---
type: PBI
parent: "[[Spatial creation]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Walls and hosted openings]]"
  - "[[Grid and snapping]]"
---

# Draw connected walls and create an enclosed room

## Actor

[[Private renovator]] tracing or entering a precise, irregular floor layout.

## Preconditions

- An editable Floor (`Plan`) is open.
- [[Walls and hosted openings]] has supplied the Wall model and persistence boundary.

## Main flow

1. The renovator chooses Add → Wall.
2. The renovator places connected wall endpoints while seeing length, angle and snap feedback.
3. The renovator may enter an exact current-segment length or undo the latest draft point.
4. The chain closes around an enclosed area.
5. The plugin offers to create a Room (`Zone`) from the enclosed boundary.
6. The renovator finishes, committing the Walls and accepted Room as one reversible transaction.
7. Reload restores the connected Walls, hosted relationships and Room identity.

## Extensions

- **3a** — A segment is invalid. It remains a draft and completion is refused.
- **4a** — No enclosure exists. Valid Walls may finish without creating a Room.
- **5a** — The renovator declines Room creation. Only the Walls are committed.
- **6a** — Escape cancels the uncommitted chain; a write failure recovers partial effects.

## Guarantee

Draft segments never become persisted Walls; a finished chain commits its chosen result atomically
and reversibly without inventing or duplicating Wall-domain rules.

## Out of scope

- Defining Wall identity, topology or persistence, owned by the prerequisite.
- Automatic plan-image recognition.
- Renovation Existing/Planned state for Walls.

## Acceptance criteria

1. Draft Wall points and segments survive local undo but no reload.
2. Exact-length and pointer routes update one shared draft.
3. Enclosure detection offers, but does not force, Room creation.
4. Accepted Walls and Room undo/redo as one completed intent.
5. Cancel and failed commit leave no partial Wall or Room records.
6. Reload and a non-canvas Wall list expose the committed result.

## Assumptions

- Wall and Opening invariants come only from [[Walls and hosted openings]].
- The derived Room uses the same Plan-as-Floor and Zone-as-Room mapping as room-first creation.

## Sources

- [[Renovation Planner — Editor UX Research & Pattern Study]], wall-first creation.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 18.
- [[M04-draw-walls]], connected-wall interaction and room detection.
