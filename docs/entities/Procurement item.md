---
name: Procurement item
layer: domain
persistence: note
sources:
  - PRD §24
  - PRD §32
  - PRD §36
  - PRD §59
  - PRD §60
  - PRD §75
  - PRD §76
  - PRD §77
type: entity
---

# Procurement item

What is actually bought. §24's lifecycle is needed → researching → selected → ordered →
partially-delivered → delivered → installed → cancelled.

§59 states the rule that gives it independent existence: a procurement item is based on a
[[Requirement]] **or a manual need**, and **must remain distinct from the requirement itself**.
Two reasons, both practical. The quantities differ — 46.2 m² required becomes 47.52 m² ordered,
because tiles come in boxes and §24's package sizes and minimum order quantities are real. And
plenty of what a renovation buys answers no requirement at all: a tool, a skip, a delivery fee.

Its lifecycle is also the longest in the model, and the reason [[Dependency]] admits
procurement → [[Work package]]: *we cannot tile until the tiles arrive* is a scheduling fact,
and it is the commonest one on a real site.

§76's remaining material lands here too. What was delivered minus what was consumed is
inventory, and inventory can be reused rather than re-bought.

## Identity and persistence

A Markdown note (§36's `Orders/` neighbourhood) with a stable `id` (§60), the lifecycle
state, the ordered/delivered/consumed quantities and the required date in frontmatter — this is
an entity whose whole value is being queryable by state and date.

## Relationships

- Based on 0..1 [[Requirement]], or none where the need is manual (§59).
- Buys exactly one [[Asset]].
- Bought from a [[Supplier]], usually under an [[Order]], evidenced by an [[Invoice]].
- Blocks 0..n [[Work package]] via [[Dependency]] (§77).
- Produces the committed and actual halves of a [[Cost item]] (§33).

## Rules

- Purchase quantity is derived from the requirement **through** package size and minimum order
  quantity (§24) — it is not the requirement rounded up by eye.
- Delivered and consumed are recorded separately (§75). Remaining is derived from the two, and
  is what §76 calls inventory.
- Partially-delivered is a real state, not a rounding of ordered or delivered.
- Cancelled is kept, not deleted. It is why something was not bought.

## Business rules that reach this entity

[[Requirement, procurement, cost and installed quantity stay four concepts]] · [[A quantity flows through seven stages and no stage stands in for another]] · [[Purchase quantity rounds up to whole lots, then up to the minimum order]]

## Sources

PRD §24 · PRD §32 · PRD §36 · PRD §59 · PRD §60 · PRD §75 · PRD §76 · PRD §77, in
[`docs/product/prds/obsidian-renovation-planner.md`](../product/prds/obsidian-renovation-planner.md) and
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](../development/sdds/obsidian-renovation-planner-SDD.md).
