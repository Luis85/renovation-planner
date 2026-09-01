---
type: Task
parent: "[[Create a free-form room]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify free-form cancellation, precision and alternatives

## Evidence

Editor invariants require cancellable drafts, visible immediate feedback and a non-canvas route
to every essential entity/action.

## Why it matters

Free-form drawing can trap keyboard users and lose accumulated points on an interrupted click.

## Approach

Test Escape, pointer cancellation, blur, invalid closure, remove-last, snap behavior and command
history. Provide keyboard-accessible point review/edit and Room metadata controls. Add theme and
live-canvas checks for close-target visibility.

## Acceptance criteria

- Cancellation and interruption write nothing.
- Invalid closure preserves an editable draft.
- Keyboard users can review points, finish/cancel and name the Room.
- Undo/redo and reload apply only after successful completion.

## Risks

An alternative point editor can become a second geometry model; operate on the shared draft.

## Outcome

Free-form Room creation remains precise, cancellable and usable beyond pointer-only drawing.
