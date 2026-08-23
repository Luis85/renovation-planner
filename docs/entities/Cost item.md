---
kind: entity
name: Cost item
layer: domain
persistence: note
sources: ["PRD §9", "PRD §10", "PRD §11", "PRD §32", "PRD §33", "PRD §73", "PRD §74", "SDD §48", "SDD §51"]
---

# Cost item

A single line of money: *18.4 m × 89 €/m*. §9's examples are the whole idea — a quantity, a
unit, a unit price, and the [[Money]] that falls out.

**A cost item carries a cost *type*, and that is what makes the model useful.** §11 lists five:
Budget, Estimated, Quoted, Committed, Actual. The same fence appears at all five values over the
life of a project — budgeted at 2,000, estimated at 1,637, quoted at 1,540, committed when
ordered, actual when invoiced — and §28's forecast is arithmetic *across* those types:
actual + committed-but-not-invoiced + remaining estimate. Collapse them into one number and the
project can never answer *are we over*.

§33's financial lifecycle is the same five as a sequence, plus payment. §10 gives the hierarchy
it aggregates through — project → construction section → work package → cost item — and lists
the seven axes it aggregates *by*: project, construction section, zone, trade, work package,
asset, supplier.

§74's price components — discount, shipping, deposit, surcharge, tax, contingency — are parts of
a cost item rather than cost items of their own, and SDD §51's pipeline fixes the order they
apply in: quantity → unit price → discount → shipping → tax → estimated cost. Order matters:
tax on a discounted total is not a discount on a taxed total.

## Identity and persistence

A note (§36's `Costs/`) with a stable `id` (§60), the cost type, quantity, unit price and
component breakdown. Many cost items are derived from a [[Requirement]] and an [[Asset]] rather
than authored, but they are persisted because a *quoted* or *actual* value is a historical fact
that must not move when the drawing does.

## Relationships

- Rolls up to a [[Work package]], then a [[Construction section]], then the [[Project]] (§10).
- Aggregates by [[Zone]], [[Trade]], [[Asset]] and [[Supplier]] as well (§10).
- Derived from a [[Requirement]] where the type is estimated; from a [[Quote]] where quoted;
  from a [[Procurement item]] where committed; from an [[Invoice]] where actual.
- Denominated in [[Money]], measured in [[Quantity]].

## Rules

- **Never native floating-point arithmetic** (SDD §49, ADR-010). `decimal.js`, always.
- Estimated values are derived and recomputed; quoted, committed and actual values are recorded
  and do not move.
- §73's tax support is planning support, and the model says so — not accounting, not tax advice.
- Contingency is a §74 component, held apart from the estimate rather than added into it, so the
  question *how much of the buffer is left* stays answerable.

## Sources

PRD §9 · PRD §10 · PRD §11 · PRD §32 · PRD §33 · PRD §73 · PRD §74 · SDD §48 · SDD §51, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
