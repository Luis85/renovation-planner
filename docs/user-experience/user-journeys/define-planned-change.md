---
id: UJ-E05
title: "Define the intended room changes"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M09-planned-room-details.md"
    section: "M09: planned details, decisions and work links"
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§15: design intent"
related_journeys:
  - UJ-E04
  - UJ-E06
  - UJ-W06
---

# Define the intended room changes

## Goal

Describe what should exist afterwards while retaining the existing baseline.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A room is selected; the user chooses What will change or starts from an Existing item.

## Main flow

1. Add a planned detail with the room and optional Existing source already associated.
2. Describe an intended finish or element and classify the change as unchanged, removed, modified, or added where valid.
3. Review applicable downstream work/cost effects before committing an edit.
4. Record or open unresolved decisions in linked Decision notes.
5. Follow See required work to the work that produces the selected outcome.

## Alternatives and recovery

- Planned records do not overwrite Existing records.
- Hiding the Planned layer changes visibility only.
- Change status must remain understandable through patterns, markers, and labels, including list access.

## Outcome

The desired outcome is traceable to its source state, unresolved decisions, and required work.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M09: planned details, decisions and work links](<../renovation-planner-editor-specs/screens/M09-planned-room-details.md>)
- [§15: design intent](<../archive/renovation-project-workspace-UXD.md>)

## Related journeys

- [UJ-E04 — Capture what exists in a room](capture-existing-room.md)
- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-W06 — Capture a renovation problem and decision](capture-problem-and-decision.md)
