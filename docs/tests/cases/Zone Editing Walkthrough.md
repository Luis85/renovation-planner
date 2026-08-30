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

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim. **This case has been AUDITED**: *What
discharges each step*, below, names the test behind every `suite` and `browser` verdict
here, or says there is none.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `suite` | Select tool; click a zone | An accent outline appears with ONE handle circle per vertex; the Inspector shows the zone's name and area in m² | Selection pipeline and the Inspector query against real vault data |
| 2 | `suite` | Click empty canvas | Outline and handles vanish; the panel reads "Nothing selected." | The deselect path |
| 3 | `suite` | Press on a zone, wiggle the pointer a pixel or two, release | Selection only — the Undo button stays DISABLED | The click-vs-drag epsilon. It is camera-scaled; a world-fixed one made every jittery click a move command, polluting the undo stack |
| 4 | `suite` | Drag a zone's body and release | The zone follows smoothly and stays where dropped; Undo enables | One command per drag, however many pointermove events fired |
| 5 | `suite` | Press Undo | The zone returns to its exact prior position | The move's inverse snapshot |
| 6 | `suite` | Note the Inspector's area. Drag one vertex handle; release | Only that vertex moves, and the panel's area CHANGES without reselecting | Vertex editing, and the post-command Inspector refresh. The area is the point: a body MOVE preserves area, so only an edit that changes it can prove the panel was re-read rather than stale |
| 7 | `suite` | Press Undo | The vertex snaps back; every other vertex is where it was | The vertex inverse touching one index only |
| 8 | `suite` | Draw-zone tool; click 3–4 vertices; click near the FIRST one | Every click leaves a circle, the FIRST one drawn larger than the rest; the polygon closes into a zone, which is selected; a zone note AND a `Geometry/*.rpgeo` entry appear in the vault | The create transaction — both files, not one. The circles are what make the gesture learnable: it drew a dashed outline and no vertex at all for three slices, so nothing on screen said which point closes the shape |
| 8a | `browser` | While drawing, move the pointer over the first vertex and back away, WITHOUT clicking | The first vertex grows and fills while the pointer is near enough to close, and returns to its resting size when it is not | The hover reaction, and that it is armed by the same camera-converted distance the close click is judged by — the layer hears no pointer events of its own (SDD §62), so the tool is what decides this. jsdom resolves no theme colours, so the FILL half of it is checked nowhere but here |
| 8b | `browser` | Select Draw zone from the TOOLBAR; place one vertex, then HOLD Shift and move the pointer roughly — but not exactly — horizontally away from it | The rubber band snaps flat the instant Shift goes down, with no mouse movement, and lets go the instant it is released. A click while held places the vertex on the flat line, not under the pointer | The constraint, and that it bites on the KEY rather than on the next pointer move — the difference between a live modifier and one that looks broken. The status bar says `Shift constrains the angle` while a drawing tool is active and stops saying it under Select. Activating from the toolbar is the point of that first clause: the button takes focus, and the vertex click is what gives it back — Chromium focuses the nearest focusable ancestor of the target, and the Konva canvas is not itself focusable |
| 8c | `suite` | With three vertices down, hold Shift and point squarely at the FIRST vertex from an angle the constraint pulls away from | The polygon still closes | The close is judged on the raw pointer, never on the constrained point. Judging it on the constrained one closes a shape the user was not pointing at, and refuses one they were |
| 8d | `desktop` | With a vertex down and Shift HELD, switch to another application without covering the Obsidian window — leave Shift held as you go | The rubber band un-flattens the moment the canvas loses focus, before the key is released | The blur handler. `keyup` reaches a FOCUSED element only, so a Shift released in the other application delivers no event here at all: the band stayed flat for ever while the next click carried the real `shiftKey: false` and placed the vertex somewhere the band was not — preview and commit are the same call by design, and this is the one way they can disagree. Assuming nothing is held is deliberately one-sided; returning still HOLDING Shift shows an unconstrained band until the next real event. jsdom dispatches focus events but models no window manager, so only a desktop can take this one |
| 8e | `browser` | Drag the editor into a sidebar and narrow it to roughly 460px, with a drawing tool active and a plan whose name is long | The plan name truncates with an ELLIPSIS and the whole of `Shift constrains the angle` stays readable — neither is cut off mid-glyph | The Status region holds two items and a narrow leaf cannot fit both. `text-overflow` was declared on the region itself, which is `display: flex`, where it does nothing — ellipsis truncates a block container's own inline content, never a flex item inside one — so the name was hard-clipped AND, refusing to shrink, pushed the hint out through the region's `overflow: hidden` (measured at 460px: 8.4px of the hint gone). The name is the part that gives, because the hint is fixed text a narrower pane would elide into nonsense. No gate here can see it: jsdom lays nothing out, and `npm run harness-shot -- --width=460` draws only the short fixture name with no tool active |
| 9 | `suite` | Still drawing: place two vertices, press Escape, then click twice more | The first buffer is GONE — the two new clicks start a fresh shape and nothing is created | Multi-click cancel. The first version failed exactly here while its test passed, because the test sent pointerdowns no mouse can produce |
| 10 | `suite` | Draw a polygon and DOUBLE-click near the first vertex | Exactly ONE zone appears | The closing re-entrancy guard — two creates from one shape was the failure |
| 11 | `suite` | Zoom out to ~20% and draw+close a small polygon | Closing still works at low zoom | The close tolerance is camera-scaled; a world-fixed one went sub-pixel and made closing impossible when zoomed out |
| 12 | `suite` | Select a zone and delete it from the Inspector | The zone note AND its sidecar entry disappear; the panel reads "Nothing selected." | The delete transaction and the selection cleanup |
| 13 | `suite` | Undo the delete | The zone returns with the same shape — open the note and check | Restore through the repository, same ID, publishing no creation event |
| 14 | `suite` | Redo | The zone is deleted again | Redo replays against the restored identity |
| 15 | `obsidian` | Toggle the plugin off and on | Every drawn zone is still there; the console shows no `Several Konva instances detected` | Persistence across unload, and the Konva global release |
| 16 | `obsidian` | Open the plan in two tabs (split the leaf); move a zone in one | The OTHER tab's canvas shows the move too, while its Undo button stays disabled and its camera and selection do not move | The two halves that must both hold: zone events reach every leaf showing the plan, and history/selection/camera stay per leaf. Before the review pass the second tab drew the pre-edit zones indefinitely and hit-tested against zones that no longer existed |
| 17 | `suite` | Select a zone, then CLICK one of its vertex handles without dragging | Nothing moves and Undo does not enable | The click-vs-drag epsilon on the VERTEX gesture. It applied to body drags only, so a click within the handle teleported that vertex — up to 8 mm per percent of zoom, ~80 mm at the default camera — and pushed a real move onto the undo stack |
| 18 | `suite` | Start dragging a zone, and right-click mid-drag without releasing the left button | The drag continues; releasing the left button commits exactly one move | Button routing. The canvas forwarded every `pointerup` while filtering `pointerdown`, so the right-button release committed the move at the half-finished position and the real release did nothing |
| 19 | `desktop` | On a touch screen or trackpad, start a zone drag and swipe as if to scroll the pane | Either the drag continues or nothing moves at all — never a zone that jumps to a later, unrelated click | `touch-action: none` plus the `pointercancel` handler. A stolen gesture delivers no `pointerup`, and the abandoned gesture used to stay live |

## What discharges each step

The audit of this case's `suite` and `browser` verdicts — the pilot for the other eight, and
the thing the `Reachable by` column deliberately does NOT claim. A verdict says a step COULD
be a node test; this table says which test actually is one, read from the test body rather
than inferred from a filename. Only the twenty `suite` and `browser` steps appear: the two
`obsidian` and two `desktop` steps have nothing here to find.

Cited by test NAME rather than by line, so an edit that moves a case leaves the citation
standing and one that renames it breaks the citation visibly.

| # | Discharged by |
| --- | --- |
| 1 | **PARTIAL.** `zoneEditing` *drags one vertex handle…* counts one interaction-layer `Circle` per vertex, under a comment naming DoD 5, and `inspectorStore` *a single-id selection produces a zone DTO sourced from the query* covers the panel. **Nothing asserts the accent OUTLINE** — the Circle count would pass with it absent. See the gaps below |
| 2 | **PARTIAL.** `selectTool` *clicking empty canvas clears the selection* covers the store and `inspectorStore` *an empty selection produces …* the panel. **Nothing looks at the interaction layer AFTER a deselection**, so handles left behind would pass both. See the gaps below |
| 3 | `selectTool` *a near-zero pointerUp is a pure selection — no command, no history entry* and *a click is camera-scaled: sub-pixel-per-millimetre jitter at high zoom stays a click* |
| 4 | `selectTool` *a body drag dispatches exactly ONE gesture regardless of pointermove count* |
| 5 | `zoneEditing` *selects by click, moves by drag with exactly one command, and undo restores the exact points* |
| 6 | `zoneEditing` *drags one vertex handle; the Inspector carries the post-drag area with no reselect (DoD 3)* — the whole step, including the area changing without a reselect |
| 7 | `selectTool` *dragging a vertex replaces exactly that index and keeps every other vertex* — whose LAST line asserts `gesture.inverse.points`, so the inverse is covered at the dispatch boundary — plus `zoneEditing` *undoes a VERTEX edit to every original point*, which drives the same claim through the history and the repository |
| 8 | `drawPolygonTool` *three vertices plus a close click produce exactly ONE dispatched command and a selection*; `interactionLayer` *marks every placed vertex, and draws the first one as the close target*; `handleMetrics` *grows the start vertex on hover, and draws it larger than an ordinary vertex at rest*. The **both-files** half is `consistency` *a failed sidecar write after an INSERT deletes the created note — not "restores nothing"* |
| 8a | `interactionLayer` *grows the close target while the pointer is close enough to CLOSE the shape* covers the GROW. The FILL is a resolved theme colour and stays `browser` |
| 8b | `interactionLayer` *flattens the rubber band the moment Shift goes down, with the pointer still* and *lets go again on release, just as promptly*. The toolbar-focus clause — Chromium focusing the nearest focusable ancestor — stays `browser` |
| 8c | `drawPolygonTool` *does not let the constraint decide whether the polygon CLOSES* |
| 8e | Nothing, by construction: a 460px truncation is a layout measurement |
| 9 | `zoneEditing` *Escape abandons a half-drawn polygon BETWEEN clicks — real click pairs, no zone created*; `drawPolygonTool` *cancel discards the buffer without dispatching anything* |
| 10 | `drawPolygonTool` *a close click while ANOTHER close is in flight is ignored — one shape, one command* |
| 11 | `drawPolygonTool` *judges the close click in screen pixels through the current camera*; `closeTarget` *accepts a pointer inside the grab radius and refuses one outside it* |
| 12 | `zoneEditing` *deletes from the Inspector; undo restores the exact entity; the panel follows both ways*. The **sidecar** half is `consistency` *a failed sidecar removal after the note was deleted restores the note bytes* |
| 13 | The same `zoneEditing` case as 12 — it asserts the restored points equal the originals |
| 14 | **NOTHING redoes a delete.** See the gaps below |
| 17 | `selectTool` *a CLICK on a vertex handle moves nothing and adds no history entry* |
| 18 | `canvasPointerRouting` *a reflexive right-click mid-drag does not commit the move; the primary release still does*; `selectTool` *a NON-PRIMARY release during a drag does not commit the move* |

### The gaps, and the one that was not

None is visible from a test name — the suite looks complete until the bodies are read, which is
the argument for auditing by reading rather than by grep. **Two were missed by the first pass of this very audit and
found by a reviewer, and a fourth it reported turned out not to be a gap at all** — which is
the argument for not trusting an audit unreviewed either. That pass read the body it was
pointed at, found an assertion covering PART of a step, and wrote the step down as discharged;
at step 7 it made the opposite error, reading a test's NAME as its whole claim and calling
covered ground a gap.

- **Step 7 was NOT a gap, and this entry is the correction.** The first pass claimed "a
  `SelectTool` that snapshotted the geometry AFTER the edit would pass every test in this
  repository and undo nothing". That was measured and is false: writing the mutation turns
  `selectTool`'s own vertex case red, because its last line — three lines below the name the
  audit read — asserts `gesture.inverse.points` against the whole pre-drag list. What was
  genuinely undriven is narrower: no case pressed Undo after a vertex edit and looked at the
  REPOSITORY, so the dispatch-to-vault link was untested even though the polygon handed to the
  dispatcher was not. `zoneEditing` *undoes a VERTEX edit to every original point* now drives
  it, and it is a second net over a defect the unit case already catches rather than the only
  one.
- **Step 14 — no test redoes a delete.** `commandHistory` proves redo moves a command between
  the stacks, with fake commands; `zoneEditing` redoes a CREATE and asserts the id survives.
  A redo of `ReversibleDeleteZone` — which must delete an entity its own undo restored — is
  exercised nowhere.

Both are worth writing as node tests rather than left to the walkthrough, per this suite's own
rule that a manual case whose findings are not converted will find the same thing again next
release. Neither is a defect: they are steps the suite was assumed to cover and does not.

- **Step 1 — nothing asserts the selection OUTLINE.** The one interaction-layer assertion in
  the editor suite counts `Circle` nodes, which are the vertex handles. An accent outline that
  stopped being drawn would leave that count untouched and every test green.
- **Step 2 — nothing looks at the interaction layer after a DESELECTION.** Both cited cases
  assert state: the selection store empties and the panel reads "Nothing selected." Handles or
  an outline left behind on the canvas are invisible to both, which is the deselect half of the
  same hole.

Steps 1 and 2 stay `suite`: Konva nodes are countable in jsdom — `zoneEditing` already counts
them — so these are tests nobody has written rather than claims jsdom cannot reach.

**All four cases were watched failing against a mutation, and two of the four mutations are
the evidence for the claims above rather than a ritual.** Removing the selection `VLine` from
`InteractionLayer.vue` reddens the two new overlay cases and leaves the other thirteen in this
file green, which is what "a `Circle` count is silent about the outline beside it" MEANS.
Leaving the overlay behind on deselection — the store still clearing correctly — reddens the
new case while all eighteen of `selectTool`'s and all eighteen of `inspectorStore`'s stay
green: fifty of fifty-one passing is the measurement that a state assertion cannot see a
canvas. Making a redo of a delete write nothing reddens exactly one case, the new one. And the
vertex mutation reddened two, which is how the step 7 correction above was found.

### What the pilot cost, for the eight cases still to do

Twenty steps, and the useful measure is not the time but WHERE the coverage turned out to be.
Four of the twenty are discharged by a test in a file no reader of this case would open —
step 1's handle count sits inside the case named for step 6, and the both-files halves of
steps 8 and 12 are in `consistency.test.ts`, two directories away from the editor. A
name-matching pass would have marked step 1 a gap and taken steps 8 and 12 on trust. Budget
the audit for reading bodies, and expect roughly **three true gaps in twenty steps**. This
line has now carried three figures: one in ten from the pass that missed two, one in five once
a reviewer found them, and this one once writing the tests proved a fourth was never a gap.
Read the number as the range an audit lands in, not as a rate anybody has established.

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
