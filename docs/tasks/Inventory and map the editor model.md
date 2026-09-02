---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Inventory and map the editor model

## Evidence

The [vertical-slice plan's WP0 inventory](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) identifies current entities, commands, queries, editor DTOs and storage concepts whose names do not match M00–M17.

## Why it matters

Without one inspected baseline, Room/Zone and Floor/Plan changes can duplicate or silently reinterpret existing contracts.

## Approach

Record the baseline commit; inventory editor-relevant model, application, persistence and presentation contracts; map homeowner term → read model → domain → persisted term; classify each as retain, adapt, extend, rename later, migrate or reject.

## Acceptance criteria

- The inventory covers every category required by WP0 and names evidence locations.
- Room/Zone, Floor/Plan, Existing/Planned/Work and unsupported Inspector states appear explicitly.
- Gaps and conflicts are ranked with affected use cases and vault data.

## Risks

A list can miss indirect event, migration or fixture contracts; review it against the complete first-slice journey.

## Outcome

One reviewed matrix describes the current editor model and every locked concept Feature A needs.
