import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Asset, AssetBackgroundRef } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Currency } from '../../core/money/Money';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { AssetRepository } from '../ports/AssetRepository';
import type { ProjectIndex } from '../ports/ProjectIndex';

/**
 * The Asset Library's own read model (design "Asset library overview" §5.1) — a DTO rather
 * than the domain entity `ListAssets` hands the assign picker, because that query drops the
 * unreadable notes and decomposes nothing: a picker's read and a browsing surface's read are
 * allowed to diverge, and forcing one query to serve both badly is the alternative refused
 * there.
 *
 * `category` is a `string`, never `AssetCategory`: the vocabulary is extensible and an
 * unrecognised category is kept as written, so a DTO typed to today's closed union could not
 * carry the value the epic asks to be preserved. `unitCostAmount` plus `currency` is `Money`
 * decomposed exactly as it crosses every other boundary — a float is what ADR-010 refuses.
 */
export interface CatalogueEntryDto {
	assetId: AssetId;
	name: string;
	category: string;
	unit: MeasurementUnit;
	unitCostAmount: string;
	currency: Currency;
	wasteFactorDefault: string;
	supplier: string | null;
	sku: string | null;
	height: number | null;
	notes: string | null;
	background: AssetBackgroundRef | null;
}

/**
 * Why a row could not be read, from the reader's side of the same three sources §5.1a names
 * on the port and the index: a note whose body would not parse, a note with no usable id, and
 * a duplicate-id loser. `code` is `null` for the last two, because both are decided by the
 * index scan, which raises no `AppError` — the note is excluded, not refused — so a row whose
 * `code` is null takes its guidance from `reason` alone.
 */
export type UnreadableReason = 'read-failed' | 'no-id' | 'duplicate-id';

/**
 * `assetId` is `null` for the two scan-decided reasons: a `no-id` note has none to carry, and
 * a duplicate-id loser is unreachable by id BY CONSTRUCTION — the index already resolved that
 * id to the winner, so filing the loser under it would let an id-keyed lookup find two
 * descriptors. At most one entry in this list carries any given id, which is the property a
 * selection resolves against.
 */
export interface UnreadableEntry {
	assetId: AssetId | null;
	path: string;
	reason: UnreadableReason;
	code: string | null;
}

export interface CatalogueListing {
	entries: readonly CatalogueEntryDto[];
	unreadable: readonly UnreadableEntry[];
}

function toCatalogueEntryDto(entity: Asset): CatalogueEntryDto {
	return {
		assetId: entity.id,
		name: entity.name,
		category: entity.category,
		unit: entity.unit,
		unitCostAmount: entity.unitCost.amount,
		currency: entity.unitCost.currency,
		wasteFactorDefault: entity.wasteFactorDefault.toString(),
		supplier: entity.supplier,
		sku: entity.sku,
		height: entity.height,
		notes: entity.notes,
		background: entity.background,
	};
}

/**
 * The Asset Library's first read: the whole catalogue, plus every note it could not draw a
 * row for. Two ports rather than one, because the two facts live in two different places —
 * `AssetRepository.listAll()` for a note whose body would not parse, and
 * `ProjectIndex.listExclusions()` for a note the index itself could never hold (§5.1a).
 *
 * The filter is `entityType === 'renovation-asset'`, the persisted discriminator
 * `ENTITY_TYPES` declares — never the shorter `'asset'`, which is not a member of that union
 * and matches nothing. The Project Index is ONE GLOBAL id namespace across every entity kind,
 * so without this filter a project note excluded for having no id would inflate this
 * library's unreadable count and appear in its repair strip.
 */
export class ListCatalogueEntries {
	constructor(
		private readonly assets: AssetRepository,
		private readonly index: ProjectIndex,
	) {}

	async execute(): Promise<Result<CatalogueListing, RepositoryError>> {
		const listed = await this.assets.listAll();
		if (isErr(listed)) return listed;

		const entries = listed.value.loaded.map((loaded) => toCatalogueEntryDto(loaded.entity));

		const readFailed: UnreadableEntry[] = listed.value.skipped.map((skipped) => ({
			assetId: skipped.assetId,
			path: skipped.path,
			reason: 'read-failed',
			code: skipped.code,
		}));

		const excluded: UnreadableEntry[] = this.index
			.listExclusions()
			.filter((exclusion) => exclusion.entityType === 'renovation-asset')
			.map((exclusion) => ({
				assetId: null,
				path: exclusion.path,
				reason: exclusion.reason,
				code: null,
			}));

		return ok({ entries, unreadable: [...readFailed, ...excluded] });
	}
}
