import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { extentOf } from '../../../core/geometry/operations';
import { ROTATION_CONTROL_WIDTH_PX, ROTATION_HOST_CONTROL_WIDTH_PX, ROTATION_CONTROL_TOP_PX, ROTATION_CONTROL_BOTTOM_PX, ROTATION_HANDLE_OFFSET_PX, ROTATION_VIEW_MARGIN_PX, ROTATION_HANDLE_CLEARANCE_PX, ROTATION_PIVOT_DEADZONE_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';

export interface RotationControlGeometry {
	readonly handle: Point;
	readonly anchor: Point;
	readonly pivot: Point;
	readonly bounds: BoundingBox;
	readonly widthPx: number;
	readonly hostWall: boolean;
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

/** One rectangular target for paint, hover and release; no corner suggests the rotation pivot. */
export function layoutRotationControl(shape: { id: string; kind: string; points: readonly Point[]; wall?: { id: string } }, pivot: Point, scale: number, visible?: BoundingBox, obstacles: readonly BoundingBox[] = []): RotationControlGeometry | null {
	const hostWall = shape.wall !== undefined && shape.id !== shape.wall.id;
	const widthPx = hostWall ? ROTATION_HOST_CONTROL_WIDTH_PX : ROTATION_CONTROL_WIDTH_PX;
	const margin = ROTATION_VIEW_MARGIN_PX * scale;
	if (visible && (visible.max.x - visible.min.x < widthPx * scale + 2 * margin || visible.max.y - visible.min.y < (ROTATION_CONTROL_TOP_PX + ROTATION_CONTROL_BOTTOM_PX) * scale + 2 * margin)) return null;
	const { minX, maxX, minY, maxY } = extentOf(shape.points), midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
	const offset = ROTATION_HANDLE_OFFSET_PX * scale, gap = ROTATION_HANDLE_CLEARANCE_PX * scale;
	const vertices = ['room', 'area', 'wall'].includes(shape.kind) ? shape.points.map(point => pointBox(point, VERTEX_GRAB_RADIUS_PX * scale)) : [];
	const excluded = [...obstacles, ...vertices, pointBox(pivot, ROTATION_PIVOT_DEADZONE_PX * scale)];
	const candidates = [
		{ anchor: { x: midX, y: minY }, handle: { x: midX, y: minY - offset } },
		{ anchor: { x: midX, y: minY }, handle: { x: midX, y: minY - 2 * offset } },
		{ anchor: { x: maxX, y: midY }, handle: { x: maxX + offset, y: midY } },
		{ anchor: { x: minX, y: midY }, handle: { x: minX - offset, y: midY } },
		{ anchor: { x: midX, y: maxY }, handle: { x: midX, y: maxY + offset } },
	];
	for (const candidate of candidates) {
		const handle = clampControl(candidate.handle, widthPx, scale, visible), bounds = rotationControlBounds(handle, widthPx, scale);
		if (excluded.every(box => !overlaps(bounds, box, gap))) return { ...candidate, handle, bounds, pivot, widthPx, hostWall };
	}
	// Dense edge selections can block a midpoint; move along the chosen side, retaining its anchor.
	for (const candidate of candidates) for (const [dx, dy] of [[-offset, 0], [offset, 0], [0, -offset], [0, offset]]) {
		const handle = clampControl({ x: candidate.handle.x + dx, y: candidate.handle.y + dy }, widthPx, scale, visible), bounds = rotationControlBounds(handle, widthPx, scale);
		if (excluded.every(box => !overlaps(bounds, box, gap))) return { ...candidate, handle, bounds, pivot, widthPx, hostWall };
	}
	return null;
}
