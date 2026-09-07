# Dedicated coverage continuation

Task: `01a07cca-4d4b-75b0-96fb-9417d3b86f51`.
Branch/worktree: `codex/editor-coverage-finalization`, `.worktrees/editor-coverage-finalization`.
Base: `6f72eea1dbb87f0b1b2774c27fc9ce8becf536c4`, fetched from Root's integration branch on 2026-09-07.

Root confirmed global coverage ownership. The first granted heavy slot is complete
and was explicitly returned to Root. All local process handles are terminal.
Root owns shared status files and the final combined source/acceptance.

## Current verification and contract correction

Installed 567 dependencies using `npm ci --no-audit` (50 seconds), Node 24.20.0.
Both prepared files passed 6/6 tests in 13.13 seconds, followed by types, whole
Oxlint and scoped ESLint. **Four marker tests establish historical current behavior
only and must not be integrated as M17 acceptance.** Root clarified that marker
selection must remain in Review and expand the Room summary; only an explicit issue
action enters Renovate. UI owns the production correction. This task owns revisions
to its new marker test file. Do not preserve the incorrect behavior just for coverage.

The two public command cases are valid and passed again under scoped coverage
(2/2, 9.87 seconds). Exact comparable gains: **2 branches, 1 statement**; see
[receipt](evidence/contextual-material-counter-gains.json). Their initial test failures
were Money representation differences (`900` versus `900.00`), corrected with the
existing `sameMoney` domain comparison while checking every other persisted field
and the independent override separately. No production correction was needed.

Fallow dead-code/duplication: zero findings, zero clone groups. Fallow health against
the original full `2c3c6360` CI with the official Linux coverage-root: zero findings,
742/742 files mapped. Bare Fallow initially refused the absent local coverage file;
the separate static and correctly mapped full-CI health runs then passed. No scoped
coverage was presented as health evidence.

Contract-correct source is now prepared: three explicit issue-button cases, two
Click/Tap cases requiring one Room marker and Review/summary retention, and the
unchanged planned-removal marker case. The revised six-case file has **not been run**.
Initial selectors use the observed predecessor; Root will supply any changed UI selectors.
Expected predecessor RED is a UI dependency, not a
reason to weaken or skip a test. Obtain UI source/selector details from Root and a new
heavy slot before testing. Final full coverage awaits the joined production source.

## Initial marker package — historical behavior, superseded by prepared revision

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

## Public command package — verified

`tests/application/commands/contextualMaterialBoundaries.test.ts` adds two public
application-command contracts with persisted valid materials: recalculation without
optional packaging preserves due date and both overrides; cross-Room reassignment
during deletion refuses a contextual material before entity writes and clears its
sequence marker. Root was informed before preparation. These are verified service
contracts, not native UI/host evidence.

## Measurement state

Latest completed known full measurement: CI `34140688682`, head `45c58609`.
Original JSON/LCOV/missing-counter files remain untouched in
`C:/Users/lum/AppData/Local/Temp/rp-finalization-20260907-88b9ee3d/ci-45c58609-linux24/`.
`git diff 45c58609 HEAD -- src` is empty. The newer tests on the base have not yet
been included in these counters; do not use the historical 39-arm deficit as current.
CI `34145242834` on base `6f72eea1` was cancelled when Root pushed its registration
document. Replacement CI `34145575098` on `2c3c6360` is complete. Its Linux24 job passed
653 files / 8087 tests (69 skipped), then failed only the 98% branch threshold.
It did not reach `analyze`. Downloaded original JSON/LCOV are preserved in
`C:/Users/lum/AppData/Local/Temp/rp-coverage-finalization-ci-2c3c6360-linux24/`.
The tested merge `f9f2f70a` and head `2c3c6360` have exactly the same Git tree.

Current full counts: statements 17881/18049, functions 5122/5160, lines 13987/14053,
branches 12406/12692. The deficit is **33 branch arms**, before this task's tests and
the still-pending UI join. Original 45 → 2c maps and all source blobs match; the new
Root tests yield 6 branch / 5 statement gains, zero losses and zero incomparable maps.
See [exact receipt and counter gains](evidence/coverage-2c3c6360-receipt.json).

Draft PR: https://github.com/Luis85/renovation-planner/pull/92. Initial unverified
checkpoint: `145b36db`. Source review then added typed Konva group selection and a
[defensive-arm audit](coverage-defensive-arm-audit.md). CI `34145889916` passed build/
types but rejected conditional assertions before tests. `2cfe3dff` splits the Decision
and Work assertions into separate cases without dropping any assertion; its CI is
running. No contribution from this task has yet been measured.

The complete gate has **not** passed. Final acceptance requires unchanged `npm run check`
and full matching coverage on the combined UI integration source Root supplies.
