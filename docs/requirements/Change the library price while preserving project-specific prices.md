---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 50
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
dependsOn:
  - "[[Explicitly save or discard asset metadata changes]]"
  - "[[Understand project usage and each project's price source]]"
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

# Change the library price while preserving project-specific prices

A project may record its own price against a shared definition, as a separate override. Correcting the catalogue price must leave every such override alone, and the library must not claim that project costs moved merely because the asset note was written.

## Actor

A renovator updating a supplier's list price.

## Main flow

1. The renovator reads the asset's usage and each project's price source.
2. They edit the shared price.
3. They save.
4. They see the confirmed library price, and the project overrides unchanged.

## Extensions

- **2a. The input is invalid or negative.** It is rejected at the field.
- **2b. A project holds its price in another currency.** Nothing is converted.
- **4a. The write succeeded.** The UI still does not claim that downstream project costs have recalculated; the event bus reports those separately.

## Guarantee

**Changing the library price never touches a project's own price.**

## Acceptance criteria

- With the library at 34.95 EUR per m² and project B at its own 31.00 EUR per m², saving 36.90 leaves the library at 36.90 and B at 31.00.
- A negative price is refused at the field.

## Scope

No override editing in the library, no exchange rates, no catalogue total.

## Asset-library implementation (2026-09-05)

Adaptation: the same Money and `UpdateAsset` path, submitting only changed fields. The existing `assetCascadeWithOverrides` and `assetPriceOverrideCascade` tests were retained.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 07.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-07 and its package feature
group; screens [AL04](../user-experience/asset-library-delivery/specification/screens/AL04-edit-definition.md), [AL06](../user-experience/asset-library-delivery/specification/screens/AL06-usage-and-price.md); `delivery-record.md` row 07. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-07.
