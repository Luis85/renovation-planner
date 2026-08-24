/**
 * The presentation read models and the query boundary that produces them (SDD §35).
 *
 * The point of this file is the BOUNDARY: an entity goes in, a flat serializable value
 * comes out, and the two failure shapes the queries distinguish survive the trip.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	createPlanEditorQueries,
	unavailablePlanEditorQueries,
} from '../../../src/presentation/read-models/planEditorQueries';
import {
	toPlanDto,
	toProjectSummaryDto,
	toZoneDto,
} from '../../../src/presentation/read-models/PlanDto';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';

describe('mapping an entity to a read model', () => {
	it('flattens a plan, background reference and all', () => {
		const projectId = createProjectId();
		const plan = makePlan({
			projectId,
			name: 'First floor',
			background: { path: 'Plans/first.pdf', kind: 'pdf', page: 3 },
			layers: ['walls'],
		});

		expect(toPlanDto(plan)).toEqual({
			id: plan.id,
			projectId,
			name: 'First floor',
			background: { path: 'Plans/first.pdf', kind: 'pdf', page: 3 },
			layers: ['walls'],
		});
	});

	it('flattens a zone, keeping its geometry in world millimetres', () => {
		const projectId = createProjectId();
		const plan = makePlan({ projectId });
		const zone = makeZone({ projectId, planId: plan.id, name: 'Bath', status: 'InProgress' });

		expect(toZoneDto(zone)).toEqual({
			id: zone.id,
			planId: plan.id,
			name: 'Bath',
			zoneType: 'Room',
			status: 'InProgress',
			points: [...zone.geometry.points],
		});
	});

	/**
	 * COPIED, not aliased. The read pipeline runs one way; a render model handed the
	 * entity's own array would let a later slice's edit reach back into a loaded entity,
	 * which is the one direction this design must not have.
	 */
	it('does not hand out the entity own point array', () => {
		const projectId = createProjectId();
		const plan = makePlan({ projectId });
		const zone = makeZone({ projectId, planId: plan.id });

		expect(toZoneDto(zone).points).not.toBe(zone.geometry.points);
		expect(toZoneDto(zone).points).toEqual([...zone.geometry.points]);
	});

	it('summarises a project down to what a header needs', () => {
		const project = makeProject({ name: 'Barn conversion' });

		expect(toProjectSummaryDto(project)).toEqual({
			id: project.id,
			name: 'Barn conversion',
			status: project.status,
		});
	});
});

async function wired() {
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const projectId = createProjectId();
	const plan = makePlan({ projectId, name: 'Ground floor' });
	expectOk(await plans.save(plan, 'absent'));
	const zone = makeZone({ projectId, planId: plan.id, name: 'Hall' });
	expectOk(await zones.save(zone, 'absent'));
	const queries = createPlanEditorQueries({
		getPlan: new GetPlan(plans),
		findZonesByPlan: new FindZonesByPlan(zones),
	});
	return { plans, zones, plan, zone, queries };
}

describe('the plan editor query boundary', () => {
	it('answers a plan as a DTO, not as an entity', async () => {
		const { plan, queries } = await wired();

		const found = expectOk(await queries.getPlan(plan.id));

		expect(found).toEqual(toPlanDto(plan));
		// Flat and serializable all the way down — no domain method survived the boundary.
		expect(JSON.parse(JSON.stringify(found))).toEqual(found);
	});

	it('answers a plan that does not exist with ok(null), never an error', async () => {
		const { queries } = await wired();

		expect(expectOk(await queries.getPlan('plan-nope'))).toBeNull();
	});

	it('answers a plan whose read failed with isErr, so the two stay distinguishable', async () => {
		const failing = {
			getPlan: { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })) },
			findZonesByPlan: { execute: () => Promise.resolve(ok([])) },
		};

		const result = await createPlanEditorQueries(failing as never).getPlan('plan-1');

		expect(expectErr(result)).toMatchObject({ category: 'Persistence' });
	});

	it('answers a plan zones as DTOs', async () => {
		const { plan, zone, queries } = await wired();

		expect(expectOk(await queries.findZonesByPlan(plan.id))).toEqual([toZoneDto(zone)]);
	});

	it('surfaces a failed zone read as an error rather than an empty list', async () => {
		const failing = {
			getPlan: { execute: () => Promise.resolve(ok(null)) },
			findZonesByPlan: {
				execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })),
			},
		};

		const result = await createPlanEditorQueries(failing as never).findZonesByPlan('plan-1');

		expect(expectErr(result)).toMatchObject({ category: 'Persistence' });
	});

	/**
	 * A session whose settings could not be read composes no repository at all, so the view
	 * is handed services that REFUSE — not ones that answer empty. "Your settings are
	 * broken" is not "this plan does not exist", and the editor's failed state is the right
	 * thing to show for the first.
	 */
	it('refuses both reads when settings were never recovered', async () => {
		const queries = unavailablePlanEditorQueries();

		expect(expectErr(await queries.getPlan('plan-1'))).toMatchObject({
			category: 'Persistence',
			code: 'settings.unrecovered',
		});
		expect(expectErr(await queries.findZonesByPlan('plan-1'))).toMatchObject({
			code: 'settings.unrecovered',
		});
	});
});
