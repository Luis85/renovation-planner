import { expect, it } from 'vitest';
import { arcExtrema, arcLength, arcPoint, arcProjection, arcRadius, arcSegmentMoments, arcTangent } from '../../../src/core/geometry/circularArc';
import { createCurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { area, boundingBoxOf, centroid, contains, perimeter, rotate, scale, translate } from '../../../src/core/geometry/operations';
import { expectOk } from '../../helpers/domain';

it('keeps a collapsed preview edge finite instead of inventing a tangent or dividing by zero', () => {
	const point = { x: 12, y: 34 }, edge = { start: point, end: point, bulge: 0 };
	expect(arcTangent(edge, 0.5)).toEqual({ x: 0, y: 0 });
	expect(arcProjection(edge, { x: 15, y: 38 })).toEqual({ point, fraction: 0, distance: 5 });
});

it('measures a semicircle analytically and keeps its endpoints exact', () => {
	const edge = { start: { x: -1000, y: 0 }, end: { x: 1000, y: 0 }, bulge: 1 };
	expect(arcRadius(edge)).toBe(1000); expect(arcLength(edge)).toBeCloseTo(Math.PI * 1000, 9);
	expect(arcPoint(edge, 0)).toEqual(edge.start); expect(arcPoint(edge, 1)).toEqual(edge.end);
	expect(arcPoint(edge, 0.5).x).toBeCloseTo(0, 10); expect(arcPoint(edge, 0.5).y).toBeCloseTo(-1000, 10);
	expect(arcTangent(edge, 0.5)).toEqual({ x: 1, y: 0 });
	const segment = arcSegmentMoments(edge); expect(segment.area).toBeCloseTo(Math.PI * 1e6 / 2, 7);
	expect(segment.normalCentroid).toBeCloseTo(-4000 / (3 * Math.PI), 9);
	expect(arcExtrema(edge)).toHaveLength(3);
});
it.each([1e-10, 0.005, 0.25, 1, -0.25, -1])('keeps arc moments and midpoint stable for bulge %s', bulge => {
	const edge = { start: { x: 1e8, y: -1e8 }, end: { x: 1e8 + 4000, y: -1e8 }, bulge };
	expect(arcPoint(edge, 0.5).y).toBeCloseTo(-1e8 - 2000 * bulge, 6);
	expect(arcLength(edge)).toBeGreaterThanOrEqual(4000);
	const moments = arcSegmentMoments(edge); expect(Math.sign(moments.area)).toBe(Math.sign(bulge));
	expect(Math.sign(moments.normalCentroid)).toBe(-Math.sign(bulge));
	expect(moments.normalMoment).toBeCloseTo(moments.area * moments.normalCentroid, 6);
});
it('gives four quarter arcs the exact circle area, perimeter, centroid and actual extrema', () => {
	const radius = 2000, b = Math.tan(Math.PI / 8);
	const circle = expectOk(createCurvedPolygon({ points: [{ x: radius, y: 0 }, { x: 0, y: radius }, { x: -radius, y: 0 }, { x: 0, y: -radius }], bulges: [b, b, b, b] }));
	expect(expectOk(area(circle))).toBeCloseTo(Math.PI * radius * radius, 6); expect(expectOk(perimeter(circle))).toBeCloseTo(2 * Math.PI * radius, 8);
	const centre = expectOk(centroid(circle)); expect(centre.x).toBeCloseTo(0, 8); expect(centre.y).toBeCloseTo(0, 8);
	for (const [x, y] of [[0, 0], [1500, 500], [-1500, -500], [0, 2100], [2100, 0], [-1800, 1800]]) expect(expectOk(contains(circle, { x, y }))).toBe(x * x + y * y < radius * radius);
	const moved = translate(rotate(scale(circle, 2, { x: 0, y: 0 }), 0.37, { x: 0, y: 0 }), { dx: 12300, dy: -4400 });
	expect(moved.bulges).toEqual(circle.bulges); expect(expectOk(area(moved))).toBeCloseTo(4 * Math.PI * radius * radius, 5);
	const box = expectOk(boundingBoxOf(moved)); expect(box.min.x).toBeCloseTo(8300, 8); expect(box.max.y).toBeCloseTo(-400, 8);
	const final = expectOk(centroid(moved)); expect(final.x).toBeCloseTo(12300, 8); expect(final.y).toBeCloseTo(-4400, 8);
});
it('uses the curve rather than its chord for outward and inward Room containment', () => {
	const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
	const outward = { points, bulges: [0.25, 0, 0, 0] }, inward = { points, bulges: [-0.25, 0, 0, 0] };
	expect(expectOk(contains(outward, { x: 2000, y: -250 }))).toBe(true); expect(expectOk(contains(outward, { x: 2000, y: -750 }))).toBe(false);
	expect(expectOk(contains(inward, { x: 2000, y: 250 }))).toBe(false); expect(expectOk(contains(inward, { x: 2000, y: 750 }))).toBe(true);
});
it('rejects invalid curve maps and refuses self-crossing arcs without changing legacy straight polygons', () => {
	const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
	for (const bulges of [[0], [2, 0, 0, 0], [NaN, 0, 0, 0]]) expect(createCurvedPolygon({ points, bulges }).ok).toBe(false);
	expect(createCurvedPolygon({ points, bulges: [0, 0, 0, 0] })).toEqual(createCurvedPolygon({ points }));
	expect(createCurvedPolygon({ points, bulges: [-1, -1, -1, -1] }).ok).toBe(false);
});
