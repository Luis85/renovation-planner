---
id: UJ-E02
title: "Create, undo, and restore a room"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md"
    section: "§2.2: explicit ten-step slice journey; §3: scope"
  - path: "../renovation-planner-editor-specs/screens/M03-add-room.md"
    section: "M03: creation and cancellation"
  - path: "../renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md"
    section: "M00: contextual overview"
  - path: "../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md"
    section: "§17: rectangular and free-shape room creation"
related_journeys:
  - UJ-E01
  - UJ-E04
  - UJ-E11
---

# Create, undo, and restore a room

## Goal

Create a useful room without CAD knowledge and trust that its identity and geometry survive reopening.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The homeowner opens an editable project plan in Standard Plan View with Select active.

## Main flow

1. Choose Add → Room.
2. Drag a rectangular preview or enter exact dimensions through numeric fields; choose a room type and name such as Kitchen.
3. Confirm Create room. The preview becomes one reversible creation, Kitchen is selected, and the editor returns to Select by default.
4. Inspect Kitchen in the contextual overview through the canvas or non-canvas room route.
5. Undo creation, then redo it.
6. Close and reopen the view or reload the plugin, then find the same room geometry and metadata.

## Alternatives and recovery

- Esc or Cancel abandons the preview without writing. Invalid dimensions remain validation errors.
- Keep adding rooms is an explicit opt-in alternative to returning to Select.
- The broader mental-model concept also offers Add → Room → Free shape: click corners, then close at the start point, by double-clicking the final point, or with Enter where appropriate. Escape cancels. This is an alternative beyond the first slice's rectangular-room flow.
- A failed write or read must not be presented as current saved data; a successful write with failed refresh follows UJ-E11.
- Only information supplied by the read model belongs in the overview; mockup costs and completion values are not fallback data.

## Outcome

The same room is selectable and restored from the vault, and creation is reversible as one user action.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§2.2: explicit ten-step slice journey; §3: scope](<../renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md>)
- [M03: creation and cancellation](<../renovation-planner-editor-specs/screens/M03-add-room.md>)
- [M00: contextual overview](<../renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md>)
- [§17: broader room-creation alternatives](<../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md>)

## Related journeys

- [UJ-E01 — Start a plan and prepare a reference](prepare-first-plan.md)
- [UJ-E04 — Capture what exists in a room](capture-existing-room.md)
- [UJ-E11 — Recover a saved plan after refresh failure](recover-saved-stale-plan.md)
