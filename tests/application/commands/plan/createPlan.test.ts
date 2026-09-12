import { describe, expect, it } from 'vitest';
import { CreatePlanCommand } from '../../../../src/application/commands/plan/CreatePlan';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	injectedReadFailure,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';

const wired = () => {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const seed = async () => {
		const project = makeProject();
		await projects.save(project, 'absent');
		return project;
	};
	return { projects, plans, zones, events, seed };
};

describe('CreatePlanCommand', () => {
	it('creates under an existing project and publishes PlanCreated', async () => {
		const { projects, plans, zones, events, seed } = wired();
		const project = await seed();

		const result = await new CreatePlanCommand(plans, projects, zones, events).execute({
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
		const { projects, plans, zones, events } = wired();
		const error = expectErr(
			await new CreatePlanCommand(plans, projects, zones, events).execute({
				projectId: 'project-missing' as never,
				name: 'Ground floor',
			}),
		);
		expect(error).toMatchObject({ category: 'Reference', code: 'plan.project-not-found' });
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed parent read instead of mistaking it for "not found"', async () => {
		const { plans, zones, events } = wired();
		class FailingRead extends InMemoryProjectRepository {
			override getById() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const error = expectErr(
			await new CreatePlanCommand(plans, new FailingRead(), zones, events).execute({
				projectId: 'project-x' as never,
				name: 'Ground floor',
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(error.category).toBe('Persistence');
		expect(events.published).toHaveLength(0);
	});

	it('propagates entity validation without saving or publishing', async () => {
		const { projects, plans, zones, events, seed } = wired();
		const project = await seed();
		const error = expectErr(
			await new CreatePlanCommand(plans, projects, zones, events).execute({
				projectId: project.id,
				name: '   ',
			}),
		);
		expect(error.code).toBe('plan.empty-name');
		expect(expectOk(await plans.listByProject(project.id)).loaded).toHaveLength(0);
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed save', async () => {
		const { projects, zones, events, seed } = wired();
		class FailingSave extends InMemoryPlanRepository {
			override save() {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
		}
		const project = await seed();
		const error = expectErr(
			await new CreatePlanCommand(new FailingSave(), projects, zones, events).execute({
				projectId: project.id,
				name: 'Ground floor',
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});

	async function parentScene() {
		const r = wired();
		const project = await r.seed();
		const site = makePlan({ projectId: project.id, name: 'Site' });
		expectOk(await r.plans.save(site, 'absent'));
		const house = makeZone({ projectId: project.id, planId: site.id, name: 'House', zoneType: 'Custom' });
		expectOk(await r.zones.save(house, 'absent'));
		const command = new CreatePlanCommand(r.plans, r.projects, r.zones, r.events);
		return { ...r, project, site, house, command };
	}

	it('creates a detail plan of a zone on another plan of the same project', async () => {
		const s = await parentScene();
		const { plan } = expectOk(await s.command.execute({ projectId: s.project.id, name: 'House', parent: { planId: s.site.id, zoneId: s.house.id } }));
		expect(plan.entity.parent).toEqual({ planId: s.site.id, zoneId: s.house.id });
		expect(s.events.published.map((event) => event.type)).toEqual(['PlanCreated']);
	});

	it('refuses a parent plan or zone that does not resolve, or that belongs elsewhere, and writes nothing', async () => {
		const s = await parentScene();
		const otherProject = makeProject();
		expectOk(await s.projects.save(otherProject, 'absent'));
		const foreignPlan = makePlan({ projectId: otherProject.id, name: 'Elsewhere' });
		expectOk(await s.plans.save(foreignPlan, 'absent'));
		const strayZone = makeZone({ projectId: s.project.id, planId: foreignPlan.id, name: 'Stray' });
		expectOk(await s.zones.save(strayZone, 'absent'));
		const cases: readonly [{ planId: never; zoneId: never }, string][] = [
			[{ planId: 'plan-missing' as never, zoneId: s.house.id as never }, 'plan.parent-plan-not-found'],
			[{ planId: foreignPlan.id as never, zoneId: s.house.id as never }, 'plan.parent-project-mismatch'],
			[{ planId: s.site.id as never, zoneId: 'zone-missing' as never }, 'plan.parent-zone-not-found'],
			[{ planId: s.site.id as never, zoneId: strayZone.id as never }, 'plan.parent-zone-not-found'],
		];
		for (const [parent, code] of cases) {
			expect(expectErr(await s.command.execute({ projectId: s.project.id, name: 'House', parent }))).toMatchObject({ category: 'Reference', code });
		}
		expect(expectOk(await s.plans.listByProject(s.project.id)).loaded.map((loaded) => loaded.entity.name)).toEqual(['Site']);
		expect(s.events.published).toHaveLength(0);
	});

	it('surfaces a failed parent PLAN read instead of mistaking it for "not found"', async () => {
		const { projects, zones, events, seed } = wired();
		const project = await seed();
		class FailingRead extends InMemoryPlanRepository {
			override getById() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const plans = new FailingRead();
		const error = expectErr(
			await new CreatePlanCommand(plans, projects, zones, events).execute({
				projectId: project.id,
				name: 'House',
				parent: { planId: 'plan-x' as never, zoneId: 'zone-x' as never },
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(error.category).toBe('Persistence');
		expect(expectOk(await plans.listByProject(project.id)).loaded).toHaveLength(0);
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed parent ZONE read instead of mistaking it for "not found"', async () => {
		const s = await parentScene();
		class FailingRead extends InMemoryZoneRepository {
			override getById() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const zones = new FailingRead();
		const error = expectErr(
			await new CreatePlanCommand(s.plans, s.projects, zones, s.events).execute({
				projectId: s.project.id,
				name: 'House',
				parent: { planId: s.site.id, zoneId: s.house.id },
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(error.category).toBe('Persistence');
		expect(expectOk(await s.plans.listByProject(s.project.id)).loaded.map((loaded) => loaded.entity.name)).toEqual(['Site']);
		expect(s.events.published).toHaveLength(0);
	});

	it('assigns a new plan the order after its siblings, and takes an explicit kind and order', async () => {
		const { projects, plans, zones, events, seed } = wired();
		const project = await seed();
		const command = new CreatePlanCommand(plans, projects, zones, events);
		const first = expectOk(await command.execute({ projectId: project.id, name: 'Site', kind: 'site' }));
		expect(first.plan.entity).toMatchObject({ kind: 'site', order: 0 });
		const second = expectOk(await command.execute({ projectId: project.id, name: 'Garden' }));
		expect(second.plan.entity).toMatchObject({ kind: 'floor', order: 1 });
		const zone = makeZone({ projectId: project.id, planId: first.plan.entity.id });
		await zones.save(zone, 'absent');
		const child = expectOk(await command.execute({ projectId: project.id, name: 'House', parent: { planId: first.plan.entity.id, zoneId: zone.id }, kind: 'building' }));
		// Siblings are counted under the PARENT, so the first child is 0 even with two roots.
		expect(child.plan.entity).toMatchObject({ kind: 'building', order: 0 });
		const explicit = expectOk(await command.execute({ projectId: project.id, name: 'Shed', order: 9 }));
		expect(explicit.plan.entity.order).toBe(9);
	});

	it('surfaces a failed sibling listing instead of guessing an order', async () => {
		const { projects, zones, events, seed } = wired();
		const project = await seed();
		class FailingList extends InMemoryPlanRepository {
			override listByProject() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const error = expectErr(
			await new CreatePlanCommand(new FailingList(), projects, zones, events).execute({ projectId: project.id, name: 'Site' }),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});
});
