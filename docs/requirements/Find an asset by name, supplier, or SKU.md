---
type: PBI
parent: "[[Searchable asset catalog]]"
order: 40
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

# Find an asset by name, supplier, or SKU

The catalogue exists so a renovator finds an asset before defining it twice, and the search is the fast route to it: one field, matched against the three facts a person actually remembers about a product — its name, who sells it, and its SKU.

## Actor

A renovator who knows something about the asset they want and not where it is shelved.

## Main flow

1. The renovator types a search term.
2. Matching assets appear inside their categories, which expand to show them.
3. They select a result.
4. They clear the search, and the groups return to how they were.

## Extensions

- **1a. The term carries whitespace or a different case —** " ep-190 " still finds SKU EP-190.
- **1b. A draft is open on the selected asset.** Searching leaves it intact; no protection dialog appears.
- **2a. Nothing matches.** A search-empty state draws, with a reset control and the term still visible.
- **3a. The selected asset is not among the results.** It stays selected; the wide inspector says why it is not in the list.

## Guarantee

**Search narrows what is listed and never what is selected or drafted.**

## Acceptance criteria

- With Oak parquet carrying SKU EP-190, entering " ep-190 " lists Oak parquet.
- A search matching nothing draws the search-empty state and a reset.
- Searching with a dirty draft open neither prompts nor loses the draft.

## Scope

No fuzzy matching, no external product search, and no new persisted asset property.

## Asset-library implementation (2026-09-05)

Adaptation: `AssetLibraryStore` joins category to the name, supplier and SKU match, matching groups expand, and the inspector explains an excluded selection. Covered by `assetLibraryRoot` and `assetDraftProtection`.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 03.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-03 and its package feature
group; screens [AL02](../user-experience/asset-library-delivery/specification/screens/AL02-search-results.md); `delivery-record.md` row 03. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-03.
