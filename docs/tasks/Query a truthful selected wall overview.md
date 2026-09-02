---
type: Task
parent: "[[Inspect a selected wall]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Query a truthful selected wall overview

## Evidence

M07 requires normalized wall length, height, thickness, adjacent rooms and hosted openings, while
[[Walls and hosted openings]] owns the canonical identities and relationships.

## Why it matters

The Inspector cannot distinguish a real zero, an absent relationship and an unsupported field
after a query has flattened them into one convenient DTO.

## Approach

Create a wall overview query keyed by stable Wall ID. Return normalized measurements,
capability-aware height and thickness, adjacent-room references, hosted-opening references and
per-section availability without copying canonical records.

## Acceptance criteria

- The query result carries the requested stable Wall ID.
- Length, height and thickness distinguish value, unavailable and failed readings.
- Adjacent rooms and hosted openings retain canonical IDs and unresolved states.
- A supported collection with no entries is distinct from an unsupported collection.
- Repository failures propagate as coded read failures rather than empty overview values.

## Risks

Joining several authorities can produce a partially current DTO unless stale and failed members
remain explicit.

## Outcome

Presentation receives one truthful, capability-aware overview for the selected wall.
