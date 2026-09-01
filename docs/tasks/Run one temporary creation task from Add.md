---
type: Task
parent: "[[Start one creation task from Add]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Run one temporary creation task from Add

## Evidence

The [component library creation contract](../user-experience/renovation-planner-editor-specs/components/component-library.md) and M02 require one activation path, temporary task state and return to Select by default.

## Why it matters

Parallel activation paths create duplicate writes and leave the editor stuck in a creation mode.

## Approach

Bind each enabled catalogue entry to one task-manager activation, pass selected context once, centralize finish/cancel precedence and retire task state after one completion.

## Acceptance criteria

- One menu activation starts exactly one task.
- Current context is passed without creating a second command path.
- Cancel writes nothing and returns to Select.
- Success returns to Select unless repeat was explicitly chosen.
- Refusal retires unsafe draft state and preserves the last valid projection.

## Risks

Repeated pointer or keyboard activation can race before the menu closes.

## Outcome

Add hands control to one bounded creation task and reliably returns the editor to safety.
