---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 80
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
dependsOn: "[[Understand a project's price sources]]"
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

# Apply or discard a project's own price deliberately

The register recorded this as a change to shipped behaviour rather than a gap — [[A field edit commits on blur, and two design packages ask for an explicit Apply]] — because the shared field hook wrote on blur. For project price rows that decision is taken: typing and blur write nothing, Apply or Enter dispatches once, Cancel or Escape discards. The shared hook's contract is unchanged; only these rows stopped binding blur.

## Actor

A renovator setting or correcting a project's own price for an asset.

## Main flow

1. The renovator edits a price in a row of the prices subsection.
2. The row shows a draft; Apply becomes available.
3. They activate Apply, or press Enter.
4. The versioned write runs once, and the confirmed price replaces the draft.

## Extensions

- **1a. They type a decimal comma —** `12,50` is normalised to `12.50` at the boundary; a canonical dot is accepted as well.
- **1b. They type grouping, mixed separators, a sign or an exponent.** The draft is refused as invalid; zero remains a valid price.
- **2a. They press Escape or Cancel before dispatch.** The draft is discarded and nothing is written.
- **3a. The write is in flight.** The row is locked; Cancel is not undo.
- **4a. The row started with no saved override and an empty draft.** No action to remove a non-existent override is offered.

## Guarantee

**Until the write is confirmed the saved and the used price are unchanged, and no keystroke or blur ever writes.**

## Acceptance criteria

- Typing a price and moving focus away writes nothing.
- Entering `12,50` and pressing Enter stores 12.50 once.
- Escape on a dirty row restores the saved value without a write.

## Scope

No change to `useFieldCommit`'s API; DOM blur binding belongs to callers and the Plan Editor Inspector keeps its own gesture. Product-wide unification stays with the linked issue.

## Project-surface implementation (2026-09-05)

`AssetPriceRow` binds explicit controls; the expected version is captured when editing starts and frozen for the draft; the decimal parser accepts an unsigned amount with at most two fractional digits. Price and concurrency tests and the harness cover it (WP-04).

Delivered by pull request #73 (`codex/project-experience`). Live-vault observation — host history, split
leaves, a forced leaf close — is still unrun, so this note is Active rather than Done. Evidence and the
remaining limitations: [execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-07 and its §1 rows; screens [P04](../user-experience/renovation-planner-project-specs/screens/P04-project-prices.md); the execution record's WP-00 decisions. Adopted into the register on
2026-09-05 with the rest of that package's ten; the five gaps the adoption ledger found were written the same day
and are its siblings under [[Project dashboard and navigation]].
