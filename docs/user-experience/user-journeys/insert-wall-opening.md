---
id: UJ-E13
title: "Insert and position a door or window"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md"
    section: "§24: doors and windows; §10: tool lifecycle"
  - path: "../renovation-planner-editor-specs/screens/M02-add-menu.md"
    section: "M02: Structure creation entries and temporary tools"
  - path: "../renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md"
    section: "§3.2: openings deferred from the first slice"
related_journeys:
  - UJ-E03
  - UJ-E05
---

# Insert and position a door or window

## Goal

Describe a door or window as an opening in a wall and place it where it belongs.

## Actor and entry

A private renovator is working in an editable floor containing a wall and wants to add a door or window.

## Main flow

1. Choose Door or Window from the Add menu's Structure group.
2. Hover the intended wall and inspect the opening preview.
3. Click to insert the opening into that wall. After successful creation, return to Select unless repeated creation was explicitly enabled.
4. Drag the opening along the wall to reposition it.
5. Inspect its properties. The source's door example shows width, height, direction, and Existing state.

## Alternatives and recovery

- Doors and windows attach to walls; they are not independent free-floating objects.
- Cancel the temporary tool with Escape before creation to return to Select without committing the preview.
- The source does not specify collision rules, wall-end clearance, or the complete window-property form. Those details require refinement rather than invented defaults.
- Wall-first modelling, doors, windows, and openings were explicitly deferred from the first room-creation slice.

## Outcome

The opening belongs to the intended wall and can be repositioned along it and inspected in context.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§24: opening insertion and repositioning; §10: temporary tool lifecycle](<../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md>)
- [M02: Add menu](../renovation-planner-editor-specs/screens/M02-add-menu.md)
- [§3.2: first-slice exclusions](<../renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md>)

## Related journeys

- [UJ-E03 — Draw and adjust a wall-based layout](draw-and-adjust-walls.md)
- [UJ-E05 — Define the intended room changes](define-planned-change.md)
