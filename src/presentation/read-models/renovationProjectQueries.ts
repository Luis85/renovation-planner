import type { PersistenceError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { ListProjects } from '../../application/queries/ListProjects';
import { toProjectSummaryDto, type ProjectSummaryDto } from './PlanDto';

/**
 * The ONLY application-layer surface the Renovation Project view depends on. A sibling of
 * `planEditorQueries.ts` rather than a member of it: that file is named for the Plan Editor
 * and already carries six methods answering to it, and a `listProjects` bolted on would be
 * named for the wrong view. Two small files named for their views beat one growing file
 * named for one of them.
 */
export interface RenovationProjectQueryServices {
	listProjects(): Promise<Result<readonly ProjectSummaryDto[], PersistenceError>>;
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
		err<PersistenceError>({
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
 * `ListProjects`, mapped at the boundary into the read model above.
 *
 * `application/` may not name `presentation/`, so `ListProjects` hands back domain
 * entities and the mapping to `ProjectSummaryDto` happens here — the same division
 * `createPlanEditorQueries` draws for `getPlan` and `findZonesByPlan`.
 */
export function createRenovationProjectQueries(listProjects: ListProjects): RenovationProjectQueryServices {
	return {
		async listProjects() {
			const found = await listProjects.execute();
			if (isErr(found)) return found;
			return ok(found.value.map(toProjectSummaryDto));
		},
	};
}
