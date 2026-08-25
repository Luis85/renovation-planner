import { describe, expect, it } from 'vitest';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../../../src/application/commands/zone/DeleteZone';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleCreateZoneCommand } from '../../../../src/application/commands/zone/reversible-create-zone-command';
import { SessionWriteLedger, type WriteLedger } from '../../../../src/application/editor/WriteLedger';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectErr, expectOk, injectedPersistenceError, RecordingEventBus } from '../../../helpers/domain';
import { makePlan, squareAt } from '../../../helpers/entities';
import { createPolygon } from '../../../../src/core/geometry/Polygon';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { ReversibleMoveZoneCommand } from '../../../../src/presentation/editor/tools/reversible-move-zone-command';

/**
 * Design slice 8 — `ReversibleCreateZoneCommand` (docs/tasks/08-zone-editing.md,
 * "Un-creating a zone"). The DoD's headline sequences are asserted by ID, never merely by
 * "a zone exists again": the fresh-identity bug this adapter exists to prevent passes
 * that weaker assertion.
 */

async function wired() {
	const plans = new InMemoryPlanRepository();
	const plan = makePlan({ projectId: createProjectId() });
	await plans.save(plan, 'absent');
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const ledger: WriteLedger = new SessionWriteLedger();
	const makeCommand = () =>
		new ReversibleCreateZoneCommand(
			new CreateZoneCommand(zones, plans, events),
			new DeleteZoneCommand(zones, events),
			zones,
			ledger,
			{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
		);
	return { zones, ledger, makeCommand };
}

function expectId(id: string | null): string {
	if (id === null) throw new Error('expected the command to have created its zone');
	return id;
}

describe('ReversibleCreateZoneCommand', () => {
	it('creates through the plain command and exposes the created id', async () => {
		const { zones, makeCommand } = await wired();

		const command = makeCommand();
		expect(expectOk(await command.execute())).toBeUndefined();
		const zoneId = expectId(command.createdZoneId);
		expect(expectOk(await zones.getById(zoneId))?.entity.name).toBe('Living room');
	});

	it('undo removes the zone; redo restores THE SAME ID', async () => {
		const { zones, makeCommand } = await wired();

		const command = makeCommand();
		await command.execute();
		const createdId = expectId(command.createdZoneId);
		expect(expectOk(await command.undo())).toBeUndefined();
		expect(expectOk(await zones.getById(createdId))).toBeNull();

		await command.execute(); // the redo path
		const restored = expectOk(await zones.getById(createdId));
		expect(restored?.entity.id).toBe(createdId);
		expect(restored?.entity.name).toBe('Living room');
	});

	it('survives create → move → undo → undo → redo → redo with the move landing on the same entity', async () => {
		const { zones, ledger, makeCommand } = await wired();
		const history = new CommandHistory();

		const create = makeCommand();
		await history.run(create);
		const zoneId = expectId(create.createdZoneId);
		const original = expectOk(await zones.getById(zoneId))?.entity;
		if (original === undefined) throw new Error('expected the created zone to exist');

		const moved = expectOk(
			createPolygon(original.geometry.points.map((point) => ({ x: point.x + 100, y: point.y + 100 }))),
		);
		await history.run(
			new ReversibleMoveZoneCommand(
				new MoveSpatialObjectCommand(zones, new RecordingEventBus()),
				ledger,
				zoneId,
				moved,
				original.geometry,
			),
		);

		// undo #1 backs out the move; undo #2 un-creates.
		expect(expectOk(await history.undo())).toBeUndefined();
		expect(expectOk(await history.undo())).toBeUndefined();
		expect(expectOk(await zones.getById(zoneId))).toBeNull();

		// redo #1 re-creates THE SAME entity; redo #2 replays the move against its ID.
		expect(expectOk(await history.redo())).toBeUndefined();
		expect(expectOk(await history.redo())).toBeUndefined();
		const restored = expectOk(await zones.getById(zoneId));
		expect(restored?.entity.id).toBe(zoneId);
		expect(restored?.entity.geometry.points).toEqual(moved.points);
	});

	it('refuses an undo when nothing has been executed yet', async () => {
		const { makeCommand } = await wired();
		const error = expectErr(await makeCommand().undo());
		expect(error.code).toBe('zone.nothing-to-undo');
	});

	it('undo falls back to the snapshot version when the ledger has no entry for the zone', async () => {
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: createProjectId() });
		await plans.save(plan, 'absent');
		const zones = new InMemoryZoneRepository();
		const events = new RecordingEventBus();
		// A ledger that never answers: the adapter must fall back to the version its own
		// execute captured, and the undo must still land.
		const silentLedger: WriteLedger = {
			lastWritten: () => null,
			record: () => undefined,
		};
		const command = new ReversibleCreateZoneCommand(
			new CreateZoneCommand(zones, plans, events),
			new DeleteZoneCommand(zones, events),
			zones,
			silentLedger,
			{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
		);

		await command.execute();
		expect(expectOk(await command.undo())).toBeUndefined();
		expect(await zones.getById(command.createdZoneId as never)).toMatchObject({ value: null });
	});

	it('propagates a failed create without capturing a snapshot', async () => {
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: createProjectId() });
		await plans.save(plan, 'absent');
		class FailingSave extends InMemoryZoneRepository {
			override save() {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
		}
		const zones = new FailingSave();
		const events = new RecordingEventBus();
		const command = new ReversibleCreateZoneCommand(
			new CreateZoneCommand(zones, plans, events),
			new DeleteZoneCommand(new InMemoryZoneRepository(), events),
			zones,
			new SessionWriteLedger(),
			{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
		);

		expect(expectErr(await command.execute()).code).toBe('test.injected-failure');
		expect(command.createdZoneId).toBeNull();
	});
});
