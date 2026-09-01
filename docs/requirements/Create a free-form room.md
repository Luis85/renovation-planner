---
type: PBI
parent: "[[Spatial creation]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Start room creation from Add]]"
---

# Create a free-form room

## Actor

[[Private renovator]] representing a Room that is not rectangular.

## Preconditions

- An editable Floor (`Plan`) is open.
- Room creation was started from Add and Free shape was chosen.

## Main flow

1. The renovator places Room corners in sequence.
2. The plugin previews the open boundary, dimensions and visible snap relationships.
3. The renovator closes the boundary by an offered completion gesture.
4. The renovator names and classifies the Room.
5. The plugin validates and commits one reversible Room (`Zone`) creation.
6. Reopening the Floor restores the same metadata and geometry.

## Extensions

- **2a** — The renovator removes the last draft point without leaving creation.
- **3a** — The boundary is incomplete or invalid. Completion is refused and the draft remains editable.
- **3b** — Escape cancels the entire draft and writes nothing.
- **5a** — Persistence fails. Partial note/geometry effects are recovered and no phantom Room remains.

## Guarantee

Only a completed, valid free-form Room becomes persisted; all draft points remain temporary,
and the completed creation is reversible as one action.

## Out of scope

- General-purpose polygon terminology or vertex editing in homeowner-facing UI.
- Automatic room recognition from source images.
- Wall-loop room creation.

## Acceptance criteria

1. Every draft point and guide is non-persistent until completion.
2. Finish, cancel and remove-last-point are keyboard reachable.
3. Invalid completion explains the issue without exposing Polygon or Vertex language.
4. One completed Room round-trips through note and sidecar with one stable identity.
5. Undo and redo affect the whole Room creation once.
6. A form/list route can review and name the Room without relying on canvas-only controls.

## Assumptions

- Room maps to a room-compatible `Zone`; existing domain validation owns shape validity.
- Completion gestures follow the editor interaction specification without creating separate commands.

## Sources

- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 17, Method 2.
- [[Renovation Planner — Editor UX Research & Pattern Study]], room shapes and precision on demand.
- [Renovation Planner — Editor Component Library](../user-experience/renovation-planner-editor-specs/components/component-library.md), `RoomCreationOverlay`.
