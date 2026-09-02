---
type: Task
parent: "[[Inspect a selected room]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Preserve room inspection across layout and read changes

## Evidence

[M16](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md) reuses Inspector content in a drawer, and [M15](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md) keeps last-valid content visible after refresh failure.

## Why it matters

Resize or transient read failure should not silently switch the room being discussed or fabricate current data.

## Approach

Share Inspector content across persistent/drawer containers, preserve stable selection and viewport, restore focus, and integrate gone/stale/failed room states.

## Acceptance criteria

- Full and constrained Inspectors render the same selected ID.
- Resizing preserves selection and viewport.
- Drawer close restores focus meaningfully.
- Stale content is labeled and unsafe actions are disabled.
- A gone room retires its selection without choosing another.

## Risks

Responsive remounting can race hydration and overwrite newer selection state.

## Outcome

Room inspection remains coherent as workspace and vault conditions change.
