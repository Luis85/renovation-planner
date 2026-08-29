---
adr: 10
title: Decimal Money Arithmetic
status: Accepted
date: 2026-08-22
revised: 2026-08-25
area: domain
---

# ADR-010: Decimal Money Arithmetic

## Context

The Cost Engine aggregates unit costs, waste factors, discounts, shipping, and tax across cost items, work packages, construction sections, and the overall project budget. Native JavaScript floating-point arithmetic is unsafe for this kind of financial calculation: rounding errors accumulate across additions, percentages, and currency conversions in ways that are unacceptable for budget and cost reporting.

## Decision

Financial calculations use `decimal.js` decimal arithmetic rather than native JavaScript numbers, at a fixed, configured precision rather than the unbounded "arbitrary precision" an earlier version of this decision claimed (see the revision note below). Money is modeled as an explicit domain concept (`Money { amount, currency }`), not a raw number.

Two things the received SDD's §49 leaves open, decided here because leaving them to each call site is how the same total comes out two ways:

- **Rounding mode is `ROUND_HALF_UP`.** Not a preference between equally good options — an unstated mode means whichever `decimal.js` default is in force, and a change to that default would move every persisted figure with nothing recording that it had a value at all.
- **Rounding happens once, at the end.** A `Money` value is rounded to its currency's minor unit only where it is finalized as output, never between stages — rounding per stage lets waste, discount and tax stacking compound the error one step at a time, which is the exact failure this ADR exists to prevent, reintroduced inside the fix. That is narrower than "intermediate values keep full precision": every operation still rounds to a configured number of significant digits (34, IEEE 754 decimal128's, via `core/money/Money.ts`'s `MONEY_PRECISION` on a private `Decimal.clone`) — wide enough that no figure this plugin computes comes near it, but a real ceiling rather than none.

> **Revised 2026-08-25.** The version of this ADR accepted on 2026-08-22 called the arithmetic "arbitrary-precision" and described intermediate values as keeping "full precision". Both overclaimed what `decimal.js` actually does: every operation rounds to a configured number of significant digits, and there was no module yet to say what that number was. `core/money/Money.ts` now pins it at `MONEY_PRECISION = 34`, and `tests/core/money/moneyArithmetic.test.ts` proves the residual — an exact 37-significant-digit product does not survive it. The decision itself is unchanged: decimal strings over floats, arithmetic confined to one module, `ROUND_HALF_UP` applied once at finalization. Only the description of how precise that arithmetic is has moved, from a claim nobody had measured to a number a test enforces.

`docs/tasks/09-quantity-and-cost-engine.md` is where both are applied, with a worked example. They are stated *here* because they are decisions with consequences, and an ADR is what this repository reads for those — a slice document is where a decision is used, not where it is looked up.

## Consequences

- Cost aggregation, tax, discounts, and rounding behave predictably and consistently across the Cost Engine, work package rollups, and project-level budget/forecast reporting.
- Every money value carries its currency explicitly, so amounts can never be summed or compared without regard to currency.
- Persistence, calculation, and display code must consistently use the `Money`/decimal representation rather than casting to native numbers at layer boundaries, which would reintroduce floating-point error.

## Alternatives

- Native JavaScript numbers with manual rounding — rejected: rounding errors resurface at every aggregation point (line items, work packages, budget totals).
- Storing money as integer minor units (cents) — considered, not chosen: works for simple currencies, but complicates tax and discount percentage math and multi-currency display compared to `decimal.js`'s much wider (34-significant-digit) decimal precision.
- `ROUND_HALF_EVEN` (banker's rounding) — considered, not chosen: it is the better choice for summing many independent values, where half-up biases the total upward. This plugin's rounding happens once per finalized figure rather than across a long chain of independently rounded ones, so that bias has one opportunity to apply instead of thousands; and half-up is what a user checking the arithmetic by hand expects, which matters more here than a statistical property nobody will observe. Revisit if a budget rollup ever sums enough independently rounded figures for the bias to be measurable.
- Leaving rounding mode and rounding *point* unspecified, as SDD §49 does — rejected: an unspecified mode is whatever the library defaults to, and an unspecified point is decided independently by each call site. Both are the kind of omission that produces two different correct-looking totals for one project.

## Revisit when

Performance profiling shows `decimal.js` is a bottleneck in bulk cost recalculation, which would justify a narrower, fixed-point integer representation for that path.
