---
type: Task
parent: "[[Canvas navigation]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Recover canvas navigation after interruption

## Evidence

The [locked editor interaction contract](../user-experience/renovation-planner-editor-specs/README.md) requires safe selection and non-destructive navigation in an Obsidian desktop leaf where blur and pointer cancellation are normal.

## Why it matters

A lost release can leave the camera or active tool owning input for the rest of the session.

## Approach

Handle pointer cancellation, pointer leave and element/window focus loss through shared gesture-abandonment rules, preserving unrelated multi-click state.

## Acceptance criteria

- Every interruption terminates only the gesture it owns.
- The next ordinary click routes normally.
- A tool drag leaves no stale preview or delayed commit.
- A drawing task between clicks retains completed points.
- Cleanup listeners are removed on leaf close.

## Risks

Two host blur signals may arrive for one interruption, so cleanup must be idempotent.

## Outcome

After interruption, navigation and editing resume from a coherent safe state.
