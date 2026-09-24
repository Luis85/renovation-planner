import { describe, expect, it } from 'vitest';
import { boxResize } from '../../../../src/core/geometry/boxHandles';
import { boundingBoxOf, rotate } from '../../../../src/core/geometry/operations';
import { unwrap } from '../../../../src/core/result/Result';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { cornerRadiusOf } from '../../../../src/domain/asset/cornerRadius';
import { roundedRect } from '../../../../src/domain/asset/presets/presetGeometry';
import { outlineOf, resizeBox, type OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { draggedShape, type DragOptions } from '../../../../src/presentation/designer/selection/selectionDrag';
import { ROUNDED_RECT, shapeWithRoundedRect } from '../../../helpers/assetShapes';
import { selectToolRig } from '../../../helpers/designerSelection';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { flushGesture, pointerAt } from '../../../helpers/tool-context';

/**
 * AD18-R21: a box-handle drag of a rounded rectangle rebuilds it in the new box with its radius kept, or
 * clamped by the rule a typed Width/Depth uses (`cornerRadius.ts`), in the preview and the commit alike.
 * `ROUNDED_RECT` is 1000 x 600, radius 150, centred on (20, 30): its box is x -480..520 by y -270..330, so
 * the bottom-right handle (4) sits on (520, 330) and the right one (3) on (520, 30).
 */
const SHAPE = shapeWithRoundedRect();
const ROUNDED: OutlinePart = { kind: 'detail', id: 'detail-3' };
const FREE: DragOptions = { shift: false, snapRotation: (radians) => radians };
const SHIFT: DragOptions = { ...FREE, shift: true };
const BR: Point = { x: 520, y: 330 };

/** The curve-aware box carries float noise of ~1e-13 into the new corners, so points are compared to 1e-9. */
const near = (outline: CurvedPolygon) => ({ ...outline, points: outline.points.map((point) => ({ x: expect.closeTo(point.x, 9), y: expect.closeTo(point.y, 9) })) });
const detailOf = (shape: AssetShape, id: string) => expectDefined(shape.details.find((detail) => detail.id === id), id);

function dragHandle(index: number, from: Point, to: Point, options: DragOptions = FREE, shape: AssetShape = SHAPE, selection: DesignerSelection = ROUNDED) {
	return draggedShape({ shape, selection, role: { kind: 'box', index }, from }, to, options);
}

/** What a box drag wrote before AD18-R21: a plain per-axis scale of the part's curve-aware box. */
function scaledAsToday(shape: AssetShape, selection: OutlinePart, index: number, to: Point) {
	const { factors, origin } = boxResize(unwrap(boundingBoxOf(expectDefined(outlineOf(shape, selection), 'outline'))), index, to, false);
	return expectOk(resizeBox(shape, selection, factors, origin));
}

describe('a box-handle drag of a rounded rectangle', () => {
	it('keeps the radius from a corner, holding the opposite corner', () => {
		const resized = expectOk(dragHandle(4, BR, { x: 320, y: 130 }));
		const detail = detailOf(resized, 'detail-3');
		expect(detail.outline).toEqual(near(roundedRect(800, 400, 150, -80, -70)));
		expect(cornerRadiusOf(detail)).toBe(150);
	});

	it('keeps the radius from a side, holding the opposite side', () => {
		const resized = expectOk(dragHandle(3, { x: 520, y: 30 }, { x: 220, y: 30 }));
		expect(detailOf(resized, 'detail-3').outline).toEqual(near(roundedRect(700, 600, 150, -130, 30)));
	});

	it('clamps the radius to the largest whole millimetre under half the new shorter side', () => {
		// 200 x 200: 150 no longer fits under 100, so it lands on 99, the slider's end.
		const detail = detailOf(expectOk(dragHandle(4, BR, { x: -280, y: -70 })), 'detail-3');
		expect(detail.outline).toEqual(near(roundedRect(200, 200, 99, -380, -170)));
		expect(cornerRadiusOf(detail)).toBe(99);
	});

	it('scales as before once no whole-millimetre radius fits the new box', () => {
		const to = { x: -478, y: -268 };
		expect(expectOk(dragHandle(4, BR, to))).toEqual(scaledAsToday(SHAPE, ROUNDED, 4, to));
	});

	it('still refuses a handle dragged past the fixed side', () => {
		expect(expectErr(dragHandle(3, { x: 520, y: 30 }, { x: -500, y: 30 })).code).toBe('asset.invalid-scale');
	});

	it('scales the radius with the box under Shift, as before', () => {
		// x by 0.5, y by 1: Shift takes 0.5 for both, so the radius halves too.
		const detail = detailOf(expectOk(dragHandle(4, BR, { x: 20, y: 330 }, SHIFT)), 'detail-3');
		expect(cornerRadiusOf(detail)).toBeCloseTo(75, 9);
	});

	it('scales one rotated off the axes as before, since a typed edit does not keep its radius either', () => {
		const turned = rotate(ROUNDED_RECT, Math.PI / 6, { x: 20, y: 30 });
		const shape = shapeWithRoundedRect(turned);
		const box = unwrap(boundingBoxOf(turned));
		const to = { x: box.max.x - 100, y: box.max.y - 50 };
		expect(expectOk(dragHandle(4, box.max, to, FREE, shape))).toEqual(scaledAsToday(shape, ROUNDED, 4, to));
	});
});

describe('a box-handle drag of anything else', () => {
	it.each([
		['a plain rectangle', { kind: 'detail', id: 'detail-1' }, { min: { x: -400, y: -100 }, max: { x: 0, y: 100 } }],
		['a circle', { kind: 'detail', id: 'detail-2' }, { min: { x: 150, y: -100 }, max: { x: 350, y: 100 } }],
		['the footprint', { kind: 'footprint' }, { min: { x: -500, y: -300 }, max: { x: 500, y: 300 } }],
	] as const)('scales %s as before', (_label, selection, box) => {
		const to = { x: box.max.x - 50, y: box.max.y + 30 };
		expect(expectOk(dragHandle(4, box.max, to, FREE, SHAPE, selection))).toEqual(scaledAsToday(SHAPE, selection, 4, to));
	});
});

describe('the select tool dragging a rounded rectangle’s handle', () => {
	it('previews the shape it commits, in one write, with the radius kept', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: ROUNDED });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(420, 230));
		rig.tool.pointerUp(pointerAt(320, 130));
		await flushGesture();

		expect(rig.written).toHaveLength(1);
		const committed = expectDefined(rig.written[0], 'write').shape;
		expect(detailOf(committed, 'detail-3').outline).toEqual(near(roundedRect(800, 400, 150, -80, -70)));
		const previews = rig.previews.filter((preview) => preview !== null);
		expect(previews.at(-1)).toEqual(committed);
		expect(cornerRadiusOf(detailOf(expectDefined(previews[0], 'preview'), 'detail-3'))).toBe(150);
	});
});
