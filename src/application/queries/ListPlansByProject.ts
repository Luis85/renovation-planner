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
 * list for one bad note and silently drops an id whose note is gone. This class does neither
 * reconciliation, counting nor validation of its own — it passes the port's array straight
 * through, which is what `listPlansByProject.test.ts` pins. The FAIL-whole-list half is also
 * pinned there, at this class, because a repository double can produce it (a failed read is a
 * `Result` value, nothing more). The DROP half cannot be produced by a double honestly — it
 * needs a real index/note loop with a missing note behind an indexed id — so it is pinned at
 * `ObsidianPlanRepository.listByProject` itself, in
 * `tests/infrastructure/obsidian/repositories/contract.test.ts`. Widening either needs the
 * PORT's contract to change, which `ListAssets` and `ListReassignmentTargets` also read
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
