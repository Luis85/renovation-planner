---
type: Task
parent: "[[Choose how to start a floor]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Route each floor-start choice canonically

## Evidence

M05 states that each choice enters the same command or tool path available elsewhere in the editor.

## Why it matters

Empty-state shortcuts become permanent alternate implementations unless routing is shared.

## Approach

Bind Add rooms to canonical Room activation, Upload to canonical reference setup and Start empty
to presentation state only. Reuse their availability and error outcomes. Test each choice by
observing the canonical action rather than comparing downstream effects.

## Acceptance criteria

- Add rooms and Upload invoke their canonical action exactly once.
- Start empty performs no domain or persistence write.
- Unavailable actions explain why and leave choices usable.

## Risks

Persisting “dismissed” without a product requirement would create hidden state; keep it local.

## Outcome

Floor onboarding guides users without creating duplicate creation paths.
