---
kind:
name: Decision
layer: domain
persistence: note
sources:
  - PRD §25
  - PRD §58
  - PRD §77
  - PRD §29
type: entity
---

# Decision

A planning choice, with the alternatives that were rejected and what it changed. §25 asks for
decisions, alternatives, change requests, impact analysis and change history, and lists what an
impact may touch: budget, schedule, assets, procurement, work packages, tasks.

**The alternatives are the content.** A decision recording only what was chosen leaves the next
reader — usually the same person, months later — to re-derive why the other options were worse,
which turns a decision into a piece of history rather than something that can be argued with.
This repository holds itself to the same rule for its own decisions, wherever they land — its
`adrs/`, and the rejected alternatives written beside a decision in the entity or slice note that
owns the subject.

It blocks work, which is why §77 admits decision → [[Work package]] as a [[Dependency]] pair.
*We cannot order until we choose the tile* is a real schedule constraint and one of the two
commonest non-task blockers in a renovation.

Its relationship to [[Scenario]] is sequential: a scenario is the comparison, a decision is the
outcome of one. §29's *select scenario* is exactly the moment one becomes the other.

## Identity and persistence

A Markdown note (§36's `Decisions/`) with a stable `id` (§60), the date and the status in
frontmatter, and the reasoning in the body where prose belongs.

## Relationships

- Blocks 0..n [[Work package]] via [[Dependency]] (§77).
- May select a [[Scenario]] (§29).
- Its impacts reach [[Cost item]], the schedule, [[Asset]], [[Procurement item]],
  [[Work package]] and [[Task]] (§25).
- May resolve an [[Issue]] or accept a [[Risk]].
- May be occasioned by a [[Constraint]].

## Rules

- A decision records the alternatives it rejected, or it is a note saying what happened.
- **Not deleted when superseded.** A reversed decision plus the reversal is the record; deleting
  the first makes the second unreadable.
- Impact analysis (§25) is derived at the time of asking — it reads the current graph rather
  than replaying what was true when the decision was taken.

## Business rules that reach this entity

[[A dependency is allowed only between five pairs of things]] · [[A derived value is recomputed on read, not persisted]]

## Sources

PRD §25 · PRD §58 · PRD §77 · PRD §29, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
