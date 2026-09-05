---
id: UJ-E03
title: "Draw and adjust a wall-based layout"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M04-draw-walls.md"
    section: "M04: draft chain and finish"
  - path: "../renovation-planner-editor-specs/screens/M07-wall-selected.md"
    section: "M07: inspection, precision and deletion"
related_journeys:
  - UJ-E01
  - UJ-E12
  - UJ-E13
---

# Draw and adjust a wall-based layout

## Goal

Model an irregular or measured layout with understandable precision controls.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. An editable floor is open; the user chooses Add → Wall, optionally over a locked reference.

## Main flow

1. Set the first point and preview the next segment with length, angle, and snapping guidance.
2. Add connected segments, using numeric length entry where needed.
3. Close the boundary when appropriate and use the offered room-creation option.
4. Finish the valid chain as one reversible transaction.
5. Select a wall from the canvas or entity list and inspect its dimensions and adjacent rooms.
6. Preview a supported exact-length change and commit it through the same reversible editing path.

## Alternatives and recovery

- Undo point removes only the last draft segment; Cancel discards the uncommitted chain.
- Room creation from a closed chain belongs to the same composite transaction.
- Deleting a wall requires impact information about adjacent rooms, openings, and linked records.
- Wall-first modelling is outside the first room-creation slice; this journey preserves the broader design intent.

## Outcome

Committed walls describe the intended layout and remain inspectable and reversibly editable.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M04: draft chain and finish](<../renovation-planner-editor-specs/screens/M04-draw-walls.md>)
- [M07: inspection, precision and deletion](<../renovation-planner-editor-specs/screens/M07-wall-selected.md>)

## Related journeys

- [UJ-E01 — Start a plan and prepare a reference](prepare-first-plan.md)
- [UJ-E12 — Apply a shared change to multiple entities](apply-shared-spatial-change.md)
- [UJ-E13 — Insert and position a door or window](insert-wall-opening.md)
