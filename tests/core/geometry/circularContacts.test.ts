import { expect, it } from 'vitest';
import { circularEdgeIntersections, arcLineParameters } from '../../../src/core/geometry/circularIntersections';
import { contains } from '../../../src/core/geometry/operations';
import type { CircularEdge } from '../../../src/core/geometry/circularArc';
import type { Point } from '../../../src/core/geometry/Point';
import { expectOk } from '../../helpers/domain';

function circle(radius: number, start: number, end: number, x = 0): CircularEdge {
	return { start: { x: x + radius * Math.cos(start), y: radius * Math.sin(start) }, end: { x: x + radius * Math.cos(end), y: radius * Math.sin(end) }, bulge: Math.tan((end - start) / 4) };
}
function expectPoints(actual: readonly Point[], expected: readonly Point[]): void {
	expect(actual).toHaveLength(expected.length);
	for (const point of expected) expect(actual.some(candidate => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 1e-6)).toBe(true);
}
const upper = { start: { x: 10, y: 0 }, end: { x: -10, y: 0 }, bulge: 1 };
const line = (start: Point, end: Point): CircularEdge => ({ start, end, bulge: 0 });

it('distinguishes straight crossings, parallel separation, vertical overlap and endpoint-only contact', () => {
	const vertical = line({ x: 0, y: 0 }, { x: 0, y: 10 });
	expectPoints(circularEdgeIntersections(vertical, line({ x: -5, y: 5 }, { x: 5, y: 5 })).points, [{ x: 0, y: 5 }]);
	expect(circularEdgeIntersections(vertical, line({ x: 1, y: 0 }, { x: 1, y: 10 }))).toEqual({ points: [], overlap: false });
	expect(circularEdgeIntersections(vertical, line({ x: 0, y: 5 }, { x: 0, y: 20 })).overlap).toBe(true);
	const touching = circularEdgeIntersections(vertical, line({ x: 0, y: 10 }, { x: 0, y: 20 }));
	expect(touching.overlap).toBe(false); expectPoints(touching.points, [{ x: 0, y: 10 }]);
	expect(circularEdgeIntersections(vertical, line({ x: 2, y: 5 }, { x: 5, y: 5 })).points).toEqual([]);
	expect(circularEdgeIntersections(vertical, line({ x: 0, y: 11 }, { x: 0, y: 20 })).points).toEqual([]);
});

it('keeps tangent contact singular, returns both secant contacts and excludes a distant line', () => {
	expectPoints(circularEdgeIntersections(upper, line({ x: -20, y: 10 }, { x: 20, y: 10 })).points, [{ x: 0, y: 10 }]);
	expectPoints(circularEdgeIntersections(line({ x: -20, y: 5 }, { x: 20, y: 5 }), upper).points, [{ x: -Math.sqrt(75), y: 5 }, { x: Math.sqrt(75), y: 5 }]);
	expect(circularEdgeIntersections(upper, line({ x: -20, y: 11 }, { x: 20, y: 11 })).points).toEqual([]);
	// Infinite-line parameters are also well-defined when an edge is straight.
	expect(arcLineParameters(line({ x: 0, y: 0 }, { x: 10, y: 0 }), { x: 5, y: 5 }, { x: 0, y: -1 })).toEqual([5]);
	expect(arcLineParameters(line({ x: 0, y: 0 }, { x: 10, y: 0 }), { x: 5, y: 5 }, { x: 1, y: 0 })).toEqual([]);
});

it('distinguishes adjacent, contained, partially overlapping and reversed arcs on one circle', () => {
	const quarter = circle(10, 0, Math.PI / 2), next = circle(10, Math.PI / 2, Math.PI);
	const adjacent = circularEdgeIntersections(quarter, next);
	expect(adjacent.overlap).toBe(false); expectPoints(adjacent.points, [{ x: 0, y: 10 }]);
	expect(circularEdgeIntersections(upper, quarter).overlap).toBe(true);
	expect(circularEdgeIntersections(quarter, upper).overlap).toBe(true);
	expect(circularEdgeIntersections(circle(10, 0, 3 * Math.PI / 4), circle(10, Math.PI / 4, Math.PI)).overlap).toBe(true);
	expect(circularEdgeIntersections(upper, { start: upper.end, end: upper.start, bulge: -1 }).overlap).toBe(true);
});

it.each([0, 0.001, 100])('keeps disjoint circles separate with centre displacement %s', x => {
	expect(circularEdgeIntersections(upper, circle(20, 0, Math.PI, x))).toEqual({ points: [], overlap: false });
});

it('returns the shared tangent point and only the crossing that belongs to both minor arcs', () => {
	const tangent = circularEdgeIntersections(circle(10, -Math.PI / 2, Math.PI / 2), circle(10, Math.PI / 2, 3 * Math.PI / 2, 20));
	expect(tangent.overlap).toBe(false); expectPoints(tangent.points, [{ x: 10, y: 0 }]);
	expectPoints(circularEdgeIntersections(upper, circle(10, 0, Math.PI, 10)).points, [{ x: 5, y: Math.sqrt(75) }]);
});

it.each([1, -1])('counts horizontal endpoint tangencies consistently for bend sign %s', bulge => {
	const room = { points: [{ x: 0, y: -10 }, { x: 0, y: 10 }, { x: 0, y: 0 }], bulges: [bulge, 0, 0] };
	expect(expectOk(contains(room, { x: bulge * 5, y: 0 }))).toBe(true);
	for (const point of [{ x: -11, y: -10 }, { x: -11, y: 10 }, { x: 11, y: -10 }, { x: 11, y: 10 }, { x: 0, y: 11 }]) expect(expectOk(contains(room, point))).toBe(false);
});
