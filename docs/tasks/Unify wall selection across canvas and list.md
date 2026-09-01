---
type: Task
parent: "[[Inspect a selected wall]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Unify wall selection across canvas and list

## Evidence

M07 requires walls to be reachable through a list/table route, while [[Selection]] requires
canvas, list and Inspector to project one shared stable identity.

## Why it matters

A wall that can only be selected spatially excludes keyboard users, and parallel selection paths
can open an Inspector for a different overlapping entity.

## Approach

Add Wall to the deterministic selection projection and the non-canvas entity list. Route both
inputs through the shared selection store, apply the established overlap priority, and derive
canvas highlight, list state and Wall Inspector from the resulting Wall ID.

## Acceptance criteria

- Canvas and list selection of one wall produce the same stable Wall ID.
- Keyboard activation of a wall row opens the same Inspector as pointer selection.
- Overlapping room, wall and opening targets follow the documented priority/cycling rule.
- Selection changes no wall, opening or room data.
- Clearing selection restores the no-selection floor summary.

## Risks

Separate filtering or sorting can leave a visible canvas wall with no list route or bind a row to
the wrong overlapping target.

## Outcome

Every inspectable wall has one stable selection route expressed through both canvas and list.
