import { describe, expect, it } from 'vitest';
import { err, isErr } from '../../../src/core/result/Result';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { ancestryOf, NO_HIERARCHY, propertyTreeOf, readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { Plan } from '../../../src/domain/plan/Plan';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../../helpers/entities';

/** The one error `failingQuery` ever answers, named so a case can assert `readPlanHierarchy` forwards THIS object rather than merely something with `ok: false`. */
const FAILING_QUERY_ERROR = { category: 'Persistence', code: 'x', message: 'y' } as const;
/** A `Query` double that refuses every call, for exercising `readPlanHierarchy`'s `isErr` arms. */
const failingQuery = { execute: () => Promise.resolve(err(FAILING_QUERY_ERROR)) };

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
		expect(ground.ancestry).toEqual([{ id: s.site.id, name: 'Site', kind: 'floor' }, { id: s.house.id, name: 'House', kind: 'floor' }]);
		expect(ground.parentZone?.name).toBe('Footprint');
		expect(ground.parentZoneMissing).toBe(false);
		const house = expectOk(await readPlanHierarchy(s.queries, s.house.id));
		expect(house.detailPlans).toEqual([
			{ id: s.upper.id, name: 'Attic', kind: 'floor', parentZoneId: s.groundZone.id },
			{ id: s.ground.id, name: 'Ground floor', kind: 'floor', parentZoneId: s.groundZone.id },
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
		expect(house).toMatchObject({ parentZone: null, parentZoneMissing: true, ancestry: [{ id: s.site.id, name: 'Site', kind: 'floor' }] });

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

	it('answers a failed plan read with isErr, carrying that query’s own error', async () => {
		const s = await scene();
		const result = await readPlanHierarchy({ ...s.queries, getPlan: failingQuery }, s.house.id);
		expect(isErr(result)).toBe(true);
		expect(result).toEqual(err(FAILING_QUERY_ERROR));
	});

	it('answers a failed plans-listing read with isErr, carrying that query’s own error', async () => {
		const s = await scene();
		const result = await readPlanHierarchy({ ...s.queries, listPlans: failingQuery }, s.house.id);
		expect(isErr(result)).toBe(true);
		expect(result).toEqual(err(FAILING_QUERY_ERROR));
	});

	it('answers a failed zones read with isErr, carrying that query’s own error', async () => {
		const s = await scene();
		const result = await readPlanHierarchy({ ...s.queries, findZonesByPlan: failingQuery }, s.house.id);
		expect(isErr(result)).toBe(true);
		expect(result).toEqual(err(FAILING_QUERY_ERROR));
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
		expect(ancestryOf(planA, [planA, planB])).toEqual([{ id: b, name: 'B', kind: 'floor' }]);
	});

	it('answers an empty chain for a plan with no parent', () => {
		const planWithoutParent = makePlan({ projectId: makeProject().id, name: 'Site' });
		expect(ancestryOf(planWithoutParent, [planWithoutParent])).toEqual([]);
	});
});

describe('propertyTreeOf', () => {
	it('nests every plan under its parent, siblings by order then name, and marks kinds', async () => {
		const s = await scene();
		const tree = propertyTreeOf([s.upper, s.ground, s.house, s.site]);
		expect(tree).toEqual([
			{ id: s.site.id, name: 'Site', kind: 'floor', order: 0, parentId: null, children: [
				{ id: s.house.id, name: 'House', kind: 'floor', order: 0, parentId: s.site.id, children: [
					{ id: s.upper.id, name: 'Attic', kind: 'floor', order: 0, parentId: s.house.id, children: [] },
					{ id: s.ground.id, name: 'Ground floor', kind: 'floor', order: 0, parentId: s.house.id, children: [] },
				] },
			] },
		]);
	});

	it('orders siblings by order before name, and carries the stored order on each node', () => {
		const project = makeProject();
		const b = makePlan({ projectId: project.id, name: 'B', order: 0 });
		const a = makePlan({ projectId: project.id, name: 'A', order: 1 });
		const c = makePlan({ projectId: project.id, name: 'C', order: 0 });
		const tree = propertyTreeOf([a, b, c]);
		expect(tree.map((node) => node.name)).toEqual(['B', 'C', 'A']);
		expect(tree.map((node) => node.order)).toEqual([0, 0, 1]);
	});

	it('draws an orphan at the root and breaks a cycle at the root', () => {
		const project = makeProject();
		const orphan = makePlan({ projectId: project.id, name: 'Orphan', parent: { planId: createPlanId(), zoneId: 'zone-x' as never } });
		const loopA = makePlan({ projectId: project.id, name: 'Loop A', order: 2 });
		const loopB = makePlan({ projectId: project.id, name: 'Loop B', parent: { planId: loopA.id, zoneId: 'zone-y' as never } });
		const loopAWithParent = expectOk(Plan.create({ ...loopA, parent: { planId: loopB.id, zoneId: 'zone-z' as never } }));
		const tree = propertyTreeOf([orphan, loopAWithParent, loopB]);
		expect(tree.map((node) => node.name).toSorted()).toEqual(['Loop A', 'Loop B', 'Orphan']);
		expect(tree.every((node) => node.children.length === 0 && node.parentId === null)).toBe(true);
		expect(tree.find((node) => node.name === 'Loop A')?.order).toBe(2);
	});

	it('readPlanHierarchy carries the whole tree for any plan', async () => {
		const s = await scene();
		const ground = expectOk(await readPlanHierarchy(s.queries, s.ground.id));
		expect(ground.tree.map((node) => node.id)).toEqual([s.site.id]);
		expect(ground.tree[0].children[0].children.map((node) => node.name)).toEqual(['Attic', 'Ground floor']);
		const site = expectOk(await readPlanHierarchy(s.queries, s.site.id));
		expect(site.tree).toEqual(ground.tree);
		expect(NO_HIERARCHY.tree).toEqual([]);
	});
});
