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
 * **Two exported FUNCTIONS, and the second works in PIXELS rather than millimetres.** Counted from
 * `grep -n "^export"` over this file after the change, which prints three lines — the FIRST is
 * `DimensionFigure` and is a type. `dimensionFigures`
 * answers what is measured and where in the world it belongs; `spreadLabels` answers where a label
 * is actually drawn once the camera has crowded several of them onto one row — AD18-R14, whose
 * whole subject is a box that has a size only on a stage. It is here rather than in the component
 * for this module's founding reason: it is a rule about positions, it reads nothing but its two
 * arguments, and a rule that lives in an SFC is a rule no node test can put a case on.
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
			value: box.max.x - box.min.x,
			edit: (typed) => (shape) => resized(shape, part, 'width', typed),
		},
		{
			name: `${key}-depth`,
			label: labels[1],
			at: { x: box.min.x, y: box.centre.y },
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
		const along = near + gapOf(box, outer, spec) / 2;
		const across = spec.axis === 'x' ? box.centre.y : box.centre.x;
		return {
			name: `${key}-${spec.key}`,
			label: spec.label,
			at: spec.axis === 'x' ? { x: along, y: across } : { x: across, y: along },
			value: gapOf(box, outer, spec),
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
function measuredParts(shape: AssetShape, selection: DesignerSelection | null, all: boolean, hidden: ReadonlySet<string>): OutlinePart[] {
	const clearance = shape.clearance === null || shape.clearancePending ? [] : [CLEARANCE];
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
): DimensionFigure[] {
	const outer = footprintCorners(shape);
	const overall = sizeFigures(FOOTPRINT, outer, 'overall', ['designer.dimension.overall-width', 'designer.dimension.overall-depth']);
	return measuredParts(shape, selection, all, hidden).flatMap((part) => {
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
 * How far one label may be pushed off its own anchor, in steps.
 *
 * Uncapped, the sweep below still terminates — each step is a whole label height and the placed set
 * is finite — but a label 700 px from the edge it measures is a worse lie than two labels sharing a
 * row, and at this surface's zoom-out it would be pushed clean off a canvas that is
 * `overflow: hidden`. Four steps is 120 px: enough for the clusters this surface actually produces
 * (AD18-R14's worst was THREE labels in one box) and short enough that a moved label is still read
 * against its own part.
 *
 * **THE CAP HAS A RESIDUAL AND IT IS THE ORIGINAL DEFECT.** A figure still covered here keeps its
 * last slot — and so does the next one, so two labels that exhaust the cap land on the SAME POINT
 * and the earlier is drawn under the later and cannot be pressed at all. That is AD18-R14's own
 * *"the two beneath it cannot be reached at all"*, surviving at the bottom of the fix for it, and
 * `dimensionCollision.test.ts` asserts it rather than leaving it to be discovered. It needs six
 * labels on one point, which this surface reaches only far outside the camera AD18-R14 measured —
 * `MIN_ZOOM` is 0.01, ten wheel-steps further out, where the whole shape is a few pixels wide.
 *
 * Both alternatives were considered and neither dominates. Stepping past the cap until the point is
 * free restores distinctness and pays for it by pushing a label off a clipped canvas, which is
 * unreachable AND invisible. A chooser that collapses a jammed group is the arm that actually
 * closes it, and it needs a locale string this card may not add.
 */
const MAX_STEPS = 4;

/** Whether `later` would sit on `earlier`'s row, near enough along it to cover the reading. */
function sharesRow(later: ScreenPoint, earlier: ScreenPoint): boolean {
	return Math.abs(later.x - earlier.x) < SAME_COLUMN_PX && Math.abs(later.y - earlier.y) < SAME_ROW_PX;
}

/**
 * Where each label is actually drawn, given where each one WANTS to be — AD18-R14's collision
 * avoidance for the `All dimensions` state, in stage pixels because that is the space a label box
 * has a size in. A collision at a zoomed-out camera is not one two wheel steps later, which
 * AD18-R14 measured as 31 overlapping pairs falling to 13.
 *
 * **The rule: a label that would land on an already-placed label's row steps one full label height
 * away, repeatedly, up to `MAX_STEPS`.** Earlier wins, and the order is `dimensionFigures`' own —
 * a part's own figures first and the overall pair appended last — so the label with the more
 * specific subject keeps its true anchor and the outer measurement stacks off it, which is how a
 * drafting dimension chain reads. `.concat(overall)` is what makes that true and is the reason the
 * defect presented as *the overall label is always on top and always takes the click*: the overlay's
 * one `z-index` lifts a wrapper only while it holds an open FORM, so among the buttons paint and
 * hit order is DOM order.
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
 * **The WIDER predicate — separate every pair whose boxes intersect at all — was measured and
 * refused, and the numbers are the argument.** Over `editableShape()` at the designer's own
 * opening camera, where the whole shape is barely a hundred pixels across:
 *
 * | predicate | selected `detail-1` (8 labels) | `All dimensions` (14 labels) |
 * | --- | --- | --- |
 * | this one | **2** moved, 60 px at worst | **5** moved, 60 px at worst |
 * | boxes intersect | **6** moved, three at the 120 px cap | **12** moved, five at the cap |
 *
 * A label at the cap is one the sweep did NOT resolve, so the wider predicate buys a scattered
 * overlay and still leaves overlaps — which is the layout engine AD18-R14's losing side warned §0
 * never asked for, arriving without even the property it was reached for. The NARROWER arm —
 * stepping only exactly coincident anchors — was measured too and is in `SAME_COLUMN_PX`: it moves
 * a third as many labels and leaves twice as many covered, because a wide reading swallows a narrow
 * one whole without landing on it.
 *
 * **What this does NOT claim, stated wider than the first version of this paragraph did.** It is a
 * rule about ANCHORS with a modelled box, so it cannot say nothing is occluded on screen, and three
 * cases are outside it by construction rather than by accident: two labels just over `SAME_ROW_PX`
 * apart, where the lower one is pressable but its digits may not be legible; two LATER labels that
 * straddle an earlier one, covering it between them while sharing a row with neither; and a pair
 * that both exhaust `MAX_STEPS`, which land on one point — see there. What it does guarantee is
 * testable here: an anchor that shares no row is returned UNMOVED, which is the floor AD18-R14 sets
 * on the resting state, and no returned point shares a row with an earlier one unless that label
 * exhausted `MAX_STEPS`.
 */
export function spreadLabels(anchors: readonly ScreenPoint[], stage: StageSize): ScreenPoint[] {
	const placed: ScreenPoint[] = [];
	const covered = (point: ScreenPoint): boolean => placed.some((other) => sharesRow(point, other));
	for (const anchor of anchors) {
		const step = anchor.y < stage.height / 2 ? LABEL_HEIGHT_PX : -LABEL_HEIGHT_PX;
		let at = anchor;
		for (let steps = 0; steps < MAX_STEPS && covered(at); steps += 1) {
			at = screenPoint(at.x, at.y + step);
		}
		placed.push(at);
	}
	return placed;
}
