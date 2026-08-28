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
status: Approved
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
| 8 | Draw-zone tool; click 3–4 vertices; click near the FIRST one | Every click leaves a circle, the FIRST one drawn larger than the rest; the polygon closes into a zone, which is selected; a zone note AND a `Geometry/*.rpgeo` entry appear in the vault | The create transaction — both files, not one. The circles are what make the gesture learnable: it drew a dashed outline and no vertex at all for three slices, so nothing on screen said which point closes the shape |
| 8b | Draw-zone tool; place one vertex, then HOLD Shift and move the pointer roughly — but not exactly — horizontally away from it | The rubber band snaps flat the instant Shift goes down, with no mouse movement, and lets go the instant it is released. A click while held places the vertex on the flat line, not under the pointer | The constraint, and that it bites on the KEY rather than on the next pointer move — the difference between a live modifier and one that looks broken. The status bar says `Shift constrains the angle` while a drawing tool is active and stops saying it under Select |
| 8d | Select Draw zone from the TOOLBAR, then place a vertex and hold Shift without clicking anything else | The band flattens on the keypress | That the canvas has keyboard focus by the time a constraint is wanted. Clicking the stage focuses the `tabindex="0"` wrapper — Chromium focuses the nearest focusable ancestor of the target — so the press reaches it even though the tool was chosen from a toolbar button. jsdom models no focus-on-mousedown, so the suite dispatches at the element directly and cannot see this; a browser measurement is the only instrument |
| 8c | With three vertices down, hold Shift and point squarely at the FIRST vertex from an angle the constraint pulls away from | The polygon still closes | The close is judged on the raw pointer, never on the constrained point. Judging it on the constrained one closes a shape the user was not pointing at, and refuses one they were |
| 8a | While drawing, move the pointer over the first vertex and back away, WITHOUT clicking | The first vertex grows and fills while the pointer is near enough to close, and returns to its resting size when it is not | The hover reaction, and that it is armed by the same camera-converted distance the close click is judged by — the layer hears no pointer events of its own (SDD §62), so the tool is what decides this. jsdom resolves no theme colours, so the FILL half of it is checked nowhere but here |
| 9 | Still drawing: place two vertices, press Escape, then click twice more | The first buffer is GONE — the two new clicks start a fresh shape and nothing is created | Multi-click cancel. The first version failed exactly here while its test passed, because the test sent pointerdowns no mouse can produce |
| 10 | Draw a polygon and DOUBLE-click near the first vertex | Exactly ONE zone appears | The closing re-entrancy guard — two creates from one shape was the failure |
| 11 | Zoom out to ~20% and draw+close a small polygon | Closing still works at low zoom | The close tolerance is camera-scaled; a world-fixed one went sub-pixel and made closing impossible when zoomed out |
| 12 | Select a zone and delete it from the Inspector | The zone note AND its sidecar entry disappear; the panel reads "Nothing selected." | The delete transaction and the selection cleanup |
| 13 | Undo the delete | The zone returns with the same shape — open the note and check | Restore through the repository, same ID, publishing no creation event |
| 14 | Redo | The zone is deleted again | Redo replays against the restored identity |
| 15 | Toggle the plugin off and on | Every drawn zone is still there; the console shows no `Several Konva instances detected` | Persistence across unload, and the Konva global release |
| 16 | Open the plan in two tabs (split the leaf); move a zone in one | The OTHER tab's canvas shows the move too, while its Undo button stays disabled and its camera and selection do not move | The two halves that must both hold: zone events reach every leaf showing the plan, and history/selection/camera stay per leaf. Before the review pass the second tab drew the pre-edit zones indefinitely and hit-tested against zones that no longer existed |
| 17 | Select a zone, then CLICK one of its vertex handles without dragging | Nothing moves and Undo does not enable | The click-vs-drag epsilon on the VERTEX gesture. It applied to body drags only, so a click within the handle teleported that vertex — up to 8 mm per percent of zoom, ~80 mm at the default camera — and pushed a real move onto the undo stack |
| 18 | Start dragging a zone, and right-click mid-drag without releasing the left button | The drag continues; releasing the left button commits exactly one move | Button routing. The canvas forwarded every `pointerup` while filtering `pointerdown`, so the right-button release committed the move at the half-finished position and the real release did nothing |
| 19 | On a touch screen or trackpad, start a zone drag and swipe as if to scroll the pane | Either the drag continues or nothing moves at all — never a zone that jumps to a later, unrelated click | `touch-action: none` plus the `pointercancel` handler. A stolen gesture delivers no `pointerup`, and the abandoned gesture used to stay live |

## Deliberately NOT checked

- **A bowtie (self-intersecting) polygon is ACCEPTED.** §26 defers self-intersection
  detection; drawing one and seeing it stored, rendered and measured as-is is correct
  behaviour, not a defect to file.
- **Snapping.** `SnapService` is wired but this slice hands it no candidate geometry, so
  nothing visibly snaps yet — vertices land where the pointer lands.
- **Zone names/types.** Every drawn zone is "Room", named "Zone N" — scaffolding until the
  creation forms arrive. Those are slice 16's ALONE. Slice 15 built the dialog FRAMEWORK they
  will be mounted in and no form of its own beyond the calibration prompt
  ([[Calibrate a Plan]]). Renaming is not wired.

  **This line has now named the wrong next owner twice**, and the second time is worth more
  than the correction: it said "until slice 15's creation dialogs", was fixed to credit slice
  14's "empty-state actions", and slice 14 then shipped **no create action at all** — two of
  its three empty states render no button and the third activates a tool
  ([[Empty States Walkthrough]] steps 2, 5 and 10). Read "slice 16" as a name, not a caller.
  The same sentence lives in `src/plugin/composition-root.ts`, which was corrected for the
  same reason.

## Runs

| Date | Result | Findings |
| --- | --- | --- |
