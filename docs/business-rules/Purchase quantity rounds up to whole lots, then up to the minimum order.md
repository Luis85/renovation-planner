---
rule: BR-QTY-004
kind: calculation
name: Purchase quantity rounds up to whole lots, then up to the minimum order
area: quantity
sources:
  - PRD §24
  - SDD §50
type: business-rule
---

# Purchase quantity rounds up to whole lots, then up to the minimum order

**The rule.** Given a lot size, the waste-adjusted quantity rounds **up** to the next whole
multiple of it; if the result is still below a stated minimum order quantity, it rounds up again
to that minimum. Both steps round up, never to nearest. Where no packaging data exists the
waste-adjusted quantity passes through unchanged.

Worked, from slice 09: `13.5802458 m²` with a lot size of `2.5` → `13.5802458 / 2.5 = 5.432…`
lots → 6 lots → `15 m²`.

**Why.** Tiles come in boxes. A purchase quantity that is not a whole number of boxes is not a
purchase anybody can make, and rounding to nearest buys too little half the time — which on site
means a second delivery, not a smaller number. [[Asset]] is where lot size and minimum order
live, because they are properties of the thing being sold, and [[Procurement item]] is what rounds
against them: purchase quantity is derived *through* packaging, not the requirement rounded up by
eye.

**Where it holds.** `applyPackaging` in the quantity engine — optional by design, since no
material catalog supplies lot sizes until slice 10.

**Checked by.** Not yet. Slice 09 names both the lot-size case and the `undefined` pass-through.

**Sources.** PRD §24 · SDD §50 · slice 09
([`docs/tasks/09-quantity-and-cost-engine.md`](../tasks/09-quantity-and-cost-engine.md)).
