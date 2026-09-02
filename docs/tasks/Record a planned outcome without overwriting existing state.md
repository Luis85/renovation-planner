---
type: Task
parent: "[[Describe existing and planned spatial state]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Record an existing spatial state]]"
---

# Record a planned outcome without overwriting existing state

## Evidence

M09 requires an intended outcome that can refer to an Existing source while leaving that source
unchanged; the current model has no separate Planned record.

## Why it matters

A renovation cannot compare present and intended conditions if saving the latter destroys the
former.

## Approach

Add the accepted Planned record and optional Existing-source relationship, support added outcomes
without a source, and prove the write path leaves Existing bytes unchanged.

## Acceptance criteria

- Saving Planned leaves its Existing source byte-identical.
- Planned and Existing share a spatial target without copying its geometry.
- An added outcome is valid without an Existing source.
- Missing source references are reported and never invented.

## Risks

Making the source mandatory would prevent genuinely new work; making it unvalidated would create
dangling relationships.

## Outcome

Not started.
