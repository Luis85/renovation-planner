---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 70
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
dependsOn: "[[Choose the next step from a project's details]]"
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

# Understand a project's price sources

A project can record its own price against a shared asset, so any figure it uses has two possible sources. The prices subsection puts the catalogue price, the saved project price and the one actually in force side by side, and refuses to invent a value where the domain has none: a missing price is not zero, a foreign currency is not converted, and an asset no plan uses is not called installed.

## Actor

A renovator checking what a project will pay for its materials.

## Main flow

1. The renovator opens the prices subsection from the project's details.
2. The section names the current project and lists its assets with the catalogue price, the saved project price and the price in force.
3. They read which source each row uses.
4. Back to project returns them to the detail state with its context intact.

## Extensions

- **2a. An asset has no usable price.** The row says No usable price; nothing shows zero.
- **2b. The saved override is zero.** That is a real price and is shown as one.
- **2c. The catalogue price is in another currency.** The row marks the mismatch; nothing is converted and no candidate is silently preferred.
- **2d. An asset is orphaned or unreadable.** The row stays, marked as such, so the saved price is not hidden.
- **2e. The price read fails.** The failure is regional; the rest of the project's actions keep working.

## Guarantee

**Every price drawn is a price the resolver produced; the section never invents a unit, a conversion or a zero.**

## Acceptance criteria

- An asset with a library price and a project override shows both, with the override marked as the one in force.
- An asset with no price in either place shows No usable price.
- A price read failure leaves the plan and note actions usable.

## Scope

No second price engine in Vue: the projection comes from `ListProjectAssetPrices` and `resolveEffectiveUnitCost`. Catalogue assets not placed in any plan are not called installed materials.

## Project-surface implementation (2026-09-05)

The dedicated host subsection sits in Obsidian's own view state beside the project id, so a project-id-only state still selects the details. `ListProjectAssetPrices` joins readable catalogue entries and versioned overrides and retains orphan and unreadable rows; the resolver prefers the override and refuses foreign currency. Price and DTO tests and the harness cover it (WP-04).

Delivered by pull request #73 (`codex/project-experience`). Live-vault observation — host history, split
leaves, a forced leaf close — is still unrun, so this note is Active rather than Done. Evidence and the
remaining limitations: [execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-06 and its §1 rows; screens [P04](../user-experience/renovation-planner-project-specs/screens/P04-project-prices.md); the execution record's WP-00 decisions. Adopted into the register on
2026-09-05 with the rest of that package's ten; the five gaps the adoption ledger found were written the same day
and are its siblings under [[Project dashboard and navigation]].
