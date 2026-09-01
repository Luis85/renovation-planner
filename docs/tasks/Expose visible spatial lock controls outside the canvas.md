---
type: Task
parent: "[[Lock completed spatial geometry against accidental editing]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Expose visible spatial lock controls outside the canvas

## Evidence

The interaction contract keeps locked elements visible, and the component library requires
canvas-only affordances to have accessible non-canvas routes. M00 and M07 keep Room and Wall
selection connected to an Inspector or list.

## Why it matters

A lock that is invisible is mistaken for a broken editor, while a canvas-only unlock can trap
keyboard users in a state they cannot change.

## Approach

Project the authoritative lock state into Room, Wall and completed-group selection overlays,
Inspector content and non-canvas rows. Add a keyboard-accessible lock/unlock control outside the
canvas, distinguish locked from merely non-editable, and retain selection and inspection.

## Acceptance criteria

- Finished Room, Wall and completed-group selections visibly identify locked and unlocked states.
- Lock state uses a mark and text or another non-color-only treatment.
- Inspector or list controls can lock and unlock without canvas manipulation.
- Locked entities remain selectable, inspectable and navigable.
- Draft geometry offers no misleading lock control.

## Risks

Deriving visuals from a local optimistic flag can disagree with the authority after refusal or
reload; render from the authoritative projection.

## Outcome

The renovator can see, inspect and deliberately change spatial lock state without relying on the
canvas.
