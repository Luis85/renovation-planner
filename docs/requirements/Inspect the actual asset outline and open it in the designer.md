---
type: PBI
parent: "[[Searchable asset catalog]]"
order: 70
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
dependsOn: "[[Switch assets without accidentally losing input]]"
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

# Inspect the actual asset outline and open it in the designer

The shape region shows the outline the sidecar actually holds — or says plainly which of five states it is in — and offers the designer only where the designer can act. A damaged sidecar gets a read error, never a button that leads nowhere.

## Actor

A renovator checking whether an asset's shape has been captured.

## Main flow

1. The renovator selects an asset.
2. They inspect its real outline and dimensions, or its explicit state.
3. They activate Edit shape.
4. The existing designer opens on the same asset id.

## Extensions

- **2a. The state is one of not read, no shape, unscaled, measured or damaged.** Each is drawn distinctly.
- **2b. The sidecar is damaged and the designer cannot repair it.** A read error draws, with a local retry and no designer door.
- **2c. Dimensions are shown.** They are finite and carry their unit.

## Guarantee

**The designer is offered only where it can act; a damaged shape shows a read error, never a dead door.**

## Acceptance criteria

- With a damaged sidecar, the shape section shows a read error rather than No outline yet and offers no designer route.
- An unscaled outline is marked as such.

## Scope

No new designer or sidecar-repair capability; that is separate scope and a separate dependency.

## Asset-library implementation (2026-09-05)

Adaptation: `AssetInspectorShape` draws `AssetMark` from the real footprint with units and an unscaled warning; damaged shapes keep the designer unavailable. Covered by the shape tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 12.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-12 and its package feature
group; screens [AL07](../user-experience/asset-library-delivery/specification/screens/AL07-shape-and-note.md); `delivery-record.md` row 12. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-12.
