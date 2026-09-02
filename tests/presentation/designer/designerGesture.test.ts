/**
 * @vitest-environment jsdom
 *
 * What the asset designer draws WHILE a gesture is being made: the vertices of a footprint
 * being traced, the close target among them, and the calibration tape.
 *
 * The pragma is load-bearing rather than conventional — `vitest.config.ts` defaults to `node`,
 * and this file mounts the real designer through `designerRig`.
 */
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../../../src/presentation/editor/handleMetrics';
import { t } from '../../../src/presentation/i18n/strings';
import { settle } from '../../helpers/editor';
import { click, designerRig, move, type DesignerRig } from '../../helpers/designerRig';

function gestureLayer(rig: DesignerRig): Konva.Layer {
	const layer = rig.stage.findOne<Konva.Layer>('.asset-gesture');
	if (layer === undefined) throw new Error('expected a mounted gesture layer');
	return layer;
}

function radii(rig: DesignerRig): number[] {
	return gestureLayer(rig).find('Circle').map((circle) => (circle as Konva.Circle).radius());
}

/**
 * The designer drew NOTHING between clicks for a whole increment: `DrawPolygonTool` closes only
 * on a click within twelve screen pixels of the first vertex, and that vertex was drawn
 * nowhere. These cases drive the real tool through the real rig and read the layer.
 */
describe('the designer while a footprint is being traced', () => {
	/**
	 * The `outlineFlat === null` arm, which is a REAL state rather than a coverage errand:
	 * `DrawPolygonTool.pointerDown` publishes `nextVertex: null` after every click — "the
	 * pointer is genuinely there, but there is no loose end yet" — so a single click leaves one
	 * placed vertex and nothing to draw a band to. The mark has to be there anyway, because it
	 * is the close target the whole gesture aims at.
	 */
	it('draws the first vertex with no rubber band until the pointer moves', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		await settle();
		expect(radii(rig)).toEqual([POLYGON_CLOSE_TARGET_RADIUS_PX]);
		expect(gestureLayer(rig).find('Line').length).toBe(0);
		rig.unmount();
	});

	it('marks every placed vertex, and draws the first one as the close target', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		click(rig, { x: 1000, y: 0 });
		click(rig, { x: 1000, y: 1000 });
		await settle();
		expect(radii(rig)).toEqual([POLYGON_CLOSE_TARGET_RADIUS_PX, POLYGON_VERTEX_RADIUS_PX, POLYGON_VERTEX_RADIUS_PX]);
		rig.unmount();
	});

	it('grows the close target while the pointer is over the first vertex, and clears the sketch on close', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		click(rig, { x: 1000, y: 0 });
		click(rig, { x: 1000, y: 1000 });
		move(rig, { x: 0, y: 0 });
		await settle();
		expect(radii(rig).at(0)).toBe(POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX);

		click(rig, { x: 0, y: 0 });
		await settle();
		expect(radii(rig)).toEqual([]);
		expect((await rig.document()).shape?.footprint.points).toHaveLength(3);
		rig.unmount();
	});
});

describe('the designer while a calibration is being measured', () => {
	it('draws the tape from the first pick, following the pointer', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.calibrate')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		move(rig, { x: 500, y: 0 });
		await settle();
		const marks = gestureLayer(rig).findOne<Konva.Shape>('.measurement-marks');
		expect(marks).toBeDefined();
		rig.unmount();
	});
});
