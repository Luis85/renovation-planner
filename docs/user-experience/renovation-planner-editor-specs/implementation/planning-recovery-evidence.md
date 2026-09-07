# Increment E: connected recovery and reliable planning

This is a bounded implementation-plan Phase 12/M15 continuation of PR #88, based on
`codex/materials-costs-evidence` at `3c1c737a5bfaf0a9e4782f1cbfe2ec4e0aca7f6a`.
It preserves the Vue/Pinia/Konva editor, guarded command/services, repositories and schemas.
It does not mark all M00–M17 criteria or a release complete.

## Production behavior and traceability

| Contract | Implementation and verification |
| --- | --- |
| Confirmed save followed by read failure | Per-leaf planning read state retains its valid baseline; combined runtime hydration qualifies Saved, shows persistent M15 retry/source actions and blocks unsafe writes/history. `planningRecovery.test.ts` asserts exactly one write across two failed retries and recovery. |
| Recoverable draft | Planning and renovation forms keep their captured target, baseline, text and editable fields while Apply pauses. Shared DraftRecovery offers read-only retry and source inspection; disappearing recovery restores focus within the form. Existing conflict/version checks still refuse a peer-changed baseline. |
| Different failure classes | Validation/write/conflict messages remain distinct; unexpected hydration rejection becomes a read failure. Uncompensated operations keep a sticky mount-local warning even after successful read. Existing conditional compensation tests remain authoritative; there is no general durable journal. |
| Latest read and disposal | `latest-read.ts` coalesces requests, skips obsolete planning results and resolves outstanding waiters on disposal. ProjectStore cancels hydration tickets. Unit tests drive queued/active disposal, reentrancy, rejected reads/publication and retained spatial data. |
| Evidence freshness | Stored and resolved relative paths, including folder prefixes, invalidate evidence resolution only. Mutable thumbnail resources carry the evidence revision in their query so successful images reload too; immutable data/blob URLs retain their identity. Errors reset when resolution changes; lazy images use async decoding. Registered host rename updates the index before repairing self-links. |
| Review and shopping | All-clear waits for successful planning data and both finding lists. Source measurement changes mark stale even with unchanged packaging. Shopping checks every material before filtering outstanding quantities. Generated Review uses one fresh planning baseline for both finding families and title. |
| Keyboard, themes and locale | Native controls drive the complete planning journey, including modal focus/Escape, retained drafts and history. Selected records have explicit text/ARIA state. Warning body text uses normal contrast with severity label/border; passive status uses muted text. Decimal-string formatting keeps currency identity and EN/DE grouping without binary money conversion. |

`planningFormat.test.ts` covers very large precise decimal strings, negative values, trailing
zeros, scientific-notation quantities, rounding and language fallback. Repository-backed forms
accept comma decimal input for material and cost facts. Existing locale parity/error, date and
pluralization tests remain part of the full gate; this slice adds no new dates or plural forms.

PR #90 review 3945673161 found that renovation Apply's ARIA state did not reflect a recovery
pause although its submit handler refused the action. A shared `submitBlocked` computation now
drives both, while the separate field-freezing state still permits recoverable text edits.
The repository-backed regression first enters Apply, fails the background planning read,
checks `aria-disabled`, edits the retained draft, verifies blocked submission leaves bytes
unchanged, retries and saves exactly once. It reproduced the false enabled state before the fix.
The browser artifacts below were captured at `26b693bd`; this follow-up changes the ARIA state
and shared submit guard only, and its recovery behavior is verified by that focused regression
and the subsequent complete gate rather than a repeated visual-layout claim.

## Original review fixes before the topic

The three original #88 findings were fixed first on its existing branch in
`3006915e8019dec66b24c945710495df48336582`. Review comments 3944979991, 3944979993 and
3944979994 received that SHA and verification and were resolved after pushing. Full check:
534 files, 7,224 passed/70 existing skips; statements 99.11%, branches 98.01%, functions
99.08%, lines 99.43%; build, both linters and Fallow passed. Four original keyboard/browser
journeys also passed. The topic incorporates the later #88/predecessor corrections through
3c1c737a rather than discarding them.

Subsequent #88 evidence rename, thumbnail recovery, fully procured stale shopping and
mixed-baseline Review findings are covered here. The latter two were reproduced red against
real repository writes before correction: a stale fully purchased row returned an empty
shopping body; an on-disk peer proposal was missing from the generated Review before its
notification reached Pinia.

Parallel review work remains separately attributed. The actual-to-committed settlement-link
correction is pushed in `5824f92c0482d0b16ceb7b10410a46e9688e2936` in
[UI PR #89](https://github.com/Luis85/renovation-planner/pull/89), not in this branch. Its owner
reports a passing 3-file/15-test focused run and a passing 544-file/7,280-test full suite, whose
branch-coverage gate still failed at 97.83%. The existing-only Evidence navigation correction
is owned by the integration task. Neither is counted as a verified fix in this slice.

## Measurement method and targets

Environment: Windows, 8 GB RAM, Node **24.20.0**, worktree-local Vitest **4.1.11** and
Playwright Core **1.62.1**, with the lockfile-installed Vite/Vue build and headless
Microsoft Edge **152.0.4191.62**, explicitly selected with `RP_CHROMIUM_EXECUTABLE` because
the pinned Playwright Chromium was unavailable. This is a declared browser substitution.
Heavy gates/browser runs were serialized with other active repository tasks.

Reusable `largePlanningBaseline` creates **80 rooms, 240 material requirements, 24 assets and
40 photo records**. The browser persists it through actual application repositories over
FakeVault and provides 40 synthetic **1600 × 1200** PNG resources. Forty image elements are
mounted; lazy loading means this is not a claim that all forty images decoded simultaneously.

Before optimizing the Review projection, it prepared materials **19,440** times and took
**658.88 ms** on this fixture. Preparing once for all room cost findings reduces the count to
**240** (98.77% fewer calls). The stable call count is the regression assertion; timing is
reported separately and is not a raised budget or a flaky suite threshold. The uninstrumented
focused rerun measured **36.80 ms** after the change, versus 658.88 ms before (94.41% lower
elapsed time in these samples). Timing is host-sensitive; call counts are the stronger evidence.
The [raw comparison](evidence/planning-recovery/projection-performance.json) preserves both
samples and their method separately from coverage-instrumented runs.

The final expanded browser matrix on 2026-09-07 measured the following, including browser-driver
round trips. [Raw report](evidence/planning-recovery/report.json).

| Scenario | Usable floor ≤1500 ms | Selection ≤100 ms | Inspector ≤200 ms | RAF median / p95 |
| --- | ---: | ---: | ---: | ---: |
| Light, 1440 px | 667.5 | 52.4 | 65.9 | 16.7 / 17.0 ms |
| Dark, 1440 px | 693.1 | 49.4 | 67.5 | 16.7 / 16.9 ms |
| Custom accent, 1000 px | 676.1 | 46.9 | 63.1 | 16.7 / 16.9 ms |
| German dark, 460 px | 691.1 | 79.3 | 59.3 | 16.7 / 17.1 ms |

Usability times measure a warm editor mount, excluding Vite cold compilation. RAF samples
(59 per scenario) cover middle-button pan plus wheel zoom; they demonstrate headless callback
cadence against the 60 fps target/30 fps minimum, not GPU compositing or live Obsidian latency.
Three close/reopen cycles per scenario (12 total) leave **zero listeners, Konva stages, image
elements and tracked object URLs** at each close. The existing seven-layer Konva advisory
remains; measured evidence did not justify a renderer rewrite.
These counters measure explicit registrations, DOM ownership and tracked URL ownership;
they do not measure garbage collection, retained heap or the browser's decoded-image cache.
Evidence uses host resource URLs, so its image fixture does not itself mint object URLs.

Original unrelated-event reproduction: 31 raw vault changes caused 31 whole planning reads.
The corrected browser journey sends **100 unrelated events → zero reads** and a linked image
event → zero planning reads. **100 same-turn typed events → one planning read** in each
scenario. A delayed unit-test burst proves one active read plus one latest follow-up rather
than dropping the final state. Evidence-only invalidation also avoids material recalculation.

## Browser acceptance and limitations

`scripts/editor-recovery-check.mjs` extends the existing planning browser journey. It drives
Room → Existing → Planned → Work → Materials → purchased/reserved allocations → Costs →
partial payment → documents/photos/notes → Review using Tab, native select arrows, typing,
Enter and Escape. It covers evidence history, cancellation, a successful save followed by
failed read-back/two failed retries, modal recovery without replay, and a source measurement
change that leaves 100-pack quantity and cost unchanged.

The four-scenario matrix uses the actual editor DOM and production CSS. All four journeys pass
with no page errors. After an earlier visual inspection found faint light warning text, warning
and retained-dialog scans were added and text contrast corrected. The final **12 axe scans**
(normal changed-source view, persistent warning, retained modal in each scenario) report
**zero WCAG 2.2 AA-tagged violations**. German normal/warning scans each retain one incomplete
color-contrast check on `button[data-rp-rail="details"]`: axe cannot parse the computed
`oklch(0.999994 0.0000497986 none / 0.067)` background. These are two instances of a known
instrument limitation, not automated contrast passes. The other ten scans have no incomplete
checks. Raw per-state axe JSON is preserved beside the report; no rule was disabled.

200% CSS layout zoom preserves draft `13,5`, focus and keyboard Cancel without horizontal
dialog overflow (446/446 px full-theme cases, 426/426 px German). This is a layout surrogate;
native Obsidian zoom and physical-device testing remain separate. Screenshots were visually
inspected for warning/source/retry access, German wrapping/decimal totals, preserved draft text
and image-heavy custom-theme inspection. Scrollable vertical content remains intentional.
The harness-only theme badge overlaps part of the footer in the screenshots; DOM assertions
verify the localized save label, and this is not evidence of native Obsidian footer layout.

Representative inspected captures:
[light warning](evidence/planning-recovery/light-saved-refresh-needed.png),
[dark warning](evidence/planning-recovery/dark-saved-refresh-needed.png),
[German warning](evidence/planning-recovery/german-constrained-saved-refresh-needed.png),
[German retained draft](evidence/planning-recovery/german-constrained-retained-draft.png),
[German costs](evidence/planning-recovery/german-constrained-costs.png),
[custom-theme photos](evidence/planning-recovery/custom-accent-large-photos.png).

| Acceptance | Status |
| --- | --- |
| Connected recovery and locale implementation | Implemented; focused automatic tests and browser journey evidence |
| Full required gate | Passed at `66bcd0d0`: 541 files, 7,259 tests, 70 existing skips; all unchanged coverage floors, build, both linters and Fallow. Later review follow-up uses targeted checks below; exact historical counters in [coverage ledger](planning-recovery-coverage.md) |
| Expanded warning/dialog axe and latest-source browser matrix | Four journeys and 12 scans passed with zero violations; two explicitly incomplete contrast checks |
| Live Obsidian desktop/mobile | Not performed by this slice; integration acceptance tracked separately |
| Manual screen reader, native zoom, physical touch/pointer | Not performed |
| Durable planning transaction journal/restart repair | Not implemented or claimed |
| Global M00–M17/release acceptance | Still open; this table covers only demonstrated criteria |

User instructions for safe retry, conflicts, backups and actual in-memory migrations are in
[Working with saved data](../../../using-planning-recovery.md).

## Reproduction

```powershell
$env:VITEST_MAX_WORKERS='2'
npm run check
$env:RP_CHROMIUM_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/editor-recovery-check.mjs
```

Ignored `harness-shots/recovery/` holds logs; diagnostic coverage HTML is outside the repository
because generated JavaScript there would enter lint's scan. The matrix writes screenshots/JSON
to `harness-shots/planning-recovery/`. Selected final evidence is copied beside this document.

## Review follow-up — evidence path and Room names

PR #90 comments `3945749013` and `3945749016` found two remaining regressions. The evidence
path is now editable during planning-read recovery, while busy/working state still freezes it
and the separate write gate still blocks file creation, import and Apply. A repository-backed
test revises the focused path through failure and read-only retry, verifies the retained value
and unchanged vault bytes, and asserts that both file actions and Apply remain blocked.

Generated Review notes still derive their finding set and title from the fresh planning
baseline. Renovation lines resolve each Room's readable name from the display map and fall
back to its ID if missing, with the same Markdown escaping. The peer-change regression now
checks both named and missing-Room cases before a refresh notification arrives.

Both regressions failed against `66bcd0d0` (2 failed, 12 passed). This is an intermediate review
checkpoint under the integration task's targeted-verification instruction. A new full coverage
or browser run is not claimed here; finalization owns the combined gate, at unchanged floors.

After the fixes, both focused files passed **14/14 tests** (17.18 s, two workers).
`npx vue-tsc -noEmit`, whole-project `npx oxlint --deny-warnings`, ESLint over the two changed
Vue components and their two regression files (`--max-warnings 0`), and `git diff --check`
all passed. No repository schema, exclusion or threshold changed.

## Review follow-up — Evidence selection announcements

PR #90 comment `3945879365` identified a mismatch between the visual selection and its
announcement when Documents opens from a material or cost. One nonempty-focus predicate now
drives the row highlight, title `aria-current` and localized Selected text. Direct evidence
selection and linked-record selection agree; idle unlinked evidence stays unselected.

Repository-backed workflow regressions exercise the real material and cost Documents buttons,
direct selection of linked and unlinked evidence, and all three selection channels. Against
`7ba5937d` the focused workflow file produced **2 failures and 21 passes**, reproducing both the
missing linked announcement and the empty-ID false selection. An existing exact-title lookup
was updated to include the newly correct Selected text. This review checkpoint follows the
integration task's targeted-verification contract; the historical full-gate counters remain
attributed to their original revision, and finalization owns the combined unchanged-floor gate.

The final three-file planning workflow/recovery/Review run passed **37/37 tests** (21.93 s,
two workers). `npx vue-tsc -noEmit`, whole-project `npx oxlint --deny-warnings`, ESLint over
the changed component and workflow regression file (`--max-warnings 0`) all passed.

## Review follow-up — Unrecovered write guidance in drafts

PR #90 comment `3945997046` identified misleading read-retry guidance after a command reports
uncompensated writes. The shared DraftRecovery panel now reads the existing per-editor
SaveStateStore flag, which is the actual pause cause. It offers source-note inspection and
the dialog's existing Cancel action with distinct EN/DE guidance, hides read retry and guards
a previously captured retry handler. Normal failed-read recovery retains its existing retry.
Callers, including Planning and Renovation forms, need no new props or parallel state.

Repository-backed form regressions inject a marked uncompensated command result through the
real dispatcher for both workflows. They verify one command attempt, a retained editable
draft, source inspection, blocked subsequent submissions, no retry after successful hydration,
unchanged fixture vault bytes and Cancel. A separate transition case exercises a captured
retry control after the unrecovered state supersedes a read failure. These UI tests do not
claim to repair actual partial files or add durable restart recovery.

The four-file planning recovery/workflow/Review/localization run passed **65/65 tests**
(22.42 s, two workers). The first run exposed a test spy attached to a copied runtime callback;
the assertion now checks the actual host-note-open counter. Oxlint required an explicit mock
function type on the injected command; that annotation was added without changing behavior.
Final `npx vue-tsc -noEmit`, whole-project `npx oxlint --deny-warnings`, changed-file ESLint
(`--max-warnings 0`) and `git diff --check` passed. English wording also follows the required
sentence-case rule. This intermediate review checkpoint uses the authorized targeted gate;
finalization still owns the combined coverage/Fallow run at unchanged thresholds.

## Obsolete spatial reads and detached refresh failures — 2026-09-07

Review comments 3946066535, 3946066536 and 3946066538 exposed three additional boundaries.
Coalescing a refresh that already mutates stores did not retire its active hydration ticket.
A queued replacement now invalidates both the ProjectStore and Inspector tickets immediately,
keeps the existing scene and stale state while waiting, and skips the obsolete hydration's
Inspector query. Superseded Inspector reads stop before requesting requirement rows; their
late results cannot publish. The coalescer continues to the queued latest read after an
obsolete rejection, and disposed callers neither query nor reactivate the retired store.

A missing Plan now shows its Close action without a contradictory planning retry warning.
Initial, event-triggered and warning-triggered detached refreshes share the existing fault
reporter; unexpected Inspector or requirement-query rejection is handled without changing a
successful write into a failed write or discarding the displayed DTO.

The new regressions reproduced obsolete geometry and Inspector publication, loss of the
queued follow-up after rejection, and unhandled Inspector/requirement failures against the
previous production source. The missing-Plan fixture initially used a helper requiring a
canvas; after switching to the ordinary editor mount, it reproduced the extra retry warning.
Peer geometry and name changes use real repositories. Targeted verification at `f252606b` passed
**80/80 tests in seven files** (18.18 s, two workers), with no unhandled errors. A separate
coalescer coverage run passed 7/7 tests and measured 40/40 statements, 14/14 branches,
9/9 functions and 22/22 lines. Coverage thresholds and exclusions are unchanged.

Type checking, changed-file ESLint and Fallow passed at that checkpoint, but the last loop
simplification was not rechecked with Oxlint. CI passed the build and then rejected
`while (alive)` because the flag changes outside the loop. The correction separates the read
attempt from lifecycle/publication decisions and restores the explicit loop exits, without a
suppression. Its 14 focused regressions pass (44.73 s); fresh isolated coverage measures
43/43 statements, 14/14 branches, 10/10 functions and 24/24 lines. Whole-project Oxlint,
vue-tsc, scoped ESLint, Fallow and diff checks pass on the corrected source. A shared notice
spy initially retained calls between parameterized
cases and now restores itself after each case.

Fallow's CRAP inputs remain the prior full coverage artifact. This is the authorized targeted
review gate, not a fresh whole-project coverage run or final integrated browser acceptance.

## Draft retry query failures — 2026-09-07

PR #90 review 3946364283 identified a remaining detached refresh boundary: the draft recovery
button called the raw runtime refresh. Inspector or requirements query rejections escaped
through Vue's native event handler. Both form entry points now supply a guarded retry
callback using the existing fault reporter and the editor's existing lifetime flag. The
callback reports once while the editor is open, while the shared recovery component continues
to reset its reading flag. Runtime refresh and successful-write tracking retain their existing
failure semantics.

Four repository-backed cases reproduced the missing report and four unhandled rejections
against `00adf082`; two disposal cases passed there already. The six new cases cover planning
and renovation drafts, Inspector and requirements failures, retained values, unchanged vault
contents, another successful read-only retry and disposal during a pending query. All **56
tests in six related files passed** on the corrected source (31.00 s, two workers), with no
unhandled errors. Type checking, whole-project Oxlint, changed-file ESLint, Fallow and diff
checks passed. Fallow still uses prior full coverage: placing the new helper after the
existing actions preserves their source positions for that artifact. Its initial placement
shifted the unchanged `change` function and produced an unmatched-coverage CRAP finding;
the final run reports zero dead-code, duplication or complexity findings. This is not fresh
whole-project coverage. The full combined gate and final browser evidence remain separate.

## Room pauses, changed image bytes and repeated rail activation — 2026-09-07

PR #90 reviews 3946488461 and 3946488464 exposed two adjacent gaps. Room rename/resize now
consume the runtime's complete write gate, including planning failure and unrecovered writes,
for their opener, retained form and commit guard. The existing saving pause remains. Native
fields stay focused with their text intact and announce read-only while Apply is unavailable.
Read-only hydration restores an ordinary planning pause, but does not clear an unrecovered write.

EvidencePreview now adds a revision query token to mutable resource URLs. It preserves existing
query parameters and fragments and leaves immutable data/blob sources intact. A previously
successful image therefore receives a different source when its file changes in place; failed
thumbnail recovery, labels, lazy loading and async decoding remain. This uses the existing
evidence event revision and adds no planning read or separate preview store.

The UI task's preliminary German journey also found repeated rail activation leaving focus
on the rail because the overlay value did not change. PanelRail now explicitly focuses the
visible panel after its opening render, unless the panel already owns focus. The target may
disappear during reflow; that case leaves focus with the persistent region. Escape from the
focused panel closes it and returns to its rail without clearing the Room selection. The
target classes are shared with the persistent outlets in finalization; execution on that
combined source remains separate from the verified older overlays on this PR.

The preceding source reproduced **seven failures**: four Room gate cases, two repeated-rail
cases and the successful same-URL image case. The corrected source passed **119 tests in nine
files** (34.78 s, two workers), including the established Room naming/resizing, responsive shell,
planning form/workflow and recovery cases. These tests use actual mounted editor controls and
repository-backed Room fixtures; native Escape is dispatched on the focused node. No additional
browser/performance matrix ran for this follow-up; the final shared run remains authoritative.

Type checking, whole-project Oxlint, changed/new-file ESLint and Fallow passed after adding the required mock
type parameter. Fallow uses the previous full coverage artifact and reports zero dead-code,
duplication or complexity findings. A separate 10-test V8 run over the thumbnail URL helper and
PanelRail measured 100% across 17 statements, 14 branches, five functions and 13 lines. That
targeted measurement does not replace full combined coverage; no floor or exclusion changed.
