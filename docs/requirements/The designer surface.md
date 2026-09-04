---
type: Feature
parent: "[[Asset designer]]"
order: 20
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

# The designer surface

A spec sheet is at 1:20 and the plans the object will be placed into are at 1:100, so the shape
is drawn somewhere of its own: a per-object workspace surface (ADR-0015), opened on one [[Asset]]
and keyed by its id, carrying its own background, its own calibration and its own origin. That
separation is the point rather than an implementation detail — a product where tracing an oven
could disturb the scale of the bathroom is a product whose numbers cannot be trusted anywhere.

Its toolbar is exactly what the surface can do: pan, trace a footprint, trace a clearance
boundary, set an anchor, set a facing direction, calibrate, undo and redo. **There is no
selection tool**, and that is a decision with a record rather than an omission — see
[[The designer offers no selection, because nothing there was selectable]], whose work is
[[Select part of an object's shape]]. There is no layers panel either, for a reason that will not
change: a single object has nothing to layer.

This feature owns the surface and the gestures on it. It does not own what a plan then does with
what was drawn — depicting a footprint on a plan, flagging an overlap between two clearances and
any fit test belong to [[Plan editor]] and [[Asset placement]], and the epic explicitly does not
promise them. So this feature ships shapes nothing on a plan yet draws, and that is the sequence
rather than a gap.

## Outcome

A renovator traces an object's true shape over that object's own technical drawing, at that
drawing's scale, and no plan's scale moves.
