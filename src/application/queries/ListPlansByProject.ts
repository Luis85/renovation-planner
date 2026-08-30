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
 * **It has no `unreadable` half, and that is inherited rather than decided.** `ListProjects`
 * can report a partial listing because `ProjectRepository.listAll` answers `{ loaded,
 * refused }`; `PlanRepository.listByProject` answers a bare array whose loop fails the whole
 * list for one bad note and silently drops an id whose note is gone. Both are pinned in
 * `listPlansByProject.test.ts` so that softening either is deliberate. Widening this needs
 * the PORT's contract to change, which `ListAssets` and `ListReassignmentTargets` also read
 * through.
 */
export class ListPlansByProject
	implements Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>
{
	constructor(private readonly plans: PlanRepository) {}

	async execute({ projectId }: ListPlansByProjectInput): Promise<Result<Plan[], RepositoryError>> {
		const listed = await this.plans.listByProject(projectId);
		if (isErr(listed)) return listed;
		return ok(listed.value.map((loaded) => loaded.entity));
	}
}
