---
type: PBI
parent: "[[Spatial creation]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Move a selected room

## Actor

[[Private renovator]] correcting a Room's position on a Floor.

## Preconditions

- A persisted Room (`Zone`) is selected on an editable Floor (`Plan`).

## Main flow

1. The renovator starts moving the selected Room by dragging it or entering a precise offset.
2. The plugin previews the movement without writing to the vault.
3. Visible snapping feedback explains any applied alignment.
4. The renovator completes the interaction.
5. The plugin commits the move as one reversible action and refreshes the projection.
6. Reopening the Floor restores the moved geometry.

## Extensions

- **2a** — The renovator presses Escape or the pointer gesture is interrupted. The preview is abandoned.
- **4a** — The resulting geometry is invalid. The move is refused and the prior Room remains visible.
- **5a** — The write or read-back fails. The plugin reports the correct state without replaying the move.
- **6a** — Another revision changed first. The move is refused rather than overwriting it.

## Guarantee

A completed move persists once and is undoable as one intent; a cancelled, interrupted or
refused move changes no persisted Room geometry.

## Out of scope

- Resizing or editing individual corners.
- Moving multiple rooms as a group.
- Camera panning, owned by [[Canvas navigation]].

## Acceptance criteria

1. Pointer preview performs no vault write.
2. Pointer and precise non-canvas routes dispatch the same move command.
3. One completed gesture creates one history entry.
4. Cancel and interruption restore the prior projection.
5. Undo, redo and reload produce deterministic geometry.
6. A failed read-back retries hydration only, never the move.

## Assumptions

- VS-07 reuses the current spatial-object movement boundary.
- Selection behavior itself remains owned by [[Selection]].

## Sources

- [[Renovation Planner — First Vertical Slice Plan and Data-Model Specification]], VS-07 and WP6–WP7.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 9, 49 and 50.
- [[M00-kitchen-selected-overview]], selected-room geometry interaction.
