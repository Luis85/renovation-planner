---
type: PBI
parent: "[[Searchable asset catalog]]"
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
dependsOn: "[[Open and resume the shared asset library]]"
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

# Compare and select assets within category groups

The catalogue is read as shelves — one per category — with each row's facts aligned under a shared header so two assets can be compared without opening either. Selection is by asset id, and a detail read that comes back late must not repaint the inspector with the asset the renovator has already left.

## Actor

A renovator choosing between assets of one kind.

## Main flow

1. The renovator expands a category.
2. They read the aligned comparison values across its rows.
3. They select an asset.
4. The inspector shows that asset.

## Extensions

- **1a. The category is empty.** Its group is inert; it cannot be expanded and offers nothing to select.
- **3a. A detail response for asset A arrives after asset B was selected.** It is dropped. The row marker and the inspector show only B.
- **3b. Focus and selection part ways —** arrow keys move focus over rows without selecting. The two are drawn distinguishably.

## Guarantee

**The row marker and the inspector always name the same asset, whatever order the reads return in.**

## Acceptance criteria

- With A selected and its detail read still running, selecting B and then letting A's response arrive leaves the marker and inspector on B.
- An empty category cannot be expanded.
- Moving focus over rows changes no selection.

## Scope

No sorting menus, no multi-selection, and no use of type icons as evidence that geometry exists.

## Asset-library implementation (2026-09-05)

Adaptation: `AssetShelves`, `AssetShelf` and `AssetRow` gained the shared comparison header; id selection and `AssetSelectionStore`'s ticketed reads were retained, and the shelf, row and selection-store tests cover them.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 02.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-02 and its package feature
group; screens [AL00](../user-experience/asset-library-delivery/specification/screens/AL00-browse.md), [AL01](../user-experience/asset-library-delivery/specification/screens/AL01-selected-object.md); `delivery-record.md` row 02. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-02.
