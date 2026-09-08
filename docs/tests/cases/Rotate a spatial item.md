---
type: Test case
sources:
  - M02-add-menu
  - ADR-0023
  - ADR-0020
status: Ready
---

# Rotate a spatial item

The expanded user contract covers Room, Area, Object, Path, Fence, Measurement and wall.
Repeat the free-item cases for each type. A selected hosted opening offers Rotate host wall;
it never detaches or rotates independently. Wall turns retain their impact-review/Apply step,
move connected junction endpoints, preserve hosted opening facts and keep Room outlines
independent. Add cases for invalid intersections, opening containment and a cancelled impact.
The rows below retain the original Object checkpoint as a representative fixture, not a scope limit.

Use the final integrated plugin in the isolated test vault named in
[release native acceptance](../../user-experience/renovation-planner-editor-specs/implementation/release-native-acceptance.md).
Record source and bundle hashes before starting. Browser automation is supplemental:
`node scripts/editor-object-rotation-check.mjs`; it does not establish physical-device or
screen-reader acceptance.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + browser + obsidian | In Plan, create one named Object, select it from the floor list and open Rotate by | Same stable Object identity; degree input receives focus; visible pointer handle and numeric/quarter-turn alternatives |
| suite + browser + obsidian | Enter `27,25`, then cancel with Escape; reopen and enter `27.25`, Apply | First preview writes nothing; second saves one rigid turn about the frozen centroid; name, links and separate Planned geometry unchanged |
| suite + browser + obsidian | Apply positive and negative quarter-turn actions, then Undo/Redo | Clockwise/counterclockwise directions agree with labels; exact prior/committed point sequences restored; selection retained |
| suite + browser + obsidian | Enter invalid text, zero and a full turn | Invalid text is explained; no write or history for invalid/no-op turns; Cancel remains usable |
| suite + browser + obsidian | Pan/zoom, drag the visible handle with Shift held from pointer-down; finish at a different final position | Handle paint and hit agree; visible angle snaps to 15°; all points derive from baseline, final release is sampled, one history entry |
| suite + browser + obsidian | Escape or switch tools during a gesture; attempt a second gesture while a save is pending | Cancelled preview disappears without writing; saving does not advertise an unavailable rotation handle or permit a duplicate write |
| suite | Hold the baseline read, switch away and back or dispose the leaf, then resolve it | Retired operation cannot write or open a dialog; an ordinary current-context operation still commits |
| suite + obsidian | Change the same saved Object from a peer source while an edit is pending | Captured version refuses overwrite; peer geometry remains intact; draft/conflict state is truthful |
| suite + browser + obsidian | Save, close/reopen the editor and reconstruct from persisted files | Object ID/name/points, relationships and current/intended independence survive; opening a new leaf does not restore the old leaf's undo stack |
| suite | Confirm a write then fail readback and retry reads | Write remains successful; retry never repeats it; exact Undo/Redo becomes usable after recovery |
| browser + obsidian | Repeat numeric/quarter-turn routes in light/dark/custom accent and German constrained layout, including a draft during reflow | Controls and labels remain readable and reachable; draft/focus stay with the root dialog; no horizontal overflow |
| desktop | Use a named physical pointing device and a named screen reader/version | Handle feedback, validation, saved/stale announcements and focus restoration are understandable; record actual observed device/reader behavior |

## Runs

Actual source revisions, browser/native outcomes and unperformed observations are recorded in
[the release ledger](../../user-experience/renovation-planner-editor-specs/implementation/release-2026-09-08.md).
This procedure itself does not claim a pass.
