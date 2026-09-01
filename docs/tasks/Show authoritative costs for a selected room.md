---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Show authoritative costs for a selected room

## Evidence

M13 requires planned, committed, actual and remaining room costs. The mental model says costs
belong to spatial scope while remaining linked to the central budget model.

## Why it matters

A room total is actionable only when it means the same thing as the project budget and changes
with the records that compose it.

## Approach

Add a selection-scoped cost query over the authoritative cost and budget services. Return staged
totals and visible item groups in project currency, and render them in the Costs Inspector without
persisting room totals.

## Acceptance criteria

1. Each selected room returns only cost items included by the authoritative spatial relation.
2. Planned, committed and actual totals reconcile to the returned visible items.
3. Remaining uses the budget authority's definition and is not recomputed in presentation.
4. A query failure cannot appear as zero costs.
5. Every amount is formatted in the selected project's currency.

## Risks

- Different cost stages could be double-counted if the read model does not own reconciliation.
- Cached rows may outlive a project-currency change.

## Outcome

The Costs Inspector shows room-scoped numbers that agree with the central budget.
