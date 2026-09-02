---
type: Task
parent: "[[Lock completed spatial geometry against accidental editing]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Record the spatial lock state authority

## Evidence

The interaction contract requires locks for finished geometry and selected groups, while the
component contract assigns panel visibility to workspace state and persisted domain data to
commands. No accepted ADR currently decides which side owns spatial locks.

## Why it matters

Choosing storage inside a component or implementation task can create a second source of truth
and silently invent the wrong undo or reload promise.

## Approach

Compare editor/workspace state and canonical persisted state against cross-route enforcement,
history, reload, compatibility and group-lock needs. Record an accepted ADR with consequences and
a revisit trigger, then map its chosen authority into one lock read/write contract for Rooms,
Walls and completed groups.

## Acceptance criteria

- The ADR compares editor/workspace and canonical ownership rather than assuming either.
- It chooses one authoritative owner for Room, Wall and completed-group lock state.
- It explicitly defines lock and unlock history, reload and workspace-restoration semantics.
- It identifies the shared mutation boundary that enforces the decision.
- Components and canvas shapes retain no independent authoritative lock state.

## Risks

A placeholder boolean can escape into persisted data or local component state before the ADR is
accepted and become an accidental compatibility contract.

## Outcome

An accepted ADR defines one authority and one explicit history and persistence contract for every
spatial lock.
