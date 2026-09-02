---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Create an intended room detail beside its existing source

## Evidence

M09 requires Planned records that do not overwrite Existing records and permits an optional link
to an existing source. The implementation plan assigns separate persistence and relationship
integrity to Phase 7.

## Why it matters

Overwriting the survey removes the baseline needed to explain, price and verify the renovation.

## Approach

Deliver one planned-detail form and command for a selected room. Persist a distinct authority-owned
record, retaining optional source identity and using the room's stable spatial identity without
copying geometry.

## Acceptance criteria

- Saving a planned detail leaves its existing source byte-for-byte unchanged.
- Added outcomes can be saved with no source; modified or removed outcomes can retain one.
- Cancel and validation refusal write nothing.
- Reload preserves room, source and planned identities.

## Risks

Existing/planned semantics may be conflated with a work-progress status.

## Outcome

A renovator can state one intended result without erasing what exists now.
