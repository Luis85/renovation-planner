---
kind:
name: Floor
layer: domain
persistence: note
partOf: "[[Building]]"
sources:
  - PRD §6
  - PRD §58
  - PRD §79
  - PRD §8
type: entity
---

# Floor

A storey of a [[Building]] — basement, ground floor, first floor. §6 places it between the
building and the [[Space]].

This is the level at which a [[Plan]] usually exists. §8's plan examples are *property, ground
floor, first floor, basement, garden, garage*, and §79 repeats the list, so in practice a floor
and a plan are close to one-to-one. They stay separate entities because they answer different
questions: the floor is part of the building, the plan is a drawing with a scale and a
background image, and one floor can have several plans across [[Plan revision]]s.

## Identity and persistence

A note, with a stable `id` (§60).

## Relationships

- Belongs to exactly one [[Building]].
- Contains 0..n [[Space]].
- Usually depicted by one [[Plan]], but that is a convention rather than a constraint.

## Rules

- Carries no geometry of its own.
- Naming is the user's. §84's custom types reach the vocabulary here as much as anywhere —
  *Souterrain* and *Dachgeschoss* have to round-trip unchanged.

## Sources

PRD §6 · PRD §58 · PRD §79 · PRD §8, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
