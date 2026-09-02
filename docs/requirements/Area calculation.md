---
type: PBI
parent: "[[Calibration and measurement]]"
order: 30
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

# Area calculation

## Actor

[[Private renovator]] using a zone's drawn shape to understand how much surface it covers.

## Preconditions

- The plan is calibrated.
- The zone has readable polygon geometry.

## Main flow

1. The renovator selects or views a zone whose area is needed.
2. The plugin reads the zone's vertices in world coordinates.
3. It derives the polygon's unrounded area in canonical square millimetres.
4. The editor converts that result to the selected display unit and applies display precision.
5. The renovator uses the area without entering a separate square-metre figure.

## Extensions

- **1a** — The plan is not calibrated, or its calibration has been invalidated. The editor says
  that calibration is required and presents no area as real.
- **2a** — The polygon is concave or rotated. The same calculation handles it without simplifying
  the shape to a rectangle.
- **2b** — The polygon is incomplete, degenerate or contains non-finite coordinates. The area is
  unavailable and the geometry problem is reported rather than displayed as zero.
- **4a** — The display unit changes. The editor reformats the unrounded square-millimetre result
  and never converts from an already rounded value.

## Guarantee

The reported area is derived from the zone's current geometry and current valid calibration.
Square millimetres remain authoritative internally; display precision is a presentation choice
and cannot change quantities or costs derived from the area.

## Out of scope

- Wall, ceiling or other surface areas not represented by the zone polygon.
- Waste, packaging, coverage rates and prices applied after the area is known.
- Manually overriding a zone's derived floor area.
- Temporary area measurement outside a zone; that belongs to [[Measuring tools]].

## Acceptance criteria

1. Convex, concave, rotated and non-axis-aligned polygons produce the correct area.
2. `42718432 mm²` may display as `42.72 m²` without changing the internal value (§71).
3. Changing display units leaves the canonical area and every downstream calculation unchanged.
4. Editing zone geometry causes the area to be derived from the new vertices.
5. An uncalibrated or invalidated plan presents no area as real.
6. Invalid geometry is reported and is not represented as a successful zero.

## Assumptions

- A zone polygon represents floor area; holes and multi-ring polygons are not part of this PBI.
- Downstream quantity and cost rules consume the canonical derived area, not its formatted label.

## Sources

- PRD §14 (Calibration & Measurement)
- PRD §44 (Non-Functional Requirements)
- PRD §70 (Unit System)
- PRD §71 (Measurement Precision)
- PRD §82 (Plan Calibration Model)
