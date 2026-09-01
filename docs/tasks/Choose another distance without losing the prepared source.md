---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Choose another distance without losing the prepared source

## Evidence

M06 requires `Choose another distance` to clear the calibration draft while retaining the prepared source.

## Why it matters

A poor measurement pair should be cheap to replace without repeating file selection, page choice, crop or rotation.

## Approach

Separate calibration endpoints and known length from prepared-source draft state. Reset only the calibration step,
restore its focus and allow a new pair while preserving every completed preparation choice.

## Acceptance criteria

- Choosing another distance clears endpoints, entered length and derived scale only.
- Source, PDF page, crop and rotation remain unchanged and uncommitted.
- A new valid distance advances to review through the same calibration path.
- Cancel still restores the previously committed reference.

## Risks

A broad setup reset can silently discard expensive preparation work.

## Outcome

The renovator can retry scale measurement without preparing the reference again.
