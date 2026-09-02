---
type: Task
parent: "[[Walls and hosted openings]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Persist a wall as one spatial identity]]"
---

# Host and restore an opening on its wall

## Evidence

M04 and M07 treat doors and windows as hosted by walls, but the current domain and persistence
model has no wall or opening relationship.

## Why it matters

An opening stored as unrelated geometry can drift off its wall and cannot explain what a wall
edit affects.

## Approach

Add the minimum opening identity, host-wall reference and host-relative placement; validate the
relationship in the command and prove a repository round trip restores both endpoints.

## Acceptance criteria

- A valid opening persists with its own ID and one host wall ID.
- Invalid host placement writes nothing.
- Reload restores the same host and placement.
- A missing host produces an unresolved result, never an unattached opening.

## Risks

Absolute and host-relative geometry can become two authorities; persist only the representation
selected by the accepted wall/opening contract.

## Outcome

Not started.
