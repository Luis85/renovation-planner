import { describe, expect, it } from 'vitest';
import { boxResize } from '../../../../src/core/geometry/boxHandles';
import { boundingBoxOf } from '../../../../src/core/geometry/operations';
import type { Point } from '../../../../src/core/geometry/Point';
import { unwrap } from '../../../../src/core/result/Result';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import { rect, stadium } from '../../../../src/domain/asset/presets/presetGeometry';
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

	it('keeps the opposite corner from a corner moved straight up, solving both axes of a coupled outline', () => {
		// The same corner handle with x unmoved: sx is exactly 1 (a snapped pointer makes that likely), but the
		// handle still owns the x axis — a depth solve about the centre widens a circle, and only a width pass
		// and the corner's own x brings it back.
		const shape = editableShape();
		const bowl: OutlinePart = { kind: 'detail', id: 'detail-2' };
		const resized = box(expectOk(dragHandle(shape, bowl, 0, { x: 150, y: -100 }, { x: 150, y: -150 })), bowl);
		expect(resized.width).toBeCloseTo(200, MM);
		expect(resized.centre.x + resized.width / 2).toBeCloseTo(350, MM);
		expect(resized.depth).toBeCloseTo(250, MM);
	});

	it('solves the footprint too, keeping its back where it was', () => {
		// The toilet's footprint is y -350..350 with a semicircular front of radius 190 that keeps its reach under a
		// plain depth scale, so its bottom-middle handle (5) dragged from (0, 350) to (0, 300) used to land 313.57.
		const shape = toiletShape();
		const footprint: OutlinePart = { kind: 'footprint' };
		const resized = box(expectOk(dragHandle(shape, footprint, 5, { x: 0, y: 350 }, { x: 0, y: 300 })), footprint);
		expect(resized.depth).toBeCloseTo(650, MM);
		expect(resized.centre.y - resized.depth / 2).toBeCloseTo(-350, MM);
	});

	// Of the two translations this case guards only the y one (a mutation dropping it turns this red); the
	// stadium's depth is linear in a y-scale, so the plain scale passed it too.
	it('keeps the top side from a bottom drag', () => {
		// The bottom-middle handle (5) from (0, 171) to (0, 271): 370 deep, with the top held at -99.
		const resized = box(expectOk(dragHandle(BASIN_SHAPE, BASIN, 5, { x: 0, y: 171 }, { x: 0, y: 271 })), BASIN);
		expect(resized.depth).toBeCloseTo(370, MM);
		expect(resized.centre.y - resized.depth / 2).toBeCloseTo(-99, MM);
	});

	it('falls back to the plain scale where the solve is refused, across a neighbourhood rather than at one bit', () => {
		// Found by a seeded search over 400 x 300 quads with bulges in steps of 0.05: its bottom-right handle dragged
		// to (-133, -150) asks 67 x 190. The solve's width pass keeps the full depth, and at that width the kept
		// arcs meet, so the domain refuses it (a typed Width 67 is refused too) — while the plain scale of both axes
		// at once is a valid shape. Every drag within 5 mm of that point behaves the same.
		const quad = { points: rect(400, 300).points, bulges: [0.95, -0.4, 1, -0.95] };
		const shape = expectOk(validateAssetShape({ ...BASIN_SHAPE, details: [...BASIN_SHAPE.details.slice(0, 2), { id: 'detail-3', name: 'quad', line: 'solid', pending: false, outline: quad }] }));
		const corner = unwrap(boundingBoxOf(quad)).max;
		expect(expectErr(resizeToExtent(shape, BASIN, 'width', 67)).code).toBe('asset.invalid-detail');
		for (const dx of [-5, 0, 5]) {
			for (const dy of [-5, 0, 5]) {
				const to = { x: -133 + dx, y: -150 + dy };
				expect(expectOk(dragHandle(shape, BASIN, 4, corner, to))).toEqual(scaledAsToday(shape, BASIN, 4, to));
			}
		}
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

	it('scales a curved clearance exactly as before, since C07 governs it', () => {
		// A stadium clearance about (0, 200), x -1100..1100, whose ends of radius 600 keep their reach under a plain
		// width scale: its right handle (3) to x 1000 is a drag a solve would land differently, so one would show here.
		const shape = editableShape({ clearance: stadium(2200, 1200, 0, 200) });
		const clearance: OutlinePart = { kind: 'clearance' };
		const to = { x: 1000, y: 200 };
		expect(expectOk(dragHandle(shape, clearance, 3, { x: 1100, y: 200 }, to))).toEqual(scaledAsToday(shape, clearance, 3, to));
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
		// This one cannot fail while the tool hands `draggedShape` one value for both; it pins that wiring.
		expect(rig.previews.filter((preview) => preview !== null).at(-1)).toEqual(committed);
	});
});
