import type { Result } from '../../core/result/Result';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Expected, EntityVersion, Loaded } from './versioning';
import type { RepositoryError } from './repositoryErrors';

/**
 * What a zone listing answers: the zones that LOADED, and how many notes refused to.
 *
 * The same shape as `ProjectListing`, for the same reason and deliberately not a second one —
 * SDD §92 item 13 asks that a refusal be scoped to THIS note, and a listing that answers the
 * first failure it meets scopes it to the whole plan instead. On this surface that cost
 * everything: one unparseable zone note and the Plan Editor drew NO zones at all.
 *
 * A COUNT and deliberately not a list of ids: the diagnostics ledger already records which
 * note refused, and a second copy here would be a second answer to one question.
 *
 * **`refused` does not decide anything by itself.** Skip-and-count is a READING policy and not
 * a property of this listing: the canvas carries the count into a warning strip, while
 * `ListReassignmentTargets` refuses outright, because an incomplete picker offered before a
 * delete is a destructive silence rather than a recoverable one. Each consumer decides; this
 * type only makes both answerable.
 */
export interface ZoneListing {
	readonly loaded: readonly Loaded<Zone>[];
	readonly refused: number;
}

export interface ZoneRepository {
	getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, RepositoryError>>;
	save(
		zone: Zone,
		expected: Expected,
	): Promise<Result<Loaded<Zone>, RepositoryError>>;
	delete(id: ZoneId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	listByProject(projectId: ProjectId): Promise<Result<ZoneListing, RepositoryError>>;
	listByPlan(planId: PlanId): Promise<Result<ZoneListing, RepositoryError>>;
}

// `save` is an ID-keyed UPSERT, not insert-only: slice 8's undo of a delete restores by
// writing the captured snapshot back through save() with its original ID. `'absent'`
// (insert-only) is what makes restoring safe — see versioning.ts.
