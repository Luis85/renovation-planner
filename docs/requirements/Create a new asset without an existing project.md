---
type: PBI
parent: "[[Asset definitions and categories]]"
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
dependsOn:
  - "[[Open and resume the shared asset library]]"
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

# Create a new asset without an existing project

A catalogue is meant to outlive any one project, so it must be possible to start one before a project exists. Creation asks for deliberate values — a price is typed, not defaulted to zero — and does not require a shape.

## Actor

A renovator building a catalogue, possibly in a vault with nothing else in it.

## Main flow

1. The renovator chooses New asset, from the empty state or the header.
2. They enter the required data deliberately.
3. They create the asset.
4. It is selected in its category.

## Extensions

- **2a. They cancel.** No file is created.
- **2b. They leave the price empty.** It is not replaced with zero; a zero is one they typed.
- **2c. They give no outline.** Creation proceeds; geometry is not a prerequisite.
- **2d. A similar name exists.** A hint may appear; nothing is merged.

## Guarantee

**A catalogue can exist before any project, and one creation writes exactly one note.**

## Acceptance criteria

- In a vault with neither projects nor assets, creating an asset with a name, category, unit and typed price but no outline leaves exactly one new note, selected in its category.
- Cancelling the form creates nothing.

## Scope

No geometry prerequisite, no import, no automatic sample data.

## Asset-library implementation (2026-09-05)

Adaptation: `NewAssetForm` starts with a blank price and permits an explicit zero; creation still guards duplicate and partial geometry writes; the root selects the result instead of opening the designer, through main's `openNewAssetDialog`. Covered by the form and root-door tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 09.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-09 and its package feature
group; screens [AL03](../user-experience/asset-library-delivery/specification/screens/AL03-create-object.md), [AL08](../user-experience/asset-library-delivery/specification/screens/AL08-empty-library.md); `delivery-record.md` row 09. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-09.
