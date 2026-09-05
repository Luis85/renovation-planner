---
id: UJ-A08
title: "Delete an asset without damaging references"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL11-delete-object.md"
    section: "AL11: deletion and reference checks"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§11: destructive actions"
related_journeys:
  - UJ-A01
  - UJ-A07
---

# Delete an asset without damaging references

## Goal

Remove a definition only when its usage and related data can be handled safely.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user chooses the secondary Delete asset action from the selected asset's detail menu.

## Main flow

1. Check current usage and show the asset name and explicit effects.
2. If deletion is supported for the current references, offer the labelled final action and Cancel.
3. Confirm deletion through the existing command, which checks references again.
4. After confirmed success, focus the next visible row, otherwise the previous row, otherwise search; show the empty state when appropriate.

## Alternatives and recovery

- Pending or failed usage checks block deletion with an explanation.
- Referenced assets use only existing supported resolution; otherwise show usage and refuse deletion.
- Never automatically delete project requirements or project data.
- A failure keeps the asset visible. There is no blanket Undo promise without actual restoration support.

## Outcome

The definition is removed only after confirmed safe deletion, and the user retains a meaningful library focus.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL11: deletion and reference checks](<../asset-library-delivery/specification/screens/AL11-delete-object.md>)
- [§11: destructive actions](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A01 — Find and inspect a reusable asset](find-and-inspect-asset.md)
- [UJ-A07 — Recover from asset loading or saving errors](recover-asset-data-errors.md)
