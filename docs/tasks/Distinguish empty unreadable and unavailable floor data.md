---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Distinguish empty unreadable and unavailable floor data

## Evidence

The vertical plan's [Inspector honesty rule](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) forbids fabricated counts and requires unavailable capability to differ from supported empty data.

## Why it matters

Zero, unreadable and unsupported lead to different user decisions and cannot share one blank state.

## Approach

Define selectors and presentation states for an empty readable floor, partial unreadable results, query failure and unsupported aggregates; expose each in the M01 shell.

## Acceptance criteria

- Empty, partial-unreadable, failed and unsupported fixtures render distinct states.
- Readable rooms remain usable beside partial warnings.
- No unsupported aggregate is displayed as zero.
- Light and dark checks include each state.

## Risks

Convenience defaults in DTO mapping can erase the distinction before presentation receives it.

## Outcome

The Standard Plan View never claims more certainty or capability than its data supports.
