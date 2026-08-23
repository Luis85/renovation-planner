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

## Consequences

- Cost aggregation, tax, discounts, and rounding behave predictably and consistently across the Cost Engine, work package rollups, and project-level budget/forecast reporting.
- Every money value carries its currency explicitly, so amounts can never be summed or compared without regard to currency.
- Persistence, calculation, and display code must consistently use the `Money`/decimal representation rather than casting to native numbers at layer boundaries, which would reintroduce floating-point error.

## Alternatives

- Native JavaScript numbers with manual rounding — rejected: rounding errors resurface at every aggregation point (line items, work packages, budget totals).
- Storing money as integer minor units (cents) — considered, not chosen: works for simple currencies, but complicates tax and discount percentage math and multi-currency display compared to `decimal.js`'s arbitrary precision.

## Revisit when

Performance profiling shows `decimal.js` is a bottleneck in bulk cost recalculation, which would justify a narrower, fixed-point integer representation for that path.
