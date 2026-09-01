---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Exercise write compensation and interrupted recovery

## Evidence

WP7 treats note and sidecar changes as one logical write sequence with compensation and recovery.

## Why it matters

Failures between files can leave ghost rooms or erase valid geometry after restart.

## Approach

Inject failure at each write, compensation, marker, and recovery boundary. Verify complete prior
state, complete new state, or an explicit unrecovered result; add backup/recovery guidance for
the residual cases.

## Acceptance criteria

- No injected failure is presented as an ordinary success with partial room data.
- Successful compensation restores the exact prior state.
- Unrecovered cases name the safe manual action and preserve available evidence.

## Risks

A test that fails before the first write does not exercise compensation.

## Outcome

Each interruption point has a tested, truthful recovery result.
