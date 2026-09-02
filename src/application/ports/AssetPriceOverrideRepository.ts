import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { AssetPriceOverride } from '../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Expected, EntityVersion, Loaded } from './versioning';

/**
 * Conditional on the same terms as every other entity port (design slice 3).
 *
 * `getForPair` is the lookup everything else asks through — uniqueness is on the pair and the
 * id is a ULID, so an id-keyed read answers a question no caller has. It returns ONE override
 * for a pair that has two notes, and the implementation logs a diagnostic when it finds a
 * duplicate: last-writer-wins, deliberately not a refusal, because the notes are user-editable.
 *
 * `listByAsset` exists for ONE caller — `onAssetUpdated`'s skip test, which fans out across
 * every project referencing a shared asset and needs the overrides for all of them in one read
 * rather than one read per requirement. It is what makes that correction cost one query.
 *
 * **There is deliberately no `getById`, and every sibling entity port has one.** `AssetRepository`
 * and `ProjectRepository` both declare it because commands there hold an id and want the entity;
 * nothing in this increment does. The clear command and Task 7a's cleanup both delete from
 * entities they already loaded, so the sentence above — an id-keyed read answers a question no
 * caller has — would otherwise sit three lines above a method contradicting it. Uniformity is a
 * reason and it is not the same reason as necessity: the alternative was to keep it and amend
 * the spec's Decision 3 from five methods to six, and the argument for dropping it is that a
 * port method with no caller is a claim nothing rests on, while adding one back is one line the
 * day a caller exists. The note-backed repository still needs a by-id read for its own hydration
 * and keeps one as a PRIVATE method.
 */
export interface AssetPriceOverrideRepository {
	getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>>;
	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>>;
	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>>;
	save(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, RepositoryError>>;
	delete(id: AssetPriceOverrideId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
}

/**
 * **Which duplicate wins, stated once because three places have to agree.** Both repositories
 * answer `getForPair`, and `ListProjectAssetPrices` folds a list into a map; a rule left to each
 * of them is three rules, and they had already drifted in this plan's first draft — the fake
 * answered the FIRST match (insertion order), the note-backed repository the LAST
 * (`getIdsByType` order), and the query's `Map` the last again. Tests would have resolved and
 * updated a different override than production.
 *
 * The winner is the HIGHEST id, and that is a real rule rather than a coin toss between two
 * enumeration orders. `createEntityId` mints `<prefix>-<ULID>` from a MONOTONIC factory —
 * Crockford-base32, timestamp-prefixed, lexicographically sortable, which its own docblock
 * calls "the property the project index (§47) and vault change detection ordering (§46) build
 * on". So the highest id IS the most recently created note: last-writer-wins meant literally,
 * and identical in both implementations however each happens to enumerate.
 *
 * **`winnersBy` is NOT written here — it belongs to Task 6, where its first caller is.** The
 * grouped-resolution helper the cascade and the price list both need has no `src/` caller at
 * this task's boundary: the in-memory repository resolves through `winningDuplicate` alone, and
 * the first imports are Task 6's `onAssetUpdated` map and Task 8's `ListProjectAssetPrices`.
 * `fallow` reports an export nothing imports, so defining it here would make this task's
 * `npm run check` red and break the plan's "each task ends green on its own". The precedent for
 * deferring is `foldersOverlap`, which design slice 18 discussed, declared in prose and shipped
 * no module for — "it had no job in this slice" — with slice 19 writing it beside its first
 * callers.
 */
export function winningDuplicate(
	matches: readonly Loaded<AssetPriceOverride>[],
): Loaded<AssetPriceOverride> | null {
	return matches.reduce<Loaded<AssetPriceOverride> | null>(
		(best, candidate) => (best === null || candidate.entity.id > best.entity.id ? candidate : best),
		null,
	);
}
