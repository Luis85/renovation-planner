import { describe, expect, it } from 'vitest';
import {
	dimensionsOf,
	footprintFromDimensions,
	normaliseFacing,
	shapeFromDimensions,
	validateAssetShape,
	type AssetShape,
} from '../../../src/domain/asset/AssetShape';
import { isErr, isOk } from '../../../src/core/result/Result';
import { createPolygon } from '../../../src/core/geometry/Polygon';

/**
 * Built through the real constructor rather than hand-written, so a field added to
 * `AssetShape` reaches every case here the day it exists instead of being spread over a
 * literal that still compiles without it.
 */
function typedShapeFixture(): AssetShape {
	const shape = shapeFromDimensions(1200, 800);
	if (!isOk(shape)) throw new Error('fixture');
	return shape.value;
}

const typedShape = typedShapeFixture();

const square = [
	{ x: -10, y: -10 },
	{ x: 10, y: -10 },
	{ x: 10, y: 10 },
	{ x: -10, y: 10 },
];

describe('footprintFromDimensions', () => {
	it('centres a rectangle on the origin so the anchor default is meaningful', () => {
		const result = footprintFromDimensions(1200, 800);
		expect(isOk(result)).toBe(true);
		if (!isOk(result)) return;
		expect(result.value.points).toEqual([
			{ x: -600, y: -400 }, { x: 600, y: -400 },
			{ x: 600, y: 400 }, { x: -600, y: 400 },
		]);
	});

	it('refuses a non-positive dimension, which would be a degenerate polygon', () => {
		const result = footprintFromDimensions(0, 800);
		expect(isErr(result)).toBe(true);
		if (!isErr(result)) return;
		expect(result.error.code).toBe('asset.non-positive-dimension');
	});

	it('refuses a non-finite dimension AT the polygon validator, which is the one gate for it', () => {
		// Asserting the code, not merely `isErr`: NaN passes the sign guard (every NaN
		// comparison is false) and is refused by `createPolygon`, which is what keeps that
		// refusal arm reachable instead of dead.
		const nan = footprintFromDimensions(Number.NaN, 800);
		expect(isErr(nan) && nan.error.code).toBe('asset.invalid-footprint');
		const infinite = footprintFromDimensions(Number.POSITIVE_INFINITY, 800);
		expect(isErr(infinite) && infinite.error.code).toBe('asset.invalid-footprint');
	});

	it('still refuses a NEGATIVE infinity as a sign error, since that guard sees it first', () => {
		const result = footprintFromDimensions(Number.NEGATIVE_INFINITY, 800);
		expect(isErr(result) && result.error.code).toBe('asset.non-positive-dimension');
	});

	it('checks the second dimension too, not only the first', () => {
		const result = footprintFromDimensions(1200, -5);
		expect(isErr(result) && result.error.code).toBe('asset.non-positive-dimension');
	});
});

describe('dimensionsOf', () => {
	it('reads the bounding box, so a traced outline needs no typed numbers beside it', () => {
		const traced = footprintFromDimensions(1200, 800);
		if (!isOk(traced)) throw new Error('fixture');
		const dims = dimensionsOf(traced.value);
		expect(isOk(dims) && dims.value).toEqual({ width: 1200, depth: 800 });
	});

	it('answers the geometry refusal for a point set no box can be taken over', () => {
		// `Polygon` is deliberately unvalidated at the type level, so an empty vertex
		// buffer is representable and this arm is reachable rather than defensive.
		const dims = dimensionsOf({ points: [] });
		expect(isErr(dims) && dims.error.category).toBe('Geometry');
	});
	it('refuses an extent that overflows, rather than reporting Infinity as a measurement', () => {
		// Every boundary below this one admits coordinates ONE AT A TIME, so each of these
		// is finite and their difference is not. A non-finite width presented as a
		// measurement is what the unscaled marker exists to prevent, and JSON.stringify
		// would persist it as null.
		const wide = createPolygon([
			{ x: -1e308, y: 0 },
			{ x: 1e308, y: 0 },
			{ x: 1e308, y: 10 },
		]);
		if (!isOk(wide)) throw new Error('fixture: each coordinate is finite');
		const result = dimensionsOf(wide.value);
		expect(isErr(result) && result.error.code).toBe('dimensions-overflow');
	});
});

describe('normaliseFacing', () => {
	it('folds a negative angle into [0, 2π)', () => {
		expect(normaliseFacing(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10);
	});

	it('folds exactly 2π to 0 rather than leaving two spellings of north', () => {
		expect(normaliseFacing(Math.PI * 2)).toBe(0);
	});

	it('answers 0 for a non-finite angle rather than propagating NaN into stored geometry', () => {
		expect(normaliseFacing(Number.NaN)).toBe(0);
		expect(normaliseFacing(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('shapeFromDimensions', () => {
	it('starts every shape typed, unpending, centred, facing +x and without a clearance', () => {
		expect(typedShape).toEqual({
			footprint: { points: [
				{ x: -600, y: -400 }, { x: 600, y: -400 },
				{ x: 600, y: 400 }, { x: -600, y: 400 },
			] },
			footprintOrigin: 'typed',
			footprintPending: false,
			clearancePending: false,
			anchorPending: false,
			clearance: null,
			anchor: { x: 0, y: 0 },
			facing: 0,
		});
	});

	it('propagates the dimension refusal rather than inventing a shape around it', () => {
		const result = shapeFromDimensions(0, 800);
		expect(isErr(result) && result.error.code).toBe('asset.non-positive-dimension');
	});
});

describe('validateAssetShape', () => {
	it('accepts the shape the constructor produces', () => {
		expect(isOk(validateAssetShape(typedShape))).toBe(true);
	});

	it('refuses a typed footprint marked as awaiting a scale', () => {
		const result = validateAssetShape({ ...typedShape, footprintPending: true });
		expect(isErr(result) && result.error.code).toBe('asset.typed-footprint-cannot-be-pending');
	});

	it('leaves a TRACED footprint free to be pending, which is the whole point of the flag', () => {
		const result = validateAssetShape({
			...typedShape,
			footprintOrigin: 'traced',
			footprintPending: true,
		});
		expect(isOk(result)).toBe(true);
	});

	it('refuses a pending clearance on a shape that has no clearance', () => {
		const result = validateAssetShape({ ...typedShape, clearance: null, clearancePending: true });
		expect(isErr(result) && result.error.code).toBe('asset.absent-clearance-cannot-be-pending');
	});

	it('accepts a pending clearance once there are clearance coordinates to be pending about', () => {
		const result = validateAssetShape({
			...typedShape,
			clearance: { points: square },
			clearancePending: true,
		});
		expect(isOk(result)).toBe(true);
	});

	it('refuses a two-point footprint, which is not a polygon at all', () => {
		const result = validateAssetShape({
			...typedShape,
			footprint: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
		});
		expect(isErr(result) && result.error.code).toBe('asset.invalid-footprint');
	});

	it('refuses a two-point clearance under its own code, so the message names the right outline', () => {
		const result = validateAssetShape({
			...typedShape,
			clearance: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
		});
		expect(isErr(result) && result.error.code).toBe('asset.invalid-clearance');
	});

	it('refuses a NaN anchor', () => {
		const result = validateAssetShape({ ...typedShape, anchor: { x: Number.NaN, y: 0 } });
		expect(isErr(result) && result.error.code).toBe('asset.invalid-anchor');
	});

	it('refuses a non-finite facing', () => {
		const result = validateAssetShape({ ...typedShape, facing: Number.POSITIVE_INFINITY });
		expect(isErr(result) && result.error.code).toBe('asset.invalid-facing');
	});

	it('normalises the facing on the way through, not only in normaliseFacing own test', () => {
		const result = validateAssetShape({ ...typedShape, facing: Math.PI * 2 });
		expect(isOk(result) && result.value.facing).toBe(0);
	});

	it('returns the VALIDATED copies, so a later mutation of the caller buffer cannot break it', () => {
		// createPolygon copies deliberately — "the caller keeps its (mutable) buffer
		// mid-gesture, and a push after construction must not be able to break the invariant
		// just validated". Spreading the input shape threw those copies away and handed back
		// the caller's own arrays, reintroducing that hazard one layer up.
		const footprint = [...square];
		const clearance = [...square];
		const result = validateAssetShape({ ...typedShape, footprint: { points: footprint }, clearance: { points: clearance } });
		expect(isOk(result)).toBe(true);
		if (!isOk(result)) return;

		footprint.length = 2;
		clearance.length = 2;

		expect(result.value.footprint.points).toHaveLength(4);
		expect(result.value.clearance?.points).toHaveLength(4);
	});

	it('detaches the ANCHOR too, which the polygon fix alone left aliased', () => {
		// The same defect class as the polygons, in the one field a reader is least likely
		// to look at: `{ ...shape }` carries the caller's anchor object by reference, so a
		// write through their own mutable-typed handle invalidates a validated shape without
		// crossing this boundary again. Point.x is readonly, which stops the write through
		// THIS type and not through the reference the caller kept.
		const anchor = { x: 10, y: 20 };
		const result = validateAssetShape({ ...typedShape, anchor });
		expect(isOk(result)).toBe(true);
		if (!isOk(result)) return;

		anchor.x = Number.NaN;

		expect(result.value.anchor).toEqual({ x: 10, y: 20 });
	});
});
