import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { boundingBoxOf, distance } from '../../../core/geometry/operations';
import { arcLength, arcPoint, arcTangent } from '../../../core/geometry/circularArc';
import { ROTATION_CONTROL_WIDTH_PX, ROTATION_CONTROL_TOP_PX, ROTATION_CONTROL_BOTTOM_PX, ROTATION_HANDLE_OFFSET_PX, ROTATION_VIEW_MARGIN_PX, ROTATION_HANDLE_CLEARANCE_PX, ROTATION_PIVOT_DEADZONE_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';

export interface RotationControlGeometry {
	readonly handle: Point;
	readonly anchor: Point;
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
/** Hover may cross the short gap from the edge to an arrow; this never expands its click target. */
export function rotationControlApproachContains(control: RotationControlGeometry, point: Point, scale: number): boolean {
	const margin = VERTEX_GRAB_RADIUS_PX * scale;
	return rotationControlContains({ min: { x: Math.min(control.anchor.x, control.bounds.min.x) - margin, y: Math.min(control.anchor.y, control.bounds.min.y) - margin },
		max: { x: Math.max(control.anchor.x, control.bounds.max.x) + margin, y: Math.max(control.anchor.y, control.bounds.max.y) + margin } }, point);
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

type Shape = { id: string; kind: string; points: readonly Point[]; bulges?: readonly number[]; wall?: { id: string; bulge?: number } };
const EDGE_POSITIONS = [1, 2].flatMap(multiplier => [[0.25, 1], [0.75, 1], [0.5, 1], [0.25, -1], [0.75, -1], [0.5, -1]].map(([fraction, side]) => [fraction, side, multiplier]));
function edgePoints(shape: Shape): readonly Point[] {
	if (shape.kind !== 'group') return shape.points;
	const bounds = boundingBoxOf(shape); if (!bounds.ok) return [];
	const { min, max } = bounds.value;
	return [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }];
}
function edgesOf(shape: Shape) {
	const points = edgePoints(shape), closed = ['room', 'area', 'object', 'group'].includes(shape.kind);
	const winding = points.reduce((sum, a, index) => { const b = points[(index + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0);
	return points.slice(0, closed ? points.length : -1).map((a, index) => {
		const b = points[(index + 1) % points.length], bulge = shape.kind === 'group' ? 0 : shape.wall?.bulge ?? shape.bulges?.[index] ?? 0, curve = { start: a, end: b, bulge }, length = arcLength(curve), sign = winding < 0 ? -1 : 1;
		return { curve, index, length, sign };
	}).filter(edge => Number.isFinite(edge.length) && edge.length > 0).toSorted((a, b) => b.length - a.length);
}
/** Bounded edge affordances share the exact unobstructed rectangles used by hit testing. */
export function layoutRotationControls(shape: Shape, pivot: Point, scale: number, visible?: BoundingBox, obstacles: readonly BoundingBox[] = []): readonly RotationControlGeometry[] {
	const hostWall = shape.wall !== undefined && shape.id !== shape.wall.id;
	const widthPx = ROTATION_CONTROL_WIDTH_PX;
	const margin = ROTATION_VIEW_MARGIN_PX * scale;
	if (visible && (visible.max.x - visible.min.x < widthPx * scale + 2 * margin || visible.max.y - visible.min.y < (ROTATION_CONTROL_TOP_PX + ROTATION_CONTROL_BOTTOM_PX) * scale + 2 * margin)) return [];
	const offset = ROTATION_HANDLE_OFFSET_PX * scale, gap = ROTATION_HANDLE_CLEARANCE_PX * scale;
	const vertices = shape.points.map(point => pointBox(point, VERTEX_GRAB_RADIUS_PX * scale));
	const excluded = [...obstacles, ...vertices, pointBox(pivot, ROTATION_PIVOT_DEADZONE_PX * scale)];
	const controls: RotationControlGeometry[] = [];
	for (const edge of edgesOf(shape)) {
		for (const [fraction, side, multiplier] of EDGE_POSITIONS) {
			const anchor = arcPoint(edge.curve, fraction), tangent = arcTangent(edge.curve, fraction);
			const handle = clampControl({ x: anchor.x + edge.sign * tangent.y * offset * side * multiplier, y: anchor.y - edge.sign * tangent.x * offset * side * multiplier }, widthPx, scale, visible), bounds = rotationControlBounds(handle, widthPx, scale);
			if (distance(handle, anchor) > 2 * offset || excluded.some(box => overlaps(bounds, box, gap))) continue;
			controls.push({ handle, anchor, bounds, pivot, widthPx, hostWall, edgeIndex: edge.index }); excluded.push(bounds); break;
		}
		if (controls.length === 4) break;
	}
	return controls;
}
export function layoutRotationControl(shape: Shape, pivot: Point, scale: number, visible?: BoundingBox, obstacles: readonly BoundingBox[] = []): RotationControlGeometry | null {
	return layoutRotationControls(shape, pivot, scale, visible, obstacles)[0] ?? null;
}
