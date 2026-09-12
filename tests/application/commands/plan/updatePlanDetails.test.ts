import { describe, expect, it } from 'vitest';
import { UpdatePlanDetailsCommand } from '../../../../src/application/commands/plan/UpdatePlanDetails';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import type { Plan } from '../../../../src/domain/plan/Plan';
import type { Expected } from '../../../../src/application/ports/versioning';
import { expectErr, expectFound, expectOk, injectedPersistenceError, RecordingEventBus } from '../../../helpers/domain';
import { makePlan, makeProject } from '../../../helpers/entities';

describe('UpdatePlanDetailsCommand', () => {
	it('writes kind and order on the version it read and publishes PlanDetailsChanged', async () => {
		const plans = new InMemoryPlanRepository(), events = new RecordingEventBus();
		const plan = makePlan({ projectId: makeProject().id, name: 'House' });
		expectOk(await plans.save(plan, 'absent'));
		const result = expectOk(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: plan.id, kind: 'building', order: 2 }));
		expect(result.plan.entity).toMatchObject({ kind: 'building', order: 2 });
		expect(expectFound(await plans.getById(plan.id)).entity).toMatchObject({ kind: 'building', order: 2 });
		expect(events.published).toEqual([{ type: 'PlanDetailsChanged', payload: { planId: plan.id, projectId: plan.projectId } }]);
	});

	it('refuses a missing plan and a bad value, writing and publishing nothing', async () => {
		const plans = new InMemoryPlanRepository(), events = new RecordingEventBus();
		expect(expectErr(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: createPlanId(), kind: 'room' })).code).toBe('plan.plan-not-found');
		const plan = makePlan({ projectId: makeProject().id });
		expectOk(await plans.save(plan, 'absent'));
		expect(expectErr(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: plan.id, order: -3 })).code).toBe('plan.invalid-order');
		expect(expectFound(await plans.getById(plan.id)).entity.order).toBe(0);
		expect(events.published).toEqual([]);
	});

	it('surfaces a refused save and publishes nothing', async () => {
		class FailingSave extends InMemoryPlanRepository {
			refuse = false;
			override save(plan: Plan, expected: Expected) {
				return this.refuse ? Promise.resolve({ ok: false, error: injectedPersistenceError() } as const) : super.save(plan, expected);
			}
		}
		const plans = new FailingSave(), events = new RecordingEventBus();
		const plan = makePlan({ projectId: makeProject().id });
		expectOk(await plans.save(plan, 'absent'));
		plans.refuse = true;
		expect(expectErr(await new UpdatePlanDetailsCommand(plans, events).execute({ planId: plan.id, kind: 'site' })).code).toBe('test.injected-failure');
		expect(events.published).toEqual([]);
	});
});
