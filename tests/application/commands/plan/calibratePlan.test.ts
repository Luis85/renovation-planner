import { describe, expect, it } from 'vitest';
import { CalibratePlanCommand } from '../../../../src/application/commands/plan/CalibratePlan';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	injectedReadFailure,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makePlan } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';

const wired = () => {
	const plans = new InMemoryPlanRepository();
	const events = new RecordingEventBus();
	return { plans, events, command: new CalibratePlanCommand(plans, events) };
};

describe('CalibratePlanCommand', () => {
	it('calibrates and publishes PlanCalibrated with the derived scale', async () => {
		const { plans, events, command } = wired();
		const plan = makePlan({ projectId: createProjectId() });
		expectOk(await plans.save(plan, 'absent'));

		const result = await command.execute({
			planId: plan.id,
			pointA: { x: 0, y: 0 },
			pointB: { x: 100, y: 0 },
			knownDistance: 2000,
		});
		const { plan: saved } = expectOk(result);
		expect(saved.entity.calibration?.pixelsPerWorldUnit).toBeCloseTo(0.05);

		expect(events.published).toEqual([
			{
				type: 'PlanCalibrated',
				payload: { planId: plan.id, projectId: plan.projectId },
			},
		]);
	});

	it('refuses a missing plan with a ReferenceError', async () => {
		const { events, command } = wired();
		const error = expectErr(
			await command.execute({
				planId: 'plan-missing' as never,
				pointA: { x: 0, y: 0 },
				pointB: { x: 1, y: 0 },
				knownDistance: 10,
			}),
		);
		expect(error).toMatchObject({ category: 'Reference', code: 'plan.plan-not-found' });
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed read rather than a missing plan', async () => {
		const { events } = wired();
		class FailingRead extends InMemoryPlanRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		const error = expectErr(
			await new CalibratePlanCommand(new FailingRead(), events).execute({
				planId: 'plan-x' as never,
				pointA: { x: 0, y: 0 },
				pointB: { x: 1, y: 0 },
				knownDistance: 10,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('refuses a non-positive known distance as a ValidationError', async () => {
		const { plans, events, command } = wired();
		const plan = makePlan({ projectId: createProjectId() });
		expectOk(await plans.save(plan, 'absent'));
		const error = expectErr(
			await command.execute({
				planId: plan.id,
				pointA: { x: 0, y: 0 },
				pointB: { x: 1, y: 0 },
				knownDistance: 0,
			}),
		);
		expect(error).toMatchObject({ category: 'Validation', code: 'plan.non-positive-distance' });
		expect(events.published).toHaveLength(0);
	});

	it('refuses coincident points as a CalculationError', async () => {
		const { plans, events, command } = wired();
		const plan = makePlan({ projectId: createProjectId() });
		expectOk(await plans.save(plan, 'absent'));
		const error = expectErr(
			await command.execute({
				planId: plan.id,
				pointA: { x: 4, y: 4 },
				pointB: { x: 4, y: 4 },
				knownDistance: 1000,
			}),
		);
		expect(error).toMatchObject({ category: 'Calculation', code: 'plan.degenerate-points' });
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed save', async () => {
		const { events } = wired();
		class FailingSave extends InMemoryPlanRepository {
			failNext = false;
			override save(plan: Parameters<InMemoryPlanRepository['save']>[0], expected: Parameters<InMemoryPlanRepository['save']>[1]) {
				if (this.failNext) {
					return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
				}
				return super.save(plan, expected);
			}
		}
		const plans = new FailingSave();
		const plan = makePlan({ projectId: createProjectId() });
		expectOk(await plans.save(plan, 'absent'));
		plans.failNext = true;
		const error = expectErr(
			await new CalibratePlanCommand(plans, events).execute({
				planId: plan.id,
				pointA: { x: 0, y: 0 },
				pointB: { x: 1, y: 0 },
				knownDistance: 1000,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});
});
