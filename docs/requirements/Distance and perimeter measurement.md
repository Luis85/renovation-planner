---
type: PBI
parent: "[[Calibration and measurement]]"
order: 20
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

# Distance and perimeter measurement

## Actor

[[Private renovator]] checking linear dimensions needed for planning or pricing.

## Preconditions

- The plan is calibrated.
- The stored geometry to be measured is readable.

## Main flow

1. The renovator requests the length of a stored segment or the perimeter of a zone.
2. The plugin reads the geometry in the plan's world coordinate system.
3. It derives the unrounded length in canonical millimetres; for a perimeter it sums every
   boundary edge, including the closing edge.
4. The editor converts that result to the selected display unit and applies display precision.
5. The renovator reads the distance without entering it again.

## Extensions

- **1a** — The plan is not calibrated, or its calibration has been invalidated. The editor says
  that calibration is required and shows no real-world number.
- **2a** — The geometry is missing, incomplete or non-finite. The measurement is unavailable and
  the failure is reported rather than displayed as zero.
- **3a** — The zone is concave or not axis-aligned. Every boundary edge is still included in the
  perimeter.
- **4a** — The display unit changes. The editor reformats the same unrounded canonical result; it
  does not recalculate from the previously displayed value.

## Guarantee

Distance and perimeter are pure derivations of stored geometry and the current valid calibration.
Their canonical length is millimetres, and no calculation reads a rounded display value.

## Out of scope

- Drawing a temporary measuring line; that belongs to [[Measuring tools]].
- Persisting a chosen dimension on the plan; that belongs to [[Measurement annotations]].
- Area and volume calculations.
- Pricing skirting, coving, edge trim, wall tiling or cornice; this use case supplies the linear
  quantity only.

## Acceptance criteria

1. A segment's length is derived from its endpoints and the valid plan calibration.
2. A zone perimeter includes every boundary edge exactly once.
3. Concave and rotated zones produce correct perimeters.
4. An uncalibrated or invalidated plan presents no distance or perimeter as real.
5. Equivalent display units show the same underlying length.
6. Display rounding never feeds a later calculation.
7. Missing or invalid geometry is distinguished from a true zero-length result.

## Assumptions

- Perimeter means the complete polygon boundary; deductions for doors, openings or excluded edges
  belong to later domain rules.
- Stored world geometry is the authority. The canvas is only a way to request and display the
  result.

## Sources

- PRD §14 (Calibration & Measurement)
- PRD §44 (Non-Functional Requirements)
- PRD §70 (Unit System)
- PRD §71 (Measurement Precision)
- PRD §82 (Plan Calibration Model)
