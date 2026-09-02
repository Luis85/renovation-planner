---
type: Task
parent: "[[Delete a room safely from spatial context]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Guard Room deletion shortcuts in editable fields

## Evidence

M00 allows Delete or Backspace only when deletion is valid and focus is not in a field.

## Why it matters

Deleting text must never become an accidental destructive action against the selected Room.

## Approach

Route Delete and Backspace through one selection-aware shortcut guard that declines events from
editable targets. Keep the non-canvas destructive action available and test input, textarea,
content-editable and canvas focus.

## Acceptance criteria

- Delete and Backspace in an editable field never open Room deletion.
- The same keys outside fields open deletion only for a deletable selected Room.
- Declined shortcuts do not disturb field input or selection.

## Risks

Tag-name checks can miss future editable controls; use the editor's actual focus contract.

## Outcome

Keyboard Room deletion is available without putting text editing at risk.
