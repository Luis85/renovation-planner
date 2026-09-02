---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Present the truthful floor summary and selection guidance

## Evidence

M01 requires the no-selection Inspector to show floor name, room count, total area, planned
changes, estimated cost and a room list, and requires the empty-selection hint to be announced.

## Why it matters

The safe home state must orient the renovator without treating unsupported or stale aggregates
as current zero values, and clearing a selection must be perceivable without sight.

## Approach

Build a floor-summary projection with independent availability and freshness for room count,
total area, planned-change count and estimated cost. Render it above the existing room list and
announce concise selection guidance only when the editor enters the no-selection state.

## Acceptance criteria

- No selection shows the floor name, room count, total area, planned changes and estimated cost
  when each value is available.
- Supported zero, unavailable, unreadable and stale are distinct for every aggregate.
- A partial or stale aggregate cannot make other current values disappear.
- The estimated cost is formatted from the project/cost authority and is never independently
  recomputed by the Inspector.
- Clearing selection announces concise guidance to select a room or other available entity.
- Continuous pointer movement and ordinary summary refreshes do not repeat the guidance.
- The room list remains keyboard reachable below the summary.

## Risks

Aggregating only readable records can produce a precise-looking partial total unless completeness
and freshness travel with the value.

## Outcome

The Standard Plan View gives every user a useful, accessible and honest floor-level home state.
