---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify reversible and accessible room creation

## Evidence

M03 requires numeric non-pointer input and focus recovery; VS-04 requires cancellation, undo,
redo and reload to preserve one completed intent.

## Why it matters

Canvas success alone excludes keyboard users and can conceal fragmented history or draft writes.

## Approach

Create end-to-end tests for cancel, create, undo, redo, reload, invalid input and write failure.
Drive both drag and form-only routes, scan the form for accessibility, capture light/dark states
and add a live-vault journey for actual canvas focus.

## Acceptance criteria

- Cancel writes nothing; create adds one history entry.
- Undo removes all effects and redo restores them once.
- A Room can be dimensioned and named without pointer-only controls.
- Failure never leaves a phantom Room.

## Risks

jsdom cannot validate layout, drag feel or visible focus; browser and vault checks remain necessary.

## Outcome

Rectangular Room creation is trustworthy across input methods, history and failures.
