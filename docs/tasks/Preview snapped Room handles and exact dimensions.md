---
type: Task
parent: "[[Edit a selected room shape and dimensions]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Grid and snapping]]"
---

# Preview snapped Room handles and exact dimensions

## Evidence

M00 requires handle dragging, editable dimensions and visible snapping before a Room edit commits.

## Why it matters

Homeowners need to see the complete proposed shape and measurements before changing renovation data.

## Approach

Drive handles and exact dimension fields into one draft geometry projection. Apply the shared snap
service, render active guides, and recalculate preview dimensions and area without repository writes.

## Acceptance criteria

- Handle and numeric changes update the same draft geometry.
- Applied snapping is visible and non-colour-only.
- Dimensions and area reflect the current draft without persisting it.

## Risks

Deriving numeric and pointer previews separately would make confirmation route-dependent.

## Outcome

Room edits have one accurate, snapped preview regardless of input method.
