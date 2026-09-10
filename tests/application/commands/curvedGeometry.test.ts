import { afterEach, expect, it, vi } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';

afterEach(() => vi.restoreAllMocks());
async function setup() {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const id = expectDefined(rig.room.createdZoneId, 'Room') as ZoneId, groups = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	const baseline = expectOk(await groups.read(rig.plan.id));
	const opening = { id: 'opening-curved', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 65 } };
	const document = { ...baseline.document, objects: baseline.document.objects.map(object => object.id === id ? { ...object, bulges: [0.25, 0, 0, 0] } : object),
		groups: [{ id: 'group-curved', name: 'Curved kitchen', memberIds: [id, 'wall-a'] }],
		structure: { ...WALL_LOOP, walls: WALL_LOOP.walls.map((wall, index) => index === 0 ? { ...wall, bulge: 0.25 } : wall), openings: [opening] } };
	const command = groups.command({ planId: rig.plan.id, baseline, document, ledger: rig.ledger });
	return { ...rig, id, groups, original: baseline, document, command, opening };
}
it('round-trips schema7 curves with groups and opening swings, rejects older readers, and reverses exactly', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write'); expectOk(await rig.command.execute()); expect(write).toHaveBeenCalledOnce();
	const fresh = new ObsidianPlanGeometrySidecar(rig.stack.store), saved = expectOk(await fresh.read(rig.plan.id)); expect(saved.document).toEqual(rig.document);
	const room = expectFound(await rig.stack.zones.getById(rig.id)).entity; expect(room.geometry.bulges).toEqual([0.25, 0, 0, 0]); expect(expectOk(room.area())).toBeGreaterThan(12e6);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto; expect(dto.schemaVersion).toBe(7);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 6));
	expect(() => older.migrateToLatest('plan-geometry', dto, 7)).toThrow('newer than this build supports');
	expectOk(await rig.command.undo()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(rig.original.document);
	expectOk(await rig.command.execute()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(saved.document);
});
it('carries curve-only Zone receipts through mixed legacy point movement, curve edits and exact Undo/Redo', async () => {
	const rig = await setup(); expectOk(await rig.command.execute());
	const original = expectFound(await rig.stack.zones.getById(rig.id));
	const move = new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events);
	const first = new ReversibleMoveZoneCommand(move, rig.ledger, rig.id, { points: original.entity.geometry.points.map(point => ({ x: point.x + 20, y: point.y + 10 })) }, original.entity.geometry);
	expectOk(await first.execute());
	const baseline = expectOk(await rig.groups.read(rig.plan.id));
	const document = { ...baseline.document, objects: baseline.document.objects.map(object => object.id === rig.id ? { ...object, bulges: [0.5, 0, 0, 0] } : object) };
	const curve = rig.groups.command({ planId: rig.plan.id, baseline, document, ledger: rig.ledger }); expectOk(await curve.execute());
	const intermediate = expectFound(await rig.stack.zones.getById(rig.id)); expect(intermediate.entity.geometry.bulges).toEqual([0.5, 0, 0, 0]);
	const points = intermediate.entity.geometry.points.map(point => ({ x: point.x + 30, y: point.y }));
	const later = new ReversibleMoveZoneCommand(move, rig.ledger, rig.id, { points }, intermediate.entity.geometry);
	expectOk(await later.execute()); expect(expectFound(await rig.stack.zones.getById(rig.id)).entity.geometry.bulges).toEqual([0.5, 0, 0, 0]);
	expectOk(await later.undo()); expectOk(await curve.undo()); expectOk(await first.undo());
	expect(expectFound(await rig.stack.zones.getById(rig.id)).entity.geometry).toEqual(original.entity.geometry);
	expectOk(await first.execute()); expectOk(await curve.execute()); expectOk(await later.execute());
	expect(expectFound(await rig.stack.zones.getById(rig.id)).entity.geometry).toEqual({ points, bulges: [0.5, 0, 0, 0] });
});
it('observes curve-only peer changes and refuses ambiguous point-only topology changes without writing', async () => {
	const rig = await setup(); expectOk(await rig.command.execute());
	const old = expectFound(await rig.stack.zones.getById(rig.id)), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const object = expectDefined(baseline.document.objects.find(value => value.id === rig.id), 'curve entry');
	const prepared = expectOk(await rig.stack.zones.prepareGeometryVersions(rig.id, object));
	expect(expectDefined(prepared, 'frozen version').zone.entity.geometry.bulges).toEqual(object.bulges);
	const peer = { ...baseline.document, objects: baseline.document.objects.map(value => value.id === rig.id ? { ...value, bulges: [0.4, 0, 0, 0] } : value) };
	expectOk(await rig.geometry.write(rig.plan.id, peer, baseline.version));
	const changed = expectFound(await rig.stack.zones.getById(rig.id)); expect(changed.version.observed).not.toBe(old.version.observed);
	const bytes = [...rig.stack.vault.entries]; expect((await rig.stack.zones.save(old.entity, old.version)).ok).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
	const result = await new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events).execute({ zoneId: rig.id, geometry: { points: changed.entity.geometry.points.slice(0, 3) } });
	expect(result.ok).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
	const current = expectOk(await rig.geometry.read(rig.plan.id));
	expect((await rig.geometry.write(rig.plan.id, { ...current.document, objects: current.document.objects.map(value => ({ ...value, bulges: [2, 0, 0, 0] })) }, current.version)).ok).toBe(false);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
