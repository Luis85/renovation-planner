---
type: Task
parent: "[[Review renovation readiness spatially]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Show readiness findings as markers and an equivalent list

## Evidence

M17 pairs Review markers with a complete Inspector list, and the component library requires
stable labels plus non-canvas equivalents. [[Project health]] forbids colour-only status.

## Why it matters

A canvas-only readiness overlay is inaccessible, while a colour heatmap cannot explain why a
room needs attention.

## Approach

Project derived room findings into Review markers and a synchronized list. Use authority-owned
status semantics with labels and shapes, and keep Review read-only.

## Acceptance criteria

- Every marker has one equivalent list entry for the same spatial target and finding.
- Marker and list selection are bidirectional and keyboard-accessible.
- Status remains distinguishable without colour in light, dark and custom themes.
- Review exposes no geometry edit or record-creation controls.

## Risks

Marker numbering may become persisted identity or visual ranking may imply a severity not supplied
by the authority.

## Outcome

A renovator can survey readiness across the floor and inspect the same findings without using the
canvas.
