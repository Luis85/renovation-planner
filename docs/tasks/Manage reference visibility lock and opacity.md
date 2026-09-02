---
type: Task
parent: "[[Plans and background import]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Manage Reference plan visibility, lock and opacity

## Evidence

The research and M06 define the imported source as a revisitable layer with visibility, opacity,
lock, recalibrate, replace and remove controls.

## Why it matters

Homeowners need to compare source and interpreted geometry without accidentally moving the source.

## Approach

Build Reference plan list/Inspector controls over canonical commands. Preview opacity without
writing continuously beyond the established property-commit policy, distinguish visibility from
removal, and require a deliberate unlock before placement edits. Add keyboard and theme tests.

## Acceptance criteria

- Completed references default visible and locked.
- Visibility changes projection only; removal is explicit.
- Lock prevents accidental placement changes.
- Controls are keyboard reachable and survive reload.

## Risks

Lock can become cosmetic if pointer routing bypasses the command guard; test at the mutation boundary.

## Outcome

Homeowners can safely compare, dim and protect a committed Reference plan.
