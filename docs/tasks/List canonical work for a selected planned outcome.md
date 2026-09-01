---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# List canonical work for a selected planned outcome

## Evidence

M10 requires a focused room list with bidirectional spatial markers. Existing authorities define
Task, Construction Section and Work Package as different canonical scopes.

## Why it matters

A room-local WorkItem list would duplicate project work and drift from the records used by task,
schedule and trade views.

## Approach

Query canonical Tasks, Construction Sections and Work Packages linked to the selected planned
outcome or spatial target. Present a focused Inspector list and numbered marker projection while
preserving each record's type and identity.

## Acceptance criteria

- Every row resolves to an existing canonical record and exposes its canonical type.
- Zero linked records is distinct from unavailable or unreadable work capability.
- Marker and row selection are bidirectional and keyboard-accessible.
- The query creates no generic WorkItem DTO that erases canonical identity.

## Risks

A common presentation shape may accidentally become a new domain abstraction or hide partial
read failures.

## Outcome

The selected outcome shows the real project work that can produce it, spatially and in a list.
