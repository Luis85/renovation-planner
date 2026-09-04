---
type: Issue
parent: "[[Select part of an object's shape]]"
order: 10
status: New
started: ""
finished: ""
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
---

# The designer offers no selection, because nothing there was selectable

A `SelectTool` was registered on the asset designer from that surface's first commit and
**removed again** before the increment closed. This note is why, so that the next person to read
[[The designer surface]]'s toolbar and find it one control shorter than the plan editor's does not
read the absence as an oversight and put the tool back.

## What was true when it shipped

Three facts, measured rather than argued:

- The tool hit-tested an **empty set** — the designer has no collection of selectable objects the
  way a plan has zones.
- Its move factory **threw**, under a comment saying *"until Task B8 gives this surface a
  selection"*.
- Task B8 then shipped an inspector that reads **no selection at all**: it describes the object,
  its derived dimensions and its height.

So the toolbar offered a control for a capability the surface did not have. That is the live
control that does nothing which the empty-state amendment refuses by name — and it is worse than
a missing control, because a renovator who presses it learns nothing and a reviewer who sees it
assumes selection works.

## What was decided

The tool was removed. The toolbar is now Pan, trace footprint, trace clearance, set anchor, set
facing, calibrate, undo, redo — and a test asserts **that exact list**, so the tool cannot come
back by accident without somebody deciding to.

## The alternatives, and why each was rejected

1. **Finish the tool in the same increment.** Rejected on size rather than on merit. Selection
   here needs a hit-test vocabulary for four different kinds of thing — a polygon, a second
   polygon, a point and an angle handle — a selection store the designer does not have, an
   inspector that reads one, and a move command per kind. That is an increment with its own
   argument, not a task inside another one.
2. **Leave it registered and disabled.** Rejected: a disabled control still claims the capability
   exists and is coming. A greyed button with no explanation is the same failure with one more
   state.
3. **Leave it registered and throwing.** Rejected, and named here because it is what actually
   shipped for a while: the finding is precisely that this reads as working code.

## What the removal costs, named rather than implied

- Every correction on the designer surface is a **re-creation**. Moving one footprint vertex means
  retracing the outline; moving an anchor means re-clicking it.
- The inspector's only editing route is the dimensions form, which is why
  [[Read and correct an object's dimensions]] offers that control unconditionally rather than only
  once a shape exists.
- Undo granularity is per gesture and nothing finer is reachable
  ([[Undo a design gesture]]).

## What would bring it back

[[Select part of an object's shape]] is the work, and it carries the open question this note does
not settle — whether the first version edits whole parts or individual vertices.

**The trigger is the first correction a renovator cannot make by redrawing.** A clearance boundary
they want to nudge, an anchor a calibration moved, a facing a degree out. Until one of those is
reported, redrawing is a real answer rather than a workaround, and that is the honest reason this
is an open item rather than a defect.
