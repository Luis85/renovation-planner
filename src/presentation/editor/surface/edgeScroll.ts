import type { Ref } from 'vue';
import type { ScreenPoint } from '../viewport/Viewport';

/** How far inside the pane's edge, in stage pixels, a drawing pointer starts scrolling the plan. */
export const EDGE_SCROLL_ZONE_PX = 40;

/** The fastest scroll, in stage pixels per frame — reached at the edge itself and anywhere past it. */
export const EDGE_SCROLL_MAX_STEP_PX = 16;

/**
 * One axis: positive near the start edge, negative near the end edge, zero between. The speed
 * ramps with how deep into the zone the pointer is, so a pointer merely crossing the zone on its
 * way to a panel barely moves the plan. A captured drag reports points past the edge; those are
 * clamped to the full speed rather than accelerating without bound.
 */
function axisStep(at: number, length: number): number {
	const depth = at < EDGE_SCROLL_ZONE_PX ? EDGE_SCROLL_ZONE_PX - at : at > length - EDGE_SCROLL_ZONE_PX ? length - EDGE_SCROLL_ZONE_PX - at : 0;
	return Math.max(-1, Math.min(1, depth / EDGE_SCROLL_ZONE_PX)) * EDGE_SCROLL_MAX_STEP_PX;
}

/**
 * The pan, in screen pixels for `EditorStore.panByScreen`, one frame of edge scrolling owes for a
 * pointer at `at` over a stage of `size` — or `null` when the pointer is clear of every edge.
 *
 * The sign is the CONTENT's: a pointer at the left edge asks to see further left, which moves the
 * plan right. An unmeasured stage (`0 × 0`, before layout) scrolls nothing.
 */
export function edgeScrollStep(at: ScreenPoint, size: { readonly width: number; readonly height: number }): { x: number; y: number } | null {
	if (size.width <= 0 || size.height <= 0) return null;
	const x = axisStep(at.x, size.width), y = axisStep(at.y, size.height);
	return x === 0 && y === 0 ? null : { x, y };
}

/** What the scroller reads of the canvas surface — never the surface itself. */
export interface EdgeScrollSurface {
	readonly size: Readonly<Ref<{ readonly width: number; readonly height: number }>>;
	/** The OWNER's pointer in stage pixels, `null` once it is forgotten (leave, cancel, blur). */
	readonly lastStagePoint: Readonly<Ref<ScreenPoint | null>>;
	/** The window the canvas lives in — a pop-out leaf's own, whose frames are the ones that run. */
	ownerWindow(): Window;
	/** Whether a drawing's loose end follows the pointer right now, with the camera free to move. */
	tracking(): boolean;
	/** Pans the plan by one step and tells the active tool where the pointer now is in the world. */
	scroll(x: number, y: number): void;
}

/**
 * Scrolls the plan while a drawing pointer rests at the pane's edge: one animation frame at a
 * time, and every frame asks the whole question again — so it stops by itself the moment the
 * pointer leaves the zone, the tool stops drawing, a pan takes the camera or the pointer is
 * forgotten, with no door having to remember to stop it. `follow` is the pointer doors' call;
 * `stop` is for a surface about to unmount, whose store a pending frame must not reach.
 */
export function edgeScroller(surface: EdgeScrollSurface): { follow(): void; stop(): void } {
	let frame: { readonly id: number; readonly view: Window } | null = null;
	function step(): { x: number; y: number } | null {
		const at = surface.lastStagePoint.value;
		return at !== null && surface.tracking() ? edgeScrollStep(at, surface.size.value) : null;
	}
	function tick(): void {
		frame = null;
		const next = step();
		if (next === null) return;
		surface.scroll(next.x, next.y);
		follow();
	}
	function follow(): void {
		if (frame !== null || step() === null) return;
		const view = surface.ownerWindow();
		frame = { id: view.requestAnimationFrame(tick), view };
	}
	function stop(): void {
		frame?.view.cancelAnimationFrame(frame.id);
		frame = null;
	}
	return { follow, stop };
}
