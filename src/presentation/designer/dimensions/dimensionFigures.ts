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
	/** Whole millimetres, as every geometry field in the Inspector shows them. */
	readonly value: number;
	readonly edit: (typed: number) => (shape: AssetShape) => Result<AssetShape, ValidationError>;
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
			edit: (typed) => (shape) => resizeToExtent(shape, part, 'width', typed),
		},
		{
			name: `${key}-depth`,
			label: labels[1],
			at: { x: box.min.x, y: box.centre.y },
			value: box.max.y - box.min.y,
			edit: (typed) => (shape) => resizeToExtent(shape, part, 'depth', typed),
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
				const by = spec.sign * (typed - gapOf(corners(current), footprintCorners(shape), spec));
				return moveOutline(shape, part, spec.axis === 'x' ? { dx: by, dy: 0 } : { dx: 0, dy: by });
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
 * pending detail draws nothing, exactly as it would under `all`. It also means every part named
 * here is one the shape has, which is what lets the caller measure without a null arm.
 *
 * A selection that is the footprint, the anchor or the facing contributes nothing: the footprint
 * is already the overall pair, and the other two are points. See this module's header.
 */
function measuredParts(shape: AssetShape, selection: DesignerSelection | null, all: boolean): OutlinePart[] {
	const clearance = shape.clearance === null || shape.clearancePending ? [] : [CLEARANCE];
	const drawable = shape.details.filter((detail) => !detail.pending);
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
export function dimensionFigures(shape: AssetShape, selection: DesignerSelection | null, all: boolean): DimensionFigure[] {
	const outer = footprintCorners(shape);
	const overall = sizeFigures(FOOTPRINT, outer, 'overall', ['designer.dimension.overall-width', 'designer.dimension.overall-depth']);
	return measuredParts(shape, selection, all).flatMap((part) => {
		// `measuredParts` names only parts the shape HAS — it derives them from `shape.details` and
		// from `shape.clearance` rather than from the selection — so this cast rests on the same
		// kind of guarantee `footprintCorners` does, and a guard here would be undrivable.
		const box = corners(partMeasure(shape, part) as PartBox);
		const key = part.kind === 'detail' ? `detail-${part.id}` : part.kind;
		return [...sizeFigures(part, box, key, PART_LABELS), ...offsetFigures(part, key, box, outer)];
	}).concat(overall);
}
