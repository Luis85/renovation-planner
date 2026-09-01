---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 40
status: New
horizon: "V1"
release: ""
---

# Navigate between evidence pins and records

## Evidence

M14 requires bidirectional selection between numbered pins and evidence items. The component
library requires every marker layer to have a list equivalent and stable labels within its view
context.

## Why it matters

A pin without a corresponding accessible record is unusable without the canvas, while a record
without spatial focus loses the reason the plan is involved.

## Approach

Project point-specific evidence as numbered markers derived from the current filtered read model.
Connect marker and list selection through shared evidence selection state and focus/reveal actions;
use relationship ids, never displayed numbers, as identity.

## Acceptance criteria

1. Selecting a visible pin selects and focuses the matching evidence row.
2. Selecting a row focuses its pin or broader spatial target.
3. Keyboard users can reach every pinned item through the list.
4. Changing filters derives a stable numbering for the new context without persisting numbers.
5. Missing files retain their marker/list relationship and display a labelled fallback.

## Risks

- Persisted marker numbers would become stale when filtering or adding evidence.
- Canvas focus and DOM focus could compete and obscure the selected item.

## Outcome

Spatial evidence is equally navigable from the plan and from its accessible records.
