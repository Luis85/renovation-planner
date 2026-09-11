import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { boundingBoxOf, distance } from '../../../core/geometry/operations';
import { arcLength, arcPoint, arcTangent } from '../../../core/geometry/circularArc';
import { spatialElementFootprint, type StairOptions } from '../../../domain/spatial/stairGeometry';
import { ROTATION_CONTROL_WIDTH_PX, ROTATION_CONTROL_TOP_PX, ROTATION_CONTROL_BOTTOM_PX, ROTATION_HANDLE_OFFSET_PX, ROTATION_VIEW_MARGIN_PX, ROTATION_HANDLE_CLEARANCE_PX, ROTATION_PIVOT_DEADZONE_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';

export interface RotationControlGeometry {
	readonly handle: Point;
	readonly anchor: Point;
	/** The endpoints of the edge the arrow sits beside; hover reach spans from it to the arrow. */
	readonly edge: readonly [Point, Point];
	readonly pivot: Point;
	readonly bounds: BoundingBox;
	readonly widthPx: number;
	readonly hostWall: boolean;
	readonly edgeIndex?: number;
}
export interface RotationInteraction {
	readonly control: RotationControlGeometry;
	readonly dragging: boolean;
	readonly snapDegrees: number | null;
}

export function rotationControlBounds(handle: Point, widthPx: number, worldPerPixel: number): BoundingBox {
	return { min: { x: handle.x - widthPx / 2 * worldPerPixel, y: handle.y - ROTATION_CONTROL_TOP_PX * worldPerPixel },
		max: { x: handle.x + widthPx / 2 * worldPerPixel, y: handle.y + ROTATION_CONTROL_BOTTOM_PX * worldPerPixel } };
}
export function rotationControlContains(bounds: BoundingBox, point: Point): boolean {
	return point.x >= bounds.min.x && point.x <= bounds.max.x && point.y >= bounds.min.y && point.y <= bounds.max.y;
}
function cross(o: Point, a: Point, b: Point): number { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
/** Monotone-chain convex hull, counter-clockwise, so a point is inside when it is left of every edge. */
function convexHull(points: readonly Point[]): readonly Point[] {
	const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y);
	const half = (list: readonly Point[]) => list.reduce<Point[]>((hull, point) => {
		while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
		hull.push(point); return hull;
	}, []).slice(0, -1);
	return [...half(sorted), ...half(sorted.toReversed())];
}
/**
 * Hover reach from anywhere along the arrow's edge to the arrow: the convex hull of that edge, its
 * anchor and the target rectangle, padded by the grab radius. Convex, so every straight path from
 * the edge to the arrow stays inside it even where another item lies beneath. Never a click target.
 */
export function rotationControlApproachContains(control: RotationControlGeometry, point: Point, scale: number): boolean {
	const m = VERTEX_GRAB_RADIUS_PX * scale, { min, max } = control.bounds;
	const hull = convexHull([...control.edge, control.anchor, min, max, { x: min.x, y: max.y }, { x: max.x, y: min.y }]
		.flatMap(({ x, y }) => [{ x: x - m, y: y - m }, { x: x + m, y: y - m }, { x: x + m, y: y + m }, { x: x - m, y: y + m }]));
	return hull.every((a, index) => cross(a, hull[(index + 1) % hull.length], point) >= 0);
}
function overlaps(a: BoundingBox, b: BoundingBox, gap: number): boolean {
	return a.min.x - gap <= b.max.x && a.max.x + gap >= b.min.x && a.min.y - gap <= b.max.y && a.max.y + gap >= b.min.y;
}
function pointBox(point: Point, radius: number): BoundingBox {
	return { min: { x: point.x - radius, y: point.y - radius }, max: { x: point.x + radius, y: point.y + radius } };
}
function clampControl(point: Point, width: number, scale: number, visible?: BoundingBox): Point {
	if (!visible) return point;
	const margin = ROTATION_VIEW_MARGIN_PX * scale;
	return { x: Math.max(visible.min.x + width / 2 * scale + margin, Math.min(visible.max.x - width / 2 * scale - margin, point.x)),
		y: Math.max(visible.min.y + ROTATION_CONTROL_TOP_PX * scale + margin, Math.min(visible.max.y - ROTATION_CONTROL_BOTTOM_PX * scale - margin, point.y)) };
}

export interface RotationControlShape {
	readonly id: string;
	readonly kind: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
	readonly wall?: { readonly id: string; readonly bulge?: number };
	readonly stair?: StairOptions;
}
const EDGE_POSITIONS = [1, 2].flatMap(multiplier => [[0.25, 1], [0.75, 1], [0.5, 1], [0.25, -1], [0.75, -1], [0.5, -1]].map(([fraction, side]) => [fraction, side, multiplier]));
function edgePoints(shape: RotationControlShape): readonly Point[] {
	if (shape.kind === 'stair') return spatialElementFootprint(shape);
	if (shape.kind !== 'group') return shape.points;
	const bounds = boundingBoxOf(shape); if (!bounds.ok) return [];
	const { min, max } = bounds.value;
	return [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }];
}
function edgesOf(shape: RotationControlShape) {
	const points = edgePoints(shape), closed = ['room', 'area', 'object', 'group', 'stair'].includes(shape.kind);
	const winding = points.reduce((sum, a, index) => { const b = points[(index + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0);
	return points.slice(0, closed ? points.length : -1).map((a, index) => {
		const b = points[(index + 1) % points.length], bulge = shape.kind === 'group' ? 0 : shape.wall?.bulge ?? shape.bulges?.[index] ?? 0, curve = { start: a, end: b, bulge }, length = arcLength(curve), sign = winding < 0 ? -1 : 1;
		return { curve, index, length, sign };
	}).filter(edge => Number.isFinite(edge.length) && edge.length > 0).toSorted((a, b) => b.length - a.length);
}
/** One edge affordance per item, on the first unobstructed rectangle hit testing also uses. */
export function layoutRotationControl(shape: RotationControlShape, pivot: Point, scale: number, visible?: BoundingBox, obstacles: readonly BoundingBox[] = []): RotationControlGeometry | null {
	const hostWall = shape.wall !== undefined && shape.id !== shape.wall.id;
	const widthPx = ROTATION_CONTROL_WIDTH_PX;
	const margin = ROTATION_VIEW_MARGIN_PX * scale;
	if (visible && (visible.max.x - visible.min.x < widthPx * scale + 2 * margin || visible.max.y - visible.min.y < (ROTATION_CONTROL_TOP_PX + ROTATION_CONTROL_BOTTOM_PX) * scale + 2 * margin)) return null;
	const offset = ROTATION_HANDLE_OFFSET_PX * scale, gap = ROTATION_HANDLE_CLEARANCE_PX * scale;
	const vertices = shape.points.map(point => pointBox(point, VERTEX_GRAB_RADIUS_PX * scale));
	const excluded = [...obstacles, ...vertices, pointBox(pivot, ROTATION_PIVOT_DEADZONE_PX * scale)];
	for (const edge of edgesOf(shape)) {
		for (const [fraction, side, multiplier] of EDGE_POSITIONS) {
			const anchor = arcPoint(edge.curve, fraction), tangent = arcTangent(edge.curve, fraction);
			const handle = clampControl({ x: anchor.x + edge.sign * tangent.y * offset * side * multiplier, y: anchor.y - edge.sign * tangent.x * offset * side * multiplier }, widthPx, scale, visible), bounds = rotationControlBounds(handle, widthPx, scale);
			if (distance(handle, anchor) > 2 * offset || excluded.some(box => overlaps(bounds, box, gap))) continue;
			return { handle, anchor, edge: [edge.curve.start, edge.curve.end], bounds, pivot, widthPx, hostWall, edgeIndex: edge.index };
		}
	}
	return null;
}
