---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Choose Existing or New Wall state

## Evidence

M04 includes Existing or New as part of the Wall-drawing Inspector.

## Why it matters

A traced existing Wall and a proposed new Wall have different renovation meaning even when their geometry matches.

## Approach

Add the accepted Wall state vocabulary to the connected-chain draft, preview it with non-colour-only semantics,
and include it in the single finish transaction. Reuse prerequisite persistence and validation.

## Acceptance criteria

- The draft clearly exposes Existing and New before Finish.
- Every Wall created from the chain receives the chosen valid state.
- State is represented by text or pattern as well as colour.
- Cancel writes no Wall state and reload restores committed state.

## Risks

This choice must not invent the broader Existing/Planned model owned elsewhere.

## Outcome

Connected Walls record whether they describe the current building or new construction.
