---
type: PBI
parent: "[[The designer surface]]"
order: 80
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

# Undo a design gesture

## Actor

[[Private renovator]] who has just traced the wrong outline, or calibrated against the wrong two
points, and wants the object back the way it was.

## Preconditions

- The designer surface is open on an object and at least one gesture has been made on it.

## Main flow

1. Each gesture is one entry: a traced footprint, a typed pair of dimensions, a clearance
   boundary, an anchor, a facing, a height, a background, a calibration.
2. The renovator presses undo. The last gesture is reversed by writing back what was there before
   it.
3. Redo re-applies it.
4. The surface redraws from the vault, and the save state says what happened.

## Extensions

- **2a** — Another surface, or another window on the same object, has written to it since. The
  undo is **refused** rather than silently discarding somebody else's edit — two surfaces on one
  object is the ordinary case a shared catalogue creates, not a rare one.
- **2b** — A restore itself fails. The failure is reported on both channels, and the surface is not
  left drawing a state the vault no longer holds.
- **2c** — The gesture spanned both the object's note and its geometry document — a background
  change is the one that does. Both resulting versions are checked, so the undo does not refuse on
  a version it wrote itself.
- **2d** — There is nothing to undo. Nothing is written, and the save state is not told a write
  succeeded.

## Guarantee

One gesture, one entry, one inverse. An undo never overwrites a write this surface did not make,
and a refused undo writes nothing at all.

## Known limitation

**A refused undo pins the stack.** The refused entry stays on the history, undo still reads as
available, and every later press refuses too for the life of that surface. This is why the item is
not done — and the remedy is a decision about the shared command history **every** surface
inherits (drop the superseded entry and say so, or disable undo below it) rather than a fix that
belongs here.

## Out of scope

- Undoing a deletion of the object itself. That is
  [[Delete an asset without stranding its shape]]'s subject, and it is not offered.
- A history shared between two surfaces on one object.
- The plan editor's own undo, which is [[Undo and redo]]'s.

## Acceptance criteria

1. Each of the design gestures is one undoable entry, and undo restores exactly the previous
   state.
2. Redo re-applies a gesture that was undone.
3. An undo is refused when the object has been written to since, and nothing is written.
4. A background undo spanning the note and the geometry document does not refuse on its own write.
5. A failed restore is reported and the surface does not draw what the vault no longer holds.
6. An undo that wrote nothing does not report a successful save.

## Assumptions

- A gesture is the right granularity: a renovator who traced an outline wants the whole outline
  back, not the last vertex.
- Undo is per surface and does not survive closing it.

## Sources

- SDD §65 (Faults against refusals)
- ADR-0014 (Library-scoped asset geometry sidecar)
- ADR-0015 (Asset designer workspace surface)
