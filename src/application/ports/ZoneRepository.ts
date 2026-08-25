import type { Result } from '../../core/result/Result';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Expected, EntityVersion, Loaded } from './versioning';
import type { RepositoryError } from './repositoryErrors';

export interface ZoneRepository {
	getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, RepositoryError>>;
	save(
		zone: Zone,
		expected: Expected,
	): Promise<Result<Loaded<Zone>, RepositoryError>>;
	delete(id: ZoneId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	listByProject(projectId: ProjectId): Promise<Result<Loaded<Zone>[], RepositoryError>>;
	listByPlan(planId: PlanId): Promise<Result<Loaded<Zone>[], RepositoryError>>;
}

// `save` is an ID-keyed UPSERT, not insert-only: slice 8's undo of a delete restores by
// writing the captured snapshot back through save() with its original ID. `'absent'`
// (insert-only) is what makes restoring safe — see versioning.ts.
