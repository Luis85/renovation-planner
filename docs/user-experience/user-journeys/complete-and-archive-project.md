---
id: UJ-W05
title: "Review completion and archive a project"
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
    section: "§26: completion and archive"
  - path: "../renovation-planner-project-specs/interaction-concept.md"
    section: "§5 and §10: completed project access"
related_journeys:
  - UJ-E09
  - UJ-W04
---

# Review completion and archive a project

## Goal

Close out the renovation while preserving its history for later use.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user considers the project complete and opens the conceptual completion review.

## Main flow

1. Review completed and remaining work.
2. Compare estimated and final costs, target and completion dates, and documentation completeness.
3. Complete the project through the intended status workflow.
4. Archive it to remove it from the default active list while preserving its underlying data.
5. Later reopen it for reference or restore it to active status.

## Alternatives and recovery

- Archive is organizational, not deletion.
- The archived source leaves exact completion criteria, commands, and archive-state mapping unspecified; this extraction does not choose them.
- The current project concept makes completed projects accessible but does not establish a separate implemented archive feature.

## Outcome

The project remains available as renovation history and can be revisited or reactivated under the future archive contract.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§26: completion and archive](<../archive/renovation-project-workspace-UXD.md>)
- [§5 and §10: completed project access](<../renovation-planner-project-specs/interaction-concept.md>)

## Related journeys

- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
- [UJ-W04 — Execute work and track the renovation](execute-and-track-renovation.md)
