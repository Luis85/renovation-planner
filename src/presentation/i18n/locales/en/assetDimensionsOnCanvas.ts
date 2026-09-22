/**
 * The on-canvas dimensions' copy — card W19-A, the asset designer snapping spec's increment 2
 * (AD18-R11).
 *
 * **Eight NOUNS and two frames, rather than sixteen finished sentences.** Each figure has one
 * name, and the button's accessible name and the open field's title compose it — so a ninth
 * measurement adds one key here and not three, and the unit is stated in exactly one place.
 * The German half then has one noun to translate per figure rather than one phrasing per
 * figure per frame.
 *
 * The button's visible text is the integer alone, the way a ruler's tick and
 * `designer.status.zoom` render theirs; the unit reaches a screen reader through
 * `designer.dimension.value` and is on the canvas beside the strip rather than in every label.
 * Putting "mm" on that number is safe for `DesignerRulers`' reason: the overlay draws nothing
 * over a design whose `dimensionsUnscaled` is set, so a placeholder pixel never gets a unit.
 *
 * `designer.dimension.unavailable` is the refusal shown inside the open field, and it is
 * deliberately NOT the one a command answers — `trError` already maps those. This one is for the
 * value a text field can hold and the geometry cannot use: an empty box, a word, or a number
 * outside what the edit accepts.
 */
export const assetDimensionsOnCanvasEn = {
	'designer.dimension.overall-width': 'Overall width',
	'designer.dimension.overall-depth': 'Overall depth',
	'designer.dimension.width': 'Width',
	'designer.dimension.depth': 'Depth',
	'designer.dimension.offset-left': 'Offset from the left edge',
	'designer.dimension.offset-right': 'Offset from the right edge',
	'designer.dimension.offset-top': 'Offset from the top edge',
	'designer.dimension.offset-bottom': 'Offset from the bottom edge',
	'designer.dimension.value': '{name} {value} mm',
	'designer.dimension.edit': 'Edit {name}',
	'designer.dimension.unavailable': 'Type a size in whole millimetres.',
	'designer.view.all-dimensions': 'All dimensions',
} as const;
