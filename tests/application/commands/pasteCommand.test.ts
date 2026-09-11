import { afterEach, expect, it, vi } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { expectDefined, expectErr, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { renovationServices } from '../../../src/application/commands/renovation/RenovationCommand';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { PasteCommand, type PasteDeps } from '../../../src/application/commands/spatial/PasteCommand';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { ReversibleCreateZoneCommand } from '../../../src/application/commands/zone/reversible-create-zone-command';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import type { PlanGeometryDocument } from '../../../src/application/ports/PlanGeometrySidecar';
import type { EntityVersion } from '../../../src/application/ports/versioning';
import type { Point } from '../../../src/core/geometry/Point';
import { createEntityId } from '../../../src/core/identity/generateId';
import { err } from '../../../src/core/result/Result';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import { captureClipboard, type ClipboardFloor, type SpatialClipboard } from '../../../src/domain/spatial/clipboard';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';

afterEach(() => vi.restoreAllMocks());

const SOURCE: ClipboardFloor = {
	rooms: [{ key: 'zone-source', name: 'Kitchen', zoneType: 'Room', points: WALL_LOOP.walls.map(item => item.start) }],
	structure: {
		...WALL_LOOP,
		openings: [{ id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end', side: 'right', angle: 65 } }],
		boundaries: [{ roomId: 'zone-source', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }],
		elements: [{ id: 'element-arrow', kind: 'arrow', points: [{ x: 1000, y: 1000 }, { x: 2000, y: 1000 }] }],
	},
	names: [{ id: 'element-arrow', name: 'Entry' }],
	groups: [{ id: 'group-source', name: 'Kitchen set', memberIds: ['zone-source', 'wall-a'] }],
};
const CLIP = expectDefined(captureClipboard(SOURCE, ['zone-source', 'element-arrow']), 'clipboard');

/** Two Rooms: the first with WALL_LOOP's walls and a boundary, the second bare, both in one group. */
const TWO_ROOM_SOURCE: ClipboardFloor = {
	rooms: [
		{ key: 'zone-source', name: 'Kitchen', zoneType: 'Room', points: WALL_LOOP.walls.map(item => item.start) },
		{ key: 'zone-second', name: 'Pantry', zoneType: 'Room', points: [{ x: 20000, y: 0 }, { x: 21000, y: 0 }, { x: 21000, y: 1000 }] },
	],
	structure: { ...WALL_LOOP, boundaries: [{ roomId: 'zone-source', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }] },
	names: [],
	groups: [{ id: 'group-two', name: 'Kitchen and pantry', memberIds: ['zone-source', 'zone-second'] }],
};
const CLIP2 = expectDefined(captureClipboard(TWO_ROOM_SOURCE, ['zone-source', 'zone-second']), 'two-room clipboard');
const TWO_ROOM_TARGET: Point = { x: 15000, y: 0 };

/** A paste wired over a real stack — `renovationStack`'s floor (a Room, its walls) or `structureStack`'s empty one. */
function wire<T extends Awaited<ReturnType<typeof structureStack>>>(base: T) {
	const { stack, plan, geometry, ledger } = base;
	const create = new CreateZoneCommand(stack.zones, stack.plans, stack.events), remove = makeDeleteZoneCommand(stack.zones, stack.events, stack.requirements);
	const deps: PasteDeps = {
		createRoom: input => new ReversibleCreateZoneCommand(create, remove, ledger, input, { zones: stack.zones, requirements: stack.requirements, events: stack.events, logger: stack.logger }),
		renovation: renovationServices(stack.plans, geometry, stack.events), groups: groupGeometryServices(geometry, stack.zones, stack.events), ledger, mintId: prefix => createEntityId(prefix),
	};
	const paste = (target: Point = { x: 10000, y: 0 }) => new PasteCommand(deps, { planId: plan.id, clipboard: CLIP, target });
	async function floor() {
		const { document } = expectOk(await geometry.read(plan.id)), entity = expectFound(await stack.plans.getById(plan.id)).entity;
		return { structure: document.structure ?? EMPTY_STRUCTURE, groups: document.groups ?? [], objects: document.objects,
			intended: document.intended, calibration: document.calibration, names: entity.spatialElements ?? [], plan: entity,
			zones: expectOk(await stack.zones.listByPlan(plan.id)).loaded.map(zone => zone.entity) };
	}
	return { ...base, deps, paste, floor };
}
const rig = async () => wire(await renovationStack());
type Rig = Awaited<ReturnType<typeof rig>>;
type FloorSnapshot = Awaited<ReturnType<Rig['floor']>>;

/** Fails the sidecar writes, counted from now, that `failing` picks; the rest reach the real store. */
function failWrites(r: Rig, failing: (call: number) => boolean) {
	const write = r.geometry.write.bind(r.geometry);
	let calls = 0;
	vi.spyOn(r.geometry, 'write').mockImplementation((planId: PlanId, document: PlanGeometryDocument, expected?: EntityVersion) =>
		failing(++calls) ? Promise.resolve(err(injectedPersistenceError())) : write(planId, document, expected));
}

/**
 * The whole sidecar document (structure, groups, planned geometry, calibration) and the plan
 * entity (renovation, element metadata) — everything a refusal or a rollback must leave exactly
 * as it found it. `objects` and `zones` are asserted separately by callers that expect them
 * unchanged too: a test racing an outside write legitimately sees those two differ.
 */
function expectSidecarUnchanged(after: FloorSnapshot, before: FloorSnapshot) {
	expect(after.structure).toEqual(before.structure);
	expect(after.groups).toEqual(before.groups);
	expect(after.intended).toEqual(before.intended);
	expect(after.calibration).toEqual(before.calibration);
	expect(after.plan).toEqual(before.plan);
}

it('writes the rooms, walls, openings, elements, names and groups of a paste as one step under new ids', async () => {
	const r = await rig(), before = await r.floor(), command = r.paste();
	expectOk(await command.execute());
	const after = await r.floor();
	const room = expectDefined(after.zones.find(zone => zone.id === command.pastedIds[0]), 'pasted room');
	expect(room).toMatchObject({ name: 'Kitchen', zoneType: 'Room' });
	expect(room.geometry.points).toEqual([{ x: 8000, y: -1500 }, { x: 12000, y: -1500 }, { x: 12000, y: 1500 }, { x: 8000, y: 1500 }]);
	const walls = after.structure.walls.slice(before.structure.walls.length), openings = after.structure.openings.slice(before.structure.openings.length);
	const elements = after.structure.elements ?? [];
	expect(walls.map(item => item.start)).toEqual([{ x: 8000, y: -1500 }, { x: 12000, y: -1500 }, { x: 12000, y: 1500 }, { x: 8000, y: 1500 }]);
	expect(openings).toEqual([{ ...SOURCE.structure.openings[0], id: expect.stringMatching(/^opening-/), hostId: walls[0].id }]);
	expect(after.structure.boundaries.at(-1)).toEqual({ roomId: room.id, wallIds: walls.map(item => item.id) });
	expect(after.names).toEqual([{ id: elements[0].id, name: 'Entry' }]);
	expect(after.groups).toEqual([{ id: expect.stringMatching(/^group-/), name: 'Kitchen set', memberIds: [room.id, walls[0].id] }]);
	expect(command.pastedIds).toEqual([room.id, ...walls.map(item => item.id), openings[0].id, elements[0].id]);
	expect(JSON.stringify(after)).not.toMatch(/"(zone-source|opening-door|element-arrow|group-source)"/);
});

it('undoes the whole paste in one step and redoes it under the same ids', async () => {
	const r = await rig(), before = await r.floor(), command = r.paste();
	expectOk(await command.execute());
	const pasted = await r.floor();
	expectOk(await command.undo());
	const undone = await r.floor();
	expect(undone.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(undone.objects).toEqual(before.objects);
	expectSidecarUnchanged(undone, before);
	expectOk(await command.execute());
	const redone = await r.floor();
	expect(redone.zones.map(zone => zone.id)).toEqual(pasted.zones.map(zone => zone.id));
	expect(redone.objects).toEqual(pasted.objects);
	expectSidecarUnchanged(redone, pasted);
});

it('refuses a paste whose walls cross the floor\'s own before writing a single room, and announces nothing', async () => {
	const r = await rig(), before = await r.floor(), save = vi.spyOn(r.stack.zones, 'save'), publish = vi.spyOn(r.stack.events, 'publish'), mintId = vi.spyOn(r.deps, 'mintId');
	expect(expectErr(await r.paste({ x: 2000, y: 1500 }).execute()).code).toBe('spatial.intersection');
	expect(save).not.toHaveBeenCalled();
	expect(publish).not.toHaveBeenCalled();
	expect(mintId).not.toHaveBeenCalled();
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.objects).toEqual(before.objects);
	expectSidecarUnchanged(after, before);
});

it('publishes what its composed commands publish, in step order on execute and reversed on undo', async () => {
	const r = await rig(), command = r.paste(), publish = vi.spyOn(r.stack.events, 'publish');
	const types = () => publish.mock.calls.map(([event]) => event.type);
	expectOk(await command.execute());
	expect(types()).toEqual(['ZoneCreated', 'PlanRenovationChanged', 'PlanStructureChanged']);
	publish.mockClear();
	expectOk(await command.undo());
	expect(types()).toEqual(['PlanStructureChanged', 'PlanRenovationChanged', 'ZoneDeleted']);
});

it('undoes the structure and the rooms when the group write fails', async () => {
	const r = await rig(), before = await r.floor();
	failWrites(r, call => call === 2);
	const error = expectErr(await r.paste().execute());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(false);
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.objects).toEqual(before.objects);
	expectSidecarUnchanged(after, before);
});

it('reports writes left behind when undoing a failed paste fails too', async () => {
	const r = await rig();
	failWrites(r, call => call >= 2);
	const error = expectErr(await r.paste().execute());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(true);
});

it('refuses the undo after an outside write and leaves the paste in place', async () => {
	const r = await rig(), command = r.paste();
	expectOk(await command.execute());
	const pasted = await r.floor();
	expectOk(await new CreateZoneCommand(r.stack.zones, r.stack.plans, r.stack.events).execute({ planId: r.plan.id, name: 'Hall', zoneType: 'Room', geometry: { points: [{ x: -5000, y: 0 }, { x: -4000, y: 0 }, { x: -4000, y: 1000 }] } }));
	expect(expectErr(await command.undo()).code).toBe('undo.superseded');
	const after = await r.floor();
	// `objects` and `zones` are not part of `expectSidecarUnchanged` — every other case in this
	// file asserts them separately alongside it. This one doesn't: the outside "Hall" create
	// legitimately added one of each, and that is what this test is proving the refused undo did
	// not also touch.
	expectSidecarUnchanged(after, pasted);
});

it('re-applies what an undo had already taken back when a later step refuses', async () => {
	const r = await rig(), command = r.paste();
	expectOk(await command.execute());
	const pasted = await r.floor();
	failWrites(r, call => call === 2);
	const error = expectErr(await command.undo());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(false);
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(pasted.zones.map(zone => zone.id));
	expect(after.objects).toEqual(pasted.objects);
	expectSidecarUnchanged(after, pasted);
});

it('pastes onto a floor that already holds renovation, elements and groups, keeping all of them', async () => {
	const r = await rig(), baseline = expectOk(await r.read());
	expectOk(await r.renovation.command(baseline, { renovation: r.value, intended: baseline.geometry.document.intended }, r.ledger).execute());
	expectOk(await r.paste({ x: 10000, y: 0 }).execute());
	expectOk(await r.paste({ x: 20000, y: 0 }).execute());
	const after = await r.floor();
	expect(after.plan.renovation).toEqual(r.value);
	expect(after.structure.walls).toHaveLength(12);
	expect(after.structure.elements).toHaveLength(2);
	expect(after.names).toHaveLength(2);
	expect(after.groups).toHaveLength(2);
});

it('pastes a room with its walls and boundary back onto the floor it was copied from', async () => {
	const r = await rig(), floor = await r.floor();
	const rooms = floor.zones.map(zone => ({ key: zone.id, name: zone.name, zoneType: zone.zoneType, points: zone.geometry.points }));
	const clipboard = expectDefined(captureClipboard({ rooms, structure: floor.structure, names: floor.names, groups: floor.groups }, [r.roomId]), 'same-floor clipboard');
	// The copied room's key IS a zone on this floor, which is what the refusal check's stand-in ids must not collide with.
	expect(clipboard.structure.boundaries.map(boundary => boundary.roomId)).toEqual([r.roomId]);
	expectOk(await new PasteCommand(r.deps, { planId: r.plan.id, clipboard, target: { x: 20000, y: 0 } }).execute());
	expect((await r.floor()).structure.boundaries).toHaveLength(floor.structure.boundaries.length + 1);
});

it('pastes onto a floor that has no structure yet', async () => {
	const r = wire(await structureStack());
	expectOk(await r.paste().execute());
	expect((await r.floor()).structure.walls).toHaveLength(4);
});

it('leaves a plan with no renovation without one after a paste, its undo and its redo', async () => {
	const r = wire(await structureStack()), before = await r.floor();
	expect(before.plan.renovation).toBeUndefined();
	const command = r.paste();
	expectOk(await command.execute());
	expect((await r.floor()).plan.renovation).toBeUndefined();
	expectOk(await command.undo());
	expect((await r.floor()).plan.renovation).toBeUndefined();
	expectOk(await command.execute());
	expect((await r.floor()).plan.renovation).toBeUndefined();
});

it('writes nothing when the floor cannot be read for the check, and undoes the rooms when a later step\'s read fails', async () => {
	for (const failing of ['check', 'renovation', 'groups'] as const) {
		const r = await rig(), before = await r.floor(), save = vi.spyOn(r.stack.zones, 'save');
		const renovationRead = r.deps.renovation.read.bind(r.deps.renovation), failure = err(injectedPersistenceError());
		if (failing === 'check') vi.spyOn(r.deps.renovation, 'read').mockResolvedValueOnce(failure);
		else if (failing === 'renovation') vi.spyOn(r.deps.renovation, 'read').mockImplementationOnce(renovationRead).mockResolvedValueOnce(failure);
		else vi.spyOn(r.deps.groups, 'read').mockResolvedValueOnce(failure);
		expect(expectErr(await r.paste().execute()).code).toBe('test.injected-failure');
		expect(save.mock.calls.length).toBe(failing === 'check' ? 0 : 1);
		const after = await r.floor();
		expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
		expect(after.objects).toEqual(before.objects);
		expectSidecarUnchanged(after, before);
	}
});

it('undoes and redoes a two-room paste under the same zone ids, structure, groups and names', async () => {
	const r = await rig(), before = await r.floor();
	const command = new PasteCommand(r.deps, { planId: r.plan.id, clipboard: CLIP2, target: TWO_ROOM_TARGET });
	expectOk(await command.execute());
	const pasted = await r.floor();
	expect(pasted.zones).toHaveLength(before.zones.length + 2);
	expect(command.pastedIds).toHaveLength(2 + pasted.structure.walls.length - before.structure.walls.length);
	expectOk(await command.undo());
	const undone = await r.floor();
	expect(undone.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(undone.objects).toEqual(before.objects);
	expectSidecarUnchanged(undone, before);
	expectOk(await command.execute());
	const redone = await r.floor();
	expect(redone.zones.map(zone => zone.id)).toEqual(pasted.zones.map(zone => zone.id));
	expect(redone.objects).toEqual(pasted.objects);
	expectSidecarUnchanged(redone, pasted);
});

it('undoes the first room when the second room of a two-room paste fails to save', async () => {
	const r = await rig(), before = await r.floor();
	const save = r.stack.zones.save.bind(r.stack.zones);
	let calls = 0;
	vi.spyOn(r.stack.zones, 'save').mockImplementation((zone, expected) =>
		++calls === 2 ? Promise.resolve(err(injectedPersistenceError())) : save(zone, expected));
	const command = new PasteCommand(r.deps, { planId: r.plan.id, clipboard: CLIP2, target: TWO_ROOM_TARGET });
	const error = expectErr(await command.execute());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(false);
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.objects).toEqual(before.objects);
	expectSidecarUnchanged(after, before);
});

it('refuses and writes nothing when the first room fails to save', async () => {
	const r = await rig(), before = await r.floor();
	vi.spyOn(r.stack.zones, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
	const error = expectErr(await r.paste().execute());
	expect(error.code).toBe('test.injected-failure');
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.objects).toEqual(before.objects);
	expectSidecarUnchanged(after, before);
});

it('skips the structure and group steps for a room copied with no walls and no groups', async () => {
	const floor: ClipboardFloor = {
		rooms: [{ key: 'zone-lone', name: 'Lone', zoneType: 'Room', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] }],
		structure: EMPTY_STRUCTURE, names: [], groups: [],
	};
	const clip = expectDefined(captureClipboard(floor, ['zone-lone']), 'lone-room clipboard');
	const r = wire(await structureStack()), before = await r.floor();
	const structureRead = vi.spyOn(r.deps.renovation, 'read'), groupsRead = vi.spyOn(r.deps.groups, 'read');
	const command = new PasteCommand(r.deps, { planId: r.plan.id, clipboard: clip, target: { x: 10000, y: 0 } });
	expectOk(await command.execute());
	expect(structureRead).not.toHaveBeenCalled();
	expect(groupsRead).not.toHaveBeenCalled();
	const after = await r.floor();
	expect(after.zones).toHaveLength(before.zones.length + 1);
	expect(after.structure).toEqual(before.structure);
	expect(after.groups).toEqual(before.groups);
	expect(command.pastedIds).toHaveLength(1);
});

it('refuses a hand-built clipboard whose opening names a host wall it never captured, before writing anything', async () => {
	// `placedStructure` trusts every reference inside a captured clipboard to name something the
	// clipboard holds (its own docblock says so); `captureClipboard` upholds that, so this
	// dangling reference is built by hand rather than produced by a copy. It proves the pre-write
	// check in `refusal()` refuses the paste before any write, rather than writing an opening
	// whose `hostId` silently became `undefined`.
	const r = await rig(), before = await r.floor(), save = vi.spyOn(r.stack.zones, 'save'), mintId = vi.spyOn(r.deps, 'mintId');
	const dangling: SpatialClipboard = {
		rooms: [],
		structure: {
			walls: [{ id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, height: 2400, thickness: 150 }],
			openings: [{ id: 'opening-dangling', kind: 'door', hostId: 'wall-missing', offset: 100, width: 800, height: 2100, sill: 0 }],
			boundaries: [], elements: [],
		},
		names: [], groups: [],
	};
	const error = expectErr(await new PasteCommand(r.deps, { planId: r.plan.id, clipboard: dangling, target: { x: 10000, y: 0 } }).execute());
	expect(error.code).toBe('spatial.host-missing');
	expect(save).not.toHaveBeenCalled();
	expect(mintId).not.toHaveBeenCalled();
	const after = await r.floor();
	expect(after.objects).toEqual(before.objects);
	expectSidecarUnchanged(after, before);
});

it('answers no-write for an undo attempted before the first execute', async () => {
	const r = await rig(), before = await r.floor();
	expect(expectOk(await r.paste().undo())).toBe('no-write');
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.objects).toEqual(before.objects);
	expectSidecarUnchanged(after, before);
});
