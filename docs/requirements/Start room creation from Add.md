---
type: PBI
parent: "[[Spatial creation]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Start room creation from Add

## Actor

[[Private renovator]] creating a room without CAD knowledge.

## Preconditions

- An editable Floor (`Plan`) is open in its safe Select state.
- The Add entry point is available.

## Main flow

1. The renovator activates Add from the editor or its keyboard-accessible equivalent.
2. The plugin opens one grouped menu of homeowner concepts and focuses its recommended item.
3. The renovator chooses Room.
4. The menu closes and the temporary room-creation state opens with brief guidance.
5. No persisted data changes until the renovator completes a valid room.

## Extensions

- **1a** — Add is unavailable because the Floor cannot be edited. The action explains why.
- **2a** — The renovator searches or uses arrow keys; the same Room action remains reachable.
- **3a** — Room creation cannot start. The plugin reports the failure and remains in Select.
- **4a** — The renovator presses Escape. The temporary state closes and nothing is written.

## Guarantee

Starting Room enters at most one temporary creation flow; declining, cancelling or failing to
start leaves the Floor unchanged.

## Out of scope

- Drawing or naming the room, owned by [[Draw and name a rectangular room]] and
  [[Create a free-form room]].
- Add-menu entries outside Spatial creation.
- Repeated-creation behavior after a successful room.

## Acceptance criteria

1. Add and its keyboard route invoke one canonical Room action.
2. User-facing text says Room, never Zone, Polygon or Draw Polygon.
3. Escape before completion writes nothing and returns to Select.
4. A failed start produces no draft or persisted room.
5. Room remains reachable without pointer interaction.

## Assumptions

- VS-03 uses the existing one-shot tool lifecycle beneath homeowner-facing Room language.
- `Zone` remains the implementation mapping for a Room until an accepted model decision changes it.

## Sources

- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], VS-03 and WP4–WP5.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 10 and 16.
- [[M02-add-menu]], Add-menu behavior and acceptance criteria.
