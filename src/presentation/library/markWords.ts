/**
 * §3.4's mark in WORDS, shared by the list's row and the grid's tile (AD18-R18), so the two
 * surfaces say one thing about one shape. Moved out of `AssetRow.vue` unchanged when the tile
 * became its second reader.
 */
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { Dimensions } from '../../domain/asset/AssetShape';
import { tr } from '../i18n/strings';

function dimensionsText(extent: Dimensions, withUnit: boolean): string {
	// Raw, unrounded, matching `DesignerInspector.vue`'s own established convention for this
	// exact value (`{{ dimensions.width }} × {{ dimensions.depth }} mm`) rather than the
	// prototype's more elaborate float-noise rounding — one house convention for one fact.
	return `${String(extent.width)} × ${String(extent.depth)}${withUnit ? ' mm' : ''}`;
}

/**
 * The size as a row or tile prints it: `1200 × 190 mm` for a measured outline, the same
 * figures without a unit for an unscaled one (so nothing recites a placeholder number as a
 * measurement), and `''` for every state that has no extent.
 */
export function sizeText(outline: AssetOutline | null): string {
	if (outline?.kind === 'measured') return dimensionsText(outline.extent, true);
	if (outline?.kind === 'unscaled') return dimensionsText(outline.extent, false);
	return '';
}

/**
 * The mark's state AND extent in words (§3.4 — "every", with no carve-out for `measured`),
 * referenced by the row through `aria-describedby` rather than nested inside it — a text
 * descendant of the button would join its accessible name ahead of the asset's own, and the
 * row's name would become a sentence. Every one of the five states has its own word now,
 * following the spec's own worked example verbatim ("Measured footprint, 1200 × 190 mm") —
 * an earlier version of this file withheld `measured`'s word on the reasoning that its extent
 * alone was what the other four are stated against, which is a real argument and not this
 * specification's: a browsing screen-reader user hears the figure and would have had to infer
 * "measured" from the ABSENCE of a word, the identical failure carried in pixels §3.4 exists
 * to refuse in words instead. `unscaled` still withholds its UNIT (never its word) exactly as
 * the definition panel's own dimensions warning does, so nothing recites a placeholder number
 * as a measurement.
 */
export function spokenMark(outline: AssetOutline | null): string {
	if (outline === null) return tr('view.asset-library.shape.pending');
	if (outline.kind === 'measured') return `${tr('view.asset-library.shape.measured')}, ${sizeText(outline)}`;
	if (outline.kind === 'unscaled') return `${tr('view.asset-library.shape.unscaled')}, ${sizeText(outline)}`;
	if (outline.kind === 'none') return tr('view.asset-library.shape.none');
	return tr('view.asset-library.shape.unreadable');
}
