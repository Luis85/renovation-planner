---
type: Task
parent: "[[Start one creation task from Add]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Show an active creation-task banner with complete controls

## Evidence

The creation-task contract requires a visible temporary state, while M03 and M04 require instructions,
Finish, Cancel, remove-last behavior and keyboard shortcuts during creation.

## Why it matters

Without a persistent task surface, the canvas can change mode invisibly and leave users unable to finish,
correct or escape their current work.

## Approach

Render one localized active-task banner from task-manager state. Supply task-specific instructions and capability-driven
Finish, Cancel and remove-last controls, display approved shortcuts, and route every control to the canonical task lifecycle.

## Acceptance criteria

- Every active creation task has a visible named banner with concise instructions.
- Finish and Cancel are always available when their task contract permits them.
- Remove last appears only for tasks with removable draft steps.
- Displayed shortcuts invoke the same actions and do not fire from editable fields.
- Completing or cancelling retires the banner and returns focus meaningfully.

## Risks

Hard-coding controls per tool can make the banner disagree with the active task's real capabilities.

## Outcome

An active creation task is always visible, understandable and controllable without relying on hidden canvas mode.
