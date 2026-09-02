---
type: Task
parent: "[[Selection]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Return selection to the safe floor state

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) is the no-selection home state; M00 defines empty-canvas and idle Escape as routes back to it.

## Why it matters

Clearing selection must not leave a stale Inspector or accidentally cancel a nearer temporary interaction.

## Approach

Define escape precedence and empty-canvas behavior, retire invalid selections on data changes, and restore the floor summary with meaningful focus.

## Acceptance criteria

- Idle Escape and empty-canvas intent clear one selection.
- A menu, dialog or temporary task handles Escape before selection.
- Clearing selection restores the floor Inspector.
- A deleted/unreadable selected ID is not rebound by name.
- Viewport remains unchanged.

## Risks

Global key handling can swallow Escape intended for a focused field or dialog.

## Outcome

Selection always has a predictable, non-destructive route back to the floor overview.
