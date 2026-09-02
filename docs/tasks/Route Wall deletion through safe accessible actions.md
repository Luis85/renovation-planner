---
type: Task
parent: "[[Delete a selected wall safely]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Route Wall deletion through safe accessible actions

## Evidence

M07 places Wall deletion under More rather than a primary button, while M00 permits Delete and
Backspace only when focus is outside an editable field. The component contract requires every
canvas action to have a keyboard-accessible, non-canvas equivalent.

## Why it matters

A destructive shortcut that runs while someone edits text can remove geometry instead of a
character, and a canvas-only action excludes keyboard and list-based workflows.

## Approach

Route More → Delete, Delete, Backspace and the non-canvas Wall action through one deletion
coordinator. Apply the editable-field guard before shortcut handling, preserve meaningful focus
on cancellation or refusal, and give the destructive action secondary visual emphasis.

## Acceptance criteria

- More → Delete, Delete, Backspace and the non-canvas Wall action invoke one coordinator.
- Inputs, textareas and editable fields retain Delete and Backspace behavior without starting
  deletion.
- Delete is never presented as the primary selected-Wall action.
- Keyboard and non-canvas routes preserve selection and focus when no deletion commits.

## Risks

Duplicating the field-focus test at several entry points can let one shortcut bypass it; keep the
guard at the shared routing boundary.

## Outcome

Every supported Wall-delete input reaches one safe, non-primary and accessible workflow.
