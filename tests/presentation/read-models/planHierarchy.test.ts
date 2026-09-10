import { describe, expect, it } from 'vitest';
import { err, isErr } from '../../../src/core/result/Result';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { ancestryOf, NO_HIERARCHY, readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../../helpers/entities';

/** A `Query` double that refuses every call, for exercising `readPlanHierarchy`'s `isErr` arms. */
const failingQuery = { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' } as const)) };

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

	/**
	 * Spec §4.9: "Parent plan deleted or unreadable — Chain ends at the project; no guide."
	 * The zone note itself still resolves (zones are indexed independently of their plan
	 * note), so a fix keyed only on the zone lookup would still draw a guide here.
	 */
	it('draws no guide once the parent plan is gone, even though its zone note still resolves', async () => {
		const s = await scene();
		expectOk(await s.plans.delete(s.site.id, expectFound(await s.plans.getById(s.site.id)).version));
		expectFound(await s.zones.getById(s.houseZone.id));

		const house = expectOk(await readPlanHierarchy(s.queries, s.house.id));
		expect(house.parentZone).toBeNull();
		expect(house.parentZoneMissing).toBe(false);
		expect(house.ancestry).toEqual([]);
	});

	it('answers a failed plan read with isErr', async () => {
		const s = await scene();
		const result = await readPlanHierarchy({ ...s.queries, getPlan: failingQuery }, s.house.id);
		expect(isErr(result)).toBe(true);
	});

	it('answers a failed plans-listing read with isErr', async () => {
		const s = await scene();
		const result = await readPlanHierarchy({ ...s.queries, listPlans: failingQuery }, s.house.id);
		expect(isErr(result)).toBe(true);
	});

	it('answers a failed zones read with isErr', async () => {
		const s = await scene();
		const result = await readPlanHierarchy({ ...s.queries, findZonesByPlan: failingQuery }, s.house.id);
		expect(isErr(result)).toBe(true);
	});

	it('carries the parent zone’s curve bulges into the outline when it has any', async () => {
		const plans = new InMemoryPlanRepository(), zones = new InMemoryZoneRepository(), project = makeProject();
		const site = makePlan({ projectId: project.id, name: 'Site' });
		const curvedZone = makeZone({ projectId: project.id, planId: site.id, name: 'Yard', zoneType: 'Custom', geometry: { points: squareAt().points, bulges: [0.25, 0, 0, 0] } });
		const child = makePlan({ projectId: project.id, name: 'Yard detail', parent: { planId: site.id, zoneId: curvedZone.id } });
		expectOk(await plans.save(site, 'absent'));
		expectOk(await plans.save(child, 'absent'));
		expectOk(await zones.save(curvedZone, 'absent'));
		const queries = { getPlan: new GetPlan(plans), listPlans: new ListPlansByProject(plans), findZonesByPlan: new FindZonesByPlan(zones) };
		const hierarchy = expectOk(await readPlanHierarchy(queries, child.id));
		expect(hierarchy.parentZone?.bulges).toEqual([0.25, 0, 0, 0]);
	});
});

describe('ancestryOf', () => {
	it('stops at a cycle a hand-edited note could create', () => {
		const project = makeProject(), a = createPlanId(), b = createPlanId();
		const planA = makePlan({ id: a, projectId: project.id, name: 'A', parent: { planId: b, zoneId: 'zone-x' as never } });
		const planB = makePlan({ id: b, projectId: project.id, name: 'B', parent: { planId: a, zoneId: 'zone-y' as never } });
		expect(ancestryOf(planA, [planA, planB])).toEqual([{ id: b, name: 'B' }]);
	});

	it('answers an empty chain for a plan with no parent', () => {
		const planWithoutParent = makePlan({ projectId: makeProject().id, name: 'Site' });
		expect(ancestryOf(planWithoutParent, [planWithoutParent])).toEqual([]);
	});
});
