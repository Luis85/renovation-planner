---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 30
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: "P0"
assignee: ""
iteration: ""
dependsOn: "[[Inspect the complete definition of a selected asset]]"
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# Explicitly save or discard asset metadata changes

The register recorded this as a change to shipped behaviour rather than a gap — [[A field edit commits on blur, and two design packages ask for an explicit Apply]] — because the inspector used to write each field on blur. This note is the flow that decision produces: one local draft over all nine fields, one Save, one write.

## Actor

A renovator correcting a definition.

## Main flow

1. The renovator changes a field — name, category, supplier, SKU, notes, price, unit, waste or height.
2. The inspector shows a local draft; Save becomes available.
3. They activate Save.
4. The confirmed values are read back into the row and the note — or they choose Discard and the draft is gone.

## Extensions

- **1a. Focus leaves the field.** Nothing is written.
- **3a. Validation rejects the draft.** Input is kept and the error sits at the field that caused it.
- **3b. Save is activated twice in quick succession.** One commit runs.
- **3c. The note changed since the draft began.** The conflict flow of [[Continue safely after save failures or external changes]] applies.
- **4a. The note carries metadata the form does not edit.** It is preserved through the write.

## Guarantee

**Nothing reaches the vault until Save is activated, and one Save is one write of one note.**

## Acceptance criteria

- With the stored supplier Timber supplier and extra metadata the form does not show, changing it to Northern timber supplier and saving leaves the re-read note with the new supplier and the extra metadata unchanged.
- Blurring a changed field writes nothing.
- A rejected draft keeps its input and shows the error at the field.

## Scope

Price and unit carry their own rules in [[Change the library price while preserving project-specific prices]] and [[Change an asset's unit and waste allowance correctly]]. The prototype's array-snapshot undo is not copied; no Undo is shown, because no reversible whole-definition contract exists.

## Asset-library implementation (2026-09-05)

Missing at baseline. `useDefinitionDraft` and `definitionDraft` hold the draft; `UpdateAsset` gained an optional expected version and `changes.height`, so all nine fields fit one conditional note write (the EN-02 decision). Covered by `assetInspectorFields` and `assetDefinitionCommit`.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 05.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-05 and its package feature
group; screens [AL04](../user-experience/asset-library-delivery/specification/screens/AL04-edit-definition.md); `delivery-record.md` row 05; enabler [EN-02](../user-experience/asset-library-delivery/enablers/EN-02.md). The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-05.
