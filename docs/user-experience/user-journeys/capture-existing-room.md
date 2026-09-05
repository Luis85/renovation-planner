---
id: UJ-E04
title: "Capture what exists in a room"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M08-existing-room-details.md"
    section: "M08: incremental capture and change entry"
related_journeys:
  - UJ-E05
  - UJ-E09
---

# Capture what exists in a room

## Goal

Record current finishes, fixtures, condition, and evidence incrementally.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A room is selected and the user chooses What's here.

## Main flow

1. Inspect the Existing rows for surfaces or elements.
2. Expand a row or choose Add existing detail; inherit the room and Existing context.
3. Record known descriptions, condition, and measurements without requiring a complete survey.
4. Attach relevant photos, documents, or notes.
5. Choose Mark something for change on an existing item, or switch to Planned/Work while retaining the room and viewport.

## Alternatives and recovery

- Calculated area or length is labelled as derived, not editable as a manually stored fact.
- Canvas surface chips have equivalent inspector/list access.
- Creating a change preserves the relationship to the original Existing item.

## Outcome

Known existing conditions and evidence remain associated with the room and can inform a planned change.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M08: incremental capture and change entry](<../renovation-planner-editor-specs/screens/M08-existing-room-details.md>)

## Related journeys

- [UJ-E05 — Define the intended room changes](define-planned-change.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
