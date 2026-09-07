# Element proposal discard and retired dialog recovery

Date: 2026-09-07. Source: `codex/modal-recovery-coverage`, following `75084550`.
This is a bounded follow-up for the final editor integration, not a complete acceptance run.

## Behavior

Discarding an intended-only generic element previously removed its geometry while retaining
its canonical Markdown label. The real RenovationCommand then refused the proposal with
`plan.invalid-spatial-elements`. The removal input now carries that label removal and the
unchanged current structure through the existing command. Its validation, conditional Plan
and sidecar writes, compensation, events and Undo/Redo remain the authority.

Current generic elements retain their labels and exact geometry when a modification or
removal proposal is discarded. Unrelated elements and Work records remain intact. Undo
restores the complete proposal; a peer revision prevents a later Undo from overwriting it.

The lifecycle regressions additionally verify that authorized material and cost saves can
finish after leaf disposal without reopening a dialog, emitting its submit event or stealing
focus. A retained dispatch callback then refuses with `undo.superseded`, with no extra writes.
The Existing form resolves a saved generic element's canonical name and persists its selected
stable target. These scenarios use the existing editor harness and real Obsidian repository
adapters over FakeVault, not a live Obsidian session.

## Verification

- Red: seven new scenarios, six passed and the intended-only discard failed at the real
  command boundary; 38.88 seconds with two workers.
- Final green after the metadata helper extraction: eight focused files, 60 tests passed
  in 33.95 seconds with two workers. These cover the new scenarios, planned elements,
  renovation failures, planning target recovery, renovation commands, draft and batch callers.
- Isolated V8 measurement on that final run: `renovationRemoval.ts` has 45/45 statements,
  34/34 branches, 22/22 functions and 25/25 lines.
  The isolated report is under ignored `coverage-discard-recovery/`; no global threshold,
  coverage exclusion, skip or suppression changed.
- The initial type check identified the captured material command's delete-input union;
  the test now explicitly refuses that unexpected operation before invoking the captured
  creation callback. Oxlint identified conditional assertions; the test now compares one
  resolved persisted value in both scenarios.
- Scoped ESLint identified complexity 17 against the unchanged limit of 16. Extracting the
  metadata proposal into one small helper preserved behavior and passed the same check.
- Final `vue-tsc -noEmit`, whole-tree Oxlint and scoped ESLint passed. Fallow reported no
  dead code or duplication. Its combined invocation automatically selected the isolated
  coverage report (only two function matches across the repository) and failed health with
  92 static-estimate findings. This is not a complete health pass; the final integration
  must rerun Fallow against its fresh full-tree coverage report.

The complete integrated source still requires the unchanged full coverage gate and the
single shared final browser matrix. This checkpoint adds no browser, performance, screen
reader, physical-device or live-host acceptance claim.
