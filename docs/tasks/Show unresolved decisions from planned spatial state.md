---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Link unresolved decisions to planned spatial state]]"
---

# Show unresolved decisions from planned spatial state

## Evidence

M09 requires unresolved Decisions to be listed and opened from the planned room context. The
relationship is owned by [[Link unresolved decisions to planned spatial state]].

## Why it matters

A planned finish that conceals an unresolved choice looks settled and can send premature work or
cost assumptions downstream.

## Approach

Read linked canonical Decision records for the selected planned target, distinguish unresolved
from resolved or unreadable states, and open the authority-owned Decision note for action.

## Acceptance criteria

- Unresolved Decisions linked to the selected planned target are listed.
- Selecting a row opens the canonical Decision record.
- Resolved, missing and unreadable Decisions are distinct.
- Review or navigation does not copy or mutate the Decision.

## Risks

The planned-state projection may infer a decision from free text instead of using the canonical
relationship.

## Outcome

The renovator can see and open the unresolved choices that keep an intended room state unsettled.
