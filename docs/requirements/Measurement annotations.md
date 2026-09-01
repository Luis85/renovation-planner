---
type: PBI
parent: "[[Calibration and measurement]]"
order: 40
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

# Measurement annotations

## Actor

[[Private renovator]] recording a dimension that must remain visible on the plan or be shared with
a trade.

## Preconditions

- A calibrated plan is open.
- The annotation layer is visible and editable.

## Main flow

1. The renovator starts a measurement annotation.
2. They choose the two plan points the dimension describes.
3. The editor derives the real-world distance from the current valid calibration and previews the
   annotation on the annotation layer.
4. The renovator confirms its placement.
5. The plugin stores the annotation with stable geometry and explicit units.
6. The plan and supported exports show the dimension with the same meaning.

## Extensions

- **1a** — The plan is not calibrated, or its calibration has been invalidated. Creation is
  refused with an explanation; no unscaled number is stored or shown as true.
- **2a** — The points coincide or cannot define a finite distance. Confirmation is refused and no
  annotation is created.
- **4a** — The renovator cancels. The plan is unchanged.
- **5a** — Persistence fails. No partial annotation remains, and the failure is reported.
- **6a** — The display unit changes. The annotation may be reformatted for the editor, but its
  stored geometry and explicit unit meaning remain unchanged.

## Guarantee

A measurement annotation is a deliberate, durable statement on the annotation layer, distinct
from a transient measuring gesture and from a quantity derived for pricing. It remains
self-describing through explicit units and never claims a real dimension without valid
calibration.

## Out of scope

- Automatically labelling every edge or zone.
- Temporary measurements that disappear when dismissed; those belong to [[Measuring tools]].
- Zone area and perimeter labels derived without deliberate annotation.
- PDF and spreadsheet exports, which PRD §43 identifies as future.

## Acceptance criteria

1. Confirming two distinct points on a calibrated plan creates one visible annotation.
2. The annotation appears on the annotation layer identified by PRD §13.
3. Cancelling, invalid points or a failed write leave no partial annotation.
4. An uncalibrated or invalidated plan cannot produce an apparently real annotation.
5. The stored annotation carries explicit units and remains meaningful in Markdown and supported
   exports.
6. Changing the editor's display unit does not change the annotation's geometry or real-world
   meaning.
7. A measurement annotation does not create or alter a Zone.

## Assumptions

- An annotation records a linear dimension between two points; angular, radial and chained
  dimensions are later work.
- PNG, JSON geometry and Markdown are the initial export surfaces named by PRD §43.
- Annotation placement and styling do not alter the measured value.

## Sources

- PRD §13 (Plan Editor)
- PRD §14 (Calibration & Measurement)
- PRD §43 (Export Requirements)
- PRD §44 (Non-Functional Requirements)
- PRD §70 (Unit System)
- PRD §71 (Measurement Precision)
- PRD §82 (Plan Calibration Model)
