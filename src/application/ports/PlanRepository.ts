import type { Result } from '../../core/result/Result';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Plan } from '../../domain/plan/Plan';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Expected, EntityVersion, Loaded } from './versioning';
import type { RepositoryError } from './repositoryErrors';

/**
 * `listByProject` extends SDD §36's Zone example by analogy: "linked plans" is resolved
 * by this query rather than a mirrored `planIds` field on Project.
 */
export interface PlanRepository {
	getById(id: PlanId): Promise<Result<Loaded<Plan> | null, RepositoryError>>;
	save(
		plan: Plan,
		expected: Expected,
	): Promise<Result<Loaded<Plan>, RepositoryError>>;
	delete(id: PlanId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	listByProject(projectId: ProjectId): Promise<Result<Loaded<Plan>[], RepositoryError>>;
}
