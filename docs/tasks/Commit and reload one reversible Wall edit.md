---
type: Task
parent: "[[Edit a selected wall precisely]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Commit and reload one reversible Wall edit

## Evidence

M07 requires numeric and direct editing to share one reversible command while preserving Wall context.

## Why it matters

Related Wall, Opening and Room writes must not become separate history actions or partial saved states.

## Approach

Commit the accepted full-geometry proposal through one compensated command, capture one inverse and publish
one coherent refresh. Exercise canvas/form parity, conflicts, every write boundary, undo, redo and reload.

## Acceptance criteria

- Every supported route dispatches the same Wall edit command once.
- All affected entities commit or compensate as one action.
- Undo restores the full pre-edit state and redo reapplies it once.
- Reload preserves exact length, Opening hosts and adjacent-Room relationships.

## Risks

Sidecar and note writes can succeed independently; detonate each ordering.

## Outcome

A precise Wall edit is one durable and reversible change across every affected entity.
