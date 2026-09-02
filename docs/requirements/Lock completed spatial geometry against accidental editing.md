---
type: PBI
parent: "[[Spatial creation]]"
order: 150
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Lock completed spatial geometry against accidental editing

## Actor

[[Private renovator]] protecting finished Room, Wall or selected-group geometry while continuing
to inspect and plan from it.

## Preconditions

- An editable Floor contains completed Room or Wall geometry, or a completed selected group.
- An accepted ADR assigns spatial lock state to exactly one authority: editor/workspace state or
  canonical persisted state.
- The selected entity or group is reachable through a non-canvas list or Inspector route.

## Main flow

1. The renovator selects a finished Room, Wall or completed group.
2. The selection and Inspector visibly identify whether the geometry is locked.
3. The renovator locks it through a non-canvas control that writes to the authority chosen by the
   accepted ADR.
4. The geometry remains visible, selectable and inspectable.
5. Pointer manipulation, keyboard edits and Inspector geometry commits are refused while locked,
   without changing geometry.
6. The renovator deliberately unlocks it through the non-canvas route.
7. Editing becomes available again, with history and reload behavior following the accepted
   state authority.

## Extensions

- **1a** — The selection includes unfinished draft geometry. Lock is unavailable because drafts
  remain temporary editor state.
- **3a** — No accepted ADR assigns lock authority. Implementation is blocked; no component
  persists or invents lock state locally.
- **3b** — The accepted ADR chooses editor/workspace state. Lock and unlock do not create
  canonical geometry-history entries or claim to survive a vault reload; any workspace-state
  restoration follows that ADR.
- **3c** — The accepted ADR chooses canonical state. Lock and unlock are reversible canonical
  commands, each one user intent, and the committed lock survives reload.
- **5a** — A pointer drag, keyboard dimension edit or Inspector commit is attempted while locked.
  The shared mutation boundary refuses it and preserves selection for inspection.
- **6a** — Canvas interaction is unavailable or too narrow. The list or Inspector route still
  exposes the lock state and deliberate unlock.
- **7a** — A lock or unlock write fails under a canonical-state decision. The prior lock and
  geometry state remain authoritative and the failure is surfaced.

## Guarantee

A locked completed Room, Wall or selected group remains visible, selectable and inspectable but
cannot be geometrically manipulated through pointer, keyboard or Inspector routes. Lock authority,
undo and persistence behavior come only from the accepted ADR.

## Out of scope

- Reference-plan locking, owned by [[Plans and background import]].
- Locking unfinished creation drafts.
- Permissions, collaboration or security access control.
- Hiding locked geometry or making it unselectable.

## Acceptance criteria

1. Finished Rooms, Walls and completed selected groups can be locked; the capability is not
   limited to the Reference plan layer.
2. Canvas selection and Inspector or list rows visibly communicate lock state without color
   alone.
3. Locked geometry remains selectable and inspectable.
4. Pointer transforms, keyboard geometry edits and Inspector geometry commits all refuse at a
   shared mutation boundary and write nothing.
5. A keyboard-accessible non-canvas route can lock and deliberately unlock the selection.
6. Under an editor/workspace-state ADR, lock changes create no canonical history entry and make
   no reload-persistence claim; under a canonical-state ADR, each lock change is one reversible
   command and survives reload.
7. No implementation stores lock state in a component, shape or repository contrary to the
   accepted ADR.

## Assumptions

- The accepted spatial-object and editor-state ADRs are authoritative even if their decision
  changes the cheaper implementation.
- Lock is accidental-edit protection, not authorization; read access and selection remain
  available.
- Every geometry mutation route already converges, or is changed to converge, on a boundary that
  can enforce the lock.

## Sources

- [[M00-kitchen-selected-overview]], selected Room manipulation, field-focus behavior and
  non-canvas selection.
- [[M07-wall-selected]], Wall inspection, editing and non-canvas access.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 13, 49, 50,
  56, 63 and 81.
- [Editor component library](../user-experience/renovation-planner-editor-specs/components/component-library.md),
  `SelectionOverlay`, `LayerList`, Inspector, non-canvas action and component-state contracts.
- [[Consolidate the current and target editor data models]] and
  [[Record remaining editor model and routing ADRs]], existing model and routing decision work
  against which spatial lock authority must be recorded without duplication.
