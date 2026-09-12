import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectOk } from '../../helpers/domain';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { SpatialObjectGeometrySchemaV10 } from '../../../src/infrastructure/persistence/dto/planGeometry';
import { observeZone } from '../../../src/infrastructure/obsidian/repositories/digest';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';

/** ADR-0029: a moved canvas caption is sidecar geometry, stored as an offset from its automatic anchor. */
const plainCabinet: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }] };
const cabinet: SpatialElement = { ...plainCabinet, labelOffset: { dx: 250, dy: -120 } };

it('round-trips a room and an element label offset at schema 10 and refuses them to a schema-9 reader', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const objects = baseline.document.objects.map(object => ({ ...object, labelOffset: { dx: -400, dy: 300 } }));
	expect(objects.length).toBeGreaterThan(0);
	const document = { ...baseline.document, objects, structure: { ...WALL_LOOP, elements: [cabinet] } };
	expectOk(await rig.geometry.write(rig.plan.id, document, baseline.version));
	expect(expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id)).document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(10);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 9));
	expect(() => older.migrateToLatest('plan-geometry', dto, 10)).toThrow('newer than this build supports');
});

it('writes the lowest schema that holds the content while no caption is moved', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...WALL_LOOP, elements: [plainCabinet] } }, baseline.version));
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(4);
	expect(PLAN_GEOMETRY_MIGRATIONS.at(-1)?.migrate({ schemaVersion: 9, revision: 2 })).toEqual({ schemaVersion: 10, revision: 2 });
});

it('refuses an offset that is not a pair of numbers, and lets a zone version see an offset change', () => {
	const entry = { id: 'zone-1', type: 'polygon' as const, points: [[0, 0], [10, 0], [10, 10]] as [number, number][] };
	expect(SpatialObjectGeometrySchemaV10.safeParse({ ...entry, labelOffset: { dx: 'far', dy: 0 } }).success).toBe(false);
	expect(SpatialObjectGeometrySchemaV10.safeParse({ ...entry, labelOffset: { dx: 5, dy: 0 } }).success).toBe(true);
	const frontmatter = { id: 'zone-1', revision: 1 };
	expect(observeZone(frontmatter, { ...entry, labelOffset: { dx: 5, dy: 0 } })).not.toEqual(observeZone(frontmatter, { ...entry, labelOffset: { dx: 6, dy: 0 } }));
	expect(observeZone(frontmatter, { ...entry, labelOffset: { dx: 5, dy: 0 } })).not.toEqual(observeZone(frontmatter, entry));
});
