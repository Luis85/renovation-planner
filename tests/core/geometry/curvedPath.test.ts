import { describe, expect, it } from 'vitest';
import { createCurvedPath, pathPolyline, type CurvedPath, type CurvedPathInput } from '../../../src/core/geometry/CurvedPath';
import type { GeometryError } from '../../../src/core/errors/AppError';
import type { Result } from '../../../src/core/result/Result';

const LINE: CurvedPathInput = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };

function errOf(result: Result<CurvedPath, GeometryError>): GeometryError {
	if (result.ok) throw new Error('expected a GeometryError, got a path');
	return result.error;
}

function valueOf(result: Result<CurvedPath, GeometryError>): CurvedPath {
	if (!result.ok) throw new Error(`expected a path, got ${result.error.code}`);
	return result.value;
}

/**
 * An open graphic is a PATH and not a polygon with a gap (AD04 §2). `CurvedPolygon` closes
 * last→first by construction, demands three points and wants one bulge per POINT because the
 * wrap edge is real; every one of those is wrong for a line, so the rules are asked here.
 */
describe('createCurvedPath', () => {
	it('takes the two-point line a polygon refuses outright', () => {
		expect(valueOf(createCurvedPath(LINE)).points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
	});

	it.each([
		['no points', []],
		['one point', [{ x: 1, y: 1 }]],
	])('refuses %s: a path needs two ends', (_label, points) => {
		expect(errOf(createCurvedPath({ points })).code).toBe('path-too-few-points');
	});

	it.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
	])('refuses a %s coordinate', (_label, value) => {
		expect(errOf(createCurvedPath({ points: [{ x: 0, y: 0 }, { x: value, y: 0 }] })).code).toBe('path-non-finite-coordinate');
	});

	/**
	 * The open analogue of a polygon's area rule (C02): a path is refused for having no LENGTH,
	 * never for enclosing nothing. Three coincident points are a click, not a line.
	 */
	it('refuses a path with no length at all, rather than asking it to enclose an area', () => {
		const stack = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }];
		expect(errOf(createCurvedPath({ points: stack })).code).toBe('path-degenerate');
	});

	it('accepts a path whose first segment is degenerate as long as the whole has length', () => {
		expect(valueOf(createCurvedPath({ points: [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 60, y: 5 }] })).points).toHaveLength(3);
	});

	/** One bulge per SEGMENT, which for an open path is one fewer than the points. */
	it('takes one bulge per segment', () => {
		const bowed = valueOf(createCurvedPath({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], bulges: [0.5, 0] }));
		expect(bowed.bulges).toEqual([0.5, 0]);
	});

	it('refuses a polygon-shaped bulge array, which would describe a closing edge a path does not have', () => {
		const closedShaped = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], bulges: [0.5, 0, 0] };
		expect(errOf(createCurvedPath(closedShaped)).code).toBe('curve-edge-count');
	});

	it('refuses a bulge beyond a semicircle, exactly as a closed boundary does', () => {
		expect(errOf(createCurvedPath({ ...LINE, bulges: [1.5] })).code).toBe('curve-bulge-invalid');
	});

	it('refuses an arc whose endpoints coincide, since it has no representable radius', () => {
		const pinched = { points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 80, y: 0 }], bulges: [0.5, 0] };
		expect(errOf(createCurvedPath(pinched)).code).toBe('curve-chord-invalid');
	});

	/**
	 * A path may cross itself. Nothing computes its interior, so the simple-boundary rule a
	 * curved POLYGON carries would refuse a legitimate drawing — a hinge line, a folded route —
	 * for breaking an invariant this type does not have.
	 */
	it('accepts a path that crosses itself', () => {
		const crossing = { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }] };
		expect(valueOf(createCurvedPath(crossing)).points).toHaveLength(4);
	});

	/** `createPolygon`'s rule, met from the other side: a validated path may not alias a caller's buffer. */
	it('copies both the array and its points, so a later write cannot reach what was validated', () => {
		const mutable = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
		const path = valueOf(createCurvedPath({ points: mutable }));
		mutable.push({ x: 20, y: 0 });
		(mutable[0] as { x: number }).x = Number.NaN;
		expect(path.points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
	});

	/** A zero-only bulge array is dropped, which is `createCurvedPolygon`'s own normalisation. */
	it('drops an all-zero bulge array rather than storing a row of noughts', () => {
		expect(valueOf(createCurvedPath({ ...LINE, bulges: [0] })).bulges).toBeUndefined();
	});
});

describe('pathPolyline', () => {
	it('answers the points themselves when nothing curves', () => {
		expect(pathPolyline(LINE)).toEqual(LINE.points);
	});

	/**
	 * The open counterpart of `polygonPolyline`, and the difference is the whole point: it emits
	 * the LAST point. A polygon drops each segment's end because the next segment starts there
	 * and the ring closes; a path has an end nothing follows, and dropping it would shorten
	 * every open graphic by its final vertex on every surface that draws one.
	 */
	it('keeps the final point, which a ring would have closed over', () => {
		const flat = pathPolyline({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }], bulges: [0.5, 0] });
		expect(flat[0]).toEqual({ x: 0, y: 0 });
		expect(flat.at(-1)).toEqual({ x: 100, y: 50 });
		expect(flat.length).toBeGreaterThan(3);
	});
});

/**
 * `pathPolyline` takes the UNVALIDATED input type, so a caller can hand it a bulge array shorter
 * than its segments — a mid-gesture buffer is exactly that. The missing entry reads as a straight
 * edge rather than throwing, which is `polygonPolyline`'s own answer to the same input.
 */
it('treats a segment with no bulge of its own as straight', () => {
	const flat = pathPolyline({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], bulges: [0.5] });
	expect(flat.at(-1)).toEqual({ x: 100, y: 100 });
	expect(flat).toContainEqual({ x: 100, y: 0 });
});
