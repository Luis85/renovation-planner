import type { Point } from './Point';
import type { CurvedPolygon } from './CurvedPolygon';
import { arcProjection } from './circularArc';
import { distance } from './operations';

/**
 * Where a point added at `at` lands: projected onto the nearest edge of a closed ring or an open
 * chain, with the fraction of that edge's arc it cuts at. `null` when it lands within `tolerance`
 * of a point already there, where a second one would only duplicate it.
 */
function nearestCut(points: readonly Point[], bulges: readonly number[] | undefined, closed: boolean, at: Point, tolerance: number) {
	const edges = points.slice(0, closed ? points.length : points.length - 1).map((start, index) => {
		const edge = { start, end: points[(index + 1) % points.length], bulge: bulges?.[index] ?? 0 };
		return { index, edge, ...arcProjection(edge, at) };
	});
	const cut = edges.reduce((best, hit) => hit.distance < best.distance ? hit : best);
	return distance(cut.point, cut.edge.start) <= tolerance || distance(cut.point, cut.edge.end) <= tolerance ? null : cut;
}

/** A bulge is tan(sweep / 4), and a cut at a fraction of the arc's length is the same fraction of its sweep. */
const bend = (bulge: number, part: number): number => Math.tan(Math.atan(bulge) * part);

/** `geometry` with a point added on its nearest edge, a curved edge becoming two arcs of the same circle. */
export function insertRingPoint(geometry: CurvedPolygon, at: Point, tolerance: number): CurvedPolygon | null {
	const cut = nearestCut(geometry.points, geometry.bulges, true, at, tolerance);
	if (!cut) return null;
	const points = [...geometry.points];
	points.splice(cut.index + 1, 0, cut.point);
	if (!geometry.bulges) return { points };
	const bulges = [...geometry.bulges];
	bulges.splice(cut.index, 1, bend(cut.edge.bulge, cut.fraction), bend(cut.edge.bulge, 1 - cut.fraction));
	return { points, bulges };
}

/** An open chain of points with one added on its nearest segment. */
export function insertPathPoint(points: readonly Point[], at: Point, tolerance: number): Point[] | null {
	const cut = nearestCut(points, undefined, false, at, tolerance);
	if (!cut) return null;
	const next = [...points];
	next.splice(cut.index + 1, 0, cut.point);
	return next;
}
