---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 20
status: New
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
