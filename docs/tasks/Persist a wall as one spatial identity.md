---
type: Task
parent: "[[Walls and hosted openings]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Persist a wall as one spatial identity

## Evidence

M04 and M07 require selectable, reloadable walls, while the current sidecar persists polygons
only and the vertical-slice model reserves wall geometry as an unimplemented kind.

## Why it matters

An editor-only segment cannot be linked to an opening, planned outcome or canonical work.

## Approach

Define the minimum wall identity and valid world geometry, carry it through one completed
command, and round-trip metadata plus geometry through the canonical repositories without
changing room-first Zone persistence.

## Acceptance criteria

- One successful command creates one stable wall identity.
- Metadata and geometry reload to the same wall.
- Invalid or partial writes never appear as a saved wall.
- The wall is queryable without a canvas.

## Risks

Choosing a geometry shape before ADR-SO settles could create an incompatible sidecar contract;
the task must implement the accepted representation, not invent one.

## Outcome

Not started.
