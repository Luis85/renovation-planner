---
type: Issue
parent: "[[Project management]]"
order: 50
status: Done
started: 2026-08-24
finished: 2026-08-24
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# The vault holds many projects, and selecting one is not a portfolio

A decision taken, recorded with what it rejected. It was raised by
[[2026-08-24-ux-layer-backlog-reconciliation]] as decision 4, the sharpest of the five that
reconciliation listed and did not take.

## The question

The workspace PRD requires multiple projects in MVP scope: §35's Slice 1 succeeds when "a user can
create and reopen multiple renovation projects", §8 asks for a `Project Selection` top-level
context beside `Renovation Project`, and §10's Epic 1 is a "Renovation Planner Home" that lists
them.

**Two derived notes said the opposite**, and one of them **named the change it had not made**:
[[Project]]'s "Nothing here spans two projects… there is no portfolio. Admitting a second root is
one of the changes [[Professional planner]] would force." The other is
[[Professional planner]]'s own *Cross-project work* non-goal. They are the reconciliation's `c2`
and `c3`.

A third note is affected without having contradicted anything.
[[Start a renovation project]]'s preconditions record "the vault holds no project yet" and then
say the second-project case "raises questions this note does not answer … and none of them are
settled anywhere in this register". **A note that declines to answer cannot contradict a document
that answers**, so the reconciliation withdrew that row to `present`. It is edited here because
this decision *settles* the question it flagged as open — not because it opposed anything.

Both contradictions were traced back to the original PRD and SDD sections their notes cite — §58,
§72 and SDD §47 — and found **faithful**. So this is not a drift to repair. It is a product
decision superseding received material, which is why it could not be read off the corpus and had
to be taken.

## The decision

> **The vault may hold many projects, and a Home lists them so one can be opened. [[Project]]
> remains the sole root of the relationship model, SDD §47's per-project index is untouched, and
> nothing aggregates across projects.**

**Selecting among projects is not a portfolio.** That distinction is the whole content of this
decision, and every consequence below follows from it.

## Why

- **The PRD draws this line itself, in two places.** §8 asks for a selection *context*; §34 places
  **cross-project dashboards** in Post-MVP Scope. Taking selection now and deferring aggregation is
  not a compromise between the two documents — it is what the received document already says.
- **Selection costs no structural change.** A list of projects is a surface. It reads project notes
  and opens one. It adds no relationship that spans two projects, so §58's model, §72's per-project
  currency and SDD §47's per-project index are all untouched — which is exactly what the entity
  note was protecting when it refused a second root.
- **Aggregation is the thing that would cost one**, and nothing asks for it in MVP. A cross-project
  budget or dashboard has to sum across projects, which needs a root above [[Project]] and an index
  that is not scoped to one. That is the "second root" [[Project]] names, and it stays refused.
- **It leaves [[Professional planner]] where it is.** That actor is out of scope, and the reason
  given was cross-project work on a client's behalf. Choosing between your own two renovations is
  not that, and conflating the two is what made this look like a bigger decision than it is.

## Alternatives rejected

**A portfolio now.** Cross-project dashboards and aggregate views in MVP. Rejected against the
PRD's own placement of them in §34's Post-MVP list, and because it forces the second root, a
rearchitected index, and effectively admits [[Professional planner]] — a much larger change than
anything asking for it today.

**Defer multi-project entirely.** Keep the single-project model and move the PRD's Epic 1 and Slice
1 out of MVP. Rejected because §35 makes multiple projects the success criterion of the *first*
slice; deferring it does not simplify the MVP, it contradicts its delivery plan.

**Admit the second root now, build the UI later.** Change the domain model so no rework is needed
when a portfolio arrives. Rejected as paying the expensive half early for a benefit nothing has
asked for: the model change is what carries the cost, and deferring the UI does not defer it.

## Consequences

- [[Project]] draws the distinction rather than reversing its claim: many projects in a vault,
  still one root, still no portfolio.
- [[Professional planner]]'s *Cross-project work* non-goal narrows to aggregation. Its standing is
  unchanged.
- [[Start a renovation project]] no longer records "how projects are told apart, whether one is
  active" as unsettled anywhere in the register. Its preconditions and its empty-vault main flow
  are the **first-run** case rather than the only one.
- **A Home surface is now owed and unbuilt.** Nothing in `docs/requirements/` describes it, and
  this note does not design it — that is a backlog item, not a decision record.
- The reconciliation's `c2` and `c3` are decided rather than withdrawn. They remain in that
  ledger's finding set, because a finding records what two corpora said and a ruling says which way
  it resolves.

## Revisit when

Somebody writes a use case that needs a number spanning two projects — a combined budget, a
portfolio dashboard, or a planner working for a client. That is the second root, and §34 already
names it as a later increment.

## References

- Workspace PRD §8 (two top-level contexts), §10 (Epic 1, Renovation Planner Home), §34 (Post-MVP
  Scope — cross-project dashboards), §35 (Slice 1's success criterion).
- Original PRD §58 (relationship model), §72 (currency per project); SDD §47 (project index).
- [[2026-08-24-ux-layer-backlog-reconciliation]] — decision 4, and the provenance trace finding all
  three derived notes faithful to their sources.
- [[Project]], [[Professional planner]], [[Start a renovation project]] — the three notes this
  decision edits.
