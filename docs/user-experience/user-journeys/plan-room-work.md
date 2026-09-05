---
id: UJ-E06
title: "Turn renovation intent into room work"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M10-room-work.md"
    section: "M10: work, dependencies and responsibility"
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§14 and §16: contextual creation and progressive work planning"
related_journeys:
  - UJ-E05
  - UJ-E07
  - UJ-W03
---

# Turn renovation intent into room work

## Goal

Express what needs doing and progressively organize the work needed for a planned outcome.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user selects a room and opens What needs doing, or follows required work from a Planned item.

## Main flow

1. Add a plain-language work item such as Replace floor with the room and optional Planned outcome inherited.
2. Inspect the work list and its corresponding numbered spatial markers.
3. Refine order and dependencies when useful.
4. Choose responsibility such as DIY or an existing trade and inspect blocked state.
5. Follow the resulting Planned item, or open the broader schedule while retaining context.

## Alternatives and recovery

- The first work item does not require tasks, trades, or a work-package hierarchy.
- Dependencies cannot introduce a cycle.
- Marker and list selection refer to the same work item; keyboard ordering accompanies drag ordering.
- The room inspector does not become a whole-project scheduling board.

## Outcome

Work remains connected to the room and its intended outcome, with understandable responsibility and sequencing.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M10: work, dependencies and responsibility](<../renovation-planner-editor-specs/screens/M10-room-work.md>)
- [§14 and §16: contextual creation and progressive work planning](<../archive/renovation-project-workspace-UXD.md>)

## Related journeys

- [UJ-E05 — Define the intended room changes](define-planned-change.md)
- [UJ-E07 — Calculate material needs and prepare shopping](plan-materials-and-shopping.md)
- [UJ-W03 — Schedule renovation work progressively](schedule-renovation-work.md)
