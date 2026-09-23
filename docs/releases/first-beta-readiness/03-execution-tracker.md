# Beta execution tracker

Prepared: 2026-09-16. This is a starting template, not an execution report. Map its statuses into the repository's existing lifecycle; keep implementation, verification, and release approval separate.

## Current state

| Field | Value |
|---|---|
| Handoff baseline | `d77e7c5eba5e6518b93a5be4606532ceab3a77eb` |
| Upstream reconciled | **Third merge, session 18 (2026-09-23):** `main` advanced 16 commits to `914fdaff3`, with dependency bumps (vue 3.5.42, zod 4.6.5, @types/node 22.20.3) and the reference-image rotation handle (#237). It was merged at `d2dc9568f`. The overlap, measured by `comm -12` over the two `git diff --name-only` sets before the merge, was one file, `tests/presentation/editor/referenceWorkflow.e2e.test.ts`, and it merged without conflict. **Earlier:** Merged twice, never rebased — every review and ledger entry references this work by commit SHA. First: `main` advanced 14 commits to `f3a8864a9` (asset-designer consolidation, plan deletion), zero file overlap. Second, in session 4: 24 further commits to `ed5c50b76` (the opening-handles work), merged at `42d07b14a` with a **one-file** overlap measured by `comm -12` over the two `git diff --name-only` sets before the merge was run, so it was known-cheap beforehand. Session 5 re-checked and `main` had **not** moved: `git rev-parse origin/main` and `git merge-base HEAD origin/main` both print `ed5c50b76`, so main is an ancestor of HEAD and there was nothing to merge. |
| Current working revision / branch | **As of session 18 (2026-09-23): branch `renovation-planner-beta-handoff-e80bb5`, this close-out commit is the tip, PUSHED. Code last changed at the upstream merge `d2dc9568f`; this branch's own code last changed at `fdea34eb4`. The last full CI run, green on all five jobs, is `35852241674` at `5e7a7dbf2`; the commits after it are recorded in the session log.** `origin/main` had moved to `914fdaff3` and was MERGED, not rebased, at `d2dc9568f`. **Everything after this sentence is the historical record.** **As of session 17, after L-43 (2026-09-23): branch `renovation-planner-beta-handoff-e80bb5`, this close-out commit is the tip, PUSHED. Code last changed at `20ff37f29` (the Asset Library's mobile guard); its CI run is recorded in the session log.** `origin/main` re-checked at `ed5c50b76`, still an ancestor, nothing merged. **Everything after this sentence is the historical record.** **As of session 13 (2026-09-21): `74cfe8647` on branch `renovation-planner-beta-handoff-e80bb5`, PUSHED, tree clean.** Six commits were added this session — `e9b982706`, `7c38db05c`, `78b851ab2`, `0ad89aea3`, `3c0e01d21`, `74cfe8647`. `origin/main` was re-checked at the session start and had NOT moved: it is at `ed5c50b76` and is still an ancestor, so no merge was needed and none was made. **Everything after this sentence is the historical record and its opening clause is superseded. The original text follows.** **As of session 11 (2026-09-20): `e2d524a9b` on branch `renovation-planner-beta-handoff-e80bb5`, PUSHED, with draft pull request [#231](https://github.com/Luis85/renovation-planner/pull/231) open — not marked ready, no auto-merge, no reviewers requested.** `origin/main` re-checked at session 11's start and had NOT moved: `git rev-parse origin/main` prints `ed5c50b76` and `git merge-base --is-ancestor origin/main HEAD` succeeds, so main remains an ancestor and there was nothing to merge. **The rest of this cell is the historical record and its opening sentence is superseded**: `c5456b239` on branch `renovation-planner-beta-handoff-e80bb5`. Nothing pushed; no pull request opened. Seven sessions of work sit on top of the handoff baseline `d77e7c5eb` and the merged upstream `ed5c50b76`. Session 7 re-checked upstream before starting and `main` had still not moved: `git rev-parse origin/main` and `git merge-base HEAD origin/main` both print `ed5c50b76`, so main remains an ancestor and there was nothing to merge. |
| Worktree and dirty files | Worktree `.claude/worktrees/renovation-planner-beta-handoff-e80bb5`. Clean at session start. 95 other worktrees exist under `.worktrees/` and `D:/codex-worktrees/`; none was touched, reset, cleaned, or stashed. |
| Responsible integrator | Unassigned — no human integrator has accepted this work. |
| Selected beta scope / platforms | Unchanged from the handoff proposal: current editor capabilities, desktop editing, mobile read-only. Not yet confirmed by an owner as a whole. One owner decision bears on its mobile half: L-43, decided 2026-09-23 as "guard the asset library on mobile", which keeps "mobile read-only" rather than narrowing it. The Asset Library's writes are guarded on mobile in code and tested in jsdom; nothing has been run on a device (L-43). |
| Existing backlog mapping | BP-01 maps to an existing recorded repository decision (increment-history ruling R1) rather than to a new backlog item. The remaining BP identifiers are unmapped. |
| Baseline full gates | **CORRECTED 2026-09-20 (session 11), and the original sentence below is FALSE — read this clause first.** `npm run check` is **GREEN, all four steps**, and has been since session 9. **L-04 was REFUTED** (ruling R-S9-2): `analyze` passes on `main` and on this branch in about a second, and the ruling that called it broken rested on a misread of fallow's report — its failure sentence names a refactoring-target POINTER, not a breach. That misreading suppressed a working gate for eight sessions and filed a real defect as pre-existing. Session 11 re-confirmed it first-hand twice, with the exit captured into a file before any pipe. **The superseded original follows, kept rather than deleted so the correction has something to point at:** `npm run check` is **RED, and not because of this work** — its `analyze` leg fails on `origin/main` itself. See limitation **L-04**, which carries the measurement. Its other three legs are green. Measured at `9d08aeed4`, exit code captured into a file before any pipe: `npm run test:coverage` **exit 0**, 1035 files / 11165 passed / 1 skipped in 1410.87 s, with statements 99.21% (28619/28844), branches 98.08% (21041/21451), functions 99.27% (8316/8377) and lines 99.65% (21034/21106) against floors of 99/99/99/98 — all four met. Counted in UNITS rather than percentage points, per CLAUDE.md: uncovered arms fell against session 4's run in three metrics and held in the fourth (statements 227→225, branches 414→410, functions 63→61, lines 72→72), so this session added no uncovered arm. No floor was ratcheted: each already sits at the next whole point, so no integer raise is available. **Not re-measured in session 6 and deliberately so**: that session added three test cases and changed no production line, so no branch arm moved, and `npm run check` was kept off the working machine under the parallel-work rule. Coverage on this branch is therefore CI's report to make, not this row's. |
| Candidate source and bundle hashes | Not created. No production build was made. |
| Native acceptance | Not performed. No Obsidian was run. |
| Publication authorization | Not granted. |
| Next executable action | Recorded at the end of the session log below. **As of 2026-09-23 (session 18): BP-08, a repair of `largeFloor()`'s path in `scripts/editor-recovery-check.mjs` (L-44)**, then harness runs at a named commit recorded as numbers and judged against neither target set. The owner questions still open are listed in `05-owner-decisions.md`. |
| Reviews performed | Across six sessions. Session 6: one task review and one scoped re-review, both independent seats told to answer their seat's question by EXPERIMENT rather than by reading. Both returned findings that were real — the first that a pointer to `guardCategory.test.ts` could not carry the claim handed to it (that file names `WRITES_PAUSED_CODE` zero times and stays green with the gate removed), the second that a docblock clause this branch had just written was measured FALSE. Session 6 also had the CONTROLLER re-run every measurement it was given, including both reverts, and the controller's own census found eleven sites where a review had named five (L-17). Session 5 alone: two task reviews, two scoped re-reviews and two final rounds, every one an independent subagent seat instructed to re-run the instruments rather than accept a report. Both task reviews returned FIX, and in each case the reviewer overturned something the CONTROLLER had ruled rather than something an implementer had written — see L-13 and the session 5 log. Across three earlier sessions: Session 3 alone: five task reviews, six scoped re-reviews and a final whole-session review, every one an independent subagent seat instructed to re-run the instruments rather than accept a report. Three of its five task reviews returned spec ❌, and two findings were real defects rather than wording — an unbounded re-seed of the incident registry on every settings save, and a module global released without checking it was still the one that load claimed. |

## Package register

“Not started” means no implementation has been performed by preparation of this handoff. It does not assert that a future repository revision lacks the behaviour. Reconcile first.

| ID | Package | Priority | Dependencies | Kind | State | Owner / existing item | Evidence / next action |
|---|---|---|---|---|---|---|---|
| BP-00 | Reconcile baseline and ownership | P0 | None | Discovery | **Complete** | This session / unmapped | Discovery is done and the Finding reconciliation table below classifies the handoff's findings. Baseline gates: the Current state table's `Baseline full gates` row. No further action. History: the first session log (2026-09-16). |
| BP-01 | Preserve recovery incidents across remounts | P0 | BP-00 | Confirmed defect | **Complete** | This session / increment-history ruling R1 | Fixed at `67f5acf9c`, narrowed at `41d803611` and `2af92f8fd`; `tests/plugin/rootSwapRebind.test.ts` asserts that a leaf's unrecovered-write flag survives a rebind. The acceptance line "a new pane shows the same incident" is met for the Plan Editor since BP-02 slice 4 (L-01, closed for the Plan Editor only). The two-pane gesture itself has not been run in a vault (`docs/tests/cases/Two panes on one plan under an open write incident.md`). The residue sits with BP-02: the gate is not reactive and a restored leaf seeds clean (L-14). No further BP-01 action. History: the first session log (2026-09-16). |
| BP-02 | Durable incident detection and recovery | P0 | BP-01 | Safety hardening | **Slices 1 to 4 landed. Open: L-06, L-11, L-14, L-15, L-17 and L-18. L-13 is reclassified rather than closed, and its residue is L-14's affordance gap. L-16 is closed.** | This session / ADR-0034 is slice 2's decision record, the one ADR-0019 asked for | Slice 1 at `81f627b53..beda98597`. Slice 2 (ADR-0034, closing L-02) at `4599a388e..f05d5d62f`. Slice 3 at `60a748423..5580e53b5`. Slice 4 at `e6cdd914b..2546d88d8` (L-05), `36a4c92f7..4966cbe7b` (the write gate reads the vault's own record, closing L-01 for the Plan Editor) and `e7c24d91b..9d08aeed4` (L-06 narrowed by a pinned census). L-12 closed at `e118f61d4`. L-16, undo and redo landing while the vault is paused on both editor surfaces, is closed by `src/presentation/editor/tools/with-incident-gate.ts`; L-16's row carries the commit range. L-06 with L-11 is `05-owner-decisions.md` Q1, an owner question; L-14 is recorded as having no data-safety effect, L-15 as wrong emphasis in two strings, and L-17 and L-18 as accuracy findings. Next: none in this package until Q1 is answered. History: session logs 2–6. |
| BP-03 | Protect drafts and in-flight commands | P0/P1 | BP-01; final after BP-02 | Verification that became a fix | **Complete: gaps F1 to F5 are closed or accepted. F3's test column is at 1 of 6, and the other five rows wait on L-21** | Sessions 7 and 8 / unmapped | Lifecycle contract `04-lifecycle-contract.md` (`cecfbbcbc`). F2 fixed at `0ffd15466`, corrected at `3392c20c4` and `fb78d444c`. F1 ruled option D at `c5b2817e2` and `1979aa7f6` and recorded as L-19. F3 (`onunload` released the write-incident registry while views were still mounted) fixed at `f5a7f219e`, locked by `tests/plugin/unloadWithViewOpen.test.ts`, with `openViewOnLeaf` promoted to `tests/helpers/plugin.ts` at `45c88a73e`. F4 and F5 measured clean and locked at `4da7258ee` and `c5456b239`. Next: none in this package. L-19 and L-21 are owner questions Q2 and Q3 in `05-owner-decisions.md`, and each needs one vault run. History: session logs 7–8. |
| BP-04 | Precise non-drag corner editing | P1 | BP-00; integrate after BP-03 | Interaction addition | **Slices A, A2 and B landed. The Acceptance criteria and Actions 1–6 are recorded as met. Open: the Deliverable's real-screenshot clause, which needs a vault run. The package is not marked closed.** | Session 9 discovery / session 10 slice A / session 11 slice A2 / **session 12 slice B** | Slice A at `6546f402c` and `152a3c18c`; slice A2 at `8bfd6dd6a`, `b6b6a1f27` and `e2d524a9b`; slice B at `1f2cf7cf8`, its user guide at `73af5eb95` and its fix round at `2cf585a40`. Action 1's specification is `docs/superpowers/specs/2026-09-21-bp04-numeric-corner-editing-spec.md` (`3c0e01d21`), cross-linked with the 2026-09-12 side-panels design's Amendment 1. The criterion-by-criterion call is in the session 12 log, and Action 1's closure in the session 13 log. Named tests: 10 covered / 2 partial / 0 absent, from session 14's re-run of the acceptance audit. Open limitations tied to this package: L-22, L-26, L-27 and L-32, and L-33's residue, the owner copy question over the fallback sentence `OutlinePointsForm.vue` renders when this package's dialog refuses a whole outline; none of them is a closing item. Next: a vault run capturing the corner-editing states for the screenshot clause, since `harness-shots/` is gitignored and no capture travels with the repository, or an owner ruling that accepts the package without it (L-31). History: session logs 9–14. |
| BP-05 | Selection, transform, cancel and history | P1 | BP-03; coordinate BP-04 | Verification/polish | Not started under the plan. Much of its behaviour is already implemented and tested per feature in jsdom. Action 1's capability matrix exists since session 18. | Unassigned / unmapped | Already in the tree: overlap priority and modifiers (`resolveSelectionTarget.test.ts`; ADR-0018 and ADR-0027), one Escape precedence function (`escapeRouting.ts`, `escapeRouting.test.ts`), one operation per history entry and no entry for a rejected command (`history.e2e.test.ts`, `commandHistory.test.ts`), a keyboard context menu on the ContextMenu key and Shift+F10 (`CanvasContextMenu.vue`, `contextMenuLifecycle.test.ts`, `nativeShellInputBoundaries.test.ts`), and paste across plans (`clipboard.test.ts`). The Deliverable's capability matrix is `10-interaction-capability-matrix.md` (`5240cc4af`, narrowed at `872cb197a`): the plan's ten actions across 21 geometry types, 105 cells Tested, 100 Implemented-untested and 5 Unsupported, each Tested cell citing a test title a script found present. An Implemented-untested cell means no test was found by `git grep` and reading; it is not a census. Absent: a dense-overlap fixture; a case asserting that a hover leaves the selection unchanged; German interaction cases; a modifier change during a move drag; a unit test of `historyShortcut.ts`; and action-specific history labels, which `undoable-command.ts` carries no field for. **Owner question:** the no-op half of the Acceptance clause "rejected/no-op operations do not add history" contradicts `CommandHistory.runNow`, which puts a no-write gesture on the undo stack by design. `history.e2e.test.ts` pins that behaviour, and the Done PBI `docs/requirements/Undo and redo.md` records the clause's history half as NARROWED at its criterion 6. Either the clause is narrowed or the code changes (`05-owner-decisions.md` §8). Next, doable here: tests for cells the matrix leaves empty, such as Redo on its six Undo-only rows or a modifier change during a move drag. Needs a vault: the platform shortcuts on Windows and on macOS. |
| BP-06 | Empty-plan and reference journeys | P1 | BP-03 | Verification | Not started under the plan. The three starts and the image and PDF reference flow are built and covered in jsdom; none has been run in a vault. A PDF page other than the first is decoded in jsdom since session 18. | Unassigned / unmapped | Already in the tree: `FloorStart.vue`'s three starts (`referenceWorkflow.e2e.test.ts` "offers three query-derived starts…"); prepare, measure and commit for PNG and PDF, with a reload through a fresh stack (`referenceWorkflow.e2e.test.ts`, `configurePlanReference.test.ts`); refused zero and invalid distances (`referenceSetup.test.ts`); a rescale of existing geometry that waits for explicit consent ("requires explicit acknowledgement before rescaling existing geometry" in `referenceWorkflow.e2e.test.ts`; ADR-0019, ADR-0020); missing, unreadable and invalid-page references (`background.test.ts`); and no write on cancel. A synthetic two-page PDF (`pdfFixture` in `tests/helpers/backgroundFixtures.ts`) is chosen at page 2 in the real reference form, decoded, committed and decoded again on a fresh mount (`referenceMultiPage.e2e.test.ts`; `e85991d70`, `5e7a7dbf2`), under the suite's `pdfjs-dist` and not Obsidian's copy; the committed printer-driver PDF still has one page. Absent, by a `git grep` for `numPages` and `pageCount` under `src/`: any reading of a PDF's page count, so page 3 of a two-page file gets the generic unreadable sentence, against the New task `docs/tasks/Import and prepare an image or PDF reference.md`'s "Expose supported PDF pages"; a case in which a failed page leaves a committed reference unchanged (acceptance A04); handling for a renamed reference source; a large-image bound; a known-distance example; and the short walkthrough the Deliverable names. Steps 4 to 7 of `docs/tests/cases/Empty States Walkthrough.md` walk a "No plan document yet" panel over the seeded plan (five zones, no background): step 4 expects it over the zones, step 5 reads it, and steps 6 and 7 watch it yield to a tool and return. At HEAD `PlanEditorRoot.vue`'s overlay is null for a plan with zones and no background, so none of those four steps has a panel to look at, and `FloorStart` is what draws for the no-background state when a panel draws at all. Next, doable here: those four steps brought up to date, and the A04 case. Needs a vault: the starts and the reference flow in Obsidian, Obsidian's own PDF.js, and a real rename or move of the source file. |
| BP-07 | Responsive, keyboard and accessibility | P1 | BP-04–BP-06 for final run | Verification/repair | Not started under the plan. Breakpoints, reflow with drafts and focus, and most keyboard alternatives are implemented and tested in jsdom; no screen reader, host zoom or community theme has been run. | Unassigned / unmapped | Already in the tree: the breakpoints `FULL_MIN_PX = 900` and `CONSTRAINED_MIN_PX = 400` (`layoutMode.test.ts`); reflow that keeps drafts, focus and selection (`persistentRegions.test.ts`, `responsiveShell.test.ts`); keyboard alternatives for corners (BP-04), nudging (`keyboardNudge.test.ts`), panel resizing (`panelResizer.test.ts`) and tree reordering (`propertyTreeReorder.test.ts`); axe-core scans of the real surfaces in the `tests/harness/accessibility*.test.ts` files, which switch off `color-contrast`, `color-contrast-enhanced` and `target-size` (`tests/harness/axeOptions.ts`); and a 200% CSS-zoom reflow pass in `scripts/editor-recovery-check.mjs`, whose own method string keeps native zoom separate. Absent: the interaction inventory (Action 3); keyboard-only panning of the plan canvas, since arrows nudge and Space arms a pointer-drag pan (`surface/keyDoors.ts`); and any contrast, focus-visibility or target-size check. Layout items against this package's acceptance: L-26, L-27 and L-32; L-27 needs a design decision rather than a patch; L-32's row records the dialog behaving as designed and names an instrument remedy, a capture that waits on the submit button or scrolls the dialog. Next, doable here: the inventory assembled from the tests above, recording the keyboard-pan gap. Needs a vault, device or screen reader: a community theme, a named screen reader, host zoom, contrast and target size. |
| BP-08 | Representative performance and cleanup | P1 | BP-00; final integrated run | Benchmark | Not started under the plan. Cleanup across open and close is held in jsdom. A mixed-scene browser driver exists, and at the current tree it does not complete (L-44). | Unassigned / unmapped | Already in the tree: `docs/tests/cases/Canvas performance.md` (room-heavy, harness rows dated 2026-09-13); the cases "stacks nothing across repeated open and close cycles" in `scene.test.ts` and in `planEditorView.test.ts`; and `scripts/editor-recovery-check.mjs`'s large-floor pass over `seedLarge()` in `tests/harness/planningRecoveryProbe.ts` (rooms, materials, assets and photos; frame gaps; stage and listener counts across close and reopen). That driver is not wired into `package.json`, and its recorded results in `pan-performance-diagnosis.md` are for older bundles and are not claimed for this tree. Session 18 ran it with the pinned Chromium: the full run fails in its planning journey, and `--performance-only` (`da7b9829f`) fails inside `largeFloor()` at the switch to Renovate (L-44), so no measurement of a current bundle exists. Absent: walls, openings and a reference image in that fixture, the three tiers, an environment record, and any measurement of a current bundle. **Owner or recorded decision needed:** the plan's targets (a plan open within 3 s, feedback within 100 ms, a p95 frame time of about 33 ms) disagree with the PBI `docs/requirements/Meet editor performance and cleanup budgets.md` (status New: initial render under 1.5 s, selection under 100 ms, Inspector under 200 ms), whose set the driver's `targets` object encodes; the plan requires a recorded decision for a changed target (`05-owner-decisions.md` §8). Next, doable here: repair `largeFloor()`'s path (L-44) and record harness runs at a named commit, labelled as harness numbers; then extend `seedLarge()` with walls, openings and a reference image. Needs a vault: native numbers on the reference machine. |
| BP-09 | Desktop/mobile support boundary | P1 | BP-00; final BP-13 evidence | Native verification | Not started under the plan. The palette guards, the two canvas views' mobile refusals, the project view's read-only mode and, since L-43, the Asset Library's read-only mode ship and are tested in jsdom; no device run exists. | Unassigned / unmapped | Already in the tree, from `git grep -n "Platform.isMobile" -- src`: `open-plan-editor`, `set-plan-background`, `open-asset-designer`, `create-sample-project` and `new-project` answer `false` on mobile; `PlanEditorView` and `AssetDesignerView` refuse in `sync()`; the project view passes `readOnly: Platform.isMobile`, and `AssetLibraryView` puts the same into its context (`20ff37f29`). Tests: `mobileReadOnly.test.ts`, `mobileDesktopOnly.test.ts`, `projectEntryBoundaries.test.ts`, `assetLibraryMobile.test.ts`, `tests/plugin/*Commands.test.ts`. The requirement is `docs/requirements/Bound the mobile surface to what it can actually do.md` (status Active). **Guarded now, in code and in jsdom and not on a device: the Asset Library (L-43, closed by owner decision on 2026-09-23).** On mobile its `New asset`, `Open designer`, `Delete`, definition fields and `Save` are refused and described by `view.mobile.read-only`, and their handlers refuse; search, selection and the shelves stay live. `open-asset-library` and the project view's Library door still open the library on mobile. The guard sits in the view rather than at either door, so it holds whichever door opened it; that is a source reading, and `assetLibraryMobile.test.ts` drives the view rather than each door. Absent: a device run (`docs/tests/cases/Read projects on mobile.md` reads "Not yet run on a device", and it does not check the Asset Library), a mobile case for the Work and schedule actions, and the tested-versus-untested matrix. Next, doable here: add Asset Library steps to `docs/tests/cases/Read projects on mobile.md`, so that the first device run checks L-43's guard. Needs a device: Actions 2 to 5 and a run recorded in that case's Runs table. |
| BP-10 | First-use and help | P1 | BP-05, BP-06 | Onboarding | Not started under the plan. The sample command, live empty-state actions and a reopenable getting-started toggle in the project view exist; no guide, help entry, fictional label or first-use log exists. | Unassigned / unmapped | Already in the tree: `create-sample-project` (`src/plugin/sampleProject.ts`, seeding through the real commands; `tests/plugin/sampleProject.test.ts` covers a failed seed), live empty-state actions (`renovationProjectEmptyState.test.ts`, `emptyStateOverlay.test.ts`), and `ProjectEntryGuidance.vue`'s Show and Hide getting-started guidance. Absent: a getting-started route in `README.md` or `docs/using-plan-editor.md`; a help command or entry, since none of the command ids registered under `src/plugin/` is one; a fictional label on the sample (`sample.project.name` is "Sample renovation" and "Beispiel-Renovierung"); a test of a second sample run; and a first-use observation log. **Owner copy needed:** a help entry needs a new command name and new copy, and a fictional label changes `sample.project.name` in both locales (`05-owner-decisions.md` §8). Next, doable here: a docs-only getting-started guide over the existing route, linking `docs/using-planning-recovery.md`, and a `sampleProject.test.ts` case pinning a second run as a second project. Needs a clean installed beta (BP-12) and real users: the formative test. |
| BP-11 | Capability/compatibility/recovery docs | P1 | BP-00; finalize after production work | Documentation | **Partial** | This session / unmapped | Corrected: `RELEASING.md`'s catalogue claim and the recovery guide's schema numbers at `cec109688`, and the recovery guide's account of the rebind behaviour BP-01 changed at `0e7f1bf04` and `b94a23677`, BP-01's review-wave commits rather than the three SHAs BP-01's row cites. `docs/using-planning-recovery.md` was then rewritten for the durable, vault-scoped incident across the BP-02 documentation chain ending `e118f61d4`. Absent: the compatibility table (reader, writer and migration per note and sidecar kind; `cec109688`'s schema figures date from 2026-09-16 and need re-reading from the mappers), a known-limitations section, and a line-by-line check of `PRODUCT.md` and `docs/using-plan-editor.md` against the tree. `PRODUCT.md`'s "mobile read-only" is no longer contradicted at source by L-43: the owner decided on 2026-09-23 to guard the Asset Library rather than narrow the claim, and that guard is verified in jsdom only, so the claim still waits on BP-09's device run before it is published as observed. Next, doable here: the compatibility table. The other remaining Actions are documentation and source reconciliation; Action 4, that opening a legacy fixture does not rewrite it, was not re-verified in session 17. History: the first session log and session logs 2–6. |
| BP-12 | Traceable production candidate | P0 | All selected production changes | Packaging | Not started | Unassigned / unmapped | The Candidate identity record below is empty, and no production build has been made for release. It depends on the selected production changes, several of which wait on owner questions (`05-owner-decisions.md`). Next, doable here once those land: freeze the intended commit, run the production build, and record SHA-256 hashes of `main.js`, `manifest.json` and `styles.css` in that record. Needs a vault: installing the candidate into an acceptance vault. |
| BP-13 | Integrated candidate acceptance | P0 | BP-12 | Release verification | Not started | Unassigned / unmapped | Waits on BP-12's candidate. `04-beta-acceptance-matrix.md` is headed as proposed acceptance work, not executed results. Doable here now, without a candidate: map the matrix's scenario IDs onto the existing `docs/tests/cases/` files and automated tests. Needs a vault and devices: the acceptance run itself. |
| BP-14 | Go/no-go and beta operations | P0/P1 | BP-13 | Owner decision | Not started | Unassigned / unmapped | The Go/no-go record below reads "Decision: Not made." The decision and any publication authorization are the owner's. Doable here as drafts for the owner to approve: the bug-report template and the release-stop conditions (plan BP-14 Actions 3 and 5). |
| BP-15 | Clean plan snapshot (optional) | P2 | Stable core; before BP-12 if selected | Proposed addition | Deferred by default | Unassigned / unmapped | Out of the default beta scope (D-01, owner confirmation pending). Action 1's search for an existing export is recorded in the Finding reconciliation table: no plan-image export was found by a name search of `src/`. No action unless the owner selects the package. |

## Finding reconciliation

| Finding | Handoff evidence | Current classification | Reproducer / newer evidence | Decision |
|---|---|---|---|---|
| Recovery flag lost on rebind | Reverified source/test at handoff baseline | **Was still present; fixed this session** | `save-state-store.ts:73` holds `unrecoveredWrite` in Pinia; `PlanEditorView.mount()` calls `createPinia()` fresh on every mount, and `rebind()` runs `unmount()`/`sync()`. The existing test `drops a leaf's unrecovered-write flag on rebind — the recorded gap, not the desired behaviour` in `tests/plugin/rootSwapRebind.test.ts` asserted the loss and its docblock named it undesired; that case now asserts the desired behaviour under a new title. | BP-01, complete at `67f5acf9c..2af92f8fd`. Ownership now sits on the `PlanEditorView` instance and travels through Obsidian's `getState`/`setState`; the named test asserts survival instead of loss. |
| No arbitrary existing-corner non-drag route | Reverified user guide at handoff baseline | **Still true, but narrower than stated** | The gap is presentation-only. `MoveSpatialObjectCommand` already accepts a full replacement polygon and is wrapped by `ReversibleMoveZoneCommand` — the same pair the existing vertex drag dispatches. No UI reaches it without dragging; the guide and the code agree. | BP-04. A numeric form reuses the existing command; no new command is needed. Open question recorded as Q-01. |
| Native ledger is historical preparation | Reverified handoff source | **Still true** | No executed native acceptance run against a named bundle exists anywhere in the repository. | BP-13 |
| Mobile device evidence incomplete | Earlier review only | **Still true** | The mobile case's Runs table reads "Not yet run on a device". Other mobile evidence exists and is jsdom only: the requirement `docs/requirements/Bound the mobile surface to what it can actually do.md` (status Active) with its guards and tests (`mobileReadOnly.test.ts`, `mobileDesktopOnly.test.ts`, `projectEntryBoundaries.test.ts`, `tests/plugin/*Commands.test.ts`). That requirement records the Asset Library's write controls as done for L-43 on 2026-09-23, guarded in code and tested in jsdom (`assetLibraryMobile.test.ts`), and not measured on a device. | BP-09; L-43 (closed) |
| Documentation drift | Earlier review only | **Changed — two confirmed, one refuted** | Confirmed: `RELEASING.md:104` still states there is no manual case catalogue while `docs/tests/cases/` holds 44 files. Confirmed: `docs/using-planning-recovery.md` cites plan schema v6 / requirement v3 / geometry v4 where the code is at v12 / v5 / v16 — its durability prose itself is accurate. Refuted: `README.md`'s contributor-only installation route is correct, not stale, because `manifest.json` is at 0.1.0 and no git tag exists, so no release has ever been cut. | BP-11, with the README item withdrawn |
| Room-heavy performance already improved | Earlier measured ledger | **Already addressed, do not reopen** | Fixed 2026-09-13; zoom at rooms=80 now measures 7.7–8.2 ms, pinned by `zoneZoomConfiguration.test.ts`. | BP-08 measures a new mixed fixture only. The historical figure is not a live defect. |
| Optional export may exist elsewhere | Not proven absent | **Investigated at source 2026-09-23: none found** | A `git grep` over `src/` at `8ab18c0bb` for `toDataURL`, `toBlob`, `toCanvas`, `exportImage`, `toImage`, `window.print`, `createObjectURL` and `saveAs(` prints nothing, and none of the command ids registered under `src/plugin/` names an export. It is a name search, so an export spelled some other way would not show. | BP-15, deferred |
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
| D-03 | Preserve desktop editing / mobile read-only unless explicitly changed | Existing scope to revalidate | — | Plan S09/S10 | Device evidence required for claims. The owner's L-43 decision (2026-09-23) kept mobile read-only and guarded the Asset Library to match, in code and in jsdom; no device has checked it. |
| D-04 | BP-01 carries incident ownership as per-leaf view-owned state through Obsidian's `getState`/`setState`, not as a session service keyed by plan id | Decided this session against the repository's recorded ruling R1 | 2026-09-16 | Increment history ruling R1, plus the same shape stated in the PBI and two task documents. The handoff's BP-01 action 3 asks for a session service; plan section 9 makes repository decisions the authority over the handoff, so R1 wins. | Consequence: BP-01's acceptance line "a new pane shows the same incident" is not met by this shape. Recorded as L-01 rather than dropped. Revisit at BP-02. |
| D-05 | An unrecovered-write flag that survives an application restart via Obsidian's persisted workspace layout is preserved, never stripped | Decided this session | 2026-09-16 | Plan section 7 names a false all-clear after incomplete writes as a no-go condition; dropping a surviving flag manufactures exactly that. | No release effect. Revisit if BP-02's durable detection supersedes the incidental persistence. |
| L-01 | **Closed for the Plan Editor only**, 2026-09-17, at `36a4c92f7..4966cbe7b`. A second Plan Editor pane on the same plan IS now gated by an open incident. | Closed by BP-02 slice 4 | 2026-09-16, closed 2026-09-17 | The shared `rp-save-state` store seeds a vault-pause ref from `activeWriteIncidentRegistry()?.anyOpen()` at setup, and each `ItemView` mounts its own Pinia (ADR-004), so a pane opened while an incident is open is gated from its first frame. An already-open pane catches up at its first refused write, because `withSaveStateTracking` now also marks on the gate's own refusal code. **The gesture itself is untestable here** — `duplicateLeaf` has zero hits in the repository and `FakeWorkspace` has no split and no layout restore (L-03) — so it rests on a mechanism test plus the unrun manual case `docs/tests/cases/Two panes on one plan under an open write incident.md`. | **Does not on its own unblock G1**, and the reason is L-13: the Asset Designer is not gated at all, so an open incident is still bypassed by opening a different SURFACE rather than a second pane. Two residues of this row are now L-14 (not reactive; a restored leaf seeds clean) and L-15 (copy). The Asset Designer clause is superseded: L-13 records its forward writes as refused, and L-16 refuses its undo and redo at the dispatcher. G1's current reason is its own row in the Gate state table. |
| D-06 | An incident, once session-scoped, is cleared only by a plugin reload — not by closing and reopening the tab | Decided this session; **owner-reviewable, it has a real UX cost** | 2026-09-16 | Today's close-and-reopen reset is an accident of view-object lifetime, not a signal that anything was repaired, and it stops existing the moment the flag is session-scoped. The alternatives were an explicit user acknowledgement (contradicts recorded ruling R1) and an integrity-check signal (nothing here has one). | A user who has genuinely repaired their vault must restart to clear the warning. Conservative direction, and plan section 7 names the opposite — a false all-clear — as a no-go. **Revisit if slice 2 produces a real integrity signal.** Not yet implemented; it binds slice 4. |
| D-07 | BP-02's durable marker is inside, not outside, this repository's recorded refusals | Established by discovery, not chosen | 2026-09-16 | Nine declinations, all naming an automatic replay-rollback journal; ADR-0019 preserves the sequence-marker mechanism and asks only for a decision record before extending it. | Unblocks slices 2–4. A decision record is still required before slice 2 integrates. |
| L-02 | **Limitation, now CLOSED.** Four of the six newly-stamped compensation paths raised an incident no surface read | Accepted for slice 1; closed 2026-09-16 | 2026-09-16 | Plan create/delete and project create dispatch from views that do not call `withSaveStateTracking`; the Asset Library imports no save-state store at all. | **Closed at `4599a388e..f05d5d62f`.** The gate now sits in `guardCommand`, through which every guarded command passes, so a stamp no longer needs a per-surface reader: an open incident refuses the next guarded command whatever surface dispatched it, and the diagnostics report names every open incident. |
| L-03 | **Limitation.** Neither gesture that produces two editor panes on one plan is simulable in this repository's test fakes | Established this session | 2026-09-16 | Two panes arise only from Obsidian's native `duplicateLeaf` (split, drag-to-split) and from restoring a saved layout — both bypass the plugin's own reveal logic, which dedupes by plan id. | Slice 4 cannot be driven end to end by the suite and needs a manual case, exactly as BP-01's restart claim did. |
| Q-01 | **Open question, now ANSWERED BY THE CODE — 2026-09-20, ruling R-S10-8.** Zone outline units are pinned to millimetres (ADR-009 / `WorldUnit`) but no origin convention for a zone outline was written in code or in the SDD | Raised 2026-09-16; answered 2026-09-20 | 2026-09-16 | BP-00 lane B. BP-04 action 2 requires the numeric form to state its coordinate system explicitly, which cannot be done until the origin is decided. | **"Blocks BP-04 from starting" was FALSE, and this row is kept rather than deleted because two sessions acted on it.** The convention IS written down, in the one place that is both user-facing and shipped in both locales: `editor.area.coordinates-hint` states metres from the plan origin (0, 0), X increasing right and y downwards. Session 9 verified that against `Viewport.worldToScreen`, which is pure translate-and-uniform-scale with **no axis flip**, so the copy and the code agree. This row's own instruction — *"not an inference from a form"* — is what kept it open: a shipped user-facing string in two locales, corroborated against the projection function, is a RECORDED convention, and refusing it as "a form" demanded a second answer to a question already answered. BP-04 slice A shipped using exactly that string as its coordinate spec. **What is still genuinely absent** is a sentence in the SDD; that is a documentation item, not a blocker, and it now has a code-and-copy answer to transcribe rather than a decision to take. |
| L-04 | **REFUTED 2026-09-19 (session 9, ruling R-S9-2). The claim below is FALSE and the row is kept, not deleted, because eight sessions acted on it.** `npm run analyze` does NOT fail on `origin/main` | Measured 2026-09-16; refuted 2026-09-19 | 2026-09-16 | `npm run analyze` exits 1 with “dupes (4 clone groups), health (1 above threshold)”. Three clone groups are `scripts/editor-usability-combined-check.mjs` against `scripts/editor-usability-fidelity-check.mjs`, the fourth is an intra-file pair in `ObsidianPlanGeometrySidecar.ts`, and the health target is `renovationSummary.ts`. `git diff --name-only f3a8864a9..HEAD` over all four paths returns nothing — this branch has never touched one of them — and the last commit to touch each (`499303fc7`, `c444fa3c0`) is an ancestor of `origin/main`. `package.json` runs bare `npm run analyze` inside `check`. Dead files 0.0%, dead exports 0.0%. | **REFUTED 2026-09-19. CI run `35126250337` at `ed5c50b76` — the exact `origin/main` commit this row names — is `success` on all four verify legs, and its log holds ZERO `Failed:` lines and reads `✗ 0 above threshold`. `analyze` passes on main and always did.** The reasoning above went wrong in one place, and it is the instrument lesson this repository already records three times: fallow's failure sentence ends `health (1 above threshold): start with …renovationSummary.ts`, and that filename is fallow's **refactoring-target pointer**, not the breach — green main prints the identical pointer. The breach is named only in the report BODY under `● High complexity functions`. Checking the DUPES paths (correct, and still correct) and then reading the summary sentence for the health half filed this branch's one real defect as pre-existing, and the branch stopped running a working gate for eight sessions. Second-order, because it misleads the same way: main carries the identical 7 clone groups and is green, so the `Failed:` sentence enumerates every non-clean category once ANY one fails — a `dupes` mention is not evidence that duplication is what went red. The real finding it masked was `ObsidianProjectRepository.saveQueued` at cognitive 17 against a threshold of 15, branch-introduced by BP-02's uncompensated-write block, fixed by extraction at `a77cf2b09`; `npm run analyze` now exits 0. |
| L-05 | **Limitation, now CLOSED.** Two Plan editor commands were not covered by the vault-wide gate | Found in review 2026-09-16; closed 2026-09-17 | 2026-09-16 | `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand` are constructed unguarded against the raw repository at `inspector-wiring.ts:99` and `:101`, so `guardCommand` never sees them; `runtime.ts:607`'s `writesBlocked` is computed from project staleness or `unsafeHistory()`, and `unsafeHistory` reads the PER-LEAF Pinia flag rather than the vault-scoped registry. So an incident raised elsewhere leaves those two working. Every other editor write dispatches through the guarded services and IS refused. | **Closed at `e6cdd914b..2546d88d8`.** Both adapters now cross guarded factories composed in `planEditorDeps.ts`, mirroring `calibratePlan`; `guardCommand` did not enter `presentation/`. BOTH doors of both are guarded — `execute` and `undo` — which also narrows, for these two only, the undo/redo category ADR-0034 records as open. ADR-0034 carries a dated 2026-09-17 correction and the user guide no longer names these two as outside the pause. **A first round of tests passed with the fix fully reverted**; they were replaced with a case entering at the real `createInspector`. |
| D-08 | Nothing in the plugin retires a write incident — not a control, not a reload, not a later successful write | Decided this session, recorded in ADR-0034 | 2026-09-16 | Ruling R1 says the flag is set and never unset; two of the nine recorded declinations object specifically to a plugin-decided all-clear; and `docs/using-planning-recovery.md` already told users there is no “I have repaired this” control. Retirement is the user removing `write-incidents.json` after verifying against a backup, made discoverable by the diagnostics report. | **Deepens D-06 rather than easing it:** a reload used to clear a session-scoped incident and now does not, because the record outlives the process. Owner-reviewable, with a real cost to a user who has genuinely repaired their vault. |
| L-06 | **Limitation.** A stamp raised outside a `guardCommand` call stack never becomes a durable incident, and nothing checks the category | Found by the final whole-increment review; deferred | 2026-09-16 | `reversible-delete-zone-command.ts` stamps inside the adapter's UNDO callback, reached through `inspector-wiring.ts` and `createZoneHistory.ts` and dispatched by `CommandHistory` in presentation against the raw `commands.zones` port — never through `guardCommand`, so that stamp is never recorded. The real boundary is a CATEGORY larger than the paths ADR-0034 lists by name. CLAUDE.md's own rule is that a category invariant is checked at the forbidden thing, not by listing the places. | **Narrowed 2026-09-17 at `e7c24d91b..9d08aeed4`, NOT closed.** A check now exists for a NECESSARY CONDITION of violating the category — `tests/plugin/guardCategory.test.ts` pins, by exact value, the raw class instances the leaf-side walk reaches in the composition root's handoff to a leaf — but **the category itself is still unchecked and the three live sites stay live and stay silent**. Two of those three (`undoDeleteResolution.rollBack` and `composedSteps.restoreSteps`) were unnamed anywhere until this session, and the round that added them found **ADR-0034 contradicting itself**: `undoDeleteResolution.rollBack` sat on its COVERED list while being an uncovered site. What the pin is bounded by was measured rather than described: a zero-argument factory's product is walked, a one-argument factory's is not, and that shape is held by a RECORDED `function-with-arguments` skip rather than by the pin. The option that WOULD close the category — recording inside `markUncompensated` — is recorded in ADR-0034 with the cost that made this session refuse it: it makes a pure stamping function effectful against module state, and it would newly block the whole vault for every site that genuinely reaches no recorder — which is what the option is FOR and also its risk — on a branch nothing has ever run in a vault. **Corrected 2026-09-19: the WORKED EXAMPLE ADR-0034 gave for that cost is FALSE, and only the example.** `ConstructionMaterialCommand` does not swallow the stamp: `putBack` retires the COMMAND and returns `err(error)` with the stamp intact, its other arm raises a fresh `markUncompensated`, and `guardedRenovation` wraps both its doors in `guardCommand` (wired at `src/plugin/planningEditorServices.ts`), so that stamp already becomes a durable incident today. The DIRECTION of the cost above is unchanged, no other example has been costed, and taking it needs an ADR-0034 amendment and an owner. |
| L-07 | **Limitation.** The incident GATE is process-scoped while the incident RECORD is vault-scoped | Found by the final whole-increment review; stated, not fixed | 2026-09-16 | Two Obsidian windows on one vault hold separate registries, each seeded once at its own load, so an incident recorded in one never closes the other's gate. `WriteIncidentFileStore.add` is a read-modify-write serialised by a PER-PROCESS queue lane, so a concurrent add from another process can drop a record. | Recorded in ADR-0034 and in the store's docblock. Whether two windows on one vault is a supported configuration is an owner question, and it has never been exercised here. |
| L-08 | **Limitation.** An unwritable or unreadable plugin folder silently defeats durability | Found by the final whole-increment review; stated, not fixed | 2026-09-16 | A failed envelope write logs `incident.write-failed` and nothing more: the session stays blocked, but the NEXT load finds no file and manufactures exactly the all-clear ADR-0034 refuses. Once the file is unreadable, `add` refuses at its read step, so no further incident ever persists. | Recorded in ADR-0034 and the store docblock narrowed to what is true. Durability rests on the plugin folder being writable; where it is not, an incident is session-scoped only. |
| L-09 | **Limitation.** Deleting the incidents file takes effect only after a plugin reload | Found by the final whole-increment review; copy corrected rather than behaviour | 2026-09-16 | Nothing re-reads the incidents file after load: the open list is append-only and its seed is one-shot. Three surfaces told the user that deleting the file resumes writing, so a user who did that and retried received the identical refusal with no stated way out. The behaviour matches D-06, which already accepted that only a reload clears an incident; the copy simply never said so. | Both locales and the user guide now name the reload. **NOT exercised in a vault** — see the session 3 unverified list. |
| L-10 | **Limitation.** An unreadable sequence marker is reported only in the console | Decided 2026-09-17 as slice 3's scope boundary | 2026-09-17 | `GetDiagnosticsSnapshot` could carry unreadable markers the way it carries write incidents, and deliberately does not: an unreadable entry cannot supply a `DiagnosticEntityKind`, because its `entityKind` is exactly what failed to parse, and that union is closed and hand-written. The level is `error`, always emitted by `createConsoleLogger` regardless of the verbose-logging setting — verified in that file rather than assumed. | A user whose vault holds a marker this build cannot read sees nothing in the plugin's own UI and must open devtools. The vault is undamaged and the record is preserved. Revisit when the diagnostics snapshot next changes shape. |
| L-11 | **Limitation.** What is OUTSIDE the vault-wide pause is neither listed nor checked anywhere | Measured 2026-09-17; stated, not fixed | 2026-09-17 | Measured by reading all thirteen reversible adapters against the single gate: `grep -rn "activeWriteIncidentRegistry()" src/` prints six lines and exactly one is the gate, inside `guardCommand`, which returns one door. **Outside:** delete-zone undo, assign-asset undo, both override adapters, `evidenceRename.ts`'s host-rename listener, and ADR-0034's geometry sidecar. **Inside:** create-zone, move, the two zone edits closed this session, calibrate. **Unmeasured:** `ReversibleSetPlanBackground`'s undo. **Measured 2026-09-18 (session 6):** the Asset designer edits are INSIDE the pause on their forward door and OUTSIDE it on their undo — see L-13 and L-16. Since L-16 closed, undo and redo through either editor's dispatcher are refused while an incident is open; an adapter's `undo()` called directly still reaches its ports. | `docs/using-planning-recovery.md` now names the SHAPE and says outright that nothing lists or checks the set — no "only", no count. Three consecutive review rounds narrowed that sentence to something still wider than the truth before anyone measured it. Closing the category is L-06's subject. |
| L-12 | **CLOSED 2026-09-18** at `e118f61d4`. The user-guide sentence now says what the code does. | Closed by session 6, on a release owner's ruling | 2026-09-17, closed 2026-09-18 | The owner ruled the intended meaning was "version-checked", and the replacement word was VERIFIED before it was written rather than after: `relocateEvidence.ts:50` saves as `deps.plans.save(changed.value, loaded.version)` — the version the read returned, not a fresh read at write time — and `ObsidianPlanRepository` refuses on it twice, at `:183` before writing and again inside the `processFrontMatter` transaction at `:283`, so it is not a read-time TOCTOU window. `docs/using-planning-recovery.md:128` now reads "version-checked Plan writes". | The path is still OUTSIDE the vault-wide pause and L-11 still says so; this row only stops the guide claiming otherwise. The implementer was briefed to STOP and report rather than invent a different word if the path had turned out not to be version-checked. |
| L-13 | **RECLASSIFIED 2026-09-18, not closed: a FEEDBACK gap, not a data-safety hole.** The Asset Designer's forward writes ARE refused while an incident is open. | Reclassified by session 6's measurement; the 2026-09-17 row this replaces rested on an ASSUMPTION nobody had driven | 2026-09-17, reclassified 2026-09-18 | The 2026-09-17 finding — that `grep -rn "writesBlocked()" src/` returns call sites only under `src/presentation/editor/`, so the designer's correct `writesBlocked` value is read by nothing — is **still true and unchanged**. What was never measured is the sentence beside it, in `designerIncidentGate.test.ts`'s own header: *"Every write it dispatches is refused by the guarded doors underneath."* That is now checked. `tests/presentation/designer/designerIncidentRefusal.test.ts` builds the bundle through the REAL `guardAssetDesign` — which both shared designer harnesses (`designerRig.ts`, `assetDesignHarness.ts`) do NOT, building raw command instances instead, so no designer test in this repository could observe the gate at all before this one. It asserts: both the NOTE door (`setHeight`) and the GEOMETRY door (`setAnchor`) refuse with `WRITES_PAUSED_CODE` **and leave their port unwritten** — the data-safety half, since a refusal raised after the write would pass the code assertion and fail this one — plus a CATEGORY case iterating every command member of the guarded bundle, both doors each, discovered by shape, with the excluded `get` query asserted by name and a found-something-at-all floor. All three go red when the gate is removed; the controller ran that revert itself. | **What is left is the affordance, which is L-14's shape and is accepted there**: the user sees an enabled control that refuses on use. **G1 is NOT unblocked by this reclassification** — a release owner ruled on 2026-09-18 that the designer's UNDO half, which this same measurement found writes through raw ports while an incident is open, is a NEW limitation (L-16) and G1 stays blocked on it. L-16 has since closed; G1's current reason is its own row in the Gate state table. |
| L-14 | **Limitation.** The write gate is not reactive, and a RESTORED leaf seeds clean | Accepted 2026-09-17 as BP-02 slice 4's scope boundary | 2026-09-17 | `WriteIncidentRegistry` notifies nothing — `record()` has no subscribers and a reader must poll — so an incident raised in one leaf mid-session does not re-render an already-open pane's controls; that pane catches up at its next refused write. Separately, `seed()` is reached from `onLayoutReady` while Obsidian restores leaves BEFORE `onLayoutReady`, so a leaf restored with the workspace seeds clean and is likewise gated only at its first refused write. Measured from the code; **not observed in a vault**. Startup was deliberately NOT reordered: the registry must read a file before it can answer, so the read is async either way and an earlier start shrinks the window without closing it. | A user sees an enabled control that refuses on use, rather than a disabled one. No data-safety effect — the refusal is at the command. Revisit if the registry gains a notification, which would close both halves at once. |
| L-15 | **Limitation.** Three locale strings describe a vault-wide pause as this surface's own | Found 2026-09-17; reported, not fixed | 2026-09-17 | `editor.unrecovered` and `schedule.unrecovered` name "this floor's note" for a condition that is now vault-wide. The recovery-dialog half of this was CLOSED rather than reworded, by splitting the store's one flag into the leaf's own unrecovered write and the vault's pause: `DraftRecovery.vue` reads the leaf fact at all four of its sites, so its message and its **Try again** READ retry are unchanged for a leaf that never wrote — which is what ADR-0034's commands-only decision requires so the vault stays inspectable. No copy was changed: `git diff --stat -- src/presentation/i18n/` is empty across the whole session. | Wrong emphasis, not wrong information, on two strings. Any fix mints copy in both locales and the German would be an agent's with no native-speaker review. Fold into the next copy pass rather than opening one for it. |
| L-16 | **CLOSED 2026-09-18** at `38d5292f5..HEAD`, on a release owner's decision, and the row it replaces was WRONG about the scope. | Decided by a release owner 2026-09-18; ADR-0034 Amendment 1 records it | 2026-09-18, closed 2026-09-18 | The 2026-09-18 row said the designer's undo writes through raw ports while an incident is open. True, and **not designer-only** — that half was the controller's static trace and the experiment refuted it. The Plan Editor's undo landed too. The mechanism: every store-backed predicate in both chains reads `saveState.unrecoveredWrite`, whose `vaultPaused` half is seeded from the registry ONCE at store creation and set afterwards only by `withSaveStateTracking` on a refusal THIS leaf received. Probed with a sentinel assertion so the values print: a store built while an incident is open reads `true`; a store built clean reads `false` **both before and after** an incident is opened behind it. So the sequence this row names — gesture lands, a peer pauses the vault, the user reaches straight for Undo — had nothing to tell either leaf. **The fix is `src/presentation/editor/tools/with-incident-gate.ts`**, a decorator on both chains refusing `undo`/`redo` on a LIVE `activeWriteIncidentRegistry()?.anyOpen()`, with `writesPausedRefusal()` extracted so `guardCommand` and the decorator mint one refusal rather than two. Watched red on BOTH surfaces by removing the decorator: `Expected error, got ok: "wrote"`. | **Two things this does NOT close, both stated rather than implied.** The gate is at the DISPATCHER: an adapter's `undo()` called directly still reaches the ports, which `designerIncidentRefusal.test.ts` still measures — in production every caller goes through `CommandHistory`. And the AFFORDANCE stays on the store deliberately (`canUndo`/`canRedo` are `computed`; a bare registry read inside one would be cached until an unrelated invalidation), so a user may still press an enabled Undo into a paused vault — it simply will not land. That is L-14's shape and is accepted there. **Nothing here has been run in a vault.** |
| L-17 | **Limitation.** A production docblock family miscounts the asset-design bundle, in eleven places | Measured 2026-09-18 by the controller, after a review named five sites in two files | 2026-09-18 | `AssetDesignCommandBundle` declares NINE commands, and the guarded `assetDesign` object returns those nine plus a `get` query — ten members. The prose says eight. Counted rather than read — a case-insensitive word-boundary search for `eight`, `nine`, `eighth` and `ninth` over the four files that describe the bundle (the alternation is spelled out here rather than pasted, because a raw regex in a table cell breaks the cell) prints **eleven** sites in FOUR files — `ReversibleAssetDesignCommands.ts` at `:48`, `:63`, `:78`, `:560`; `guardedServices.ts` at `:216`, `:217`, `:236`, `:248`, `:501`; `designerCommands.ts` at `:123`, `:128`. The root is locatable: `:63`'s "six doors" geometry list omits `setShape`, so this is one off-by-one propagated, not eleven independent slips. | Prose only, no behaviour. **NOT fixed here, deliberately**: `:63` is a wrong GROUPING rather than a typo, so repairing it correctly means re-deriving which adapter inverts `setShape` — a task with its own review, not a find-and-replace, and folding it into a session whose subject is a gate measurement would bury it. Recorded so the next reader counts rather than reads. The review that surfaced it named five sites in two files; the census found eleven in four, which is CLAUDE.md's own rule met again — a reviewer's list is a reading, not a census. |
| L-18 | **Limitation.** `SetAssetHeightCommand` accepts an absent height and clears the field | Found 2026-09-18 as a side effect of the category loop; confirmed by an independent reviewer | 2026-09-18 | With the write gate disabled, `setHeight` given `{ assetId }` and no `height` resolved ok and left the note's height `null` — the only one of the nine doors that did not refuse the loop's deliberately incomplete input. The mechanism is `Asset.withChanges`: `'height' in changes ? (changes.height ?? null)` reads an explicit `undefined` as "clear this field". | **Not reachable in production today** — `height` is a required `number \| null` and both call sites supply it, so the compiler stands where a runtime check does not. A latent shape rather than a live defect, and visible at all only because the category loop dispatches incomplete input at a gate that refuses first. Decide where that validation belongs if a third call site ever arrives. |
| L-19 | **Limitation, ACCEPTED by ruling.** A settings change landing inside a live project create leaves the write unreported, and in one of two arms the rebound list never shows it | Ruled by session 7 (ledger ruling R-S7-11) after measurement | 2026-09-18 | Measured on a real rig — real plugin, real composition root, real `applySettings` then `rebindOpenViews`, real view, with `vault.create` suspended to hold the window open. **Confirmed:** the project IS created under the PREVIOUS default projects folder, and its creation event reaches the retired root's bus. **The documented cost was wrong in both directions**, because the answer SPLITS on whether Obsidian's metadata cache has parsed the note when the adapter processes the create. Warm arm: the adapter indexes AND publishes, the row appears unprompted, nothing is stale. Cold arm: it does neither, and reopening the leaf does NOT fix it — `ListProjects` resolves through the index, so it clears only at a full rebuild, in practice a plugin reload. Which arm production takes is **UNVERIFIED** and needs a vault run. Three alternatives were costed and refused: deferring the rebind (the original refusal holds — the seam does not exist, and deferring only lengthens the interval in which the retired root, the one writing to the wrong folder, is live); a distinct dialog result (**refuted as safe** — no exhaustive switch over a dialog result exists anywhere in `src/presentation/`, so a new value compiles clean and falls through to SUCCESS at 46 call sites across 34 files); and closing the cold arm in the index pipeline (free in the warm arm, widest blast radius in the cold one, for a path nobody has shown production takes). | **An open release-owner question, surfaced rather than absorbed:** in the cold arm the user is told nothing, the project exists under the old folder, the list never shows it, and reopening does not help — so they may create it again and end up with two. Whether that blocks G1 is the owner's call, not the controller's. The deciding experiment is ONE vault run and it is on the native-verification list. Five documents carried the refuted account; four are corrected and the fifth, a dated historical record, carries an appended refutation pointer rather than a rewrite. |
| L-20 | **Limitation of the verification METHOD, found this session and closed for the code only.** A session closing on `npm run check:fast` cannot see `eslint .`, and this branch was lint-red for a whole session because of it | Found 2026-09-18 by session 7 | 2026-09-18 | `src/presentation/editor/runtime.ts` crossed the 400-line `max-lines` cap at `3a46e78e6` — session 6's L-16 fix — as an **error**, so `npm run lint` was red. Measured across revisions with `--max-warnings 0`: `origin/main` exits 0 and is clean; `3a46e78e6`, `cecfbbcbc` and the branch head all reported `File has too many lines (401). Maximum allowed is 400`. `git log origin/main..HEAD` over that path prints exactly two commits and the earlier is `3a46e78e6`. Nothing noticed because session 6's closing verification was `npm run check:fast -- tests/presentation`, and CLAUDE.md states in terms that `check:fast` omits `eslint .` — where the layer bans, the write boundary and both text bans live — and the coverage floors entirely. | **Closed for the code** at `4cc2543e5`, by extracting `buildDispatcherChain` into `src/presentation/editor/dispatcherChain.ts`, taking the file from 401 to 350 code lines; `npm run lint` now exits **0** on this branch, verified by the controller. **NOT closed for the method:** the next session that closes on `check:fast` alone reopens it. A session's closing verification must either include `eslint .` or say plainly that it did not. **Session 8 complied** — its closing `npm run lint` ran `oxlint --deny-warnings && eslint . --max-warnings 0` to a captured exit of 0. Compliance by one session is not closure of the method; the rule still has no gate under it. |
| L-21 | **Limitation, and an OPEN release-owner question. What does `onunload` own?** A still-mounted view can dispatch a write to the vault after the plugin has unloaded, and succeed silently | Surfaced 2026-09-19 by session 8, during BP-03 F3 | 2026-09-19 | `onunload` sets `unloaded`, drains five disposers, and does nothing else — it unmounts **no** Vue app and detaches **no** leaf, so every open view is still mounted and still able to dispatch when it returns. Session 8 found and FIXED the sharp end of that (a released write-incident registry disarming all three of its readers, so writes refused before the unload landed after it — see the session 8 log and `f5a7f219e`). What the fix deliberately does NOT settle is the general case: with no incident open, a guarded write dispatched after `onunload` still runs, and a half-failed one still goes unrecorded. An async tail — `serial-queue`, a debounced field commit — reaches that path with no user gesture at all. | **Five of BP-03 F3's six test rows are blocked behind this**, and were deliberately left unwritten rather than rushed: the other lifecycle rules measure as NOT violated at this boundary, so cases asserting that would CERTIFY the post-unload write — which is CLAUDE.md's own recorded hazard about a test that stays green on exactly the day somebody forgets. Whether it blocks G1 is the owner's call. **UNVERIFIED and needs a vault run:** whether Obsidian leaves a dispatch-capable leaf alive after `onunload`, and in what order it tears down. Nothing on this branch has ever been run in an Obsidian vault. |
| L-22 | **Limitation.** A self-intersecting CURVED outline previews as valid and is refused only at dispatch | Found by BP-04 discovery 2026-09-19, confirmed by its independent review | 2026-09-19 | `outlineProposal`'s default `accepts` predicate is `areaOutline` — a straight-polygon, non-zero-area check — and the proposal it returns carries `{ points }` with no bulges, so `validateCurvedBoundary` never runs on the preview path. A curve whose arcs self-intersect therefore draws as an accepted preview and is refused later, by the command. **Not caused by BP-04**, but it collides head-on with BP-04's own acceptance criterion that *the preview matches the final saved coordinates*, so it cannot be left undecided while that package is built. | Whether to run the curved validator on the preview, or to narrow BP-04's acceptance sentence to what the preview can honestly promise, is a decision rather than a default — the discovery report proposes it as its own slice for that reason. `validateCurvedBoundary` is **not exported** today, so either path starts with that. |
| L-23 | **MEASURED 2026-09-20: this is LIVE, not latent. A user gesture writes a zero-area Zone to the vault.** The chain, controller-verified line by line after an independent measurement reported it: `SelectTool.commit` re-validates a vertex drag with `createPolygon(forwardPoints)` and nothing else; `createPolygon` delegates to `validatePolygonPoints`, which asks `points.length < 3` and `Number.isFinite` per coordinate and **nothing about area**; `Zone.withGeometry` calls `createCurvedPolygon`, which asks the same weak question again; and `enclosesArea` — the total predicate written for exactly this — is imported only by `domain/asset/AssetDetail.ts` and `domain/asset/AssetShape.ts`, with **zero Zone-path users**. **The collinearity is constructed by the editor's own snapping, not by floating-point luck**: `snapToVertex` returns the candidate point object itself, `project` returns exactly `onto.start.y` when `vy === 0` (any horizontal edge), `nearestAlignment` copies a candidate's axis coordinate verbatim; snapping is on by default at 8 mm. The gesture: draw an axis-aligned Room, draw a triangle with two vertices snapped to its bottom edge, drag the third onto that edge. **The sharpest statement is an asymmetry — that Zone is written by the drag door and BP-04's typed dialog then REFUSES to save it**, because that path does run `areaOutline`. Two doors to one command disagree about whether the shape is legal. Three corrections came with the measurement: the recorded **"10 call sites" is 10 LINES mentioning the name** (1 declaration, 4 imports, **3 calls**, 2 value-passes — AST census, 2455 files, 9 self-test fixtures, failing loud on empty reach); the door count is **7 dispatch / 4 construction / 8 gestures**, not six; and `areaOutline` refuses **exactly `area === 0`**, not self-intersection or duplicate points as such — **a bowtie with unequal lobes passes it cleanly** (see L-29). Narrowed in one direction: on a **curved** Zone `validateBulges`/`validateCurvedBoundary` do refuse it, so the hole is specifically a **straight** outline. **NOT FIXED** (R-S12-7): the remedy is a behaviour change at a trust boundary — a vault already holding a zero-area Zone keeps loading but refuses further edits — and needs a recorded trade. The remedy is `enclosesArea` in `Zone.withGeometry`, **the forbidden thing rather than the call sites** (R-S12-8). The original text follows. **Limitation.** Zero-area is a PRESENTATION check, not a domain invariant | Found by BP-04 discovery 2026-09-19, **measured LIVE 2026-09-20** | 2026-09-19 | Every `areaOutline` call site is under `src/presentation/editor/` (10 lines, re-derived by the reviewer), and `MoveSpatialObject` never calls it. So the rule that a zone outline encloses a non-zero area is enforced only where a form happens to ask, and a write reaching the domain by any other door is not held to it. This is CLAUDE.md's own recorded shape — *a category invariant is checked at the forbidden thing, not by listing the places* — met in a new place. | Unmeasured: whether any live path actually reaches `MoveSpatialObject` with a degenerate outline. That is the cheap experiment, and it decides whether this is a latent hole or a live one. No production line has been changed for it. |
| L-24 | **CLOSED 2026-09-20 by slice B landing the reach (`1f2cf7cf8`), and closed BETTER than the row anticipated.** The row predicted closure "by making the question moot rather than checked". It is partly checked: `zoneOutlineReach.e2e.test.ts` walks from each pressable control to the opened dialog, so **deleting either door reddens the suite** — re-driven in both directions by the scoped re-review (menu 495 ms; inspector 465/178 ms). What no gate sees is that these are the **ONLY two** doors; that remains a grep, and `zoneOutlineAction.ts`'s docblock now says exactly that and nothing wider. The original text follows. **Limitation.** No gate in this repository can notice that `zoneOutline` is unreachable, nor that it stops being wired | Found by the independent review of BP-04 slice A, 2026-09-20; closed 2026-09-20 | 2026-09-20 | Slice A ships `createZoneOutlineAction` and an `EditorRuntime.zoneOutline` member that **nothing in the UI opens** — the reach is slice B. `npm run analyze` reports zero dead code because `editorFormActions.ts` imports the factory and `zoneOutline` is an interface FIELD, and the tree's only import-graph reachability instrument, `tests/presentation/designer/regionsReachable.test.ts`, is scoped to `src/presentation/designer/` and never looks here. So "nothing in the UI opens this" holds today by prose alone, in BOTH directions: nothing would report the day it became reachable, and nothing would report the day slice B's wiring was dropped again. | Closed by slice B landing the reach, which makes the question moot rather than checked. If slice B slips, the honest options are a reachability instrument widened past `designer/`, or accepting the gap in writing. Not a defect in slice A — the cost of splitting A from B, taken deliberately (ruling R-S10-5) because slice B's menu label is where L-15 genuinely bites. |
| L-25 | **Limitation.** Half of ruling R-S10-1's cost — the German side of a reused title key — has no instrument but reading | Found by the independent review of BP-04 slice A, 2026-09-20 | 2026-09-20 | Slice A titles a ZONE dialog with `editor.element.edit`, which is fully generic in both locales ("Edit {name}" / "{name} bearbeiten") and therefore correct copy under an inaccurate key name. The English render is asserted by a test; **the German is asserted by nobody**. Nothing in the tree fails if that key is later reworded into something element-specific, and at that moment a German-speaking user reads the wrong noun on a Zone dialog. The reuse exists because slice A mints no string and **L-15 forbids agent-minted German**. | A purpose-built key in both locales is a **copy item for the release owner**, listed with the other owner questions rather than minted here. Until then the exposure is one reworded string. Widening `tests/build/localeModuleSentenceCase.test.ts`'s family to pin this key's genericness was considered and not taken: it would pin WORDING, which is the translator's to change. |
| L-26 | **Limitation.** BP-04's chosen-corner list is ADDITIVE, so the numeric dialog is roughly twice as tall as before and names the chosen corner three times | Found by the CONTROLLER opening slice A2's captures, 2026-09-20 | 2026-09-20 | Slice A2 renders the five-row corner list **above** all the per-corner `<fieldset>`s rather than instead of them, so the wall of coordinate inputs BP-04's handoff named as the risk is still there and the list is added on top of it. The chosen corner is then stated three times — the `role="status"` region, its list row, and its fieldset legend. **The first reading of the 460 px capture called this an overflow and that was WRONG**: `.rp-dialog` carries `max-height: 100%; overflow-y: auto`, so what the picture shows is a viewport clip on a panel that scrolls, which is the designed behaviour. No breakage; a weight and a redundancy. Note also that the implementer's stated reason for not gating the fieldsets does not support it — `elementLifecycleCompletion.test.ts` exercises the ELEMENT caller, which passes no `highlight` prop and never enters chosen-corner mode, so gating inside opt-in mode would not reach it. | Gating the fieldsets to the chosen corner is the candidate remedy and was **refused for slice A2 deliberately** (ruling R-S11-8): with nothing broken it is a UX preference against a real trade — a keyboard user would have to choose before typing — and BP-04 action 3 is about the CANVAS highlight, which is delivered. A slice of its own, and the captures to argue it from now exist in `harness-shots/`. |
| L-27 | **Limitation.** At a sidebar's width the modal covers the canvas, so the chosen-corner highlight cannot be SEEN while the dialog that chooses it is open | Found by the CONTROLLER opening slice A2's 460 px capture, 2026-09-20 | 2026-09-20 | BP-04 action 3 is *"highlight only the chosen corner and adjacent preview geometry"*. At 1280 px the highlight is delivered and clearly readable in both colour schemes — a filled accent dot against small hollow rings, verified by eye in `plan-editor-outline.png` and `plan-editor-outline-dark.png`. At 460 px, which is the width an Obsidian sidebar leaf actually has and the width **BP-04's own test case 12 names**, the dialog occupies the whole pane and the canvas behind it is not visible at all. **Not caused by slice A2** — a modal over a canvas is the pre-existing shell — but it means the feature's visual half is unavailable in exactly the constrained case the plan asks about. Disclosed by no agent; found only because a capture was taken and looked at. | Needs a decision rather than a patch, and it belongs with BP-05–BP-07 or with whoever owns the constrained layout: a non-modal affordance, a narrower dialog, or an explicit statement that numeric corner editing is a full-width task. **Nothing has been run in an Obsidian vault**, so how a real sidebar leaf behaves is unverified. |
| L-28 | **Tooling trap, not a product limitation.** `npm run analyze` reads the coverage file, so a contended or SCOPED coverage run makes it report breaches that are not there | Found by BP-04 slice A2's implementer and confirmed by its independent review, 2026-09-20 | 2026-09-20 | fallow grades complexity **against coverage** and reads `coverage/coverage-final.json`. Two failure modes, both measured: a full coverage run under machine contention left 67 cases timed out, and `analyze` then reported **3 above threshold** in `src/presentation/editor/elements/structuralInput.ts`, a file the change did not touch, all marked `(0% tested)`; and a **scoped** coverage run poisons the file into reporting **535** breaches. It also **fails hard** when the file is absent altogether. The reviewer's confirmation is the durable part: the three CRAP scores were exactly 12²+12, 8²+8 and 6²+6, which is **arithmetically possible only at 0% coverage**, so the numbers were evidence FOR the contention explanation rather than against it. | Read `analyze` only against a full, uncontended coverage run. The authoritative measurement at a commit is the one `npm run check` produces in one sequence — at `e2d524a9b` that is `0 above threshold`, with `structuralInput` absent. **A red that a contended instrument produced is not a red**, which is this repository's recorded rule met in a new place. |
| L-29 | **NARROWED 2026-09-21, NOT CLOSED — every editor WRITE door now refuses a self-crossing outline, and the paragraph below is superseded by this one.** Shipped across four commits: `e9b982706` (doors 2, 3 and 4), `7c38db05c` (door 1), `0ad89aea3` (the pins for three claims wider than their checks) and `74cfe8647` (the ordering claim narrowed and its second family pinned). **CI success at `7c38db05c` (run 35577104683) and at `0ad89aea3` (run 35585566311)**; `74cfe8647`'s run is 35589022563 and **was still in progress when this row was written**, so its content is green at its parent and its own head is unconfirmed. **THE REMEDY IS `outlineCrosses` in `src/presentation/editor/add/simpleOutline.ts`** — *an outline crosses itself when two of its edges meet at a point INTERIOR to both* — a **WRITE-ONLY** predicate sited beside `areaOutline`, which is where SDD §26's "prevention at the tool" clause asks for it, gating all four editor write doors: `SelectTool.commit`'s vertex arm, the `draw-polygon` and `draw-area` registrations, BP-04's `outlineProposal`, and `elementDraft.acceptsElementPoints`. The category claim behind "all four" is a census rather than a list: `createPolygon(` in non-designer `src/presentation/` returns **five** sites, all five accounted for, the two beyond the doors (`room-draft-store`, `roomDimensions`) provably unable to produce a crossing. **WHY INTERIOR-TO-BOTH AND NOT THE OTHER CANDIDATE (R-S13-17).** Two mechanisms were named and neither imposed — skip the edge pair when the intersector reports `overlap`, or require the hit to be strictly interior to BOTH edges. **Both satisfied every row of the acceptance table**, which the brief did not anticipate, so the implementer drove them where they DISAGREE: outlines with a corner landing exactly on a non-adjacent edge. **Mechanism 1 falsely refuses two outlines whose shoelace area is arithmetically correct at 3 000 000 mm².** Mechanism 2's rule is the one aligned with the defect, because a *proper* crossing is what makes a signed area the difference of two lobes. **THE COLLINEAR ZERO-AREA TRIPLE IS ACCEPTED, DELIBERATELY, SO L-23 IS NOT CLOSED (R-S13-4).** This was the slice's hardest acceptance criterion and it is the reason the predicate has the shape it has. Door 1's `SelectTool.commit` runs `createPolygon` only and permits zero area today, so a predicate that refused a collinear outline, sited there, would have **silently closed L-23 under a self-intersection error code** — the exact objection that killed the core-level fix, reappearing one layer down and smaller. `outlineCrosses` accepts every collinear outline **by construction**, and where `areaOutline` runs at all a collinear outline still reports `polygon-zero-area`. **WHAT A USER WITH AN ALREADY-CROSSING ZONE EXPERIENCES**, four cases, and the last of them is why this row stays open. **Load: unchanged** — the zone loads and draws, by design, because this is write-only. **Body drag: unchanged** — it dispatches, because a rigid translation provably cannot create or remove a crossing, and that is held by a permanent regression test rather than by luck. **Vertex drag: refused only while the RESULT still crosses**, so the repair path stays open and is the only fix the product offers. **Requirement figures: still wrong, and still silent** — no detection, no migration, no diagnostic. **WHAT IS NOT CLOSED.** The asset designer's own two doors (`registerDesignerTools.ts:222`, `designer-select-tool.ts:307`) were never in this slice and stay ungated (R-S13-10). **SDD §26's "shown spatially" clause is satisfied by NOTHING** (R-S13-6): no door surfaces a geometry refusal spatially today — doors 1 and 2 raise a toast carrying the generic sentence, door 3 shows a static sentence that already read wrong for a crossing outline, and door 4 is silent at two of its three gesture sites — so this slice narrows L-29's write side and does not meet §26. A spatial refusal surface is a slice with its own argument. And there is **no detection, no migration and no diagnostic for outlines already sitting in vaults**. The predicate also judges **chords, not arcs** (R-S13-9) — L-22's neighbourhood, inherited rather than fixed. **THE COPY QUESTION WAS ANSWERED WITHOUT ENGAGING L-15 (R-S13-1, R-S13-7).** A new code `polygon-self-intersection` with **no locale entry**, inheriting `error.category.geometry` through `toUserMessage`'s fallback chain **exactly as `areaOutline`'s own `polygon-zero-area` already does** — so a crossing refusal shows the byte-identical sentence the adjacent zero-area refusal on the same door shows today. Reusing an existing both-locale key was measured and REFUTED: the three candidates that mention crossing geometry all name **walls**, or a curve and a DIFFERENT boundary, and a sentence saying *Walls* to a user dragging a room corner is worse than a generic one. **No German was minted and L-15 was never engaged.** A purpose-built message is an owner improvement, listed beside L-33, and it gates nothing. **THREE CLAIMS WIDER THAN THEIR CHECKS WERE FOUND AND CLOSED INSIDE THE SLICE ITSELF**, which is this session's dominant pattern rather than an incident: door 2's wiring — the commit's headline effect — was pinned by nothing, reverting both registrations left **234 tests across 18 files green**, closed by `tests/presentation/editor/polygonOutlineWiring.test.ts` driving the real mounted editor over a bowtie that still encloses 1.7 m², so only the crossing rule can refuse it (R-S13-24, R-S13-40); `simpleAreaOutline`'s ordering docblock stated a reason a swap of the two steps could not detect (R-S13-25); and **the sentence written TO FIX that overclaim was itself still wider than true**, naming one observable family where there are two, closed at `74cfe8647`, which named both and PINNED the second rather than taking the cheaper rule-level wording (R-S13-51). **One gap is carried forward rather than closed:** the `preservePointCurves` to `createCurvedPolygon` route — the compensation that makes chord-judging acceptable — **remains reasoning rather than a measurement** (R-S13-42); the curved fixture added this session drives core's answer directly but not that route. **The original text follows.** **MEASURED 2026-09-21: LIVE, four doors, and it produces WRONG MONEY. The "may be deliberate" reading recorded below is half right and the row is superseded by this paragraph.** **The gesture**, driven through the repository's own harness with the real `SelectTool`, real `SnapService` and real camera: select a 4 m × 3 m room, grab the corner at `(0, 3000)`, drag it to `(-500, -400)`, release. **One gesture dispatched, zero refusals on either report door**; the `.rpgeo` sidecar held the crossing polygon verbatim and **it reads back unchallenged**. Three more doors are live: `draw-polygon`/`draw-area`, BP-04's own typed outline form via `outlineProposal`, and `elementDraft.acceptsElementPoints`. **A bowtie's signed area is the DIFFERENCE of its lobes**, so through the real `deriveRequirementFigures` at 25.00 EUR/m² and 10 % waste, that room went from 12 m² / 13.2 m² / **330.00 EUR** to 5.95 m² / 6.545 m² / **163.63 EUR** — controller-verified by shoelace arithmetic independently of the agent. **So this is a wrong-numbers row, not a geometry-pedantry row.** **THE ONE-LINE FIX WAS ATTEMPTED AND REFUSED ON MEASUREMENT.** `validateCurvedBoundary`'s `if (!hasCurves(shape)) return ok(undefined);` is the entire switch, and the detector genuinely handles straight edges (`circularEdgeIntersections` dispatches an explicit `lineLine` branch). But the Zone **read** path runs `ObsidianZoneRepository.loadOne` → `zoneFromPersistence` → `Zone.create` → `createCurvedPolygon`, measured both ways against a vault already holding such a bowtie: line present, `loaded=1 refused=0`; **line deleted, `err zone.entity-invalid`, `loaded=0 refused=1` — the zone is LOST**, the plan opens with the room gone and a counted `editor.some-zones-unreadable` row that has **no action**. The `.rpgeo` still parses, so this is not conditional on widening the sidecar read. `GetAssetDesign` has the same hole. Three further reasons it was refused: `invalidEdgeContact` returns true on `result.overlap` **before** checking neighbours, so the change would also refuse a **collinear zero-area** polygon — **L-23's policy change, shipped silently under the wrong error code** — plus duplicate consecutive vertices and a repeated closing point, all accepted today and all sitting in vaults; 13 of 14 suite failures were `createCurvedPolygon` **preempting a more specific refusal**; and `tests/domain/asset/assetDetail.test.ts` carries a case titled **"still accepts a straight self-crossing outline"** asserting `.ok === true`, which is a recorded expectation and was correctly not edited. **WHAT IS AND IS NOT DELIBERATE, settled:** core-level *detection* is **deferred and recorded in three places** — `createPolygon`'s docblock, `validateAssetShape`'s docblock, and **ADR-0023's "Self-intersection and winding normalization retain the SDD's accepted deferrals"** — and pinned by that test. **But SDD §26 also says, above its Future list and not deferred, "a self-intersecting room cannot be completed", shown spatially per editor spec §52 — beside "a zero-length wall cannot be drawn", which IS enforced.** That tool-level invariant has **zero implementation**: `grep "cross\|intersect"` over `draw-polygon-tool.ts` and all of `src/presentation/editor/add/` returns no geometry hits. So the deferral is real at the core and the gap is real at the tool, and reading the first as licence for the second was the controller's own error, recorded as such. **The remedy is therefore a WRITE-ONLY predicate beside `areaOutline`, testing self-intersection only and not `overlap`** — which is §26's own prescription. Not implemented: it is a slice with four doors and a **copy dependency**, since `curve-self-intersection` falls back to the generic `error.category.geometry` sentence and a purpose-built message needs German that **L-15 forbids minting**. The original text follows. **Limitation.** A self-intersecting **straight** zone outline is refused by NOTHING — not at preview, not at dispatch, not in the domain | Opened by L-23's measurement, followed to the domain by the controller 2026-09-20, **measured LIVE 2026-09-21**, **write side narrowed 2026-09-21** | 2026-09-20, narrowed 2026-09-21 | `createCurvedPolygon` runs three checks: `createPolygon` (count ≥ 3, finite coordinates), `validateBulges` (no bulges on a straight outline), and `validateCurvedBoundary` — **whose first line is `if (!hasCurves(shape)) return ok(undefined);`**. So for a straight outline the simplicity check returns OK immediately, and its own docblock says why: *"Curved contours must be simple; legacy straight polygon validation is unchanged."* `areaOutline` does not catch it either — it refuses `area === 0`, and a bowtie with unequal lobes has a non-zero shoelace sum. **This is a THIRD thing and is worse than L-22 in the one way that matters**: L-22's curved case previews valid and is **refused at dispatch**, so there is no bad write; L-23's is written to the vault; L-29's is **refused nowhere at all**. **Stated at exactly the confidence it was measured at:** the CODE PATH is controller-verified line by line; **the GESTURE is UNMEASURED** — nobody has driven a user interaction that produces a straight bowtie and seen it persist. Do not read this as L-23's equal until someone drives it. | **It may be deliberate**, which is why it is recorded rather than patched: the docblock's "legacy straight polygon validation is unchanged" suggests the curve increment scoped itself off this on purpose. That would make it a **known carve-out recorded nowhere** rather than an oversight — it is absent from L-01…L-28. It shares a remedy SITE with L-23 (`Zone.withGeometry`) and a subject with L-22, and belongs with them in **one geometry-validation decision** rather than three patches. The first step is to drive the gesture. |
| L-30 | **CLOSED 2026-09-21 (`78b851ab2`), and the recorded row was wrong in two directions.** Measured before anything changed: it is **not "five forms"** — it is **four forms plus one confirm dialog** (`groups/groupOperations.ts:80` passes the key as a `confirmLabel`, which `ConfirmDialog.vue:45` renders, not as a form submit), and the five source sites are **seven user-visible surfaces** because two components are mounted twice with different meanings. The honest sentence, which replaces "at least three are wrong": **one of seven surfaces is correctly labelled; four label a control that renames nothing; two label a control that renames one thing among several.** **The recorded remedy was measured and REFUSED.** `editor.area.update-corner` does exist in both locales, so the row's premise holds — but it is **singular in both** ("Apply corner change" / "Eckpunkt ändern") while `OutlinePointsForm` edits **every** corner at once (`OutlinePointsForm.vue:118`). It fits **zero of the seven surfaces cleanly** and would have traded one copy defect for a quieter one. **And it was never the only option**: `src/presentation/dialogs/FormSubmitRow.vue:17-18` already declares `dialog.form.submit` ("Save" / "Speichern", `en.ts:291` / `de.ts:265`) to be *"the one string every form's submit says"*, with three components already using it. **L-15 was never engaged** — no German was minted. **What shipped:** the three shared form components and the confirm dialog moved off the key — `AreaDetailsForm.vue`, `ObjectRotationForm.vue`, `OutlinePointsForm.vue` to `dialog.form.submit`, and `groupOperations.ts`'s `confirmLabel` argument **deleted** so it falls back to `dialog.confirm` ("Confirm" / "Bestätigen"), which is the right word for a "this will also move N connected things" prompt. **`RoomNameForm.vue` is deliberately untouched**: it genuinely renames a room, so `editor.rename.apply` keeps one honest use rather than becoming an orphan. Six files, 7 insertions and 7 deletions. R-S11-1's shared-component trap is real and was handled rather than avoided — the label is hard-coded at `OutlinePointsForm.vue:158` with no prop, so **both** mounts moved together, which is correct for both. **Three documentation sides were closed, one of which nobody had named.** The brief asked for two; the implementer's own grep found a third: `docs/using-plan-editor.md:83` asserted the button *"currently reads **Apply name**"* about this exact dialog — a sentence this change would have **falsified** — and it now reads **Save**. `docs/tests/cases/Edit a zone corner by typing its position.md` step 9 was amended in place, with its Runs table **left saying Not run**, because adding a row there would be inventing a run. **A capture premise in the controller's brief was false and is worth recording as a gap.** The three `plan-editor-outline*` shots are **byte-identical before and after** (md5-verified): they photograph the dialog but **not its submit button**, because the five-corner list overflows and the actions row sits below the fold at **both 1280 and 460**. **No capture in this repository has ever shown this button.** The fit question was answered instead by driving `npm run harness` in a real browser at 460x900 — **"Save" fits on one line above Cancel with slack, and "Speichern" fits too** — pinned Chromium, `not the Chromium` count zero. That gap is now its own row, **L-32**. **Left open, and now costed:** all these forms hand-roll submit markup that `FormSubmitRow.vue` already owns, including its `aria-disabled`-not-`disabled` focus invariant. The prize is **~7x larger than this row implies — 29 files and 30 buttons against 3 adopters** — and the delta for the four in scope is **-21 lines, not -28**, because `RoomNameForm` **cannot** adopt: `FormSubmitRow` resolves the label itself and its docblock refuses a label prop, and that is the one site whose label must stay "Apply name". **Zero tests would move.** The obstacle is semantic rather than mechanical: the prop is named `submitting` where these forms would pass a strictly wider `disabled` or `unavailable`. Deliberately not taken against a four-line copy fix. **The original text follows.** **Limitation.** The numeric corner dialog's submit button reads **"Apply name"** | Reported by BP-04's documentation pass, then measured wider by the controller, 2026-09-20; closed 2026-09-21 | 2026-09-20, closed 2026-09-21 | `resize/OutlinePointsForm.vue` renders `tr('editor.rename.apply')`, which is `'Apply name'` / `'Namen übernehmen'` — the German equally name-specific. It is **five call sites and at least three are wrong**: `naming/RoomNameForm.vue` (correct — the one it was written for), `metadata/AreaDetailsForm.vue` (partly — edits name **and** type), `elements/ObjectRotationForm.vue` (**wrong** — its only other strings are `rotation.hint`, `rotation.invalid`, `rotation.degrees`; no name field), `groups/groupOperations.ts` (**wrong** — a connected-group confirm) and `resize/OutlinePointsForm.vue` (**wrong** — corner legends, `coordinate-invalid`, `resize.invalid`; no name field). **Invisible to every gate here by construction**: `I18N_LITERAL_BAN` refuses a LITERAL at six call sites and passes a `tr(...)` call untouched, because that is a `CallExpression` and not a `Literal` at the position it checks; `localeModuleSentenceCase` checks CASE, not meaning. A correctly-spelled key carrying the wrong words is exactly the gap between those two instruments. **Pre-existing — slice A inherited it and slice B did not cause it** — but slice B is what puts it in front of a user for the first time, the same sentence this package owes for L-26 and L-27. | **Possibly a REUSE rather than an owner mint** (R-S12-14): `editor.area.update-corner` already exists in **both locales** as "Apply corner change" / "Eckpunkt ändern", so L-15 need not be engaged — reuse of an existing both-locale key is what slices A and A2 did three times. **But `OutlinePointsForm` is SHARED with `elementEditPresentation.ts`** (R-S11-1), so changing its submit label changes the ELEMENT caller too — the exact trap session 11 met on this same component. Not free, and not taken this session. |
| L-31 | **PARTLY CLOSED 2026-09-21: Action 1 is DONE, the screenshot clause is NOT, and this paragraph supersedes the one below.** **Action 1 shipped at `3c0e01d21`, docs only** — `docs/superpowers/specs/2026-09-21-bp04-numeric-corner-editing-spec.md`, 312 lines, six sections one per Action, written AFTER slices A, A2 and B landed so that every clause carries a file and a line rather than an intention. It reconciles the coordinate system against ADR-0009, which decides the UNIT and **not** the origin or the axis directions — those live only in `editor.area.coordinates-hint`, and the document says which half is where. **Its home was chosen with an argument rather than a preference (R-S13-45):** `docs/user-experience/renovation-planner-editor-specs/` is a locked, mockup-sourced M00-M17 screen set whose stated source this document has none of, while `docs/superpowers/specs/` is forty dated per-increment interaction documents already using `## Records` and `## Amendment N` as their correction convention — and is where the document that had to be cross-linked already lives. **`## Amendment 1` is APPENDED to the 2026-09-12 side-panels design**, original text untouched (R-S7-12), and **both documents now point at each other**. Its narrowing is sharper than this tracker's earlier account in two directions (R-S13-44): that spec's §3 **names the row by its LABEL and never by `data-rp-action="edit-outline"`** — a grep for the attribute in it returns nothing — so the attribute reaches it only through §3's blanket "hooks unchanged" invariant, which is why that section's own invariant still holds; and **the gap is THIRTEEN HOURS, not "later"** — the spec at `35db38400`, 00:20, and PR #149's `d77dff4bd` at 13:51 **the same calendar day**. A specification and its removal on one date is a different story from drift over weeks, and nothing here should imply the latter. **The Deliverable's real-screenshot clause is UNCHANGED and unsatisfied**, on the same three grounds the original row gives: `harness-shots/` is gitignored so **no screenshot travels**; a harness capture is a browser render and **nothing on this branch has ever been run in a vault**; and the context-menu door still has no capture at all. **It remains owner-acceptance territory needing a vault run, exactly as L-19 and L-21 are**, and it is not a defect in the shipped code. **The original text follows.** **Limitation.** BP-04's Action 1 has no artifact, and its Deliverable's real-screenshot clause cannot be satisfied from here | Found by the independent acceptance audit of BP-04, 2026-09-20; Action 1 closed 2026-09-21 | 2026-09-20, Action 1 closed 2026-09-21 | **Action 1** asks for *"a short interaction specification that reconciles the existing design decisions"*. **No such document exists in `docs/`** — what exists is docblocks, the GITIGNORED `.superpowers/` discovery and review reports, the user guide passages rewritten at `73af5eb95`, and the new manual case. **The Deliverable** asks for *"real screenshots of its key states when a runtime is available"*. Three grounds on which that is unsatisfied: `harness-shots/` is **gitignored, so no screenshot travels**; a harness capture is a browser render and **nothing on this branch has ever been run in a vault**; and the context-menu door has **no capture at all**, because no knob opens the canvas context menu and building one was held out of slice B's scope. | Action 1 is a writing task that can be done here and was held out of slice B deliberately to keep the reach one slice. **The screenshot clause is owner-acceptance territory like L-19 and L-21** — it needs a vault run, which is the same blocker G1 carries. Neither is a defect in the shipped code. |
| L-32 | **Limitation.** No capture in this repository has ever shown a dialog's actions row | Found 2026-09-21 by the L-30 implementer; **confirmed by the controller's own eyes** | 2026-09-21 | The three `plan-editor-outline*` captures photograph BP-04's numeric corner dialog but **not its submit button** — the corner list overflows and the actions row is below the fold at both 1280 and 460 — so **no picture in this repository has ever shown that button's copy, its width or its state**. Found by md5-verifying that a label change left all three PNGs byte-identical (R-S13-33), then **confirmed by the controller opening `plan-editor-outline-narrow.png` directly** (R-S13-60): it is cut off **mid-Corner-3** — hint, five-row chooser list, fieldsets for corners 1 and 2 and a clipped 3, with corners 4 and 5 and the whole Save/Cancel row below the fold. **Not a defect in the captures:** `.rp-dialog` carries `max-height: 100%; overflow-y: auto` and is behaving as designed, the same mechanism L-26 records. | The consequence is narrow and specific: **a copy or layout change to any dialog's actions row is outside every instrument this repository has.** `I18N_LITERAL_BAN` passes a `tr(...)` call, `localeModuleSentenceCase` checks case rather than meaning, jsdom measures no layout, and the capture that would show it stops above the fold. The remedy is a capture whose wait selector is the submit button itself, or one that scrolls the dialog before shooting; neither is free, because the shot table's rows are pinned in both directions by `tests/build/harness-shot.test.ts`. The one-off substitute used for L-30 was a real browser run at 460x900 under `npm run harness`, which answers a question but leaves no artifact. |
| L-33 | **CLOSED 2026-09-21 (`b512f2db6`), and the fix was NOT the shape this row proposed.** The row called for "a code-to-copy mapping or a genuinely generic sentence". The mapping was **costed and refused on measurement**: it buys nothing user-visible, because the coordinate-parse cause already renders a precise per-field message at the same moment, the two shape causes deliberately have no locale entry (R-S13-1) so a mapping resolves them to `error.category.geometry` anyway, and a fourth cause on the shared element mount — `validSpatialElement` — returns a bare boolean with **no error code to map at all**. What shipped is a one-line key swap to `error.category.geometry`, which is both-locale, mentions neither dimensions nor rooms, and is **the same sentence this refusal already produces as a toast** via `toUserMessage`. **No German was minted; L-15 holds.** | Closed by session 14 | 2026-09-21, closed 2026-09-21 | **The measurement fired a STOP that changed the fix and prevented a regression.** `editor.resize.invalid` has **three** render sites, not one: `OutlinePointsForm.vue:150` (wrong) plus `RoomDimensionsForm.vue:126` and `roomDimensionDraft.ts:26`, where "dimensions" and "room" are **correct** because that dialog takes a width and a depth on a room. Editing the STRING would have fixed one surface and silently broken two. The capture `harness-shots/plan-editor-outline-narrow.png` shows the dialog titled **"Edit Terrace"**, which demonstrates the "room" defect rather than arguing it. A second defect found in the same measurement was fixed with it: `OutlinePointsForm.vue:127` held a `LengthRefusal` and threw it away, so a too-large coordinate read as an unparseable one — now discriminated, copying `AreaCornerEditor.vue`. Independently reviewed: spec PASS, quality PASS. | **A residue is recorded rather than closed.** The swap is a deliberate **departure** from a written convention, not a clean win: `error.category.*` is a declared FALLBACK tier, and `en.ts` records falling into a category sentence **as a defect worth minting a key to avoid**. The honest answer is a minted both-locale sentence naming the cause, which **L-15 blocks** — an owner copy question, surfaced rather than absorbed, and the swap does not foreclose it. Revisit when an owner rules on minting. |
| L-34 | **Limitation, NEW 2026-09-21, NARROWED and then CLOSED AS NARROWED 2026-09-21 (session 15).** Shipped strings told the user to open the diagnostics report and gave them no way to do it | Measured by session 14; narrowed and closed by session 15 (`cf6b39fac`, `c4c60f11c`) | 2026-09-21 | The tracker framed this as four surfaces. Session 15 traced each and **two of the four are not surfaces at all**: `zone.listing-incomplete` and `asset.listing-incomplete` are raised by `ListReassignmentTargets` and end at `new Notice(string, 0)` — a toast whose whole payload is a resolved string, with no slot and no actions array. Those two moved to **L-37**. The remaining two are closed: `view.project.some-plans-unreadable` (both renderers) and `view.asset-library.some-unreadable` now draw a **Show diagnostics report** button, on two required `openDiagnosticsReport` deps members injected by the composition root exactly as `planEditorDeps` does. No new locale string; `command.show-diagnostics-report` already existed in both locales. The button is gated on the SOME arm, never on the notice existing, because `all-plans-unreadable` names no report. | Closed as narrowed, not in full, and the narrowing is recorded rather than quiet. **`ProjectWorkState.vue`s button is reachable by no harness knob**, verified four ways, so it is drawn by nothing that re-runs — see **L-40**. The counted doors pin was found to count SEAMS rather than controls; its prose counts were deleted rather than corrected, per R-S14-34. |
| L-35 | **Limitation, NEW 2026-09-21, CLOSED 2026-09-21 (session 15) at `780e562dc`.** The `?unreadable=N` capture drew every zone while the strip said two were not drawn | Found by the controller in a browser; refused by session 14 on a costing, closed by session 15 on a measurement | 2026-09-21 | **Session 14 refused the prune on four named couplings, and two of them do not exist.** Walls carry no zone reference; the only zone reference in `Structure` is one `boundaries` entry. Decisively, the real `findZonesByPlan` reads `structure` from the **per-plan geometry sidecar**, independent of which zone notes loaded — so keeping the structure whole under a prune is exactly what a real vault does, and pruning it would have been a new infidelity. `STALE_TRIGGER_ZONE_ID` is a bare literal whose throwing resolution reads the module constant, so a prune of the answer cannot reach it. The fake now drops `harness-bath` and `harness-terrace` (the only zones named by no wall, opening or boundary), keeps the structure, and **throws above its maximum of two** rather than clamping. Verified by eye in the re-taken capture: two polygons, `Rooms 1 · Areas 1 · Total area 45.6 m²`, so 2 drawn + 2 refused = the fixture`s 4. | **The durable lesson is about the refusal, not the fix: a costing is a hypothesis too.** Session 14`s estimate was honest, was priced by reading, and was wrong by enough to reverse the decision — so a refusal that goes unchallenged looks exactly like a settled one. Honest residual loss, stated and not written back as a replacement caveat: the two captures lose the fixture`s only non-rectangular polygon and its only `Complete` chip, both covered by other captures. |
| L-36 | **Limitation, NEW 2026-09-21 — an OWNER copy question, deliberately not decided.** English describes the two axis labels of one form in two different registers | Measured by session 14; left alone on a ruling | 2026-09-21 | `en/structure.ts` reads `Starting horizontal coordinate (m)` for x and (now) `Start Y (m)` for y, while German writes a symmetric pair. **Git cannot settle why**: `git log -L` returns one entry, both lines born in `866ccc38e` with those values, and `Start x (m)` has never existed in any English locale file. **But the gate can.** Writing `Start x (m)` at clean HEAD with the acronym widening OFF **reports** (a lowercase `x` is a finding, because `brands.js` carries `X` and the rule demands the brand casing) while `Start y (m)` does not — and the rule was already live when `866ccc38e` was authored. So that author faced exactly "finding on x, none on y", and shipped a long phrase on x and an untouched y. That is the signature of copy bent around the rule, which `eslint.config.mjs`s own docblock forbids. | **Left alone deliberately, and the session did not make it worse** — `en.y` and `de.y` agreed before and agree now. Both remedies are copy judgements no measurement decides: restoring `Start X (m)` trades a more descriptive label for a terser one, and the better symmetry (a long-form y) needs real translated German, which **L-15 blocks**. Revisit when an owner rules on minting, alongside L-33s residue. |
| L-37 | **Limitation, NEW 2026-09-21 (session 15), split out of L-34.** Two shipped strings tell the user to open the diagnostics report and surface as a toast, which cannot carry an action | Measured by session 15 during the L-34 recon; scoped out on a ruling (R-S15-6) | 2026-09-21 | `zone.listing-incomplete` and `asset.listing-incomplete` are raised by `ListReassignmentTargets` and reach the user by two independent paths that meet at one function: `notifyOperationFailure` → `notifyError` → `queue.push(level, string)` → `new Notice(textOf(view), 0)`. **Four independent reasons a button there is a new mechanism rather than a patch**, each sufficient alone: the payload is a resolved string with no slot; `NOTICE_TEXT_BAN` governs exactly those four doors and keys on `callee.name`, which is why they are bare functions; the queue folds identical messages into a `(×N)` suffix and calls `update`, so two foldable notices carrying two different actions is an unanswered question; and the vendored harness CSS declares **no `.notice` rule at all**, so a control there would ship unphotographed by every instrument this repository has. | Does not block a first beta — it is the status quo on two surfaces, and both refusals are recoverable by asking again. **The real item is the mechanism**: whether an Obsidian `Notice` in this plugin should be able to carry an action at all. `Notice` accepts a `DocumentFragment`, which is a lead and nothing more; `minAppVersion` compatibility and the fold-and-`update` behaviour are both unanswered and neither is checkable outside a live vault. **Not reachable from here.** Session 15 also could not establish that either code is reachable in a real vault at all: nothing in the suite drives a refused listing at the moment a delete-with-references resolution is answered. |
| L-38 | **CLOSED 2026-09-21 (session 16), `13cd46975`.** The Floor Inspector glued two bare numbers together with one space | Measured LIVE by the controller in a browser before any brief, in both locales; fix reviewed independently; captures taken and looked at | 2026-09-21 | `textFor` now brackets the annotation, joining the formatted value and the `editor.inspector.partial` result with a parenthesis pair instead of a bare space. **Punctuation in code — no word minted in either locale, so L-15 was never engaged**, which is what made this one movable. **The row this table carried was right for the wrong reason on one point, and a STOP fired on it before any work began**: it said `Total area` and `Estimated cost` "carry a unit or a word", but `spatialRecords.ts` hard-wires `estimatedCost` to the `unavailable` state, typed `Aggregate<never>`, so that row can **never** reach the partial branch at all — a `tsc --strict` probe rejects its `partial` AND `available` arms. **Four rows can exhibit the state, not five.** `ReviewSummary.vue` renders the same string standalone in its own paragraph and was ruled NOT a second instance but the correct precedent. The case that should have caught the defect asserted `toContain('2')`, which the annotation's own leading digit satisfies either way; it now pins the exact rendered string on a bare-count row and on the unit-carrying one, and was **watched failing on the old glue first** | **Closed with a measured residue that is recorded rather than waved away.** At the full-layout width the value column is 137px and the shipped text is 130.86px, so the `--partial` `::after` marker (a space plus an asterisk, 8.98px) no longer fits and sits **alone on a second line** on three rows — the text itself does not wrap, which a `Range` walk establishes and the height alone does not. **Full-layout only**: at a 460px pane the Details overlay is closed. Seen in `harness-shots/plan-editor-unreadable.png` and judged acceptable — a footnote marker hanging under a right-aligned figure, plainly better than two digits reading as one. **A one-character remedy exists and is deliberately NOT taken**: dropping the marker's leading space fits it (37.7px to 18.8px, measured) but wins by **0.72px**, which is inside the noise for a font the harness resolved to FALLBACKS. **Nothing here has been run in an Obsidian vault**, so whether the marker orphans in a real one is unknown in both directions. `white-space: nowrap` also fits and is the wrong lever — `Total area` legitimately wraps |
| L-39 | **CLOSED 2026-09-21 (session 16), `9db5fc7f8`.** `npx eslint .` exited 1 in a worktree carrying gitignored session scratch | Premise re-measured by the controller before briefing; fix measured by the implementer over the whole linted SET rather than by sampling | 2026-09-21 | One entry, `.superpowers/**`, in the same global `ignores` block `.worktrees/**` sits in, with a comment stating only the mechanism. **`eslint . --max-warnings 0` went from exit 1 (24 problems, all four files under `.superpowers/sdd/01-improvement-plan/`) to exit 0.** Scope proved by the SET and not by three sample paths: `eslint . -f json` emits an entry per linted file including clean ones, and the count went **2290 to 2286** — exactly those four removed, zero added, with `.ts`/`.vue`/`src/`/`tests/` tallies identical across both runs. **`.oxlintrc.json` is byte-unchanged and that was measured in both directions**: `npx oxlint .superpowers` answers `No files found to lint` although `.superpowers` is absent from its `ignorePatterns`, because oxlint DOES read `.gitignore` and flat config does not — the identical asymmetry this block already records for `.worktrees/**` | **Not a weakening**: the directory is gitignored, committed by nothing, imported by nothing and shipped by nothing, and `.claude/**` already sits in the same list for the same reason. **A trap was avoided deliberately**: `.superpowers/` was NOT added to `lint-scope.test.ts`'s `leaves the vendored and generated trees alone` case, because that case is about `ignorePatterns` holding and this exclusion is `.gitignore` — the assertion would have passed for a reason different from the one written above it. **One latent exposure found and deliberately not fixed**: ESLint reads no `.gitignore` at all, and `harness-shots/` is gitignored and absent from `ignores`, clean today only because it holds PNGs and a contact sheet no block's `files` matches. Feeding all 2286 post-fix paths to `git check-ignore --stdin` returns **zero** gitignored files in ESLint's set. Trigger: anything emitting a `.ts` or `.vue` into `harness-shots/` |
| L-40 | **CLOSED 2026-09-23 (session 17), `f0c1af9e3` with `9533c4e2b` and `8ab18c0bb`.** The schedule section's diagnostics button was reachable by no harness knob | Found by session 15's implementer; closed by a harness fixture, reviewed independently (Spec ✅, Quality Approved); CI run `35797680970` green on all five jobs | 2026-09-23 | `?project=…&plans=…&plans-unreadable=…&section=schedule` now draws `ProjectWorkState.vue` over the REAL `projectWorkServices` on a real composition root (`tests/harness/scheduleKnob.ts`), with the unreadable count produced by a real refused read (damaged plan notes), not a wrapped number. Two shots, `project-schedule-unreadable` and its 460-wide `-narrow` twin, pinned in `tests/build/harness-shot.test.ts`, with a selector scoped to `.rp-project-work` so it cannot pass on the detail state's own button. Six reds watched. **Captured and looked at**: at both widths the button is content-width, and nothing clips, overlaps or orphans, so the full-pane-width defect class that motivated this row is not present on this surface | **Captured twice**: first approximately, with the cached 1223 build through `RP_CHROMIUM_EXECUTABLE`, after the pinned 1234 had left the shared cache; then with the pinned 1234, restored with the user's permission, with no override set. The two renders of each shot match, and their file sizes differ by one byte. **Observed and not filed as a defect**: the unreadable-plans sentence is a tinted warning band on the detail state and plain body text on the schedule, where the button reads as part of the `Floor` toolbar. `UnreadablePlansNotice.vue` records the bare shape as the caller's deliberate choice, so it is a trade for BP-07 to weigh. The harness's detail and schedule states read two worlds from one seed, so a write in one does not show in the other, and `quotes` is still undrawable here |
| L-41 | **CLOSED 2026-09-22 (session 16), `ee7d4b3ff` with `0f5e0e4f6`.** Two shipped strings were glued into one run-on sentence at two sites, one of them a screen-reader live region | Found by the controller's unasked check and independently by the implementer's census; verified LIVE; reviewed independently; a review finding then REFUTED by probe | 2026-09-22 | Both copies moved into one pure function, `editor/selection/selectionGuidance.ts`, joining the two keys with `. `. **Punctuation in code — neither locale string touched, so L-15 was never engaged.** `CanvasContextMenu`'s `title` computed existed only to feed its copy and is gone with it. **The census changed the scope before any work began**: the job was SEVEN sites, not two, because five existing assertions rebuilt the glued expression to compare against it — the same shape as the `toContain('2')` that failed to catch L-38, so none of them could fail on the glue. One is now written out in full and four state the separator as a literal; the independent reviewer read each expected value and confirmed none can pass if the separator is reverted. **Two new assertions cover what nothing covered**, including the live region's single-selection text, which no test had ever read. CI run `35730335714` green on all five jobs | **A review finding was REFUTED rather than fixed, and it exposed a FALSE RATIONALE.** The module said ids are a parameter because a watcher may hold a value the store has moved past; a probe of exactly that scenario — two writes in one flush — shows Vue 3.5.41 coalescing them into ONE firing with `ids` reference-identical to the store's value. **Reproduced independently by the controller.** So passing either is behaviour-identical, no test can discriminate them, and the docblock now records the refutation and says outright that nothing re-runs it. The code was correct either way; the REASON given for it was wrong. **Generation SIX of the wider-than-its-check overclaim landed in this work** — an only-claim, a caller list and a count, in the TEST docblock, one file from where the brief had forbidden exactly that shape; all three deleted rather than corrected. **The category is now measured closed at four** by an AST census over every `src/` file, tested against the pre-fix tree first — see L-42 |
| L-42 | **CLOSED 2026-09-23 (session 17), `53c148de4`.** A paste notice glued a bare count to the sentence after it | Found by the L-41 implementer's unasked check; verified at source in both locales; watched red with the rendered string captured; reviewed independently; CI run `35790576648` green on all five jobs | 2026-09-23 | `pastedNotice()` now puts the `·`-joined tally LAST: `Pasted into {floor}. Work, materials, costs and evidence stay with the original. Use undo to reverse this paste. Rooms: 1 · Walls: 4`. **A period after the tally was considered and refused**: in German a digit, a period and a capitalised noun is ordinal notation (`Wände: 4. Arbeit`), and this text reaches a live region; whether a German voice announces it as an ordinal is NOT measurable here, so the remedy is the one that needs no punctuation after a count in either locale. No locale string touched, no word minted, no branch added. **This row's own earlier claim that nothing in `tests/` asserted the notice was FALSE**: `i12-clipboard-feedback.test.ts` asserted it with four `toContain` fragments, every one passing on the glued string, which is L-41's hollow shape again; the AST census had read `src/` only. They are now one exact `toBe`, and a second `toBe` covers a single-row tally (`Objects: 1`); both were watched red, received `… Walls: 4 Work, materials …` and `… Objects: 1 Work, materials …`. **The empty-summary edge got no guard**: `captureClipboard` returns `null` unless something counted contributes a point, and `copy()` is the one `src/` writer of the shared clipboard, so every paste has at least one row | **Residue, accepted and recorded rather than fixed.** When an identical paste repeats while its notice is still up, the queue folds it and `notify.ts`'s `textOf` appends ` (×N)`, which now lands straight after the last count: `… Walls: 4 (×2)`, in the toast and the live region. Measured by the reviewer's probe; `Notice.shown` records constructor messages only, so neither new assertion can see it. Accepted because two of its three readings are true of what happened, and changing `textOf` changes the repeat rendering of every notice in the plugin, which is a notice-mechanism change rather than an L-42 patch. The commit message's claim that nothing follows a count was DELETED before push for the same reason. German is asserted by nothing; the order lives in code and is language-independent. No capture can exist: the vendored harness CSS has no `.notice` rule |
| L-43 | **CLOSED 2026-09-23 (session 17), owner-decided; `20ff37f29`, with `45b797d18` and `511373e90` for the PBI and `19197b9ed` for the manual case's wording; `a420b677a` (session 18) for a style check its first full CI run failed.** On mobile the Asset Library could create, edit and delete assets, while the beta scope and `PRODUCT.md` read "mobile read-only" | The release owner, 2026-09-23: "guard the asset library on mobile." Found by the session 17 BP-09 review lane; the fix reviewed independently (Spec ✅, Quality Approved). Nothing has been run on a device | 2026-09-23 | **Before, a source reading:** `AssetLibraryRoot.vue`'s `.rp-al-create` had no `disabled` binding, `git grep -n "Platform.isMobile"` found no hit under `src/presentation/library/`, and `assetLibraryViewDeps()` passed no mobile or read-only member, while `AssetLibraryCommandServices` carried its write commands with no device gate on any of them. **After, at `20ff37f29`:** `AssetLibraryView` decides `readOnly: Platform.isMobile` once, at its `provide()`, as `RenovationProjectView` does. On mobile the library draws the `view.mobile.read-only` notice; `New asset` (toolbar and empty catalogue), `Open designer`, `Delete`, the definition fields and `Save` stay drawn, refused and described by that notice, and their handlers refuse too. Search, selection and the shelves stay live. `tests/presentation/library/assetLibraryMobile.test.ts` mounts the real view, spies on every door of every member of the command services, enumerated by key, and asserts no call on mobile; a desktop run of the same gestures reaches the commands, so the mobile case cannot pass by reaching nothing. The pinned-Chromium capture `harness-shots/asset-library-phone.png` exists: a browser render, not a device. `open-asset-library` is still a plain `callback` and the project view's Library door is still enabled on mobile; both open the guarded view. The PBI `docs/requirements/Bound the mobile surface to what it can actually do.md` records the item done and not measured on a device; `docs/tests/cases/Read projects on mobile.md` does not check the library | **Residue, recorded and not fixed.** No device run: the guard holds in code and in jsdom and is NOT verified on a device, so a published mobile claim still waits on BP-09's device run. Review Minors: the read-only text fields have no visual refused state; `Discard` stays live on mobile but can never act there; the mobile notice fails colour contrast in the light theme at 2.73:1 (axe in Chromium), a style the project view already ships, so this change did not introduce it. Revisit at BP-09's device run, or when a Minor is taken up. |
| L-44 | **OPEN 2026-09-23 (session 18).** The BP-08 mixed-scene browser driver does not complete at the current tree | Found by session 18's BP-08 measurement with the pinned Chromium 1234; the STOP in its brief fired twice, correctly | 2026-09-23 | `node scripts/editor-recovery-check.mjs` exits 1 in scenario `light` inside the planning journey: `[data-rp-room-navigation]` is never drawn after `activate('[data-rp-mode="existing"]')`, and the capture shows the Plan perspective offering a `Renovate: Room 1` action. The recovery, accessibility and reflow journeys after it were never reached. `--performance-only` (`da7b9829f`) skips those four journeys and exits 1 inside `largeFloor()` itself: `Tab did not reach [data-rp-perspective][tabindex="0"]` after the first pan, with focus on the `Room 76` row of an 80-row list in which every row is a tab stop, and `tabTo` gives up at 150 presses. No `report.json` was written, so no timing exists for this tree. The 3-cycle cleanup check counts less than its names say: `objectUrls` cannot be non-zero with this fixture, `images` counts attached thumbnails only, and `listeners` counts vault listeners only | Blocks BP-08's harness measurement, not a user. Revisit: a scoped repair of `largeFloor()`'s path, which first establishes whether 80 row tab stops are intended, a keyboard design question for BP-07 that is recorded here and not decided. |
| L-45 | **OPEN 2026-09-23 (session 18).** `ReferenceMeasure` hands its parent a Number through a model declared as a String | Seen as 37 `[Vue warn]` lines in the BP-08 driver's harness log; the mechanism confirmed at source by session 18's final review | 2026-09-23 | `ReferenceMeasure.vue` declares `defineModel<string>('ax', …)` and binds it to `<input type="number" v-model>`, and Vue's `vModelText` casts a number input's value to a Number. `ReferenceSetupForm`'s `String(…)` and `Number(…)` coercions make it harmless in behaviour today. The suite prints no such warning; only the browser driver shows it. It predates session 18 | No user-visible failure is known. Revisit with BP-06's reference work: widen the model's type or stop the cast. |

## Native / hardware availability

| Environment | Named OS / device / Obsidian version | Available runner | Planned cases | Actual evidence |
|---|---|---|---|---|
| Desktop primary | Not yet selected | Unassigned | Full core journey | Unperformed |
| Minimum supported Obsidian | Read current manifest; verify native availability | Unassigned | Compatibility and core smoke | Unperformed |
| Additional desktop platforms claimed | Not yet selected | Unassigned | Core smoke and OS shortcuts | Unperformed |
| Screen reader | Name product/version and OS | Unassigned | Keyboard, validation, warning/focus | Unperformed |
| iOS | Actual device/Obsidian version | Unassigned | Mobile read-only and restored tabs; the Asset Library's L-43 guard is tested in jsdom only, and the mobile case does not yet check it | Unperformed |
| Android | Actual device/Obsidian version | Unassigned | Mobile read-only and restored tabs; the Asset Library's L-43 guard is tested in jsdom only, and the mobile case does not yet check it | Unperformed |
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

### Session 5 — 2026-09-17 — BP-02 slice 4's remaining two parts

**Pre-flight.** `origin/main` had **not** moved: `git rev-parse origin/main` and
`git merge-base HEAD origin/main` both printed `ed5c50b76`, so main is an ancestor of HEAD and
nothing was merged. Tree clean. Disk checked **before** dispatching rather than after a failure,
because session 4 lost a diagnosis to it: `C:` at 8.5 GB free, `D:` at 393 GB, `D:/tmp-rp` present.
The three symbols the first brief rests on were spot-checked against the code rather than inherited
from a reconnaissance report.

**Method.** Subagent-driven, strictly sequential — one implementer at a time in a shared worktree.
Six agent seats: two implementers, two independent reviewers, two final rounds, plus two scoped
re-reviews. No review finding was fixed by the controller. One reviewer seat died at its first tool
call on a session rate limit; the tree was checked clean and no partial report found before a clean
re-dispatch, because an agent that dies LATE is a dirty worktree nobody attributed.

**Part A — the write gate now reads the vault's own record** (`36a4c92f7..4966cbe7b`, eight commits
across the change, a fix round and a final round). The shared `rp-save-state` store, which the Asset
Designer imports from the Plan Editor's `save-state/`, seeds from
`activeWriteIncidentRegistry()?.anyOpen()`; `withSaveStateTracking` also marks on the gate's own
refusal code so an already-open pane catches up at its first refused write. **The review overturned
the controller's own ruling from session 4**: the Asset Designer's `writesBlocked` is read by
nothing, so the designer is wired and ungated — L-13. A second review finding became a design change:
one ref had been made to answer two questions, so `DraftRecovery.vue`'s READ retry vanished under a
vault-wide pause, against ADR-0034's commands-only decision. The store now carries the leaf's own
unrecovered write, the vault's pause, and the gate as their computed OR, which also makes ruling R1
("set, never unset") structural rather than a rule to remember.

**Part B — L-06's pinned leaf-handoff census** (`e7c24d91b..9d08aeed4`, six commits across the change,
a fix round and a final round). `tests/plugin/guardCategory.test.ts` gained the second question its
own header had named as missing, and ADR-0034 gained four corrections — including one where **the
document contradicted itself**, listing `undoDeleteResolution.rollBack` as covered while it is an
uncovered site. The reconnaissance predicted a five-entry set; the first measurement found 27; the
review showed 21 of those were the composition root's own collaborators, which would have reddened on
~21 past commits for a property none of them touched. The honest instrument pins **10**, and closing
the zero-argument-factory hole surfaced a bypass SURFACE nobody had named
(`editorDeps.commands.structure.roomHistory()`).

**Commands and outcomes, every exit code captured into a variable or a file BEFORE any pipe.**
`npm run test:coverage` at `9d08aeed4` → **exit 0**, 1035 files / 11165 passed / 1 skipped,
1410.87 s, all four floors met (statements 99.21%, branches 98.08%, functions 99.27%, lines 99.65%
against 99/99/99/98); uncovered arms fell in three metrics and held in the fourth. `npx eslint .` → 0.
`npx vue-tsc -noEmit` → 0. `npx oxlint --deny-warnings` → 0. `npm run analyze` **deliberately not run**
(L-04). The full `npm run check` deliberately not run (contends). The line budget on
`guardCategory.test.ts` moved 361 → 409 → **393** of 450, measured by ESLint itself; no suppression and
no trimmed assertion at any point.

**Two controller errors, recorded because they are the session's own defects.** First: session 4's
ruling that the designer's tool framework "already consults" the gate rested on a reconnaissance claim
nobody re-measured, and it survived a brief, an implementation and a report before an outside reviewer
ran one grep — the fix's own describe had even deleted a measured sentence saying the opposite and
written the hope over it. Second: two briefs told agents to measure the line budget with
`npx eslint <file> --rule max-lines:1`, which exits **0 with no output** because severity 1 means
*warning* — a controller handing down an instrument that always succeeds, which is the same defect as
a test that passes for the wrong reason.

**What is implemented but unverified.** All of it. **Nothing on this branch has ever been run in a
real Obsidian vault.** Specifically unverified: that Obsidian's split duplicates a leaf with view
state intact; that a restored layout returns two same-plan leaves; the real startup ordering behind
L-14; `WriteIncidentFileStore` against Obsidian's own adapter; themed dimming; any screen-reader
announcement. The new manual case's Runs table records that it has **not** been run. A 515-file vitest
run stalled for 21 minutes mid-session with 25 files each showing one ~5000 ms timeout; it was killed
and is named rather than attributed, and the final whole-suite coverage run was clean at 1035/1035.

**Native checks still not performed.** Every row of the native availability table above remains
Unperformed.

**The recurring defect of this session, and it is the same one under a new costume.** Five separate
sentences claimed more than they checked, **one of them written by the round whose stated purpose was
to stop them**. What worked was never a list: the final round was told that a reviewer's list is a
reading and not a census, and its own sweep found the falsehood in three homes where the reviewer had
named one, plus a fourth sentence that named two items in a clause beginning "three of the five". The
same lesson met from the assertion side: a negative assertion, and a case whose setup was never itself
asserted, each passed with the mechanism under them fully removed. **Ask what stays green when the fix
is undone — and when a sentence claims a set, count the set rather than reading the sentence.**

**Next executable action.** Decide L-13 — gate the Asset Designer for real, or accept it explicitly as
a release owner. It is the single thing standing between the current state and gate G1, and it is a
decision rather than a discovery: the field is already wired and correct-valued, and what is missing is
a tool framework consulting it on a surface nothing has ever run in a vault. L-12 remains a one-word
intent call for an owner.

### Session 6 — 2026-09-18 — L-13 measured, and what the measurement found instead

**Opened** at `35ab0c12d`, tree clean apart from the untracked session-6 prompt. `origin/main` at
`ed5c50b76` and `git merge-base HEAD origin/main` the same SHA, so main is an ancestor and there was
nothing to merge; no overlap measurement was needed. Closed at `e118f61d4`, **nothing pushed**.

**This session wrote no production code at all.** `git diff --stat 35ab0c12d..e118f61d4 -- src/` is
empty, and it was re-checked after every round.

#### What was measured, and why the session did not build what it was dispatched to consider

L-13 said the Asset Designer was "not gated by an open write incident at all", and that row was the
only thing the previous session put between the current state and G1. The controller read the
composition before dispatching anything and found the row's evidence — one grep showing that
`writesBlocked()` is read only under `src/presentation/editor/` — **true but about the affordance**,
while the data-safety question it was being used to answer had never been driven.

Four measurements, taken by the controller from the code and then re-verified by an implementer and
two independent reviewers:

| # | Measurement | How |
|---|---|---|
| M1 | The designer has exactly ONE write door | `runtime.ts:368`, `context.commands.designEdits({ noteLedger, geometryLedger })` — the only non-prose write path in `src/presentation/designer/` |
| M2 | Its FORWARD half is guarded | `guardAssetDesign` composes all nine commands through `guardBothDoors`, which wraps BOTH `execute` and `executeWithVersion` in `guardCommand`; the vault gate refuses BEFORE the wrapped command is awaited |
| M3 | Its UNDO half is NOT | the inverses write through the raw ports in `ReversibleAssetDesignDeps` — `sidecar.write`, `assets.save` and the background adapter's pair — and `guardCommand` wraps a `Command`, never a port |
| M4 | None of that was checked, and the harnesses were kinder than production | `designerRig.ts` and `assetDesignHarness.ts` both build the bundle from RAW `new SetAsset…Command(...)` instances; `grep -rn "guardAssetDesign" tests/` returned **zero** hits, so no designer test could observe the gate at all |

M4 is the finding that shaped the session. `designerIncidentGate.test.ts`'s header already asserted,
in prose, that *"Every write it dispatches is refused by the guarded doors underneath"* — a sentence
with nothing under it, in a file whose other half is carefully checked. **Ruling R-S6-1: the
session's subject is the instrument, not a gate.** No production gate unless the instrument
contradicted M2. *Cost if wrong:* a forward designer edit landing under an open incident would have
been a live data-safety hole, and the session would have had to gate it at the command seam.

#### What was built

`tests/presentation/designer/designerIncidentRefusal.test.ts` — seven cases, built over the REAL
`guardAssetDesign` rather than either shared harness's raw bundle, with the deps spelled as
`composition-root.ts` and `assetDesignerDeps.ts` spell them:

- a success control and a refusal case for the NOTE door (`setHeight`) and the GEOMETRY door
  (`setAnchor`), each refusal asserting `WRITES_PAUSED_CODE` **and that the port was not written** —
  the geometry one checking the entity VERSION too, since a rewrite with identical bytes would move
  it and the value assertion alone could not see that;
- a CATEGORY case iterating every command member of the guarded bundle, both doors each, members
  discovered by SHAPE rather than by a typed list, the excluded `get` query asserted BY NAME, and a
  found-something-at-all floor;
- two cases recording the UNDO gap, written to what the instrument printed rather than to what would
  be desirable.

**Ruling R-S6-2**, after a review found the file handing its whole-bundle claim to
`tests/plugin/guardCategory.test.ts`: close the CATEGORY rather than narrow the sentence. That file
names `WRITES_PAUSED_CODE` **zero** times — its `MAPPED_REFUSAL` is `vault.unexpected-failure`, it
checks the error boundary and not the gate, and it stays 13/13 green with the gate removed. One loop
over the bundle is both cheaper than seven more hand-written cases and wider than them.
*Cost if wrong:* the loop's inputs are only valid to a gate that refuses first, so the fix round was
required to watch it red and report the code each door answered. It did.

#### Commands run, with exit codes captured before any pipe

| Command | Revision | Exit | Outcome |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerIncidentRefusal.test.ts` | `0248de6cf` | **0** | 1 file / 6 passed |
| the same, with `guardCommand`'s incident block disabled | `0248de6cf` | **1** | 2 failed / 6 passed — both refusal cases red; `designerIncidentGate.test.ts` run beside it stayed FULLY GREEN |
| the same file | `1732092ff` | **0** | 1 file / 7 passed |
| the same, gate disabled | `1732092ff` | **1** | **3 failed** / 4 passed — the category loop now red too |
| the same file | `4a9c14d68` | **0** | 1 file / 7 passed |
| `npm run check:fast -- tests/presentation/designer` | `4a9c14d68` | **0** | 47 files / 560 tests (implementer and both reviewers) |
| `npm run check` | — | **not run** | contends with parallel work; CI is where it belongs |
| `npm run analyze` | — | **not run** | L-04 — it fails on `origin/main` itself |

**The controller ran both reverts itself** rather than reading them out of a report, each applied by
a script that asserted its anchor was present AND unique before writing, with `git diff --numstat`
checked after and `git checkout --` and a clean `git diff --stat -- src/` proving the restore.

#### The contrast datum, which is the session's most useful single fact

Under the same revert that turns all three refusal cases red, **`designerIncidentGate.test.ts` stays
fully green.** It reads `writesBlocked()` off the registry directly and never enters `guardCommand`.
That is precisely the "one seam away from the code that decides" shape session 4 paid four review
rounds to learn to hunt — and it was sitting in the same directory as its own counter-example, in a
file whose prose claimed the property the green run cannot see.

#### Reviews

Two independent seats, each told to answer its seat's question by experiment and to treat every
sentence of the report under it as a claim.

- **Task review** — spec ✅, quality ✅, one Important. Its seat question was whether the refusal
  cases' SETUP was vacuous: the incident is opened BEFORE the harness seeds, so "the note is
  untouched" could have been asserting a value a failed seed would read back anyway. It answered by
  perturbation, not by reading — seeded height 700 → 777 made the assertion follow it
  (`expected 777 to be 700`) with the incident open, and a no-op'd `seed()` reddened the geometry
  case with `expected undefined to deeply equal {x:5,y:5}`. **Not vacuous.**
- **Scoped re-review** of the fix round — spec ✅, quality ✅, one Important. It falsified all three
  of the category loop's guards by experiment: an `execute`-only member reddened the exclusion
  assertion BY NAME, a deleted member reddened the count floor, and a stubbed single door was named
  in place among the other seventeen. Its Important was that a clause the fix round had just written
  — that the file probe "IS reached with the gate disabled" — was measured FALSE: instrumented, the
  probe recorded `asked: []`, because `SetAssetBackgroundCommand` throws in `backgroundKindOf` before
  consulting it. Fixed at `4a9c14d68`, by an implementer who re-measured it independently rather
  than taking the review's word, and who added a well-formed-path arm so the empty result is a
  measurement rather than a dead instrument.

#### Rulings, and what each costs if wrong

| Ruling | Decision | Cost if wrong |
|---|---|---|
| R-S6-1 | The subject is the instrument, not a gate; no production change unless M2 is falsified | A forward designer edit landing under an open incident would be a live hole; the session would have had to gate at the command seam |
| R-S6-2 | Close the door CATEGORY with a loop over the bundle rather than narrowing the sentence to two doors | The loop's inputs are valid only to a gate that refuses first, so it must be watched red and its per-door codes reported — it was |
| R-S6-3 | Record L-17 (the eleven-site EIGHT/nine miscount) rather than fix it here | The false counts stay in production docblocks one more session. `:63` is a wrong GROUPING, not a typo — repairing it means re-deriving which adapter inverts `setShape`, which is a task with its own review |
| R-S6-4 | Record L-18 (`setHeight` accepting an absent height) rather than fix it | Nothing reaches it today; `height` is a required `number \| null` and both call sites supply it. If a third call site arrives without a decision on where validation belongs, it can clear a field silently |

Three owner calls were put to a release owner rather than guessed, and all three were answered:
**L-13** reclassified with G1 still blocked on the undo half as its own limitation (L-16), **L-12**
closed by changing "guarded" to "version-checked", and **L-15** deliberately left for a copy pass
with native-speaker review rather than minting more agent German.

#### What is implemented but unverified, and what was NOT done

- **Nothing on this branch has ever been run in Obsidian.** No native, device, screen-reader or
  performance verification was performed in this session or any before it.
- **Coverage was not re-measured.** Three test cases were added and no production line changed, so
  no branch arm moved; `npm run check` was kept off the working machine under the parallel-work rule
  and coverage on this branch is CI's report to make.
- **BP-03 was not opened.** The session's remainder is not where a P0 discovery package starts.
- **The seven other guarded doors' data-safety half.** The category loop proves all nine refuse with
  `WRITES_PAUSED_CODE`; the port-was-not-written assertion is driven for two of them, one per
  adapter. Widening it means seeding a meaningful before-state per door, which is a real cost for a
  claim the shared `guardCommand` already carries.
- **Whether the designer's UI actually reaches the guarded chain at runtime.** The instrument proves
  the chain the composition root builds refuses. It does not prove the mounted surface dispatches
  through that chain rather than through a harness's, because `designerRig` builds a raw bundle —
  closing that means editing a shared harness, which changes what every other designer test measures
  and is a decision with its own review.

**Next executable action.** Decide **L-16** — whether the reversible adapters' UNDO halves come
inside the write gate. It is a DECISION and not a discovery: the behaviour is measured, driven and
pinned by two cases that go red the day it changes. Read ADR-0034's own framing first, because it
argues the other way — the gate exists because a compensating undo itself failed, which reads as a
reason an undo should stay possible while writes are paused. Nothing states that as a decision
today, and settling it is what an ADR-0034 amendment would be for. BP-03 remains the next P0
package after it.

### Session 7 — 2026-09-18 — BP-03: the lifecycle contract, F2 closed, F1 measured

**Branch and revision.** `renovation-planner-beta-handoff-e80bb5`, `136e27b3a` to `1979aa7f6`, six
commits, **nothing pushed**. Upstream re-checked before starting: `git rev-parse origin/main` and
`git merge-base HEAD origin/main` both print `ed5c50b76`, so main is an ancestor and there was
nothing to merge. Tree clean at start and at close.

**Task zero — the coverage run session 6 never performed.** Session 6 changed production code and
closed on `check:fast`, which omits the coverage floors entirely. `npm run test:coverage`, exit
code captured to a file before any pipe: **captured exit 1**, while the harness's own completion
notification said "exit code 0" — the wrapper's status, not the command's, and the second recorded
instance of that trap.

| Metric | Measured | Covered / total | Uncovered units | Floor | Headroom in units |
|---|---|---|---|---|---|
| Statements | 99.21% | 28630/28856 | 226 | 99 | 62 |
| Branches | 98.08% | 21051/21461 | 410 | 98 | **19** |
| Functions | 99.26% | 8326/8388 | 62 | 99 | 21 |
| Lines | 99.65% | 21045/21117 | 72 | 99 | 139 |

**All four floors held, and the contended run was the better evidence.** The exit 1 was ten failed
tests and no threshold breach. Eight of the ten sat in a 5193-5482ms band against vitest's 5000ms
default; re-run on a quiet machine, 9 of 10 files were green, and the survivor passed 11 of 11
alone with 2 node processes. Every one was contention. Because ten dead tests contribute nothing to
a numerator while their files stay in the denominator, a contended run is biased DOWNWARD — so
clearing every floor anyway settles the question in the safe direction, which is why a second
44-minute gate was not run.

**Closing measurement — the session's production changes re-measured on a QUIET machine.**
`npm run test:coverage`, captured exit **0**, 1253.92s: **1037 of 1037 files, 11182 tests passed,
1 skipped, zero failures.** That is a fully green whole-suite run, and it is also the control that
settles task zero's ten failures as contention rather than regression.

| Metric | Task zero (contended) | Close (quiet) | Uncovered units, start to close | Headroom |
|---|---|---|---|---|
| Statements | 99.21% (28630/28856) | **99.22%** (28633/28858) | 226 to 225 | 63 |
| Branches | 98.08% (21051/21461) | **98.08%** (21055/21465) | 410 to **410** | **19** |
| Functions | 99.26% (8326/8388) | **99.27%** (8328/8389) | 62 to 61 | 22 |
| Lines | 99.65% (21045/21117) | **99.65%** (21046/21118) | 72 to 72 | 139 |

**Read the branch row in UNITS, which is the only way to see what happened.** The total rose by 4
and the covered count rose by 4, so the uncovered branch count is **unchanged at 410**: every
branch arm this session added is covered, and no uncovered arm was introduced. The percentage moved
by less than the hundredth it prints, and would have shown the same figure had all four new arms
been uncovered — which is precisely why the floors are not the instrument for this question.


**A controller error, recorded at the time it was made.** The pre-flight measured the machine quiet
and the controller then dispatched three reconnaissance agents alongside the live coverage run,
taking it to 9 and then 13 node processes. That is what produced the ten contention failures and
the re-runs needed to attribute them. The floors still cleared, but that was recovery, not design.

**BP-03 Action 1 — the lifecycle contract**, `cecfbbcbc`:
`docs/releases/first-beta-readiness/04-lifecycle-contract.md`. Six states crossed with five
disruptive actions, built from three independent reconnaissance passes plus controller verification
of every claim a decision rests on. The fact that decides most of it: `createPinia()` is called only
inside a view's `mount()` and `rebind()` is `unmount(); sync()`, so **a Pinia store here has the
same lifetime as a component `ref`** — "it is in a store, so it survives" is false in this codebase.
Stated as six rules rather than a cell-by-cell table, because a table enumerating code goes stale
and a table stating a rule does not. Output: five numbered gaps, F1 to F5.

**F2 — closed.** A settings rebind destroyed an active stale-read-back refusal, and the fresh
hydrate could not re-derive it: `handleFailedRead` sets `stale` only while the status is `ready`,
and a fresh store starts `idle`, so the identical refusing read routed to `fail()` instead. Both
terminal states were safe; the exposure was the TRANSIT, one whole vault read wide, in which a
dispatched command **executed**. That is acceptance criterion 1 verbatim — "no hidden write on
cancel or reflow". Fixed at `0ffd15466` by adding `status !== 'ready'` to `writesBlocked`; blast
radius measured at **0 files, 0 tests**. `3392c20c4` then closed a consequence the fix introduced —
the paused-reason sentence rendering "could not be re-read after the last change" on every healthy
first load — with **no new string and no locale touched**, so L-15 is untouched. `fb78d444c`
narrowed four sentences to what checks them.

**F1 — measured, ruled, documented; the behaviour accepted.** See L-19. The measurement refuted the
docblocks in both directions AND refuted the controller's own brief, which had asserted that a new
dialog result value would be compiler-checked. It would not.

**The max-lines finding.** See L-20. Surfaced by an implementer's "left undone" note, not by
anything the controller ran; the controller had accepted the prompt's framing that lint was red
only because of L-04 and had not checked. Closed at `4cc2543e5`; `npm run lint` now exits 0.

**Exact commands and outcomes, every exit code captured to a file before any pipe.**

| Command | Captured exit | Outcome |
|---|---|---|
| `npm run test:coverage` (task zero) | 1 | Floors all held; 10 failures, all contention |
| the ten failing files, quiet | 1 | 9 of 10 green |
| `lint-edited.test.ts` alone, 2 node procs | **0** | 11 of 11 |
| `planEditorRebindRefusal.test.ts` as landed | 0 | 2 passed |
| same, `status !== 'ready'` term removed | 1 | 2 failed as ASSERTIONS, not timeouts |
| `pausedSurfaces` + pin as landed | 0 | 13 passed |
| same, paused-reason `v-if` reverted | 1 | 1 failed |
| `saveStateWiring.test.ts` as landed | 0 | 6 passed |
| same, stale gate re-pointed at the untracked dispatcher | 1 | 1 failed — the gate fires on a real invariant break |
| `tests/presentation/editor` before and after the extraction | 0 / 0 | 397 files / 3191 tests, identical |
| `npm run lint` at close | **0** | green; was red for a whole session |
| `npm run analyze` | not run | limitation L-04 |

**Evidence locations.** Controller run logs and captured exit codes under
`.superpowers/sdd/01-improvement-plan/s7/` (gitignored, this worktree only), alongside every brief,
implementer report and review for the session. The working ledger is
`.superpowers/sdd/01-improvement-plan/progress.md`, SESSION 7 section, which carries each ruling
R-S7-1 to R-S7-12 with what it costs if wrong.

**Implemented but unverified.** Everything. Nothing on this branch has ever been run in an Obsidian
vault. Specifically: F2's fix is proven by jsdom tests and three controller-run reverts, never by a
vault; L-19's arm question needs one vault run to settle; the max-lines extraction has had **no
independent review** — the controller ruled a spot-review sufficient (R-S7-10) and the residual
risk is a moved docblock that is now false.

**Native checks still not performed.** All of them — the native matrix table above is unchanged.
No Obsidian run, no device, no screen reader, no performance measurement. M3's paused-reason fix is
screen-reader-facing and was verified only in jsdom, which measures DOM and not what assistive
technology announces.

**Next executable action.** BP-03 **F3**: promote `openViewOnLeaf` out of
`tests/plugin/rootSwapRebind.test.ts:62` into `tests/helpers/`. It is the helper that plays
Obsidian's part in a view lifecycle, it is local to one test file today, and promoting it unlocks
the four UNTESTABLE plugin-unload cells — the emptiest column in the matrix. Then F4 and F5, the
empty `command pending` row and the below-floor width crossing, both reachable with the existing
`defer()` idiom.


### Session 8 — 2026-09-19 — BP-03 F3, F4 and F5, and the review session 7 deferred

Branch `renovation-planner-beta-handoff-e80bb5`, `8e390f520` to `c5456b239`, **nine commits, nothing
pushed**. Upstream re-checked before starting: `git rev-parse origin/main` and
`git merge-base HEAD origin/main` both print `ed5c50b76`, so main remains an ancestor and there was
nothing to merge.

**Task zero was the review session 7 ruled unnecessary, and it found three things that ruling priced
as one.** R-S7-10 had accepted a controller spot-review of the `buildDispatcherChain` extraction
(`4cc2543e5`) and recorded the residual as "a moved docblock that is now false … bounded: it is
prose, in two files". All three clauses were wrong. The independent review confirmed the move IS
verbatim — one changed character, `function` to `export function` — and then found that
`saveStateWiring.test.ts` read TWO files joined and whitespace-collapsed, which makes comment text
and code text indistinguishable to every assertion. Measured: with the incident gate genuinely
removed from the dispatcher, ONE added comment line turned the gate green; and a legitimate
warning comment naming a forbidden spelling reddened correct code. The docblock justifying the
concatenation was false in both premises — it counted four `not.toMatch` cases where there are
three, and claimed a stale path would go "vacuously green" where replaying the six cases against
the wrong file turns 6 of 6 RED. A third finding was in PRODUCTION source, not prose:
`save-state-store.ts` named `runtime.ts` as a reader of `unrecoveredWrite` after the symbol moved.

Fixed by converting the gate to an AST check over the chain builder’s own body through
`tests/helpers/parsedSource.ts` (`13ec00696`), which is the conversion CLAUDE.md’s own regex census
already named as next for this file. Six cases became four; no property was lost and two were
gained. Controller-verified by re-driving the false-green mutation: **exit 1, an AssertionError
naming what it looked for and how many it found, not a timeout.**

**F3 stopped at its STOP on a real P0, which is the second consecutive session where a row the plan
called verification held a defect.** `onunload` drains five disposers and does nothing else — it
unmounts no Vue app and detaches no leaf. One disposer releases the write-incident registry, and
`null` disarms all three of its readers at once: `guardCommand` skips its refusal arm entirely,
the incident gate answers `false` through its `?? false` default, and the recording arm stops
recording. Driven on a rig using the plugin’s own registered view factory against a real
repository stack: an identical `createZone` was refused before `onunload` and wrote a note after it,
and an Undo refused before ran its inverse after. **The docblock beside the code already stated the
invariant it broke** — it describes an earlier version of this bug and its consequence, that the
gate then answers "nothing open" over a vault whose own incidents say it is half-written, which is
true verbatim of the teardown case the earlier fix did not cover.

Two fix options were costed and **the briefed option B was refuted by measurement**: a
permanently-refusing sentinel would refuse a write in a never-half-written vault using the only copy
that exists, and L-15 forbids minting a variant. The deciding measurement the controller had said it
could not answer by reading — does the recording arm still reach disk after the session is disposed
— came back YES, because the store’s adapter is Obsidian’s own and nothing in `onunload` touches
it. What landed is neither option as briefed: keep the identity guard, add one term, **do not
release an OPEN registry; a clean one still releases.** The residual is stated in the docblock rather
than hidden.

**F4 and F5 found no defect and locked five arms that were already clean.** A draft survives the
width round trip on the same node and commits to the requirement it was typed for; a part-drawn
polygon leaves the zone repository untouched; a selection moved to another room after the width
returns discards rather than relocates. Perspective already refuses while saving; width needs no
refusal; and the rebind arm is DISTINCT from F1 rather than its residual. F5 runs over real
repositories because the shell suite’s own harness refuses every write, which would have made
"nothing was written" vacuous — a fake-too-kind catch the round made on itself.

**Five separate claims were refuted by measurement this session, and three of them were the
controller’s.** The controller’s `openViewOnLeaf` count (9, actually 11 — the recon grep was piped
through `head`), its `onunload` file count (11, actually 8 — it counted prose mentions), and its
`FakeLeaf.view` census (2, actually nine sites in six files — it grepped one file and called it a
census). All three are the same defect and CLAUDE.md names it: *measure a set with an instrument
that can see all of it, and test the instrument first.* The briefs told every implementer to
re-drive them, which is the only reason all three were caught.

The other two were implementers refuting themselves: the fix round’s corrected `unrecoveredWrite`
count was invalidated one commit later BY the correction that cited it (12 to 13), caught by
re-grepping after the edit rather than before; and F4/F5 withdrew its own first docblock claim when
the mutation it named stayed green. **8 mutation runs there, 6 red, 2 rejected as green** — and the
two rejections are why the two refutations exist.

**A controller check worth repeating: the completion summary and the shipped docblock disagreed.**
F4/F5’s summary named one mechanism for the draft discard; the committed docblock named another.
Both were driven. The summary’s mechanism, removed, left all three cases GREEN at exit 0; the
docblock’s mutation produced an AssertionError on the named case alone with both siblings green,
exactly as it predicts. **The artifact that ships was the correct one.** The docblock is what the
next reader meets, so it is the claim that earns the check.

#### Closing verification, quiet machine, every exit captured to a file before any pipe

| Command | Captured exit | Result |
|---|---|---|
| `npm run lint` | **0** | oxlint with warnings denied, then `eslint .` with max-warnings 0. **`eslint .` DID run** — L-20’s method half, complied with rather than closed |
| `npm run test:coverage` | **0** | **1040 files, 11191 passed**, 1 skipped, zero failures, 1050.68s |
| `npm run analyze` | **not run** | L-04 — fails on `origin/main` itself |

Statements 99.22% (28636/28861), branches 98.09% (21059/21467), functions 99.27% (8328/8389), lines
99.65% (21048/21120), against floors of 99/99/99/98 in `vitest.config.ts` — all four met. **Counted
in UNITS, which is the rule the percentage cannot satisfy:** uncovered branches fell from 410 to
**408** while the total rose by 2, so headroom against the 98% floor went from 19 branches to **21**.
This session added no uncovered arm and recovered two.

**A correction to session 7’s closing line.** It recorded the floors as "99.22 / 98.08 / 99.27 /
99.65" labelled *statements/functions/lines/branches*. That label is MIS-ORDERED: 98.08 was branches
and 99.65 was lines. The measured order is statements, branches, functions, lines. Corrected here
rather than in that session’s own log, which is a dated record.

#### Not done, and not to be represented otherwise

- **Five of F3’s six unload rows are unwritten**, deliberately — see L-21. Writing them as the code
  stands would certify a behaviour nobody has decided is correct.
- **Two assertions in `pendingDispatchDisruption.test.ts` have no available mutation** and are named
  in the file as locks rather than as demonstrated reds. Honest spelling, and still two assertions
  nobody has watched fail.
- **Nothing on this branch has ever been run in an Obsidian vault.** No native, device,
  screen-reader or performance verification was performed or is claimed. L-19’s arm question and
  L-21’s ordering question each need one vault run.
- **`npm run analyze` was not run** and its L-04 failure is unchanged.

#### Next executable action

**A release-owner decision on L-21** — may a still-mounted view write to the vault once `onunload`
has run? It is not work and not the controller’s to take. Five BP-03 test rows and, with L-19, the
G1 evaluation stand behind it.

### Session 9 — 2026-09-19 — CI read for the first time, the owner decision package, BP-04 opened

Branch `renovation-planner-beta-handoff-e80bb5`, `f40bd2bd2` → `5ecd0e8b5`, two commits. Pre-flight:
tree clean, `origin/main` at `ed5c50b76` and still an ancestor, so nothing to merge and no rebase
question. Working ledger at `.superpowers/sdd/01-improvement-plan/s9-*` (GITIGNORED, one copy).

#### Task zero — CI had never run on nine sessions of work, and it refuted the ruling that kept it unread

Run `35458670059`: `audit` green, **all four `verify` legs red**, character-identical failure on
Windows 22 and Ubuntu 22/24/26 — so no platform and no Node-version divergence.

**L-04 is REFUTED (ruling R-S9-2).** `npm run analyze` does not fail on `origin/main` and never did:
CI run `35126250337` at `ed5c50b76` is `success` on all four legs, its log holds **zero** `Failed:`
lines and reads `✗ 0 above threshold`. The L-04 row carries the full account and why it is kept
rather than deleted. The short form: fallow's failure sentence ends with a **refactoring-target
pointer**, not the breach, and green main prints the identical pointer.

**One REAL finding, fixed at `a77cf2b09` (ruling R-S9-3).**
`ObsidianProjectRepository.saveQueued` at **cognitive 17** against a threshold of 15 — cyclomatic 11
did not breach, so DEPTH was the lever and not branch count. Branch-introduced (`+27 −1` across
`81f627b53`, `616deaed1`, `316e86a86`). Cleared by extracting the create arm's `catch` body into a
private `undoInsert`, never by raising a threshold. The ADR-0034 comment travelled with the code it
explains; no test was edited; both arms (`project.write-uncompensated`, `project.write-failed`) are
covered by existing cases watched passing by name. **Controller-verified independently:**
`npm run analyze` exits **0**, `✗ 0 above threshold`, clone groups unchanged at 7.

Everything else on those legs was NOT a finding: 11192/11192 tests passed four times with identical
coverage; all 7 clone groups are byte-identical to green main; and **line endings have no connection**
— `.gitattributes` sets `eol=lf`, and 0 of 142 changed blobs carry a CR in the index, so the local
stage-time CRLF warning cannot reach CI. That is stated explicitly because it had never been checked.

#### The owner decision package, and what assembling it refuted

`05-owner-decisions.md` states the three remaining G1 owner questions for one sitting — L-06 (with
L-11 folded in on L-11's own consequence column), L-19 and L-21 — costing every option including the
refused ones, giving each what it costs if chosen wrongly, and naming each deciding experiment.
**It decides nothing, deliberately.** Three of the three need a vault run.

**Ruling R-S9-4: ADR-0034's worked example for refusing L-06's closing option is FALSE.** Verified at
source by the controller and again by two independent agents: `ConstructionMaterialCommand.putBack`
retires the COMMAND and returns `err(error)` with the stamp intact, its other arm raises a fresh
`markUncompensated`, `guardedRenovation` wraps both doors in `guardCommand`, and `withBoundary`
returns a failed `Result` unchanged — so `guardCommand`'s own exit test is reached and **that stamp
already becomes a durable incident today**. `git blame` puts the deciding line at `e225634b4`, before
the correction reasoning from it: wrong when written, not drift.

**The DIRECTION of that cost survives and every corrected document says so.** Recording inside
`markUncompensated` would still make a pure stamping function effectful against module state and
still widen the harshest mechanism this plugin has. Only the one demonstration fails, and **no other
has been costed** — so a correction reading "the cost is refuted" would push an owner toward an
uncosted option. **Ruling R-S9-5: three carriers, three treatments, one edit**, because correcting
one alone only moves the contradiction: ADR-0034 takes an APPENDED dated correction beside its eleven
existing ones (R-S7-12), the tracker's L-06 row is a live status row and is corrected in place, and
`07-session-5-prompt.md` is dated history and takes an appended pointer.

#### BP-04 opened with discovery, and reviewed

No implementation started. The package register row carries what was established and the three
corrections its independent review made. The headline: the domain half **ships today**, and the
per-corner selection state the contract needs **exists nowhere** — smaller than the plan assumes in
one direction, larger in another. Two code findings fell out of it that BP-04 did not cause and are
recorded as **L-22** and **L-23**.

**Ruling R-S9-6:** no fix round on the discovery report. It is a gitignored research note, its review
sits beside it, and both are read together — so the corrections were written into this tracker
instead, which is committed and is what the next session reads first. **Cost if wrong:** an
implementer reads only the discovery note and under-budgets the package, which is why the per-corner
gap is named outright in the register row rather than left to inference.

#### Instrument failures this session, kept because the ledger is where they belong

1. **The controller's own pipe-counting instrument was broken** — an awk `gsub(/\\\|/,…)` reads in ERE
   as "backslash OR empty" and matched every character, reporting 2327 escaped pipes in a 2326-char
   row; `gsub` also mutates `$0`, so its length reading was wrong too. Replaced with a node script
   that **self-tests on six fixtures before it reports**, which is the only reason the breakage was
   visible rather than merely wrong.
2. **`wc -l` is not the instrument for this repository's line cap.** `max-lines` is 400 with
   `skipBlankLines: true, skipComments: true`; `runtime.ts` is 619 raw lines and passes at exit 0.
   Raw counts overstate by roughly a third in this codebase, and a discovery report had flagged the
   resulting disagreement as unresolved.
3. **A controller count of ADR-0034's existing corrections said two; there are eleven.** The grep was
   for one date rather than for the correction form.
4. **A reviewer's list is a reading, not a census — in both directions.** The review of the decision
   package named four tracker rows as wrongly called closed; checking all four found two of them
   genuinely closed. The brief's instruction to verify rather than apply is what caught it.

#### Machine state — a caveat on every timing-sensitive measurement here

`ps -W | grep -ci node` read **0** at pre-flight and **10** mid-session: a real concurrent
`vitest run`, an `eslint` and a harness dev server, **all in the sibling worktree
`renovation-planner-asset-designer-bc5539`**, another session's agents. Nothing failed and nothing
had to be discounted. But the handoff rule "check the count and re-run" is necessary and **not
sufficient** when the contention belongs to a different checkout.

#### Not done, and not claimed

- **Nothing has been run in an Obsidian vault**, this session or any previous one. No native, device,
  screen-reader or performance verification was performed or is claimed.
- BP-04 has no production line changed.
- L-22 and L-23 are recorded, not fixed.
- The five BP-03 unload rows remain deliberately unwritten (R-S8-3 / R-S8-4).

#### Closing gates — `npm run check` is GREEN, all four steps, for the first time on this branch

| Command | Captured exit | Result |
|---|---|---|
| `npm run check` | **0** | All four steps ran: `build`, `lint` (oxlint + `eslint . --max-warnings 0` — **`eslint .` DID run**, which is L-20's method half), `test:coverage`, and **`analyze`**, which no session had run since L-04 |
| — `test:coverage` | — | **1040 of 1040 files, 11191 passed**, 1 skipped |
| — `analyze` | — | `✗ 0 above threshold`, 7 clone groups unchanged, no `Failed:` line |

Statements 99.22% (28637/28862), branches 98.09% (21059/21467), functions 99.27% (8329/8390), lines
99.65% (21049/21121), against floors of 99/99/99/98 — read `vitest.config.ts`, not this sentence.
**Counted in UNITS, because the percentage cannot see one arm:** the extraction added one statement,
one function and one line, all covered, and **zero branches** — uncovered branches stay at 408 and
**headroom stays at 21**.

**The FIRST run of that gate captured exit 1, and the harness notification said "exit code 0".**
The captured file is the authority and the handoff predicted exactly this. Three `tests/build/`
files failed and **not one failure was an assertion**: a child vitest killed (`exit null, signal
SIGTERM`), a 60000ms timeout which is `ESLINT_BOOT_MS` — the budget CLAUDE.md describes as the
instrument for ESLint boot contention — and a 5000ms timeout, vitest's bare default and the same
band session 7 recorded eight false reds in. The run overlapped a sibling worktree holding ten node
processes. All three passed in isolation on a quiet machine (134/134, exit 0) and the whole gate
then passed on a re-run. **The diagnosis rests on the failure SHAPES, which were contention-shaped
before any re-run; the re-run confirmed it rather than producing it.** The 7-skipped count in the
red run was an artifact of the failed files and returns to 1.

#### Next executable action

**BP-04 slice A** — one `createRoomEditAction` whose `accepts` covers Room and Area, mounting the
existing `OutlinePointsForm`, templated on `roomResizeAction.ts`. Its brief must carry the review's
three corrections, above all that no per-corner selection state exists anywhere.

**G1 remains blocked**, and not on work: the three owner questions in `05-owner-decisions.md` must be
answered or explicitly accepted, and three of the three need a vault run.

### Session 10 — 2026-09-20 — CI confirmed green, and BP-04 leaves discovery for code

Branch `renovation-planner-beta-handoff-e80bb5`, opened at `7d7033b15`, closed at `152a3c18c`.
`origin/main` at `ed5c50b76`, re-checked and still an ancestor — **no merge, no rebase**, so every
review record that references this work by SHA still resolves.

#### CI run 35469578843 at `7d7033b15` is GREEN, on all five jobs

`audit`, and `verify` on `ubuntu-latest` 22/24/26 and `windows-latest` 22. The previous run
(`35458670059`, at `f40bd2bd2`) was red on all four `verify` legs; session 9 found one real cause and
fixed it by extraction at `a77cf2b09`, and **this run is the confirmation nobody had seen.** No
triage round was dispatched, because there was nothing to classify — recorded so the omission reads
as a decision rather than an oversight.

#### BP-04 slice A shipped, reviewed, and is explicitly NOT the whole of BP-04

| Commit | What |
|---|---|
| `6546f402c` | `src/presentation/editor/resize/zoneOutlineAction.ts`, one wiring line each in `editorFormActions.ts` and `runtime.ts`, and `tests/presentation/editor/resize/zoneOutline.e2e.test.ts`. 229 insertions, four files |
| `152a3c18c` | one docblock clause pointing the curve-refusal claim at the test that drives it (review finding S-4) |

Zero locale changes. **Zero new user-facing strings and no German**, which was not the expected
outcome — see R-S10-1.

#### Three of the handoff's own premises were refuted at source BEFORE any code was written

Every one of them was written into a brief as something the implementer had to drive rather than
believe, which is the habit sessions 8 and 9 established and the highest-yield one in this record.

1. **There is no `'Area'` ZoneType** (R-S10-2). `ZoneType.ts` declares seven values and `'Area'` is
   not among them; "Area" is this codebase's UI word for a zone that is not a Room. So the shared
   phrase "covers Room AND Area", carried identically by the plan, this tracker and the handoff,
   means EVERY type — `accepts: () => true`, written as a category because a list of seven omits the
   eighth silently.
2. **Slice A needed no new string, and L-15 was never engaged** (R-S10-1). Four existing keys,
   written in BOTH locales, cover every slot. The residue is L-25.
3. **The template was the wrong file** (R-S10-3). `metadata/areaDetailsAction.ts`, not
   `resize/roomResizeAction.ts` — it is the only existing action that already widens `accepts` past
   Room, and it costs one runtime member instead of two.

Beside those, **Q-01 is answered by the code** (R-S10-8): its "blocks BP-04 from starting" was false,
and its own instruction not to accept "an inference from a form" is what kept a settled question
open for two sessions.

#### What the evidence base nearly was, and why it is worth recording

The implementer's first batch of 17 mutation runs used `--reporter=basic`, **which vitest 4
rejects** — so all 17 exited 1 with **no test executed**. Read uncritically that is seventeen
fabricated watched-reds, in the exact place this package's evidence lives. It caught itself and redid
them; the independent reviewer then confirmed structurally that no fabricated row survived, since
every row carries case-level text a run that executed nothing cannot produce.

A second one in the same family: a red that was a **timeout rather than an assertion**, rewritten so
its failure reads `expected true to be false`. A test whose only failure mode is a timeout cannot be
told apart from machine contention, and this repository has eight recorded false reds in a
5193–5482ms band.

#### The review, and the one mutation nobody asked for

Spec **PASS**, quality **PASS WITH FINDINGS**. The reviewer re-drove **six** watched-reds itself
against a brief asking for five, all six matching. It then added a **seventh of its own** — dropping
the no-op guard — expressly to test whether `vi.spyOn(runtime.dispatcher, 'run')` sat on the real
path. It reddened; had it not, four assertions would have been vacuous at once. **That is the check
the controller most wanted and did not think to ask for**, and it is the argument for an independent
reviewer over a scoped re-read.

Its findings were one FALSE and one OVERREACH, **both in a gitignored research note rather than in
the artifact** (ruling R-S10-6, which is R-S9-6 applied again: no fix round on a note, corrections
into this committed tracker), plus five silences. One silence earned a round (S-4, above); two became
**L-24** and **L-25**; two are disclosure and are recorded here.

#### Controller instrument failures, kept because the ledger is where they belong

1. **A shell-inlined regex reached node unterminated** — session 9 recorded this exact failure and it
   was reproduced on the first attempt at reading coverage. The working replacement is written to a
   FILE, self-tests on fixtures before it reports, and **exits non-zero rather than printing a clean
   result when it matches nothing**.
2. **A bash heredoc failed outright** writing the first brief — session 8's recorded hazard, met
   again. Prose is written with a file-writing tool here, not a heredoc and not `sed -i`.
3. **The brief named `inspector/inspector-wiring.ts`**; the file is
   `src/presentation/editor/inspector-wiring.ts`. Written from a report's prose rather than from a
   `find`. Harmless only because it sat inside a stop gate the implementer had to drive anyway.
4. **The brief proposed a file name without grepping for a collision.** `EditorRuntime` already
   declares `areaCorners` (`runtime.ts:100`, the draw-area corner input), so `zoneCornersAction.ts`
   would have put two members one word apart in front of unrelated things. The implementer caught it
   and the file is `zoneOutlineAction.ts`.

#### Gates — `npm run check`, CAPTURED exit

The background wrapper reported "exit code 0" and so did the file; **the file is what was believed**,
because session 9's harness reported exit 0 over a captured exit of 1 on the most important
measurement of that session. Exit written before any pipe and read back.

| Command | Captured exit | Result |
|---|---|---|
| `npm run check` | **0** | all four steps green |
| — `test:coverage` | — | **1041 files, 11206 passed**, 1 skipped |
| — `analyze` | — | `0 above threshold · 7756 analyzed · maintainability 86.7 (good)`, 7 clone groups, no `Failed:` line |

Coverage against floors of 99/99/99/98 — statements 99.22% (28644/28869), branches **98.11%
(21066/21471)**, functions 99.27% (8335/8396), lines 99.65% (21056/21128).

**Branch headroom went UP, 21 to 24.** Counted in UNITS rather than percentage points, as this
project's own rule requires: total branches rose 4 and covered branches rose 7, so BP-04 — the first
feature work in several sessions, and the place headroom was expected to go — paid for its own arms
and covered three that were already uncovered. The new file measures **100/100/100/100**, read from
`coverage-final.json` for the changed files with the self-testing instrument above, because the
percentage summary cannot see a single arm.

#### Not done, and not claimed

- **Nothing has been run in an Obsidian vault**, this session or any previous one. No native, device,
  screen-reader, appearance or performance verification was performed or is claimed.
- **Nothing in the UI opens slice A's dialog.** It is reachable only from a test (L-24).
- BP-04's per-corner contract and its action 3 are NOT implemented (slice A2).
- L-22 and L-23 remain recorded and unfixed. L-17, L-18 and the two `pendingDispatchDisruption`
  lock assertions were not touched.
- The five BP-03 unload rows remain deliberately unwritten (R-S8-3 / R-S8-4).

#### Next executable action

**BP-04 slice A2 — per-corner selection and highlight**, in `tools/render-state.ts` and
`layers/InteractionLayer.vue`. It needs no new string, which is what makes it movable; **slice B is
blocked on owner copy, not on work.**

**G1 remains blocked**, and still not on work: L-06's category, L-19 and L-21 are assembled in
`05-owner-decisions.md` and all three need a vault run. **G2 needs BP-04 through BP-07**, and BP-04
is one slice of three.

### Session 11 — 2026-09-20 — BP-04 slice A2, verified by captures, and a hollow assertion found

Opened at `219cf4846`, tree clean, pushed. `origin/main` re-checked: `ed5c50b76`, **not moved**, still
an ancestor — no merge, no rebase, every review record still resolves by SHA. CI run `35502614126`
was already green on all five jobs and was confirmed in one call rather than re-litigated.

#### BP-04 slice A2 shipped — the per-corner half of BP-04's contract

| SHA | What |
|---|---|
| `8bfd6dd6a` | slice A2 — chosen-corner list, `RenderState.highlightedVertex`, the canvas mark, a `?outline=1` harness knob and three capture rows. 17 files, 449 insertions |
| `b6b6a1f27` | the review round — five findings, including the hollow-assertion fix |
| `e2d524a9b` | `guardKnob`'s docblock moved back above `guardKnob`, 12 lines, byte-identical |

**BP-04 is still NOT closable.** Slice B — the reach — remains, and is blocked on **owner copy**
rather than on work: its action label needs German, and L-15 forbids minting it. Nothing in the UI
opens the dialog (L-24 stands); the harness knob opens it **programmatically**, which is a harness
door and not a UI one.

#### Two of the handoff's own premises were refuted at source before any code was written

Driven by the controller, not inherited. This is now the ninth through eleventh premise refuted this
way across sessions 8–11, and it remains the single highest-yield habit in this record.

1. **`OutlinePointsForm` is SHARED.** The handoff calls it "the right substrate" and never says it has
   a second production importer — `elementEditPresentation.ts`, the fallback form for every
   `NamedSpatialElement` that is not a stair, post, beam or dimension, asserted in four places by
   `elementLifecycleCompletion.test.ts`. An implementer told it was slice A's form would have edited
   it freely.
2. **"No per-corner state exists anywhere" is TOO WIDE.** True of RENDER state; false of the
   codebase. `add/AreaCornerEditor.vue` already carries the whole affordance — a chosen-corner index,
   a numbered list, a per-row control with an `edit-corner` aria-label, a `role="status"` region, and
   a measured docblock about focus loss when a row's own button removes itself. **Session 10 met its
   `areaCorners` runtime member as a NAME COLLISION and nobody followed the signal.**

A third, smaller: **three** usable keys exist in both locales rather than the two named, and the
unnamed one — `editor.area.corner-position`, "Corner {n}: X {x} m, Y {y} m" — is the accessible row
label a numbered list needs. **Zero strings were minted for a THIRD consecutive slice where copy was
expected to be needed.**

#### The independent review's UNASKED mutation earned the round, for the second session running

`interactionLayer.test.ts` compared the rendered radius to **the same constant the renderer read** —
self-referential, and therefore unable to see what the constant MEANS.

- at `2`, the chosen corner drawn **SMALLER** than its siblings — **the highlight inverted** — both
  test files stayed **green, 28 passed, exit 0**
- at `10`, the drawn mark larger than the grab region — the exact defect `handleMetrics.test.ts`
  names **in words** at the assertion next door — also green

`handleMetrics.ts`'s header claimed that ordering *"is a check rather than this paragraph"*. It was
not one. Fixed as two ORDERINGS plus a pixel-level one against what the same layer drew a moment
earlier, watched red three ways (`expected 2 to be greater than 4` in both files; `expected 8 to be
greater than or equal to 10`; the finiteness list). **No reviewer was asked to look there.**

The same reviewer also found the **narrow capture row reducible to a byte-identical duplicate of the
wide one** with `tests/build` green (46 files, 1280 tests) — so the instrument for BP-04's own test
case 12 was not pinned to the width it exists for — and that the e2e's `[role="status"]` assertion
reads the form's pre-existing sibling status region the moment it renders.

#### The fix agent corrected the reviewer, and the controller's own instrument was too narrow

The review wrote that every writer of `previewPolygon` stores unexpanded corner points. There is a
**SIXTH**: `src/presentation/designer/tools/draw-detail-tool.ts` assigns an already-expanded
`polygonPolyline` to that field on the same `RenderState` class. **Writing the reviewer's sentence
verbatim would have shipped a fresh false claim into the docblock being fixed for exactly that
offence.** Verified at source by the controller.

And in the act of verifying it, the controller's own `grep "previewPolygon = "` **missed that site**,
because the assignment spans two lines. Only reading the range found it. *Measure a set with an
instrument that can see all of it* — met on the controller's own grep.

#### What the CAPTURES found, and what they cost to get

**The captures are the reason A2 was the right next slice, and they earned it.** The controller
opened them itself — the handoff required that of the controller specifically, not only of its
agents.

**Delivered and confirmed by eye:** the chosen vertex is a filled accent dot, clearly larger than its
hollow siblings, in **both** colour schemes, with good contrast on the dark canvas. jsdom can only
measure a `radius()` number, which is a proxy; this is the thing itself.

**Found by nobody else, and recorded as limitations rather than built:** the corner list is
**ADDITIVE** — the dialog renders the list above all five fieldsets rather than instead of them,
roughly doubling its height, and names the chosen corner three times (**L-26**); and at 460 px the
modal covers the canvas entirely, so **the highlight cannot be seen at the one width BP-04's test
case 12 is about** (**L-27**).

**The controller's first reading of the 460 px capture was WRONG and the ruling went against it.**
It called the clipping an overflow; `.rp-dialog` carries `max-height: 100%; overflow-y: auto`, so it
is a viewport clip on a panel that scrolls — the designed behaviour. **Measured before ruling.** With
nothing broken, gating the fieldsets became a UX preference against a real trade, and BP-04 action 3
is about the CANVAS highlight, which is delivered.

The eight-corner layout case is **not photographed** — the densest seeded zone has five corners.

#### Gates — CI is the authoritative measurement, and that was a correction mid-session

| Gate | Result |
|---|---|
| **CI run `35519074226` at `e2d524a9b`** | **success, all five jobs** — `audit`, and `verify` on ubuntu 22/24/26 and windows 22 |
| Suite, identical on all four legs | **1042 files, 11215 passed** |
| analyze, all four legs | `0 above threshold · 7763 analyzed · maintainability 86.7 (good)` |
| Local `npm run check` at `8bfd6dd6a` | **`CAPTURED_EXIT=0`**, read from a file written before any pipe. 1041 files, 11210 passed |
| `npm run harness-shot` | exit 0, **120 PNGs, zero `not the Chromium` lines** — the genuinely pinned build, no approximate caveat |

Coverage from CI, against floors of 99/99/99/98 in `vitest.config.ts`:

| Metric | Session 11 | Session 10 |
|---|---|---|
| Statements | 99.22% (28662/28887) | 99.22% (28644/28869) |
| Branches | **98.11% (21073/21478)** | 98.11% (21066/21471) |
| Functions | 99.27% (8343/8404) | 99.27% (8335/8396) |
| Lines | 99.65% (21072/21144) | 99.65% (21056/21128) |

**Branch headroom is UNCHANGED at 24** — 405 uncovered against an allowance of 429. Counted in
UNITS: total branches rose 7 and covered branches rose 7, so **A2 paid for every one of its own
arms**, exactly as slice A did. Four independent CI legs returned coverage identical to the digit,
which is itself evidence of no flakiness.

**A mid-session correction worth recording, because it was the controller's own rule being broken.**
The full gate was run LOCALLY a second time while a **peer session held more node processes than this
one did** (measured: 4 mine, 6 the asset-designer worktree's, 4 unattributed). `CLAUDE.md` states
plainly that two gates at once produce a WRONG red rather than a slow one and that the full gate
belongs in CI — and three briefs this session said so to their agents. The local run was stopped and
the commits pushed so CI could measure on clean runners, which is what the table above rests on.

Stopping it exposed a second thing: **`TaskStop` killed the npm wrapper but not the process tree.** A
vitest fork worker was still executing at ~33% of a core with its reaper gone, found only by sampling
CPU **twice** — one reading cannot tell an orphan that is spinning from one that is idle. Both
survivors were confirmed by command line and worktree before being killed; nothing of the peer's was
touched. The interrupted run left `coverage/` with no `coverage-final.json` and one orphaned shard,
which is **L-28's own third failure mode** met within an hour of recording it; the shard was removed.

#### Rulings made this session, with what each costs if wrong

| # | Ruling | Cost if wrong |
|---|---|---|
| R-S11-1 | The per-corner affordance is OPT-IN on the shared form; `elementEditPresentation.ts` stays byte-unchanged | One optional prop and one branch. A later caller wanting the list passes the prop; no rework |
| R-S11-2 | REUSE `AreaCornerEditor.vue`'s affordance shape rather than invent a third corner list | The two lists sit in different components and could drift. Extracting a shared one is a refactor of its own; inventing a third shape is worse |
| R-S11-3 | The highlight is ONE new nullable `RenderState` field, not a richer `previewPolygon` — which has a second writer in `SelectTool` | One field. Merging later is local to two files |
| R-S11-4 | Captures are mandatory and the FORM at 460 px is the required subject | A capture round that finds nothing, ~2 minutes, against a layout defect no gate here can see. It found three things |
| R-S11-5 | One implementer for the whole slice; the harness knob LAST | A large brief. Mitigated by five stop gates and by the capture being last |
| R-S11-6 | No parallel agent beside the implementer; L-23's measurement held | L-23 waits one session. It is a latent-vs-live classification, not a defect |
| R-S11-7 | The implementer's `analyze` exit 1 was CONTENTION, settled by the clean gate rather than by its explanation | Had it been a real regression, believing the explanation would have shipped it. Three independent confirmations, recorded as L-28 |
| R-S11-8 | The additive-list design change is REFUSED — **and the finding refused is the CONTROLLER'S OWN** | The dialog stays tall and BP-04's constrained case is adequate rather than good. Recorded as L-26/L-27; reversible, and the captures to argue it from now exist |
| — | The orphaned docblock was ruled on rather than deferred | A comment move. A knowingly-wrong comment in code written this session is not something to log and leave |

#### Not done, and not claimed

- **Nothing has been run in an Obsidian vault.** No native, device, screen-reader, contrast or
  performance verification was performed or is claimed by anyone this session. **A harness capture is
  a browser render, not a vault run**, and the new axe scan is a jsdom scan of 21 rule families — not
  an accessibility conformance claim, and it grades neither contrast, nor a visible focus indicator,
  nor hit-target size.
- **Slice B is not started** and is blocked on owner copy (L-15). BP-04 is one slice from closable.
- L-17, L-18, L-22, L-23 untouched. **L-23's cheap experiment was deliberately held** (R-S11-6).
- The eight-corner constrained-layout case is unphotographed.
- The five BP-03 unload rows remain deliberately unwritten.
- `05-owner-decisions.md` untouched, as the handoff required.

#### Next executable action

**BP-04 slice B — the reach**: a context-menu entry and `SpatialInspectorActions.vue` wiring, which
is the ONLY thing standing between BP-04 and closable. **It is blocked on the OWNER, not on work** —
it needs an action label in both locales and L-15 forbids agent-minted German. Landing it also closes
L-24 by making it moot.

If the owner is unavailable, the movable pieces are **L-23's measurement** (whether any live path
reaches `MoveSpatialObject` with a degenerate outline — the cheap experiment that decides latent
versus live) and **L-22**, which needs the realistic-geometry case produced first and starts with
exporting `validateCurvedBoundary`.

### Session 12 — 2026-09-20 — BP-04 slice B lands, and three geometry holes are measured

Branch `renovation-planner-beta-handoff-e80bb5`, opening tip `d6b7ee4b7`, closing tip
`2cf585a40`. `origin/main` at `ed5c50b76` and still an ancestor — verified with
`git merge-base --is-ancestor origin/main HEAD` — so **no merge was needed and none was made**.
Three commits, all pushed. The working ledger with every ruling and its cost is
`.superpowers/sdd/01-improvement-plan/s12-ledger.md` (GITIGNORED).

#### BP-04 slice B shipped — the reach, and BP-04's last slice

**`1f2cf7cf8`** — a context-menu entry (`edit-outline`) and an inspector button
(`resize/ZoneOutlineAction.vue`), both calling the one function
`runtime.zoneOutline.editZoneOutline`, which is CLAUDE.md's *"one action, every input"*. Pushed
for **every zone type** as a sibling of the Room/non-Room `rename` ternary rather than an arm of
it (ruling R-S10-2). One locale key in both locales, **the owner's copy verbatim** —
`Edit corners` / `Eckpunkte bearbeiten` — so **L-15 is satisfied for this string and no other**.

**`73af5eb95`** — the documentation half. **`2cf585a40`** — the consolidated fix round after an
independent review and an independent acceptance audit.

**CI is green at `1f2cf7cf8` on all five jobs** (`audit`, and `verify` on ubuntu 22/24/26 and
windows 22), which resolved the implementer's one disclosed risk: `npm run analyze` had not seen
the `zoneEditActions` extraction the 100-line budget forced, and that was named as the likeliest
red leg. **No full local gate was run this session at all**, deliberately — the two problems
observed locally were both contention, and the authoritative answer came from the machine with no
peer session on it.

#### Three of the controller's own premises were refuted, and one was refuted twice

This is the session's most reusable result, so it is recorded as a pattern rather than as a list
of corrections.

1. **The perspective guard.** The brief asked about **Review**; Review is unreachable there (the
   computed returns before `singleActions`). **Renovate** is the live arm and no brief named it.
   `'edit-outline'` joins `GEOMETRY_ACTIONS`; it costs no branch.
2. **The key name.** The controller recommended `editor.area.edit-corners`; the implementer
   measured and chose **`editor.area.outline`**, because there is no `editor.zone.*` family at
   all (zero keys) and the `corner` stem already carries **six** keys in that block, four
   parameterised — so a seventh differing by one `s`, one parameterised and one not, is a
   substitution **no gate in this repository can see**. Accepted over the controller's own.
3. **The narrow capture row — refuted, reinstated, then re-refuted on its reason.** The
   controller ruled one should be added, withdrew that on the implementer's claim that no knob
   presses the Details rail, and the independent review **restored it with a jsdom probe**. The
   fix round then found **that probe wrong**: the press is guarded on
   `querySelector('.rp-room-list__row') === null`, `ResponsiveEditorShell.vue` uses `v-show`, so
   at 460 px the row is **attached and `display: none`** and the press never fires. The probe had
   waited for the button's PRESENCE, which a hidden region satisfies — *the same
   attachment-versus-screen confusion as the bug it was chasing*. **The conclusion survived while
   its reason did not.** The row was added behind a new `?details` knob rather than by changing
   `selectZoneOnceReady`, because changing that would silently reopen the drawer under
   `plan-editor-outline-narrow`, **which is L-27's only evidence** — changing the instrument that
   recorded a limitation is how a limitation quietly stops being reproducible.

The scoped re-review confirmed the correction three ways and added the sharper form the fix agent
had reached without stating: **`captureReadiness.mjs` waits with `state: 'attached'`**, so a bare
`.rp-room-inspector` selector would have **exited 0 on a picture of the canvas**.

#### The unasked mutation earned the round for the THIRD consecutive session

The independent reviewer moved `edit-outline` into the **Room arm** of the ternary — restricting
the entry to Rooms, the exact opposite of the decision four comments and the commit message all
state — and **33 tests passed across 4 files**, including the case named *"offers the menu entry
on every zone type"*, which drove one Room.

**The acceptance audit found the same hole from the opposite direction**, by reading the case
body rather than by mutating: the case calls `renovationEditor(true)`, which creates
`zoneType: 'Room'` named `'Studio'`, and asserts `toContain('Edit Studio')`. Neither agent knew
the other existed.

One narrowing the controller verified and neither summary made: the case immediately above **does**
exercise a Garden — but through `[data-rp-action="edit-outline"]`, the **inspector** door. The
menu door is `[data-rp-context-action="edit-outline"]`. **The hole was the MENU entry on a
non-Room specifically**, and it sat under **acceptance criterion 1**. Closed at `2cf585a40`,
which drives a Garden through the real context menu and renames the case to what its body does.

**Three consecutive sessions have had the reviewer's own unasked mutation be the most valuable
finding of the round.** It is no longer a habit worth recommending; it belongs in every review
brief as a requirement.

#### The fix round refuted its own brief twice, correctly, and the re-review verified both

Besides the capture premise above, it **refused the controller's docblock sentence** that "no
gate can see this action is reachable": deleting either door reddens the e2e, re-driven both ways
(menu 495 ms; inspector 465/178 ms), and `grep editZoneOutline src/` gives exactly two call
sites. What no gate sees is that these are the **only two** doors. It wrote that and nothing
wider — CLAUDE.md's *"write the guarantee to the check"* applied **against its own brief**.

The re-review (**PASS WITH FINDINGS**) verified every fix with a stronger mutation than was asked
for. Two worth recording: for *"one history entry"* it deleted `toHaveBeenCalledTimes(1)` **with
the double-dispatch mutation in place** and watched the case pass, proving both assertions
load-bearing rather than arguing it; and for *"fresh repository reload"* it **attacked the rig
instead of the subject**, byte-patching `0.4`→`0.9` in the FakeVault between write and reopen
(exactly one file matched, the `.rpgeo` sidecar) and getting `expected [0, 0.9, 0, 0]` — so that
test genuinely re-parses vault bytes.

**A handed-on hazard was MEASURED AND KILLED rather than inherited.** The fix round recorded,
unmeasured, that `multiSelectionKnob.ts` carried the same guard and so
`plan-editor-multiple-narrow` *might* be photographing a canvas. The re-review measured it at
460 — `display=""`, `drawer=true`, multi-selection inside the region — and found
`multiSelectionKnob.ts` presses the Details rail **unconditionally**; the cited guard is on the
**layers** side. **Struck from the remainder rather than carried forward**, which is the right
end for an item its finder honestly marked unmeasured.

#### Three geometry holes measured, none fixed, all recorded

**L-23 is LIVE**, not latent — the session's largest result, and re-verified by the controller at
source rather than accepted from the report. Full chain in the L-23 row below. The gesture is
constructed by the editor's **own snapping**, not by floating-point luck, and the sharpest
statement of the defect is an asymmetry: **the drag door writes a zero-area Zone to the vault and
BP-04's typed dialog then refuses to save it.** Two doors to one command disagree about whether
the shape is legal.

Measuring it refuted the recorded **"10 `areaOutline` call sites"**: an AST census over 2455
files (9 self-test fixtures, failing loud on empty reach) found **10 lines mentioning the name** —
1 declaration, 4 imports, **3 calls**, 2 value-passes — with zero references outside
`src/presentation/editor/`. CLAUDE.md's *"a grep is not a census"*, on a figure an independent
reviewer had already "re-derived". The door count is **7 dispatch sites / 4 construction sites /
8 gestures**, not the six on record.

**L-29 is new** — a self-intersecting **straight** outline is refused by nothing at all. **L-30
is new** — the corner dialog's submit button reads **"Apply name"**.

#### An observation from opening the captures, for BP-05/BP-07 rather than for BP-04

`plan-editor-selected-narrow.png` (460 px, the row added this session) and
`plan-editor-selected.png` (1280) were opened by the controller. The agents' reports are
confirmed — `Edit corners` fits on one line at 460, no wrap, no overflow, and it draws with no
button chrome. **What no report carried is the comparison.** The Details panel uses four
affordance levels side by side: `Change room size` is a **filled primary button**, `Enclose with
walls and group` an outlined one, `More actions` plain text **with a chevron**, and `Rename room`
and **`Edit corners`** plain text with neither. **So the entry point to the whole of BP-04 has
the weakest affordance in the panel and sits directly beneath its heaviest** — identical at both
widths, so not a narrow-layout artifact.

**Not a regression and not a defect**: it matches `Rename room` exactly and BP-04's acceptance
says nothing about affordance. But it compounds with the **32 px** box height the fix agent
volunteered, which is under the hit-target guideline and invisible to every scan here. A
low-affordance, small-target row is the discoverability half of "reachable", and reachability is
this package's whole subject. **Three agents looked at these captures and none reported the
ranking**, because each was asked whether the button was correct and answered that honestly; the
comparison only appears when the whole panel is in view.

#### Not done, and not claimed

- **Nothing has been run in an Obsidian vault.** No native, device, screen-reader, contrast or
  performance verification was performed or is claimed by anyone this session. **A harness
  capture is a browser render, not a vault run**, and an axe scan in jsdom is not a conformance
  claim — it grades neither contrast, nor a visible focus indicator, nor hit-target size.
- **L-23, L-29 and L-30 are measured and recorded, NOT fixed.** L-23's remedy is a behaviour
  change at a trust boundary and needs a recorded trade; L-30 is copy.
- **Action 1 of BP-04 — a short interaction specification — has no document**, and the
  Deliverable's real-screenshot clause cannot be satisfied from here.
- L-17, L-18, L-22, L-26, L-27 untouched. L-25 untouched.
- The five BP-03 unload rows remain deliberately unwritten.
- `05-owner-decisions.md` untouched, as every handoff has required.

#### Rulings

| Id | Ruling | Cost if wrong |
|---|---|---|
| R-S12-5 | **BP-04 supersedes a `docs/issues/` note that records its own route as REJECTED.** The note scopes itself to "this increment" twice and the plan approves a concrete interaction in its own words. The note is **appended to, never edited**, keeps `status: In Progress`, and the tracker carries the same pointer | If the rejection was meant to bind future increments, BP-04 is built against a standing refusal and the right move was to ask the owner. **This is the one ruling this session a release owner could reverse**, and nothing written claims verification happened — so a reversal costs a retraction, not an unwound accessibility claim |
| R-S12-7 | **L-23 is reclassified LIVE and NOT fixed this session** | A proven live data-integrity hole stays open one more session, mitigated by recording the exact gesture and the exact remedy |
| R-S12-8 | **The remedy is `enclosesArea` in `Zone.withGeometry` — the forbidden thing, not the call sites.** Explicitly not swapping `createPolygon` for `areaOutline` in `SelectTool`, which closes one door and leaves the category resting on one agent's enumeration | If `Zone.withGeometry` is not the single chokepoint the guard is misplaced; the measurement found 4 construction sites, so that is the premise the fixing slice must drive first |
| R-S12-10 | **`editor.area.outline` accepted over the controller's own recommendation** | A key rename later; one line per locale, no user-visible change |
| R-S12-16 / R-S12-17 | **The narrow capture row is added, behind a new `?details` knob** rather than by changing the shared `selectZoneOnceReady` | A second knob where one might have served. Changing the shared one would have altered L-27's only evidence |
| R-S12-14 | **L-30 is a candidate REUSE, not necessarily an owner mint** — `editor.area.update-corner` exists in both locales. But `OutlinePointsForm` is SHARED with `elementEditPresentation.ts` (R-S11-1), so the fix is not free | If the reuse reads wrong on a multi-corner form, four wrong labels become five differently-wrong ones |
| R-S12-19 | **The `multiSelectionKnob` hazard is STRUCK on a measurement, not carried** | Carrying a refuted item hands the next session a false premise to re-derive, which is this record's most expensive recurring cost |

#### Next executable action

**L-29's write-only prevention predicate** — promoted above BP-04's Action 1 on 2026-09-21,
because L-29 was measured **LIVE and producing wrong money** (330.00 EUR became 163.63 EUR on a
4 m × 3 m room) and because the cheap remedy was attempted and **refused on measurement**, so the
next session starts from a costed design rather than an experiment.

**Site it beside `areaOutline`, as a WRITE-ONLY predicate testing self-intersection and NOT
`overlap`.** That is SDD §26's own prescription — *"prevention at the tool… shown spatially"* —
and every other siting has been measured and refused: the core-level guard in
`createCurvedPolygon` makes existing zones **unreadable** (`loaded=0 refused=1`), silently
decides L-23 under a misleading error code via `invalidEdgeContact`'s `overlap` arm, and
contradicts a test that asserts the current behaviour by name. **Four doors to wire**:
`SelectTool.commit`, `draw-polygon`/`draw-area`, BP-04's `outlineProposal`, and
`elementDraft.acceptsElementPoints`.

**It has a COPY DEPENDENCY and that is the thing to resolve first**: `curve-self-intersection`
falls back to the generic `error.category.geometry` sentence, so a purpose-built refusal needs a
string in both locales and **L-15 forbids agent-minted German**. Either accept the generic
sentence or put the copy in front of the release owner with L-30's.

**Then BP-04's Action 1 — the short interaction specification (L-31).** It is the one outstanding
BP-04 item that can be done from here at all: a writing task needing no owner and no vault.
Reconcile what the three slices actually shipped with the existing design decisions — the 2026-09-12
side panels spec §3 (which already specified this row), ADR-009/`WorldUnit`, the
`editor.area.coordinates-hint` coordinate convention that answers Q-01, and the curve policy in
`preservePointCurves`. With it done, the only thing left between BP-04 and closed is the
Deliverable's real-screenshot clause, which **needs a vault run** and is therefore
owner-acceptance territory beside L-19 and L-21.

**Beside it, and larger: decide L-22, L-23 and L-29 together.** They are one geometry-validation
question, not three patches, and two of them share a remedy site:

- **L-23 is LIVE** — a vertex drag writes a zero-area Zone to the vault, while BP-04's typed
  dialog refuses to save the same shape. Gesture recorded; remedy `enclosesArea` in
  `Zone.withGeometry`.
- **L-29** — a self-intersecting straight outline is refused by nothing at all. **Its gesture is
  UNMEASURED and driving it is the cheap first step**, since that is the one thing separating it
  from L-23's confidence.
- **L-22** — the curved preview/dispatch asymmetry, which the acceptance audit confirmed does
  **not** falsify BP-04's acceptance criterion as written.

**This is not a remainder-task.** The remedy is a behaviour change at a trust boundary: a vault
already holding a zero-area Zone would keep loading but refuse further edits. It needs a recorded
trade, and plausibly an ADR.

Smaller and independent: **L-30**, the "Apply name" button on four forms that are not renaming
anything — possibly a reuse of the existing both-locale `editor.area.update-corner` rather than
an owner mint, but it touches a component shared with `elementEditPresentation.ts`.

### Session 13 — 2026-09-21 — L-29's write side is gated, L-30 closed, BP-04 Action 1 written

Branch `renovation-planner-beta-handoff-e80bb5`, opening tip `0e32fc2dd`, closing tip
`74cfe8647`. `origin/main` at `ed5c50b76`, re-checked at the session start and still an ancestor,
so **no merge was needed and none was made**. Six commits, all pushed, tree clean at the close.
The working ledger with all sixty-one rulings and the cost of each being wrong is
`.superpowers/sdd/01-improvement-plan/s13-ledger.md` (GITIGNORED), and the round reports and
reviews sit beside it as `s13-*-report.md` and `s13-*-review.md`.

Task zero: CI run **35541642468** at the opening tip `0e32fc2dd` — **success**, confirmed with
`gh run list --branch … --json databaseId,status,conclusion,headSha`. Run 35533905571 is
`cancelled` rather than failed, exactly as the handoff describes (`cancel-in-progress` on
`pull_request`).

#### The six commits

- **`e9b982706`** `feat(editor): refuse a self-crossing outline at three write doors` — 6 files,
  +187/-8. `outlineCrosses` and `simpleAreaOutline` in `src/presentation/editor/add/simpleOutline.ts`,
  wired at doors 2, 3 and 4.
- **`7c38db05c`** `feat(editor): refuse a self-crossing corner drag at door 1` — 3 files, +120/-20.
  `crossingFreeOutline`, and `select-tool.ts`'s `commit` taught the gesture kind so a VERTEX drag is
  gated while a BODY drag is not.
- **`78b851ab2`** `fix(editor): stop six surfaces saying "Apply name" to rename nothing` — 6 files,
  7 insertions and 7 deletions. L-30, closed.
- **`0ad89aea3`** `test(editor): pin door 2 wiring and the three claims wider than their checks` —
  4 files, +150/-18, including the new `tests/presentation/editor/polygonOutlineWiring.test.ts`.
- **`3c0e01d21`** `docs(bp04): specify the typed corner route from the code, and date the row it
  replaced` — 2 files, +337, docs only. BP-04 Action 1 and the side-panels `## Amendment 1`.
- **`74cfe8647`** `docs(editor): narrow the ordering claim to two families, and pin the second` —
  4 files, +74/-14, including an appended amendment to the diagnostics-surface issue note.

#### Commands run, and what they returned

- `gh run list --branch … --json databaseId,status,conclusion,headSha` — at task zero and again at
  the close.
- **CI run 35577104683 at `7c38db05c`: success. CI run 35585566311 at `0ad89aea3`: success.** Both
  confirmed by the controller from the run list rather than taken from a report. **`74cfe8647`'s run
  is 35589022563 and was `in_progress` when this section was written — it is NOT recorded as green
  and the next session must confirm it.** `e9b982706`, `78b851ab2` and `3c0e01d21` have **no run of
  their own**: each was pushed together with the commit after it, so their content rode a green head
  rather than earning its own report. Say it that way rather than "all six are green".
- `npm run harness-shot` — **exit 0, captured to a file before any pipe; 121 PNGs; `not the
  Chromium` count ZERO**, so every capture came from the pinned browser.
- Per-round scoped gates only: `npm run check:fast -- <paths>` and scoped `vitest run`. **No full
  `npm run check`, `npm run test:coverage` or `npm run analyze` was run locally at any point this
  session**, by every round's brief and under CLAUDE.md's parallel-work rule — the full gate is
  CI's, on the pull request. Read every coverage or fallow figure in this session's reports as a
  scoped measurement rather than as the gate's verdict.

#### Seven agents refuted their own briefs, and every one of them was right

This is the session's most transferable result, so it is recorded as a pattern rather than as a
list of corrections. In each case the agent was told something by the controller, drove it, and
came back with a measurement instead of compliance.

1. **The doors recon (R-S13-4)** — the predicate as the brief specified it **refuses the collinear
   zero-area triple**, because `circularEdgeIntersections` returns a hit that is an endpoint of one
   edge and interior to the other, which survives the brief's filter. Sited at door 1 that would
   have **silently closed L-23 under a self-intersection error code** — the exact objection that
   killed the core-level fix, one layer down. The acceptance criterion became the case table rather
   than the mechanism.
2. **The predicate round (R-S13-16)** — the brief's door-1 row was wrong **twice**:
   `simpleAreaOutline` is the wrong composition there (it runs `areaOutline` first, so a zero-area
   vertex drag would be refused as `polygon-zero-area`, closing L-23 in the very row that forbids
   it), and `commit` cannot tell a body drag from a vertex drag, so wiring it as briefed would have
   **newly refused a BODY drag of an already-crossing zone** — measured, one gesture became zero.
3. **The door-1 round (R-S13-20)** — case B, which I had carried verbatim from the previous
   report's own §9, **does not collapse the area to zero**; `(2000,1500)` is the midpoint of the
   diagonal and encloses 6 m². The agent did not merely notice it, it measured the consequence: with
   the vertex arm mutated to the wrong function, **B stays green**, so the case as briefed could not
   discriminate. It added B2, which reddens in 11 ms.
4. **The L-30 round (R-S13-33)** — my capture premise was false. The three shots are byte-identical
   before and after, md5-verified, because **they photograph the dialog and not its submit button**.
   Rather than report that and stop, the agent drove `npm run harness` in a real browser at 460x900
   and answered the question I was actually asking.
5. **The L-29 fix round (R-S13-39, R-S13-40)** — invited to check whether doors 3 and 4 shared door
   2's hole, it measured that **they do not** and added nothing, saying so; and it refuted the
   reviewer's suggested cheap fix for door 2 on two counts (**nothing in `tests/` imports
   `registerEditorTools`**, and `ToolManager` exposes no registration listing), which is why the pin
   that landed drives the real mounted editor instead.
6. **BP-04 Action 1 (R-S13-43)** — it refused the coverage figures its own brief handed it. See
   below.
7. **The cleanup round (R-S13-56)** — a sub-claim of mine, that `unreadable-zones` is *"the only row
   in `editorWarnings` with no `actions` array"*, is **false**: `background-missing` and
   `background-unreadable` carry none either. The amendment records the narrower true sentence
   instead of the count.

#### The unrequested review check was the most valuable finding in every round it ran — now five consecutive rounds

- **R-S13-17** — both candidate mechanisms passed all twelve acceptance rows, which the brief did
  not anticipate, so the agent drove them **where they disagree** and found mechanism 1 falsely
  refusing two outlines whose shoelace area is correct at 3 000 000 mm². That is what chose the
  shipped rule.
- **R-S13-24** — the independent review reverted the two registrations the commit is NAMED for and
  **234 tests across 18 files stayed green**. The commit's headline effect was pinned by nothing.
- **R-S13-31** — the door-1 review found the discriminant **fails open**: a third `Gesture` kind
  added later would silently take the ungated arm. Inverting it costs the same line and defaults to
  safe. Taken.
- **R-S13-49, R-S13-50, R-S13-51** — the scoped re-review drove doors 3 and 4 **separately** (1 red
  and 3 reds) where the fix round had driven them together, which is what actually establishes that
  each is independently pinned; checked the new wiring fixture for **vacuity** (`areaOutline` alone
  accepts it, and under the revert the zone count went 1 to 2, so the test proves the close really
  WRITES); and found N-1, below.

It is no longer a habit worth recommending. It belongs in every review brief as a requirement, and
it has now earned five rounds running.

#### A sentence wider than its check regenerated THREE times in one session

- **R-S13-25** — `simpleAreaOutline`'s ordering docblock gave a reason a swap of the two steps
  cannot detect: 182 of 182 stayed green with the order reversed, because the predicate accepts
  every collinear outline by construction. The stated reason could not be the operative one.
- **R-S13-38** — a sentence I flagged as possibly over-strong rather than grading it myself
  (*"No single-vertex drag of the briefed rectangle can reach zero area at all"*) turned out to be
  false, and the fix round found it had **already reached a test file**, describing what that file
  does.
- **R-S13-51** — **the docblock rewritten TO FIX the overclaim was still wider than true**: it
  named exactly one observable family where there are two, since `areaOutline` also raises
  `polygon-area-overflow`. A commit whose whole purpose was to narrow an overclaimed sentence
  introduced a narrower version of the same overclaim. Closed at `74cfe8647`, which named both
  families and **pinned the second**, rejecting the cheaper rule-level wording because that would
  still have been reasoning about which codes reach the both-fail state — the exact shape the
  finding is about.

A fourth instance was caught in DRAFT rather than in the record (R-S13-55): the cleanup agent's
first disclosure paragraph claimed `activateNotices()` stops the notice path throwing, which is
false because every door is a `queue?.push(…)` that no-ops, and it rewrote it unprompted before
committing. The durable lesson is the rate, not any one instance: this defect regenerates under
active attention, including inside the commit written to remove the previous one.

#### Six timeout false-reds, none counted as a failure

Two in the predicate round at **5081 ms and 5551 ms** in files unrelated to the change, green on
re-run (R-S13-23); one the predicate REVIEWER declined to report, a 5098 ms failure in an untouched
file (R-S13-28); two in the L-30 round, green on a re-run of the same two files alone (R-S13-36);
and one 60 s `beforeAll(warmUpEslint)` timeout in `tests/build/lint-scope.test.ts` during the
re-review (R-S13-53). Every one of them is a mechanism CLAUDE.md documents by name — the
`maxWorkers` contention band and the ESLint-boot contention — and **no test was edited for any of
them**. The discipline that makes the reds these rounds DID report believable is the same one: the
re-review's own reported failures all sit in the 10–686 ms band.

#### Two numbers that did not survive contact, and both were handed down rather than measured

- **The handoff's own BP-04 coverage figure (R-S13-43).** The session 13 handoff states BP-04's
  named tests are *"10 covered / 2 partial / 0 absent"* and the controller repeated it in the
  Action 1 brief. The Action 1 agent refused it: `s12-acceptance-audit-report.md:85`'s own Net line
  says **`8 covered, 3 partial, 1 absent`**, and its §1 Net at `:63` says **five of six** acceptance
  criteria are gate-checked while all six are met. **The tracker now carries BOTH readings with
  their dates and their instruments rather than one of them**, because the audit predates session
  12's fix round and the 10/2/0 figure is a derivation from that round that nobody re-ran the audit
  to confirm — see the BP-04 row, where that is written out. The transferable half is unchanged
  either way: **a figure written in prose is a figure nothing re-runs**, and this one was repeated
  across three documents before anyone opened the report it came from.
- **A re-review number that does not reproduce (R-S13-58).** The scoped re-review records
  `simpleOutline.test.ts` at **146 of 450** lines; measured on the byte-identical `git show HEAD:`
  copy it is **159**, and 160 after the cleanup round's single added fixture row. Two agents, two
  counts, and the later one names its instrument. Do not carry the first forward.

#### The captures were taken AND LOOKED AT, and looking produced three things no agent reported

`npm run harness-shot`: exit 0, 121 PNGs, `not the Chromium` count zero.

- **The affordance finding is real and SHARPER than session 12 recorded it (R-S13-59).** Session 12
  wrote *"Edit corners has the weakest affordance"*. Opening `plan-editor-selected-narrow.png`
  directly shows something more specific: the Details panel runs **four actions in three different
  treatments** — `Rename room` bare text with no chevron, **`Change room size` a filled primary
  button at full width**, `Edit corners` bare text with no chevron, `More actions` bare text **with
  a chevron**. So the honest sentence is not "Edit corners is weakest" but **"two of the four
  actions carry no affordance marking at all and read as static labels"**, and it is the chevron on
  `More actions` that makes their bareness legible as a gap. For BP-05 and BP-07, not for BP-04.
- **L-32 is confirmed by eye (R-S13-60).** `plan-editor-outline-narrow.png` is cut off
  **mid-Corner-3**: hint, five-row chooser list, fieldsets for corners 1 and 2 and a clipped 3.
  Corners 4 and 5 and the whole Save/Cancel row are below the fold. **The submit button genuinely
  appears in no capture this repository holds.**
- **The coordinate-hint nit is worse than "EN differs from DE" (R-S13-61).** Visible in that same
  frame: the hint reads *"with X increasing to the right and **y** downwards"* while the chooser
  rows beneath it read `Corner 1: X 0 m, Y 3.2 m` and every fieldset legend reads `X position (m)`
  and `Y position (m)`. **It is the only lowercase axis letter in a frame that shows an uppercase
  `Y` eleven times** — a stronger reason to fix it than the cross-locale comparison, and the kind of
  thing only looking produces. L-26's three-times redundancy is also plainly visible and exactly as
  recorded.

#### Not done, and not claimed

- **Nothing has been run in an Obsidian vault.** No native, device, screen-reader, contrast or
  performance verification was performed or is claimed by anyone this session. A harness capture is
  a browser render, not a vault run.
- **No full `npm run check` was run locally.** Coverage floors, `eslint .` and fallow are CI's
  report on the pull request, and `74cfe8647`'s CI run was still in flight at the close.
- **L-29 is NARROWED, not closed** — the asset designer's own doors are ungated, SDD §26's "shown
  spatially" clause is satisfied by nothing, and no detection, migration or diagnostic exists for
  crossing outlines already in vaults, so a Requirement figure derived from one is still wrong and
  still silent.
- **L-23 was deliberately left open** and is an owner decision, not a remainder task. The predicate
  accepts the collinear zero-area triple precisely so that it is not decided by accident.
- **L-33 is recorded and not fixed**, and this session's own predicate is what made it worse.
- **The diagnostics-surface inversion is recorded and not built** (R-S13-57): the id and callback
  are mechanical, but `showDiagnosticsReport` lives in `src/plugin/` and `presentation/` may not
  reach it, so it is slice-shaped.
- **The `FormSubmitRow` convergence is costed and not taken** — 29 files and 30 buttons against 3
  adopters, `RoomNameForm` unable to adopt at all, zero tests moving.
- L-17, L-18, L-22, L-25, L-26, L-27 untouched. The five BP-03 unload rows remain deliberately
  unwritten. `05-owner-decisions.md` untouched, as every handoff has required.
- **No owner question was decided or absorbed.** G1 stays blocked on L-06, L-19 and L-21.

#### Rulings

| Id | Ruling | Cost if wrong |
|---|---|---|
| R-S13-1 / R-S13-7 | **Ship `polygon-self-intersection` with NO locale entry**, inheriting `error.category.geometry` exactly as `areaOutline`'s own `polygon-zero-area` already does. Reuse of an existing both-locale key was measured and refuted — all three candidates name walls or a different boundary | A user who crosses an outline reads *"A geometry value is invalid."* rather than a sentence naming the crossing. Vaguer than ideal, identical to what the adjacent refusal on the same door says today, and no German is minted so **L-15 never engaged** |
| R-S13-4 | **The predicate MUST accept the collinear zero-area triple**, so that L-23 is not closed by accident under the wrong error code. The acceptance criterion is the case table, not the mechanism | Shipping a second behaviour change riding in on the first — an owner decision deferred twice, taken by accident, invisible in the error text |
| R-S13-5 | **A separate function beside `areaOutline`, not a check inside it** — a check inside would land in `areaTask.ts:36`'s reactive enablement, making self-intersection the one refusal with no sentence at all. **The perf half of that argument is UNMEASURED and is not what it rests on**; R-S13-26 later refuted the hot-path reasoning while the conclusion survived | One more module than strictly needed and three composition sites instead of zero. Cheap and visible, against a silent refusal |
| R-S13-6 | **SDD §26's "shown spatially" clause is NOT satisfied by this slice**, and nothing in the code or the tracker may claim it | L-29 reads as closed when §26's own words are still unmet. Guarded by saying so in the tracker, in the module docblock and in the report |
| R-S13-18 | **Door 1 is wired**, because without it the slice does not touch L-29's own reproduction — the corner drag that produced 330.00 EUR becoming 163.63 EUR | A signature change to a function with one call site. Guarded by the body-drag regression case becoming permanent |
| R-S13-22 | **L-29 is NARROWED, not closed, and the tracker says exactly that** | A row that reads closed while the designer doors, §26's spatial clause and every vault-resident crossing outline are untouched |
| R-S13-43 | **The BP-04 coverage figure is recorded with BOTH readings and their instruments**, rather than one being picked, because the audit predates the fix round and the later figure is a derivation nobody re-ran | BP-04 recorded as better- or worse-tested than it is, in the row that decides whether the package closes. The cheap settlement is to re-run the audit |
| R-S13-45 | **The Action 1 spec lives in `docs/superpowers/specs/`**, because the editor-specs directory is a locked mockup-sourced screen set and this one has none of that source, while `superpowers/specs/` already uses `## Amendment N` as its correction convention | A specification filed where its neighbours have a provenance it does not share |
| R-S13-57 | **The diagnostics-surface inversion is slice-shaped and was correctly declined** — `showDiagnosticsReport` is in `src/plugin/` and `presentation/` may not reach it | A layer crossing taken inside a cleanup round, where it would get a cleanup round's review |

#### Next executable action

**L-33 — the one refusal sentence that answers three different causes.** `OutlinePointsForm.vue:150`
renders `editor.resize.invalid` — *"Enter valid dimensions that can describe this room."* — for an
invalid coordinate, a zero area, and **since `e9b982706` a self-crossing outline as well**. It is
the strongest candidate on three counts: it is measured rather than suspected, it is small, and
**this session's own predicate made it worse**, so it is a debt this session created rather than one
it merely found. It is a **copy decision rather than a substitution** — three distinct causes share
one sentence, so the honest fix is either a code-to-copy mapping or a genuinely generic both-locale
sentence, and which of those is taken decides whether an owner is needed at all. Beside it, at one
line: `editor.area.coordinates-hint`'s lowercase `y` (R-S13-61).

**Named as alternatives, not as the action.** The **diagnostics-surface inversion** is now costed as
**slice-shaped rather than cleanup-shaped** (R-S13-57) — the composition root must inject a callback
because `presentation/` may not reach `src/plugin/`'s `showDiagnosticsReport`. And **L-23 remains an
owner decision and is explicitly NOT a remainder task**; session 13's predicate left it open on
purpose.

**Also outstanding and small:** confirm CI run **35589022563** at `74cfe8647`, which was still in
progress when this section was written.

**BP-04:** Action 1 is done, Actions 2–6 were already satisfied, and **only the Deliverable's
real-screenshot clause now stands between the package and closed** — it needs a vault run and is
owner-acceptance territory beside L-19 and L-21. **L-32 is the reason a capture cannot substitute
for it in the one place it might have**: no picture here has ever shown a dialog's actions row.

### Session 18 — 2026-09-23 — a red CI caught and fixed, BP-06's page-2 slice, BP-05's matrix, and BP-08's driver found not runnable

**Task zero: CI was RED.** Run `35840321128` at `d5ad8c1d7`, the first full `npm run check` over `20ff37f29` (L-43's guard), failed on all four verify legs, with audit passing, on one deterministic test: `tests/build/libraryComponentStyles.test.ts` › "names no class nothing styles, beyond the two documented exemptions" → `expected [ 'rp-mobile-notice' ] to deeply equal []`. The guard had given the Asset Library's notice the rule-less test-hook class that `ViewRoot.vue` uses, and that check refuses such a class under `src/presentation/{library,components,designer}/`. Session 17's narrowed `check:fast` runs never included `tests/build/`. `a420b677a` hooks the notice by `data-rp-notice="mobile-read-only"` instead; the check, its two pinned exemptions and `ViewRoot.vue` are unchanged. It was watched red on the unchanged tree with CI's exact message and green after, and forcing `readOnly` to `false` reddens 3 of 5 mobile tests. CI run `35852241674` at `5e7a7dbf2` is green on all five jobs, `analyze` included.

**BP-06's smallest slice, and the premise it corrected.** The prompt's "add a multi-page PDF to the fixture generator" was the wrong premise: `npm run background-fixture` draws only the PNG, and the committed PDF is a printer-driver artifact with no generator. A synthesiser did exist, `pdfFixture()` in `tests/helpers/backgroundFixtures.ts`, and the controller ruled to extend it rather than build a script or commit a second binary. `e85991d70`, `71d5bca43` and `5e7a7dbf2`: `pdfFixture` takes a page list, and its no-argument output is pinned by SHA-256, which the final review recomputed from `d5ad8c1d7`'s source. `tests/presentation/editor/referenceMultiPage.e2e.test.ts` chooses page 2 in the real reference form with `loadBackground` passing through, asserts that the decoded raster is page 2's 600×300 with its red pixel where page 1 is 400×200 and blue, asserts that the committed `background.page` is 2, and decodes page 2 again on a fresh mount. A second case loads page 2 and then page 3, and asserts the failure sentence and that no stale preview remains. Review: Spec ✅. Its Important finding, `npx fallow dead-code` red on a private-type leak that the brief had not let the implementer run, was fixed by exporting `PdfFixturePage`. **What this proves and what it cannot:** the page chosen in the form reaches pdf.js and that page is decoded, under the suite's `pdfjs-dist`. It says nothing of Obsidian's copy or of a real multi-page file. Found and left open: nothing in `src/` reads a PDF's page count, and no case fails a page over a committed reference (A04).

**BP-05: the capability matrix.** `5240cc4af`, narrowed at `872cb197a`: `docs/releases/first-beta-readiness/10-interaction-capability-matrix.md`, the plan's ten actions across 21 geometry types. Review: Spec ❌ on three Important findings: a vacuous Cancel citation, six Undo-only cells printed as Tested, and the owner question stated wider than the code, which the controller's own brief had written that way. The fix round downgraded or narrowed every one and widened no cell: 105 Tested, 100 Implemented-untested and 5 Unsupported, with 98 cited title pairs found present by a script and none missing. The controller accepted the fix by reading its word-diff in context. **The owner question stays open, narrowed:** only the NO-OP half of "rejected/no-op operations do not add history" contradicts `CommandHistory.runNow`, because a rejected command is never pushed. The register's BP-05 row now says so. `c70a0fb54` deletes the library's old selector from the mobile PBI.

**The harness-shot cap.** `a6f4508be` moves the per-surface shot pins out of `tests/build/harness-shot.test.ts`, which stood at exactly its cap of 450 counted lines, into `tests/build/harness-shot-surfaces.test.ts`, byte-identical: 47 cases and 69 runtime tests before and after, and 318 counted lines left. `c3443a32b` and `fdea34eb4` delete or name three positional pointers that did not resolve.

**BP-08: nothing measured, and the reason found.** The pinned Chromium 1234 resolved with no override. `node scripts/editor-recovery-check.mjs` exited 1 after 62 s inside its planning journey. `da7b9829f` adds `--performance-only` to reach `largeFloor()` alone; that run exited 1 after 31 s inside `largeFloor()` itself (L-44). No timing exists for this tree, and none is claimed. `fdea34eb4` narrows that mode's comment to what was measured and marks its report. The driver's log also showed L-45.

**Commands, with exit codes captured before any pipe:** `gh run view 35840321128` → failure (four verify legs, one test). `npx vitest run tests/build/libraryComponentStyles.test.ts` → red on the unchanged tree, 11/11 after. `npm run check:fast` over the BP-06 files → 94/94, exit 0. `npm run check:fast -- tests/build` → 47 files, 1282 tests, exit 0, after the extraction. `npx fallow dead-code` → exit 0 after the export. `gh run view 35852241674` → success, five jobs. Several local `check:fast` runs went red on TIMEOUTS alone, with no assertion failing, while other sessions held the machine at up to 79% CPU. Each re-ran green alone, except `tests/build/lint-edited.test.ts`, which passed in a later run and in CI.

**Reviews:** four task reviews and a final whole-branch review, each an independent seat. The final review returned Spec/plan ✅ with three Minors, one to fix before merge; all three are fixed at `fdea34eb4`. The controller fixed none itself.

**Upstream merge.** At close-out, `origin/main` had moved to `914fdaff3`, 16 commits including the reference-image rotation handle in `ReferenceSetupForm.vue`, which this session's page-2 test drives. It was merged, not rebased, at `d2dc9568f`, and the one overlapping file merged cleanly. After the merge, `npx vitest run` over the five reference test files and the two files the CI fix touched gave 105 of 106 passing. The failure was a 5-second timeout in `referenceMultiPage.e2e.test.ts` on a loaded machine. That file re-run alone passed 2 of 2, but its test time was 4.6 s against the 5 s budget, so it is close. The installed `node_modules` predates the upstream dependency bumps, so only CI has run the merged tree against the locked versions.

**Not done, and not claimed:** nothing has run in a vault or on a device. No performance number exists. No screen reader, contrast or native check was performed.

#### Next executable action

**BP-08: repair `largeFloor()`'s path (L-44).** Its STOP-ZERO first establishes whether the 80 room rows are meant to be 80 tab stops, a BP-07 design question, before `tabTo` or the list changes. Then three `--performance-only` runs at a named commit, recorded as harness numbers beside both target sets and judged against neither. **Owner questions still open:** BP-05's no-op clause, BP-08's targets, BP-10's copy, L-37, L-36, L-33's residue and L-23, plus G1's L-06, L-19 and L-21. **Nothing on this branch has been run in a vault or on a device.**

### Session 17 — 2026-09-23 — L-42 closed, and the row that opened it corrected

**Branch** `renovation-planner-beta-handoff-e80bb5`, tip `5bd7eb9cd` at open, `53c148de4` for code at close. `origin/main` re-checked at `ed5c50b76`, still an ancestor, so nothing was merged or rebased. Draft PR [#231](https://github.com/Luis85/renovation-planner/pull/231): not marked ready, no auto-merge, no reviewers.

**Nothing in this session was run in an Obsidian vault, and no screen reader was pointed at anything.** No capture was taken, because none can show this notice (see below).

#### Task zero

CI run `35736846356` at `5bd7eb9cd` (session 16's tracker commit) completed `success` on all five jobs, matched by `headSha` via `gh run list --branch`. `gh run list --commit` with a short SHA returned `[]`; it needs the full SHA. That was not a missing run.

#### A STOP fired on this tracker's own row

L-42's row said nothing in `tests/` asserted the paste notice. **False.** `tests/presentation/editor/usability/i12-clipboard-feedback.test.ts` asserted it with four `toContain` fragments. Each one is true of the glued string, so none could fail on the defect. That is L-41's hollow shape in another file. The AST census that closed the category read `src/` only, so the row's sentence reached further than its check. **The red was still available**: one exact `toBe` replaces the four.

#### What was decided, and against what reading

| shape | before | after |
|---|---|---|
| several rows (room + 4 walls) | `Pasted into Ground floor. Rooms: 1 · Walls: 4 Work, materials, …` | `Pasted into Ground floor. Work, materials, costs and evidence stay with the original. Use undo to reverse this paste. Rooms: 1 · Walls: 4` |
| one row (a lone placement) | `Pasted into Ground floor. Objects: 1 Work, materials, …` | `… Use undo to reverse this paste. Objects: 1` |
| none | unreachable, see below | unreachable |

The "before" strings are the received values from the two watched reds. **L-41's period does not carry over**: L-41 put a period after a NAME, and here it would follow a DIGIT. In German `Wände: 4. Arbeit` is ordinal notation, and the text reaches a live region. The German voice risk is plausible but not measured here, so the chosen remedy needs no punctuation after a count at all. English reads marginally better with the period, and that is the price. **The empty summary is unreachable**: `captureClipboard` returns `null` unless `groupPivot` receives a point, every point comes from a captured room, wall or element that `clipboardSummary` counts, and `copy()` is the one `src/` writer of the shared clipboard. So there is no guard, since an unreachable one costs a branch it cannot pay back.

#### Commands run, and their outcomes

| command | outcome |
|---|---|
| `gh run view 35736846356` (task zero) | success, five jobs |
| watched red, i12 and `clipboard.test.ts` on unchanged source | both exit 1, received strings recorded above |
| `npm run check:fast -- tests/presentation/editor/usability tests/presentation/editor/clipboard.test.ts` | exit 0, 21 files, 69 tests. A NARROWED run, not a superset |
| `npx eslint` / `npx oxlint --deny-warnings` on the three changed files | exit 0 / exit 0 |
| order reverted (implementer, and independently the reviewer on a scratch copy) | 2 failed, 12 passed; restored to 14 passed |
| reviewer's fold probe, scratch config outside the tree | a repeated paste renders `… Walls: 4 (×2)` in toast and live region; `Notice.shown` holds one entry |
| CI `35790576648` at `53c148de4` | **success, all five jobs**, which is the authoritative verdict |

**Not run locally:** `npm run check`, `test:coverage`, `npm run analyze`, `npm run build`, `npm run test-build`, any capture, any vault run.

#### Reviews

Implementer DONE, no STOP. Independent review: **Spec ✅, Quality changes requested**, with one Important and three Minor findings. **Important 1 was real and is ACCEPTED rather than fixed**: the queue's ` (×N)` repeat fold now follows the last count. Changing `textOf` changes every notice's repeat rendering, which makes it a mechanism change. Two of the three readings of `Walls: 4 (×2)` are true of what happened. It is recorded on L-42's row. The commit message had claimed that nothing follows a count, and that claim was **deleted rather than corrected** before push. The three Minors were message-level: a separator typed `' - '`, "double space" where the reordered edge would be a trailing space, and the co-author trailer. A message-only amend fixed them (`95778926c` → `53c148de4`, empty diff between them, never pushed before the amend). The re-review Approved it. The controller found one more Minor and recorded it without fixing it: the body says "selected" where boundary and host walls are "captured".

#### Rulings

The rulings are R-S17-0 … R-S17-8 in the session ledger, each with its cost if wrong. The two that carry weight: **R-S17-3** (tally last rather than a period; if wrong, the counts sit less prominently at the end of a toast, which is cosmetic and a one-line reorder) and **R-S17-6** (accept the fold residue; if wrong, a user may misread a repeated paste's last count, with no data consequence, and `textOf` is one line if an owner rules otherwise). **Neither optional item was taken.** L-38's residue is decidable only in a vault. L-40 is a harness-fixture increment of its own, and it is now the next action.

#### What is implemented but unverified

The German rendering is asserted by nothing. No screen reader has heard either the old or the new announcement. The toast has never been seen: the harness CSS declares no `.notice` rule, and no knob raises a paste.

#### Next executable action

**L-40**: a harness fixture that can reach `ProjectWorkState.vue`'s schedule surface, so the third diagnostics button can be photographed. Four locks stand in the way, all listed on L-40's row. **An alternative, unmeasured**: extend the session-16 AST census to `tests/`, looking for `toContain` fragments over joined user-visible text. This session found one by grep, and nobody has measured whether it was the last. **L-37, L-33's residue and L-36 remain OWNER questions.** **BP-04 is unchanged.** **G1 stays blocked on L-06, L-19 and L-21.**

#### Continued — L-40 closed, and the package register reviewed at the owner's request

**L-40** landed at `f0c1af9e3`, with two docblock follow-ups at `9533c4e2b` and `8ab18c0bb`. The harness now reaches the schedule section over the real `projectWorkServices`, and the count comes from a real refused read. Review: **Spec ✅, Quality Approved**. Two of its Minors were prose wider than a check: a member count, and an `origin` clause nothing drives. Both were deleted, **and that deletion left the next paragraph's `it` pointing at nothing**, which is the seventh generation of the pattern. The controller caught it by reading the diff in context, not by any check. CI `35797680970` passed on all five jobs.

**The pinned browser had gone, and is restored.** `playwright-core@1.62.1` pins Chromium 1234, and the shared cache held only 1223. The implementer's STOP fired correctly and it refused to hunt. The controller took **approximate** captures through the documented `RP_CHROMIUM_EXECUTABLE` door, which printed its caveat. What they show is on L-40's row. Restoring 1234 is session 10's recorded remedy, a CDN download to `D:\dev-cache\playwright\chromium-1234\`. That writes outside this worktree, so it was asked of the user first, and the user said yes. The build was downloaded from that URL (201,068,834 bytes, archive test clean) and extracted there; `chrome.exe` reports 151.0.7922.34, the version `playwright-core`'s `browsers.json` pins. With no override set, `npm run harness-shot` exited 0, wrote 127 PNGs and printed no not-the-pinned-browser line.

**The package register was reviewed and rewritten as current statements.** Three read-only lanes reviewed the packages: A (BP-00…04), B (BP-05…10), and C (BP-11…15 plus the gates). One writer applied their findings at `7cbf2bc4e`. After review (1 Important, 7 Minor), a fix round landed at `2d69b43ed`. After re-review (Approved, 5 Minor), three clauses wider than their evidence were deleted at `40c799b56`. What the review found:

| finding | outcome |
|---|---|
| BP-02's row listed L-16 as open and said G1 was blocked on it; L-16 closed 2026-09-18 | corrected in BP-02, G1, L-13 and L-01 |
| **On mobile, the Asset Library creates, edits and deletes assets** — no guard on `.rp-al-create` or on `open-asset-library`, while the beta scope says mobile read-only | new row **L-43**, an OWNER decision and a P0 candidate; each "mobile read-only" statement now points at it, and the stated scope is unchanged |
| BP-05's "no-op operations add no history" contradicts a finished PBI that withdrew it | recorded as an owner question in BP-05 and `05-owner-decisions.md` |
| BP-06's multi-page PDF test cannot be met with the committed one-page fixture | BP-06's next action |
| BP-08: a mixed-scene browser driver exists that no release document referenced | BP-08's evidence |
| BP-11 credited a recovery-guide fix to the wrong commits | re-cited to the commits that made it |
| `05-owner-decisions.md` counted its questions and predated L-23, L-36 and L-37 | count deleted; a section now lists the other open owner questions |

**Two lane findings were half wrong, and one reviewer finding refuted the consolidation.** Lane C's BP-11 finding was a miscitation, not a falsehood. Lane C also judged G1's row correct partly from BP-02's stale L-16 claim, which lane A had shown was wrong. And the consolidation cut L-16's cited range down to a single SHA: `38d5292f5`, a wip commit that does not touch the file it was credited with. That made the claim narrower than its evidence, the mirror image of the usual overclaim.

**Not done, and not claimed:** no vault run, no device run, no screen reader. The mobile finding was checked by reading source only. `npm run check` was not run locally; CI is the gate.

#### Next executable action

**First, an owner decision: L-43.** Either guard the Asset Library on mobile, or narrow the beta's mobile claim. **The next action executable here without an owner is BP-06's smallest slice**: a multi-page synthetic PDF in the fixture generator, plus one test that chooses a page other than the first and commits it as a reference. **L-37, L-33's residue, L-36 and BP-05's no-op clause remain owner questions. G1 stays blocked on L-06, L-19 and L-21.**

#### Continued — L-43 decided by the owner, and guarded

**The owner decided L-43 on 2026-09-23: "guard the asset library on mobile."** The beta's mobile-read-only scope therefore stands, and the tree was brought to it. The controller's scoping of the decision: the library stays READABLE on mobile (the PBI's extension 4a), so its command and the project view's Assets button stay enabled. Its write controls are disabled and described by the existing `view.mobile.read-only` sentence, so no new copy was written and L-15 was never engaged.

**`20ff37f29`** takes `Platform.isMobile` once, at `AssetLibraryView`'s `provide`, the way `RenovationProjectView` does. The write controls render disabled and described, and their handlers refuse. `tests/presentation/library/assetLibraryMobile.test.ts` spies on the command services, enumerated generically so a later command is covered too. **It went red on the unchanged source**: on mobile the driver reached `createAsset`, `deleteAsset`, `setAssetFootprintFromDimensions` and `updateAsset`. A desktop run of the same gestures is its positive control. Independent review: **Spec ✅, Quality Approved.** The controller doubted by eye whether **New asset** looked disabled in the phone capture. The reviewer MEASURED it: `opacity: 0.7`, `cursor: not-allowed`, and a darkest text pixel identical to Save's. The doubt was wrong; the white search field beside it made the button look darker.

**Documentation followed in four rounds, and two of them corrected the round before.** `45b797d18` recorded the guard in the PBI. `511373e90` deleted two claims no check covers: that a device case covers the library, and that two links stay live. **That fix introduced the next false sentence**: the manual case then said the library's writes "are not guarded here". `19197b9ed` reworded it to say the case does not check them on a device. That is the ninth generation of the pattern, caught by the controller reading the result in context. `5fd4db598` moved every release-document statement of L-43 to decided and guarded, and `54692eadc` narrowed four of its sentences to their evidence: a count, an enumeration, a "reaches them" and a jsdom-only reading.

**Residue, recorded on L-43's row:** nothing has run on a device. The read-only text fields have no visual refused state. Discard stays live on mobile but cannot act there. The mobile notice fails contrast at 2.73:1 in the light theme; that predates this work and ships on the project view too, so it is for BP-07. `tests/build/harness-shot.test.ts` sits at exactly its 450-line cap, so the next shot needs an extraction first.

#### Next executable action

**BP-06's smallest slice**: a multi-page synthetic PDF in the fixture generator, plus one test that chooses a page other than the first and commits it as a reference. The committed PDF fixture has one page. **Owner questions still open:** BP-05's no-op clause, L-37, L-36, L-33's residue and L-23, plus G1's L-06, L-19 and L-21. **Nothing on this branch has been run in a vault or on a device.**

### Session 16 — 2026-09-21 — L-38 and L-39 closed, and two claims refuted by re-measuring them, then L-41 and the category measured closed

**Branch** `renovation-planner-beta-handoff-e80bb5`, tip `19d573c83` at open, `9db5fc7f8` at close.
`origin/main` re-checked at `ed5c50b76` and still an ancestor, so nothing was merged or rebased.
Draft PR [#231](https://github.com/Luis85/renovation-planner/pull/231) — not marked ready, no
auto-merge, no reviewers.

**Nothing in this session has been run in an Obsidian vault.** Every rendered figure below is a
browser render through `npm run harness` or `npm run harness-shot`. No native, device,
screen-reader, contrast or performance verification was performed or is claimed.

#### Task zero — the run that had to be checked rather than assumed

`gh run view 35646136247` at open: **`in_progress`**, not complete — `audit` green, four `verify`
legs running. The handoff had it as "still in flight", and it still was. Re-checked through the
session and it **completed `success` on all five jobs**. Nothing was pushed on top of it until it
had completed, and no run was cancelled.

#### What was measured before any brief was written

The task said to establish what each of the five Floor Inspector stat rows renders before scoping,
and **that STOP fired on the tracker's own L-38 row**. Driven by the controller in a browser at
`?view=plan-editor&unreadable=2&theme=light` and again with `&lang=de`, reading the five
`[data-rp-stat]` nodes out of the live DOM:

| row | EN, live, before | state |
|---|---|---|
| Rooms | `1 2 could not be read` | partial — collides |
| Areas | `1 2 could not be read` | partial — collides |
| Total area | `45.6 m² 2 could not be read` | partial — run-on only |
| Planned changes | `0 2 could not be read` | partial — collides |
| Estimated cost | `Not available yet` | **unavailable, always** |

German identical in shape at every row. The row said `Total area` and `Estimated cost` "carry a
unit or a word"; true of the first, and **false as a description of the second** —
`spatialRecords.ts` hard-wires `estimatedCost` to `unavailable`, typed `Aggregate<never>`, so it
can never reach the partial branch. **Four rows, not five.** `ReviewSummary.vue` renders the same
string standalone in its own paragraph and was ruled the correct precedent rather than a second
instance. The `--partial` `::after` marker — a space and an asterisk, orange — was also found and
is named in no earlier record.

L-39's premise was likewise re-measured rather than taken: `eslint . --max-warnings 0` exit **1**,
24 problems, **all four files under `.superpowers/`** (the report grepped for absolute paths, so
that list is the whole report and not a sample); `git ls-files .superpowers` **0**;
`npx oxlint --deny-warnings` exit **0** with zero bytes, and `npx oxlint .superpowers` answering
`No files found to lint` although `.superpowers` is absent from its `ignorePatterns` — so oxlint
excludes it by reading `.gitignore` and only ESLint needed the entry.

#### Commands run, and their outcomes

| command | outcome |
|---|---|
| `gh run view 35646136247` | `in_progress` at open, `success` on all five jobs at close |
| `npx eslint . --max-warnings 0` (before) | exit **1**, 24 problems, four files, all under `.superpowers/` |
| `npx eslint . --max-warnings 0` (after `9db5fc7f8`) | exit **0**, zero bytes |
| `npx oxlint --deny-warnings` | exit **0**, zero bytes, before and after |
| `npm run lint` (the gate L-39 is about) | exit **0** |
| `npm run check:fast -- tests/presentation/editor` | exit **0**, 403 files / 3259 tests |
| `npm run check:fast -- tests/build` | exit **0**, 46 files / 1281 tests |
| `npm run harness-shot` | exit **0**, 125 PNGs, pinned Chromium resolved, **no substitute named** |
| `s14-tablecheck.mjs` | 5/5 fixtures, 41 L- rows, `{"6":41}`, uniform OK |
| `git push` | `19d573c83..9db5fc7f8`, CI run **35652038937** — **completed `success` on all five jobs** |

**Not run this session, named rather than left silent:** `npm run check` in full, `npm run build`,
`test:coverage` and its floors, `npm run analyze`, `npm run test-build`, and any vault run. CI on
the pull request is the report, per the standing workflow.

#### What shipped

- **`13cd46975` — L-38.** One line in `FloorInspector.vue`'s `textFor`: the annotation is
  bracketed rather than spaced. No docblock or comment added, so the change introduced no new
  sentence to overclaim. The test that should have caught the defect asserted `toContain('2')` —
  green either way, because the annotation's own first character is that digit — and now pins the
  exact rendered string on a bare-count row and on the unit-carrying one, **watched failing on the
  old glue first**.
- **`9db5fc7f8` — L-39.** One entry and a mechanism-only comment in `eslint.config.mjs`.
  `.oxlintrc.json` byte-unchanged, and `lint-scope.test.ts` deliberately unedited.

#### Three claims re-measured, and two of them refuted

**A costing is a hypothesis, including the reviewer's and including the controller's own.**

1. **"The path argument did not narrow the vitest run"** (implementer) — **refuted.**
   `find tests/presentation/editor -name '*.test.ts'` is **403**; `find tests -name '*.test.ts'`
   is **1047**. The run reported 403, which is exactly the narrowed directory, not a superset.
   CLAUDE.md's "362 files" and `vitest.config.ts`'s "461 of 461" are dated snapshots the guide
   itself says to re-measure. **Consequence:** nothing outside `tests/presentation/editor` was
   exercised locally, which is why the full gate runs in CI.
2. **"Every candidate separator costs the same two characters"** (implementer) — **refuted.**
   `measureText` against the real 137px column: text alone is 130.86px with parentheses and
   125.8px with a comma, and the marker is 8.98px — so a comma fits and parentheses do not.
   **The parentheses ruling nevertheless stands, on semantics**: `1, 2 could not be read` reads as
   a list, which substitutes one wrong reading for another rather than fixing it.
3. **"A non-breaking space does not help, as does `white-space: nowrap`"** (reviewer) —
   **half refuted.** Injected each rule and read the height back: baseline 37.7px, nbsp 37.7px,
   thin space 37.7px, **`nowrap` 18.8px**, **marker without its leading space 18.8px**. The review
   is right about nbsp, wrong about `nowrap`, and did not test the actual proposal. **The remedy
   is still not taken**, and the reason changed from scope to arithmetic: dropping the leading
   space wins by **0.72px**, which is inside the noise for a font this harness resolved to
   fallbacks.

#### The captures, taken and looked at

The review's unasked check found the one thing the session had left undone: `harness-shot.mjs`
declares `plan-editor-unreadable` and `plan-editor-unreadable-narrow`, aimed at exactly this URL,
and neither had been run. The pinned Chromium resolved from disk, so these are the pinned
browser's pictures and carry no approximation caveat.

- **`harness-shots/plan-editor-unreadable.png`** shows the fix and the residue: the orange marker
  alone on a second line under three right-aligned values. **Looked at by the controller**, and it
  is what settled "ship it" — a footnote marker hanging below a figure, plainly better than two
  digits reading as one.
- **`harness-shots/plan-editor-unreadable-narrow.png` does not show the Floor Inspector at all.**
  At 460 the shell is constrained and the Details overlay is closed, so that shot photographs the
  warning strip and its button, which is what its own comment says it is for. Recorded because the
  opposite is the natural assumption from the name.

#### A controller defect, made and caught

The controller ran all four `s14-*.mjs` helpers to "test the instrument", treating the set as
read-only because one of them is. **`s14-rows.mjs` is a WRITER**: it exited 0 and re-appended
session 14's stale L-34, L-35 and L-36 rows to this tracker as duplicates beside session 15's
updated ones. Caught by the next `git status`, inspected as a diff, reverted by explicit path, and
the table re-verified identical. *"Test your instrument before you believe its count" assumes the
instrument only reads.* **`s14-tablecheck.mjs` is the only read-only one of the four.**

#### Findings recorded rather than absorbed

- **L-41 is new**, from the controller's own unasked check and independently rediscovered by the
  implementer's census: two sites glue `editor.input.current-target` to a full sentence with a
  bare space, and one of them is a `role="status"` live region, so a screen reader hears the
  run-on. Verified live, not reasoned from source. Not fixed — a different collision at two sites.
- **A latent exposure, deliberately not fixed:** ESLint reads no `.gitignore` at all, and
  `harness-shots/` is gitignored and absent from `ignores`, clean only because nothing emits a
  linted extension there. All 2286 post-fix linted paths were fed to `git check-ignore --stdin`
  and **zero** gitignored files remain in ESLint's set today.
- **L-38's residue** — the orphaned marker — is on L-38's own row with its measurement, its
  one-character remedy and the reason the remedy is not taken.

#### What is implemented but unverified

Both commits are **CI-green**: run **35652038937** at `9db5fc7f8` completed `success` on all five jobs, so `npm run check` passed on all four verify legs. The
L-38 residue's behaviour in a real vault is unknown in both directions, because the 0.72px margin
that decides it is font-dependent and this harness resolved fallback fonts. **L-19, L-21, L-06 and
BP-04's real-screenshot clause all still need a vault run and none was performed.**

#### Next executable action

**L-41 — the run-on sentence a screen reader announces.** It is the same shape as the item this
session just closed and inherits its whole argument: MEASURED live rather than suspected, a LIVE
product defect rather than a harness artifact, and **the remedy is punctuation in code, so it
mints no word and L-15 does not gate it** — which is what makes it movable where L-37, L-33's
residue and L-36 are not. It is two call sites and one character each. **Check first whether the
two sites should share a helper or stay separate**: they are byte-identical expressions in two
files, which R-S15-8's measurement released for exactly the two-identical-sites case, but the
surfaces differ — one is a visually hidden live region and the other a `title` tooltip — so that
is a decision to take with a measurement rather than by pattern. **And note what no instrument can
do here: the live region is `rp-visually-hidden`, so no capture in this repository can show the
fix**, which makes the exact-string unit assertion the only evidence there will be.

**Two alternatives, named as alternatives and not as the action.** (1) **L-38's residue** — the
orphaned `::after` marker, whose one-character remedy is measured and whose 0.72px margin is the
reason it was not taken; it becomes decidable the moment anyone runs this surface in a vault.
(2) **L-40** — the third diagnostics button is still reachable by no harness knob; closing it is a
harness fixture that can reach the schedule surface, which is its own increment.

**L-37, L-33's residue and L-36 remain OWNER questions and are NOT remainder tasks.** **BP-04 is
unchanged** and still closable against its Acceptance sentence with only the real-screenshot
clause outstanding. **G1 stays blocked on L-06, L-19 and L-21.**


#### Continued — 2026-09-22 — L-41 closed, and the category measured closed at four

**Tip `0f5e0e4f6`.** CI **35730335714** at `ee7d4b3ff` completed `success` on all five jobs, so
`npm run check` passed in full on all four verify legs. CI **35733667768** at `0f5e0e4f6` (the
docblock follow-up) was still in flight when this was written.

**The census changed the scope before any brief was written.** L-41 read as two production sites.
It was **seven**: five existing assertions rebuilt the glued expression to compare against it —
`contextMenuLifecycle.test.ts`, `i09-selection-guidance.test.ts` (twice) and
`contextMenuActions.test.ts` (twice) — which is the same shape as the `toContain('2')` that failed
to catch L-38, so **none of them could fail on the glue.** Two further facts decided the shape:
the live region's single-selection text was asserted by **nothing**, and there were **two** clones
rather than one, with `CanvasContextMenu`'s `title` computed existing solely to feed its copy.

So the fix **extracted one pure function** rather than adding a period twice — the minimal diff was
never two characters, and the copy is why the defect had two sites. The separator is punctuation in
code; **neither locale string was touched and L-15 was never engaged.**

| command | outcome |
|---|---|
| CI `35730335714` at `ee7d4b3ff` | **success, all five jobs** — the authoritative verdict |
| CI `35733667768` at `0f5e0e4f6` | in flight at the time of writing |
| `npm run check:fast -- tests/presentation/editor` (local) | **never returned** — starved, then abandoned |
| `npx oxlint` on the two docblock-only files | exit **0** |
| Vue watcher probe (controller's own) | `vue 3.5.41`, 1 firing, `referenceIdentical: true` |
| `s14-tablecheck.mjs` | 5/5 fixtures, 42 L- rows, `{"6":42}`, uniform OK |

**Not run:** `npm run check` locally, `npm run build`, `test:coverage`, `npm run analyze`,
`npm run test-build`, any capture, any vault run. **No capture can show this change** — the live
region is `rp-visually-hidden` and the tooltip is a `title` attribute no screenshot renders — so
none was generated, deliberately.

**A review finding was REFUTED, and it exposed a false rationale rather than a missing test.**
The module justified taking ids as a parameter by a watcher holding a value the store had moved
past. A probe of exactly that scenario — two writes in one flush — shows Vue 3.5.41 coalescing
them into **one** firing with `ids` reference-identical to the store's value; **the controller
reproduced it independently**. So passing either is behaviour-identical and no test can
discriminate them. The docblock now records the refutation and says outright that nothing re-runs
it. **The code was correct either way; the reason given for it was wrong** — *a false reason is
worse than no reason*, and this one was the controller's.

**Generation SIX of the wider-than-its-check overclaim landed in this work, one file from where
the brief had forbidden it.** The brief barred an only-claim and a caller list from the module
docblock; both appeared in the TEST docblock instead, together with a count. **Six for six: every
generation after the first has been introduced by the commit fixing the previous one.** All three
shapes deleted rather than corrected.

**The category is now measured closed at four.** Rather than a sixth grep, the review built an AST
census over all 1047 `src/` files — template literals, `+` concatenation, `.join` over tr-bearing
arrays, adjacent SFC interpolations — and **tested the instrument against the pre-fix tree first,
where it finds both L-41 sites and nothing else.** On the fixed tree: 13 hits, twelve verified
benign against the locale tables, and one real — `clipboardActions.ts`, now **L-42**. A negative
result, and worth more than a finding: it answers whether the category needed an instrument or a
fifth row.

**Two controller defects, both caught.** A duplicate implementer was dispatched onto a live agent's
files because a notification's `status: completed` was read while its note — *"the result below may
be interim"* — was not. No tree damage, but two `check:fast` runs contended. And the local gate's
repeated failure was diagnosed, by reading command lines rather than counting processes, as **the
peer session's** three concurrent jobs, not a defect in the change; the remedy was the documented
workflow — CI is the report — and **nothing of the peer's was touched.**

#### Next executable action

**L-42 — the paste notice that glues a count to the sentence after it.** Strongest candidate on
five counts, and it inherits L-38's and L-41's whole argument. It is **MEASURED** — found by an
agent's unasked check, verified at source in both locales by the controller. It is a **LIVE
product defect** in a real `notifySuccess` toast raised by an ordinary paste, not a harness
artifact. **It mints no word and L-15 does not gate it**, because the remedy is punctuation in
code. **Nothing asserts that notice's text today**, so the watched-failing red is available and
cheap. And it is **the last known member of the category** — an AST census, tested against a tree
where it is known to fire, finds no fifth — so closing it closes the category rather than chipping
at it.

**Two things to settle first, and neither is a blocker.** The remedy is a **judgement about where
the summary group ends** — a period after the `·` list, or a different joiner — rather than one
character, so decide it against a rendered reading rather than by pattern. And there is a
**second, latent edge in the same function**: an empty summary makes the inner join the empty
string, so the outer join leaves a **double space**; decide deliberately whether to close it in the
same edit or record it, rather than discovering it afterwards.

**Two alternatives, named as alternatives and not as the action.** (1) **L-38's residue** — the
`--partial` marker orphaned on a second line at full-layout width, whose one-character remedy is
measured and deliberately not taken because it wins by 0.72px on a font the harness resolved to
fallbacks; it becomes decidable the moment anyone runs that surface in a vault. (2) **L-40** — the
third diagnostics button is reachable by no harness knob; closing it is a harness fixture that can
reach the schedule surface, which is its own increment.

**L-37, L-33's residue and L-36 remain OWNER questions and are NOT remainder tasks.** **BP-04 is
unchanged** and still closable against its Acceptance sentence with only the real-screenshot clause
outstanding. **G1 stays blocked on L-06, L-19 and L-21.** **Nothing here has been run in an
Obsidian vault, and no screen reader has ever been pointed at this branch.**


### Session 15 — 2026-09-21 — L-34 narrowed and closed, L-35's refusal overturned on measurement, and a red CI caught by a check nobody asked for

**Branch `renovation-planner-beta-handoff-e80bb5`, opened at `3fb8ef6b9`, closed at `c4c60f11c`.**
`origin/main` was still `ed5c50b76` and still an ancestor, so **no merge was needed and none was
performed**. CI at `3fb8ef6b9` (run 35622959288) confirmed success on all five jobs before any work
began. PR #231 remains draft, no auto-merge, no reviewers.

#### What landed

| commit | subject | run |
|---|---|---|
| `cf6b39fac` | a button beside three notices | 35634524060 — **FAILURE**, see below |
| `780e562dc` | `?unreadable=N` drops refused zones | shares 35643210328 by R-S15-31 |
| `c4c60f11c` | extract the unreadable-plans notice | 35643210328 |

#### L-34 — narrowed from four strings to two, then closed as narrowed

**The tracker's framing was wider than the tree, and a read-only recon established that before
anything was built.** Two of the four strings — `zone.listing-incomplete` and
`asset.listing-incomplete` — are raised by `ListReassignmentTargets` and end at
`new Notice(string, 0)`. **A toast cannot carry an action**, for four independent reasons each
sufficient alone, so they are not doors and were split out as **L-37**.

The remaining two shipped their button. Two required deps members injected by the composition root,
copying the `planEditorDeps` seam twice; three controls; **no new component and no new locale
string**. The button is gated on the SOME arm rather than on the notice existing, because
`all-plans-unreadable` names no report — **a defect the recon found that no brief had anticipated,
and the over-delivery mirror of the one L-34 closes.**

**Two of the controller's own briefing premises were refuted by the agents given them**, both about
`PersistentWarningStrip`: the asset-library strip is not one, and it has **one** importer rather
than five. The corrected count reversed the design answer, because a one-caller component is not a
shared component.

#### L-35 — session 14 refused the prune, and the refusal rested on a false premise

Session 14 priced pruning the `?unreadable=N` fixture as too coupled and named four couplings.
**Two do not exist.** Walls carry no zone reference at all, and — decisively — the real
`findZonesByPlan` reads `structure` from the **per-plan geometry sidecar**, independently of which
zone notes loaded. **Keeping the structure whole under a prune is exactly what a real vault does;
pruning it would have been a new infidelity.**

The fake now drops the two zones named by no wall, opening or boundary, keeps the structure, and
**throws above its maximum rather than clamping**. Verified by the controller in the re-taken
capture: two polygons rather than four, `Rooms 1 · Areas 1 · Total area 45.6 m²`, so
**2 drawn + 2 refused = the fixture's 4** — a vault that can exist.

**The durable lesson is about the refusal rather than the fix: a costing is a hypothesis too.**
Session 14's estimate was honest and was priced by reading. A refusal that goes unchallenged looks
exactly like a settled one.

#### The red CI, and where the defect actually was

**`npm run check` was RED at `cf6b39fac`, on all four verify legs, at the `analyze` step** — two
templates at cognitive 17 against a threshold of 16, and they were precisely the two files the
commit had added a `v-if` button to. **It was found by the independent reviewer's unrequested
check, on a commit whose author had already reported success.**

The implementer's report said *"Every one of its four steps was run"* and then listed three. The
missing one was the red one. **That is this branch's signature defect — a sentence wider than what
was done — arriving in a COMPLETION CLAIM, which is a surface no gate watches.** The workflow is
vindicated rather than indicted: CI is where the full gate runs, and CI is what caught it.

**The controller's proposed fix was refuted by arithmetic.** Wrapping the notice and its button in
an enclosing element inline moves the `v-if` to nesting 2, where it costs 3 instead of 2 — one file
would have gone 17 → **18**. Wrapping and reducing cannot both happen inside a template. Extracting
the pair into one component that both surfaces render **with no `v-if` at the call site** took both
files 17 → 13. **No threshold, budget or ignore was touched.**

#### Generation five of the same overclaim, in three homes

The commit that correctly **deleted** three stale counts wrote one new unchecked claim beside them:
a case name asserting *"none composes its own"*, which the reviewer disproved by composing a second
report and watching 7 of 7 stay green. The fix round's audit then found the identical claim in a
**third** home, outside the commit under review. All three closed by deletion; **no count was
replaced with a newer count.**

#### Instruments and honesty

- **Four controller-brief defects, every one caught and reported by the agent it was given to and
  none reaching the tree.** Two changed the work materially.
- **Ninth consecutive round in which the unrequested check was the most valuable item.** This
  round's found a red CI; the fix round's tested the *instrument* it had been handed and showed its
  approximation is one-sided in the safe direction.
- **The limitations table checker earned its place**: it refused an edit whose `L-40` row carried an
  unescaped `|`, before that row reached the file.
- **Nothing here has been run in an Obsidian vault.** No native, device, screen-reader, contrast or
  performance verification is claimed. A harness capture is a browser render, not a vault run.
- **No full `npm run check` was run locally, deliberately**, and **no CI run was cancelled**.

#### Four new limitations, none of them found by a gate

**L-37** (two strings surface as a toast, which cannot carry an action), **L-38** (the Floor
Inspector glues two bare numbers together — a live product defect found by looking at a capture,
which L-35 made sharper rather than better), **L-39** (`eslint .` exits 1 locally on gitignored
session scratch; CI unaffected) and **L-40** (one of the three new buttons is reachable by no
harness knob, so it is unphotographed though not untested).


### Session 14 — 2026-09-21 — L-33 closed, the diagnostics door built, and a lint rule's vocabulary fixed instead of its copy

**Branch** `renovation-planner-beta-handoff-e80bb5`, opened at `cb7189334`. `origin/main` stood at
`ed5c50b76` and was still an ancestor, so **no merge was needed and none was performed**. Draft
PR #231 left a draft: not marked ready, no auto-merge, no reviewers.

Subagent-driven throughout — every task dispatched to a fresh agent with a written brief, every
implementation reviewed by an independent agent, the fix round re-reviewed by a third, and a fourth
agent run as a narrow clause-by-clause audit. **The controller never fixed a review finding
itself.** The full working record — briefs, reports and every ruling with what it costs if wrong —
is at `.superpowers/sdd/01-improvement-plan/s14-*` (gitignored; the only copy).

#### What shipped

| Commit | Subject |
|---|---|
| `b512f2db6` | `fix(editor): stop the corner dialog naming a room` |
| `b226b6c67` | `feat(editor): give unreadable-zones its diagnostics door` |
| `5f3895acd` | `test(editor): pin both editor.resize.invalid sites` |
| `63ecd9fd9` | `fix(i18n): uppercase the axis letters X and Y` |
| `f7ec76c22` | `test(harness): pin the base-bundle knob rule` |
| `79cffcc8b` | `test(harness): re-run the ?stale only over all 7` |
| `2ce9b424e` | `docs(harness): drop counts nothing re-runs` |

Each was pushed only after the previous commit's CI run had **completed**, so **no run was
cancelled this session** — the specific failure R-S13-65 recorded. Green at `b512f2db6`
(`35599684790`), `b226b6c67` (`35604802085`), `5f3895acd` (`35608842759`), `63ecd9fd9`
(`35613162141`). The final two are a test-only and a comments-only commit, pushed together.

#### L-33 — closed, and the measurement stopped a regression

The row proposed "a code-to-copy mapping or a genuinely generic sentence". **Neither the mapping
nor the row's premise survived measurement.**

- **The brief said "three distinct causes". There are five across two mounts**, and three codes it
  named are unreachable from this form. A whole cause family was missing: on the shared element
  mount, most element kinds never reach `simpleAreaOutline` and are refused by
  `validSpatialElement` — **a bare boolean with no error code at all**.
- **`editor.resize.invalid` has THREE render sites, not one.** The other two are the room
  width/depth dialog, where "dimensions" and "room" are **correct**. Editing the string would have
  fixed one surface and silently broken two — verified at source by the controller before any fix
  was briefed. `5f3895acd` then pinned both correct sites on their rendered text, because an
  independent reviewer swapped the key at both and **179 tests stayed green**.
- **The mapping was refused on measurement**, not preference: the parse cause already renders a
  precise per-field message simultaneously, the two shape causes have no locale entry (R-S13-1) and
  resolve to `error.category.geometry` regardless, and the fourth cause has no code to map.

What shipped is a one-line key swap to `error.category.geometry` — both-locale, naming neither
dimensions nor rooms, and **the same sentence this refusal already produces as a toast**. A second
defect found in the same measurement shipped with it: the form held a `LengthRefusal` and discarded
it, so a too-large coordinate read as unparseable.

**Recorded as a departure, not a win** — `error.category.*` is a declared fallback tier, and the
codebase writes down that falling into one is a defect worth minting a key to avoid. The honest
answer needs a minted both-locale sentence, which **L-15 blocks**; surfaced as an owner question
(L-33's residue, with L-36) rather than absorbed.

`harness-shots/plan-editor-outline-narrow.png` shows this dialog titled **"Edit Terrace"** — it
demonstrates the "room" defect rather than arguing it.

#### The diagnostics inversion — the Plan Editor half is closed

The `unreadable-zones` row now carries an action labelled with the palette command's own
both-locale `command.show-diagnostics-report` — **no locale file changed**. `presentation/` still
may not import `src/plugin/`; the button presses a callback injected by the composition root onto
the same public method the palette command and the settings row already call. `planEditorDeps`
declines the member in its return type, making "this function composes no plugin action" a
compiler-checked fact rather than a convention. A reviewer proved the layer ban by **negative
control** — adding a `plugin/` import and watching ESLint refuse it.

`background-missing` and `background-unreadable` stay action-less on a **structural** ground now
written into the model: `DiagnosticEntityKind` has no background member, so a button there would
open a report incapable of mentioning the background. **Four other surfaces still name that report
with no way to reach it — L-34.**

#### The axis letters — the rule's vocabulary was wrong, not the copy

The controller ruled the lowercase `y` a typo because German writes `Y`. **That ruling was wrong**,
and the implementer's STOP caught it. Measured both ways: `Y` fails
`obsidianmd/ui/sentence-case-locale-module` under `--max-warnings 0`; `y` passes. Root cause, read
at the plugin's source: `brands.js` **contains `"X"`** — the social network — and no `"Y"`, and
`acronyms.js` has neither. **The uppercase `X` passed the marketplace rule only by accident.**

The remedy is the one already written down for `SKU`: *fix the RULE's vocabulary, not the copy.*
**A second STOP fired and found the inverse of the risk it guards** — the widening suppressed
nothing (baseline zero) and **exposed a second site** with the same defect. Final state: ESLint over
all locale modules, before 0, after 0.

**One German string was touched, under a narrow recorded ruling.** `de/structure.ts` changed by
exactly two characters — `git diff --word-diff-regex=.` shows `-x +X`, `-y +Y` and nothing else. A
case change to a standalone Latin axis letter needs no German-language knowledge, and `de/editor.ts`
already writes both uppercase, so this makes the file agree with existing German rather than
inventing a convention. **Either character reverts independently.** English keeps a labelled pair in
two registers — **L-36**, an owner copy question left undecided.

#### BP-04's test figures — settled by measurement

The audit was **re-run** against the current tree with its own rubric: **10 covered / 2 partial /
0 absent, confirmed**, moving `10/2/0` from a derivation nobody checked to a measurement. Nothing
regressed. **Worth more than the number:** item 3's *verdict* is still partial but its recorded
*reason* is now stale, so anyone re-deriving the gap from the old sentence over-states it. Honest
caveat: no verdict rests on a watched-red mutation, because that brief forbade edits.

#### The pattern this record keeps paying for — FOUR generations in one session

A docblock claimed more than its check could see. The commit fixing it wrote a new overclaim. The
commit fixing **that** wrote another. A narrow clause-by-clause audit then found a fourth — **three
of whose five findings were written by the two commits under audit**.

**The diagnosis is the durable part:** each commit narrowed the quantifier it was *aiming* at and
wrote a fresh count-or-reason **beside** it, in supporting prose that got neither a check nor an
admission. The worst was not a count but a **reason** — `harnessDeps` claimed "nothing downstream
compares the two", which is what justified where the fake stops, while `counted(rooms.length,
input.unreadable)` feeds the Floor Inspector and flips every room row to "Unknown".

**Closed by DELETION, not correction** (`2ce9b424e`): five claims removed outright, three survivors
given an in-docblock "nothing re-runs this" admission, and no count replaced with a newer count —
**a right count is a wrong count that has not aged yet.** The evidence for that rule is the
controller's own briefs: one said a knob count was two, an agent correctly widened it to four, and
the audit found four is also wrong.

**The instrument that caught every generation was the same**: an independent agent required to
perform **one mutation nobody asked for**. Seven rounds running, it was the most valuable finding in
the round each time.

#### Controller errors, recorded

- **R-S14-4 was wrong.** The axis letter was ruled a typo from two files that agreed with each
  other, without asking the gate — this repository's own most-repeated lesson, met from the side
  where the controller was writing the sentence.
- **Nine briefs carried false premises**, every one caught and reported by its agent rather than
  worked around, and **none reached the tree**: the L-33 cause count; `planEditorDeps.ts` "must not
  change" (`vue-tsc` refuses it — the agent's `Omit<…>` fix is better than the premise and was
  endorsed); Ruling 2's two branches, which were **not exhaustive**; a `?stale` table's rows
  miscounted as layers; the `location.search` knob count; a 400-line cap warning that could not
  apply because `max-lines` sets `skipComments`; and a `buildFloorSummary` call path off by one hop.
- **R-S14-19 was over-read and is corrected in place:** the Details panel reading `Unavailable` is
  fed by the same fake, so what the controller reported as the panel being honest is the
  distortion. L-35 names the Inspector as well as the canvas.

#### Gate state

**Nothing was run in an Obsidian vault.** No native, device, screen-reader, contrast or performance
verification was performed or is claimed anywhere. `npm run check` was **not run locally** by
design — CI runs it verbatim across five jobs; `npm run check:fast -- <paths>` was the inner loop.

`npm run harness-shot`: exit 0, **123 PNGs**, `grep -c "not the Chromium"` → 0. The controller
additionally drove `npm run harness` in a real browser at `?view=plan-editor&unreadable=2`, at 1280
and 460, because the first round's captures were taken through temporary `SHOTS` rows and deleted
with them. The button is a real `button` with the accessible name **Show diagnostics report**, full
label at both widths, dropping to its own line at 460.

**A third `beforeAll(warmUpEslint)` false red** was hit: a 60 s hook timeout against **3.0 s** on a
serial re-run of the unchanged tree — a **23×** swing. The band to distrust is not only "~5000 ms".

**A standing instruction was corrected:** `npx eslint <file> --max-warnings 0` is the **wrong**
line-cap instrument for `scripts/` — ESLint ignores that tree and reports the file as *ignored*,
which `--max-warnings 0` turns into exit 1 for the wrong reason. `npx oxlint --deny-warnings` is the
instrument there.

#### Next executable action

**L-34 — give the four remaining surfaces the door the Plan Editor now has.**
`view.project.some-plans-unreadable` (two renderers), `zone.listing-incomplete`,
`asset.listing-incomplete` and `view.asset-library.some-unreadable` all tell the user to open the
diagnostics report and offer no way to reach it; the last has a button that opens a **note**
instead. It is the strongest candidate on four counts: it is **measured** rather than suspected;
`b226b6c67` already built and reviewed the composition-root callback seam these would reuse, so the
architecture question is settled; `command.show-diagnostics-report` exists in both locales so **no
German is minted**; and it closes the *other* half of an inversion this session only half-closed.
Check first whether each surface's own composition root can reach
`RenovationPlannerPlugin.openDiagnosticsReport()` the same way — *one action, every input* means the
fifth door calls the same method, not a new composition.

**Two alternatives, named as alternatives.** (1) **L-35** — the `?unreadable` capture draws zones
the strip says are not drawn, and distorts the Floor Inspector through the same fake; the "no
picture to misread" mitigation is now spent, and the round that found it recommends making
`mountPlanEditorHarness` **refuse** a discarded knob combination loudly rather than pruning.
(2) **L-33's residue and L-36 are OWNER copy questions** and explicitly not remainder tasks.

**G1 remains blocked** on L-06, L-19 and L-21, all three assembled in `05-owner-decisions.md` and
all three needing a vault run. **G2 needs BP-04 through BP-07**; BP-04 is closable against its
Acceptance sentence with only the real-screenshot clause outstanding, which also needs a vault run.

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
| G1 — data trust | **Not evaluated** | BP-01 to BP-03's implementation work is complete, and L-16 (undo and redo landing on a paused vault) is closed; L-16's row carries the commit range. Evaluation waits on three owner questions, `05-owner-decisions.md` Q1 to Q3: L-06 with L-11 (a stamp raised outside `guardCommand` never becomes a durable incident, and nothing checks the category); L-19 (a settings save inside a live project create, whose cold arm is a duplicate-project risk); and L-21 (whether a still-mounted view may write after `onunload`, which the remaining F3 test rows wait on). L-19 and L-21 each need one vault run, and nothing on this branch has been run in a vault. L-13's affordance residue and L-14 are accepted as having no data-safety effect. History: session logs 2–9. |
| G2 — core journey | **Not evaluated** | Needs BP-04 to BP-07 and representative end-to-end cases. BP-04 has one open item, the Deliverable's real-screenshot clause, which needs a vault run (L-31). BP-05 to BP-07 are not started under the plan, though much of their behaviour is built and tested in jsdom (their register rows). Geometry items bearing on this gate: L-23 (a vertex drag can write a zero-area straight Zone; its remedy is an owner trade), L-29 (narrowed, not closed: the editor's write doors refuse a self-crossing outline, while outlines already in a vault and the asset designer's doors are not covered) and L-22. Nothing here has been run in an Obsidian vault, and no screen reader has been pointed at this branch. History: session logs 10–17. |
| G3 — support and first use | Not evaluated | BP-08–BP-11. BP-08 to BP-10 are not started under the plan and BP-11 is partial. L-43 is closed: the owner decided on 2026-09-23 to guard the Asset Library on mobile, and the guard is in code and tested in jsdom; this gate's device-scope claim still waits on BP-09's device run. |
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
