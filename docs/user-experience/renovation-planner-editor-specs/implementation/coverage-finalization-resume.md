# Dedicated coverage continuation

Task: `01a07cca-4d4b-75b0-96fb-9417d3b86f51`.
Branch/worktree: `codex/editor-coverage-finalization`, `.worktrees/editor-coverage-finalization`.
Base: `6f72eea1dbb87f0b1b2774c27fc9ce8becf536c4`, fetched from Root's integration branch on 2026-09-07.

Root confirmed global coverage ownership. UI owns the current heavy slot;
no installation, tests, build or analyzer has started in this worktree.
Root owns shared status files and the final combined source/acceptance.

## Prepared, unverified WIP

`tests/presentation/editor/reviewMarkerNavigation.test.ts` adds four native editor
cases using persisted renovation records and real commands/repositories. Each Review
case acquires a fresh marker and asserts its existence, canonical record/room/mode,
Decision dialog or Work row, and unchanged vault bytes after navigation/cancel.
The fourth checks the existing description on a planned-removal marker and its target.
These are native canvas/component tests, not browser or host acceptance.

Existing `renovationRoutes.test.ts` traverses a captured marker list while repeatedly
switching perspectives, without per-marker context assertions. This new file isolates
the remaining counter boundaries without editing that existing package. No production,
threshold, timeout, assertion, discovery or exclusion changes.

## Measurement state

Latest completed known full measurement: CI `34140688682`, head `45c58609`.
Original JSON/LCOV/missing-counter files remain untouched in
`C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d/ci-45c58609-linux24/`.
`git diff 45c58609 HEAD -- src` is empty. The newer tests on the base have not yet
been included in these counters; do not use the historical 39-arm deficit as current.
CI `34145242834` on base `6f72eea1` was cancelled when Root pushed its registration
document. Replacement CI `34145575098` on `2c3c6360` is running; Root has agreed to keep
that checkpoint stable until full artifacts exist. Its production is still identical.

Draft PR: https://github.com/Luis85/renovation-planner/pull/92. Initial unverified
checkpoint: `145b36db`. Source review then added typed Konva group selection and a
[defensive-arm audit](coverage-defensive-arm-audit.md); neither claims measured hits.

All changes above remain **unverified WIP**. No coverage gain or gate pass is claimed.
Next: obtain Root's explicit free slot, install dependencies, run the new native file
and targeted type/lint verification; audit the new complete CI counters before choosing
the next package. Final acceptance requires unchanged `npm run check` and full matching
coverage on the combined UI integration source Root supplies.
