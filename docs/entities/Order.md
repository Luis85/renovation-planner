---
name: Order
layer: domain
persistence: note
sources:
  - PRD §11
  - PRD §24
  - PRD §33
  - PRD §36
  - PRD §37
  - PRD §60
type: entity
---

# Order

A commitment to buy: what was ordered, from which [[Supplier]], when, for how much. §33 places
it at the *commitment* step of the financial lifecycle, between quote and invoice.

Commitment is what it contributes, and §11's cost types make that a distinct number: committed
cost is money that is spent but not yet invoiced. §28's forecast is built from it — actual +
committed-but-not-invoiced + remaining estimate — so an order that produced no committed value
would leave a hole in the only figure that answers *what will this end up costing*.

It groups. Several [[Procurement item]]s go on one order, which is why the order exists as an
entity rather than a date field on each item: delivery, shipping cost and the reference number
you quote on the phone all belong to the order, not to any one line.

## Identity and persistence

A Markdown note (§36's `Orders/`) with a stable `id` (§60), the supplier id, the order date,
the expected delivery date and the order reference in frontmatter.

## Relationships

- Placed with exactly one [[Supplier]].
- Contains 1..n [[Procurement item]].
- Usually accepts a [[Quote]].
- Produces Committed [[Cost item]]s (§11), later matched by an [[Invoice]].
- Its expected delivery date drives [[Dependency]] from procurement to [[Work package]] (§77).

## Rules

- Committed value comes from here; actual value comes from the [[Invoice]]. Both exist at once
  and neither replaces the other.
- Partial delivery is tracked on the [[Procurement item]], not the order — §24's
  partially-delivered state is per line, because that is how deliveries actually arrive.
- Cancelling releases the commitment. It does not delete the order.

## Business rules that reach this entity

[[The forecast counts a commitment only until it is invoiced]] · [[Each cost type has exactly one source of record]]

## Sources

PRD §11 · PRD §24 · PRD §33 · PRD §36 · PRD §37 · PRD §60, in
[`docs/product/prds/obsidian-renovation-planner.md`](../product/prds/obsidian-renovation-planner.md) and
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](../development/sdds/obsidian-renovation-planner-SDD.md).
