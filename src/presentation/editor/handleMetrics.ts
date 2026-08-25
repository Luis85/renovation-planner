/**
 * The screen-pixel sizes of the editor's vertex handles — the ONE place the drawn dot and
 * the region that grabs it are stated, because they are two numbers that must stay in a
 * known relationship and were declared independently before this module existed.
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
