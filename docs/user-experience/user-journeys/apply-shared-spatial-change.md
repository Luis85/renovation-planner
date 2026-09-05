---
id: UJ-E12
title: "Apply a shared change to multiple entities"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M11-multi-selection.md"
    section: "M11: shared properties and batch actions"
related_journeys:
  - UJ-E03
  - UJ-E06
  - UJ-E09
---

# Apply a shared change to multiple entities

## Goal

Perform one safe, reversible action across compatible spatial entities.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user adds at least two entities to selection with Shift-click or keyboard selection.

## Main flow

1. Inspect the selected members, shared properties, mixed values, and aggregate measurements.
2. Choose a supported batch action such as marking walls for removal or linking shared work/evidence.
3. Preview affected entities and confirm the action.
4. Commit one composite reversible change and inspect the result.

## Alternatives and recovery

- Unsupported combinations disable the action with an explanation.
- A mixed value must not appear as a shared value.
- Deletion requires an explicit impact summary and confirmation.
- Esc clears multi-selection and returns to the safe no-selection state; one batch action undoes as one action.

## Outcome

The intended compatible entities receive the shared change with explicit scope and reversible behavior.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M11: shared properties and batch actions](<../renovation-planner-editor-specs/screens/M11-multi-selection.md>)

## Related journeys

- [UJ-E03 — Draw and adjust a wall-based layout](draw-and-adjust-walls.md)
- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
