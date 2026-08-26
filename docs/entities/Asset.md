---
name: Asset
layer: domain
persistence: note
sources:
  - PRD §8
  - PRD §17
  - PRD §32
  - PRD §36
  - PRD §59
  - PRD §60
  - PRD §84
  - SDD §55
type: entity
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

A Markdown note in the library folder's `Assets/` (§83, §36) with a stable `id` (§60).
Category, unit and unit price in frontmatter so the library is searchable and [[Bases]]-queryable;
product data, links and photos in the body. It carries **no project id**, which is the rule being
kept rather than a field somebody forgot — see
[[Work belongs to one project, catalogues belong to the vault]].

## Relationships

- Belongs to **no** [[Project]] (§59, amended 2026-08-26). The library is shared across every
  project, so a tile defined for the bathroom is available to the next renovation without being
  defined again. Referenced by any project; owned by none.
- Referenced by 0..n [[Requirement]].
- Priced by 0..n [[Quote]] line, from 0..n [[Supplier]].
- May be placed on a [[Plan]] as a [[Spatial object]] (§17 asset placement).
- Documented by [[Document]] — data sheets, installation manuals (§23).

## Rules

- **Asset categories are configurable** (§84).
- The price here is a default, not a fact. A [[Quote]] beats it, and a [[Cost item]] records
  what was actually used.
- **The price carries its own currency, and a mismatch is an error rather than a coercion.** A
  [[Project]] defines the currency every [[Money]] value in it is denominated in (§72), and two
  projects in one vault may legitimately disagree — while the definition they both reference
  holds one price. So the currency travels with the price, and a project whose own currency
  differs is told rather than served a number that is well-formed and wrong. This is
  [[A mismatched unit or currency is an error, not a coercion]] applied at the point sharing
  created: nothing here converts, because no exchange rate, and no date to read one at, exists
  anywhere in this product. The project supplies its own price instead, as a **per-project price
  override**: stored in its own field, marked as an override, with the shared default still
  visible beside it — [[A manual override is stored as an override, beside what it replaced]],
  which already governs the shape. A [[Quote]] beats both, and this is the MVP answer precisely
  *because* a Quote is not one: [[Quotes and quote items]] is V1, so without the override an MVP
  project in a second currency could not price a shared asset at all without duplicating the
  definition. Where the override is persisted is a slice question; that it exists, and that it
  never overwrites the shared default, is not.
- One asset, one unit. An asset sold by both the piece and the m² is two assets, or the
  quantity chain has no defined arithmetic.
- Package size and minimum order quantity belong here, and are what [[Procurement item]] rounds
  against (§24).

## Business rules that reach this entity

[[Purchase quantity rounds up to whole lots, then up to the minimum order]] · [[An asset's unit kind must match the dimension its requirement is derived from]] · [[A type this version does not know survives a round trip verbatim]]

## Sources

PRD §8 · PRD §17 · PRD §32 · PRD §36 · PRD §59 · PRD §60 · PRD §84 · SDD §55, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
