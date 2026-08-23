---
kind:
name: Dependency
layer: domain
persistence: note
sources:
  - PRD §77
  - PRD §78
  - PRD §21
  - PRD §19
  - PRD §20
type: entity
---

# Dependency

An ordering constraint between two things. §77 enumerates the pairs it may hold between:
[[Work package]] → [[Work package]], [[Task]] → [[Task]], [[Procurement item]] →
[[Work package]], [[Decision]] → [[Work package]], [[Milestone]] → [[Work package]].

§78 gives three initial types, and they are not three flavours of the same thing:

- **Finish-to-Start** — scheduling. The second cannot start until the first finishes, and it
  moves dates.
- **Blocking** — status. The second is stuck, whatever the dates say.
- **Informational** — neither. A recorded relationship that changes nothing automatically.

The reason it is an entity rather than a list of ids on each side is that third type. An
informational link has no direction that a scheduler should act on, and a dependency list that
cannot say "related, but do not reschedule anything" gets misused until nobody trusts the
dates.

That §77 list also shows what makes this model different from a plain task graph: a
[[Procurement item]] and a [[Decision]] can block work. *We cannot tile until the tiles arrive*
and *we cannot order until we choose* are the two commonest real blockers in a renovation, and
neither is a task.

## Identity and persistence

Frontmatter on the dependent side, referencing the other by stable `id` (SDD §83), with the
§78 type. It has no note of its own — it has no lifecycle, no cost and no body worth writing.

## Relationships

- Connects exactly two entities, from §77's permitted pairs.
- Consumed by [[Milestone]] and the schedule, and by [[Work package]] status.

## Rules

- References are by stable `id`. A dependency pointing at a deleted note is exactly the
  dangling reference §63 requires be detected.
- A cycle is invalid and must be refused at the point it would be created, not discovered later
  by a scheduler that fails to terminate.
- Only Finish-to-Start moves dates. Blocking changes status; Informational changes nothing.

## Sources

PRD §77 · PRD §78 · PRD §21 · PRD §19 · PRD §20, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
