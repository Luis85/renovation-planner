import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectOk } from '../../helpers/domain';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { placementPoints } from '../../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';

const radiator: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: placementPoints({ x: 2000, y: 475 }, Math.PI / 2) };
const cabinet: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }] };

it('round-trips an asset placement at schema 9 and refuses it to a schema-8 reader as newer', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const document = { ...baseline.document, structure: { ...WALL_LOOP, elements: [radiator, cabinet] }, intended: { ...WALL_LOOP, elements: [radiator] } };
	expectOk(await rig.geometry.write(rig.plan.id, document, baseline.version));
	const saved = expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id));
	expect(saved.document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(9);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 8));
	expect(() => older.migrateToLatest('plan-geometry', dto, 9)).toThrow('newer than this build supports');
});

it('writes the lowest schema that holds the content once the last asset is gone', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...WALL_LOOP, elements: [cabinet] } }, baseline.version));
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(4);
	expect(PLAN_GEOMETRY_MIGRATIONS.at(-1)?.migrate({ schemaVersion: 8, revision: 2 })).toEqual({ schemaVersion: 9, revision: 2 });
});
