import type { PersistenceError, ValidationError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Expected, EntityVersion, Loaded } from './versioning';

export interface ZoneRepository {
	getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, PersistenceError>>;
	save(
		zone: Zone,
		expected: Expected,
	): Promise<Result<Loaded<Zone>, PersistenceError | ValidationError>>;
	delete(id: ZoneId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
	listByProject(projectId: ProjectId): Promise<Result<Loaded<Zone>[], PersistenceError>>;
	listByPlan(planId: PlanId): Promise<Result<Loaded<Zone>[], PersistenceError>>;
}

// `save` is an ID-keyed UPSERT, not insert-only: slice 8's undo of a delete restores by
// writing the captured snapshot back through save() with its original ID. `'absent'`
// (insert-only) is what makes restoring safe — see versioning.ts.
