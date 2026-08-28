/**
 * @vitest-environment jsdom
 *
 * What the transient layer actually PUTS ON THE STAGE for the two gestures a user drives it
 * with — driven through the real mounted Plan Editor, real Konva included, so the assertions
 * are about nodes rather than about the `RenderState` the tool tests already pin.
 *
 * Its limits, stated rather than implied: jsdom draws nothing and lays nothing out, so
 * nothing here can see how any of this LOOKS. Colour is one of them — no theme variables are
 * defined under jsdom, so every token in `resolveThemeTokens` falls back to the same computed
 * ink and an assertion that the armed target fills with the accent would pass against a
 * circle filled with the background. Size is the channel asserted below (§85 forbids colour
 * being the only one anyway); the rest is `npm run harness` and a capture read by eye.
 */
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { settle } from '../../helpers/editor';
import { click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../../../src/presentation/editor/handleMetrics';
import { RULER_TICK_SPACING_PX } from '../../../src/presentation/editor/layers/rulerGeometry';

/** The layer under test; every assertion below is about what is inside it. */
function interactionLayer(stage: Konva.Stage | null): Konva.Layer {
	const layer = stage?.findOne<Konva.Layer>('.interaction');
	if (layer === undefined) throw new Error('expected a mounted interaction layer');
	return layer;
}

describe('the interaction layer while a zone is being drawn', () => {
	it('marks every placed vertex, and draws the first one as the close target', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		await settle();

		// One circle per click that landed — and none for the pointer, which is the whole
		// reason the sketch carries its cursor in a separate field.
		const circles = interactionLayer(harness.stage).find('Circle');
		expect(circles).toHaveLength(3);
		expect(circles.map((circle) => (circle as Konva.Circle).radius())).toEqual([
			POLYGON_CLOSE_TARGET_RADIUS_PX,
			POLYGON_VERTEX_RADIUS_PX,
			POLYGON_VERTEX_RADIUS_PX,
		]);
	});

	it('grows the close target while the pointer is close enough to CLOSE the shape', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);

		// Five screen pixels from the first vertex: inside the twelve a close click takes.
		pointer(canvas, 'pointermove', 505, 100);
		await settle();
		const armed = interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle;
		expect(armed.radius()).toBe(POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX);

		// And back down again, so the mark tracks the pointer rather than latching on.
		pointer(canvas, 'pointermove', 560, 100);
		await settle();
		const atRest = interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle;
		expect(atRest.radius()).toBe(POLYGON_CLOSE_TARGET_RADIUS_PX);
	});

	/**
	 * The camera moves without the pointer moving: wheel zoom is always live, whatever tool
	 * is active (`PlanCanvas.onWheel`), and `+`/`-` do the same from the keyboard. A mark
	 * computed once per `pointermove` and cached goes on promising a close that the click
	 * would no longer make — the vertex has slid out from under a stationary pointer.
	 *
	 * Reported by a review bot against the first version of this change, which cached the
	 * flag on `RenderState`; reproduced here before it was fixed.
	 */
	it('stops promising a close when a ZOOM moves the target out from under a still pointer', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		pointer(canvas, 'pointermove', 505, 100);
		await settle();
		expect((interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle).radius())
			.toBe(POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX);

		// Zoom in hard, anchored far from the vertex, and move nothing.
		canvas.dispatchEvent(
			new WheelEvent('wheel', { deltaY: -600, clientX: 100, clientY: 500, bubbles: true }),
		);
		await settle();

		const first = interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle;
		expect(first.radius()).toBe(POLYGON_CLOSE_TARGET_RADIUS_PX);
	});

	/**
	 * The keyboard's own zoom, which is the case the wheel one above does NOT cover: `+`/`-`
	 * anchor at the stage CENTRE rather than at the pointer, so the world point the pointer
	 * hovers genuinely changes. A cursor remembered in WORLD units then describes a place the
	 * pointer is no longer over, and reprojecting it follows the scene instead of the hand.
	 */
	it('stops promising a close when a KEYBOARD zoom moves the world under a still pointer', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		pointer(canvas, 'pointermove', 505, 100);
		await settle();
		expect((interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle).radius())
			.toBe(POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX);

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
		await settle();

		// The pointer never moved, so it is still over screen (505, 100) — and the first
		// vertex is no longer there.
		const first = interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle;
		expect(first.radius()).toBe(POLYGON_CLOSE_TARGET_RADIUS_PX);
	});

	it('does not promise a close before there are enough vertices for one', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		pointer(canvas, 'pointermove', 500, 100); // right on the first vertex, and still not closable
		await settle();

		const first = interactionLayer(harness.stage).find('Circle').at(0) as Konva.Circle;
		expect(first.radius()).toBe(POLYGON_CLOSE_TARGET_RADIUS_PX);
	});
});

describe('the interaction layer while a plan is being calibrated', () => {
	it('caps the anchor with a bar as soon as the first point is placed', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 300, 300);
		await settle();

		// A zero-length segment: the spine plus the two bars, and no ticks to space along it.
		// The bars are the whole point — before them a single click drew a dot that said
		// nothing about which direction was about to be measured.
		expect(interactionLayer(harness.stage).find('Line')).toHaveLength(3);
		expect(interactionLayer(harness.stage).find('Circle')).toHaveLength(0);
	});

	/**
	 * The same staleness class as the close target's, and the reason the fix belongs to the
	 * CANVAS rather than to either tool: the measured segment's loose end is a world point
	 * too, so a centre-anchored zoom would leave it describing somewhere the pointer is not.
	 * One re-issued move keeps both tools honest.
	 */
	it('keeps the loose end under the pointer when the camera zooms beneath it', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 300, 300);
		pointer(canvas, 'pointermove', 500, 300);
		await settle();

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
		await settle();

		// The spine is drawn in stage pixels, so its far end is directly comparable with the
		// pointer that has not moved.
		const spine = interactionLayer(harness.stage).find('Line').at(0) as Konva.Line;
		const points = spine.points();
		expect(points.at(-2)).toBeCloseTo(500);
		expect(points.at(-1)).toBeCloseTo(300);
	});

	it('rules the segment with ticks as it is dragged out', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 300, 300);
		pointer(canvas, 'pointermove', 500, 300);
		await settle();

		// 200 screen pixels of spine: a tick every `RULER_TICK_SPACING_PX` with both ends
		// left to the bars, plus the spine and those two bars.
		const ticks = Math.floor(200 / RULER_TICK_SPACING_PX) - 1;
		expect(ticks).toBeGreaterThan(0);
		expect(interactionLayer(harness.stage).find('Line')).toHaveLength(3 + ticks);
	});
});
