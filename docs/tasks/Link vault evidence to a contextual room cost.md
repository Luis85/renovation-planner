---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 60
status: New
horizon: "V1"
release: ""
---

# Link vault evidence to a contextual room cost

## Evidence

M13 lets the renovator link a vault document to cost, work and supplier context. [[Document]] keeps
the file as vault content, while cost, work and supplier remain separate canonical authorities.

## Why it matters

A quote or invoice is useful from the room only when its evidence relationship identifies what
cost it supports and who or what supplied the context.

## Approach

Use the common vault evidence picker and relationship command from the selected room cost. Prefill
the Cost item and available work or Supplier identities, permit deliberate adjustment, and refresh
both cost and evidence projections after the relationship succeeds.

## Acceptance criteria

1. Linking writes one evidence relationship and copies no vault file bytes.
2. The relationship can retain Cost item, room, work and Supplier context when each is supplied.
3. Opening the evidence uses its ordinary vault identity.
4. Cancelling or a missing endpoint creates no partial relationship.
5. The link is visible from the room cost and from the evidence authority after refresh.

## Risks

- Flattening several typed endpoints into one untyped id could resolve the wrong record.
- Treating a relationship failure as a file-write failure would give the wrong recovery.

## Outcome

Vault evidence can be attached to a room cost with its work and supplier context intact.
