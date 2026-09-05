---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 20
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
dependsOn: "[[Compare and select assets within category groups]]"
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

# Inspect the complete definition of a selected asset

The inspector is where a renovator judges an asset before using or changing it, so it has to show the whole production contract — including the fields the mockup left out — and each section has to load on its own, so a slow geometry read never blanks the price.

## Actor

A renovator with an asset selected.

## Main flow

1. The renovator selects an asset.
2. They read its identity, its metadata, its price in its own currency with its unit, its height, and — loaded independently — its geometry and its usage.

## Extensions

- **2a. A section has not loaded yet.** It draws as loading, never as zero.
- **2b. The price is in a currency other than the vault default.** That currency is shown; nothing is converted or relabelled.
- **2c. Height is absent.** It is shown as absent; no default is invented.

## Guarantee

**Every value drawn is a value read; nothing is invented to fill a field.**

## Acceptance criteria

- An asset priced in USD with a stored height shows USD and that height with its unit, not EUR or a default.
- Before the geometry read resolves, the shape section shows a loading state and the price section is unaffected.

## Scope

No new procurement, quantity or project fields on the definition.

## Asset-library implementation (2026-09-05)

Adaptation: `AssetInspectorFields` shows explicit currency, millimetres and percentage; the shape preview reads the real `GetAssetDesign`. Field and shape tests cover it.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 04.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-04 and its package feature
group; screens [AL01](../user-experience/asset-library-delivery/specification/screens/AL01-selected-object.md), [AL07](../user-experience/asset-library-delivery/specification/screens/AL07-shape-and-note.md); `delivery-record.md` row 04. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-04.
