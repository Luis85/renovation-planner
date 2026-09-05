---
id: UJ-A02
title: "Create a reusable asset definition"
type: user-journey
status: documented
source_maturity: proposed
version: 1
language: en
updated: 2026-09-05
area: asset-library
actor: private-renovator
sources:
  - path: "../asset-library-delivery/specification/screens/AL03-create-object.md"
    section: "AL03: explicit creation"
  - path: "../asset-library-delivery/specification/screens/AL08-empty-library.md"
    section: "AL08: first asset"
  - path: "../asset-library-delivery/specification/interaction-rules.md"
    section: "§5: intentional price and supported fields"
related_journeys:
  - UJ-A03
  - UJ-A05
  - UJ-A06
---

# Create a reusable asset definition

## Goal

Capture a reusable object with minimal required information, even before creating a project.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The user chooses New asset; a genuinely empty library offers that same creation path.

## Main flow

1. Handle an existing unsaved draft before leaving it.
2. Focus Name and enter the required definition using supported category and unit values.
3. Enter an intentional price where required; do not substitute zero for an unknown price.
4. Submit once through the agreed create operation.
5. After confirmed success, select the new asset and its category, deliberately reset search, and inspect it.

## Alternatives and recovery

- A similar name is a hint to inspect existing results, not an automatic merge.
- An outline is not required for creation.
- Read failures or known unreadable files do not qualify as an empty catalogue.
- Rejected creation retains actionable feedback and never shows success.

## Outcome

A confirmed reusable definition is selected and can later gain a shape or project usage.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [AL03: explicit creation](<../asset-library-delivery/specification/screens/AL03-create-object.md>)
- [AL08: first asset](<../asset-library-delivery/specification/screens/AL08-empty-library.md>)
- [§5: intentional price and supported fields](<../asset-library-delivery/specification/interaction-rules.md>)

## Related journeys

- [UJ-A03 — Edit a shared asset definition](edit-asset-definition.md)
- [UJ-A05 — Open an asset shape or source note and return](open-asset-shape-or-note.md)
- [UJ-A06 — Leave or retain an unsaved asset draft](leave-unsaved-asset-draft.md)
