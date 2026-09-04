---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Render rooms on the standard canvas and list

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) requires the whole floor, a room list and Select as the safe no-selection state.

## Why it matters

Canvas-only rooms exclude keyboard users, while list-only rooms lose the spatial value of the editor.

## Approach

Render one Room projection in both the canvas layer and accessible summary list, keyed by the same ID, with a truthful no-selection floor summary.

## Acceptance criteria

- Canvas and list expose the same readable room IDs.
- Opening has no selection and no active temporary task.
- Every room list row is keyboard reachable.
- Fit-floor shows available geometry without changing it.

## Risks

Separate render lists can drift in filtering or ordering.

## Outcome

Users can see and reach every readable room spatially or through the list.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. Criteria 1 and 3 are one case:
`tests/presentation/editor/shell/floorInspector.test.ts`'s 'lists every room and every area as a
button, and a row selects and frames its record' — the rows are real `<button>` elements carrying
the same stable ids the canvas draws, so the keyboard route and the pointer route reach one
identity. Criterion 2 is `tests/presentation/editor/runtime.test.ts`'s 'activates Select once the
plan becomes ready' beside `tests/presentation/editor/shell/roomSummaryList.test.ts`'s 'marks no
row pressed when nothing is selected'. Criterion 4 is the pre-existing
`tests/presentation/editor/zoneExtent.test.ts` and `tests/presentation/editor/viewport.test.ts`:
fitting reads bounds and writes only the camera.
