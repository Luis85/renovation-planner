---
id: UJ-A05
title: "Open an asset shape or source note and return"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL07-shape-and-note.md"
    section: "AL07: destination resolution and return"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§2 and §7: navigation and draft protection"
related_journeys:
  - UJ-A01
  - UJ-A06
---

# Open an asset shape or source note and return

## Goal

Move from a catalogue definition to its geometry or documentation without losing library context.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user selects Edit shape or Open note for the selected asset.

## Main flow

1. Resolve any unsaved draft through the leave guard.
2. Open the existing designer for the exact asset ID, or reveal the actual resolved note path in Obsidian.
3. Work with the shape or note through that destination's existing contract.
4. Return to the library with selection, search, and groups preserved.

## Alternatives and recovery

- Not read, no outline, unscaled, measured, and read failure are different geometry states.
- Unreadable geometry only offers designer navigation when that destination has a functional recovery action.
- A lost selection is not silently replaced by an arbitrary asset.
- Opening the shape is not placement into an implicit plan.

## Outcome

The intended asset destination opens and the library context remains recoverable.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL07: destination resolution and return](<../asset-library-delivery/specification/screens/AL07-shape-and-note.md>)
- [§2 and §7: navigation and draft protection](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A01 — Find and inspect a reusable asset](find-and-inspect-asset.md)
- [UJ-A06 — Leave or retain an unsaved asset draft](leave-unsaved-asset-draft.md)
