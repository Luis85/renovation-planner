---
type: Task
parent: "[[Edit a selected room shape and dimensions]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Commit Room geometry edits through one reversible path

## Evidence

M00 requires direct manipulation and displayed-dimension edits to update dependent values through
one command path.

## Why it matters

Two commit paths can disagree about validation, history, recalculation or recovery.

## Approach

Translate the accepted draft into one Room geometry command regardless of its input route. Record
one inverse, refresh dependent quantities after success, and exercise write, compensation and read-back failures.

## Acceptance criteria

- Every valid edit dispatches the same command shape once.
- One edit creates one undo entry and one recalculation cascade.
- Undo/redo and reload preserve Room identity and the expected geometry.
- Failed writes never present partial geometry as saved.

## Risks

An editor adapter may bypass the shared history or guarded service door.

## Outcome

Each completed Room edit is one durable, reversible user action.
