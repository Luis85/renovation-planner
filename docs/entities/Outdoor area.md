---
kind:
name: Outdoor area
layer: domain
persistence: note
partOf: "[[Site]]"
sources:
  - PRD §6
  - PRD §58
  - PRD §4
  - PRD §8
type: entity
---

# Outdoor area

The [[Site]]'s other branch: garden, terrace, driveway, front garden, everything not inside a
[[Building]]. §6 and §58 give it a branch of its own rather than treating it as a floor
without walls.

That separation is a product decision, not a modelling nicety. §4's primary persona plans
*garden redesign* and *outdoor works* as first-class jobs, not as leftovers from a house
renovation, and §8's [[Zone]] examples put terrace, front garden, flower bed, driveway and
roof beside kitchen and bathroom. A model that reached outdoor space only by relaxing an
indoor assumption would keep producing indoor answers.

## Identity and persistence

A note, with a stable `id` (§60).

## Relationships

- Belongs to exactly one [[Site]].
- Has no [[Floor]] and no [[Space]] — that is the branch it is not on.
- Depicted by [[Plan]]s, and subdivided by [[Zone]]s.

## Rules

- Carries no geometry.
- Nothing in the quantity, cost or scheduling model may assume a room. An outdoor
  [[Requirement]] is measured from area and length the same way an indoor one is.

## Business rules that reach this entity

[[A requirement names what it is required for]]

## Sources

PRD §6 · PRD §58 · PRD §4 · PRD §8, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
