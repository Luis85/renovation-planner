---
type: Feature
parent: "[[Plan editor]]"
order: 20
status: Active
started: 2026-09-04
finished: ""
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

## Progress

**2026-09-04** — this Feature's first increment has landed on `claude/plan-editor-add-room`:
**Add Room**, the vertical-slice plan's checkpoint C2. Its design is
`docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md` and its plan
`docs/superpowers/plans/2026-09-03-plan-editor-add-room.md`. A private renovator opens Add,
chooses Room, drags a rectangle whose width, depth and area follow the hand — or types the two
lengths with no pointer at all — names it, and one press writes ONE reversible Room. It changes
no schema: a Room is still a `Zone` note plus a sidecar entry, and
`tests/infrastructure/persistence/editorRoundTrip.test.ts` says so through the real command
rather than through a fixture.

Two of this Feature's fifteen PBIs are **Done** — [[Start room creation from Add]] and
[[Draw and name a rectangular room]], each with a dated `## Amendments` section naming the test
that holds every criterion, the one criterion that is vacuous and why, and the narrowings this
increment took rather than ticked. The nine Tasks under them are Done, each with a
`## Closing evidence` section.

What this Feature has NOT started, so that a reader does not infer it from "Active": free-form
rooms (the polygon tool stays registered and has no door — [[Create a free-form room]] is the
trigger), walls, openings, reference tracing, snapping, resize handles, and the three-way floor
start. Each is its own PBI and each is named in the design spec's §14.
