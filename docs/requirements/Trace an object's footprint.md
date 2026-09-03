---
type: PBI
parent: "[[The designer surface]]"
order: 40
status: Done
started: 2026-08-30
finished: 2026-09-03
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Trace an object's footprint

## Actor

[[Private renovator]] tracing the outline of an object off its technical drawing, because the
object is not a rectangle and typing two numbers would be a lie.

## Preconditions

- The designer surface is open on an object.
- A background is usually present, but is not required: an outline can be drawn freehand.

## Main flow

1. The renovator activates the footprint tool.
2. They click each corner of the outline. A rubber band follows the pointer, every placed vertex
   is marked, and the first one is drawn larger because clicking it is what closes the shape.
3. Holding shift constrains the next edge to a whole angle, measured against the last vertex
   placed.
4. They click the first vertex to close the outline.
5. The outline is stored as the object's footprint, replacing whatever was there before.
6. The dimensions shown for the object become the new outline's bounding box.

## Extensions

- **2a** — A click lands on a vertex already placed. It is not appended twice; a coincidence within
  a nanometre is one point, because a coordinate that has been through trigonometry is never
  bitwise what it should be.
- **2b** — The close target is out of reach after a zoom. The mark that promises a close is
  derived from the camera as it stands, so it never promises one the click cannot make.
- **4a** — Fewer than three vertices are placed. The outline cannot close.
- **4b** — The outline encloses no area — every point collinear. It is refused rather than stored
  as a shape nothing can measure.
- **4c** — The outline's area is so large it is not finite. It is refused, because an infinite
  area becomes a quantity and then a cost the moment the object is ever placed.
- **4d** — The renovator presses Escape, or focus leaves. A deliberate cancel discards the
  vertices; an interruption abandons only what the missing click would have completed.
- **5a** — The write fails. The previous footprint stands and the failure is reported.
- **6a** — The drawing carries no scale yet. The outline is stored and **marked as awaiting one**,
  and every dimension shown for it says so rather than presenting pixels as millimetres.

## Guarantee

The footprint is the only stored geometry of record for the object's size. A completed trace
replaces it wholesale, and width and depth are always a reading of its bounding box rather than a
second stored answer.

## Out of scope

- Depicting the footprint on a plan, which is [[Asset placement]]'s and [[Plan editor]]'s.
- Editing an individual vertex after the fact, which needs a selection this surface does not have
  — [[Select part of an object's shape]].
- A curved or arced outline; the footprint is a polygon.

## Acceptance criteria

1. A closed outline of three or more distinct vertices is stored as the object's footprint.
2. A completed trace replaces any previous footprint entirely.
3. The dimensions shown afterwards are the new outline's bounding box.
4. An outline enclosing no area, or one whose area is not finite, is refused and changes nothing.
5. A retrace onto a placed vertex does not append a duplicate.
6. An outline traced with no scale is marked as awaiting one, and no dimension derived from it is
   presented as a measurement.
7. Shift constrains an edge to a whole angle, and a constrained horizontal or vertical edge is
   exactly straight.

## Assumptions

- A renovator tracing a drawing wants the outline the drawing shows, not a simplified one; no
  smoothing or vertex reduction is applied.

## Sources

- PRD §17 (Asset Library)
- PRD §88 (Derived data)
- ADR-009 (World coordinates in millimetres)
- ADR-0014 (Library-scoped asset geometry sidecar)
