---
type: PBI
parent: "[[Spatial creation]]"
order: 140
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Delete a selected wall safely

## Actor

[[Private renovator]] removing a Wall that no longer belongs on the Floor while protecting
adjacent Rooms, hosted Openings and linked renovation records.

## Preconditions

- An editable Floor (`Plan`) contains a selected Wall supplied by
  [[Walls and hosted openings]].
- The Wall is reachable from the canvas and from a non-canvas Wall list or form.
- The plugin can determine the Wall's current geometric and referential impact.

## Main flow

1. The renovator invokes the non-primary More → Delete action, or presses Delete or Backspace
   while focus is not in an editable field.
2. The plugin determines every affected adjacent Room, hosted Opening and linked reference.
3. A confirmation names the Wall and explicitly lists those affected Rooms, Openings and
   references.
4. The renovator confirms the permitted deletion.
5. One canonical command validates the current impact and atomically deletes the Wall and every
   approved dependent effect.
6. The Floor returns to a safe selection state with no orphaned geometry or references.
7. One Undo restores the complete Wall and its resolved relationships; reload preserves the
   state most recently committed.

## Extensions

- **1a** — Focus is in an input, textarea or editable field. Delete or Backspace edits that
  field and never starts Wall deletion.
- **1b** — The renovator starts from the non-canvas Wall route. It invokes the same impact query
  and canonical delete command.
- **2a** — The Wall cannot be deleted without invalidating an adjacent Room, hosted Opening or
  protected reference. Deletion is refused and the Wall remains selected.
- **3a** — The renovator cancels confirmation. Nothing is written and focus returns meaningfully.
- **4a** — An affected entity or reference changes after confirmation was prepared. The command
  refuses stale consent and requires a fresh impact review.
- **5a** — A write or compensation fails. The failure is surfaced and recovery prevents a
  silently partial deletion.

## Guarantee

Wall deletion either removes the Wall and every approved dependent effect through one atomic,
recoverable command, or preserves the complete pre-deletion Wall, Room, Opening and reference
state.

## Out of scope

- Deleting a Room or Opening as the selected primary object.
- Bulk deletion of several selected Walls.
- Automatically deleting protected linked records without explicit consent.
- Defining Wall identity, topology, persistence or hosted-Opening rules owned by the prerequisite.

## Acceptance criteria

1. Delete and Backspace cannot trigger Wall deletion while focus is in an editable field.
2. Delete is non-primary and is available through More, keyboard and a non-canvas Wall route.
3. Confirmation names the Wall and explicitly lists every affected Room, hosted Opening and
   linked reference.
4. Invalid geometry, unresolved impact or changed referents refuse deletion without writing.
5. One canonical command commits the Wall and approved dependent effects atomically and creates
   one undo entry.
6. One Undo restores the complete pre-delete state, redo removes it once, and reload reproduces
   the committed result without orphaned relationships.

## Assumptions

- Wall, Opening and adjacent-Room invariants remain owned by
  [[Walls and hosted openings]] and the accepted spatial-object ADR.
- Existing reference-integrity and compensated-sequence mechanisms remain authoritative.
- Canvas, keyboard, Inspector and non-canvas routes delegate to one deletion use case rather than
  implementing separate policies.

## Sources

- [[M07-wall-selected]], non-primary More → Delete and affected Room, Opening and reference
  confirmation.
- [[M00-kitchen-selected-overview]], field-focus guard and reversible selected-object deletion.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 49, 51, 52,
  56, 63 and 65.
- [Editor component library](../user-experience/renovation-planner-editor-specs/components/component-library.md),
  shared action, Inspector, impact-confirmation and non-canvas contracts.
- [[Walls and hosted openings]], canonical Wall identity, hosted Opening and persistence
  prerequisites.
