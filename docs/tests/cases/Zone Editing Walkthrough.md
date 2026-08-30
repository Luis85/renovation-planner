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
than inferred from a filename. Only the twenty `suite` and `browser` steps appear.

**One row per CLAUSE**, per `.claude/skills/auditing-manual-test-cases/SKILL.md`, and that is
not presentation: every over-report this audit made came from folding a step's clauses onto a
single assertion, and it made four of them while this table had one row per STEP. Cited by test
NAME rather than by line, so an edit that moves a case leaves the citation standing and one
that renames it breaks the citation visibly.

| # | Clause | Discharged by |
| --- | --- | --- |
| 1 | the accent outline appears | `zoneEditing` *draws the accent OUTLINE beside the handles, which a Circle count cannot see* |
| 1 | one handle circle per vertex | `zoneEditing` *drags one vertex handle…* — its first assertion, under a comment naming DoD 5 |
| 1 | the Inspector shows the area in m² | `zoneEditing` *drags one vertex handle…* — it waits on `wrapper.text()` containing `5.51 m²`, so the RENDERED figure |
| 1 | the Inspector shows the zone's NAME | `zoneEditing` *a FAILED delete surfaces through the notice seam and leaves the zone intact* — the only case asserting `wrapper.text()` contains `Kitchen`. `inspectorStore` covers the DTO behind both and would stay green with either `<dd>` deleted from `InspectorPanel.vue` |
| 2 | outline and handles vanish | `zoneEditing` *takes the outline and the handles down on deselection, not just the store entry* |
| 2 | the panel reads "Nothing selected." | `zoneEditing` *deletes from the Inspector; undo restores the exact entity; the panel follows both ways* — it asserts that string in `wrapper.text()`. `selectTool` *clicking empty canvas clears the selection* and `inspectorStore` *an empty selection produces …* cover the STATE behind it and would both stay green with the copy removed |
| 3 | a wiggle selects and dispatches nothing | `selectTool` *a near-zero pointerUp is a pure selection — no command, no history entry* |
| 3 | the epsilon is camera-scaled | `selectTool` *a click is camera-scaled: sub-pixel-per-millimetre jitter at high zoom stays a click* |
| 3 | the Undo button stays DISABLED | `runtime` *leaves Undo DISABLED until there is something to undo, which nothing asserted* — placed beside the file's other assertions on that control, and because `zoneEditing` was at its line cap. Every other assertion on that control in the suite is `disabled === false` |
| 4 | one command per drag | `selectTool` *a body drag dispatches exactly ONE gesture regardless of pointermove count* |
| 4 | the ghost follows the pointer | `selectTool` *the body preview FOLLOWS the pointer mid-drag, rather than merely existing* |
| 4 | the zone stays where dropped | the same drag case — it asserts the committed `forward.points` |
| 4 | Undo enables | `zoneEditing` *draws a zone through the toolbar and canvas…* — it asserts `undoButton.disabled === false` before pressing it |
| 4 | "smoothly" | **none.** A drag landing correctly and stuttering fails this and passes everything. A residue, not a gap |
| 5 | undo returns the exact prior position | `zoneEditing` *selects by click, moves by drag with exactly one command, and undo restores the exact points* |
| 6 | only that vertex moves | `selectTool` *dragging a vertex replaces exactly that index and keeps every other vertex* |
| 6 | the area changes with no reselect | `zoneEditing` *drags one vertex handle; the Inspector carries the post-drag area with no reselect (DoD 3)* |
| 7 | the vertex snaps back | `zoneEditing` *undoes a VERTEX edit to every original point, not just the one that moved* |
| 7 | every other vertex is where it was | `selectTool` *dragging a vertex…* — its LAST line asserts `gesture.inverse.points` against the whole pre-drag list |
| 8 | every click leaves a circle | `interactionLayer` *marks every placed vertex, and draws the first one as the close target* |
| 8 | the FIRST is drawn larger | `handleMetrics` *grows the start vertex on hover, and draws it larger than an ordinary vertex at rest* |
| 8 | the polygon closes into a selected zone | `drawPolygonTool` *three vertices plus a close click produce exactly ONE dispatched command and a selection* |
| 8 | a note AND a sidecar entry appear | the zone-repository contract's *save with 'absent' inserts at revision 1 and reads back* — `getById` reads note THEN sidecar, so a create writing one file cannot round-trip. Not the compensation cases: those assert what a FAILED write leaves behind |
| 8a | the first vertex grows near enough to close | `interactionLayer` *grows the close target while the pointer is close enough to CLOSE the shape* |
| 8a | and FILLS | **none** — a resolved theme colour, which is why the step is `browser` |
| 8b | the band snaps flat on the KEY, pointer still | `interactionLayer` *flattens the rubber band the moment Shift goes down, with the pointer still* |
| 8b | and lets go on release | `interactionLayer` *lets go again on release, just as promptly* |
| 8b | the click lands on the flat line | `drawPolygonTool` *previews exactly the point the next click places* |
| 8b | the status bar says `Shift constrains the angle`, and not under Select | `shell` *announces the angle constraint under the tools that take it, and no others* |
| 8b | the toolbar button hands focus back | **none** — Chromium focusing the nearest focusable ancestor, which is why the step is `browser` |
| 8c | the polygon still closes under Shift | `drawPolygonTool` *does not let the constraint decide whether the polygon CLOSES* |
| 8e | the name truncates with an ellipsis | **none** — a layout measurement, which is why the step is `browser` |
| 8e | the hint stays whole | **none** — same |
| 9 | the first buffer is gone | `zoneEditing` *Escape abandons a half-drawn polygon BETWEEN clicks — real click pairs, no zone created* |
| 9 | the next clicks start a fresh shape | `drawPolygonTool` *cancel discards the buffer without dispatching anything* |
| 10 | a double-click makes exactly ONE zone | `drawPolygonTool` *a close click while ANOTHER close is in flight is ignored — one shape, one command* |
| 11 | closing still works at ~20% zoom | `drawPolygonTool` *judges the close click in screen pixels through the current camera*; `closeTarget` *accepts a pointer inside the grab radius and refuses one outside it* |
| 12 | the zone note disappears | `consistency` *a SUCCESSFUL delete takes the geometry entry with the note, not just the note* — it captures the pre-delete path and reads the vault at it. The `zoneEditing` case runs on `InMemoryZoneRepository` and cannot see a Markdown file |
| 12 | the sidecar entry disappears | `consistency` *a SUCCESSFUL delete takes the geometry entry with the note, not just the note* |
| 12 | the panel reads "Nothing selected." | the same `zoneEditing` case |
| 13 | undo returns the zone with the same shape | the same `zoneEditing` case — it compares the restored points to the originals |
| 13 | the restore keeps the SAME id | `reversibleDeleteZone` *undo resurrects the EXACT entity — same id, same type, identical geometry (DoD 8)* |
| 13 | the restore publishes NO creation event | `reversibleDeleteZone` *undo publishes NOTHING — a restore is not a creation*. Nothing asserted it: the redo case clears `events.published` immediately after its own undo, discarding the evidence |
| 13 | the NOTE is back in the vault ("open the note and check") | **compositional, and no single case crosses the seam.** `ReversibleDeleteZone.undo` restores through `restoreZone` → `zones.save(snapshot, 'absent')`, and the zone-repository contract's *save with 'absent' inserts at revision 1 and reads back* covers that write; the `zoneEditing` case above proves the history reaches it, over `InMemoryZoneRepository`. A dedicated Obsidian-backed restore case was considered and not written: its mutation is a mutation of `save`, which reddens eight cases nobody wrote for it, so by the skill's own gate it would add nothing |
| 14 | redo deletes it again | `zoneEditing` *redoes a DELETE, which is the one command whose own undo put the entity back* |
| 17 | a click on a handle moves nothing | `selectTool` *a CLICK on a vertex handle moves nothing and adds no history entry* |
| 17 | and Undo does not enable | the same case — it asserts no history entry |
| 18 | the drag survives a right-click | `canvasPointerRouting` *a reflexive right-click mid-drag does not commit the move; the primary release still does* |
| 18 | the left release commits exactly one move | the same case; `selectTool` *a NON-PRIMARY release during a drag does not commit the move* |

### The seven gaps, how they were closed, and the one that was never a gap

None was visible from a test name — the suite looked complete until the bodies were read, which
is the argument for auditing by reading rather than by grep. **Two were missed by the first pass
of this very audit and found by a reviewer, and a fourth it reported turned out not to be a gap
at all** — which is the argument for not trusting an audit unreviewed either. That pass read the
body it was pointed at, found an assertion covering PART of a step, and wrote the step down as
discharged; at step 7 it made the opposite error, reading a test's NAME as its whole claim and
calling covered ground a gap.

All seven real ones are closed — three in `tests/presentation/editor/zoneEditing.test.ts`, one in `tests/presentation/editor/tools/selectTool.test.ts`, one in `tests/infrastructure/obsidian/repositories/consistency.test.ts`:

- **Step 1 — nothing asserted the selection OUTLINE.** The only interaction-layer assertion in
  the editor suite counted `Circle` nodes, which are the vertex handles; an outline that stopped
  being drawn left that count untouched. Closed by *draws the accent OUTLINE beside the handles,
  which a Circle count cannot see*, which asserts the node's COLOUR and stroke width as well as
  its geometry — a `Line` present in the Konva tree with a zero width or a non-accent stroke is
  a node the user cannot see, and the first version of this case would have passed against
  both.
- **Step 2 — nothing looked at the interaction layer after a DESELECTION.** Both cited cases
  assert state: the selection store empties, the panel reads "Nothing selected." Handles left
  behind on the canvas were invisible to both. Closed by *takes the outline and the handles down
  on deselection, not just the store entry*.
- **Step 4 — nothing asserted that the preview FOLLOWS the pointer.** The cited drag case
  checks `previewPolygon` is non-null mid-drag and then validates the committed polygon, so a
  ghost frozen at the original coordinates passed it: the zone would not move under the hand
  and the release would still commit correctly. Closed by *the body preview FOLLOWS the pointer
  mid-drag, rather than merely existing*, in `selectTool.test.ts` beside the case it narrows.
- **Step 12 — nothing asserted the sidecar entry goes on a SUCCESSFUL delete.** "The zone note
  AND its sidecar entry disappear" is two clauses, and the audit cited a COMPENSATION case for
  the second — which proves a FAILED sidecar removal restores the note, the opposite half of
  the pair. `getById` reads the note first, so a delete that removed the note and left the
  geometry entry read as a clean success from every note-side assertion in the suite. Closed by
  *a SUCCESSFUL delete takes the geometry entry with the note, not just the note*.
- **Step 14 — nothing redid a delete.** `commandHistory` proves redo moves a command between the
  stacks using fakes, and `zoneEditing` redid a CREATE. Closed by *redoes a DELETE, which is the
  one command whose own undo put the entity back*.

- **Step 7 was NOT a gap, and this entry is the correction.** The first pass claimed "a
  `SelectTool` that snapshotted the geometry AFTER the edit would pass every test in this
  repository and undo nothing". That was measured and is false: writing the mutation turns
  `selectTool`'s own vertex case red, because its last line — three lines below the name the
  audit read — asserts `gesture.inverse.points` against the whole pre-drag list. What was
  genuinely undriven is narrower: no case pressed Undo after a vertex edit and looked at the
  REPOSITORY, so the dispatch-to-vault link was untested even though the polygon handed to the
  dispatcher was not. *undoes a VERTEX edit to every original point* now drives it, and is a
  second net over a defect the unit case already catches rather than the only one.

- **Step 13 — nothing asserted the restore publishes no creation event.** `restore-zone.ts`
  saves and publishes nothing on purpose: a restore is not a creation, and anything subscribed
  to `ZoneCreated` would treat it as one. The redo case clears `events.published` right after
  its own `undo()`, discarding exactly that evidence. Closed by *undo publishes NOTHING — a
  restore is not a creation*, whose verification is a SENSITIVITY check rather than a source
  mutation, and the case says so: nothing in the undo path holds an event bus, so publishing
  from a restore requires wiring one — and that wiring is the change the case exists to catch.
- **Step 3's Undo-DISABLED clause** and **step 8b's status-hint clause** were omissions from
  this table rather than from the suite; the hint was already discharged by `shell`.

None of the seven was a defect: they were steps the suite was assumed to cover and did not.

**Every cited test's BODY has now been read against its row**, which is what the first pass
claimed to have done and had not. That re-read is where step 4 came from, and it is the last
of four corrections this audit needed: it OVER-reported coverage at steps 1, 2 and 4, calling
them discharged on an assertion covering part of a row, and UNDER-reported it at step 7,
calling covered ground a gap by taking a test's name as its whole claim. The corrections came from a reviewer in
every case but this one.

**Nine mutations were run for six of the seven gaps and the one correction, and several are the
evidence for the claims above rather than a ritual.** Removing the selection `VLine` from
`InteractionLayer.vue` reddens the two new overlay cases and leaves the other thirteen in this
file green, which is what "a `Circle` count is silent about the outline beside it" MEANS.
Leaving the overlay behind on deselection — the store still clearing correctly — reddens the new
case while all eighteen of `selectTool`'s and all eighteen of `inspectorStore`'s stay green:
fifty of fifty-one passing is the measurement that a state assertion cannot see a canvas. Making
a redo of a delete write nothing reddens exactly one case, the new one. Freezing the drag
preview at its origin — so the ghost exists and does not move — reddens the new preview case
alone, leaving the eighteen other `selectTool` cases and all fifteen here green, including the
one asserting the preview is non-null. And the vertex mutation
reddened two, which is how the step 7 correction above was found. And leaving the geometry
entry in the sidecar on a successful delete reddens one case out of the 422 in
`tests/infrastructure/obsidian/repositories/` — the sharpest of the five, since every other
assertion about that delete is note-side and a missing note already reads as absent. That case
carries a SIBLING zone for a reason a seventh mutation measured: reading the sidecar cannot
tell an absent file from an empty one, so a delete that wiped the whole plan's geometry —
every other zone with it — satisfied `not.toContain` perfectly until something else on the
plan had to survive. An eighth mutation, a delete that trashes nothing, reddens it too — and
would NOT have before the note assertion stopped asking the INDEX for a path the delete had
just removed, which answered `undefined` for a note still sitting in the vault. A ninth, an
Undo button with its condition dropped, reddens the new disabled case and nothing else — every
other assertion on that control in this suite is `disabled === false` and an always-live Undo
satisfies all of them.

### What the pilot cost, for the eight cases still to do

Twenty steps, and the useful measure is not the time but WHERE the coverage turned out to be.
Four of the twenty are discharged by a test in a file no reader of this case would open —
step 1's handle count sits inside the case named for step 6, and the both-files halves of
steps 8 and 12 are in `consistency.test.ts`, two directories away from the editor. A
name-matching pass would have marked step 1 a gap and taken steps 8 and 12 on trust. Budget
the audit for reading bodies, and expect roughly **five true gaps in twenty steps**. This line
has now carried five figures — one in ten, one in five, three in twenty, four in twenty, and
this — as the audit was corrected in both directions across six review rounds. It is a range,
not a rate.
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
