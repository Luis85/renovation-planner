import type { GeometryError } from '../errors/AppError';
import { validatePolygonPoints } from './Polygon';
import { err, ok, type Result } from '../result/Result';
import type { BoundingBox } from './BoundingBox';
import type { LineSegment } from './LineSegment';
import type { Point } from './Point';
import type { Polygon } from './Polygon';
import type { Polyline } from './Polyline';
import type { Transform } from './Transform';
import type { Vector } from './Vector';

/**
 * Pure functions over the geometry value objects (§22). No operation mutates its input;
 * operations that are mathematically undefined for some input return
 * `Result<_, GeometryError>` rather than throwing or silently answering `0`/`NaN` — the
 * editor can legitimately produce those inputs mid-gesture, and a made-up number is a
 * believable, silent bug.
 *
 * The flip side of that split, equally deliberate: the ALWAYS-defined operations
 * (`distance`, `length`, `translate`, `rotate`, `scale`, `applyTransform`) validate
 * nothing and will happily propagate NaN from garbage input — visible in the number, not
 * disguised as a verdict. Only a Result-wrapping operation may answer "undefined".
 */

export type Shape = Point | LineSegment | Polyline | Polygon | BoundingBox;

type PointMapper = (point: Point) => Point;

const ORIGIN: Point = { x: 0, y: 0 };

function mapPoints<T extends Shape>(shape: T, map: PointMapper): T {
	if ('start' in shape && 'end' in shape) {
		return { ...shape, start: map(shape.start), end: map(shape.end) };
	}
	if ('min' in shape && 'max' in shape) {
		return { ...shape, min: map(shape.min), max: map(shape.max) };
	}
	if ('points' in shape) {
		return { ...shape, points: shape.points.map(map) };
	}
	return map(shape) as T;
}

function isSegment(shape: LineSegment | Polyline): shape is LineSegment {
	return 'start' in shape && 'end' in shape;
}

function geometryErr(code: string, message: string): Result<never, GeometryError> {
	return err({ category: 'Geometry', code, message });
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * How close two world coordinates must be to be the same point. A nanometre, in the
 * millimetres every length here is stated in (ADR-009).
 *
 * Chosen to sit in the gap between two scales that are twenty orders of magnitude apart, so
 * it can only ever catch a representation error:
 *
 * - Above the dust. Floating-point residue out of a projection or a rotation lands around
 *   1e-14 mm; this is eight orders of magnitude larger.
 * - Below anything real. A pointer at this editor's tightest zoom expresses about 0.05 mm per
 *   screen pixel, and a renovation is not measured past the millimetre, so no two points a
 *   user MEANT to be distinct can ever land this close.
 */
export const COINCIDENT_TOLERANCE_MM = 1e-6;

/**
 * Whether two points are the same point — geometrically, not bitwise.
 *
 * Exists because exact equality is the wrong test for a coordinate that has been through
 * arithmetic, and every "is this a repeated vertex" guard was written as `===` before this
 * did. Trigonometry is where it bites: constraining a click back onto an existing vertex
 * along a 45 degree ray answers `(0, -1.42e-14)` for a point that is exactly `(0, 0)`, since
 * `Math.cos` and `Math.sin` of a quarter-pi differ in their last bit and no exact value
 * exists to restore. A guard that misses that lets a zero-length edge into a polygon, which
 * area, centroid and hit-testing all divide through.
 */
export function coincident(a: Point, b: Point): boolean {
	return distance(a, b) <= COINCIDENT_TOLERANCE_MM;
}

function chainLength(points: readonly Point[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distance(points[i - 1], points[i]);
	}
	return total;
}

/**
 * Signed twice-area times nothing — this is the raw shoelace sum Σ(x_i·y_{i+1} −
 * x_{i+1}·y_i), whose half IS the signed area. Internal only; `area` exports its
 * unsigned magnitude.
 */
function signedAreaSum(points: readonly Point[]): number {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		sum += a.x * b.y - b.x * a.y;
	}
	return sum;
}

/**
 * Finiteness guard for the non-polygon inputs of the Result-wrapping operations: segment
 * endpoints and probe points. Needed because comparison-based guards do NOT catch NaN —
 * `NaN < 0` is `false`, so a NaN coordinate once sailed past intersect's range check and
 * came back as a confident `ok` answer carrying NaN.
 */
function requireFinite(points: readonly Point[]): Result<void, GeometryError> {
	for (const point of points) {
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
			return geometryErr(
				'non-finite-coordinate',
				`Coordinates must be finite; got (${point.x}, ${point.y}).`,
			);
		}
	}
	return ok(undefined);
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function isZeroLength(s: LineSegment): boolean {
	return s.start.x === s.end.x && s.start.y === s.end.y;
}

export function length(shape: LineSegment | Polyline): number {
	return isSegment(shape) ? distance(shape.start, shape.end) : chainLength(shape.points);
}

/** Unsigned magnitude (shoelace formula). Winding order is deliberately invisible here. */
export function area(polygon: Polygon): Result<number, GeometryError> {
	const checked = validatePolygonPoints(polygon.points);
	if (!checked.ok) {
		return checked;
	}
	return ok(Math.abs(signedAreaSum(polygon.points)) / 2);
}

export function perimeter(polygon: Polygon): Result<number, GeometryError> {
	const checked = validatePolygonPoints(polygon.points);
	if (!checked.ok) {
		return checked;
	}
	let total = 0;
	for (let i = 0; i < polygon.points.length; i++) {
		total += distance(
			polygon.points[i],
			polygon.points[(i + 1) % polygon.points.length],
		);
	}
	return ok(total);
}

/**
 * The area-weighted centroid — NOT the arithmetic mean of the vertices, which differs for
 * any non-regular polygon. Undefined for a zero-area (collinear) vertex set, where the
 * weighting divides by nothing.
 */
export function centroid(polygon: Polygon): Result<Point, GeometryError> {
	const checked = validatePolygonPoints(polygon.points);
	if (!checked.ok) {
		return checked;
	}
	const cross = signedAreaSum(polygon.points);
	if (cross === 0) {
		return geometryErr('polygon-zero-area', 'Cannot weight a centroid by a zero area.');
	}
	let cx = 0;
	let cy = 0;
	const n = polygon.points.length;
	for (let i = 0; i < n; i++) {
		const a = polygon.points[i];
		const b = polygon.points[(i + 1) % n];
		const w = a.x * b.y - b.x * a.y;
		cx += (a.x + b.x) * w;
		cy += (a.y + b.y) * w;
	}
	return ok({ x: cx / (3 * cross), y: cy / (3 * cross) });
}

/** Undefined on an empty or non-finite point set — a min/max over nothing answers nothing. */
export function boundingBoxOf(shape: Polyline | Polygon): Result<BoundingBox, GeometryError> {
	if (shape.points.length === 0) {
		return geometryErr('points-empty', 'A bounding box needs at least one point.');
	}
	const finite = requireFinite(shape.points);
	if (!finite.ok) {
		return finite;
	}
	let minX = shape.points[0].x;
	let minY = shape.points[0].y;
	let maxX = minX;
	let maxY = minY;
	for (const p of shape.points) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	return ok({ min: { x: minX, y: minY }, max: { x: maxX, y: maxY } });
}

/**
 * Ray-casting point-in-polygon over a validated vertex set and a validated probe. A point
 * exactly on an edge is boundary territory: ray casting answers it arbitrarily, and this
 * function does not pretend otherwise — callers needing edge-exact semantics decide them
 * at a boundary that owns snapping (slice 6).
 */
export function contains(polygon: Polygon, point: Point): Result<boolean, GeometryError> {
	const checked = validatePolygonPoints(polygon.points);
	if (!checked.ok) {
		return checked;
	}
	const probe = requireFinite([point]);
	if (!probe.ok) {
		return probe;
	}
	let inside = false;
	const n = polygon.points.length;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const a = polygon.points[i];
		const b = polygon.points[j];
		if (
			a.y > point.y !== b.y > point.y &&
			point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
		) {
			inside = !inside;
		}
	}
	return ok(inside);
}

/**
 * The point where two segments cross, or `null` when they do not share exactly one —
 * parallel or non-crossing. Parallelism is an EXACT `denominator === 0` comparison on
 * purpose: a near-parallel denominator does not slip through, it produces huge t/u that
 * the range check rejects to null anyway. Zero-length or non-finite input is a different
 * failure entirely and errors, because "where does a point cross something" is not a
 * weaker version of the question.
 */
export function intersect(
	a: LineSegment,
	b: LineSegment,
): Result<Point | null, GeometryError> {
	if (isZeroLength(a) || isZeroLength(b)) {
		return geometryErr('segment-zero-length', 'A zero-length segment intersects nothing.');
	}
	const finite = requireFinite([a.start, a.end, b.start, b.end]);
	if (!finite.ok) {
		return finite;
	}
	const rx = a.end.x - a.start.x;
	const ry = a.end.y - a.start.y;
	const sx = b.end.x - b.start.x;
	const sy = b.end.y - b.start.y;
	const denominator = rx * sy - ry * sx;
	if (denominator === 0) {
		return ok(null);
	}
	const t = ((b.start.x - a.start.x) * sy - (b.start.y - a.start.y) * sx) / denominator;
	const u = ((b.start.x - a.start.x) * ry - (b.start.y - a.start.y) * rx) / denominator;
	if (t < 0 || t > 1 || u < 0 || u > 1) {
		return ok(null);
	}
	return ok({ x: a.start.x + t * rx, y: a.start.y + t * ry });
}

/** The nearest point on a segment — clamped to the endpoints, never off the segment. */
export function project(point: Point, onto: LineSegment): Result<Point, GeometryError> {
	if (isZeroLength(onto)) {
		return geometryErr('segment-zero-length', 'Nothing to project onto.');
	}
	const finite = requireFinite([point, onto.start, onto.end]);
	if (!finite.ok) {
		return finite;
	}
	const vx = onto.end.x - onto.start.x;
	const vy = onto.end.y - onto.start.y;
	const t = clamp01(
		((point.x - onto.start.x) * vx + (point.y - onto.start.y) * vy) / (vx * vx + vy * vy),
	);
	return ok({ x: onto.start.x + t * vx, y: onto.start.y + t * vy });
}

export function translate<T extends Shape>(shape: T, by: Vector): T {
	return mapPoints(shape, (p) => ({ x: p.x + by.dx, y: p.y + by.dy }));
}

/** Rotation about `origin`, which is required — no implicit (0,0) default to forget. */
export function rotate<T extends Shape>(shape: T, radians: number, origin: Point): T {
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return mapPoints(shape, (p) => ({
		x: origin.x + (p.x - origin.x) * cos - (p.y - origin.y) * sin,
		y: origin.y + (p.x - origin.x) * sin + (p.y - origin.y) * cos,
	}));
}

/** Uniform scaling about `origin`, required for the same reason as `rotate`. */
export function scale<T extends Shape>(shape: T, factor: number, origin: Point): T {
	return mapPoints(shape, (p) => ({
		x: origin.x + (p.x - origin.x) * factor,
		y: origin.y + (p.y - origin.y) * factor,
	}));
}

/**
 * Composes scale, then rotate, then translate — all three about the world origin, since a
 * `Transform` carries no pivot. Callers wanting another pivot pre-translate, or compose
 * these functions themselves.
 */
export function applyTransform<T extends Shape>(shape: T, transform: Transform): T {
	const scaled = scale(shape, transform.scale, ORIGIN);
	const rotated = rotate(scaled, transform.rotationRadians, ORIGIN);
	return translate(rotated, transform.translation);
}
