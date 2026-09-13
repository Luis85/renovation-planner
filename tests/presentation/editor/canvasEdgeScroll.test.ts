/**
 * @vitest-environment jsdom
 *
 * EDGE SCROLLING on the Plan Canvas, through the real mounted editor: a pointer drawing
 * something — a room being dragged, a polygon with vertices placed — that rests near the pane's
 * edge scrolls the plan one step per animation frame, and the drawing follows it into what was
 * off-screen. `surface/edgeScroll.test.ts` holds the step and the frame loop in isolation; what
 * is asserted here is the ROUTING — which tool states and which camera states let it run.
 *
 * The rig's canvas is 800 × 600 at (0, 0), so x = 790 is inside the right-hand zone and x = 5
 * inside the left-hand one. Frames run only when a case calls `nextFrame`, because a real
 * `requestAnimationFrame` loop would never let a case observe one step at a time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { runtimeOf, settle } from '../../helpers/editor';
import { clearDimensionFrames, installDimensionFrames, pendingDimensionFrames } from '../../helpers/dimensionFrames';
import { activateTool, click, pointer, rig } from '../../helpers/planEditorRig';
import { resizeTo } from '../../helpers/layout';

beforeEach(() => installDimensionFrames());
afterEach(() => { clearDimensionFrames(); vi.unstubAllGlobals(); });

async function editor() {
	const built = await rig();
	const canvas = built.harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	return { ...built, canvas, camera: useEditorStore(built.harness.pinia) };
}

/** Runs every frame pending now — the editor's own measuring frames included, which are harmless. */
function nextFrame(): void {
	const batch = pendingDimensionFrames();
	clearDimensionFrames();
	for (const callback of batch) callback(0);
}

describe('edge scrolling while drawing', () => {
	it('scrolls the plan under a room drag held at the edge, and the rectangle grows into it', async () => {
		const { harness, canvas, camera } = await editor();
		activateTool(harness, 'draw-room');
		await settle();
		const draft = runtimeOf(harness).roomDraft;

		pointer(canvas, 'pointerdown', 400, 300);
		pointer(canvas, 'pointermove', 790, 450);
		const panned = camera.viewport.pan;
		const width = draft.rect?.width ?? 0;
		nextFrame();
		nextFrame();

		// The world moved LEFT under the pointer, so the camera looks further right — along x alone…
		expect(camera.viewport.pan.x).toBeGreaterThan(panned.x);
		expect(camera.viewport.pan.y).toBe(panned.y);
		// …and the re-issued move carried the loose corner with it.
		const grown = draft.rect?.width ?? 0;
		expect(grown).toBeGreaterThan(width);

		// The release settles what was drawn, and a pointer left resting at the edge scrolls no further.
		pointer(canvas, 'pointerup', 790, 450);
		const settled = camera.viewport.pan.x;
		nextFrame();
		expect(camera.viewport.pan.x).toBe(settled);
		expect(draft.rect?.width).toBeGreaterThanOrEqual(grown);
		harness.unmount();
	});

	it('scrolls nothing for a pointer merely hovering at the edge with nothing being drawn', async () => {
		const { harness, canvas, camera } = await editor();
		activateTool(harness, 'draw-room');
		await settle();
		const before = camera.viewport.pan;

		pointer(canvas, 'pointermove', 790, 300, 0, 1, 0);
		nextFrame();

		expect(camera.viewport.pan).toEqual(before);
		harness.unmount();
	});

	it('scrolls between the clicks of a polygon, and stops once the pointer leaves the pane', async () => {
		const { harness, canvas, camera } = await editor();
		activateTool(harness, 'draw-polygon');
		await settle();

		click(canvas, 400, 300);
		pointer(canvas, 'pointermove', 5, 300, 0, 1, 0);
		const before = camera.viewport.pan.x;
		nextFrame();
		// The left edge: the camera looks further left.
		expect(camera.viewport.pan.x).toBeLessThan(before);

		pointer(canvas, 'pointerleave', -5, 300, 0, 1, 0);
		const left = camera.viewport.pan.x;
		nextFrame();
		expect(camera.viewport.pan.x).toBe(left);
		harness.unmount();
	});

	it('yields to a space pan that takes the camera, and to the canvas unmounting', async () => {
		const { harness, canvas, camera } = await editor();
		activateTool(harness, 'draw-polygon');
		await settle();

		click(canvas, 400, 300);
		pointer(canvas, 'pointermove', 5, 300, 0, 1, 0);
		// A frame is pending; the pan claims the camera before it runs.
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
		pointer(canvas, 'pointerdown', 5, 300);
		const claimed = camera.viewport.pan;
		nextFrame();
		expect(camera.viewport.pan).toEqual(claimed);
		pointer(canvas, 'pointerup', 5, 300);
		canvas.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));

		// The SURFACE unmounting alone — a split narrowed below the shell's floor — with a frame
		// pending and the leaf's polygon tool still drawing: that frame must not pan a camera no
		// canvas shows, nor reach for the canvas element that is gone.
		pointer(canvas, 'pointermove', 6, 300, 0, 1, 0);
		const pending = camera.viewport.pan;
		resizeTo(harness.rootEl, 300, 800);
		await settle();
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		expect(runtimeOf(harness).toolManager.activeToolTracksPointer()).toBe(true);
		expect(() => nextFrame()).not.toThrow();
		expect(camera.viewport.pan).toEqual(pending);
		harness.unmount();
	});
});
