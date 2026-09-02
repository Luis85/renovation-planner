---
type: Task
parent: "[[Grid and snapping]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify grid, snap consistency and controls

## Evidence

Snapping affects every spatial gesture, and the status bar contract requires truthful Grid and
Snap state without making advanced configuration primary.

## Why it matters

A correct snap service can still be bypassed by one tool or misrepresented by its controls.

## Approach

Create shared contract cases run against rectangular/free Room, move, Wall and Opening adapters
as they become available. Test control state, keyboard operation, cancellation, zoom invariance,
reload and undo of owning actions. Capture guide appearance in supported themes.

## Acceptance criteria

- Every participating gesture passes the shared snap contract.
- Controls and actual behavior cannot disagree.
- Cancel persists no preview; reload preserves only completed snapped geometry.
- Guides have text/shape evidence beyond color.

## Risks

Unavailable prerequisite tools should be explicit pending cases, not fake adapters.

## Outcome

Grid and snapping remain consistent from controls through persisted spatial results.
