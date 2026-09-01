---
type: PBI
parent: "[[Spatial creation]]"
order: 110
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Grid and snapping]]"
---

# Edit a selected room shape and dimensions

## Actor

[[Private renovator]] correcting a Room whose shape or measurements no longer match what they know.

## Preconditions

- An editable Floor (`Plan`) contains a selected Room (`Zone`) with valid persisted geometry.
- The Room is reachable from the canvas and from a non-canvas room list or form.

## Main flow

1. The renovator chooses a boundary handle, a displayed dimension, or `Edit shape` for the selected Room.
2. The plugin enters a temporary Edit shape state and previews the proposed geometry without writing.
3. The renovator drags handles or enters exact dimensions while snapping feedback explains supported alignments.
4. The plugin continuously shows the affected shape, dimensions and derived area.
5. The renovator confirms the valid edit.
6. The plugin commits the geometry change through one reversible command path and refreshes dependent values.
7. Reload restores the edited Room under the same identity.

## Extensions

- **1a** — The renovator starts from the room list or form. The same selected Room and edit command are used.
- **3a** — Numeric input is invalid or produces geometry outside the Floor bounds. Completion is refused and the draft remains editable.
- **3b** — A snap candidate is available. The preview identifies the applied relation without changing the command path.
- **5a** — The renovator cancels. The temporary shape disappears and persisted geometry remains unchanged.
- **6a** — The write fails. The previous Room remains authoritative and no partially edited geometry is presented as saved.

## Guarantee

The Room keeps its identity and either receives one valid, reloadable geometry change as one reversible action,
or retains exactly the geometry it had before editing began.

## Out of scope

- Creating a new Room.
- Moving an unchanged Room as a whole, owned by [[Move a selected room]].
- Editing Wall topology or hosted openings.

## Acceptance criteria

1. Handle dragging, exact dimensions and the list/form route converge on one reversible command path.
2. `Edit shape` is temporary; cancel and invalid or out-of-bounds input write nothing.
3. Snapping changes the preview only through the shared snapping rules and gives visible feedback.
4. A successful edit preserves Room identity and updates geometry-derived values.
5. Undo restores the prior shape, redo restores the edited shape once, and reload keeps the committed result.
6. A Room can be edited precisely without relying on canvas dragging.

## Assumptions

- Room maps to the existing room-compatible `Zone`; Floor maps to `Plan`.
- Geometry validity and snapping rules remain owned by their existing domain and application boundaries.

## Sources

- [[M00-kitchen-selected-overview]], selected-Room handles, dimensions and temporary Edit shape state.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], selection-first editing and snapping.
- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], Room/Zone persistence mapping.
