---
id: UJ-E09
title: "Attach and find evidence in context"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M14-room-evidence.md"
    section: "M14: shared evidence shell"
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§20: documentation journey"
related_journeys:
  - UJ-E04
  - UJ-E08
  - UJ-W05
---

# Attach and find evidence in context

## Goal

Keep renovation photos, documents, and notes connected to the place and work they explain.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A spatial entity is selected and the user chooses Documents, Photos, or Notes.

## Main flow

1. Add a photo, link a vault document, or create/open a Markdown note.
2. Use inherited room/entity context and optionally associate work and a phase such as Before, During, After, or Hidden services.
3. Inspect the evidence metadata and optional spatial pin.
4. Navigate between the numbered pin and the matching evidence row or thumbnail.
5. Filter by phase or switch evidence types while retaining the selected entity; open the ordinary vault file when needed.

## Alternatives and recovery

- Missing or unreadable thumbnails degrade to labelled file rows; a missing file remains a distinct state.
- Evidence remains ordinary vault content and links where practical.
- Non-canvas lists provide the same context access as pins.

## Outcome

Evidence is retrievable through its renovation context and remains accessible as vault content.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M14: shared evidence shell](<../renovation-planner-editor-specs/screens/M14-room-evidence.md>)
- [§20: documentation journey](<../archive/renovation-project-workspace-UXD.md>)

## Related journeys

- [UJ-E04 — Capture what exists in a room](capture-existing-room.md)
- [UJ-E08 — Estimate and review renovation costs](estimate-and-review-costs.md)
- [UJ-W05 — Review completion and archive a project](complete-and-archive-project.md)
