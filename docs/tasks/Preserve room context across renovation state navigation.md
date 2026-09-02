---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Preserve room context across renovation state navigation

## Evidence

M08, M09 and M10 require Existing, Planned and Work navigation to retain the selected room and
viewport.

## Why it matters

Losing context between the three questions forces the renovator to relocate the room before they
can compare observation, intention and work.

## Approach

Carry stable room identity, compatible focused detail and viewport through Existing, Planned and
Work navigation, with safe fallbacks when a destination cannot represent the focused detail.

## Acceptance criteria

- Existing, Planned and Work retain the same available room identity.
- A compatible focused record and viewport are restored.
- An incompatible detail falls back to the room without clearing it.
- A missing room produces an explicit state rather than selecting another room.

## Risks

Navigation may preserve a display row or marker number instead of the canonical identity.

## Outcome

The renovator can move among current state, intended state and work without losing the room.
