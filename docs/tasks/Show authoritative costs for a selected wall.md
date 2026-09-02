---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 70
status: New
horizon: "V1"
release: ""
---

# Show authoritative costs for a selected wall

## Evidence

M13 makes costs spatial and traceable to related surfaces, but the existing room-cost task covers
only room scope. [[Cost item]] already permits aggregation by Zone, work, asset and supplier.

## Why it matters

A renovator selecting one wall needs the costs genuinely linked to that wall, not the whole room
silently relabelled as a wall total.

## Approach

Extend the authoritative spatial cost query to accept a selected wall identity and return the cost
items included by canonical relationships, with their room and work context. Render that narrower
projection and preserve an explicit route back to the containing room totals.

## Acceptance criteria

1. Selecting each of two walls returns only costs authoritatively linked to that wall.
2. A wall cost row exposes its Cost item and related work or material source.
3. Costs linked only to the containing room are not presented as wall-specific.
4. Query failure, no linked costs and unreadable linked costs remain distinct.
5. No wall total is persisted or recomputed in presentation.

## Risks

- Inferring wall membership from screen position could disagree with canonical relationships.
- Narrow filtering could hide a room-level cost without explaining the scope boundary.

## Outcome

Selecting a wall reveals the authoritative costs linked to it without manufacturing a wall
budget.
