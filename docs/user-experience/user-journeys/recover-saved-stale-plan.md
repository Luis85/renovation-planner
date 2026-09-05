---
id: UJ-E11
title: "Recover a saved plan after refresh failure"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M15-stale-data-warning.md"
    section: "M15: saved write and failed hydration"
related_journeys:
  - UJ-E02
  - UJ-P03
---

# Recover a saved plan after refresh failure

## Goal

Confirm that an edit was saved and safely restore a current view without duplicating it.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A mutation succeeded, but the subsequent hydration/read-back failed and the last valid projection remains available.

## Main flow

1. Read Saved · refresh needed and the persistent explanation alongside the retained plan.
2. Inspect known content or open the source note if useful.
3. Choose Try again to repeat only the read.
4. After successful refresh, return to editing with current content and restored actions.

## Alternatives and recovery

- Geometry, Add, and Delete actions stay unavailable against stale geometry with an explanation.
- Another failed read keeps the valid content and warning visible.
- An unconfirmed write outcome is not this state and must not be labelled saved.
- Retry never replays the successful mutation.

## Outcome

The view becomes current without writing the same edit twice, or remains visibly stale with a safe next action.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M15: saved write and failed hydration](<../renovation-planner-editor-specs/screens/M15-stale-data-warning.md>)

## Related journeys

- [UJ-E02 — Create, undo, and restore a room](create-and-restore-room.md)
- [UJ-P03 — Resume work and recover a missing destination](resume-and-recover-context.md)
