import { expect, it } from 'vitest';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { PlanGeometrySchemaV14, PlanGeometrySchemaV15 } from '../../../src/infrastructure/persistence/dto/planGeometry';
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
	expect(PlanGeometrySchemaV15.parse(migrated).structure?.elements?.[0]).not.toHaveProperty('color');
	expect(old.schemaVersion).toBe(12);
	const colored = { ...old, schemaVersion: 14, structure: { ...structure, elements: [{ ...item, color: 'rose' }] } };
	expect(PlanGeometrySchemaV14.parse(colored).structure?.elements?.[0].color).toBe('rose');
	for (const invalid of [{ ...item, color: 'pink' }, { ...item, color: null }, { ...item, kind: 'path', color: 'rose' }]) {
		expect(PlanGeometrySchemaV14.safeParse({ ...colored, structure: { ...structure, elements: [invalid] } }).success).toBe(false);
	}
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(migration => migration.toVersion <= 13));
	expect(() => previous.migrateToLatest('plan-geometry', colored, 14)).toThrow('newer than this build supports');
});

it('parses schema 15 colours on every family and refuses malformed values', () => {
	const wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, sideExtents: { a: 75, b: 75 }, color: 'rose' };
	const opening = { id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, color: '#3a7bd5' };
	const path = { id: 'element-path', kind: 'path', points: [{ x: 0, y: 0 }, { x: 900, y: 0 }], color: '#00ff00' };
	const room = { id: 'zone-a', type: 'polygon', points: [[0, 0], [100, 0], [100, 100]], color: 'amber' };
	const v15 = { schemaVersion: 15, planId: 'floor', revision: 0, unit: 'mm', calibration: null, objects: [room], structure: { walls: [wall], openings: [opening], boundaries: [], elements: [path] } };
	const parsed = PlanGeometrySchemaV15.parse(v15);
	expect([parsed.objects[0].color, parsed.structure?.walls[0].color, parsed.structure?.openings[0].color, parsed.structure?.elements?.[0].color]).toEqual(['amber', 'rose', '#3a7bd5', '#00ff00']);
	for (const bad of ['#00FF00', '#0f0', 'green-ish', null]) {
		expect(PlanGeometrySchemaV15.safeParse({ ...v15, structure: { ...v15.structure, elements: [{ ...path, color: bad }] } }).success).toBe(false);
	}
	const hexItem14 = { ...v15, schemaVersion: 14, objects: [], structure: { walls: [], openings: [], boundaries: [], elements: [{ ...item, color: '#00ff00' }] } };
	expect(PlanGeometrySchemaV14.safeParse(hexItem14).success).toBe(false);
});

it('migrates 14 to 15 without changing content, and a schema-14 reader refuses 15', () => {
	const runner = new MigrationRunner(); runner.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS);
	const colored14 = { ...old, schemaVersion: 14, structure: { ...structure, elements: [{ ...item, color: 'rose' }] } };
	expect(PlanGeometrySchemaV15.parse(runner.migrateToLatest('plan-geometry', colored14, 14)).structure?.elements?.[0].color).toBe('rose');
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 14));
	expect(() => previous.migrateToLatest('plan-geometry', { ...colored14, schemaVersion: 15 }, 15)).toThrow('newer than this build supports');
});
