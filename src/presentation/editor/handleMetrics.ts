/**
 * The screen-pixel sizes of the editor's vertex marks — the ONE place a drawn dot and the
 * region that acts on it are stated, because they are numbers that must stay in a known
 * relationship and were declared independently before this module existed.
 *
 * Two families live here now: the selected zone's draggable handles, and the polygon-drawing
 * tool's placed vertices with the close target among them. They are kept apart because they
 * mean different things — one is a handle that moves geometry, the other a record of a click
 * — and a size chosen for one must not silently move the other.
 *
 * They were both called `HANDLE_RADIUS_PX`, in `select-tool.ts` (8) and in
 * `InteractionLayer.vue` (4), and the comment on the 8 claimed the handle was "eight
 * screen pixels across" while the code used it as a RADIUS. So the dot a user saw was
 * 8 px across and the region that started a vertex drag was 16 px across, and no test
 * pinned either.
 *
 * The relationship is deliberate and is the reason two constants survive rather than one:
 * a pointing target is easier to hit than it is to see, so the grab radius is larger than
 * the drawn one on purpose (Fitts's law — the same reason a checkbox's label is clickable).
 * `tests/presentation/editor/handleMetrics.test.ts` is what holds `GRAB >= DRAWN`, so the
 * ordering is a check rather than this paragraph.
 *
 * Both are SCREEN pixels at every zoom: the handle is a constant-size affordance drawn on
 * the `InteractionLayer`, which is deliberately the one layer the camera transform is not
 * bound to (`viewport/Viewport.ts`). A tool converts these through
 * `worldPerScreenPixel()` on every gesture rather than holding a world-space equivalent.
 */

/** The radius of the circle drawn for a selected zone's vertex. */
export const VERTEX_HANDLE_RADIUS_PX = 4;

/**
 * How close, in screen pixels, a primary click must land to a vertex of the SELECTED zone
 * to start a vertex drag rather than a body drag or a deselect. Larger than the drawn
 * radius by design; see the module comment.
 */
export const VERTEX_GRAB_RADIUS_PX = 8;

/**
 * The radius of the circle drawn for a vertex the user has PLACED while drawing a polygon,
 * but not yet closed. Its own constant rather than a reuse of the selected-zone handle
 * above: the two are the same size today and say different things — one is a handle that can
 * be dragged, this one is a record of a click that has happened — so a future change to
 * either must not silently move the other.
 */
export const POLYGON_VERTEX_RADIUS_PX = 4;

/**
 * The first vertex of an in-progress polygon, drawn larger than the rest because it is the
 * only one a click means something special on: clicking it CLOSES the shape. Before this
 * existed the tool drew no vertex at all — a dashed outline and nothing to aim at — and the
 * only way to learn the gesture was to be told it.
 */
export const POLYGON_CLOSE_TARGET_RADIUS_PX = 6;

/** The same target while the pointer is within closing distance of it; see the pair's test. */
export const POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX = 9;

/**
 * How close, in screen pixels, a click must land to the first vertex for it to CLOSE the
 * polygon rather than place another one — converted through the current camera on every
 * click by `DrawPolygonTool`, which is where it used to be declared as `CLOSE_TOLERANCE_PX`
 * with nothing drawn for it to relate to.
 *
 * A world-fixed tolerance was that constant's own first defect: 25 mm is a 2.5 px target at
 * the default zoom and goes sub-pixel when zoomed out. Twelve pixels: a deliberate click
 * lands, a vertex-placement click does not stumble into it — and it is the number the hover
 * reaction is armed by, so what the user sees change is exactly the region that will act.
 */
export const POLYGON_CLOSE_GRAB_RADIUS_PX = 12;

/**
 * Below this SCREEN displacement, pointerUp is a click, not a drag — converted to world
 * millimetres through the CURRENT camera on every release. A world-fixed epsilon was the
 * first version's defect: 0.5 mm is half a pixel at the default zoom, so ordinary hand
 * jitter during a click dispatched a move command — exactly the history pollution the
 * spec's "a no-op move must not pollute the undo stack" exists to prevent.
 *
 * It is measured on EVERY gesture, body and vertex alike. The second version's defect was
 * applying it only to body drags: a plain click on a vertex handle then teleported that
 * vertex to the click point — up to `VERTEX_GRAB_RADIUS_PX` away, which is 80 mm at the
 * default zoom — and pushed a real move onto the undo stack. Both gestures therefore
 * record where they STARTED, which is the whole reason the vertex arm carries a
 * `startWorld` it otherwise has no use for.
 */
export const CLICK_EPSILON_PX = 4;
