# Curved-boundary implementation follow-up — PR #111

Date: 2026-09-09. This is the current concern receipt for
[PR #111](https://github.com/Luis85/renovation-planner/pull/111), on
`codex/editor-deliver-curves`. The [remaining plan in #117](https://github.com/Luis85/renovation-planner/blob/5c15006c38d01b530641ac6da1ed154ab52227c6/docs/user-experience/renovation-planner-editor-specs/implementation/remaining-plan.md)
still owns the overall editor plan. Manual acceptance is **user-owned and pending**;
it does not block this implementation step. No desktop/Obsidian control, manual browser
walkthrough or screenshot acceptance was performed in this follow-up.

## Integration and scope

The clean existing dedicated worktree `.worktrees/editor-deliver-curves` was reused.
Remote state was fetched before work. PR #111's original head was
`0a049e270de7b0dbdd4ba88e000866fe34f8634d`. It had no reviews or review threads;
its four verification jobs were red, while audit and GitGuardian passed.

The latest #110 head, `5c742ffdabda910f98290997d90659ed5901c7e0`, was merged without
textual conflicts. The overlapping equality helper retains both curve parameters and
ordered Group6 membership; schema 7 retains #110's exact accepted group names. The
dependency's source and evidence changes are inherited, not additional Photo/Reference
work by this follow-up. No downstream branch was rewritten. Main remains clean on
its integration branch. Schema 7 is still the latest supported version; Stair8 is absent.

## Demonstrated fix

Entering a representable radius of `10^305` metres multiplied the converted radius by
two before dividing the chord. That intermediate value overflowed, producing zero bulge
and silently straightening the edge. The calculation now halves the chord before
dividing by the radius. Two regression cases were observed failing before the fix and
passing afterward; they cover both signed bend directions and the resulting analytic
radius, not just the parser's return value.

Existing free-form creation, analytic geometry, curve controls, rendering, selection,
snapping, opening placement, bounds and quantities were reviewed and retained. No new
editor architecture or group interaction UI was introduced.

## Automated evidence

`curveDelivery.test.ts` adds real repository/runtime checks for:

- Untouched high-precision values and Cancel making no writes or byte changes.
- A successful write whose receipt returns after leaf disposal, preserving exactly one write.
- Successful Apply followed by failed readback and three read-only retries, then exact
  Undo/Redo and a fresh sidecar/store read; group order, padded names, intended geometry,
  hosted openings and swing metadata remain exact.
- A returned persistence failure retaining the draft and its typed text without implicit retries.
- Self-intersecting curve refusal without point repair or writes.
- All Room-edge measurements during point and rotation previews, saved curve preservation,
  and exact history restoration.

The existing focused suites additionally cover circular moments/extrema/contact rules,
curved area/perimeter/wall quantities, snapping and hit projection, native controls,
pending reads, curve-only peers, ambiguous topology refusal, mixed history, schema 7
compatibility with Group6/opening5, enclosure and the Group6 follow-up regressions.

Verification used Windows, Node 24.20.0 and lockfile-installed dependencies (`npm ci`).
Only worker parallelism was limited (`VITEST_MAX_WORKERS=2`). No assertions, thresholds,
timeouts or exclusions were weakened; checked configuration matches the updated #110
dependency. Historical receipts apply only to their named revisions.

- **82 targeted tests passed across 16 files**, including eight new cases. The two
  radius cases were observed red before the fix. [Final focused run](evidence/curves-20260909/targeted.log)
  and [pre-fix reproduction](evidence/curves-20260909/radius-red.log).
- **Build/type-check, Oxlint and ESLint passed.** The changed production file has no
  uncovered statements or functions; one existing branch arm remains uncovered.
- **Unchanged `npm run check` remains red:** 8,524 passed, eight failed, 70 unchanged
  skips across 719 files. All eight failures match the inherited set below; no new
  curve failure was reported. [Full log](evidence/curves-20260909/check.log).
- Coverage: **98.85% statements, 97.49% branches, 98.86% functions, 99.47% lines**.
  The first three still miss unchanged floors; these same floors already failed on
  the published #111. This is not a green complete quality gate.
- **Separate `npm run analyze` remains red:** six dead-code/type findings, one existing
  command-guard clone (`dup:6f87acd9`), fourteen complexity findings.
  [Fallow log](evidence/curves-20260909/analyze.log). The curve composition's existing
  `RoomDimensionLabels.vue` and `TemporaryToolBanner.vue` findings account for the two
  additional complexity entries compared with #110's twelve. General cleanup is outside
  this follow-up; these findings remain open.
- A [diagnostic comparison](evidence/curves-20260909/analyze-baseline.log) restoring only
  the pre-fix radius expression reproduced the same six findings, clone and fourteen
  complexity entries. It held tests, coverage and source line positions constant; it
  is not an independently measured baseline coverage or full-gate pass. The checked
  source was restored byte-for-byte before the final focused run.
- `git diff --check` and relative note links passed.

No further functional curve gap was demonstrated. The remaining automated quality debt
above and user-owned manual acceptance are explicitly open. [Machine-readable receipt](evidence/curves-20260909/receipt.json)
records the checked source hashes and log hashes.

### Failure attribution baseline

The [published Windows/Node 22 CI job](https://github.com/Luis85/renovation-planner/actions/runs/34326611486/job/102385239628)
reported nine failed tests on the earlier PR composition. Its coverage was 98.83%
statements, 97.46% branches, 98.83% functions and 99.46% lines; the first three missed
unchanged floors. #110's later [full-check receipt](evidence/group-storage-20260909/check.log)
reported the following eight failures after the reference-viewport update:

| Test file | Existing failure(s) |
| --- | --- |
| `zoneEditing.test.ts` | Three Inspector/selection/removal expectations. |
| `renovationRoutes.test.ts` | Visibility-control expectation. |
| `shell/newRoomInspector.test.ts` | Two creation-hint visibility expectations. |
| `structureLifecycle.test.ts` | Wall-removal UI wait at the unchanged timeout. |
| `renovateRoomManipulation.test.ts` | Expected old always-visible rotation handle. |

These are comparison evidence, not an assertion that this branch passed the full gate.

## Optional user-owned manual checks

- Bend a free-form Room and a wall using handles and depth/radius fields; inspect every
  Room edge during point editing and rotation.
- Save, Undo/Redo and reopen; check hosted openings and group membership.
- Cancel a changed draft and check that saved geometry is unchanged.

No manual confirmation or vault access is requested. No PR merge, release publication
or completion of the entire editor plan is authorized by this receipt.
