---
type: Task
parent: "[[Start room creation from Add]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Route Add Room through every entry point

## Evidence

M02 requires pointer and keyboard access, while M05 routes its Add rooms choice into the same
path. The repository rule is one action for every input.

## Why it matters

Parallel entry implementations drift in availability, errors, focus and tool lifecycle.

## Approach

Wire the editor Add menu, command/keyboard route and Floor start choice to the canonical Room
activation. Preserve focus, close the menu before activation and return a start failure through
the shared error surface. Test each route by spying on the canonical action.

## Acceptance criteria

- Every entry invokes the canonical action exactly once.
- A refused start leaves Select active and reports why.
- Focus is restored predictably after refusal or menu cancellation.

## Risks

Event bubbling can activate both menu and canvas; tests must include real keyboard and pointer grammar.

## Outcome

Room creation starts consistently wherever the homeowner asks for it.
