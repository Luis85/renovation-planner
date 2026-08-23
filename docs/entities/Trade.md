---
kind:
name: Trade
layer: domain
persistence: note
partOf: "[[Project]]"
sources:
  - PRD §8
  - PRD §19
  - PRD §10
  - PRD §21
  - PRD §84
type: entity
---

# Trade

A discipline of work: electrical, plumbing, painting, tiling, gardening, groundworks, roofing.
§8's list, and §19 asks for a catalog of them.

A trade is a **category, not a person**. It is not a [[Supplier]] and not a contractor, and
this is the distinction the entity exists to hold: *tiling* is a kind of work, whoever does it,
including the [[Private renovator]] doing it themselves on a Saturday. The company that quotes
for it is a supplier; the money is a [[Cost item]]; the work is a [[Work package]].

It earns its place by being an axis. §10 makes trade one of the dimensions cost aggregates by,
and §21 asks for a trade timeline — *when is the electrician here* is a question about a trade,
not about any one work package. Both of those are impossible if trade is a string on a work
package rather than an entity.

## Identity and persistence

A note in a small catalog (§36's `Trades/`), with a stable `id` (§60).

## Relationships

- Belongs to exactly one [[Project]] as catalog content.
- Assigned to 0..n [[Work package]], one trade each.
- Aggregates [[Cost item]]s and schedule across those work packages (§10, §21).
- Appears in a [[Construction section]] indirectly, through its work packages.

## Rules

- **Configurable** (§84). The shipped list is a starting set; a trade this plugin does not ship
  must round-trip unchanged. Regional and language differences make this immediate rather than
  hypothetical.
- Not a party to anything. A trade has no contact details, no address and no price — those
  belong to [[Supplier]] and [[Quote]].

## Business rules that reach this entity

[[A type this version does not know survives a round trip verbatim]] · [[A cost rollup is derived along its axis, never stored]]

## Sources

PRD §8 · PRD §19 · PRD §10 · PRD §21 · PRD §84, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
