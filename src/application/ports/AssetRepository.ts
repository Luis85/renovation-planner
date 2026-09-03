import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Expected, EntityVersion, Loaded } from './versioning';

/**
 * One note `listAll` could not read, with the id already in hand at the point of the skip.
 *
 * `code` is the refusal's own `AppError.code`, not a category: §5.1a's repair strip needs
 * to tell a `MigrationError` (the note was written by a newer build; the remedy is to
 * upgrade the plugin, and `Open note` is the wrong advice) from an ordinary schema failure
 * (a frontmatter edit really is the fix). `path` is what `Open note` needs to act on, and
 * the only thing the read has left once the entity itself is unreadable — there is no name
 * to show instead.
 */
export interface SkippedAsset {
	readonly assetId: AssetId;
	readonly code: string;
	readonly path: string;
}

/**
 * `ObsidianProjectRepository.listAll`'s `ProjectListing` shape, widened from a `refused`
 * COUNT to a descriptor per note. The project list only needs to tell "no projects" from
 * "projects I could not read"; this surface additionally offers a per-note repair action
 * (§5.1a), which a count cannot address and a descriptor can.
 */
export interface AssetListing {
	readonly loaded: readonly Loaded<Asset>[];
	readonly skipped: readonly SkippedAsset[];
}

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
	listAll(): Promise<Result<AssetListing, RepositoryError>>;
}
