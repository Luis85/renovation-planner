---
id: UJ-A03
title: "Edit a shared asset definition"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL04-edit-definition.md"
    section: "AL04: local draft and explicit save"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§4–6 and §8: commit, conflict and price boundaries"
related_journeys:
  - UJ-A04
  - UJ-A06
  - UJ-A07
---

# Edit a shared asset definition

## Goal

Correct asset metadata or the shared library price through an explicit save.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. A readable asset is selected and the user changes a supported field.

## Main flow

1. Edit a local draft and read Unsaved changes; leaving a field does not save.
2. Review affected fields and, for a price change, inspect usage and its price basis.
3. Choose Save to validate the changed fields and use the agreed commit path.
4. After confirmed write and read-back, inspect the saved definition.
5. Alternatively choose Discard to restore the last confirmed baseline.

## Alternatives and recovery

- Validation errors and rejected saves retain the draft. Version conflicts show affected differences and require a deliberate reload or continued editing.
- Currency is not converted implicitly; incompatible unit changes may be rejected for referenced assets.
- A partial commit must not appear as complete success. The whole-form save remains a proposed contract requiring production reconciliation.
- Confirmed write plus failed refresh is a refresh problem; an unknown write outcome requires status resolution before retry.
- Shared price corrections do not overwrite project overrides or historical actual costs.

## Outcome

The definition reflects confirmed supported edits, or the draft remains available with a specific explanation.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL04: local draft and explicit save](<../asset-library-delivery/specification/screens/AL04-edit-definition.md>)
- [§4–6 and §8: commit, conflict and price boundaries](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A04 — Inspect asset usage and choose the right price scope](inspect-asset-usage-and-prices.md)
- [UJ-A06 — Leave or retain an unsaved asset draft](leave-unsaved-asset-draft.md)
- [UJ-A07 — Recover from asset loading or saving errors](recover-asset-data-errors.md)
