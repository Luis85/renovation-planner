import type { Point } from './Point';
import { arcExtrema, arcPoint, arcTangent, type CircularEdge } from './circularArc';

export interface EdgeIntersections { readonly points: readonly Point[]; readonly overlap: boolean }
export function curveTolerance(points: readonly Point[]): number {
	let maximum = 1;
	for (const point of points) maximum = Math.max(maximum, Math.abs(point.x), Math.abs(point.y));
	return Math.max(1e-7, 64 * Number.EPSILON * maximum);
}
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const near = (a: Point, b: Point, epsilon: number) => Math.hypot(a.x - b.x, a.y - b.y) <= epsilon;
interface CircleEquation { a: number; x: number; y: number; c: number }
function equation(edge: CircularEdge): CircleEquation {
	const dx = edge.end.x - edge.start.x, dy = edge.end.y - edge.start.y, b = edge.bulge;
	const mx = edge.start.x / 2 + edge.end.x / 2, my = edge.start.y / 2 + edge.end.y / 2;
	const x = -4 * b * mx + (1 - b * b) * dy, y = -4 * b * my - (1 - b * b) * dx;
	return { a: 2 * b, x, y, c: 2 * b * (mx * mx + my * my - (dx * dx + dy * dy) / 4) + (1 - b * b) * (-dy * mx + dx * my) };
}
function onArc(edge: CircularEdge, point: Point, epsilon: number): boolean {
	if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
	const chord = minus(edge.end, edge.start), relative = minus(point, edge.start);
	if (Math.sign(edge.bulge) * cross(chord, relative) > epsilon * Math.hypot(chord.x, chord.y)) return false;
	const q = equation(edge), value = q.a * (point.x * point.x + point.y * point.y) + q.x * point.x + q.y * point.y + q.c;
	const gradient = Math.hypot(2 * q.a * point.x + q.x, 2 * q.a * point.y + q.y);
	return Math.abs(value) <= epsilon * (gradient + Math.abs(q.a) * epsilon);
}
function roots(a: number, b: number, c: number): number[] {
	if (a === 0) return b === 0 ? [] : [-c / b];
	const discriminant = b * b - 4 * a * c, tolerance = 64 * Number.EPSILON * Math.max(b * b, Math.abs(4 * a * c));
	if (discriminant < -tolerance) return [];
	// Round-off on either side of zero must remain one tangency, not two phantom crossings.
	if (discriminant <= tolerance) return [-b / (2 * a)];
	const sqrt = Math.sqrt(discriminant);
	const q = -0.5 * (b + (b < 0 ? -sqrt : sqrt));
	return [q / a, c / q];
}
/** Infinite line intersections; the caller decides whether its parameter belongs to a segment/ray. */
export function arcLineParameters(arc: CircularEdge, origin: Point, direction: Point): number[] {
	const q = equation(arc);
	return roots(q.a * (direction.x * direction.x + direction.y * direction.y),
		2 * q.a * (origin.x * direction.x + origin.y * direction.y) + q.x * direction.x + q.y * direction.y,
		q.a * (origin.x * origin.x + origin.y * origin.y) + q.x * origin.x + q.y * origin.y + q.c);
}
function endpointDirection(edge: CircularEdge, end: boolean): number {
	const tangent = arcTangent(edge, end ? 1 : 0);
	if (Math.abs(tangent.y) > 32 * Number.EPSILON) return Math.sign(tangent.y);
	return Math.sign((end ? -1 : 1) * edge.bulge * tangent.x);
}
/** Horizontal ray from (0,0); endpoints follow the same half-open rule as straight edges. */
export function arcRayCrossings(edge: CircularEdge, epsilon: number): number {
	return arcLineParameters(edge, { x: 0, y: 0 }, { x: 1, y: 0 }).filter(x => rayContactCrosses(edge, x, epsilon)).length;
}
function rayContactCrosses(edge: CircularEdge, x: number, epsilon: number): boolean {
	const point = { x, y: 0 };
	if (!(x > 0) || !onArc(edge, point, epsilon)) return false;
	if (near(point, edge.start, epsilon)) return endpointDirection(edge, false) > 0;
	if (near(point, edge.end, epsilon)) return endpointDirection(edge, true) < 0;
	const q = equation(edge), dy = 2 * q.a * x + q.x;
	return Math.abs(dy) > 32 * Number.EPSILON * Math.hypot(dy, q.y);
}
function lineArc(line: CircularEdge, arc: CircularEdge, epsilon: number): EdgeIntersections {
	const direction = minus(line.end, line.start);
	const parameterTolerance = epsilon / Math.hypot(direction.x, direction.y);
	const points = arcLineParameters(arc, line.start, direction).filter(t => t >= -parameterTolerance && t <= 1 + parameterTolerance).map(t => Math.max(0, Math.min(1, t)))
		.map(t => ({ x: line.start.x + direction.x * t, y: line.start.y + direction.y * t })).filter(point => onArc(arc, point, epsilon));
	return { points, overlap: false };
}
function lineLine(a: CircularEdge, b: CircularEdge, epsilon: number): EdgeIntersections {
	const av = minus(a.end, a.start), bv = minus(b.end, b.start), delta = minus(b.start, a.start), denominator = cross(av, bv);
	if (denominator !== 0) {
		const t = cross(delta, bv) / denominator, u = cross(delta, av) / denominator;
		return { points: t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [{ x: a.start.x + av.x * t, y: a.start.y + av.y * t }] : [], overlap: false };
	}
	if (cross(delta, av) !== 0) return { points: [], overlap: false };
	const axis = Math.abs(av.x) >= Math.abs(av.y) ? 'x' : 'y';
	const low = Math.max(Math.min(a.start[axis], a.end[axis]), Math.min(b.start[axis], b.end[axis]));
	const high = Math.min(Math.max(a.start[axis], a.end[axis]), Math.max(b.start[axis], b.end[axis]));
	return { points: [a.start, a.end, b.start, b.end].filter(point => point[axis] >= low && point[axis] <= high), overlap: high - low > epsilon };
}
function arcArc(a: CircularEdge, b: CircularEdge, epsilon: number): EdgeIntersections {
	const qa = equation(a), qb = equation(b);
	const x = qb.a * qa.x - qa.a * qb.x, y = qb.a * qa.y - qa.a * qb.y, c = qb.a * qa.c - qa.a * qb.c;
	const magnitude = Math.hypot(x, y);
	const endpoints = [a.start, a.end, b.start, b.end].filter(point => onArc(a, point, epsilon) && onArc(b, point, epsilon));
	const coincident = [arcPoint(a, 0.25), arcPoint(a, 0.5), arcPoint(a, 0.75)].every(point => {
		const q = equation(b), value = q.a * (point.x * point.x + point.y * point.y) + q.x * point.x + q.y * point.y + q.c;
		return Math.abs(value) <= epsilon * Math.hypot(2 * q.a * point.x + q.x, 2 * q.a * point.y + q.y);
	});
	if (coincident) {
		const interior = (edge: CircularEdge, point: Point) => onArc(edge, point, epsilon) && !near(point, edge.start, epsilon) && !near(point, edge.end, epsilon);
		return { points: endpoints, overlap: interior(b, arcPoint(a, 0.5)) || interior(a, arcPoint(b, 0.5)) || endpoints.some(point => interior(a, point) || interior(b, point)) };
	}
	if (magnitude === 0) return { points: [], overlap: false };
	const nx = x / magnitude, ny = y / magnitude, offset = -c / magnitude;
	const reach = Math.max(...[...arcExtrema(a), ...arcExtrema(b)].map(point => Math.hypot(point.x, point.y))) + epsilon;
	if (Math.abs(offset) > reach) return { points: endpoints, overlap: false };
	const origin = { x: nx * offset, y: ny * offset }, direction = { x: -ny, y: nx };
	const points = arcLineParameters(a, origin, direction).map(t => ({ x: origin.x + direction.x * t, y: origin.y + direction.y * t }))
		.filter(point => onArc(a, point, epsilon) && onArc(b, point, epsilon));
	return { points: [...endpoints, ...points], overlap: false };
}
/** Normalised analytic intersections, including overlap; no tessellation determines validity. */
export function circularEdgeIntersections(a: CircularEdge, b: CircularEdge): EdgeIntersections {
	const origin = a.start, vertices = [a.start, a.end, b.start, b.end];
	const scale = Math.max(1, ...vertices.flatMap(point => [Math.abs(point.x - origin.x), Math.abs(point.y - origin.y)]));
	const epsilon = curveTolerance(vertices) / scale;
	const local = (edge: CircularEdge): CircularEdge => ({ start: { x: (edge.start.x - origin.x) / scale, y: (edge.start.y - origin.y) / scale }, end: { x: (edge.end.x - origin.x) / scale, y: (edge.end.y - origin.y) / scale }, bulge: edge.bulge });
	const left = local(a), right = local(b);
	const result = left.bulge === 0 ? right.bulge === 0 ? lineLine(left, right, epsilon) : lineArc(left, right, epsilon) : right.bulge === 0 ? lineArc(right, left, epsilon) : arcArc(left, right, epsilon);
	const points = result.points.filter((point, index, all) => all.findIndex(other => near(point, other, epsilon)) === index)
		.map(point => ({ x: origin.x + point.x * scale, y: origin.y + point.y * scale }));
	return { points, overlap: result.overlap };
}
