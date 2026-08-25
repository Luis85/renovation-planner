import type { Result } from '../../core/result/Result';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Zone } from '../../domain/zone/Zone';
import type { Loaded } from '../ports/versioning';
import type { Query } from './Query';
import type { ZoneRepository } from '../ports/ZoneRepository';
import type { RepositoryError } from '../ports/repositoryErrors';

export interface FindZonesByPlanInput {
	readonly planId: PlanId;
}

/**
 * The one list query the canvas needs (SDD §80's Find-vs-Get convention): the Plan
 * Editor hydrates a whole plan's zones in ONE call. Wraps `ZoneRepository.listByPlan`
 * and adds nothing — declared here because this is where the repository method it wraps
 * got its first real implementation.
 */
export class FindZonesByPlan
	implements Query<FindZonesByPlanInput, Result<Loaded<Zone>[], RepositoryError>>
{
	constructor(private readonly zones: ZoneRepository) {}

	execute({ planId }: FindZonesByPlanInput) {
		return this.zones.listByPlan(planId);
	}
}
