import { describe, expect, it } from 'vitest';
import type { Calibration } from '../../../src/domain/plan/Calibration';
import { Plan, withPlanNorth } from '../../../src/domain/plan/Plan';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { childKindOf, DEFAULT_PLAN_KIND, isPlanKind, PLAN_KINDS } from '../../../src/domain/plan/PlanKind';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../../helpers/domain';

const projectId = () => createProjectId();

describe('Plan parent', () => {
	it('carries an optional parent through every with-method, and refuses itself as parent', () => {
		const id = createPlanId();
		const parent = { planId: createPlanId(), zoneId: 'zone-house' as never };
		const plan = expectOk(Plan.create({ id, projectId: projectId(), name: 'House', parent }));
		expect(plan.parent).toEqual(parent);
		expect(expectOk(plan.withBackground(null)).parent).toEqual(parent);
		expect(expectOk(plan.withCalibration(null)).parent).toEqual(parent);
		expect(expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'Site' })).parent).toBeNull();
		expect(expectErr(Plan.create({ id, projectId: projectId(), name: 'Loop', parent: { ...parent, planId: id } })).code).toBe('plan.parent-is-self');
	});
});

describe('Plan north', () => {
	it('keeps a whole-degree bearing through every with-method, and refuses anything else', () => {
		const plan = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'House', north: 90 }));
		expect(expectOk(plan.withBackground(null)).north).toBe(90);
		expect(expectOk(plan.withCalibration(null)).north).toBe(90);
		expect(expectOk(withPlanNorth(plan, 0)).north).toBe(0);
		expect(expectOk(withPlanNorth(plan, undefined)).north).toBeUndefined();
		for (const north of [-15, 360, 12.5]) expect(expectErr(withPlanNorth(plan, north)).code).toBe('plan.invalid-north');
	});
});

describe('Plan.create', () => {
	it('constructs with defaults: no background, no calibration, empty layers', () => {
		const plan = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: ' Ground floor ' }));
		expect(plan.name).toBe('Ground floor');
		expect(plan.background).toBeNull();
		expect(plan.calibration).toBeNull();
		expect(plan.layers).toEqual([]);
	});

	it('keeps background and layer order', () => {
		const plan = expectOk(
			Plan.create({
				id: createPlanId(),
				projectId: projectId(),
				name: 'Ground floor',
				background: { path: 'plans/ground.png', kind: 'image' },
				layers: ['walls', 'fixtures'],
			}),
		);
		expect(plan.background?.path).toBe('plans/ground.png');
		expect(plan.layers).toEqual(['walls', 'fixtures']);
	});

	it('rejects an empty name', () => {
		const error = expectErr(Plan.create({ id: createPlanId(), projectId: projectId(), name: '  ' }));
		expect(error.code).toBe('plan.empty-name');
	});

	it('rejects a background reference without a path', () => {
		const error = expectErr(
			Plan.create({
				id: createPlanId(),
				projectId: projectId(),
				name: 'Ground',
				background: { path: '   ', kind: 'pdf', page: 2 },
			}),
		);
		expect(error.code).toBe('plan.empty-background-path');
	});

	it('rejects duplicate layer names', () => {
		const error = expectErr(
			Plan.create({
				id: createPlanId(),
				projectId: projectId(),
				name: 'Ground',
				layers: ['walls', 'walls'],
			}),
		);
		expect(error.code).toBe('plan.duplicate-layer');
	});
});

describe('Plan.withCalibration', () => {
	const base = () => expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'P' }));

	it('stores a valid calibration and leaves the original untouched', () => {
		const plan = base();
		const calibration: Calibration = {
			pointA: { x: 0, y: 0 },
			pointB: { x: 100, y: 0 },
			knownDistance: 2000,
			pixelsPerWorldUnit: 0.05,
		};
		const updated = expectOk(plan.withCalibration(calibration));
		expect(updated.calibration).toBe(calibration);
		expect(plan.calibration).toBeNull();
		expect(updated.id).toBe(plan.id);
	});

	it('re-validates: a hand-built calibration cannot bypass the rules', () => {
		const error = expectErr(base().withCalibration({
			pointA: { x: 3, y: 3 },
			pointB: { x: 3, y: 3 },
			knownDistance: 1000,
			pixelsPerWorldUnit: 1,
		}));
		expect(error.code).toBe('plan.degenerate-points');
	});

	it('clears with null, which is what a sidecar restored past its first calibration carries', () => {
		const calibration: Calibration = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 2000, pixelsPerWorldUnit: 0.05 };
		const calibrated = expectOk(base().withCalibration(calibration));
		expect(expectOk(calibrated.withCalibration(null)).calibration).toBeNull();
		expect(calibrated.calibration).toBe(calibration);
	});
});

describe('Plan kind and order', () => {
	it('defaults to floor and order 0, and carries both through every with-method', () => {
		const plan = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'Site' }));
		expect(plan.kind).toBe('floor');
		expect(plan.order).toBe(0);
		const site = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'Site', kind: 'site', order: 3 }));
		expect(expectOk(site.withBackground(null))).toMatchObject({ kind: 'site', order: 3 });
		expect(expectOk(site.withCalibration(null))).toMatchObject({ kind: 'site', order: 3 });
		const oriented = expectOk(withPlanNorth(site, 90));
		expect(oriented).toMatchObject({ kind: 'site', order: 3, north: 90 });
		expect(expectOk(site.withDetails({ order: 4 })).north).toBeUndefined();
		// And a north already set survives a details change — the half the line above cannot see.
		expect(expectOk(oriented.withDetails({ order: 4 }))).toMatchObject({ kind: 'site', order: 4, north: 90 });
	});

	it('withDetails re-validates and leaves the parent alone', () => {
		const parent = { planId: createPlanId(), zoneId: 'zone-house' as never };
		const plan = expectOk(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'House', parent }));
		const moved = expectOk(plan.withDetails({ kind: 'building', order: 2 }));
		expect(moved).toMatchObject({ kind: 'building', order: 2, parent });
		expect(expectOk(moved.withDetails({ order: 5 }))).toMatchObject({ kind: 'building', order: 5 });
		expect(expectErr(plan.withDetails({ kind: 'attic' as never })).code).toBe('plan.unknown-kind');
		expect(expectErr(plan.withDetails({ order: -1 })).code).toBe('plan.invalid-order');
		expect(expectErr(plan.withDetails({ order: 1.5 })).code).toBe('plan.invalid-order');
	});

	it('refuses a kind outside the vocabulary and a bad order at creation', () => {
		expect(expectErr(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'X', kind: 'attic' as never })).code).toBe('plan.unknown-kind');
		expect(expectErr(Plan.create({ id: createPlanId(), projectId: projectId(), name: 'X', order: Number.NaN })).code).toBe('plan.invalid-order');
	});

	it('PlanKind helpers: vocabulary, guard, and one step down', () => {
		expect(PLAN_KINDS).toEqual(['site', 'building', 'floor', 'room']);
		expect(DEFAULT_PLAN_KIND).toBe('floor');
		expect(isPlanKind('room')).toBe(true);
		expect(isPlanKind('attic')).toBe(false);
		expect(isPlanKind(3)).toBe(false);
		expect(childKindOf('site')).toBe('building');
		expect(childKindOf('building')).toBe('floor');
		expect(childKindOf('floor')).toBe('room');
		expect(childKindOf('room')).toBe('room');
	});
});
