/**
 * @file What the geometry operations do at the REPRESENTABLE LIMITS of a double.
 *
 * Extracted from `operations.test.ts` when that file crossed its 450-line cap — an extraction
 * rather than a reformat, because these nine describes are one subject and the rest of that file
 * is another. Every case here exists because a fix for one end of the range broke the other:
 *
 * - Translating the shoelace sum to the FIRST VERTEX rescued a small polygon far from the origin
 *   from cancelling to zero, and made a polygon spanning the range overflow to `NaN`.
 * - Translating to the bounding-box MIDPOINT fixed that, and left the third moments — one power
 *   higher than the area — overflowing for a polygon whose area and centroid are both fine.
 * - Conditioning the moments by a single shared factor fixed THAT, and erased the smaller axis of
 *   a polygon thin enough that one factor cannot describe both.
 *
 * So the shape of this file is the shape of the mistake it keeps catching: a numeric remedy aimed
 * at the case in front of you, which trades one false answer for another at the far end. Each
 * describe names the input, what it produces, and which guard it is holding down.
 */
import { describe, expect, it } from 'vitest';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { area, centroid, enclosesArea } from '../../../src/core/geometry/operations';

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

/**
 * The OPPOSITE end of the same helper's range, and the reason the finiteness question is asked
 * of all three consumers rather than of the one a review pointed at.
 *
 * Every coordinate here is finite, so `createPolygon` accepts the triangle — and the shoelace
 * PRODUCTS overflow: 1e308 x 1e308 is `Infinity`, and the translation that rescues the
 * cancelling case above cannot help, because there is nothing to cancel. Each consumer then
 * treated that as an ordinary number: `enclosesArea` read it as a real area and let
 * `validateAssetShape` persist the footprint, `centroid` divided infinite accumulators by it and
 * answered a confident `ok` carrying `NaN`, and `area` reported `Infinity` as a measurement —
 * which reaches a Requirement's quantity and its cost, since `Zone.area()` is the same call.
 *
 * A finite EXTENT does not mean a finite PRODUCT, which is `dimensionsOf`'s own recorded lesson
 * one axis over.
 */
describe('a polygon whose vertices are finite and whose area is not', () => {
	const OVERFLOWING = createPolygon([
		{ x: 0, y: 0 },
		{ x: 1e308, y: 0 },
		{ x: 0, y: 1e308 },
	]);

	it('is accepted as a polygon, because every coordinate is finite', () => {
		expect(OVERFLOWING.ok).toBe(true);
	});

	it('does not enclose a representable area', () => {
		expect(OVERFLOWING.ok && enclosesArea(OVERFLOWING.value)).toBe(false);
	});

	it('refuses to report an area rather than reporting an infinite one', () => {
		expect(OVERFLOWING.ok && area(OVERFLOWING.value)).toEqual({
			ok: false,
			error: expect.objectContaining({ code: 'polygon-area-overflow' }),
		});
	});

	it('refuses to weight a centroid rather than answering NaN', () => {
		expect(OVERFLOWING.ok && centroid(OVERFLOWING.value)).toEqual({
			ok: false,
			error: expect.objectContaining({ code: 'polygon-area-overflow' }),
		});
	});
});

/**
 * The translation that rescues the cancelling case can itself OVERFLOW, and the origin it
 * translates to is what decides whether it does.
 *
 * Every coordinate here is finite and the area is about 1 — computed on the raw coordinates the
 * shoelace sum is `-2`. Translating to the FIRST vertex subtracts `-1e308` from `1e308`, which
 * is `Infinity`, and the sum is then `NaN`: a polygon with a perfectly representable area
 * refused as unrepresentable. The remedy is not to stop translating, which reopens the
 * cancellation defect above, but to translate to the origin that MINIMISES the largest
 * difference — the midpoint of the bounding box, computed as `min / 2 + max / 2` so the
 * midpoint's own arithmetic cannot overflow either.
 *
 * Measured across all four cases before it was taken: the midpoint gives `-2` here where the
 * first vertex gives `NaN`, and gives the far-from-origin square and the 3-4-5 triangle exactly
 * the sums they already had.
 */
describe('a polygon whose coordinates span the whole double range', () => {
	const SPANNING = createPolygon([
		{ x: -1e308, y: 0 },
		{ x: 1e308, y: 1e-308 },
		{ x: 1e308, y: 0 },
	]);

	it('has its real area rather than being refused as unrepresentable', () => {
		expect(SPANNING.ok && area(SPANNING.value)).toEqual({ ok: true, value: expect.closeTo(1, 10) });
	});

	it('encloses an area', () => {
		expect(SPANNING.ok && enclosesArea(SPANNING.value)).toBe(true);
	});

	/**
	 * **This case used to assert a REFUSAL, and per-axis conditioning made the refusal wrong.**
	 *
	 * When the moments were summed on raw translated coordinates, the weights were finite and
	 * the shift back out of that frame was not, so the point came back as `Infinity` inside a
	 * confident `ok` — and a guard was added to refuse it. Scaling each axis by its own extent
	 * places this centroid exactly: one third of the way along, on both axes. So the guard was
	 * standing in for poor conditioning, and the honest answer is the number.
	 *
	 * The guard is NOT removed with it — see the bowtie below, which still reaches it.
	 */
	it('centroids at its real point, now that each axis is conditioned separately', () => {
		const result = SPANNING.ok && centroid(SPANNING.value);
		expect(result && result.ok).toBe(true);
		if (!result || !result.ok) return;
		// A third, COMPUTED — the decimal literal for it is not representable and `no-loss-of-
		// precision` refuses it, which is the same class of honesty this whole describe is about.
		expect(result.value.x / 1e307).toBeCloseTo(10 / 3, 6);
		expect(result.value.y / 1e-309).toBeCloseTo(10 / 3, 6);
	});
});

/**
 * The OTHER non-finite sum, and the reason `enclosesArea` needs its finiteness conjunct at all.
 *
 * The overflow case above sums to `NaN`, because its translated cross products straddle zero and
 * infinity — and `Math.abs(NaN) / 2 > 0` is already `false`, so that case cannot tell whether the
 * `Number.isFinite` half is doing any work. A square whose vertices all share a magnitude sums to
 * `+Infinity` instead, with no opposing term to cancel it, and there `Math.abs(sum) / 2 > 0` is
 * `TRUE`: without the finiteness test `validateAssetShape` would accept it.
 *
 * Measured rather than assumed — deleting that conjunct left the whole geometry suite green until
 * this case existed, which is the untested-conjunct shape this repository has a rule about.
 */
describe('a polygon whose area sum saturates rather than cancelling', () => {
	const SATURATED = createPolygon([
		{ x: -1e160, y: -1e160 },
		{ x: 1e160, y: -1e160 },
		{ x: 1e160, y: 1e160 },
		{ x: -1e160, y: 1e160 },
	]);

	it('does not enclose a representable area', () => {
		expect(SATURATED.ok && enclosesArea(SATURATED.value)).toBe(false);
	});

	it('refuses to report an area', () => {
		expect(SATURATED.ok && area(SATURATED.value)).toEqual({
			ok: false,
			error: expect.objectContaining({ code: 'polygon-area-overflow' }),
		});
	});
});

/**
 * A polygon whose AREA is representable and whose third moments are not.
 *
 * `centroid` accumulates `(ax + bx) * w`, one power of the coordinates above the shoelace sum
 * itself — so a rectangle at `(±5e153, ±2.5e153)` has a finite `cross` of `1e308`, an area of
 * `5e307`, and a centroid of exactly `(0, 0)`, while the accumulators reach opposing infinities
 * and cancel to `NaN`. The overflow guard added one round earlier then refused a centroid that
 * is not merely representable but is the ORIGIN.
 *
 * The remedy is conditioning rather than a wider guard: the accumulation runs on coordinates
 * divided by the largest translated magnitude, and the answer is multiplied back. Sound because
 * the centroid is translation-equivariant AND scale-equivariant — scaling every vertex by `k`
 * scales `w` by `k²`, the moments by `k³` and their quotient by `k` — so the same subtraction
 * and the same division answer in either frame, and only the intermediates change size.
 */
describe('a polygon whose third moments overflow but whose centroid does not', () => {
	const HUGE = createPolygon([
		{ x: -5e153, y: -2.5e153 },
		{ x: 5e153, y: -2.5e153 },
		{ x: 5e153, y: 2.5e153 },
		{ x: -5e153, y: 2.5e153 },
	]);

	it('has a representable area', () => {
		expect(HUGE.ok && area(HUGE.value)).toEqual({ ok: true, value: 5e307 });
	});

	it('centroids at the origin rather than refusing as unrepresentable', () => {
		expect(HUGE.ok && centroid(HUGE.value)).toEqual({ ok: true, value: { x: 0, y: 0 } });
	});
});

/**
 * `enclosesArea` and `area` must answer the same question, and a docblock claiming they did was
 * the thing that was wrong.
 *
 * That comment read: *"`Math.abs(sum) / 2 > 0` and `Math.abs(sum) > 0` answer identically, so the
 * halving is dropped."* False for exactly one double — `Number.MIN_VALUE` is greater than zero
 * and halves to zero — so a polygon summing to it would enclose an area by one function and none
 * by the other, and `validateAssetShape` would persist a footprint `area()` reports as `0`.
 *
 * **Measured, and the honest report is that no polygon found produces it.** The reported triangle
 * `(0,0), (1,0), (0, MIN_VALUE)` sums to `MIN_VALUE` under the FIRST-VERTEX origin this module
 * used before the overflow fix, and to exactly `0` under the bounding-box midpoint it uses now —
 * so it is correctly refused today, and a search over 4096 (width, height) pairs in denormal
 * steps found none that lands on `MIN_VALUE` either. The fix is therefore not driven by a
 * reachable case: it is that two functions answering one question should agree BY CONSTRUCTION
 * rather than by an argument about denormals that has already been wrong once.
 */
/**
 * A polygon THIN enough that one shared scale factor erases an axis — the defect the
 * conditioning fix introduced, one round after the overflow it was written for.
 *
 * `(-1e200, 0), (1e200, 1e-124), (1e200, 0)` has an area of about 1e76 and a perfectly
 * representable centroid, and dividing BOTH axes by the largest magnitude (1e200) underflows
 * every y to exactly zero: `crossScaled` becomes `0` and the polygon is refused as
 * unrepresentable. A false refusal traded for a false refusal, which is what a conditioning
 * step gets wrong when it treats an anisotropic shape as if it had one size.
 *
 * Scaled PER AXIS instead. The algebra survives the split: dividing x by `sx` and y by `sy`
 * divides each `w` by `sx * sy`, the x-moments by `sx * sx * sy` and the y-moments by
 * `sx * sy * sy`, so the two quotients come back multiplied by `sx` and `sy` respectively —
 * one factor each, exactly as the shared-scale version returned one factor of `unit`.
 */
describe('a polygon whose axes differ by hundreds of orders of magnitude', () => {
	const THIN = createPolygon([
		{ x: -1e200, y: 0 },
		{ x: 1e200, y: 1e-124 },
		{ x: 1e200, y: 0 },
	]);

	it('has a representable area', () => {
		expect(THIN.ok && area(THIN.value)).toEqual({ ok: true, value: expect.closeTo(1e76, -70) });
	});

	it('encloses an area', () => {
		expect(THIN.ok && enclosesArea(THIN.value)).toBe(true);
	});

	it('centroids at its real point rather than refusing as unrepresentable', () => {
		const result = THIN.ok && centroid(THIN.value);
		expect(result && result.ok).toBe(true);
		if (!result || !result.ok) return;
		expect(result.value.x / 1e199).toBeCloseTo(10 / 3, 6);
		expect(result.value.y / 1e-125).toBeCloseTo(10 / 3, 6);
	});
});

/**
 * The input that keeps `polygon-centroid-overflow` alive once conditioning removed its first
 * one, and it is a shape this module deliberately does not refuse: a SELF-INTERSECTING polygon.
 *
 * `validatePolygonPoints` asks for three or more finite points and says nothing about
 * simplicity, so a bowtie is a legal `Polygon` here. Its area-weighted centroid is not
 * constrained to the convex hull the way a simple polygon's is — this one's normalised centroid
 * lands about 1.5e15 unit-lengths out, on a `crossScaled` of 1.8e-15 — so multiplying back by an
 * extent near the representable limit overflows however well each axis is scaled.
 *
 * Which is why the guard stays: conditioning fixed the case it was written for and did not fix
 * the class. A guard removed because the one input anybody had stopped reaching it is a guard
 * removed on the strength of a sample.
 */
describe('a self-intersecting polygon whose weighted centroid escapes its own extent', () => {
	// The y-extent must be TINY as well as the x-extent huge, and finding that out is the
	// case's own lesson. A bowtie at (+/-1e308, +/-1) overflows the UNSCALED shoelace sum, so
	// it refuses at `polygon-area-overflow` two guards earlier and never reaches this one — a
	// first draft asserted the centroid code against exactly that shape and failed, because the
	// simulation used to find it computed only the conditioned sum and not the one the code
	// checks first. At y = +/-1e-280 the unscaled sum is about 1.8e13, finite and usable, while
	// the conditioned centroid still lands 1.5e15 unit-lengths out.
	const BOWTIE = createPolygon([
		{ x: -1e308, y: -1e-280 },
		{ x: 1e308, y: 1e-280 },
		{ x: 1e308, y: -1e-280 },
		{ x: -1e308, y: 1e-280 * (1 + 1e-15) },
	]);

	it('refuses to place a centroid it cannot represent', () => {
		expect(BOWTIE.ok && centroid(BOWTIE.value)).toEqual({
			ok: false,
			error: expect.objectContaining({ code: 'polygon-centroid-overflow' }),
		});
	});
});

describe('the degeneracy predicate and the area it stands for', () => {
	it.each([
		['a unit triangle', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }]],
		['a collinear set', [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }]],
		['a denormal sliver', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: Number.MIN_VALUE }]],
		['a subnormal square', [
			{ x: -Number.MIN_VALUE, y: -Number.MIN_VALUE },
			{ x: Number.MIN_VALUE, y: -Number.MIN_VALUE },
			{ x: Number.MIN_VALUE, y: Number.MIN_VALUE },
			{ x: -Number.MIN_VALUE, y: Number.MIN_VALUE },
		]],
	])('agree for %s', (_name, points) => {
		const polygon = createPolygon(points);
		expect(polygon.ok).toBe(true);
		if (!polygon.ok) return;
		const measured = area(polygon.value);
		expect(measured.ok).toBe(true);
		if (!measured.ok) return;
		expect(enclosesArea(polygon.value)).toBe(measured.value > 0);
	});
});

/**
 * The degenerate case keeps its OWN code, so the two refusals stay distinguishable: a
 * collinear vertex set encloses nothing, and an overflowing one encloses something nobody can
 * represent. Collapsing them would put "these vertices are collinear" over a triangle with
 * three corners.
 */
describe('a collinear polygon', () => {
	const COLLINEAR = createPolygon([
		{ x: 0, y: 0 },
		{ x: 10, y: 10 },
		{ x: 20, y: 20 },
	]);

	it('does not enclose an area', () => {
		expect(COLLINEAR.ok && enclosesArea(COLLINEAR.value)).toBe(false);
	});

	it('still reports an area of zero rather than refusing', () => {
		expect(COLLINEAR.ok && area(COLLINEAR.value)).toEqual({ ok: true, value: 0 });
	});

	it('refuses a centroid under the zero-area code', () => {
		expect(COLLINEAR.ok && centroid(COLLINEAR.value)).toEqual({
			ok: false,
			error: expect.objectContaining({ code: 'polygon-zero-area' }),
		});
	});
});
