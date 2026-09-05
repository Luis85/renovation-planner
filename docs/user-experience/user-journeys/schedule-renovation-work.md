---
id: UJ-W03
title: "Schedule renovation work progressively"
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
    section: "§18: schedule journey"
  - path: "../renovation-planner-editor-specs/screens/M10-room-work.md"
    section: "M10: broader schedule entry and contextual return"
related_journeys:
  - UJ-E06
  - UJ-W04
---

# Schedule renovation work progressively

## Goal

Understand when work should happen and how its sequence fits together.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. Work already exists and the user is ready to add timing information.

## Main flow

1. Open the broader Schedule context from the project or room work.
2. Organize existing work into useful phases.
3. Add known dates and durations progressively.
4. Represent dependencies and milestones to make sequence understandable.
5. Return to the relevant work or room context when the sequence needs refinement.

## Alternatives and recovery

- An unscheduled project remains valid.
- The source gives a high-level journey, not a committed scheduling interface, algorithm, or resource-leveling contract.
- Cycle prevention is specified for room-work dependencies; broader schedule validation requires its own refinement.

## Outcome

Existing work gains useful timing and sequence information without making scheduling a prerequisite for planning.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§18: schedule journey](<../archive/renovation-project-workspace-UXD.md>)
- [M10: broader schedule entry and contextual return](<../renovation-planner-editor-specs/screens/M10-room-work.md>)

## Related journeys

- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-W04 — Execute work and track the renovation](execute-and-track-renovation.md)
