---
type: Task
parent: "[[Describe existing and planned spatial state]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Record an existing spatial state

## Evidence

M08 needs incremental descriptions of current surfaces and fixtures, while the implemented Zone
status is a work-progress axis and cannot represent Existing.

## Why it matters

Without a separate canonical record, a planned edit either overwrites the survey or misuses a
status whose existing meaning must remain intact.

## Approach

Implement the accepted ADR-EPW Existing record, link it to one stable spatial identity, preserve
partial information, and round-trip it through canonical storage and queries.

## Acceptance criteria

- Existing state does not change the spatial object's progress status.
- Partial Existing information is valid and visibly incomplete.
- The record reloads with the same identity and spatial target.
- Missing, empty and unreadable results stay distinct.

## Risks

Treating a canvas layer as state would make visibility the data authority; persistence must remain
independent from projection.

## Outcome

Not started.
