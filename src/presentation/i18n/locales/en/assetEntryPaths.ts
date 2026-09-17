/**
 * The asset designer's CREATION vocabulary (AD07): the empty state's three entry paths, the
 * preset gallery's search and previews, and what the measurement-first dialog says.
 *
 * Its own module rather than more of `assetSymbols.ts` so that AD07, AD08's marquee and AD10's
 * arrange actions can be authored at the same time without three workers appending to one table
 * — the integration hazard AD01 §2 names. Spread into `en/editor.ts` beside `assetSymbolsEn`.
 *
 * **Three strings AD07 needed and did not add**, because the gesture they name already had a
 * label and a second one would be a second vocabulary for one control: the empty state's
 * alternative entry paths reuse `designer.inspector.start-preset`,
 * `empty.asset.no-shape.action` and `empty.asset.no-background.action` — the exact words the
 * inspector's own button and the other empty state's primary action already use for the same
 * three gestures.
 */
export const assetEntryPathsEn = {
	/** The gallery's filter. A `<input type="search">`, so the label says what it searches. */
	'designer.preset.search': 'Search presets',
	'designer.preset.no-matches': 'No preset matches that search.',
	/**
	 * AD07's implementation item 4, and the honest half of it: nothing in this repository stores
	 * a preset's parameters, so what Apply writes is ordinary geometry a user then edits by
	 * hand. Saying so at the form is what keeps "change the width to 1800" from being looked for
	 * afterwards in a parameter field that does not exist.
	 */
	'designer.preset.editable': 'A preset draws ordinary editable geometry. These values are not kept, so later changes are made on the shape itself.',
} as const;
