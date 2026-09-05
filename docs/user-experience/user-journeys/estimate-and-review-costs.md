---
id: UJ-E08
title: "Estimate and review renovation costs"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M13-room-costs.md"
    section: "M13: cost stages and evidence"
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§17 and §29: progressive estimation and room ↔ budget flow"
related_journeys:
  - UJ-P04
  - UJ-E07
  - UJ-E09
---

# Estimate and review renovation costs

## Goal

Understand spending in room/work context and refine estimates without losing the distinction between planned, committed, and actual costs.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user opens Costs for a selected room or begins with a simple work estimate.

## Main flow

1. Record a simple estimate or inspect existing cost items for the room.
2. Expand a work-cost group and distinguish material, labor, and other contributions.
3. Inspect calculated estimate inputs where quantities, rates, and waste determine the result.
4. Add a contextual planned, committed, or actual cost and link a quote or invoice as evidence.
5. Open dedicated quote comparison when needed; the broader workspace concept also allows moving to project budget and back to the same room.

## Alternatives and recovery

- Totals require reliable contributing items and must reconcile to them; do not invent financial summaries from unit prices.
- Remaining cost needs an explicit derived definition; financial stages stay labelled.
- Project-budget navigation and progressive aggregate views are broader concept scope, not part of the first editor slice.
- Project price overrides are a separate journey; they are not a budget total.

## Outcome

The user can explain the estimate or spending through its work items, calculation inputs, and evidence.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M13: cost stages and evidence](<../renovation-planner-editor-specs/screens/M13-room-costs.md>)
- [§17 and §29: progressive estimation and room ↔ budget flow](<../archive/renovation-project-workspace-UXD.md>)

## Related journeys

- [UJ-P04 — Maintain project-specific prices](maintain-project-prices.md)
- [UJ-E07 — Calculate material needs and prepare shopping](plan-materials-and-shopping.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
