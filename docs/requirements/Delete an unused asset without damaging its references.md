---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 100
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
  - "[[Understand project usage and each project's price source]]"
  - "[[Continue safely after save failures or external changes]]"
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

# Delete an unused asset without damaging its references

Deletion is the one gesture that can strand a plan. The command, not the screen, is what decides: it re-checks the referent set at commit, so a reference created between the usage check and the confirmation refuses the deletion. The sidecar half of the same gesture is [[Delete an asset without stranding its shape]].

## Actor

A renovator retiring an asset they no longer use.

## Main flow

1. The renovator chooses the secondary Delete action.
2. Current usage is checked.
3. They confirm an allowed deletion.
4. The confirmed catalogue state draws, with focus on a meaningful successor.

## Extensions

- **2a. Usage is unknown because the read failed.** Deletion is blocked.
- **2b. The asset is referenced.** Deletion is blocked and the usage is shown; removal goes only through the existing explicit reference resolution.
- **3a. A requirement starts referencing the asset between the check and the commit.** The command refuses and the asset stays.

## Guarantee

**An asset is removed only when the command itself, at commit, finds nothing referencing it.**

## Acceptance criteria

- With no references at check time and one created before the commit, the command prevents the deletion and the asset remains in the catalogue.
- A failed usage read blocks Delete.

## Scope

No automatic deletion of project requirements, and no Undo promise without a restoration contract.

## Asset-library implementation (2026-09-05)

Fulfilled at baseline, integrated with the draft guard: `deleteAssetFlow` → `deleteWithReferences`, the current reference query, the locked command check, compensation and focus restoration. Covered by `assetDelete` and the reference refusal and compensation suites.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 17.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-17 and its package feature
group; screens [AL11](../user-experience/asset-library-delivery/specification/screens/AL11-delete-object.md); `delivery-record.md` row 17. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-17.
