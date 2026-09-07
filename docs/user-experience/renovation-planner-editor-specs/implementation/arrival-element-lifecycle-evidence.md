# Cost arrival and element deletion lifecycle evidence

Date: 2026-09-07. Test-only contribution on `codex/arrival-element-lifecycle`, based on
`0d115e38`. Production behavior is unchanged. This supports the combined PR #91 recovery
verification; it does not replace the final integrated quality gate.

## New behavior checks

Five arrival cases use the public `PlanEditorRoot.navigateToRecord` API exposed to
`PlanEditorView`, actual persisted Work/Cost records and the real editor runtime:

- A Cost origin without an explicit Room derives its Room from the saved record and opens
  the matching Costs entry in the same mounted editor and Konva stage without writing.
- A Room-only origin returns from Cost detail to overview with an empty focused record ID.
- A Cost removed through the canonical Plan repository while its arrival awaits read
  recovery produces the existing missing-source warning and no invented destination/write.
- Cancelling a queued return at native draft confirmation leaves the path draft intact and
  does not replay that return after another refresh.
- A read failure arriving during confirmation defers navigation and retains the path
  draft. Successful hydration allows a new explicit confirmation before navigation.

Three element cases cover different lifecycle boundaries from the existing changed-drag
and initial-edit tests:

- A held result from an actual planning/reference read completes after leaf disposal;
  deletion opens no late confirmation, dispatches nothing and leaves persisted bytes intact.
- A real peer command changes a Path's geometry/name while native deletion confirmation is
  open. Confirming the old deletion produces a conditional-write refusal and preserves the
  peer's complete result without geometry writes.
- The public `ElementMove` gesture forwards its captured source to the normal runtime action
  after that source has been deleted and refreshed. Finishing the old drag cannot recreate
  the source, write, or restore selection/preview.

These cases use public host/gesture APIs and native modal controls. They do not invoke
private handlers or construct impossible repository results. No production defect was
found. The first run passed all five arrival cases; the three element cases stopped in
setup because the test identity lacked the domain-required `element-` prefix. Correcting
that fixture was the only change needed before the final run.

## Verification and coverage limits

The final five-file run passed all 33 tests in 21.76 seconds: both new files plus existing
`editorArrival.test.ts`, `elementInteractionGuards.test.ts` and `elementRecovery.test.ts`.
The same run collected V8 coverage for the two unchanged production modules. Its isolated
coverage **failed the unchanged thresholds**: statements 157/161 (97.51%), branches
132/142 (92.95%), functions 40/41 (97.56%), lines 84/84 (100%). No full-gate pass is claimed.

The maps for every statement, function and branch were compared with the preserved
`coverage-c1091086-final.json`; all three maps matched exactly for both files. The following
delta counts only previously zero-hit counters that this focused run exercised:

| Module | Additional statements | Additional functions | Additional branches |
| --- | --- | --- | --- |
| `editorArrival.ts` | 4 | 1 | 7 |
| `elementActions.ts` | 2 | 0 | 4 |
| Total | 6 | 1 | 11 |

Locally, arrival reached 58/58 statements, 14/14 functions and 51/52 branches; element
actions reached 99/103 statements, 26/27 functions and 81/90 branches. Combining the
observed hits with the old full report would give element actions 101/103 statements,
27/27 functions and 85/90 branches. That union is an analytical comparison, not a new
full-tree measurement or a reason to relax the gates.

`vue-tsc --noEmit`, whole-tree Oxlint, scoped ESLint with zero warnings and
`git diff --check` passed. Machine reports are preserved as
`%TEMP%/rp-e-arrival-deletion-first.json`, `rp-e-arrival-deletion-final.json` and
`rp-e-arrival-deletion-coverage/coverage-final.json` with its JSON summary. All heavy work
was serialized with the other editor contributors. No thresholds, exclusions, skips,
timeouts or browser assertions changed. This adds no browser, performance, live Obsidian,
or manual screen-reader acceptance claim.
