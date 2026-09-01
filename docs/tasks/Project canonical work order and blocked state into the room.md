---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Project canonical work order and blocked state into the room

## Evidence

M10 displays order, responsibility, dependencies and blocked work, but [[Dependencies]] is the
single authority for permitted pairs and types. Work Package progress is likewise derived from
canonical Tasks.

## Why it matters

Recomputing dependency or progress semantics inside the editor would make a room disagree with
the project schedule and task tooling.

## Approach

Read order, responsibility, status, progress and dependency results from their canonical queries
and render them in the focused work list and markers. Route edits to authority-owned commands and
surface their validation unchanged.

## Acceptance criteria

- A forbidden or cyclic dependency is refused by the canonical authority.
- Blocked and progress states match the same records in non-spatial views.
- Status is expressed with text or shape, not colour alone.
- Reordering or responsibility changes create no editor-private state.

## Risks

Marker order may be persisted as identity or a read model may duplicate dependency evaluation.

## Outcome

The room shows actionable work order and blockers without becoming a second scheduling model.
