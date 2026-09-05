---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 60
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
dependsOn: "[[Explicitly save or discard asset metadata changes]]"
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

# Change an asset's unit and waste allowance correctly

The unit decides what a requirement's quantity means, so changing it on an asset that requirements already reference can silently turn square metres into metres. The domain refuses that; this note is the library honouring the refusal at the field, and keeping the waste percentage a person types apart from the fraction the note stores.

## Actor

A renovator correcting how an asset is measured.

## Main flow

1. The renovator changes the unit or the waste allowance.
2. The input is validated.
3. An allowed change is saved.
4. The updated unit or percentage is read back.

## Extensions

- **2a. The unit change alters the dimension kind of a referenced asset.** It is refused with the domain rule, explained at the unit field.
- **2b. The waste value is non-finite or outside 0–100 %.** It is invalid at the field.
- **4a. Display and storage differ —** the form shows 8 %, the note stores 0.08, and the two are never confused.

## Guarantee

**A stored unit changes only when every requirement referencing it can still be measured in it.**

## Acceptance criteria

- With an area-unit asset referenced by an area requirement, saving a length unit leaves the stored unit unchanged and explains the refusal at the field.
- Typing 8 in the waste field stores 0.08.

## Scope

No implicit quantity conversion and no recalculation outside the existing domain contract.

## Asset-library implementation (2026-09-05)

Adaptation: the percentage is converted with Decimal, bounds are finite, and the `asset.unit-kind-referenced` refusal lands at the unit field. Covered by `assetInspectorFields` and the existing asset command tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 08.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-08 and its package feature
group; screens [AL04](../user-experience/asset-library-delivery/specification/screens/AL04-edit-definition.md); `delivery-record.md` row 08. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-08.
