import { describe, expect, it } from 'vitest';
import { CreatePlanCommand } from '../../../../src/application/commands/plan/CreatePlan';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	injectedReadFailure,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makeProject } from '../../../helpers/entities';

const wired = () => {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const events = new RecordingEventBus();
	const seed = async () => {
		const project = makeProject();
		await projects.save(project, 'absent');
		return project;
	};
	return { projects, plans, events, seed };
};

describe('CreatePlanCommand', () => {
	it('creates under an existing project and publishes PlanCreated', async () => {
		const { projects, plans, events, seed } = wired();
		const project = await seed();

		const result = await new CreatePlanCommand(plans, projects, events).execute({
			projectId: project.id,
			name: 'Ground floor',
		});
		const { plan } = expectOk(result);
		expect(plan.entity.projectId).toBe(project.id);
		expect(plan.version.revision).toBe(1);
		expect(expectOk(await plans.getById(plan.entity.id))).not.toBeNull();

		expect(events.published).toEqual([
			{ type: 'PlanCreated', payload: { planId: plan.entity.id, projectId: project.id } },
		]);
	});

	it('refuses a missing parent with a ReferenceError — not a validation error', async () => {
		const { projects, plans, events } = wired();
		const error = expectErr(
			await new CreatePlanCommand(plans, projects, events).execute({
				projectId: 'project-missing' as never,
				name: 'Ground floor',
			}),
		);
		expect(error).toMatchObject({ category: 'Reference', code: 'plan.project-not-found' });
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed parent read instead of mistaking it for "not found"', async () => {
		const { plans, events } = wired();
		class FailingRead extends InMemoryProjectRepository {
			override getById() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const error = expectErr(
			await new CreatePlanCommand(plans, new FailingRead(), events).execute({
				projectId: 'project-x' as never,
				name: 'Ground floor',
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(error.category).toBe('Persistence');
		expect(events.published).toHaveLength(0);
	});

	it('propagates entity validation without saving or publishing', async () => {
		const { projects, plans, events, seed } = wired();
		const project = await seed();
		const error = expectErr(
			await new CreatePlanCommand(plans, projects, events).execute({
				projectId: project.id,
				name: '   ',
			}),
		);
		expect(error.code).toBe('plan.empty-name');
		expect(expectOk(await plans.listByProject(project.id))).toHaveLength(0);
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed save', async () => {
		const { projects, events, seed } = wired();
		class FailingSave extends InMemoryPlanRepository {
			override save() {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
		}
		const project = await seed();
		const error = expectErr(
			await new CreatePlanCommand(new FailingSave(), projects, events).execute({
				projectId: project.id,
				name: 'Ground floor',
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});
});
