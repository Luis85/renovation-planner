import { describe, expect, it } from 'vitest';
import { boxResize } from '../../../../src/core/geometry/boxHandles';
import { boundingBoxOf } from '../../../../src/core/geometry/operations';
import type { Point } from '../../../../src/core/geometry/Point';
import { unwrap } from '../../../../src/core/result/Result';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../../src/domain/asset/presets/presetGeometry';
import { outlineOf, resizeBox, type OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partMeasure, resizeToExtent, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { draggedShape, type DragOptions } from '../../../../src/presentation/designer/selection/selectionDrag';
import { expectDefined, expectOk } from '../../../helpers/domain';

/**
 * AD18-R23: a box-handle drag on a CURVED CLEARANCE solves its extent as every other curved part does
 * (`fittedResize`), withdrawing Task 13's clearance exclusion — so the side or corner opposite the handle stays
 * put and the curve-aware box lands what the typed Width/Depth path (`resizeToExtent`) lands.
 *
 * The two presets at their defaults, as the integrator measured them: the round table's clearance is a circle
 * of diameter 2100 about the origin (curve box ±1050), the oval table's a stadium 3000 x 2200 whose half-circle
 * ends of radius 1100 sit on the vertical chords at x ±400. The round-table side drag is the measured one: the
 * right handle dragged 40 px at zoom ~0.293 took the plain scale's right vertex from 1050 to 1186.4.
 */
const CLEARANCE: OutlinePart = { kind: 'clearance' };
const FREE: DragOptions = { shift: false, snapRotation: (radians) => radians };
/**
 * `scaleSolve.ts` stops within its `TOLERANCE_MM` of 1e-6, and `toBeCloseTo`'s 6 decimals means 5e-7, which the
 * round table's inward drag misses by 2.8e-7 (it lands 1963.6000008). 5 decimals is 5e-6: still far under every
 * miss the plain scale makes here, the smallest of which is 0.43 mm.
 */
const MM = 5;

function preset(id: string): AssetShape {
	const found = expectDefined(ASSET_PRESETS.find((each) => each.id === id), id);
	return expectOk(found.build(defaultValues(found)));
}

const ROUND = preset('round-table');
const OVAL = preset('oval-table');

function drag(shape: AssetShape, index: number, from: Point, to: Point, options: DragOptions = FREE) {
	return draggedShape({ shape, selection: CLEARANCE, role: { kind: 'box', index }, from }, to, options);
}

const box = (shape: AssetShape): PartBox => expectDefined(partMeasure(shape, CLEARANCE), 'clearance');
const minX = (measured: PartBox) => measured.centre.x - measured.width / 2;
const minY = (measured: PartBox) => measured.centre.y - measured.depth / 2;

/** What a box drag wrote before AD18-R23: the clearance's points scaled by the plain ratio over its curve-aware box. */
function plainScale(shape: AssetShape, index: number, to: Point, shift: boolean) {
	const { factors, origin } = boxResize(unwrap(boundingBoxOf(expectDefined(outlineOf(shape, CLEARANCE), 'clearance'))), index, to, shift);
	return expectOk(resizeBox(shape, CLEARANCE, factors, origin));
}

/** The typed path for a corner: Width, Depth, Width, in `scaleDesignToDimensions`' order. */
function typedCorner(shape: AssetShape, width: number, depth: number): PartBox {
	const once = expectOk(resizeToExtent(shape, CLEARANCE, 'width', width));
	const twice = expectOk(resizeToExtent(once, CLEARANCE, 'depth', depth));
	return box(expectOk(resizeToExtent(twice, CLEARANCE, 'width', width)));
}

describe('a box-handle drag on a curved clearance', () => {
	it.each([
		// The integrator's drag reversed, 2100 -> 1963.6. Outward (to 1186.4) the plain scale's width was already right,
		// since every arc's x-extreme stays at a vertex while it widens; inward the right-hand arcs overshoot the pointer.
		['round table', ROUND, { x: 1050, y: 0 }, { x: 913.6, y: 0 }, 1963.6, -1050],
		// The ends keep their 2200 of reach under an x-scale, so the plain scale lands short AND moves the left side.
		['oval table', OVAL, { x: 1500, y: 0 }, { x: 1640, y: 0 }, 3140, -1500],
	])('lands the typed Width on the %s and keeps its left side from a right-side drag', (_, shape, from, to, width, left) => {
		const resized = box(expectOk(drag(shape, 3, from, to)));
		const typed = box(expectOk(resizeToExtent(shape, CLEARANCE, 'width', width)));
		expect(resized.width).toBeCloseTo(width, MM);
		expect(resized.width).toBeCloseTo(typed.width, MM);
		expect(resized.depth).toBeCloseTo(typed.depth, MM);
		expect(minX(resized)).toBeCloseTo(left, MM);
	});

	it.each([
		['round table', ROUND, { x: 1050, y: 1050 }, { x: 1186.4, y: 1100 }, 2236.4, 2150, -1050, -1050],
		['oval table', OVAL, { x: 1500, y: 1100 }, { x: 1640, y: 1200 }, 3140, 2300, -1500, -1100],
	])('lands the typed Width and Depth on the %s and keeps its opposite corner from a corner drag', (_, shape, from, to, width, depth, left, top) => {
		const resized = box(expectOk(drag(shape, 4, from, to)));
		const typed = typedCorner(shape, width, depth);
		expect(resized.width).toBeCloseTo(width, MM);
		expect(resized.depth).toBeCloseTo(depth, MM);
		expect(resized.width).toBeCloseTo(typed.width, MM);
		expect(resized.depth).toBeCloseTo(typed.depth, MM);
		expect(minX(resized)).toBeCloseTo(left, MM);
		expect(minY(resized)).toBeCloseTo(top, MM);
	});

	it.each([
		['a side', 3, { x: 1050, y: 0 }, { x: 1186.4, y: 0 }],
		['a corner', 4, { x: 1050, y: 1050 }, { x: 1186.4, y: 1100 }],
	])('keeps the uniform scale under Shift from %s handle', (_, index, from, to) => {
		const shift = { ...FREE, shift: true };
		expect(expectOk(drag(ROUND, index, from, to, shift))).toEqual(plainScale(ROUND, index, to, true));
	});

	// The flags are not this module's to decide: both paths write through `resizeBox`, whose `mapPartOutline` carries
	// `clearancePending` and clears the review flag (AD14-R1). This pins that the solve reaches the same door.
	it('treats clearancePending and the review flag as the typed Width does', () => {
		const flagged = expectOk(validateAssetShape({ ...ROUND, clearancePending: true, clearanceNeedsReview: true }));
		const dragged = expectOk(drag(flagged, 3, { x: 1050, y: 0 }, { x: 1186.4, y: 0 }));
		const typed = expectOk(resizeToExtent(flagged, CLEARANCE, 'width', 2236.4));
		expect([dragged.clearancePending, dragged.clearanceNeedsReview]).toEqual([true, false]);
		expect([typed.clearancePending, typed.clearanceNeedsReview]).toEqual([true, false]);
	});
});
