---
id: UJ-P04
title: "Maintain project-specific prices"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: projects
actor: private-renovator
sources:
  - path: "../renovation-planner-project-specs/screens/P04-project-prices.md"
    section: "P04: interactions, data contract and exceptions"
  - path: "../renovation-planner-project-specs/interaction-concept.md"
    section: "§9: project prices"
related_journeys:
  - UJ-A04
  - UJ-P02
---

# Maintain project-specific prices

## Goal

Use a project-specific unit price while preserving the shared catalogue definition.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user chooses View prices from project details or follows a library usage link into that project.

## Main flow

1. Read the project identity, currency, catalogue price, saved override, and usable price.
2. Choose Set project price or Edit and enter a local draft.
3. Choose Apply; validate and commit through the existing version-aware write path.
4. After confirmed success, show the saved override and the price usable under domain rules.
5. Optionally remove an existing saved override, or return using Back to project.

## Alternatives and recovery

- Cancel discards the draft. Leaving with a draft offers Discard or Keep editing.
- Invalid input and conflicts retain the draft; inspect current data and deliberately reapply after a conflict.
- A first unsaved draft has no Remove project price action. Removing a saved override does not guarantee a usable catalogue price.
- Write success followed by failed refresh stays Saved · refresh needed; do not repeat the write.
- No implicit currency conversion, totals without quantities, or units absent from the read model. Unreadable/orphan override cleanup follows the source contract.

## Outcome

The project uses only a confirmed, valid price; catalogue prices and other project overrides are unchanged.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [P04: interactions, data contract and exceptions](<../renovation-planner-project-specs/screens/P04-project-prices.md>)
- [§9: project prices](<../renovation-planner-project-specs/interaction-concept.md>)

## Related journeys

- [UJ-A04 — Inspect asset usage and choose the right price scope](inspect-asset-usage-and-prices.md)
- [UJ-P02 — Find and deliberately open a project](find-and-open-project.md)
