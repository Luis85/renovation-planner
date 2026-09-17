# Beta execution tracker

Prepared: 2026-09-16. This is a starting template, not an execution report. Map its statuses into the repository's existing lifecycle; keep implementation, verification, and release approval separate.

## Current state

| Field | Value |
|---|---|
| Handoff baseline | `d77e7c5eba5e6518b93a5be4606532ceab3a77eb` |
| Upstream reconciled | `main` advanced 14 commits to `f3a8864a9` (asset-designer consolidation, plan deletion) and was **merged** into this branch, not rebased — every review and ledger entry references this work by commit SHA. Zero file overlap; no conflict resolved by hand. |
| Current working revision / branch | `2546d88d8` on branch `renovation-planner-beta-handoff-e80bb5`. Nothing pushed; no pull request opened. Three sessions of work sit on top of the handoff baseline `d77e7c5eb` and the merged upstream `f3a8864a9`. |
| Worktree and dirty files | Worktree `.claude/worktrees/renovation-planner-beta-handoff-e80bb5`. Clean at session start. 95 other worktrees exist under `.worktrees/` and `D:/codex-worktrees/`; none was touched, reset, cleaned, or stashed. |
| Responsible integrator | Unassigned — no human integrator has accepted this work. |
| Selected beta scope / platforms | Unchanged from the handoff proposal: current editor capabilities, desktop editing, mobile read-only. Not yet confirmed by an owner. |
| Existing backlog mapping | BP-01 maps to an existing recorded repository decision (increment-history ruling R1) rather than to a new backlog item. The remaining BP identifiers are unmapped. |
| Baseline full gates | `npm run check` is **RED, and not because of this work** — its `analyze` leg fails on `origin/main` itself. See limitation **L-04**, which carries the measurement. Its other three legs are green: `npm run build` 0, `npx eslint .` 0, and one clean uncontended `npm run test:coverage` at 1023 files / 11025 tests with thresholds met. |
| Candidate source and bundle hashes | Not created. No production build was made. |
| Native acceptance | Not performed. No Obsidian was run. |
| Publication authorization | Not granted. |
| Next executable action | Recorded at the end of the session log below. |
| Reviews performed | Across three sessions. Session 3 alone: five task reviews, six scoped re-reviews and a final whole-session review, every one an independent subagent seat instructed to re-run the instruments rather than accept a report. Three of its five task reviews returned spec ❌, and two findings were real defects rather than wording — an unbounded re-seed of the incident registry on every settings save, and a module global released without checking it was still the one that load claimed. |

## Package register

“Not started” means no implementation has been performed by preparation of this handoff. It does not assert that a future repository revision lacks the behaviour. Reconcile first.

| ID | Package | Priority | Dependencies | Kind | State | Owner / existing item | Evidence / next action |
|---|---|---|---|---|---|---|---|
| BP-00 | Reconcile baseline and ownership | P0 | None | Discovery | **Complete** | This session / unmapped | Five discovery lanes; every finding classified below. Scoped baseline green. |
| BP-01 | Preserve recovery incidents across remounts | P0 | BP-00 | Confirmed defect | **Complete** | This session / increment-history ruling R1 | Fixed at `67f5acf9c`, narrowed at `41d803611` and `2af92f8fd`; task review clean. Second-pane gating deferred to BP-02 — limitation L-01 — so BP-01's own acceptance set is not met in full. |
| BP-02 | Durable incident detection and recovery | P0 | BP-01 | Safety hardening | **In progress — slices 1 and 2 of 4 complete** | This session / ADR-0019 requires a decision record for slice 2 | Discovery resolved the package's opening conflict: durable detection is **outside** the recorded refusal. Slice 1 (silent compensation paths now stamp) is at `81f627b53..beda98597`. Slice 2 — ADR-0034, affected-entity identity, the durable record and the coarse gate — is at `4599a388e..f05d5d62f` and closes L-02. Slices 3–4 below. |
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
| 2 | Affected-entity-id identity on the stamp, a durable store, and the gate widening | **Complete** — `4599a388e..f05d5d62f`. ADR-0034 is the decision record ADR-0019 asked for. |
| 3 | A future-version recovery marker must read as *unknown*, not as healthy absence | **Complete** — `60a748423..037782ed0`, nine commits across the change and two fix rounds |
| 4 | L-01's second pane, the designer's hard-coded `writesBlocked: () => false`, and now L-05's two unguarded editor commands | **One of three parts complete.** L-05 closed at `e6cdd914b..2546d88d8` (five commits, three review rounds). The second pane (L-01) and the Asset Designer are **designed, briefed and NOT started** — see the session 4 log. L-06 was ruled on and its task briefed, not started. |

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
| L-02 | **Limitation, now CLOSED.** Four of the six newly-stamped compensation paths raised an incident no surface read | Accepted for slice 1; closed 2026-09-16 | 2026-09-16 | Plan create/delete and project create dispatch from views that do not call `withSaveStateTracking`; the Asset Library imports no save-state store at all. | **Closed at `4599a388e..f05d5d62f`.** The gate now sits in `guardCommand`, through which every guarded command passes, so a stamp no longer needs a per-surface reader: an open incident refuses the next guarded command whatever surface dispatched it, and the diagnostics report names every open incident. |
| L-03 | **Limitation.** Neither gesture that produces two editor panes on one plan is simulable in this repository's test fakes | Established this session | 2026-09-16 | Two panes arise only from Obsidian's native `duplicateLeaf` (split, drag-to-split) and from restoring a saved layout — both bypass the plugin's own reveal logic, which dedupes by plan id. | Slice 4 cannot be driven end to end by the suite and needs a manual case, exactly as BP-01's restart claim did. |
| Q-01 | **Open question.** Zone outline units are pinned to millimetres (ADR-009 / `WorldUnit`) but no origin convention for a zone outline is written in code or in the SDD | Raised this session | 2026-09-16 | BP-00 lane B. BP-04 action 2 requires the numeric form to state its coordinate system explicitly, which cannot be done until the origin is decided. | Blocks BP-04 from starting. Needs a recorded decision, not an inference from a form. |
| L-04 | **Limitation.** `npm run check` cannot go green on this branch, and the cause is not this branch | Measured this session | 2026-09-16 | `npm run analyze` exits 1 with “dupes (4 clone groups), health (1 above threshold)”. Three clone groups are `scripts/editor-usability-combined-check.mjs` against `scripts/editor-usability-fidelity-check.mjs`, the fourth is an intra-file pair in `ObsidianPlanGeometrySidecar.ts`, and the health target is `renovationSummary.ts`. `git diff --name-only f3a8864a9..HEAD` over all four paths returns nothing — this branch has never touched one of them — and the last commit to touch each (`499303fc7`, `c444fa3c0`) is an ancestor of `origin/main`. `package.json` runs bare `npm run analyze` inside `check`. Dead files 0.0%, dead exports 0.0%. | **A red CI leg on this pull request must be read against this row before it is attributed to BP-02.** Clearing it is separate work on main's own duplication. |
| L-05 | **Limitation, now CLOSED.** Two Plan editor commands were not covered by the vault-wide gate | Found in review 2026-09-16; closed 2026-09-17 | 2026-09-16 | `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand` are constructed unguarded against the raw repository at `inspector-wiring.ts:99` and `:101`, so `guardCommand` never sees them; `runtime.ts:607`'s `writesBlocked` is computed from project staleness or `unsafeHistory()`, and `unsafeHistory` reads the PER-LEAF Pinia flag rather than the vault-scoped registry. So an incident raised elsewhere leaves those two working. Every other editor write dispatches through the guarded services and IS refused. | **Closed at `e6cdd914b..2546d88d8`.** Both adapters now cross guarded factories composed in `planEditorDeps.ts`, mirroring `calibratePlan`; `guardCommand` did not enter `presentation/`. BOTH doors of both are guarded — `execute` and `undo` — which also narrows, for these two only, the undo/redo category ADR-0034 records as open. ADR-0034 carries a dated 2026-09-17 correction and the user guide no longer names these two as outside the pause. **A first round of tests passed with the fix fully reverted**; they were replaced with a case entering at the real `createInspector`. |
| D-08 | Nothing in the plugin retires a write incident — not a control, not a reload, not a later successful write | Decided this session, recorded in ADR-0034 | 2026-09-16 | Ruling R1 says the flag is set and never unset; two of the nine recorded declinations object specifically to a plugin-decided all-clear; and `docs/using-planning-recovery.md` already told users there is no “I have repaired this” control. Retirement is the user removing `write-incidents.json` after verifying against a backup, made discoverable by the diagnostics report. | **Deepens D-06 rather than easing it:** a reload used to clear a session-scoped incident and now does not, because the record outlives the process. Owner-reviewable, with a real cost to a user who has genuinely repaired their vault. |
| L-06 | **Limitation.** A stamp raised outside a `guardCommand` call stack never becomes a durable incident, and nothing checks the category | Found by the final whole-increment review; deferred | 2026-09-16 | `reversible-delete-zone-command.ts` stamps inside the adapter's UNDO callback, reached through `inspector-wiring.ts` and `createZoneHistory.ts` and dispatched by `CommandHistory` in presentation against the raw `commands.zones` port — never through `guardCommand`, so that stamp is never recorded. The real boundary is a CATEGORY larger than the paths ADR-0034 lists by name. CLAUDE.md's own rule is that a category invariant is checked at the forbidden thing, not by listing the places. | ADR-0034 now states the category and records that no check exists. Building that check is its own increment; until it exists, a raise site added outside a guarded stack turns nothing red. |
| L-07 | **Limitation.** The incident GATE is process-scoped while the incident RECORD is vault-scoped | Found by the final whole-increment review; stated, not fixed | 2026-09-16 | Two Obsidian windows on one vault hold separate registries, each seeded once at its own load, so an incident recorded in one never closes the other's gate. `WriteIncidentFileStore.add` is a read-modify-write serialised by a PER-PROCESS queue lane, so a concurrent add from another process can drop a record. | Recorded in ADR-0034 and in the store's docblock. Whether two windows on one vault is a supported configuration is an owner question, and it has never been exercised here. |
| L-08 | **Limitation.** An unwritable or unreadable plugin folder silently defeats durability | Found by the final whole-increment review; stated, not fixed | 2026-09-16 | A failed envelope write logs `incident.write-failed` and nothing more: the session stays blocked, but the NEXT load finds no file and manufactures exactly the all-clear ADR-0034 refuses. Once the file is unreadable, `add` refuses at its read step, so no further incident ever persists. | Recorded in ADR-0034 and the store docblock narrowed to what is true. Durability rests on the plugin folder being writable; where it is not, an incident is session-scoped only. |
| L-09 | **Limitation.** Deleting the incidents file takes effect only after a plugin reload | Found by the final whole-increment review; copy corrected rather than behaviour | 2026-09-16 | Nothing re-reads the incidents file after load: the open list is append-only and its seed is one-shot. Three surfaces told the user that deleting the file resumes writing, so a user who did that and retried received the identical refusal with no stated way out. The behaviour matches D-06, which already accepted that only a reload clears an incident; the copy simply never said so. | Both locales and the user guide now name the reload. **NOT exercised in a vault** — see the session 3 unverified list. |
| L-10 | **Limitation.** An unreadable sequence marker is reported only in the console | Decided 2026-09-17 as slice 3's scope boundary | 2026-09-17 | `GetDiagnosticsSnapshot` could carry unreadable markers the way it carries write incidents, and deliberately does not: an unreadable entry cannot supply a `DiagnosticEntityKind`, because its `entityKind` is exactly what failed to parse, and that union is closed and hand-written. The level is `error`, always emitted by `createConsoleLogger` regardless of the verbose-logging setting — verified in that file rather than assumed. | A user whose vault holds a marker this build cannot read sees nothing in the plugin's own UI and must open devtools. The vault is undamaged and the record is preserved. Revisit when the diagnostics snapshot next changes shape. |
| L-11 | **Limitation.** What is OUTSIDE the vault-wide pause is neither listed nor checked anywhere | Measured 2026-09-17; stated, not fixed | 2026-09-17 | Measured by reading all thirteen reversible adapters against the single gate: `grep -rn "activeWriteIncidentRegistry()" src/` prints six lines and exactly one is the gate, inside `guardCommand`, which returns one door. **Outside:** delete-zone undo, assign-asset undo, both override adapters, `evidenceRename.ts`'s host-rename listener, and ADR-0034's geometry sidecar. **Inside:** create-zone, move, the two zone edits closed this session, calibrate. **Unmeasured:** `ReversibleSetPlanBackground`'s undo and the four Asset designer edits. | `docs/using-planning-recovery.md` now names the SHAPE and says outright that nothing lists or checks the set — no "only", no count. Three consecutive review rounds narrowed that sentence to something still wider than the truth before anyone measured it. Closing the category is L-06's subject. |
| L-12 | **Limitation.** One user-guide sentence about evidence links is in tension with the measured boundary | Found 2026-09-17 by the round that measured L-11; reported, not fixed | 2026-09-17 | The guide's Evidence paragraph says link updates on a rename go "through **guarded** Plan writes"; that path uses the raw `PlanRepository` port and is one of the things outside the pause. "Guarded" may have been meant as "version-checked" — those saves do carry the loaded version — so it is an intent call rather than a clear error. | One word closes it either way. Left for an owner or the next session rather than fixed by the controller, because a controller fix skips review. |

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

### Session 3 — 2026-09-16 — BP-02 slice 2

**Revision and branch:** started at `330a4d554` on `renovation-planner-beta-handoff-e80bb5`, tree
clean. `git fetch origin main` then `git rev-list --count HEAD..origin/main` returned **0**, so
`origin/main` had not moved since session 2's merge and no merge was needed. Ends at `f05d5d62f`,
eleven commits, nothing pushed.

**Package:** BP-02 slice 2 — the decision record, affected-entity identity on the stamp, a durable
store, and the gate. It closes L-02 and absorbs `relocateEvidence`.

**Files changed:** 60 files, 2764 insertions, 124 deletions. New production modules:
`src/application/incidents/WriteIncident.ts` and `WriteIncidentRegistry.ts`,
`src/application/ports/WriteIncidentStore.ts`,
`src/infrastructure/obsidian/plugin-data/WriteIncidentFileStore.ts`, `src/plugin/sessionStores.ts`,
`src/plugin/diagnostics/DiagnosticsReportModal.ts`, `styles/diagnostics.css`, and an `en`/`de`
`writeIncident` locale pair. Amended: `DispatchOutcome.ts` and its raise sites,
`guardAgainstThrowing.ts`, `GetDiagnosticsSnapshot.ts`, `relocateEvidence.ts`, `evidenceRename.ts`,
`guardedServices.ts`, `RenovationPlannerPlugin.ts`, three Obsidian repositories, `noteEntityWrite.ts`,
both `deleteResolution` modules, plus `docs/development/adrs/0034-…md` and
`docs/using-planning-recovery.md`. Commits `4599a388e`, `0138b8834`, `616deaed1`, `316e86a86`,
`4b0af3f03`, `e6afb4de2`, `ae4ae7088`, `554d84556`, `f3a5d4f4d`, `f7f457a1a`, `f05d5d62f`.

| Command / test | Source | Exit / outcome | Evidence |
|---|---|---|---|
| `npx eslint .` | every task and every re-review | **0, no output** | run independently by me and by five separate reviewer seats |
| `npx vue-tsc -noEmit` | `316e86a86`, `4b0af3f03`, `f05d5d62f` | 0 | proves the refusal needed no signature change at any guarded call site |
| `npm run build` | `4b0af3f03` | 0 | implementer |
| `npm run test:coverage` (clean, uncontended) | `4b0af3f03` | 0 — 1023 files / 11025 tests, thresholds met | implementer; the only full-suite run of the session |
| `npm run check:fast -- tests/plugin tests/application tests/infrastructure/obsidian/plugin-data` | `e6afb4de2` | 0 — 58 files / 475 tests | scoped re-review |
| `npx vitest run tests/plugin tests/application tests/infrastructure/obsidian/repositories` | `554d84556` | 0 — 232 files / 2600 tests | implementer |
| `npm run analyze` | `4b0af3f03` | **1 — pre-existing, see L-04** | run by me, and classified by reading the failure's content rather than by trusting a baseline |

**Reviews performed:** five task reviews and six scoped re-reviews, every one an independent
subagent seat that re-ran the instruments rather than accepting a report. Three of the five task
reviews returned spec ❌. A final whole-session review was dispatched over all eleven commits.

**What was decided, and the decision record.** ADR-0034 — *A write incident is durable and
vault-scoped* — is the record ADR-0019's own refusal asked for, and it is the non-silent extension
that refusal names as the way through. It fixes what an incident IS, that its affected-entity set is
**best effort and knowingly incomplete**, that the application layer owns it, that it persists to its
own plugin-local file rather than into `sequence-markers.json`, that **nothing in the plugin retires
it**, which command families it covers, and that the gate is **coarse by decision**. It refuses, out
loud: automatic replay, a rollback journal, a plugin-decided all-clear, a pre-write marker for the
families that lack one, and storing any content.

**The census premise the plan rested on is FALSE, and it is what shaped the slice.** The handoff said
every producer has its affected ids in scope at the raise site. Measured per site: three did not.
`ObsidianZoneRepository.ts:370` dropped the plan id in an under-parameterized helper while its
sibling `delete()` bound it correctly inline in the same class; `deleteResolution.ts:499` left the
requirement ids reachable but unbound outside the loop; and `undoDeleteResolution.ts:131` cannot
reach them at all, its rollback list being zero-argument closures. The first two were threaded in
this slice; the third is recorded as a stated limit. **This is why the gate is coarse rather than
intersection-keyed**: a gate built on a knowingly incomplete id set would let a write land on an
entity that IS inconsistent while presenting as precise. The second measurement agrees — eleven
sampled command input types use five different id field names and creation commands carry a
parent's id, so no affected set can be derived generically at the wrapper.

**Actually observed behaviour.** A half-written vault now raises an incident that outlives the tab,
the settings save, the plugin reload and the application. The next guarded command is refused with a
coded, localised message; guarded queries still run, so the vault stays inspectable. The diagnostics
report names the open incidents and the file that retires them. Every one of those is driven by
tests against the real modules — the gate test asserts the refused command's `execute` was never
CALLED rather than only that an error came back, and the `relocateEvidence` non-stamping arm asserts
a byte-identical refusal, which is the only shape that catches an over-report now that a stamp is a
vault-wide block.

**Three fakes were found thinner or harsher than the real thing, none by a gate.** A test vault
adapter answered `exists` true for every path with no `read` — "present and unreadable" where a real
vault says "absent" — and had been silently logging a failed recovery read on every plugin load,
invisible because that path only logs. A `PluginCommandHost` cast hid a snapshot literal missing a
required field that the real renderer threw on. A third is recorded in the session ledger. They are
further instances of CLAUDE.md's fake rule, whose numbered record lives in the increment history.

**Implemented but NOT verified.** Nothing in this slice was exercised in a real vault. Every failure
arm is driven through injected failures on in-memory fakes, and whether the real Obsidian
`DataAdapter` produces these shapes in these sequences is unchecked. Specifically unverified: that
the incidents file is written where `manifest.dir` actually resolves in a running vault; what
happens if the user deletes that file while the plugin is running; the behaviour with two Obsidian
windows on one vault; and whether the diagnostics modal renders legibly. The German copy was checked
against its English rows by reading and by the register gate, not by a native speaker.

**Native/device checks not performed:** all of them. No Obsidian was launched, no production bundle
was built, no device and no screen reader was used.

**New limitations:** L-04 and L-05 from the slice itself, and L-06 to L-09 from the final whole-increment review, all in the table above. L-02 is closed. **L-09 is the one a release owner should read first**: the documented way out of a paused vault needed a plugin reload that no surface mentioned, which made the remedy a dead end until the copy was corrected.

**One next executable action:** **BP-02 slice 3** — a recovery marker whose schema version this
build does not recognise must read as *unknown* rather than as healthy absence.
`SequenceMarkerFileStore.readEnvelope`'s check is bare equality and therefore direction-blind: a
HIGHER version is discarded exactly like a lower one, with a log line, and `list()` never returns
it. That is a defect against SDD §87 rules 7 and 8. **The pattern to copy already exists in this
branch** — `WriteIncidentFileStore` deliberately treats an unrecognised record as an open incident,
never dropped and never rewritten, and its docblock states why it differs from its sibling. Slice 4
follows, and its scope has GROWN: it now owns L-05 as well as L-01 and the designer's hard-coded
`writesBlocked: () => false`.

---

**One next executable action (as recorded at the close of session 1, superseded by session 2's
entry above):** BP-00 finding 4's two confirmed documentation defects were closed at `cec109688`,
so the next action is **BP-02**. It owns the second-pane gate (L-01), the ungated `DeleteAsset`
compensated delete, and one thing session 1 found that no earlier document records:
`src/presentation/designer/runtime.ts:318` wires the Asset Designer to the same
`withSaveStateTracking`, so a designer write **can** raise an incident, while `:395` hard-codes
`writesBlocked: () => false`. A half-written asset is raised and read by nobody.

### Session 4 — 2026-09-17 — upstream merge, BP-02 slice 3, and BP-02 slice 4's L-05

**Upstream.** `origin/main` had advanced **24 commits** to `ed5c50b76` (the on-canvas opening-handles
work). Fetched, then **merged** at `42d07b14a` — not rebased, because every review record and this
tracker reference the work by commit SHA. File overlap between the two sides was measured with
`comm -12` over the two `git diff --name-only` sets BEFORE merging, and was exactly one file
(`docs/tests/suites/Smoke Test the Editor.md`); nothing was resolved by hand. Note for the next
reader: main touched `src/presentation/editor/runtime.ts`, so line numbers quoted in this tracker, in
ADR-0034 and in the session-4 kickoff prompt are stale for that file.

**BP-02 slice 3 — complete, `60a748423..037782ed0`.** `SequenceMarkerFileStore.readEnvelope` tested
`schemaVersion === CURRENT` with bare equality and was therefore direction-blind: a marker written by
a FUTURE build was discarded exactly like a corrupt one. The defect was **worse than recorded** —
`write()` and `clear()` rewrote the envelope from the validated map, so the next marker operation
destroyed the unreadable record permanently, which is rule 7 failing open rather than only rule 8
presenting wrongly. `list()` now answers `SequenceMarkerListing { markers, unreadable }`; an
unrecognised entry is preserved verbatim, never replayed and never cleared; `read()` refuses rather
than answering `null`; a `write()` whose id collides with an unreadable entry is refused under its
own code rather than superseding it; and the envelope-level refusal is unchanged, with the reason now
written where the next reader would conflate the two levels. No ADR — this is a bug against SDD §87
rules 7 and 8, both already recorded — with a dated amendment added to ADR-0034 where that document
deferred it.

**BP-02 slice 4 — one of three parts, `e6cdd914b..2546d88d8`.** L-05 is closed; see its row above.
The second pane (L-01), the Asset Designer's hard-coded `writesBlocked: () => false`, and L-06's
check are **designed, ruled on and briefed, and none of them is started.**

**Commands and outcomes, exit codes captured before any pipe.**

| Command | Result |
|---|---|
| `git merge --no-ff origin/main` | 0 — 31 files, nothing resolved by hand |
| `npm run build` | **0**, at `2546d88d8` |
| `npx eslint .` | **0**, zero lines of output, at `2546d88d8` |
| `npx vue-tsc -noEmit` | 0, every agent round |
| `npx oxlint --deny-warnings` | 0, every agent round |
| `npx vitest run tests/plugin tests/presentation/editor` | **0 — 450 files, 3613 tests** |
| `npx vitest run tests/application tests/infrastructure tests/plugin` | 0 — 280 files, 3065 tests |
| `npx vitest run tests/presentation/editor/structure tests/domain/spatial` | 0 — 44 files, 367 tests (the merge baseline) |
| `npm run analyze` | **Not run** — L-04; it fails on `origin/main` itself |
| `npm run test:coverage` | **Exit 1**, and the four floors are **MET** — see the paragraph below |

**The coverage gate, measured for the first time in three sessions — floors met, run red, and the two
facts are independent.** `npm run test:coverage` at `2546d88d8` reported **statements 99.21%
(28610/28837), branches 98.06% (21031/21445), functions 99.24% (8311/8374), lines 99.65%
(21030/21102)** against floors of 99/99/99/98 — **all four met**, and met CONSERVATIVELY, since 26
tests did not execute and therefore contributed no coverage.

The run itself exited **1**: 21 files, 26 tests, of which **22 were `Test timed out in 5000ms`** on a
run that took **2363 seconds** against the ~160 seconds `CLAUDE.md` records for this suite. Attributed
to the environment rather than to this work, by three checks rather than by one: **(a)** this
session's own diff (`git diff --name-only 42d07b14a..HEAD`) intersects the 21 failing files in
**nothing**; **(b)** an earlier quiet run of `vitest run tests/plugin tests/presentation/editor` —
which contains most of them — was **exit 0 at 450 files / 3613 tests**; and **(c)** the three failures
that were NOT timeouts were re-run alone and passed, **exit 0, 22 tests in 16.34s**. Those three
(`scene.test.ts`'s two isolation cases and a `npm_package_version is not set`) are named in
`CLAUDE.md`'s own list of module-level-state families — Konva's `stages` registry and the
`npm_package_version` mutation — so they are a recorded hazard reappearing, not a new one.

**A caveat on that exit code that is worth more than the number.** The command was written as
`npm run test:coverage > log 2>&1; c=$?; echo "COVERAGE_EXIT=$c"`, and the harness reported the
**wrapper** as "exited with code 0" while the captured `COVERAGE_EXIT` was **1**. That is the
kickoff's `tail`-masks-`$?` warning in a second costume: a trailing `echo` masks it just as a pipe
does. Capture the code into a variable and PRINT it; do not read the harness line.

**Evidence locations.** Every brief, implementer report, review, fix report and re-review for this
session is in `.superpowers/sdd/01-improvement-plan/` — gitignored, worktree-local, and the only
copy that exists. `progress.md` there carries every ruling with its stated cost.

**Two environment facts the next session needs.** The machine's `C:` drive reached **0 bytes free**
mid-session and every `vitest` invocation failed `ENOSPC`; the remedy that worked was setting
`TEMP`/`TMP`/`TMPDIR` to `D:/tmp-rp` with FORWARD slashes, since backslashes are mangled into a
relative path. It stood at 9.5 GB free afterwards, and nothing reports this before a run fails.
Separately, one 44-file "0 test, no error body" failure was first diagnosed as this repository's
documented parallelism artifact and was **almost certainly that disk condition instead** — an empty
error body is what a temp-write failure looks like from outside, and the familiar explanation was
reached by matching a symptom rather than by reading the error.

**What is implemented but unverified.** All of it. **Nothing on this branch has ever been run in a
real Obsidian vault.** Specifically: what a user sees when a delete is refused over an unreadable
marker was read out of `toUserMessage`'s lookup and asserted in jsdom, never on screen; the German
copy minted this session is an agent's and has had no native-speaker review; two reversible adapters
are named in L-11 as unmeasured; and `npm run analyze`'s opinion of this session's changes is unknown.

**Native checks still not performed.** Every row of the native availability table above remains
Unperformed — no desktop platform, no minimum-Obsidian-version check, no screen reader, no iOS, no
Android, no trackpad, pen or touch.

**The recurring defect of this session, recorded because it cost four review rounds.** Three times, a
test was written one seam away from the code that decides, and each time it was found only by
someone REVERTING the fix and watching what stayed green — never by adding more tests around the
change. The worst instance: reverting `inspector-wiring.ts`'s two arms, reopening L-05 completely,
left **450 files / 3611 tests green, exit 0**. A fourth instance of the same family, three separate
times: a count stated in N places with N−1 updated. **Ask what stays green when the fix is undone,
before asking whether the tests pass.**

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
