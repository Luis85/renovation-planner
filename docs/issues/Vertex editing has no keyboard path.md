---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 70
status: In Progress
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# Vertex editing has no keyboard path

## Amendment — 2026-09-20: BP-04 supersedes the 2026-09-13 rejection, for the NON-DRAG route only

**Appended, not edited.** Every section below stands as written and the front-matter `status`
stays `In Progress`. This section records that the code has taken a decision this note records as
REJECTED, so the contradiction is resolvable from this side too — the shape ADR-0015 already set
for the same failure, and the reason CLAUDE.md gives for it: *a contradiction findable from only
one side is one the next reader resolves the wrong way.*

**What BP-04 is.** [`docs/releases/first-beta-readiness/01-improvement-plan.md`](../releases/first-beta-readiness/01-improvement-plan.md)'s
**BP-04 — Provide precise non-drag editing of existing Room and Area corners**. Its interaction
contract, in its own words: *select one Room/Area → choose **Edit corners** → choose a numbered
corner → enter its position → preview → Apply or Cancel*. The execution tracker is
[`03-execution-tracker.md`](../releases/first-beta-readiness/03-execution-tracker.md), which
carries BP-04's row, its rulings and its limitations.

**What has landed**, in three slices on the `renovation-planner-beta-handoff-e80bb5` branch:

| Slice | Commits | What it shipped |
| --- | --- | --- |
| A | `6546f402c`, `152a3c18c` | `createZoneOutlineAction` — the whole-outline numeric editor over the existing reversible geometry command, for every `ZoneType`. Reachable from a test only |
| A2 | `8bfd6dd6a`, `b6b6a1f27`, `e2d524a9b` | The numbered chosen-corner list (`CornerChooser.vue`) and the chosen corner's mark on the canvas |
| B | `1f2cf7cf8` | The reach: an `edit-outline` context-menu entry and `ZoneOutlineAction.vue` in the Inspector, both calling the one `runtime.zoneOutline.editZoneOutline` |

**This supersedes the 2026-09-13 rejection for the non-drag route specifically** (controller
ruling R-S12-5). The *Current increment decision* section scopes itself to *"this increment"*
twice, and BP-04 is a later one that approves a concrete interaction in its own words — which is
the condition that section names. What it approves is a non-drag route: a dialog with a numbered
corner list, per-corner position fields, a preview and Apply/Cancel, reached from a context-menu
entry and an Inspector button, both labelled **Edit corners** / **Eckpunkte bearbeiten**.

**The note stays open, and its title is why.** The *other* condition that section names —
*verified with keyboard/native users* — has NOT been performed. Nothing on this branch has been
run in an Obsidian vault. The automated accessibility scans in this repository run in jsdom,
which has no rendering engine, so they verify neither a visible focus indicator, nor contrast,
nor hit-target size, and no screen reader has been near this route. The dialog's controls are
ordinary form controls and are therefore expected to be keyboard-operable, but *expected* is not
*verified*, and the release consequence recorded on 2026-09-13 — that WCAG conformance for this
operation may not be claimed — is unchanged by BP-04.

Two things BP-04 does not deliver, so that nothing here is read wider than it is:

- **A vertex-scoped keyboard GESTURE.** *What closes it* below asks for a keyboard entry into
  `select-tool.ts`'s own snap → validate → dispatch funnel. BP-04 dispatches the same reversible
  command through a dialog instead; the funnel and its keyboard sibling to `keyboardNudge.test.ts`
  are untouched.
- **A route at a sidebar's width that shows what it is doing.** Limitation **L-27** in the
  execution tracker: at 460 px the dialog covers the canvas, so the chosen corner's mark cannot
  be seen while the dialog that chooses it is open.

The manual case written for this route is [[Edit a zone corner by typing its position]]. It has
**not** been run.

## Current increment decision — 2026-09-13

I18 is explicitly deferred. I00 found no approved, understandable keyboard or non-drag interaction for choosing and moving one arbitrary Room/Area vertex, and the editor-usability increment forbids treating the rejected coordinate form as the answer. Whole-selection arrow nudging remains available in Plan, and pointer vertex dragging remains available in Plan; neither is a vertex-scoped non-drag route.

The unsupported task is: select one arbitrary corner of a Room or Area, change only that corner without dragging, review the same geometry impact, and commit through the existing reversible geometry command. No production control, selector, shortcut or schema is introduced until a concrete interaction is approved and verified with keyboard/native users.

Release consequence: the increment cannot claim the applicable non-drag/keyboard corner-editing criterion, WCAG conformance for that operation, or completion of this issue. I15/I17 must carry this limitation into accessibility and user-validation reports; I16 must not relabel automated pointer coverage as human or assistive-technology evidence.

## Historical finalization status — 2026-09-07

An explicit Inspector corner-coordinate form reached the existing reversible geometry command for Room and Area outlines. That route was subsequently rejected as the interaction for this increment and must not be cited as closing the non-drag gap. Direct arrow-key vertex-handle gestures were not added, and full live-host keyboard acceptance was never established.

## Original finding

The 2026-09-05 polish pass shipped arrow-key MOVE of a whole selected room —
`EditorSurface.vue`'s arrow branch calls `props.nudgeSelection`, wired in `runtime.ts` to
`createNudgeSelectionAction`, closing SDD §85's "one operation slice 5 left unreachable by
keyboard" (E8, Task 14). That closed half of E8; the other half is untouched. Dragging a single
vertex of a room's polygon is still pointer-only: `select-tool.ts`'s vertex-drag path
(`kind: 'vertex'`, around line 89's "Dragging a vertex replaces exactly that index in the point
list") has no keyboard equivalent, and `EditorSurface.vue`'s keyboard handling has no
vertex-scoped branch at all — only the whole-selection nudge.

## What is true today

A user who selects a room can move the whole shape with arrow keys but cannot reshape it (move
one corner) without a pointer. Nothing in `src/presentation/editor/tools/select-tool.ts` or
`EditorSurface.vue`'s keyboard handlers reaches the vertex-drag funnel described at
`select-tool.ts`'s own "snap → validate → dispatch" comment.

## What closes it

A keyboard vertex gesture needs its own entry into that same snap → validate → dispatch
funnel — most naturally gated on a vertex handle being the current selection kind (the
`kind: 'vertex'` target type `select-tool.ts` already carries) rather than a whole zone. It
needs its own test alongside `keyboardNudge.test.ts`, since that file only exercises the
whole-room case.

## References

- [[Plan editor and canvas]]
- `src/presentation/editor/tools/select-tool.ts` — the vertex-drag funnel a keyboard gesture
  would have to enter.
- `tests/presentation/editor/keyboardNudge.test.ts` — the existing whole-room case; the sibling
  a vertex gesture would need.
