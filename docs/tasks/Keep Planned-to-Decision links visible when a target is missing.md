---
type: Task
parent: "[[Link unresolved decisions to planned spatial state]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Keep Planned-to-Decision links visible when a target is missing

## Evidence

M09 depends on linked Decisions, while [[Four kinds of reference failure are detected by name]]
requires missing, deleted, invalid and duplicate identities to remain distinguishable.

## Why it matters

Silently dropping a damaged link makes an unresolved planning choice look completed or
never-recorded and removes the information needed to repair it.

## Approach

Make the relationship query preserve unresolved rows and identify which endpoint cannot resolve.
Route delete and repair actions through the common reference-integrity policy, and keep unrelated
readable links available when one is damaged.

## Acceptance criteria

1. A missing Decision target leaves an unresolved row on its Planned outcome.
2. A missing Planned target remains discoverable from the Decision-side query.
3. Missing, unreadable, invalid and duplicate identity failures retain distinct codes or states.
4. One damaged relationship does not hide unrelated readable links.
5. No replacement endpoint or "resolved" state is manufactured.

## Risks

- Filtering failed joins could turn data damage into an authoritative empty result.
- A broad query failure could unnecessarily hide every healthy relationship.

## Outcome

Broken Planned-to-Decision relationships remain visible, diagnosable and repairable from either
side.
