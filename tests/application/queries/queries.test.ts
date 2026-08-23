import { describe, expect, it } from 'vitest';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { GetProject } from '../../../src/application/queries/GetProject';
import { GetZone } from '../../../src/application/queries/GetZone';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectErr, expectOk, injectedReadFailure } from '../../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../../helpers/entities';

describe('the three read queries', () => {
	it('answer ok(Loaded) for an entity seeded directly into the repository', async () => {
		const projects = new InMemoryProjectRepository();
		const project = makeProject();
		await projects.save(project, 'absent');
		const found = await new GetProject(projects).execute({ projectId: project.id });
		expect(expectOk(found)?.entity.name).toBe(project.name);

		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: project.id });
		await plans.save(plan, 'absent');
		const foundPlan = await new GetPlan(plans).execute({ planId: plan.id });
		expect(expectOk(foundPlan)?.entity.id).toBe(plan.id);

		const zones = new InMemoryZoneRepository();
		const zone = makeZone({ projectId: project.id, planId: plan.id, geometry: squareAt() });
		await zones.save(zone, 'absent');
		const foundZone = await new GetZone(zones).execute({ zoneId: zone.id });
		expect(expectOk(foundZone)?.entity.id).toBe(zone.id);
	});

	it('answer ok(null) — not an error — for a missing id', async () => {
		expect(await new GetProject(new InMemoryProjectRepository()).execute({ projectId: 'project-x' as never })).toEqual({
			ok: true,
			value: null,
		});
		expect(await new GetPlan(new InMemoryPlanRepository()).execute({ planId: 'plan-x' as never })).toEqual({
			ok: true,
			value: null,
		});
		expect(await new GetZone(new InMemoryZoneRepository()).execute({ zoneId: 'zone-x' as never })).toEqual({
			ok: true,
			value: null,
		});
	});

	it('pass a failed read straight through, keeping "no entity" distinguishable', async () => {
		class FailingProjects extends InMemoryProjectRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		class FailingPlans extends InMemoryPlanRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		class FailingZones extends InMemoryZoneRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		const projectError = await new GetProject(new FailingProjects()).execute({ projectId: 'project-y' as never });
		const planError = await new GetPlan(new FailingPlans()).execute({ planId: 'plan-y' as never });
		const zoneError = await new GetZone(new FailingZones()).execute({ zoneId: 'zone-y' as never });

		expect(expectErr(projectError).code).toBe('test.injected-failure');
		expect(expectErr(planError).code).toBe('test.injected-failure');
		expect(expectErr(zoneError).code).toBe('test.injected-failure');
	});
});
