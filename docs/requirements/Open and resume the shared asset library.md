---
type: PBI
parent: "[[Searchable asset catalog]]"
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
dependsOn: ""
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

# Open and resume the shared asset library

A renovator keeps the catalogue open in a side leaf and comes back to it many times in a session. Each return should land where they left — the same leaf, the same asset selected, the same groups open — and a second activation must never open a second copy of a singleton view.

## Actor

A renovator, in any vault, with or without a project.

## Main flow

1. The renovator activates the ribbon button or the command.
2. The plugin reuses the existing library leaf, creating one only when none exists.
3. The catalogue loads.
4. The leaf's saved selection and expanded groups are restored where they are still valid.

## Extensions

- **2a. Two activations arrive in one tick —** a double click on the ribbon, or a command and a click. One leaf exists and both activations reveal it.
- **3a. The vault has no projects.** The entry point is still offered, and the library opens on its assets or on the empty state.
- **3b. The catalogue is still loading.** A loading state draws; it is never mistaken for an empty library.
- **4a. The saved selection names an asset no longer in the catalogue.** A neutral state draws — never another asset's details in its place.

## Guarantee

**There is exactly one library leaf, and what it shows on return is either the renovator's own last state or a visibly neutral one — never another asset's.**

## Acceptance criteria

- In a vault with no projects and two asset notes, activating the open-library command twice leaves exactly one library leaf, with both assets reachable.
- Reopening a leaf whose saved selection has since been deleted draws the neutral inspector, not a neighbour.
- While the first read is in flight the empty-library state is not drawn.

## Scope

No new global navigation and no second ribbon icon.

## Asset-library implementation (2026-09-05)

Fulfilled at baseline: `AssetLibraryView`, its root and the persisted leaf state, with `plugin/assetLibraryWiring` and `library/assetLibraryViewState`. The in-flight map in `revealView` is what coalesces the double activation.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 01.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-01 and its package feature
group; screens [AL00](../user-experience/asset-library-delivery/specification/screens/AL00-browse.md), [AL08](../user-experience/asset-library-delivery/specification/screens/AL08-empty-library.md); `delivery-record.md` row 01; enabler [EN-01](../user-experience/asset-library-delivery/enablers/EN-01.md). The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-01.
