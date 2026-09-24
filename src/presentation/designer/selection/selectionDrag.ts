import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Point } from '../../../core/geometry/Point';
import { boxResize } from '../../../core/geometry/boxHandles';
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

/** How far the solved part must move along one axis so the side the handle holds still is back where it was. */
function held(factor: number, fixed: number, min: number, centre: number, extent: number): number {
	if (factor === 1) return 0;
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
 * coupled through any arc whose chord is not axis-aligned. An axis the handle does not move is not solved.
 *
 * ponytail: up to three `solveScale` runs of at most four attempts each, so twelve `resizeBox` calls per
 * pointer move at worst (four for a side handle); bounded, and cheap beside a render.
 */
function fittedResize(
	shape: AssetShape,
	part: Extract<OutlinePart, { readonly kind: 'detail' }>,
	box: BoundingBox,
	factors: { readonly sx: number; readonly sy: number },
	origin: Point,
): Result<AssetShape, ValidationError> {
	const width = { axis: 'width', target: (box.max.x - box.min.x) * factors.sx } as const;
	const depth = { axis: 'depth', target: (box.max.y - box.min.y) * factors.sy } as const;
	const passes = factors.sx === 1 ? [depth] : factors.sy === 1 ? [width] : [width, depth, width];
	let solved: Result<AssetShape, ValidationError> = ok(shape);
	for (const pass of passes) {
		solved = resizeToExtent(unwrap(solved), part, pass.axis, pass.target);
		if (isErr(solved)) return solved;
	}
	// The part is there: `resizeToExtent` just answered it.
	const got = partMeasure(unwrap(solved), part) as PartBox;
	return moveOutline(unwrap(solved), part, {
		dx: held(factors.sx, origin.x, box.min.x, got.centre.x, got.width),
		dy: held(factors.sy, origin.y, box.min.y, got.centre.y, got.depth),
	});
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
 * **A box handle on any other graphic with an arc solves its extent** (AD18-R20 Task 13, `fittedResize`) —
 * which now includes a rounded rectangle `scaleRoundedRect` declines — so the side opposite the handle stays
 * put and the curve-aware box lands where the pointer asks, or as near as a typed size would. Shift, straight
 * graphics, the footprint and the clearance still take the plain scale; a uniform scale keeps every arc.
 * A handle dragged past the fixed side asks for a non-positive extent, which the solve's first factor carries to
 * `resizeBox` and `invalid-scale`, as before.
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
		const { factors, origin } = boxResize(box.value, role.index, to, options.shift);
		const rounded = selection.kind === 'detail' && !options.shift ? scaleRoundedRect(shape, selection.id, factors, origin) : null;
		if (rounded !== null) return rounded;
		// The outline is there: `boxOf` just measured it.
		const arcs = (outlineOf(shape, selection) as CurvedPolygon).bulges ?? [];
		const curved = selection.kind === 'detail' && !options.shift && arcs.some((bulge) => bulge !== 0);
		return curved ? fittedResize(shape, selection, box.value, factors, origin) : resizeBox(shape, selection, factors, origin);
	}
	const centre = { x: (box.value.min.x + box.value.max.x) / 2, y: (box.value.min.y + box.value.max.y) / 2 };
	const by = Math.atan2(to.y - centre.y, to.x - centre.x) - Math.atan2(from.y - centre.y, from.x - centre.x);
	return rotateOutline(shape, selection, options.shift ? options.snapRotation(by) : by, centre);
}
