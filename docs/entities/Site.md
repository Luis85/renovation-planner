---
kind: entity
name: Site
layer: domain
persistence: note
partOf: "[[Project]]"
sources: ["PRD §6", "PRD §58", "PRD §79"]
---

# Site

The physical property the [[Project]] is about — the plot, with whatever stands on it. §6 and
§58 both put it directly under the project, branching into [[Building]] and [[Outdoor area]].

It is the answer to a question a flat list of [[Plan]]s cannot answer: *where is this,
physically?* A plan is a drawing of part of the site; the site is the thing itself. §79's
multi-plan model — site plan, basement, ground floor, upper floors, garden, garage — is a set
of views onto one site, which is why the site and not the plan is what they share.

For a single-flat renovation the site is degenerate and probably implicit. It earns its
existence on a property with a house, a garage and a garden, where "the garden" and "the
kitchen" need a common parent that is not just the project.

## Identity and persistence

A note, with a stable `id` (§60). Optional in practice: a project with one plan and no
outdoor work need not have one.

## Relationships

- Belongs to exactly one [[Project]].
- Contains 0..n [[Building]] and 0..n [[Outdoor area]] (§6).
- A [[Plan]] depicts part of a site, but belongs to the project (§59).

## Rules

- Structural, not spatial. The site carries no geometry of its own — geometry lives on a
  [[Plan]] and its [[Spatial object]]s.
- Being empty is legitimate. It is a place to hang structure when there is structure, not a
  step to complete.

## Sources

PRD §6 · PRD §58 · PRD §79, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
