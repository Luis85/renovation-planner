---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Create one shared work record for multiple spatial targets

## Evidence

M11 allows one new or existing record to link to all selected entities, and canonical work
already supports spatial targets without owning their geometry.

## Why it matters

Creating one work record per selected target duplicates scope, cost and lifecycle for work the
renovator intends to manage once.

## Approach

For a compatible multi-selection, route one authority-owned work creation through the established
workflow and attach the ordered stable target identities to that single canonical record.

## Acceptance criteria

- One confirmation creates exactly one canonical work record.
- Every compatible selected target is linked by stable identity.
- No target geometry or editor-private work copy is stored.
- An incompatible or changed selection refuses before creation.
- Undo or compensation follows the canonical creation transaction.

## Risks

The workflow may fan out into duplicate records or silently omit a target after concurrent change.

## Outcome

One piece of shared work can truthfully scope several selected spatial targets.
