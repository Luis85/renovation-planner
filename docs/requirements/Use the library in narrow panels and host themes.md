---
type: PBI
parent: "[[Searchable asset catalog]]"
order: 90
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
  - "[[Find an asset by name, supplier, or SKU]]"
  - "[[Switch assets without accidentally losing input]]"
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

# Use the library in narrow panels and host themes

An Obsidian sidebar leaf is about 460 pixels wide, and a themed vault is the norm. The library has to fold into a list-or-detail layout at that width and take its colours from the host, without any of that touching what is selected, searched or drafted.

## Actor

A renovator with the library docked in a sidebar, under a community theme.

## Main flow

1. The renovator narrows the leaf.
2. They use the list, and the detail view with its Back control.
3. They change width and theme.
4. Selection, search and draft are preserved throughout.

## Extensions

- **1a. The leaf is 460 pixels wide.** There is no horizontal page scroll.
- **1b. Columns are hidden for width.** Their headings go with them.
- **1c. The viewport is short.** The content scrolls and the status stays visible.
- **3a. Theme controls —** exist only in the browser harness; none ships in the plugin.

## Guarantee

**Resizing or re-theming the leaf changes how the library is drawn and nothing about what is selected, searched or drafted.**

## Acceptance criteria

- With a dirty draft selected in a wide leaf, narrowing to 460 pixels and widening again preserves the asset id and the draft, with no horizontal page scroll at either width.
- Narrow Back hides the detail without clearing the selection.

## Scope

Not a mobile product: 460 pixels tests a leaf, not a platform. Mobile is [[Bound the mobile surface to what it can actually do]].

## Asset-library implementation (2026-09-05)

Adaptation: the existing container ladder was retained with a wider proportional inspector and sticky form actions; Back preserves the selected id and the draft. Covered by the keyboard tests and the AL10 captures.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 15.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-15 and its package feature
group; screens [AL10](../user-experience/asset-library-delivery/specification/screens/AL10-narrow-and-theme.md); `delivery-record.md` row 15. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-15.
