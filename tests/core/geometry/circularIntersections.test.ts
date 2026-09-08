import { expect, it } from 'vitest';
import { circularEdgeIntersections } from '../../../src/core/geometry/circularIntersections';
const arc = { start: { x: -1000, y: 0 }, end: { x: 1000, y: 0 }, bulge: 1 };
const shifted = (edge: typeof arc) => ({ ...edge, start: { x: edge.start.x + 1e8, y: edge.start.y - 1e8 }, end: { x: edge.end.x + 1e8, y: edge.end.y - 1e8 } });
it('finds actual arc crossings that its chord misses, and ignores the other semicircle', () => {
	const result = circularEdgeIntersections(arc, { start: { x: 0, y: -1500 }, end: { x: 0, y: -500 }, bulge: 0 });
	expect(result.overlap).toBe(false); expect(result.points).toHaveLength(1); expect(result.points[0].x).toBeCloseTo(0, 8); expect(result.points[0].y).toBeCloseTo(-1000, 8);
	expect(circularEdgeIntersections(arc, { start: { x: 0, y: 500 }, end: { x: 0, y: 1500 }, bulge: 0 }).points).toEqual([]);
});
it('distinguishes shared endpoints, identical arc overlap and opposite arcs on the same circle', () => {
	expect(circularEdgeIntersections(arc, arc).overlap).toBe(true);
	const opposite = circularEdgeIntersections(arc, { ...arc, bulge: -1 }); expect(opposite.overlap).toBe(false); expect(opposite.points).toHaveLength(2);
	const line = { start: arc.end, end: { x: 2000, y: 0 }, bulge: 0 };
	expect(circularEdgeIntersections(arc, line).points).toEqual([arc.end]);
});
it('keeps arc intersections under translation and finds tangencies once', () => {
	const crossing = { start: { x: 0, y: -1000 }, end: { x: 2000, y: -1000 }, bulge: -1 };
	const result = circularEdgeIntersections(arc, crossing); expect(result.points.length).toBeGreaterThan(0);
	expect(circularEdgeIntersections(shifted(arc), shifted(crossing)).points).toHaveLength(result.points.length);
	const tangent = circularEdgeIntersections(arc, { start: { x: -2000, y: -1000 }, end: { x: 2000, y: -1000 }, bulge: 0 }); expect(tangent.points).toHaveLength(1);
});
