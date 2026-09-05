---
id: UJ-W07
title: "Refine a rough estimate with measurements"
type: user-journey
status: documented
source_maturity: archived-concept
version: 1
language: en
updated: 2026-09-05
area: workspace
actor: private-renovator
sources:
  - path: "../archive/renovation-canvas-concept-interaction-design.md"
    section: "§5–6, §13 and §19–20: fidelity, precision and refinement"
  - path: "../archive/renovation-project-workspace-wireframes.md"
    section: "A.15: rough-to-detailed estimate"
  - path: "../archive/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md"
    section: "§9: optional estimate refinement"
related_journeys:
  - UJ-E01
  - UJ-E07
  - UJ-E08
  - UJ-W02
---

# Refine a rough estimate with measurements

## Goal

Add spatial precision when it improves an estimate, while keeping a rough estimate useful on its own.

## Actor and entry

A private renovator working in Obsidian. A work item such as Replace Kitchen Floor has a rough estimate and the user wants a more reliable quantity or cost.

## Main flow

1. Open the work item and choose Refine Estimate or respond to the contextual measurement guidance.
2. Choose between retaining a rough estimate, using room area, or measuring on the plan.
3. If the room has no measured area, read why measuring helps and deliberately choose Measure Kitchen or Enter Rough Estimate.
4. When useful, refine the property representation from conceptual spaces to approximate layout to measured geometry using entered dimensions or a calibrated reference.
5. Use known area and waste with material and labor details to refine required quantities and the estimate.
6. Keep the work, measured zone where used, and resulting estimate associated with the same renovation context.

## Alternatives and recovery

- A rough estimate remains valid; measured geometry and renovation zones are optional for simple work.
- The source's sample prices, areas, and waste values are fixtures, not calculated defaults to copy into a project.
- The source does not specify an automatic conversion between conceptual and persisted measured entities.
- Current reference setup, room materials, and cost specifications govern their respective detailed subflows.

## Outcome

The user either retains an intentional rough estimate or can explain a refined estimate through its measurement and cost inputs.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. The [catalogue conventions](README.md#conventions-and-precedence) define precedence and shared constraints.

- [§5–6, §13 and §19–20: fidelity, precision and refinement](<../archive/renovation-canvas-concept-interaction-design.md>)
- [A.15: rough-to-detailed estimate](<../archive/renovation-project-workspace-wireframes.md>)
- [§9: optional estimate refinement](<../archive/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md>)

## Related journeys

- [UJ-E01 — Start a plan and prepare a reference](prepare-first-plan.md)
- [UJ-E07 — Calculate material needs and prepare shopping](plan-materials-and-shopping.md)
- [UJ-E08 — Estimate and review renovation costs](estimate-and-review-costs.md)
- [UJ-W02 — Organize and work within property spaces](organize-property-spaces.md)
