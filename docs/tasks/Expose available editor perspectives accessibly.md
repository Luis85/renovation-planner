---
type: Task
parent: "[[Switch editor perspectives without losing context]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Expose available editor perspectives accessibly

## Evidence

The shared `PerspectiveSwitch` specification requires Plan, Renovate and Review availability,
arrow-key navigation and an explicit active state.

## Why it matters

A visual-only switch or an unavailable perspective presented as empty hides both location and
capability from keyboard and assistive-technology users.

## Approach

Project capability-aware choices into one tablist or radiogroup control with a programmatic
active state, keyboard movement and an explanation for unavailable choices.

## Acceptance criteria

- Plan, Renovate and Review availability comes from their required capabilities.
- Active and unavailable states are exposed programmatically and visually.
- Every available perspective can be reached and activated by keyboard.
- Unavailable is distinct from empty and failed content.

## Risks

Disabled controls may become undiscoverable or availability may be inferred from query results.

## Outcome

The renovator can identify and choose every usable perspective through one accessible control.
