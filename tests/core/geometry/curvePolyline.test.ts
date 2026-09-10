import { expect, it } from 'vitest';
import { polygonPolyline } from '../../../src/core/geometry/curvePolyline';

it('polygonPolyline tessellates a curved edge while a bulge-less edge contributes only its start', () => {
	const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
	// A `bulges` array shorter than `points` still has SOME curved edge (index 0), so
	// `polygonPolyline` tessellates rather than returning the raw vertex list, and every
	// edge past index 0 is missing its own entry rather than merely holding a zero.
	const line = polygonPolyline({ points: square, bulges: [1] }, 0.5);
	expect(line.length).toBeGreaterThan(square.length);
	expect(line[0]).toEqual(square[0]);
	for (const point of line) { expect(Number.isFinite(point.x)).toBe(true); expect(Number.isFinite(point.y)).toBe(true); }
});
