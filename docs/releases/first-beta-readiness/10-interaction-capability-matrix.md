# First beta — BP-05 interaction capability matrix

Assembled 2026-09-23 at revision `71d5bca43`, read-only, from `src/` and `tests/` at that revision.
This is BP-05 Action 1's deliverable (`01-improvement-plan.md` §BP-05). It records which tests
exist at that revision. **It runs nothing.** A Tested cell says a test exists and what it asserts.
It does not say the test passed on any candidate.

**Amended 2026-09-24 (session 20), from tests added at `54f85d2a1`:** §3's and §4.9's Undo/redo cells for Asset placement, Stair, Arrow, Post, Beam, Dimension and Section, §5's "Modifier change mid-gesture" row and §6's gaps list. Then, from tests added at `215992fe7`, the Undo/redo cells in §3, §4.9 and §6 for View, Hatch, Text, Boundary and Grid. Then, from the review round's m2 finding, seven cells narrowed to name structure.elements (BP05B fix m2): Asset placement, Post, View, Hatch, Text, Boundary and Grid. Then, from tests added at `b09aa7a85`, the Delete cells in §3, §4.7 and §6 for View, Hatch, Text, Boundary and Grid. Then, from tests added at `6ded211d3`, the Cancel cells in §3, §4.8 and §6 for View, Hatch, Text, Boundary and Grid. Every other cell is still as assembled at `71d5bca43`.

## 1. Method

| Instrument | What it gave | What it cannot see |
|---|---|---|
| `CREATION_CATALOGUE` in `src/presentation/editor/add/creationCatalogue.ts` (the Add menu), with `tests/presentation/editor/add/creationCatalogue.test.ts` › "offers Room and Area, each activating its own geometry path", which pins its 16 ids | Row census, first instrument | Any door outside `CREATION_CATALOGUE` |
| `canvasCandidates` / `structureCandidates` in `src/presentation/editor/selection/` and the `SpatialElementKind` union in `src/domain/spatial/SpatialElement.ts` | Row census, second instrument: every kind the canvas can hit | Whether a user can create that kind. Groups, which are not candidates |
| `useCanvasMenuActions.ts`, `draftingMenuActions.ts`, `canvasGroupActions.ts` | Creation doors outside the catalogue; the per-kind menu actions | Keyboard shortcuts, Inspector-only controls |
| `git grep` over `tests/` at HEAD, then reading each cited test body | Every cell | Behaviour no test drives. A title search is not a census, so an **I** cell means "no test found by that search", not "no test exists" |
| `D:/tmp-rp/s18-bp05/check-titles.mjs` (outside the repository) | Confirms every cited file-and-title pair appears literally in that file at HEAD | **Whether a test asserts what its cell says.** Only reading the test can check that |

**Columns** are the plan's ten actions, with these meanings:

| Column | A cell is Tested when a test asserts, for this kind… |
|---|---|
| Create | that its creation route saves an object of this kind |
| Select | that a canvas click, hit test or marquee selects or resolves this kind |
| Move | that a pointer drag of the body saves translated geometry |
| Precise edit | that a typed field edit of its geometry is saved |
| Rotate | that a rotation of this kind is saved |
| Duplicate/copy | that Copy then Paste places a copy of this kind |
| Delete | that a removal removes this kind |
| Cancel | that Cancel or Escape while creating **or editing** this kind writes nothing. Each Tested cell says which |
| Undo/redo | that Undo restores and Redo reapplies an operation on this kind. A cell whose test asserts Undo only is Implemented, untested, and says "Undo asserted; missing: Redo" |
| Non-drag route | that it can be moved without a drag: arrow-key nudge, a typed position, or a click-to-place move. The typed outline form (Precise edit) is not counted a second time here |

**Cell states** follow the brief: Tested (file, exact title, and what it asserts for this kind),
Implemented, untested (the `src/` symbol and the missing test), Unsupported (the product's own
explanation, or "no explanation shown"), Unknown. A test that asserts only at a spy, only for
another kind, or only that nothing was drafted is not Tested. Drafting kinds other than Grid are
created in their tests through `setTool`/`startAt`, the tool the Drafting menu starts, not by
clicking the menu itself.

## 2. Rows: the geometry types the Plan Editor exposes

**21 rows.** Every difference between the two row instruments was settled at source:

| Difference | Settled by |
|---|---|
| Catalogue lacks dimension, section, view, hatch, text, boundary, grid | `draftingMenuActions.ts` `DRAFTING_TOOLS`: context menu › Drafting starts each tool; all seven are `SpatialElementKind`s and canvas candidates |
| Catalogue has door, window and opening; candidates have one `opening` kind | `Opening.kind` in `src/domain/spatial/Structure.ts` is the sub-kind: **one row** |
| Candidates have one zone class; catalogue has Room and Area | `zoneType` 'Room' or not. **Two rows**, because behaviour differs: `curveTask.ts` curves a Room only, and `zoneEditActions` offers different forms |
| Catalogue has Note; no candidate kind matches | `noteCreation.ts` opens a Markdown evidence form. **Not a geometry type** |
| Neither lists groups | `canvasGroupActions.ts` (`group`, `ungroup`, `enclose`, `select-group`) and saved groups: **one row** |
| Straight and curved walls and rooms | A curve is a `bulge` on the same Wall or Zone, not a kind. No separate row |

**Not exposed as rows**, with the evidence:

| Candidate | Why it is not a row |
|---|---|
| `ToolId` `'annotation'` (`tools/editor-tool.ts`) | No tool registers that id. It names a Konva layer only (`scene/KonvaLayers.ts`) |
| `trace-footprint`, `trace-clearance`, `draw-rect`, `draw-circle`, `trace-detail`, `set-anchor`, `set-facing` | Registered only in `src/presentation/designer/tools/registerDesignerTools.ts`: the Asset designer, not the Plan Editor |
| `calibrate`, reference image and PDF | The reference, not plan geometry: BP-06 |
| `edit-curves`, `edit-room-dimension`, `move-opening` | Tools acting on an existing Room, Wall or Opening, not types |
| Captions, vertices, handles, room dimension labels | Parts of a row's object |
| Add › Note, evidence pins, records, detail plans | Renovation records or navigation, not geometry |

## 3. The matrix

State per cell: **T** Tested, **I** Implemented, untested, **U** Unsupported, **?** Unknown. Every cell's evidence is in §4, one table per column.

| Row | Create | Select | Move | Precise edit | Rotate | Duplicate/copy | Delete | Cancel | Undo/redo | Non-drag route |
|---|---|---|---|---|---|---|---|---|---|---|
| Room | T | T | T | T | T | T | T | T | T | T |
| Area | T | T | I | T | T | I | I | T | T | I |
| Wall | T | T | U | T | T | T | T | I | T | U |
| Opening | T | T | I | T | U | T | I | T | T | T |
| Item | T | T | I | T | T | I | T | T | T | I |
| Asset placement | T | T | I | T | T | T | T | I | T | I |
| Path | T | T | T | T | T | I | T | T | T | T |
| Fence | T | I | I | T | T | I | T | I | T | I |
| Measurement | T | T | I | T | T | I | T | I | T | I |
| Stair | T | T | I | T | T | I | T | T | T | I |
| Arrow | T | I | I | T | I | I | T | T | T | I |
| Post | T | T | I | T | I | I | T | I | T | I |
| Beam | T | T | I | T | I | I | T | I | T | I |
| Dimension | T | T | I | T | I | I | I | I | T | I |
| Section | T | T | I | I | I | I | I | I | T | I |
| View | T | T | I | I | I | I | T | T | T | I |
| Hatch | T | T | I | I | I | I | T | T | T | I |
| Text | T | T | I | I | U | I | T | T | T | I |
| Boundary | T | T | I | I | I | I | T | T | T | I |
| Grid | T | T | I | I | U | I | T | T | T | I |
| Group | T | T | T | T | T | T | T | T | T | I |
| **Tested** | 21 | 19 | 3 | 15 | 10 | 5 | 17 | 13 | 21 | 3 |

Totals over 210 cells: **127 Tested, 78 Implemented-untested, 5 Unsupported, 0 Unknown.**

## 4. Evidence, one table per column

### 4.1 Create

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/roomCreation.e2e.test.ts` › "drags a rectangle, names it, and Create writes it, selects it and ends the task" — a new zone with zoneType Room, the typed name and the dragged 4-point geometry, selected |
| Area | Tested | `tests/presentation/editor/areaCreation.e2e.test.ts` › "%s completes one Area, then Undo/Redo preserves its identity and geometry" (param 'Finish' (also 'target', 'Enter')) — the saved zone has zoneType Custom, the default name and the exact outline, selected |
| Wall | Tested | `tests/presentation/editor/structureCanvasRoutes.test.ts` › "uses canvas Backspace and Enter for wall and opening commits through actual repositories" — with `draw-wall`, two clicks and Enter leave one wall in the structure |
| Opening | Tested | `tests/presentation/editor/openingUsability.test.ts` › "places one %s centred at the clicked wall position through the normal history path" (param 'door', 'window', 'opening') — a click with `place-<kind>` saves one opening of that sub-kind on `wall-a` at the clicked offset; one write |
| Item | Tested | `tests/presentation/editor/objectShapeModes.e2e.test.ts` › "starts an item as a rectangle drag and saves the dragged outline" — the saved element matches `{ kind: 'object', points: RECTANGLE }` |
| Asset placement | Tested | `tests/presentation/editor/assetPlacement.e2e.test.ts` › "places repeated copies, snapped to a wall face, each its own undo step, and Escape leaves the tool" — the first placement is `{ kind: 'asset', assetId }` at the snapped points |
| Path | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'path') — the saved element matches `{ kind: 'path', points }`, selected |
| Fence | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'fence') — the saved element matches `{ kind: 'fence', points }`, selected |
| Measurement | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'measurement') — the saved element matches `{ kind: 'measurement', points }`, selected |
| Stair | Tested | `tests/presentation/editor/stairsArrows.test.ts` › "creates, renders, edits and rotates a stair with one geometry/metadata history and a full-width hit target" — Add › Stair then Finish saves `{ kind: 'stair', points, stair: { width, treads, direction } }` |
| Arrow | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'arrow') — the saved element matches `{ kind: 'arrow', points }`, selected |
| Post | Tested | `tests/presentation/editor/structuralCreation.test.ts` › "places one post per click at the typed section, stays on the tool, and undoes each post alone" — a click saves `{ kind: 'post', loadBearing: true, points: postOutline(…) }` |
| Beam | Tested | `tests/presentation/editor/structuralCreation.test.ts` › "saves a beam on its second click with the typed width and draws it as two dashed edges" — two clicks save `{ kind: 'beam', width: 240, loadBearing: true, points }` |
| Dimension | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "ends a dimension chain's points on Finish, steps back on Undo point, and saves it where its line is clicked" — saves `{ kind: 'dimension', offset: -500, points }` (tool started by `setTool`, not the menu) |
| Section | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a stepped section line of every clicked point on Finish as S-01 looking the default way, as schema 12, and names the next one S-02" — saves `{ kind: 'section', flipped: false, points }` named S-01 |
| View | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a view marker on its second point as A-01" — saves `{ kind: 'view', points }` named A-01 |
| Hatch | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a hatched area and a boundary line on Finish, and refuses a hatch outline that crosses itself" — a self-crossing outline saves nothing; the corrected outline saves `{ kind: 'hatch' }` |
| Text | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "places a text point without saving, moves it on a further point, and saves it once it has words" — nothing is saved until the text has words, then `{ kind: 'text', points }` |
| Boundary | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a hatched area and a boundary line on Finish, and refuses a hatch outline that crosses itself" — the second saved element is `{ kind: 'boundary', points }` |
| Grid | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "offers every drafting tool from the empty canvas with a known icon, and starts the chosen one at the menu's point" — context menu › Drafting › Grid persists one `{ kind: 'grid' }` element |
| Group | Tested | `tests/presentation/editor/groupEditing.test.ts` › "ungroups without moving members, then saves an explicit multi-selection as a group again" — the Inspector Group action saves one group; structure unchanged (same action list the context menu spreads) |

### 4.2 Select

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/selection/spatialSelection.test.ts` › "cycles top to bottom, wraps, and starts at the top for an unrelated selection" — a zoneType Room record resolves as the body hit at its interior and corner |
| Area | Tested | `tests/presentation/editor/selection/spatialSelection.test.ts` › "cycles top to bottom, wraps, and starts at the top for an unrelated selection" — a zoneType 'Terrace' record resolves as the body hit |
| Wall | Tested | `tests/presentation/editor/structureSelection.test.ts` › "keeps bodies selectable, previews only a selected wall end, and shares the reviewed edit callback" — a real `SelectTool` click selects `['wall-a']` |
| Opening | Tested | `tests/presentation/editor/structureSelection.test.ts` › "shares Object-first hover and click while Alt, list identity and Shift retain the same selection set" — an Alt-click at the door selects `['opening-a']` |
| Item | Tested | `tests/presentation/editor/structureSelection.test.ts` › "shares Object-first hover and click while Alt, list identity and Shift retain the same selection set" — a plain click selects `['object-a']` ahead of the opening, wall and room; Shift toggles it |
| Asset placement | Tested | `tests/presentation/editor/elements/assetCandidates.test.ts` › "selects a placement over the room it stands in by clicking inside its footprint" — the hit test resolves the placement over its room inside the footprint |
| Path | Tested | `tests/presentation/editor/tools/marqueeSelection.test.ts` › "marquees past a record with no drawable points and over an edge that only crosses the box" — a `SelectTool` marquee selects `['path']` by edge crossing |
| Fence | Implemented, untested | `structureCandidates` → `resolveSelectionTarget` line hit, shared with Path. Missing: a click or marquee that selects an unselected fence. |
| Measurement | Tested | `tests/presentation/editor/structureSelection.test.ts` › "ranks a generic element below opening and wall and above the room, and cycles all four" — a measurement `element-a` is resolved as a body hit in the overlap cycle |
| Stair | Tested | `tests/presentation/editor/tools/marqueeSelection.test.ts` › "includes a stair footprint when the marquee misses its canonical centreline" — a marquee selects the stair through its footprint |
| Arrow | Implemented, untested | `structureCandidates` → `resolveSelectionTarget`. Missing: a hit test or marquee that selects an arrow. |
| Post | Tested | `tests/presentation/editor/structuralCanvasGeometry.test.ts` › "hits a post standing in a wall before the wall, and a beam across its whole width" — the post is hit ahead of the wall it stands in |
| Beam | Tested | `tests/presentation/editor/structuralCanvasGeometry.test.ts` › "hits a post standing in a wall before the wall, and a beam across its whole width" — the beam is hit across its band width |
| Dimension | Tested | `tests/presentation/editor/draftingHitTesting.test.ts` › "hits a chain between its points and its line, a view marker at its triangle, a section along its line, a boundary and a hatch" — a point between the chain and its line resolves to the dimension; a point outside resolves to nothing |
| Section | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "right-clicks a section line a few pixels off its line and offers its Delete" — a right-click 3 px off the line selects the section |
| View | Tested | `tests/presentation/editor/draftingHitTesting.test.ts` › "hits a chain between its points and its line, a view marker at its triangle, a section along its line, a boundary and a hatch" — a point at the triangle resolves to the view marker |
| Hatch | Tested | `tests/presentation/editor/draftingHitTesting.test.ts` › "hits a chain between its points and its line, a view marker at its triangle, a section along its line, a boundary and a hatch" — a point inside resolves to the hatch |
| Text | Tested | `tests/presentation/editor/draftingHitTesting.test.ts` › "clicks a text mark through the same drafting context the tool uses, not only structureCandidates's own call" — a click inside the drawn words in the mounted editor selects the text |
| Boundary | Tested | `tests/presentation/editor/draftingHitTesting.test.ts` › "hits a chain between its points and its line, a view marker at its triangle, a section along its line, a boundary and a hatch" — a point on the line resolves to the boundary |
| Grid | Tested | `tests/presentation/editor/draftingHitTesting.test.ts` › "hits a text across its drawn words and a grid point across its circle, at the zoom they are drawn at" — a point inside the circle resolves to the grid point, one just outside to nothing |
| Group | Tested | `tests/presentation/editor/tools/marqueeSelection.test.ts` › "expands a saved group and delegates its entire drag without falling back to a member edit" — `tests/presentation/editor/groupNativeActions.test.ts` › "groups only walls with a useful default name, expands saved identity, and supports list toggling without metadata changes" — a click on one member selects every member through the `expandSelection` seam (stubbed in the first test; the real expansion is the second) |

### 4.3 Move

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/zoneEditing.test.ts` › "selects by click, moves by drag with exactly one command, and undo restores the exact points" — a canvas drag of a Room persists translated points; Undo restores them |
| Area | Implemented, untested | `SelectTool` body gesture → `moveGesture` → `ReversibleMoveZoneCommand` (`src/presentation/editor/tools/registerEditorTools.ts`), zoneType-agnostic. Missing: a body drag of a non-Room zone that persists translated points. |
| Wall | Unsupported | `tests/presentation/editor/structureSelection.test.ts` › "keeps bodies selectable, previews only a selected wall end, and shares the reviewed edit callback" — A press on a selected wall body starts no drag; only its end handle drags, and that reshapes the wall through a review form. A wall translates only as a group member. No explanation shown. |
| Opening | Implemented, untested | `OpeningResize` 'move' grip (`src/presentation/editor/structure/OpeningResize.ts`) → `commitOpening`. `tests/presentation/editor/structure/openingResize.test.ts` asserts only the preview for that grip. Missing: a move-grip drag that persists a new offset. |
| Item | Implemented, untested | `ElementMove` body gesture → `elementActions.move`. `tests/presentation/editor/elementMoveAdmission.test.ts` asserts translated points only at a `moveElement` spy. Missing: a body drag of an item in the mounted editor that saves. |
| Asset placement | Implemented, untested | `ElementMove` body gesture. `tests/presentation/editor/tools/selectToolResize.test.ts` asserts only that a `moveElement` spy is called. Missing: a body drag of a placement that saves translated points. |
| Path | Tested | `tests/presentation/editor/elementInteractionGuards.test.ts` › "previews a selected path drag through the real Select tool, clears preview, then saves one translation" — a real drag previews and saves points translated by (400, 200); Undo restores |
| Fence | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a fence in the mounted editor that saves translated points. |
| Measurement | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a measurement in the mounted editor that saves translated points. |
| Stair | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a stair in the mounted editor that saves translated points. `elementMoveAdmission.test.ts` and `stairGestureGuards.test.ts` assert only at a `moveElement` spy. |
| Arrow | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a arrow in the mounted editor that saves translated points. |
| Post | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a post in the mounted editor that saves translated points. `structuralInspector.test.ts` "keeps a dragged post…" compares the saved points with the preview but never with the original, so it passes if the drag moved nothing (this document's unasked check). |
| Beam | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a beam in the mounted editor that saves translated points. |
| Dimension | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a dimension chain in the mounted editor that saves translated points. |
| Section | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a section line in the mounted editor that saves translated points. |
| View | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a view marker in the mounted editor that saves translated points. |
| Hatch | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a hatch in the mounted editor that saves translated points. |
| Text | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a text mark in the mounted editor that saves translated points. |
| Boundary | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a boundary in the mounted editor that saves translated points. |
| Grid | Implemented, untested | `ElementMove` body gesture (`src/presentation/editor/elements/ElementMove.ts`) → `elementActions.move`. Missing: a body drag of a grid point in the mounted editor that saves translated points. |
| Group | Tested | `tests/presentation/editor/groupEditing.test.ts` › "moves a grouped Room, walls and later hosted opening from the immutable pointer baseline with one write" — one drag writes once, moving Room and walls; the hosted opening keeps its offset; Undo/Redo |

### 4.4 Precise edit

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/resize/zoneOutlineReach.e2e.test.ts` › "reaches the outline editor from the Inspector on a Room and writes the typed corner" — a typed corner x is saved to the Room in the repository |
| Area | Tested | `tests/presentation/editor/resize/zoneOutline.e2e.test.ts` › "rounds a retyped coordinate to whole millimetres from comma and from point, and passes an untouched sibling through unrounded" — typed corners of a Garden zone are saved rounded to whole millimetres |
| Wall | Tested | `tests/presentation/editor/structureActions.test.ts` › "previews and applies an exact connected length, refuses containment and numeric errors, and preserves unchanged precision" — typed length 5 saves the wall end at x 5000; the hosted opening offset is kept |
| Opening | Tested | `tests/presentation/editor/structureActions.test.ts` › "keeps another opening unchanged and allows retry after an ordinary persistence refusal" — typed width 1.1 saves 1100 after a refused try; the other opening is unchanged |
| Item | Tested | `tests/presentation/editor/elementLifecycleCompletion.test.ts` › "retains a zero-area Object edit, then saves corrected corners and restores the original through Undo" — a zero-area entry is refused with no dispatch; corrected typed corners are saved; Undo restores |
| Asset placement | Tested | `tests/presentation/editor/assetPlacementInspector.test.ts` › "sizes a placement from the Inspector about its centre and resets it to the library size" — typed width 1.2 m saves size {1200, 600}; invalid text writes nothing; reset clears the size |
| Path | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'path') — an Inspector `outline-points` edit saves the typed x; Undo restores the label |
| Fence | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'fence') — an Inspector `outline-points` edit saves the typed x; Undo restores the label |
| Measurement | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'measurement') — an Inspector `outline-points` edit saves the typed x; Undo restores the label |
| Stair | Tested | `tests/presentation/editor/stairsArrows.test.ts` › "creates, renders, edits and rotates a stair with one geometry/metadata history and a full-width hit target" — the `stair-edit` form saves typed width, treads and direction; Undo restores |
| Arrow | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'arrow') — an Inspector `outline-points` edit saves the typed x; Undo restores the label |
| Post | Tested | `tests/presentation/editor/structuralInspector.test.ts` › "summarises a post and resizes it about its centre from the dimensions form" — typed width and depth save `postOutline(centre, 200, 100)` |
| Beam | Tested | `tests/presentation/editor/structuralInspector.test.ts` › "summarises a beam, switches load-bearing through undoable history, and edits its width" — typed width 0,2 saves width 200 with points unchanged (width is its one typed geometry field) |
| Dimension | Tested | `tests/presentation/editor/draftingInspector.test.ts` › "edits a dimension chain's offset and keeps its points" — typed offset saves -800 with points unchanged |
| Section | Implemented, untested | `elementEditPresentation` falls back to `OutlinePointsForm` (Inspector `edit-element`). Missing: a typed point edit of a section line that asserts the write. |
| View | Implemented, untested | `elementEditPresentation` falls back to `OutlinePointsForm` (Inspector `edit-element`). Missing: a typed point edit of a view marker that asserts the write. |
| Hatch | Implemented, untested | `elementEditPresentation` falls back to `OutlinePointsForm` (Inspector `edit-element`). Missing: a typed point edit of a hatch that asserts the write. |
| Text | Implemented, untested | `elementEditPresentation` falls back to `OutlinePointsForm` (Inspector `edit-element`). Missing: a typed point edit of a text mark that asserts the write. |
| Boundary | Implemented, untested | `elementEditPresentation` falls back to `OutlinePointsForm` (Inspector `edit-element`). Missing: a typed point edit of a boundary that asserts the write. |
| Grid | Implemented, untested | `elementEditPresentation` falls back to `OutlinePointsForm` (Inspector `edit-element`). Missing: a typed point edit of a grid point that asserts the write. |
| Group | Tested | `tests/presentation/editor/groupNativeActions.test.ts` › "moves an assembly from the native numeric fields and uses both quarter-turn buttons with exact history" — typed dx/dy move the member Room corner; empty or invalid input writes nothing; Undo restores |

### 4.5 Rotate

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "rotates %s through the guarded Zone command without changing wall/current/intended associations" (param Room) — rotated points written through the Zone command; structure untouched; Undo/Redo; a fresh read sees them |
| Area | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "rotates %s through the guarded Zone command without changing wall/current/intended associations" (param Custom) — same assertions as Room, target kind 'area' |
| Wall | Tested | `tests/presentation/editor/wallRotationRuntime.test.ts` › "reviews %s host rotation, writes once and restores exact hosted facts and independent Room geometry" (param 'wall-a') — one write equal to `rotateWallStructure(…, 90)`, Room geometry untouched; Undo/Redo exact |
| Opening | Unsupported | `tests/presentation/editor/wallRotationRuntime.test.ts` › "reviews %s host rotation, writes once and restores exact hosted facts and independent Room geometry" — An opening does not rotate on its own: Rotate on an opening rotates its HOST wall, and the product says so (`editor.rotation.host-wall`, `editor.rotation.host-wall-hint` in `ObjectRotationControls.vue`; `editor.rotation.host-title` in `wallRotationActions.ts`). The host route is tested (param `opening-a`). |
| Item | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "commits numeric decimal comma once, matches preview, preserves intended metadata, and restores exact Undo/Redo" — typed '27,25' writes once, points equal `rotationPoints(27.25)`; Undo/Redo exact |
| Asset placement | Tested | `tests/presentation/editor/assetPlacementInspector.test.ts` › "rotates a placement about its anchor and keeps its asset" — rotate 90: the anchor is unchanged, the facing point moves, assetId kept |
| Path | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly" (param 'path') — LIMITED: a rotation after reopening changes the points, and Undo restores the persisted structure; the written points are not compared with the rotated geometry |
| Fence | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly" (param 'fence') — LIMITED: as Path |
| Measurement | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly" (param 'measurement') — LIMITED: as Path, on a 2-point measurement |
| Stair | Tested | `tests/presentation/editor/stairsArrows.test.ts` › "creates, renders, edits and rotates a stair with one geometry/metadata history and a full-width hit target" — rotate 90 saves points equal to `rotationPoints` about the centreline pivot |
| Arrow | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a arrow that asserts the written points and Undo. |
| Post | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a post that asserts the written points and Undo. |
| Beam | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a beam that asserts the written points and Undo. |
| Dimension | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a dimension chain that asserts the written points and Undo. |
| Section | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a section line that asserts the written points and Undo. |
| View | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a view marker that asserts the written points and Undo. |
| Hatch | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a hatch that asserts the written points and Undo. |
| Text | Unsupported | A single point: `linearPivot` returns null, so there is no rotation target and the Rotate controls and menu item are absent. No explanation shown. |
| Boundary | Implemented, untested | `rotationActions.target` → `rotationPivot` (`src/presentation/editor/elements/objectRotation.ts`). Missing: a rotation of a boundary that asserts the written points and Undo. |
| Grid | Unsupported | A single point, as Text. No explanation shown. |
| Group | Tested | `tests/presentation/editor/groupPointerRotation.test.ts` › "releases an edge-arrow group rotation as one reversible command" — an edge-arrow drag writes once with the rotated wall start; Undo/Redo |

### 4.6 Duplicate/copy

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/clipboard.test.ts` › "copies with Ctrl+C and pastes under the pointer with Ctrl+V, as one undo step that selects the result" — Ctrl+C/Ctrl+V pastes one new Room at the pointer, selected; one Undo removes it |
| Area | Implemented, untested | `captureClipboard` / `placedRooms` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`. The domain test `tests/domain/spatial/clipboard.test.ts` places a Garden zone by offset only. Missing: Copy then Paste of an Area through `PasteCommand` or the editor, asserting its zoneType. |
| Wall | Tested | `tests/presentation/editor/clipboard.test.ts` › "copies with Ctrl+C and pastes under the pointer with Ctrl+V, as one undo step that selects the result" — the Room's four walls are selected and copied; after Paste the wall count grows by four and the new walls are selected |
| Opening | Tested | `tests/application/commands/pasteCommand.test.ts` › "writes the rooms, walls, openings, elements, names and groups of a paste as one step under new ids" — the pasted door equals the source door, with a new id and its hostId rewired to the pasted wall. It travelled with its host, not as its own selection |
| Item | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of an item, asserting the pasted kind and points. `tests/presentation/editor/itemColors.test.ts` › "copies and pastes the color as placement content through the editor clipboard and history" asserts only the pasted element's colour and the element count. |
| Asset placement | Tested | `tests/presentation/editor/clipboard.test.ts` › "pastes a copied placement with its asset, its anchor on the paste point" — the pasted element is `{ kind: 'asset', assetId }` anchored at the paste point |
| Path | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a path, asserting the pasted kind and points. |
| Fence | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a fence, asserting the pasted kind and points. |
| Measurement | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a measurement, asserting the pasted kind and points. |
| Stair | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a stair, asserting the pasted kind and points. The domain test `tests/domain/spatial/clipboard.test.ts` keeps stair options under `placedStructure` only. |
| Arrow | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a arrow, asserting the pasted kind and points. |
| Post | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a post, asserting the pasted kind and points. |
| Beam | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a beam, asserting the pasted kind and points. |
| Dimension | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a dimension chain, asserting the pasted kind and points. |
| Section | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a section line, asserting the pasted kind and points. |
| View | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a view marker, asserting the pasted kind and points. |
| Hatch | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a hatch, asserting the pasted kind and points. |
| Text | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a text mark, asserting the pasted kind and points. |
| Boundary | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a boundary, asserting the pasted kind and points. |
| Grid | Implemented, untested | `captureClipboard` / `placedStructure` (`src/domain/spatial/clipboard.ts`) and `PasteCommand`, which filter no element kind. Missing: Copy then Paste of a grid point, asserting the pasted kind and points. |
| Group | Tested | `tests/application/commands/pasteCommand.test.ts` › "writes the rooms, walls, openings, elements, names and groups of a paste as one step under new ids" — the pasted group has a new id, its name and the pasted members as memberIds (application level) |

### 4.7 Delete

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/contextMenuActions.test.ts` › "deletes an unreferenced Room through history and keeps cancelled Wall changes unapplied" — context-menu Delete removes the Room from store and repository; Undo restores it |
| Area | Implemented, untested | Context menu `delete` → `runtime.deleteZone` (`useCanvasMenuActions.ts` `singleActions`), zoneType-agnostic. Missing: deleting an Area through a menu, key or Inspector control. |
| Wall | Tested | `tests/presentation/editor/spatialNavigationBoundaries.test.ts` › "names both Wall and Opening in native batch deletion, cancels safely and undoes the exact confirmed relationship" — batch Delete of the wall with its opening removes `wall-a`; Cancel writes nothing; Undo restores |
| Opening | Implemented, untested | Context menu `delete` → `structureActions.remove` (`useCanvasMenuActions.ts` `singleActions`). Openings are removed in tests only with or through their host wall. Missing: deleting a lone opening while its host survives. |
| Item | Tested | `tests/presentation/editor/contextMenuActions.test.ts` › "edits and deletes an Object through typed context actions and restores its label and geometry on undo" — context-menu Delete plus confirm empties the elements; Undo restores id, points and name |
| Asset placement | Tested | `tests/presentation/editor/deleteShortcut.test.ts` › "removes a selected placement with %s as one confirmed step that Undo restores" (param 'Delete', 'Backspace') — the key plus confirm empties the elements; Ctrl+Z restores the placement with its assetId |
| Path | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'path') — Inspector Delete plus confirm empties the elements; Undo restores element and name |
| Fence | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'fence') — Inspector Delete plus confirm empties the elements; Undo restores element and name |
| Measurement | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'measurement') — Inspector Delete plus confirm empties the elements; Undo restores element and name |
| Stair | Tested | `tests/presentation/editor/batchTargetKinds.test.ts` › "deletes a selection of stairs and arrows through element removal, not wall removal" — batch Delete plus confirm removes the stair |
| Arrow | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'arrow') — Inspector Delete plus confirm empties the elements; Undo restores element and name |
| Post | Tested | `tests/presentation/editor/structuralDeletion.test.ts` › "names a load-bearing post in its own confirmation, and still deletes it on confirm" — Inspector Delete names the post; confirm removes it; Undo restores |
| Beam | Tested | `tests/presentation/editor/structuralDeletion.test.ts` › "names every load-bearing element in a multi-item confirmation" — confirm empties the elements. Called at `elementActions.removeMany`, the function multi-item Delete reaches through `deleteItems`, not at a control |
| Dimension | Implemented, untested | Context menu `delete` → `elementActions.remove` (`useCanvasMenuActions.ts` `singleActions`); Inspector `delete-element`. Missing: an executed deletion of a dimension chain. |
| Section | Implemented, untested | Context menu `delete` → `elementActions.remove` (`useCanvasMenuActions.ts` `singleActions`); Inspector `delete-element`. Missing: an executed deletion of a section line. |
| View | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "deletes a %s mark from its context menu on confirm, and leaves every other mark and label as it was" (param 'view') — with all seven drafting marks seeded and the view marker selected, context-menu Delete plus confirm removes its id from the store's `structure.elements` and `plan.spatialElements`; every other entry of both is deep-equal to what it was before the delete |
| Hatch | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "deletes a %s mark from its context menu on confirm, and leaves every other mark and label as it was" (param 'hatch') — with all seven drafting marks seeded and the hatch selected, context-menu Delete plus confirm removes its id from the store's `structure.elements` and `plan.spatialElements`; every other entry of both is deep-equal to what it was before the delete |
| Text | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "deletes a %s mark from its context menu on confirm, and leaves every other mark and label as it was" (param 'text') — with all seven drafting marks seeded and the text mark selected, context-menu Delete plus confirm removes its id from the store's `structure.elements` and `plan.spatialElements`; every other entry of both is deep-equal to what it was before the delete |
| Boundary | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "deletes a %s mark from its context menu on confirm, and leaves every other mark and label as it was" (param 'boundary') — with all seven drafting marks seeded and the boundary selected, context-menu Delete plus confirm removes its id from the store's `structure.elements` and `plan.spatialElements`; every other entry of both is deep-equal to what it was before the delete |
| Grid | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "deletes a %s mark from its context menu on confirm, and leaves every other mark and label as it was" (param 'grid') — with all seven drafting marks seeded and the grid point selected, context-menu Delete plus confirm removes its id from the store's `structure.elements` and `plan.spatialElements`; every other entry of both is deep-equal to what it was before the delete |
| Group | Tested | `tests/presentation/editor/deleteShortcut.test.ts` › "deletes a selected group with the Delete key as one confirmed step that one Undo restores" — Delete key plus confirm removes the room, walls and group; Ctrl+Z restores membership |

### 4.8 Cancel

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/roomCreation.e2e.test.ts` › "Cancel leaves the task in one gesture and writes nothing" — creation Cancel after a drag and a typed name leaves the zone count unchanged |
| Area | Tested | `tests/presentation/editor/areaCreation.e2e.test.ts` › "Escape from a banner steps through draft, tool and single list selection; Add closes first" — Escape clears a drafted outline, a second returns to Select; the repository still lists one zone |
| Wall | Implemented, untested | `structureActions.edit` (`src/presentation/editor/structure/structureActions.ts`) opens `StructureEditForm` in a dialog. Missing: a wall edit that is typed and then cancelled, vault bytes unchanged. `tests/presentation/editor/contextMenuActions.test.ts` › "deletes an unreferenced Room through history and keeps cancelled Wall changes unapplied" cancels an edit dialog in which nothing was typed, so it cannot tell cancel from apply, and a cancelled delete review, which is neither creating nor editing. |
| Opening | Tested | `tests/presentation/editor/structureActions.test.ts` › "retains a failed form, suppresses busy native Enter, pauses on conflict, and cancels without a write" — EDIT cancel: the opening form is cancelled after failed submits; width stays 900 |
| Item | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "refuses invalid/no-op input and discards numeric cancellation without a write" — EDIT cancel: the rotation form is cancelled; no geometry write |
| Asset placement | Implemented, untested | `AssetPlacementTool.cancel` (`src/presentation/editor/elements/AssetPlacementTool.ts`). Missing: Escape or the banner's Cancel with the tool armed, asserting the vault unchanged. `tests/presentation/editor/assetPlacement.e2e.test.ts` › "places repeated copies, snapped to a wall face, each its own undo step, and Escape leaves the tool" presses the secondary button, which the tool ignores, then calls `cancelInterruptedGesture`, which is not the Cancel door; its Escape asserts only the active tool and the preview. |
| Path | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "blocks every finish route while numeric text is pending, preserves it through reflow, and cancels without writing" — two points placed, then cancel: vault entries equal the before-snapshot |
| Fence | Implemented, untested | `ElementTool.cancel` (`src/presentation/editor/elements/ElementTool.ts`) and `createCancelActiveTask` (`src/presentation/editor/runtime.ts`), reached from `TemporaryToolBanner.vue`. Missing: start the tool, draft input, Escape or Cancel, vault bytes unchanged. The only fence cancel (`objectCreation.e2e.test.ts`, param fence) cancels with no point drafted, so it cannot see a draft being written. |
| Measurement | Implemented, untested | `ElementTool.cancel` (`src/presentation/editor/elements/ElementTool.ts`) and `createCancelActiveTask` (`src/presentation/editor/runtime.ts`), reached from `TemporaryToolBanner.vue`. Missing: start the tool, draft input, Escape or Cancel, vault bytes unchanged. The only measurement cancel (`objectCreation.e2e.test.ts`, param measurement) cancels with no point drafted. |
| Stair | Tested | `tests/presentation/editor/stairsArrows.test.ts` › "keeps invalid stair dimensions in the draft and cancels without changing the vault" — invalid treads block Finish; cancel leaves vault entries unchanged |
| Arrow | Tested | `tests/presentation/editor/stairsArrows.test.ts` › "draws an independent arrowhead, edits a selected endpoint and restores it through Undo" — EDIT cancel: an endpoint drag then `cancelGesture()` leaves the element equal to the saved one |
| Post | Implemented, untested | `ElementTool.cancel` (`src/presentation/editor/elements/ElementTool.ts`) and `createCancelActiveTask` (`src/presentation/editor/runtime.ts`), reached from `TemporaryToolBanner.vue`. Missing: start the tool, draft input, Escape or Cancel, vault bytes unchanged. |
| Beam | Implemented, untested | `ElementTool.cancel` (`src/presentation/editor/elements/ElementTool.ts`) and `createCancelActiveTask` (`src/presentation/editor/runtime.ts`), reached from `TemporaryToolBanner.vue`. Missing: start the tool, draft input, Escape or Cancel, vault bytes unchanged. |
| Dimension | Implemented, untested | `ElementTool.cancel` (`src/presentation/editor/elements/ElementTool.ts`) and `createCancelActiveTask` (`src/presentation/editor/runtime.ts`), reached from `TemporaryToolBanner.vue`. Missing: start the tool, draft input, Escape or Cancel, vault bytes unchanged. |
| Section | Implemented, untested | `ElementTool.cancel` (`src/presentation/editor/elements/ElementTool.ts`) and `createCancelActiveTask` (`src/presentation/editor/runtime.ts`), reached from `TemporaryToolBanner.vue`. Missing: start the tool, draft input, Escape or Cancel, vault bytes unchanged. |
| View | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "cancels a drafted %s from the task bar without writing, and returns to Select with nothing drafted" (param 'view') — creation cancel: the tool started through `setTool`, one point placed through the tool manager's pointer events and the second point's X and Y typed in the task form but not added, and the tool reporting a draft (`activeToolHasDraft`); the task bar's Cancel (`.rp-task-banner__cancel`) leaves the fake vault's entries (`rig.stack.vault.entries`) equal to a snapshot taken before the tool started and the store's `structure.elements` and `plan.spatialElements` equal to what they were then (both read as empty); the active tool is then Select, and the task's draft holds no points, no typed coordinates and no name |
| Hatch | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "cancels a drafted %s from the task bar without writing, and returns to Select with nothing drafted" (param 'hatch') — creation cancel: the tool started through `setTool`, a rectangle dragged through the tool manager's pointer events and not finished, and the tool reporting a draft (`activeToolHasDraft`); the task bar's Cancel (`.rp-task-banner__cancel`) leaves the fake vault's entries (`rig.stack.vault.entries`) equal to a snapshot taken before the tool started and the store's `structure.elements` and `plan.spatialElements` equal to what they were then (both read as empty); the active tool is then Select, and the task's draft holds no points, no typed coordinates and no name |
| Text | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "cancels a drafted %s from the task bar without writing, and returns to Select with nothing drafted" (param 'text') — creation cancel: the tool started through `setTool`, a point placed through the tool manager's pointer events and its words typed in the task form's name field, not finished, and the tool reporting a draft (`activeToolHasDraft`); the task bar's Cancel (`.rp-task-banner__cancel`) leaves the fake vault's entries (`rig.stack.vault.entries`) equal to a snapshot taken before the tool started and the store's `structure.elements` and `plan.spatialElements` equal to what they were then (both read as empty); the active tool is then Select, and the task's draft holds no points, no typed coordinates and no name |
| Boundary | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "cancels a drafted %s from the task bar without writing, and returns to Select with nothing drafted" (param 'boundary') — creation cancel: the tool started through `setTool`, two points placed through the tool manager's pointer events and not finished, and the tool reporting a draft (`activeToolHasDraft`); the task bar's Cancel (`.rp-task-banner__cancel`) leaves the fake vault's entries (`rig.stack.vault.entries`) equal to a snapshot taken before the tool started and the store's `structure.elements` and `plan.spatialElements` equal to what they were then (both read as empty); the active tool is then Select, and the task's draft holds no points, no typed coordinates and no name |
| Grid | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "cancels a drafted %s from the task bar without writing, and returns to Select with nothing drafted" (param 'grid') — creation cancel: the tool started through `setTool`, a point's X and Y typed in the task form but not added, and the tool reporting a draft (`activeToolHasDraft`); the task bar's Cancel (`.rp-task-banner__cancel`) leaves the fake vault's entries (`rig.stack.vault.entries`) equal to a snapshot taken before the tool started and the store's `structure.elements` and `plan.spatialElements` equal to what they were then (both read as empty); the active tool is then Select, and the task's draft holds no points, no typed coordinates and no name |
| Group | Tested | `tests/presentation/editor/groupEditing.test.ts` › "keeps cancel, click jitter, zero movement and Review free of writes" — EDIT cancel: a cancelled group move writes nothing |

### 4.9 Undo/redo

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/freeShapeRoom.e2e.test.ts` › "creates a nonrectangular Room and restores its identity and outline through Undo/Redo" — Undo removes the created Room; Redo restores an equal entity |
| Area | Tested | `tests/presentation/editor/areaCreation.e2e.test.ts` › "%s completes one Area, then Undo/Redo preserves its identity and geometry" (param 'target', 'Enter', 'Finish') — Undo removes the Area; Redo restores it by the same id, geometry and zoneType Custom |
| Wall | Tested | `tests/presentation/editor/wallThickness.test.ts` › "previews direct millimetre entry, commits once, undoes, redoes and reads the saved structure" — a thickness edit: Undo restores the prior sidecar, Redo the edited structure |
| Opening | Tested | `tests/presentation/editor/openingUsability.test.ts` › "places one %s centred at the clicked wall position through the normal history path" (param 'door', 'window', 'opening') — Undo leaves no opening; Redo restores the same object |
| Item | Tested | `tests/presentation/editor/transformBox.e2e.test.ts` › "resizes a selected item through its transform box in one undoable write" — Undo restores the original points, Redo the resized corner |
| Asset placement | Tested | `tests/presentation/editor/deleteShortcut.test.ts` › "removes a selected placement with %s as one confirmed step that Undo restores" (param 'Delete', 'Backspace') — the key plus confirm removes the placement; Ctrl+Z restores it with its assetId; Ctrl+Y removes it again, the store's `structure.elements` and element metadata deep-equal to what the delete left and the saved geometry with no elements |
| Path | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly" (param 'path') — Undo restores the saved structure; Redo changes the points again |
| Fence | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly" (param 'fence') — Undo restores the saved structure; Redo changes the points again |
| Measurement | Tested | `tests/presentation/editor/objectRotationRuntime.test.ts` › "reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly" (param 'measurement') — Undo restores the saved structure; Redo changes the points again |
| Stair | Tested | `tests/presentation/editor/stairsArrows.test.ts` › "creates, renders, edits and rotates a stair with one geometry/metadata history and a full-width hit target" — after a `stair-edit`, Undo restores the saved stair and its prior name; Redo (`runtime.redo()`) brings back the store's element deep-equal to the edited one and the name 'Back stairs' |
| Arrow | Tested | `tests/presentation/editor/linearElements.e2e.test.ts` › "creates/selects/edits/deletes %s with atomic label and geometry history" (param 'arrow') — after an Inspector `outline-points` edit, Undo restores the saved element and its name; Redo (`runtime.redo()`) brings back the store's element deep-equal to the edited one and the name 'Side route'; Undo of a delete restores element and name |
| Post | Tested | `tests/presentation/editor/structuralCreation.test.ts` › "places one post per click at the typed section, stays on the tool, and undoes each post alone" — after two posts, Undo leaves only the first; Redo (`runtime.redo()`) brings back the store's `structure.elements` and element metadata deep-equal to both posts as placed |
| Beam | Tested | `tests/presentation/editor/structuralInspector.test.ts` › "summarises a beam, switches load-bearing through undoable history, and edits its width" — Undo returns a switched-off load-bearing flag to true; Redo (`runtime.redo()`) brings back the store's element deep-equal to the switched beam |
| Dimension | Tested | `tests/presentation/editor/draftingInspector.test.ts` › "edits a dimension chain's offset and keeps its points" — Undo returns the offset to -600; Redo (`runtime.redo()`) brings back the store's element deep-equal to the edited chain (offset -800, same points) |
| Section | Tested | `tests/presentation/editor/draftingInspector.test.ts` › "flips a section line from its Inspector through undoable history" — Undo reverts a flip; Redo (`runtime.redo()`) brings back the store's element deep-equal to the flipped section line |
| View | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a view marker on its second point as A-01" — after the view marker is saved, one Undo (`runtime.undo()`) leaves the store's `structure.elements` and element metadata (an absent list read as empty) deep-equal to what they were before the save; Redo (`runtime.redo()`) brings both back deep-equal to what the save left |
| Hatch | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a hatched area and a boundary line on Finish, and refuses a hatch outline that crosses itself" — after the hatch is saved, one Undo (`runtime.undo()`) leaves the store's `structure.elements` and element metadata (an absent list read as empty) deep-equal to what they were before the save; Redo (`runtime.redo()`) brings both back deep-equal to what the save left |
| Text | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "places a text point without saving, moves it on a further point, and saves it once it has words" — after the text is saved, one Undo (`runtime.undo()`) leaves the store's `structure.elements` and element metadata (an absent list read as empty) deep-equal to what they were before the save; Redo (`runtime.redo()`) brings both back deep-equal to what the save left |
| Boundary | Tested | `tests/presentation/editor/draftingCreation.test.ts` › "saves a hatched area and a boundary line on Finish, and refuses a hatch outline that crosses itself" — after the boundary line is saved beside the hatch, one Undo (`runtime.undo()`) leaves the store's `structure.elements` and element metadata (an absent list read as empty) deep-equal to what they were before the save; Redo (`runtime.redo()`) brings both back deep-equal to what the save left |
| Grid | Tested | `tests/presentation/editor/draftingMenu.test.ts` › "offers every drafting tool from the empty canvas with a known icon, and starts the chosen one at the menu's point" — after context menu › Drafting › Grid saves a grid point, one Undo (`runtime.undo()`) leaves the store's `structure.elements` and element metadata (an absent list read as empty) deep-equal to what they were before the save; Redo (`runtime.redo()`) brings both back deep-equal to what the save left |
| Group | Tested | `tests/presentation/editor/groupEditing.test.ts` › "encloses a Room in one saved group and restores both walls and membership on undo/redo" — Undo leaves no group and no walls; Redo restores both |

### 4.10 Non-drag route

| Row | State | Evidence |
|---|---|---|
| Room | Tested | `tests/presentation/editor/keyboardNudge.test.ts` › "ArrowRight dispatches one moveObject translated by {dx:10, dy:0}, records a history entry, and Undo restores it" — a real ArrowRight keydown saves points +10 mm in x; Undo restores |
| Area | Implemented, untested | `createNudgeSelectionAction` (`src/presentation/editor/nudge.ts`), zoneType-agnostic. Missing: an arrow-key nudge of a non-Room zone. |
| Wall | Unsupported | `createNudgeSelectionAction` resolves no wall and returns silently; `StructureEditForm.vue` has no position field. A wall moves without a drag only as a group member. No explanation shown. |
| Opening | Tested | `tests/presentation/editor/openingMove.test.ts` › "admits Inspector Move, previews without writes, commits the literal centre and reverses all opening metadata" — Inspector Move then a click: preview writes nothing, commit writes offset 2550 once; Undo/Redo |
| Item | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected item that saves the translated points. |
| Asset placement | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected placement that saves the translated points. |
| Path | Tested | `tests/presentation/editor/elementRecovery.test.ts` › "moves and nudges current geometry through one history path while preserving its canonical label" — two `runtime.nudgeSelection({dx:10})` calls (the arrow key's function) save x +20; three Undos restore |
| Fence | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected fence that saves the translated points. |
| Measurement | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected measurement that saves the translated points. |
| Stair | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected stair that saves the translated points. |
| Arrow | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected arrow that saves the translated points. |
| Post | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected post that saves the translated points. |
| Beam | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected beam that saves the translated points. |
| Dimension | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected dimension chain that saves the translated points. |
| Section | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected section line that saves the translated points. |
| View | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected view marker that saves the translated points. |
| Hatch | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected hatch that saves the translated points. |
| Text | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected text mark that saves the translated points. |
| Boundary | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected boundary that saves the translated points. |
| Grid | Implemented, untested | `createNudgeSelectionAction` element branch (`src/presentation/editor/nudge.ts`) → `moveElement`. Missing: an arrow key on a selected grid point that saves the translated points. |
| Group | Implemented, untested | `GroupControls.vue` → `groupActions.moveBy` (`src/presentation/editor/groups/groupActions.ts`), the typed dx/dy fields (arrow nudge does not apply to a multi-selection). Missing: a check not already counted under Group · Precise edit. `tests/presentation/editor/groupNativeActions.test.ts` › "moves an assembly from the native numeric fields and uses both quarter-turn buttons with exact history" is the same check as Group · Precise edit and is counted there only. Every other `groupActions.moveBy` call a `git grep` finds under `tests/` asserts a refusal or a pending state, or moves an explicit selection rather than a saved group. |

## 5. The ten tests the plan names

| Plan test | At HEAD | Evidence |
|---|---|---|
| Dense overlap fixture | Absent | `git grep -i dense` finds nothing under `tests/presentation/editor`. The nearest is a four-way overlap: `tests/presentation/editor/selection/resolveSelectionTarget.test.ts` › "ranks Object before Opening before Wall before Room across paint orders and cycles every overlap" |
| Group with hidden member | Present | `tests/presentation/editor/groupNativeActions.test.ts` › "keeps hidden assembly members in precise operations, while layer visibility removes every pointer handle"; `tests/presentation/editor/groupEditing.test.ts` › "rotates hidden members with the saved group, retaining exact cardinal coordinates and history" |
| Lock/unlock | Partial | `tests/presentation/editor/zoneLock.e2e.test.ts` › "locks a zone from the sidebar, takes it off the canvas hit list, and undoes the lock" locks through the sidebar and unlocks only through Undo. Unlocking through the control is asserted at the command: `tests/application/commands/editZoneDetails.test.ts` › "locks and unlocks through the same transaction, as one undo step with its event" |
| Wall plus hosted openings | Present | `tests/presentation/editor/wallRotationRuntime.test.ts` › "reviews %s host rotation, writes once and restores exact hosted facts and independent Room geometry"; `tests/presentation/editor/curveTask.e2e.test.ts` › "edits a Wall through the same task while preserving attached openings and refusing Review"; `tests/presentation/editor/groupEditing.test.ts` › "moves a grouped Room, walls and later hosted opening from the immutable pointer baseline with one write" |
| Copy/paste across plans | Present | `tests/presentation/editor/clipboard.test.ts` › "pastes on one floor what was copied on another" (two editors sharing one clipboard) |
| Click versus drag rotation | Present | `tests/presentation/editor/rotationInteraction.test.ts` › "uses the entire invisible rectangle and a four-screen-pixel threshold at scale %s" (0.2, 1, 5); same file › "never turns a completed drag back into a click when it returns to its start" |
| Modifier change mid-gesture | Partial | Pan: `tests/presentation/editor/canvasNavigation.test.ts` › "releasing space mid-drag lets the pan finish rather than stranding the pointer". Rotate, Shift pressed after the drag started: `tests/presentation/editor/objectRotation.test.ts` › "previews without drift and commits the final release position exactly once with Shift snapping" and `tests/presentation/editor/rotationInteraction.test.ts` › "retains a stable bearing near the pivot and exposes the configured Shift increment". Draw, Shift pressed mid-draw with `draw-polygon`: `tests/presentation/editor/canvasGestureOwnership.test.ts` › "still reaches the tool while the TOOL’s own gesture is in flight" (button held; the drawn lines change) and `tests/presentation/editor/interactionLayer.test.ts` › "flattens the rubber band the moment Shift goes down, with the pointer still" (the rubber band's loose end moves from y 105 to 100, level with the first vertex); both assert the preview, not a save. Move, a body drag of a Room with Shift or Alt pressed after the drag started: `tests/presentation/editor/zoneMoveModifier.test.ts` › "keeps a body move drag when %s goes down mid-drag: one write of the plain translation, and the gesture ends" (param 'Shift', 'Alt') — one save of the outline translated by exactly the pointer delta, no gesture or draft left, after the next click on empty canvas the selection is empty and nothing is written, and one Undo restores the outline. A PIN of current behaviour, not a requirement: no spec, PBI or ADR states what a modifier does once a move has started. Still without a case: a modifier RELEASED mid-move, Ctrl or Meta, and a modifier change during an element, point or group drag, a resize or a label move |
| Input-focused shortcuts | Partial | Integration only: `tests/presentation/editor/inputInteractions.test.ts` › "routes Ctrl Z/Y from editor buttons through real history and leaves text/modal editing alone"; `tests/presentation/editor/deleteShortcut.test.ts` › "leaves chords, repeats, composition, dialogs, a stale floor, Review and fields alone". No file under `tests/` names `historyShortcut` |
| Pending command | Present | `tests/presentation/editor/wallRotationRuntime.test.ts` › "keeps the reviewed angle immutable and rejects duplicate Apply or Cancel while its write is pending"; `tests/presentation/editor/clipboard.test.ts` › "offers no paste while a structure or element edit is in flight, from the menu or the shortcut" |
| Both locales | Partial | German is checked at the string level only: `tests/presentation/editor/add/creationCatalogue.test.ts` › "offers Room and Area, each activating its own geometry path" (an Add search in `de`); `tests/presentation/editor/spatialMessage.test.ts` › "answers every command-level spatial code with its own sentence in both locales". All five files under `tests/presentation/editor` that name `'de'` call a string function with it, and none of them mounts the editor in German. No editor test calls the mock's `setLanguage` |

## 6. Gaps: every cell that is not Tested

One line per cell. A list of what is empty, not a plan to fill it.

| Row | Column | State |
|---|---|---|
| Area | Move | Implemented, untested |
| Area | Duplicate/copy | Implemented, untested |
| Area | Delete | Implemented, untested |
| Area | Non-drag route | Implemented, untested |
| Wall | Move | Unsupported |
| Wall | Cancel | Implemented, untested |
| Wall | Non-drag route | Unsupported |
| Opening | Move | Implemented, untested |
| Opening | Rotate | Unsupported |
| Opening | Delete | Implemented, untested |
| Item | Move | Implemented, untested |
| Item | Duplicate/copy | Implemented, untested |
| Item | Non-drag route | Implemented, untested |
| Asset placement | Move | Implemented, untested |
| Asset placement | Cancel | Implemented, untested |
| Asset placement | Non-drag route | Implemented, untested |
| Path | Duplicate/copy | Implemented, untested |
| Fence | Select | Implemented, untested |
| Fence | Move | Implemented, untested |
| Fence | Duplicate/copy | Implemented, untested |
| Fence | Cancel | Implemented, untested |
| Fence | Non-drag route | Implemented, untested |
| Measurement | Move | Implemented, untested |
| Measurement | Duplicate/copy | Implemented, untested |
| Measurement | Cancel | Implemented, untested |
| Measurement | Non-drag route | Implemented, untested |
| Stair | Move | Implemented, untested |
| Stair | Duplicate/copy | Implemented, untested |
| Stair | Non-drag route | Implemented, untested |
| Arrow | Select | Implemented, untested |
| Arrow | Move | Implemented, untested |
| Arrow | Rotate | Implemented, untested |
| Arrow | Duplicate/copy | Implemented, untested |
| Arrow | Non-drag route | Implemented, untested |
| Post | Move | Implemented, untested |
| Post | Rotate | Implemented, untested |
| Post | Duplicate/copy | Implemented, untested |
| Post | Cancel | Implemented, untested |
| Post | Non-drag route | Implemented, untested |
| Beam | Move | Implemented, untested |
| Beam | Rotate | Implemented, untested |
| Beam | Duplicate/copy | Implemented, untested |
| Beam | Cancel | Implemented, untested |
| Beam | Non-drag route | Implemented, untested |
| Dimension | Move | Implemented, untested |
| Dimension | Rotate | Implemented, untested |
| Dimension | Duplicate/copy | Implemented, untested |
| Dimension | Delete | Implemented, untested |
| Dimension | Cancel | Implemented, untested |
| Dimension | Non-drag route | Implemented, untested |
| Section | Move | Implemented, untested |
| Section | Precise edit | Implemented, untested |
| Section | Rotate | Implemented, untested |
| Section | Duplicate/copy | Implemented, untested |
| Section | Delete | Implemented, untested |
| Section | Cancel | Implemented, untested |
| Section | Non-drag route | Implemented, untested |
| View | Move | Implemented, untested |
| View | Precise edit | Implemented, untested |
| View | Rotate | Implemented, untested |
| View | Duplicate/copy | Implemented, untested |
| View | Non-drag route | Implemented, untested |
| Hatch | Move | Implemented, untested |
| Hatch | Precise edit | Implemented, untested |
| Hatch | Rotate | Implemented, untested |
| Hatch | Duplicate/copy | Implemented, untested |
| Hatch | Non-drag route | Implemented, untested |
| Text | Move | Implemented, untested |
| Text | Precise edit | Implemented, untested |
| Text | Rotate | Unsupported |
| Text | Duplicate/copy | Implemented, untested |
| Text | Non-drag route | Implemented, untested |
| Boundary | Move | Implemented, untested |
| Boundary | Precise edit | Implemented, untested |
| Boundary | Rotate | Implemented, untested |
| Boundary | Duplicate/copy | Implemented, untested |
| Boundary | Non-drag route | Implemented, untested |
| Grid | Move | Implemented, untested |
| Grid | Precise edit | Implemented, untested |
| Grid | Rotate | Unsupported |
| Grid | Duplicate/copy | Implemented, untested |
| Grid | Non-drag route | Implemented, untested |
| Group | Non-drag route | Implemented, untested |

Tested cells that check only part of the column (listed so a Tested mark is not read wider than it is): Opening · Cancel; Item · Cancel; Path · Rotate; Fence · Rotate; Measurement · Rotate; Arrow · Cancel; Group · Cancel.

## 7. Owner question, not decided here

The no-op half of the plan's Acceptance clause "rejected/no-op operations do not add history" contradicts
`CommandHistory.runNow` (`src/presentation/editor/tools/command-history.ts`), which puts a gesture
that wrote nothing on the undo stack by design.
`tests/presentation/editor/history.e2e.test.ts` › "a no-write success writes nothing, keeps a standing save error, and still takes a history entry"
pins that behaviour. The Done PBI `docs/requirements/Undo and redo.md` records the clause's history
half as NARROWED at its criterion 6. The question is open and recorded in
[`05-owner-decisions.md`](./05-owner-decisions.md) §8. This matrix does not choose a remedy.

## 8. Out of reach here

- Platform shortcuts in real hosts on Windows and macOS need a vault. The suite dispatches synthetic
  key events in jsdom.
- This document makes no claim about native, device or screen-reader behaviour.
