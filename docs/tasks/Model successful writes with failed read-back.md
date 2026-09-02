---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Model successful writes with failed read-back

## Evidence

M15 distinguishes a successful mutation from the failed hydration that follows it.

## Why it matters

One generic failure state cannot truthfully say both whether data was saved and whether the view
is current.

## Approach

Represent write outcome, last valid projection, stale state, recoverable error, source target,
and retry progress independently. Keep canonical error routing outside this state model.

## Acceptance criteria

- A post-write read failure retains the previous projection.
- Save state reads `Saved · refresh needed`.
- Retry state cannot contain a command to replay.

## Risks

Coupling stale state to a view mode could replace valid content with a failure page.

## Outcome

The editor can represent saved data and stale presentation at the same time.
