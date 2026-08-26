---
name: Project
layer: domain
persistence: note
sources:
  - PRD §8
  - PRD §12
  - PRD §58
  - PRD §59
  - PRD §72
  - PRD §83
  - SDD §47
type: entity
---

# Project

The whole renovation, and the root of everything else. §58's relationship model hangs off it
and §59 states the rule plainly: a project owns 0..n [[Plan]]s, [[Construction section]]s,
[[Work package]]s and [[Document]]s. It does **not** own the three catalogues — [[Asset]],
[[Supplier]] and [[Trade]] are shared across projects (§59, amended 2026-08-26) and a project
references them without containing them, which is what
[[Work belongs to one project, catalogues belong to the vault]] states in full.

It is a root rather than a container, which is a different claim. **Nothing here spans two
projects** — the index (SDD §47) is scoped to one, the currency (§72) is defined once per
project, and there is no portfolio.

A vault may nonetheless hold several projects, and a Home lists them so one can be opened. That
is a surface, not a second root: it reads project notes and opens one, adding no relationship
across them, which is why none of the three sentences above changes. **Selecting among projects
and aggregating across them are different things**, and only the second would force the second
root — see
[[The vault holds many projects, and selecting one is not a portfolio]]. Aggregation is what
[[Professional planner]] would force, and it stays refused.

§8's properties: name, description, status, start, target completion, budget, contingency,
location description, linked plans. §83 adds project settings on top of plugin settings, so
some configuration is per project rather than global.

## Identity and persistence

One note at the root of the renovation folder, named after the project and deduplicated on
collision like every other entity note
([`docs/tasks/04-persistence-and-repository-layer.md`](../tasks/04-persistence-and-repository-layer.md)),
with a stable `id` independent of filename, title and path (PRD §60) and a `schema-version`
(PRD §61).

PRD §36 draws this file as `Project.md`, and that is a recommendation rather than a rule: the
section is headed "Recommended structure" and closes with "Paths must be configurable". An
earlier version of this note hardened the drawing into identity, which would have made Project
the one entity whose filename is fixed while every other is derived from its name.
[[Start a renovation project]] is where that was noticed and settled.

## Relationships

- Owns [[Plan]], [[Construction section]], [[Work package]] and [[Document]] — 0..n each (§59).
- **References, and does not own,** the three shared catalogues: [[Asset]], [[Supplier]] and
  [[Trade]] (§59, amended 2026-08-26). They live in §36's `Library/`, are available to every
  project, and carry no project id.
- Owns at most one [[Site]], which is where the physical hierarchy starts.
- Defines the currency every [[Money]] value in it is denominated in (§72).

## Rules

- Every unit of *work* resolves to exactly one project, and between two projects' work there is no
  reference. The catalogues are the exception and belong to no project at all — both halves are
  [[Work belongs to one project, catalogues belong to the vault]].
- What a project does with a shared catalogue entry is still its own: a [[Requirement]], a
  [[Quote]] line and a [[Cost item]] belong to the project that raised them, however widely the
  [[Asset]] they name is shared.
- The budget here is the top of the [[Cost item]] hierarchy (§10), not a number typed twice.
- Deleting it is not a modelled operation — that is deleting the folder, which belongs to
  [[The vault]] and its owner.

## Business rules that reach this entity

[[Work belongs to one project, catalogues belong to the vault]] · [[Each cost type has exactly one source of record]]

## Sources

PRD §8 · PRD §12 · PRD §58 · PRD §59 · PRD §72 · PRD §83 · SDD §47, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
