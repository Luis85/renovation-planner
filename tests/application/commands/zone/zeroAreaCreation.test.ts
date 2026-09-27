import { describe, expect, it } from 'vitest';
import { structureStack } from '../../../helpers/structure';
import { makeDeleteZoneCommand } from '../../../helpers/slice10';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { renovationServices } from '../../../../src/application/commands/renovation/RenovationCommand';
import { groupGeometryServices } from '../../../../src/application/commands/spatial/GroupGeometryCommand';
import { PasteCommand, type PasteDeps } from '../../../../src/application/commands/spatial/PasteCommand';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { ReversibleCreateZoneCommand } from '../../../../src/application/commands/zone/reversible-create-zone-command';
import { createEntityId } from '../../../../src/core/identity/generateId';
import { captureClipboard } from '../../../../src/domain/spatial/clipboard';
import { EMPTY_STRUCTURE } from '../../../../src/domain/spatial/Structure';

/**
 * L-23, ruling 34: the creation doors, driven through the real commands over the in-memory
 * vault. Each asserts the vault's own entries against a snapshot taken before the attempt, which
 * is the whole of what "nothing was written" means here — the fake vault's files, not the disk.
 */
const COLLINEAR = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 }];

async function wired() {
	const base = await structureStack();
	const { stack, geometry, ledger } = base;
	const create = new CreateZoneCommand(stack.zones, stack.plans, stack.events);
	const deps: PasteDeps = {
		createRoom: input => new ReversibleCreateZoneCommand(create, makeDeleteZoneCommand(stack.zones, stack.events, stack.requirements), ledger, input,
			{ zones: stack.zones, requirements: stack.requirements, events: stack.events, logger: stack.logger }),
		renovation: renovationServices(stack.plans, geometry, stack.events),
		groups: groupGeometryServices(geometry, stack.zones, stack.events),
		ledger,
		mintId: prefix => createEntityId(prefix),
	};
	return { ...base, create, deps, entries: () => new Map(stack.vault.entries) };
}

describe('a zone outline that encloses no area cannot be created', () => {
	it('through CreateZoneCommand, which writes nothing', async () => {
		const r = await wired(), before = r.entries();
		const error = expectErr(await r.create.execute({ planId: r.plan.id, name: 'Sliver', zoneType: 'Room', geometry: { points: COLLINEAR } }));
		expect(error.code).toBe('polygon-zero-area');
		expect(r.entries()).toEqual(before);
	});

	/**
	 * The door `Zone.withGeometry` alone left open: a Room already sitting in a vault without an
	 * area is copied verbatim by `captureClipboard`, and a paste used to write a second one.
	 */
	it('through a paste of a copied Room that encloses none, which writes nothing', async () => {
		const r = await wired(), before = r.entries();
		const clipboard = expectDefined(captureClipboard({
			rooms: [{ key: 'zone-sliver', name: 'Sliver', zoneType: 'Room', points: COLLINEAR }],
			structure: EMPTY_STRUCTURE, names: [], groups: [],
		}, ['zone-sliver']), 'clipboard');
		const paste = new PasteCommand(r.deps, { planId: r.plan.id, clipboard, target: { x: 5000, y: 5000 } });

		expect(expectErr(await paste.execute()).code).toBe('polygon-zero-area');
		expect(expectOk(await r.stack.zones.listByPlan(r.plan.id)).loaded).toHaveLength(0);
		expect(r.entries()).toEqual(before);
	});

	it('while a paste of a Room that does enclose one is still written', async () => {
		const r = await wired();
		const clipboard = expectDefined(captureClipboard({
			rooms: [{ key: 'zone-room', name: 'Room', zoneType: 'Room', points: [...COLLINEAR.slice(0, 2), { x: 1000, y: 1000 }] }],
			structure: EMPTY_STRUCTURE, names: [], groups: [],
		}, ['zone-room']), 'clipboard');
		expectOk(await new PasteCommand(r.deps, { planId: r.plan.id, clipboard, target: { x: 5000, y: 5000 } }).execute());
		expect(expectOk(await r.stack.zones.listByPlan(r.plan.id)).loaded).toHaveLength(1);
	});
});
