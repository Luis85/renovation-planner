import { describe, expect, it } from 'vitest';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { ancestryOf, NO_HIERARCHY, readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../../helpers/entities';

async function scene() {
	const plans = new InMemoryPlanRepository(), zones = new InMemoryZoneRepository(), project = makeProject();
	const site = makePlan({ projectId: project.id, name: 'Site' });
	const houseZone = makeZone({ projectId: project.id, planId: site.id, name: 'House', zoneType: 'Custom', geometry: squareAt(30000, 12000) });
	const house = makePlan({ projectId: project.id, name: 'House', parent: { planId: site.id, zoneId: houseZone.id } });
	const groundZone = makeZone({ projectId: project.id, planId: house.id, name: 'Footprint', zoneType: 'Custom' });
	const ground = makePlan({ projectId: project.id, name: 'Ground floor', parent: { planId: house.id, zoneId: groundZone.id } });
	const upper = makePlan({ projectId: project.id, name: 'Attic', parent: { planId: house.id, zoneId: groundZone.id } });
	const unrelated = makePlan({ projectId: makeProject().id, name: 'Elsewhere', parent: { planId: house.id, zoneId: groundZone.id } });
	for (const plan of [site, house, ground, upper, unrelated]) expectOk(await plans.save(plan, 'absent'));
	for (const zone of [houseZone, groundZone]) expectOk(await zones.save(zone, 'absent'));
	const queries = { getPlan: new GetPlan(plans), listPlans: new ListPlansByProject(plans), findZonesByPlan: new FindZonesByPlan(zones) };
	return { plans, zones, site, house, ground, upper, houseZone, groundZone, queries };
}

describe('readPlanHierarchy', () => {
	it('answers ancestry root first, this plan’s detail plans by name, and the parent zone outline', async () => {
		const s = await scene();
		const ground = expectOk(await readPlanHierarchy(s.queries, s.ground.id));
		expect(ground.ancestry).toEqual([{ id: s.site.id, name: 'Site' }, { id: s.house.id, name: 'House' }]);
		expect(ground.parentZone?.name).toBe('Footprint');
		expect(ground.parentZoneMissing).toBe(false);
		const house = expectOk(await readPlanHierarchy(s.queries, s.house.id));
		expect(house.detailPlans).toEqual([
			{ id: s.upper.id, name: 'Attic', parentZoneId: s.groundZone.id },
			{ id: s.ground.id, name: 'Ground floor', parentZoneId: s.groundZone.id },
		]);
		expect(house.parentZone?.points).toEqual(s.houseZone.geometry.points);
		const site = expectOk(await readPlanHierarchy(s.queries, s.site.id));
		expect(site.ancestry).toEqual([]);
		expect(site.parentZone).toBeNull();
		expect(site.detailPlans.map((plan) => plan.name)).toEqual(['House']);
	});

	it('reports a deleted parent zone, ends the chain at a missing ancestor, and stops at a cycle', async () => {
		const s = await scene();
		expectOk(await s.zones.delete(s.houseZone.id, expectFound(await s.zones.getById(s.houseZone.id)).version));
		const house = expectOk(await readPlanHierarchy(s.queries, s.house.id));
		expect(house).toMatchObject({ parentZone: null, parentZoneMissing: true, ancestry: [{ id: s.site.id, name: 'Site' }] });

		expectOk(await s.plans.delete(s.site.id, expectFound(await s.plans.getById(s.site.id)).version));
		expect(expectOk(await readPlanHierarchy(s.queries, s.house.id)).ancestry).toEqual([]);

		expect(expectOk(await readPlanHierarchy(s.queries, 'plan-missing'))).toEqual(NO_HIERARCHY);
	});
});

describe('ancestryOf', () => {
	it('stops at a cycle a hand-edited note could create', () => {
		const project = makeProject(), a = createPlanId(), b = createPlanId();
		const planA = makePlan({ id: a, projectId: project.id, name: 'A', parent: { planId: b, zoneId: 'zone-x' as never } });
		const planB = makePlan({ id: b, projectId: project.id, name: 'B', parent: { planId: a, zoneId: 'zone-y' as never } });
		expect(ancestryOf(planA, [planA, planB])).toEqual([{ id: b, name: 'B' }]);
	});
});
