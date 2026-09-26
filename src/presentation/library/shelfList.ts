/**
 * §3.2's shelf list, DERIVED and never enumerated: every category the build declares, in
 * `ASSET_CATEGORY_LABELS`'s order, then every category the listing names that the build does
 * not declare, by `localeCompare`, kept as written.
 *
 * Moved out of `AssetShelves.vue` unchanged when AD18-R18's category sidebar became its second
 * reader. One derivation means the sidebar and the shelves can never disagree about which
 * categories exist.
 */
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import { ASSET_CATEGORY_LABELS } from '../views/assetLabels';
import { currentLanguage, tr } from '../i18n/strings';

export interface Shelf {
	readonly category: string;
	readonly label: string;
	readonly entries: readonly CatalogueEntryDto[];
}

const DECLARED: readonly AssetCategory[] = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];
const DECLARED_SET: ReadonlySet<string> = new Set(DECLARED);

/** A declared category's own label, or an undeclared one exactly as the vault wrote it. */
export function categoryLabel(category: string): string {
	return DECLARED_SET.has(category) ? tr(ASSET_CATEGORY_LABELS[category as AssetCategory]) : category;
}

export function shelvesOf(entries: readonly CatalogueEntryDto[]): readonly Shelf[] {
	const byCategory = new Map<string, CatalogueEntryDto[]>();
	for (const entry of entries) {
		const bucket = byCategory.get(entry.category);
		if (bucket === undefined) byCategory.set(entry.category, [entry]);
		else bucket.push(entry);
	}
	const collator = new Intl.Collator(currentLanguage());
	const undeclared = [...byCategory.keys()]
		.filter((category) => !DECLARED_SET.has(category))
		.toSorted((one, other) => collator.compare(one, other));
	return [...DECLARED, ...undeclared].map((category) => ({
		category,
		label: categoryLabel(category),
		entries: byCategory.get(category) ?? [],
	}));
}
