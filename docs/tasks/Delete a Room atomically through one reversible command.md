---
type: Task
parent: "[[Delete a room safely from spatial context]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Delete a Room atomically through one reversible command

## Evidence

The Room note, geometry and approved referential resolutions can span several persistence writes.

## Why it matters

Deleting only part of that state leaves orphaned renovation data or a Room that exists in only one store.

## Approach

Use the existing reference-integrity and compensated-sequence boundaries to prepare, apply and record
one Room deletion. Lock every participant, capture inverses from actual pre-state and expose one history entry.

## Acceptance criteria

- Approved Room and dependent effects commit as one action.
- Any refused or faulted step compensates completed writes where possible and reports recovery needs.
- No unrelated reference is changed.
- One successful deletion creates one undo entry.

## Risks

Concurrent changes can invalidate prepared resolutions between confirmation and write.

## Outcome

Room deletion is an atomic, recoverable spatial operation rather than a collection of file removals.
