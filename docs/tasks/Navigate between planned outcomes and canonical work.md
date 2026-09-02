---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Navigate between planned outcomes and canonical work

## Evidence

M09 opens required work for one Planned item; M10's **Creates planned** link returns to that
outcome and its marker/list selection is bidirectional.

## Why it matters

Links that work in only one direction force the renovator to search for the context they just
left and obscure whether a task actually produces the intended result.

## Approach

Deliver navigation in both directions using stable planned, work and spatial IDs. Preserve
compatible room selection and viewport, and route broader schedule requests to the existing
authority-owned view.

## Acceptance criteria

- Planned-to-work navigation highlights the linked canonical record.
- Work-to-planned navigation focuses the linked intended outcome.
- Returning restores compatible room and viewport context.
- A missing target produces an explicit current-state screen and a route back.

## Risks

Display-order marker numbers or filenames may be mistaken for persistent navigation identity.

## Outcome

A renovator can trace intended result and required work in either direction without losing the
room.
