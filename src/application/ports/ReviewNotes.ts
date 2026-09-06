import type { Result } from '../../core/result/Result';
import type { RepositoryError } from './repositoryErrors';
import type { PlanId } from '../../domain/plan/PlanId';
export interface ReviewNotes {
	generate(planId: PlanId, body: string): Promise<Result<string, RepositoryError>>;
}
