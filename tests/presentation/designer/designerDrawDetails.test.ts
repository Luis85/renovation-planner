/**
 * @vitest-environment jsdom
 *
 * The designer's three detail tools (asset designer symbols spec, Decision 11), driven through the
 * real toolbar and canvas: what each writes to the sidecar, that a detail captured over an
 * uncalibrated sheet awaits its scale, that the new detail is selected with Select active again,
 * and that every refusal writes nothing.
 *
 * Geometry note: the rig's default camera is 10 mm per screen pixel, so the snap tolerance is
 * 80 mm; every point below sits more than that from the fixture's corners (±1000) and its anchor
 * (the origin). Coordinates are compared to 6 places because a point travels world → screen →
 * world through the camera.
 */
import { describe, expect, it } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import type { Point } from '../../../src/core/geometry/Point';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig, drag, tracePolygon, type DesignerRig } from '../../helpers/designerRig';

const SQUARE = expectOk(shapeFromDimensions(2000, 2000));
const QUARTER = Math.tan(Math.PI / 8);

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

function expectNear(points: readonly Point[], expected: readonly (readonly [number, number])[]): void {
	expect(points).toHaveLength(expected.length);
	points.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index][0], 6);
		expect(point.y).toBeCloseTo(expected[index][1], 6);
	});
}

async function details(rig: DesignerRig) {
	return (await rig.document()).shape?.details ?? [];
}

describe('drawing a rectangle detail', () => {
	it('writes one solid detail with the dragged corners, selects it and returns to Select', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		const [drawn, ...rest] = await details(rig);
		expect(rest).toEqual([]);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'rectangle', line: 'solid', pending: false });
		expectNear(drawn.outline.points, [[200, 200], [600, 200], [600, 500], [200, 500]]);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	/**
	 * The preview is DRAWN, by `DesignerGestureLayer`, while the button is still held — asked of the
	 * stage mid-drag, since `drag()` releases in the same tick and no render lands between its move
	 * and its release. The release still comes: a press is never left without one.
	 */
	it('draws the box being dragged at its corners while the button is held, and nothing once released', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');
		const corners = [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 500 }, { x: 200, y: 500 }].map((corner) => rig.at(corner));
		const held = (type: string, at: { x: number; y: number }, buttons: number) =>
			rig.canvasEl.dispatchEvent(new PointerEvent(type, { button: 0, buttons, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));

		held('pointerdown', corners[0], 1);
		held('pointermove', corners[2], 1);
		await settle();

		const drawn: number[] = rig.stage.findOne('.detail-preview')?.getAttr('points') ?? [];
		expect(drawn).toHaveLength(8);
		corners.flatMap((corner) => [corner.x, corner.y]).forEach((value, index) => expect(drawn[index]).toBeCloseTo(value, 6));

		held('pointerup', corners[2], 0);
		await settle();
		expect(rig.stage.findOne('.detail-preview')).toBeUndefined();
		rig.unmount();
	});

	it('marks the detail as awaiting a scale when it is drawn over an uncalibrated sheet', async () => {
		const rig = await designerRig({ shape: SQUARE, background: true });
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		expect((await details(rig)).map((detail) => detail.pending)).toEqual([true]);
		rig.unmount();
	});

	it('is one undo entry', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');
		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		await press(rig, 'designer.toolbar.undo');

		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	it('writes nothing for a drag with no area, and stays on the tool', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 200, y: 500 });
		await settle();

		expect(await details(rig)).toEqual([]);
		expect(rig.activeToolId()).toBe('draw-rect');
		rig.unmount();
	});

	it('reports a drag on an asset with no shape and writes nothing', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const rig = await designerRig();
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		expect(Notice.shown).toEqual([t('en', 'asset.no-footprint')]);
		expect(Notice.shown[0]).toContain('detail');
		expect((await rig.document()).shape).toBeNull();
		rig.unmount();
	});
});

describe('drawing a circle detail', () => {
	it('writes four quarter arcs through the rim, centred where the drag began', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-circle');

		drag(rig, { x: 300, y: 300 }, { x: 300, y: 500 });
		await settle();

		const [drawn] = await details(rig);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'circle', line: 'solid' });
		expectNear(drawn.outline.points, [[300, 100], [500, 300], [300, 500], [100, 300]]);
		expect(drawn.outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
		rig.unmount();
	});
});

describe('tracing a detail', () => {
	it('completes the traced outline into a detail, selects it, returns to Select, and undoes as one entry', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.trace-detail');

		tracePolygon(rig, [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 500 }]);
		await settle();

		const [drawn] = await details(rig);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'outline', line: 'solid', pending: false });
		expectNear(drawn.outline.points, [[200, 200], [600, 200], [600, 500]]);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(rig.activeToolId()).toBe('select');

		// The wrapper command's own `undo` — the only caller that reaches it.
		await press(rig, 'designer.toolbar.undo');
		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	it('reports an outline that encloses no area, and writes nothing', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.trace-detail');

		tracePolygon(rig, [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 600, y: 200 }]);
		await settle();

		expect(Notice.shown).toEqual([t('en', 'asset.degenerate-detail')]);
		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	it('advertises the Shift constraint, which the box and circle tools do not take', async () => {
		const rig = await designerRig({ shape: SQUARE });
		const hint = () => rig.wrapper.find('.rp-designer-hint');

		await press(rig, 'designer.toolbar.trace-detail');
		expect(hint().exists()).toBe(true);
		await press(rig, 'designer.toolbar.draw-rect');
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});
});
