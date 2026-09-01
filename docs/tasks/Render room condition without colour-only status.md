---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Render room condition without colour-only status

## Evidence

M08 requires homeowner-language condition and explicitly refuses traffic-light colour as its only
representation; SDD §85 requires status not encoded only by colour.

## Why it matters

Colour alone is inaccessible and cannot explain what a condition means when printed, themed or
read through a non-canvas route.

## Approach

Render the canonical condition value as text in every Inspector and list projection, with any
colour or mark remaining supplementary and consistent across themes.

## Acceptance criteria

- Every condition state has visible text.
- Canvas and non-canvas projections use the same canonical value.
- Removing colour leaves each state distinguishable.
- Unknown and unreadable condition are not presented as a known traffic-light state.

## Risks

Compact layouts may hide the label and leave only a coloured mark.

## Outcome

Room condition remains understandable without colour perception or canvas access.
