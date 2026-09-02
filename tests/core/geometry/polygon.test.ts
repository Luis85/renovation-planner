import { describe, expect, it } from 'vitest';
import { createPolygon, type Polygon } from '../../../src/core/geometry/Polygon';
import type { GeometryError } from '../../../src/core/errors/AppError';
import type { Point } from '../../../src/core/geometry/Point';
import type { Result } from '../../../src/core/result/Result';

const TRIANGLE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 4, y: 0 },
	{ x: 0, y: 3 },
];

/**
 * Unwraps a Result for assertion. Throwing — rather than an `expect` behind an `if` —
 * keeps every expectation unconditional: a conditional expectation silently passes when
 * its condition never holds.
 */
function errOf(result: Result<Polygon, GeometryError>): GeometryError {
	if (result.ok) {
		throw new Error('expected a GeometryError, got a polygon');
	}
	return result.error;
}

describe('createPolygon', () => {
	it.each([
		['zero points', []],
		['one point', [{ x: 1, y: 1 }]],
		[
			'two points',
			[
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
			],
		],
	])('rejects a polygon with $1', (_name, points) => {
		const error = errOf(createPolygon(points as Point[]));
		expect(error.category).toBe('Geometry');
		expect(error.code).toBe('polygon-too-few-points');
	});

	it('rejects a NaN coordinate among otherwise valid vertices', () => {
		const error = errOf(createPolygon([...TRIANGLE.slice(0, 2), { x: Number.NaN, y: 5 }]));
		expect(error.code).toBe('polygon-non-finite-coordinate');
	});

	it('rejects an Infinity coordinate among otherwise valid vertices', () => {
		const error = errOf(
			createPolygon([TRIANGLE[0], TRIANGLE[1], { x: 2, y: Number.POSITIVE_INFINITY }]),
		);
		expect(error.code).toBe('polygon-non-finite-coordinate');
	});

	it('accepts a well-formed triangle without repeating the closing point', () => {
		expect(createPolygon(TRIANGLE)).toEqual({ ok: true, value: { points: TRIANGLE } });
	});

	it('detaches the VERTICES as well as the array, so a later write cannot invalidate it', () => {
		// The array half was already copied; the Point objects were shared, so a caller that
		// kept a mutable-typed handle could reach through a validated polygon.
		const vertices = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		];
		const result = createPolygon(vertices);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		vertices.push({ x: 0, y: 10 });
		vertices[0].x = Number.NaN;

		expect(result.value.points).toHaveLength(3);
		expect(result.value.points[0]).toEqual({ x: 0, y: 0 });
	});
});
