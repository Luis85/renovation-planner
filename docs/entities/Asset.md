---
kind: entity
name: Asset
layer: domain
persistence: note
partOf: "[[Project]]"
sources: ["PRD §8", "PRD §17", "PRD §32", "PRD §59", "PRD §84", "SDD §55"]
---

# Asset

A physical or cost-relevant item: a tile, a plant, a window, a light, a fence, a sink, a garden
shed, paint. §17 asks for a searchable library of them with categories.

An asset is a **kind of thing, not an amount of it**. This is the first and most important
separation in §32's chain: the asset is *porcelain terrace tile*, the [[Requirement]] is
*46.2 m² of it*, the [[Procurement item]] is *47.52 m² ordered*, the [[Cost item]] is
*1,661.42 €*. Fold the quantity into the asset and the same tile used in two rooms becomes two
assets, the price is recorded twice, and updating it fixes one of them.

It carries the unit price and the unit — §9's vocabulary of piece, m, m², m³, hour, day, fixed —
and §24's package size and minimum order quantity, which is what makes a purchase quantity
different from a required one.

Labour fits here too: *electrician, 12 h × 75 €/h* is §9's own example, so an asset is not
necessarily a material. That is why the entity is called Asset rather than Material.

## Identity and persistence

A Markdown note in a library (§36's `Assets/`) with a stable `id` (§60). Category, unit and
unit price in frontmatter so the library is searchable and [[Bases]]-queryable; product data,
links and photos in the body.

## Relationships

- Belongs to exactly one [[Project]] (§59) — the library is per project, not global.
- Referenced by 0..n [[Requirement]].
- Priced by 0..n [[Quote]] line, from 0..n [[Supplier]].
- May be placed on a [[Plan]] as a [[Spatial object]] (§17 asset placement).
- Documented by [[Document]] — data sheets, installation manuals (§23).

## Rules

- **Asset categories are configurable** (§84).
- The price here is a default, not a fact. A [[Quote]] beats it, and a [[Cost item]] records
  what was actually used.
- One asset, one unit. An asset sold by both the piece and the m² is two assets, or the
  quantity chain has no defined arithmetic.
- Package size and minimum order quantity belong here, and are what [[Procurement item]] rounds
  against (§24).

## Sources

PRD §8 · PRD §17 · PRD §32 · PRD §59 · PRD §84 · SDD §55, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
