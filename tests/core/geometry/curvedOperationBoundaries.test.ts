import { expect, it } from 'vitest';
import { area, boundingBoxOf, centroid, contains, enclosesArea, perimeter } from '../../../src/core/geometry/operations';
import { createCurvedPolygon, validateBulges, type CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { circularEdgeIntersections } from '../../../src/core/geometry/circularIntersections';
import { expectErr, expectOk } from '../../helpers/domain';

const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];

it.each([
	{ bulges: [0.25], code: 'curve-edge-count' },
	{ bulges: [NaN, 0, 0, 0], code: 'curve-bulge-invalid' },
	{ bulges: [Number.MIN_VALUE, 0, 0, 0], code: 'curve-chord-invalid' },
])('refuses $code consistently across quantities, centring, framing and hit testing', ({ bulges, code }) => {
	const shape = { points, bulges }, before = structuredClone(shape);
	for (const result of [area(shape), perimeter(shape), centroid(shape), boundingBoxOf(shape), contains(shape, { x: 2000, y: 1500 })]) {
		expect(expectErr(result)).toMatchObject({ category: 'Geometry', code });
	}
	expect(enclosesArea(shape)).toBe(false);
	expect(shape).toEqual(before);
});

it('rejects a collapsed curved edge even when the other vertices still enclose a room', () => {
	const shape: CurvedPolygon = { points: [points[0], points[0], points[1], points[2], points[3]], bulges: [0.5, 0, 0, 0, 0] };
	expect(expectErr(validateBulges(shape))).toMatchObject({ code: 'curve-chord-invalid' });
	expect(expectErr(createCurvedPolygon(shape))).toMatchObject({ code: 'curve-chord-invalid' });
});

it('refuses an unrepresentable curved centroid without losing its separately representable area', () => {
	const shape = { points: [{ x: 0, y: 0 }, { x: 1e308, y: 0 }, { x: 1e308, y: 1e-308 }, { x: 0, y: 1e-308 }], bulges: [0, 0.25, 0, 0] };
	expect(expectOk(area(shape))).toBeCloseTo(1, 14);
	expect(expectErr(centroid(shape))).toMatchObject({ category: 'Geometry', code: 'polygon-centroid-overflow' });
});

it('keeps exactly concentric semicircles disjoint in either argument order', () => {
	const inner = { start: { x: 10, y: 0 }, end: { x: -10, y: 0 }, bulge: 1 };
	const outer = { start: { x: 20, y: 0 }, end: { x: -20, y: 0 }, bulge: 1 };
	expect(circularEdgeIntersections(inner, outer)).toEqual({ points: [], overlap: false });
	expect(circularEdgeIntersections(outer, inner)).toEqual({ points: [], overlap: false });
});
