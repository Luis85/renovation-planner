# Independent wall faces

User decision, 2026-09-14: true independent A/B face distances supersede the first PR's symmetric-only interaction. Foundation [PR #212](https://github.com/Luis85/renovation-planner/pull/212), `aeb75f6067cd771cd97facc9eda1f1fc2ab7a599`, remains unchanged and green. This concern is stacked separately as `codex/usability-astra-wall-side-thickness`.

## Contract

- Keep the directed `start → end` wall reference line fixed. In the editor's downward-positive y coordinates, A is its left normal `(tangent.y, -tangent.x)` and B is the opposite normal. This agrees with existing opening-swing side semantics. Reversing a wall's direction swaps A/B and negates its bulge to describe the same footprint.
- Store `sideExtents: { a, b }` in world mm. `thickness` remains the compatibility/quantity total and must equal A+B. Legacy walls backfill A=B=thickness/2 without moving any reference point, opening or room link. Sidecar schema 13 protects asymmetric geometry from older writers.
- A/B are nonnegative; total stays within the existing 1–1,000,000 mm sanity range. A zero distance places that face on the reference line. A default button step moves the chosen face 10 mm, clamped by the other extent and total bounds. Exact numeric input does not quantize the half-mm values produced by legacy odd-mm thicknesses. Untouched stored precision is preserved.
- Numeric context entry and the full Details form expose both values and the derived total. The focused canvas mode gives each face its own input and minus/plus controls. Hover/focus highlights the corresponding face; labels and a reference-direction cue make the mapping explicit. Canvas controls clamp/tether at constrained edges and retain taskbar clearance without changing camera state.
- Preview is transient. Apply owns one StructureCommand/history entry. Cancel/Escape, mode/selection/tool changes and disposal retire the session; initial command admission remains checked around its asynchronous version read. The opposite face and reference line are never translated as a shortcut.

## Geometry seams to cover

`Wall`, `structureGeometry`, `wallThickness`, geometry equality, scaling, full/bulk measurement edits, persistence schemas/migrations/store and sidecar lowering; `wallBody`, `wallPasses`/StructureLayer, opening cuts/frame symbols, hit/framing candidates and tolerance, room-face enclosure queries and asset wall-face snapping. Hosted opening offset/width/swing records stay unchanged.

Rendering must use genuine offset polygons for asymmetric wall networks, with joined outer wedges and host clipping where needed. Symmetric networks retain their incumbent stroke path so migration alone has no visual drift. Curve offsets that reach/cross the curve centre and unsupported curved host-clipping cases must be refused explicitly rather than rendered with a misleading centred stroke. Bounds and exact supported geometry are finalized against tests.

## Verification

Focused tests must prove one-face-only changes, reversed direction, connected L/T corners, curved cases/refusals, opening masks/offset retention, selection/framing/snapping, schema backfill/backward refusal, shared history/undo/redo, reload, stale/busy/no-op cases, retained callbacks and mode changes, hover/focus mapping and narrow layout. Browser captures use the approved Obsidian-native overlay/menu pattern in EN/DE, light/dark and narrow panes, in at most two visual rounds. Keep generic Add detail removed. One final detector, full one-worker npm run check exit 0 on the final code/test tree, read-only audit and green CI are required before handoff.

This does not close I18 or implement the separately queued opening resize/swing controls.
