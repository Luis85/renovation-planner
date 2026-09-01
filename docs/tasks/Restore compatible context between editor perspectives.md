---
type: Task
parent: "[[Switch editor perspectives without losing context]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Restore compatible context between editor perspectives

## Evidence

M08–M10 retain room and viewport across semantic navigation, M17 returns to the exact renovation
context, and `PerspectiveSwitch` promises compatible-context preservation.

## Why it matters

A perspective change that loses the floor, room or camera turns comparison into repeated search
and can restore a selection the destination cannot represent.

## Approach

Carry stable floor and room identities plus viewport state through the perspective transition.
Restore each part only when compatible, with explicit safe fallbacks for missing targets or a
different floor.

## Acceptance criteria

- Switching on one floor preserves that floor.
- A room supported by both perspectives remains selected by stable ID.
- A compatible viewport is restored without storing geometry in navigation state.
- Missing or incompatible selection falls back safely while retaining the floor.
- An incompatible viewport frames the preserved floor.

## Risks

Display labels, stale IDs or screen coordinates may be mistaken for durable context.

## Outcome

The renovator changes workflow while remaining oriented to the same compatible spatial subject.
