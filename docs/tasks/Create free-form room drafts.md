---
type: Task
parent: "[[Create a free-form room]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Create free-form room drafts

## Evidence

The interaction specification defines corner placement, close gestures and Escape cancellation;
draft geometry must remain temporary.

## Why it matters

Irregular rooms need a guided shape flow without exposing implementation vocabulary or persisting
half-finished geometry.

## Approach

Adapt the existing polygon tool behind Room language. Add placed-corner, live-edge, snap and close
feedback; support remove-last-point, keyboard finish and cancellation. Keep all draft state in
render/runtime state and test real pointer grammar.

## Acceptance criteria

- No draft point causes a repository write.
- Close, finish, remove-last and cancel have deterministic behavior.
- Guidance uses Room/corner language rather than Zone/Polygon/Vertex.

## Risks

Multiple completion gestures can disagree; route each through one close predicate.

## Outcome

Homeowners can shape an irregular Room safely before committing it.
