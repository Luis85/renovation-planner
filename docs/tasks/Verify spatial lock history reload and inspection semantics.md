---
type: Task
parent: "[[Lock completed spatial geometry against accidental editing]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify spatial lock history reload and inspection semantics

## Evidence

The interaction contract requires one predictable history action per meaningful edit, while the
component state contract distinguishes workspace UI state from canonical persisted data. The
accepted ADR determines which promise applies to locks.

## Why it matters

A lock can appear effective during one canvas session yet disappear unexpectedly, pollute geometry
history or block inspection after reload.

## Approach

Run Room, Wall and completed-group journeys through canvas, keyboard and Inspector/list routes.
Verify manipulation refusal and selection retention, then assert the accepted authority's exact
history and reload semantics: no canonical history or vault-persistence claim for workspace state,
or one reversible command and reload persistence for canonical state.

## Acceptance criteria

- Room, Wall and completed-group locks refuse pointer, keyboard and Inspector manipulation.
- Locked targets remain selectable and their Inspector data remains readable.
- Non-canvas unlock restores editing through the same mutation boundary.
- Workspace-state ownership adds no canonical undo entry and is described truthfully after
  reload or workspace restoration.
- Canonical-state ownership makes lock and unlock one undoable intent each and preserves the
  committed state across reload.
- Tests fail if implementation follows the authority not chosen by the accepted ADR.

## Risks

A conditional test suite that accepts both authorities after the ADR lands proves nothing; bind
the cases to the decision actually accepted.

## Outcome

Spatial locking is proven safe, inspectable and consistent with its accepted history and
persistence contract.
