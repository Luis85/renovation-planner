---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 80
sources:
  - PRD §88
  - SDD §12
  - SDD §65
  - SDD §84
  - SDD §91
  - ADR-0014
  - ADR-0015
status: Ready
---
# Design an Asset

The asset designer's first increment (design slices B1–B10), walked end to end in a real
vault: a third workspace surface (ADR-0015) keyed by an `assetId` rather than a plan id, its
own background and its own calibration (ADR-0014's geometry sidecar), a footprint, a
clearance boundary, an anchor, a facing direction and a height. This file is the **canonical
procedure**; `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md` is the
plan that shipped it.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and
`Create sample renovation project` run first so a Plan with zones is open in a second tab —
step 19 needs one to compare against. The two fixtures this case reuses,
`editor-background-png-test.png` and `editor-background-pdf-test.pdf`, are
[[Editor Walkthrough]]'s own — there is no asset-specific fixture, and there does not need to
be one: the PNG's 1000mm scale bar is exactly the tool this surface needs too, and a second
copy of either file would only be a second thing to keep in sync with
`npm run background-fixture`.

**Why a human still matters here.** Four things put this surface out of every gate's reach,
the same shapes CLAUDE.md's harness section names for the rest of the plugin:

- **A notice looks like a notice nowhere but here.** `tests/harness/obsidian.css` declares no
  `.notice` rule at all, so neither `npm run harness` nor `npm run harness-shot` can draw the
  one this surface raises. Step 1 is where that is looked at.
- **A PDF page rendering is the one thing no fake stands in for.** Production asks Obsidian
  for its own copy of pdf.js; the suite runs a different one. Step 21 is the only instrument.
- **A calibration touching no plan is asserted by `calibrateAsset.test.ts`'s own seeded-Plan
  case, and this is the first time it has been looked at with a real Plan Editor open beside
  the thing being calibrated.** Step 19 is that look.
- **A sidebar-width toolbar is a real Obsidian workspace question.** `npm run harness-shot`'s
  `asset-designer-narrow` capture proved the CSS fix once; step 23 is whether dragging a real
  leaf into a real sidebar agrees with a synthetic 460px browser page.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | With no assets anywhere in the vault, run `Open asset designer` from the command palette | A notice reads "This vault has no assets yet.", prefixed "Information", and clears on its own after about six seconds | `openAssetPicker`'s empty-catalogue refusal — the one notice this surface can raise before anything exists to open — and whether it actually LOOKS like a notice, which the harness cannot show |
| 2 | `suite` | Open the Renovation project view (ribbon or command) with no projects in the vault | Below the "No renovation projects yet" empty state, a sibling "New asset" button appears | The catalogue's own creation door sitting BESIDE the project empty state rather than inside it — an Asset carries no project id since design slice 19, so the project empty state's one-action registry could not have grown a second action for it |
| 3 | `suite` | Click "New asset", fill in a Name and a Unit cost, leave Width and Depth blank, and Save | The dialog closes and the asset designer opens automatically on the asset just created | Task B9's `onCreateAsset` → `context.openAsset` wiring. There is no catalogue list on this surface for the new row to appear in, so this is the only way a click here is seen to have bought anything |
| 4 | `browser` | Look at the shell | Four regions are present: a toolbar along the top, a canvas in the centre, an Inspector panel on the right, and a status bar along the bottom | Layout collapse — `regionsReachable.test.ts` proves every region is reachable BY IMPORT, never that it is drawn at a usable size |
| 5 | `browser` | Look at the toolbar | Ten tool buttons — Pan, Select, Trace footprint, Trace clearance, Draw rectangle, Draw circle, Trace detail, Set anchor, Set facing, Calibrate — plus Undo/Redo dimmed at the right, wrapping onto a second row where the pane is too narrow for one | Task B6's `CalibrateTool` registered where a tool CAN fail by being absent from a list with every one of its own tests green — the exact shape slice 7 shipped once |
| 6 | `browser` | Look at the canvas | A centred card reads "No spec sheet yet" with a "Choose a background" button — not "No footprint yet" | `selectAssetDesignerEmptyState`'s precedence: this asset has neither a background nor a shape, and Task B7's Decision 3 puts the background nag first |
| 7 | `obsidian` | Click "Choose a background" and pick `editor-background-png-test.png` from the picker | The picker lists it, and every other PNG/JPEG/PDF in the vault, by full path; choosing it closes the picker and the sheet appears under the canvas, right way up, with its 1000mm scale bar readable | `ObsidianBackgroundPicker` wrapping a real `FuzzySuggestModal`, where `backgroundPicker.test.ts` drives a hand-built fake one — and `SetAssetBackgroundCommand`'s write actually landing |
| 8 | `obsidian` | Look in the file explorer, inside your library folder's `Geometry/` subfolder (`Renovation/Library/Geometry/` by default) | A file named after the asset's id, with a `.rpgeo` extension, is listed | ADR-0014: the shape lives beside the shared library rather than in any Plan's own `Geometry/` folder. Setting a background already wrote it — clearing a calibration that was already null still writes the document (Task B7's own no-write guard is keyed on the BACKGROUND, not on the calibration) |
| 9 | `suite` | Look at the Inspector | No Dimensions line yet, and no "Edit dimensions" button | `DesignerInspector` drawing nothing about a shape this asset does not have — a background alone is not a footprint |
| 10 | `suite` | Trace the footprint: click Trace footprint, click three or four points over the spec sheet to outline a rough rectangle, then click back on the first point to close it | Each click draws a small circle at the vertex, the first one larger; moving back over the first vertex grows it before the closing click. The outline is drawn, the Inspector now shows a Dimensions line with two numbers, and a warning line reads above it | `dimensionsUnscaled` (`GetAssetDesign`'s own field) — this footprint was traced in the background's raw pixel space, before the asset had a scale, so the numbers are real coordinates and not yet real millimetres |
| 11 | `suite` | Read the warning | It reads "This footprint was traced before a scale existed, so these numbers are not real measurements yet." | The exact `designer.inspector.dimensions.unscaled` string — a reader should know WHY the numbers cannot be trusted, not merely that something is wrong |
| 12 | `suite` | Trace the clearance: click Trace clearance, outline a slightly larger rectangle around the footprint, and close it | A second, larger outline is drawn around the first | The second coordinate group Task B6's calibration also has to rescale — footprint and clearance are two independent `Polygon` fields, and a fix rescaling only one would pass every case that draws just a footprint |
| 13 | `suite` | Click Set anchor, then click once inside the footprint | A small marker appears at that point | `SetAnchorTool`'s commit-on-`pointerDown` gesture — one click, no drag, no second click, and the one designer tool with no generation counter because nothing about it can be interrupted mid-gesture |
| 13a | `suite` | Click Select, then click the anchor marker you just placed | The Inspector shows an "Anchor" section with no position field, and one line reads "This part was captured before a scale existed, so its measurements are hidden until the asset is calibrated." | Amendment 2's pending-part rule reaching every part kind, not only the footprint — a millimetre field beside an unscaled anchor would invite a number calibration later multiplies (Task 3, commit 0bde4f73) |
| 14 | `browser` | Click Set facing, then drag a short distance from anywhere on the canvas and release | An arrow is drawn from the drag's start toward its end | `SetFacingTool`'s drag-names-a-direction gesture — the one designer command whose input is an angle rather than a point, which step 16 checks a calibration leaves alone |
| 15 | `obsidian` | Click Calibrate, then click one end tick of the scale bar and the other | A confirmation dialog appears, asking about rescaling this asset's geometry, with a destructive-styled rightmost button | `hasGeometryToRescale`'s own gate — the footprint, the clearance and the anchor are all still PENDING, so there is something to lose, the mirror image of [[Calibrate a Plan]] step 14 on a plan with no zones |
| 16 | `suite` | Confirm, then in the distance dialog that follows, type `2000` — not the fixture's real 1000mm — and save | The dialog closes, and the Inspector's Dimensions line reads exactly DOUBLE the two numbers from step 10, with no unscaled warning any more | The whole chain — tool → `CalibrateAssetCommand` → the sidecar → the Inspector's post-command refresh — and DOUBLE rather than the same or quadruple is the tell: a linear dimension takes the correction once, where [[Calibrate a Plan]]'s own worked example is an AREA and quadruples for the identical reason |
| 16a | `browser` | Look at the canvas after the calibration lands | The spec sheet has grown with the footprint, and the outline still sits over the pixels it was traced on | Task 1 of the review fixes: `drawnWorldScale` corrects the raster by the asset's own `pixelsPerWorldUnit`; before it the footprint doubled and the sheet did not |
| 17 | `browser` | Look at the anchor marker and the facing arrow | The anchor has moved outward with the footprint, at the same relative position; the facing arrow is unchanged in length and direction | `rescaled()`'s per-flag rule (`CalibrateAsset.ts`) — the anchor's own `anchorPending` flag says it awaited a scale, and `facing` is an angle nothing in that function touches at all |
| 18 | `suite` | Press Undo | The Dimensions line returns to its step-10 reading, and the unscaled warning reappears | The calibration's inverse restoring the pre-calibration shape, not merely the calibration record beside it |
| 19 | `suite` | Switch to the Plan Editor tab from the preconditions and read the Kitchen zone's area | It is exactly what it was before you touched the asset designer | `CalibrateAssetCommand` never reaching a Plan or a Zone repository — [[Asset designer]]'s own Definition of Done item ("an object's calibration belongs to the object" and never a plan's) looked at with a real Plan open, rather than only asserted by `calibrateAsset.test.ts`'s seeded-Plan case |
| 20 | `suite` | Give the asset a height: type a number into the Inspector's height field and blur it | The value persists with no error | Task B8's one editable scalar, committed through `useFieldCommit` exactly like the Plan Editor's Requirement override fields |
| 21 | `obsidian` | Create a SECOND asset from the Renovation project view, typing both Width and Depth at creation (e.g. 600 and 400), then choose `editor-background-pdf-test.pdf` as its background once its designer opens | A rectangle is already drawn on the canvas with no Trace footprint gesture, and once the PDF is chosen its page renders as the background | Two Definition of Done items at once: "an object is usable before it is accurate" (a typed rectangle needs no tracing), and the one step no automated test can stand in for — the suite runs its own copy of pdf.js and production asks Obsidian for a different one |
| 22 | `suite` | Calibrate this second asset (any two points, any distance) | The distance dialog appears with NO confirmation first | `hasGeometryToRescale` answering false for a typed footprint — nothing is pending, so there is nothing to warn about losing, [[Calibrate a Plan]] step 14 met from the opposite side |
| 23 | `obsidian` | Drag this pane into a sidebar, or narrow it to roughly 460px | The toolbar wraps onto two rows; every label stays fully spelled out, and Calibrate is reachable | Task B10's fix, checked in a real Obsidian workspace rather than only `harness-shot`'s synthetic 460px capture — before it, this width silently pushed "Set facing" and Calibrate off the pane with no wrap, no scroll and no sign anything was missing |
| 24 | `obsidian` | Toggle the plugin off and back on, then reopen both asset designers | Every shape, the calibration, the anchor, the facing and the height are exactly as you left them, and the console shows no `Several Konva instances detected` and no duplicate-view warning | Persistence living in the `.rpgeo` sidecar rather than in memory, and `onunload` releasing Konva's global — the same failure this suite's own header records finding once, for the Plan Editor, before anything here existed |
| 24a | `obsidian` | Close this asset's designer tab (not the whole plugin), then reopen it from the Renovation project view or the library | The camera frames the whole symbol the moment the canvas has an area — the same view `Shift+1` would give — rather than opening at whatever camera the view last had | Task 10's fix (commit 8ca2f7c8): an asset merely opened used to keep its last view, so a small object could open as a speck in the corner with its handles piled on it (critique finding 1) |
| 25 | `suite` | On an asset with a traced footprint, click "Start from preset" in the Inspector, choose Toilet, keep the defaults and press "Apply preset" | The dialog warns that the current design is replaced; afterwards the canvas draws a round-fronted outline with a tank and a bowl inside it, and Dimensions read 380 × 700 mm | `SetAssetShape` through the reversible geometry edit, and the details layer drawing what the preset built |
| 26 | `suite` | Press Undo | The traced footprint returns and the tank and bowl are gone | The whole-document inverse restoring a shape the preset replaced, details included |
| 27 | `obsidian` | Place that toilet on a plan by snapping it to a wall | The tank sits against the wall, the bowl points into the room, and the plan draws the tank and bowl inside the outline | The +y front convention meeting `backDepth` on a curved footprint, and `assetShapeConfig`'s details in a real Konva stage — no harness capture covers a placed symbol |
| 28 | `browser` | Start from preset → Curved table, set Sweep to 180, apply, and zoom the designer in on one end of the arc | The arc stays smooth, with no visible facets | The zoom-aware arc tolerance (`ARC_TOLERANCE_PX`) rather than a fixed world tolerance |

## Steps — a preset adjusted by selection

Preconditions: a THIRD asset, created from the Renovation project view with no width or depth,
its designer open with no background, and **Start from preset → Toilet** applied at its defaults
(Dimensions read 380 × 700 mm). It is a fresh asset so nothing on it is pending and nothing was
calibrated. The toilet's details: the **tank**, the straight one across the back, and the **bowl**,
the rounded one in front of it; the anchor dot sits inside the bowl. The Inspector's number fields
are labelled "Horizontal centre in millimetres", "Width in millimetres" and so on; the steps below
shorten them.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 29 | `suite` | Click Select, then click inside the bowl away from the anchor dot | The bowl is outlined in the accent colour with eight square handles and a curved rotate arrow on a stem above it; a mode control reads Transform, Edit points, Bend edges with Transform pressed; the Inspector shows a "Detail" section reading Name Bowl, Line Solid, Horizontal centre 0, Vertical centre 100, Width 304, Depth 450; Undo stays dimmed | Decision 10's hit order — a detail over the footprint is the detail — and "a selection writes nothing" |
| 29a | `suite` | With the bowl still selected, look at the Inspector as a whole, below the Detail section | A second heading reads "Asset", with the asset's own Dimensions line below it — never blended into the Detail section above | Task 13's fix (commit 47467885): before it, the asset's Dimensions sat directly under the Detail section with no heading of its own, so the two read as one block and the asset's footprint size looked like the bowl's (critique finding 4) |
| 29b | `browser` | Hover, in turn, over the Transform, Edit points and Bend edges buttons (do not click) | Each shows its own tooltip: Transform reads "Drag the part to move it, a square handle to resize it or the curved arrow to rotate it", Edit points reads "Drag a corner to move it; it snaps to the corners, edges and alignments of the other parts, to the anchor, and to the grid while shown", Bend edges reads "Drag the handle in the middle of an edge to curve that edge" | Task 4's fix (commit e52fda6b): the buttons' own text names the mode, not the gesture it offers, so a `title` naming what dragging its handles does now sits beside it |
| 29c | `suite` | With Transform still the pressed mode and the bowl selected, look at the status bar along the bottom | It reads "Shift keeps proportions and snaps the rotation" | Amendment 2's designer-only Shift hint (Task 4, commit e52fda6b): the shared `select` id must not borrow the plan editor's constrained-angle hint, so this one is asked of the designer's own selection and mode rather than of the shared list |
| 29d | `obsidian` | With the bowl selected, look at the "Line" dropdown in the Detail section | Record whether it renders with Obsidian's own themed `<select>` chrome or as a plain, unstyled control | Critique finding 23 — the harness's vendored stylesheet declares no `<select>` rule at all, so a plain control there may be a harness artefact rather than a real gap; only a real theme can tell them apart (no code change was made against this finding) |
| 30 | `suite` | Press Right arrow twice, then Shift+Down once | The bowl moves right, then further down; the Inspector reads Horizontal centre 20, then Vertical centre 200 | Arrows nudging 10 mm and Shift 100 mm through `moveOutline`, one write per press |
| 31 | `suite` | Press Undo three times | The bowl is back at Horizontal centre 0, Vertical centre 100 | Each nudge being exactly one undo entry |
| 32 | `suite` | Drag the bowl's bottom-right handle outward and release, then press Undo | While dragging, the bowl grows and keeps its rounded ends; on release Width and Depth have grown; Undo restores 304 × 450 | `resizeBox` keeping bulges, and the drag's preview committing as one write |
| 32a | `obsidian` | Drag the bowl's bottom-right handle outward, release, then immediately press an arrow key or start a second drag | The second gesture builds on the first once both land: the bowl ends up moved AND resized, with no "Save error" notice at any point | Task 8's one write chain (commit 5f2f4e0b, fix round 54bceeda): a press that arrives while an earlier write is still in flight is held and replayed once it drains, reading the design the replay actually sees, rather than refusing with a stale-write error |
| 32b | `obsidian` | Release a drag on a handle, then immediately press and hold a second drag, on a slow or synced vault | Nothing changes on screen — no live preview, no selection change — until the first drag's write lands, at which point the part jumps straight to the held second drag's position | The stated trade behind Task 8's write chain: a preview shown before the drain would be the stale read Amendment 2 removes, so the lag is deliberate and only visible on a vault slow enough to show it |
| 33 | `suite` | Click the tank, choose Bend edges — its four edge handles are diamonds, not the round vertex handles Edit points draws — drag the tank's front edge handle toward the bowl and release; then press Undo | That one edge bows toward the bowl while the other three stay straight; Undo straightens it | The plan editor's `CurveTool` bound to a detail outline through `CurveToolActions`, and Task 12's diamond handle shape (commit 51c65c4c) telling an edge handle apart from a vertex handle at a glance (critique finding 17) |
| 33a | `browser` | With the bowl selected in Transform, change "Line" from Solid to Dashed, then press Undo | The bowl's outline switches to a dashed stroke immediately, and STAYS dashed while its handles are drawn around it; Undo returns it to solid | Task 12's fix (commit 51c65c4c): a selected detail's outline used to draw solid regardless of its own line style, so the dashed convention (overhead or provisional) vanished the moment a part was being edited (critique finding 7) |
| 34 | `obsidian` | With the tank selected, Tab to the Inspector's Duplicate button and press Enter | A copy of the tank appears 100 mm right and 100 mm down, drawn above the original, and it is the selection; its Name reads Tank; then press Tab once and confirm focus lands in the Inspector rather than jumping to the top of the pane | `duplicateDetail` inserting above the original and selecting `nextDetailId` — the same door Ctrl+D (Cmd+D on macOS) shares — and Task 5's focus hand-off (commit 9336b2c6): Duplicate re-keys the section under the button that had focus, so focus moves to the Inspector aside before it unmounts. The canvas keys leave focus on the canvas, not the Inspector, so this row presses the button rather than Ctrl+D |
| 35 | `obsidian` | With the copy selected, Tab to the Inspector's Delete button and press Enter | The copy disappears and the Inspector shows no Detail section; then press Tab once and confirm focus moves on from the Inspector rather than from the top of the pane | The selection clearing once the part no longer exists, and Task 5's focus hand-off (commit 9336b2c6): Delete prunes the section under the button that had focus, so focus moves to the Inspector aside before it unmounts. The canvas Delete key leaves focus on the canvas, so this row presses the button rather than the key |
| 35a | `suite` | Select the bowl (the topmost detail), then click "Bring forward" repeatedly until it stops moving | Once the bowl is topmost, "Bring forward" is visibly dimmed (`aria-disabled`) rather than removed, further clicks do nothing, and focus stays on the button rather than jumping away | Task 13's fix (commit 47467885): the button used to be a real `:disabled`, and Chromium drops focus to `<body>` when a focused control disables itself, which is the same focus-loss class as the Duplicate/Delete fix above (critique finding 11) |
| 35b | `suite` | Select a detail, then press an arrow key and Delete in quick succession (Delete first, arrow second) | The detail is deleted; the queued arrow key does nothing — no error, no notice, and no stray Undo entry for it | Task 7's fix (commit 31c12265): a nudge or a Delete captured at the key press runs after earlier writes, and skips silently if its part is already gone by the time its own write runs, as the plan editor's nudge does |
| 36 | `suite` | Click inside the footprint below the tank and beside the bowl's rounded back end (between the bowl's side and the footprint's side), then press "Fit to details" | The Inspector showed a "Footprint" section with Fit to details; afterwards the round front is gone and Dimensions read 380 × 675 mm | `fitFootprintToDetails` writing the box of the tank and the bowl as a typed rectangle |
| 37 | `suite` | Press Undo | The round-fronted footprint returns and Dimensions read 380 × 700 mm | The fit being one undo entry |
| 38 | `suite` | With the footprint selected, choose Edit points, drag its back-left corner about 100 mm further left and release, then press Undo | A round handle sits on each of the four corners; the dragged corner follows the pointer and the round front stays round; Undo restores it | Vertex handles through the snap service, and `moveVertex` keeping the curves of the edges it does not touch |
| 39 | `suite` | Click exactly on the anchor dot, type 50 into "Horizontal position in millimetres" and press Enter; then press Undo | The Inspector shows an "Anchor" section and no mode control; a ring is drawn around the dot over a canvas-coloured halo, so the ring reads clearly against the drawing beneath it; the dot moves 50 mm right; Undo puts it back | The anchor winning over the bowl beneath it (hit order step 2), the Inspector's commit on Enter, and Task 12's halo (commit 51c65c4c): a selected anchor used to read as a slightly fatter dot with no visible ring (critique finding 8) |
| 39a | `suite` | Click the facing arrow to select it, then look at the line beneath the angle field | It reads "An angle of 0 points right, and 90 points down" | Task 13's fix (commit 47467885): the facing's direction convention was unstated, so a typed angle's effect had to be guessed (critique finding 25) |
| 40 | `suite` | Click Draw rectangle and drag a box inside the footprint, clear of every corner; then press Undo | A solid rectangle detail appears, is the selection, and the toolbar shows Select pressed again; Undo removes it | `draw-rect` → `addDetail`, the new detail selected, and every draw returning to Select |
| 41 | `browser` | Select the bowl again and narrow the pane to about 460 px | The toolbar and the mode control wrap rather than truncate; the Inspector moves BELOW the canvas rather than beside it, and the canvas keeps a measured height rather than collapsing; every field of the Detail section stays readable without scrolling sideways | The mode control and the inspector section at a sidebar leaf's real width, which no fixed capture takes, and Task 14's fix (commit 848a438b): below a 35rem container the inspector used to keep its 14rem width and leave the canvas about 236px wide, with the selected part a small figure under its handles (critique finding 6) |
| 42 | `suite` | Click on empty canvas outside the clearance | The selection clears and the mode control disappears | PBI extension 1a — a click on nothing clears rather than keeping the previous selection |
| 43 | `suite` | Click "Edit dimensions", type width 760 and depth 1400, and save; then press Undo | The whole symbol doubles about the anchor — footprint, round front, tank and bowl — and Dimensions read 760 × 1400 mm; Undo restores 380 × 700 | Set dimensions taking `scaleDesign` on a design with details, where a plain rectangle would have replaced the drawing |

## Steps — a plain item promoted to the library

Preconditions: a project with a floor that has walls and one Room, open in the Plan Editor —
[[Add an item to the asset library]]'s own.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 44 | `obsidian` | Follow [[Add an item to the asset library]] steps 1 to 8 with a rectangle item named `Cabinet` | The item redraws as a placement with exactly the outline it had, and its Inspector offers Open in designer | Promotion storing an item's outline exactly (`centredFootprint` → `SetAssetFootprint`) |
| 45 | `obsidian` | Choose Open in designer | A designer tab opens on `Cabinet` with its footprint drawn, no details, and no unscaled warning | The promoted asset reaching the designer as a measured footprint |
| 46 | `suite` | Click Select, then click inside the footprint | A "Footprint" section shows Width and Depth equal to the Dimensions line, and no Fit to details button | PBI extension 2a — no control for details the asset does not carry |

There is deliberately no step promoting a CURVED item: a plan item carries no curve today, so
promotion has nothing to lose (the symbols spec's Amendment 1, "Plan items carry no curves"). That
step belongs to the commit that adds `bulges` to `SpatialElement`.

## Steps — snapping, guides and the grid

Preconditions: an asset started from the Toilet preset, open in its designer; step 51 needs an asset with a
calibrated spec sheet.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 47 | `browser` | Click Select, click the bowl and drag it slowly until its left edge nears the tank's left edge | A short dashed guide appears as the edges line up, the bowl jumps onto the line, and the guide disappears on release — the bowl's left side sits on the same line as the tank's, so edge snapping wins before an alignment would, and the guide it draws is only as long as the last bit of travel | The guides `DesignerGestureLayer` draws and clears at release — no fixed capture holds a live pointer |
| 48 | `suite` | Open View, tick Show grid, then drag the tank into open space | The status row reads `Grid … mm`, and the tank's top-left corner lands on a grid line counted from the footprint's top-left corner | The grid supplied to snapping only while shown, from the footprint's corner (`designerGrid`) |
| 49 | `obsidian` | Untick Snap to objects, close the designer, open another asset's designer, then a Plan Editor | The second designer opens with the grid shown and Snap to objects unticked; the Plan Editor's View menu is unchanged | The designer's own device slot (`designer-view`), apart from the Plan Editor's |
| 50 | `suite` | With the bowl selected in Transform, hold Shift and drag a side handle past the tank's edge | The bowl keeps its proportions, nothing snaps and no guide is drawn | Proportional resize taking the raw point |
| 51 | `obsidian` | On an asset with a calibrated spec sheet, tick Show grid | The grid lines are visible over the drawing, not hidden behind it | The grid mounted above the stage — the harness refuses a background document, so no capture can show it |
| 52 | `obsidian` | On an asset whose spec sheet is calibrated, trace an L-shaped footprint with no details, then Edit dimensions and type a new width | The outline keeps its six corners and its notch at the new overall size | The footprint replaced by a rectangle — the defect this row exists for |

## Deliberately NOT checked

- **Replacing an already-set background.** The "Choose a background" button vanishes the
  moment a background exists — `selectAssetDesignerEmptyState` no longer answers
  `'noBackground'` — and nothing else in this increment opens the picker again. Step 21 uses a
  SECOND asset for the PDF check for exactly this reason; do not go hunting for a way to
  change the first asset's background.
- **Placing this asset on a Plan, or anything reading its clearance or its height.** [[Asset
  placement]] is a separate epic and does not exist yet: nothing anywhere in this plugin draws
  a footprint on a Plan's own canvas, no clearance is checked against anything, and the height
  is stored and shown and interpreted by nothing — [[Asset designer]]'s own Definition of Done
  says so and refuses any item beneath it from claiming otherwise.
- **The Shift angle constraint while tracing or dragging.** `CalibrateTool`, `DrawPolygonTool`
  and their shared `SnapService` are the identical objects the Plan Editor uses (Task B6's own
  decision to share rather than duplicate ~200 lines of gesture state), and [[Canvas
  Navigation]] and [[Calibrate a Plan]] already exercise that code path. Re-walking it here
  would be checking the same object twice under a different name.
- **Colour contrast and hit-target size.** The same standing exception every case in this
  suite carries: `tests/harness/accessibility.test.ts` grades roles, names, labels and ARIA
  validity, and explicitly not these two.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design, the plans and task reports and the code, rather than from a walk: step 5's tool list and steps 29 to 46 from the asset designer symbols PR 2 (`docs/superpowers/plans/2026-09-13-asset-designer-symbols-pr2.md` and `.superpowers/sdd/2026-09-13-asset-designer-symbols-pr2/task-1…12-report.md`), steps 25 to 28 from PR 1 (`docs/superpowers/plans/2026-09-13-asset-designer-symbols-pr1.md`), and the rest from the first increment's task reports (`.superpowers/sdd/2026-08-30-asset-designer-first-increment/task-B6…B10-report.md`) and the commits that have corrected those rows since. Steps 47 to 51 from the snapping spec (`docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md`) and its plan, and step 52 from the consolidation spec (`docs/superpowers/specs/2026-09-16-asset-designer-consolidate-design.md` §3) and its plan. |
