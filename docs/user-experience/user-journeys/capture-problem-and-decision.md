---
id: UJ-W06
title: "Capture a renovation problem and decision"
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
    section: "§34: required eight-step prototype scenario"
  - path: "../renovation-planner-editor-specs/screens/M09-planned-room-details.md"
    section: "M09: linked decisions"
  - path: "../renovation-planner-editor-specs/screens/M14-room-evidence.md"
    section: "M14: contextual evidence"
related_journeys:
  - UJ-E05
  - UJ-E09
  - UJ-P03
  - UJ-W08
  - UJ-W09
---

# Capture a renovation problem and decision

## Goal

Connect unexpected conditions, evidence, and a decision to the renovation work they affect.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The archived canvas prototype scenario begins with a Kitchen and an intended floor replacement.

## Main flow

1. Create or select Kitchen.
2. Add Replace Floor and a sample estimate of EUR 2,500.
3. Add the problem Damp Wall and attach a photo.
4. Create the decision Repair or Replace? in that context.
5. Navigate among space, work, problem, decision, photo, and cost through canvas, tree, and inspector.
6. Leave and restore the meaningful context.

## Alternatives and recovery

- The amount and names are prototype task fixtures, not product defaults or cost guidance.
- This archived scenario does not approve separate canvas-object schemas or its proposed recovery hierarchy.
- Newer editor specifications provide contextual evidence and decision entry; their detailed contracts take precedence when overlapping.
- The surrounding archived concept describes separate problem and decision lifecycles; UJ-W08 and UJ-W09 extract them. Exact transition commands and automatic downstream replanning remain unspecified.

## Outcome

The user can follow the relationship from renovation intent through an observed problem and evidence to a decision.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§34: required eight-step prototype scenario](<../archive/renovation-canvas-concept-interaction-design.md>)
- [M09: linked decisions](<../renovation-planner-editor-specs/screens/M09-planned-room-details.md>)
- [M14: contextual evidence](<../renovation-planner-editor-specs/screens/M14-room-evidence.md>)

## Related journeys

- [UJ-E05 — Define the intended room changes](define-planned-change.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
- [UJ-P03 — Resume work and recover a missing destination](resume-and-recover-context.md)
- [UJ-W08 — Investigate a problem and turn it into work](investigate-renovation-problem.md)
- [UJ-W09 — Compare alternatives and preserve a decision](evaluate-and-record-decision.md)
