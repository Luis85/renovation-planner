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
import { mountPlanEditorCanvas, runtimeOf, settle, type EditorHarness } from '../../helpers/editor';
import { click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../../../src/presentation/editor/handleMetrics';
import {
	RULER_TICK_SPACING_PX,
	type RulerMarks,
} from '../../../src/presentation/editor/layers/rulerGeometry';

/**
 * The ruler's marks, read off the ONE node that draws them all. They are a custom Konva
 * attribute rather than a node each, which is what keeps the per-move cost independent of
 * how long the segment is — see 'draws a long segment on no more nodes than a short one'.
 */
function measurementMarks(stage: Konva.Stage | null): RulerMarks {
	const shape = stage?.findOne<Konva.Shape>('.measurement-marks');
	if (shape === undefined) throw new Error('expected the measurement marks on the stage');
	return shape.getAttr('marks') as RulerMarks;
}

/** The layer under test; every assertion below is about what is inside it. */
function interactionLayer(stage: Konva.Stage | null): Konva.Layer {
	const layer = stage?.findOne<Konva.Layer>('.interaction');
	if (layer === undefined) throw new Error('expected a mounted interaction layer');
	return layer;
}

/** Every `Konva.Line` inside the interaction layer carrying the given `name`. */
function linesNamed(harness: EditorHarness, name: string): Konva.Line[] {
	return interactionLayer(harness.stage).find(`.${name}`) as Konva.Line[];
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
		expect(measurementMarks(harness.stage).endBars).toHaveLength(2);
		expect(measurementMarks(harness.stage).ticks).toHaveLength(0);
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

	/**
	 * The same rule at the camera doors THIS branch added, which is what
	 * `reissuePointerMove`'s own docblock anticipated when it said the rule "holds for camera
	 * paths not yet written, while 'the ones that need it' is a list that goes stale". A
	 * shift+wheel pan moves the world under a stationary pointer exactly as the keyboard zoom
	 * does, so it owes the same re-issue — and it did not have one until this merge put the
	 * two changes in the same file.
	 */
	it('keeps the loose end under the pointer when shift+wheel pans beneath it', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 300, 300);
		pointer(canvas, 'pointermove', 500, 300);
		await settle();

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, shiftKey: true, bubbles: true, cancelable: true }));
		await settle();

		const spine = interactionLayer(harness.stage).find('Line').at(0) as Konva.Line;
		const points = spine.points();
		expect(points.at(-2)).toBeCloseTo(500);
		expect(points.at(-1)).toBeCloseTo(300);
	});

	/**
	 * The fit shortcut owes the same re-issue and moves the camera further than any other
	 * door — the pointer can end up over a different part of the plan entirely.
	 *
	 * **Asserted as "not the stale point" rather than as an exact position, and the reason is
	 * behaviour rather than convenience.** A fit shortcut IS `Shift+1`, so Shift is genuinely
	 * held while it fires, and the re-issue correctly reports that — which makes the angle
	 * constraint bite. The exact loose end is therefore the CONSTRAINED one, and asserting it
	 * would mean re-implementing `snapDirection` in the test. The stale and re-issued points
	 * are far apart (781 vs 317 stage pixels when this was measured), so the weaker assertion
	 * still discriminates; it is the constraint, not the re-issue, that costs the precision.
	 */
	it('tells the tool where the pointer is when a fit shortcut jumps the camera', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 300, 300);
		pointer(canvas, 'pointermove', 500, 300);
		await settle();
		const stale = (interactionLayer(harness.stage).find('Line').at(0) as Konva.Line).points();

		canvas.dispatchEvent(new KeyboardEvent('keydown', {
			key: '!', code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true,
		}));
		await settle();

		const moved = (interactionLayer(harness.stage).find('Line').at(0) as Konva.Line).points();
		// Both ends moved: the anchor because the camera did, and the loose end because the
		// tool was told. Without the re-issue the loose end keeps the world point it was last
		// given, which the new camera renders somewhere else again.
		expect(moved.at(-1)).not.toBeCloseTo(stale.at(-1) as number);
		expect(moved.at(-1)).toBeCloseTo(316.993, 2);
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
		expect(measurementMarks(harness.stage).ticks).toHaveLength(ticks);
	});

	/**
	 * **The stage node count may not grow with the segment's LENGTH**, which is the whole of
	 * design's answer to a defect a user reported as "massive performance issues": every
	 * ruler tick used to be its own Konva node, re-rendered by Vue and re-attributed by
	 * vue-konva on EVERY pointer move. Measured through this same mounted rig, the per-move
	 * cost tracked the node count and nothing else — 0.18 ms with no tool, 0.76 ms on a
	 * five-node segment, 2.61 ms once the ruler reached its 48-tick cap, against 3.8 US for
	 * `rulerMarks` itself. The arithmetic was never the cost; the node count was.
	 *
	 * The tick count is asserted beside the node count so that the comparison is not vacuous:
	 * a segment whose ruler never got busier would hold any node count constant.
	 *
	 * **What this case does NOT reach, measured rather than assumed:** it reads the marks off
	 * the `marks` ATTRIBUTE, which is the input to the painting and not the painting. A build
	 * whose `paintRulerMarks` skipped the ticks entirely left every assertion in this file
	 * green, this one included — so the cheap fix of drawing fewer marks is refused in
	 * `rulerGeometry.test.ts`'s 'painting the ruler marks', at the one function that issues
	 * the strokes, and not here.
	 */
	it('draws a long segment on no more nodes than a short one', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 60, 60);
		pointer(canvas, 'pointermove', 80, 60);
		await settle();
		const shortNodes = interactionLayer(harness.stage).getChildren().length;
		const shortTicks = measurementMarks(harness.stage).ticks.length;

		// Long enough to reach the tick cap the ruler coarsens against.
		pointer(canvas, 'pointermove', 760, 560);
		await settle();
		const longNodes = interactionLayer(harness.stage).getChildren().length;
		const longTicks = measurementMarks(harness.stage).ticks.length;

		// The ruler really did get busier — otherwise the count below proves nothing.
		expect(longTicks).toBeGreaterThan(shortTicks);
		expect(longNodes).toBe(shortNodes);
	});
});

/**
 * The hovered zone's outline (design slice 12) — `hoverOutlineFlat`'s own computed, driven
 * directly through the runtime's `RenderState` rather than through a real hover gesture:
 * `SelectTool.pointerMove` already has its own suite, and what this describes is the LAYER's
 * three early returns, independent of whatever wrote the field.
 */
describe('the interaction layer hover outline', () => {
	it('draws a hover outline for the hovered zone and none for the selected one', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);

		runtime.renderState.hoveredObjectId = 'zone-terrace';
		await settle();
		expect(linesNamed(harness, 'hover-outline')).toHaveLength(1);

		// Selecting the same zone draws its OWN outline instead — a hover on top of a
		// selection would say nothing the selection outline does not already say.
		useSelectionStore().select(['zone-terrace' as never]);
		await settle();
		expect(linesNamed(harness, 'hover-outline')).toHaveLength(0);

		harness.unmount();
	});

	it('draws nothing for a hovered id the hydrated zones do not hold', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);

		runtime.renderState.hoveredObjectId = 'zone-nonexistent';
		await settle();

		expect(linesNamed(harness, 'hover-outline')).toHaveLength(0);

		harness.unmount();
	});
});

/**
 * The Shift angle constraint, end to end through the mounted editor: the canvas routing, the
 * tool's use of `SnapService.snapDirection`, and what the rubber band actually draws.
 *
 * Geometry: world = 10 x screen - 480 at the default camera, so a pointer 200 screen pixels
 * right of the anchor and 5 below it is about 1.4 degrees off the horizontal — inside the 15
 * degree step's basin, and far enough along that the flattening is unmistakable in pixels.
 */
describe('the angle constraint while drawing', () => {
	/** The in-progress polygon's outline: the only line the layer draws mid-sketch. */
	function looseEnd(stage: Konva.Stage | null): { x: number; y: number } {
		const outline = interactionLayer(stage).find('Line').at(0) as Konva.Line;
		const points = outline.points();
		return { x: points.at(-2) ?? Number.NaN, y: points.at(-1) ?? Number.NaN };
	}

	it('flattens the rubber band the moment Shift goes down, with the pointer still', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 700, 105);
		await settle();
		expect(looseEnd(harness.stage).y).toBeCloseTo(105);

		// No pointer movement at all — the key alone. A preview that waited for the next
		// mouse move would read as a dead key, which is what every drawing tool in the field
		// avoids by acting on the press.
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
		await settle();

		const constrained = looseEnd(harness.stage);
		expect(constrained.y).toBeCloseTo(100);
		expect(constrained.x).toBeCloseTo(700);
	});

	it('lets go again on release, just as promptly', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 700, 105);
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
		await settle();
		expect(looseEnd(harness.stage).y).toBeCloseTo(100);

		// `shiftKey` is false on the release: the tool reads the STATE, not the transition,
		// which is also what makes this work under Sticky Keys.
		canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', shiftKey: false, bubbles: true }));
		await settle();

		expect(looseEnd(harness.stage).y).toBeCloseTo(105);
	});

	/**
	 * Shift held, focus lost (Alt+Tab), the key released in the other application, and the
	 * user back with a click and no mouse movement in between: the `keyup` never reached this
	 * element, so the preview would go on showing a constrained edge while the click — which
	 * carries the REAL `shiftKey: false` — placed the vertex somewhere else. Preview and
	 * commit are the same call by design, and this was the one way they could disagree.
	 *
	 * There is no way to READ the modifier state on the web without an event, so losing focus
	 * assumes nothing is held. That is the honest answer rather than a complete one, and the
	 * next real event corrects it in either direction.
	 */
	it('drops the constraint when the canvas loses focus, where no keyup can reach it', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 700, 105);
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
		await settle();
		expect(looseEnd(harness.stage).y).toBeCloseTo(100);

		canvas.dispatchEvent(new FocusEvent('blur'));
		await settle();

		expect(looseEnd(harness.stage).y).toBeCloseTo(105);
	});

	it('ignores a key that is not the modifier, rather than re-issuing on every keystroke', async () => {
		const { harness } = await rig();
		toolbarButton(harness, 'Draw zone').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 700, 105);
		await settle();

		canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
		await settle();

		expect(looseEnd(harness.stage).y).toBeCloseTo(105);
	});
});
