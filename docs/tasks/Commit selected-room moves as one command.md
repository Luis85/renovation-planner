---
type: Task
parent: "[[Move a selected room]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Commit selected-room moves as one command

## Evidence

VS-07 and the interaction specification require continuous drag to remain a preview until release,
then become one user-intent operation.

## Why it matters

Writing during pointer movement produces noisy revisions, broken undo and visible state that can
outrun persistence.

## Approach

Route selected-Room drag and precise offset input through one reversible move command. Keep preview
geometry in render state, apply snapping before command creation, and refresh from queries after
completion. Test pointer interruption and optimistic-version refusal.

## Acceptance criteria

- Pointer movement performs no vault write.
- One completed move dispatches once and creates one history entry.
- Precise and direct routes share the command boundary.

## Risks

Camera movement during a drag can corrupt world-space deltas; lock or compensate through existing viewport rules.

## Outcome

A selected Room moves as one deliberate, validated edit.
