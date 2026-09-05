---
id: UJ-E15
title: "Navigate the floor and compare renovation views"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M01-standard-plan-view.md"
    section: "M01: navigation, layers, fit and reference lock"
  - path: "../renovation-planner-editor-specs/screens/M16-constrained-workspace.md"
    section: "M16: responsive panel access"
  - path: "../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md"
    section: "§28–32 and §54–59: perspectives, visibility and floors"
  - path: "../renovation-planner-editor-specs/Renovation Planner — Editor UX Research & Pattern Study.md"
    section: "§28 flow 6: spatial renovation review"
related_journeys:
  - UJ-E10
  - UJ-E14
---

# Navigate the floor and compare renovation views

## Goal

Orient within the property and inspect the relevant renovation information without accidentally changing it.

## Actor and entry

A private renovator working in Obsidian. The user opens a populated floor or returns to the editor's safe Select state.

## Main flow

1. Read the current project/floor context and fit the floor; pan or zoom to the area of interest.
2. Select another floor through property navigation when needed. Retain useful viewport state per floor where practical, and clear a selection that does not belong there.
3. Choose Plan for geometry inspection or Renovate for Existing, Work, and Planned context.
4. Show or hide relevant layers, such as demolition and planned geometry, and inspect work or cost information for a room.
5. Keep reference/finished geometry locked while inspecting; unlocking the reference requires the specified explicit confirmation.
6. When the desktop leaf narrows, open the Property/Layers or Inspector panel as needed, or use Focus this tab below the supported editor width.

## Alternatives and recovery

- Layer visibility changes projection only; it neither deletes nor transfers ownership of records.
- Changing perspective preserves the selected entity and viewport where valid; changing floors has its own selection boundary.
- Room/entity lists provide keyboard access; hover is never the only source of information.
- Cross-floor reference overlays are explicitly deferred from V1.
- Constrained desktop layout is not the historical mobile-capture proposal; current project scope permits mobile reading only.

## Outcome

The user understands the chosen floor and renovation aspect with safe selection and unchanged domain data during navigation.

## Scope and evidence

This journey extracts source design intent, not verified implementation or passed usability testing. The [catalogue conventions](README.md#conventions-and-precedence) define precedence and shared constraints.

- [M01: navigation, layers, fit and reference lock](<../renovation-planner-editor-specs/screens/M01-standard-plan-view.md>)
- [M16: responsive panel access](<../renovation-planner-editor-specs/screens/M16-constrained-workspace.md>)
- [§28–32 and §54–59: perspectives, visibility and floors](<../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md>)
- [§28 flow 6: spatial renovation review](<../renovation-planner-editor-specs/Renovation Planner — Editor UX Research & Pattern Study.md>)

## Related journeys

- [UJ-E10 — Review renovation readiness and address issues](review-renovation-readiness.md)
- [UJ-E14 — Find, inspect, and adjust an existing room](inspect-and-edit-room.md)
