---
id: UJ-W09
title: "Compare alternatives and preserve a decision"
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
    section: "§11: decision lifecycle, alternatives and rationale; §15: contextual entry"
  - path: "../renovation-planner-editor-specs/screens/M09-planned-room-details.md"
    section: "M09: linked unresolved decisions"
related_journeys:
  - UJ-W08
  - UJ-E05
  - UJ-E08
---

# Compare alternatives and preserve a decision

## Goal

Record what was chosen, why, and which alternatives and impacts informed it.

## Actor and entry

A private renovator working in Obsidian. A renovation choice is open for a room, work item, or problem, such as keeping a kitchen layout or moving a sink.

## Main flow

1. Create or open the contextual decision.
2. List the alternatives and known impacts, including cost information where available.
3. Evaluate the options and select the intended outcome.
4. Record the rationale, what was chosen, and when; retain the alternatives rather than replacing them with only the final answer.
5. If later circumstances replace the choice, preserve the old decision as Superseded.

## Alternatives and recovery

- Open → Evaluating → Decided → Superseded is the archived proposed lifecycle, not a shipped workflow guarantee.
- Illustrated alternative prices are sample data, not validated estimates.
- The source leaves comparison mechanics, approval roles, and automatic downstream changes unspecified.
- Current Planned details use linked Decision notes and preserve the relationship to room/work context.

## Outcome

The decision can later be understood through its alternatives, rationale, timing, and known impact.

## Scope and evidence

This is an archived concept journey retained for traceability. It is not current delivery approval. The [catalogue conventions](README.md#conventions-and-precedence) define precedence and shared constraints.

- [§11: decision lifecycle, alternatives and rationale; §15: contextual entry](<../archive/renovation-canvas-concept-interaction-design.md>)
- [M09: linked unresolved decisions](<../renovation-planner-editor-specs/screens/M09-planned-room-details.md>)

## Related journeys

- [UJ-W08 — Investigate a problem and turn it into work](investigate-renovation-problem.md)
- [UJ-E05 — Define the intended room changes](define-planned-change.md)
- [UJ-E08 — Estimate and review renovation costs](estimate-and-review-costs.md)
