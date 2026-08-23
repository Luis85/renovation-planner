---
kind: entity
name: Issue
layer: domain
persistence: note
sources: ["PRD §26", "PRD §27", "PRD §58"]
---

# Issue

Something that has gone wrong and is blocking or costing. §26 groups it with [[Risk]] and
[[Constraint]], and asks for spatial issue markers alongside.

The distinction from its two neighbours is in [[Risk]], and it is the one worth holding: an
issue is *actual*. It has already happened, so probability is meaningless and impact is
observed. What it needs is resolution and an owner, not mitigation.

Its spatial attachment is the feature that makes it worth modelling here rather than as a task.
§26's marker on the [[Plan]] means *the damp is in that corner*, and §27's site log and progress
photos are where the evidence accumulates. An issue found on site is discovered *somewhere*, and
losing the where is losing most of it.

An issue commonly forces a [[Decision]] and produces a change: §25's change requests and impact
analysis are frequently downstream of one.

**Note:** this is the domain entity. The `docs/issues/` folder in this repository is a
different thing — open questions about the *plugin*, in the backlog's own vocabulary.

## Identity and persistence

A Markdown note with a stable `id` (§60), status, owner and the affected entity in frontmatter.

## Relationships

- Attached to a [[Zone]], [[Work package]] or [[Construction section]].
- May be shown on a [[Plan]] as a marker [[Spatial object]] (§26).
- May have originated as a [[Risk]] that materialised.
- Evidenced by [[Photo]] and [[Document]] (§27).
- Resolved by a [[Decision]], and usually by [[Task]]s.
- May block a [[Work package]] via [[Dependency]].

## Rules

- Resolution is recorded on the issue. What it cost and what it taught is the reason to keep it
  after it closes.
- A closed issue is kept, not deleted.
- An issue with no evidence and no location is a note. §26 and §27 both push it toward being
  attached to something.

## Sources

PRD §26 · PRD §27 · PRD §58, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
