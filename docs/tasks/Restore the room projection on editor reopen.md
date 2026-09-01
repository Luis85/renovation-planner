---
type: Task
parent: "[[Reload the editor without losing room data]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Restore the room projection on editor reopen

## Evidence

Scenario C requires the reopened canvas, room list, and Inspector to agree after hydration.

## Why it matters

Correct repository bytes can still be lost at store or presentation rehydration.

## Approach

Drive close/reopen and workspace-restore paths through real queries. Compare canvas, list, and
Inspector IDs and derived values; verify transient draft state is absent and Select is safe.

## Acceptance criteria

- Reopen shows the last successful room state in every projection.
- No transient draft is restored as a room.
- A missing prior selection does not hide valid rooms.

## Risks

A test can mount a fresh fixture instead of reopening the written one; assert the same stable ID.

## Outcome

Editor hydration reconstructs one coherent room projection.
