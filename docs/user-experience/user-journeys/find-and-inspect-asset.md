---
id: UJ-A01
title: "Find and inspect a reusable asset"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL00-browse.md"
    section: "AL00: browse"
  - path: "../asset-library-delivery/specification/screens/AL01-selected-object.md"
    section: "AL01: inspect"
  - path: "../asset-library-delivery/specification/screens/AL02-search-results.md"
    section: "AL02: search"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§2–3 and §8"
related_journeys:
  - UJ-A02
  - UJ-A04
  - UJ-A05
---

# Find and inspect a reusable asset

## Goal

Recognize an existing definition before creating a duplicate.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The renovator opens Asset library through the Obsidian command or Projects entry point.

## Main flow

1. Browse category groups; without a valid restored selection, start with a neutral inspector.
2. Search by name, supplier, SKU, or category, ignoring case and surrounding whitespace.
3. Select a result by pointer or keyboard to inspect definition, shape, and usage.
4. Read each section as its data becomes available for the current asset.
5. Clear search to restore the previous group expansion state, or follow a specific detail action.

## Alternatives and recovery

- No results differs from an empty library and offers Clear search.
- A selection filtered out of results remains selected; a wide inspector explains that state. Narrow search shows the list while preserving a draft.
- Usage-read failure never means unused; stale responses for another selection must not appear.
- Selection neither opens the designer automatically nor places an asset in a plan.

## Outcome

The user understands the selected definition and its known usage without changing data.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL00: browse](<../asset-library-delivery/specification/screens/AL00-browse.md>)
- [AL01: inspect](<../asset-library-delivery/specification/screens/AL01-selected-object.md>)
- [AL02: search](<../asset-library-delivery/specification/screens/AL02-search-results.md>)
- [§2–3 and §8](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A02 — Create a reusable asset definition](create-reusable-asset.md)
- [UJ-A04 — Inspect asset usage and choose the right price scope](inspect-asset-usage-and-prices.md)
- [UJ-A05 — Open an asset shape or source note and return](open-asset-shape-or-note.md)
