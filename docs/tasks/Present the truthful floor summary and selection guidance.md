---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 40
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. Criterion 1 is
`tests/presentation/read-models/spatialRecords.test.ts`'s 'counts rooms and areas separately and
sums their area' beside `tests/presentation/editor/shell/floorInspector.test.ts`'s 'with nothing
selected shows the floor summary: counts available, unbuilt aggregates unavailable, never zero'.
Criterion 2's available/partial/unavailable arms are 'marks every count partial when some zones
were unreadable, carrying the number' and 'never fabricates a planned-change count or a cost'.
Criterion 3 is that a partial total is a total OVER WHAT WAS READ and says so, rather than being
rounded up to available. Criterion 4 is met by there being nothing to recompute: `estimatedCost`
is `unavailable` in this increment, because no floor-level cost query exists. Criteria 5 and 6 are
one case, `floorInspector.test.ts`'s 'announces guidance once when the selection clears, and not
on a refresh'. Criterion 7 is the room list rendering below the summary in the same component.

Criterion 2's STALE arm is answered by the additive warning strip rather than by an aggregate
state: `Aggregate<T>` has three members and none of them is stale.
