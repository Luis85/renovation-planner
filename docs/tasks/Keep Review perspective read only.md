---
type: Task
parent: "[[Switch editor perspectives without losing context]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Keep Review perspective read only

## Evidence

The shared perspective model makes Review read-oriented, while M17 routes correction to Renovate
and permits only a linked Markdown summary export.

## Why it matters

Editing from Review would create a second mutation surface for derived findings and blur which
authority owns the corrected record.

## Approach

Expose finding inspection, source navigation and the explicit summary export in Review. Withhold
geometry tools and canonical renovation-record creation or editing controls.

## Acceptance criteria

- Review cannot activate geometry creation or editing tools.
- Findings route to authority-owned correction surfaces in Renovate.
- The summary action exports derived links without persisting a finding or Issue.
- Returning from a correction restores compatible Review context.

## Risks

A generic action menu may reintroduce editing controls that the Review-specific surface omitted.

## Outcome

Review remains a trustworthy read-only assessment surface with explicit routes to correction.
