---
kind:
name: Requirement
layer: domain
persistence: note
sources:
  - PRD §32
  - PRD §59
  - PRD §75
  - PRD §88
  - PRD §89
  - SDD §50
  - SDD §51
type: entity
---

# Requirement

*How much of an [[Asset]] is needed, and why.* §32 gives its properties: required asset, source
geometry, calculated quantity, waste factor, unit, manual override, required date.

**The source geometry is what makes this entity worth having.** A requirement is not a number
someone typed; it is a number *computed from a [[Zone]]'s area or a wall's length*, which means
it updates when the drawing does. §3.4's "geometry drives planning" is realised precisely here —
this is the join between the spatial half of the product and the commercial half.

§59 requires an origin: a [[Zone]], a [[Work package]] or an [[Asset]]. A requirement with no
origin is a shopping list item, and the model has a place for that — it is a manual
[[Procurement item]] — so nothing is lost by holding the line.

§75's pipeline runs through it: calculated requirement → waste adjustment → required quantity →
purchase quantity → delivered → consumed → remaining. This entity owns the first three; the
[[Procurement item]] owns the rest.

## Identity and persistence

A Markdown note (§36's `Requirements/`) with a stable `id` (§60), the asset id, the origin
id, the waste factor and any manual override in frontmatter.

## Relationships

- Requires exactly one [[Asset]].
- Originates from exactly one [[Zone]], [[Work package]] or [[Asset]] (§59).
- Derives its quantity from a [[Spatial object]]'s geometry, via the [[Quantity]] pipeline.
- Satisfied by 0..n [[Procurement item]].
- Priced into 0..n [[Cost item]].

## Rules

- **The calculated quantity is derived, never stored as fact** (§88). It is recomputed from
  geometry on read.
- **A manual override is stored, and stored as an override** (§89) — the calculated value
  remains visible beside it. Overwriting the derivation with a typed number destroys the
  ability to notice that the drawing has since changed.
- The waste factor is applied to the calculation, not baked into it, so *27.4 m² × 1.10* stays
  legible as two facts (§9).
- A requirement is not a purchase. It is what is needed; [[Procurement item]] is what is bought.

## Business rules that reach this entity

[[Requirement, procurement, cost and installed quantity stay four concepts]] · [[Waste multiplies the required quantity and stays a separate factor]] · [[A requirement names what it is required for]] · [[A manual override is stored as an override, beside what it replaced]]

## Sources

PRD §32 · PRD §59 · PRD §75 · PRD §88 · PRD §89 · SDD §50 · SDD §51, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
