---
id: UJ-A06
title: "Leave or retain an unsaved asset draft"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL05-unsaved-changes.md"
    section: "AL05: pending action and choice"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§7: supported guard boundaries"
related_journeys:
  - UJ-A02
  - UJ-A03
  - UJ-A05
---

# Leave or retain an unsaved asset draft

## Goal

Choose deliberately whether to keep editing or abandon input before navigation.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A changed draft exists and the user requests another selection, New asset, note/designer/project navigation, or a supported normal closure.

## Main flow

1. Keep the requested navigation as a pending action and show the unsaved-changes choice.
2. Choose Continue editing (Keep editing in the screen specification) to retain the draft and return to the field.
3. Alternatively choose Discard and continue to restore the baseline and execute the pending action exactly once.

## Alternatives and recovery

- Esc cancels the dialog and performs no pending navigation.
- Search, group expansion, and width changes preserve input and need no guard.
- Forced termination or restart has no promised recovery without a separate recovery contract.
- Normal closing is guarded only where the host supports vetoing it.

## Outcome

Input is retained or discarded by an explicit choice; navigation never silently loses the draft.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL05: pending action and choice](<../asset-library-delivery/specification/screens/AL05-unsaved-changes.md>)
- [§7: supported guard boundaries](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A02 — Create a reusable asset definition](create-reusable-asset.md)
- [UJ-A03 — Edit a shared asset definition](edit-asset-definition.md)
- [UJ-A05 — Open an asset shape or source note and return](open-asset-shape-or-note.md)
