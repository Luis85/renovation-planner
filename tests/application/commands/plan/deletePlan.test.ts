import { describe, expect, it } from 'vitest';
import { DeletePlanCommand } from '../../../../src/application/commands/plan/DeletePlan';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import type { PlanRepository } from '../../../../src/application/ports/PlanRepository';
import type { ZoneRepository } from '../../../../src/application/ports/ZoneRepository';
import {
	expectErr,
	expectOk,
	injectedReadFailure,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';

const wired = async () => {
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const project = makeProject();
	const plan = makePlan({ projectId: project.id, name: 'Ground floor' });
	expectOk(await plans.save(plan, 'absent'));
	return { plans, zones, events, project, plan };
};

describe('DeletePlanCommand', () => {
	it('deletes an empty plan, removes the note and publishes PlanDeleted', async () => {
		const { plans, zones, events, project, plan } = await wired();

		expect(expectOk(await new DeletePlanCommand(plans, zones, events).execute({ planId: plan.id })))
			.toEqual({ planId: plan.id });

		expect(expectOk(await plans.getById(plan.id))).toBeNull();
		expect(events.published).toEqual([
			{ type: 'PlanDeleted', payload: { planId: plan.id, projectId: project.id } },
		]);
	});

	it('refuses a plan that is not there, and writes nothing', async () => {
		const { plans, zones, events } = await wired();

		const error = expectErr(
			await new DeletePlanCommand(plans, zones, events).execute({ planId: 'plan-missing' as never }),
		);
		expect(error).toMatchObject({ category: 'Reference', code: 'plan.plan-not-found' });
		expect(events.published).toEqual([]);
	});

	/**
	 * The refusal names the rooms rather than counting them: `namedReferenceError`'s `names` is
	 * what fills the copy's `{names}`, and a user told "3 rooms" cannot tell which plan they are
	 * looking at from the sentence alone.
	 */
	it('refuses while the plan still holds rooms, naming them, and deletes nothing', async () => {
		const { plans, zones, events, project, plan } = await wired();
		expectOk(await zones.save(makeZone({ projectId: project.id, planId: plan.id, name: 'Kitchen' }), 'absent'));
		expectOk(await zones.save(makeZone({ projectId: project.id, planId: plan.id, name: 'Bathroom' }), 'absent'));

		const error = expectErr(await new DeletePlanCommand(plans, zones, events).execute({ planId: plan.id }));

		expect(error).toMatchObject({
			category: 'Reference',
			code: 'plan.rooms-exist',
			names: ['Kitchen', 'Bathroom'],
		});
		expect(expectOk(await plans.getById(plan.id))).not.toBeNull();
		expect(events.published).toEqual([]);
	});

	it('refuses while a detail plan still names it as parent', async () => {
		const { plans, zones, events, project, plan } = await wired();
		const child = makePlan({
			projectId: project.id,
			name: 'Kitchen detail',
			parent: { planId: plan.id, zoneId: createZoneId() },
		});
		expectOk(await plans.save(child, 'absent'));

		const error = expectErr(await new DeletePlanCommand(plans, zones, events).execute({ planId: plan.id }));

		expect(error).toMatchObject({
			category: 'Reference',
			code: 'plan.detail-plans-exist',
			names: ['Kitchen detail'],
		});
		expect(expectOk(await plans.getById(plan.id))).not.toBeNull();
	});

	/**
	 * A listing that skipped a note cannot say the plan is empty, so a `refused` count of either
	 * kind refuses — the same rule `ListReassignmentTargets` takes, and the case a `loaded.length`
	 * check alone reads as "nothing here, go ahead".
	 */
	it.each([
		['zone', 'zones'],
		['plan', 'plans'],
	] as const)('refuses when a %s note could not be read', async (_kind, refusing) => {
		const { plans, zones, events, plan } = await wired();
		// DELEGATING wrappers rather than a spread: these ports are class instances and a spread
		// copies own fields only, so `{ ...plans }` is an object whose `getById` does not exist.
		const skipped = Promise.resolve({ ok: true as const, value: { loaded: [], refused: 1 } });
		const planPort: PlanRepository = {
			getById: (id) => plans.getById(id),
			save: (entity, expected) => plans.save(entity, expected),
			delete: (id, expected) => plans.delete(id, expected),
			listByProject: (id) => (refusing === 'plans' ? skipped : plans.listByProject(id)),
		};
		const zonePort: ZoneRepository = {
			getById: (id) => zones.getById(id),
			save: (entity, expected) => zones.save(entity, expected),
			delete: (id, expected) => zones.delete(id, expected),
			listByProject: (id) => zones.listByProject(id),
			listByPlan: (id) => (refusing === 'zones' ? skipped : zones.listByPlan(id)),
		};

		const error = expectErr(
			await new DeletePlanCommand(planPort, zonePort, events).execute({ planId: plan.id }),
		);

		expect(error).toMatchObject({ category: 'Reference', code: 'plan.referents-unreadable' });
		expect(events.published).toEqual([]);
	});

	it('surfaces a failed zone listing as itself rather than as an empty plan', async () => {
		const { plans, zones, events, plan } = await wired();
		const zonePort: ZoneRepository = {
			getById: (id) => zones.getById(id),
			save: (entity, expected) => zones.save(entity, expected),
			delete: (id, expected) => zones.delete(id, expected),
			listByProject: (id) => zones.listByProject(id),
			listByPlan: () => Promise.resolve(injectedReadFailure()),
		};

		const error = expectErr(await new DeletePlanCommand(plans, zonePort, events).execute({ planId: plan.id }));

		expect(error).toMatchObject({ category: 'Persistence', code: 'test.injected-failure' });
		expect(expectOk(await plans.getById(plan.id))).not.toBeNull();
	});
});
