---
id: UJ-A04
title: "Inspect asset usage and choose the right price scope"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL06-usage-and-price.md"
    section: "AL06: project navigation and price impact"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§6: shared price definition"
related_journeys:
  - UJ-P04
  - UJ-A03
---

# Inspect asset usage and choose the right price scope

## Goal

Understand which projects use an asset and whether a shared or project-specific price should change.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The selected asset has a Used in section, especially relevant before changing its price.

## Main flow

1. Read known project references and each available price basis.
2. Distinguish the shared library default from project overrides.
3. For a project-specific change, open that named project through its usage row.
4. Edit the override in project details using UJ-P04.
5. Return to the library with selection and browsing context preserved.

## Alternatives and recovery

- Usage counts are references, not inventory or purchased quantities.
- An unreadable usage section stays an error, not a claim that the asset is unused.
- A shared price write does not establish that every downstream cost has already updated; failures remain explicit.
- No catalogue total or cross-currency sum is inferred from unit prices.

## Outcome

The user reaches the correct scope for a price decision and can distinguish overrides from shared defaults.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL06: project navigation and price impact](<../asset-library-delivery/specification/screens/AL06-usage-and-price.md>)
- [§6: shared price definition](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-P04 — Maintain project-specific prices](maintain-project-prices.md)
- [UJ-A03 — Edit a shared asset definition](edit-asset-definition.md)
