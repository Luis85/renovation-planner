import { POLYGON_CLOSE_GRAB_RADIUS_PX } from './handleMetrics';
import type { ScreenPoint } from './viewport/Viewport';

/**
 * Whether a click at `pointer` would CLOSE the polygon being drawn — the ONE predicate
 * behind both the click that acts (`DrawPolygonTool.pointerDown`) and the mark that promises
 * it (`InteractionLayer`'s close target).
 *
 * **In screen pixels, and that is what makes it shareable.** The tolerance is a screen-sized
 * affordance, so expressing the rule in stage pixels lets the tool project its world click
 * through the camera it already holds, and lets the layer — which works in stage pixels for
 * everything else — ask the same question of the projections it has already made. A
 * world-space version would have forced the layer to convert a tolerance it has no camera
 * arithmetic for, which is how the two ended up as separate answers in the first place.
 *
 * **A predicate, never a cached flag.** The first version of the close target stored the
 * answer on `RenderState` at each `pointermove`. Wheel and keyboard zoom stay live while a
 * drawing tool is active (`EditorSurface`), so the camera moves under a stationary pointer: the
 * vertex slides more than the tolerance away while the mark goes on saying a click will
 * close, and the click then places a vertex instead. Asking per render, off a `computed`
 * that reads the viewport, makes that state unrepresentable rather than merely refreshed.
 * Found by a review bot on the pull request; the regression is
 * `tests/presentation/editor/interactionLayer.test.ts`'s zoom case.
 */

/** Below this a polygon has no interior, so no click on the first vertex can close it. */
export const POLYGON_MIN_VERTICES = 3;

export function closesPolygon(
	vertexCount: number,
	pointer: ScreenPoint,
	firstVertex: ScreenPoint,
): boolean {
	if (vertexCount < POLYGON_MIN_VERTICES) return false;
	return Math.hypot(pointer.x - firstVertex.x, pointer.y - firstVertex.y)
		<= POLYGON_CLOSE_GRAB_RADIUS_PX;
}
