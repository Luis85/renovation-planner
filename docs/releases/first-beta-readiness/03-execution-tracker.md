# Beta execution tracker

Prepared: 2026-09-16. This is a starting template, not an execution report. Map its statuses into the repository's existing lifecycle; keep implementation, verification, and release approval separate.

## Current state

| Field | Value |
|---|---|
| Handoff baseline | `d77e7c5eba5e6518b93a5be4606532ceab3a77eb` |
| Upstream reconciled | `main` advanced 14 commits to `f3a8864a9` (asset-designer consolidation, plan deletion) and was **merged** into this branch, not rebased — every review and ledger entry references this work by commit SHA. Zero file overlap; no conflict resolved by hand. |
| Current working revision / branch | `d77e7c5eb` (identical to the handoff baseline) on branch `renovation-planner-beta-handoff-e80bb5`; session work commits on top |
| Worktree and dirty files | Worktree `.claude/worktrees/renovation-planner-beta-handoff-e80bb5`. Clean at session start. 95 other worktrees exist under `.worktrees/` and `D:/codex-worktrees/`; none was touched, reset, cleaned, or stashed. |
| Responsible integrator | Unassigned — no human integrator has accepted this work. |
| Selected beta scope / platforms | Unchanged from the handoff proposal: current editor capabilities, desktop editing, mobile read-only. Not yet confirmed by an owner. |
| Existing backlog mapping | BP-01 maps to an existing recorded repository decision (increment-history ruling R1) rather than to a new backlog item. The remaining BP identifiers are unmapped. |
| Baseline full gates | `npm run check` NOT run this session (~200 s, contends with parallel work; CI runs it on the pull request). Scoped baseline measured instead and recorded below. |
| Candidate source and bundle hashes | Not created. No production build was made. |
| Native acceptance | Not performed. No Obsidian was run. |
| Publication authorization | Not granted. |
| Next executable action | Recorded at the end of the session log below. |
| Reviews performed | BP-01 task review, two scoped re-reviews, a final whole-branch review and one scoped re-review of its fix wave. All independent subagent seats; each re-ran tests itself rather than accepting a report. |

## Package register

“Not started” means no implementation has been performed by preparation of this handoff. It does not assert that a future repository revision lacks the behaviour. Reconcile first.

| ID | Package | Priority | Dependencies | Kind | State | Owner / existing item | Evidence / next action |
|---|---|---|---|---|---|---|---|
| BP-00 | Reconcile baseline and ownership | P0 | None | Discovery | **Complete** | This session / unmapped | Five discovery lanes; every finding classified below. Scoped baseline green. |
| BP-01 | Preserve recovery incidents across remounts | P0 | BP-00 | Confirmed defect | **Complete** | This session / increment-history ruling R1 | Fixed at `67f5acf9c`, narrowed at `41d803611` and `2af92f8fd`; task review clean. Second-pane gating deferred to BP-02 — limitation L-01 — so BP-01's own acceptance set is not met in full. |
| BP-02 | Durable incident detection and recovery | P0 | BP-01 | Safety hardening | **In progress — slice 1 of 4 complete** | This session / ADR-0019 requires a decision record for slice 2 | Discovery resolved the package's opening conflict: durable detection is **outside** the recorded refusal. Slice 1 (silent compensation paths now stamp) is at `81f627b53..beda98597`. Slices 2–4 below. |
| BP-03 | Protect drafts and in-flight commands | P0/P1 | BP-01; final after BP-02 | Verification | Not started | Unassigned / unmapped | — |
| BP-04 | Precise non-drag corner editing | P1 | BP-00; integrate after BP-03 | Interaction addition | Not started | Unassigned / unmapped | — |
| BP-05 | Selection, transform, cancel and history | P1 | BP-03; coordinate BP-04 | Verification/polish | Not started | Unassigned / unmapped | — |
| BP-06 | Empty-plan and reference journeys | P1 | BP-03 | Verification | Not started | Unassigned / unmapped | — |
| BP-07 | Responsive, keyboard and accessibility | P1 | BP-04–BP-06 for final run | Verification/repair | Not started | Unassigned / unmapped | — |
| BP-08 | Representative performance and cleanup | P1 | BP-00; final integrated run | Benchmark | Not started | Unassigned / unmapped | — |
| BP-09 | Desktop/mobile support boundary | P1 | BP-00; final BP-13 evidence | Native verification | Not started | Unassigned / unmapped | — |
| BP-10 | First-use and help | P1 | BP-05, BP-06 | Onboarding | Not started | Unassigned / unmapped | — |
| BP-11 | Capability/compatibility/recovery docs | P1 | BP-00; finalize after production work | Documentation | **Partial** | This session / unmapped | Three defects closed at `cec109688` and in BP-01's own commits: `RELEASING.md`'s catalogue claim, the recovery guide's schema numbers, and the recovery guide's description of the very behaviour BP-01 changed. The compatibility table, the known-limitations section and the rest of the package remain. |
| BP-12 | Traceable production candidate | P0 | All selected production changes | Packaging | Not started | Unassigned / unmapped | — |
| BP-13 | Integrated candidate acceptance | P0 | BP-12 | Release verification | Not started | Unassigned / unmapped | — |
| BP-14 | Go/no-go and beta operations | P0/P1 | BP-13 | Owner decision | Not started | Unassigned / unmapped | — |
| BP-15 | Clean plan snapshot (optional) | P2 | Stable core; before BP-12 if selected | Proposed addition | Deferred by default | Unassigned / unmapped | — |

## Finding reconciliation

| Finding | Handoff evidence | Current classification | Reproducer / newer evidence | Decision |
|---|---|---|---|---|
| Recovery flag lost on rebind | Reverified source/test at handoff baseline | **Was still present; fixed this session** | `save-state-store.ts:73` holds `unrecoveredWrite` in Pinia; `PlanEditorView.mount()` calls `createPinia()` fresh on every mount, and `rebind()` runs `unmount()`/`sync()`. The existing test `drops a leaf's unrecovered-write flag on rebind — the recorded gap, not the desired behaviour` in `tests/plugin/rootSwapRebind.test.ts` asserted the loss and its docblock named it undesired; that case now asserts the desired behaviour under a new title. | BP-01, complete at `67f5acf9c..2af92f8fd`. Ownership now sits on the `PlanEditorView` instance and travels through Obsidian's `getState`/`setState`; the named test asserts survival instead of loss. |
| No arbitrary existing-corner non-drag route | Reverified user guide at handoff baseline | **Still true, but narrower than stated** | The gap is presentation-only. `MoveSpatialObjectCommand` already accepts a full replacement polygon and is wrapped by `ReversibleMoveZoneCommand` — the same pair the existing vertex drag dispatches. No UI reaches it without dragging; the guide and the code agree. | BP-04. A numeric form reuses the existing command; no new command is needed. Open question recorded as Q-01. |
| Native ledger is historical preparation | Reverified handoff source | **Still true** | No executed native acceptance run against a named bundle exists anywhere in the repository. | BP-13 |
| Mobile device evidence incomplete | Earlier review only | **Still true** | The mobile case's Runs table reads "Not yet run on a device". No other mobile evidence found. | BP-09 |
| Documentation drift | Earlier review only | **Changed — two confirmed, one refuted** | Confirmed: `RELEASING.md:104` still states there is no manual case catalogue while `docs/tests/cases/` holds 44 files. Confirmed: `docs/using-planning-recovery.md` cites plan schema v6 / requirement v3 / geometry v4 where the code is at v12 / v5 / v16 — its durability prose itself is accurate. Refuted: `README.md`'s contributor-only installation route is correct, not stale, because `manifest.json` is at 0.1.0 and no git tag exists, so no release has ever been cut. | BP-11, with the README item withdrawn |
| Room-heavy performance already improved | Earlier measured ledger | **Already addressed, do not reopen** | Fixed 2026-09-13; zoom at rooms=80 now measures 7.7–8.2 ms, pinned by `zoneZoomConfiguration.test.ts`. | BP-08 measures a new mixed fixture only. The historical figure is not a live defect. |
| Optional export may exist elsewhere | Not proven absent | **Not investigated** | Out of this session's scope; the optional package was not selected. | BP-15, deferred |
| *(new, found this session)* A second Plan Editor leaf on the same plan is not gated at all | Not in the handoff | **Pre-existing hole, newly identified** | Each leaf owns its own Pinia store and its own `writesBlocked`, so a second pane bypasses the incident with or without a rebind. | Deferred to BP-02 — see limitation L-01. |
| *(new, found this session)* Asset Library delete and the Project work section run compensated deletes with no shared incident gate | Not in the handoff | **Pre-existing, newly identified** | `DeleteAsset` runs the same compensated-delete machinery with no incident gate; the Renovation Project view's work section carries a separate, unrelated incident flag. | BP-02, whose scope already covers affected entity identities |

## BP-02 — what discovery established, and the slices it produced

The package opened on a conflict worth recording, because it resolved the opposite way from
what the handoff feared. The plan asks for a durable pending-operation marker written before a
destructive multi-file mutation. This repository has declined durable crash-recovery metadata
**nine times** — but every one of those declinations names a *generic automatic replay-rollback
journal*, which BP-02 also refuses. Seven are "out of scope for now"; the two architectural ones
object to automatic repair and a plugin-decided all-clear. **None is a never-do-this product
rule, and nothing anywhere declines a bare pending-operation marker.** ADR-0019's own refusal
says the sequence-marker mechanism "is not silently repurposed" — it preserves the mechanism and
asks only for a decision record before extending it, which is exactly what BP-02 action 1
specifies. The refusal names its own remedy.

More usefully: `SequenceMarkerFileStore` already **is** the shape BP-02 asks for, built for one
command family. It writes a versioned JSON file under the plugin directory before the first
mutation, refuses the whole operation if that write fails, marks finished only after the last
mutation, and is read cold at load. That is BP-02 actions 2, 3 and 4, shipped. So the package is
mostly wiring and widening rather than invention.

The census then found the thing that reordered everything: **five of six repository compensation
paths never stamped an incident at all.** A half-write on any of them was recorded nowhere, so
even the correctly-wired Plan editor never heard about it. A gate protects against incidents that
are *raised*; widening the gate first would have been fitting a better lock to a door nobody
rings.

| Slice | What it does | State |
|---|---|---|
| 1 | The silent compensation paths stamp | **Complete** — `81f627b53..beda98597` |
| 2 | Affected-entity-id identity on the stamp, a durable store, and the gate widening | Not started; needs the decision record ADR-0019 asks for |
| 3 | A future-version recovery marker must read as *unknown*, not as healthy absence | Not started; a bug against SDD §87 rule 8, not a new design claim |
| 4 | L-01's second pane, and the designer's hard-coded `writesBlocked: () => false` | Not started; falls out of slice 2 |

Slice 1 found all five census entries real and a sixth the census missed. It deliberately did
**not** add a gate, and did not widen the stamp to carry entity ids — both are slice 2. Its
accepted consequence is recorded honestly: on four of the six paths the stamp is now raised into
nothing, because those dispatching surfaces do not call `withSaveStateTracking`. That is a
visible inconsistency rather than a silent loss, and strictly better than the prior state, where
the loss was silent everywhere.

Two things slice 1 surfaced that belong to later work: `relocateEvidence` is a genuine
partial-write path with **no compensation at all**, outside slice 1's shape and unaddressed; and
`project.write-uncompensated` is the weakest stamp of the six, since its residue is an empty
folder rather than inconsistent data, so a future gate would pause writes over coherent data.

## Decisions and explicit limitations

Record the decision-maker, date, affected scope, evidence, consequence, and review trigger. Do not encode a deferral as a pass.

| ID | Decision / limitation | Owner | Date | Evidence | Release effect / revisit trigger |
|---|---|---|---|---|---|
| D-01 | Keep optional snapshot out of default beta scope | Proposed; owner confirmation pending | — | Plan BP-15 | Does not block mandatory work |
| D-02 | Recovery durability is detection and guarded manual recovery, not automatic crash replay | Proposed architecture boundary | — | Plan BP-02 | ADR required before integration |
| D-03 | Preserve desktop editing / mobile read-only unless explicitly changed | Existing scope to revalidate | — | Plan S09/S10 | Device evidence required for claims |
| D-04 | BP-01 carries incident ownership as per-leaf view-owned state through Obsidian's `getState`/`setState`, not as a session service keyed by plan id | Decided this session against the repository's recorded ruling R1 | 2026-09-16 | Increment history ruling R1, plus the same shape stated in the PBI and two task documents. The handoff's BP-01 action 3 asks for a session service; plan section 9 makes repository decisions the authority over the handoff, so R1 wins. | Consequence: BP-01's acceptance line "a new pane shows the same incident" is not met by this shape. Recorded as L-01 rather than dropped. Revisit at BP-02. |
| D-05 | An unrecovered-write flag that survives an application restart via Obsidian's persisted workspace layout is preserved, never stripped | Decided this session | 2026-09-16 | Plan section 7 names a false all-clear after incomplete writes as a no-go condition; dropping a surviving flag manufactures exactly that. | No release effect. Revisit if BP-02's durable detection supersedes the incidental persistence. |
| L-01 | **Limitation.** A second Plan Editor pane on the same plan is not gated by an open incident, before or after BP-01 | Deferred by this session | 2026-09-16 | Found during BP-00 lane A. Closing it needs the affected-identity model that BP-02 action 2 already owns. | Blocks the full BP-01 acceptance set. Must be closed or explicitly accepted by an owner before gate G1 passes. |
| D-06 | An incident, once session-scoped, is cleared only by a plugin reload — not by closing and reopening the tab | Decided this session; **owner-reviewable, it has a real UX cost** | 2026-09-16 | Today's close-and-reopen reset is an accident of view-object lifetime, not a signal that anything was repaired, and it stops existing the moment the flag is session-scoped. The alternatives were an explicit user acknowledgement (contradicts recorded ruling R1) and an integrity-check signal (nothing here has one). | A user who has genuinely repaired their vault must restart to clear the warning. Conservative direction, and plan section 7 names the opposite — a false all-clear — as a no-go. **Revisit if slice 2 produces a real integrity signal.** Not yet implemented; it binds slice 4. |
| D-07 | BP-02's durable marker is inside, not outside, this repository's recorded refusals | Established by discovery, not chosen | 2026-09-16 | Nine declinations, all naming an automatic replay-rollback journal; ADR-0019 preserves the sequence-marker mechanism and asks only for a decision record before extending it. | Unblocks slices 2–4. A decision record is still required before slice 2 integrates. |
| L-02 | **Limitation.** Four of the six newly-stamped compensation paths raise an incident no surface reads | Accepted for slice 1 | 2026-09-16 | Plan create/delete and project create dispatch from views that do not call `withSaveStateTracking`; the Asset Library imports no save-state store at all. | Closed by slice 2. Until then a user may see a warning in the editor and none in the library for the same class of fault. |
| L-03 | **Limitation.** Neither gesture that produces two editor panes on one plan is simulable in this repository's test fakes | Established this session | 2026-09-16 | Two panes arise only from Obsidian's native `duplicateLeaf` (split, drag-to-split) and from restoring a saved layout — both bypass the plugin's own reveal logic, which dedupes by plan id. | Slice 4 cannot be driven end to end by the suite and needs a manual case, exactly as BP-01's restart claim did. |
| Q-01 | **Open question.** Zone outline units are pinned to millimetres (ADR-009 / `WorldUnit`) but no origin convention for a zone outline is written in code or in the SDD | Raised this session | 2026-09-16 | BP-00 lane B. BP-04 action 2 requires the numeric form to state its coordinate system explicitly, which cannot be done until the origin is decided. | Blocks BP-04 from starting. Needs a recorded decision, not an inference from a form. |

## Native / hardware availability

| Environment | Named OS / device / Obsidian version | Available runner | Planned cases | Actual evidence |
|---|---|---|---|---|
| Desktop primary | Not yet selected | Unassigned | Full core journey | Unperformed |
| Minimum supported Obsidian | Read current manifest; verify native availability | Unassigned | Compatibility and core smoke | Unperformed |
| Additional desktop platforms claimed | Not yet selected | Unassigned | Core smoke and OS shortcuts | Unperformed |
| Screen reader | Name product/version and OS | Unassigned | Keyboard, validation, warning/focus | Unperformed |
| iOS | Actual device/Obsidian version | Unassigned | Mobile read-only and restored tabs | Unperformed |
| Android | Actual device/Obsidian version | Unassigned | Mobile read-only and restored tabs | Unperformed |
| Trackpad / pen / touch claims | Name physical device or explicitly exclude claim | Unassigned | Applicable input cases | Unperformed |

## Session log template

Copy one block for each session. Never overwrite earlier observations.

### Session — 2026-09-16 — BP-00 and BP-01

**Revision and branch:** started at `d77e7c5eb`, identical to the handoff baseline, on branch
`renovation-planner-beta-handoff-e80bb5` in the worktree of the same name. Commits added this
session are listed under Files changed.

**Worktree / existing changes preserved:** the tree was clean at the start and nothing was reset,
cleaned, stashed or force-pushed. Ninety-five other worktrees exist under `.worktrees/` and
`D:/codex-worktrees/`; none was read from or written to.

**Package and intended acceptance:** BP-00 in full, then BP-01 bounded to the settings-rebind
survival of an unrecovered-write incident. BP-02 onward were not started.

**Findings reconciled:** see the reconciliation table above. In summary: the recovery-rebind defect
is still present and unchanged; the corner-editing gap is real but presentation-only; native
acceptance and mobile device evidence are both still outstanding; room-heavy zoom performance is
already fixed and must not be reopened; documentation drift is two confirmed defects and one
refuted assumption. Two holes the handoff did not know about were found and recorded.

**Files changed:** `docs/releases/first-beta-readiness/**` (the handoff itself, committed at
`421ceab72`), then BP-01's ten files at `67f5acf9c` — `src/presentation/views/PlanEditorView.ts`,
`src/presentation/editor/save-state/save-state-store.ts`, `tests/plugin/rootSwapRebind.test.ts`,
the new `tests/presentation/views/planEditorIncident.test.ts`, the SDD's §14 and §102, and the
related issue note. Two accuracy rounds followed at `41d803611` and `2af92f8fd`, each narrowing
sentences that promised more than the code delivers, and a separate documentation commit at
`cec109688` corrected two statements BP-00 had found stale. A final whole-branch review then
returned one Critical and nine further findings, all documentation or comment accuracy; that fix
wave is the branch's last commit.

| Command / test | Environment and source | Exit / outcome | Evidence location |
|---|---|---|---|
| `npm run check:fast -- tests/plugin` | Node 24.20.0, Windows 11, clean tree at `d77e7c5eb` | 0 — 50 files / 415 tests | baseline, recorded before any change |
| `npx vitest run tests/plugin/rootSwapRebind.test.ts` | same | 0 — 14/14 | baseline |
| `npx vitest run tests/presentation/views/planEditorIncident.test.ts tests/plugin/rootSwapRebind.test.ts` | at `67f5acf9c` | 0 — 2 files / 24 tests | re-run independently by the task reviewer |
| `npm run check:fast -- tests/plugin tests/presentation/views tests/presentation/editor/save-state` | at `67f5acf9c` | 0 — 121 files / 1154 tests | task reviewer |
| `npx vitest run tests/presentation/editor/wallContextActions.test.ts` | at `67f5acf9c` | 0 — 4/4 | re-run after the implementer reported it failing; the failure did not reproduce, and is the parallelism-contention artifact this repository already documents |
| `npm run check` | — | **not run** | ~200 s and contends with parallel work; CI runs it verbatim on the pull request across four legs |
| `npm run audit` | — | **not run** | separate script, confirmed not called by `check` |
| `npx vitest run tests/release` | at `2af92f8fd` | 0 — 3 files / 19 tests | run before committing the documentation corrections, since `changelog.test.ts` is the only gate that names `RELEASING.md` |
| `npm ci` | after an unrelated process emptied `node_modules` mid-session | 0 — 413 packages | environment restore, not a code change |
| `npx vitest run tests/plugin/rootSwapRebind.test.ts tests/presentation/views/planEditorIncident.test.ts` | after the restore | 0 — 2 files / 24 tests | re-verification; a green taken before an environment wipe is not a green anybody has checked |
| `npx vitest run tests/build/{contractDiscriminates,engines,focusReach}.test.ts` | after the restore | 0 — 3 files / 74 tests | the three files reported failing during the wipe; they pass, so those 18 failures were the missing dependencies and no finding was recorded against them |

**Actually observed behaviour:** the new regressions were watched failing before the production
change — one in `rootSwapRebind.test.ts`, the single flipped expectation, and six in the new
`planEditorIncident.test.ts` — and green after it. An
incomplete-write incident now survives a settings rebind, repeated rebinds, and a close-and-reopen
of the same leaf, and is not cleared by a successful read or by an unrelated successful command.

**Implemented but not verified:** the incident is carried in Obsidian's own view state, which
Obsidian persists, so an open incident is expected to outlive an application restart. **That
expectation rests on Obsidian's documented behaviour and was not observed**: Obsidian does not run
in this environment and the test double records asks rather than performing them. The same caveat
applies to whether Obsidian reuses one view object across a close-and-reopen, which is the premise
of one test case.

**Native/device checks not performed:** all of them. No Obsidian was launched, no production bundle
was built, no device, screen reader, screenshot or performance measurement was taken. Nothing in
this session is native acceptance, and no part of it may be recorded as one.

**One environment incident, recorded because it produced a false signal.** Partway through the
session an unrelated process emptied this worktree's `node_modules` — zero entries, no test runner.
A subagent running at the time reported eighteen failures across nine `tests/build` files. The
directory was restored from the lockfile with `npm ci` and all three named files then passed,
74 of 74. Those failures were the missing dependencies and are recorded here as a false signal
rather than as findings. Git state was never affected.

**New defects / limitations / decisions:** decisions D-04 and D-05, limitation L-01, and open
question Q-01, all in the table above. Two pre-existing holes were newly identified and appear in
the reconciliation table. One finding was parked during review: a view state arriving with the flag
at an already-mounted leaf sets the field but does not seed the live store, so the gate appears one
remount late. Unreachable today; assigned to BP-03, whose subject is exactly that lifecycle
boundary.

**One method lesson worth carrying, because it cost two review rounds.** This tracker was
reviewed only at the end, and only because a whole-branch reviewer went looking outside its
package. It sits in the branch's FIRST commit, so every review range of the form
`<first commit>..HEAD` excludes it by construction — and while it was excluded it said the
defect was still open and had the watched-red counts backwards, in a document merged into the
repository as a record. A review range keyed from a branch's first commit cannot see that commit.

### Session 2 — 2026-09-16 — upstream merge and BP-02 slice 1

**Revision and branch:** merged `origin/main` (14 commits, to `f3a8864a9`) into the branch at
`e63fd94c9`. Zero file overlap with this branch's work; no conflict was resolved by hand. Merged
rather than rebased because every review record and this tracker reference the work by commit SHA.

**Package:** BP-02, bounded to its first slice. Discovery resolved the package's opening conflict
in the plan's favour; the census then reordered the package's own slices.

**Files changed:** `src/application/commands/DispatchOutcome.ts`,
`src/application/reference/undoDeleteResolution.ts`, three `ObsidianRepository` files,
`noteEntityWrite.ts`, `toUserMessage.ts`, both locale tables plus four locale submodules, and six
test files including the new `tests/presentation/editor/saveState/uncompensatedIncident.test.ts`.
Commits `81f627b53`, `31cf6bd44`, `0903525be`, `beda98597`, `92f8f1d31`.

| Command / test | Source | Exit / outcome | Evidence |
|---|---|---|---|
| `npm run check:fast -- tests/infrastructure tests/application` | `81f627b53` | 0 — 222 files / 2581 tests | reproduced independently by the task reviewer |
| `npm run check:fast` (whole tree) | `81f627b53` | 0 — 1017 files / 10982 tests, 1 skipped | implementer |
| `npx vitest run tests/presentation/editor/saveState tests/infrastructure/obsidian` | `31cf6bd44` | 0 — 60 files / 1196 tests | scoped re-review |
| `npx eslint .` | `beda98597` | **0, no output** | run by me after a prior round's equivalent claim proved wrong |
| `npm run check:fast -- tests/presentation/i18n tests/infrastructure tests/application tests/presentation/editor/saveState` | `beda98597` | 0 — 233 files / 2808 tests | me |

**A defect this branch caused and caught late.** Slice 1's added error copy pushed both locale
tables over their 400-line `max-lines` budget — `en.ts` to 402, `de.ts` to 401, against a base
that sat at 399 with one line of headroom. That is an ESLint error, so CI's lint leg would have
refused the branch, and it rode five commits unnoticed because `npm run check:fast` omits
`eslint .` by design. A fix round reported it as pre-existing, having compared against a later
commit on this same branch rather than against the base; measuring across revisions showed
otherwise. Closed by extraction into the locale submodule pattern both tables already use, not by
widening the budget — `en.ts`'s own docblock had already recorded that rule from a previous
increment that hit the same wall.

**Actually observed behaviour:** a half-written vault on any of six repository compensation paths
now stamps an incident. On the one path that reaches a live gate — zone delete, dispatched through
the Plan editor — an integration test drives the real repository failure through the real command,
the real history and the real tracking wrapper and confirms the incident is raised. It was watched
red by mutating the compensation to rebuild the error field by field, which is the re-wrap hazard
that would have made the slice a no-op where it matters.

**Implemented but not verified:** nothing in this slice was exercised in a real vault. Every
failure arm is driven through injected-failure keys on the in-memory fakes, and whether the real
Obsidian API produces those failure shapes in these sequences is unchecked. The German copy was
checked against its English rows by reading, not by a native speaker.

**Native/device checks not performed:** all of them, again. No Obsidian was launched and no
production bundle was built.

**New limitations:** L-02 and L-03, with decisions D-06 and D-07, all in the table above.

**One next executable action:** BP-02 slice 2 — affected-entity-id identity on the stamp, a
durable store, and the gate widening. It is the slice that needs the decision record ADR-0019's
own refusal asks for, and it closes L-02. Take its scope from the lane reports, and note that
`relocateEvidence` (a partial-write path with no compensation at all) belongs in it.

---

**One next executable action (as recorded at the close of session 1, superseded by session 2's
entry above):** BP-00 finding 4's two confirmed documentation defects were closed at `cec109688`,
so the next action is **BP-02**. It owns the second-pane gate (L-01), the ungated `DeleteAsset`
compensated delete, and one thing session 1 found that no earlier document records:
`src/presentation/designer/runtime.ts:318` wires the Asset Designer to the same
`withSaveStateTracking`, so a designer write **can** raise an incident, while `:395` hard-codes
`writesBlocked: () => false`. A half-written asset is raised and read by nobody.

## Candidate identity record

Keep a new record for each production candidate. Evidence belongs to the recorded artifact, not merely the current branch name.

| Field | Value |
|---|---|
| Candidate ID | Unassigned |
| Source SHA / tree state | Not recorded |
| Manifest / package version | Read actual candidate files |
| Lockfile identity / build environment | Not recorded |
| `main.js` SHA-256 | Not recorded |
| `manifest.json` SHA-256 | Not recorded |
| `styles.css` SHA-256 | Not recorded |
| Installation destination | Isolated vault only; path not yet selected |
| Installed bytes verified equal | Not checked |
| Full quality gate and dependency audit | Not run for candidate |
| CI exact-commit result | Not inspected for candidate |
| Native matrix / outcomes | Not run |
| Supersedes candidate | None |
| Evidence invalidated by later changes | None recorded |

## Gate state

| Gate | State | Required evidence / decision |
|---|---|---|
| G0 — baseline known | **Passed** | BP-00 complete: source identity recorded, every finding classified, scoped baseline green and unmodified, ownership recorded as unassigned. |
| G1 — data trust | Not evaluated — **blocked by L-01** | BP-01's rebind survival is implemented and tested; the second-pane bypass (L-01) and all of BP-02 and BP-03 remain. G1 cannot pass while an open incident can be bypassed by opening another pane. |
| G2 — core journey | Not evaluated | BP-04–BP-07 |
| G3 — support and first use | Not evaluated | BP-08–BP-11 |
| G4 — actual candidate | Not evaluated | BP-12–BP-13 |
| G5 — distribution authorization | Not granted | BP-14 owner decision |

## Go/no-go record

**Decision:** Not made.

**Release owner / date:**

**Candidate identity:**

**Blocking issues:**

**Accepted non-safety limitations and their scope:**

**Supported versus unverified environments:**

**Installation / backup / compatibility / recovery materials checked:**

**Explicit publication authorization and channel:** None.

**Post-beta follow-up:**
