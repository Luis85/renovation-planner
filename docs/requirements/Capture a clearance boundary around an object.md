---
type: PBI
parent: "[[The designer surface]]"
order: 50
status: Done
started: 2026-08-30
finished: 2026-09-03
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

# Capture a clearance boundary around an object

## Actor

[[Private renovator]] recording the space an object needs around it — a door that swings, an
appliance that needs air, an island that needs a walkway — as something a plan can carry rather
than something they remember.

## Preconditions

- The designer surface is open on an object.
- The object usually has a footprint already, though the two are captured independently.

## Main flow

1. The renovator activates the clearance tool.
2. They trace an outline for the space the object needs, drawn with the same rubber band and close
   target as the footprint.
3. They close the outline.
4. It is stored as the object's clearance boundary — **its own field, distinct from the
   footprint**, in the footprint's own coordinate space.
5. It is drawn distinctly from the footprint, so the two are never read as one outline.

## Extensions

- **1a** — The object has no clearance yet. That is the ordinary state; nothing presents one and no
  default is invented.
- **3a** — The outline encloses no area, or an area that is not finite. It is refused, exactly as
  the footprint's is.
- **3b** — Escape, or focus leaving. A deliberate cancel discards the outline; an interruption
  abandons only what the missing click would have completed.
- **4a** — The write fails. The previous clearance stands and the failure is reported.
- **4b** — The outline was traced with no scale on the drawing. It is stored and **marked as
  awaiting one**, and a calibration later converts it.
- **4c** — A clearance is traced beside a **typed** footprint over an uncalibrated drawing. It is
  still marked as awaiting a scale, because it came off the drawing rather than out of the typed
  rectangle — two frames are overlaid there and one click cannot say which the renovator meant, so
  the answer resolves towards the drawing.

## Guarantee

A clearance boundary is stored in the footprint's coordinate space as a boundary of its own,
distinct from the footprint and never merged into it, so a placement carries onto a plan an
outline whose meaning nothing has to guess.

## Out of scope

- **A derived default clearance.** Only what somebody drew is stored; the product does not offer
  a rule of thumb, and this is deliberate rather than pending.
- Drawing the clearance on a plan, and flagging an overlap between two of them, which belong to
  [[Plan editor]] and [[Asset placement]] and which the epic explicitly does not promise.
- Any vertical clearance question, which needs a height nothing reads — see
  [[Record how tall an object is]].

## Acceptance criteria

1. A clearance boundary is stored as its own outline, and a footprint change does not move it.
2. An object with no clearance presents none, and no default is supplied.
3. A degenerate or non-finite clearance outline is refused and changes nothing.
4. A clearance captured with no scale is marked as awaiting one, and a later calibration converts
   it.
5. The clearance is drawn distinctly from the footprint on the designer surface.

## Assumptions

- One clearance boundary per object is enough for the MVP; a per-side or per-purpose set of
  clearances is not offered.
- A clearance may overlap or fall inside the footprint; nothing here refuses that, because the
  meaning is the plan's to interpret.

## Sources

- PRD §17 (Asset Library)
- PRD §88 (Derived data)
- ADR-009 (World coordinates in millimetres)
- ADR-0014 (Library-scoped asset geometry sidecar)
