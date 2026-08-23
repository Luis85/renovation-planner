---
adr: 12
title: Price Component Placement in the Cost Pipeline
status: Accepted
date: 2026-08-23
area: domain
---

# ADR-012: Price Component Placement in the Cost Pipeline

## Context

PRD §74 names six price components a cost item may carry: discount, shipping, deposit, surcharge, tax, contingency. SDD §51's cost pipeline places three of them — `quantity → unit price → discount → shipping → tax → estimated cost`.

That leaves a gap nobody had to notice while the engine was unwritten. **Deposit and surcharge are named by the requirements and placed by nothing.** Contingency is placed, but only by a derived note (`docs/entities/Cost item.md`, "held apart from the estimate"), not by the received design. And `docs/entities/Cost item.md` states the whole thing wider than the evidence supports: it lists all six components and then says "SDD §51's pipeline fixes the order they apply in", followed by an order containing three of them.

The gap is the same shape as the one ADR-010 closed for rounding. An unplaced additive component is placed independently by each call site, and the two plausible placements — before or after tax — produce different totals from the same inputs, both of which look right. Slice 09 fixes the order of the three it has for exactly this reason ("order is fixed by §51 and is not configurable"), and that argument does not stop applying at the components §51 happened to list.

## Decision

All six of §74's components have a stated placement, and the pipeline has one order. Two of the six are deliberately **not** stages in it, which is a placement rather than an omission.

| Component | Placement | Why there |
| --- | --- | --- |
| Discount | Stage: after the line subtotal, before shipping | SDD §51. Shipping is not discounted — a trade discount is negotiated on the goods |
| Surcharge | Stage: with shipping, after discount, before tax | **This ADR's addition.** A surcharge is additive and taxable, and it is not discountable: it is levied on the order rather than negotiated on the goods, so it enters exactly where shipping does |
| Shipping | Stage: after discount, before tax | SDD §51. Shipping is taxable |
| Tax | Stage: last, on the post-shipping total | SDD §51 |
| Contingency | **Not a stage.** Held beside the estimate, never added into it | So *how much of the buffer is left* stays answerable. Folded in, a contingency is indistinguishable from a higher estimate |
| Deposit | **Not a stage.** A payment against a commitment | A deposit does not change what a thing costs, only when it is paid. It belongs to §33's financial lifecycle, not to the price |

Surcharge is therefore a second additive, pre-tax term alongside shipping, and the full order is:

```text
quantity × unit price → − discount → + shipping → + surcharge → + tax → round → estimated cost
```

Shipping before surcharge is arbitrary between the two and stated anyway, because addition commuting is a property of the arithmetic and not of the code that will read these fields in some order regardless.

This refines SDD §51 by extending it, the way ADR-009 refines the SDD's §40 sidecar example — the received document is not edited, and the two components §51 does not mention are not left for a call site to place.

## Consequences

- `computeEstimatedCost`'s input gains an optional `surcharge: Money` term, applied in the same stage as `shipping`. Contingency and deposit are fields on a cost item that the estimate pipeline reads and does not consume.
- A cost item's stored component breakdown can be re-added by hand and reach the same total, which is what "every cost can be broken back down into the parts somebody actually quoted" (the *Cost items and price components* Feature) actually requires.
- Two claims elsewhere become true rather than approximately true: `docs/entities/Cost item.md` can cite a placement for all six components instead of promising an order for six and listing three, and slice 09's "order is fixed and not configurable" now covers every component the requirements name.
- Contingency being outside the estimate means a project total and a project total *with buffer* are two different figures, and any report showing one must say which.

## Alternatives

- **Leave deposit and surcharge unplaced, as §74 and §51 jointly do** — rejected: that is the omission this ADR exists to close. Slice 09 already argues that an unstated convention "produces a plausible number rather than an error", and an unplaced component is an unstated convention with a field to store it in.
- **Surcharge after tax** — rejected: it would make a surcharge the only untaxed charge on the line, which is wrong for the surcharges a renovation actually meets (delivery, fuel, small-order, out-of-hours), all of which are part of the taxable supply.
- **Surcharge as negative discount, reusing that stage** — rejected: it would make a surcharge discountable, and it destroys the breakdown. A discount of −50 and a surcharge of +50 are not an absence of both.
- **Contingency as a pipeline stage** — rejected, and this ADR only records what `docs/entities/Cost item.md` already decided: an estimate that has swallowed its own buffer cannot report the buffer.
- **A configurable component order** — rejected for the reason slice 09 gives for the three it already had: two projects would compute different totals from identical inputs, and neither could be called wrong.

## Revisit when

A tax regime the plugin must model treats a named surcharge as outside the taxable supply, or a quote arrives whose components genuinely do not re-add to its total — either would mean the pipeline is modelling one jurisdiction's convention as arithmetic.
