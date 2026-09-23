/**
 * The drafting marks each on-canvas dimension draws — AD18-R17's row for board 01: *"dimension
 * lines with arrows and extension lines"*. Pure, in stage pixels, and beside `dimensionFigures.ts`
 * for that module's founding reason: a rule that lives in an SFC is a rule no node test can put a
 * case on. `DesignerDimensions.vue` hands it a figure's span and the point its label was PLACED at,
 * and writes the two strings into an `aria-hidden` SVG.
 *
 * **The line runs through the PLACED label, not the anchor.** AD18-R14's rule moves a label down or
 * up a whole box when another would cover it; a width's line moves with it and its extension lines
 * grow to meet it, which is how a drafted dimension chain stacks — and why a moved label still reads
 * as measuring the two edges it measures rather than whatever it has been pushed over. A depth is
 * moved ALONG its own line, so there the line is simply run on to the label.
 *
 * **No colour and no stroke here.** The paths carry geometry only; `styles/designer-dimensions.css`
 * strokes and fills them from a host variable (SDD §84).
 */
import type { ScreenPoint } from '../../editor/viewport/Viewport';

/** An arrowhead's length along the line, and its full width across it. */
const ARROW_PX = 6;
const ARROW_HALF_PX = 3;
/**
 * How far an extension line runs past the dimension line. It starts AT the edge when the line stands
 * off it, since a drafted extension line never runs back into the object; a line left on its edge
 * gets a tick this far to each side instead.
 */
const EXTENSION_PX = 4;

/** SVG path data: the stroked line and extension lines, and the two filled arrowheads. */
export interface DimensionLine {
	readonly line: string;
	readonly arrows: string;
}

/**
 * The marks for one dimension along `axis`, measuring `from` to `to`, whose label is drawn at `at`.
 *
 * Worked in (ALONG, ACROSS) coordinates and mapped back once, so the two axes are one rule rather
 * than two near-copies. `from` and `to` are ordered here rather than trusted, because a signed gap
 * a part overhangs runs backwards and its marks are the same marks.
 *
 * **A span shorter than two arrowheads takes them OUTSIDE, pointing in**, as a drafted narrow gap
 * does: inside, two 6 px heads on a 4 px gap would cross and read as one blot — and a zero gap,
 * which this surface does draw, would have no direction at all.
 */
export function dimensionLine(axis: 'x' | 'y', from: ScreenPoint, to: ScreenPoint, at: ScreenPoint): DimensionLine {
	const along = (point: ScreenPoint): number => (axis === 'x' ? point.x : point.y);
	const across = (point: ScreenPoint): number => (axis === 'x' ? point.y : point.x);
	const pt = (a: number, c: number): string => (axis === 'x' ? `${String(a)} ${String(c)}` : `${String(c)} ${String(a)}`);

	const lo = Math.min(along(from), along(to));
	const hi = Math.max(along(from), along(to));
	const row = across(at);
	const edge = across(from);
	const inside = hi - lo >= 2 * ARROW_PX;
	const back = inside ? ARROW_PX : -ARROW_PX;
	const start = Math.min(inside ? lo : lo - 2 * ARROW_PX, along(at));
	const end = Math.max(inside ? hi : hi + 2 * ARROW_PX, along(at));
	const near = row <= edge ? row - EXTENSION_PX : edge;
	const far = row >= edge ? row + EXTENSION_PX : edge;

	const extension = (a: number): string => `M${pt(a, near)}L${pt(a, far)}`;
	const head = (tip: number, base: number): string => `M${pt(tip, row)}L${pt(base, row - ARROW_HALF_PX)}L${pt(base, row + ARROW_HALF_PX)}Z`;
	return {
		line: `M${pt(start, row)}L${pt(end, row)}${extension(lo)}${extension(hi)}`,
		arrows: `${head(lo, lo + back)}${head(hi, hi - back)}`,
	};
}
