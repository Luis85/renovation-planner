# Preserve evidence phase during selection — 2026-09-07

The actual four-scenario planning capture on UI `a59a0ec3` completed its earlier
assertions, but pixel inspection rejected the M14 state: selecting a During photo
cleared the phase and exposed a seventh Before photo. The extra card and pin also
changed the Inspector scroll position and room-caption clearance. No visual pass
is claimed from that run. UI archived the initial images in its own gallery report.

## Native proof and correction

`evidencePhaseSelection.test.ts` uses an actual saved three-photo register with
dates and pins. Gallery, pin and selected metadata-row activation each failed with
`evidencePhase === ''` instead of `during`; the explicit outside-phase arrival
already passed. RED: three failed, one passed, 13.96 seconds.

`createRenovationActions.focus` now delegates the phase decision to `revealEvidence`.
That decision reads the same retained planning baseline used by gallery and pins.
Selecting an item inside the active phase preserves the filter and numbering;
explicitly navigating to an item outside it clears the filter so the destination
remains visible. Generic source navigation retains its existing behavior. The
gallery does not reset the filter after selection to manufacture a matching image.

The initial inline lookup exceeded ESLint's function complexity ceiling (18/16).
The named phase update separates this navigation responsibility from spatial focus;
no limit or assertion was changed.

## Verification

- Native phase/date/Work/shared-evidence/planning suite: **42/42 tests, five files,
  34.22 seconds**.
- Final phase cases after the helper extraction: **4/4, 13.22 seconds**. Same
  phase/number/selection/unchanged-vault assertions and outside-phase arrival.
- Type checking, whole Oxlint, scoped ESLint including all new composition tests:
  passed.
- Fallow static scan: zero dead-code issues and clone groups. No cognitive or
  cyclomatic violations.
- Health still exits 1 against the old full coverage input: three **estimated**
  CRAP findings in `perspective`, `focus` and `change`, whose source positions shifted.
  This is not a fresh coverage measurement. Re-evaluate with the next full CI
  artifact before claiming the complete health gate passed.
- Four-platform CI on earlier `95e7510b`: 647 files/8058 tests pass on each leg;
  statements 98.98% and branches 97.54% remain below unchanged floors. All four
  diagnostic artifacts uploaded; Linux24 JSON/LCOV download and hashes verified in
  [the receipt](evidence/ci-95e7510b-coverage.json).

Root logs are under `%TEMP%/rp-finalization-20260907-88b9ee3d/` with prefixes
`evidence-phase-selection-` and `phase-composition-`.

UI owns the separate M14 density, contextual Add label and post-selection/resize
assertions. A new matching capture must show the retained During filter, exactly
six photos, correct selected date/Work, and the visible Inspector heading/actions.
The complete nine-journey/eighteen-reference and host acceptance remain open.
