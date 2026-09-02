---
type: PBI
parent: "[[Spatial creation]]"
order: 90
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Plans and background import

## Actor

[[Private renovator]] managing a source drawing as a reference while creating Floor geometry.

## Preconditions

- A Floor (`Plan`) is open.
- A supported source has been prepared and, when dimensional accuracy is claimed, calibrated.

## Main flow

1. The plugin presents the source as a Reference plan, separate from editable Rooms and Walls.
2. The renovator shows or hides the reference layer.
3. The renovator adjusts opacity to compare source and created geometry.
4. The renovator locks the reference against accidental placement changes.
5. The renovator can re-enter setup to recalibrate, replace or remove the source.
6. Reload restores the committed source link, preparation, visibility, opacity, lock and scale state.

## Extensions

- **1a** — The source is missing or unreadable. The Floor remains usable and the reference reports its state.
- **4a** — Unlock is requested. The plugin communicates the consequence before allowing placement edits.
- **5a** — Reconfiguration is cancelled. The previous committed reference remains unchanged.
- **5b** — Replace or remove fails. The last valid committed reference remains recoverable.

## Guarantee

Reference management never turns source pixels into editable project geometry or silently claims
accuracy; completed configuration is reloadable and reversible, while cancelled drafts preserve
the prior reference.

## Out of scope

- File acquisition and preparation, owned by [[Upload an image to be used as background]].
- Calibration mathematics, owned by [[Scale calibration]].
- Automatic tracing, OCR, CAD import and source recognition.

## Acceptance criteria

1. The source is visibly identified as Reference plan and is separate from Rooms/Walls.
2. Visibility changes only presentation; removal is an explicit reversible action.
3. Completed references default to visible and locked.
4. Opacity, lock, placement and scale-related configuration survive reload.
5. Missing/unreadable source state does not hide or corrupt editable Floor geometry.
6. Reconfigure, replace and remove are keyboard reachable outside the canvas.

## Assumptions

- A Floor is presented by the current `Plan`.
- The existing background reference remains the persistence anchor; this PBI manages its layer lifecycle.

## Sources

- PRD §13 and §42 (plans and background sources).
- [[Renovation Planner — Editor Interaction & Mental Model Specification]], sections 25–27.
- [[M06-reference-plan-setup]], review and committed reference controls.
