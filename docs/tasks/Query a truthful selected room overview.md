---
type: Task
parent: "[[Inspect a selected room]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Query a truthful selected room overview

## Evidence

The [vertical plan's RoomOverviewDto proposal](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) combines current room/floor data with explicit unavailable sections.

## Why it matters

The Inspector cannot distinguish empty, unsupported and failed if the query erases those states.

## Approach

Build the selected-room read path from stable Room/Zone ID, geometry-derived values, floor context, supported linked summaries and capability metadata.

## Acceptance criteria

- The DTO preserves selected ID and floor ID.
- Area derives from current geometry.
- Unsupported, empty and failed results remain distinct.
- Unreadable dependencies propagate a coded result rather than zero values.

## Risks

Aggregating convenience counts can turn partial data into apparent completeness.

## Outcome

The Inspector receives one honest projection of the selected room.
