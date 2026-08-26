import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../../application/ports/RequirementRepository';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * See InMemoryProjectRepository for the contract this implements and why `poke` exists.
 *
 * `markStale` reads and writes in one synchronous block — no `await` between them — so the
 * read-modify-write is atomic here, matching the Obsidian implementation's per-entity
 * queue. A requirement that does not exist cannot be marked: that is a persistence
 * failure, not a silent success.
 */
export class InMemoryRequirementRepository implements RequirementRepository {
	private readonly store = new VersionedStore<Requirement>();

	poke(id: RequirementId): void {
		this.store.poke(id);
	}

	/** Test seam: fail the next markStale for this id, the cascade-abort fixture. */
	failMarkStaleOnce(): void {
		this.failNextMarkStale = true;
	}
	private failNextMarkStale = false;

	getById(id: RequirementId): Promise<Result<Loaded<Requirement> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
	}

	save(
		requirement: Requirement,
		expected: Expected,
	): Promise<Result<Loaded<Requirement>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(requirement.id, requirement, expected, 'requirement'));
	}

	delete(
		id: RequirementId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'requirement'));
	}

	listByZone(zoneId: ZoneId): Promise<Result<Loaded<Requirement>[], PersistenceError>> {
		return Promise.resolve(
			ok(
				this.store
					.values()
					.filter((r) => r.entity.origin.kind === 'zone' && r.entity.origin.zoneId === zoneId),
			),
		);
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<Requirement>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values().filter((r) => r.entity.assetId === assetId)));
	}

	markStale(id: RequirementId): Promise<Result<void, PersistenceError>> {
		if (this.failNextMarkStale) {
			this.failNextMarkStale = false;
			return Promise.resolve(
				err({
					category: 'Persistence',
					code: 'requirement.mark-stale-failed',
					message: `markStale was configured to fail for ${id}.`,
				}),
			);
		}
		const current = this.store.get(id);
		if (!current) {
			return Promise.resolve(
				err({
					category: 'Persistence',
					code: 'requirement.not-found',
					message: `Requirement ${id} could not be marked stale because it does not exist.`,
				}),
			);
		}
		const marked = current.entity.markedStale();
		if (isErr(marked)) {
			return Promise.resolve(
				err({
					category: 'Persistence',
					code: 'requirement.mark-stale-invalid',
					message: marked.error.message,
				}),
			);
		}
		const written = this.store.save(id, marked.value, current.version, 'requirement');
		if (!written.ok) {
			return Promise.resolve(
				err({
					category: 'Persistence',
					code: 'requirement.mark-stale-failed',
					message: written.error.message,
				}),
			);
		}
		return Promise.resolve(ok(undefined));
	}
}
