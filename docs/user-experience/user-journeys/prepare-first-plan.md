---
id: UJ-E01
title: "Start a plan and prepare a reference"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M05-new-floor-start.md"
    section: "M05: three starting paths"
  - path: "../renovation-planner-editor-specs/screens/M06-reference-plan-setup.md"
    section: "M06: prepare, scale, review"
  - path: "../renovation-planner-project-specs/interaction-concept.md"
    section: "§6: project/editor boundary"
related_journeys:
  - UJ-P01
  - UJ-E02
  - UJ-E03
---

# Start a plan and prepare a reference

## Goal

Begin spatial planning with or without an existing image or PDF.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A project exists; the user creates or opens a plan/floor with no room geometry and no usable reference.

## Main flow

1. Open the plan through project details and read the empty-floor choices.
2. Choose Add rooms, Upload a floor plan, or Start empty. The room path continues in UJ-E02; Start empty opens Standard Plan View.
3. For a supported reference file, prepare its rotation, crop, and PDF page as needed.
4. Mark a known distance and enter its real length to preview scale.
5. Review scale, opacity, alignment, and lock state, then finish setup to persist reference metadata and layer configuration as one transaction.
6. Trace a room or walls against the visible, locked reference and verify the resulting dimensions through the relevant room/wall workflow.

## Alternatives and recovery

- Unreadable sources offer retry or replacement through supported recovery; do not fabricate a usable preview.
- Choose another distance resets the calibration draft while retaining the prepared source.
- Cancel restores the previous reference configuration, if any.
- Reference import belongs to the editor workflow, not a promised import step in project creation.
- This specification describes the proposed setup workflow; the first vertical slice explicitly deferred its redesign.

## Outcome

The user reaches an editable planning surface, optionally with a confirmed scaled reference, without a mandatory upload.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M05: three starting paths](<../renovation-planner-editor-specs/screens/M05-new-floor-start.md>)
- [M06: prepare, scale, review](<../renovation-planner-editor-specs/screens/M06-reference-plan-setup.md>)
- [§6: project/editor boundary](<../renovation-planner-project-specs/interaction-concept.md>)

## Related journeys

- [UJ-P01 — Start a project without a floor plan](start-project-without-plan.md)
- [UJ-E02 — Create, undo, and restore a room](create-and-restore-room.md)
- [UJ-E03 — Draw and adjust a wall-based layout](draw-and-adjust-walls.md)
