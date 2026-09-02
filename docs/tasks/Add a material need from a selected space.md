---
type: Task
parent: "[[Manage materials from spatial context]]"
order: 30
status: New
horizon: "V1"
release: ""
---

# Add a material need from a selected space

## Evidence

M12 requires adding a manual or calculated requirement linked to Room or Work. The shared component
contract requires every input to converge on one command path and keeps commands outside
presentational components.

## Why it matters

Prefilling the selected context removes repetitive linking while retaining the same authoritative
command and validation used outside the editor.

## Approach

Provide a contextual add/link form that receives the selected spatial id, searches the existing
asset catalogue and dispatches the canonical requirement command. Refresh the displayed rows from
the query after success; retain the draft after a refusal.

## Acceptance criteria

1. Opening the form from a selected space prefills that space and does not create a requirement.
2. Submitting dispatches one canonical command with the selected spatial id and chosen asset or
   manual description.
3. A refusal keeps the draft and shows the routed field or form error.
4. Success is visible only after the authoritative query returns the new relationship.

## Risks

- A selection change while the form is open could attach the need to the wrong space.
- A catalogue shortcut could accidentally copy an asset definition into project data.

## Outcome

A renovator can add a material need in context without creating an Inspector-owned material model.
