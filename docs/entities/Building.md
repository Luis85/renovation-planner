---
kind:
name: Building
layer: domain
persistence: note
partOf: "[[Site]]"
sources:
  - PRD §6
  - PRD §58
  - PRD §79
type: entity
---

# Building

A structure on the [[Site]]: the house, the garage, the shed. §6 and §58 place it between the
site and the [[Floor]].

Its whole job is to be the thing a [[Floor]] belongs to. Without it, "the ground floor" is
ambiguous the moment a property has both a house and a garage — which §79's multi-plan
examples (basement, ground floor, upper floors, *garage*) show is the expected case rather
than an exotic one.

## Identity and persistence

A note, with a stable `id` (§60). Like [[Site]], commonly absent on a single-building
project where the building and the site are the same thing.

## Relationships

- Belongs to exactly one [[Site]].
- Contains 0..n [[Floor]].
- Distinct from [[Outdoor area]], which is the site's other branch and has no floors.

## Rules

- Carries no geometry. It is depicted by [[Plan]]s, not drawn.
- A building with no floors modelled is still valid — the hierarchy is optional depth, not a
  required path.

## Business rules that reach this entity

[[Every entity resolves to exactly one project]]

## Sources

PRD §6 · PRD §58 · PRD §79, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
