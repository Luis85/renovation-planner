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
| 5 | `browser` | Look at the toolbar | Six tool buttons on one line — Pan, Trace footprint, Trace clearance, Set anchor, Set facing, Calibrate — plus Undo/Redo dimmed at the right | Task B6's `CalibrateTool` registered where a tool CAN fail by being absent from a list with every one of its own tests green — the exact shape slice 7 shipped once |
| 6 | `browser` | Look at the canvas | A centred card reads "No spec sheet yet" with a "Choose a background" button — not "No footprint yet" | `selectAssetDesignerEmptyState`'s precedence: this asset has neither a background nor a shape, and Task B7's Decision 3 puts the background nag first |
| 7 | `obsidian` | Click "Choose a background" and pick `editor-background-png-test.png` from the picker | The picker lists it, and every other PNG/JPEG/PDF in the vault, by full path; choosing it closes the picker and the sheet appears under the canvas, right way up, with its 1000mm scale bar readable | `ObsidianBackgroundPicker` wrapping a real `FuzzySuggestModal`, where `backgroundPicker.test.ts` drives a hand-built fake one — and `SetAssetBackgroundCommand`'s write actually landing |
| 8 | `obsidian` | Look in the file explorer, inside your library folder's `Geometry/` subfolder (`Renovation/Library/Geometry/` by default) | A file named after the asset's id, with a `.rpgeo` extension, is listed | ADR-0014: the shape lives beside the shared library rather than in any Plan's own `Geometry/` folder. Setting a background already wrote it — clearing a calibration that was already null still writes the document (Task B7's own no-write guard is keyed on the BACKGROUND, not on the calibration) |
| 9 | `suite` | Look at the Inspector | No Dimensions line yet, and no "Edit dimensions" button | `DesignerInspector` drawing nothing about a shape this asset does not have — a background alone is not a footprint |
| 10 | `suite` | Trace the footprint: click Trace footprint, click three or four points over the spec sheet to outline a rough rectangle, then click back on the first point to close it | Each click draws a small circle at the vertex, the first one larger; moving back over the first vertex grows it before the closing click. The outline is drawn, the Inspector now shows a Dimensions line with two numbers, and a warning line reads above it | `dimensionsUnscaled` (`GetAssetDesign`'s own field) — this footprint was traced in the background's raw pixel space, before the asset had a scale, so the numbers are real coordinates and not yet real millimetres |
| 11 | `suite` | Read the warning | It reads "This footprint was traced before a scale existed, so these numbers are not real measurements yet." | The exact `designer.inspector.dimensions.unscaled` string — a reader should know WHY the numbers cannot be trusted, not merely that something is wrong |
| 12 | `suite` | Trace the clearance: click Trace clearance, outline a slightly larger rectangle around the footprint, and close it | A second, larger outline is drawn around the first | The second coordinate group Task B6's calibration also has to rescale — footprint and clearance are two independent `Polygon` fields, and a fix rescaling only one would pass every case that draws just a footprint |
| 13 | `suite` | Click Set anchor, then click once inside the footprint | A small marker appears at that point | `SetAnchorTool`'s commit-on-`pointerDown` gesture — one click, no drag, no second click, and the one designer tool with no generation counter because nothing about it can be interrupted mid-gesture |
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
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design, the four task reports (`.superpowers/sdd/2026-08-30-asset-designer-first-increment/task-B6…B10-report.md`) and the code, rather than from a walk. |
