---
type: Task
parent: "[[Selection]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Return selection to the safe floor state

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) is the no-selection home state; M00 defines empty-canvas and idle Escape as routes back to it.

## Why it matters

Clearing selection must not leave a stale Inspector or accidentally cancel a nearer temporary interaction.

## Approach

Define escape precedence and empty-canvas behavior, retire invalid selections on data changes, and restore the floor summary with meaningful focus.

## Acceptance criteria

- Idle Escape and empty-canvas intent clear one selection.
- A menu, dialog or temporary task handles Escape before selection.
- Clearing selection restores the floor Inspector.
- A deleted/unreadable selected ID is not rebound by name.
- Viewport remains unchanged.

## Risks

Global key handling can swallow Escape intended for a focused field or dialog.

## Outcome

Selection always has a predictable, non-destructive route back to the floor overview.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. `routeEscape`
(`src/presentation/editor/escapeRouting.ts`) states the whole precedence once, and
`tests/presentation/editor/escapeRouting.test.ts` walks every level of it in seven cases.
Criterion 1 is 'Select with a selection clears it' beside
`tests/presentation/editor/tools/selectTool.test.ts`'s 'clicking empty canvas clears the
selection'. Criterion 2 is 'a running pan swallows Escape and touches nothing', 'a drawing tool
WITH a draft cancels the draft and stays active' and 'Select mid-drag cancels the drag before it
would clear the selection', plus `tests/presentation/editor/add/addMenu.test.ts`'s 'Escape reaches
the menu and never the canvas: a selected zone stays selected'. Criterion 3 is
`tests/presentation/editor/shell/floorInspector.test.ts`. Criterion 4 is
`tests/presentation/editor/runtime.test.ts`'s 'a selected zone that disappears from the next
hydrate is retired, not rebound', with its sibling 'keeps a selected id that survives the next
hydrate untouched' holding the other direction. Criterion 5 is what `routeEscape` does NOT reach —
no arm of it touches the viewport — and the retirement case asserts the camera is left alone.
