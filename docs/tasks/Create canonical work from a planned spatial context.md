---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Create canonical work from a planned spatial context

## Evidence

M10 creates contextual work linked to Room and Planned outcome. The entity authorities require an
ordinary Task for checkbox-sized work, a Work Package for awardable trade scope, and a
Construction Section for a grouped measure.

## Why it matters

Choosing the wrong canonical scope loses either task-tool compatibility or the planning,
budgeting and awarding relationships the larger records own.

## Approach

Offer only available authority-owned creation paths and carry the selected planned-outcome and
spatial-target IDs into the chosen flow. Store references only; leave validation, lifecycle and
persistence to that authority.

## Acceptance criteria

- Each choice dispatches the canonical Task, Construction Section or Work Package workflow.
- A created record links back to the exact outcome and spatial target.
- No created record contains copied geometry.
- If no canonical creation path is available, creation is unavailable and nothing is written.

## Risks

A convenience form may silently flatten three scopes into one generic record.

## Outcome

A renovator can turn an intended result into the right kind of canonical work without retyping
its spatial context.
