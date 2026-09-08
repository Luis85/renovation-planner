import type { SpatialObjectCandidate } from '../tools/select-tool';
import { arcPolyline, polygonPolyline } from '../../../core/geometry/curvePolyline';

/** Paint follows the same canonical edge map as selection; original vertices remain handles. */
export function spatialOutlinePoints(shape: Pick<SpatialObjectCandidate, 'points' | 'bulges' | 'kind'>, tolerance: number) {
	if (shape.kind === undefined || shape.kind === 'object') return polygonPolyline(shape, tolerance);
	if (!shape.bulges?.some(value => value !== 0)) return shape.points;
	const edges = shape.points.slice(1).flatMap((end, index) => arcPolyline({ start: shape.points[index], end, bulge: shape.bulges?.[index] ?? 0 }, tolerance).slice(0, -1));
	return [...edges, ...shape.points.slice(-1)];
}
