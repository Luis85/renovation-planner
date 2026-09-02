---
type: Task
parent: "[[Undo and redo]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Refresh history results without replaying writes

## Evidence

[M15](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md) requires last-valid content and hydration-only retry after a successful write whose read-back fails.

## Why it matters

Repeating Undo or Redo to repair a failed read can apply the mutation twice.

## Approach

Refresh stores after history dispatch, retain last-valid projection on failure, mark `Saved · refresh needed`, disable unsafe edits and bind retry to hydration only.

## Acceptance criteria

- Successful Undo/Redo refreshes through queries.
- Failed read-back leaves the last valid projection visible and marked stale.
- Retry invokes no command or history transition.
- Context-bar actions expose correct disabled/busy states and keyboard paths.
- Successful retry clears stale state.

## Risks

UI handlers that discard promises can turn technical faults into silent failures.

## Outcome

History actions remain trustworthy even when the view cannot immediately reread their result.
