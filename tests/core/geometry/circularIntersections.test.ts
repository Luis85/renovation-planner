import { expect, it } from 'vitest';
import { circularEdgeIntersections } from '../../../src/core/geometry/circularIntersections';
import { createCurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { expectErr } from '../../helpers/domain';
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
/**
 * AD18-R24: two adjacent quarter-arcs of a four-arc circle stretched a few parts per million out of round
 * lie on nearly the same circle, and their radical line carried enough round-off to report a second
 * contact 1.1e-7 mm from their shared corner, past the 1e-7 mm tolerance. The pair is the tree footprint
 * scaled by 1.5 across and 1.5 * (1 - 1.564e-5) along, bit for bit as `resizeBox` produces it.
 */
const PHANTOM = {
	a: { start: { x: 1.3777276490407722e-13, y: 2249.96481 }, end: { x: -2250, y: 2.7554122027606826e-13 }, bulge: 0.41421356237309503 },
	b: { start: { x: -2250, y: 2.7554122027606826e-13 }, end: { x: 1.3777276490407722e-13, y: -2249.96481 }, bulge: 0.41421356237309503 },
};
it('reports only the shared corner of adjacent arcs on nearly the same circle', () => {
	const result = circularEdgeIntersections(PHANTOM.a, PHANTOM.b);
	expect(result.overlap).toBe(false);
	expect(result.points).toHaveLength(1);
	expect(Math.hypot(result.points[0].x - PHANTOM.a.end.x, result.points[0].y - PHANTOM.a.end.y)).toBeLessThanOrEqual(1e-7);
});
/**
 * The shrub's lobed detail flattened to 1e-5 of its depth and then widened 3.3 times: a 1214 mm arc meets a
 * 0.004 mm one, so their common chord is nearly tangent to the long arc's circle. Solving that line for both
 * roots put the corner's own root 1.3e-7 mm off the corner, where the other arc still accepts it.
 */
const TINY_NEIGHBOUR = {
	a: { start: { x: 8.587835679020814e-14, y: -0.00425 }, end: { x: 1214.600628807675, y: -0.002125 }, bulge: 0.35 },
	b: { start: { x: 1214.600628807675, y: -0.002125 }, end: { x: 1214.6006288076753, y: 0.0021249999999999997 }, bulge: 0.35 },
};
it('reports only the shared corner of a long arc beside a very short one', () => {
	expect(circularEdgeIntersections(TINY_NEIGHBOUR.a, TINY_NEIGHBOUR.b)).toEqual({ points: [TINY_NEIGHBOUR.a.end], overlap: false });
});
it('finds where a 10 mm arc crosses back over the 52 m arc it leaves, half a millimetre from their corner', () => {
	// Exactly, the circles' other common point is 0.4802 mm from the corner. Solved in a frame 79 m across,
	// the short arc's own circle test failed on round-off and the crossing went unreported.
	const a = { start: { x: 88307.5857755673, y: 6915.556049040941 }, end: { x: 22231.96891966229, y: -71797.90189210298 }, bulge: -0.8754865880730038 };
	const b = { start: a.end, end: { x: 22228.737272335653, y: -71807.0579553409 }, bulge: -0.8363684971441033 };
	const points = circularEdgeIntersections(a, b).points;
	expect(points).toHaveLength(2);
	expect(Math.hypot(points[1].x - a.end.x, points[1].y - a.end.y)).toBeCloseTo(0.4802, 4);
});
it('still finds the second crossing of arcs that share a corner, and refuses the outline', () => {
	// A figure-eight of arcs: each semicircle bows through (5, 5), where the two cross.
	const outline = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], bulges: [-1, -1, 0, 0] };
	const crossing = circularEdgeIntersections({ start: outline.points[0], end: outline.points[1], bulge: -1 }, { start: outline.points[1], end: outline.points[2], bulge: -1 });
	expect(crossing.points.some(point => Math.hypot(point.x - 5, point.y - 5) < 1e-9)).toBe(true);
	expect(expectErr(createCurvedPolygon(outline)).code).toBe('curve-self-intersection');
});
it('still finds the crossing of a cusp that doubles back along nearly the same circle', () => {
	// Arrive at the top of a 2250 mm circle and leave back down one whose centre sits 0.05 mm away, so the
	// two cross again at 35 degrees, inside both arcs: the phantom's regime, with a real second contact.
	const degree = Math.PI / 180, radius = 2250, corner = { x: 0, y: radius };
	const centre = { x: 0.05 * Math.cos(62.5 * degree), y: 0.05 * Math.sin(62.5 * degree) }, other = Math.hypot(corner.x - centre.x, corner.y - centre.y);
	const leave = Math.atan2(corner.y - centre.y, corner.x - centre.x), end = -25 * degree;
	const arriving = { start: { x: radius * Math.cos(-20 * degree), y: radius * Math.sin(-20 * degree) }, end: corner, bulge: Math.tan(110 * degree / 4) };
	const leaving = { start: corner, end: { x: centre.x + other * Math.cos(end), y: centre.y + other * Math.sin(end) }, bulge: Math.tan((end - leave) / 4) };
	const points = circularEdgeIntersections(arriving, leaving).points;
	expect(points.some(point => Math.hypot(point.x - radius * Math.cos(35 * degree), point.y - radius * Math.sin(35 * degree)) < 1e-3)).toBe(true);
});
