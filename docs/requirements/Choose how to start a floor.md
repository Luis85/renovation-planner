---
type: PBI
parent: "[[Spatial creation]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Choose how to start a floor

## Actor

[[Private renovator]] beginning a Floor with incomplete or uneven information.

## Preconditions

- A Floor (`Plan`) exists with no Rooms and no usable reference source.

## Main flow

1. The plugin presents a meaningful start state instead of a blank drafting surface.
2. The renovator chooses Add rooms, Upload a floor plan, or Start empty.
3. The chosen option enters the same canonical flow available elsewhere in the editor.
4. The Floor remains useful even when the renovator chooses not to add precision yet.

## Extensions

- **2a** — Add rooms starts [[Start room creation from Add]].
- **2b** — Upload starts [[Upload an image to be used as background]].
- **2c** — Start empty dismisses guidance and leaves Add available.
- **3a** — The chosen flow cannot start. The start state remains available and reports why.
- **4a** — The Floor later becomes empty again. The start state is selected from query results.

## Guarantee

Every choice is optional and recoverable: no Floor data is invented, and declining setup never
blocks later room, wall or reference creation.

## Out of scope

- Creating the Floor itself.
- Long tutorials or mandatory setup.
- Automatic plan recognition, scanning and CAD import.

## Acceptance criteria

1. The empty Floor offers all three starting choices as keyboard-reachable controls.
2. Each choice routes to an existing canonical action rather than a duplicate implementation.
3. Start empty writes no geometry or reference configuration.
4. A failed option leaves the start choices usable.
5. The state disappears while a creation task is active or useful Floor content exists.

## Assumptions

- “Floor” is the presentation of the current `Plan`, not a new persistence entity in this PBI.
- Empty-state selection is based on loaded data, not on whether canvas pixels happen to render.

## Sources

- [[Renovation Planner — Editor UX Research & Pattern Study]], section 11.
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], section 46.
- [[M05-new-floor-start]], start choices and empty-state contract.
