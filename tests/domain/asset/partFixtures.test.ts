import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { validateAssetShape } from '../../../src/domain/asset/AssetShape';
import { isOk } from '../../../src/core/result/Result';
import { editableShape, shapeWithOpenGraphic, shapeWithParts } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';

/**
 * **F12's fixture family — the FIXTURE half of that row and not its measurement half.**
 * `ACCEPTANCE-AND-QA.md` §1 names F12 as "25, 250 and 1000 graphic parts with documented vertex
 * counts", and §6 asks for a 250-part fixture behind the selection and drag targets and a
 * 1000-part one "with documented path/vertex complexity" behind the stress target.
 *
 * What is asserted here is that the family EXISTS at the three sizes, that the counts
 * `shapeWithParts`'s docblock documents are the counts it builds, and that the real
 * `validateAssetShape` accepts every size — a fixture the domain would refuse is one no benchmark
 * could ever use. What is NOT asserted, anywhere, is a duration: this repository has no benchmark
 * harness (`npm run perf` is absent deliberately, and its trigger is a render cost somebody can
 * argue about) and no host to warm a renderer in, so §6's own preamble — "do not generalize
 * benchmark results to arbitrary hardware" — has nothing here to generalize from. A timing
 * assertion under vitest on shared CI hardware would be a flake wearing a gate's clothes.
 */

/** Every point on every graphic. A part's vertex count is its `points` length, open or closed. */
const vertexCount = (shape: AssetShape): number =>
	shape.details.reduce((total, detail) => total + detail.outline.points.length, 0);

/**
 * Every edge that actually curves.
 *
 * **The `?? []` fallback is load-bearing here**, measured rather than argued: `createCurvedPolygon`
 * drops `bulges` altogether when `hasCurves` is false, so a straight graphic reaches this with no
 * array at all, and removing the fallback fails five cases with `TypeError: Cannot read properties
 * of undefined (reading 'filter')`.
 *
 * **The `!== 0` filter is NOT exercised by anything in this file**, and this sentence says so
 * rather than claiming a reach it has not got. Every outline that reaches this counter carries
 * either no array (squares and open polylines) or four non-zero bulges (circles), so deleting the
 * filter leaves all 12 cases green — measured. It is still correct in general, guarding the MIXED
 * arrays `presetGeometry`'s `stadium` (`[0, 1, 0, 1]`) and `roundFront` (`[0, 0, 1, 0]`) produce,
 * and a `stadium` case to drive it was considered and refused: it buys a property this card does
 * not need, at the cost of a fixture nobody asked for.
 */
const curvedEdgeCount = (shape: AssetShape): number =>
	shape.details.reduce((total, detail) => total + (detail.outline.bulges ?? []).filter((bulge) => bulge !== 0).length, 0);

/** Parts by kind, told apart the way the domain tells them apart rather than by their ids. */
function kindCounts(shape: AssetShape): { squares: number; circles: number; openPaths: number } {
	const openPaths = shape.details.filter((detail) => detail.kind === 'open').length;
	const circles = shape.details.filter((detail) => detail.kind !== 'open' && (detail.outline.bulges ?? []).some((bulge) => bulge !== 0)).length;
	return { squares: shape.details.length - openPaths - circles, circles, openPaths };
}

describe('the counting instruments', () => {
	/**
	 * Proven on two shapes whose answers are countable by hand BEFORE they are pointed at a
	 * thousand parts, because a counter that reaches nothing reports the same zero a clean tree
	 * would. `editableShape` is one straight rectangle and one circle — 4 + 4 points, and the
	 * circle's four edges are the only curved ones on it.
	 */
	it('counts editableShape by hand: two graphics, eight vertices, four curved edges', () => {
		const shape = editableShape();
		expect(shape.details).toHaveLength(2);
		expect(vertexCount(shape)).toBe(8);
		expect(curvedEdgeCount(shape)).toBe(4);
		expect(kindCounts(shape)).toEqual({ squares: 1, circles: 1, openPaths: 0 });
	});

	/** The same two graphics plus `OPEN_POINTS`' three-point polyline: 11 vertices, still 4 curves. */
	it('counts the open graphic too: three graphics, eleven vertices, four curved edges', () => {
		const shape = shapeWithOpenGraphic();
		expect(shape.details).toHaveLength(3);
		expect(vertexCount(shape)).toBe(11);
		expect(curvedEdgeCount(shape)).toBe(4);
		expect(kindCounts(shape)).toEqual({ squares: 1, circles: 1, openPaths: 1 });
	});
});

/**
 * The table `shapeWithParts`'s own docblock carries. It is arithmetic over the three-kind cycle
 * (4-point square, 4-point circle, 3-point polyline) rather than a measurement, which is what lets
 * it be written down at all — and this case is what stops the builder and the sentence drifting
 * apart.
 */
const SIZES = [
	{ parts: 25, squares: 9, circles: 8, openPaths: 8, vertices: 92, curvedEdges: 32 },
	{ parts: 250, squares: 84, circles: 83, openPaths: 83, vertices: 917, curvedEdges: 332 },
	{ parts: 1000, squares: 334, circles: 333, openPaths: 333, vertices: 3667, curvedEdges: 1332 },
] as const;

describe('shapeWithParts — F12 at its three sizes', () => {
	it.each(SIZES)('builds $parts parts at the documented complexity', ({ parts, squares, circles, openPaths, vertices, curvedEdges }) => {
		const shape = shapeWithParts(parts);
		expect(shape.details).toHaveLength(parts);
		expect(kindCounts(shape)).toEqual({ squares, circles, openPaths });
		expect(vertexCount(shape)).toBe(vertices);
		expect(curvedEdgeCount(shape)).toBe(curvedEdges);
	});

	/**
	 * The builder already refuses an invalid shape — it composes through `validateAssetShape` and
	 * `expectOk` throws — so this asks the question the row actually promises instead: a shape that
	 * has BEEN through the validator survives being put through it again, at every size, with no
	 * part dropped. That is the property a benchmark rests on, and it is the one a cap anywhere in
	 * `AssetShape.ts` or `AssetDetail.ts` would break first.
	 */
	it.each(SIZES)('is accepted by the real validateAssetShape at $parts parts', ({ parts }) => {
		const revalidated = validateAssetShape(shapeWithParts(parts));
		expect(isOk(revalidated)).toBe(true);
		expect(expectOk(revalidated).details).toHaveLength(parts);
	});

	/**
	 * The docblock claims the parts sit INSIDE the object rather than piled on the origin, which is
	 * what makes a hit test or a rubber-band selection over this fixture resemble one over a real
	 * drawing. Nothing in the domain requires it — no rule relates a graphic to the footprint — so
	 * it is a claim in a comment and therefore gets a case.
	 *
	 * **It measures every part's VERTICES, not its arc envelope.** A bulged edge bows outside the
	 * chord between its endpoints, so a curved graphic can in principle reach past a box its points
	 * sit inside. That is not a gap here only because the one curved kind is `circle`, whose four
	 * points are cardinal and reach exactly the radius its arcs do — and the margin is 20 mm either
	 * way regardless. Widening this to envelopes would need `boundingBoxOf` over the arcs and buys
	 * nothing this fixture family can use.
	 */
	it.each(SIZES)('lays every part\'s vertices inside the footprint at $parts parts', ({ parts }) => {
		const shape = shapeWithParts(parts);
		const box = expectOk(boundingBoxOf(shape.footprint));
		const outside = shape.details.filter((detail) =>
			detail.outline.points.some((point) => point.x < box.min.x || point.x > box.max.x || point.y < box.min.y || point.y > box.max.y),
		);
		expect(outside.map((detail) => detail.id)).toEqual([]);
	});

	/** Distinct ids, which is what lets a selection fixture name one part out of a thousand. */
	it('gives every part its own id', () => {
		const shape = shapeWithParts(1000);
		expect(new Set(shape.details.map((detail) => detail.id)).size).toBe(1000);
	});
});
