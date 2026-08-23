---
rule: BR-QTY-003
kind: calculation
name: Waste multiplies the required quantity and stays a separate factor
area: quantity
sources:
  - PRD §9
  - PRD §88
  - SDD §50
type: business-rule
---

# Waste multiplies the required quantity and stays a separate factor

**The rule.** `wasted = required × (1 + wastePercent / 100)`. A waste percentage of `0` is the
identity operation, not a special case. The factor is stored on the [[Requirement]] as its own
field and applied at calculation time — it is never folded into the calculated quantity.

**Why.** §9's own example is *27.4 m² × 1.10 × 45 €/m²*, and it is written that way because both
halves are facts a user needs to see: how much is actually being covered, and how much is being
bought to cover it. Bake the factor in and the 27.4 disappears — nobody can then check the number
against the drawing, adjust the allowance for a different tile format, or notice that a 10%
allowance was applied twice.

**Where it holds.** `applyWaste` in the quantity engine, between required and purchase quantity in
[[A quantity flows through seven stages and no stage stands in for another]].

**Checked by.** Not yet. Slice 09 names the identity case (`wastePercent = 0`) as its own test.

**Sources.** PRD §9 · PRD §88 · SDD §50 · slice 09
([`docs/tasks/09-quantity-and-cost-engine.md`](../tasks/09-quantity-and-cost-engine.md)).
