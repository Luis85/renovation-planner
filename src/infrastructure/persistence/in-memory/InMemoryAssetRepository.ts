import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetRepository } from '../../../application/ports/AssetRepository';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * See InMemoryProjectRepository for the contract this implements and why `poke` exists.
 */
export class InMemoryAssetRepository implements AssetRepository {
	private readonly store = new VersionedStore<Asset>();

	poke(id: AssetId): void {
		this.store.poke(id);
	}

	getById(id: AssetId): Promise<Result<Loaded<Asset> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
	}

	save(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(asset.id, asset, expected, 'asset'));
	}

	delete(
		id: AssetId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'asset'));
	}

	listAll(): Promise<Result<Loaded<Asset>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values()));
	}
}
