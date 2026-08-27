import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { Query } from '../../application/queries/Query';
import type { ProjectListResult } from '../../application/queries/ListProjects';
import { toProjectSummaryDto, type ProjectSummaryDto } from './PlanDto';

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
 * The ONLY application-layer surface the Renovation Project view depends on. A sibling of
 * `planEditorQueries.ts` rather than a member of it: that file is named for the Plan Editor
 * and already carries six methods answering to it, and a `listProjects` bolted on would be
 * named for the wrong view. Two small files named for their views beat one growing file
 * named for one of them.
 */
export interface RenovationProjectQueryServices {
	listProjects(): Promise<Result<ProjectListView, RepositoryError>>;
}

/**
 * The read side for a session whose settings could not be recovered.
 *
 * With no `projectFolder` there is no repository, no index and no project list — the
 * composition root deliberately builds none, because a default folder is a different
 * LOCATION rather than a milder version of the user's. So the view is handed a query
 * service that refuses.
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
function refuseUnrecovered() {
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
export function createRenovationProjectQueries(
	listProjects: Query<void, Result<ProjectListResult, RepositoryError>>,
): RenovationProjectQueryServices {
	return {
		async listProjects() {
			const found = await listProjects.execute();
			if (isErr(found)) return found;
			return ok({
				projects: found.value.projects.map(toProjectSummaryDto),
				unreadable: found.value.unreadable,
			});
		},
	};
}
