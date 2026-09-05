---
id: UJ-E14
title: "Find, inspect, and adjust an existing room"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md"
    section: "M00: selection and geometry interactions"
  - path: "../renovation-planner-editor-specs/screens/M01-standard-plan-view.md"
    section: "M01: non-canvas room selection"
  - path: "../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md"
    section: "§9, §20, §49–50 and §84 scenarios 1/3"
related_journeys:
  - UJ-E02
  - UJ-E11
  - UJ-E15
  - UJ-E16
---

# Find, inspect, and adjust an existing room

## Goal

Find a known room, understand its size, and correct its name or geometry without losing its identity.

## Actor and entry

A private renovator working in Obsidian. A populated editable floor is open and the user wants to inspect or correct a room such as Kitchen.

## Main flow

1. Select Kitchen on the canvas or through the room list; the same room is highlighted and shown in the inspector.
2. Read its name and available dimensions, then correct its name through the inspector.
3. Drag the selected object to move it, or a boundary/handle to preview a shape or size change with snapping.
4. Alternatively activate a displayed dimension, enter a precise value, and confirm with Enter.
5. Commit the drag on release and inspect the resulting geometry and calculated size.
6. Undo the adjustment as one meaningful action, or follow the room's Existing, Planned, Work, or evidence detail while retaining selection.

## Alternatives and recovery

- Escape cancels a temporary edit; from an idle selection it clears selection.
- Numeric and pointer editing follow the same reversible command semantics.
- Locked or stale geometry is not editable. Derived measurements are not independent manually stored facts.
- Mockup counts, costs, and progress are displayed only when the read model supports them.
- The first-room prototype task uses an approximate 4 × 5 metre kitchen and one exact correction; these are task fixtures, not defaults.

## Outcome

The selected room keeps its identity and context while the intended supported metadata or geometry adjustment is confirmed.

## Scope and evidence

This journey extracts source design intent, not verified implementation or passed usability testing. The [catalogue conventions](README.md#conventions-and-precedence) define precedence and shared constraints.

- [M00: selection and geometry interactions](<../renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md>)
- [M01: non-canvas room selection](<../renovation-planner-editor-specs/screens/M01-standard-plan-view.md>)
- [§9, §20, §49–50 and §84 scenarios 1/3](<../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md>)

## Related journeys

- [UJ-E02 — Create, undo, and restore a room](create-and-restore-room.md)
- [UJ-E11 — Recover a saved plan after refresh failure](recover-saved-stale-plan.md)
- [UJ-E15 — Navigate the floor and compare renovation views](navigate-and-compare-plan.md)
- [UJ-E16 — Delete a spatial entity with understood consequences](delete-spatial-entity.md)
