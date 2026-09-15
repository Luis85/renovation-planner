import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP_WITH_SIDES as WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import { DIMENSION_A, DRAFTING_MARKS, HATCH_A, SECTION_A, TEXT_A } from '../../helpers/drafting';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { PlanGeometrySchemaV12 } from '../../../src/infrastructure/persistence/dto/planGeometry';

/** Geometry only: names live in the plan note, never in the sidecar. */
const geometryOf = ({ name: _name, ...element }: SpatialElement & { readonly name: string }): SpatialElement => element;
const marks = DRAFTING_MARKS.map(element => geometryOf(element));

it('refuses the drafting refine at the schema itself: an offset or look side on the wrong kind, or missing from its own', () => {
	const document = { schemaVersion: 12 as const, planId: 'plan-a', revision: 0, unit: 'mm' as const, calibration: null, objects: [], structure: WALL_LOOP };
	const refused = [{ ...geometryOf(DIMENSION_A), offset: undefined }, { ...geometryOf(SECTION_A), flipped: undefined }, { ...geometryOf(TEXT_A), offset: 10 }, { ...geometryOf(HATCH_A), flipped: true }];
	for (const element of refused) expect(PlanGeometrySchemaV12.safeParse({ ...document, structure: { ...WALL_LOOP, elements: [element] } }).success).toBe(false);
	expect(PlanGeometrySchemaV12.safeParse({ ...document, structure: { ...WALL_LOOP, elements: marks } }).success).toBe(true);
});

it('round-trips every drafting mark as schema 12, which a build that stops at 11 refuses', async () => {
	const rig = await structureStack();
	const document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: marks } };
	expectOk(await rig.geometry.write(rig.plan.id, document, rig.baseline.version));
	expect(expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id)).document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(12);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 11));
	expect(() => older.migrateToLatest('plan-geometry', dto, 12)).toThrow('newer than this build supports');
	expect(expectDefined(PLAN_GEOMETRY_MIGRATIONS.find(step => step.toVersion === 12), 'schema 12 step').migrate({ schemaVersion: 11, revision: 3 })).toEqual({ schemaVersion: 12, revision: 3 });
});

it('keeps a sidecar without a drafting mark below schema 12, and treats offset and look side as geometry facts', async () => {
	const rig = await structureStack();
	const plain = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [{ id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] }] } };
	expectOk(await rig.geometry.write(rig.plan.id, plain, rig.baseline.version));
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBeLessThan(12);
	const dimension = geometryOf(DIMENSION_A), section = geometryOf(SECTION_A);
	const document = { ...plain, structure: { ...WALL_LOOP, elements: [dimension, section] } };
	expect(sameGeometryDocument(document, { ...document, structure: { ...WALL_LOOP, elements: [{ ...dimension, offset: -400 }, section] } })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...WALL_LOOP, elements: [dimension, { ...section, flipped: true }] } })).toBe(false);
});
