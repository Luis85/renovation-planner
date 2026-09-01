---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Deliver rectangular room creation end to end

## Evidence

M03 requires drag, exact dimensions, type, name and calculated area to converge on one Room
creation; VS-04 maps that Room to the existing Zone model.

## Why it matters

The beginner path is useful only when one interaction reaches real domain validation and storage,
not a presentation-only rectangle.

## Approach

Build the draft overlay and form over a Room-oriented application command backed by the current
Zone creation boundary. Keep draft state local, derive area from geometry, and dispatch once at
confirmation. Cover domain, command, store and component behavior.

## Acceptance criteria

- Drag and numeric input produce equivalent command geometry.
- Name/type and geometry share one stable identity.
- Confirm creates one logical Room and selects it.

## Risks

Presentation adapters may duplicate Zone validation; delegate rather than reimplement it.

## Outcome

A homeowner can create and name a real rectangular Room in one guided flow.
