---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 20
status: Done
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

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 0c51dcc3 (#85, `codex/reference-plan-workflow`,
ADR-0019).

Criterion 1 — **calibration delegates arithmetic and validity to Scale calibration** — is
`deriveCalibration` in `src/domain/plan/Calibration.ts` being the ONE derivation the consent
preview (`setupMeasurement`) and `ConfigurePlanReference` share.
`tests/presentation/editor/referenceSetup.test.ts` drives it: 'shares image/PDF raster density
(%s) and recalibration math', 'rejects a nonrepresentable known distance %s', 'rejects coincident
points and illegal crop/appearance while accepting exact boundaries'. A review finding lived in
that shared line: reopening a 15° reference reconstructed source points through inverse
trigonometry and produced a `scaleCorrection` of `1.0000000000000002`, so the exact comparison
demanded rescale consent for an unchanged calibration and then applied that correction to every
room. 8c864153 snaps a ratio within eight machine epsilons of one to exactly one, in the
derivation and therefore for both callers; 'keeps an unchanged rotated calibration exact (%s
degrees)' read `1.0000000000000002` at 15° before it — the 45°, −15° and −45° arms happened to
round exactly on this platform and passed either way, so the 15° arm is the one carrying the
regression.

Criterion 2 — **invalid calibration leaves setup editable and uncommitted** — is
`tests/presentation/editor/referenceWorkflow.e2e.test.ts`'s 'retains invalid source, crop and
scale input, and accepts corrections' and 'withdraws the scale review after its source changes and
refuses to persist an invalid preview'.

Criterion 3 — **Finish writes one complete reference configuration** — is
`tests/application/commands/plan/configurePlanReference.test.ts`'s 'commits one coherent
configuration, publishes in both directions, and reloads through a fresh stack' and the e2e's
'prepares, measures and commits $source, then Undo/Redo and reconfiguration preserve it' for PNG
and PDF. Over a populated floor the write is a whole-plan rescale and asks first: 'requires
explicit acknowledgement before rescaling existing geometry'.

Criterion 4 — **Cancel restores the prior reference and creates no history entry** — is
'preserves the committed reference when replacement is cancelled, including page changes and
another distance' (the vault's entries compare equal before and after) and
`configurePlanReference.test.ts`'s 'does not write before confirmation and makes repeated
execute/undo no-ops'.

Two more review findings on #85 belong to this criterion set and are on the branch. The form
converted source points with the calibration `loadPlan` had read while the command derived against
a LATER sidecar read, so a calibration written between the two awaits — or, past a first
calibration, an undo restoring `calibration: null` — persisted a scale that did not match the
picked points: 38ae64f7 and 6521d79d read one calibration for both halves, with
`Plan.withCalibration(null)` clearing ('reads one calibration for both halves of the baseline, so
the form converts with what the command derives from' and 'clears the entity calibration when the
snapshot read after the plan is uncalibrated', both red before; 38ae64f7's own "no command removes
a calibration" was false and is corrected in 6521d79d). And the rescale's `ZoneGeometryChanged`
fan-out was a `Promise.all` over every object, which at forty rooms and four writes per
recalculation is roughly 160 concurrent writes: 63673ab7 publishes sequentially, as
`ReversibleCalibratePlan.announce` already did, and 'bounds Zone recalculation cascades in execute,
Undo and Redo' measured a peak of 3 in-flight subscribers before it and 1 after.
