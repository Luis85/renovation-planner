---
kind: entity
name: Money
layer: core
persistence: none
sources: ["PRD §72", "PRD §73", "SDD §49", "ADR-010"]
---

# Money

An amount and a currency (SDD §49). A value object, not an entity with a life of its own — it
has no id, no note and no lifecycle, and two Money values with the same amount and currency are
the same value.

It is listed here because it is a business concept the product genuinely works with, and because
getting it wrong is the classic quiet defect. ADR-010 and SDD §49 state the rule: **never use
native floating-point arithmetic for financial calculations.** `0.1 + 0.2` is a plausible
number and a wrong one, and a renovation budget accumulates thousands of those. `decimal.js`
is the answer, and the constraint is not that it be *available* but that no code path routes
around it.

§72 puts the currency on the [[Project]] — one project, one currency. That is a real
simplification with a real cost: a [[Quote]] in another currency has no home in the model today.

## Identity and persistence

None. It is stored as part of whatever holds it — a [[Cost item]]'s amount, a [[Quote]] line, an
[[Invoice]] total — never on its own.

## Relationships

- Held by [[Cost item]], [[Quote]], [[Order]], [[Invoice]] and the [[Project]] budget.
- Denominated in the [[Project]]'s currency (§72).

## Rules

- Decimal arithmetic throughout, with no float shortcut anywhere on the path (ADR-010).
- Amount and currency travel together. A bare number crossing a boundary is a currency waiting
  to be assumed.
- §73's net / tax rate / tax amount / gross are four values, and the model keeps all four rather
  than storing one and recomputing the others at display time.
- Rounding happens at display, not in the arithmetic (§71's separation, applied to money).

## Sources

PRD §72 · PRD §73 · SDD §49 · ADR-010, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
