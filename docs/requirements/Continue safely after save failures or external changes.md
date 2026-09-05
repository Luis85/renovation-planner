---
type: PBI
parent: "[[Asset definitions and categories]]"
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
  - "[[Explicitly save or discard asset metadata changes]]"
  - "[[Keep valid content after loading failures and retry the affected read]]"
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

# Continue safely after save failures or external changes

A Save has more than two outcomes. This note names them — rejected, conflict, confirmed, confirmed but not read back, unknown — and says what the renovator may do after each, so that partial persistence is never shown as success and a write whose outcome is unknown is never blindly repeated.

## Actor

A renovator whose Save did not simply succeed.

## Main flow

1. The renovator saves a changed draft.
2. The outcome is distinguished and shown.
3. They correct rejected input, refresh after a confirmed write whose read-back failed, or review the differences after a conflict.

## Extensions

- **2a. The note changed since the draft began.** It is not overwritten. The draft and the captured version are kept, the differences are listed, and adopting the current data is an explicit discard.
- **2b. The write was confirmed and the read-back failed.** The submitted values stay, a refresh is offered, Save is disabled, and the refresh performs only a read.
- **2c. The outcome is unknown.** A repeat save is blocked until the current note has been inspected.

## Guarantee

**Partial persistence is never presented as complete success, and no non-idempotent write is retried on an unknown outcome.**

## Acceptance criteria

- With a write confirmed and its read-back failed, activating the offered refresh runs no write and clears the notice after a successful read.
- An external edit between draft start and Save produces the conflict state with the draft intact.

## Scope

No invented rollback. Where recovery is not supported the limitation is stated.

## Asset-library implementation (2026-09-05)

Missing at baseline. The expected version now travels from the catalogue query; conflict differences and the rejected, confirmed-read-failed and unknown states are drawn; no retry write follows an ambiguous fault. Covered by the field and vault commit tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 14.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-14 and its package feature
group; screens [AL04](../user-experience/asset-library-delivery/specification/screens/AL04-edit-definition.md), [AL09](../user-experience/asset-library-delivery/specification/screens/AL09-loading-and-errors.md); `delivery-record.md` row 14. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-14.
