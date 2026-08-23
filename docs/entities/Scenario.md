---
kind:
name: Scenario
layer: domain
persistence: note
sources:
  - PRD §29
  - PRD §25
  - PRD §50
type: entity
---

# Scenario

A costed alternative, held beside the plan rather than in it. §29 asks for scenario costs,
scenario schedule, scenario assets, comparison and selection, and names the comparison
dimensions: cost, duration, material, effort, risk.

Its purpose is to let a renovator answer *tiles or decking?* with numbers instead of a feeling,
which requires the alternative to be modelled fully enough to cost — its own [[Asset]]s, its own
[[Requirement]]s, its own duration — while not being part of the real plan. That is the whole
difficulty: a scenario is a parallel branch of the project graph.

**The five comparison dimensions are the point.** A comparison on cost alone is the one a
spreadsheet already gives you; §29 asks for duration, material, effort and risk alongside it,
because the cheapest option is routinely the one that takes three more weekends.

Selecting a scenario produces a [[Decision]] and folds the branch into the plan. The unselected
scenarios stay, because *what we nearly did and why we did not* is the same value a decision's
rejected alternatives carry.

## Identity and persistence

A Markdown note (§36's `Decisions/` neighbourhood) with a stable `id` (§60) and a status.
The entities it varies reference it, rather than being copied into it — a scenario that
duplicated its assets would drift from the library the moment a price changed.

## Relationships

- Scoped to a [[Construction section]] or a [[Work package]], not usually the whole project.
- Varies [[Asset]], [[Requirement]], [[Cost item]] and schedule.
- Selected by a [[Decision]] (§29).
- Compared against sibling scenarios on §29's five dimensions.

## Rules

- Scenario costs never aggregate into the project's real figures. A scenario that changed the
  budget by existing would make every total a question about which branch you are looking at.
- Unselected scenarios are kept.
- V2 scope (§50). The entity is named here so the model has a place for it, not because it is
  being built.

## Sources

PRD §29 · PRD §25 · PRD §50, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
