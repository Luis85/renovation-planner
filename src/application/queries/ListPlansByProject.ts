import { isErr, ok, type Result } from '../../core/result/Result';
import type { Plan } from '../../domain/plan/Plan';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanRepository } from '../ports/PlanRepository';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Query } from './Query';

export interface ListPlansByProjectInput {
	readonly projectId: ProjectId;
}

/**
 * The plans of one project, and how many of its plan notes could not be read.
 *
 * `unreadable` is the query-side name for the port's `refused` — the rename
 * `ProjectListResult` already makes across this same boundary.
 */
export interface PlanListResult {
	readonly plans: readonly Plan[];
	readonly unreadable: number;
}

/**
 * One project's plans — the project detail state's read (design slice 21).
 *
 * A thin wrapper over `listByProject`, which slice 3 declared on the port and slice 4
 * implemented ahead of any consumer, precisely so adding one is a query file rather than a
 * port change. Named `List*` per SDD §80, the shape `ListProjects` and `ListAssets` follow.
 *
 * It hands back DOMAIN ENTITIES, not a DTO: `application/` may not name `presentation/`, so
 * the mapping to `PlanSummaryDto` happens in the read-model bundle the view is handed, beside
 * every other `to*Dto`.
 *
 * **It HAS an `unreadable` half now, and this paragraph used to say the opposite.** It read
 * "no `unreadable` half, and that is inherited rather than decided", because
 * `PlanRepository.listByProject` answered a bare array whose loop failed the whole list for
 * one bad note — so the project detail state drew its failure screen rather than the plans it
 * could read. The port answers `{ loaded, refused }` now, the same shape `ProjectRepository.
 * listAll` always had, and this query renames it across the boundary exactly as
 * `ProjectListResult` does.
 *
 * Still no reconciliation, counting or validation of its own: the count is the port's, and
 * WHICH refusals were folded into it is the repository's decision (`SKIPPABLE_PLAN_CODES`),
 * not this query's. The other half of the old paragraph survives unchanged — an id whose note
 * is gone is silently DROPPED rather than counted, because `getById` answers `ok(null)` for a
 * missing note and that is not a refusal. It cannot be produced by a repository double
 * honestly, so it stays pinned at `ObsidianPlanRepository.listByProject` itself, in
 * `tests/infrastructure/obsidian/repositories/contract.test.ts`.
 */
export class ListPlansByProject
	implements Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>
{
	constructor(private readonly plans: PlanRepository) {}

	async execute({
		projectId,
	}: ListPlansByProjectInput): Promise<Result<PlanListResult, RepositoryError>> {
		const listed = await this.plans.listByProject(projectId);
		if (isErr(listed)) return listed;
		return ok({
			plans: listed.value.loaded.map((loaded) => loaded.entity),
			unreadable: listed.value.refused,
		});
	}
}
