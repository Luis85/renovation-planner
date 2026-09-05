---
type: PBI
parent: "[[Searchable asset catalog]]"
order: 80
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: "P1"
assignee: ""
iteration: ""
dependsOn: "[[Navigate from an asset to its note or a project using it]]"
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

# Access asset information through native Obsidian notes and Bases

The Epic promises a catalogue reachable through Bases and not only through this plugin's view. The register's own note for that gap is [[Reach the asset catalogue without this plugin's own view]], still open on [[What discharges the catalogue's Bases access is undecided]]. This note records the part the delivery discharged: a documented recipe over the frontmatter every asset note already carries, and no new view, no generated `.base` file and no schema change.

## Actor

A renovator reading the catalogue without opening the plugin.

## Main flow

1. The renovator follows the documented native route.
2. They open an asset note, or a built-in Base table filtered on the asset type.
3. They read the catalogue-compatible metadata.

## Extensions

- **2a. Only existing production frontmatter —** is promised as a column.
- **2b. Geometry and cross-project joins —** are not advertised as native capabilities; they need the plugin's queries.
- **2c. No `.base` file is created automatically —** until the strategy in the linked issue is decided.

## Guarantee

**What the recipe promises is exactly what an asset note already carries.**

## Acceptance criteria

- Following the recipe against a real asset note reads the supported metadata outside the library view.
- The recipe names no column that the data contract does not.

## Scope

No automatic Base creation and no new Bases engine.

## Asset-library implementation (2026-09-05)

Documentation adaptation: [native-access.md](../user-experience/asset-library-delivery/native-access.md), restricted to actual frontmatter; the existing open-note adapter and repository tests stand as evidence.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 18.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-18 and its package feature
group; screens [AL07](../user-experience/asset-library-delivery/specification/screens/AL07-shape-and-note.md); `delivery-record.md` row 18; enabler [EN-01](../user-experience/asset-library-delivery/enablers/EN-01.md). The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-18.
