import { describe, expect, it } from 'vitest';
import { boxResize } from '../../../../src/core/geometry/boxHandles';
import { boundingBoxOf } from '../../../../src/core/geometry/operations';
import type { Point } from '../../../../src/core/geometry/Point';
import { unwrap } from '../../../../src/core/result/Result';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { stadium } from '../../../../src/domain/asset/presets/presetGeometry';
import { outlineOf, resizeBox, type OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { partMeasure, resizeToExtent, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { draggedShape, type DragOptions } from '../../../../src/presentation/designer/selection/selectionDrag';
import { editableShape, shapeWithRoundedRect, toiletShape } from '../../../helpers/assetShapes';
import { selectToolRig } from '../../../helpers/designerSelection';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { flushGesture, pointerAt } from '../../../helpers/tool-context';

/**
 * AD18-R20 Task 13: a box-handle drag of a graphic with arcs keeps the side or corner opposite the handle
 * FIXED and lands its CURVE-AWARE extent on the dragged box, solved as a typed Width/Depth is
 * (`resizeToExtent`), rather than scaling its points by the plain ratio and leaving every arc bowing by the
 * sagitta its chord keeps.
 *
 * `BASIN` is the vanity's basin at the preset's defaults, as the integrator measured it: `stadium(360, 270)`
 * about (0, 36), so points at x ±45 and y -99..171, with half-circle ends of radius 135 on its left and
 * right sides — a curve-aware box of x -180..180 by y -99..171. Its right-middle handle (3) sits on (180, 36).
 */
const BASIN_SHAPE = shapeWithRoundedRect(stadium(360, 270, 0, 36));
const BASIN: OutlinePart = { kind: 'detail', id: 'detail-3' };
const RIGHT: Point = { x: 180, y: 36 };
const FREE: DragOptions = { shift: false, snapRotation: (radians) => radians };

/** The typed path's own tolerance (`scaleSolve.ts`'s `TOLERANCE_MM`) is 1e-6; 6 decimals is that. */
const MM = 6;

function dragHandle(shape: AssetShape, selection: OutlinePart, index: number, from: Point, to: Point, options: DragOptions = FREE) {
	return draggedShape({ shape, selection, role: { kind: 'box', index }, from }, to, options);
}

const box = (shape: AssetShape, part: OutlinePart): PartBox => expectDefined(partMeasure(shape, part), 'part');
const minX = (measured: PartBox) => measured.centre.x - measured.width / 2;

/** What a box drag wrote before Task 13: the part's points scaled by the plain ratio over its curve-aware box. */
function scaledAsToday(shape: AssetShape, selection: OutlinePart, index: number, to: Point, shift = false) {
	const { factors, origin } = boxResize(unwrap(boundingBoxOf(expectDefined(outlineOf(shape, selection), 'outline'))), index, to, shift);
	return expectOk(resizeBox(shape, selection, factors, origin));
}

describe('a box-handle drag of a graphic with arcs', () => {
	it('lands the dragged width and keeps the fixed left side where the box can reach it', () => {
		// 360 -> 320: the ends keep their 270 of reach, so the points close to 50 apart.
		const resized = box(expectOk(dragHandle(BASIN_SHAPE, BASIN, 3, RIGHT, { x: 140, y: 36 })), BASIN);
		expect(resized.width).toBeCloseTo(320, MM);
		expect(minX(resized)).toBeCloseTo(-180, MM);
		expect(resized.depth).toBeCloseTo(270, MM);
	});

	it('does what a typed Width does for a box it cannot reach, and still keeps the fixed side', () => {
		// The integrator's drag: about 169 to the left asks for 191, under the 270 the two ends alone span.
		const resized = box(expectOk(dragHandle(BASIN_SHAPE, BASIN, 3, RIGHT, { x: 11, y: 36 })), BASIN);
		const typed = box(expectOk(resizeToExtent(BASIN_SHAPE, BASIN, 'width', 191)), BASIN);
		expect(resized.width).toBeCloseTo(typed.width, MM);
		expect(resized.width).toBeGreaterThan(270);
		expect(minX(resized)).toBeCloseTo(-180, MM);
	});

	it('keeps the opposite corner from a corner drag and lands both extents', () => {
		// The bowl circle, diameter 200 about (250, 0): the top-left handle (0) from (150, -100) to
		// (200, -150) asks for 150 x 250 with the bottom-right corner (350, 100) held.
		const shape = editableShape();
		const bowl: OutlinePart = { kind: 'detail', id: 'detail-2' };
		const resized = box(expectOk(dragHandle(shape, bowl, 0, { x: 150, y: -100 }, { x: 200, y: -150 })), bowl);
		expect(resized.width).toBeCloseTo(150, MM);
		expect(resized.depth).toBeCloseTo(250, MM);
		expect(resized.centre.x + resized.width / 2).toBeCloseTo(350, MM);
		expect(resized.centre.y + resized.depth / 2).toBeCloseTo(100, MM);
	});

	it('keeps the top side from a bottom drag', () => {
		// The bottom-middle handle (5) from (0, 171) to (0, 271): 370 deep, with the top held at -99.
		const resized = box(expectOk(dragHandle(BASIN_SHAPE, BASIN, 5, { x: 0, y: 171 }, { x: 0, y: 271 })), BASIN);
		expect(resized.depth).toBeCloseTo(370, MM);
		expect(resized.centre.y - resized.depth / 2).toBeCloseTo(-99, MM);
	});

	it('still refuses a handle dragged past the fixed side', () => {
		expect(expectErr(dragHandle(BASIN_SHAPE, BASIN, 3, RIGHT, { x: -200, y: 36 })).code).toBe('asset.invalid-scale');
	});
});

describe('a box-handle drag this does not change', () => {
	it('scales a straight rectangle exactly as before', () => {
		const shape = editableShape();
		const top: OutlinePart = { kind: 'detail', id: 'detail-1' };
		// Values a solve-then-move lands a few ulps off, so this fails if a straight graphic is ever solved too.
		const to = { x: -168.35, y: 336.55 };
		expect(expectOk(dragHandle(shape, top, 4, { x: 0, y: 100 }, to))).toEqual(scaledAsToday(shape, top, 4, to));
	});

	it('scales a curved graphic under Shift exactly as before', () => {
		const to = { x: 140, y: 36 };
		const shift = { ...FREE, shift: true };
		expect(expectOk(dragHandle(BASIN_SHAPE, BASIN, 3, RIGHT, to, shift))).toEqual(scaledAsToday(BASIN_SHAPE, BASIN, 3, to, true));
	});

	it('scales a curved footprint exactly as before', () => {
		// The toilet's footprint is y -350..350 with a semicircular front of radius 190, so its bottom-middle
		// handle (5) is on (0, 350) — and a depth drag is one a plain ratio misses, since that arc keeps its reach.
		const shape = toiletShape();
		const footprint: OutlinePart = { kind: 'footprint' };
		const to = { x: 0, y: 300 };
		expect(expectOk(dragHandle(shape, footprint, 5, { x: 0, y: 350 }, to))).toEqual(scaledAsToday(shape, footprint, 5, to));
	});
});

describe('the select tool dragging a curved graphic’s handle', () => {
	it('previews the shape it commits, with the fixed side held', async () => {
		const rig = selectToolRig({ shape: BASIN_SHAPE, selection: BASIN });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(RIGHT.x, RIGHT.y));
		rig.tool.pointerMove(pointerAt(160, 36));
		rig.tool.pointerUp(pointerAt(140, 36));
		await flushGesture();

		expect(rig.written).toHaveLength(1);
		const committed = expectDefined(rig.written[0], 'write').shape;
		expect(minX(box(committed, BASIN))).toBeCloseTo(-180, MM);
		expect(rig.previews.filter((preview) => preview !== null).at(-1)).toEqual(committed);
	});
});
