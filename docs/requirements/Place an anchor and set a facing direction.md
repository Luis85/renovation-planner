---
type: PBI
parent: "[[The designer surface]]"
order: 60
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

# Place an anchor and set a facing direction

## Actor

[[Private renovator]] saying which point of an object is the one that gets positioned, and which
way the object faces — so that a fridge's door and a sink's tap end up pointing the way they must.

## Preconditions

- The designer surface is open on an object.

## Main flow

1. The renovator activates the anchor tool and clicks the point that should be the object's
   reference point.
2. They activate the facing tool and set the direction the object faces; a direction line is drawn
   while they do.
3. Both are stored with the shape, in the footprint's own coordinate space.
4. Both round-trip unchanged, so a placement reads **one** reference point and **one** canonical
   orientation rather than each deriving its own.

## Extensions

- **1a** — No anchor has been placed. The object carries none and nothing presents one.
- **1b** — An anchor is placed again. It replaces the previous one; there is exactly one.
- **2a** — A facing is set again. It replaces the previous one; there is exactly one.
- **3a** — The write fails. The previous value stands and the failure is reported.
- **3b** — The anchor was clicked on a drawing with no scale. It is **marked as awaiting one** and
  a later calibration converts it.
- **3c** — A calibration happens. It converts the anchor and leaves the facing **exactly as it
  is**, because an angle is scale-invariant. The facing therefore carries no pending marker at
  all, and that asymmetry is deliberate rather than an omission.

## Guarantee

An object carries at most one anchor point and at most one facing angle, both in the footprint's
coordinate space, both round-tripping unchanged. A calibration rescales the anchor and never the
angle.

## Out of scope

- **Which of them a placement applies, and what happens when a renovator rotates or mirrors an
  object.** That is [[Asset placement]]'s and is not promised here.
- Snapping the anchor to a footprint vertex, edge midpoint or centroid.
- Moving an anchor that is already placed by dragging it, which needs a selection this surface
  does not have — [[Select part of an object's shape]].

## Acceptance criteria

1. An anchor point is stored, replaced on a second placement, and round-trips.
2. A facing angle is stored, replaced on a second setting, and round-trips.
3. An anchor placed with no scale is marked as awaiting one; a facing never is.
4. A calibration converts the anchor and leaves the facing angle bit-for-bit unchanged.
5. An object with neither presents neither, and nothing invents a default.

## Assumptions

Two questions are **raised rather than decided here**, and both are inherited by
[[Asset placement]]:

- **The zero direction.** The angle is stored in radians anticlockwise from the positive x axis.
  Whether the *product's* zero is that axis or the footprint's longest edge is that epic's to
  settle, and it cannot be renegotiated later without moving every stored angle.
- **Origin versus anchor.** They are one point today — the centre of a typed rectangle. If they
  must differ, the shape grows a field and the geometry document's schema version bumps.

## Sources

- PRD §17 (Asset Library)
- ADR-009 (World coordinates in millimetres)
- ADR-0014 (Library-scoped asset geometry sidecar)
