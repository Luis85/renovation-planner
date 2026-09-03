import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { LibraryOverlaps } from '../../application/ports/LibraryOverlaps';
import type { ProjectListFacts, ProjectRowFacts } from '../../application/ports/ProjectListFacts';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { Query } from '../../application/queries/Query';
import type { GetProjectInput } from '../../application/queries/GetProject';
import type {
	ListPlansByProjectInput,
	PlanListResult,
} from '../../application/queries/ListPlansByProject';
import type { ProjectListResult } from '../../application/queries/ListProjects';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';
import type { Loaded } from '../../application/ports/versioning';
import type { Project } from '../../domain/project/Project';
import type { ProjectId } from '../../domain/project/ProjectId';
import { toPlanSummaryDto, toProjectSummaryDto, type PlanSummaryDto, type ProjectSummaryDto } from './PlanDto';

/**
 * The view's own shape of a project listing: summaries it can render, and how many projects
 * it cannot show. `unreadable > 0` is what suppresses the empty state — see
 * `selectRenovationProjectEmptyState`.
 */
export interface ProjectListView {
	readonly projects: readonly ProjectSummaryDto[];
	readonly unreadable: number;
}

/**
 * The detail state's own shape of a plan listing: summaries it can render, and how many plans
 * it cannot show. `ProjectListView`'s twin one level down.
 */
export interface PlanListView {
	readonly plans: readonly PlanSummaryDto[];
	readonly unreadable: number;
}

/**
 * The ONLY application-layer surface the Renovation Project view depends on. A sibling of
 * `planEditorQueries.ts` rather than a member of it: that file is named for the Plan Editor
 * and already carries six methods answering to it, and a `listProjects` bolted on would be
 * named for the wrong view. Two small files named for their views beat one growing file
 * named for one of them.
 */
export interface RenovationProjectQueryServices {
	listProjects(): Promise<Result<ProjectListView, RepositoryError>>;
	/**
	 * One project by id — design slice 21's detail state. `ok(null)` means "no such project"
	 * and travels through unchanged, because the store has to tell that apart from a failed
	 * read: navigating away on a failure would tell a user their project was deleted because
	 * their vault hiccuped.
	 */
	getProject(projectId: string): Promise<Result<ProjectSummaryDto | null, RepositoryError>>;
	/** That project's plans, as list rows read them, and how many notes refused to be read. */
	listPlansByProject(projectId: string): Promise<Result<PlanListView, RepositoryError>>;
	/**
	 * The price section's own read: the whole shared catalogue with this project's own price
	 * beside each default. Answers `AssetPriceRowDto[]` directly rather than a mapped DTO —
	 * `ListProjectAssetPrices` already builds the row this view renders, and a second mapping
	 * here would be a second derivation of the same shape.
	 */
	listAssetPrices(projectId: string): Promise<Result<AssetPriceRowDto[], RepositoryError>>;
}

/**
 * The read side for a session whose settings could not be recovered.
 *
 * With settings unrecovered there is no repository, no index and no project list, so the
 * view is handed a query service that refuses.
 *
 * **That the root builds none is a conservative choice, not a necessity, and the reason
 * lives with the choice** — `CompositionRoot.persistence`. Since ADR-0013 the index's scan
 * is bounded by what a note DECLARES and an existing project's folder comes from where its
 * own note sits, so a project list would in fact be readable without the setting; what the
 * root refuses to do is compose a stack where one door (creating a new project's folder) has
 * no answer and every other one works.
 *
 * This is the exemption `CLAUDE.md`'s fifth fake-instance lesson names, not a violation of
 * it: that lesson is about a STAND-IN refusing what production would have answered, which
 * turns a tool built for looking into one that shows a false picture. Here there is no
 * production answer to hide — with settings unrecovered there is genuinely no repository,
 * no index and no project list to read, so `settings.unrecovered` is exactly what a caller
 * should get, not a milder substitute for it. The Plan Editor's `unavailablePlanEditorQueries`
 * documents the identical reasoning for the identical situation, and the same `code` travels
 * here rather than being re-derived: one logical failure must not arrive under two different
 * codes when something downstream branches on it.
 */
function refuseUnrecovered(): Promise<Result<never, RepositoryError>> {
	return Promise.resolve(
		err<RepositoryError>({
			category: 'Persistence',
			code: 'settings.unrecovered',
			message: 'Settings could not be read, so no project can be loaded.',
		}),
	);
}

export function unavailableRenovationProjectQueries(): RenovationProjectQueryServices {
	return {
		listProjects: refuseUnrecovered,
		getProject: refuseUnrecovered,
		listPlansByProject: refuseUnrecovered,
		listAssetPrices: refuseUnrecovered,
	};
}

/**
 * Slice 11's guarded `ListProjects`, mapped at the boundary into the read model above.
 * Typed structurally (`Query<void, …>`), never as the concrete `ListProjects` class,
 * for the same reason `guardedServices.ts` states once for every service it wraps: what
 * the composition root hands out is a wrapper object with the same `execute`, not the
 * class itself, and a parameter typed as the class would refuse that wrapper.
 *
 * `application/` may not name `presentation/`, so the query hands back domain
 * entities and the mapping to `ProjectSummaryDto` happens here — the same division
 * `createPlanEditorQueries` draws for `getPlan` and `findZonesByPlan`.
 */
/**
 * What a project the facts port did not answer for gets, at BOTH doors.
 *
 * A compliant port never produces it — `ProjectListFacts.factsFor` states one entry per id
 * asked about, never a sparse map — so this exists because `ReadonlyMap.get` is typed
 * `V | undefined` and the branch has to go somewhere, not because either door is likelier to
 * miss than the other. `readModels.test.ts` drives a deliberately sparse port through both,
 * so the arm is exercised rather than merely present.
 *
 * Zero and null rather than a refusal: the detail state draws neither field today, and a row
 * with an unknown plan count still has a name, a status and a currency worth drawing.
 */
const NO_FACTS: ProjectRowFacts = { planCount: 0, lastWorked: null };

/**
 * ONE bundle rather than six positional parameters, which is `createPlanEditorQueries`'s own
 * shape one file over and the reason is the same: this boundary grows a member every time a
 * surface above it grows a section, and the Home surface's facts port and the price section's
 * catalogue read arrived from two independent branches into a signature that was already at
 * five, which is a `max-params` failure. So: a lint rule forced a signature change, and the
 * bundle is the shape it was changed INTO — not a latent hazard the rule uncovered.
 *
 * An earlier draft of this comment claimed the positional form let a call site "silently
 * transpose" two adjacent ports of the same shape. Measured and false: `ProjectListFacts`
 * declares `factsFor` and every other member here declares `execute`, and all six are
 * mutually unassignable on their parameter and return types, so that swap — and every other
 * pairwise one — is a compile error in either spelling. The bundle buys legibility at the
 * call site; it buys no safety the compiler was not already giving.
 */
export function createRenovationProjectQueries(deps: {
	readonly listProjects: Query<void, Result<ProjectListResult, RepositoryError>>;
	readonly getProject: Query<GetProjectInput, Result<Loaded<Project> | null, RepositoryError>>;
	readonly listPlansByProject: Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>;
	readonly overlaps: LibraryOverlaps;
	readonly facts: ProjectListFacts;
	readonly listAssetPrices: Query<ProjectId, Result<AssetPriceRowDto[], RepositoryError>>;
}): RenovationProjectQueryServices {
	const { listProjects, getProject, listPlansByProject, overlaps, facts, listAssetPrices } = deps;
	return {
		async listProjects() {
			const found = await listProjects.execute();
			if (isErr(found)) return found;
			// A SET rather than `overlapping.includes(...)` per row: the query answers a list
			// of ids and the mapping asks one question per project, which is quadratic on a
			// vault with many projects for no reason — and the set is built once per read, so
			// it cannot drift from the list it came from the way a second lookup could.
			const overlapping = new Set<string>(found.value.overlapping);
			return ok({
				projects: found.value.projects.map((project) =>
					toProjectSummaryDto(
						project,
						overlapping.has(project.id),
						found.value.facts.get(project.id) ?? NO_FACTS,
					),
				),
				unreadable: found.value.unreadable,
			});
		},

		/**
		 * The `as ProjectId` is the same boundary assertion every other edge of the system
		 * makes — `createPlanEditorQueries` states it for `as PlanId` at its own two doors.
		 * The id arrives from a `ProjectSummaryDto` this bundle itself minted or from
		 * Obsidian's view state, and the repository's answer for an id that names nothing is
		 * `ok(null)`, which is a case the caller already handles.
		 */
		async getProject(projectId) {
			const found = await getProject.execute({ projectId: projectId as ProjectId });
			if (isErr(found)) return found;
			if (found.value === null) return ok(null);
			// §83's flag ASKED rather than fabricated. `ProjectSummaryDto.libraryOverlap` is
			// required because the list row renders a mark and a word from it, and this door
			// answers the same DTO type — so `false` here would be a statement about a project
			// whose folder this function never compared. The detail state draws no marker today,
			// which is exactly what makes the lie safe to tell and wrong to write down: the day
			// it grows one, a hard-coded `false` is a defect with no failing test in front of it.
			//
			// `overlapping` takes a LIST and answers the overlapping subset, so a single id is a
			// one-element ask — synchronous, and the same instrument the list query reaches
			// through `ListProjects`, rather than a second derivation that could disagree with it.
			const [overlapping] = overlaps.overlapping([found.value.entity.id]);
			// ASKED rather than fabricated, exactly as `libraryOverlap` is one line up and for
			// the reason that comment gives: this door answers the same DTO type, so a
			// hard-coded `{ planCount: 0, lastWorked: null }` here would be a statement about a
			// project this function never counted — safe today only because the detail state
			// draws neither field, and a defect with no failing test in front of it the day it
			// does. One instrument for both doors, so the two cannot disagree about a project.
			const rowFacts = facts.factsFor([found.value.entity.id]).get(found.value.entity.id);
			return ok(
				toProjectSummaryDto(found.value.entity, overlapping !== undefined, rowFacts ?? NO_FACTS),
			);
		},

		async listPlansByProject(projectId) {
			const listed = await listPlansByProject.execute({ projectId: projectId as ProjectId });
			if (isErr(listed)) return listed;
			return ok({
				plans: listed.value.plans.map(toPlanSummaryDto),
				unreadable: listed.value.unreadable,
			});
		},

		/** Straight through — `ListProjectAssetPrices` already builds the row this view renders. */
		listAssetPrices(projectId) {
			return listAssetPrices.execute(projectId as ProjectId);
		},
	};
}
