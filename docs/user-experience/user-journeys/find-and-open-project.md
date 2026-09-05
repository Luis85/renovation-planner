---
id: UJ-P02
title: "Find and deliberately open a project"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: projects
actor: private-renovator
sources:
  - path: "../renovation-planner-project-specs/interaction-concept.md"
    section: "§4B, §5, §7 and §11"
  - path: "../renovation-planner-project-specs/screens/P00-project-overview.md"
    section: "P00: project selection"
  - path: "../renovation-planner-project-specs/screens/P02-active-project.md"
    section: "P02: active project"
related_journeys:
  - UJ-P03
  - UJ-P04
  - UJ-E01
---

# Find and deliberately open a project

## Goal

Choose the intended renovation and reach its note, plans, or prices with clear context.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The Projects overview is open and the user wants to choose a project explicitly.

## Main flow

1. Scan active projects or type a search term; matching completed projects are revealed while searching.
2. Activate a project row to open its details.
3. Confirm the project name, status, and currency, then inspect the optional entry paths and visible plan list.
4. Open the project note, a specific plan, or project prices deliberately. A plan action targets its exact project and plan IDs.
5. Return through project navigation; returning to the overview restores search, scroll, and focus when the row still exists.

## Alternatives and recovery

- No matches keeps the search text and offers adjustment or deliberate creation with that text prefilled.
- Readable projects and plans remain accessible alongside regional read warnings.
- A missing row restores focus to the filter; it does not select a different project automatically.
- An ordinary row opens details. Only Resume restores the last working context.
- Optional entry guidance may be hidden and restored without removing note, plan, creation, or price access. Opening an entry does not mark a setup task complete.

## Outcome

The user reaches a named destination in the chosen project and can return without losing orientation.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§4B, §5, §7 and §11](<../renovation-planner-project-specs/interaction-concept.md>)
- [P00: project selection](<../renovation-planner-project-specs/screens/P00-project-overview.md>)
- [P02: active project](<../renovation-planner-project-specs/screens/P02-active-project.md>)

## Related journeys

- [UJ-P03 — Resume work and recover a missing destination](resume-and-recover-context.md)
- [UJ-P04 — Maintain project-specific prices](maintain-project-prices.md)
- [UJ-E01 — Start a plan and prepare a reference](prepare-first-plan.md)
