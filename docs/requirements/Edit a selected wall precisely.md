---
type: PBI
parent: "[[Spatial creation]]"
order: 130
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Edit a selected wall precisely

## Actor

[[Private renovator]] correcting a Wall length while keeping the surrounding Floor coherent.

## Preconditions

- An editable Floor (`Plan`) contains a selected Wall supplied by [[Walls and hosted openings]].
- Adjacent Rooms and hosted Openings can be queried before a geometry change.

## Main flow

1. The renovator starts Wall editing from its canvas selection or a non-canvas Wall list or form.
2. The renovator chooses the displayed length and enters an exact value.
3. The plugin previews the changed Wall and every affected adjacent geometry without writing.
4. The preview explains the effect on hosted Openings and adjacent Rooms.
5. The renovator confirms a valid result.
6. The plugin commits the Wall and approved related geometry through one reversible command path.
7. Reload restores the precise Wall length, hosted Openings and adjacent-room relationships.

## Extensions

- **2a** — The exact length is invalid or cannot produce valid Wall geometry. The draft remains and completion is refused.
- **3a** — Moving an endpoint would make an adjacent Room invalid. The preview identifies the conflict and confirmation is unavailable.
- **4a** — A hosted Opening cannot remain valid on the edited Wall. The flow requires an explicit supported resolution or refuses the edit.
- **5a** — The renovator cancels. No Wall, Opening or Room geometry is written.
- **6a** — A related entity changes before commit or a write fails. The command refuses stale input or compensates partial effects.

## Guarantee

The selected Wall either receives one valid, reloadable precise edit with hosted Openings and adjacent
Rooms kept coherent, or every involved entity retains its complete pre-edit state.

## Out of scope

- Creating Walls, Rooms or Openings.
- Changing Wall construction, finish or renovation state.
- Deleting a Wall.

## Acceptance criteria

1. Canvas and non-canvas routes edit the same Wall through one reversible command path.
2. Exact length input produces a before-commit preview of all affected geometry.
3. Hosted Openings and adjacent Rooms are preserved, explicitly resolved or cause refusal; none are silently orphaned.
4. Cancel, invalid input and stale related data write nothing.
5. Undo restores every affected entity, redo reapplies the edit once, and reload preserves the committed relationships.
6. The workflow uses Wall contracts from [[Walls and hosted openings]] rather than redefining them.

## Assumptions

- The prerequisite owns Wall identity, topology, persistence and Opening-host invariants.
- Precise length editing may move connected geometry only when the preview and command validate the complete result.

## Sources

- [[M07-wall-selected]], exact length, affected-geometry preview and non-canvas Wall access.
- [[M00-kitchen-selected-overview]], selection-first reversible geometry editing.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], precise editing and spatial integrity.
