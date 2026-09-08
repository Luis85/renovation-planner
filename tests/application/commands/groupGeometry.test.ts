import { afterEach, expect, it, vi } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { encloseRoom } from '../../../src/domain/spatial/encloseRoom';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { groupMembers } from '../../../src/domain/spatial/SpatialGroup';
import { transformGroupGeometry } from '../../../src/domain/spatial/groupGeometry';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { err } from '../../../src/core/result/Result';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

afterEach(() => vi.restoreAllMocks());
async function setup() {
	const rig = await structureStack();
	const opening = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 65 } };
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: { ...WALL_LOOP, openings: [opening] }, ledger: rig.ledger, room: rig.room }).execute());
	const roomId = expectDefined(rig.room.createdZoneId, 'created Room') as ZoneId;
	const groups = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	const baseline = expectOk(await groups.read(rig.plan.id));
	const group = { id: 'group-kitchen', name: 'Kitchen assembly', memberIds: [roomId, 'wall-a'] };
	const command = groups.command({ planId: rig.plan.id, baseline, document: { ...baseline.document, groups: [group] }, ledger: rig.ledger });
	return { ...rig, roomId, groups, group, command, initial: baseline, opening };
}
it('persists a flat group and implicit hosted openings, rejects older writers, and restores the exact prior document', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write');
	expectOk(await rig.command.execute()); expect(write).toHaveBeenCalledOnce();
	const fresh = new ObsidianPlanGeometrySidecar(rig.stack.store), saved = expectOk(await fresh.read(rig.plan.id));
	expect(saved.document.groups).toEqual([rig.group]);
	expect(groupMembers(rig.group, expectDefined(saved.document.structure, 'structure'))).toEqual([rig.roomId, 'wall-a', rig.opening.id]);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto; expect(dto.schemaVersion).toBe(6);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 5));
	expect(() => older.migrateToLatest('plan-geometry', dto, 6)).toThrow('newer than this build supports');
	expectOk(await rig.command.undo()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(rig.initial.document);
	expectOk(await rig.command.execute()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(saved.document);
});
it('moves Room and wall together in one write, preserves opening facts and connected junctions, and keeps mixed Zone history reversible', async () => {
	const rig = await setup(); expectOk(await rig.command.execute());
	const room = expectFound(await rig.stack.zones.getById(rig.roomId));
	const movedFirst = room.entity.geometry.points.map(point => ({ x: point.x + 20, y: point.y + 10 }));
	const first = new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, rig.roomId, { points: movedFirst }, room.entity.geometry);
	expectOk(await first.execute());
	const baseline = expectOk(await rig.groups.read(rig.plan.id)), structure = expectDefined(baseline.document.structure, 'structure');
	const next = transformGroupGeometry(baseline.document.objects, structure, groupMembers(rig.group, structure), point => ({ x: point.x + 100, y: point.y + 200 }));
	const move = rig.groups.command({ planId: rig.plan.id, baseline, document: { ...baseline.document, ...next }, ledger: rig.ledger });
	const write = vi.spyOn(rig.geometry, 'write'); expectOk(await move.execute()); expect(write).toHaveBeenCalledOnce();
	const after = expectOk(await rig.groups.read(rig.plan.id));
	expect(after.document.structure?.openings).toEqual([rig.opening]);
	expect(after.document.structure?.walls[1].start).toEqual({ x: 4100, y: 200 });
	expect(after.document.structure?.walls[1].end).toEqual({ x: 4000, y: 3000 });
	const intermediate = expectFound(await rig.stack.zones.getById(rig.roomId));
	const laterPoints = intermediate.entity.geometry.points.map(point => ({ x: point.x + 30, y: point.y }));
	const later = new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, rig.roomId, { points: laterPoints }, intermediate.entity.geometry);
	expectOk(await later.execute()); expectOk(await later.undo()); expectOk(await move.undo()); expectOk(await first.undo());
	expect(expectFound(await rig.stack.zones.getById(rig.roomId)).entity.geometry).toEqual(room.entity.geometry);
	expectOk(await first.execute()); expectOk(await move.execute()); expectOk(await later.execute());
	expect(expectFound(await rig.stack.zones.getById(rig.roomId)).entity.geometry.points).toEqual(laterPoints);
});
it('refuses a peer sidecar write before applying or undoing, including an identical-content rewrite', async () => {
	const rig = await setup();
	const peer = expectOk(await rig.geometry.read(rig.plan.id)); expectOk(await rig.geometry.write(rig.plan.id, peer.document, peer.version));
	const write = vi.spyOn(rig.geometry, 'write'); expect((await rig.command.execute()).ok).toBe(false); expect(write).not.toHaveBeenCalled();
	const current = expectOk(await rig.groups.read(rig.plan.id));
	const command = rig.groups.command({ planId: rig.plan.id, baseline: current, document: { ...current.document, groups: [rig.group] }, ledger: rig.ledger });
	expectOk(await command.execute());
	const saved = expectOk(await rig.geometry.read(rig.plan.id)); expectOk(await rig.geometry.write(rig.plan.id, saved.document, saved.version));
	write.mockClear(); expect((await command.undo()).ok).toBe(false); expect(write).not.toHaveBeenCalled();
});
it('refuses missing members and a failed pre-write Zone version read without changing any file', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	const bad = rig.groups.command({ planId: rig.plan.id, baseline: rig.initial, document: { ...rig.initial.document, groups: [{ ...rig.group, memberIds: ['missing'] }] }, ledger: rig.ledger });
	expect((await bad.execute()).ok).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
	const next = transformGroupGeometry(rig.initial.document.objects, expectDefined(rig.initial.document.structure, 'walls'), rig.group.memberIds, point => ({ x: point.x + 50, y: point.y }));
	vi.spyOn(rig.stack.zones, 'prepareGeometryVersions').mockResolvedValue(err(injectedPersistenceError()));
	const command = rig.groups.command({ planId: rig.plan.id, baseline: rig.initial, document: { ...rig.initial.document, ...next }, ledger: rig.ledger });
	expect((await command.execute()).ok).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('encloses a Room and creates its group in one reversible write, reusing exact existing walls', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const roomId = expectDefined(rig.room.createdZoneId, 'Room') as ZoneId;
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	let counter = 0;
	const room = expectDefined(baseline.document.objects.find(object => object.id === roomId), 'Room outline');
	const enclosed = expectOk(encloseRoom(room, EMPTY_STRUCTURE, { height: 2400, thickness: 150 }, () => `wall-enclosure-${counter++}`));
	expect(enclosed.createdIds).toHaveLength(4);
	const repeated = expectOk(encloseRoom(room, enclosed.structure, { height: 2400, thickness: 150 }, () => `wall-enclosure-${counter++}`));
	expect(repeated.createdIds).toEqual([]); expect(repeated.structure.walls).toEqual(enclosed.structure.walls);
	const groups = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	const command = groups.command({ planId: rig.plan.id, baseline, ledger: rig.ledger, document: { ...baseline.document,
		structure: enclosed.structure, groups: [{ id: 'group-enclosure', name: 'Kitchen', memberIds: [roomId, ...enclosed.wallIds] }] } });
	const write = vi.spyOn(rig.geometry, 'write'); expectOk(await command.execute()); expect(write).toHaveBeenCalledOnce();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups?.[0].memberIds).toHaveLength(5);
	expectOk(await command.undo()); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(baseline.document);
	expect(expectFound(await rig.stack.zones.getById(roomId)).entity.geometry.points).toEqual(room.points);
});
