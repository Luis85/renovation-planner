---
type: Task
parent: "[[Move a selected room]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Persist, reload and reverse room moves

## Evidence

WP7 requires move, undo, redo and reload to reproduce deterministic sidecar geometry without
changing Room identity.

## Why it matters

Movement is unsafe if a reload resurrects old coordinates or undo restores only the projection.

## Approach

Extend repository, command-history and fixture-vault scenarios around moved Zone geometry. Capture
the inverse from the pre-write state, retain stable identity, test revision conflict and ensure a
post-write read failure retries hydration without redispatch.

## Acceptance criteria

- Reload restores the last successful coordinates and the same ID.
- Undo and redo each persist exactly one corresponding state.
- Read-back failure never repeats the move.
- Revision conflict preserves the newer vault state.

## Risks

Tests can pass against in-memory projection; always read the sidecar back from the fixture vault.

## Outcome

Room movement remains correct across history, concurrency and reload.
