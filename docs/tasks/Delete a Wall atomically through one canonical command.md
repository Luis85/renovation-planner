---
type: Task
parent: "[[Delete a selected wall safely]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Delete a Wall atomically through one canonical command

## Evidence

A Wall, its hosted Openings, adjacent-Room geometry and linked references can span several
canonical records, while the interaction contract defines their deletion as one user intent.

## Why it matters

Deleting only part of that state leaves orphaned Openings, invalid Rooms or references to a Wall
that no longer exists.

## Approach

Build one command over the accepted Wall and Opening contracts. Re-read and validate the consented
impact, refuse invalid geometry or stale referents, lock every participant, apply only approved
effects, and compensate any completed write if a later step fails.

## Acceptance criteria

- Every entry route dispatches the same canonical Wall-delete command.
- Invalid adjacent-Room geometry, unresolved hosted Openings and stale or protected references
  refuse before an irreversible result is exposed.
- Approved Wall and dependent effects commit atomically as one user intent.
- A fault or refusal after a write compensates completed effects where possible and reports any
  recovery need.
- One successful deletion creates exactly one undo entry.

## Risks

Command-time impact may differ from the confirmation; accepting stale consent would turn a
correct preview into an unsafe write.

## Outcome

Wall deletion is one validated, atomic and recoverable domain operation.
