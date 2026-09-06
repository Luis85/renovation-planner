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

## Current finalization status — 2026-09-07

An explicit Inspector corner-coordinate form now reaches the existing reversible geometry command for Room and Area outlines. Two production component cases and seven parser/proposal cases pass, including native comma input, preview, focus retention across reflow, cancellation and Undo/Redo. Direct arrow-key vertex-handle gestures have not been added; the accessible numeric form provides the non-pointer editing route. Full integrated gates and live-host keyboard acceptance remain outstanding, so this issue is not marked complete.

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
