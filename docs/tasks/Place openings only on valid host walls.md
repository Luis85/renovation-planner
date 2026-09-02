---
type: Task
parent: "[[Add and safely edit a wall opening]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Place Openings only on valid host Walls

## Evidence

The editor mental model says doors/windows are inserted into Walls, and M07 requires hosted
openings and referential impact.

## Why it matters

A free-floating Opening is invalid project information even if its canvas shape looks plausible.

## Approach

Use prerequisite host validation and Opening creation commands. Add eligible-Wall highlighting,
host-relative preview and exact dimensions, with Add-menu and contextual Wall entries routed to
one action. Test absent host, invalid bounds, cancellation and write failure.

## Acceptance criteria

- Creation cannot begin or finish without a valid host Wall.
- All entry routes invoke one canonical Opening action.
- Preview writes nothing; confirmation creates one hosted Opening.
- Refusal retains the valid Floor state and explains the host problem.

## Risks

Presentation geometry must not become the authority on whether hosting is valid.

## Outcome

Every new Opening begins life attached to a valid persisted Wall.
