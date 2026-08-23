---
rule: BR-QTY-002
kind: lifecycle
name: A quantity flows through seven stages and no stage stands in for another
area: quantity
sources:
  - PRD §75
  - SDD §50
type: business-rule
---

# A quantity flows through seven stages and no stage stands in for another

**The rule.** §75's chain, in order, each stage a distinct value:

```text
calculated requirement → waste adjustment → required quantity → purchase quantity
  → delivered quantity → consumed quantity → remaining quantity
```

The first four are derived by the quantity engine (SDD §50). The last three are **recorded** —
delivery and consumption are observations, not calculations — and remaining is derived from those
two, which is what §76 calls reusable inventory.

**Why.** This is [[Requirement, procurement, cost and installed quantity stay four concepts]]
stated as arithmetic. The failure it prevents is silent: reading *purchase quantity* where
*required quantity* is meant inflates every downstream figure by the waste factor, and the result
is a plausible number.

**Where it holds.** `domain/requirement` and `domain/procurement`. The four derived stages are
pure functions composed in order; the three recorded stages are fields on [[Procurement item]].
Partially-delivered is a real state, not a rounding of ordered or delivered.

**Checked by.** Not yet. Slice 09 owns the derived stages; slice 10 wires them to real entities.

**Sources.** PRD §75 · PRD §76 · SDD §50.
