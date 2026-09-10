# Combined release gate — 2026-09-09

This is an active verification record, not release acceptance. Earlier concern-level green checks do not establish that the combined release passes.

## Failed combined gate

At `b758695ca447e53830daa1922253985b4ffe0ea6`, the unchanged `npm run check` passed build and both whole-tree linters, then failed coverage/testing. It reported 57 failed / 659 passed files, 83 failed / 8,395 passed / 70 skipped tests and six unhandled errors. Coverage was 97.88% statements, 95.96% branches, 98.05% functions and 99.15% lines. Static analysis was not reached.

The machine has eight logical CPUs and 7.817 GiB RAM. The default-worker run exhausted available memory and reported worker startup failures, late mounts and timeouts. This is not grounds to discard assertion failures: owners are reproducing them quietly and adding missing behavioral evidence. The next full run uses `VITEST_MAX_WORKERS=1` with the same command, tests, timeouts and thresholds. The installed Vitest resolver supports this environment variable.

Raw output and coverage were preserved locally in ignored `harness-shots/full-check-b758695c/`; the original log is `C:/Users/lum/.codex/tmp/editor-integrated-check-20260909-pass2.log`. These paths are local diagnostics, not portable checked-in evidence.

## Confirmed repairs and follow-up

- `f5a28f45`: translated group errors, German imperative consistency, exact reviewed group guard ownership with real fault cases, and future-schema fixtures derived from the current version. No blanket guard exception.
- `9aa4f6c2`: renamed a private reference-preview pointer helper to preserve the sole branded ScreenPoint factory contract.
- `c2215a79`: exercised actual hover for transient rotation arrows and the current M00 floor-setup state after deletion; all 19 aligned cases passed quietly.
- `03722e9e`: warning rows now assert severity, the stale heading and retained failure detail separately. The original ten-case suite reproduced four outdated text expectations; the corrected ten passed without production edits.
- `f3b40149`: group move inputs restore their value when saving blocks input; fourteen rendered Inspector/runtime cases passed alongside five command-boundary cases. Further census/receipt cases are pending.

Supplemental stair/arrow and reference/photo/opening browser drivers are integrated. They add acceptance coverage without replacing the original nine journeys or eighteen reference comparisons. Their actual capture runs remain pending, as do the full combined gate, final visual inspection, isolated Obsidian acceptance and concern PR publication.

Their animation-frame Promise executors were also made explicitly void, consistent with the curve-driver repair that the first combined lint run required. `node --check` passes for the four new driver modules; this is syntax validation only. Root, input, shell and curve behavioral additions are being combined for one focused run before the next unchanged full gate.
