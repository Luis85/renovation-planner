---
id: UJ-W02
title: "Organize and work within property spaces"
type: user-journey
status: documented
source_maturity: archived-concept
version: 1
language: en
updated: 2026-09-05
area: workspace
actor: private-renovator
sources:
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§6–7 and §12–14: hierarchy, space detail and contextual creation"
  - path: "../renovation-planner-project-specs/interaction-concept.md"
    section: "§3 and §13: rooms versus plans and future aggregates"
related_journeys:
  - UJ-E02
  - UJ-E06
  - UJ-E09
---

# Organize and work within property spaces

## Goal

Break the renovation into meaningful places and keep related work and information in context.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user opens the conceptual Spaces view for a project, including projects without drawings.

## Main flow

1. Add useful buildings, floors, rooms, zones, or outdoor areas as appropriate to the actual scope.
2. Rename, move, or inspect spaces as the understanding of the property improves.
3. Open a space detail and orient through project and spatial context.
4. Choose the space's work, materials, costs, documents, or optional plan.
5. Create related information with the current project and space inherited, adjusting the association deliberately if needed.

## Alternatives and recovery

- The hierarchy must accommodate apartments, partial renovations, and outdoor-only projects.
- A room can conceptually exist without a drawing; a plan may contain several rooms.
- The newer project-detail plan list must not be renamed Spaces or Rooms as a substitute for the missing domain capability.
- Detailed validation and persistence behavior for the full hierarchy remains outside this archived journey.

## Outcome

The user can think in terms of a place such as Kitchen while its related renovation information follows that context.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§6–7 and §12–14: hierarchy, space detail and contextual creation](<../archive/renovation-project-workspace-UXD.md>)
- [§3 and §13: rooms versus plans and future aggregates](<../renovation-planner-project-specs/interaction-concept.md>)

## Related journeys

- [UJ-E02 — Create, undo, and restore a room](create-and-restore-room.md)
- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
