---
type: PBI
parent: "[[The designer surface]]"
order: 30
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

# Calibrate an object's own drawing

## Actor

[[Private renovator]] whose spec sheet carries one dimension they can read off it, establishing
what that drawing's pixels are worth.

## Preconditions

- The designer surface is open on an object with a background.
- The renovator can read one real distance between two points on that drawing.

## Main flow

1. The renovator starts calibration on the designer surface.
2. If anything on this object was captured **before** a scale existed, the surface asks first
   whether to convert it — the answer changes what the calibration does, so it is asked rather
   than assumed.
3. They pick two points on the drawing. The segment is drawn as a tape measure while they do.
4. They enter the real distance between those two points.
5. The plugin stores the calibration **on this object** and multiplies only what came off this
   drawing and still awaits a scale. A footprint typed in millimetres is left exactly as it is.
6. Dimensions shown for the object are real measurements from then on, and the unscaled marker is
   gone.

## Extensions

- **2a** — The object's footprint was typed rather than traced. No conversion question is asked,
  because typed millimetres are already real.
- **3a** — The two points coincide. Confirmation is refused **with a reason given**; the refusal is
  said rather than the pick silently discarded.
- **4a** — The distance is empty, zero, negative or not finite. The form does not offer to submit
  it, so the refusal happens at the input rather than after a dispatch.
- **4b** — The renovator cancels, or focus leaves mid-gesture. The existing calibration stands and
  the **first** placed point is restored rather than both being lost — a kept second point
  completed by some later unrelated click is a scale error every dimension would inherit.
- **5a** — The correction derives a result that is not finite. The calibration is refused, so the
  object's geometry document stays readable.
- **5b** — The write fails. The previous calibration remains authoritative and the failure is
  reported.
- **6a** — The background is later replaced. The calibration is cleared; see
  [[Choose a technical drawing for an object]].

## Guarantee

A calibration relates two points on **this object's** drawing to one positive real distance,
belongs to that object, and reaches no plan's scale. It converts exactly the coordinate groups
captured before a scale existed and nothing else.

## Out of scope

- The rules of the calibration act itself — canonical units, calculation precision against display
  precision, and never presenting an uncalibrated value as true — which are
  [[Calibration and measurement]]'s and inherited whole. **The one rule this item replaces is
  which subject owns the calibration**: an object's calibration belongs to the object.
- [[Scale calibration]]'s subject, which is a plan.
- Multiple control points and distortion correction, which PRD §82 identifies as future work.
- Two objects sharing one calibrated sheet: each calibrates separately and nothing is shared.

## Acceptance criteria

1. Two distinct points and one positive known distance calibrate the object.
2. The calibration is stored on the object and no plan's scale changes.
3. Coincident points are refused with a stated reason and no calibration is written.
4. Only coordinates captured before a scale existed are converted; a typed footprint is untouched.
5. A correction that is not finite is refused and the geometry document remains readable.
6. Cancelling preserves any existing calibration and restores the first placed point.
7. After a successful calibration, nothing about the object is still marked as awaiting a scale.

## Assumptions

- One uniform scale applies across the drawing.
- A dimension printed on a spec sheet is accurate enough for the MVP.
- Where an uncalibrated background and a typed footprint are both present, a pick is read as
  belonging to the **drawing**, because a renovator who has just chosen a sheet is tracing it.
  That is an approximation, stated rather than hidden.

## Sources

- PRD §82 (Plan calibration model)
- PRD §81 (Coordinate transformations)
- PRD §70 (Unit system)
- PRD §71 (Measurement precision)
- ADR-009 (World coordinates in millimetres)
- ADR-0014 (Library-scoped asset geometry sidecar)
