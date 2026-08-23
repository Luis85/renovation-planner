---
kind: entity
name: Spatial object
layer: domain
persistence: sidecar
partOf: "[[Plan]]"
sources: ["PRD §7", "PRD §30", "PRD §34", "PRD §38", "PRD §59", "SDD §22", "SDD §26", "SDD §40"]
---

# Spatial object

Anything with geometry on a [[Plan]]. §34's model gives it four branches, and this note is the
place they are all covered, because individually most of them are a shape with a label:

- **PhysicalElement** — Wall, Door, Window, Tree, Structure. Things that exist.
- **Area** — Room, GardenArea, Terrace, Driveway. Extents that carry quantity.
- **PlanningZone** — [[Construction section]], WorkArea. Extents that carry *intent* rather
  than physical fact.
- **Annotation** — Measurement, Text, Marker, PhotoReference. Things that say something about
  the plan without being part of what is built.

The branch matters because it decides what may be asked of the object. An Annotation has no
quantity and no cost; a Wall has length and can be demolished; an Area has area and can be
tiled. Flattening these into "shape with a type string" would put the burden of that
distinction on every consumer.

§7's geometry types and SDD §22's geometry core are the primitives underneath; SDD §26 is the
validation — a self-intersecting polygon has no defensible area, so it is refused rather than
measured.

## Identity and persistence

In the [[Plan]]'s geometry sidecar (§37, SDD §40): an `id`, a type, and points in millimetre
world coordinates. §59 allows it to **link to a domain note** — that link is how the polygon
drawn on the plan becomes *the bathroom* rather than staying a shape.

## Relationships

- Belongs to exactly one [[Plan]] (§59).
- May belong to a [[Layer]].
- May link to exactly one domain note, most often a [[Zone]] (§59).
- Carries a §30 object state: existing, to-remove, to-retain, planned, in-progress, installed.

## Rules

- Points are millimetres in world coordinates, never canvas pixels (§38).
- Geometry is validated before it is measured (SDD §26).
- The link to a domain note is by stable `id`, never by filename (SDD §83).
- An Annotation branch object never contributes to a quantity or a cost.

## Sources

PRD §7 · PRD §30 · PRD §34 · PRD §38 · PRD §59 · SDD §22 · SDD §26 · SDD §40, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
