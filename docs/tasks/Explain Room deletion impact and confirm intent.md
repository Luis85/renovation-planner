---
type: Task
parent: "[[Delete a room safely from spatial context]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Explain Room deletion impact and confirm intent

## Evidence

M00 requires confirmation, while the Room can already anchor requirements and linked renovation records.

## Why it matters

Consent is meaningful only when it identifies the Room and the current consequences of removing it.

## Approach

Query referential impact before confirmation, group affected records in homeowner language, and pass
the exact reviewed referent set into the command. Re-query once when the set changes.

## Acceptance criteria

- Confirmation names the selected Room and affected record groups.
- Cancel writes nothing and restores focus.
- Changed referents invalidate stale consent and produce one refreshed confirmation.
- Protected impacts that cannot be resolved refuse deletion.

## Risks

A pre-confirmation read is stale by construction; the command must enforce the reviewed set.

## Outcome

The renovator confirms Room deletion against truthful, current consequences.
