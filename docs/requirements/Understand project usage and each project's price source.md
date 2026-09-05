---
type: PBI
parent: "[[Searchable asset catalog]]"
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

# Understand project usage and each project's price source

Before touching a shared definition a renovator needs to know what it touches back: which projects reference it, how many requirements each holds, and whether each pays the library price or its own. That region sits above the definition, because it is what decides whether to edit at all.

## Actor

A renovator about to change or delete an asset.

## Main flow

1. The renovator selects an asset.
2. They read the projects using it, each with its requirement count and its price source.
3. They can tell whether the usage check has completed.

## Extensions

- **2a. The usage read failed.** That is drawn as a failure with a retry — never as no usage.
- **2b. A project holds an override.** It is labelled Project-specific price; the others are labelled Library price.
- **2c. A late response arrives after reselection.** It is dropped; current data draws.

## Guarantee

**An empty usage list is shown only after a read that succeeded.**

## Acceptance criteria

- With project A on the library price and project B on its own, the usage section labels A Library price and B Project-specific price.
- A failed usage read draws a failure and a retry, not an empty list.

## Scope

No inventory quantities and no cross-project totals. Navigation to a project is [[Navigate from an asset to its note or a project using it]].

## Asset-library implementation (2026-09-05)

Adaptation: `AssetInspectorUsedIn` precedes the definition and names both price sources over the real `ListRequirementsReferencing` and `ListOverridingProjects`. Covered by the used-in and selection tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 10.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-10 and its package feature
group; screens [AL06](../user-experience/asset-library-delivery/specification/screens/AL06-usage-and-price.md); `delivery-record.md` row 10. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-10.
