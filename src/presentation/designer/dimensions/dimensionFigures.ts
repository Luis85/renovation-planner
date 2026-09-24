/**
 * What the designer's on-canvas dimensions MEASURE — the asset designer snapping spec
 * (2026-09-15) §0's increment 2, authorised in full by AD18-R11: *"overall width × depth along
 * the footprint, the selected part's size and its offsets to the footprint edges"*.
 *
 * Pure, and beside its component the way `rulers/rulerMarks.ts` sits beside `DesignerRulers.vue`:
 * every figure is a world point, a millimetre value and the edit that writes a typed one back, so
 * the component owns only `worldToScreen` and the markup. Nothing here reads a store, a camera or
 * a DOM node.
 *
 * **Five exported FUNCTIONS, and the last four work in PIXELS rather than millimetres.** Counted
 * from `grep -n "^export"` over this file after AD18-R21's change, which prints seven lines: the
 * types `DimensionFigure` and `LabelAnchor` and the five functions — `restingFigures` thins the
 * resting set while the drawing is small on screen (AD18-R21), and `outsideAnchor`, last, stands
 * the overall pair outside the footprint where the canvas has room. `dimensionFigures` answers what
 * is measured and where in the world it belongs; `spreadLabels` answers where a label is actually
 * drawn under `All dimensions` once the camera has crowded several of them onto one row —
 * AD18-R14, whose whole subject is a box that has a size only on a stage — and `separateLabels` the
 * same for the resting state, whose floor is stricter (AD18-R17). They are here rather than in the
 * component for this module's founding reason: each is a rule about positions, reads nothing but
 * its arguments, and a rule that lives in an SFC is a rule no node test can put a case on.
 *
 * **Which measurements, and which are NOT here.** The spec's decision table fixes the set for the
 * whole iteration — overall size, part size, offsets from edges, and explicitly *"not per-edge
 * lengths"* — so this module answers those three families and no fourth.
 *
 * **The FOOTPRINT is measured by the overall pair and never gets offsets**, which falls out of
 * what an offset IS rather than being a case: an offset is measured to the footprint's own edges,
 * so the footprint's four are zero by construction and a control for one would be a field whose
 * only legal value is the one it already shows. The anchor and the facing get nothing for the
 * neighbouring reason — `selectionFrame` answers them as degenerate points, and a point has no
 * size to state and no edge to stand off from. The Inspector owns both of those numbers.
 */
import type { Point } from '../../../core/geometry/Point';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, type Result } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { AssetDetail } from '../../../domain/asset/AssetDetail';
import { moveOutline, partNotFound, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { VERTEX_GRAB_RADIUS_PX } from '../../editor/handleMetrics';
import { screenPoint, type ScreenPoint, type StageSize } from '../../editor/viewport/Viewport';
import type { StringKey } from '../../i18n/locales/en';
import type { DesignerSelection } from '../selection/designerSelection';
import { partMeasure, resizeToExtent, type PartBox } from '../selection/partExtent';

const FOOTPRINT: OutlinePart = { kind: 'footprint' };
const CLEARANCE: OutlinePart = { kind: 'clearance' };

/** One measured value on the canvas: where it is drawn, what it reads, and what typing into it writes. */
export interface DimensionFigure {
	/** Stable within one render, so the open field and the button it replaced are the same figure. */
	readonly name: string;
	/** The figure's own noun, which the button's accessible name and the field's label both compose. */
	readonly label: StringKey;
	/** World millimetres, at the middle of whatever the figure spans. */
	readonly at: Point;
	/**
	 * What the figure's dimension LINE spans (AD18-R17, board 01): the axis it runs along, and a
	 * point on each of the two edges it measures, on the row or column `at` sits on. `to` minus
	 * `from` along the axis is the signed `value`, so a gap a part overhangs runs BACKWARDS.
	 */
	readonly axis: 'x' | 'y';
	readonly from: Point;
	readonly to: Point;
	/** An OVERALL figure, drawn outside the footprint's edge when the canvas has room — `outsideAnchor`. */
	readonly outside: boolean;
	/** The CANONICAL millimetres; the surface rounds them for display and `unchanged` knows it does. */
	readonly value: number;
	/**
	 * What typing `typed` writes — or **`null` for "nothing to do"**, which `editShape` resolves as
	 * `no-write` and therefore dispatches nothing and pushes no undo entry. See `unchanged`.
	 */
	readonly edit: (typed: number) => (shape: AssetShape) => Result<AssetShape, ValidationError> | null;
}

/**
 * **Typing the current value is no command at all** — contract C03 in as many words, and C05's
 * *"a cancelled/refused/no-op gesture is none"*. Nothing below this answers it: `editShape`'s only
 * no-op door fires on a `null` EDIT, `SetAssetShapeCommand`'s `ALWAYS_CHANGED` compares nothing
 * deliberately, and `CommandHistory` pushes for any ok result and clears redo. So the figure has
 * to answer it, and this is where.
 *
 * **BOTH spellings of "the current value" are refused, and the second is the one C03 names
 * separately.** The button and the field show `Math.round(value)`, so on a footprint measuring
 * 999.6 the field opens reading `1000`; a user who changes nothing and presses Apply has typed the
 * value they were SHOWN. Comparing only against the canonical 999.6 would write 1000 and quantize
 * the six tenths away — *"do not quantize canonical values merely because the inspector displays
 * rounded measurements"*, reached by a user who edited nothing.
 *
 * `AssetDesignerRoot.editDimensions` already took this decision for the whole-design form and
 * states the trade this inherits: *"a footprint measuring 1200.4 is offered as 1200, and a user
 * typing 1200 there means 'leave it as it is' rather than 'trim four tenths of a millimetre'."*
 * The cost is real and is the same one — 1000 cannot be typed onto a 999.6 part through this
 * field, because that gesture is indistinguishable from leaving it alone.
 */
function unchanged(typed: number, current: number): boolean {
	return typed === current || typed === Math.round(current);
}

/** A `PartBox` read back as the corners the figures are placed against. */
interface Corners {
	readonly min: Point;
	readonly max: Point;
	readonly centre: Point;
}

/**
 * The FOOTPRINT's box, with no null arm — a cast for `DesignerSelectionInspector.boxOf`'s reason
 * and on a stronger guarantee than that one has. `AssetShape.footprint` is a `CurvedPolygon` and
 * not `CurvedPolygon | null`, so `outlineOf` answers it for every shape that exists and
 * `partMeasure` cannot answer `null` for this part. A guard here would be a branch nothing could
 * ever drive, and an unreachable guard costs a branch it can never pay back.
 */
function footprintCorners(shape: AssetShape): Corners {
	return corners(partMeasure(shape, FOOTPRINT) as PartBox);
}

const asPart = (detail: AssetDetail): OutlinePart => ({ kind: 'detail', id: detail.id });

function corners(box: PartBox): Corners {
	return {
		min: { x: box.centre.x - box.width / 2, y: box.centre.y - box.depth / 2 },
		max: { x: box.centre.x + box.width / 2, y: box.centre.y + box.depth / 2 },
		centre: box.centre,
	};
}

/**
 * `resizeToExtent`, unless the typed extent is the one the part already has — see `unchanged`.
 * The part is re-measured off the shape the edit is HANDED, never off the render that drew it.
 *
 * A part the shape has lost falls through to `resizeToExtent`, which answers `part-not-found`
 * itself: the refusal belongs to the function that owns what a part is, and a second guard here
 * would be a second answer to the same question.
 */
function resized(shape: AssetShape, part: OutlinePart, axis: 'width' | 'depth', typed: number): Result<AssetShape, ValidationError> | null {
	const box = partMeasure(shape, part);
	return box !== null && unchanged(typed, box[axis]) ? null : resizeToExtent(shape, part, axis, typed);
}

/**
 * The size pair for one part, placed against its own box: the width above its top edge and the
 * depth against its left one, which is where `RoomDimensionLabels` anchors the plan editor's
 * equivalent pair.
 */
function sizeFigures(part: OutlinePart, box: Corners, key: string, labels: readonly [StringKey, StringKey]): DimensionFigure[] {
	return [
		{
			name: `${key}-width`,
			label: labels[0],
			at: { x: box.centre.x, y: box.min.y },
			outside: part.kind === 'footprint',
			axis: 'x',
			from: box.min,
			to: { x: box.max.x, y: box.min.y },
			value: box.max.x - box.min.x,
			edit: (typed) => (shape) => resized(shape, part, 'width', typed),
		},
		{
			name: `${key}-depth`,
			label: labels[1],
			at: { x: box.min.x, y: box.centre.y },
			outside: part.kind === 'footprint',
			axis: 'y',
			from: box.min,
			to: { x: box.min.x, y: box.max.y },
			value: box.max.y - box.min.y,
			edit: (typed) => (shape) => resized(shape, part, 'depth', typed),
		},
	];
}

/**
 * One of the four gaps, as a rule rather than as four near-copies: which axis it runs along, and
 * which way round its two edges sit.
 *
 * `sign` is what turns a typed gap into a displacement. A `left` or `top` gap grows as the part
 * moves away from the origin; a `right` or `bottom` gap grows as it moves towards it.
 */
interface OffsetSpec {
	readonly key: string;
	readonly label: StringKey;
	readonly axis: 'x' | 'y';
	readonly sign: 1 | -1;
}

/** In the order a reader scans them, which is also the order the Inspector lists an axis pair. */
const OFFSETS: readonly OffsetSpec[] = [
	{ key: 'offset-left', label: 'designer.dimension.offset-left', axis: 'x', sign: 1 },
	{ key: 'offset-right', label: 'designer.dimension.offset-right', axis: 'x', sign: -1 },
	{ key: 'offset-top', label: 'designer.dimension.offset-top', axis: 'y', sign: 1 },
	{ key: 'offset-bottom', label: 'designer.dimension.offset-bottom', axis: 'y', sign: -1 },
];

/**
 * The gap a spec names, SIGNED. Negative is a part that reaches outside the footprint on that
 * edge, which is a real design — a handle, an overhang, a clearance-adjacent trim — and is worth
 * more to the user than an unsigned distance that reads the same as its opposite. It round-trips:
 * typing a negative moves the part back out by exactly as much.
 */
function gapOf(box: Corners, outer: Corners, spec: OffsetSpec): number {
	return spec.sign === 1 ? box.min[spec.axis] - outer.min[spec.axis] : outer.max[spec.axis] - box.max[spec.axis];
}

/**
 * The four gaps between one part's box and the footprint's, each drawn at the middle of the gap it
 * measures.
 *
 * **Typing one MOVES the part and never resizes it**, which is the only reading that keeps the
 * other three offsets meaningful: widening the left gap by pushing the left edge right would
 * shrink the part and silently change its own Width field at the same time. So the edit is a
 * translation, and the opposite offset takes the complementary change — which is a fact the user
 * can see on the canvas rather than one this module has to announce.
 *
 * The edit re-measures BOTH boxes off the shape it is handed rather than closing over the ones
 * this render saw, which is `DesignerSelectionInspector`'s standing rule: `editShape` hands each
 * edit the shape the previous write left, so a gap captured at render would quietly undo a commit
 * still in flight.
 */
function offsetFigures(part: OutlinePart, key: string, box: Corners, outer: Corners): DimensionFigure[] {
	return OFFSETS.map((spec) => {
		const near = spec.sign === 1 ? outer.min[spec.axis] : box.max[spec.axis];
		const drawn = gapOf(box, outer, spec);
		const across = spec.axis === 'x' ? box.centre.y : box.centre.x;
		const point = (along: number): Point => (spec.axis === 'x' ? { x: along, y: across } : { x: across, y: along });
		return {
			name: `${key}-${spec.key}`,
			label: spec.label,
			at: point(near + drawn / 2),
			outside: false,
			axis: spec.axis,
			from: point(near),
			to: point(near + drawn),
			value: drawn,
			edit: (typed: number) => (shape: AssetShape) => {
				const current = partMeasure(shape, part);
				if (current === null) return err(partNotFound(part));
				const gap = gapOf(corners(current), footprintCorners(shape), spec);
				if (unchanged(typed, gap)) return null;
				return moveOutline(shape, part, spec.axis === 'x' ? { dx: spec.sign * (typed - gap), dy: 0 } : { dx: 0, dy: spec.sign * (typed - gap) });
			},
		};
	});
}

const PART_LABELS: readonly [StringKey, StringKey] = ['designer.dimension.width', 'designer.dimension.depth'];

/**
 * Which parts besides the footprint are measured.
 *
 * **`all` widens the SET of parts and changes nothing about what each one gets**, which is the
 * whole reason the toggle is one line here rather than a second family of figures: an "All
 * dimensions" view that drew a different, thinner set for an unselected part would be a second
 * answer to what a part's dimensions are. Off, it is the selection — the spec's *"selection-driven,
 * with a view toggle to show all"*. On, it is every drawable detail plus the clearance.
 *
 * **A HIDDEN part is not measured either, and that is a second per-part fact rather than the same
 * one.** `DesignerCanvas` drops a hidden graphic from what it draws, through this same
 * `partView.hidden` set, so measuring one would put six editable millimetre labels over nothing —
 * and under `All dimensions` a user who hid a part to get it out of the way would get its numbers
 * back. `locked` is deliberately NOT asked beside it: `DesignerSelectionInspector` already lets a
 * locked part be resized by typing, and a lock that stopped one field and not the other would be
 * two answers to what a lock means.
 *
 * **The CLEARANCE has its own hide, `Show clearance` (AD18-R17), and `clearanceShown` is it** — the
 * leaf's `showClearance` ref, which drops the canvas's clearance layer as `hidden` drops a detail's
 * graphic. Same reason, same answer in both modes: a selected clearance draws nothing while it is
 * off. It defaults to shown so a caller with no leaf runtime measures what it always did.
 *
 * **A PENDING part is not measured, in either mode.** §0's *"no numbers on an unscaled part"* is
 * read at the part and not only at the design: a detail or clearance captured over an uncalibrated
 * background carries placeholder pixels that calibration later multiplies, so a millimetre drawn
 * beside it would be a unit on a number that is not a measurement, and a millimetre TYPED into it
 * would be rescaled too. That is the same rule `DesignerSelectionInspector`'s `pendingPart` applies
 * to the same part's length fields. The design-wide half — an unscaled FOOTPRINT, which withholds
 * every figure including the overall pair — is `dimensionsUnscaled` and belongs to the component,
 * because it is a fact about the DTO rather than about the shape.
 *
 * Filtering the selection through the same list is what makes the two modes agree: a selected
 * pending or hidden detail draws nothing, exactly as it would under `all`. It also means every part named
 * here is one the shape has, which is what lets the caller measure without a null arm.
 *
 * A selection that is the footprint, the anchor or the facing contributes nothing: the footprint
 * is already the overall pair, and the other two are points. See this module's header.
 */
function measuredParts(shape: AssetShape, selection: DesignerSelection | null, all: boolean, hidden: ReadonlySet<string>, clearanceShown: boolean): OutlinePart[] {
	const clearance = shape.clearance === null || shape.clearancePending || !clearanceShown ? [] : [CLEARANCE];
	const drawable = shape.details.filter((detail) => !detail.pending && !hidden.has(detail.id));
	if (all) return [...drawable.map((detail) => asPart(detail)), ...clearance];
	if (selection === null) return [];
	const id = selection.kind === 'detail' ? selection.id : null;
	if (id !== null) return drawable.filter((detail) => detail.id === id).map((detail) => asPart(detail));
	return selection.kind === 'clearance' ? clearance : [];
}

/**
 * Every figure the overlay draws over `shape` (the PREVIEW while a gesture is live — the caller
 * decides, exactly as `selectionFrame`'s does, and AD18-R11 binds this overlay to reading the
 * preview).
 *
 * Only the overall pair for a shape with nothing measurable selected, and that is never empty:
 * every `AssetShape` has a footprint, which is what `footprintCorners` rests on.
 */
export function dimensionFigures(
	shape: AssetShape,
	selection: DesignerSelection | null,
	all: boolean,
	hidden: ReadonlySet<string>,
	clearanceShown = true,
): DimensionFigure[] {
	const outer = footprintCorners(shape);
	const overall = sizeFigures(FOOTPRINT, outer, 'overall', ['designer.dimension.overall-width', 'designer.dimension.overall-depth']);
	return measuredParts(shape, selection, all, hidden, clearanceShown).flatMap((part) => {
		// `measuredParts` names only parts the shape HAS — it derives them from `shape.details` and
		// from `shape.clearance` rather than from the selection — so this cast rests on the same
		// kind of guarantee `footprintCorners` does, and a guard here would be undrivable.
		const box = corners(partMeasure(shape, part) as PartBox);
		const key = part.kind === 'detail' ? `detail-${part.id}` : part.kind;
		return [...sizeFigures(part, box, key, PART_LABELS), ...offsetFigures(part, key, box, outer)];
	}).concat(overall);
}

/**
 * One label's drawn height, in stage pixels — AD18-R14's measured box (*"one 33.4 x 30 px box"*),
 * and the step the sweep below takes. Stepping by a FULL height is what makes two stacked labels
 * share no pixels vertically at all, whatever their widths.
 *
 * It is a MODEL of something only a browser draws. Every guarantee here is stated over ANCHORS and
 * never over rendered boxes, which is what keeps the sentence honest in a suite where jsdom
 * computes no layout.
 */
const LABEL_HEIGHT_PX = 30;

/**
 * How near, vertically, two anchors have to be before the later label COVERS the earlier one.
 *
 * Every label is the same height — one line of `--font-ui-smaller` in a box with a fixed
 * `min-height` and fixed padding — so a pair on genuinely different rows always leaves a strip of
 * the lower one exposed, whatever their widths. A pair within a few pixels of one row does not.
 *
 * **Read this as PRESSABLE and not as READABLE, which is narrower than it looks.** The strip it
 * guarantees is at the bottom of a 30 px box whose digits are centred in it, so between roughly 8
 * and 20 px of separation the lower label is clickable while its number may still be hidden behind
 * the one above. Raising the threshold buys legibility by moving more labels; whether that trade is
 * worth taking is a rendered judgement and is on the card's browser list.
 */
const SAME_ROW_PX = 8;

/**
 * How near, HORIZONTALLY, before that row is the same row in the sense that matters.
 *
 * **This is a containment bound and not a box width, and the first version of this file got that
 * wrong.** A label is lost when a LATER one covers it whole, which needs their centres within
 * `(wider − narrower) / 2`. Widths here run from about 20 px for a one-glyph `0` — a zero gap draws
 * one — to about 46 px for a five-glyph signed reading like `-1050`, since `gapOf` is signed and
 * the repository's own fixture already produces a negative. So the worst containment offset is
 * about 13 px and anything above it catches every case; the label's own ~40 px WIDTH is a different
 * quantity and using it only moved labels that were never at risk.
 *
 * Measured rather than derived alone, over `editableShape()` under `All dimensions` at ten cameras
 * from `MIN_ZOOM` to 0.5 — 140 placements, counting labels left more than 90% covered by a later
 * one against labels moved:
 *
 * | reach | left covered | moved |
 * | --- | --- | --- |
 * | none (today's defect) | 36 | 0 |
 * | exact coincidence only | 17 | 20 |
 * | 12 px | 8 | 58 |
 * | **15 px** | **8** | **60** |
 * | 40 px (the first version) | 9 | 79 |
 *
 * 15 is the smallest measured value that clears the 13 px bound with a margin. 12 is a placement or
 * two cheaper and sits UNDER it, which is buying two placements with the property the rule exists
 * for.
 */
const SAME_COLUMN_PX = 15;


/**
 * The label's box, modelled from the number it draws: fixed chrome plus one tabular digit each.
 *
 * **This model is no longer only a model — a browser re-capture measured three of its predictions
 * to within 0.2 px** (20.5 against 20.4 for a one-glyph reading, 26.9 against 26.8 for two, 33.4
 * against 33.2 for three), which is also how AD18-R14's original 33.4 px box is recovered. It is
 * still a model of ONE font at ONE size: `--font-ui-smaller` is a theme variable and a user can
 * change it, so a vault at a larger UI font draws wider boxes than this arithmetic believes, and
 * every guarantee below is stated over anchors and this model rather than over rendered pixels.
 *
 * The VALUE is what the width depends on, which is why `spreadLabels` takes one per label: the
 * component draws `Math.round(figure.value)`, so the glyph count is read from the same number the
 * button shows rather than from a second opinion about it.
 *
 * **`UNIT_PX` is the ` mm` every label carries since AD18-R17, and it is NOT one of the measured
 * three.** It is estimated from the UI font's own metrics — a space and two `m`s at
 * `--font-ui-smaller`, about 23 px — and rounded UP, because an over-wide model separates labels a
 * little further than they need while an under-wide one lets two touch. A constant rather than a
 * per-locale figure because both locales print the SI symbol.
 */
const LABEL_CHROME_PX = 14;
const GLYPH_PX = 6.4;
const UNIT_PX = 24;

/** One label's drawn width, from the digits the button shows and its unit — see `LABEL_CHROME_PX`. */
function labelWidth(value: number): number {
	return LABEL_CHROME_PX + GLYPH_PX * String(Math.round(value)).length + UNIT_PX;
}

/**
 * How much of a label's own WIDTH may be left uncovered before a later label stops counting as
 * covering it at all.
 *
 * A strip four pixels wide down the side of a label is not a hit target, so a coverer that spans
 * all but that much is treated as spanning the whole thing. Smaller and the rule is fooled by a
 * sliver nobody can press; larger and it starts calling a genuine half-overlap a full one.
 */
const SPAN_SLACK_PX = 4;

/**
 * How much of a label's HEIGHT must stay clear of every later label put together — the property
 * AD18-R14 actually asks for, and the one the pairwise rules above cannot state.
 *
 * Ten pixels is a third of the box, across its full width. Measured rather than chosen: at twelve
 * the browser-measured `All dimensions` frame keeps its overlap count but a SELECTED part starts
 * moving four of its eight labels instead of two, which is the floor AD18-R14 sets on the resting
 * state. Ten is the largest value that holds that floor. **That measurement predates AD18-R17**,
 * which gave the resting state to `separateLabels`; the value was kept, not re-derived, and today it
 * governs `All dimensions` alone.
 */
const MIN_BAND_PX = 10;

/**
 * How far one label may be pushed off its own anchor, in steps.
 *
 * Uncapped, the sweep below still terminates — each step is a whole label height and the placed set
 * is finite — but a label 700 px from the edge it measures is a worse lie than two labels sharing a
 * row, and at this surface's zoom-out it would be pushed clean off a canvas that is
 * `overflow: hidden`. Four steps is 120 px: enough for the clusters this surface actually produces
 * and short enough that a moved label is still read against its own part.
 *
 * **What happens AT the cap changed in round 3, and it is the one thing about the cap that did.**
 * The rule used to take the last slot it had stepped to, which for two labels that both ran out of
 * steps meant landing on the SAME POINT — AD18-R14's own defect, surviving at the bottom of the fix
 * for it. It now takes the best of the five candidate slots instead, scored by the widest band it
 * leaves the worst-affected label. That is free — the same five positions, one of which it was
 * already going to pick — and on the browser-measured frame it is the difference between two dead
 * labels and none.
 *
 * **It is not a guarantee, and the residual is now precisely statable.** Six labels on ONE point
 * still have five distinct slots between them, so the sixth must repeat one, and
 * `dimensionCollision.test.ts` asserts that rather than leaving it to be discovered. Which slot it
 * repeats is what changed: the scored fallback picks the emptiest, not the last. Six labels on one
 * point needs a camera far outside the one AD18-R14 measured — `MIN_ZOOM` is 0.01, ten wheel-steps
 * further out — and the arm that actually closes it is a chooser over a jammed group, which needs a
 * locale string this card may not add.
 */
const MAX_STEPS = 4;

/**
 * The air the RESTING state keeps between two labels side by side (AD18-R17), in stage pixels.
 *
 * AD18-R14's floor is ZERO overlapping pairs in the resting state, and it held at a 1280 leaf by
 * the accident of the camera: at a 460 leaf the same eight labels of a selected part overlapped in
 * five pairs, every one of them PRESSABLE and therefore invisible to `spreadLabels`' two rules,
 * which are about being covered rather than about touching. So the resting state asks the plain question —
 * do the boxes share any area — and this is the margin it asks it with. Side by side only, because
 * that is the axis the width MODEL answers: four pixels absorb two either side of `labelWidth`'s
 * estimate of the unit. Vertically the box is Obsidian's fixed `--input-height`, so a label one
 * whole height away touches its neighbour and shares no area with it.
 */
const APART_GAP_PX = 4;

/** A label as the rule sees it: where its centre is, and how wide the number makes it. */
interface LabelBox {
	readonly at: ScreenPoint;
	readonly width: number;
}

/** What `spreadLabels` is given per label — the stage point it wants, and the number it draws. */
export interface LabelAnchor {
	readonly at: ScreenPoint;
	readonly value: number;
	/**
	 * The axis of an OVERALL figure, which `separateLabels` places first and moves only along its own
	 * line or further out (`overallSlot`) — whether `outsideAnchor` stood it outside the footprint or
	 * left it on the edge for want of room. Absent for every other figure. `spreadLabels` ignores it.
	 */
	readonly overall?: 'x' | 'y';
}

/** Whether `later` would sit on `earlier`'s row, near enough along it to cover the reading. */
function sharesRow(later: ScreenPoint, earlier: ScreenPoint): boolean {
	return Math.abs(later.x - earlier.x) < SAME_COLUMN_PX && Math.abs(later.y - earlier.y) < SAME_ROW_PX;
}

/** Whether two boxes share any area, keeping `APART_GAP_PX` of air between them side by side. */
function overlaps(one: LabelBox, other: LabelBox): boolean {
	return Math.abs(one.at.x - other.at.x) < (one.width + other.width) / 2 + APART_GAP_PX
		&& Math.abs(one.at.y - other.at.y) < LABEL_HEIGHT_PX;
}

/** Whether `later` covers `earlier` across its whole width, give or take `SPAN_SLACK_PX`. */
function spansColumn(later: LabelBox, earlier: LabelBox): boolean {
	return later.at.x - later.width / 2 <= earlier.at.x - earlier.width / 2 + SPAN_SLACK_PX
		&& later.at.x + later.width / 2 >= earlier.at.x + earlier.width / 2 - SPAN_SLACK_PX;
}

/**
 * The tallest unbroken strip of `victim` that `cuts` leaves clear.
 *
 * `cuts` are the y-ranges of the labels drawn OVER it, each already known to span its width, so
 * this is a one-dimensional question: clip each range to the victim, merge them in order, and take
 * the largest gap — including the one after the last range, which is the case a naive sweep drops.
 * Every label is the same height, which is what makes a strip of this band clickable across the
 * victim's whole width rather than in some corner of it.
 */
function freeBand(victim: LabelBox, cuts: readonly (readonly [number, number])[]): number {
	const top = victim.at.y - LABEL_HEIGHT_PX / 2;
	const bottom = victim.at.y + LABEL_HEIGHT_PX / 2;
	const inside = cuts
		.map(([from, to]) => [Math.max(from, top), Math.min(to, bottom)] as const)
		.filter(([from, to]) => to > from)
		.toSorted((one, other) => one[0] - other[0]);
	let widest = 0;
	let edge = top;
	for (const [from, to] of inside) {
		if (from > edge) widest = Math.max(widest, from - edge);
		edge = Math.max(edge, to);
	}
	return Math.max(widest, bottom - edge);
}

const rangeOf = (box: LabelBox): readonly [number, number] =>
	[box.at.y - LABEL_HEIGHT_PX / 2, box.at.y + LABEL_HEIGHT_PX / 2];

/**
 * Where each label is actually drawn, given where each one WANTS to be — AD18-R14's collision
 * avoidance for the `All dimensions` state, in stage pixels because that is the space a label box
 * has a size in.
 *
 * **TWO rules, and the second is the one round 3 added.** A candidate slot is refused when it would
 * either sit on an already-placed label's ROW (`sharesRow`, the pairwise rule) or leave one with no
 * clear strip at all once every label drawn over it is counted TOGETHER (`freeBand`). The second is
 * not a widening of the first: the browser re-capture found two labels with no reachable point
 * anywhere in their box whose three coverers were each 8.1, 10.5 and 19.1 px away — every one of
 * them correctly outside `SAME_ROW_PX`, and together blanketing the victim's whole 30 px height.
 * A rule that asks about pairs cannot see a union, and the property AD18-R14 states — *"no drawn
 * label may be impossible to click"* — is about the union.
 *
 * Earlier wins, and the order is `dimensionFigures`' own — a part's own figures first and the
 * overall pair appended last — so the label with the more specific subject keeps its true anchor
 * and the outer measurement stacks off it, which is how a drafting dimension chain reads. Paint and
 * hit order among the buttons is DOM order — every label wrapper shares one `z-index`, and only an
 * open FORM is lifted above it — so a label placed later is a label drawn ON TOP.
 *
 * **It steps DOWN from an anchor in the stage's top half and UP from one in the bottom half**, the
 * same rule `DesignerDimensions.placement` uses for an open field and for the same measured reason:
 * `.rp-plan-canvas` is `overflow: hidden` and `DesignerCanvas` fits an opened asset with only
 * `FIT_PADDING_PX`'s 48 px of margin, so the overall pair sits 48 px from the top edge and an
 * unconditional outward step would clip it. A clipped label is a total loss; a label pushed inward
 * over the drawing is not. **That holds while the stage is at least 240 px tall** — worst travel is
 * `MAX_STEPS` x `LABEL_HEIGHT_PX` each way and the rule is symmetric about the middle — and it
 * INVERTS on one input: `EditorStore` initialises `stageSize` to `{ 0, 0 }`, so until the resize
 * observer first reports, `stage.height / 2` is 0, every anchor reads as the bottom half and every
 * step goes up. Transient, and it resolves itself on the first report.
 *
 * **What was measured, over the VANITY preset — the shape the browser capture used — at the camera
 * `DesignerCanvas` fits on mount plus six more from a quarter of it to three times it.** 26 labels,
 * seven cameras, with "unreachable" sampled on a grid across each box exactly as the capture's
 * `elementFromPoint` sweep does, and counted only for labels lying fully inside the canvas, because
 * a label pushed off-screen is clipped rather than covered and scoring it as covered is the
 * instrument lying:
 *
 * | rule | unreachable, fit camera | unreachable, all seven | labels moved | overlapping pairs, fit | pairs, all seven |
 * | --- | --- | --- | --- | --- | --- |
 * | none (the defect) | 2 | 7 | 0 | 30 | 156 |
 * | pairwise only (round 2) | 1 | 6 | 59 | 12 | 102 |
 * | **pairwise + union (this)** | **0** | **0** | **56** | **14** | **85** |
 * | every intersecting pair | 1 | 5 | 89 | 18 | 107 |
 * | union alone, no pairwise | 0 | 0 | 27 | 22 | 127 |
 *
 * The two refused arms are refused for opposite reasons and both are worth stating. Separating
 * every intersecting pair moves half again as many labels and STILL leaves five unreachable, because
 * the extra movement exhausts `MAX_STEPS` more often. Dropping the pairwise rule and keeping only
 * the union one is genuinely tempting — half the movement — but it gives back most of the overlap
 * the card was written to reduce, 22 pairs at the fit camera against 14.
 *
 * **What this does NOT claim.** It is a rule about anchors and a MODELLED box, so it cannot say
 * nothing is occluded on a screen whose UI font is not the one `labelWidth` models. Two cases stay
 * outside it by construction: a pair just over `SAME_ROW_PX` apart, where the lower label is
 * pressable but its digits may not be legible; and a jam that exhausts `MAX_STEPS`, which is
 * bounded at `MAX_STEPS + 1` labels on one point and asserted rather than hoped for. What it does
 * guarantee is testable here: a label nothing would cover is returned UNMOVED — the floor AD18-R14
 * set on the resting state, which since AD18-R17 is `separateLabels`' — and no placed label leaves an earlier one with less than
 * `MIN_BAND_PX` clear unless that label exhausted its steps.
 */
export function spreadLabels(labels: readonly LabelAnchor[], stage: StageSize): ScreenPoint[] {
	const placed: LabelBox[] = [];
	// What each placed label has had taken out of it since, by the labels drawn over it.
	const cuts: (readonly [number, number])[][] = [];

	const bandLeft = (candidate: LabelBox, victim: LabelBox, index: number): number =>
		freeBand(victim, [...cuts[index], rangeOf(candidate)]);
	const hides = (candidate: LabelBox): boolean => placed.some((victim, index) =>
		sharesRow(candidate.at, victim.at)
		|| (spansColumn(candidate, victim) && bandLeft(candidate, victim, index) < MIN_BAND_PX));
	// The worst any earlier label is left by putting the candidate here — bigger is better.
	const worst = (candidate: LabelBox): number => placed.reduce(
		(least, victim, index) => spansColumn(candidate, victim) ? Math.min(least, bandLeft(candidate, victim, index)) : least,
		LABEL_HEIGHT_PX,
	);

	for (const label of labels) {
		const step = label.at.y < stage.height / 2 ? LABEL_HEIGHT_PX : -LABEL_HEIGHT_PX;
		const width = labelWidth(label.value);
		let chosen: LabelBox = { at: label.at, width };
		let best = -1;
		for (let taken = 0; taken <= MAX_STEPS; taken += 1) {
			const candidate: LabelBox = { at: screenPoint(label.at.x, label.at.y + step * taken), width };
			if (!hides(candidate)) {
				chosen = candidate;
				break;
			}
			const room = worst(candidate);
			if (room > best) {
				best = room;
				chosen = candidate;
			}
		}
		placed.forEach((victim, index) => {
			if (spansColumn(chosen, victim)) cuts[index].push(rangeOf(chosen));
		});
		placed.push(chosen);
		cuts.push([]);
	}
	return placed.map((box) => box.at);
}

/**
 * The rulers' strip along the canvas's top and left edges, in stage pixels —
 * `--rp-designer-ruler-size` in `designer-rulers.css`, restated because a stylesheet variable is not
 * readable from here; `restingLabels.test.ts` pins the two together. No label is PLACED on it, to
 * within `ROOM_SLACK_PX`: a label paints above the rulers, so one standing there would cover the
 * scale it is read against. `separateLabels` and `outsideAnchor` both keep a label they move clear
 * of it, give or take that half pixel of floating-point slack. A label whose own
 * anchor lies there is still drawn there — the camera put its edge there, not the rule.
 */
const RULER_PX = 18;
/**
 * Floating-point slack in the room tests, so a fit camera's 48 px margin is not read as 47.999 —
 * `outsideAnchor`'s, and `separateLabels`' ruler edges since fix round 1 of AD18-R21.
 */
const ROOM_SLACK_PX = 0.5;

/**
 * How far a RESTING label may be moved to clear another: up to five whole label heights up or
 * down (150 px), each at no shift or at any half-step of its own width up to three either side.
 * **The measurements below were taken at one and a half widths**, before fix round 2 of AD18-R21
 * widened the reach; see the last paragraph.
 *
 * Measured rather than chosen, over every catalogue preset with nothing, the clearance and each
 * detail selected in turn, at the fit camera on every stage from 280 x 280 to 900 x 700 in 40 x 20
 * steps — 20,416 frames, counting frames left with two labels sharing any area. First with the
 * overall pair on its edges:
 *
 * | reach | frames with an overlap |
 * | --- | --- |
 * | three rows, no sideways shift (`spreadLabels`' own axis) | 2,692 |
 * | three rows, shifts to one width | 963 |
 * | two rows, shifts to one and a half widths | 45 |
 * | three rows, shifts to one and a half widths | 0 |
 *
 * **Then again once `outsideAnchor` stood the overall pair outside the footprint and a moved label
 * was kept off the rulers' strip**, which together crowd a narrow canvas's top band: three rows left
 * 74 frames overlapping and four left 16, every one an armchair's or a sofa's second detail on a
 * stage under 640 px; **five rows leave none**, and none either when the labels are drawn up to
 * four pixels wider than `labelWidth` models — the `APART_GAP_PX` margin, spent. Below 280 px two
 * frames still collide (a toilet's and a tree's detail at 260 wide). `restingLabels.test.ts` holds
 * two of the failing frames, which three or four rows turn red. The cost is movement: a moved label
 * travels 42 px on average and at most 150, and 654 of the 44,850 moves exceeded 100 px — each a
 * label whose nearer slots were all taken, off the stage or on the rulers.
 *
 * **Fix round 2 of AD18-R21 widened the sideways reach from one and a half widths to three**, for the
 * overall width: once it may not step onto the footprint (`separateLabels`), a width whose outside
 * row sits right under the ruler has only its own row left, and on a small footprint every slot to
 * one and a half widths lands on the selected part's middle or corner handles. Measured over every
 * preset with nothing, the footprint, the clearance and each detail selected, in all three selection
 * modes, on the stage grid above plus the four modelled leaves — 77,964 frames: a label left on a
 * handle in 2,336 frames at one and a half widths and in **205 at three**, every one an overall label
 * on a stage 280 to 360 px wide; none overlapping and none drawn inside the footprint either way. The
 * cost is distance: moves over 100 px rose from 190 to 2,321 of about 126,000, each a width sliding
 * along its own row past the part's corner handle. Fix round 3 briefly had an overall label try its
 * own line before any nearer slot further out, which took that to 2,967 and put 3,521 overall widths
 * and 1,186 depths wholly past their own line's end; fix round 4 went back to nearest-first over both
 * (`overallSlot`): **2,366**, **2,737** and **720**, every floor above unchanged.
 */
const RESTING_ROWS = 5;
const RESTING_SHIFTS: readonly number[] = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, 3, -3];

/**
 * The footprint's on-screen WIDTH, in stage pixels, below which the resting state draws the overall
 * width and depth alone (AD18-R21). `All dimensions` is not asked: it still draws every label.
 *
 * **A dated snapshot of ONE preset, the vanity, at the camera `DesignerCanvas` fits on mount**,
 * measured by the integrator in the harness on 2026-09-24: the footprint drew about 470 px across at
 * a 1280 leaf, 285 at 760, 190 at 580 and 170 at 460, and at the last two the selected part's
 * figures — the 270, 220, 126 and 54 mm offsets and sizes — nearly covered the drawing, though no
 * label overlapped another. 240 falls between 190 and 285, so it fires at 580 and 460 and at neither
 * wider leaf. It is read off the FOOTPRINT rather than the canvas because the canvas at a 460 leaf
 * is 460 px wide — a canvas-width threshold would never fire there — and zooming in past it brings
 * the part's figures back, since what is too small is the drawing and not the pane.
 *
 * **It reads the footprint's WIDTH alone, as the brief that set it asks**: a long, shallow footprint
 * drawn 240 px across and 40 px deep rests every figure. The depth is not asked.
 */
const RESTING_DETAIL_MIN_PX = 240;

/**
 * The figures the RESTING state draws (AD18-R21): `figures` as `dimensionFigures` measured them,
 * or the overall pair alone while `shape`'s footprint draws under `RESTING_DETAIL_MIN_PX` across
 * at `worldPerPixel`. The overall pair is the `outside` pair — the only figures `sizeFigures`
 * marks that way — so it is picked by that fact rather than by name.
 */
export function restingFigures(figures: readonly DimensionFigure[], shape: AssetShape, worldPerPixel: number): readonly DimensionFigure[] {
	const outer = footprintCorners(shape);
	return (outer.max.x - outer.min.x) / worldPerPixel < RESTING_DETAIL_MIN_PX ? figures.filter((figure) => figure.outside) : figures;
}

/**
 * Whether a label's box reaches into a selection handle's GRAB square (AD18-R21) — the
 * `VERTEX_GRAB_RADIUS_PX` `hitDesign` grabs a handle within, taken each way of its point. The
 * overlay paints over the stage, so a label there takes the press the handle was meant to get:
 * measured at a 1280 leaf, the vanity basin's `54 mm` offset sat on its bottom-middle box handle and
 * the handle could not be grabbed. A square rather than the disc, because a label is a box and the
 * corner the square adds is 3.3 px at most.
 */
function onHandle(box: LabelBox, handle: ScreenPoint): boolean {
	return Math.abs(box.at.x - handle.x) < box.width / 2 + VERTEX_GRAB_RADIUS_PX
		&& Math.abs(box.at.y - handle.y) < LABEL_HEIGHT_PX / 2 + VERTEX_GRAB_RADIUS_PX;
}

const distance = (one: ScreenPoint, other: ScreenPoint): number => Math.hypot(one.x - other.x, one.y - other.y);

/** Whether a slot lies inside the stage and off the rulers, asked along each axis on its own. */
interface SlotBounds {
	readonly x: (box: LabelBox) => boolean;
	readonly y: (box: LabelBox) => boolean;
}

/**
 * Where an OVERALL label goes when its own anchor is not free: the NEAREST free slot that is either
 * **along its own line** — a width's own row, a depth's own column — or **further out**, a width's
 * rows above, a depth's columns to the left; `undefined` when none is, and the label keeps its
 * anchor. Never a slot further onto the drawing (fix rounds 2 and 3 of AD18-R21).
 *
 * **A slide along the line asks only the bounds ALONG it**, and that bound is the part that matters.
 * The slide changes nothing across the line, so a width on the ruler's edge, or a depth over the left
 * ruler, is no further onto the ruler for sliding than it already was — and asking the full bounds
 * there left such a label no slot at all, which is what round 2's carve-out for an edge label worked
 * around, putting 1,652 of 24,309 edge overall depths across the drawing by up to 86 px (the review's
 * measurement; a sofa's `700 mm` over its arm at a 460 leaf, seen in Chromium).
 *
 * **Nearest-first over both kinds, not the line first** (fix round 4). Round 3 tried every slot along
 * the line before any further out, whatever the distance; the review rebuilt it as this one search
 * over the same frames and every floor held while labels travelled less — see `RESTING_ROWS`.
 * Asked the same way whether `outsideAnchor` stood the label outside or left it on the edge.
 */
function overallSlot(
	axis: 'x' | 'y',
	anchor: ScreenPoint,
	slots: readonly LabelBox[],
	free: (box: LabelBox) => boolean,
	bounds: SlotBounds,
): LabelBox | undefined {
	const along = axis === 'x'
		? (box: LabelBox): boolean => box.at.y === anchor.y && bounds.x(box)
		: (box: LabelBox): boolean => box.at.x === anchor.x && bounds.y(box);
	const out = (box: LabelBox): boolean => (axis === 'x' ? box.at.y <= anchor.y : box.at.x <= anchor.x) && bounds.x(box) && bounds.y(box);
	return slots.find((box) => (along(box) || out(box)) && free(box));
}

/**
 * Where each label of the RESTING state is drawn — nothing selected, or one part selected, with
 * `All dimensions` off (AD18-R17). AD18-R14 set that state's floor at ZERO overlapping pairs and it
 * was only ever measured at a 1280 leaf; at a 460 leaf a selected part's eight labels overlapped in
 * five pairs, every one pressable, so neither of `spreadLabels`' rules — both about being COVERED —
 * could see them. This one asks the plain question instead: do two boxes share any area.
 *
 * **Earlier wins, as in `spreadLabels`, and a label that would touch one already placed takes the
 * NEAREST free slot** among whole label heights up or down and shifts of up to three of its own
 * widths sideways (`RESTING_ROWS`), inside the stage — nearest by straight distance, the inward row
 * first on a tie.
 * Each of those moves has a drafting reading, which `dimensionLines.ts` draws: a width moved up or
 * down takes its line with it on longer extension lines, a width moved sideways slides along its own
 * line, and a depth the other way round. A label nothing would touch is returned UNMOVED, which is
 * what keeps the nothing-selected pair exactly where it has always been drawn.
 *
 * **A slot must lie inside the stage and clear of the rulers' strip** because `.rp-plan-canvas` is
 * `overflow: hidden`: a label moved off it is clipped, which is worse than the overlap it was moved
 * for — and one moved onto the strip covers the scale (`RULER_PX`). When no slot is free
 * the label stays on its anchor and the overlap stands — honest rather than hidden. It happens on
 * no fit-camera frame of 280 px or more in `RESTING_ROWS`' measurement, and it did happen on the two
 * 260 px frames that docblock records; `restingLabels.test.ts`' sweep of the four modelled leaves
 * reaches it in no frame it draws.
 *
 * **`handles` are OBSTACLES in the same search (AD18-R21)**: the stage points of the selected part's
 * handles, which no label may cover (`onHandle`). They are placed before every label and never move,
 * so a label on one takes the nearest slot clear of both the labels before it and every handle — the
 * same slots, the same order, one more question asked of each. A part's own width and depth anchor
 * on the middles of its top and left edges, where its Transform box handles are, so a selected
 * part's size pair moves whenever its Transform handles are drawn. With no free slot the label stays
 * on its anchor, over the handle, as it stays over a label — at the fit camera, `restingLabels.test.ts`'s
 * sweep leaves no label on a handle in any frame it draws, in all three selection modes.
 *
 * **The OVERALL pair is placed FIRST, so a part's labels yield to it and never the reverse** (fix
 * round 1 of AD18-R21). Measured in Chromium on the first version of the handle rule, at a 1280 leaf
 * with the vanity's basin selected: the `126 mm` offset stepped off the basin's rotate handle into
 * the free slot above it, and the `800 mm` width, placed after it as `dimensionFigures` orders them,
 * yielded and was pushed INSIDE the footprint, its line through the tap hole. That broke AD18-R17's
 * *"outside the footprint wherever the canvas has room"*, and there was room. The answer keeps the
 * input's order; only the order of PLACING changes.
 *
 * **And an overall label takes NO slot on the footprint's side of its anchor** (fix round 2). Placed
 * first it moves only for a handle — but the FOOTPRINT's own top-middle box handle and its rotate
 * handle lie under the width's outside anchor, and of two slots equally near the inward row came
 * first, so a selected rect table's width was drawn over the table (measured by the review at 251.3
 * under a top edge at 206.3; 9,050 frames of 77,964 over every preset, selection and mode). So a
 * width's slots are its own row and the rows above it, and a depth's its own column and the columns
 * left of it: every move is a slide along its own line or a step further out, the nearest free one
 * first (`overallSlot`). That holds for an overall label `outsideAnchor` left ON the edge too:
 * it may not move further onto the drawing than its anchor either. **With no such slot free it keeps
 * its anchor, over the handle**, rather than go inside — since an overall figure drawn over the
 * drawing is the defect AD18-R17 names. The handle may then be unreachable: the slot search counted
 * it blocked, and in the geometry that forces this arm — a width right under the ruler — the strip of
 * it the box leaves is under the ruler too. `restingLabels.test.ts`' sweep reaches that arm in no
 * frame of the four modelled leaves, in any mode; over the whole stage grid `RESTING_ROWS` records,
 * it happens in 205 of 77,964 frames, all on canvases 280 to 360 px wide.
 *
 * **The rotate handle stays an obstacle, for every label** — including the `126 mm` top offset,
 * whose own vertical line runs up the handle's stem. A label on it takes the press, and a rotate
 * handle nobody can grab is the defect this rule exists for; the offset slides one of its widths
 * sideways instead, which carries its line with it on extension lines, as any moved offset does.
 *
 * `spreadLabels` stays the rule for `All dimensions`, whose floor is a different one: 26 labels
 * cannot all be kept apart at the camera the designer opens with, and AD18-R14 asks only that none
 * is impossible to click. It is handed no handles.
 */
export function separateLabels(labels: readonly LabelAnchor[], stage: StageSize, handles: readonly ScreenPoint[] = []): ScreenPoint[] {
	const placed: LabelBox[] = [];
	const drawn: ScreenPoint[] = labels.map((label) => label.at);
	// `ROOM_SLACK_PX` on the ruler edges for `outsideAnchor`'s reason: at the fit camera an overall
	// width stands exactly on the ruler's edge, computed as 17.99999, and a slide along its own row
	// was refused as over the ruler without it.
	const bounds: SlotBounds = {
		x: (box) => box.at.x - box.width / 2 >= RULER_PX - ROOM_SLACK_PX && box.at.x + box.width / 2 <= stage.width,
		y: (box) => box.at.y - LABEL_HEIGHT_PX / 2 >= RULER_PX - ROOM_SLACK_PX && box.at.y + LABEL_HEIGHT_PX / 2 <= stage.height,
	};
	const inside = (box: LabelBox): boolean => bounds.x(box) && bounds.y(box);
	// The overall pair first; `toSorted` is stable, so each group keeps `dimensionFigures`' order.
	const order = labels.map((_, index) => index).toSorted((one, other) => Number(labels[other].overall !== undefined) - Number(labels[one].overall !== undefined));
	for (const index of order) {
		const label = labels[index];
		const width = labelWidth(label.value);
		const own: LabelBox = { at: label.at, width };
		const inward = label.at.y < stage.height / 2 ? LABEL_HEIGHT_PX : -LABEL_HEIGHT_PX;
		const slots = Array.from({ length: 2 * RESTING_ROWS + 1 }, (_, step) => (step % 2 === 0 ? -step / 2 : (step + 1) / 2))
			.flatMap((row) => RESTING_SHIFTS.map((shift): LabelBox => ({ at: screenPoint(label.at.x + shift * width, label.at.y + row * inward), width })))
			.toSorted((one, other) => distance(one.at, label.at) - distance(other.at, label.at));
		const free = (box: LabelBox): boolean => !placed.some((other) => overlaps(box, other)) && !handles.some((handle) => onHandle(box, handle));
		const moved = label.overall === undefined ? slots.find((box) => inside(box) && free(box)) : overallSlot(label.overall, label.at, slots, free, bounds);
		const chosen = free(own) ? own : moved ?? own;
		placed.push(chosen);
		drawn[index] = chosen.at;
	}
	return drawn;
}

/**
 * How far an OVERALL dimension line stands outside the footprint (board 01), in stage pixels.
 *
 * A width's is 15: half a label's height, so its box sits wholly outside the outline — and at the
 * camera an asset OPENS with it exactly fills the 30 px `FIT_PADDING_PX`'s 48 px margin leaves below
 * the 18 px ruler, which is the most it can be and still be drawn there. A depth's is 36: half the
 * widest overall label the model draws, a five-glyph reading at 70 px, plus one, so its box clears
 * the left edge too.
 */
const WIDTH_OUTSET_PX = 15;
const DEPTH_OUTSET_PX = 36;

/**
 * Where an OVERALL label stands (AD18-R17, board 01): its line moved OUTSIDE the footprint — up for
 * the width, left for the depth — by a fixed distance, when the canvas has ROOM for the label there;
 * otherwise `anchor`, the edge placement. Room is read off the canvas box itself — the stage's own
 * top and left, where the rulers' strip lies — so it is a fact about the current camera rather than
 * a width breakpoint: at a camera that puts the edge near the canvas's top or left the label falls
 * back to the edge rather than run under the ruler or off the canvas, which `overflow: hidden` clips.
 *
 * Only the top and left: those are the only edges the overall pair is anchored on.
 */
export function outsideAnchor(axis: 'x' | 'y', anchor: ScreenPoint, value: number): ScreenPoint {
	if (axis === 'x') {
		const y = anchor.y - WIDTH_OUTSET_PX;
		return y - LABEL_HEIGHT_PX / 2 >= RULER_PX - ROOM_SLACK_PX ? screenPoint(anchor.x, y) : anchor;
	}
	const x = anchor.x - DEPTH_OUTSET_PX;
	return x - labelWidth(value) / 2 >= RULER_PX - ROOM_SLACK_PX ? screenPoint(x, anchor.y) : anchor;
}
