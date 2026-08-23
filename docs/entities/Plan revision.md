---
kind: entity
name: Plan revision
layer: domain
persistence: note
partOf: "[[Plan]]"
sources: ["PRD §31", "PRD §30", "PRD §61"]
---

# Plan revision

An explicit version of a [[Plan]], with its own lifecycle: draft → proposed → approved →
superseded → as-built (§31).

Its reason to exist is that a renovation plan is *argued about*. §31 asks for revision
metadata, comparison between revisions, and — the load-bearing one — an **immutable approved
revision**. Once a revision is approved, the numbers quoted against it, the [[Quote]]s
received for it and the [[Decision]]s taken on it all refer to a state that must still be
recoverable, or none of those records mean anything later.

It is the sibling of §30's object states (existing, to-remove, to-retain, planned,
in-progress, installed), which version an individual object's *condition*. A revision versions
the whole plan's *content*. The as-built state is where the two meet.

## Identity and persistence

A note, with a stable `id` (§60), referencing the [[Plan]] and the geometry snapshot it
describes.

## Relationships

- Belongs to exactly one [[Plan]].
- Supersedes at most one earlier revision, forming a chain rather than a tree.
- Referenced by [[Decision]] and [[Quote]], which is why immutability matters.

## Rules

- **An approved revision is immutable.** Changing it is not an edit; it is a new revision that
  supersedes it.
- A comparison between two revisions is derived on demand, never stored.
- The as-built revision is the record of what was actually built, not a plan for it.

## Sources

PRD §31 · PRD §30 · PRD §61, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
