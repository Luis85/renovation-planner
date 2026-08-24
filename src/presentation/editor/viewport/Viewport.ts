import type { Point } from '../../../core/geometry/Point';

/**
 * The viewport transform (SDD §24): the ONE boundary at which world millimetres
 * (ADR-009) become pixels.
 *
 * It lives here rather than in `core/geometry/` because slice 2 excludes viewport
 * transform from its own scope — "core never sees a pixel" — so `ScreenPoint`,
 * `screenPoint()`, `worldToScreen()` and `screenToWorld()` are this slice's own
 * contribution, built on slice 2's `Point`. This module is their ONE declaration in
 * `src/`: slice 6 imports them from here and defines none of them, because two
 * structurally identical brands type-check everywhere and guarantee nothing
 * (`tests/presentation/editor/viewport/declarations.test.ts` is what checks that,
 * rather than this paragraph).
 *
 * **Rendering is not a caller.** Pan and zoom are the content `Group`'s own transform
 * (`contentGroupTransform` below), so no shape's vertices are converted per frame —
 * see `PlanCanvas.vue`. What still calls these two is anything that needs genuine
 * pixels: a pointer position on its way to a world coordinate, and the measurements
 * readout. The Group's transform is DERIVED from `worldToScreen` here, so there is one
 * definition of the transform rather than two that can disagree.
 */
export type { Point } from '../../../core/geometry/Point';

/**
 * A coordinate in the stage's pixel space. Deliberately incompatible with `Point`,
 * which is always world millimetres: the two are the same shape and mean opposite
 * things, and a codebase that lets one be passed where the other is expected has no
 * coordinate system at all. The incompatibility runs both ways only because `Point`
 * carries a phantom `__brand?: undefined` field of its own
 * (`../../../core/geometry/Point.ts`) — without it, a value merely ADDING this
 * `__brand` property would still satisfy `Point` structurally.
 * `tests/presentation/editor/type-safety.test-d.ts` is what checks that, rather than
 * this paragraph.
 */
export interface ScreenPoint {
	readonly x: number;
	readonly y: number;
	readonly __brand: 'ScreenPoint';
}

/**
 * The only way to make a `ScreenPoint` out of raw pointer or DOM numbers, and the only
 * cast in this module. Without it the brand would be unconstructible outside
 * `worldToScreen` and every call site would reach for a cast of its own — which is the
 * same as having no brand.
 */
export function screenPoint(x: number, y: number): ScreenPoint {
	return { x, y } as ScreenPoint;
}

export interface Viewport {
	/** The world-space location sitting under the stage's own origin. */
	readonly pan: Point;
	/** Stage pixels per world millimetre. */
	readonly zoom: number;
}

/**
 * The device-pixel argument every caller in this plugin passes.
 *
 * §24 lists the device pixel ratio among the transform's components, and it is one —
 * but **Konva's `Stage` already applies it**: `Canvas.setWidth` sizes the backing
 * canvas to `width * pixelRatio` and scales its 2D context to match, with
 * `pixelRatio` defaulting to `window.devicePixelRatio`. Konva's pointer positions come
 * back in the same space. So passing a real ratio here would apply it a second time and
 * draw everything `dpr` times too large — the parameter is kept because the transform
 * genuinely has that component and something outside the stage may one day need it (a
 * raster export at native resolution is the plausible case), and this constant is what
 * keeps every caller inside the stage from having to decide.
 */
export const STAGE_PIXELS = 1;

/** Zoom bounds for the camera. Below the floor a plan is a dot; above the ceiling a
 * millimetre fills the pane and panning becomes unusable. */
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 20;

/**
 * What a Plan Editor opens at.
 *
 * The zoom is a fixed default because there is nothing yet to fit to: design slice 5 says
 * the camera resets to a computed "fit to background", and until slice 7 gives a Plan a
 * calibrated background there is no extent to compute one from. At 0.1 a 12-metre plan is
 * 1200 stage pixels, which is about a pane.
 *
 * The pan is NOT the origin, and the margin is why: a plan's geometry conventionally
 * starts at world `(0, 0)`, so an origin flush against the pane corner clips everything
 * drawn just outside a shape — every zone caption sits above its own top edge, and at
 * `pan = (0, 0)` three of four captions were off the top of the pane. Found by looking
 * (`npm run harness-shot`); jsdom draws nothing and could not have.
 */
const DEFAULT_ZOOM = 0.1;

/** Stage pixels of clear space between the pane's corner and world `(0, 0)`. */
const DEFAULT_MARGIN_PX = 48;

export const DEFAULT_VIEWPORT: Viewport = {
	pan: { x: -DEFAULT_MARGIN_PX / DEFAULT_ZOOM, y: -DEFAULT_MARGIN_PX / DEFAULT_ZOOM },
	zoom: DEFAULT_ZOOM,
};

export function clampZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function worldToScreen(point: Point, viewport: Viewport, dpr: number): ScreenPoint {
	const scale = viewport.zoom * dpr;
	return screenPoint((point.x - viewport.pan.x) * scale, (point.y - viewport.pan.y) * scale);
}

export function screenToWorld(point: ScreenPoint, viewport: Viewport, dpr: number): Point {
	const scale = viewport.zoom * dpr;
	return { x: point.x / scale + viewport.pan.x, y: point.y / scale + viewport.pan.y };
}

/** What a Konva node's `x`/`y`/`scaleX`/`scaleY` config wants — plain numbers, no brand. */
export interface NodeTransform {
	readonly x: number;
	readonly y: number;
	readonly scaleX: number;
	readonly scaleY: number;
}

/**
 * The whole pan-and-zoom transform, as ONE value bound to every world-space layer's own
 * Konva config. Its position is simply where world `(0, 0)` lands on screen — computed by
 * `worldToScreen` above, so the scene and these two functions cannot drift apart.
 *
 * Pan and zoom therefore cost one node transform per layer and re-derive no shape's
 * vertices at all; nothing in the render path calls `worldToScreen` per point, which at a
 * few hundred zones would be `O(total vertices)` of JavaScript on every frame of a drag.
 *
 * **Why per LAYER and not one content `Group` holding all of them**, which is what design
 * slice 5 drew: Konva refuses it. `group.add(layer)` throws *"You may only add groups and
 * shapes to groups"* — measured, not reasoned — because a `Layer` owns a canvas and only a
 * `Stage` can parent one. What the Group was actually FOR survives the change: slice 6
 * needs somewhere for nodes that must not scale (a `Transformer`'s handles, snap guides,
 * vertex handles are constant-size screen affordances), and that somewhere is the
 * `InteractionLayer`, which is deliberately the one layer this transform is NOT bound to.
 *
 * `STAGE_PIXELS` and not a device ratio, for the reason that constant states.
 */
export function viewportTransform(viewport: Viewport): NodeTransform {
	const origin = worldToScreen({ x: 0, y: 0 }, viewport, STAGE_PIXELS);
	return { x: origin.x, y: origin.y, scaleX: viewport.zoom, scaleY: viewport.zoom };
}

/**
 * Zoom about a fixed screen point — the wheel-zoom rule that keeps whatever is under the
 * pointer under the pointer. Expressed as "the world point that was there must still be
 * there", which is why it reads through both functions rather than deriving a new pan
 * formula that would be a third statement of the same transform.
 */
export function zoomAbout(viewport: Viewport, anchor: ScreenPoint, nextZoom: number): Viewport {
	const zoom = clampZoom(nextZoom);
	const worldUnderAnchor = screenToWorld(anchor, viewport, STAGE_PIXELS);
	return {
		zoom,
		pan: {
			x: worldUnderAnchor.x - anchor.x / zoom,
			y: worldUnderAnchor.y - anchor.y / zoom,
		},
	};
}

/** Drag-to-pan: a screen-space delta moved into world space at the current zoom. */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
	return {
		zoom: viewport.zoom,
		pan: { x: viewport.pan.x - dx / viewport.zoom, y: viewport.pan.y - dy / viewport.zoom },
	};
}
