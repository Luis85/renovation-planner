---
type: PBI
parent: "[[Calibration and measurement]]"
order: 10
status: New
started: ""
finished: ""
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

# Scale calibration

## Actor

[[Private renovator]] establishing the real scale of a plan from a distance they can verify.

## Preconditions

- A plan with a readable background image is open in the plan editor.
- The renovator knows the real length between two visible points.

## Main flow

1. The renovator starts calibration.
2. They select Point A and Point B on the background.
3. The editor shows the selected segment and asks for its known distance in the visible display
   unit.
4. The renovator enters the distance and confirms it.
5. The plugin converts that input to canonical millimetres and stores the calibration on the
   plan without changing the background image.
6. Measurements derived from that plan now report real-world dimensions.

## Extensions

- **2a** — The two points coincide. Confirmation is refused and the plan remains uncalibrated.
- **3a** — The selected display unit changes while the distance is being entered. The typed value
  is converted exactly so its real-world meaning does not change.
- **4a** — The distance is empty, zero, negative or not finite. Confirmation is refused with a
  visible explanation, and no calibration is stored.
- **4b** — The renovator cancels. The existing calibration, if any, remains unchanged.
- **5a** — The calibration cannot be saved. The previous calibration remains authoritative and
  the failure is reported.
- **6a** — The background is later replaced. The old calibration is invalidated until the plan is
  calibrated against the new background; measurements are not presented as true in the interim.

## Guarantee

A successful calibration relates two plan points to one positive real-world distance. Its stored
distance and resulting world geometry use canonical millimetres, while the background remains
separate from world coordinates as required by §81.

## Out of scope

- Multiple control points or automatic distortion correction, which §82 identifies as future
  work.
- Changing or editing the background image.
- Ad-hoc measuring after calibration; that belongs to [[Measuring tools]].
- Calculating zone area or perimeter; those belong to [[Area calculation]] and
  [[Distance and perimeter measurement]].

## Acceptance criteria

1. Two distinct points and one positive known distance are sufficient to calibrate a plan (§82).
2. Equivalent distances entered in different display units produce the same millimetre
   calibration.
3. Invalid or coincident input writes no calibration.
4. Cancelling preserves the calibration that existed before the attempt.
5. Replacing the background invalidates the calibration and suppresses apparently real
   measurements until recalibration.
6. Calibration changes the plan-to-world transform, not the background image (§81).

## Assumptions

- A distance measured with an ordinary tape measure is accurate enough for the MVP.
- One uniform scale applies across the background.
- Rotation and translation remain viewport concerns; calibration establishes scale.

## Sources

- PRD §14 (Calibration & Measurement)
- PRD §70 (Unit System)
- PRD §71 (Measurement Precision)
- PRD §81 (Coordinate Transformations)
- PRD §82 (Plan Calibration Model)
