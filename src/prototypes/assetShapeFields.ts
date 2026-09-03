/**
 * What the inspector's Shape section says about an asset.
 *
 * Its own module because `AssetInspector.vue` reached this repository's 400-line cap, and the
 * lesson recorded there is that a budget bought back by reformatting is one already spent — so
 * this is the extraction rather than a collapsed literal. The seam is not merely convenient:
 * these four are pure functions of a `CatalogueAsset`, and they are where FOUR consecutive
 * review rounds landed — the withheld unit, the anchor and facing rows, which section owns
 * height, and an absence reported after a refused read. A rule that keeps being corrected is a
 * rule worth reading in one place, with nothing else on the screen.
 */
import { boundsOf, type CatalogueAsset } from './assetLibraryFixture';

/**
 * An extent as a number of millimetres, and it may never print a positive value as `0`.
 *
 * Three decimals is this repository's figure for telling a real value from float noise, and on
 * its own it MOVED the zero-extent lie rather than removing it — `Math.round` reported anything
 * under 0.5 mm as `0`, and `toFixed(3)` reports anything under 0.0005 mm the same way. Smaller
 * threshold, identical falsehood, and the comment claiming the trap was escaped was the thing
 * that made it hard to see. Nothing in the geometry validators bounds an extent from below, so
 * the honest rule is adaptive: round for the ordinary case, and when rounding would erase a
 * positive extent, say what it actually is. Reported by a review bot, one round after the
 * rounding it replaced.
 */
function millimetres(extent: number): string {
	const rounded = Number(extent.toFixed(3));
	if (rounded !== 0 || extent === 0) return String(rounded);
	return extent.toPrecision(2);
}

/** Width × depth in millimetres, from the footprint's own extent — derived, never typed (§88). */
export function shapeDimensions(asset: CatalogueAsset | null): string | null {
	const outline = asset?.outline;
	if (!outline) return null;
	const { width: rawWidth, depth: rawDepth } = boundsOf(outline);
	// NOT `Math.round`, which was here and which turns a measurement into a different one:
	// a traced or calibrated outline has fractional extents, so `1200.4 × 189.6` was reported as
	// `1200 × 190`, and anything under half a millimetre was reported as `0 mm` — an extent that
	// cannot be zero, printed as zero. Three decimals is this repository's own figure for
	// distinguishing a real value from float noise (`594.005` survives; `594.0000001` does not),
	// and `Number(...)` drops the trailing zeros so the ordinary whole-millimetre case still
	// reads `1200 × 190`. The Asset designer shows its derived dimensions unrounded; this row is
	// the same measurement and had been quietly disagreeing with it.
	// **Guarded here as well as in `markPath`, which is where the guard went first.** Finite
	// vertices can span an infinite extent, `boundsOf` hands back `Infinity`, and `millimetres`
	// formats it as the literal string — so the row's mark correctly drew nothing while the
	// inspector beside it printed `Infinity × … mm` as a measurement. The round that fixed the
	// mark did not look one function over, in the same pair of files. `null` withholds the row;
	// the real surface answers with §3.5's extent-overflow refusal, which a fixture that sets
	// `ShapeState` by hand cannot represent.
	if (!Number.isFinite(rawWidth) || !Number.isFinite(rawDepth)) return null;
	const width = millimetres(rawWidth);
	const depth = millimetres(rawDepth);
	// The unit is WITHHELD while this group's capture is pending, exactly as the clearance's is.
	// The reported defect was the clearance's; the footprint had it too, one row up, and fixing
	// only the row in the report is how a partial fix ends up reading like a complete one.
	return `${width} × ${depth}${asset?.shape === 'unscaled' ? '' : ' mm'}`;
}

/**
 * The clearance's extent — and its unit WITHHELD while its own capture is pending.
 *
 * `AssetShape` carries `clearancePending` independently of `footprintPending`, so a typed
 * footprint can sit beside a clearance traced before a scale existed. Printing `mm` on those
 * coordinates would present placeholder-space numbers as measurements, which is the one thing
 * this surface's whole unscaled vocabulary exists to refuse. Reported by a review bot.
 */
export function shapeClearance(asset: CatalogueAsset | null): string {
	if (asset?.clearance === undefined) return 'None';
	const [width, depth] = asset.clearance;
	return `${width} × ${depth}${asset.clearancePending === true ? '' : ' mm'}`;
}

/**
 * Has the shape read ANSWERED? Only then may a derived row state an absence.
 *
 * `Clearance: None` is a claim that this asset has no clearance boundary. For a sidecar that
 * refused (`unreadable`) or has not been read yet (`pending`) that claim is simply false — the
 * read never returned a shape to be absent from, and in production `GetAssetDesign` refuses
 * before returning one at all. So the derived rows are withheld and the note carries the reason,
 * which is §3.5's own Refused state rather than a new one.
 *
 * `none` IS an answer: the read succeeded and there is no outline, so `None` is true there.
 * That is the same distinction the row's mark already draws between a real absence and a failed
 * read — this panel was making it one layer down and getting it the other way round. Reported by
 * a review bot.
 *
 * The **spec sheet stays** in every state, and that is not an oversight: the background
 * reference rides on `CatalogueEntryDto` (§5.1) from the catalogue read, which succeeded — it is
 * the sidecar that refused. It is also the one thing a user can act on when a shape will not
 * parse, since re-tracing starts from the sheet.
 */
export function shapeAnswered(asset: CatalogueAsset | null): boolean {
	const shape = asset?.shape;
	return shape === 'measured' || shape === 'unscaled' || shape === 'none';
}


/**
 * The warnings the Shape section owes, as a LIST rather than one string.
 *
 * `AssetShape` carries a pending flag per coordinate group, so a footprint and a clearance can be
 * in different states at once — a typed rectangle beside an outline traced before a scale
 * existed. One string could only ever report the first of them, which is the collapse that made
 * placeholder coordinates read as millimetres in the first place.
 */
export function shapeNotes(asset: CatalogueAsset | null): readonly string[] {
	const notes: string[] = [];
	if (asset?.shape === 'unscaled') {
		notes.push('The footprint was traced before a scale existed, so it is not measured yet.');
	}
	if (asset?.shape === 'none') notes.push('No outline. This asset has nothing to draw on a plan.');
	if (asset?.shape === 'pending') notes.push('Reading the shape…');
	if (asset?.shape === 'unreadable') {
		notes.push('A shape file is stored for this asset and could not be read.');
	}
	if (asset?.clearancePending === true) {
		notes.push('The clearance was traced before a scale existed, so it is not measured yet.');
	}
	return notes;
}
