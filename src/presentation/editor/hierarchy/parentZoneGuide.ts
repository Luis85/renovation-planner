import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { Point } from '../../../core/geometry/Point';
import type { ParentZoneOutlineDto } from '../../read-models/planHierarchy';

/**
 * The parent zone moved so its bounding box's top-left corner is world origin (ADR-0028). A new
 * reference image's crop corner is pinned at world origin with no free offset (ADR-0019), so
 * cropping a drawing at the matching corner lines the two up. Bulges are translation-invariant.
 *
 * ponytail: vertex bounds, not curve bounds — a bulging first edge can sit a little above or left
 * of origin. Use `boundsOfZones` if a curved parent zone is ever reported misaligned.
 */
export function guideOutline(zone: ParentZoneOutlineDto): ParentZoneOutlineDto {
	if (zone.points.length === 0) return zone;
	const minX = Math.min(...zone.points.map((point) => point.x));
	const minY = Math.min(...zone.points.map((point) => point.y));
	return { ...zone, points: zone.points.map((point) => ({ x: point.x - minX, y: point.y - minY })) };
}

/**
 * The guide as points a frame can bound: its polyline at 1 mm, curves included, so Fit and the
 * first-open fit frame what is drawn rather than only its vertices. Empty without a parent zone,
 * which `boundsOfZones` skips.
 */
export function guideFramePoints(zone: ParentZoneOutlineDto | null): readonly Point[] {
	return zone === null ? [] : polygonPolyline(guideOutline(zone));
}
