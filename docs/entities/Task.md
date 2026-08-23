---
kind: entity
name: Task
layer: domain
persistence: note
partOf: "[[Work package]]"
sources: ["PRD §8", "PRD §20", "PRD §58", "PRD §65", "PRD §77"]
---

# Task

Concrete executable work: *order terrace tiles*, *compact sub-base*, *install drainage*, *cut
tiles*. §20's lifecycle is todo → in-progress → blocked → done → cancelled.

The defining constraint is that this plugin does **not own it**. §20 asks for Obsidian task
integration and the requirement note [[Obsidian task integration]] reads that as a refusal: a
private task format would make the renovation the one part of the vault the user's own tooling
cannot see. So a task is an ordinary Markdown checkbox, and
[[The renovator's task tooling]] is the actor that reads it.

§65 makes the consequence explicit: **a task ticked by hand is the normal case, not an edge
case**, and must never be overwritten. That single rule is why progress everywhere upstream is
derived rather than stored — there is no second place for "is it done" to live.

§20 also asks that a task be creatable *from context*: from a [[Zone]], an [[Asset]], a
[[Work package]] or a [[Construction section]]. The link back to whatever it came from is the
task's most valuable property, because it is what lets a checkbox in a daily note still mean
something six weeks later.

## Identity and persistence

A Markdown checkbox in a note, with a stable `id` (§60) and the link to its origin. Status is
the checkbox; the richer §20 lifecycle states that the checkbox cannot express are frontmatter
beside it, never instead of it.

## Relationships

- Usually belongs to one [[Work package]]; may hang off a [[Zone]], [[Asset]] or
  [[Construction section]] directly (§20).
- Depends on other tasks via [[Dependency]] (§77).
- Carries actual dates, which is where the [[Work package]]'s real schedule comes from.

## Rules

- The checkbox is the source of truth for completion. Nothing else may contradict it.
- A task created from context keeps the reference by stable `id`, not by filename (SDD §83).
- Cancelled is not deleted: it is a state (§20), and the record of a decision not to do
  something is worth as much as the doing.

## Sources

PRD §8 · PRD §20 · PRD §58 · PRD §65 · PRD §77, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
