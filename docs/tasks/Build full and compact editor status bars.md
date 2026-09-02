---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Build full and compact editor status bars

## Evidence

M00 and M05 require an editor status region, M16 names a compact variant, and the component
library defines zoom, grid, snapping, scale, save state and optional gesture hints with
lower-priority controls moving into View at constrained widths.

## Why it matters

Users need persistent orientation and save truth without sacrificing the canvas or losing
controls when an Obsidian leaf becomes narrow.

## Approach

Compose one status model into full and compact presentations. Keep zoom, snapping, scale and
save state visible in the compact form, move lower-priority controls to the existing View menu,
and isolate meaningful announcements from continuously changing pointer or measurement readouts.

## Acceptance criteria

- The full bar exposes zoom, grid, snapping, scale, save state and applicable gesture hints.
- The compact bar retains zoom, snapping, scale and save state.
- Controls omitted from compact layout remain keyboard reachable through View.
- Full/compact changes preserve floor identity, viewport, selection and active temporary task.
- Save, stale and uncalibrated states remain distinct and are not communicated by color alone.
- Live regions announce meaningful state changes without announcing every pointer movement.

## Risks

Forked variants can drift in state semantics, while one indiscriminate live region can make
ordinary canvas movement unusably noisy.

## Outcome

The editor communicates its essential state truthfully at full and constrained leaf widths.
