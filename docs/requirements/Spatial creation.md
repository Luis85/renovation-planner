---
type: Feature
parent: "[[Plan editor]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Spatial creation

Homeowners rarely begin with complete survey data. They may know a room's dimensions, have a
rough sketch, hold an estate-agent image or architect's PDF, or simply know which spaces they
want to renovate. Spatial creation lets them start from any of that evidence and add precision
only when it becomes useful.

In homeowner-facing presentation, an existing `Plan` is a **Floor** and a room-compatible
`Zone` is a **Room**. Those mappings do not rename persisted concepts or duplicate the domain
rules owned by their entity and architecture notes.

## Outcome

A homeowner can start with the information they have and create accurate rooms, walls and
openings, or trace a calibrated reference, with reversible completed changes and cancellable
drafts.

## Sources

- [[Renovation Planner — Editor UX Research & Pattern Study]], especially room-first creation,
  multiple starting points and blueprint tracing.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], especially
  sections 16–27, 46–50 and 68.
- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], especially
  the Room/Zone and Plan/Floor compatibility mappings and WP5–WP7.
- [Renovation Planner — Editor Implementation Plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md), increment B and phases 4–6.
