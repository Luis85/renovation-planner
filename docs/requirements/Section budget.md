---
type: PBI
parent: "[[Construction sections]]"
order: 40
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
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
release: "[[MVP]]"
---

# Section budget

## Actor

[[Private renovator]] checking or setting the amount available for one renovation job.

## Preconditions

- A construction section exists.
- Any work packages and cost items included in it can be queried.
- The project defines the currency used by its money values.

## Main flow

1. The renovator opens the construction section's budget.
2. The plugin derives the section total from the work packages and cost items the section
   contains, following the project cost hierarchy.
3. The plugin shows the derived total in the project's currency and exposes the contributing
   values so the total can be taken apart.
4. The renovator may enter an explicit section-budget override.
5. The plugin stores the override separately from the derived total, with provenance that it was
   entered manually.
6. The budget view shows the effective amount and identifies whether it comes from derivation or
   from the manual override.
7. Removing the override reveals the current derived total again.

## Extensions

- **2a** — The section contains no priced work. The derived total follows the cost authority's
  empty-aggregation rule; the plugin does not invent a manual budget.
- **2b** — A contributing value is stale, unreadable or uses a conflicting currency. The section
  total is marked stale or refused under the cost authority's rule rather than presented as a
  trustworthy total.
- **4a** — The override is invalid for the project's currency or amount rules. It is refused and
  the previous effective budget remains.
- **5a** — Persisting or removing the override fails. The failure is reported and the unsaved
  provenance is not presented as saved.
- **7a** — Underlying costs changed while an override was active. Removing it reveals a newly
  derived total from the current contributors, not the old pre-override figure.

## Guarantee

The section budget is either a reproducible aggregation of its authoritative contributors or an
explicit manual override whose separate storage and provenance remain visible; the two are never
silently blended.

## Out of scope

- Creating or editing work packages and cost items.
- Project-level contingency, tax or currency conversion.
- Actual-cost and invoice workflows.
- Defining cost formulas already owned by the cost and budget authorities.
- Automatically allocating a project budget among sections.

## Acceptance criteria

1. With no override, the section total equals the authoritative aggregation of its work packages
   and cost items.
2. The displayed total uses the project's currency.
3. Contributors can be inspected so the derived total is explainable.
4. Entering an override does not overwrite or alter the derived total.
5. A stored override is explicitly identified as manual and retains its provenance across reload.
6. Removing the override reveals a total recomputed from current contributors.
7. Stale, unreadable or currency-conflicting contributors cannot silently produce a trustworthy
   derived total.
8. A failed override write is not displayed as saved.

## Assumptions

1. The effective section budget prefers a present manual override over the derived total while
   retaining both values distinctly.
2. Override provenance records at least that the value is manual; richer audit authorship and
   timestamps belong to a later audit capability.
3. Aggregation and currency rules remain owned by the existing cost and budget model.

## Sources

- PRD §10 (Cost Hierarchy).
- PRD §16 (construction-section budget).
- PRD §72 (currency authority).
- PRD §89 (Manual Overrides).
- [[Construction sections]].
