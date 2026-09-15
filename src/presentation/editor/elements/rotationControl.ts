import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { boundingBoxOf } from '../../../core/geometry/operations';
import { spatialElementFootprint, type StairOptions } from '../../../domain/spatial/stairGeometry';
import { ROTATION_CONTROL_SIZE_PX, ROTATION_HANDLE_CLEARANCE_PX, ROTATION_HANDLE_OFFSET_PX, ROTATION_HANDLE_REACH_PX, ROTATION_VIEW_MARGIN_PX } from '../handleMetrics';

export interface RotationControlGeometry {
	readonly handle: Point;
	/** Where the stem meets the item's box, on the side the arrow stands beyond. */
	readonly anchor: Point;
	readonly pivot: Point;
	readonly bounds: BoundingBox;
	readonly hostWall: boolean;
}
export interface RotationInteraction {
	readonly control: RotationControlGeometry;
	readonly dragging: boolean;
	readonly snapDegrees: number | null;
}

/** The square pointer target centred on the arrow, `ROTATION_CONTROL_SIZE_PX` across at any zoom. */
export function rotationControlBounds(handle: Point, worldPerPixel: number): BoundingBox {
	const half = ROTATION_CONTROL_SIZE_PX / 2 * worldPerPixel;
	return { min: { x: handle.x - half, y: handle.y - half }, max: { x: handle.x + half, y: handle.y + half } };
}
export function rotationControlContains(bounds: BoundingBox, point: Point): boolean {
	return point.x >= bounds.min.x && point.x <= bounds.max.x && point.y >= bounds.min.y && point.y <= bounds.max.y;
}
function overlaps(a: BoundingBox, b: BoundingBox, gap: number): boolean {
	return a.min.x - gap <= b.max.x && a.max.x + gap >= b.min.x && a.min.y - gap <= b.max.y && a.max.y + gap >= b.min.y;
}
function clamp(value: number, low: number, high: number): number {
	return Math.max(low, Math.min(high, value));
}

export interface RotationControlShape {
	readonly id: string;
	readonly kind: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
	readonly wall?: { readonly id: string; readonly bulge?: number };
	readonly stair?: StairOptions;
	/** A closed outline the caller derived and the domain cannot (an asset's footprint needs its shape); the handle stands off it instead of `points`. */
	readonly hitPoints?: readonly Point[];
}
/** The drawn outline's curve-aware box: a placement's derived footprint, a stair's, a wall's own arc, else the shape as stored. */
function outlineBox(shape: RotationControlShape): BoundingBox | null {
	const outline = shape.hitPoints ? { points: shape.hitPoints }
		: shape.kind === 'stair' ? { points: spatialElementFootprint(shape) }
			: shape.wall?.id === shape.id ? { points: shape.points, bulges: [shape.wall.bulge ?? 0, 0] }
				: shape;
	const box = boundingBoxOf(outline);
	return box.ok ? box.value : null;
}
/** Top first, where Konva's Transformer puts its rotater, then bottom, left and right. World y grows downward, so the top is `min.y`. */
const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
/**
 * One arrow per item, beyond the middle of a side of its axis-aligned box: the top, then the bottom,
 * left and right in turn. A measured native control covering the arrow pushes it further out on the
 * same side, its stem running beneath — a selected Room's dimension labels sit at all four middles —
 * and the side is given up once that passes `ROTATION_HANDLE_REACH_PX` or the view. Along its side the
 * arrow slides into view but never past the box, so the stem always meets the box. `null` when no side
 * has room.
 */
export function layoutRotationControl(shape: RotationControlShape, pivot: Point, scale: number, visible?: BoundingBox, obstacles: readonly BoundingBox[] = []): RotationControlGeometry | null {
	const box = outlineBox(shape);
	if (!box) return null;
	const hostWall = shape.wall !== undefined && shape.id !== shape.wall.id;
	const half = ROTATION_CONTROL_SIZE_PX / 2 * scale, gap = ROTATION_HANDLE_CLEARANCE_PX * scale, reach = ROTATION_HANDLE_REACH_PX * scale, inset = half + ROTATION_VIEW_MARGIN_PX * scale;
	const along = (axis: 'x' | 'y'): number => {
		const middle = (box.min[axis] + box.max[axis]) / 2;
		return clamp(visible ? clamp(middle, visible.min[axis] + inset, visible.max[axis] - inset) : middle, box.min[axis], box.max[axis]);
	};
	const shown = (point: Point): boolean => !visible || (point.x >= visible.min.x + inset && point.x <= visible.max.x - inset && point.y >= visible.min.y + inset && point.y <= visible.max.y - inset);
	for (const [dx, dy] of SIDES) {
		const anchor = { x: dx === 0 ? along('x') : dx < 0 ? box.min.x : box.max.x, y: dy === 0 ? along('y') : dy < 0 ? box.min.y : box.max.y };
		let distance = ROTATION_HANDLE_OFFSET_PX * scale;
		while (distance <= reach) {
			const handle = { x: anchor.x + dx * distance, y: anchor.y + dy * distance }, bounds = rotationControlBounds(handle, scale);
			if (!shown(handle)) break;
			const covering = obstacles.find(obstacle => overlaps(bounds, obstacle, gap));
			if (!covering) return { handle, anchor, pivot, bounds, hostWall };
			// Clear of its far edge by the gap and a pixel, so every pass moves strictly outward.
			const far = { x: dx < 0 ? covering.min.x : covering.max.x, y: dy < 0 ? covering.min.y : covering.max.y };
			distance = dx * (far.x - anchor.x) + dy * (far.y - anchor.y) + half + gap + scale;
		}
	}
	return null;
}
