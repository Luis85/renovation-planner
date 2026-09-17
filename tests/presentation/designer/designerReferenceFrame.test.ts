/**
 * AD12's facing frame: the placement presets, the quarter-turn test the clearance helper is
 * gated on, and the rectangle that helper generates.
 *
 * **A NODE test, with no `@vitest-environment` directive**, because nothing here draws: the
 * module under test imports only `core/geometry`, and `facingTip` — the one thing it borrows
 * from a layer module — is a pure function over an `AssetShape`. That import is the point of
 * this file rather than an accident: AD12's second acceptance criterion says back centre must be
 * *opposite the displayed front*, and the displayed front is where `anchorLayer.facingArrow`
 * puts the arrow's tip, so the cases ask THAT function rather than re-deriving a direction from
 * `shape.facing` and agreeing with themselves.
 *
 * The fixture footprint is deliberately asymmetric in both axes — 1000 across by 400 deep, with
 * its near corner at the origin — so a case that confused width with depth, or min with max,
 * cannot pass by landing on a shared number.
 */
import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import type { Point } from '../../../src/core/geometry/Point';
import { validateAssetShape, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { facingTip } from '../../../src/presentation/designer/layers/anchorLayer';
import {
	anchorPresetPoint,
	clearanceRectangle,
	currentAnchorPreset,
	facingQuarter,
	rectangularFootprint,
} from '../../../src/presentation/designer/inspector/DesignerReferenceFrame';
import { expectOk } from '../../helpers/domain';

const QUARTER = Math.PI / 2;

/** x 0…1000, y 0…400 — asymmetric in both axes, and its centre at (500, 200). */
const FOOTPRINT: CurvedPolygon = {
	points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 400 }, { x: 0, y: 400 }],
};

/** A polygon offset along x, for the mirror case — 100…1100, so mirroring it moves every coordinate. */
const OFFSET: CurvedPolygon = {
	points: [{ x: 100, y: 0 }, { x: 1100, y: 0 }, { x: 1100, y: 400 }, { x: 100, y: 400 }],
};

const mirroredX = (polygon: CurvedPolygon): CurvedPolygon => ({
	points: polygon.points.map((point) => ({ x: -point.x, y: point.y })),
});

function shapeFacing(facing: number, footprint: CurvedPolygon = FOOTPRINT): AssetShape {
	return expectOk(
		validateAssetShape({
			footprint,
			footprintOrigin: 'traced',
			footprintPending: false,
			clearance: null,
			clearancePending: false,
			anchor: { x: 0, y: 0 },
			anchorPending: false,
			facing,
			details: [],
		}),
	);
}

const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;

/** The direction the arrow actually points, as a vector from the anchor — `anchorLayer`'s own answer. */
function drawnFront(shape: AssetShape): Point {
	const tip = facingTip(shape, 1);
	return { x: tip.x - shape.anchor.x, y: tip.y - shape.anchor.y };
}

function presetPoint(shape: AssetShape, preset: 'centre' | 'back-centre'): Point {
	const point = anchorPresetPoint(shape.footprint, shape.facing, preset);
	if (point === null) throw new Error('the fixture footprint should be measurable');
	return point;
}

describe('which quarter a facing is', () => {
	it.each([
		[0, 0],
		[QUARTER, 1],
		[Math.PI, 2],
		[3 * QUARTER, 3],
	])('reads %s as quarter %s', (facing, quarter) => {
		expect(facingQuarter(facing)).toBe(quarter);
	});

	it('answers null for a front pointing between two axes, which is what withholds the four-side helper', () => {
		expect(facingQuarter(Math.PI / 4)).toBeNull();
	});

	/**
	 * `validateAssetShape` folds a facing into `[0, 2π)`, so a drag a hair anticlockwise of due
	 * east is STORED just under a full turn rather than just under zero. Without the fold in
	 * `facingQuarter` this answers null and the helper vanishes for a front the user can see
	 * lying on the axis.
	 */
	it('reads a facing just under a full turn as quarter 0', () => {
		expect(facingQuarter(2 * Math.PI - 1e-9)).toBe(0);
	});
});

describe('the placement presets', () => {
	it.each([
		[0, { x: 0, y: 200 }],
		[QUARTER, { x: 500, y: 0 }],
		[Math.PI, { x: 1000, y: 200 }],
		[3 * QUARTER, { x: 500, y: 400 }],
	])('puts back centre on the far side of the box at facing %s', (facing, expected) => {
		const point = presetPoint(shapeFacing(facing), 'back-centre');
		expect(point.x).toBeCloseTo(expected.x, 9);
		expect(point.y).toBeCloseTo(expected.y, 9);
	});

	it('puts centre in the middle whatever the facing, because a box centre has no direction', () => {
		for (const facing of [0, QUARTER, Math.PI, 3 * QUARTER, 1.1]) {
			const point = presetPoint(shapeFacing(facing), 'centre');
			expect(point.x).toBeCloseTo(500, 9);
			expect(point.y).toBeCloseTo(200, 9);
		}
	});

	/**
	 * AD12's second acceptance criterion, asked of the DRAWN arrow rather than of the number
	 * behind it: whatever the rotation, back centre lies on the far side of the centre from where
	 * `facingArrow` points, and front and back are the same distance from it on that one axis.
	 *
	 * Watched failing first: with `anchorPresetPoint` returning the facing-frame `max.x` instead
	 * of `min.x`, every one of these reported a positive projection where a negative one is
	 * required.
	 */
	it.each([0, QUARTER, Math.PI, 3 * QUARTER, 0.7, 2.9])('keeps back centre opposite the drawn front at %s', (facing) => {
		const shape = shapeFacing(facing);
		const centre = presetPoint(shape, 'centre');
		const back = presetPoint(shape, 'back-centre');
		const behind = { x: back.x - centre.x, y: back.y - centre.y };
		expect(dot(behind, drawnFront(shape))).toBeLessThan(0);
	});

	/** And it is HALF the box away, on the axis the front lies along: 1000 mm across, 400 mm deep. */
	it.each([
		[0, 500],
		[QUARTER, 200],
		[Math.PI, 500],
		[3 * QUARTER, 200],
	])('sets back centre half the facing-frame span back at %s', (facing, half) => {
		const shape = shapeFacing(facing);
		const centre = presetPoint(shape, 'centre');
		const back = presetPoint(shape, 'back-centre');
		expect(Math.hypot(back.x - centre.x, back.y - centre.y)).toBeCloseTo(half, 9);
	});

	/**
	 * Mirroring. The footprint is reflected across x = 0 and the front with it — a front pointing
	 * along +x points along −x afterwards — and back centre follows, landing on the mirror of
	 * where it was rather than staying on the side it was computed from.
	 */
	it('mirrors back centre when the outline and the front are mirrored', () => {
		const before = presetPoint(shapeFacing(0, OFFSET), 'back-centre');
		const after = presetPoint(shapeFacing(Math.PI, mirroredX(OFFSET)), 'back-centre');
		expect(before.x).toBeCloseTo(100, 9);
		expect(after.x).toBeCloseTo(-before.x, 9);
		expect(after.y).toBeCloseTo(before.y, 9);
	});

	it('names the preset an anchor is sitting on, and nothing for a point the user placed', () => {
		const shape = shapeFacing(0);
		expect(currentAnchorPreset(shape.footprint, 0, { x: 500, y: 200 })).toBe('centre');
		expect(currentAnchorPreset(shape.footprint, 0, { x: 0, y: 200 })).toBe('back-centre');
		expect(currentAnchorPreset(shape.footprint, 0, { x: 123, y: 45 })).toBeNull();
	});

	/**
	 * The unmeasurable arm. A validated `AssetShape` can never carry a footprint with no points —
	 * `createCurvedPolygon` refuses one — so it is driven from a bare polygon, which is exactly
	 * the contract this function states rather than a state the designer can reach.
	 */
	it('answers null for a footprint with nothing to measure', () => {
		expect(anchorPresetPoint({ points: [] }, 0, 'centre')).toBeNull();
		expect(currentAnchorPreset({ points: [] }, 0, { x: 0, y: 0 })).toBeNull();
	});
});

describe('what counts as a rectangular footprint', () => {
	it('accepts an axis-aligned rectangle and reports its box', () => {
		expect(rectangularFootprint(FOOTPRINT)).toEqual({ min: { x: 0, y: 0 }, max: { x: 1000, y: 400 } });
	});

	it('refuses a curved outline rather than inferring four setbacks from it', () => {
		expect(rectangularFootprint({ ...FOOTPRINT, bulges: [0, 0.5, 0, 0] })).toBeNull();
	});

	it('refuses an outline that is not four points', () => {
		expect(rectangularFootprint({ points: [...FOOTPRINT.points, { x: -10, y: 200 }] })).toBeNull();
	});

	it('refuses four points that are not on the box corners', () => {
		const skewed = { points: [{ x: 0, y: 0 }, { x: 1000, y: 100 }, { x: 1000, y: 400 }, { x: 0, y: 300 }] };
		expect(rectangularFootprint(skewed)).toBeNull();
	});

	/** Both axes, because a guard that only asks about one leaves the other's collapse through. */
	it.each([
		['x', [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 400 }, { x: 0, y: 400 }]],
		['y', [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0 }]],
	])('refuses a rectangle with no extent on %s', (_axis, points) => {
		expect(rectangularFootprint({ points })).toBeNull();
	});
});

describe('the rectangle the helper generates', () => {
	const BOX = { min: { x: 0, y: 0 }, max: { x: 1000, y: 400 } };
	const SETBACKS = { front: 100, back: 50, left: 20, right: 30 };

	/**
	 * Facing +x: the front grows +x, the back −x, and — the derivation this repository does NOT
	 * get from either shipped tool — the object's LEFT is −y, the top of the sheet, the way a
	 * figure walking east on a map has north on its left. Every one of the four expansions is
	 * exercised by this one quarter, which is why the second case below only has to prove the
	 * frame turns with the facing.
	 */
	it('expands each side along its own direction at facing 0', () => {
		expect(clearanceRectangle(BOX, 0, SETBACKS)).toEqual([
			{ x: -50, y: -20 },
			{ x: 1100, y: -20 },
			{ x: 1100, y: 430 },
			{ x: -50, y: 430 },
		]);
	});

	it('turns the four sides with the facing, so the front allowance follows the arrow', () => {
		const points = clearanceRectangle(BOX, 1, SETBACKS);
		// Front is +y at quarter 1, back is −y, and the object's left becomes +x.
		expect(points).toEqual([
			{ x: -30, y: -50 },
			{ x: 1020, y: -50 },
			{ x: 1020, y: 500 },
			{ x: -30, y: 500 },
		]);
	});

	it('generates the footprint itself for four zero allowances, rather than refusing to answer', () => {
		expect(clearanceRectangle(BOX, 0, { front: 0, back: 0, left: 0, right: 0 })).toEqual([
			{ x: 0, y: 0 },
			{ x: 1000, y: 0 },
			{ x: 1000, y: 400 },
			{ x: 0, y: 400 },
		]);
	});
});
