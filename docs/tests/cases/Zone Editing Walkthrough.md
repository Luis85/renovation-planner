---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 20
sources:
  - SDD §19
  - SDD §26
  - SDD §29
  - SDD §30
  - SDD §31
  - SDD §57
  - SDD §59
  - SDD §91
---
# Zone Editing Walkthrough

Design slice 8's Definition of Done, walked end to end in a real vault — the companion to
[[Editor Walkthrough]] (slice 5's shell, which this builds on; run that first or at least
its steps 1–6, so there are zones to edit). This file is the **canonical procedure**;
`docs/tasks/08-zone-editing.md` records what the runs found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and
a plan with at least one zone (`Create sample renovation project` makes five).

**Why a human still matters here, after 1200 automated tests:** the review pass found
Escape-cancels-drawing certified by an event sequence no mouse can produce, and two
gestures whose feel was wrong at the default camera in ways only a hand on a mouse shows.
The steps below are the ones where "the suite is green" proves nothing about the hand.

## Steps

| # | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- |
| 1 | Select tool; click a zone | An accent outline appears with ONE handle circle per vertex; the Inspector shows the zone's name and area in m² | Selection pipeline and the Inspector query against real vault data |
| 2 | Click empty canvas | Outline and handles vanish; the panel reads "Nothing selected." | The deselect path |
| 3 | Press on a zone, wiggle the pointer a pixel or two, release | Selection only — the Undo button stays DISABLED | The click-vs-drag epsilon. It is camera-scaled; a world-fixed one made every jittery click a move command, polluting the undo stack |
| 4 | Drag a zone's body and release | The zone follows smoothly and stays where dropped; Undo enables | One command per drag, however many pointermove events fired |
| 5 | Press Undo | The zone returns to its exact prior position | The move's inverse snapshot |
| 6 | Note the Inspector's area. Drag one vertex handle; release | Only that vertex moves, and the panel's area CHANGES without reselecting | Vertex editing, and the post-command Inspector refresh. The area is the point: a body MOVE preserves area, so only an edit that changes it can prove the panel was re-read rather than stale |
| 7 | Press Undo | The vertex snaps back; every other vertex is where it was | The vertex inverse touching one index only |
| 8 | Draw-zone tool; click 3–4 vertices; click near the FIRST one | The polygon closes into a zone, which is selected; a zone note AND a `Geometry/*.rpgeo` entry appear in the vault | The create transaction — both files, not one |
| 9 | Still drawing: place two vertices, press Escape, then click twice more | The first buffer is GONE — the two new clicks start a fresh shape and nothing is created | Multi-click cancel. The first version failed exactly here while its test passed, because the test sent pointerdowns no mouse can produce |
| 10 | Draw a polygon and DOUBLE-click near the first vertex | Exactly ONE zone appears | The closing re-entrancy guard — two creates from one shape was the failure |
| 11 | Zoom out to ~20% and draw+close a small polygon | Closing still works at low zoom | The close tolerance is camera-scaled; a world-fixed one went sub-pixel and made closing impossible when zoomed out |
| 12 | Select a zone and delete it from the Inspector | The zone note AND its sidecar entry disappear; the panel reads "Nothing selected." | The delete transaction and the selection cleanup |
| 13 | Undo the delete | The zone returns with the same shape — open the note and check | Restore through the repository, same ID, publishing no creation event |
| 14 | Redo | The zone is deleted again | Redo replays against the restored identity |
| 15 | Toggle the plugin off and on | Every drawn zone is still there; the console shows no `Several Konva instances detected` | Persistence across unload, and the Konva global release |
| 16 | Open the plan in two tabs; undo in one | The other tab's canvas and Undo button are unaffected | Per-leaf runtime: history, selection and camera are per leaf, never shared |

## Deliberately NOT checked

- **A bowtie (self-intersecting) polygon is ACCEPTED.** §26 defers self-intersection
  detection; drawing one and seeing it stored, rendered and measured as-is is correct
  behaviour, not a defect to file.
- **Snapping.** `SnapService` is wired but this slice hands it no candidate geometry, so
  nothing visibly snaps yet — vertices land where the pointer lands.
- **Zone names/types.** Every drawn zone is "Room", named "Zone N" — scaffolding until
  slice 15's creation dialogs. Renaming is not wired.

## Runs

| Date | Result | Findings |
| --- | --- | --- |
