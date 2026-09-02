---
type: Task
parent: "[[Inspect a selected room]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Render the selected room Inspector overview

## Evidence

[M00](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md) locks room identity, context, truthful overview values and future navigation in one contextual Inspector.

## Why it matters

The selected outline becomes useful only when it leads to understandable room information without leaving the plan.

## Approach

Render Room name/type, floor context, derived area and supported summaries; represent unavailable future sections explicitly and bind every action to the selected stable ID.

## Acceptance criteria

- Heading, overlay and Inspector share one ID.
- Available values use homeowner language.
- Unsupported sections never show invented counts or statuses.
- Empty supported sections have their own empty state.
- Clearing selection restores the floor overview.

## Risks

Locked mockup examples can be mistaken for production fixture values.

## Outcome

A selected room has a useful, honest overview in spatial context.
