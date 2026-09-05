---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 90
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
dependsOn: "[[Apply or discard a project's own price deliberately]]"
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

# Remove a saved project price

Removing a project's own price is a write against the override record, not against the asset, and it is not the same gesture as cancelling a draft. Afterwards the row shows the catalogue price only if one exists and is usable — otherwise it says so, and never falls back to an invented zero.

## Actor

A renovator who wants a project to pay the catalogue price again.

## Main flow

1. The renovator chooses Clear on a row with a saved override.
2. The command targets that override's id and expected version.
3. On success the row draws the catalogue price, or No usable price.

## Extensions

- **1a. The asset is orphaned or unreadable.** Clear stays available while setting a new price is disabled.
- **2a. The override changed since the row was read.** Clear is rejected, the saved value stays, and the conflict is explained.
- **3a. There is no usable catalogue price.** The row says No usable price; nothing shows zero.

## Guarantee

**Clear removes exactly the saved override it was read against, and never the asset or anybody else's later write.**

## Acceptance criteria

- Clearing an override on an asset with a library price leaves the row on the library price.
- Clearing on an orphan asset removes the override and keeps new-price entry disabled.
- A stale Clear is refused and the saved value remains.

## Scope

No asset deletion and no new persistence; the existing clear command is reused.

## Project-surface implementation (2026-09-05)

`commitAssetPrice` in `ProjectDetailState` separates draft cancellation from override removal and acts only on the persisted override identity and version. Null, zero, orphan and conflict cases are tested (WP-04).

Delivered by pull request #73 (`codex/project-experience`). Live-vault observation — host history, split
leaves, a forced leaf close — is still unrun, so this note is Active rather than Done. Evidence and the
remaining limitations: [execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-08 and its §1 rows; screens [P04](../user-experience/renovation-planner-project-specs/screens/P04-project-prices.md); the execution record's WP-00 decisions. Adopted into the register on
2026-09-05 with the rest of that package's ten; the five gaps the adoption ledger found were written the same day
and are its siblings under [[Project dashboard and navigation]].
