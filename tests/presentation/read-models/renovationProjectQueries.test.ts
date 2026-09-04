/**
 * The Renovation Project query boundary: `createRenovationProjectQueries` and its refusing
 * twin (SDD §35).
 *
 * Split out of `readModels.test.ts` when the union of the Home surface's facts port and the
 * price section's catalogue read took that file past its line budget. The seam is the one
 * `renovationProjectQueries.ts` itself argues for — "two small files named for their views
 * beat one growing file named for one of them" — so the mapping cases and the Plan Editor
 * boundary stay there and this file owns the four doors of the project surface's own read.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { GetProject } from '../../../src/application/queries/GetProject';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { ListProjects } from '../../../src/application/queries/ListProjects';
import type { Query } from '../../../src/application/queries/Query';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { Result } from '../../../src/core/result/Result';
import type { LibraryOverlaps } from '../../../src/application/ports/LibraryOverlaps';
import type { ProjectListFacts, ProjectRowFacts } from '../../../src/application/ports/ProjectListFacts';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import {
	createRenovationProjectQueries,
	unavailableRenovationProjectQueries,
} from '../../../src/presentation/read-models/renovationProjectQueries';
import { toProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

/** What `toProjectSummaryDto` is handed where the case is not about either Home fact. */
const NO_ROW_FACTS: ProjectRowFacts = { planCount: 0, lastWorked: null };

/** A last-worked stamp distinctive enough that a passed-through one is unmistakable. */
const WORKED = '2026-08-14T00:00:00.000Z';

/**
 * The §83 overlap port, answering nothing — there is no vault and no Project Index behind
 * these in-memory repositories, so no folder is derivable and there is genuinely nothing to
 * report. `overlapping` is not part of `ProjectListView` anyway: the read model maps the two
 * fields the view draws today, and this file is about that boundary rather than about §83.
 */
const NO_OVERLAPS: LibraryOverlaps = { overlapping: () => [] };

/**
 * The Home surface's facts port, answering what the REAL adapter answers over an empty
 * Project Index: one entry per id asked about, with nothing counted and nothing dated. Not a
 * sparse map and not an empty one — the port's contract is an entry per id, and a stub that
 * broke it would make the `?? NO_FACTS` fallback below look load-bearing when it is not.
 */
const NO_FACTS: ProjectListFacts = {
	factsFor: (ids) => new Map(ids.map((id) => [id, { planCount: 0, lastWorked: null }])),
};

/**
 * This file is about the getProject/listProjects/listPlansByProject boundary; none of its
 * cases exercise the price list, so every call gets the same empty answer rather than a
 * fifth `NO_OVERLAPS`-shaped literal repeated at each site.
 */
const NO_ASSET_PRICES: Query<ProjectId, Result<AssetPriceRowDto[], RepositoryError>> = {
	execute: () => Promise.resolve(ok([])),
};


describe('the renovation project query boundary', () => {
	it('answers every project as a DTO, not as an entity', async () => {
		const projects = new InMemoryProjectRepository();
		const project = makeProject({ name: 'Barn conversion' });
		expectOk(await projects.save(project, 'absent'));
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.listProjects());

		expect(found.projects).toEqual([toProjectSummaryDto(project, false, NO_ROW_FACTS)]);
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
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, { overlapping: () => [overlapping.id] }, NO_FACTS),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.listProjects());

		expect(
			Object.fromEntries(found.projects.map((project) => [project.name, project.libraryOverlap])),
		).toEqual({ 'Barn conversion': true, 'Loft conversion': false });
	});

	it('answers an empty vault with an empty list and no refusals, not an error', async () => {
		const projects = new InMemoryProjectRepository();
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		expect(expectOk(await queries.listProjects())).toEqual({ projects: [], unreadable: 0 });
	});

	/**
	 * The `isErr` branch of `createRenovationProjectQueries` — a failed read must stay
	 * distinguishable from a legitimately empty vault, which is the whole reason the
	 * `Result` travels through unflattened.
	 */
	it('answers a failed read with isErr, never with an empty list', async () => {
		const failing = { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })) };

		const result = await createRenovationProjectQueries({
			listProjects: failing as never,
			getProject: undefined as never,
			listPlansByProject: undefined as never,
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		}).listProjects();

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

/**
 * Both new doors map at THIS seam, not in the query: `application/` may not name
 * `presentation/`, so the query hands back domain entities and the DTO is minted here —
 * the same division `createPlanEditorQueries` draws for `getPlan` and `findZonesByPlan`.
 */
describe('createRenovationProjectQueries — the detail state’s two reads', () => {
	it('maps a found project to its summary DTO', async () => {
		const projects = new InMemoryProjectRepository();
		const saved = expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.getProject(saved.entity.id));

		// EXHAUSTIVE on purpose, which is why slice 19 broke it: `toEqual` pins "and no more",
		// so the DTO gaining `libraryOverlap` failed here rather than passing over a field this
		// case had never heard of. `false` is the port's ANSWER — `NO_OVERLAPS` above returns an
		// empty overlapping set — not a value this fixture states.
		expect(found).toEqual({
			id: saved.entity.id,
			name: 'Hallway',
			status: saved.entity.status,
			currency: saved.entity.currency,
			libraryOverlap: false,
			planCount: 0,
			lastWorked: null,
		});
	});

	/**
	 * **`getProject` ASKS the overlaps port**, and nothing proved it until this case.
	 *
	 * `ProjectSummaryDto.libraryOverlap` is required because the list row draws a mark and a
	 * word from it, and this door answers the same type — so the merge of slices 19 and 21 left
	 * a choice: hard-code `false`, which compiles and passes every case above because the
	 * detail state draws no marker, or ask the same instrument the list reaches through
	 * `ListProjects`. The second was taken, and this is what makes that a behaviour rather than
	 * a comment: a port answering "this one overlaps" must reach the DTO.
	 *
	 * It fails against the `false` — which is the whole point, since that build is otherwise
	 * indistinguishable from this one.
	 */
	it('answers the overlaps port rather than a fixed false', async () => {
		const projects = new InMemoryProjectRepository();
		const saved = expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: { overlapping: () => [saved.entity.id] },
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.getProject(saved.entity.id));

		expect(found?.libraryOverlap).toBe(true);
	});

	/**
	 * `ok(null)` travels through UNCHANGED — it is not an error and must not become one.
	 * `ProjectDetailStore` branches on exactly this to tell "no such project" from "the read
	 * failed", and flattening the two is what would tell a user their project was deleted
	 * because their vault hiccuped.
	 */
	it('passes a missing project through as ok(null)', async () => {
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(new InMemoryProjectRepository()),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.getProject('project-01JNOPE'));

		expect(found).toBeNull();
	});

	it('maps a project’s plans to summary DTOs', async () => {
		const plans = new InMemoryPlanRepository();
		const projectId = 'project-01JAAA' as ProjectId;
		expectOk(await plans.save(makePlan({ projectId, name: 'Ground floor' }), 'absent'));
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(new InMemoryProjectRepository()),
			listPlansByProject: new ListPlansByProject(plans),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const listed = expectOk(await queries.listPlansByProject(projectId));

		expect(listed.plans.map((plan) => plan.name)).toEqual(['Ground floor']);
		expect(listed.unreadable).toBe(0);
	});

	/**
	 * The `isErr` branch of `getProject` — a failed read must stay distinguishable from a
	 * project that does not exist, the same rule `listProjects`'s own isErr case pins for
	 * its sibling door.
	 */
	it('answers a failed project read with isErr, never as a missing project', async () => {
		const failing = { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })) };
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS, NO_FACTS),
			getProject: failing as never,
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const result = await queries.getProject('project-01JAAA');

		expect(expectErr(result)).toMatchObject({ category: 'Persistence' });
	});

	/**
	 * The Home surface's two commissioned facts reach the DTO from the port rather than from
	 * anywhere else. Both fields, because a mapping that carried one and hard-coded the other
	 * passes a case that reads only the one it carried.
	 */
	it('carries planCount and lastWorked onto every summary', async () => {
		const projects = new InMemoryProjectRepository();
		expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));
		const facts: ProjectListFacts = {
			factsFor: (ids) => new Map(ids.map((id) => [id, { planCount: 3, lastWorked: WORKED }])),
		};
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, facts),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.listProjects());

		expect(found.projects[0]?.planCount).toBe(3);
		expect(found.projects[0]?.lastWorked).toBe(WORKED);
	});

	/**
	 * The SINGLE-project door asks the port too. A hard-coded `{ planCount: 0, lastWorked:
	 * null }` here passes every case that only reads the LIST, which is why this asserts on
	 * the door that would have kept the lie — and on WHICH id was asked about, because a door
	 * asking for the wrong project would answer a plausible number about somebody else's.
	 */
	it('asks the facts port at the single-project door too', async () => {
		const projects = new InMemoryProjectRepository();
		const saved = expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));
		let asked: readonly string[] = [];
		const facts: ProjectListFacts = {
			factsFor: (ids) => {
				asked = ids;
				return new Map(ids.map((id) => [id, { planCount: 7, lastWorked: WORKED }]));
			},
		};
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const found = expectOk(await queries.getProject(saved.entity.id));

		expect(asked).toEqual([saved.entity.id]);
		expect(found?.planCount).toBe(7);
		expect(found?.lastWorked).toBe(WORKED);
	});

	/**
	 * `ReadonlyMap.get` answers `V | undefined`, so BOTH doors carry a fallback the port's own
	 * contract forbids reaching — "one entry per id asked about, never a sparse map". The
	 * branch exists because the TYPE requires it, not because a compliant port can produce it,
	 * and a fallback nothing drives is a fallback nobody would notice going wrong. A sparse
	 * port is what drives it: zero and null, never a refusal, because a row with an unknown
	 * plan count still has a name, a status and a currency worth drawing.
	 */
	it('draws a row for a project the facts port left out at either door', async () => {
		const projects = new InMemoryProjectRepository();
		const saved = expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));
		const sparse: ProjectListFacts = { factsFor: () => new Map() };
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(projects, NO_OVERLAPS, sparse),
			getProject: new GetProject(projects),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: sparse,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const listed = expectOk(await queries.listProjects());
		const one = expectOk(await queries.getProject(saved.entity.id));

		expect(listed.projects[0]).toMatchObject({ name: 'Hallway', planCount: 0, lastWorked: null });
		expect(one).toMatchObject({ name: 'Hallway', planCount: 0, lastWorked: null });
	});

	/** The `isErr` branch of `listPlansByProject` — the same distinction, one door over. */
	it('answers a failed plans read with isErr, never as an empty list', async () => {
		const failing = { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })) };
		const queries = createRenovationProjectQueries({
			listProjects: new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(new InMemoryProjectRepository()),
			listPlansByProject: failing as never,
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: NO_ASSET_PRICES,
		});

		const result = await queries.listPlansByProject('project-01JAAA');

		expect(expectErr(result)).toMatchObject({ category: 'Persistence' });
	});

	/**
	 * `listAssetPrices` is a straight pass-through — `ListProjectAssetPrices` already builds
	 * the row this view renders, so there is no mapping step here for a second query to
	 * disagree with the first about. Asserted on BOTH arms, the same way the other two doors
	 * above are: an `ok` result travels unchanged, and so does a failure, never collapsed to
	 * an empty list.
	 */
	it('passes listAssetPrices straight through, both when it answers and when it refuses', async () => {
		const row: AssetPriceRowDto = {
			assetId: 'asset-1',
			assetName: 'Oak flooring',
			catalogue: null,
			override: null,
			overrideId: null,
			overrideVersion: null,
			assetStatus: 'known',
		};
		const answering = createRenovationProjectQueries({
			listProjects: new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(new InMemoryProjectRepository()),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: { execute: () => Promise.resolve(ok([row])) },
		});
		expect(await answering.listAssetPrices('project-01JAAA')).toEqual(ok([row]));

		const failing = { execute: () => Promise.resolve(err({ category: 'Persistence', code: 'x', message: 'y' })) };
		const refusing = createRenovationProjectQueries({
			listProjects: new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS, NO_FACTS),
			getProject: new GetProject(new InMemoryProjectRepository()),
			listPlansByProject: new ListPlansByProject(new InMemoryPlanRepository()),
			overlaps: NO_OVERLAPS,
			facts: NO_FACTS,
			listAssetPrices: failing as never,
		});
		const result = await refusing.listAssetPrices('project-01JAAA');
		expect(expectErr(result)).toMatchObject({ category: 'Persistence' });
	});

	/**
	 * ONE logical failure must not arrive under two codes when something downstream branches
	 * on it — the rule `unavailableRenovationProjectQueries` already states for `listProjects`.
	 */
	it('refuses all three new doors with settings.unrecovered when settings could not be recovered', async () => {
		const queries = unavailableRenovationProjectQueries();

		const project = await queries.getProject('project-01JAAA');
		const plans = await queries.listPlansByProject('project-01JAAA');
		const prices = await queries.listAssetPrices('project-01JAAA');

		expect(expectErr(project).code).toBe('settings.unrecovered');
		expect(expectErr(plans).code).toBe('settings.unrecovered');
		expect(expectErr(prices).code).toBe('settings.unrecovered');
	});
});
