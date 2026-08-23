---
kind:
name: Invoice
layer: domain
persistence: note
sources:
  - PRD §33
  - PRD §11
  - PRD §37
  - PRD §23
  - PRD §73
type: entity
---

# Invoice

A bill received, and the origin of every *actual* cost in the project. §33's lifecycle ends
budget → estimate → quote → commitment → **invoice** → payment.

It produces the one cost type that is not a projection. §11's Actual is the only figure in the
model that is a fact rather than a calculation, which makes the invoice the anchor everything
else is measured against: §27's planned-versus-actual and §28's forecast both reduce to
comparing something computed with something invoiced.

**Payment is a state, not an entity.** §33 lists it as the step after invoice, and it is one
date and one flag on this note — an entity would be an entity with no properties of its own.

§73's tax model surfaces here more than anywhere: net, tax rate, tax amount, gross, all four
recorded, and the PRD's own caveat repeated — planning support, not accounting.

## Identity and persistence

A Markdown note (§36's `Invoices/`) with a stable `id` (§60), the supplier id, the invoice
number, the date, the due date, net/tax/gross and the payment state in frontmatter.

## Relationships

- Received from exactly one [[Supplier]].
- Usually settles an [[Order]], and through it 1..n [[Procurement item]].
- Produces Actual [[Cost item]]s (§11), which retire the corresponding Committed ones.
- Evidenced by a [[Document]] — §23 lists *invoice* as a document category, and the scan is that
  document.

## Rules

- Actual cost is recorded, never derived, and never moves afterwards.
- Booking an invoice retires the matching commitment. Counting both is the classic way to
  overstate a forecast, and it is the reason the PRD's two Forecast formulas (§28 against §33)
  are settled on §33's *committed but not invoiced* reading — the decision is recorded on
  [[Cost item]], the entity that carries the cost type.
- An invoice with no matching order is legitimate — not everything bought was ordered formally.

## Sources

PRD §33 · PRD §11 · PRD §37 · PRD §23 · PRD §73, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
