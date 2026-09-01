---
type: Task
parent: "[[Delete a selected wall safely]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify Wall deletion undo reload and alternate routes

## Evidence

M07 requires a non-canvas Wall route, and the interaction contract defines one history entry per
user intent. The prerequisite requires Wall and hosted-Opening relationships to survive reload.

## Why it matters

A deletion that looks correct on the canvas can still leave canonical records orphaned, require
several undos or behave differently from the accessible route.

## Approach

Exercise deletion from More, keyboard and the non-canvas Wall route against Walls with adjacent
Rooms, hosted Openings and references. Verify one undo/redo unit, persistence round trips, stale
impact refusal, editable-field protection and recovery from an injected partial-write failure.

## Acceptance criteria

- More, keyboard and non-canvas routes produce the same command input and result.
- One Undo restores the Wall, affected Rooms, hosted Openings and approved references; one Redo
  removes them again.
- Reload after delete, undo and redo reproduces the last committed state.
- No route can leave an orphaned Opening, invalid Room or dangling protected reference.
- Field-focused Delete and Backspace mutate no spatial state.

## Risks

A test can pass on an early refusal without reaching atomic deletion; assert the final canonical
records and history depth, not only the returned result.

## Outcome

Wall deletion is proven consistent, reversible and reloadable from every supported route.
