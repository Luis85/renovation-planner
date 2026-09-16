import { firstNonFinitePoint, type Point } from './Point';
import type { GeometryError } from '../errors/AppError';
import { err, ok, type Result } from '../result/Result';
import { validateBulgeEdge } from './CurvedPolygon';
import { arcPolyline } from './curvePolyline';

declare const OPEN_PATH: unique symbol;

/**
 * An OPEN curved polyline as a caller proposes it: two or more points, each consecutive pair one
 * edge, and no implicit closure. `bulges[i]` describes the edge `i → i+1`, so there is exactly one
 * bulge per SEGMENT — one fewer than the points, where `CurvedPolygon` has one per point because
 * its wrap edge is real (AD04 §2).
 *
 * It is a separate type rather than a flag on `CurvedPolygon` because all three of that type's
 * defining rules are wrong here: three points minimum, the last→first edge, and a bulge array the
 * length of the point list. A path also has no interior, so it has no area rule and no
 * simple-boundary rule — it may legitimately cross itself.
 *
 * UNVALIDATED, exactly as `Polygon` is and for the same reason: a tool holds a not-yet-valid point
 * buffer mid-gesture. Validity lives in `createCurvedPath` alone.
 */
export interface CurvedPathInput {
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
}

/**
 * A validated open path.
 *
 * **The brand is the whole safety property of this type.** A path's fields are structurally
 * identical to a `CurvedPolygon`'s, so without it TypeScript would hand an open path to any
 * routine that closes a ring, measures its area or fills it — silently drawing a wrong picture,
 * which is what AD04's criterion 7 refuses. With it, `CurvedPath` is not assignable to
 * `CurvedPolygon` and the reverse is not either, while `.points` and `.bulges` stay readable on a
 * union of the two: a consumer that wants VERTICES needs no narrowing, and a consumer that wants
 * an interior cannot get one by accident.
 *
 * The symbol is declared and never exported, so the only way to hold one of these is to have gone
 * through `createCurvedPath` — the access lock `presentation/errors/errorSurfacePolicy.ts`'s
 * `Routed` uses, for the same reason: a hand-built value would carry no validation.
 */
export interface CurvedPath extends CurvedPathInput {
	readonly [OPEN_PATH]: true;
}

/** Does anything here have length? Asked of the whole path, never per segment. */
function hasLength(points: readonly Point[]): boolean {
	return points.some((point) => point.x !== points[0].x || point.y !== points[0].y);
}

const pathHasCurves = (path: CurvedPathInput): boolean => path.bulges?.some((value) => value !== 0) ?? false;

/** Two ends, finite coordinates, and some length overall — a path's point rules, split out for the budget. */
function validatePathPoints(points: readonly Point[]): Result<void, GeometryError> {
	if (points.length < 2) {
		return err({ category: 'Geometry', code: 'path-too-few-points', message: `A path needs at least 2 points; got ${points.length}.` });
	}
	const broken = firstNonFinitePoint(points);
	if (broken !== null) {
		return err({ category: 'Geometry', code: 'path-non-finite-coordinate', message: `A path point must have finite coordinates; got (${broken.x}, ${broken.y}).` });
	}
	return hasLength(points)
		? ok(undefined)
		: err({ category: 'Geometry', code: 'path-degenerate', message: 'A path must have some length.' });
}

/** One bulge per SEGMENT, each obeying the arc rules `CurvedPolygon` states for a closed edge. */
function validatePathBulges(points: readonly Point[], bulges: readonly number[]): Result<void, GeometryError> {
	if (bulges.length !== points.length - 1) {
		return err({ category: 'Geometry', code: 'curve-edge-count', message: 'An open path needs one curve value per segment.' });
	}
	for (let index = 0; index < bulges.length; index++) {
		const edge = validateBulgeEdge(points[index], points[index + 1], bulges[index]);
		if (!edge.ok) return edge;
	}
	return ok(undefined);
}

/**
 * The ONE validator for an open path. Its refusals are the open analogues of a polygon's, and the
 * arc rules are the SAME rules: `validateBulgeEdge` is shared with `CurvedPolygon` rather than
 * copied, because two spellings of "a curved edge supports at most a semicircle" is the clone
 * family `npm run analyze` reports and the pair that drifts.
 *
 * `path-degenerate` is where a polygon asks for area: a path is refused for having no LENGTH. It
 * is asked of the whole path and not of each segment, so a doubled vertex — which a trace produces
 * routinely — is kept rather than refused.
 */
export function createCurvedPath(path: CurvedPathInput): Result<CurvedPath, GeometryError> {
	const { points, bulges } = path;
	const shape = validatePathPoints(points);
	if (!shape.ok) return shape;
	if (bulges !== undefined) {
		const curves = validatePathBulges(points, bulges);
		if (!curves.ok) return curves;
	}
	// Copied at both levels, `createPolygon`'s rule: a caller keeping its mid-gesture buffer must
	// not be able to write through a validated path. The assertion is where the brand is minted —
	// the one place in this module that may claim it, which is what makes the lock mean anything.
	return ok({
		points: points.map((point) => ({ x: point.x, y: point.y })),
		...(bulges !== undefined && pathHasCurves(path) ? { bulges: [...bulges] } : {}),
	} as unknown as CurvedPath);
}

/**
 * The drawable approximation of an open path — `polygonPolyline`'s counterpart, differing in the
 * one place that matters: it EMITS THE LAST POINT. A ring may drop each segment's end because the
 * next segment starts there and the last closes onto the first; a path's final point is followed
 * by nothing, and dropping it would shorten every open graphic by its last vertex.
 *
 * Display only, like every polyline here. Measurement and persistence keep the analytic arcs.
 */
export function pathPolyline(path: CurvedPathInput, tolerance = 1): readonly Point[] {
	if (!pathHasCurves(path)) return path.points;
	const segments = path.points.slice(0, -1).flatMap((start, index) => arcPolyline({ start, end: path.points[index + 1], bulge: path.bulges?.[index] ?? 0 }, tolerance).slice(0, -1));
	return [...segments, path.points[path.points.length - 1]];
}
