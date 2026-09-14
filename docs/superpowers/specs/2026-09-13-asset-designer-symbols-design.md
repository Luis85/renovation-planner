# The asset designer, symbols: curves, details, presets and part editing

**Status:** design approved in conversation 2026-09-13; planned. PR 1 (steps 1–2: curved outlines,
detail linework and presets) is implemented on branch `claude/asset-editor-modeling-58c8d3`;
steps 3a and 3b (selection and part editing, draw tools) ship together as PR 2 on
`claude/asset-designer-part-editing` — see Amendment 1. Its follow-ups and polish are planned on
`claude/asset-designer-selection-polish` — see Amendment 2.
**Builds on:** [`2026-08-30-asset-designer-first-increment-design.md`](./2026-08-30-asset-designer-first-increment-design.md)
(its Decisions 1, 3 and 6 are load-bearing here), ADR-0014, ADR-0015,
[`2026-09-10-plan-editor-asset-placement-design.md`](./2026-09-10-plan-editor-asset-placement-design.md).
**Closes:** `docs/requirements/Select part of an object's shape.md`.

## Why

An asset's shape today is one straight-edged footprint polygon plus a clearance, an anchor and a
facing. That cannot describe a round table, a curved table or a tree canopy, and it cannot show
what a toilet or a chair *is* on a plan — every asset draws as a bare outline. Every correction is
a re-creation, because the designer has no selection.

The goal: a renovator can model common assets — chairs, round and curved tables, trees, toilets,
beds, sofas, sanitary fittings — as **plan symbols**: an accurate outer outline for size,
placement and clearance, plus interior linework that says what the object is.

## Decisions taken in the brainstorm

| Question | Answer |
| --- | --- |
| What does a placed asset look like? | A symbol: outline of record plus interior detail linework. |
| How is a symbol authored? | Start from a preset sized by typed dimensions, then edit ordinary parts with shape tools. Presets are NOT live-parametric. |
| How do details relate to the footprint? | Separate. The footprint stays the geometry of record and may curve; details are an optional drawing layer; nothing edits the footprint implicitly. |
| Which presets? | Tables, seating, sanitary, plants and beds (14 generators). |
| Editing depth? | Whole parts (move, resize, rotate, duplicate, delete, reorder) **and** vertices and edge bends. |

## Decisions

### 1. Every detail is a curved outline

A detail is `{ id, name, outline: CurvedPolygon, line: 'solid' | 'dashed', pending }`, the
points-plus-bulges type rooms already use (`src/core/geometry/CurvedPolygon.ts`).

A circle is four points with 90° arcs; an oval table is an exact stadium (`bulges: [0, 1, 0, 1]`);
a curved table is a ring sector with one convex and one concave edge; a canopy is an N-point
outline with bulged edges; a toilet bowl is a four-arc oval.

**Rejected:**

- **Typed primitives** (`rect | ellipse | arc | polygon` with parametric fields). Exact ellipses
  and a circle that keeps a radius, bought with a per-kind branch in hit-testing, transforms,
  calibration, plan rendering, the library mark and vertex editing — roughly three times the code
  for a fidelity difference invisible at plan scale.
- **SVG path strings.** Would admit imported symbol SVGs, but `src/core` has no Bézier arithmetic,
  and hit-testing, calibration and validation would all need a path parser. If import is ever
  wanted it arrives as a *converter into* Decision 1's type.

**Accepted cost:** a true ellipse is approximated by circular arcs; a stretched circle
(Decision 9) becomes a four-arc oval, not an ellipse.

### 2. The footprint and clearance may curve; the footprint stays the geometry of record

`AssetShape.footprint` and `clearance` widen from `Polygon` to `CurvedPolygon`. The types are
structurally compatible (`bulges` is optional), and the first increment's Decision 1 is unchanged:
width and depth are the footprint's bounding box, stored nowhere. `boundingBoxOf` already includes
arc extrema, so `dimensionsOf` needs no change and a circular footprint reports its diameter.

`validateAssetShape` moves from `createPolygon` to `createCurvedPolygon`. **A v1 file that reads
today still reads**: `createCurvedPolygon`'s self-intersection check runs only when the outline has
a non-zero bulge (`validateCurvedBoundary`), so straight outlines get exactly the validation they
get now. A v1 fixture test holds that.

### 3. Details are named "details", not "parts"

`Select part of an object's shape` already uses *part* for the footprint, the clearance, the anchor
and the facing. Reusing the word for linework would make that item and this one ambiguous. The UI
label is "Detail".

### 4. Draw order is array order; solid covers, dashed does not

Details draw in array order. A **solid** detail is filled with the canvas background, so it covers
what was drawn before it — chair seats tuck under a tabletop, a bowl covers the tank's edge. A
**dashed** detail is unfilled, following the drafting convention that dashed means overhead or
hidden. This is a convention of the `line` field, not a second field.

### 5. One pending flag per detail

Each detail carries its own `pending`, set when it is captured by pointer over an uncalibrated
background and cleared by the calibration that converts it — the first increment's Decision 3
("one flag per thing that can be captured on its own") applied to a new group. `CalibrateAsset`
rescales exactly the details whose flag is set, alongside the three existing groups. Preset and
typed details are never pending. Uniform scaling leaves a bulge unchanged, so calibration touches
points only.

### 6. Sidecar schema version 2, upgraded in the store

- `footprint` and `clearance` become `{ points, bulges? }`, one bulge per edge within ±1 — the
  plan sidecar's V7 rule, reused rather than re-declared.
- `details: [{ id, name, outline: { points, bulges? }, line, pending }]`, defaulting to `[]`.
- `AssetGeometryStore` accepts version 1 or 2, raises v1 to v2 in memory (no details, no bulges)
  and writes version 2 only.

**The bump is required, not optional.** Zod strips unknown keys, so an older build reading a file
with details would load it and erase every detail on its next write. With the bump, that build's
`schemaVersion: z.literal(1)` refuses the file instead.

No `MigrationRunner`: the store already declines one for a stated reason (the
`DiagnosticEntityKind` union), and that reason stands.

### 7. One command for every whole-shape edit

`SetAssetShape({ assetId, shape })` writes a complete `AssetShape` through `updateAssetShape` and
the existing versioned reversible edit (`ReversibleAssetGeometryEdit` already snapshots and
restores the entire geometry). It keeps the background and calibration. It never answers
`no-write`: re-applying an identical shape writes again, which costs a revision and nothing else.

Both presets (Decision 8) and every part edit (Decision 9) compute a new shape in the domain and
dispatch this one command, so the guarded-services / command-bundle / reversible-adapter /
`runtime.ts` wiring is done **once**. `validateAssetShape` is the gate on this wide input; a
version conflict is refused exactly as an undo is.

*(The in-conversation Section 3 named a `SetAssetShapeFromPreset` command. Section 4 replaced it
with this one; this document records only the result.)*

The existing narrow commands (`SetAssetFootprint`, `SetAssetClearance`, `SetAssetAnchor`,
`SetAssetFacing`, `SetAssetFootprintFromDimensions`) stay, because the tracing and dimension
gestures already use them. Re-tracing a footprint clears only the footprint's own bulges and leaves
details untouched.

### 8. Presets are pure domain generators

`src/domain/asset/presets/`: a catalogue of descriptors
`{ id, group, fields, build(values): Result<AssetShape, ValidationError> }`, with
`fields: { key, kind: 'length' | 'count' | 'angle', min, max, default }[]`.

- **`id` is data** — like a command id, never renamed.
- **No text in the domain.** Preset names are i18n keys `preset.<id>`; field labels are shared by
  field key, `designer.preset.field.<key>`, because a width is labelled the same on every preset.
  Preset ids (`PresetId`) and field keys (`PresetFieldKey`) are closed unions, so a missing label is
  a build error. Detail `name`s are stable lowercase keys (`seat`, `bowl`), not display text.
- **Shared conventions:** centred on the origin; width along x, depth along y; front toward +y, so
  `facing = π/2`; typed footprint, never pending; a default clearance where a common one exists.
  The front convention matches wall snapping: `assetPlacementDraft` offsets by `backDepth`, which
  measures behind the facing, so a toilet's back lands against the wall.
- The preset id and values are **not stored**. Once applied, the result is ordinary geometry.

| Group | Preset (fields, defaults in mm) | Footprint | Details |
| --- | --- | --- | --- |
| Tables | `rect-table` (width 1600, depth 900) | rectangle | — |
| | `round-table` (diameter 900) | circle, 4 arcs | — |
| | `oval-table` (length 1800, width 1000) | stadium, exact | — |
| | `curved-table` (outer radius 1500, depth 600, sweep 90°, max 180°) | ring sector | — |
| Seating | `chair` (width 450, depth 500) | rectangle | seat, backrest |
| | `armchair` (width 800, depth 800) | rectangle | seat, backrest, two arms |
| | `sofa` (width 2000, depth 900, seats 3) | rectangle | back, two arms, one cushion per seat |
| Sanitary | `toilet` (width 380, depth 700) | rounded silhouette | tank, bowl |
| | `washbasin` (width 600, depth 450) | rectangle | basin, tap hole |
| | `shower-tray` (width 900, depth 900) | rectangle | drain |
| | `bathtub` (length 1700, width 750) | rectangle | inner basin (stadium), drain |
| Plants & beds | `tree` (canopy diameter 3000, trunk diameter 300) | circle | lobed canopy, trunk |
| | `shrub` (diameter 1000) | circle | lobed outline |
| | `bed` (width 1600, length 2000, pillows 2) | rectangle | pillows, duvet |

The curved table's sweep is capped at 180° because a bulge above 1 is refused (`validateBulges`);
a wider sweep would need a split arc, which no preset needs. `build` refuses incoherent values
(e.g. a depth not below the outer radius) with an `assetError` code the dialog maps to a sentence.

Single and double beds are one preset: width plus pillow count covers both.

### 9. Part edits are pure domain functions

`src/domain/asset/shapeEdits.ts`: `moveOutline`, `moveVertex`, `setBulge`, `resizeBox`,
`rotateOutline`, `addDetail`, `duplicateDetail`, `deleteDetail`, `reorderDetail`,
`fitFootprintToDetails`, `scaleDesign`. Each takes a shape and answers a validated shape or a
refusal.

- **Pending flags are carried through**: an edit to a group in background pixels leaves it in
  pixel space.
- **Rotation preserves bulges.** A vertex move keeps the point count, so `preservePointCurves`
  keeps the curves.
- **Non-uniform `resizeBox`** scales points and keeps bulges, so arcs stay circular through the new
  chords — stated behaviour, tested. Shift keeps proportions.
- **The footprint cannot be deleted.** The clearance can (to `null`).
- **`fitFootprintToDetails`** writes the bounding rectangle of the details' flattened outlines as a
  typed footprint.
- **`scaleDesign(sx, sy)`** scales footprint, clearance, details and anchor about the anchor. "Set
  dimensions" uses it on a shape that has details or curves; a plain rectangle keeps today's
  replace-with-rectangle behaviour, so existing tests stand.

### 10. Selection, with a stated hit order and three modes

**What is selectable:** the footprint, the clearance, a detail (by id), the anchor, the facing
handle — one at a time (multi-selection is out, as the PBI says). The selection lives in the
designer's own `assetDesignStore`, per leaf, and clears when what it names stops existing (a
delete, or an undo that removes a detail). A selection writes nothing.

**Hit order, deterministic** (PBI extension 1b):

1. the current selection's own handles for the active mode (box and rotate handles, vertex
   handles, or edge midpoints), within a screen-pixel radius (`handleMetrics.ts`) — so a handle
   drawn over a detail is still the handle;
2. anchor or facing handle, within the same radius;
3. details, topmost first (last in the array);
4. footprint interior;
5. clearance band — inside the clearance and outside the footprint;
6. anything else clears the selection (extension 1a).

**Three modes for a selected outline**, chosen in the context bar, so a rectangle's corner handles
and its vertex handles never compete for one pointer:

- **Transform** (default) — eight box handles, a rotate handle, body drag to move.
- **Edit points** — vertex handles, snapped through the existing snap service. The designer's
  `EditorContext.snapCandidates` (today `() => ({})`) supplies footprint and detail vertices and
  the anchor.
- **Bend edges** — the plan editor's `CurveTool`, bound through its `CurveToolActions` seam to the
  selected outline.

**Keyboard:** Delete removes the selected detail or clearance; arrows nudge 10 mm (Shift: 100 mm);
Ctrl+D duplicates; Escape follows the existing pan → draft → tool → selection order.

Every gesture is one `SetAssetShape` dispatch, one undo entry, applied whole or refused whole — the
PBI's guarantee.

### 11. Drawing tools for details

Added to `DESIGNER_TOOL_LABELS` (the record the toolbar test asserts **exactly**):

- `select`;
- `draw-rect` — drag a box;
- `draw-circle` — drag from the centre;
- `trace-detail` — the existing `DrawPolygonTool`, completing into `addDetail`.

A detail captured over an uncalibrated background is pending, by the rule tracing already follows.
`select` returns with its candidates and its gesture together, which is the condition
`registerDesignerTools.ts`'s FIVE-tools note sets for bringing it back.

## Rendering

Eleven sites in `src/` read `footprint.points` or `clearance.points` directly. Each takes one of
three treatments:

**Carries vertices and bulges through** (a similarity transform leaves a bulge unchanged):
validation (`AssetShape.ts`), calibration (`CalibrateAsset.ts`), the sidecar adapter
(`ObsidianAssetGeometrySidecar.ts`).

**Reads the flattened curve** through `polygonPolyline` (the `ZoneShape.vue` pattern):

- `placedOutline` (`assetPlacement.ts`) — flattened at a fixed 1 mm world tolerance *before* it is
  turned onto the placement, so its `Point[]` answer and every plan consumer of it
  (`elementFootprint`, hit-testing, labels, rotation handles) stay exactly as they are. *(Amended
  while planning: the design said "carries bulges through"; flattening here is the smaller change
  and 1 mm of sagitta is below a plan's pixel.)*
- `backDepth` (`assetPlacement.ts`) — an arc can reach past its corner points, so the points alone
  answer wrong;
- designer `footprintLayer.ts` and `clearanceLayer.ts`, at a zoom-aware tolerance of 0.25 px ÷ zoom;
- library: `ListAssetOutlines.ts` and `AssetInspectorShape.vue` hand `AssetMark` flattened points,
  so `AssetMark.vue` is unchanged and its extent is already curve-aware.

**Adds details:**

- **Designer:** `layers/detailsLayer.ts`, between the footprint and clearance layers — one closed
  Konva line per detail in array order; solid filled with `canvasBackground`, dashed unfilled with a
  dash; stroke in screen pixels, like the footprint.
- **Plan editor:** `placedOutline` also returns `details`; `assetShapeConfig` adds a `details`
  config list and draws footprint and clearance through `polygonPolyline`; `AssetShapes.vue` draws
  details after the footprint with `listening: false`. Details use `zoneStroke` at 1 px against the
  footprint's 2 px so the outline still reads as the object's edge. Hit-testing stays on the
  footprint.
- **Library:** outline only, curved. At 20 px details are noise.

## Presentation

- **Preset dialog:** `src/presentation/designer/presets/AssetPresetForm.vue` under the existing
  `kind: 'form'` (no new dialog kind — `presentation/dialogs/` holds no field knowledge), opened
  by a "Start from preset" button beside "Set dimensions" in the designer inspector. A preset picker
  grouped with `<optgroup>`, one number input per field, a live SVG preview of what `build` answers.
  Apply is disabled while `build` refuses, with the mapped refusal shown. On an asset that already
  has a shape the dialog says the design will be replaced and that undo restores it; there is no
  second confirmation.
- **Inspector for the selection:**
  - detail — name, solid/dashed, x/y (centre), w/d, rotation, bring forward / send backward,
    duplicate, delete;
  - footprint — w/d, "Fit to details";
  - clearance — delete;
  - anchor and facing — coordinates and angle.
  No control is offered for a part the asset does not have (PBI extension 2a).

## Scope

### In

Decisions 1–11, the rendering and presentation above, `en` and `de` strings for every new label.

### Out, each with its trigger

- **Presets in the library's `New asset` form** — when create-then-open-designer proves one step
  too many.
- **A larger symbol preview in the library inspector** — when someone asks to see the symbol there.
- **Multi-selection** — when a user needs to move two details together.
- **A clearance derived as an offset of the footprint** (`offsetOutline` exists) — when preset
  default clearances are not enough.
- **Mirroring** (it flips bulge signs) — when a left-handed variant of an asset is needed.
- **Doors, windows, stairs** — their own designer items under the epic.
- **Open (unclosed) linework** such as a door swing — when the first symbol needs a stroke that is
  not a closed outline.
- **SVG import** — Decision 1's rejection names its shape.

## Testing

- **Domain:** a v1 fixture reads unchanged; detail validation (unique ids, bulge count and range,
  encloses area); calibration converts exactly the pending details; `backDepth` on a circular
  footprint; one table-driven test over every preset at default, min and max — `build` succeeds,
  `validateAssetShape` accepts, `dimensionsOf` equals the typed size, every detail's flattened
  outline lies inside the footprint; every `shapeEdits` function with its degenerate refusal;
  non-uniform resize keeps bulges; hit order as a table.
- **Store:** v1 read upgrades in memory, v2 round-trips, a v1-only schema refuses a v2 file.
- **Rendering as data:** `assetShapeConfig` and `detailsLayer` configs — order, fill, dash.
- **Tools:** `select`, the three draw tools and the three modes against the existing designer-tool
  fakes; the toolbar's exact-list test updated deliberately.
- **Dialogs and inspector:** jsdom (preview updates, Apply disabled on refusal, one dispatch), plus
  an axe scan in the `accessibility*.test.ts` family.
- **Captures:** `harness-shot` of each preset group in the designer (a `?preset=` knob on the
  designer harness), and each selection mode. A placed symbol on a plan is NOT captured — the
  plan-editor harness has no asset-shape source — so it is held by `assetShapeConfig`'s data tests
  and a manual step instead.
- **Manual:** `docs/tests/cases/Design an Asset.md` gains a case — a toilet from a preset, adjusted
  by selection — run in a vault before the increment is called done.

## Sequencing

| Step | Content | Ships as |
| --- | --- | --- |
| 1 | Decisions 1–6, rendering (nothing visible yet — nothing authors details) | PR 1, with step 2 |
| 2 | Decisions 7–8, preset dialog | PR 1 |
| 3a | Decisions 9–10 without Edit points / Bend edges: select, transform, inspector, delete / duplicate / order, keyboard | PR 2 |
| 3b | Edit points, Bend edges, Decision 11's draw tools, fit to details, `scaleDesign` in "Set dimensions" | PR 3 |

Steps 1 and 2 ship together because step 1 alone gives a user nothing.

## Amendments

### Amendment 1 — 2026-09-13, while planning PR 2 (steps 3a and 3b)

**Sequencing.** Steps 3a and 3b ship as ONE pull request, "PR 2 of 2", after PR 1 (#197, merged
2026-09-13). The table
above still describes the content of each step; only its last column changed. The plan is
[`../plans/2026-09-13-asset-designer-symbols-pr2.md`](../plans/2026-09-13-asset-designer-symbols-pr2.md).

**Plan items carry no curves, measured rather than assumed.** A later request asked that "Add to
asset library" (the item modes spec, §B) keep an item's curved edges. Planning looked for them and
found none on this branch or on `origin/main` at `a93eebe5`:

- `SpatialElement` (`src/domain/spatial/SpatialElement.ts`) has no `bulges` field, and no commit on
  any branch ever gave it one (`git log --all -S bulges -- src/domain/spatial/SpatialElement.ts`
  prints nothing);
- the plan sidecar's `bulges` (`SpatialObjectShapeV7` in `planGeometry.ts`,
  `SpatialObjectGeometry.bulges`) belong to ZONE geometry, and walls carry their own `bulge`;
- `CurveTool`'s task (`curveTask.ts`) resolves a target only for a Room zone or a wall.

So promotion loses nothing today: an item outline IS its points, and `centredFootprint` →
`SetAssetFootprint({ measured: true })` stores it exactly. **No code is written for it in PR 2.**

**The door, decided now so the day items gain curves is not a fresh argument.** Tracing keeps
Decision 7's rule — `SetAssetFootprint` clears the footprint's own bulges on a re-trace, because a
re-traced outline has new edges. Promotion must NOT use that door for a curved item. When
`SpatialElement` gains `bulges`, promotion writes through `SetAssetShape` with the translated
outline and its bulges unchanged (a translation leaves a bulge unchanged, and promotion neither
rotates nor mirrors: the placement is anchored at the centre facing +x, `placementPoints(centre, 0)`).
The trigger is the commit that adds `bulges` to `SpatialElement`; its test is the one the request
named — a promoted item with a bulged edge stores the same bulges, and its flattened outline in
world space equals the item's.

**Part edits, as built.** Decision 9's list gains five functions the Presentation section already
needed and never named: `updateDetail` (name and line), `removeClearance`, `moveAnchor`,
`setFacing` and `nextDetailId`. Every one answers a validated shape, so the anchor, the facing and a
detail's name travel the same `SetAssetShape` door as everything else. That is what makes Decision
10's "every gesture is one `SetAssetShape` dispatch" literally true — the narrow `SetAssetAnchor`
and `SetAssetFacing` stay for their tools, as Decision 7 says.

**Refusals added to `validateAssetShape`'s:** `asset.part-not-found` (an edit names a clearance the
shape has not got, or an unknown detail id), `asset.vertex-out-of-range` (a vertex or edge index
outside the outline), `asset.invalid-scale` (a scale factor that is not a finite positive number — a
negative one would mirror, and mirroring is out of scope), `asset.detail-at-limit` (bring forward on
the topmost detail, send backward on the bottom one), `asset.no-details` and
`asset.details-await-scale` (fit to details with none, or with any still in background pixels —
a typed footprint around pixel coordinates would launder them into millimetres).

**A gesture is conditional on the design it was made against.** Every selection gesture passes
`expected: design.geometryVersion` — the version the leaf's store read — so a peer write since the
read refuses the gesture rather than being overwritten by a shape computed from the older design
(PBI extension 4b). `ReversibleAssetEdit.runForward` already honours a caller's `expected` on the
first execute.

**Where the capture rule lives.** A detail drawn over an uncalibrated background is pending "by
the rule tracing already follows" (Decision 11). That rule was a private function inside
`updateAssetShape.ts`; a draw tool builds its shape in presentation before any command runs, so the
rule moves to `src/domain/asset/captureAwaitsScale.ts` and both callers ask it.

**Selection details decided while planning.**

- Choosing a DIFFERENT part resets the mode to Transform; re-clicking the selected part keeps it.
- Transform's box handles are the part's curve-aware bounding box; a side handle scales one axis, a
  corner both, Shift keeps proportions; the rotate handle rotates about the box centre, Shift snaps
  to the snap service's step. The anchor and the facing have no mode handles — selecting one and
  dragging it moves it (the facing takes the pointer's bearing from the anchor).
- Duplicate inserts the copy directly above the original, offset 100 mm along +x and +y, and
  selects it. A drawn detail is selected once written, and every trace or draw returns to Select.
- The inspector's detail rotation is a "rotate by" field that applies and resets to 0: a detail
  stores no rotation to show.
- "Set dimensions" uses `scaleDesign` when the shape has details or any curved footprint or
  clearance edge, and its footprint is already in millimetres (not pending); otherwise it keeps
  today's replace-with-rectangle.

### Amendment 2 — 2026-09-14, the selection follow-ups and polish

The plan is [`../plans/2026-09-14-asset-designer-selection-polish.md`](../plans/2026-09-14-asset-designer-selection-polish.md).
It is stacked on PR #205 and changes five behaviours this spec had left unsaid or stated wrongly.

**A part that awaits a scale offers no millimetre fields.** The inspector already withheld a pending
footprint's width and depth. The same rule now covers every part kind. A pending detail shows no
centre, width or depth, and a pending anchor shows no position. One line in the section says why.
Rotate by, the facing angle, the name, the line style, ordering, Duplicate and Delete stay, because
none of them reads or writes a length. A field shown beside a warning was rejected: it still invites
the user to type millimetres that calibration would later multiply.

**Select has its own Shift hint.** The designer's status hint is chosen in the designer. It is never
chosen by adding `select` to the shared `CONSTRAINING_TOOLS`, because both surfaces use the id
`select` and the plan editor's Select must not advertise a constrained angle. The hint under Select
depends on what is selected:

- Transform, with an outline selected: what Shift does there, which is keeping proportions and
  snapping rotation.
- A selected facing: the existing constrained-angle hint.
- Edit points and Bend edges: no status hint. Neither mode reads a modifier, and every status hint on both surfaces names a modifier or a standing state rather than a gesture. The gesture each mode takes is named in its mode button's tooltip instead.

Every hint is en and de.

**Focus survives an inspector write that removes its control.** Delete removes the selection's
section and Duplicate re-keys it. In both cases the section hands focus to the inspector itself
before it unmounts. The inspector is a focus target (`tabindex="-1"`), not a new Tab stop. This is
the plan editor's inspector rule.

**A queued key on a part that no longer exists does nothing.** A nudge or a Delete is captured at
the key press and runs after earlier writes. If its part has gone by then (a Delete before it, or a
peer's delete), it skips silently, as the plan editor's nudge does. The inspector keeps its refusal
alert, because its control sits beside a part that is still drawn.

**One write chain per leaf, and a press waits for it.** Decision 10's "every gesture is one
`SetAssetShape` dispatch" held, but only for a gesture made against a design that had finished
refreshing. The first bullet refines Amendment 1's condition:

- Every write a designer leaf makes runs on one serialised chain, each step reading the design when
  it runs. That covers the select tool's release, every draw and trace tool, the anchor, facing,
  calibration and height writes, the arrow keys and the inspector.
- A press that arrives while that chain is busy is held and replayed once it drains. A drag
  therefore still reads, and is conditional on, the design the user pressed on.
- A peer write during the hold still refuses the drag.
- Escape abandons a held press.

## Docs this changes

- `docs/requirements/Select part of an object's shape.md` — Done at 3b; its open question is
  answered "both".
- `docs/issues/The designer offers no selection, because nothing there was selectable.md` — an
  outcome pointing here.
- The asset designer epic gains this work as child items when the plan is written.
