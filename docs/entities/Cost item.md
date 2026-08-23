---
kind:
name: Cost item
layer: domain
persistence: note
sources:
  - PRD §9
  - PRD §10
  - PRD §11
  - PRD §32
  - PRD §33
  - PRD §73
  - PRD §74
  - SDD §48
  - SDD §51
  - ADR-012
type: entity
---

# Cost item

A single line of money: *18.4 m × 89 €/m*. §9's examples are the whole idea — a quantity, a
unit, a unit price, and the [[Money]] that falls out.

**A cost item carries a cost *type*, and that is what makes the model useful.** §11 lists five:
Budget, Estimated, Quoted, Committed, Actual. The same fence appears at all five values over the
life of a project — budgeted at 2,000, estimated at 1,637, quoted at 1,540, committed when
ordered, actual when invoiced — and the forecast is arithmetic *across* those types:
actual + committed-but-not-invoiced + remaining estimate. Collapse them into one number and the
project can never answer *are we over*.

§33's financial lifecycle is the same five as a sequence, plus payment. §10 gives the hierarchy
it aggregates through — project → construction section → work package → cost item — and lists
the seven axes it aggregates *by*: project, construction section, zone, trade, work package,
asset, supplier.

§74's price components — discount, shipping, deposit, surcharge, tax, contingency — are parts of
a cost item rather than cost items of their own. **ADR-012** places all six; SDD §51 places only
the three it names, and an earlier version of this paragraph claimed §51 fixed the order for all
of them and then listed an order containing three. The order is
quantity → unit price → discount → shipping → surcharge → tax → estimated cost, with contingency
held beside the estimate and a deposit belonging to §33's lifecycle rather than to the price.
Order matters: tax on a discounted total is not a discount on a taxed total.

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
- **`Committed` means *not yet invoiced*, and the forecast is computed on that reading.** The PRD
  states the same Forecast concept twice and the two do not agree: §28 (Epic 17, Reporting &
  Project Cockpit) writes `Actual Cost + Committed Cost + Remaining Estimate`, while §33
  (Financial Lifecycle) writes `Actual + Committed but not invoiced + Remaining Estimate`. §33's
  is the one implemented. Read literally, §28 counts a commitment that has already been invoiced
  twice — once as Actual, again as Committed — and inflates the forecast; §33's phrasing is the
  same intent stated precisely, so §28's `Committed Cost` is shorthand for it, not a second,
  full-commitment total. Booking an [[Invoice]] retires the matching commitment, which is the
  mechanism that makes the narrower reading the only coherent one. The PRD is received evidence
  and is kept verbatim per [`docs/README.md`](../README.md), so the correction lives here rather
  than as an edit to the source — which is what keeps the §28 cited above unedited. Both sites are
  cited by section number rather than feature number because Epic 17 lists its features as an
  unnumbered bullet list: no `F17.x` identifier exists to check against the source.
- §73's tax support is planning support, and the model says so — not accounting, not tax advice.
- Contingency is a §74 component, held apart from the estimate rather than added into it (ADR-012), so the
  question *how much of the buffer is left* stays answerable.

## Business rules that reach this entity

[[The forecast counts a commitment only until it is invoiced]] · [[Money is rounded once, where the pipeline finalizes it]] · [[Each cost type has exactly one source of record]] · [[A cost rollup is derived along its axis, never stored]] · [[The cost pipeline applies its components in one fixed order]]

## Sources

PRD §9 · PRD §10 · PRD §11 · PRD §32 · PRD §33 · PRD §73 · PRD §74 · SDD §48 · SDD §51, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
