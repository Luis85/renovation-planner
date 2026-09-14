import type { Point } from '../../core/geometry/Point';
import { arcPoint, arcRadius, arcTangent } from '../../core/geometry/circularArc';
import { arcPolyline } from '../../core/geometry/curvePolyline';
import type { Wall, WallSide } from './Structure';
import { wallSideExtents, wallSideNormal } from './wallSides';

/** The actual face, perpendicular to the directed line/arc. Other-side and centre-line data are not used. */
export function wallFacePoint(wall: Wall, side: WallSide, fraction: number): Point {
	const edge = { ...wall, bulge: wall.bulge ?? 0 }, point = arcPoint(edge, fraction);
	const normal = wallSideNormal(arcTangent(edge, fraction), side), extent = wallSideExtents(wall)[side];
	return { x: point.x + normal.x * extent, y: point.y + normal.y * extent };
}

export function wallFacePoints(wall: Wall, side: WallSide, tolerance = 1): readonly Point[] {
	return arcPolyline({ start: wallFacePoint(wall, side, 0), end: wallFacePoint(wall, side, 1), bulge: wall.bulge ?? 0 }, tolerance);
}

/** A positive-winding body polygon; outlines are a separate, screen-size paint pass. */
export function wallFacePolygon(wall: Wall, tolerance = 1): readonly Point[] {
	return [...wallFacePoints(wall, 'a', tolerance), ...wallFacePoints(wall, 'b', tolerance).toReversed()];
}

/** A circular inside face cannot fold through its centre. Legacy centred paint is retained separately. */
export function validWallFaceCurve(wall: Wall): boolean {
	const bulge = wall.bulge ?? 0, radius = arcRadius({ ...wall, bulge });
	return radius === null || wallSideExtents(wall)[bulge > 0 ? 'b' : 'a'] < radius;
}
