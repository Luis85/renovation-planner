# Shared warning contract verification

Baseline: integrated source `b758695c`, full gate log
`editor-integrated-check-20260909-pass2.log` (2026-09-09).

The four post-refresh cases in `planEditorFailure.test.ts` expected a contiguous severity and
message string. The shared-shell implementation now places an explicit stale heading between
those parts. The tests must retain all three pieces of information in their intended order.

The isolated adjustment asserts the status region, semantic `stale` row, warning severity and
exact ordered severity/heading/message children. Existing canvas retention, absence of a fatal
failure view, warning retention throughout a pending refresh and removal after success remain
unchanged. The independent background case still requires exactly the stale and missing-background
rows in order, with exact background text. Its injected event uses the declared `backgroundStatus`
spelling; emitting the hyphenated listener spelling caused a Vue declaration warning.

This changes test contracts only. Production rendering, query behavior, event handlers, timeouts,
coverage thresholds and harness warning handling are unchanged.

Quiet verification used `VITEST_MAX_WORKERS=1` and `--maxWorkers=1` on the same production
baseline. The original ten-case file reproduced exactly four concatenation failures (six passed,
1.37 s test time); its canvas/stale-state checks and two-row background count had passed before
the text assertions. The aligned ten-case file passed completely (1.50 s test time), and scoped
ESLint passed. The canonical event spelling also removed the undeclared-event warning.

Original and fixed logs are retained at `C:/Users/lum/.codex/tmp/warning-contract-original-20260909.log`
and `C:/Users/lum/.codex/tmp/warning-contract-fixed-20260909.log`. The temporary baseline test copy
was removed after reproduction. These four failures were test-contract drift, not lost canvas,
lost staleness, swallowed background state or wrong-component event delivery.

## Group hover and standalone Inspector contracts

The additional two-file quiet run passed 11/11 cases with scoped ESLint and one worker.
`rotationHover.e2e.test.ts` now requires the current transient group descriptor, its unchanged
actual member selection, four painted edge-arrow targets and unchanged persisted bytes. Alt
suppression is retained. Its former empty-control expectation predated grouped rotation.

The standalone `roomInspector.test.ts` fixture supplies an explicitly unavailable/null-target
rotation facade matching the current component contract. The name, Delete, missing-derived-field
and missing-list checks remain; the test additionally confirms unavailable rotation controls are
absent. Production components gained no optional guards or fallback behavior. A fixture-only
TypeScript line-break parsing error was corrected before the passing run; no tests ran in that
initial attempt.
