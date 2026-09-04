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
 * `listByAsset` is the FAN-OUT read: one query answering every project that holds an override
 * for a shared asset, where the alternative is a `getForPair` per project. Stated as the rule
 * rather than as a count, because the count has already been wrong — this sentence said "exists
 * for ONE caller" while `grep -rn "overrides\.listByAsset" src/` printed three
 * (`onAssetUpdated`'s skip test, `DeleteAsset`'s override cleanup and `ListOverridingProjects`),
 * two of which pre-date the edit that finally re-ran the grep. A rule about the SHAPE of the
 * read survives a fourth caller; a number does not.
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

/**
 * The same rule applied to a GROUPED list, which is what every caller but `getForPair` actually
 * needs — the cascade keys by project, the price list by asset.
 *
 * It exists because `new Map(list.map(...))` is the shape that keeps arriving: it reads as a
 * grouping and is really "whichever entry came last in enumeration order", which is a third
 * answer to the question `winningDuplicate` states. That spelling had already been written into
 * three call sites of this plan and corrected; the FOURTH — `onAssetUpdated`'s own map — survived
 * that correction and was found a round later. A rule with a function has one place to be wrong.
 */
export function winnersBy<K>(
	overrides: readonly Loaded<AssetPriceOverride>[],
	keyOf: (o: Loaded<AssetPriceOverride>) => K,
	/**
	 * **Called once per key that had more than one note, and it is REQUIRED reading rather
	 * than an option.** `getForPair` logs `asset-price.duplicate-pair` when it resolves one,
	 * and every other resolution goes through this function — so without a door here, a
	 * project whose only surface is the price section (no requirements, so no `getForPair`
	 * on that pair) resolves duplicates silently for the life of the vault, and the design's
	 * promised diagnostic is one no user can ever provoke. Optional-with-a-no-op default is
	 * the shape this repository has already paid for twice (`CascadeDeps.notify`,
	 * `ResolutionOps.notify`): the caller that forgets it compiles, passes and says nothing.
	 */
	onDuplicate: (key: K, notes: readonly Loaded<AssetPriceOverride>[]) => void,
): Map<K, Loaded<AssetPriceOverride>> {
	const grouped = new Map<K, Loaded<AssetPriceOverride>[]>();
	for (const override of overrides) {
		const key = keyOf(override);
		const bucket = grouped.get(key);
		if (bucket) bucket.push(override);
		else grouped.set(key, [override]);
	}
	const winners = new Map<K, Loaded<AssetPriceOverride>>();
	for (const [key, bucket] of grouped) {
		if (bucket.length > 1) onDuplicate(key, bucket);
		const best = winningDuplicate(bucket);
		// **UNREACHABLE, and it earns its place by NARROWING A TYPE rather than by
		// discriminating** — which is a different reason from a guard that prevents a crash, and
		// is stated here so a later reader meets a decision instead of the dead branch this
		// repository records DELETING. Every bucket is non-empty by construction: the loop above
		// creates one only by putting an override in it, and `winningDuplicate` moves off `null`
		// on its first candidate. `coverage-final.json` agrees: this `if` counts `[21, 0]`, the
		// false arm never taken. Named by its counts rather than by the `if@<line>` address the
		// report prints, because this comment moved the line the moment it was written.
		//
		// Without it, `best` is `Loaded<AssetPriceOverride> | null` at a `Map.set` whose value
		// type admits no `null`, and the build fails. The alternative is a non-null assertion,
		// which asserts the same fact with nothing to read it off. The currency increment's
		// `isStaleReading` has the identical shape and the same note, under this repository's own
		// rule that uniformity is a reason and it is not the same reason as necessity.
		if (best !== null) winners.set(key, best);
	}
	return winners;
}
