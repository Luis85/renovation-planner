---
type: Task
parent: "[[Delete a selected wall safely]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Explain selected Wall deletion impact before consent

## Evidence

M07 requires destructive confirmation to describe affected Rooms, hosted Openings and references,
and the interaction contract requires destructive actions to communicate consequences.

## Why it matters

Consent to delete a Wall is not informed when the dialog hides which adjacent geometry and linked
records will change or become invalid.

## Approach

Query the current impact by stable identity, group the result into affected Rooms, Openings and
references, and render every group in the shared impact confirmation. Refuse confirmation when a
protected effect has no supported resolution; cancellation writes nothing.

## Acceptance criteria

- Confirmation names the selected Wall.
- Affected Rooms, hosted Openings and linked references are explicitly listed in separate,
  understandable groups.
- Empty groups are represented truthfully without implying that the query failed.
- Unsupported or protected effects disable confirmation and explain the refusal.
- Cancel returns focus meaningfully and writes nothing.

## Risks

An impact list is stale as soon as it is shown; it informs consent but cannot replace command-time
validation.

## Outcome

The renovator sees the complete current consequence of Wall deletion before deciding.
