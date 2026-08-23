---
kind: entity
name: Work package
layer: domain
persistence: note
partOf: "[[Project]]"
sources: ["PRD §8", "PRD §19", "PRD §10", "PRD §58", "PRD §59", "PRD §77"]
---

# Work package

A plannable unit of work: one [[Trade]] doing one scope of work in one place. §8 gives it a
construction section, trade, scope, assets, tasks, dependencies, estimate, planned dates,
actual dates and status.

This is the pivot of the whole model. §19's goal states it exactly — *turn spatial planning
into executable project planning* — and everything upstream (geometry, zones, quantities)
converges here, while everything downstream (tasks, schedule, procurement, cost) flows out of
it. It is the smallest thing you would ask someone for a price on.

§59's rule is looser than it looks: a work package belongs to one [[Project]], **optionally**
one [[Construction section]], and at least one domain scope. The optional section matters —
work that does not fit a section must still be plannable, or the model forces bookkeeping
before it allows work.

## Identity and persistence

A Markdown note (§36, §37) with a stable `id` (§60). Trade, section, status and planned dates
belong in frontmatter for [[Bases]]; the scope belongs in the body, where it can be written in
sentences.

## Relationships

- Belongs to exactly one [[Project]]; optionally one [[Construction section]] (§59).
- Has exactly one [[Trade]].
- Scoped to 0..n [[Zone]] (its "at least one domain scope" is usually spatial).
- Contains 0..n [[Task]].
- Sources 0..n [[Requirement]].
- Accrues 0..n [[Cost item]] (§10).
- Depends on other work packages, [[Procurement item]]s, [[Decision]]s and [[Milestone]]s via
  [[Dependency]] (§77).

## Rules

- Progress is derived from its [[Task]]s, which are derived from checkboxes owned by
  [[The renovator's task tooling]]. It is never stored as a percentage someone types.
- Its estimate is the sum of its [[Cost item]]s, not an independent number.
- Planned dates live here; actual dates live on the tasks. Conflating them loses the variance
  that §28's forecast is built from.

## Sources

PRD §8 · PRD §19 · PRD §10 · PRD §58 · PRD §59 · PRD §77, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
