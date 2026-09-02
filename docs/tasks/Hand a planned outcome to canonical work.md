---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Hand a planned outcome to canonical work

## Evidence

M09's **See required work** interaction opens M10 and highlights work producing the selected
Planned item. The implementation plan requires that relationship before Review.

## Why it matters

An outcome that cannot identify how it will be produced remains a design note rather than
actionable renovation scope.

## Approach

Expose one handoff carrying planned-outcome and spatial-target IDs into
[[Turn a planned outcome into actionable work]]. Preserve room selection and viewport. When the
canonical-work prerequisite is absent, disclose unavailability without changing the outcome.

## Acceptance criteria

- The work view receives the exact planned-outcome and spatial-target identities.
- Existing linked canonical work is highlighted on arrival.
- Back navigation restores the selected planned outcome and viewport.
- Unavailable work capability neither creates a placeholder nor reports the outcome as failed.

## Risks

Navigation state may retain labels while losing the stable IDs needed for canonical linking.

## Outcome

A planned room result becomes the precise context from which actionable work can be reviewed or
created.
