---
type: Task
parent: "[[Move a selected room]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Provide precise non-canvas room movement

## Evidence

The editor invariants require every essential spatial action outside the canvas, while M00 exposes
selected-room geometry controls through the Inspector.

## Why it matters

Drag-only movement is inaccessible and cannot express a known precise correction.

## Approach

Add Inspector fields or an equivalent list/form action for a selected Room's position adjustment.
Use project units for display, normalize to world units and dispatch the same move command. Cover
labels, validation, focus, cancellation, themes and constrained layout.

## Acceptance criteria

- Keyboard users can enter and cancel a precise move.
- Unit conversion reaches the same command input as dragging.
- Invalid input preserves the draft and persisted Room.
- Focus returns to the selected Room after completion.

## Risks

Absolute position may be less understandable than offsets; validate wording in the harness.

## Outcome

Room placement can be corrected accurately without manipulating the canvas.
