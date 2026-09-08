---
type: Task
parent: "[[Select several parts of a plan]]"
order: 20
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Show only truthful shared multi-selection values

## Evidence

[M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) forbids showing a mixed value as shared and requires valid aggregate area or length.

## Why it matters

Editing one member's value as though every selected member shared it causes unintended batch changes.

## Approach

Compute shared-property intersections, explicit mixed states, compatible aggregates and per-action compatibility from the selected ID set.

## Acceptance criteria

- Equal, mixed, unavailable and failed values remain distinct.
- Aggregates include exactly the compatible selected records.
- Unsupported combinations explain why an action is unavailable.
- Canvas badges and Inspector members correspond one-to-one.

## Risks

Ignoring unreadable members can make a partial aggregate look complete.

## Outcome

The multi-selection Inspector states only what is true of the whole selected set.


## Implementation update — 2026-09-05

M11 now displays the sum of individual selected areas and shared or mixed room/area types. Canvas badges and ordered rows agree. multiSelectionInspector.test.ts covers the current types. Failed/unavailable domain aggregates and per-batch-action compatibility remain open; this task is not complete.
