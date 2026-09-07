# Source disappearance and retired editor recovery

Date: 2026-09-07. Checkpoint on `codex/modal-recovery-coverage` after `7f051874`.
This bounded contribution targets the combined editor PR #91.

## Behavior and regression evidence

A peer can remove a displayed wall before an edit or removal action reads its fresh
baseline. Previously, missing-structure and missing-target early returns skipped the
projection comparison, leaving the removed wall visible. Both actions now compare the
fresh geometry first, report the existing stale-write refusal and refresh the projection.
They do not open a form or dispatch a write. A partial deletion retains the peer's other
walls; an entire structure deletion retains the independent Room outline.

Ten new scenarios cover these three failures plus a captured StructureEditForm callback
after disposal, rejected initial element reads and retries after Cancel/new tool or leaf
disposal, source-less legacy Requirements, and an externally removed material target while
planning read-back fails. The legacy marker navigates to its Room source without rewriting
the Requirement. Failed planning read-back retains material records and facts, but the
missing geometry has no marker. Tests use real commands and repository adapters over
FakeVault; the missing-target scenario deliberately models external sidecar editing.

The preserved red run on `7f051874` passed six and failed four tests in 15.84 seconds.
Three failures showed obsolete walls. The fourth was an uncaught Inspector retry rejection
after replacing the element tool. The integration already owns the alive/generation-guarded
`editor.refresh.failed` catch in `elementBaseline.ts`; that exact guard was temporarily
applied here for verification, then restored before committing. This checkpoint changes
only `structureActions.ts` in production. Its element retry regression requires that
existing integration fix; this checkpoint alone on its older parent is not claimed green.

## Verification

All runs used two workers and ran separately from the other editor contributors' heavy work.

- New scenarios plus existing structure actions/lifecycle/draft tests: six files, 50 passed,
  20.61 seconds, with the integration retry guard temporarily applied.
- Expanded run including existing element and material marker cases: nine files, 63 passed,
  28.05 seconds, with the same temporary guard.
- The expanded run's isolated V8 coverage **failed the unchanged thresholds**: 187/201
  statements (93.03%), 138/160 branches (86.25%), 52/52 functions (100%), and 112/114 lines
  (98.24%). This is not full-tree coverage or a successful quality gate.
- `vue-tsc -noEmit`, whole-tree Oxlint and scoped ESLint passed. The borrowed retry guard
  was then restored to the parent version; it is not part of this contribution.

| Measured source | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `elementBaseline.ts` with integration guard | 50/56 | 42/49 | 10/10 | 27/27 |
| `MaterialMarkers.vue` | 35/35 | 27/32 | 14/14 | 22/22 |
| `structureActions.ts` | 102/110 | 69/79 | 28/28 | 63/65 |

Machine reports were preserved in `%TEMP%/rp-e-abc-red.json`, `rp-e-abc-green.json`,
`rp-e-abc-coverage.json` and `rp-e-abc-coverage.log`; instrumentation is in ignored
`coverage-source-recovery/`. No thresholds, exclusions, skips or suppressions changed.
The final integration owns the complete coverage and Fallow health gates. These cases
add no browser, performance, live Obsidian or screen-reader acceptance claim.
