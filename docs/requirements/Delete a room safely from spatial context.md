---
type: PBI
parent: "[[Spatial creation]]"
order: 120
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Delete a room safely from spatial context

## Actor

[[Private renovator]] removing a Room that is no longer part of the Floor while protecting linked renovation data.

## Preconditions

- An editable Floor (`Plan`) contains a selected Room (`Zone`).
- The plugin can determine the Room's referential impact before deletion.

## Main flow

1. The renovator invokes Delete from the Room's spatial actions or presses Delete or Backspace while focus is not in a field.
2. The plugin determines which geometry, requirements and linked records would be affected.
3. A confirmation identifies the Room and explains the referential impact and available resolution.
4. The renovator confirms the permitted deletion.
5. The plugin deletes the Room and approved dependent effects atomically as one reversible action.
6. The Floor returns to a safe selection state without showing orphaned references.
7. Undo restores the complete Room and its resolved relationships; reload preserves whichever state was committed.

## Extensions

- **1a** — Focus is in an input, textarea or editable field. Delete or Backspace edits that field and never starts Room deletion.
- **2a** — Protected references cannot be resolved by this flow. Deletion is refused and the Room remains selected.
- **3a** — The renovator cancels confirmation. Nothing is written and focus returns meaningfully.
- **4a** — Referents changed after the impact query. The command refuses stale consent and asks again from current data.
- **5a** — A write or compensation fails. The failure is surfaced and recovery prevents a silently partial deletion.

## Guarantee

A deletion either removes the Room and every approved dependent effect as one recoverable action,
or preserves the complete pre-deletion spatial and referential state.

## Out of scope

- Deleting a Wall or Opening.
- Bulk deletion of several spatial entities.
- Automatically deleting protected linked records without explicit consent.

## Acceptance criteria

1. Delete and Backspace cannot trigger Room deletion while focus is in an editable field.
2. Confirmation names the Room and truthfully describes current referential impact.
3. Changed or unresolved references refuse deletion rather than using stale consent.
4. The delete and approved dependent changes commit atomically through one reversible command.
5. Undo restores the complete pre-delete state and redo removes it once.
6. Reload after delete or undo reproduces the committed result with no orphaned references.

## Assumptions

- Existing reference-integrity and compensated-sequence mechanisms remain authoritative.
- The non-canvas Room route exposes the same destructive action rather than a second deletion implementation.

## Sources

- [[M00-kitchen-selected-overview]], field-focus guard and selected-Room deletion behavior.
- PRD §64, safe deletion and referential integrity.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], selection and destructive-action rules.
