---
id: UJ-E16
title: "Delete a spatial entity with understood consequences"
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
    section: "§51: consequence-based destructive actions"
  - path: "../renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md"
    section: "M00: valid delete and focus conditions"
  - path: "../renovation-planner-editor-specs/screens/M07-wall-selected.md"
    section: "M07: adjacent-room/opening/reference impact"
related_journeys:
  - UJ-E12
  - UJ-E14
  - UJ-E11
---

# Delete a spatial entity with understood consequences

## Goal

Remove an editable spatial entity while understanding the effect on linked renovation information.

## Actor and entry

A private renovator working in Obsidian. The user has selected a room, wall, or other editable spatial entity and deliberately requests Delete.

## Main flow

1. Invoke the valid deletion action outside a text field.
2. Inspect the consequence summary for a high-value or linked entity, including affected work, photos, documents, costs, or wall openings.
3. Cancel to retain the entity, or explicitly confirm the permitted deletion.
4. Observe the confirmed result; use Undo only where the actual command supports safe restoration.

## Alternatives and recovery

- The mental-model concept distinguishes low-impact deletion of an unused chair from deletion of a room with linked content; it does not make every delete equally destructive.
- The newer M00 screen requires confirmation when its room-deletion action is valid.
- Wall deletion cannot silently orphan hosted openings or linked records.
- The exact treatment of dependent records requires the domain/reference contract; this extraction does not invent a cascade.
- Stale geometry blocks deletion; multi-entity deletion follows the shared batch impact contract.

## Outcome

The user deliberately removes the intended entity under supported reference rules or cancels with its data retained.

## Scope and evidence

This journey extracts source design intent, not verified implementation or passed usability testing. The [catalogue conventions](README.md#conventions-and-precedence) define precedence and shared constraints.

- [§51: consequence-based destructive actions](<../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md>)
- [M00: valid delete and focus conditions](<../renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md>)
- [M07: adjacent-room/opening/reference impact](<../renovation-planner-editor-specs/screens/M07-wall-selected.md>)

## Related journeys

- [UJ-E12 — Apply a shared change to multiple entities](apply-shared-spatial-change.md)
- [UJ-E14 — Find, inspect, and adjust an existing room](inspect-and-edit-room.md)
- [UJ-E11 — Recover a saved plan after refresh failure](recover-saved-stale-plan.md)
