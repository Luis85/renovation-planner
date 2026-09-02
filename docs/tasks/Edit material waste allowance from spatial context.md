---
type: Task
parent: "[[Manage materials from spatial context]]"
order: 50
status: New
horizon: "V1"
release: ""
---

# Edit material waste allowance from spatial context

## Evidence

M12 requires waste editing to recalculate derived need and preview cost impact. The Requirement
and quantity pipeline own waste as a separate factor, and the cost authority owns the resulting
money.

## Why it matters

A contextual edit is valuable only if it shows the consequence before commit and cannot leave the
Inspector displaying a value that the quantity or cost authorities rejected.

## Approach

Add a waste-allowance field for the selected material need that requests authoritative quantity
and cost previews, then dispatches the canonical Requirement command on commit. Keep the draft and
previous authoritative row when preview, command or refresh fails.

## Acceptance criteria

1. Editing waste requests updated needed quantity and cost impact from their authorities.
2. The preview identifies old and proposed quantity and cost without persisting either.
3. Commit dispatches the canonical waste command and refreshes the row from a query.
4. Invalid input, preview failure, command refusal and failed refresh each retain truthful prior
   data and provide a corrective surface.
5. No waste, quantity or money arithmetic is implemented in presentation.

## Risks

- A preview calculated through a different path could disagree with the committed result.
- Replacing prior data on failed refresh could present an unsaved draft as authoritative.

## Outcome

A renovator can change waste in spatial context with authoritative quantity and cost consequences
visible before commit.
