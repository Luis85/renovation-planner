---
rule: BR-COST-005
kind: calculation
name: The cost pipeline applies its components in one fixed order
area: cost
sources:
  - SDD §51
  - PRD §74
  - ADR-012
type: business-rule
---

# The cost pipeline applies its components in one fixed order

**The rule.** One order, and it is not configurable:

```text
purchase quantity × unit price          → line subtotal
− discount percentage of the subtotal   → after discount
+ shipping                              → after shipping
+ surcharge                             → after surcharge
+ tax percentage of that                → estimated cost (rounded, once)
```

SDD §51 gives discount, shipping and tax. ADR-012 places the other three of §74's six components,
including the two the received documents place nowhere:

| Component | Where | Why |
| --- | --- | --- |
| Discount | Before shipping | Shipping is not discounted |
| Shipping | After discount, before tax | Shipping is taxable |
| Surcharge | With shipping, before tax | Additive and taxable, and not discountable — it is levied on the order, not negotiated on the goods |
| Tax | Last, on the post-shipping total | §51 |
| Contingency | **Not a stage** — held beside the estimate | An estimate that has swallowed its buffer cannot report the buffer |
| Deposit | **Not a stage** — a payment, not a price | It changes *when* something is paid, not what it costs (§33) |

**Why.** The components do not commute. Taxing before a discount and discounting after tax
produce different totals from the same inputs, and both look right in isolation. One stated order
is what makes two implementations of the same cost item agree.

An *unplaced* component is the same defect with nothing to point at: a surcharge stored in a field
and applied by whichever call site reaches it first is an unstated convention, and getting an
unstated convention backwards produces a plausible number rather than an error. That is the gap
ADR-012 closes — and *not a stage* is a placement too, which is why contingency and deposit are in
the table rather than absent from it.

**Where it holds.** `domain/cost`'s pipeline, as pure composed stages that are private to
`computeEstimatedCost` — a caller cannot skip a stage or reorder them. The rounding step is
[[Money is rounded once, where the pipeline finalizes it]]. `percentageOf` returns the *part*,
never the adjusted total: discount subtracts it, tax adds it, and one function that "applies a
percentage" for both would need a sign convention nobody states.

**Checked by.** Not yet. Slice 09 states the pipeline and carries the worked example.

**Sources.** SDD §51 · PRD §74 · ADR-012
([`docs/adrs/0012-price-component-placement-in-the-cost-pipeline.md`](../adrs/0012-price-component-placement-in-the-cost-pipeline.md)) ·
slice 09 ([`docs/tasks/09-quantity-and-cost-engine.md`](../tasks/09-quantity-and-cost-engine.md)).
