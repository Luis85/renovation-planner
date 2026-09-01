---
type: Task
parent: "[[Review renovation readiness spatially]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Keep readiness findings separate from persisted issues

## Evidence

M17 calls its derived rows issues, but the backlog already gives [[Issues]] persisted product
semantics. The requested readiness model distinguishes a computed finding from that canonical
record.

## Why it matters

Persisting every missing estimate or blocked dependency as an Issue creates stale duplicates and
turns a review result into project data the user must clean up.

## Approach

Represent Review output as transient derived findings carrying rule, source and spatial target
references. Route each to its canonical source. Do not create, update or resolve Issue notes as a
side effect of review.

## Acceptance criteria

- Re-running Review replaces findings from current inputs without writing notes.
- A finding carries an explanation and canonical source reference.
- Displaying, selecting or clearing a finding does not mutate any Issue.
- If Issue creation is later offered, it is an explicit authority-owned action, not derivation.

## Risks

Shared UI naming may conceal that Issue and finding have different lifecycle and persistence.

## Outcome

Readiness can remain current and disposable without competing with the project's persisted Issue
records.
