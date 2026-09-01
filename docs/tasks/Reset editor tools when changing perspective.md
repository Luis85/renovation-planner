---
type: Task
parent: "[[Switch editor perspectives without losing context]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Reset editor tools when changing perspective

## Evidence

The mental-model specification separates perspective from tool state and requires every
perspective change to return to Select.

## Why it matters

Carrying a hidden drawing or creation tool into another workflow can turn the first click after
navigation into an unintended write.

## Approach

Route accepted perspective changes through one transition that cancels or safely settles the
current gesture, activates Select, and only then exposes destination interactions.

## Acceptance criteria

- Every changed perspective starts with Select active.
- An in-flight gesture is cancelled or settled according to its existing interruption contract.
- Destination input cannot arrive before Select is active.
- Choosing the active perspective does not reset the current tool.

## Risks

A transition may discard a multi-step draft without applying the tool's established cancellation
semantics.

## Outcome

Each perspective opens in the editor's safe interaction state without accidental carry-over.
