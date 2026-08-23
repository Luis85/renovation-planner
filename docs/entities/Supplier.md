---
name: Supplier
layer: domain
persistence: note
partOf: "[[Project]]"
sources:
  - PRD §10
  - PRD §22
  - PRD §36
  - PRD §59
  - PRD §60
  - PRD §103
type: entity
---

# Supplier

A party that sells something or does work: a builders' merchant, a garden centre, a tiling firm,
a one-person electrician. §22 asks for supplier records, and §10 makes supplier one of the seven
axes cost aggregates by.

**A supplier is a record, not an actor.** Nobody at the supplier ever touches this plugin —
§3.1's local-first and §57's rejection of multi-user collaboration see to that — so it appears
in `entities/` and not in `actors/`. What is modelled is the renovator's *notes about* them.

It is also not a [[Trade]]. The trade is the discipline (tiling); the supplier is whoever is
doing it or selling for it. One supplier can cover several trades, one trade can have several
suppliers competing, and the reason to compare [[Quote]]s at all is that both are true.

## Identity and persistence

A Markdown note (§36's `Suppliers/`) with a stable `id` (§60). Contact details in
frontmatter, everything else — what they were like, what they got wrong — in the body, where
prose belongs.

## Relationships

- Belongs to exactly one [[Project]] (§59). Not a global address book.
- Gives 0..n [[Quote]].
- Receives 0..n [[Order]], sends 0..n [[Invoice]].
- Aggregates [[Cost item]]s across everything bought from them (§10).
- Covers 0..n [[Trade]], and supplies 0..n [[Asset]].

## Rules

- Contains personal data belonging to a third party. §103's security and privacy section
  applies: it stays local, it is never transmitted, and it is the most sensitive content in the
  vault.
- Has no prices of its own. A price is a [[Quote]] with a date and a validity, because
  yesterday's price is not today's.

## Business rules that reach this entity

[[Each cost type has exactly one source of record]] · [[A cost rollup is derived along its axis, never stored]]

## Sources

PRD §10 · PRD §22 · PRD §36 · PRD §59 · PRD §60 · PRD §103, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
