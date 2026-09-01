---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Calibrate and confirm a prepared reference

## Evidence

M06 moves calibration into Reference setup: two selected points, a known distance, scale preview
and final review.

## Why it matters

Preparation becomes useful for accurate tracing only when the source-to-world transform is explicit
and reviewable.

## Approach

Compose the existing [[Scale calibration]] command and known-distance UI into the setup stepper.
Keep endpoints and entered distance as draft state, show the derived scale, then commit source and
configuration once at Finish. Test units, invalid input, cancellation and persistence failure.

## Acceptance criteria

- Calibration delegates all arithmetic and validity rules to [[Scale calibration]].
- Invalid calibration leaves setup editable and uncommitted.
- Finish writes one complete reference configuration.
- Cancel restores the prior reference and creates no history entry.

## Risks

Reimplementing scale math in presentation would create two calibration truths.

## Outcome

A prepared source becomes an accurately scaled Reference plan through one reviewed commit.
