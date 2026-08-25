import type { Result } from '../../core/result/Result';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Plan } from '../../domain/plan/Plan';
import type { Query } from './Query';
import type { PlanRepository } from '../ports/PlanRepository';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Loaded } from '../ports/versioning';

export interface GetPlanInput {
	readonly planId: PlanId;
}

/** See GetProject: "not found" is `ok(null)`, never an error. */
export class GetPlan
	implements Query<GetPlanInput, Result<Loaded<Plan> | null, RepositoryError>>
{
	constructor(private readonly plans: PlanRepository) {}

	execute({ planId }: GetPlanInput) {
		return this.plans.getById(planId);
	}
}
