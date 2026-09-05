---
type: PBI
parent: "[[Searchable asset catalog]]"
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
dependsOn:
  - "[[Switch assets without accidentally losing input]]"
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

# Navigate from an asset to its note or a project using it

The library is a door, not a dead end: from an asset a renovator goes to its note or to a project using it, through the host's own navigation, and comes back to the library as they left it.

## Actor

A renovator following an asset out into the vault.

## Main flow

1. The renovator activates Open note, or a project row in the usage region.
2. If a draft is dirty, the protection dialog runs first.
3. The resolved target opens through host navigation.
4. On return the library context is recovered.

## Extensions

- **1a. The note has moved or is missing.** The currently resolved path opens, or the missing outcome is shown; no file is created at an old path.
- **1b. The project sits at the vault root.** That is a valid target.
- **2a. They cancel the protection dialog.** Nothing opens.

## Guarantee

**The library opens only a target that exists at the path it currently resolves to.**

## Acceptance criteria

- With an asset's note moved within the vault, Open note opens the current path and creates nothing at the old one.
- Cancelling the protection dialog opens no destination.

## Scope

No project-detail page inside the library and no embedded copy of the note.

## Asset-library implementation (2026-09-05)

The project action was missing at baseline. `assetLibraryDeps` reuses `renovationProjectOpenProject`; note, designer and project actions all pass the draft guard; the missing-note refresh was retained. Covered by the inspector and plugin tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 11.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-11 and its package feature
group; screens [AL06](../user-experience/asset-library-delivery/specification/screens/AL06-usage-and-price.md), [AL07](../user-experience/asset-library-delivery/specification/screens/AL07-shape-and-note.md); `delivery-record.md` row 11. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-11.
