import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { centroid, coincident, distance, extentOf, rotate } from '../../../core/geometry/operations';
import type { SpatialElementKind } from '../../../domain/spatial/SpatialElement';
import type { Wall } from '../../../domain/spatial/Structure';
import { ROTATION_HANDLE_OFFSET_PX, ROTATION_VIEW_MARGIN_PX, ROTATION_VIEW_TOP_MARGIN_PX } from '../handleMetrics';

export interface RotationShape {
	readonly id: string;
	readonly generation?: number;
	readonly kind: 'room' | 'area' | SpatialElementKind | 'wall';
	readonly points: readonly Point[];
	/** A hosted-opening selection rotates this captured host, without changing selection identity. */
	readonly wall?: Wall;
}
export interface NamedRotationShape extends RotationShape { readonly name: string }
function polygon(shape: RotationShape): boolean { return shape.kind === 'object' || shape.kind === 'room' || shape.kind === 'area'; }
export function rotationPivot(shape: RotationShape): Point | null {
	if (!shape.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 1e9 && Math.abs(point.y) <= 1e9)) return null;
	if (polygon(shape)) { const result = centroid({ points: shape.points }); return result.ok ? result.value : null; }
	if (shape.points.length < 2 || ((shape.kind === 'measurement' || shape.kind === 'wall') && shape.points.length !== 2)) return null;
	let length = 0, x = 0, y = 0;
	for (let index = 1; index < shape.points.length; index++) {
		const a = shape.points[index - 1], b = shape.points[index], weight = distance(a, b);
		if (weight === 0) return null;
		length += weight; x += (a.x / 2 + b.x / 2) * weight; y += (a.y / 2 + b.y / 2) * weight;
	}
	return { x: x / length, y: y / length };
}
/** Every preview rotates the original points; zero/complete revolutions keep their exact coordinates. */
export function rotationPoints(shape: RotationShape, degrees: number, pivot: Point): readonly Point[] | null {
	if (!Number.isFinite(degrees)) return null;
	const angle = degrees % 360;
	if (angle === 0) return shape.points;
	const points = rotate({ points: shape.points }, angle * Math.PI / 180, pivot).points;
	return rotationPivot({ ...shape, points }) ? points : null;
}
export function rotationChanged(original: readonly Point[], points: readonly Point[]): boolean {
	return points.some((point, index) => !coincident(point, original[index]));
}
export function parseRotationDegrees(text: string): number | null {
	if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text.trim())) return null;
	const value = Number(text.trim().replace(',', '.'));
	return Number.isFinite(value) ? value : null;
}
/** Shared diagonal placement/clamping. Both paint and hit testing consume the same world point. */
export function rotationHandle(shape: RotationShape, worldPerPixel: number, visible?: BoundingBox): Point | null {
	if (!rotationPivot(shape)) return null;
	const bounds = extentOf(shape.points), x = bounds.maxX + ROTATION_HANDLE_OFFSET_PX * worldPerPixel, y = bounds.minY - ROTATION_HANDLE_OFFSET_PX * worldPerPixel;
	if (!visible) return { x, y };
	const margin = ROTATION_VIEW_MARGIN_PX * worldPerPixel;
	return { x: Math.max(visible.min.x + margin, Math.min(visible.max.x - margin, x)), y: Math.max(visible.min.y + ROTATION_VIEW_TOP_MARGIN_PX * worldPerPixel, Math.min(visible.max.y - margin, y)) };
}
/** Relative heading of a rigid two-endpoint shape; wall commands retain their reviewed impact boundary. */
export function rotationDegreesBetween(original: readonly Point[], points: readonly Point[]): number {
	const before = Math.atan2(original[1].y - original[0].y, original[1].x - original[0].x), after = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
	return Math.atan2(Math.sin(after - before), Math.cos(after - before)) * 180 / Math.PI;
}
