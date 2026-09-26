/**
 * The on-canvas dimensions' copy — card W19-A, the asset designer snapping spec's increment 2
 * (AD18-R11).
 *
 * **Eight NOUNS and three frames, rather than sixteen finished sentences.** Each figure has one
 * name, and the button's accessible name and the open field's title compose it — so a ninth
 * measurement adds one key here and not three. The German half then has one noun to translate
 * per figure rather than one phrasing per figure per frame.
 *
 * **The button's visible text carries the unit since AD18-R17** — `designer.dimension.label`,
 * board 01's `800 mm` — where it used to be the integer alone. It is the tail of
 * `designer.dimension.value` in both locales, so the visible label stays inside the accessible
 * name (WCAG 2.5.3's label-in-name). Putting "mm" on that number is safe for `DesignerRulers`'
 * reason: the overlay draws nothing over a design whose `dimensionsUnscaled` is set, so a
 * placeholder pixel never gets a unit.
 *
 * `designer.dimension.unavailable` is the refusal shown inside the open field, and it is
 * deliberately NOT the one a command answers — `trError` already maps those. This one is for the
 * one thing a text field can hold that never reaches the geometry at all: an entry that is not a
 * number. **It does not say "whole" millimetres**, which the first version did: the field parses
 * with `Number` and accepts a decimal, and `partExtent.ts`'s own docblock is this repository's
 * statement that a wrong why is not a why. What it does not accept is refused by the domain and
 * shown through `trError` instead.
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
	'designer.dimension.label': '{value} mm',
	'designer.dimension.edit': 'Edit {name}',
	'designer.dimension.unavailable': 'Type a size in millimetres.',
	'designer.view.all-dimensions': 'All dimensions',
} as const;
