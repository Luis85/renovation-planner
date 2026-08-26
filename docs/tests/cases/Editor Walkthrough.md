---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 10
sources:
  - SDD §11
  - SDD §17
  - SDD §54
  - SDD §60
  - SDD §84
  - SDD §91
status: Approved
---
# Editor Walkthrough

Design slice 5's Definition of Done, walked end to end in a real vault. This file is the
**canonical procedure**; `docs/tasks/05-canvas-rendering-and-editor-shell.md` records what
the runs found and points here rather than restating the steps, so there is one list to keep
correct.

Preconditions: `npm run test-build`, this folder open as a vault, and the plugin enabled.
A fresh vault is the stronger start — three of the four defects the first run found only
happen when a folder or a note does not exist yet.

## Steps

Each step names what it would catch, because a step whose purpose is vague gets skipped and
a step that only says "it looks right" cannot fail.

| # | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- |
| 1 | Run `Create sample renovation project` | A project note, a plan note, a `Geometry/*.rpgeo` sidecar and five zone notes appear under `Renovation/` | The whole persistence layer on a vault with no folders in it. Two of the four known defects fired here |
| 2 | Run `Open plan editor` and pick the plan | The editor opens on it | The command is available with no plan note active — it used to require one, which made it invisible in every vault |
| 3 | Look at the shell | §60's five regions are present: toolbar, layers panel, canvas, inspector, status bar | Layout collapse. The toolbar and inspector were deliberately empty until slice 6 — they have content since slice 8, which [[Zone Editing Walkthrough]] walks |
| 4 | Look at the zones | Five zones, each with its name and a status caption; fills differ by zone TYPE and dash patterns by STATUS | A render model that draws every zone identically. The sample covers four types, all three statuses and one non-rectangular outline for exactly this |
| 5 | Untick a layer in the Layers panel | Its contents disappear; ticking it back restores them | Layer visibility wired to the wrong layer, or to none |
| 6 | Drag to pan; zoom with the wheel and with `+`/`-`; move the pointer | The camera follows, the zoom percentage changes, and the status bar's world-millimetre readout tracks the pointer | A viewport transform applied twice or in the wrong direction. `+`/`-` is listed separately because it is a different code path from the wheel |
| 7 | `Set plan background`, choose `editor-background-png-test.png` | The sheet appears UNDER the zones, its top-left corner at world (0,0), reading the right way up | Placement, orientation and scale. The sheet is annotated with its own size, an origin marker and a 1000mm scale bar so all three are checkable rather than plausible — see below |
| 8 | `Set plan background`, choose `editor-background-pdf-test.pdf` | The page renders | **The only step no automated test can stand in for**: production asks Obsidian for pdf.js, and the suite runs our own copy of it |
| 9 | Switch Obsidian's theme (light ⇄ dark) | Zone colours and the shell follow, with no reload | A palette resolved once at mount instead of on `css-change`. This failed in the browser harness for exactly that reason |
| 10 | Open a second plan in a second tab; then run `Open plan editor` again and pick a plan that is already open | Each tab keeps its own camera; the already-open plan is REVEALED rather than opened twice | Per-leaf state leaking between views, and a second entry point deciding for itself what "open" means |
| 11 | Close a Plan Editor tab and reopen it | The zones render identically | An unmount that leaves a stage, observer or listener behind |
| 12 | Quit Obsidian and reopen it, with two Plan Editor tabs open | **Both** tabs reopen onto the plan they were showing | The startup ordering. Check both: Obsidian defers a non-active leaf, so only the first one is exercised early enough to break |

## Reading the PNG fixture (step 7)

The sheet is 3000 × 2000 px, which is 3000mm × 2000mm on the canvas, because a raster is
declared to be one world millimetre per source pixel until slice 7 calibrates it. So:

- Its top-left corner should sit exactly on world (0,0), where the accent corner mark is.
- It should span the first 3m × 2m of the plan — inside the 4200 × 3000mm Kitchen zone, with
  its right and bottom edges visible against that zone's fill rather than hidden under a
  neighbouring one.
- Hovering a major gridline should read that many millimetres in the status bar. The 1000mm
  scale bar is the same check by eye.
- The solid triangle is near the top-left and the open circle at the bottom-right. If they
  are swapped, the image is being drawn mirrored or transposed.

Zone fills are translucent on purpose, so a background under a zone is visible through it —
"I cannot see it" is a failure, not an expected consequence of the zone being on top.

## Runs

| Date | Result | Findings |
| --- | --- | --- |
| 2026-08-24 | Items 1–11 pass, item 12 FAILED | A restored Plan Editor reported "This plan no longer exists" on the first of two tabs. Fixed: `startPersistence` publishes `ProjectIndexRebuilt` and every open editor re-hydrates on it. Three further defects were found on the way to being able to run the list at all — see the suite note |

Anything on this list which does not work is a slice 5 defect, not a later slice's work.
