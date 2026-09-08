import type { Point } from '../../../core/geometry/Point';
import { centroid, coincident, extentOf, rotate } from '../../../core/geometry/operations';
import { validSpatialElement, type SpatialElement } from '../../../domain/spatial/SpatialElement';

export function rotationPivot(element: SpatialElement): Point | null {
	if (element.kind !== 'object' || !validSpatialElement(element)) return null;
	const result = centroid({ points: element.points });
	return result.ok ? result.value : null;
}
/** Signed relative degrees; zero and complete revolutions retain the exact original points. */
export function rotationPoints(element: SpatialElement, degrees: number, pivot: Point): readonly Point[] | null {
	if (element.kind !== 'object' || !Number.isFinite(degrees)) return null;
	const angle = degrees % 360;
	if (angle === 0) return element.points;
	const points = rotate({ points: element.points }, angle * Math.PI / 180, pivot).points;
	return validSpatialElement({ ...element, points }) ? points : null;
}
export function rotationChanged(original: readonly Point[], points: readonly Point[]): boolean {
	return points.some((point, index) => !coincident(point, original[index]));
}
export function parseRotationDegrees(text: string): number | null {
	if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text.trim())) return null;
	const value = Number(text.trim().replace(',', '.'));
	return Number.isFinite(value) ? value : null;
}
/** Screen-sized offset shared by paint and hover/click targeting. */
export function rotationHandle(element: SpatialElement, worldPerPixel: number): Point | null {
	const pivot = rotationPivot(element);
	return pivot ? { x: pivot.x, y: extentOf(element.points).minY - 28 * worldPerPixel } : null;
}
