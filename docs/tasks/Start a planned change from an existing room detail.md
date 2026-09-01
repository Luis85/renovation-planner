---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Start a planned change from an existing room detail

## Evidence

M08's **Mark something for change** interaction must pre-link the planned draft to its existing
source; M09 accepts that handoff as an entry path.

## Why it matters

Without the source relationship, the user sees two descriptions but cannot tell which intended
outcome changes which current condition.

## Approach

Route the existing-detail action into the canonical planned-state creation entry point with the
room and source IDs. Do not copy the source record or geometry. Make the action unavailable when
planned-state capability is absent.

## Acceptance criteria

- The planned draft receives the selected room and existing-detail identities.
- Cancelling creates no planned record and changes no existing record.
- A successful result remains linked after reload.
- An absent planned-state capability is unavailable rather than reported as a failed write.

## Risks

The handoff may pass display labels or geometry snapshots instead of stable references.

## Outcome

A renovator can move from an observed condition to the intended-change workflow without losing
its origin.
