# Plan editor transform box — design

Date: 2026-09-15. Status: approved in chat (padded box; per-placement absolute size).

## Goal

A selected **item** (`kind: 'object'`) or **placed asset** (`kind: 'asset'`) on the plan shows a
transform box with eight resize handles, so it can be fitted to the plan by dragging. Move (body
drag) and rotate (the existing edge arrow) stay as they are.

## Decisions

1. **Not a `Konva.Transformer`.** The interaction layer is `listening: false` and `SelectTool` hit
   tests from geometry (SDD §62); a `VTransformer` needs listening nodes and reports
   `scaleX`/`scaleY` that must be normalised back (ADR-003), whose normaliser R5 deleted as
   unused. The box is drawn and hit tested the way the rotation arrow already is.
2. **Reuse the asset designer's box arithmetic.** `boxHandlePoint` (`designer/selection/handles.ts`)
   and the private `boxResize` (`designer/selection/selectionDrag.ts`) move to
   `src/core/geometry/boxHandles.ts`; the designer imports them from there. One definition of
   handle order (clockwise from top-left, `(index + 4) % 8` is the fixed handle) and of Shift.
3. **Padded box, no mode switch.** The box is drawn `TRANSFORM_BOX_PADDING_PX` (12) screen pixels
   outside the element's oriented extent, so an item's vertex dots stay grabbable. Where both are in
   reach, the vertex handle wins.
4. **Per-placement absolute size for assets.** A placement may carry `size: { width, depth }`
   (world mm, along the library shape's own x and y axes — the axes `dimensionsOf` measures). The
   placement keeps that size if the library shape later changes; its drawing is stretched to fit.
5. **Items need no model change** — a resize writes new outline points.

## Interaction

**When the box shows** — the same gates as the rotation arrow: exactly one selected element of
kind `object` or `asset`; Plan perspective; not locked; its layer visible; writes not blocked; no
`edit-curves` tool active. An asset whose shape answer is not `placeable` (missing, unreadable,
no shape, unscaled) shows no box. Multi-selection, groups and every other kind show none.

**Orientation** — the box is not screen-aligned:

- *Asset*: the library shape's frame turned by `heading − facing`.
- *Item*: the direction of its first non-zero edge (`points[i] → points[i+1]`) and its
  perpendicular. An item with no non-zero edge shows no box.

The box is the min/max of the element's footprint projected onto those two axes.

**Handles** — eight squares (corners and side midpoints), constant screen size, drawn in
`InteractionLayer` in screen space exactly as the vertex dots are, plus a thin box outline; stroke
`tokens.accent`, fill `tokens.canvasBackground`. Hovering one highlights it (filled with
`tokens.accent`). No cursor change: the editor sets none for any other handle either.

**Hit priority** in `resolveSelectionTarget`: rotation control → vertex handle → **box handle**
(new target `{ kind: 'resize', id, handleIndex }`, grab radius `VERTEX_GRAB_RADIUS_PX`) → label →
body. Alt bypasses box handles as it bypasses the other decorations.

**Drag** (`ElementResize`, beside `ElementMove` and `ElementRotation` in `SelectTool`):

- A press is not yet a resize; travel past `CLICK_EPSILON_PX` starts it.
- The dragged handle's world point is snapped through `snapService.snapPointWithGuides` against
  `snapCandidates([id])`, then projected into the box frame; the opposite handle holds still.
- Side handles change one axis. **Shift keeps proportions** (`boxResize`'s rule).
- A span below 1 mm or flipped past the fixed side keeps the last valid preview; releasing there
  cancels.
- Preview through the existing `previewElement`; release commits once; Escape or a stale target
  cancels, the same as a move.
- The rotation arrow's layout treats the box handles as obstacles, so the two never overlap.

## Geometry

**Item resize** (`src/presentation/editor/elements/transformBox.ts`, pure): for axis `u`, `v` and
origin `o`, each point maps to local `(a, b)`, is scaled about the fixed handle's local
coordinates by the factors `boxResize` returns, and maps back. Points are not rounded (rotation
does not round either). The result must pass `acceptsElementPoints`.

**Asset outline** (`src/domain/spatial/assetPlacement.ts`): `placedOutline` stretches footprint,
clearance and details about the shape anchor by `kx = size.width / W0`, `ky = size.depth / D0`
(`W0`, `D0` from `dimensionsOf(shape.footprint)`) before turning and moving them. With no `size`
it is today's function exactly. `membershipProbe` is unchanged (10 mm in front of the anchor).

**Asset resize** (`resizedPlacement`, same module, pure): given the placement, its shape, the
handle index, the snapped world point and Shift, returns `{ points, size }`. The fixed handle's
world position is preserved by moving the anchor: `A' = A + R(θ)((k − k') ⊙ f)`, where `f` is the
fixed handle relative to the anchor in the unscaled shape frame; the facing point follows from
`placementPoints(A', heading)`. A size equal to the library size (within 0.5 mm per axis) is
written as **no `size` field**, the way a reset colour removes `color`.

**Replace asset** drops `size`: a different asset starts at its own library size.

## Data

- `SpatialElement.size?: Dimensions` — only an `'asset'` may carry one; `width` and `depth` finite,
  `> 0`, `≤ 1e6`. Enforced in `validSpatialElement`.
- Plan geometry **schema 15**: `SpatialElementSchemaV15 = V14 element + size` with the asset-only
  refine; `PlanGeometrySchema` union and `PlanGeometryDTO['schemaVersion']` gain 15.
- `PlanGeometryStore.writtenSchema` returns 15 when any element carries `size` (checked first), so
  a schema-14 build refuses the file rather than silently dropping sizes.
- Migration 14 → 15 is a version bump, as 13 → 14 is.
- Any whole-document comparison that lists element fields (`sameGeometryDocument`, the move stale
  check in `elementActions.move`) compares `size` too.

## Writes and undo

Resize goes through `elementActions`' existing `operate` → `renovation.command` path, like `move`
and `setColor`: one dispatch, one undo entry, stale-refused when the element's points, stair or
size changed since the press.

## Inspector

`AssetPlacementDetails.vue`'s "W × D" line becomes two length fields (width, depth; the
`formatLength` parsers and `commitField` pattern) committing through the same resize write about
the placement's centre, plus a **Reset to library size** button shown only while `size` is set.
Not shown for a non-placeable shape (the reason text stays). New strings in en and de, sentence
case.

## Out of scope

Resize for posts (their own section fields), hatches, stairs, drafting marks, groups and
multi-selection; a rotate knob on the box; per-placement size for items (they have points).

## Testing

- `core/geometry/boxHandles` — handle points and `boxResize` (moved tests from the designer).
- `transformBox` — oriented box for an axis-aligned and a rotated item; corner, side and Shift
  resize; refusal below 1 mm and past the fixed side.
- `assetPlacement` — `placedOutline` with and without `size` (identity when absent);
  `resizedPlacement` keeps the fixed corner in world space at 0°, 90° and 30° headings; equal size
  collapses to no field.
- `validSpatialElement` and the schema: `size` on a non-asset refused; schema-15 round trip;
  `writtenSchema` picks 15; 14 → 15 migration.
- `resolveSelectionTarget` — box handle below a vertex handle, above a body; Alt bypass.
- `SelectTool` — resize preview, Shift, snap guides, release write, click-without-travel, Escape,
  stale target.
- `AssetPlacementDetails` — field commit, reset, hidden for non-placeable shapes.
- Harness capture of a selected item and a selected rotated asset in both schemes; a manual case
  `docs/tests/cases/Resize an item and an asset on the plan.md` (unrun until walked in a vault).
