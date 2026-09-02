---
type: PBI
parent: "[[Calibration and measurement]]"
order: 50
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
# Measuring tools

Calibration makes a plan measurable; this PBI schedules the editor work that lets a renovator ask
an ad-hoc distance or area question without first creating a room or another persistent spatial
object. A temporary measurement reads canonical world geometry, disappears when dismissed unless
explicitly turned into an annotation, and never creates a Zone or feeds the pricing pipeline.

Ad-hoc measuring and [[Switch the measurement unit in the plan editor]] are one scheduled group
because the gesture and its result share one presentation contract: the tool produces an
unrounded calibrated measurement, while the display-unit increment decides how that value is
entered, formatted and labelled. Shipping either alone leaves the interaction incomplete — a
measuring tool with unreadable millimetre output, or a unit picker with no ad-hoc result to apply
to.

The geometry derivation and pointer interaction can be built in parallel with the unit picker and
formatter. Their integration depends on both: measurement output must pass through the shared
formatter, and calibration input must interpret the unit the renovator can see. Both depend on
[[Scale calibration]] for a valid plan scale. The Switch-unit Task is the only child Task
currently recorded; the scheduling argument covers the whole group rather than turning this PBI
into a second use case.

This PBI does not own the canonical millimetre coordinate, [[Area calculation]],
[[Distance and perimeter measurement]], or the durable dimensions in
[[Measurement annotations]].

## Outcome

A renovator can measure a distance or area on a calibrated plan, read it in a useful display
unit, and leave the plan's canonical geometry unchanged.