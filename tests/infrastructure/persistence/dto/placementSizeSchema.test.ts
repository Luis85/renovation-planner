import { expect, it } from 'vitest';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { PlanGeometrySchemaV15, PlanGeometrySchemaV16 } from '../../../../src/infrastructure/persistence/dto/planGeometry';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { MigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { sameGeometryDocument } from '../../../../src/application/commands/spatial/sameGeometryDocument';

const placement: SpatialElement = { id: 'element-sofa', kind: 'asset', assetId: 'asset-sofa', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
const structure = { walls: [], openings: [], boundaries: [], elements: [placement] };
const old = { schemaVersion: 14, planId: 'floor', revision: 0, unit: 'mm', calibration: null, objects: [], structure };
const sized = { ...old, schemaVersion: 15, structure: { ...structure, elements: [{ ...placement, size: { width: 1800, depth: 900 } }] } };

it('includes a placement’s own size in document equality', () => {
	const document = { calibration: null, objects: [], structure };
	expect(sameGeometryDocument(document, { ...document, structure: sized.structure })).toBe(false);
	expect(sameGeometryDocument({ ...document, intended: structure }, { ...document, intended: sized.structure })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...structure, elements: [{ ...placement }] } })).toBe(true);
});

it('migrates schema 14 without inventing a size and reads a size at 15', () => {
	const migrations = new MigrationRunner(); migrations.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS);
	expect(PlanGeometrySchemaV16.parse(migrations.migrateToLatest('plan-geometry', old, 14)).structure?.elements?.[0]).not.toHaveProperty('size');
	expect(old.schemaVersion).toBe(14);
	expect(PlanGeometrySchemaV15.parse(sized).structure?.elements?.[0].size).toEqual({ width: 1800, depth: 900 });
});

it('refuses a size on anything but an asset, a non-positive or oversized side, and a file from a newer build', () => {
	const item = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], size: { width: 1, depth: 1 } };
	for (const invalid of [item, { ...placement, size: { width: 0, depth: 900 } }, { ...placement, size: { width: 1800, depth: 1e6 + 1 } }]) {
		expect(PlanGeometrySchemaV15.safeParse({ ...sized, structure: { ...structure, elements: [invalid] } }).success).toBe(false);
	}
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(migration => migration.toVersion <= 14));
	expect(() => previous.migrateToLatest('plan-geometry', sized, 15)).toThrow('newer than this build supports');
});
