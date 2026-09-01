---
type: Task
parent: "[[Undo and redo]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Reverse and replay editor commands safely

## Evidence

[M03](../user-experience/renovation-planner-editor-specs/screens/M03-add-room.md) and [M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) require one reversible command per completed or composite user action.

## Why it matters

An inverse that bypasses revisions or restores only half a logical write can overwrite external work or split metadata from geometry.

## Approach

Exercise undo and redo through application/repository boundaries with captured inverses, optimistic revisions, compensation and exact one-time stack transitions.

## Acceptance criteria

- One Undo invokes one captured inverse.
- One Redo replays once against current versions.
- Revision conflict overwrites nothing and surfaces once.
- Composite metadata/geometry effects reverse together.
- Failed undo/redo leaves a coherent stack state.

## Risks

A command may report success after partial compensation failure; recovery evidence must remain visible.

## Outcome

Undo and redo preserve external edits and the logical integrity of each user action.
