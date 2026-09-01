---
type: Task
parent: "[[Switch editor perspectives without losing context]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Enter geometry work in the Plan perspective by default

## Evidence

M01 defines Plan as the default perspective for geometry work, while the parent workflow
requires explicit restored perspective state and a safe Select entry.

## Why it matters

Always forcing Plan discards a restored user choice, but restoring an editing tool can resume an
unsafe or stale gesture.

## Approach

Resolve the initial perspective from explicit valid view state when present and otherwise choose
Plan for geometry entry. Initialize the editor in Select independently of the perspective choice.

## Acceptance criteria

- Geometry entry with no explicit perspective opens Plan.
- A valid explicitly restored Plan, Renovate or Review perspective is respected.
- Missing, unavailable or invalid restored perspective falls back to Plan with no active
  creation or editing tool.
- Every initial perspective becomes usable only after Select is active.
- Reopening cannot restore an in-flight gesture or temporary tool.

## Risks

Perspective and tool state may be restored as one value, causing safe fallback in one to erase a
valid choice in the other.

## Outcome

Geometry work starts in the expected Plan perspective without overriding valid restored context
or reviving unsafe tool state.
