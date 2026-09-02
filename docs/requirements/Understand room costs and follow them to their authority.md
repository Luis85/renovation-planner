---
type: PBI
parent: "[[Planning depth]]"
order: 20
status: New
horizon: "V1"
release: ""
dependsOn:
  - "[[Cost items and price components]]"
  - "[[Budget aggregation]]"
  - "[[Project settings]]"
---

# Understand room costs and follow them to their authority

## Actor

[[Private renovator]], while checking the financial consequence of work in a selected room.

## Preconditions

- A room or equivalent spatial scope is selected.
- The selected project defines its authoritative currency.
- Cost items and budget aggregation can be queried for the selected scope.

## Main flow

1. The renovator opens Costs for the selected room.
2. The editor queries the authoritative cost and budget read models with that room's spatial id.
3. The Inspector shows planned, committed and actual amounts, remaining cost under the budget
   authority's definition, and a breakdown by work group and cost category.
4. Every amount is formatted in the project's currency and reconciles to the visible authoritative
   items.
5. The renovator expands a group or selects a cost row.
6. The editor reveals the related work or surface and provides a route to the source cost,
   material, quote, invoice, document or supplier record.
7. When the renovator requests quote comparison, the editor opens the dedicated quote-comparison
   capability with the current context; the Inspector performs no comparison itself.

## Extensions

- **2a** — The cost query fails. The previous spatial view remains available and a failure is
  shown; zero is not substituted for an unreadable total.
- **3a** — No costs are linked. The Inspector shows an empty contextual state without implying
  that the project budget is zero.
- **3b** — A calculated estimate is stale. It is labelled stale and exposes its quantity, rate
  and waste provenance from the calculation authority.
- **4a** — An item has a currency that conflicts with the project. The authoritative refusal is
  shown; the Inspector neither converts nor silently aggregates it.
- **6a** — A referenced authority is missing or unreadable. The broken relationship is identified
  without manufacturing a replacement cost record.
- **7a** — Quote comparison is unavailable. The route is disabled with a reason; no narrow
  Inspector comparison is substituted.

## Guarantee

Every room total is a query result from the authoritative cost and budget model, shown in the
project currency and traceable to the records that compose it; the Inspector never owns a stored
total or quote comparison.

## Out of scope

- Accounting, tax advice or invoice reconciliation beyond the owning cost features.
- Currency conversion.
- Inspector-owned quote normalization, scoring or selection.
- Stored room-total or marker numbers.
- Full project budget management inside the plan editor.

## Acceptance criteria

1. Selecting a room returns only cost items included by the authoritative spatial query.
2. Planned, committed and actual totals reconcile to the visible items under the budget
   authority's rules.
3. Every displayed amount uses the selected project's currency and no conflicting currency is
   silently aggregated.
4. Selecting a row can reveal its related spatial/work context and open its authoritative record.
5. A calculated estimate exposes quantity, rate and waste provenance and remains visibly distinct
   from an override.
6. A query failure cannot render as a legitimate zero or empty total.
7. Quote comparison opens the dedicated authority and no quote-comparison state or arithmetic
   exists in the Inspector.
8. Room badges or markers, if shown, derive their number on read and persist no total.

## Assumptions

1. V1 is a contextual explanation and navigation surface over the cost model, not a replacement
   budget dashboard.
2. Remaining cost uses the definition owned by the budget authority; this PBI introduces no
   competing formula.
3. Costs may link to several authority types, so missing references are represented per row rather
   than invalidating every readable room cost.

## Sources

- [[M13-room-costs]]
- [Renovation Planner — Editor Component Library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [[Renovation Planner — Editor Interaction & Mental Model Specification]]
- [[Renovation Planner — Editor UX Research & Pattern Study]]
- [Renovation Planner — Editor Implementation Plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [[Cost and budget engine]]
- [[Cost items and price components]]
- [[Budget aggregation]]
- [[Project settings]]
- [[Quote comparison]]
