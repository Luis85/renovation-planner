import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { BOX_HANDLE_COUNT, boxHandlePoint, boxResize } from '../../../core/geometry/boxHandles';
import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape, Dimensions } from '../../../domain/asset/AssetShape';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { placementBox, placementHeading, resizedPlacement } from '../../../domain/spatial/assetPlacement';
import { TRANSFORM_BOX_PADDING_PX } from '../handleMetrics';

/** No side of a resized item or placement is shorter than this, world mm. */
const MIN_SIDE_MM = 1;
/** Nor longer than a kilometre, the bound `validSpatialElement` holds a placement's size to. */
const MAX_SIDE_MM = 1e6;

/**
 * A selected item's or placement's resize frame (plan editor transform box design): world = origin + a·u + b·v,
 * where `v` is `u` turned a quarter anticlockwise. `box` is the outline's extent in (a, b); `shape` is present
 * exactly for an asset placement, whose frame is `placementBox`'s.
 */
export interface TransformBox {
	readonly element: SpatialElement;
	readonly origin: Point;
	readonly u: Point;
	readonly box: BoundingBox;
	readonly shape?: AssetShape;
}

/** What a resize writes: new points, and for a placement its own size — absent while it matches the library. */
export interface ResizedGeometry {
	readonly points: readonly Point[];
	readonly size?: Dimensions | undefined;
}

type Frame = Pick<TransformBox, 'origin' | 'u'>;
const toWorld = (frame: Frame, local: Point): Point =>
	({ x: frame.origin.x + local.x * frame.u.x - local.y * frame.u.y, y: frame.origin.y + local.x * frame.u.y + local.y * frame.u.x });
function toLocal(frame: Frame, world: Point): Point {
	const dx = world.x - frame.origin.x, dy = world.y - frame.origin.y;
	return { x: dx * frame.u.x + dy * frame.u.y, y: -dx * frame.u.y + dy * frame.u.x };
}
const withinLimits = (width: number, depth: number): boolean => width >= MIN_SIDE_MM && depth >= MIN_SIDE_MM && width <= MAX_SIDE_MM && depth <= MAX_SIDE_MM;

/** An item's frame follows its first edge of non-zero length; `null` for an outline with no such edge, or a side outside the limits. */
export function itemTransformBox(element: SpatialElement): TransformBox | null {
	const { points } = element;
	const index = points.findIndex((point, at) => { const next = points[(at + 1) % points.length]; return next.x !== point.x || next.y !== point.y; });
	if (index < 0) return null;
	const start = points[index], end = points[(index + 1) % points.length], length = Math.hypot(end.x - start.x, end.y - start.y);
	const frame = { origin: start, u: { x: (end.x - start.x) / length, y: (end.y - start.y) / length } };
	const box = unwrap(boundingBoxOf({ points: points.map(point => toLocal(frame, point)) }));
	return withinLimits(box.max.x - box.min.x, box.max.y - box.min.y) ? { element, ...frame, box } : null;
}

/** A placement's frame is its own: the anchor at the origin, the library shape's x turned onto the plan by heading − facing. */
export function assetTransformBox(element: SpatialElement, shape: AssetShape): TransformBox {
	const turn = placementHeading(element) - shape.facing;
	return { element, shape, origin: element.points[0], u: { x: Math.cos(turn), y: Math.sin(turn) }, box: placementBox(element, shape) };
}

export function transformBoxSize(frame: TransformBox): Dimensions {
	return { width: frame.box.max.x - frame.box.min.x, depth: frame.box.max.y - frame.box.min.y };
}

/** The eight handles in world coordinates, clockwise from the frame's top-left, on the box grown by the padding at this camera. What is drawn and what is hit. */
export function transformHandlePoints(frame: TransformBox, worldPerPixel: number): Point[] {
	const pad = TRANSFORM_BOX_PADDING_PX * worldPerPixel, { min, max } = frame.box;
	const grown = { min: { x: min.x - pad, y: min.y - pad }, max: { x: max.x + pad, y: max.y + pad } };
	return Array.from({ length: BOX_HANDLE_COUNT }, (_, index) => toWorld(frame, boxHandlePoint(grown, index)));
}

/** The unpadded point a handle stands for, in world coordinates: where a drag adds the pointer's travel. */
export function transformHandleWorld(frame: TransformBox, index: number): Point {
	return toWorld(frame, boxHandlePoint(frame.box, index));
}

function scaled(frame: TransformBox, factors: { readonly sx: number; readonly sy: number }, fixed: Point): ResizedGeometry | null {
	if (frame.shape) return resizedPlacement(frame.element, frame.shape, factors, fixed);
	return { points: frame.element.points.map(point => {
		const local = toLocal(frame, point);
		return toWorld(frame, { x: fixed.x + (local.x - fixed.x) * factors.sx, y: fixed.y + (local.y - fixed.y) * factors.sy });
	}) };
}

/**
 * The geometry handle `index` dragged to `to` (world) leaves, or `null` when a side would be under a millimetre,
 * over a kilometre, or flipped past the fixed side. An item's points stretch in its frame about the opposite
 * handle; a placement moves its anchor and takes its own size.
 */
export function resizeTransformBox(frame: TransformBox, index: number, to: Point, shift: boolean): ResizedGeometry | null {
	const { factors, origin } = boxResize(frame.box, index, toLocal(frame, to), shift), size = transformBoxSize(frame);
	return withinLimits(size.width * factors.sx, size.depth * factors.sy) ? scaled(frame, factors, origin) : null;
}

/** A typed width and depth, applied about the box centre: the Inspector's resize. `null` outside the same limits a drag has. */
export function sizedTransformBox(frame: TransformBox, size: Dimensions): ResizedGeometry | null {
	if (!withinLimits(size.width, size.depth)) return null;
	const current = transformBoxSize(frame), { min, max } = frame.box;
	return scaled(frame, { sx: size.width / current.width, sy: size.depth / current.depth }, { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 });
}
