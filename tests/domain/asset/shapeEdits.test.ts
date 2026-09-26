import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { circle } from '../../../src/domain/asset/presets/presetGeometry';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { solveScale } from '../../../src/domain/asset/scaleSolve';
import {
	markClearanceReviewed,
	moveAnchor,
	moveOutline,
	moveVertex,
	outlineOf,
	removeClearance,
	resizeBox,
	rotateOutline,
	scaleDesign,
	scaleDesignToDimensions,
	setBulge,
	setFacing,
	type OutlinePart,
} from '../../../src/domain/asset/shapeEdits';
import { closedOutlineOf, editableShape, QUARTER } from '../../helpers/assetShapes';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';

/**
 * Spec 2026-09-13 Decision 9 and Amendment 1: every part edit answers a validated shape or a
 * refusal. `editableShape` puts every kind of part at round numbers, so a straight result is
 * compared exactly and one that went through trigonometry is compared through `near`.
 */
const FOOTPRINT: OutlinePart = { kind: 'footprint' };
const CLEARANCE: OutlinePart = { kind: 'clearance' };
const TOP: OutlinePart = { kind: 'detail', id: 'detail-1' };
const BOWL: OutlinePart = { kind: 'detail', id: 'detail-2' };
const MISSING: OutlinePart = { kind: 'detail', id: 'detail-9' };
const ALL_QUARTERS = [QUARTER, QUARTER, QUARTER, QUARTER];

const near = (pairs: readonly (readonly [number, number])[]) =>
	pairs.map(([x, y]) => ({ x: expect.closeTo(x, 9), y: expect.closeTo(y, 9) }));

const widthOf = (shape: AssetShape) => expectOk(dimensionsOf(shape.footprint)).width;
const depthOf = (shape: AssetShape) => expectOk(dimensionsOf(shape.footprint)).depth;

describe('outlineOf', () => {
	it('names the footprint, the clearance and a detail by id', () => {
		const shape = editableShape();
		expect(outlineOf(shape, FOOTPRINT)).toBe(shape.footprint);
		expect(outlineOf(shape, CLEARANCE)).toBe(shape.clearance);
		expect(outlineOf(shape, BOWL)).toBe(shape.details[1].outline);
	});

	it('answers null for a clearance the shape has not got and for an unknown detail', () => {
		expect(outlineOf(editableShape({ clearance: null }), CLEARANCE)).toBeNull();
		expect(outlineOf(editableShape(), MISSING)).toBeNull();
	});
});

describe('moveOutline', () => {
	it('moves the footprint and keeps its origin and pending flag', () => {
		const traced = editableShape({ footprintOrigin: 'traced', footprintPending: true });
		const moved = expectOk(moveOutline(traced, FOOTPRINT, { dx: 10, dy: -20 }));
		expect(moved.footprint.points).toEqual([{ x: -490, y: -320 }, { x: 510, y: -320 }, { x: 510, y: 280 }, { x: -490, y: 280 }]);
		expect([moved.footprintOrigin, moved.footprintPending]).toEqual(['traced', true]);
	});

	it('moves a pending curved detail as itself, and leaves its neighbour alone', () => {
		const before = editableShape();
		const moved = expectOk(moveOutline(before, BOWL, { dx: 0, dy: 50 }));
		const bowl = moved.details[1];
		expect([bowl.id, bowl.name, bowl.line, bowl.pending]).toEqual(['detail-2', 'bowl', 'dashed', true]);
		expect(bowl.outline.points).toEqual(near([[250, -50], [350, 50], [250, 150], [150, 50]]));
		expect(bowl.outline.bulges).toEqual(ALL_QUARTERS);
		expect(moved.details[0]).toEqual(before.details[0]);
	});

	it('moves the clearance', () => {
		const moved = expectOk(moveOutline(editableShape(), CLEARANCE, { dx: 5, dy: 5 }));
		expect(moved.clearance?.points).toEqual([{ x: -695, y: -295 }, { x: 705, y: -295 }, { x: 705, y: 705 }, { x: -695, y: 705 }]);
	});

	it('refuses a part the shape has not got', () => {
		expect(expectErr(moveOutline(editableShape(), MISSING, { dx: 1, dy: 0 })).code).toBe('asset.part-not-found');
		expect(expectErr(moveOutline(editableShape({ clearance: null }), CLEARANCE, { dx: 1, dy: 0 })).code).toBe('asset.part-not-found');
	});
});

describe('moveVertex', () => {
	it('moves one corner of the footprint', () => {
		const moved = expectOk(moveVertex(editableShape(), FOOTPRINT, 2, { x: 600, y: 400 }));
		expect(moved.footprint.points).toEqual([{ x: -500, y: -300 }, { x: 500, y: -300 }, { x: 600, y: 400 }, { x: -500, y: 300 }]);
	});

	it('keeps a curved outline curved, because the point count is unchanged', () => {
		const moved = expectOk(moveVertex(editableShape(), BOWL, 0, { x: 250, y: -110 }));
		expect(moved.details[1].outline.points[0]).toEqual({ x: 250, y: -110 });
		expect(moved.details[1].outline.bulges).toEqual(ALL_QUARTERS);
	});

	it('refuses a move that leaves the footprint enclosing no area', () => {
		const triangle = editableShape({ footprint: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] } });
		expect(expectErr(moveVertex(triangle, FOOTPRINT, 2, { x: 50, y: 0 })).code).toBe('asset.degenerate-footprint');
	});

	it.each([4, -1, 1.5])('refuses vertex index %s of a four-corner outline', (index) => {
		expect(expectErr(moveVertex(editableShape(), FOOTPRINT, index, { x: 0, y: 0 })).code).toBe('asset.vertex-out-of-range');
	});

	it('refuses a detail the shape has not got', () => {
		expect(expectErr(moveVertex(editableShape(), MISSING, 0, { x: 0, y: 0 })).code).toBe('asset.part-not-found');
	});
});

describe('setBulge', () => {
	it('bends one straight edge, writing a bulge for every edge', () => {
		const bent = expectOk(setBulge(editableShape(), TOP, 1, 0.5));
		expect(bent.details[0].outline.bulges).toEqual([0, 0.5, 0, 0]);
	});

	it('replaces one edge of a curved outline and keeps the others', () => {
		const straightened = expectOk(setBulge(editableShape(), BOWL, 2, 0));
		expect(straightened.details[1].outline.bulges).toEqual([QUARTER, QUARTER, 0, QUARTER]);
	});

	it('refuses a bend past a semicircle under the outline’s own code', () => {
		expect(expectErr(setBulge(editableShape(), FOOTPRINT, 0, 1.5)).code).toBe('asset.invalid-footprint');
	});

	it('refuses an edge the outline has not got', () => {
		expect(expectErr(setBulge(editableShape(), FOOTPRINT, 4, 0.2)).code).toBe('asset.vertex-out-of-range');
	});
});

describe('resizeBox', () => {
	it('scales the footprint about a fixed corner, each axis by its own factor', () => {
		const resized = expectOk(resizeBox(editableShape(), FOOTPRINT, { sx: 1.5, sy: 0.5 }, { x: -500, y: -300 }));
		expect(resized.footprint.points).toEqual([{ x: -500, y: -300 }, { x: 1000, y: -300 }, { x: 1000, y: 0 }, { x: -500, y: 0 }]);
	});

	/**
	 * The spec's stated behaviour: arcs stay circular through their new chords. A circle of diameter
	 * 200 doubled along x keeps four quarter arcs, now through chords of 100√5 with radius 50√10 —
	 * so its width is exactly 400 and its depth bulges past the top and bottom corners to 100√10 − 100.
	 */
	it('keeps bulges through a non-uniform resize', () => {
		const resized = expectOk(resizeBox(editableShape(), BOWL, { sx: 2, sy: 1 }, { x: 250, y: 0 }));
		const bowl = resized.details[1];
		expect(bowl.outline.bulges).toEqual(ALL_QUARTERS);
		expect([bowl.id, bowl.line, bowl.pending]).toEqual(['detail-2', 'dashed', true]);
		const box = expectOk(boundingBoxOf(closedOutlineOf(bowl)));
		expect(box.max.x - box.min.x).toBeCloseTo(400, 6);
		expect(box.max.y - box.min.y).toBeCloseTo(100 * Math.sqrt(10) - 100, 6);
	});

	it.each([
		[0, 1],
		[1, -2],
		[Number.NaN, 1],
		[1, Number.POSITIVE_INFINITY],
	])('refuses the factors %s by %s', (sx, sy) => {
		expect(expectErr(resizeBox(editableShape(), FOOTPRINT, { sx, sy }, { x: 0, y: 0 })).code).toBe('asset.invalid-scale');
	});

	it('refuses a clearance the shape has not got', () => {
		const refused = resizeBox(editableShape({ clearance: null }), CLEARANCE, { sx: 2, sy: 2 }, { x: 0, y: 0 });
		expect(expectErr(refused).code).toBe('asset.part-not-found');
	});
});

describe('rotateOutline', () => {
	it('turns the footprint a quarter about the origin', () => {
		const turned = expectOk(rotateOutline(editableShape(), FOOTPRINT, Math.PI / 2, { x: 0, y: 0 }));
		expect(turned.footprint.points).toEqual([{ x: 300, y: -500 }, { x: 300, y: 500 }, { x: -300, y: 500 }, { x: -300, y: -500 }]);
	});

	it('preserves bulges', () => {
		const turned = expectOk(rotateOutline(editableShape(), BOWL, Math.PI / 2, { x: 250, y: 0 }));
		expect(turned.details[1].outline.points).toEqual(near([[350, 0], [250, 100], [150, 0], [250, -100]]));
		expect(turned.details[1].outline.bulges).toEqual(ALL_QUARTERS);
	});

	it('refuses a detail the shape has not got', () => {
		expect(expectErr(rotateOutline(editableShape(), MISSING, 1, { x: 0, y: 0 })).code).toBe('asset.part-not-found');
	});
});

describe('moveAnchor and setFacing', () => {
	it('moves the anchor and keeps its pending flag', () => {
		const moved = expectOk(moveAnchor(editableShape({ anchorPending: true }), { x: 10, y: 20 }));
		expect(moved.anchor).toEqual({ x: 10, y: 20 });
		expect(moved.anchorPending).toBe(true);
	});

	it('refuses an anchor that is not a finite point', () => {
		expect(expectErr(moveAnchor(editableShape(), { x: Number.NaN, y: 0 })).code).toBe('asset.invalid-anchor');
	});

	it('passes the facing through validation, which folds it into one turn', () => {
		expect(expectOk(setFacing(editableShape(), 3 * Math.PI)).facing).toBeCloseTo(Math.PI, 12);
	});

	it('refuses a facing that is not a finite angle', () => {
		expect(expectErr(setFacing(editableShape(), Number.POSITIVE_INFINITY)).code).toBe('asset.invalid-facing');
	});
});

describe('removeClearance', () => {
	it('removes the clearance and its pending flag, which validation refuses on an absent clearance', () => {
		const removed = expectOk(removeClearance(editableShape({ clearancePending: true })));
		expect([removed.clearance, removed.clearancePending]).toEqual([null, false]);
	});

	it('removes the REVIEW flag too, which validation refuses on an absent clearance for the same reason', () => {
		const removed = expectOk(removeClearance(editableShape({ clearanceNeedsReview: true })));
		expect([removed.clearance, removed.clearanceNeedsReview]).toEqual([null, false]);
	});

	it('refuses a shape with no clearance', () => {
		expect(expectErr(removeClearance(editableShape({ clearance: null }))).code).toBe('asset.part-not-found');
	});
});

/**
 * AD14-R1's clear-the-flag rule, which it states as a RULE and deliberately not as a list: *cleared
 * by any write whose SUBJECT is the clearance itself, because a gesture aimed at the clearance IS
 * the review.* The two paths a clearance edit can take are `mapPartOutline` (whole-outline
 * transforms) and `withOutline` via `editOutline` (a vertex, an edge's bulge), so both get a case —
 * and the footprint's own edit gets the counter-case, because a rule that cleared on every edit
 * would pass the first two and be wrong.
 */
describe('the clearance review flag', () => {
	it('comes down when the clearance itself is transformed, through either path', () => {
		const flagged = editableShape({ clearanceNeedsReview: true });
		expect(expectOk(moveOutline(flagged, CLEARANCE, { dx: 10, dy: 0 })).clearanceNeedsReview).toBe(false);
		expect(expectOk(moveVertex(flagged, CLEARANCE, 0, { x: -800, y: -300 })).clearanceNeedsReview).toBe(false);
	});

	it('stays up when the edit names another part, because that is not a review of the boundary', () => {
		const flagged = editableShape({ clearanceNeedsReview: true });
		expect(expectOk(moveOutline(flagged, FOOTPRINT, { dx: 10, dy: 0 })).clearanceNeedsReview).toBe(true);
		expect(expectOk(moveOutline(flagged, TOP, { dx: 10, dy: 0 })).clearanceNeedsReview).toBe(true);
		expect(expectOk(moveAnchor(flagged, { x: 5, y: 5 })).clearanceNeedsReview).toBe(true);
		expect(expectOk(setFacing(flagged, Math.PI / 2)).clearanceNeedsReview).toBe(true);
	});

	it('markClearanceReviewed answers the notice and moves not one coordinate', () => {
		const flagged = editableShape({ clearanceNeedsReview: true });
		const reviewed = expectOk(markClearanceReviewed(flagged));
		expect(reviewed.clearanceNeedsReview).toBe(false);
		expect(reviewed.clearance?.points).toEqual(flagged.clearance?.points);
		expect(reviewed.footprint.points).toEqual(flagged.footprint.points);
	});
});

describe('scaleDesign', () => {
	/**
	 * **AMENDED at AD14, not replaced.** This case used to pin the clearance's SCALED points
	 * literally — `[{ x: -1500, y: -150 }, { x: 1300, y: -150 }, { x: 1300, y: 350 }, { x: -1500, y: 350 }]`,
	 * which is `editableShape`'s 1400 x 1000 boundary put through the same 2 x 0.5 the footprint
	 * takes. That was correct behaviour for its whole life and stopped being correct at ruling
	 * AD14-R1 / ADR-0034: a MEASURED clearance is an authored planning boundary, so it is preserved
	 * at the size somebody drew and flagged for review rather than silently redrawn at a size
	 * nobody chose. The literal is kept as the fixture's UNSCALED coordinates below, which is the
	 * same list the shape went in with — the point of the case is still that every OTHER part
	 * moved.
	 */
	it('scales every part about the anchor, which does not move, and carries pending flags', () => {
		const scaled = expectOk(scaleDesign(editableShape({ anchor: { x: 100, y: 0 } }), 2, 0.5));
		expect(scaled.anchor).toEqual({ x: 100, y: 0 });
		expect(scaled.footprint.points).toEqual([{ x: -1100, y: -150 }, { x: 900, y: -150 }, { x: 900, y: 150 }, { x: -1100, y: 150 }]);
		// PRESERVED, not scaled: `editableShape`'s own 1400 x 1000 clearance, unmoved (AD14-R1).
		expect(scaled.clearance?.points).toEqual([{ x: -700, y: -300 }, { x: 700, y: -300 }, { x: 700, y: 700 }, { x: -700, y: 700 }]);
		expect(scaled.clearanceNeedsReview).toBe(true);
		expect(scaled.details[0].outline.points).toEqual([{ x: -900, y: -50 }, { x: -100, y: -50 }, { x: -100, y: 50 }, { x: -900, y: 50 }]);
		expect(scaled.details[1].pending).toBe(true);
	});

	/**
	 * The other half of `r1` row 2, which AD14 leaves exactly as it found it: a PENDING clearance's
	 * coordinates are background pixels, the whole capture shares one space, and scaling them
	 * weakens nothing that is yet a measurement. So it scales with everything else and the flag is
	 * NOT set — the literal here is the one the case above gave up.
	 */
	it('goes on scaling a PENDING clearance, and flags nothing, because those are not millimetres yet', () => {
		const scaled = expectOk(scaleDesign(editableShape({ anchor: { x: 100, y: 0 }, clearancePending: true }), 2, 0.5));
		expect(scaled.clearance?.points).toEqual([{ x: -1500, y: -150 }, { x: 1300, y: -150 }, { x: 1300, y: 350 }, { x: -1500, y: 350 }]);
		expect(scaled.clearanceNeedsReview ?? false).toBe(false);
		expect(scaled.clearancePending).toBe(true);
	});

	it('flags a measured clearance when the object GROWS as well as when it shrinks', () => {
		for (const [sx, sy] of [[2, 2], [0.5, 0.5], [2, 0.5]] as const) {
			expect(expectOk(scaleDesign(editableShape(), sx, sy)).clearanceNeedsReview).toBe(true);
		}
	});

	/**
	 * The identity arm, which `scaleDesignToDimensions` really does apply — its width pass runs at
	 * factor 1 whenever the typed width already matches. It must not SET the flag (nothing moved)
	 * and, more sharply, it must not CLEAR one that is already up: re-typing the current size is
	 * not an answer to a review.
	 */
	it('sets no flag for an identity scale, and does not clear one already set', () => {
		expect(expectOk(scaleDesign(editableShape(), 1, 1)).clearanceNeedsReview ?? false).toBe(false);
		expect(expectOk(scaleDesign(editableShape({ clearanceNeedsReview: true }), 1, 1)).clearanceNeedsReview).toBe(true);
	});

	it('keeps a circle’s bulges under a non-uniform scale, doubling its width', () => {
		const round = editableShape({ footprint: circle(200), clearance: null, details: [] });
		const scaled = expectOk(scaleDesign(round, 2, 1));
		expect(scaled.footprint.bulges).toEqual(ALL_QUARTERS);
		const box = expectOk(boundingBoxOf(scaled.footprint));
		expect(box.max.x - box.min.x).toBeCloseTo(400, 6);
		expect(scaled.clearance).toBeNull();
	});

	it('refuses a factor that is not a finite positive number', () => {
		expect(expectErr(scaleDesign(editableShape(), 0, 1)).code).toBe('asset.invalid-scale');
	});
});

describe('scaleDesignToDimensions', () => {
	it('lands a straight design exactly and scales every part about the anchor', () => {
		const scaled = expectOk(scaleDesignToDimensions(editableShape(), 2000, 300));

		const box = expectOk(boundingBoxOf(scaled.footprint));
		expect([box.max.x - box.min.x, box.max.y - box.min.y]).toEqual([2000, 300]);
		expect(scaled.anchor).toEqual({ x: 0, y: 0 });
		// **AMENDED at AD14, not replaced.** This line asserted `[2800, 500]` — the fixture's
		// 1400 x 1000 clearance put through the same 2 x 0.5 the footprint took — for its whole
		// life, and that was the shipped behaviour this card supersedes deliberately (AD14-R1,
		// ADR-0034). A measured clearance is now PRESERVED at the size its author drew, so the
		// numbers below are the fixture's own, and the review flag is what makes the mismatch
		// survive a reopen rather than being an ephemeral warning.
		const clearance = expectOk(boundingBoxOf(expectDefined(scaled.clearance, 'the clearance')));
		expect([clearance.max.x - clearance.min.x, clearance.max.y - clearance.min.y]).toEqual([1400, 1000]);
		expect(scaled.clearanceNeedsReview).toBe(true);
		expect(scaled.details[1].pending).toBe(true);
	});

	/**
	 * The gesture this whole ruling is about, end to end: Edit dimensions on a design whose typed
	 * width already matches leaves the width pass at factor 1 and only the depth moves — and the
	 * flag still comes up, because the object the boundary was drawn around did change.
	 */
	it('flags the clearance when only ONE axis moves', () => {
		const start = editableShape();
		const scaled = expectOk(scaleDesignToDimensions(start, 1000, 300));
		expect(widthOf(scaled)).toBeCloseTo(1000, 9);
		expect(depthOf(scaled)).toBeCloseTo(300, 9);
		expect(scaled.clearanceNeedsReview).toBe(true);
	});

	it('flags nothing when both typed dimensions are the ones the design already has', () => {
		const scaled = expectOk(scaleDesignToDimensions(editableShape(), 1000, 600));
		expect(scaled.clearanceNeedsReview ?? false).toBe(false);
	});

	it('lands a curved footprint the plain ratio would miss', () => {
		const round = editableShape({ footprint: circle(1000), clearance: null, details: [] });

		const plain = expectOk(scaleDesign(round, 1.4, 1));
		const plainBox = expectOk(boundingBoxOf(plain.footprint));
		// The miss this function exists for — measured, not guessed: the x-axis lands on 1400
		// exactly (the widest points are the vertices, not an arc apex), but leaving sy at 1 does
		// NOT leave the depth at 1000. Scaling x alone still turns each arc's chord, so the
		// untouched axis drifts too — measured at 1016.5525 mm, a ~16.55 mm miss.
		expect(Math.abs(plainBox.max.y - plainBox.min.y - 1000)).toBeGreaterThan(15);

		const solved = expectOk(scaleDesignToDimensions(round, 1400, 1000));
		const box = expectOk(boundingBoxOf(solved.footprint));
		expect(box.max.x - box.min.x).toBeCloseTo(1400, 3);
		expect(box.max.y - box.min.y).toBeCloseTo(1000, 3);
		expect(solved.footprint.bulges).toEqual(round.footprint.bulges);
	});

	it('refuses a size that is not a finite positive number', () => {
		expect(expectErr(scaleDesignToDimensions(editableShape(), 0, 300)).code).toBe('asset.invalid-scale');
	});

	it('refuses a footprint whose extent overflows rather than solving against Infinity', () => {
		// The AssetShape.dimensionsOf fixture: every coordinate is finite on its own, but the
		// bounding box's x-span (1e308 - (-1e308)) is not a representable double.
		const huge: AssetShape = {
			footprint: { points: [{ x: -1e308, y: 0 }, { x: 1e308, y: 0 }, { x: 1e308, y: 10 }] },
			footprintOrigin: 'typed',
			footprintPending: false,
			clearancePending: false,
			anchorPending: false,
			clearance: null,
			anchor: { x: 0, y: 0 },
			facing: 0,
			details: [],
		};
		expect(expectErr(scaleDesignToDimensions(huge, 1000, 500)).code).toBe('asset.invalid-footprint');
	});

	/**
	 * The docblock's "the third pass never landed worse than the second" claim, closed with a check
	 * rather than left as nine one-time fixture measurements. A four-arc circle's kept bulges cannot
	 * narrow its width below about a fifth of its diameter (`solveScale`'s own docblock) — the shape
	 * that function already names as unreachable — so width 1 is unreachable from the 1000-diameter
	 * `round` below. Reproducing pass 1 (width) and pass 2 (depth) directly through the exported
	 * `solveScale` and `scaleDesign` — the same two calls `scaleDesignToDimensions` makes internally —
	 * gives the shape the THIRD pass (width, again) starts from, without reaching into the function's
	 * own private loop.
	 */
	it('never lands the third pass on width worse than the second, when the target is unreachable', () => {
		const round = editableShape({ footprint: circle(1000), clearance: null, details: [] });

		const afterPass1 = expectOk(
			solveScale({ start: widthOf(round), target: 1, apply: (factor) => scaleDesign(round, factor, 1), measure: widthOf }),
		);
		// Depth 5000 is reachable, so pass 2 lands on it exactly — and moves width further from its
		// own unreached target as a side effect of the coupled geometry (the same coupling Important 1
		// measures on a different pair of targets).
		const afterPass2 = expectOk(
			solveScale({ start: depthOf(afterPass1), target: 5000, apply: (factor) => scaleDesign(afterPass1, 1, factor), measure: depthOf }),
		);
		expect(Math.abs(widthOf(afterPass2) - 1)).toBeGreaterThan(Math.abs(widthOf(afterPass1) - 1));

		const full = expectOk(scaleDesignToDimensions(round, 1, 5000));
		// The third pass (width, target 1 again) starts from `afterPass2` inside the real function —
		// unreachable again, so it must not push width any further from the target than pass 2 left
		// it, and it measurably lands within a tenth of a millimetre of that same unreached width.
		expect(Math.abs(widthOf(full) - 1)).toBeLessThanOrEqual(Math.abs(widthOf(afterPass2) - 1));
		expect(widthOf(full)).toBeCloseTo(widthOf(afterPass2), 0);
	});
});
