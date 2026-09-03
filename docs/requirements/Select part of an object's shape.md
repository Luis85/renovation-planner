---
type: PBI
parent: "[[The designer surface]]"
order: 90
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

# Select part of an object's shape

## Actor

[[Private renovator]] correcting one part of a design rather than redrawing the whole thing — a
clearance boundary to nudge outwards, an anchor a calibration moved, a facing that is a degree
out.

## Why this is open

The designer surface has **no selection at all**, which is a decision with a record:
[[The designer offers no selection, because nothing there was selectable]]. Every correction
available today is therefore a re-creation — retracing the whole outline to move one vertex,
re-clicking the anchor to move it a few millimetres — and the inspector describes the object
rather than anything within it. This item is the work that closes that.

## Preconditions

- The designer surface is open on an object that has at least a footprint.

## Main flow

1. The renovator activates selection and clicks a part of the drawn design: the footprint, the
   clearance boundary, the anchor, or the facing handle.
2. The surface marks what is selected, and the inspector describes **that part** rather than the
   whole object.
3. The renovator moves or adjusts it.
4. The change is committed as one gesture, undoable exactly like every other gesture on this
   surface.

## Extensions

- **1a** — The click lands on nothing. The selection clears; it does not keep the previous one.
- **1b** — Two parts overlap under the pointer — a clearance boundary drawn inside a footprint.
  The order is deterministic and stated, so the same click always selects the same part.
- **2a** — The object has no clearance, no anchor or no facing. No control is offered for a part
  the object does not have, rather than a live control that cannot act.
- **3a** — An adjustment would make the part degenerate — a footprint enclosing no area, a
  non-finite coordinate. It is refused whole and the part stays where it was.
- **4a** — The write fails. The previous state stands and the failure is reported.
- **4b** — Another surface wrote to the object since the selection was made. The adjustment is
  refused rather than overwriting it, exactly as an undo is
  ([[Undo a design gesture]]).

## Guarantee

An adjustment made through a selection is the same kind of write a trace is: one gesture, one
undo entry, refused whole or applied whole. A selection by itself writes nothing.

## Out of scope

- **Multi-selection**, which is the plan editor's [[Select several parts of a plan]] and is not
  asked for here — a single object has four parts at most.
- Anything about a plan's selection, which [[Selection]] owns and which this item must not change.
- Depicting or selecting the shape on a plan, which is [[Asset placement]]'s.

## Open question

**Whether the first version edits whole parts or individual vertices.** Moving a whole clearance
boundary and dragging one footprint vertex are different capabilities with different hit-testing:
the first needs one hit-test per part, the second needs vertex handles, a grab radius and a
tolerance in screen pixels. Raised rather than assumed, because building the second when only the
first was wanted is most of the cost.

## Acceptance criteria

1. Each part of a design that the object actually has can be selected on the canvas.
2. The inspector describes the selected part rather than the whole object.
3. An adjustment through a selection is one undo entry.
4. No control is offered for a part the object does not carry.
5. A degenerate adjustment is refused and changes nothing.
6. Nothing about a plan's selection behaviour changes.

## Assumptions

- The four parts are enough; a footprint's individual edges are not separately selectable unless
  the open question above is settled that way.

## Sources

- PRD §17 (Asset Library)
- SDD §57 (Editor tool classes)
- ADR-0015 (Asset designer workspace surface)
