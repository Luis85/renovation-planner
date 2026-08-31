import { describe, expect, it } from 'vitest';
import type { LineSegment } from '../../../src/core/geometry/LineSegment';
import type { Point } from '../../../src/core/geometry/Point';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import type { Polygon } from '../../../src/core/geometry/Polygon';
import type { Polyline } from '../../../src/core/geometry/Polyline';
import type { Transform } from '../../../src/core/geometry/Transform';
import type { GeometryError } from '../../../src/core/errors/AppError';
import type { Result } from '../../../src/core/result/Result';
import {
	applyTransform,
	area,
	boundingBoxOf,
	centroid,
	coincident,
	COINCIDENT_TOLERANCE_MM,
	contains,
	distance,
	intersect,
	length,
	perimeter,
	project,
	rotate,
	scale,
	translate,
} from '../../../src/core/geometry/operations';

const ORIGIN: Point = { x: 0, y: 0 };
/** A 3-4-5 right triangle — every hand-computed case below keys off it. */
const TRIANGLE: Polygon = {
	points: [
		{ x: 0, y: 0 },
		{ x: 4, y: 0 },
		{ x: 4, y: 3 },
	],
};
const TWO_POINT: Polygon = { points: TRIANGLE.points.slice(0, 2) };
const SQUARE: Polygon = {
	points: [
		{ x: 0, y: 0 },
		{ x: 2, y: 0 },
		{ x: 2, y: 2 },
		{ x: 0, y: 2 },
	],
};
const UNIT_SEGMENT: LineSegment = { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } };
const ZERO_SEGMENT: LineSegment = { start: { x: 1, y: 1 }, end: { x: 1, y: 1 } };

/**
 * Unwraps a Result for assertion. Throwing — rather than an `expect` behind an `if` —
 * keeps every expectation unconditional, which is what `vitest/no-conditional-expect`
 * exists for: a conditional expectation silently passes when its condition never holds.
 */
// `unknown` rather than a `T` parameter, for the reason `expectOk` carries: this is called
// over a union of results whose value types differ (`number`, `Point`), and a bound `T` has
// nothing to infer to across one. The value is never read here.
function errOf(result: Result<unknown, GeometryError>): GeometryError {
	if (result.ok) {
		throw new Error('expected a GeometryError, got a value');
	}
	return result.error;
}

function valueOf<T>(result: Result<T, GeometryError>): T {
	if (!result.ok) {
		throw new Error(`expected a value, got ${result.error.code}`);
	}
	return result.value;
}

describe('distance and length', () => {
	it('computes the Euclidean distance between two points', () => {
		expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});

	it('lengths a segment by its endpoints', () => {
		expect(length(UNIT_SEGMENT)).toBe(5);
	});

	it('lengths a polyline as the sum of its consecutive edges', () => {
		const open: Polyline = {
			points: [
				{ x: 0, y: 0 },
				{ x: 4, y: 0 },
				{ x: 4, y: 3 },
			],
		};
		expect(length(open)).toBe(7);
	});
});

/**
 * TRANSLATION CANCELLATION, asked of the shared accumulator through the two exported callers
 * that use it.
 *
 * The shoelace sum multiplies raw coordinates, so a shape that is small relative to its offset
 * produces terms whose difference is below a double's resolution and cancels to exactly zero. A
 * 1×1 square at 1e8 sums to `0` raw and to `2` once the vertices are translated to the first one.
 * Area is translation-invariant, so subtracting a vertex before accumulating changes no correct
 * answer and rescues the cancelling ones.
 *
 * Asked here rather than only through `enclosesArea`, because `area` and `centroid` accumulate
 * through the same helper and had the identical defect — fixing the caller that a review happened
 * to point at would have left its two siblings wrong.
 */
describe('a small polygon far from the origin', () => {
	const FAR = createPolygon([
		{ x: 1e8, y: 1e8 },
		{ x: 1e8 + 1, y: 1e8 },
		{ x: 1e8 + 1, y: 1e8 + 1 },
		{ x: 1e8, y: 1e8 + 1 },
	]);

	it('has its real area rather than zero', () => {
		expect(FAR.ok && area(FAR.value)).toEqual({ ok: true, value: 1 });
	});

	it('centroids at its middle rather than refusing as zero-area', () => {
		expect(FAR.ok && centroid(FAR.value)).toEqual({
			ok: true,
			value: { x: 1e8 + 0.5, y: 1e8 + 0.5 },
		});
	});
});

describe('area, perimeter, centroid over the 3-4-5 triangle', () => {
	it('areas it as 6, unsigned regardless of winding', () => {
		expect(area(TRIANGLE)).toEqual({ ok: true, value: 6 });
		const reversed: Polygon = { points: TRIANGLE.points.toReversed() };
		expect(area(reversed)).toEqual({ ok: true, value: 6 });
	});

	it('perimeters it as 12, including the implicit closing edge', () => {
		expect(perimeter(TRIANGLE)).toEqual({ ok: true, value: 12 });
	});

	it('centroids it at its area-weighted point', () => {
		expect(centroid(TRIANGLE)).toEqual({
			ok: true,
			value: { x: 8 / 3, y: 1 },
		});
	});

	it('weights the centroid by area, unlike a vertex mean — for any shape where the two differ', () => {
		const quad: Polygon = {
			points: [
				{ x: 0, y: 0 },
				{ x: 4, y: 0 },
				{ x: 4, y: 1 },
				{ x: 1, y: 1 },
			],
		};
		const weighted = valueOf(centroid(quad));
		const vertexMean = {
			x: quad.points.reduce((s, p) => s + p.x, 0) / 4,
			y: quad.points.reduce((s, p) => s + p.y, 0) / 4,
		};
		expect(weighted.x).toBeCloseTo(47 / 21);
		expect(weighted.y).toBeCloseTo(10 / 21);
		expect(vertexMean.x).not.toBeCloseTo(weighted.x);
	});
});

describe('degenerate inputs return GeometryError values', () => {
	it.each([
		['area', () => area(TWO_POINT)],
		['perimeter', () => perimeter(TWO_POINT)],
		['centroid', () => centroid(TWO_POINT)],
	])('%s rejects a two-point polygon with a Geometry error', (_name, call) => {
		const error = errOf(call());
		expect(error.category).toBe('Geometry');
		expect(error.code).toBe('polygon-too-few-points');
	});

	it('centroid rejects a collinear zero-area polygon rather than dividing by nothing', () => {
		const collinear: Polygon = {
			points: [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
			],
		};
		expect(errOf(centroid(collinear)).code).toBe('polygon-zero-area');
	});

	it('area rejects a non-finite coordinate instead of answering NaN', () => {
		const poisoned: Polygon = {
			points: [
				{ x: 0, y: 0 },
				{ x: Number.NaN, y: 0 },
				{ x: 4, y: 3 },
			],
		};
		expect(errOf(area(poisoned)).code).toBe('polygon-non-finite-coordinate');
	});

	it('boundingBoxOf rejects an empty point set', () => {
		expect(errOf(boundingBoxOf({ points: [] })).code).toBe('points-empty');
	});

	it('boundingBoxOf bounds an axis-aligned square', () => {
		expect(boundingBoxOf(SQUARE)).toEqual({
			ok: true,
			value: { min: { x: 0, y: 0 }, max: { x: 2, y: 2 } },
		});
	});

	it('contains rejects an invalid polygon', () => {
		expect(errOf(contains(TWO_POINT, ORIGIN)).code).toBe('polygon-too-few-points');
	});

	it.each([
		['intersect', () => intersect(ZERO_SEGMENT, UNIT_SEGMENT)],
		['project', () => project({ x: 0, y: 0 }, ZERO_SEGMENT)],
	])('%s rejects a zero-length segment', (_name, call) => {
		const error = errOf(call());
		expect(error.category).toBe('Geometry');
		expect(error.code).toBe('segment-zero-length');
	});

	it('intersect rejects a NaN endpoint instead of answering a NaN point', () => {
		const poisoned: LineSegment = { start: { x: Number.NaN, y: 0 }, end: { x: 1, y: 0 } };
		expect(errOf(intersect(poisoned, UNIT_SEGMENT)).code).toBe('non-finite-coordinate');
	});

	it('project rejects a NaN probe point instead of answering a NaN point', () => {
		const onto: LineSegment = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
		expect(errOf(project({ x: Number.NaN, y: 1 }, onto)).code).toBe(
			'non-finite-coordinate',
		);
	});

	it('contains rejects a NaN probe point instead of answering false', () => {
		expect(errOf(contains(SQUARE, { x: Number.NaN, y: 1 })).code).toBe(
			'non-finite-coordinate',
		);
	});

	it('boundingBoxOf rejects a non-finite coordinate instead of answering a NaN box', () => {
		const poisoned: Polyline = { points: [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }] };
		expect(errOf(boundingBoxOf(poisoned)).code).toBe('non-finite-coordinate');
	});

	it('createPolygon and the polygon operations reject the same vertex sets with the same error', () => {
		const rejected: readonly Point[][] = [
			[],
			[{ x: 1, y: 1 }],
			TRIANGLE.points.slice(0, 2),
			[TRIANGLE.points[0], TRIANGLE.points[1], { x: Number.NaN, y: 3 }],
			[TRIANGLE.points[0], TRIANGLE.points[1], { x: Infinity, y: 3 }],
		];
		for (const points of rejected) {
			const fromConstructor = errOf(createPolygon(points));
			const fromOperation = errOf(area({ points }));
			expect(fromOperation.code).toBe(fromConstructor.code);
			expect(fromOperation.category).toBe('Geometry');
		}
	});

	it('createPolygon and the polygon operations accept the same vertex sets', () => {
		expect(createPolygon(TRIANGLE.points).ok).toBe(true);
		expect(area({ points: TRIANGLE.points }).ok).toBe(true);
	});
});

describe('contains', () => {
	it('answers true inside, false outside, for a square', () => {
		expect(contains(SQUARE, { x: 1, y: 1 })).toEqual({ ok: true, value: true });
		expect(contains(SQUARE, { x: 5, y: 5 })).toEqual({ ok: true, value: false });
	});
});

describe('intersect', () => {
	const CROSS_A: LineSegment = { start: { x: -1, y: 0 }, end: { x: 1, y: 0 } };
	const CROSS_B: LineSegment = { start: { x: 0, y: -1 }, end: { x: 0, y: 1 } };

	it('finds the crossing point of two perpendicular segments', () => {
		expect(intersect(CROSS_A, CROSS_B)).toEqual({ ok: true, value: { x: 0, y: 0 } });
	});

	it('answers null for non-crossing segments', () => {
		const elsewhere: LineSegment = { start: { x: 5, y: 5 }, end: { x: 6, y: 6 } };
		expect(intersect(CROSS_A, elsewhere)).toEqual({ ok: true, value: null });
	});

	it('answers null for parallel segments', () => {
		const parallel: LineSegment = { start: { x: -1, y: 1 }, end: { x: 1, y: 1 } };
		expect(intersect(CROSS_A, parallel)).toEqual({ ok: true, value: null });
	});
});

describe('project', () => {
	it('projects onto the interior of a segment', () => {
		const onto: LineSegment = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
		expect(project({ x: 3, y: 7 }, onto)).toEqual({ ok: true, value: { x: 3, y: 0 } });
	});

	it('clamps to the nearest endpoint when the foot falls outside', () => {
		const onto: LineSegment = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
		expect(project({ x: -4, y: 2 }, onto)).toEqual({ ok: true, value: { x: 0, y: 0 } });
	});
});

describe('transforms', () => {
	it('translates every point by the vector', () => {
		const moved = translate(SQUARE, { dx: 10, dy: -5 });
		expect(moved.points[0]).toEqual({ x: 10, y: -5 });
		expect(moved.points[2]).toEqual({ x: 12, y: -3 });
	});

	it('translates a segment by moving both endpoints', () => {
		const moved = translate(UNIT_SEGMENT, { dx: 1, dy: 2 });
		expect(moved.start).toEqual({ x: 1, y: 2 });
		expect(moved.end).toEqual({ x: 4, y: 6 });
	});

	it('translates a bounding box by moving its corners', () => {
		const box = { min: { x: 0, y: 0 }, max: { x: 2, y: 2 } };
		const moved = translate(box, { dx: 5, dy: 5 });
		expect(moved.min).toEqual({ x: 5, y: 5 });
		expect(moved.max).toEqual({ x: 7, y: 7 });
	});

	it('translates and scales a bare point as the degenerate single-point shape', () => {
		const moved = translate({ x: 1, y: 2 }, { dx: 10, dy: 20 });
		expect(moved).toEqual({ x: 11, y: 22 });
		const scaled = scale({ x: 3, y: 5 }, 2, ORIGIN);
		expect(scaled).toEqual({ x: 6, y: 10 });
	});

	it('rotates about the required origin, not the world origin', () => {
		const pivot: Point = { x: 2, y: 0 };
		const rotated = rotate({ points: [pivot] }, Math.PI, { x: 0, y: 0 });
		expect(rotated.points[0].x).toBeCloseTo(-2);
		expect(rotated.points[0].y).toBeCloseTo(0);
	});

	it('scales about the required origin', () => {
		const scaled = scale({ points: [{ x: 4, y: 6 }] }, 0.5, { x: 2, y: 2 });
		expect(scaled.points[0]).toEqual({ x: 3, y: 4 });
	});

	it('composes applyTransform as scale, then rotate, then translate', () => {
		const transform: Transform = {
			translation: { dx: 100, dy: 0 },
			rotationRadians: Math.PI / 2,
			scale: 2,
		};
		const result = applyTransform({ points: [{ x: 1, y: 0 }] }, transform);
		const expected = translate(
			rotate(scale({ points: [{ x: 1, y: 0 }] }, 2, ORIGIN), Math.PI / 2, ORIGIN),
			transform.translation,
		);
		expect(result.points[0].x).toBeCloseTo(expected.points[0].x);
		expect(result.points[0].y).toBeCloseTo(expected.points[0].y);
	});

	it('mutates no input shape', () => {
		const original: Polygon = {
			points: [
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
				{ x: 3, y: 1 },
			],
		};
		const frozen = JSON.parse(JSON.stringify(original)) as Polygon;
		translate(original, { dx: 1, dy: 1 });
		rotate(original, 1, ORIGIN);
		scale(original, 2, ORIGIN);
		applyTransform(original, {
			translation: { dx: 1, dy: 1 },
			rotationRadians: 0.5,
			scale: 3,
		});
		expect(original).toEqual(frozen);
	});
});

/**
 * `coincident` — "the same point" as a geometric question rather than a bitwise one.
 *
 * It exists because a coordinate that has been through trigonometry is never bitwise what it
 * should be: constraining a click back onto an existing vertex along a 45 degree ray answers
 * `(0, -1.42e-14)` for the origin, and an `===` guard lets that into a polygon as a
 * zero-length edge.
 */
describe('coincident', () => {
	it('holds for a point and itself', () => {
		expect(coincident({ x: 1234.5, y: -67.25 }, { x: 1234.5, y: -67.25 })).toBe(true);
	});

	it('absorbs the floating-point residue a rotation leaves behind', () => {
		expect(coincident({ x: 0, y: 0 }, { x: 0, y: -1.4210854715202004e-14 })).toBe(true);
	});

	it('keeps two points a user could actually distinguish apart', () => {
		// A hundredth of a millimetre: ten thousand times the tolerance, and still far finer
		// than a renovation is ever measured — so if this merged, real vertices would.
		expect(coincident({ x: 0, y: 0 }, { x: 0.01, y: 0 })).toBe(false);
	});

	it('measures distance, not each axis on its own', () => {
		// Both components inside the tolerance but the DISTANCE outside it, which a
		// component-wise test would wrongly call the same point.
		const offset = COINCIDENT_TOLERANCE_MM * 0.8;
		expect(coincident({ x: 0, y: 0 }, { x: offset, y: offset })).toBe(false);
	});
});
