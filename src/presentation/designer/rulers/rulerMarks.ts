/**
 * How many steps apart a designer ruler puts a NUMBER. `designerGrid` chooses a step at least
 * `MIN_STEP_PX` (12) wide on screen, so a number on every step would be twelve pixels of label
 * against twelve pixels of room; every fifth is sixty pixels at the worst camera the step
 * function allows.
 */
const LABELLED_EVERY = 5;

/**
 * The labelled marks of a designer ruler over a visible span (asset designer snapping spec
 * 2026-09-15, §0 increment 3): the multiples of `step × LABELLED_EVERY` inside it, ends included.
 *
 * `from` and `to` are world millimetres measured from the GRID's own origin — the committed
 * footprint's box minimum — rather than from the asset's world origin, which is what makes a
 * returned value the label's text as well as its place: the ruler reads 0 at the corner the grid
 * counts from, so an offset from the footprint's edge is a whole number of steps on both.
 *
 * Only the labelled marks are answered here. The minor ticks are a repeating gradient on the
 * strip itself (`styles/designer-rulers.css`), the way `CanvasGrid` tiles the grid: at twelve
 * screen pixels a tick, one DOM node per tick would be some seventy per axis rebuilt on every
 * frame of a pan, for lines a background tiles for free.
 */
export function rulerLabels(step: number, from: number, to: number): number[] {
	const spacing = step * LABELLED_EVERY;
	const labels: number[] = [];
	// Counted as a MULTIPLE each time rather than accumulated by `value += spacing`, so a long
	// span at a 5000 mm step answers exact integers rather than a drifting sum — the labels are
	// what a user reads off, and `25000.000000001` is not a millimetre reading.
	for (let index = Math.ceil(from / spacing); index * spacing <= to; index += 1) labels.push(index * spacing);
	return labels;
}
