---
type: Task
parent: "[[Link unresolved decisions to planned spatial state]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Link a planned outcome to a canonical decision

## Evidence

M09 lets a renovator record unresolved decisions from Planned state, while [[Decision]] and
[[Describe existing and planned spatial state]] already own the two canonical endpoints.

## Why it matters

Copying a decision into a planned row would lose its alternatives, reasoning and independent
lifecycle as soon as either side changes.

## Approach

Provide create/select Decision actions from a selected Planned outcome and dispatch one domain
command that validates both stable identities before persisting their relationship. Treat an
existing pair as a no-op and reject incompatible project scope.

## Acceptance criteria

1. Creating or selecting a Decision stores one stable Planned-to-Decision relationship.
2. Repeating the same link creates no duplicate.
3. Renaming either note does not break the relationship.
4. A missing, unreadable or incompatible endpoint causes no partial persistence.

## Risks

- Path-based links would break under an ordinary Obsidian rename.
- Persisting one endpoint before validating the other could leave a one-sided relationship.

## Outcome

A planned spatial outcome can carry one durable link to the canonical decision it awaits.
