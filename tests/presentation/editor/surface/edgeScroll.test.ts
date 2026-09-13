import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { EDGE_SCROLL_MAX_STEP_PX, EDGE_SCROLL_ZONE_PX, edgeScrollStep, edgeScroller } from '../../../../src/presentation/editor/surface/edgeScroll';
import { screenPoint, type ScreenPoint } from '../../../../src/presentation/editor/viewport/Viewport';

const STAGE = { width: 800, height: 600 };

describe('edgeScrollStep', () => {
	it('scrolls nothing clear of every edge, or over a stage not measured yet', () => {
		expect(edgeScrollStep(screenPoint(400, 300), STAGE)).toBeNull();
		expect(edgeScrollStep(screenPoint(EDGE_SCROLL_ZONE_PX, 600 - EDGE_SCROLL_ZONE_PX), STAGE)).toBeNull();
		expect(edgeScrollStep(screenPoint(0, 0), { width: 0, height: 600 })).toBeNull();
		expect(edgeScrollStep(screenPoint(0, 0), { width: 800, height: 0 })).toBeNull();
	});

	it('moves the CONTENT toward the pointer\'s edge, faster the deeper into the zone', () => {
		// Left and top: see further left and up, so the plan moves right and down.
		expect(edgeScrollStep(screenPoint(EDGE_SCROLL_ZONE_PX / 2, 300), STAGE)).toEqual({ x: EDGE_SCROLL_MAX_STEP_PX / 2, y: 0 });
		expect(edgeScrollStep(screenPoint(400, 0), STAGE)).toEqual({ x: 0, y: EDGE_SCROLL_MAX_STEP_PX });
		// Right and bottom: the opposite sign; a corner scrolls both axes at once.
		expect(edgeScrollStep(screenPoint(800 - EDGE_SCROLL_ZONE_PX * 3 / 4, 600), STAGE)).toEqual({ x: -EDGE_SCROLL_MAX_STEP_PX / 4, y: -EDGE_SCROLL_MAX_STEP_PX });
	});

	it('clamps a captured pointer dragged past the edge to the full speed', () => {
		expect(edgeScrollStep(screenPoint(-500, 5000), STAGE)).toEqual({ x: EDGE_SCROLL_MAX_STEP_PX, y: -EDGE_SCROLL_MAX_STEP_PX });
	});
});

/** A window whose frames run only when the case says so. */
function frames() {
	const pending = new Map<number, FrameRequestCallback>();
	let next = 0;
	const view = {
		requestAnimationFrame: (callback: FrameRequestCallback) => { pending.set(++next, callback); return next; },
		cancelAnimationFrame: (id: number) => { pending.delete(id); },
	} as unknown as Window;
	const run = (): void => { const batch = [...pending.values()]; pending.clear(); for (const callback of batch) callback(0); };
	return { view, pending, run };
}

function scroller(at: ScreenPoint | null, tracking = true) {
	const { view, pending, run } = frames();
	const state = { tracking };
	const lastStagePoint = ref<ScreenPoint | null>(at);
	const scroll = vi.fn<(x: number, y: number) => void>();
	const edge = edgeScroller({ size: ref(STAGE), lastStagePoint, ownerWindow: () => view, tracking: () => state.tracking, scroll });
	return { edge, pending, run, scroll, state, lastStagePoint };
}

describe('edgeScroller', () => {
	it('schedules nothing while the pointer is clear of the edge, forgotten, or nothing is being drawn', () => {
		for (const r of [scroller(screenPoint(400, 300)), scroller(null), scroller(screenPoint(0, 300), false)]) {
			r.edge.follow();
			expect(r.pending.size).toBe(0);
		}
	});

	it('scrolls one step per frame for as long as the pointer rests at the edge, with one frame pending at most', () => {
		const r = scroller(screenPoint(0, 300));
		r.edge.follow(); r.edge.follow();
		expect(r.pending.size).toBe(1);
		r.run(); r.run();
		expect(r.scroll).toHaveBeenCalledTimes(2);
		expect(r.scroll).toHaveBeenLastCalledWith(EDGE_SCROLL_MAX_STEP_PX, 0);
		expect(r.pending.size).toBe(1);
	});

	it('stops by itself once the question changes between frames — the pointer moves away or the drawing ends', () => {
		const moved = scroller(screenPoint(0, 300));
		moved.edge.follow();
		moved.lastStagePoint.value = screenPoint(400, 300);
		moved.run();
		expect(moved.scroll).not.toHaveBeenCalled();
		expect(moved.pending.size).toBe(0);

		const ended = scroller(screenPoint(0, 300));
		ended.edge.follow();
		ended.state.tracking = false;
		ended.run();
		expect(ended.scroll).not.toHaveBeenCalled();
	});

	it('cancels a pending frame on stop, and stopping with none pending is harmless', () => {
		const r = scroller(screenPoint(0, 300));
		r.edge.stop();
		r.edge.follow();
		r.edge.stop();
		expect(r.pending.size).toBe(0);
		r.edge.follow();
		expect(r.pending.size).toBe(1);
	});
});
