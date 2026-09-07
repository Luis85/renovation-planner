# Increment E verification and coverage ledger

The `npm run check` at `66bcd0d033753796e4c290c88f9bbb05322a30db` **passed** on 2026-09-07 with `VITEST_MAX_WORKERS=2`, Windows and
Node 24.20.0. Build/vue-tsc, oxlint, ESLint, the coverage suite and Fallow all passed.

The later evidence-path/Review-name, Evidence-selection, unrecovered-draft, obsolete-spatial-read, draft-retry, Room-pause, thumbnail and rail-focus follow-ups use targeted verification, recorded in the
[evidence ledger](planning-recovery-evidence.md#review-follow-up--evidence-path-and-room-names).
The obsolete-read follow-up passed 80 tests in seven files; its isolated coalescer coverage is
100% statements, branches, functions and lines. This does not replace the full-gate counters below.
The counters below belong to `66bcd0d0`; they are not a claim of a fresh full gate after that
follow-up. Finalization owns the subsequent combined coverage/Fallow run at unchanged floors.
**541 test files passed; 7,259 tests passed, 70 existing skips, 7,329 total.**
The test phase began at 01:57:32 Europe/Berlin and took **647.91 seconds**.
Production dependency audit reports zero vulnerabilities.

Existing thresholds remain 99% statements/functions/lines and 98% branches.
No exclusions, skips, timing budgets or thresholds are added to conceal this slice.

Focused verification covers real write/read-back failure, retained modal drafts, read-only
retry, late/disposed readers, relative evidence invalidation, actual registered host rename,
thumbnail recovery, decimal precision/input, stale fully procured shopping and fresh-baseline
Review generation. Performance compares actual calculation calls on the reusable 80-room
fixture, not an implementation-shaped mock of the optimized loop.

Scope is every changed instrumented `src/` file relative to #88 at
`3c1c737a5bfaf0a9e4782f1cbfe2ec4e0aca7f6a`, including newly added files. Counts are collected
from the final complete run's `coverage-final.json` and `lcov.info`; percentages truncate to
two decimals like Istanbul. Changed-file totals cover whole files, including their inherited
branches, rather than only edited lines. [Raw counters](evidence/planning-recovery/coverage.json)
also list uncovered locations. Whole-suite uncovered totals are 128 statements, 189 branches,
37 functions and 67 lines. Branch headroom above the unchanged floor is four covered branches.

See [implementation and browser evidence](planning-recovery-evidence.md) for scope and limits.

## Diagnostic runs before the final gate

PR #90 review 3945673161 was reproduced by entering renovation Apply before a failed read:
the button reported `aria-disabled="false"` while submission was blocked. After sharing one
blocked-state computation between the button and submit handler, all seven recovery tests
pass, including editable retained text, zero writes while paused, read-only retry and one
successful save after recovery. The final full gate and counters in this ledger include this
follow-up. The previous checkpoint `26b693bd` also passed the complete gate in 670.32 seconds;
its four-scenario browser captures remain separately attributed in the evidence report.

The first complete locally installed run passed **541 test files, 7,257 tests and 70 existing
skips** in 676.26 seconds. Build and both linters passed. Coverage was 14,669/14,799 statements
(99.12%), 9,490/9,687 branches (97.96%), 4,070/4,108 functions (99.07%) and 11,932/12,000 lines
(99.43%). The branch gate correctly refused this run; Fallow was therefore not reached.

The uncovered initial-baseline Inspector error/retry route prompted a real repository-backed
regression: first planning load fails, unrelated files trigger no read, repeated retry writes
nothing, recovery restores the panel, and the fresh Review can be generated. All seven recovery
tests pass. A focused coverage diagnostic confirms five previously uncovered Inspector branches
are now exercised. Its whole-suite thresholds necessarily fail because it runs one test file;
it is not claimed as a complete gate. A failed generated-Review read after disposal and a rapid
duplicate Generate request also have an explicit regression. Final complete totals are recorded
in this ledger.

The subsequent complete suite passed 541 files and 7,259 tests (70 existing skips) in 657.00
seconds and cleared coverage: 99.13% statements, 98.04% branches, 99.09% functions, 99.44%
lines. Fallow then correctly refused the root template's cognitive complexity of 16 against
15. Moving the localized paused-reason derivation into a computed value preserves behavior
and restores the template budget; the seven recovery tests and Fallow then pass. The final
complete gate measures that refactored source, not the preceding result.

Earlier setup diagnostics were corrected without changing gates: npm commands could resolve
ancestor dependencies, but hook/contract tests required a worktree-local installation, now
provided by `npm ci` without package/lockfile edits. A temporary coverage reporting script was
moved outside the repository instead of adding a lint exclusion. The focused diagnostic's
generated HTML-report JavaScript was also moved outside after lint correctly scanned it under
the harness output directory; the final complete gate uses no new lint ignore.
Production dependency audit:
zero vulnerabilities.

## Final coverage counters

| Scope | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Whole suite | 14675/14803 (99.13%) | 9498/9687 (98.04%) | 4073/4110 (99.09%) | 11935/12002 (99.44%) |
| Changed instrumented files | 1310/1325 (98.86%) | 977/1002 (97.5%) | 402/411 (97.81%) | 960/969 (99.07%) |

| File | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `src/infrastructure/obsidian/vault/vaultFileChanges.ts` | 13/13 (100%) | 6/6 (100%) | 7/7 (100%) | 9/9 (100%) |
| `src/plugin/RenovationPlannerPlugin.ts` | 191/193 (98.96%) | 45/46 (97.82%) | 51/52 (98.07%) | 168/169 (99.4%) |
| `src/presentation/composables/latest-read.ts` | 38/38 (100%) | 12/12 (100%) | 9/9 (100%) | 21/21 (100%) |
| `src/presentation/editor/forms/DraftRecovery.vue` | 14/14 (100%) | 8/8 (100%) | 3/3 (100%) | 10/10 (100%) |
| `src/presentation/editor/PlanEditorRoot.vue` | 95/95 (100%) | 86/86 (100%) | 35/35 (100%) | 79/79 (100%) |
| `src/presentation/editor/planning/CostRow.vue` | 13/13 (100%) | 27/28 (96.42%) | 7/7 (100%) | 11/11 (100%) |
| `src/presentation/editor/planning/CostTotals.vue` | 3/3 (100%) | 0/0 (100%) | 1/1 (100%) | 2/2 (100%) |
| `src/presentation/editor/planning/EvidenceFields.vue` | 39/40 (97.5%) | 49/50 (98%) | 15/15 (100%) | 27/27 (100%) |
| `src/presentation/editor/planning/EvidenceInspector.vue` | 42/42 (100%) | 42/45 (93.33%) | 23/23 (100%) | 24/24 (100%) |
| `src/presentation/editor/planning/EvidencePreview.vue` | 10/10 (100%) | 14/15 (93.33%) | 4/4 (100%) | 6/6 (100%) |
| `src/presentation/editor/planning/MaterialFields.vue` | 19/19 (100%) | 25/26 (96.15%) | 14/14 (100%) | 17/17 (100%) |
| `src/presentation/editor/planning/MaterialNumbers.vue` | 1/1 (100%) | 10/12 (83.33%) | 0/0 (100%) | 1/1 (100%) |
| `src/presentation/editor/planning/MaterialRow.vue` | 12/12 (100%) | 24/24 (100%) | 7/7 (100%) | 11/11 (100%) |
| `src/presentation/editor/planning/MaterialsInspector.vue` | 47/48 (97.91%) | 37/39 (94.87%) | 13/13 (100%) | 22/22 (100%) |
| `src/presentation/editor/planning/planningContext.ts` | 35/37 (94.59%) | 30/34 (88.23%) | 8/8 (100%) | 24/24 (100%) |
| `src/presentation/editor/planning/planningDraft.ts` | 46/46 (100%) | 71/71 (100%) | 21/21 (100%) | 33/33 (100%) |
| `src/presentation/editor/planning/PlanningForm.vue` | 71/74 (95.94%) | 77/77 (100%) | 20/23 (86.95%) | 44/47 (93.61%) |
| `src/presentation/editor/planning/PlanningInspector.vue` | 3/3 (100%) | 15/15 (100%) | 1/1 (100%) | 2/2 (100%) |
| `src/presentation/editor/planning/planningProjection.ts` | 54/54 (100%) | 47/47 (100%) | 30/30 (100%) | 32/32 (100%) |
| `src/presentation/editor/planning/planningReadState.ts` | 7/7 (100%) | 0/0 (100%) | 1/1 (100%) | 4/4 (100%) |
| `src/presentation/editor/planning/planningRefresh.ts` | 50/50 (100%) | 26/26 (100%) | 14/14 (100%) | 29/29 (100%) |
| `src/presentation/editor/renovation/renovationActions.ts` | 87/87 (100%) | 86/90 (95.55%) | 13/13 (100%) | 56/56 (100%) |
| `src/presentation/editor/renovation/RenovationForm.vue` | 65/71 (91.54%) | 66/69 (95.65%) | 14/19 (73.68%) | 44/49 (89.79%) |
| `src/presentation/editor/renovation/ReviewInspector.vue` | 52/52 (100%) | 60/61 (98.36%) | 13/13 (100%) | 31/31 (100%) |
| `src/presentation/editor/runtime.ts` | 163/163 (100%) | 52/53 (98.11%) | 56/56 (100%) | 127/127 (100%) |
| `src/presentation/editor/save-state/SaveStateIndicator.vue` | 8/8 (100%) | 9/9 (100%) | 2/2 (100%) | 7/7 (100%) |
| `src/presentation/editor/tools/with-stale-gate.ts` | 7/7 (100%) | 7/7 (100%) | 6/6 (100%) | 7/7 (100%) |
| `src/presentation/i18n/locales/de/planning.ts` | 1/1 (100%) | 0/0 (100%) | 0/0 (100%) | 1/1 (100%) |
| `src/presentation/i18n/locales/en/planning.ts` | 1/1 (100%) | 0/0 (100%) | 0/0 (100%) | 1/1 (100%) |
| `src/presentation/i18n/planningFormat.ts` | 12/12 (100%) | 16/16 (100%) | 2/2 (100%) | 9/9 (100%) |
| `src/presentation/stores/ProjectStore.ts` | 111/111 (100%) | 30/30 (100%) | 12/12 (100%) | 101/101 (100%) |

## Element discard follow-up — 2026-09-07

An isolated V8 run after the `75084550` modal checkpoint passed eight files / 60 tests
in 33.95 seconds with two workers. `renovationRemoval.ts` reached 45/45 statements,
34/34 branches, 22/22 functions and 25/25 lines. This is a targeted measurement, not a
replacement for the historical full-tree figures above or the final integrated gate.
The real intended-only discard failure, conditional-history fix and retired dialog cases
are recorded in [the follow-up evidence](element-discard-recovery-evidence.md).

## Source and lifecycle follow-up — 2026-09-07

Ten additional recovery regressions cover peer-deleted structures, retired element reads
and callbacks, legacy material sources and retained facts with missing target geometry.
The expanded targeted run passed 63 tests in nine files using the integration's existing
element retry guard. Its isolated three-source coverage failed the unchanged thresholds:
187/201 statements, 138/160 branches, 52/52 functions and 112/114 lines. The new structural
refresh fix, red evidence and integration dependency are recorded in
[the source/lifecycle evidence](source-lifecycle-recovery-evidence.md). This measurement
does not replace the complete integrated gate or the historical full-tree figures above.

## Element completion and service boundaries — 2026-09-07

Four native element-form lifecycle scenarios and fifteen actual plugin-composition fault
cases extend the recovery evidence. The final focused run passed 46 tests in five files in
30.18 seconds, including the existing structure action, lifecycle and source-disappearance
regressions after consolidating their shared baseline preparation. The repository Fallow
duplication scan reports zero clone groups. These are execution and duplication results,
not new coverage percentages or a complete quality-gate result. See
[the element completion evidence](element-lifecycle-completion-evidence.md) for the exact
scope, fixture correction and acceptance limitations.
