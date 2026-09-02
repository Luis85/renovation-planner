---
type: PBI
parent: "[[Spatial creation]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Grid and snapping

## Actor

[[Private renovator]] drawing or moving spatial geometry with approximate pointer input.

## Preconditions

- An editable Floor (`Plan`) is open.
- A supported room, wall or opening creation/edit gesture is active.

## Main flow

1. The renovator moves a draft or selected spatial item.
2. The plugin evaluates eligible grid and geometry targets in world coordinates.
3. When a target is within tolerance, the preview lands on it.
4. A guide, marker or short label explains what relation was applied.
5. The renovator completes the gesture and the resulting geometry is committed by its owning action.

## Extensions

- **2a** — Snapping is disabled. The preview follows unsnapped world coordinates.
- **2b** — Several candidates compete. A deterministic priority chooses one and shows it.
- **3a** — Zoom changes. The screen-sized acquisition tolerance remains usable while stored geometry stays zoom-independent.
- **5a** — The gesture is cancelled. No snapped preview is persisted.

## Guarantee

Snapping changes only the geometry submitted by the owning completed action; it never writes by
itself, never depends on zoom for the stored result, and never hides that it influenced placement.

## Out of scope

- Parametric constraint solving.
- Domain validation for Rooms, Walls or Openings.
- Camera navigation and measurement-unit selection.

## Acceptance criteria

1. Equivalent world input produces equivalent snapped geometry at different zoom levels.
2. Grid, endpoints, corners and supported alignment targets use deterministic priority.
3. Every applied snap has visible, non-colour-only feedback.
4. Grid and snap controls expose their current state and remain keyboard reachable.
5. Disabling snapping prevents it from changing the owning command input.
6. Cancel writes nothing; undo and redo remain owned by the completed spatial action.

## Assumptions

- The existing snapping service remains the single calculation boundary.
- Each spatial PBI decides which candidate kinds are meaningful for its own geometry.

## Sources

- PRD §13 (grid and snapping).
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 22–23.
- [Renovation Planner — Editor Component Library](../user-experience/renovation-planner-editor-specs/components/component-library.md), `SnapGuideLayer` and status controls.
