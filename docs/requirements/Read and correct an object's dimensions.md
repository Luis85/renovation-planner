---
type: PBI
parent: "[[The designer surface]]"
order: 70
status: Active
started: 2026-08-30
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

# Read and correct an object's dimensions

## Actor

[[Private renovator]] checking what the plugin thinks an object measures, and correcting it by
typing the real numbers when the drawing was not worth tracing.

## Preconditions

- The designer surface is open on an object.

## Main flow

1. The inspector shows the object's width and depth, **derived** from the footprint's bounding box
   and recomputed on read rather than stored beside it (§88).
2. Where the footprint came off a drawing that has no scale, the inspector says the numbers are
   not measurements yet.
3. The renovator opens **Edit dimensions** and types a width and a depth.
4. The plugin replaces the footprint with a rectangle of exactly those millimetres, and the
   outline stops awaiting a scale, because typed millimetres are real.
5. The inspector shows the new bounding box.

## Extensions

- **2a** — The numbers are unscaled. The dimensions form opens with its fields **empty** and a
  warning, rather than pre-filling placeholder numbers that one click would launder into
  millimetres.
- **3a** — The object has no shape at all. The control is offered anyway, because typing
  dimensions is the one route to a shape that needs no drawing, no sheet and no calibration; a
  control that appeared only once a shape existed would make that route unreachable.
- **4a** — A dimension is zero, negative or not finite. It is refused against both dimension
  fields and the previous footprint stands.
- **4b** — The renovator cancels. Nothing changes.
- **4c** — The write fails. The previous footprint stands and the failure is reported.
- **5a** — The footprint was a traced outline. Typing dimensions **replaces** it with a rectangle;
  the outline is not preserved underneath, and nothing pretends it is.

## Guarantee

Width and depth are always a reading of the footprint and never a second stored answer to what
the object measures. A typed pair replaces the footprint with exactly that rectangle, in
canonical millimetres.

## Known limitation

**The inspector prints unrounded values followed by `mm` even while the numbers are unscaled**,
so a number that is not a measurement is presented with a unit beside a warning that says it is
not one. That contradicts the epic's condition that an uncalibrated surface says so *wherever a
measurement would otherwise appear*, and it is why this item is not done.

## Out of scope

- Dimensions at creation time, which is [[Give a new asset its dimensions]].
- The height, which is [[Record how tall an object is]] and is not a dimension of the footprint.
- Per-plan display units, which are [[Apply per-plan display units throughout the editor]]'s.

## Acceptance criteria

1. Width and depth shown are the footprint's bounding box, recomputed on read.
2. A typed pair replaces the footprint with a rectangle of exactly those millimetres and clears
   the awaiting-a-scale marker.
3. The dimensions control is offered whether or not the object already has a shape.
4. While the numbers are unscaled, the form pre-fills nothing and shows a warning.
5. A non-positive or non-finite dimension writes nothing and keeps what was typed.
6. No dimension that is not a real measurement is presented as one.

## Assumptions

- A renovator who types dimensions over a traced outline means to discard the outline.
- Two numbers are enough to describe what most catalogue objects occupy on a floor.

## Sources

- PRD §88 (Derived data)
- PRD §71 (Measurement precision)
- PRD §3.5 (Progressive Complexity)
- ADR-0014 (Library-scoped asset geometry sidecar)
