---
type: Task
parent: "[[Update purchased material quantities from spatial context]]"
order: 10
status: New
horizon: "V1"
release: ""
---

# Update a purchased quantity through the procurement authority

## Evidence

M12 offers purchased-quantity editing from a material row, while [[Requirement]] owns needed
quantity and [[Procurement item]] separately owns what is bought, its unit and persistence.

## Why it matters

The spatial shortcut is safe only when it reaches the same command and record as every other
procurement update.

## Approach

Connect the spatial material row to a canonical procurement command and query. Pass stable
requirement or procurement identity plus the entered quantity and unit; let the domain validate
and persist, then replace the row only with the refreshed query result.

## Acceptance criteria

1. A successful edit persists on the canonical Procurement item and survives reload.
2. Neither the Requirement nor presentation state stores a second purchased quantity.
3. The displayed value changes only after the command and authoritative refresh succeed.
4. Reopening the material need outside the editor resolves the same purchased quantity.

## Risks

- A convenient Inspector field could bypass procurement lifecycle rules.
- Optimistically presenting the draft as saved could disagree with a failed write.

## Outcome

A purchased quantity can be updated in spatial context through one procurement authority.
