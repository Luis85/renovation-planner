---
rule: BR-QTY-005
kind: constraint
name: A mismatched unit or currency is an error, not a coercion
area: quantity
sources:
  - SDD §48
  - SDD §49
  - PRD §70
type: business-rule
---

# A mismatched unit or currency is an error, not a coercion

**The rule.** A quantity carries its unit and a [[Money]] value carries its currency, and both
travel with the value everywhere. An arithmetic operation between mismatched ones resolves to an
error result — never a coercion, never a silent pick of the left operand, never `NaN`.

*8 pieces* and *8 m²* are not both eight. `€100 + $100` is not `200` of anything.

**Why.** A bare number crossing a boundary is a unit waiting to be assumed, and the assumption is
made by whichever call site happens to be first. Coercion is worse than an error here because the
result is a well-formed number that no later check can distinguish from a correct one.

**Where it holds.** `core/money`'s `add`/`subtract`/`compare` return `Result<…, CalculationError>`
on a currency mismatch; the quantity engine's stages carry `MeasurementUnit` on every value. It
also holds at a boundary that did not exist before the catalogues were shared (§59, amended
2026-08-26): an [[Asset]]'s default price is one value read by projects that may each define a
different currency (§72), so that price carries its own and a project whose currency differs is
told rather than served a well-formed wrong number. Nothing converts — this product has no
exchange rate and no date to read one at. Two
vocabularies are kept deliberately distinct — the **dimension** (`piece`, `length`, `area`,
`volume`, `hour`, `day`, `fixed`, SDD §48) and the **symbol** a quantity is priced in (`piece`,
`m`, `m2`, `m3`, `hour`, `day`, `fixed`) — so a rule about dimensions is not written against a
string. See [[An asset's unit kind must match the dimension its requirement is derived from]].

**Checked by.** Not yet. Slice 09 names currency safety and unit handling as its own test groups.

**Sources.** SDD §48 · SDD §49 · PRD §70 · slice 09
([`docs/tasks/09-quantity-and-cost-engine.md`](../../tasks/09-quantity-and-cost-engine.md)).
