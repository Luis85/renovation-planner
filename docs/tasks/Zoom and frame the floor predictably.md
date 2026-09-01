---
type: Task
parent: "[[Canvas navigation]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Zoom and frame the floor predictably

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) requires pointer-anchored zoom and Fit floor; the approved implementation plan adds fit-selection and canvas routing tests.

## Why it matters

Camera changes must preserve the spatial point under the user's hand and never alter persisted geometry.

## Approach

Verify wheel/pinch anchoring, horizontal trackpad intent, zoom limits, fit-floor and fit-selection shortcuts against valid and degenerate bounds.

## Acceptance criteria

- Zoom remains anchored around the pointer.
- Horizontal trackpad intent pans instead of becoming a no-op zoom.
- Fit shortcuts are keyboard-layout independent.
- Degenerate bounds preserve a valid zoom.
- Camera operations change no world coordinates.

## Risks

Camera movement during a geometry drag can corrupt the command's world-coordinate delta.

## Outcome

The user can reliably find the floor or selection without changing the plan.
