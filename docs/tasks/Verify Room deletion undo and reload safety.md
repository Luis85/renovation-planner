---
type: Task
parent: "[[Delete a room safely from spatial context]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify Room deletion undo and reload safety

## Evidence

The deletion guarantee spans confirmation, compensated writes, history and the state reconstructed after reload.

## Why it matters

A Room that returns incomplete on undo or reappears after reload makes a destructive confirmation untrustworthy.

## Approach

Drive deletion from canvas, shortcut and non-canvas routes through cancel, stale impact, success, every write
failure, undo, redo and reload. Verify Room geometry and every resolved relationship together.

## Acceptance criteria

- Cancel and refused deletion preserve the complete pre-state.
- Successful deletion survives reload with no orphaned relationships.
- Undo restores the complete Room and references; redo removes them once.
- Interrupted sequences recover to a documented coherent state.

## Risks

In-memory assertions can miss note/sidecar disagreement; include fixture-vault and live-vault evidence.

## Outcome

Room deletion remains coherent across failure, history and time.
