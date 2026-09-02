---
type: Task
parent: "[[Manage materials from spatial context]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Show authoritative material needs for a selected space

## Evidence

M12 requires room materials grouped by related work, while the editor mental model makes the
Inspector selection-driven and the implementation plan assigns calculation to domain/application
services rather than presentation.

## Why it matters

A material list is useful only if selecting a room reliably answers what that room needs without
creating a second requirement store in the editor.

## Approach

Add the selected spatial id to an application query that returns authoritative requirement rows,
their work grouping and quantity state. Render that read model in the Materials Inspector and
refresh it when selection or an authoritative material event changes.

## Acceptance criteria

1. Selecting each of two spaces produces only the requirements linked to that space.
2. Rows are grouped by related work and expose manual, overridden, calculated and stale states.
3. A failed query shows a failure rather than a legitimate empty list.
4. The presentation layer contains no quantity calculation or duplicated requirement state.

## Risks

- A stale response could replace a newer selection's rows.
- Treating unreadable requirements as absent would understate need.

## Outcome

The Materials Inspector is an authoritative, selection-scoped view of material needs.
