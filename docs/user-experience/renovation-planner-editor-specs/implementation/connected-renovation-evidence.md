# Connected renovation workflow: evidence and acceptance boundary

Continuation of PR #86 (`866ccc38e0c853b6c0f0ad7a27173f5c96c1b879`), based on the actual open
head, with #85/#83/#82/#76/#75/#74 ancestry. ADR-0021 resolves ADR-EPW and ADR-RL for this slice.

## Delivered behavior

Select an ordinary Room and choose What’s here, What will change or What needs doing. Existing
surface/element observations use a documented condition vocabulary and remain independently
readable after a proposal. Add/modify/remove/unchanged enforce their source rules. Straight walls
and openings use stable IDs in independent current/intended structures. Apply validates each
state’s opening hosts. Existing target choices come only from current geometry, so a proposed-only
opening cannot be misrepresented as an observed fact. Discarding a proposal preserves its Existing source and restores supported
spatial facts. Room outlines remain independent of wall-boundary provenance.

Work belongs to the containing Plan’s Project. A Work item has stable target/outcome links,
ordering, progress, unassigned/DIY responsibility and editable dependencies. Cycles refuse; an
incomplete predecessor explains blocking. No Trade records exist to assign. Decisions carry
question, source subject, resolution text and resolved state in ordinary Plan Markdown.

Review lists unresolved Decisions, changed outcomes without Work, Work without an outcome and
blocked Work. It routes back to actionable records and generates a sibling review note. The
note links its owning Plan with encoded filename segments and identifies records by ID. A vanished
source is refused even if the index has not caught up. Safe regeneration preserves human edits
by refusing replacement, and conditions replacement against the previously read bytes. It does
not claim readiness in unimplemented domains.

## Automated traceability

| Contract / requirement | Evidence |
|---|---|
| M08 independent manual facts, conditions, state vocabulary | `tests/domain/renovation.test.ts`; `renovationWorkflow.test.ts` |
| M09 classification/source rules, additions and proposal discard | `renovation.test.ts`; `renovationDraft.test.ts`; `renovationCommand.test.ts` |
| M07 current/intended wall/opening hosts, calibration and Room outlines | `renovationDraft.test.ts`; `renovationCommand.test.ts`; inherited `structureCommand.test.ts`, `structurePersistence.test.ts`, `configurePlanReference.test.ts` |
| M10 outcome links, ordering, dependencies, cycles and blocking | `renovation.test.ts`; `renovationWorkflow.test.ts`; `renovationRoutes.test.ts` |
| Decision creation, resolution and source navigation | `renovationWorkflow.test.ts`; `renovationRoutes.test.ts`; browser journey below |
| Perspectives, preserved spatial selection/context and viewport | `renovationWorkflow.test.ts`; `renovationFailures.test.ts` |
| Root draft retention, cancellation, invalid input, busy/duplicate, persistence refusal, conflict and disposal | `renovationFailures.test.ts`; `renovationWorkflow.test.ts` |
| Stale projection paired with fresh storage baseline | `renovationFailures.test.ts`; inherited `structureLifecycle.test.ts` |
| Conditional composite writes, returned/thrown failure, operation-owned compensation, failed-compensation reporting, undo/redo | `renovationCommand.test.ts` |
| Actual Plan and sidecar persistence; fresh index/repository reload; production query projection | `renovationCommand.test.ts`; `renovationProjection.test.ts`; inherited reference/structure persistence tests |
| Review-note path, repeated generation, human edits, race, source loss and write failure | `renovationReviewNotes.test.ts`; `guardedRenovation.test.ts` |
| Pure/idempotent v3 upgrades and unsupported future-version refusal | `renovationReviewNotes.test.ts`; `referencePlanMigration.test.ts`; `structurePersistence.test.ts` |
| Linked geometry deletion refuses without losing notes; late deletion read cannot open a disposed leaf | `renovationCommand.test.ts`; `renovationRoutes.test.ts`; `renovationGeometryGuard.test.ts` |
| PR86 Room rename/move → undo → structure undo, peer sandwich protection | `structureMixedHistory.test.ts` |
| Planned geometry apply/undo between structure edits preserves a peer generation gap | `renovationMixedHistory.test.ts` (failed before the consumed-version observation, passes after) |
| PR86 unrelated structure edits remain available with an unreadable Room note and a valid sidecar boundary | `structureCanvasRoutes.test.ts` |
| Inherited wall Backspace/Enter, opening Enter, direct-drag runtime handoff and Area Escape focus | `structureCanvasRoutes.test.ts` |
| Newly advanced #74: Alt hover refresh and constrained multi-selection mode retention | `canvasKeyboardGestures.test.ts`; `shell/multiSelectionInspector.test.ts` (upstream regressions) |
| Reversible-event registration and notification | `reversibleWritePathDiscovery.test.ts`; `renovationCommand.test.ts` |

Test names above without a path prefix are under `tests/presentation/editor`,
`tests/application/commands`, `tests/domain`, `tests/plugin`, `tests/presentation/read-models`, or `tests/infrastructure/obsidian/repositories`
as appropriate; the filenames are unique. These tests use actual production repositories over
FakeVault where stated. They do not run inside Obsidian.

## Reproducible browser evidence

Run from the continuation worktree:

```powershell
$env:RP_CHROMIUM_EXECUTABLE='D:\dev-cache\playwright\chromium-1223\chrome-win64\chrome.exe'
node scripts/editor-renovation-check.mjs
```

Omit the override when the browser pinned by playwright-core is installed. This run used cached
Chromium **148.0.7778.96**, a different build from the package pin; font/layout evidence is tied
to that build. Four scenarios passed: light (1440), dark (1440), custom accent (1000) and German
constrained (460). The actual keyboard journey prepares and calibrates a reference, creates a
closed wall loop plus Room, records Existing/Planned/Work/Decision, visits Review, generates its
note and resolves the Decision. It uses Tab/Enter/Space and native typing rather than DOM
focus/fill shortcuts. Custom tokens are saved, restored and asserted across fixture reloads.
Every scenario asserts no horizontal page overflow and no page errors.

Outputs are in ignored `harness-shots/renovation-workflow/`: `report.json` and per-scenario PNGs
for the closed loop, wall Inspector, Existing, Planned, Work, Review and resolved Review.
The representative captures and machine-readable report are committed in
[`evidence/renovation-workflow`](evidence/renovation-workflow). Light/dark Review, custom Work and German Planned screenshots were visually
inspected: host surfaces and accent remain distinct, controls wrap within the available width,
and the constrained Inspector scrolls vertically. The helper fixtures are reproducible; the
screenshots are evidence, not pixel-diff golden files. The existing seven-layer Konva warning
remains inherited; this slice reuses the annotation layer rather than adding another stage layer.

## Inherited review state

PR #86 remained open at the stated base with its Linux Node 22/24/26, Windows Node 22,
audit and GitGuardian checks successful when rechecked. Its three open review threads are
implemented in this continuation: shared editor ledger, sibling sidecar receipts, and all-object
validation. A later fetch found PR #74 advanced to `2f1fce9b` and `origin/main` advanced to `44234f77`
(#84 merged), while #86/#85/#83/#82/#76/#75 retained their heads. The two new #74 fixes relevant
to this editor are carried here with their upstream regressions: `48febd87` refreshes overlap
hover on Alt, and `381bcdc4` preserves multi-selection mode across constrained panel remounts.
The continuation base remains #86; this feature does not merge the broader #84 polish branch. The review threads on #85 about appearance
observation, calibration consistency and canonical reference paths are already addressed in #86's
code and remain administratively unresolved on that earlier PR. This contribution does not
modify or resolve an earlier PR branch. The native-select Escape report on #74 was declined upstream in `2f1fce9b` after a Chromium popup-event measurement; this continuation retains #86’s editing-field contract. The Area Escape focus and inherited canvas keyboard/drag
acceptance gaps now have runtime regressions. The new stale-drag baseline check refuses to
apply endpoints derived from a stale displayed structure.

## Verification and remaining acceptance

`$env:VITEST_MAX_WORKERS='2'; npm run check` passed on Windows with Node 24.20.0:
production build, oxlint/ESLint, **518 test files / 7,011 tests passed** (70 inherited skips),
coverage and Fallow. The full coverage suite took 580.94s. Coverage is **99.23% statements,
98.06% branches, 99.17% functions, 99.57% lines**. All original floors remain in force.
`npm run audit` reported zero production vulnerabilities. The four browser scenarios above passed.

[Changed-file coverage](connected-renovation-coverage.md) reports all 75 measured changed source
files, exact uncovered positions in 22 files, and overlap with added diff lines. The final run’s
covered/uncovered positions match that report. Browser evidence, repository integration and
unperformed host acceptance remain distinct.
The inherited lint-hook test timed out once at its unchanged 60s budget (104s invocation), then passed unchanged: 11 cases in 14.9s, including that SFC case in 5.4s. The environment guard also exceeded its 120s budget while repeatedly resolving the expanded import graph. A cache scoped to one collection now reuses resolved file edges; every entry still gets its own traversal and both protection assertions. Its targeted run passed in 4.45s. No threshold, skip, timeout or assertion has been relaxed. `reportOnFailure` now retains diagnostic coverage after a failed assertion; it does not change the pass criteria.

Unperformed acceptance: live Obsidian desktop/mobile, screenreader, forced-process/crash recovery,
real filesystem sync races and performance at large project sizes. FakeVault simulates failures
and conditional callback races; it does not prove host atomicity beyond Obsidian’s API contract.
There is no durable multi-file journal. Cross-floor dependencies, Trade assignment, materials,
cost reconciliation, procurement, evidence/photos, scheduling and engineering remain later work.
Strict legacy reference/calibration history can refuse after interleaved writes. Reopening and
reviewing the current state is required in that case; no history path overwrites a peer change.
Full M08–M17 or complete renovation readiness is not claimed.
