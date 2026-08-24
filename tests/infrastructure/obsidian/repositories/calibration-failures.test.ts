import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';

/**
 * Final slice-4 branch completion: the calibrated-save paths whose inverse operations
 * can also fail.
 */

function sidecarPathOf(stack: ReturnType<typeof createRepositoryStack>, planId: PlanId): string {
	return `${stack.projectFolder}/Geometry/${planId}.rpgeo`;
}

describe('calibrated saves under failure', () => {
	it('a calibrated update whose sidecar write fails reports through syncCalibration', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const inserted = expectOk(
			await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'),
		);

		const calibrated = inserted.entity.calibrate({
			pointA: { x: 0, y: 0 },
			pointB: { x: 100, y: 0 },
			knownDistance: 2000,
		});
		if (!calibrated.ok) throw new Error(calibrated.error.message);

		stack.vault.failures.add(`modify:${sidecarPathOf(stack, planId)}`);
		const result = await stack.plans.save(calibrated.value, inserted.version);
		const failure = expectErr(result);
		expect(failure.category).toBe('Persistence');
		expect(failure.code.startsWith('plan-geometry.')).toBe(true);
	});

	it('a calibrated save whose sidecar write succeeds round-trips', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const inserted = expectOk(
			await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'),
		);

		const calibrated = inserted.entity.calibrate({
			pointA: { x: 0, y: 0 },
			pointB: { x: 100, y: 0 },
			knownDistance: 2000,
		});
		if (!calibrated.ok) throw new Error(calibrated.error.message);
		const saved = expectOk(await stack.plans.save(calibrated.value, inserted.version));
		expect(saved.entity.calibration?.knownDistance).toBe(2000);
	});
});
