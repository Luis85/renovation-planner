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
Cancel case: Cancel retires the banner by returning to Select, discarding any draft.

The banner's only control is Cancel. So criterion 2's FINISH is unmet: a polygon finishes by
clicking its own first corner and nothing in the banner says so. Criterion 3's REMOVE LAST is
unmet for a tool that does have removable draft steps — `DrawPolygonTool` holds a vertex buffer
and offers no way to drop the last one. Criterion 4 is vacuous: the banner displays no shortcut,
so there is nothing that could fire from an editable field.

**2026-09-04**, the Add Room increment — **Finish** is built, and criterion 3's Remove last stays
open for a reason rather than for want of work.

Criterion 2's FINISH half is met for the task that declares it. `TASKS` in
`TemporaryToolBanner.vue` gained a `finish?: true` flag and a `draw-room` entry; a task carrying
that flag renders a Finish button — labelled "Create room" — `aria-disabled` with its reason
(`editor.task.finish.blocked`) until the draft is valid, calling the identical
`runtime.createRoom()` the Inspector's own Create calls. Two doors, one action. Held by
`tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s 'names the room task and offers
Finish, aria-disabled with its reason until the draft is valid', 'offers no Finish under the
calibrate tool, which finishes by gesture', 'Finish creates the room through the same action as
the form, and focus lands on the canvas' and 'pressing Finish while the draft is incomplete calls
no action and leaves the tool in place' — the last of which spies the action rather than
asserting an outcome, because `createRoomFromDraft` refuses the same invalid draft on its own and
an outcome assertion would pass with the guard deleted.

That the flag lives in the TABLE is what keeps criterion 2's *"when their task contract permits
them"* a property of the contract rather than of the component: calibrate and draw-polygon
declare no `finish` and render no button, which the second case above asserts.

Criterion 5's focus half needed a mechanism the room task is the first to require, and the brief's
was wrong: `onBeforeUnmount` never fires here, because the banner's own ROOT carries the
`v-if` — the component is not unmounted when a task ends, its content is. Measured, not reasoned:
a scratch SFC with `v-if` on its own root called `onBeforeUnmount` zero times when toggled off,
and the literal implementation left focus on `<body>`. It is `watch(task)` instead, whose default
`'pre'` flush runs before the owning component's DOM patch — the same "before" moment
`NewRoomInspector`'s `onBeforeUnmount` gets, reached through a mechanism that works for a
self-`v-if`'d root.

**Criterion 3 — Remove last — stays open, and now for a stated reason.** A rectangle has no
removable step: the room task's whole draft is one `rect`, and Escape clears it in one gesture.
The one tool that DOES hold a removable vertex buffer, `DrawPolygonTool`, no longer has a door in
the Plan Editor at all (design spec §2.1), so a Remove last built today would have no task to
belong to. Trigger: [[Create a free-form room]], which gives that tool a door again.

Criterion 4 stays vacuous: the banner still displays no shortcut, so there is nothing that could
fire from an editable field.
