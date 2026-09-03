---
type: Task
parent: "[[Start one creation task from Add]]"
order: 40
status: Active
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

## Amendments

**2026-09-03** — `TemporaryToolBanner.vue` draws whenever the active tool is neither `null` nor
`select`. Criterion 1 is `tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s 'is
absent under Select and names the task under a creation tool' and 'names the calibrate task under
the calibrate tool' — a name and one instruction, both from the locale table. Criterion 5 is its
Cancel case, which retires the banner by returning to Select.

The banner's only control is Cancel. So criterion 2's FINISH is unmet: a polygon finishes by
clicking its own first corner and nothing in the banner says so. Criterion 3's REMOVE LAST is
unmet for a tool that does have removable draft steps — `DrawPolygonTool` holds a vertex buffer
and offers no way to drop the last one. Criterion 4 is vacuous: the banner displays no shortcut,
so there is nothing that could fire from an editable field.
