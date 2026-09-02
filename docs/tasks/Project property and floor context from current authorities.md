---
type: Task
parent: "[[Navigate property, building and floor context in the editor]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Project property and floor context from current authorities

## Evidence

M00 and M01 require Property → Building → Floor context, while [[Project]] already owns
[[Plan]] records and consolidation explicitly refuses premature hierarchy persistence.

## Why it matters

Navigation cannot be truthful if presentation invents durable entities or becomes a second
authority for the current project and plan.

## Approach

Build a capability-aware navigation read model from the selected Project and readable Plans.
Represent missing persisted hierarchy as explicit presentation grouping, retain stable Plan IDs,
and carry unreadable floors separately from an empty valid result.

## Acceptance criteria

- Every displayed floor retains its canonical Plan ID and owning Project ID.
- No Property, Building or Floor note or schema is introduced by this task.
- Missing persisted Building identity is represented explicitly rather than fabricated as domain
  data.
- Readable floors remain available beside an additive unreadable count or refusal.

## Risks

A convenient tree DTO can silently become a competing hierarchy model or flatten unreadable
Plans into absence.

## Outcome

The editor can present truthful property context without changing current Project or Plan
authority.
