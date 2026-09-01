---
type: Task
parent: "[[Review renovation readiness spatially]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Return from a readiness finding to its renovation context

## Evidence

M17 requires each finding to open the relevant Decision, Work, Cost or Evidence detail in Renovate
and requires the previous selection and viewport to survive the round trip.

## Why it matters

A readiness warning that cannot take the renovator to the place where it can be corrected is a
report, not an actionable workflow.

## Approach

Route each derived finding through its canonical source identity into Renovate, preserving Review
selection and viewport as workspace state. Provide explicit missing-target and unavailable-source
outcomes with a route back.

## Acceptance criteria

- Every actionable finding opens exactly one canonical source in the correct room context.
- Returning to Review restores compatible selection and viewport.
- A missing source shows a stable current-state message and route back without redirect loops.
- An unavailable source capability is distinguished from a read failure.

## Risks

Navigation may preserve component-local state rather than workspace identity and lose context on
remount.

## Outcome

A renovator can move from a readiness explanation to the exact correction point and back without
losing spatial context.
