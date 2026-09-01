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
 * Signed twice-area — the shoelace sum Σ(x_i·y_{i+1} − x_{i+1}·y_i), whose half IS the
 * signed area. Internal only; `area` exports its unsigned magnitude.
 *
 * **Accumulated RELATIVE TO THE FIRST VERTEX, and that is not a micro-optimisation.** The raw
 * form multiplies absolute coordinates, so a shape small relative to its offset produces terms
 * whose difference falls below a double's 15-16 significant digits and cancels to exactly zero:
 * a genuine 1×1 square at (1e8, 1e8) sums to `0` raw and to `2` translated. Measured, and all
 * three callers were wrong — `area` answered 0, `centroid` REFUSED the square as zero-area, and
 * `enclosesArea` refused the footprint.
 *
 * Sound because the signed area is translation-invariant: subtracting a constant point from
 * every vertex changes no correct answer, whatever point that is.
 *
 * **WHICH point is what decides whether the translation overflows, and the first vertex was the
 * wrong one.** It needs no search and is guaranteed to exist, which is why it was chosen — and
 * for a polygon spanning the double range it makes the differences as large as they can be:
 * `(-1e308, 0), (1e308, 1e-308), (1e308, 0)` has a raw sum of `-2` and an area of about 1, and
 * subtracting its first vertex gives `1e308 - (-1e308) === Infinity` and a sum of `NaN`. A
 * representable area refused as unrepresentable — the cancellation fix's own mirror image,
 * introduced by the fix and found by review rather than by any gate.
 *
 * `boundsMidpoint` minimises the largest difference instead, which is the property both ends
 * need: it is close to a far-flung cluster (the cancellation case) and central to a spanning
 * one (the overflow case). Measured across four polygons before it was taken: identical sums
 * for the far-from-origin square and the 3-4-5 triangle, `-2` for the spanning one where the
 * first vertex gives `NaN`, and still non-finite for a genuinely unrepresentable area, which is
 * what the callers' guards read.
 *
 * Its arithmetic is `min / 2 + max / 2` rather than `(min + max) / 2` because the sum of two
 * extremes is what can overflow — and **no input distinguishes the two spellings through this
 * module, which is why there is no test for it and why this sentence says so.** `min + max`
 * overflows only for a polygon out near 1e308, and doubles there are about 2e292 apart, so its
 * smallest possible extent already squares past the double range: every such polygon has a
 * non-representable area and is refused whichever spelling is used. The safer form is kept
 * because it costs nothing, not because anything here can catch its loss.
 */
function boundsMidpoint(points: readonly Point[]): Point {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const point of points) {
		if (point.x < minX) minX = point.x;
		if (point.x > maxX) maxX = point.x;
		if (point.y < minY) minY = point.y;
		if (point.y > maxY) maxY = point.y;
	}
	return { x: minX / 2 + maxX / 2, y: minY / 2 + maxY / 2 };
}

function signedAreaSum(points: readonly Point[]): number {
	const origin = boundsMidpoint(points);
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		sum += (a.x - origin.x) * (b.y - origin.y) - (b.x - origin.x) * (a.y - origin.y);
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

/**
 * Unsigned magnitude (shoelace formula). Winding order is deliberately invisible here.
 *
 * ZERO is a legitimate answer — a collinear vertex set is a legal polygon (SDD §26 files
 * degeneracy under "Future") and its area really is nothing. `Infinity` is not: every
 * coordinate can be finite while their PRODUCTS overflow, and this function's output is a
 * Requirement's quantity and therefore its cost, through `Zone.area()`. A measurement that
 * cannot be represented is refused rather than reported, which is the rule `dimensionsOf`
 * already keeps one axis over.
 */
export function area(polygon: Polygon): Result<number, GeometryError> {
	const checked = validatePolygonPoints(polygon.points);
	if (!checked.ok) {
		return checked;
	}
	const sum = signedAreaSum(polygon.points);
	if (!Number.isFinite(sum)) {
		return geometryErr(
			'polygon-area-overflow',
			'These vertices are finite but the area they enclose is not representable.',
		);
	}
	return ok(Math.abs(sum) / 2);
}

/**
 * Does this polygon enclose any area at all?
 *
 * TOTAL rather than a `Result`, and that is the whole point of it existing beside `area`
 * above. `area` validates its input, so a caller that already holds a validated `Polygon` —
 * anything downstream of `createPolygon` — would have to handle a refusal arm nothing can
 * reach, which is the dead guard `footprintFromDimensions`'s own docblock records this
 * repository paying for. One gate per question, both arms reachable: `createPolygon` owns
 * vertex count and finiteness, and this owns degeneracy.
 *
 * **Zero area is not the same question as a zero bounding-box EXTENT**, and the difference is
 * why this is not a `boundingBoxOf` check. Three points on a diagonal — (0,0), (10,10),
 * (20,20) — enclose nothing while their box is 20 by 20, so an extent test refuses the
 * axis-aligned collinear case and passes the diagonal one. Measured rather than reasoned,
 * because a partial fix here would read exactly like a complete one.
 *
 * **The halving is CARRIED, and the comment that dropped it was wrong.** It read "`Math.abs(sum)
 * / 2 > 0` and `Math.abs(sum) > 0` answer identically" — false for exactly one double, since
 * `Number.MIN_VALUE` is greater than zero and halves to zero. A polygon summing to it would
 * enclose an area by this predicate and none by `area`, and `validateAssetShape` would persist a
 * footprint `area()` reports as `0`.
 *
 * **No polygon found produces it**, which is said here rather than left implied: the reported
 * triangle sums to `MIN_VALUE` only under the FIRST-VERTEX origin this module used before the
 * overflow fix, and to exactly `0` under the midpoint it uses now, and a search over 4096
 * (width, height) pairs in denormal steps landed on it never. So this is not a fix for a
 * reachable case. It is that two functions answering one question should agree BY CONSTRUCTION
 * rather than by an argument about denormals — an argument this comment has already got wrong
 * once, which is the whole reason to stop making it.
 *
 * **A REPRESENTABLE area, which is two questions and not one.** The shoelace sum of finite
 * coordinates can overflow — (0,0), (1e308,0), (0,1e308) — and `Math.abs` of a non-finite sum
 * is greater than zero, so a bare magnitude test read that overflow as a real area and
 * `validateAssetShape` persisted the footprint. Both failures answer `false` here because both
 * mean the same thing to a caller asking whether there is an area to work with; the two are
 * kept DISTINGUISHABLE at `area` and `centroid`, which have a `Result` to say which happened
 * in.
 *
 * **`Number.isFinite` and not a test against `Infinity`**, because a finite coordinate set
 * really does produce `NaN`: the translated products of that triangle straddle zero and
 * infinity, and `Infinity - Infinity` is `NaN`. An earlier draft of this paragraph asserted the
 * opposite — that no finite coordinate set can — which was true of the untranslated sum and
 * false of the one below it, in a comment written beside the code that translates. A `> 0` test
 * lets `NaN` through by making it incomparable rather than by making it large, which is the
 * quieter of the two ways to pass.
 */
export function enclosesArea(polygon: Polygon): boolean {
	const sum = signedAreaSum(polygon.points);
	return Number.isFinite(sum) && Math.abs(sum) / 2 > 0;
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
	// The other end of the same range, and the one that used to answer rather than refuse:
	// dividing infinite accumulators by an infinite weight is `NaN`, handed back inside a
	// confident `ok`. A separate code from the zero case on purpose — "cannot weight by a
	// zero area" over a triangle with three corners would be a false account of the refusal.
	if (!Number.isFinite(cross)) {
		return geometryErr(
			'polygon-area-overflow',
			'Cannot weight a centroid by an area that is not representable.',
		);
	}
	// Accumulated relative to the bounding box's midpoint for the reason `signedAreaSum` gives,
	// and the SAME origin as the `cross` above so the weights and their divisor are terms of one
	// calculation. **Narrow claim, measured**: the signed area is translation-invariant, so two
	// origins would agree exactly in real arithmetic and differ only where one of them overflows
	// — and every such polygon is already refused by the guard below or by `cross`'s own. Nothing
	// in the suite tells the two apart, so this is written as the reason it is spelled this way
	// rather than as a behaviour something checks. And then
	// shifted back. A centroid is not translation-INVARIANT the way an area is, but it is
	// translation-EQUIVARIANT — centroid(P − o) + o = centroid(P) — so the same subtraction is
	// sound here with one addition at the end. Fixing the shared accumulator alone left this
	// loop still multiplying raw coordinates, so the guard above stopped refusing a real
	// square while this answered the wrong point for it: a refusal replaced by a quiet error,
	// which is the worse of the two.
	const origin = boundsMidpoint(polygon.points);
	// **SCALED as well as translated, because the moments are one power higher than the area.**
	// `(ax + bx) * w` is cubic in the coordinates where the shoelace sum is quadratic, so a
	// rectangle at (+/-5e153, +/-2.5e153) has a finite `cross` of 1e308, an area of 5e307 and a
	// centroid of exactly (0, 0) while these accumulators reach opposing infinities and cancel to
	// `NaN` — the guard below then refusing a centroid that is not merely representable but IS
	// the origin. Sound because the centroid is scale-equivariant as well as translation-
	// equivariant: scaling every vertex by k scales `w` by k squared, the moments by k cubed and
	// their quotient by k, so the same division answers in either frame and only the
	// intermediates change size. They are `unitX`/`unitY` rather than `scale` because this module
	// EXPORTS a `scale` function and a local of that name shadows it.
	//
	// **PER AXIS, and one shared factor was a false refusal traded for a false refusal.** A
	// polygon of `(-1e200, 0), (1e200, 1e-124), (1e200, 0)` has an area near 1e76 and a
	// representable centroid, and dividing BOTH axes by the largest magnitude underflows every y
	// to exactly zero — `crossScaled` becomes 0 and the shape is refused as unrepresentable. The
	// algebra survives the split: dividing x by `unitX` and y by `unitY` divides each `w` by
	// `unitX * unitY`, the x-moments by `unitX * unitX * unitY` and the y-moments by
	// `unitX * unitY * unitY`, so the quotients come back multiplied by one factor each. Neither factor can be zero — a polygon whose translated coordinates
	// are all zero has `cross === 0` and returned above — so no guard is owed for it.
	//
	// `cross` above stays UNSCALED on purpose: it is the AREA's question, and it is what keeps
	// this function refusing the polygon whose area genuinely is not representable. The scaled
	// `crossScaled` below is this function's own divisor, in the frame its moments were summed
	// in.
	let unitX = 0;
	let unitY = 0;
	for (const point of polygon.points) {
		unitX = Math.max(unitX, Math.abs(point.x - origin.x));
		unitY = Math.max(unitY, Math.abs(point.y - origin.y));
	}
	let crossScaled = 0;
	let cx = 0;
	let cy = 0;
	const n = polygon.points.length;
	for (let i = 0; i < n; i++) {
		const a = polygon.points[i];
		const b = polygon.points[(i + 1) % n];
		const ax = (a.x - origin.x) / unitX;
		const ay = (a.y - origin.y) / unitY;
		const bx = (b.x - origin.x) / unitX;
		const by = (b.y - origin.y) / unitY;
		const w = ax * by - bx * ay;
		crossScaled += w;
		cx += (ax + bx) * w;
		cy += (ay + by) * w;
	}
	const x = (cx / (3 * crossScaled)) * unitX + origin.x;
	const y = (cy / (3 * crossScaled)) * unitY + origin.y;
	// The guard on the RESULT, not on the sum it came from — the two are different questions and
	// this one is asked last for that reason. A finite `cross` and finite weights can still shift
	// back out of the translated frame into infinity: the spanning triangle's centroid is
	// genuinely not representable, and without this it came back as a confident `ok` carrying
	// `Infinity`. Found while checking the area fix rather than by any report; it is the same
	// class, one step further along the calculation.
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return geometryErr(
			'polygon-centroid-overflow',
			'This polygon encloses an area, but its centroid is not representable.',
		);
	}
	return ok({ x, y });
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
