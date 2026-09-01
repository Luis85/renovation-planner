---
type: Task
parent: "[[Selection]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Resolve overlapping selection targets deterministically

## Evidence

The [implementation plan Phase 2](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md) locks priority as handle → object → opening → wall → room → background and requires overlap cycling.

## Why it matters

Overlapping geometry otherwise makes the same click select different records as render order changes.

## Approach

Centralize hit candidates and priority, make hover use the same resolution as selection, and provide an alternate/cycling route for ambiguous locations.

## Acceptance criteria

- Identical candidate sets resolve identically regardless of layer iteration order.
- Hover predicts the record a click selects.
- Alternate selection can reach lower-priority candidates.
- Priority cases are tested with overlapping fixtures.

## Risks

Future entity types can bypass the rule if hit testing is distributed among shapes.

## Outcome

Users can predict and recover which overlapping part will be selected.
