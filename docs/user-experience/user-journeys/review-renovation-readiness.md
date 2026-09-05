---
id: UJ-E10
title: "Review renovation readiness and address issues"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M17-review-perspective.md"
    section: "M17: review and issue navigation"
related_journeys:
  - UJ-E05
  - UJ-E06
  - UJ-E08
  - UJ-E09
---

# Review renovation readiness and address issues

## Goal

Find missing decisions, estimates, evidence, or blocked work and return to the right place to resolve them.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A floor contains rooms or changes and the user switches to Review.

## Main flow

1. Inspect readiness through the floor markers or inspector list.
2. Select a room/change and read its Existing → Work → Planned summary.
3. Open a specific issue to the relevant Decision, Work, Cost, or Evidence detail in Renovate.
4. Address the issue in that contextual workflow.
5. Optionally create a vault-backed review note with entity links; return to Renovate with the previous selection and viewport.

## Alternatives and recovery

- Readiness is derived from deterministic, explainable rules rather than invented progress.
- Review offers inspection and issue navigation, not geometry editing or Add controls.
- This journey adds no collaboration or approval semantics.

## Outcome

Each reported issue has an actionable source destination and the user retains spatial orientation.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M17: review and issue navigation](<../renovation-planner-editor-specs/screens/M17-review-perspective.md>)

## Related journeys

- [UJ-E05 — Define the intended room changes](define-planned-change.md)
- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-E08 — Estimate and review renovation costs](estimate-and-review-costs.md)
- [UJ-E09 — Attach and find evidence in context](attach-and-find-evidence.md)
