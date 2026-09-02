---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Guard stale editing and retry hydration only

## Evidence

M15 permits inspection but disables geometry, add, delete, and other unsafe writes.

## Why it matters

An edit based on stale geometry can overwrite a successful change the view failed to load.

## Approach

Place one stale-write guard on every mutation entry point, expose its reason, and wire `Try
again` directly to hydration. Test the command boundary, not only disabled button markup.

## Acceptance criteria

- Every unsafe write path is refused while stale.
- Selection and source-note inspection remain available.
- Repeated retries invoke reads and never repeat the mutation.

## Risks

A visually disabled control may leave a shortcut or menu path active.

## Outcome

Stale state remains inspectable without allowing a destructive follow-up.
