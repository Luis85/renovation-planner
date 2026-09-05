---
id: UJ-W10
title: "Set up and resume the historical workspace prototype"
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
    section: "§8–9: first launch and guided project setup"
  - path: "../archive/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md"
    section: "§2: golden path; §9: navigation and wizard contracts; §13: usability task"
related_journeys:
  - UJ-P01
  - UJ-P03
  - UJ-W02
  - UJ-E06
  - UJ-W07
---

# Set up and resume the historical workspace prototype

## Goal

Preserve the original guided setup and end-to-end no-plan prototype journey for traceability.

## Actor and entry

A private renovator working in Obsidian. The archived prototype's first-use Planner Home is open; the participant plans a two-floor house with a garden.

## Main flow

1. Choose New Project and enter project identity; only the name is required in the UXD.
2. Choose renovation type and property scope, such as Whole House and two floors plus garden.
3. Choose a starting method: import, draw a blank plan, or continue without a plan. The golden path uses Start Without a Plan.
4. Optionally select initial spaces, review the summary, and create the project.
5. Enter Project Home, open Spaces, and select Kitchen.
6. Add Replace Floor with the inherited Kitchen context and an optional rough estimate of EUR 2,500.
7. Open Work Detail, then return through Project Home to Planner Home.
8. Choose Continue and restore Kitchen / Replace Floor when that prototype context remains valid.

## Alternatives and recovery

- This wizard has been superseded for current entry by the newer minimal creation form and ordinary project note in UJ-P01. Retention here does not reintroduce it as a requirement.
- In the prototype, Back preserves wizard input, validation is step-local, optional steps can be skipped, and Cancel returns Home.
- Its fallback is Entity → Space → Functional View → Project Home; the current Resume contract instead uses reliably resolved project/plan context.
- Import/drawing, budget, schedule, and documents were representative prototype destinations, not production implementations.
- The project name, scope, room, work, and price are a usability fixture; the journey is not evidence of a passed study.

## Outcome

The historical participant reaches a useful room work item without a floor plan and can leave and continue that same work.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. The [catalogue conventions](README.md#conventions-and-precedence) define precedence and shared constraints.

- [§8–9: first launch and guided project setup](<../archive/renovation-project-workspace-UXD.md>)
- [§2: golden path; §9: navigation and wizard contracts; §13: usability task](<../archive/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md>)

## Related journeys

- [UJ-P01 — Start a project without a floor plan](start-project-without-plan.md)
- [UJ-P03 — Resume work and recover a missing destination](resume-and-recover-context.md)
- [UJ-W02 — Organize and work within property spaces](organize-property-spaces.md)
- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-W07 — Refine a rough estimate with measurements](refine-estimate-with-measurements.md)
