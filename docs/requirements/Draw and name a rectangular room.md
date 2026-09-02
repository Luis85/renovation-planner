---
type: PBI
parent: "[[Spatial creation]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Start room creation from Add]]"
---

# Draw and name a rectangular room

## Actor

[[Private renovator]] who knows a room approximately or by width and depth.

## Preconditions

- An editable Floor (`Plan`) is open.
- Room creation was started from Add.

## Main flow

1. The renovator drags a rectangular Room (`Zone`) preview on the Floor.
2. The preview shows live width, depth and derived area.
3. The renovator optionally enters exact width or depth through numeric fields.
4. The renovator chooses a room type and enters a meaningful name.
5. The renovator confirms creation.
6. The plugin commits one reversible room creation, returns to Select and selects the Room.
7. Reopening the Floor restores the same Room identity, metadata and geometry.

## Extensions

- **1a** — The rectangle has invalid or zero dimensions. Completion is refused without a write.
- **3a** — Numeric input is invalid. The draft remains and the field explains the problem.
- **5a** — The renovator cancels. The draft disappears and nothing is written.
- **6a** — Persistence fails. No phantom Room is shown as saved and partial effects are recovered.

## Guarantee

The Floor contains either one complete, reloadable Room created as one reversible user action,
or exactly the persisted state it had before creation began.

## Out of scope

- Arbitrary polygons, owned by [[Create a free-form room]].
- Wall-first room detection.
- Existing/Planned renovation-state details.

## Acceptance criteria

1. Dragging and numeric dimensions converge on the same creation command.
2. Metadata and geometry share one stable identity across reload.
3. Area is derived from geometry rather than stored independently.
4. Cancel writes neither a note nor geometry.
5. Undo removes all completed creation effects and redo restores them once.
6. Creation and naming are possible through a non-canvas numeric/form route.

## Assumptions

- Homeowner-facing Floor maps to the existing `Plan`; Room maps to a room-compatible `Zone`.
- Domain geometry validation remains owned by the existing model and is not restated here.

## Sources

- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], VS-04 and scenarios A–C.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 17.
- [[M03-add-room]], complete room-first creation flow.
