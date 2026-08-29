---
name: Constraint
layer: domain
persistence: note
sources:
  - PRD §25
  - PRD §26
  - PRD §58
  - PRD §60
type: entity
---

# Constraint

A fixed limit the plan has to be designed around. §26 groups it with [[Risk]] and [[Issue]] and
gives it no property list of its own, which understates it.

It is the one of the three that is **not an event**. A risk might happen, an issue has happened,
a constraint simply *is*: the ceiling is 2.10 m, the doorway is 78 cm wide, the budget stops at
80,000, the bathroom has to be usable by the end of March, the listed façade cannot be touched.
None of those will ever be resolved or mitigated — they are the boundary of the solution space.

That makes its role in the model different too. A constraint does not get worked on; it gets
*checked against*. §25's impact analysis is where it bites: a [[Decision]] that violates one is
a decision that has to be revisited, and the value of writing constraints down is that the
violation is noticed before the bath is delivered rather than after.

Physical constraints attach to space, which is why §26's markers apply here as well as to
issues.

## Identity and persistence

A Markdown note with a stable `id` (§60), the kind of constraint and the affected entity in
frontmatter. Frequently short — a constraint is often one sentence and a number.

## Relationships

- Attached to the [[Project]], a [[Zone]], a [[Construction section]] or a [[Work package]].
- Bounds [[Decision]] and [[Scenario]] — a scenario violating a constraint is not an option.
- May bound [[Cost item]] (a budget ceiling) or the schedule (a fixed date).
- May be shown on a [[Plan]] as a marker [[Spatial object]] (§26).

## Rules

- Not resolvable. It has no done state, which distinguishes it from an [[Issue]] in the data as
  well as in the prose.
- Changing one is a [[Decision]], usually a significant one, and keeps its history.
- The value is in being checkable. A constraint written as prose nobody can compare against is a
  reminder, not a constraint.

## Sources

PRD §25 · PRD §26 · PRD §58 · PRD §60, in
[`docs/product/prds/obsidian-renovation-planner.md`](../product/prds/obsidian-renovation-planner.md) and
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](../development/sdds/obsidian-renovation-planner-SDD.md).
