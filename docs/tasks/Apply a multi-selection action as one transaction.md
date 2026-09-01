---
type: Task
parent: "[[Select several parts of a plan]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Apply a multi-selection action as one transaction

## Evidence

[M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) requires batch commands to be atomic and undo as one user action.

## Why it matters

Partial batch writes leave selected records disagreeing about the action the user confirmed once.

## Approach

Define the generic confirmation, impact and composite-command route for compatible actions, including version checks, compensation and one history entry.

## Acceptance criteria

- One confirmation dispatches one composite command.
- Every target is revalidated before write.
- Success creates one undo entry.
- A refusal writes nothing; a mid-sequence failure compensates or exposes recovery state.
- Destructive impact is shown before consent.

## Risks

Later domain actions may require stronger transaction semantics than the foundation can assume.

## Outcome

Compatible shared actions behave as one trustworthy reversible user action.
