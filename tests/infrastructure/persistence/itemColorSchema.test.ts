import { expect, it } from 'vitest';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { PlanGeometrySchemaV14 } from '../../../src/infrastructure/persistence/dto/planGeometry';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';

const item: SpatialElement = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] };
const structure = { walls: [], openings: [], boundaries: [], elements: [item] };
const old = { schemaVersion: 12, planId: 'floor', revision: 0, unit: 'mm', calibration: null, objects: [], structure };

it('includes placement color in document equality for current and intended history baselines', () => {
	const document = { calibration: null, objects: [], structure };
	const colored = { ...structure, elements: [{ ...item, color: 'blue' as const }] };
	expect(sameGeometryDocument(document, { ...document, structure: colored })).toBe(false);
	expect(sameGeometryDocument({ ...document, intended: structure }, { ...document, intended: colored })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...structure, elements: [{ ...item, color: undefined }] } })).toBe(true);
});

it('migrates old sidecars without inventing colors and refuses unknown colors and ineligible kinds', () => {
	const migrations = new MigrationRunner(); migrations.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS);
	const migrated = migrations.migrateToLatest('plan-geometry', old, 12);
	expect(PlanGeometrySchemaV14.parse(migrated).structure?.elements?.[0]).not.toHaveProperty('color');
	expect(old.schemaVersion).toBe(12);
	const colored = { ...old, schemaVersion: 14, structure: { ...structure, elements: [{ ...item, color: 'rose' }] } };
	expect(PlanGeometrySchemaV14.parse(colored).structure?.elements?.[0].color).toBe('rose');
	for (const invalid of [{ ...item, color: 'pink' }, { ...item, color: null }, { ...item, kind: 'path', color: 'rose' }]) {
		expect(PlanGeometrySchemaV14.safeParse({ ...colored, structure: { ...structure, elements: [invalid] } }).success).toBe(false);
	}
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(migration => migration.toVersion <= 13));
	expect(() => previous.migrateToLatest('plan-geometry', colored, 14)).toThrow('newer than this build supports');
});
