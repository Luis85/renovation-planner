import type { Result } from '../../core/result/Result';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Query } from './Query';
import type { ZoneListing, ZoneRepository } from '../ports/ZoneRepository';
import type { RepositoryError } from '../ports/repositoryErrors';

export interface FindZonesByPlanInput {
	readonly planId: PlanId;
}

/**
 * The one list query the canvas needs (SDD §80's Find-vs-Get convention): the Plan
 * Editor hydrates a whole plan's zones in ONE call. Wraps `ZoneRepository.listByPlan`
 * and adds nothing — declared here because this is where the repository method it wraps
 * got its first real implementation. It answers the whole `ZoneListing` for the same
 * reason: the count of notes that refused belongs to the surface drawing the zones, and a
 * query that dropped it would decide, silently, that one unreadable note is not worth
 * mentioning.
 */
export class FindZonesByPlan
	implements Query<FindZonesByPlanInput, Result<ZoneListing, RepositoryError>>
{
	constructor(private readonly zones: ZoneRepository) {}

	execute({ planId }: FindZonesByPlanInput) {
		return this.zones.listByPlan(planId);
	}
}
