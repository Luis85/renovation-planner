---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Commit enclosed walls and Room atomically

## Evidence

M04 offers Room creation when a Wall loop closes and requires the accepted result to be one
undoable transaction.

## Why it matters

Separate Wall and Room writes can leave an enclosure with a ghost Room or a Room with no defining Walls.

## Approach

Use prerequisite Wall commands and the existing Room/Zone creation boundary inside one compensated
application sequence. Detect enclosure as application input, ask for Room consent, persist accepted
effects, publish refresh events and capture one inverse. Test every failure step.

## Acceptance criteria

- Declining Room commits only valid Walls.
- Accepting Room commits Walls and Room as one history action.
- Any failed step compensates prior effects.
- Reload restores the same IDs and relationships.

## Risks

Atomicity may require recovery records across note and sidecar writes; reuse existing sequence infrastructure.

## Outcome

An enclosed Wall chain can become a Room without partial or separately reversible results.
