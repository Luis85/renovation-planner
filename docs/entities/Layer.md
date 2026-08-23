---
kind:
name: Layer
layer: domain
persistence: sidecar
partOf: "[[Plan]]"
sources:
  - PRD §6
  - PRD §8
  - PRD §13
  - PRD §30
  - PRD §37
  - SDD §17
  - SDD §18
type: entity
---

# Layer

A named, toggleable grouping of what is drawn on a [[Plan]]. §8 lists layers among a plan's
properties and §13's plan editor makes them a feature.

Layers exist because a renovation plan shows several incompatible truths at once. §30's
existing-versus-target view is the sharpest case: the wall being removed and the wall
replacing it occupy the same coordinates, and the only way to read either is to hide the
other. That makes layer visibility a *planning* tool rather than a drawing convenience.

They are distinct from Konva's rendering layers (SDD §17, §18), which are an implementation
of the canvas and group by paint cost rather than by meaning. A domain layer maps onto
rendering, but the two lists are not the same list and must not be made to be.

## Identity and persistence

In the [[Plan]]'s geometry sidecar rather than as a note (§37 lists layer state as sidecar
data). A layer has no frontmatter worth querying, no [[Cost item]] and no lifecycle — making
it a note would put a file in [[The vault]] that no one has a reason to open.

## Relationships

- Belongs to exactly one [[Plan]].
- Groups 0..n [[Spatial object]].

## Rules

- Visibility is a property of the plan's saved state, not ephemeral UI state — reopening a
  plan restores what was visible.
- A layer groups; it never owns. Deleting a layer must not delete the objects on it, or
  hiding and deleting become one keystroke apart.

## Business rules that reach this entity

[[A delete reports what references it and offers four choices]]

## Sources

PRD §6 · PRD §8 · PRD §13 · PRD §30 · PRD §37 · SDD §17 · SDD §18, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
