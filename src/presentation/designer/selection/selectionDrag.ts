import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Point } from '../../../core/geometry/Point';
import { boxHandlePoint, boxResize } from '../../../core/geometry/boxHandles';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, isErr, ok, unwrap, type Result } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { scaleRoundedRect } from '../../../domain/asset/cornerRadius';
import {
	moveAnchor,
	moveOutline,
	moveVertex,
	outlineOf,
	partNotFound,
	resizeBox,
	rotateOutline,
	setFacing,
	type OutlinePart,
} from '../../../domain/asset/shapeEdits';
import { isOutlineSelection, type DesignerSelection } from './designerSelection';
import { partMeasure, resizeToExtent, type PartBox } from './partExtent';
import type { HandleRole } from './handles';

type BoxResize = ReturnType<typeof boxResize>;

/** A body drag, or a handle. An `edge` handle is Bend edges', which `CurveTool` drives, so it is not a role here. */
export type DragRole = { readonly kind: 'body' } | Exclude<HandleRole, { readonly kind: 'edge' }>;

export interface DragStart {
	/** The design the gesture started on. */
	readonly shape: AssetShape;
	readonly selection: DesignerSelection;
	readonly role: DragRole;
	/** World point of the press. */
	readonly from: Point;
}

export interface DragOptions {
	readonly shift: boolean;
	readonly snapRotation: (radians: number) => number;
}

/** The selected outline's box, or `part-not-found` for a selection the shape no longer has. */
function boxOf(shape: AssetShape, part: OutlinePart): Result<BoundingBox, ValidationError> {
	const outline = outlineOf(shape, part);
	return outline === null ? err(partNotFound(part)) : ok(unwrap(boundingBoxOf(outline)));
}

/** How far the solved part must move along one axis the handle moves, so the side it holds still is back where it was. */
function held(moves: boolean, fixed: number, min: number, centre: number, extent: number): number {
	if (!moves) return 0;
	return fixed - (fixed === min ? centre - extent / 2 : centre + extent / 2);
}

/**
 * A box-handle resize of a graphic with arcs (AD18-R20 Task 13): its CURVE-AWARE extent solved onto the
 * dragged box by `resizeToExtent` — the typed Width/Depth path, so a drag and a typed size land the same
 * numbers, and reach the same NEAREST extent for a box the kept bulges cannot reach — then moved so the side
 * or corner opposite the handle is back where it was. A plain ratio misses here because every arc keeps its
 * bulge, so an arc whose chord a scale leaves alone keeps its whole sagitta (`scaleSolve.ts`).
 *
 * A corner drag solves width, depth, width, as `scaleDesignToDimensions` does and for its reason: the axes are
 * coupled through any arc whose chord is not axis-aligned. Which axes are solved is the HANDLE's, not the
 * factors': a corner moved straight up has `sx` of exactly 1 — a snapped pointer makes that ordinary — and a
 * coupled outline still needs its width solved back and its corner held. A side handle solves its one axis.
 *
 * A refusal comes back as it is; `keptCurves` turns it into the plain scale.
 *
 * ponytail: up to three `solveScale` runs of at most four attempts each, so twelve `resizeBox` calls per
 * pointer move at worst (four for a side handle); bounded, and cheap beside a render.
 */
function fittedResize(
	shape: AssetShape,
	part: OutlinePart,
	box: BoundingBox,
	index: number,
	{ factors, origin }: BoxResize,
): Result<AssetShape, ValidationError> {
	const handle = boxHandlePoint(box, index);
	const moves = { x: handle.x !== origin.x, y: handle.y !== origin.y };
	const width = { axis: 'width', target: (box.max.x - box.min.x) * factors.sx } as const;
	const depth = { axis: 'depth', target: (box.max.y - box.min.y) * factors.sy } as const;
	const passes = !moves.x ? [depth] : !moves.y ? [width] : [width, depth, width];
	let solved = shape;
	for (const pass of passes) {
		const next = resizeToExtent(solved, part, pass.axis, pass.target);
		if (isErr(next)) return next;
		solved = next.value;
	}
	// The part is there: `resizeToExtent` just answered it.
	const got = partMeasure(solved, part) as PartBox;
	return moveOutline(solved, part, {
		dx: held(moves.x, origin.x, box.min.x, got.centre.x, got.width),
		dy: held(moves.y, origin.y, box.min.y, got.centre.y, got.depth),
	});
}

/**
 * What a box handle writes WITHOUT Shift where it differs from the plain scale: a rounded rectangle rebuilt
 * (`scaleRoundedRect`), or any other curved outline solved (`fittedResize`) — or `null`,
 * which `draggedShape` answers with the plain scale. A refused solve is `null` too.
 */
function keptCurves(shape: AssetShape, part: OutlinePart, box: BoundingBox, index: number, resize: BoxResize): Result<AssetShape, ValidationError> | null {
	const rounded = part.kind === 'detail' ? scaleRoundedRect(shape, part.id, resize.factors, resize.origin) : null;
	if (rounded !== null) return rounded;
	// The outline is there: `boxOf` just measured it.
	const arcs = (outlineOf(shape, part) as CurvedPolygon).bulges ?? [];
	if (!arcs.some((bulge) => bulge !== 0)) return null;
	const fitted = fittedResize(shape, part, box, index, resize);
	return fitted.ok ? fitted : null;
}

/**
 * The shape this drag would write if released at `to` (symbols spec, Decision 10 and Amendment 1).
 * `to` is already snapped by the caller where snapping applies. Pure: the tool calls it on every move
 * for the preview and once more at release for the write, so the two cannot disagree.
 *
 * The anchor and the facing have no handles, so their drags ignore `role`: the anchor moves by the
 * pointer's travel, and the facing takes the pointer's bearing from the anchor.
 *
 * **A box handle keeps a rounded rectangle one** (AD18-R21): `scaleRoundedRect` rebuilds it in the new box
 * with its radius kept or clamped, by the rule a typed Width or Depth takes, and answers `null` for every
 * other part — which then takes the rule below, as does a rounded rectangle turned off the axes, since the
 * typed path does not keep that one's radius either. Shift is left out: a proportional scale keeps the
 * outline a rounded rectangle already, with the radius scaled by the same factor, as it always has.
 *
 * **A box handle on any other graphic with an arc, on a curved footprint or on a curved clearance, solves its
 * extent** (AD18-R20 Task 13, `fittedResize`; the clearance since AD18-R23) — which includes a rounded rectangle
 * `scaleRoundedRect` declines — so the side opposite the handle stays put and the curve-aware box lands where the
 * pointer asks, or as near as a typed size would. The footprint's and the clearance's typed Width and Depth (the
 * inspector's for the footprint, the canvas dimension labels' for both) already solve through `resizeToExtent`.
 * Both paths write through `resizeBox` (the drag adds a `moveOutline`, and its fallback is `resizeBox` alone), so
 * both carry `clearancePending` as it was and both clear the clearance's review flag (AD14-R1): a gesture aimed at
 * the boundary is the review. A handle on the footprint touches neither. A pending clearance has no dimension
 * label to type into (`dimensionFigures.measuredParts`) while its handles drag as any other's, which is true of a
 * pending detail too and is not this rule's. Shift and straight outlines keep the plain scale; a uniform scale
 * keeps every arc.
 * **A solve that is refused falls back to the plain scale**, so a release never turns into a notice where it
 * used to commit. A solve can be refused where the plain scale is not because its passes go through shapes the
 * plain scale never makes — a width pass leaves the depth unscaled — and one whose kept arcs meet is refused by
 * the domain. A handle dragged past the fixed side is refused by that same plain scale, as `invalid-scale`,
 * exactly as before.
 */
export function draggedShape(start: DragStart, to: Point, options: DragOptions): Result<AssetShape, ValidationError> {
	const { shape, selection, role, from } = start;
	if (!isOutlineSelection(selection)) {
		if (selection.kind === 'anchor') {
			return moveAnchor(shape, { x: shape.anchor.x + to.x - from.x, y: shape.anchor.y + to.y - from.y });
		}
		const bearing = Math.atan2(to.y - shape.anchor.y, to.x - shape.anchor.x);
		return setFacing(shape, options.shift ? options.snapRotation(bearing) : bearing);
	}
	if (role.kind === 'body') return moveOutline(shape, selection, { dx: to.x - from.x, dy: to.y - from.y });
	if (role.kind === 'vertex') return moveVertex(shape, selection, role.index, to);
	const box = boxOf(shape, selection);
	if (isErr(box)) return box;
	if (role.kind === 'box') {
		const resize = boxResize(box.value, role.index, to, options.shift);
		const kept = options.shift ? null : keptCurves(shape, selection, box.value, role.index, resize);
		return kept ?? resizeBox(shape, selection, resize.factors, resize.origin);
	}
	const centre = { x: (box.value.min.x + box.value.max.x) / 2, y: (box.value.min.y + box.value.max.y) / 2 };
	const by = Math.atan2(to.y - centre.y, to.x - centre.x) - Math.atan2(from.y - centre.y, from.x - centre.x);
	return rotateOutline(shape, selection, options.shift ? options.snapRotation(by) : by, centre);
}
