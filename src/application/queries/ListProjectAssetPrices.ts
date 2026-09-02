import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Money } from '../../core/money/Money';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { AssetPriceOverrideId } from '../../domain/asset-price/AssetPriceOverrideId';
import type { AssetRepository } from '../ports/AssetRepository';
import { winnersBy, type AssetPriceOverrideRepository } from '../ports/AssetPriceOverrideRepository';
import type { EntityVersion } from '../ports/versioning';
import type { ProjectIndex } from '../ports/ProjectIndex';
import type { Logger } from '../ports/Logger';
import type { Query } from './Query';

/**
 * The row the project's price section renders: the whole shared catalogue, this project's
 * own price beside each default, and a third state neither `assetName` nor `catalogue` alone
 * can tell apart.
 *
 * `listAll()` drops a note for TWO different reasons: the asset is gone, or the note is
 * still there but its BODY would not parse (`ObsidianAssetRepository.list` records the
 * refusal to the diagnostics ledger and `continue`s past it). Both produce `assetName: null`,
 * so a component branching on that alone cannot tell "this price is real, the note just
 * would not read today" from "there is no note, do not bother" — and Clear, live on the
 * ORPHAN row by Decision 6's own design, would delete a live override on the false diagnosis.
 *
 * The discriminator is INDEX MEMBERSHIP, which `listAll` cannot answer and the Project Index
 * already can: the index resolves a note off its `type` plus a non-empty `id` alone, both
 * of which survive a malformed body. So an unreadable note's id is still returned by
 * `index.getIdsByType('renovation-asset')` while being absent from `listAll`, and a
 * genuinely deleted note's id is absent from both.
 */
export interface AssetPriceRowDto {
	assetId: string;
	assetName: string | null;
	catalogue: Money | null;
	override: Money | null;
	overrideId: AssetPriceOverrideId | null;
	overrideVersion: EntityVersion | null;
	/**
	 * `'known'` — an ordinary row; the asset is in `listAll()`.
	 * `'unreadable'` — the id is in the Project Index (the note declares `type` and a
	 * non-empty `id`, and both survive a malformed BODY) but `listAll()` could not read it —
	 * a hand-edited note with, say, a bad `unit-cost`. The asset is not gone, only its note
	 * would not parse today — but `SetAssetPriceOverrideCommand` loads the asset BEFORE it
	 * reaches the write and propagates a failed read unchanged, so a set dispatched against
	 * this row refuses EVERY time: price input disabled, Clear live — the same controls as
	 * the orphan row below, for a different reason.
	 * `'orphan'` — the id is absent from the Project Index too: the note itself is gone,
	 * out of band. Decision 6's ORPHAN row: price input disabled, Clear live.
	 *
	 * `assetName` and `catalogue` are `null` for BOTH unhappy states — this query has no name
	 * or price to show in either case — so `assetStatus` earns its place on the COPY alone:
	 * which reason, and which remedy, a row names for a state neither field can distinguish
	 * on its own.
	 */
	assetStatus: 'known' | 'unreadable' | 'orphan';
}

/**
 * The row ordering: named rows by name, then id; orphan and unreadable rows LAST, together,
 * and by id among themselves — neither is part of the catalogue the section exists to
 * compare against, and neither has a name to sort by. `assetName === null` is the correct
 * GROUPING test even though it stopped being the STATE discriminator on the DTO itself; a
 * `'known'` row always has a name and neither unhappy state ever does, so the two questions
 * do not conflict. `localeCompare` on a null would throw, so the null test is not a nicety.
 *
 * **The id breaks a NAME tie too, and without it the promise above is false for same-named
 * assets.** Nothing makes an asset's name unique — there is no such refusal anywhere in
 * `domain/asset/` or its commands — and returning 0 falls back to exactly the `listAll`
 * order this sort exists to replace. That order is not stable either: `InMemoryProjectIndex
 * .upsert` unindexes an existing entry and re-indexes it, so updating or syncing either of
 * two same-named assets moves its id to the end of the type `Set` and swaps the pair on the
 * next read.
 *
 * **A module-level function, not an inline `Array.sort` callback, and that is what makes
 * both of its named/unhappy arms provable rather than merely written.** `execute` always
 * builds the pre-sort array with every named row before every unhappy one, and V8's
 * `Array.prototype.sort` — measured, not assumed — only ever calls a comparator with the
 * LATER-positioned element first when inserting it against earlier ones, so `execute`'s own
 * array shape can never drive this function with a named row as `a` and an unhappy row as
 * `b`. The comparator still has to answer that pairing correctly, because nothing about
 * `Array.sort`'s call order is a contract this module controls — a different engine, a
 * different array size, or a future V8 could ask it the other way — so the direct unit test
 * over this exported function is what exercises the pairing `execute`'s own construction
 * order can never produce.
 */
export function compareAssetPriceRows(a: AssetPriceRowDto, b: AssetPriceRowDto): number {
	if (a.assetName === null || b.assetName === null) {
		if (a.assetName !== null) return -1;
		if (b.assetName !== null) return 1;
		return a.assetId.localeCompare(b.assetId);
	}
	const byName = a.assetName.localeCompare(b.assetName);
	return byName !== 0 ? byName : a.assetId.localeCompare(b.assetId);
}

/**
 * The project's price list: the whole shared catalogue, with this project's own price beside
 * each default. ONE query joining `listAll` and `listByProject` rather than a view calling two
 * and joining them in Pinia — a join in a store is a read model nothing can test without
 * mounting something.
 *
 * The whole catalogue rather than only the overrides, because the section's question is "what
 * does this project pay", and a sparse list hides the comparison against the shared default
 * that §89 asks for. The trigger for the other shape is written in the spec: a library that
 * outgrows one readable list.
 */
export class ListProjectAssetPrices implements Query<ProjectId, Result<AssetPriceRowDto[], RepositoryError>> {
	constructor(
		private readonly assets: AssetRepository,
		private readonly overrides: AssetPriceOverrideRepository,
		/**
		 * The THREE-state discriminator's second question. `listAll()` answers only "was this
		 * asset readable"; this port answers "does this plugin still know of a note with this
		 * id at all" — the Project Index resolves a note off `type` plus a non-empty `id`, both
		 * of which survive a malformed body, so an unreadable note stays in it while `listAll`
		 * drops it.
		 * A same-layer import (`application/ports/ProjectIndex.ts`), not a widening.
		 */
		private readonly index: ProjectIndex,
		/** For the duplicate diagnostic below — this query is the only surface some duplicates
		 *  are ever resolved on. */
		private readonly logger: Logger,
	) {}

	async execute(projectId: ProjectId): Promise<Result<AssetPriceRowDto[], RepositoryError>> {
		const assets = await this.assets.listAll();
		if (isErr(assets)) return assets;
		const overrides = await this.overrides.listByProject(projectId);
		if (isErr(overrides)) return overrides;

		// `winnersBy`, never `new Map(list.map(...))`: that keeps whichever entry came last in
		// `listByProject` order, which is a different answer from the one `getForPair` gives.
		//
		// The reporter is what makes the duplicate visible on THIS path. `getForPair` logs its
		// own, but a project with no requirements never reaches `getForPair` for that pair, so
		// opening the section was the one way to meet a duplicate and hear nothing.
		const byAsset = winnersBy(overrides.value, (o) => o.entity.assetId, (assetId, notes) => {
			this.logger.warn('asset-price.duplicate-pair', {
				projectId,
				assetId,
				count: notes.length,
			});
		});
		const rows: AssetPriceRowDto[] = assets.value.map((loaded) => {
			const override = byAsset.get(loaded.entity.id) ?? null;
			return {
				assetId: loaded.entity.id,
				assetName: loaded.entity.name,
				catalogue: loaded.entity.unitCost,
				override: override?.entity.unitCost ?? null,
				overrideId: override?.entity.id ?? null,
				overrideVersion: override?.version ?? null,
				assetStatus: 'known',
			};
		});

		// **Every override `listAll` did not return an asset for — and TWO different reasons,
		// which used to collapse into one row shape.** Task 7a cleans overrides up when
		// `DeleteAssetCommand` runs — and an asset note deleted by hand in the file explorer, or
		// removed by sync, runs no command at all: `VaultChangeAdapter.onDelete` drops the index
		// entry and publishes `ProjectIndexEntryChanged`, and dispatches nothing. So the override
		// survives, `listAll` no longer names its asset, and a catalogue-only join drops it from
		// the one surface that can clear it. Unreachable, and undeletable through any door the
		// plugin offers: that row is a genuine ORPHAN.
		//
		// **But `listAll` also skips a note it could not READ** — malformed frontmatter beyond
		// `type`/`id`, which `ObsidianAssetRepository.list` records to the diagnostics ledger and
		// `continue`s past rather than failing the whole catalogue over it (correct, and untouched
		// here). That note's id is absent from `listAll` exactly as a deleted note's is. The two
		// used to render as the SAME row — `assetName: null` either way — which told the section
		// "this asset is gone" about one that merely would not parse today, and Clear, live on
		// that row by Decision 6's own design for the genuine orphan, deleted a perfectly good
		// override on the false diagnosis.
		//
		// The Project Index does not conflate them: it resolves a note off `type` plus a
		// non-empty `id` alone, both of which survive a malformed BODY, so the unreadable note's id
		// is still in `index.getIdsByType('renovation-asset')` while the deleted note's is in
		// neither set. `readable` is "did `listAll` return it"; `indexed` is "does the Project
		// Index still know a note with this id" — and `assetStatus` is the two questions read
		// together, which is what a caller must branch on now rather than `assetName === null`.
		const readable = new Set(assets.value.map((loaded) => loaded.entity.id));
		const indexed = new Set(this.index.getIdsByType('renovation-asset') as AssetId[]);
		for (const [assetId, override] of byAsset) {
			if (readable.has(assetId)) continue;
			rows.push({
				assetId,
				assetName: null,
				catalogue: null,
				override: override.entity.unitCost,
				overrideId: override.entity.id,
				overrideVersion: override.version,
				assetStatus: indexed.has(assetId) ? 'unreadable' : 'orphan',
			});
		}

		// Sorted so the list does not reshuffle between reads — `listAll` is index order, which
		// is a fact about the vault's write history rather than anything a reader expects. See
		// `compareAssetPriceRows`'s own header for what the ordering promises and why it is a
		// module-level function rather than an inline comparator.
		rows.sort(compareAssetPriceRows);
		return ok(rows);
	}
}
