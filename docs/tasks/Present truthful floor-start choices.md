---
type: Task
parent: "[[Choose how to start a floor]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Present truthful floor-start choices

## Evidence

M05 defines three ways to start an empty Floor and requires an empty-state selector based on query
results rather than a blank canvas guess.

## Why it matters

A blank drafting surface assumes CAD knowledge; a false empty state can hide unreadable content.

## Approach

Define the ready-state selector for no Rooms and no usable reference, preserving unreadable counts.
Render Add rooms, Upload a floor plan and Start empty with localized descriptions and real control
semantics. Test empty, unreadable, loading and failure states separately.

## Acceptance criteria

- The start state appears only after a successful, genuinely empty read.
- All three choices are real keyboard-reachable controls.
- Unreadable Floor content is not presented as empty.

## Risks

Combining unsupported with empty would give misleading guidance; preserve distinct query outcomes.

## Outcome

An empty Floor teaches three honest ways forward.
