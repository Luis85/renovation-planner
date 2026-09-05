---
id: UJ-E07
title: "Calculate material needs and prepare shopping"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: editor
actor: private-renovator
sources:
  - path: "../renovation-planner-editor-specs/screens/M12-room-materials.md"
    section: "M12: quantities, provenance and procurement"
related_journeys:
  - UJ-E06
  - UJ-E08
  - UJ-A01
---

# Calculate material needs and prepare shopping

## Goal

Understand required material quantities and what remains to purchase.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A room is selected and the user opens Materials.

## Main flow

1. Inspect materials grouped by related work.
2. Add a manual or calculated material requirement associated with the room/work.
3. Inspect Calculated provenance: source geometry, formula, unit, and waste allowance.
4. Adjust waste allowance and review the changed need and cost preview.
5. Record purchased quantities in compatible units.
6. Create or open a vault-backed shopping list from outstanding quantities.

## Alternatives and recovery

- Calculated need and purchased quantity remain distinct.
- Incompatible units cannot be combined silently.
- Relevant geometry changes update derived quantities; stale information must remain identifiable.
- The default shopping list contains outstanding quantities unless configured otherwise.

## Outcome

The user can trace required quantities and distinguish what is needed from what has already been purchased.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [M12: quantities, provenance and procurement](<../renovation-planner-editor-specs/screens/M12-room-materials.md>)

## Related journeys

- [UJ-E06 — Turn renovation intent into room work](plan-room-work.md)
- [UJ-E08 — Estimate and review renovation costs](estimate-and-review-costs.md)
- [UJ-A01 — Find and inspect a reusable asset](find-and-inspect-asset.md)
