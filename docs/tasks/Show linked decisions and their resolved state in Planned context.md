---
type: Task
parent: "[[Link unresolved decisions to planned spatial state]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Show linked decisions and their resolved state in Planned context

## Evidence

M09 requires Decision records and resolved state beside Planned details, and all Planned items
must remain reachable through an Inspector or list path.

## Why it matters

A renovator cannot tell whether an intended outcome is actionable if its unresolved choices are
hidden in unrelated notes or represented by stale copied status.

## Approach

Add a Planned-scoped decision query returning canonical Decision identities, labels and resolved
state. Render the result beside the selected outcome and support navigation in both directions,
refreshing when the Decision changes.

## Acceptance criteria

1. A Planned outcome lists every linked Decision with current resolved-state text.
2. Resolving a Decision changes the next query result without rewriting the Planned record.
3. The Decision can be opened from the Planned list and the Planned target reached from the
   Decision through a non-canvas route.
4. A failed query is distinct from an authoritative empty list.

## Risks

- Copying resolved state into the relationship would create a stale second authority.
- Canvas-only navigation would make the relationship inaccessible to keyboard and list users.

## Outcome

Planned context truthfully shows which linked decisions remain unresolved and where to open them.
