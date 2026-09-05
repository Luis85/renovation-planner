---
name: Snap guide
medium: canvas
region: canvas
slice:
  - "[[07-calibration]]"
partOf: "[[Design System]]"
sources:
  - SDD §19
  - SDD §21
  - SDD §85
type: component
image: "[[snap-guide.png]]"
---

# Snap guide

The drawn feedback that a snap is in effect — the line or marker saying *this edge aligned with
that one*. The only component in this inventory that is pure output: it is never a target, it
takes no input, and a user cannot interact with it at all.

## Specimen

![Snap guide, and the states it owes, in Obsidian's default light and dark](snap-guide.png)

A drawing of the proposal, not a screenshot of anything built — `src/` is a scaffold.
Obsidian's **default** light and dark, so a themed vault differs; shot from
[`component-gallery.html`](component-gallery.html) by `npm run concept-shots`.

## Anatomy

- **On SDD §19's InteractionLayer**, transient, alongside [[Selection handle]] and the drawing
  previews.
- **One shape per snap kind.** SDD §21's `SnapService` exposes six operations — `snapPoint()`,
  `snapRotation()`, `snapResize()`, `snapToGrid()`, `snapToVertex()`, `snapToEdge()` — and they
  do not all mean the same thing to a user. A grid snap and a vertex snap drawn identically is
  feedback that says *something* snapped, which is the least useful thing it could say.

## States

Two, and deliberately fewer than [[Design System]]'s ten:

| State | Notes |
| --- | --- |
| Absent | No snap applies |
| Active | A snap applies, drawn for as long as it does |

There is **no hover, no focus and no selected state**, because a guide is output rather than a
control. Listing them as "not applicable" would imply they were considered and refused; they
were never available.

## Contract

**Given** the snap result from SDD §21's service — which point was snapped, to what, and by
which operation. **Emits** nothing.

Snapping is an editor/application service per SDD §21, so this component draws a decision made
elsewhere and has no vote in it. The consequence worth stating: **a guide that cannot name which
operation fired cannot be built from this contract**, so the result has to carry the operation,
not just the adjusted point. That is a requirement this note places on slice 07 rather than a
detail it can settle.

## Where it appears

[[Plan canvas]], during a draw or a transform. Never at rest.

## Accessibility

**A snap that is only drawn is a snap a non-visual user does not know happened** — and unlike
[[Selection handle]], there is no possible drawn equivalent, because the problem is not the
size of the mark but that the mark is the whole message.

The second channel for a canvas guide cannot be colour, weight or a ring. It has to be text
somewhere, and [[Status bar]] is the only surface that exists to carry it. That makes this the
one component in the inventory whose accessibility answer lives in a different component.

## Open

1. **Does the guide or the [[Status bar]] report which snap fired?** Both is the wrong answer —
   [[Information Architecture]]'s rule is that a fact is shown once, where it is derived, and
   referenced elsewhere.
2. **Is there a snap the user can decline?** SDD §21 makes snapping a service and says nothing
   about disabling it. A guide for a snap that cannot be refused is a notification; a guide for
   one that can is an affordance, and they are drawn differently.

## Sources

SDD §19 · SDD §21 · SDD §85, in
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](../development/sdds/obsidian-renovation-planner-SDD.md).
