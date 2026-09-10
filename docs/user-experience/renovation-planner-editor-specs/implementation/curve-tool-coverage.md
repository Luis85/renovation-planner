# Curve tool completion and lifetime coverage

Source prepared from `b10c3b24` after the unchanged full gate passed 730 files /
8,624 tests with 70 skipped, but missed the coverage thresholds. The saved report
identifies nine missing CurveTool branch outcomes and three uncalled methods:
pointerUp, finish and hasDraft. Those numbers describe the parent baseline only;
no coverage increase is claimed for these unrun additions.

`curvePointerCompletion.test.ts` mounts the real editor and uses its painted bend
handle. Native pointer input with Shift and Alt previews a 400 mm depth; the final
release at 600 mm must replace that preview. The registered ToolManager finish
route refuses during the active bend, then writes once after release and restores
the exact original document through undo. A second case keeps a pending native
curve-task read from admitting a draft and verifies cancellation retires its late
result without changing vault bytes. This tests the registered tool finish seam;
it does not claim that Enter is a CurveTask keyboard shortcut.

`curveToolLifetime.test.ts` exercises the public tool boundary directly for states
that the DOM normally filters: inactive/missing/paused admission, secondary press
and release, an off-handle press, sub-threshold jitter, nonfinite pointer samples,
busy deactivation, finish before/after release, and interrupted/deactivated rollback
to a pre-existing bend. The assertions verify observable geometry and delegated
actions rather than private fields or coverage counters.

Five cases across two new test files; no production source, thresholds, test
timeouts or analysis exclusions changed. `git diff --check` passed. Tests, types,
linters and coverage are **unrun** for this source-ready commit; root owns the
combined single-worker verification. No browser/native-host acceptance is claimed.
