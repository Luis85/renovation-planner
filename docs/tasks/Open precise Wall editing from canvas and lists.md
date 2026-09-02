---
type: Task
parent: "[[Edit a selected wall precisely]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Open precise Wall editing from canvas and lists

## Evidence

M07 requires a Wall to be selectable spatially and through a non-canvas entity list, with exact
length available from the selected context.

## Why it matters

Precise Wall editing cannot depend on hitting a narrow canvas target or create separate behavior per route.

## Approach

Resolve canvas and list/form selection to one Wall ID and one temporary edit state. Expose exact length,
Finish and Cancel while retaining adjacent-Room and hosted-Opening context.

## Acceptance criteria

- Canvas and non-canvas routes open the same Wall edit state.
- The edit state identifies adjacent Rooms and hosted Openings before changes.
- Cancel returns to the selected Wall without writing.

## Risks

Overlapping Room and Wall hit targets can select different entities than the list route.

## Outcome

Any selected Wall can enter one precise editing workflow without pointer-only targeting.
