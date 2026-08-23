import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ZoneRepository } from '../../../application/ports/ZoneRepository';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * See InMemoryProjectRepository for the contract this implements and why `poke` exists.
 */
export class InMemoryZoneRepository implements ZoneRepository {
	private readonly store = new VersionedStore<Zone>();

	poke(id: ZoneId): void {
		this.store.poke(id);
	}

	getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
	}

	save(
		zone: Zone,
		expected: Expected,
	): Promise<Result<Loaded<Zone>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(zone.id, zone, expected, 'zone'));
	}

	delete(
		id: ZoneId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'zone'));
	}

	listByPlan(planId: PlanId): Promise<Result<Loaded<Zone>[], PersistenceError>> {
		return Promise.resolve(
			ok(this.store.values().filter((z) => z.entity.planId === planId)),
		);
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<Zone>[], PersistenceError>> {
		return Promise.resolve(
			ok(this.store.values().filter((z) => z.entity.projectId === projectId)),
		);
	}
}
