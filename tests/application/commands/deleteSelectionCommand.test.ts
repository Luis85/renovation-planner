import { afterEach, expect, it, vi } from 'vitest';
import { groupDeletionStack } from '../../helpers/groupDeletion';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { ReversibleDeleteZoneCommand } from '../../../src/application/commands/zone/reversible-delete-zone-command';
import { DeleteSelectionCommand, type DeleteSelectionDeps } from '../../../src/application/commands/spatial/DeleteSelectionCommand';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { err } from '../../../src/core/result/Result';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';

afterEach(() => vi.restoreAllMocks());

/** `groupDeletionStack`'s "Assembly" group as the editor selects it: its members plus the door hosted on `wall-a`. */
const ASSEMBLY_STRUCTURE = ['wall-a', 'element-table', 'wall-b', 'opening-door'];

async function rig() {
	const base = await groupDeletionStack(), locks = new ReferenceLocks();
	const deps: DeleteSelectionDeps = {
		deleteRoom: zoneId => new ReversibleDeleteZoneCommand(makeDeleteZoneCommand(base.stack.zones, base.stack.events, base.stack.requirements), base.stack.zones, base.ledger,
			{ zoneId }, { boundary: base.services.roomHistory(), events: base.stack.events, requirements: base.stack.requirements, locks, logger: base.stack.logger }),
		renovation: base.renovation, ledger: base.ledger,
	};
	/** A deletion confirmed against the floor as it reads now. */
	const remove = async (roomIds: readonly string[], structureIds: readonly string[]) =>
		new DeleteSelectionCommand(deps, { baseline: expectOk(await base.renovation.read(base.plan.id)), roomIds: roomIds as ZoneId[], structureIds });
	async function floor() {
		const read = expectOk(await base.renovation.read(base.plan.id));
		return { document: read.geometry.document, names: read.plan.entity.spatialElements ?? [],
			zones: expectOk(await base.stack.zones.listByPlan(base.plan.id)).loaded.map(zone => zone.entity.id) };
	}
	/** Fails the renovation read `nth` from now (1 is the pre-write check, 2 the structure step's), leaving the others real. */
	function failRead(nth: 1 | 2) {
		const read = base.renovation.read.bind(base.renovation), spy = vi.spyOn(base.renovation, 'read');
		if (nth === 2) spy.mockImplementationOnce(read);
		spy.mockResolvedValueOnce(err(injectedPersistenceError()));
	}
	return { ...base, deps, remove, floor, failRead };
}

it('deletes a group of a room, its walls, a hosted opening and an element as one step, keeping the unrelated group', async () => {
	const r = await rig(), before = await r.floor();
	expectOk(await (await r.remove([r.id], ASSEMBLY_STRUCTURE)).execute());
	const after = await r.floor(), structure = after.document.structure;
	expect(after.zones).toEqual(before.zones.filter(id => id !== r.id));
	expect(after.document.objects).toEqual([]);
	expect(structure?.walls.map(wall => wall.id)).toEqual(['wall-c', 'wall-d']);
	expect(structure?.openings).toEqual([]);
	expect(structure?.boundaries).toEqual([]);
	expect(structure?.elements ?? []).toEqual([]);
	expect(after.names).toEqual([]);
	expect(after.document.groups).toEqual([r.unrelated]);
});

it('undoes the whole deletion in one step and redoes it, twice over', async () => {
	// Annotated: fallow resolves `execute`/`undo` through an explicit type, not through `remove`'s awaited return.
	const r = await rig(), before = await r.floor(), command: DeleteSelectionCommand = await r.remove([r.id], ASSEMBLY_STRUCTURE);
	expectOk(await command.execute());
	const removed = await r.floor();
	for (let cycle = 0; cycle < 2; cycle++) {
		expectOk(await command.undo());
		expect(await r.floor()).toEqual(before);
		expectOk(await command.execute());
		expect(await r.floor()).toEqual(removed);
	}
});

it('publishes what its composed commands publish, in step order on execute and reversed on undo', async () => {
	const r = await rig(), command = await r.remove([r.id], ASSEMBLY_STRUCTURE), publish = vi.spyOn(r.stack.events, 'publish');
	const types = () => publish.mock.calls.map(([event]) => event.type);
	expectOk(await command.execute());
	expect(types()).toEqual(['ZoneDeleted', 'PlanRenovationChanged']);
	publish.mockClear();
	expectOk(await command.undo());
	expect(types()).toEqual(['PlanRenovationChanged', 'ZoneCreated']);
});

it('skips the structure step for rooms alone, and deletes structure alone without touching a room', async () => {
	const rooms = await rig(), command = await rooms.remove([rooms.id], []), read = vi.spyOn(rooms.deps.renovation, 'read');
	expectOk(await command.execute());
	expect(read).toHaveBeenCalledOnce();
	expect((await rooms.floor()).zones).toEqual([]);
	const structure = await rig(), before = await structure.floor();
	expectOk(await (await structure.remove([], ['element-table'])).execute());
	const after = await structure.floor();
	expect(after.zones).toEqual(before.zones);
	expect(after.document.structure?.elements ?? []).toEqual([]);
});

it('refuses a floor changed since the confirmed read, before deleting anything', async () => {
	const r = await rig(), command = await r.remove([r.id], ASSEMBLY_STRUCTURE), read = expectOk(await r.geometry.read(r.plan.id));
	expectOk(await r.geometry.write(r.plan.id, { ...read.document, groups: [r.unrelated] }, read.version));
	const changed = await r.floor();
	expect(expectErr(await command.execute()).category).toBe('Validation');
	expect(await r.floor()).toEqual(changed);
});

it('writes nothing when the check fails, and puts deleted rooms back when a later room or the structure read or write refuses', async () => {
	for (const failing of ['check', 'room', 'read', 'write'] as const) {
		const r = await rig(), before = await r.floor(), command = await r.remove(failing === 'room' ? [r.id, 'zone-missing'] : [r.id], ASSEMBLY_STRUCTURE);
		if (failing === 'check') r.failRead(1);
		if (failing === 'read') r.failRead(2);
		if (failing === 'write') vi.spyOn(r.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
		const error = expectErr(await command.execute());
		expect(error.code).toBe(failing === 'room' ? 'zone.zone-not-found' : 'test.injected-failure');
		expect(leftWritesBehind(error)).toBe(false);
		expect(await r.floor()).toEqual(before);
		vi.restoreAllMocks();
	}
});

it('reports writes left behind when putting a deleted room back fails too', async () => {
	const r = await rig(), command = await r.remove([r.id], ASSEMBLY_STRUCTURE);
	r.failRead(2);
	vi.spyOn(r.stack.zones, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
	const error = expectErr(await command.execute());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(true);
});

it('answers no-write for an undo attempted before the first execute', async () => {
	const r = await rig(), before = await r.floor();
	expect(expectOk(await (await r.remove([r.id], ASSEMBLY_STRUCTURE)).undo())).toBe('no-write');
	expect(await r.floor()).toEqual(before);
});
