# Asset designer: snapping, alignment guides and a zoom-following grid

**Date:** 2026-09-15
**Baseline:** `main` at `9ef60703`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-15. No
implementation plan yet.
Where this document and the SDD disagree, the SDD is the authority (§19 interaction layer, §21
snapping architecture). ADR-0015 (the designer is its own view) is unchanged by it.

## 0. Where this sits

The next asset-designer iteration is built around **precision and measuring**, chosen over editing
fluency, shell polish and modeling power. Brainstorming split it into three increments, each with
its own spec, plan and pull request, in this order:

1. **Snapping and guides** — this document.
2. **Dimensions on canvas** — overall width × depth along the footprint, the selected part's size
   and its offsets to the footprint edges, each value a button opening an inline field, updated
   live from the drag preview, an "All dimensions" view toggle, and no numbers on an unscaled part.
3. **Rulers** — top and left millimetre rulers following the camera, with the selection's extent
   marked, on this document's step function.

Decisions already taken for the whole iteration, so increments 2 and 3 do not reopen them:

| Question | Decision |
| --- | --- |
| How real dimensions arrive | Both typed from a datasheet and traced from a drawing; every aid must serve both. |
| Which measurements | Overall size, part size, offsets from edges. **Not** per-edge lengths. |
| When dimensions are drawn | Selection-driven, with a view toggle to show all. |
| Drag aids | Alignment guides, grid with step snap, rulers, live readout. |
| Grid step | Follows zoom; no step setting. |
| Canvas annotations (dimensions, rulers) | **DOM overlay** in `EditorSurface`'s overlay slot, positioned by `worldToScreen` — the plan editor's `RoomDimensionLabels` pattern. Konva labels were refused: a clickable Konva node fights the designer's hit test, where every layer is `listening: false` and tools hit-test world points, and would still need a DOM mirror for accessibility. A hybrid (lines in Konva, labels in DOM) was refused for two render cadences that visibly lag each other during a drag. |

Out of this iteration: per-edge lengths, a minimap, a context menu, multi-select, Ctrl+Z (a
separate small PR if wanted — `editorHistoryShortcut` is wired only in `PlanEditorRoot.vue`).

## 1. What this increment delivers

While a renovator moves, resizes or draws a part of an asset, the designer snaps it to the other
parts and to a visible grid, and draws a dashed guide saying why. The guides exist only while a
gesture is live and the commit honours exactly what the preview showed.

What exists today:

| Fact | Where |
| --- | --- |
| A vertex drag and an anchor drag snap to vertices only | `designer/tools/designer-select-tool.ts` `dragTarget` |
| A body move and a box-handle resize take the raw pointer | same, `return raw` |
| Candidates are vertices of the footprint, details and the anchor; no edges, no alignments | `designer/selection/snapCandidates.ts` |
| Draw rect/circle snap through `snapPoint`, which writes no guides | `designer/tools/draw-detail-tool.ts` `snapped` |
| No guides are drawn anywhere in the designer | `designer/layers/DesignerGestureLayer.vue` |
| The designer composes the config-only `EDITOR_SNAP_SERVICE`, always enabled | `designer/runtime.ts` |
| No grid, no View menu, no grid readout | `DesignerCanvas.vue`, `DesignerToolbar.vue`, `AssetDesignerRoot.vue` |

## 2. Behaviour

### 2.1 Gestures that snap

| Gesture | Snaps | Today |
| --- | --- | --- |
| Body move of an outline | rigidly, through `snapTranslation` | raw |
| Box-handle resize | the moved handle, through `snapPointWithGuides` | raw |
| Vertex drag, anchor drag | as today, now with edges, alignments and grid | vertices only |
| Draw rectangle / circle | press and release | vertices, no guides |
| Trace footprint / clearance / detail | as today through `DrawPolygonTool.landingPoint`, which gains the new candidates for free | vertices |
| Rotate, facing, bend | unchanged — an angle, not a position | — |

The "moved feature, not the pointer" rule in `dragTarget`'s docblock holds for every row: what
snaps is where the pointer's travel since the press has carried the feature.

### 2.2 Targets

Excluding the dragged part (`partKey`), as today:

- **vertices** — footprint, every other detail, the anchor (existing);
- **edges** — the footprint's and every other detail's segments, with their bulges (new);
- **alignments** — the vertices and box centres of the footprint and every other detail, plus the
  anchor (new).

The clearance is still no target.

### 2.3 Precedence and tolerance

vertex > edge > axis alignment > grid step > raw. Tolerance is `SNAP_TOLERANCE_PX` (8) screen
pixels at any zoom, as the draw tools already use.

### 2.4 Grid

- **Step** follows zoom over 1 / 5 / 10 / 50 / 100 / 500 … mm: the smallest step whose screen size
  is at least 12 px.
- **Origin** is the footprint's bounding-box minimum corner, read from the committed design
  (`store.design`, not the preview) — so it is the design as it stood when the gesture began, and
  dragging the footprint itself does not move the grid under the drag. With no footprint, `{0, 0}`.
  The asset's world origin is its middle (`AssetShape`'s default anchor), so a grid counted from
  there would put an offset from an edge on odd numbers.
- A **body move** puts the moving set's minimum corner on the grid; a **resize** puts the moved
  handle on it; a **draw** puts the pointer on it.
- **Step snapping only while the grid is visible.** What you see is what you snap to.

### 2.5 Shift

- Proportional resize (Shift on a box handle) takes the raw point: no snap, no guides. Proportion
  wins, since a snapped handle projected back onto the aspect ratio would no longer be aligned.
- The trace tools keep "constrain, then snap".

### 2.6 Controls and readout

- A **View** menu at the end of the designer toolbar with **Grid** and **Snap**.
- Both remembered **per device** in their own slot, separate from the plan editor's: an asset is
  worked at a different scale. Defaults as the plan editor's: Grid off, Snap on.
- **Snap** gates vertex, edge and alignment snapping. **Grid** gates the grid's visibility and step
  snapping. Snap off with Grid on still snaps to the grid.
- The status row reads `Grid 10 mm` while the grid is visible, and nothing while the design is
  unscaled — a number that is not a measurement is not given a unit ("Read and correct an
  object's dimensions", acceptance criterion 6).

## 3. Snap service

`editor/snapping/snap-service.ts`, extended in place. Still no store, repository or Konva node.

### 3.1 Candidates

```ts
readonly grid?: { readonly step: number; readonly origin: Point };
```

Supplied by the caller like every other candidate. The plan editor never supplies it.

### 3.2 `snapPointWithGuides`

After the axis stage, each axis the alignment stage did not decide rounds to
`origin + round((value − origin) / step) · step`. The grid stage adds no guide.

### 3.3 `snapTranslation`

After the axis stage, each axis not decided by an alignment takes the correction that lands the
moving set's minimum (`extentOf(moving)`) on the grid. One correction vector for every point, so
the move stays rigid.

### 3.4 `enabled`

`enabled` gates the vertex, edge and axis stages only; the grid stage runs whenever
`candidates.grid` is present. The no-snap answer stays the input object itself — callers pin it
with `toBe`. With no `grid`, both methods behave exactly as today, which is what keeps the plan
editor unchanged; its existing tests are the check.

## 4. Designer wiring

### 4.1 `designer/selection/snapCandidates.ts`

`designerSnapCandidates(shape, exclude)` adds `edges` and `alignments` per §2.2.

### 4.2 `designer/grid/designerGrid.ts` (new)

- `gridStepMm(worldPerPixel: number): number`
- `gridOrigin(shape: AssetShape | null): Point`

Pure; used by the runtime's candidate supply and by the canvas's grid.

### 4.3 `designer/runtime.ts`

- `snapCandidates` adds `grid: { step: gridStepMm(worldPerPixel), origin: gridOrigin(store.design?.shape ?? null) }`
  only while `WorkspaceStore.gridVisible`.
- `EDITOR_SNAP_SERVICE` becomes `createEditorSnapService(() => editor.snappingEnabled)`.

`runtime.ts` is near its 400-line budget; if the closure pushes it over, the candidate supply moves
into `designer/grid/` beside the step function rather than the budget moving.

### 4.4 `designer/tools/designer-select-tool.ts`

`dragTarget`:

- **body** — translate the start outline by `raw − from`, `snapTranslation(translated,
  candidates, tolerance)`, answer `raw + correction`.
- **box handle** — `snapPointWithGuides(handle + (raw − from), …)`. A side handle keeps only the
  snapped coordinate and the guide on the axis it moves. With Shift, answer the raw point and no
  guides. Side effect: the handle no longer jumps by the press offset between the pointer and the
  handle's centre.
- **vertex, anchor** — `snapPointWithGuides` in place of `snapPoint`.

Every path writes `renderState.snapGuides`; release, cancel, `abandonGesture` and deactivate clear
them, as the plan editor's `select-tool.ts` does.

### 4.5 `designer/tools/draw-detail-tool.ts`

`snapped` uses `snapPointWithGuides` and writes the guides; `drop` clears them.

### 4.6 Known ceiling

A body move's grid corner comes from the outline's vertices, so a bulged edge can reach past it.
`selection/partExtent.ts` (curve-aware) is the upgrade if a capture or a user shows it.

## 5. Rendering, controls, persistence

- **Guides.** `DesignerGestureLayer.vue` mounts `editor/layers/SnapGuides.vue` with
  `renderState.snapGuides`, its own `toScreen` and `tokens`. Still screen space, still last.
- **Grid.** `editor/layers/CanvasGrid.vue` gains optional `stepMm` and `origin` props; absent, it
  keeps today's 100 mm decimation from the world origin, so `PlanCanvas.vue` is untouched.
  `DesignerCanvas.vue` mounts it with `gridStepMm(worldPerPixel)` and `gridOrigin(shape)`, **after**
  the `VStage` — above it, where the plan editor mounts it below. A designer is usually traced over
  an opaque spec sheet, and a grid under it would snap to lines nobody can see.
  `pointer-events: none` and the existing 0.5 opacity stay.
- **State.** `WorkspaceStore.gridVisible` and `EditorStore.snappingEnabled`, the plan editor's own
  fields. Each leaf has its own Pinia, and `CanvasGrid` already reads `gridVisible`.
  (`DesignerCanvas`'s comment calling `WorkspaceStore` a plan-editor concern is about layer
  visibility and is narrowed to say so.)
- **Persistence.** `AssetDesignerDeps` gains `viewPreferences?: EditorViewPreferences`, built in the
  plugin by `editorViewPreferencesStore(adapter, `${pluginId}:designer-view`, logger)`. The seed
  and write-back in `PlanEditorRoot.vue` moves to a composable, `useViewPreferences(prefs)`, which
  both roots call — a copy would be a fallow clone.
- **View menu.** New `designer/DesignerViewMenu.vue`, a `<details>` with Grid and Snap checkboxes,
  at the end of `DesignerToolbar`. The Snap toggle is refused while
  `toolManager.gestureInFlight`, as `EditorViewMenu` refuses it. The outside-press and Escape
  dismissal lifts from `EditorViewMenu.vue` into a composable both menus use. `AddMenu` and
  `PropertyTreeMenu` carry their own copies and are out of scope. No zoom or fit buttons.
- **Readout.** `AssetDesignerRoot`'s `rp-designer-status` gains the step while `gridVisible &&
  !design.dimensionsUnscaled`, with no `role`, for the reason that region's comment already gives.
- **Strings.** Reuse `editor.view`, `editor.view.grid`, `editor.view.snap`. One new key,
  `designer.status.grid` (`Grid {step} mm`), in `locales/en/assetSymbols.ts` and
  `locales/de/assetSymbols.ts`, because `en.ts` and `de.ts` are at their line budget.

## 6. Testing

Every case is watched red before the change that turns it green.

**Pure (node)**

- `tests/presentation/editor/snapping/snapServiceGuides.test.ts` — the grid rounds only the axes
  alignment left undecided; a vertex and an alignment each beat a nearer grid line; the grid
  stage runs with `enabled === false` and the others do not; no `grid` answers the input by
  identity; `snapTranslation` lands the minimum on the grid with one correction for all points.
- `tests/presentation/designer/selection/snapCandidates.test.ts` — `edges` and `alignments`, box
  centres, bulges, exclusion.
- `tests/presentation/designer/grid/designerGrid.test.ts` (new) — `gridStepMm` across the series
  at chosen `worldPerPixel` values; `gridOrigin` with and without a shape.

**Tools**

- `tests/presentation/designer/tools/designerSelectTool.test.ts` — a body drag near a neighbour's
  centre snaps and the preview equals the committed shape; a box handle snaps on its own axis only;
  Shift gives no snap and no guides; guides present mid-drag and empty after release, cancel and a
  tool switch; with the grid visible a drag lands on the grid counted from the footprint corner.
- `tests/presentation/designer/tools/drawDetailTool.test.ts` — press and release snap and write
  guides.
- `tests/presentation/editor/snapping/editorSnapPreference.test.ts` — the designer's service follows
  `editor.snappingEnabled`.

**Components (jsdom)**

- `tests/presentation/designer/layers.test.ts` — the gesture layer draws `snap-guides`; the layer
  order holds.
- `tests/presentation/designer/designerToolbar.test.ts` — the View menu drives `gridVisible` and
  `snappingEnabled`; Snap refused mid-gesture; Escape and an outside press close it.
- `tests/presentation/designer/assetDesignerRoot.test.ts` — the readout shows with the grid and
  hides while unscaled; preferences seed on mount and write back under the designer's key.
- The two extracted composables: existing `EditorViewMenu` dismissal and `PlanEditorRoot`
  seed/write-back behaviour is asserted before the move and still green after it.
- An axe case with the View menu open, in `tests/harness/accessibilityDesignerSelection.test.ts` or
  a sibling if that file is at its cap.

**Captures.** `npm run harness-shot` gains a `?grid` knob and two fixed shots over the toilet
preset, `asset-designer-grid` (dark) and `asset-designer-grid-light`, checking the grid reads
above a spec sheet and the readout fits at 460 px. A guide needs a live pointer and is not
capturable.

**Manual.** `docs/tests/cases/Design an Asset.md` gains rows for a guide while dragging, a grid
landing, Snap off with the grid on, and a Shift proportional resize not snapping. Its Runs table
stays "Not yet run".

**Coverage.** The grid stage adds branches in a tight metric: read `coverage-final.json` for
`snap-service.ts`, `designer-select-tool.ts` and `snapCandidates.ts` after the run, not the
summary line.

## 7. Deferred

- A modifier to suppress snapping for one gesture.
- Equal-spacing guides between three or more parts; full-extent (Figma-style) guide lines.
- The clearance as a snap target.
- The curve-aware grid corner (§4.6).
- `AddMenu` and `PropertyTreeMenu` onto the shared dismissal composable.

## Amendments (implementation plan, 2026-09-15)

1. `gridStepMm` and `gridOrigin` are one function, `designer/grid/designerGrid.ts`'s
   `designerGrid(shape, worldPerPixel): SnapGrid`, so the drawn grid, the snapped grid and the
   readout cannot disagree; its series ends at 5000 mm, which `MIN_ZOOM` still reaches.
2. §4.4's side handle snaps its moving coordinate to **alignments and the grid only** — a side
   handle is an edge's midpoint, not a feature a vertex or an edge could land on — and keeps only
   that axis's guide (vertical for x, horizontal for y).
3. Drag snapping lives in `designer/selection/dragSnap.ts` (`dragTarget`), not inside
   `designer-select-tool.ts`, which keeps the tool under its budget and the arithmetic testable
   beside it.
4. `EDITOR_SNAP_SERVICE` is deleted: with the designer on `createEditorSnapService`, nothing in
   `src/` used it.
5. §6's tests landed in new files beside the named ones, which are at or near their line caps:
   `designerSelectSnapping.test.ts`, `designerSnapGrid.test.ts`, `designerViewMenu.test.ts`, and
   `tests/presentation/designer/grid/designerGrid.test.ts`.
6. The grid capture cannot show a spec sheet under the grid (the harness refuses a background
   document); `Design an Asset` step 51 carries that check, and the light grid shot is taken at
   460 px for the readout.
7. §4.3's fallback was taken: the candidate supply lives in `designer/grid/designerGrid.ts` as
   `designerCandidateSupply`, because the closure pushed `runtime.ts`'s `buildRuntime` over its
   100-line function budget (not the file's 400-line budget).
