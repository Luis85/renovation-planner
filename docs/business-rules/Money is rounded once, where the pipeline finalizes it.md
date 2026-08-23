---
rule: BR-COST-002
kind: calculation
name: Money is rounded once, where the pipeline finalizes it
area: cost
sources:
  - ADR-010
  - SDD §49
  - PRD §71
type: business-rule
---

# Money is rounded once, where the pipeline finalizes it

**The rule.** Rounding mode is `ROUND_HALF_UP`. A `Money` value is rounded to its currency's
minor unit exactly where it is finalized as pipeline output — the `Estimated Cost` step of the
cost pipeline — and never between stages. Intermediate values keep full `decimal.js` precision.

**Why.** Rounding per stage lets waste, discount and tax stacking compound the error one step at
a time, which is the exact failure decimal arithmetic was adopted to prevent, reintroduced inside
the fix. An unstated *mode* is worse: it means whichever `decimal.js` default is in force, and a
change to that default would move every persisted figure with nothing recording that it had a
value at all. `ROUND_HALF_EVEN` was considered and refused — see ADR-010's alternatives.

**Where it holds.** `core/money`'s `round`, called once by the cost pipeline. Every other
operation returns full precision.

**Two roundings, not one — and this is where they are told apart.** §71's separation is real and
is [[Internal precision and display precision are separate]], but it is about a *second*
rounding, not this one. The point ADR-010 fixes is the **last step of the cost pipeline**, inside
the domain; display formatting rounds again for presentation and never feeds back. [[Money]]'s
own rule read *"rounding happens at display, not in the arithmetic"*, which took the second
rounding for the only one and contradicted ADR-010's *once, at the end* — corrected there
2026-08-23, this note being where the distinction is stated.

**Checked by.** Not yet. Slice 09's Definition of Done carries the worked example
(`13.5802458 m²` → `15 m²` → `$219.8828125` → `$219.88`) and the `.005`/`.125` boundary cases.

**Sources.** ADR-010 ([`docs/adrs/0010-decimal-money-arithmetic.md`](../adrs/0010-decimal-money-arithmetic.md)) ·
SDD §49 · PRD §71.
