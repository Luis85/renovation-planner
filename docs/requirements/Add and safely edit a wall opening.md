---
type: PBI
parent: "[[Spatial creation]]"
order: 80
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Add and safely edit a wall opening

## Actor

[[Private renovator]] recording a door, window or other opening in a known Wall.

## Preconditions

- An editable Floor (`Plan`) contains a persisted Wall.
- [[Walls and hosted openings]] has supplied hosted Opening behavior.

## Main flow

1. The renovator chooses an opening type from Add or a selected Wall's contextual actions.
2. The plugin highlights eligible host Walls.
3. The renovator previews the Opening on one Wall and enters or adjusts its dimensions.
4. The renovator confirms placement.
5. The plugin commits one hosted Opening and selects it.
6. The renovator later moves or resizes it within valid host bounds through the same command boundary.
7. Reload restores the Opening on the same Wall.

## Extensions

- **2a** — No eligible Wall exists. Creation is unavailable with an explanation.
- **3a** — The preview leaves the Wall or violates host constraints. Completion is refused.
- **4a** — The renovator cancels. The preview disappears and nothing is written.
- **6a** — A Wall edit would invalidate an Opening. The impact is shown and unsafe orphaning is refused.
- **7a** — Persistence or read-back fails. The prior valid state remains recoverable.

## Guarantee

An Opening is never committed or left as a free-floating object: completed changes preserve its
host relationship and are reversible; drafts and refused edits persist nothing.

## Out of scope

- The Wall/Opening domain and reference-integrity rules owned by the prerequisite.
- Detailed manufacturer products or BIM properties.
- Renovation-state semantics for openings.

## Acceptance criteria

1. Creation requires a valid host Wall.
2. Add-menu and selected-Wall routes invoke one canonical opening action.
3. Placement and later edits are single reversible user actions.
4. Cancel and invalid placement write nothing.
5. Wall changes cannot silently orphan a hosted Opening.
6. Reload and a non-canvas Wall/Opening list preserve and expose the relationship.

## Assumptions

- Door and Window are homeowner-facing opening types supplied by the external prerequisite.
- Exact host rules are referenced, not duplicated, by this use case.

## Sources

- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 24.
- [[Renovation Planner — Editor UX Research & Pattern Study]], hosted door/window patterns.
- [[M07-wall-selected]], hosted-opening and deletion-impact requirements.
