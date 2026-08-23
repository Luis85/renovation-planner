import { describe, expect, it } from 'vitest';
import type { Calibration } from '../../../src/domain/plan/Calibration';
import { Plan } from '../../../src/domain/plan/Plan';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../../helpers/domain';

const projectId = () => createProjectId();

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
});
