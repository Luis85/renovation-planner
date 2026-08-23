---
kind:
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
[[Work package]]s, [[Asset]]s, [[Supplier]]s and [[Document]]s.

It is a root rather than a container, which is a different claim. Nothing here spans two
projects — the index (SDD §47) is scoped to one, the currency (§72) is defined once per
project, and there is no portfolio. Admitting a second root is one of the changes
[[Professional planner]] would force.

§8's properties: name, description, status, start, target completion, budget, contingency,
location description, linked plans. §83 adds project settings on top of plugin settings, so
some configuration is per project rather than global.

## Identity and persistence

One note at the root of the renovation folder, named after the project and deduplicated on
collision like every other entity note
([`docs/design/04-persistence-and-repository-layer.md`](../design/04-persistence-and-repository-layer.md)),
with a stable `id` independent of filename, title and path (PRD §60) and a `schema-version`
(PRD §61).

PRD §36 draws this file as `Project.md`, and that is a recommendation rather than a rule: the
section is headed "Recommended structure" and closes with "Paths must be configurable". An
earlier version of this note hardened the drawing into identity, which would have made Project
the one entity whose filename is fixed while every other is derived from its name.
[[Start a renovation project]] is where that was noticed and settled.

## Relationships

- Owns [[Plan]], [[Construction section]], [[Work package]], [[Asset]], [[Supplier]],
  [[Document]] — 0..n each (§59).
- Owns at most one [[Site]], which is where the physical hierarchy starts.
- Defines the currency every [[Money]] value in it is denominated in (§72).

## Rules

- Every other entity resolves to exactly one project. There is no cross-project reference.
- The budget here is the top of the [[Cost item]] hierarchy (§10), not a number typed twice.
- Deleting it is not a modelled operation — that is deleting the folder, which belongs to
  [[The vault]] and its owner.

## Sources

PRD §8 · PRD §12 · PRD §58 · PRD §59 · PRD §72 · PRD §83 · SDD §47, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
