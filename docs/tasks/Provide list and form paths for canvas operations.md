---
type: Task
parent: "[[Operate the released editor without a pointer]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Provide list and form paths for canvas operations

## Evidence

The Plan editor epic and component library require every spatial action and entity outside the
canvas too.

## Why it matters

Keyboard shortcuts do not make pointer geometry accessible by themselves.

## Approach

Inventory released canvas operations and map each to an entity list, numeric form, or structured
creation flow that dispatches the same command. Add a traceability check for missing equivalents.

## Acceptance criteria

- Create, select, inspect, edit, move/resize by values, and delete have non-canvas paths.
- Equivalent paths reach the same command boundary.
- No popover, marker, or handle is the sole action source.

## Risks

A read-only list can be mistaken for an operational alternative.

## Outcome

Every released canvas operation has a complete list/form route.
