import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { ProjectId } from '../../domain/project/ProjectId';
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
	listByProject(projectId: ProjectId): Promise<Result<Loaded<Asset>[], RepositoryError>>;
}
