---
name: Measurement label
medium: canvas
region: canvas
slice:
  - "[[07-calibration]]"
partOf: "[[Design System]]"
sources:
  - PRD §39
  - PRD §71
  - PRD §82
  - SDD §19
  - SDD §25
type: component
image: "[[measurement-label.png]]"
---

# Measurement label

The number drawn beside a measurement — the Measure tool's output, and the one value a renovator
reads more often than any other. It is a small component with the inventory's most consequential
rule attached to it: it is the place a plugin most easily tells a confident lie.

## Specimen

![Measurement label, and the states it owes, in Obsidian's default light and dark](measurement-label.png)

A drawing of the proposal, not a screenshot of anything built — `src/` is a scaffold.
Obsidian's **default** light and dark, so a themed vault differs; shot from
[`component-gallery.html`](component-gallery.html) by `npm run concept-shots`.

## Anatomy

- **A value and a unit**, together. A bare number on a plan is ambiguous between millimetres and
  metres, and PRD §71's own example spans both.
- **The geometry it belongs to** — a leader line or a position along the measured edge. A label
  that has drifted from its edge is measuring something else.
- **Two layers, depending on lifecycle.** While the Measure tool is active it is a *measure
  preview* on SDD §19's InteractionLayer; once kept it belongs to the AnnotationLayer.

## States

| State | Notes |
| --- | --- |
| Preview | Following the pointer, not yet committed |
| Placed | Persisted as an annotation |
| **Uncalibrated** | The state that must exist. See below |

**Uncalibrated is not an error and not an empty value.** PRD §82's calibration model is a
minimum of Point A, Point B and a known distance; until it exists, a distance in world units has
no metric meaning. [[An uncalibrated plan never presents a measurement as true]] is a business
rule with a UI consequence, and the consequence is this component's: it owes a *state*, not a
hidden value and not a plausible-looking number.

## Contract

**Given** a world-space distance and the plan's calibration. **Emits** nothing.

**It displays precision; it never decides it.** PRD §71 separates the two explicitly — internal
precision is millimetres squared, display precision is two decimals of a square metre — and
this component owns only the second. A label that rounded to fit its own width would have
introduced a third precision nobody declared.

The related consequence from [[Information Architecture]]: a zone's area belongs to the
[[Plan canvas]] and the zone's own note. If this label and the [[Inspector]] disagree by a
rounding, one of them is wrong and neither can say which.

## Where it appears

[[Plan canvas]] — AnnotationLayer when placed, InteractionLayer while previewing.

## Accessibility

**A drawn number is invisible to a screen reader**, and this is the component where *the canvas
cannot be the only route* is least negotiable of anywhere in the inventory. A measurement is not
decoration a non-visual user can skip; it is the answer they came for.

The non-canvas route is [[Status bar]] for the live value and the annotation's own note for the
kept one. Neither is optional.

## Open

1. **Does the label scale with the world or with the screen?** Scaling with the world makes it
   illegible when zoomed out; scaling with the screen makes it move relative to its own geometry
   as the user zooms. Both are wrong in a different direction and SDD §24's viewport transform
   does not choose.
2. **What an uncalibrated measurement actually renders as.** A pixel count, a placeholder, or a
   refusal. The rule says it must not read as true; it does not say what it reads as instead.

## Sources

PRD §39 · PRD §71 · PRD §82 · SDD §19 · SDD §25, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
