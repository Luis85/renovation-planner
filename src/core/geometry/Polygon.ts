import { err, ok, type Result } from '../result/Result';
import type { GeometryError } from '../errors/AppError';
import type { Point } from './Point';

/**
 * A closed polygon whose last→first edge is implicit — never a repeated closing point.
 * Storing one would duplicate derived data that can drift from the vertices it is
 * supposed to equal (the §3.6 principle).
 *
 * The interface is deliberately UNVALIDATED: a 0- or 1-point polygon is representable at
 * the type level on purpose, because an editor tool legitimately holds a not-yet-valid
 * point buffer mid-gesture. Validity lives in exactly one place — `createPolygon` below —
 * so every caller that turns raw points into a `Polygon` gets the same answer.
 */
export interface Polygon {
	readonly points: readonly Point[];
}

/**
 * The ONE validator for a polygon vertex set: at least three vertices, finite coordinates
 * (no NaN/Infinity; one predicate). `createPolygon` and the polygon operations in
 * `operations.ts` both go through it, so the two rejection paths cannot drift — an input
 * the constructor rejects is an input every area/perimeter/centroid call rejects too,
 * with the identical error.
 */
export function validatePolygonPoints(
	points: readonly Point[],
): Result<void, GeometryError> {
	if (points.length < 3) {
		return err({
			category: 'Geometry',
			code: 'polygon-too-few-points',
			message: `A polygon needs at least 3 vertices; got ${points.length}.`,
		});
	}
	for (const point of points) {
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
			return err({
				category: 'Geometry',
				code: 'polygon-non-finite-coordinate',
				message:
					`A polygon vertex must have finite coordinates; ` +
					`got (${point.x}, ${point.y}).`,
			});
		}
	}
	return ok(undefined);
}

/**
 * The smart constructor enforcing SDD §26's required rules that are properties of a point
 * list — exactly what `validatePolygonPoints` states. §26's remaining bullets (valid
 * unit, valid transform) are properties of other boundaries — the editor (slice 8) and
 * persistence validation (slice 4); its "Future" rules (self-intersection, winding
 * normalization, repair) are deliberately not implemented or stubbed here.
 */
export function createPolygon(points: readonly Point[]): Result<Polygon, GeometryError> {
	const checked = validatePolygonPoints(points);
	if (!checked.ok) {
		return checked;
	}
	// Copied, not aliased: the caller keeps its (mutable) buffer mid-gesture, and a push
	// after construction must not be able to break the invariant just validated.
	return ok({ points: [...points] });
}
