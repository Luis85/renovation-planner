---
type: Task
parent: "[[Update purchased material quantities from spatial context]]"
order: 20
status: New
horizon: "V1"
release: ""
---

# Validate spatial purchase edits in their authoritative unit

## Evidence

M12 requires unit validation, and [[A mismatched unit or currency is an error, not a coercion]]
forbids silently combining quantities whose symbols or dimensions disagree.

## Why it matters

A well-formed number in the wrong unit looks trustworthy and can produce a materially wrong
procurement state.

## Approach

Have the procurement command accept the quantity together with its explicit unit and validate it
against the owning Procurement item and Requirement. Route a refusal back to the spatial field
without converting, persisting or discarding the user's draft.

## Acceptance criteria

1. A compatible quantity and unit can complete the update end to end.
2. An incompatible unit returns a named refusal and leaves persisted quantity unchanged.
3. The editor retains the rejected draft and identifies the unit expected by the authority.
4. No unit conversion or compatibility table is implemented in presentation.

## Risks

- Comparing display labels instead of unit identities could admit incompatible dimensions.
- Clearing a rejected draft would force the renovator to reconstruct the attempted value.

## Outcome

Every spatial purchase edit is either accepted in its authoritative unit or refused without
coercion.
