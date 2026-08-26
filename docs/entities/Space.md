---
name: Space
layer: domain
persistence: note
partOf: "[[Floor]]"
sources:
  - PRD §6
  - PRD §34
  - PRD §58
  - PRD §60
type: entity
---

# Space

A room-sized subdivision of a [[Floor]] in the *building* hierarchy. The bottom of §6's
structural tree.

**The distinction worth getting right is Space versus [[Zone]].** A space is a place in the
building — the bathroom, as a fact about the house. A zone is a place with geometry that
planning attaches to — the bathroom, as an area you drew on a [[Plan]] and are going to tile.
They coincide constantly, and are still not the same object: a zone can cover half a room or
span two, and a room can exist with nothing planned in it at all. §34 keeps them in separate
branches for that reason, and merging them would make it impossible to say *this room is
untouched*.

## Identity and persistence

A note, with a stable `id` (§60). The most commonly skipped level of the hierarchy: many
projects go straight to [[Zone]]s.

## Relationships

- Belongs to exactly one [[Floor]].
- May correspond to one or more [[Zone]]s, or to none.

## Rules

- Carries no geometry. If it has an outline you drew, that outline is a [[Zone]].
- Existing without any planned work is the normal case and must stay expressible.

## Business rules that reach this entity

[[Work belongs to one project, catalogues belong to the vault]]

## Sources

PRD §6 · PRD §34 · PRD §58 · PRD §60, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
