---
adr: 10
title: Decimal Money Arithmetic
status: Accepted
date: 2026-08-22
area: domain
---

# ADR-010: Decimal Money Arithmetic

## Context

The Cost Engine aggregates unit costs, waste factors, discounts, shipping, and tax across cost items, work packages, construction sections, and the overall project budget. Native JavaScript floating-point arithmetic is unsafe for this kind of financial calculation: rounding errors accumulate across additions, percentages, and currency conversions in ways that are unacceptable for budget and cost reporting.

## Decision

Financial calculations use arbitrary-precision decimal arithmetic via `decimal.js` rather than native JavaScript numbers. Money is modeled as an explicit domain concept (`Money { amount, currency }`), not a raw number.

Two things the received SDD's §49 leaves open, decided here because leaving them to each call site is how the same total comes out two ways:

- **Rounding mode is `ROUND_HALF_UP`.** Not a preference between equally good options — an unstated mode means whichever `decimal.js` default is in force, and a change to that default would move every persisted figure with nothing recording that it had a value at all.
- **Rounding happens once, at the end.** Intermediate pipeline values keep full precision; a `Money` value is rounded to its currency's minor unit only where it is finalized as output, never between stages. Rounding per stage lets waste, discount and tax stacking compound the error one step at a time, which is the exact failure this ADR exists to prevent, reintroduced inside the fix.

`docs/design/09-quantity-and-cost-engine.md` is where both are applied, with a worked example. They are stated *here* because they are decisions with consequences, and an ADR is what this repository reads for those — a slice document is where a decision is used, not where it is looked up.

## Consequences

- Cost aggregation, tax, discounts, and rounding behave predictably and consistently across the Cost Engine, work package rollups, and project-level budget/forecast reporting.
- Every money value carries its currency explicitly, so amounts can never be summed or compared without regard to currency.
- Persistence, calculation, and display code must consistently use the `Money`/decimal representation rather than casting to native numbers at layer boundaries, which would reintroduce floating-point error.

## Alternatives

- Native JavaScript numbers with manual rounding — rejected: rounding errors resurface at every aggregation point (line items, work packages, budget totals).
- Storing money as integer minor units (cents) — considered, not chosen: works for simple currencies, but complicates tax and discount percentage math and multi-currency display compared to `decimal.js`'s arbitrary precision.
- `ROUND_HALF_EVEN` (banker's rounding) — considered, not chosen: it is the better choice for summing many independent values, where half-up biases the total upward. This plugin's rounding happens once per finalized figure rather than across a long chain of independently rounded ones, so that bias has one opportunity to apply instead of thousands; and half-up is what a user checking the arithmetic by hand expects, which matters more here than a statistical property nobody will observe. Revisit if a budget rollup ever sums enough independently rounded figures for the bias to be measurable.
- Leaving rounding mode and rounding *point* unspecified, as SDD §49 does — rejected: an unspecified mode is whatever the library defaults to, and an unspecified point is decided independently by each call site. Both are the kind of omission that produces two different correct-looking totals for one project.

## Revisit when

Performance profiling shows `decimal.js` is a bottleneck in bulk cost recalculation, which would justify a narrower, fixed-point integer representation for that path.
