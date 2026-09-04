import type { CatalogueAsset } from './assetLibraryFixture';

/**
 * What a catalogue row and the inspector print for a unit cost.
 *
 * The symbol where one is unambiguous, the ISO code where it is not. An asset carries its own
 * currency and a project carries its own (PRD §72), so a vault-wide catalogue is legitimately
 * mixed — the row hard-coded `€` and reported the wrong currency for anything else, which is a
 * lie about a number rather than a cosmetic slip. `CHF` has no symbol in common use and `$` is
 * ambiguous across several currencies, so both print their code; a promoted component resolves
 * this through the locale rather than through a table this size.
 *
 * It lives here rather than in either component because it was written out twice, byte for
 * byte, in `AssetShelf.vue` and `AssetInspector.vue` — two copies of one rule, which is what
 * this repository's own account of `npm run analyze`'s clone detector cites as the reason to
 * extract. The row and the inspector must not be able to disagree about what a price says.
 */
const SYMBOLS: Readonly<Record<string, string>> = { EUR: '€', GBP: '£' };

export function priceOf(asset: CatalogueAsset): string {
	const symbol = SYMBOLS[asset.currency];
	return symbol === undefined ? `${asset.unitCost} ${asset.currency}` : `${symbol}${asset.unitCost}`;
}
