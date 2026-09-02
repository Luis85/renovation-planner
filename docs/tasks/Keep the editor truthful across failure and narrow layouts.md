---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Keep the editor truthful across failure and narrow layouts

## Evidence

[M15](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md) keeps last-valid content after read-back failure, while [M16](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md) preserves editor state across layout changes.

## Why it matters

Failure and narrow leaves must not turn valid data into an empty screen or reset the user's spatial context.

## Approach

Integrate initial failure, stale projection, retry-only hydration and full/constrained/unsupported-width shell states around the same floor identity.

## Acceptance criteria

- Initial failure, supported empty and stale-after-write render differently.
- Retry after stale state repeats no mutation.
- Constrained reflow preserves viewport and selection.
- Unsupported width offers a non-canvas summary and focus action without horizontal scrolling.

## Risks

Responsive remounts can accidentally retire the store whose state they promise to preserve.

## Outcome

The floor remains honest and recoverable when data or workspace width is imperfect.
