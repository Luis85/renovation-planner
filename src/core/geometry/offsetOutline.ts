import type { Point } from './Point';
import type { CurvedPolygon } from './CurvedPolygon';
import type { GeometryError } from '../errors/AppError';
import { err, ok, type Result } from '../result/Result';
import { curveMoments } from './curveMeasures';

/** The infinite line or full circle an outline edge lies on, oriented so a positive distance leaves the outline. */
export type EdgeSupport =
	| { readonly kind: 'line'; readonly origin: Point; readonly direction: Point; readonly normal: Point }
	| { readonly kind: 'circle'; readonly centre: Point; readonly radius: number; readonly side: number };

const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const along = (point: Point, direction: Point, distance: number): Point => ({ x: point.x + direction.x * distance, y: point.y + direction.y * distance });
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const gap = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** +1 when the outline's signed area, curves included, is positive; the sign every outward normal follows. */
function winding(shape: CurvedPolygon): number {
	const origin = shape.points[0];
	let sum = 0;
	for (let index = 0; index < shape.points.length; index++) sum += cross(minus(shape.points[index], origin), minus(shape.points[(index + 1) % shape.points.length], origin));
	return sum + 2 * curveMoments(shape).area >= 0 ? 1 : -1;
}

/** One support per edge, edge i running from point i to point i + 1. A curve's centre sits `(1 - b²) / 4b` chords off its midpoint. */
export function edgeSupports(shape: CurvedPolygon): EdgeSupport[] {
	const sign = winding(shape);
	return shape.points.map((start, index) => {
		const end = shape.points[(index + 1) % shape.points.length], bulge = shape.bulges?.[index] ?? 0;
		const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
		if (bulge === 0) return { kind: 'line', origin: start, direction: { x: dx / length, y: dy / length }, normal: { x: sign * dy / length, y: -sign * dx / length } };
		const offset = (1 - bulge * bulge) / (4 * bulge);
		return { kind: 'circle', centre: { x: start.x + dx / 2 - dy * offset, y: start.y + dy / 2 + dx * offset }, radius: length * (1 + bulge * bulge) / (4 * Math.abs(bulge)), side: sign * Math.sign(bulge) };
	});
}

/** Signed distance of a point from an edge's support: positive outside the outline, negative inside. */
export function outwardDistance(support: EdgeSupport, point: Point): number {
	if (support.kind === 'line') return (point.x - support.origin.x) * support.normal.x + (point.y - support.origin.y) * support.normal.y;
	return support.side * (gap(point, support.centre) - support.radius);
}

/** The outward unit normal of a support at a point on it. */
export function outwardNormal(support: EdgeSupport, point: Point): Point {
	if (support.kind === 'line') return support.normal;
	const radial = minus(point, support.centre), length = Math.hypot(radial.x, radial.y);
	return { x: support.side * radial.x / length, y: support.side * radial.y / length };
}

function moved(support: EdgeSupport, distance: number): EdgeSupport | null {
	if (support.kind === 'line') return { ...support, origin: along(support.origin, support.normal, distance) };
	const radius = support.radius + support.side * distance;
	return radius > 0 ? { ...support, radius } : null;
}

type Line = Extract<EdgeSupport, { kind: 'line' }>;
type Circle = Extract<EdgeSupport, { kind: 'circle' }>;

function lineCircle(line: Line, circle: Circle): Point[] {
	const relative = minus(line.origin, circle.centre), half = line.direction.x * relative.x + line.direction.y * relative.y;
	const discriminant = half * half - (relative.x * relative.x + relative.y * relative.y - circle.radius * circle.radius);
	if (discriminant < 0) return [];
	return [-half - Math.sqrt(discriminant), -half + Math.sqrt(discriminant)].map(t => along(line.origin, line.direction, t));
}

/** Concentric circles divide by zero into a non-finite height, refused by the same comparison as circles that never touch. */
function circleCircle(a: Circle, b: Circle): Point[] {
	const between = minus(b.centre, a.centre), distance = Math.hypot(between.x, between.y);
	const toChord = (a.radius * a.radius - b.radius * b.radius + distance * distance) / (2 * distance), height = a.radius * a.radius - toChord * toChord;
	if (!(height >= 0)) return [];
	const unit = { x: between.x / distance, y: between.y / distance }, foot = along(a.centre, unit, toChord), perpendicular = { x: -unit.y, y: unit.x };
	return [along(foot, perpendicular, Math.sqrt(height)), along(foot, perpendicular, -Math.sqrt(height))];
}

function intersections(a: EdgeSupport, b: EdgeSupport): Point[] {
	if (a.kind === 'line' && b.kind === 'line') {
		const denominator = cross(a.direction, b.direction);
		return Math.abs(denominator) < 1e-9 ? [] : [along(a.origin, a.direction, cross(minus(b.origin, a.origin), b.direction) / denominator)];
	}
	if (a.kind === 'line') return lineCircle(a, b as Circle);
	return b.kind === 'line' ? lineCircle(b, a) : circleCircle(a, b);
}

interface MovedEdge { readonly support: EdgeSupport; readonly distance: number; readonly target: EdgeSupport }

/**
 * Where two consecutive moved edges meet, nearest the corner they shared. When both carry the corner
 * to one point — no distance, a straight run or a tangent curve — that point is the answer, exactly.
 */
function corner(vertex: Point, previous: MovedEdge, next: MovedEdge): Point | null {
	const before = along(vertex, outwardNormal(previous.support, vertex), previous.distance), after = along(vertex, outwardNormal(next.support, vertex), next.distance);
	if (gap(before, after) <= 1e-9 * Math.max(1, Math.abs(previous.distance), Math.abs(next.distance))) return before;
	return intersections(previous.target, next.target).reduce<Point | null>((best, point) => best === null || gap(point, vertex) < gap(best, vertex) ? point : best, null);
}

/** The bulge of the arc from `start` to `end` on the moved circle, turning the same way as the original. */
function movedBulge(centre: Point, start: Point, end: Point, bulge: number): number {
	const from = minus(start, centre), to = minus(end, centre);
	let sweep = Math.atan2(cross(from, to), from.x * to.x + from.y * to.y);
	if (Math.sign(sweep) !== Math.sign(bulge)) sweep += Math.sign(bulge) * 2 * Math.PI;
	const next = Math.tan(sweep / 4);
	return Math.abs(next - bulge) <= 1e-12 ? bulge : next;
}

const unsolvable = (): Result<never, GeometryError> => err({ category: 'Geometry', code: 'outline-offset-unsolvable', message: 'Two moved outline edges no longer meet at a corner.' });

/**
 * Moves edge i of a valid outline `distances[i]` along its outward normal (negative moves inward),
 * mitring each corner where the moved neighbours meet. A curve stays concentric. Refused when two
 * moved edges have no meeting point or a curve is moved through its centre; whether the result is
 * itself simple is the caller's validation to make.
 */
export function offsetOutline(shape: CurvedPolygon, distances: readonly number[]): Result<CurvedPolygon, GeometryError> {
	const count = shape.points.length, edges: MovedEdge[] = [];
	for (const [index, support] of edgeSupports(shape).entries()) {
		const target = moved(support, distances[index]);
		if (!target) return unsolvable();
		edges.push({ support, distance: distances[index], target });
	}
	const points: Point[] = [];
	for (const [index, vertex] of shape.points.entries()) {
		const point = corner(vertex, edges[(index + count - 1) % count], edges[index]);
		if (!point) return unsolvable();
		points.push(point);
	}
	const bulges = shape.bulges?.map((bulge, index) => {
		const support = edges[index].target;
		return support.kind === 'circle' ? movedBulge(support.centre, points[index], points[(index + 1) % count], bulge) : bulge;
	});
	return ok({ points, ...(bulges ? { bulges } : {}) });
}
