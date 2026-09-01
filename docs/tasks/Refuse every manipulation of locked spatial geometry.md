---
type: Task
parent: "[[Lock completed spatial geometry against accidental editing]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Refuse every manipulation of locked spatial geometry

## Evidence

Rooms and Walls can be manipulated through pointer handles, exact keyboard dimensions and
Inspector commits. The locking contract says finished geometry cannot be accidentally
manipulated, not merely that its canvas handles disappear.

## Why it matters

A presentation-only lock is bypassed by whichever mutation route does not consult the component
that drew it.

## Approach

Enforce authoritative lock state at the shared geometry-mutation boundary for single Rooms,
single Walls and completed groups. Disable or explain unavailable controls in Presentation, but
retain command-time refusal as the invariant. Keep selection and read-only inspection active.

## Acceptance criteria

- Pointer drag, handle resize, keyboard dimension edit and Inspector geometry commit all consult
  one lock policy.
- Every locked manipulation refuses before a geometry write and gives a visible reason.
- Group manipulation refuses when the accepted group-lock semantics say the target is locked.
- Selection, navigation and inspection remain available.
- Unlock uses the dedicated non-canvas action rather than an implicit edit-side bypass.

## Risks

Testing only disabled controls misses direct command dispatch; test the mutation boundary and
each route that reaches it.

## Outcome

No supported manipulation path can change locked completed spatial geometry.
