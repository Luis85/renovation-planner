---
kind: entity
name: Milestone
layer: domain
persistence: note
sources: ["PRD §21", "PRD §58", "PRD §77", "PRD §28"]
---

# Milestone

A dated point that matters: *bathroom usable*, *scaffolding down*, *move-in*. §21 lists it among
the schedule features, and §77 admits milestone → [[Work package]] as a [[Dependency]] pair.

**A milestone has no duration and no work.** That is what distinguishes it from a
[[Work package]] with a short scope: it consumes nothing and produces nothing, it only *arrives*
— which is exactly what makes it useful as a fixed point everything else is arranged around.

The dependency direction in §77 is the interesting half. A milestone can block a work package,
not merely summarise one, which means it works as a **deadline** and not only as a marker: *the
bathroom must be usable before the guests arrive* constrains everything upstream of it.

For a private renovation these are usually the dates real life imposes — a tenancy ending, a
birth, a season for planting. They come from outside the project, which is why they are entities
rather than derived from the work.

## Identity and persistence

A note with a stable `id` (§60), the target date and the status in frontmatter. Small, and
mostly frontmatter.

## Relationships

- Belongs to the [[Project]]; may be scoped to a [[Construction section]].
- Blocks or is blocked by [[Work package]]s via [[Dependency]] (§77).
- Appears on the timeline (§21) beside [[Work package]] and [[Trade]] schedules.
- Feeds §28's project cockpit, where upcoming work is what the renovator actually reads.

## Rules

- Zero duration. A milestone with a start and an end is a [[Work package]].
- Its date is a target, and whether it will be met is derived from the work leading to it —
  never a status typed by hand, which would be the same defect as a hand-typed progress
  percentage.
- Missing one is a fact worth keeping. The date is not edited to whatever happened.

## Sources

PRD §21 · PRD §58 · PRD §77 · PRD §28, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
