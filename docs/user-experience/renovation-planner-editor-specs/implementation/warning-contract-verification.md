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
