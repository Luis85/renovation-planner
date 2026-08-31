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
import { ListProjects } from '../../../src/application/queries/ListProjects';
import type { LibraryOverlaps } from '../../../src/application/ports/LibraryOverlaps';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	createPlanEditorQueries,
	unavailablePlanEditorQueries,
} from '../../../src/presentation/read-models/planEditorQueries';
import {
	createRenovationProjectQueries,
	unavailableRenovationProjectQueries,
} from '../../../src/presentation/read-models/renovationProjectQueries';
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
			calibration: null,
			layers: ['walls'],
		});
	});

	it('carries a plan CALIBRATION onto the read model', () => {
		// The field the editor's tool framework reads through `EditorContext.activePlan`.
		// It was absent from this DTO, so the runtime handed every tool a hard-coded `null`
		// — an uncalibrated reading of a calibrated plan, with the type satisfied.
		const calibration = {
			pointA: { x: 0, y: 0 },
			pointB: { x: 1000, y: 0 },
			knownDistance: 1000,
			pixelsPerWorldUnit: 2,
		};
		const plan = expectOk(makePlan({ projectId: createProjectId() }).withCalibration(calibration));

		expect(toPlanDto(plan).calibration).toEqual(calibration);
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

		expect(toProjectSummaryDto(project, false)).toEqual({
			id: project.id,
			name: 'Barn conversion',
			status: project.status,
			libraryOverlap: false,
		});
	});

	/**
	 * §83's flag is an ARGUMENT, not something read off the entity — a `Project` cannot know
	 * whether its derived folder overlaps a configured library folder. Asserted in both
	 * directions, because a mapper that hard-coded `false` would satisfy the case above.
	 */
	it('carries the caller own overlap answer rather than deriving one', () => {
		const project = makeProject({ name: 'Barn conversion' });

		expect(toProjectSummaryDto(project, true).libraryOverlap).toBe(true);
		expect(toProjectSummaryDto(project, false).libraryOverlap).toBe(false);
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
	it('refuses every read when settings were never recovered', async () => {
		const queries = unavailablePlanEditorQueries();

		expect(expectErr(await queries.getPlan('plan-1'))).toMatchObject({
			category: 'Persistence',
			code: 'settings.unrecovered',
		});
		for (const refused of [
			await queries.findZonesByPlan('plan-1'),
			await queries.getRequirementsForZone('zone-1'),
			await queries.listAssets(),
			await queries.listRequirementsReferencing('zone-1'),
			await queries.listReassignmentTargets('zone-1'),
		]) {
			expect(expectErr(refused)).toMatchObject({ code: 'settings.unrecovered' });
		}
	});

	/**
	 * The four slice-10 members are OPTIONAL on the input, for editor test rigs that mount
	 * no Requirements panel content — and an omitted one answers EMPTY rather than throwing.
	 * Asserted because the alternative reads identically at the call site and fails only in
	 * a rig, which is the last place anyone looks.
	 */
	it('surfaces a failed asset read as an error rather than an empty picker', async () => {
		// An empty picker and an unreadable catalog look identical to the panel, and only one
		// of them means "this project has no assets yet".
		const failing = createPlanEditorQueries({
			getPlan: { execute: () => Promise.resolve(ok(null)) },
			findZonesByPlan: { execute: () => Promise.resolve(ok([])) },
			listAssets: {
				execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })),
			},
		} as never);

		expect(expectErr(await failing.listAssets())).toMatchObject({ category: 'Persistence' });
	});

	/**
	 * A read that refuses must not reach the flow as an empty set — that is exactly the
	 * picture "this zone has no referents" produces, and the flow would delete on it.
	 */
	it('surfaces a failed referent read rather than an empty referent set', async () => {
		const failing = createPlanEditorQueries({
			getPlan: { execute: () => Promise.resolve(ok(null)) },
			findZonesByPlan: { execute: () => Promise.resolve(ok([])) },
			listRequirementsReferencing: {
				execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })),
			},
		} as never);

		expect(expectErr(await failing.listRequirementsReferencing('zone-1'))).toMatchObject({
			category: 'Persistence',
		});
	});

	/**
	 * The seam carries the GROUPS. It flattened them for one slice, which left slice 19's
	 * grouping — and the per-project rows the delete dialog draws from it — unreachable: the
	 * ambiguity decision is the query's, and once the project names are gone nothing
	 * downstream can recover it. The assertion is on the shape, not on a count, because a
	 * flattening answers the right NUMBER of referents and the wrong thing entirely.
	 */
	it('carries the referent groups a shared asset spreads across projects, unflattened', async () => {
		const grouped = createPlanEditorQueries({
			getPlan: { execute: () => Promise.resolve(ok(null)) },
			findZonesByPlan: { execute: () => Promise.resolve(ok([])) },
			listRequirementsReferencing: {
				execute: () =>
					Promise.resolve(
						ok([
							{ projectId: 'p-1', projectName: 'Kitchen', requirementIds: ['r-1', 'r-2'] },
							{ projectId: 'p-2', projectName: 'Bathroom', requirementIds: ['r-3'] },
						]),
					),
			},
		} as never);

		expect(expectOk(await grouped.listRequirementsReferencing('zone-1'))).toEqual([
			{ projectId: 'p-1', projectName: 'Kitchen', requirementIds: ['r-1', 'r-2'] },
			{ projectId: 'p-2', projectName: 'Bathroom', requirementIds: ['r-3'] },
		]);
	});

	it('answers empty for a slice-10 query the composition omitted', async () => {
		const bare = createPlanEditorQueries({
			getPlan: { execute: () => Promise.resolve(ok(null)) },
			findZonesByPlan: { execute: () => Promise.resolve(ok([])) },
		} as never);

		expect(expectOk(await bare.getRequirementsForZone('zone-1'))).toEqual([]);
		expect(expectOk(await bare.listAssets())).toEqual([]);
		expect(expectOk(await bare.listRequirementsReferencing('zone-1'))).toEqual([]);
		expect(expectOk(await bare.listReassignmentTargets('zone-1'))).toEqual([]);
	});
});

/**
 * The §83 overlap port, answering nothing — there is no vault and no Project Index behind
 * these in-memory repositories, so no folder is derivable and there is genuinely nothing to
 * report. `overlapping` is not part of `ProjectListView` anyway: the read model maps the two
 * fields the view draws today, and this file is about that boundary rather than about §83.
 */
const NO_OVERLAPS: LibraryOverlaps = { overlapping: () => [] };

describe('the renovation project query boundary', () => {
	it('answers every project as a DTO, not as an entity', async () => {
		const projects = new InMemoryProjectRepository();
		const project = makeProject({ name: 'Barn conversion' });
		expectOk(await projects.save(project, 'absent'));
		const queries = createRenovationProjectQueries(new ListProjects(projects, NO_OVERLAPS));

		const found = expectOk(await queries.listProjects());

		expect(found.projects).toEqual([toProjectSummaryDto(project, false)]);
		// Flat and serializable all the way down — no domain method survived the boundary.
		expect(JSON.parse(JSON.stringify(found))).toEqual(found);
	});

	/**
	 * The §83 mapping, which the `NO_OVERLAPS` port above cannot reach: it answers `[]`, so
	 * every case in this block would be equally green against a boundary that dropped
	 * `overlapping` entirely — which is exactly what this boundary did until design slice 19.
	 *
	 * Both directions in ONE read, over two projects, because that is the claim: the flag
	 * lands on the project the port NAMED and on no other. A mapping that set every row's
	 * flag from `overlapping.length > 0` would pass a single-project case in both directions.
	 */
	it('marks the projects the overlap port names, and only those', async () => {
		const projects = new InMemoryProjectRepository();
		const overlapping = makeProject({ name: 'Barn conversion' });
		const ordinary = makeProject({ name: 'Loft conversion' });
		expectOk(await projects.save(overlapping, 'absent'));
		expectOk(await projects.save(ordinary, 'absent'));
		const queries = createRenovationProjectQueries(
			new ListProjects(projects, { overlapping: () => [overlapping.id] }),
		);

		const found = expectOk(await queries.listProjects());

		expect(
			Object.fromEntries(found.projects.map((project) => [project.name, project.libraryOverlap])),
		).toEqual({ 'Barn conversion': true, 'Loft conversion': false });
	});

	it('answers an empty vault with an empty list and no refusals, not an error', async () => {
		const queries = createRenovationProjectQueries(new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS));

		expect(expectOk(await queries.listProjects())).toEqual({ projects: [], unreadable: 0 });
	});

	/**
	 * The `isErr` branch of `createRenovationProjectQueries` — a failed read must stay
	 * distinguishable from a legitimately empty vault, which is the whole reason the
	 * `Result` travels through unflattened.
	 */
	it('answers a failed read with isErr, never with an empty list', async () => {
		const failing = { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })) };

		const result = await createRenovationProjectQueries(failing as never).listProjects();

		expect(expectErr(result)).toMatchObject({ category: 'Persistence' });
	});

	/**
	 * A session whose settings could not be read composes no repository at all, so the view
	 * is handed a query service that REFUSES — the same reasoning
	 * `unavailablePlanEditorQueries` states, and the same `settings.unrecovered` code rather
	 * than a second one for the identical fact.
	 */
	it('refuses the read when settings were never recovered', async () => {
		const queries = unavailableRenovationProjectQueries();

		expect(expectErr(await queries.listProjects())).toMatchObject({
			category: 'Persistence',
			code: 'settings.unrecovered',
		});
	});
});
