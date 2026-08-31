import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Expected, EntityVersion, Loaded } from './versioning';

/**
 * Conditional on the same terms as every other entity port (design slice 3): `save` is an
 * ID-keyed upsert whose compare-and-swap runs INSIDE the write, and `delete` takes its own
 * expected version — a field edit loaded before a concurrent delete must refuse rather
 * than RESURRECT the asset after the delete removed or reassigned its requirements.
 * `'absent'` means insert-and-fail-if-taken; see versioning.ts.
 */
export interface AssetRepository {
	getById(id: AssetId): Promise<Result<Loaded<Asset> | null, RepositoryError>>;
	save(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, RepositoryError>>;
	delete(id: AssetId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	/**
	 * The whole vault's catalogue. An Asset belongs to no project since design slice 19, so
	 * there is no per-project list to ask for — the picker's narrowing (unit kind, the
	 * entity being deleted) lives with the caller that owns each rule.
	 */
	listAll(): Promise<Result<Loaded<Asset>[], RepositoryError>>;
}
