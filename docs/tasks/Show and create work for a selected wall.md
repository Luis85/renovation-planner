---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Show and create work for a selected wall

## Evidence

M10 links work to optional spatial targets, while the Renovation semantics backlog requires all
created work to remain canonical and geometry-free.

## Why it matters

Room-only work hides which wall an action affects; editor-private wall work would create a second
work authority.

## Approach

Resolve canonical work linked to the selected wall and planned outcome. Route creation through the
appropriate authority-owned Task, Construction Section or Work Package workflow with stable wall
identity as scope.

## Acceptance criteria

- Selecting a wall lists canonical work linked to that stable wall ID.
- Creation receives the wall and optional planned-outcome identities.
- The created record stores no wall geometry.
- Marker and list selection focus the same wall and work record.
- Unavailable work capability creates no substitute.

## Risks

Wall labels, path positions or geometry snapshots may be persisted as the relationship.

## Outcome

The renovator can inspect and create canonical work for the precise wall that needs it.
