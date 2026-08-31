import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanListing, PlanRepository } from '../../../application/ports/PlanRepository';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * See InMemoryProjectRepository for the contract this implements and why `poke` exists.
 */
export class InMemoryPlanRepository implements PlanRepository {
	private readonly store = new VersionedStore<Plan>();

	poke(id: PlanId): void {
		this.store.poke(id);
	}

	getById(id: PlanId): Promise<Result<Loaded<Plan> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
	}

	save(
		plan: Plan,
		expected: Expected,
	): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(plan.id, plan, expected, 'plan'));
	}

	delete(
		id: PlanId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'plan'));
	}

	/**
	 * `refused` is 0 by construction — this store holds entities, not text, so there is no
	 * parse step to refuse at. The non-zero arm belongs to the Obsidian implementation.
	 */
	listByProject(projectId: ProjectId): Promise<Result<PlanListing, PersistenceError>> {
		return Promise.resolve(
			ok({ loaded: this.store.values().filter((p) => p.entity.projectId === projectId), refused: 0 }),
		);
	}
}
