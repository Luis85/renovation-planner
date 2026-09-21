# Beta execution tracker

Prepared: 2026-09-16. This is a starting template, not an execution report. Map its statuses into the repository's existing lifecycle; keep implementation, verification, and release approval separate.

## Current state

| Field | Value |
|---|---|
| Handoff baseline | `d77e7c5eba5e6518b93a5be4606532ceab3a77eb` |
| Upstream reconciled | Merged twice, never rebased — every review and ledger entry references this work by commit SHA. First: `main` advanced 14 commits to `f3a8864a9` (asset-designer consolidation, plan deletion), zero file overlap. Second, in session 4: 24 further commits to `ed5c50b76` (the opening-handles work), merged at `42d07b14a` with a **one-file** overlap measured by `comm -12` over the two `git diff --name-only` sets before the merge was run, so it was known-cheap beforehand. Session 5 re-checked and `main` had **not** moved: `git rev-parse origin/main` and `git merge-base HEAD origin/main` both print `ed5c50b76`, so main is an ancestor of HEAD and there was nothing to merge. |
| Current working revision / branch | **As of session 13 (2026-09-21): `74cfe8647` on branch `renovation-planner-beta-handoff-e80bb5`, PUSHED, tree clean.** Six commits were added this session — `e9b982706`, `7c38db05c`, `78b851ab2`, `0ad89aea3`, `3c0e01d21`, `74cfe8647`. `origin/main` was re-checked at the session start and had NOT moved: it is at `ed5c50b76` and is still an ancestor, so no merge was needed and none was made. **Everything after this sentence is the historical record and its opening clause is superseded. The original text follows.** **As of session 11 (2026-09-20): `e2d524a9b` on branch `renovation-planner-beta-handoff-e80bb5`, PUSHED, with draft pull request [#231](https://github.com/Luis85/renovation-planner/pull/231) open — not marked ready, no auto-merge, no reviewers requested.** `origin/main` re-checked at session 11's start and had NOT moved: `git rev-parse origin/main` prints `ed5c50b76` and `git merge-base --is-ancestor origin/main HEAD` succeeds, so main remains an ancestor and there was nothing to merge. **The rest of this cell is the historical record and its opening sentence is superseded**: `c5456b239` on branch `renovation-planner-beta-handoff-e80bb5`. Nothing pushed; no pull request opened. Seven sessions of work sit on top of the handoff baseline `d77e7c5eb` and the merged upstream `ed5c50b76`. Session 7 re-checked upstream before starting and `main` had still not moved: `git rev-parse origin/main` and `git merge-base HEAD origin/main` both print `ed5c50b76`, so main remains an ancestor and there was nothing to merge. |
| Worktree and dirty files | Worktree `.claude/worktrees/renovation-planner-beta-handoff-e80bb5`. Clean at session start. 95 other worktrees exist under `.worktrees/` and `D:/codex-worktrees/`; none was touched, reset, cleaned, or stashed. |
| Responsible integrator | Unassigned — no human integrator has accepted this work. |
| Selected beta scope / platforms | Unchanged from the handoff proposal: current editor capabilities, desktop editing, mobile read-only. Not yet confirmed by an owner. |
| Existing backlog mapping | BP-01 maps to an existing recorded repository decision (increment-history ruling R1) rather than to a new backlog item. The remaining BP identifiers are unmapped. |
| Baseline full gates | **CORRECTED 2026-09-20 (session 11), and the original sentence below is FALSE — read this clause first.** `npm run check` is **GREEN, all four steps**, and has been since session 9. **L-04 was REFUTED** (ruling R-S9-2): `analyze` passes on `main` and on this branch in about a second, and the ruling that called it broken rested on a misread of fallow's report — its failure sentence names a refactoring-target POINTER, not a breach. That misreading suppressed a working gate for eight sessions and filed a real defect as pre-existing. Session 11 re-confirmed it first-hand twice, with the exit captured into a file before any pipe. **The superseded original follows, kept rather than deleted so the correction has something to point at:** `npm run check` is **RED, and not because of this work** — its `analyze` leg fails on `origin/main` itself. See limitation **L-04**, which carries the measurement. Its other three legs are green. Measured at `9d08aeed4`, exit code captured into a file before any pipe: `npm run test:coverage` **exit 0**, 1035 files / 11165 passed / 1 skipped in 1410.87 s, with statements 99.21% (28619/28844), branches 98.08% (21041/21451), functions 99.27% (8316/8377) and lines 99.65% (21034/21106) against floors of 99/99/99/98 — all four met. Counted in UNITS rather than percentage points, per CLAUDE.md: uncovered arms fell against session 4's run in three metrics and held in the fourth (statements 227→225, branches 414→410, functions 63→61, lines 72→72), so this session added no uncovered arm. No floor was ratcheted: each already sits at the next whole point, so no integer raise is available. **Not re-measured in session 6 and deliberately so**: that session added three test cases and changed no production line, so no branch arm moved, and `npm run check` was kept off the working machine under the parallel-work rule. Coverage on this branch is therefore CI's report to make, not this row's. |
| Candidate source and bundle hashes | Not created. No production build was made. |
| Native acceptance | Not performed. No Obsidian was run. |
| Publication authorization | Not granted. |
| Next executable action | Recorded at the end of the session log below. **As of 2026-09-21 (session 14) it is L-34 — give the four remaining surfaces the door the Plan Editor now has.** `view.project.some-plans-unreadable` (two renderers), `zone.listing-incomplete`, `asset.listing-incomplete` and `view.asset-library.some-unreadable` all tell the user to open the diagnostics report and offer no way to reach it; the last has a button that opens a **note** instead. Strongest candidate on four counts: it is **MEASURED** rather than suspected; `b226b6c67` already built and independently reviewed the composition-root callback seam these would reuse, so the architecture question is settled rather than open; `command.show-diagnostics-report` exists in **both locales**, so **no German is minted** and L-15 does not gate it; and it closes the other half of an inversion session 14 only half-closed. Check first whether each surface`s own composition root can reach `RenovationPlannerPlugin.openDiagnosticsReport()` the same way — **one action, every input** means the fifth door calls the same public method, never a second composition beside it. **Two alternatives, named as alternatives and not as the action.** (1) **L-35** — the new `?unreadable` capture draws zones the strip says are not drawn AND distorts the Floor Inspector through the same fake; the "there is no picture to misread" mitigation is now spent because this session added two, and the round that found it recommends making `mountPlanEditorHarness` **refuse** a discarded knob combination loudly rather than pruning the fixture. (2) **L-33`s residue and L-36 are OWNER copy questions**, both needing a minted both-locale sentence that L-15 blocks, and explicitly NOT remainder tasks. **BP-04 is unchanged and still closable against its Acceptance sentence with only the real-screenshot clause outstanding**, which needs a vault run. **G1 stays blocked on L-06, L-19 and L-21.** **The superseded session 13 entry follows.** Recorded at the end of the session log below. **As of 2026-09-21 (session 13) it is L-33 — the one refusal sentence that answers three different causes.** `OutlinePointsForm.vue:150` renders `editor.resize.invalid` — *"Enter valid dimensions that can describe this room."* — for every whole-outline refusal: an invalid coordinate, a zero area, and **since `e9b982706` a self-crossing outline as well**. It is the strongest candidate on three counts: it is MEASURED rather than suspected, it is small, and **this session's own predicate made an existing copy defect worse**, which is a debt the next session inherits rather than discovers. It is a **copy decision rather than a substitution** — three distinct causes share one sentence, so the honest fix is either a code-to-copy mapping or a genuinely generic both-locale sentence — and it sits in the same instrument gap L-30 just closed one instance of. **Two alternatives, named as alternatives and not as the action.** (1) **The diagnostics-surface inversion, RE-COSTED this session as slice-shaped rather than cleanup-shaped** (R-S13-57): the `WarningAction` id and callback are mechanical, but `showDiagnosticsReport` lives in `src/plugin/` and `presentation/` may not reach it, so the composition root has to inject one more callback — a layer crossing with its own argument, not a tidy-up. (2) **L-23 remains an OWNER decision and is explicitly NOT a remainder task**; session 13's predicate deliberately left it open (R-S13-4). **BP-04's own state moved:** Action 1 is DONE at `3c0e01d21`, so **only the Deliverable's real-screenshot clause now stands between BP-04 and closed**, and that needs a vault run — owner-acceptance territory beside L-19 and L-21. **G1 is unchanged and stays blocked on L-06, L-19 and L-21.** **The superseded session 12 entry follows.** **As of 2026-09-20 (session 12) it is BP-04's Action 1 — the short interaction specification (L-31) — paired with a decision on the three geometry holes.** Action 1 is the one outstanding BP-04 item that can be done from here at all: it is a writing task, it needs no owner and no vault, and with it done the only thing left between BP-04 and closed is the Deliverable's real-screenshot clause, which needs a vault run and is therefore owner-acceptance territory alongside L-19 and L-21. **Beside it, and larger: L-23 is now MEASURED LIVE** — a vertex drag writes a zero-area Zone to the vault while BP-04's own typed dialog refuses to save the same shape — and it should be decided together with **L-29** (a self-intersecting straight outline is refused by nothing at all) and **L-22**, because all three are one geometry-validation question and two of them share a remedy site (`Zone.withGeometry`). **That decision is NOT a remainder-task**: the remedy is a behaviour change at a trust boundary, since a vault already holding a zero-area Zone would keep loading but refuse further edits. The cheap first step is to **drive L-29's gesture**, which is unmeasured where L-23's is not. **The superseded session 11 entry follows.** **As of 2026-09-20 (session 11) it is BP-04 slice B — the reach**: a context-menu entry and `SpatialInspectorActions.vue` wiring, the ONLY thing between BP-04 and closable, and **blocked on the OWNER rather than on work** — it needs an action label in both locales and L-15 forbids agent-minted German. Landing it also makes L-24 moot. If the owner is unavailable, the movable pieces are **L-23's measurement** (whether any live path reaches `MoveSpatialObject` with a degenerate outline — the cheap experiment that decides latent versus live) and **L-22**, which starts by exporting `validateCurvedBoundary` and needs a realistic-geometry case produced first. **The superseded session 10 entry follows.** As of 2026-09-20 (session 10) it is **BP-04 slice A2 — per-corner selection and highlight**, which is what BP-04's interaction contract and its action 3 actually ask for and what slice A deliberately did not build. It lands in **two files no budget table has ever named**: `src/presentation/editor/tools/render-state.ts`, which has no per-vertex field at all, and `src/presentation/editor/layers/InteractionLayer.vue`, whose `editableVertices` draws every handle uniformly. Slice A (2026-09-20, `6546f402c`) shipped the whole-outline numeric editor underneath it and is reachable only from a test. **Slice B — the reach — is NOT the next action and is blocked on copy**, not on work: its context-menu entry needs an action label, and **L-15 forbids agent-minted German**, so it needs the release owner. A2 needs no new string and is therefore the piece that can actually move. **G1 remains blocked on something that is NOT work:** a release-owner decision on what `onunload` owns (L-21), which is what five of BP-03 F3's six rows are blocked behind. BP-03's five numbered gaps are otherwise all closed or accepted. That decision and the two other open owner questions (L-06 with L-11 folded in, and L-19) are assembled for one sitting in [`05-owner-decisions.md`](./05-owner-decisions.md), which also records that the WORKED EXAMPLE behind ADR-0034's stated cost for the L-06 closing option does not hold: `ConstructionMaterialCommand` re-raises the stamp and is guarded on both doors, so that stamp already becomes a durable incident today. The DIRECTION of that cost is unchanged and no other example has been costed. |
| Reviews performed | Across six sessions. Session 6: one task review and one scoped re-review, both independent seats told to answer their seat's question by EXPERIMENT rather than by reading. Both returned findings that were real — the first that a pointer to `guardCategory.test.ts` could not carry the claim handed to it (that file names `WRITES_PAUSED_CODE` zero times and stays green with the gate removed), the second that a docblock clause this branch had just written was measured FALSE. Session 6 also had the CONTROLLER re-run every measurement it was given, including both reverts, and the controller's own census found eleven sites where a review had named five (L-17). Session 5 alone: two task reviews, two scoped re-reviews and two final rounds, every one an independent subagent seat instructed to re-run the instruments rather than accept a report. Both task reviews returned FIX, and in each case the reviewer overturned something the CONTROLLER had ruled rather than something an implementer had written — see L-13 and the session 5 log. Across three earlier sessions: Session 3 alone: five task reviews, six scoped re-reviews and a final whole-session review, every one an independent subagent seat instructed to re-run the instruments rather than accept a report. Three of its five task reviews returned spec ❌, and two findings were real defects rather than wording — an unbounded re-seed of the incident registry on every settings save, and a module global released without checking it was still the one that load claimed. |

## Package register

“Not started” means no implementation has been performed by preparation of this handoff. It does not assert that a future repository revision lacks the behaviour. Reconcile first.

| ID | Package | Priority | Dependencies | Kind | State | Owner / existing item | Evidence / next action |
|---|---|---|---|---|---|---|---|
| BP-00 | Reconcile baseline and ownership | P0 | None | Discovery | **Complete** | This session / unmapped | Five discovery lanes; every finding classified below. Scoped baseline green. |
| BP-01 | Preserve recovery incidents across remounts | P0 | BP-00 | Confirmed defect | **Complete** | This session / increment-history ruling R1 | Fixed at `67f5acf9c`, narrowed at `41d803611` and `2af92f8fd`; task review clean. Second-pane gating deferred to BP-02 — limitation L-01 — so BP-01's own acceptance set is not met in full. |
| BP-02 | Durable incident detection and recovery | P0 | BP-01 | Safety hardening | **All four slices complete; the package's own limitations L-06, L-11, L-14, L-15, L-16, L-17 and L-18 remain open, and L-13 is reclassified rather than closed** | This session / ADR-0019 requires a decision record for slice 2 | Discovery resolved the package's opening conflict: durable detection is **outside** the recorded refusal. Slice 1 (silent compensation paths now stamp) is at `81f627b53..beda98597`. Slice 2 — ADR-0034, affected-entity identity, the durable record and the coarse gate — is at `4599a388e..f05d5d62f` and closes L-02. Slice 3 (the sequence-marker store's direction-blind read, which also destroyed the unreadable record on the next write) is at `60a748423..5580e53b5`. Slice 4 landed in three parts: L-05's two unguarded Inspector zone commands at `e6cdd914b..2546d88d8`, the write gate reading the vault's own record at `36a4c92f7..4966cbe7b`, and L-06's pinned leaf-handoff census at `e7c24d91b..9d08aeed4`. **Completing the slices did not close the package**: L-06 is narrowed rather than closed, and slice 4 opened L-13, L-14 and L-15. Session 6 then MEASURED L-13 rather than acting on it (`0248de6cf..4a9c14d68`, three commits, no production line changed) and it reclassified: the designer's forward writes were already refused, so what that row named as a surface bypass does not exist on the forward path. The same measurement opened **L-16** — the designer's undo half writes through raw ports and lands while the vault is paused — which is what G1 is blocked on now. L-12 was closed at `e118f61d4` on an owner's ruling; L-17 and L-18 are accuracy findings the measurement turned up beside its subject. |
| BP-03 | Protect drafts and in-flight commands | P0/P1 | BP-01; final after BP-02 | Verification that became a fix | **All five gaps closed or accepted. F3 found a real P0 and fixed it; its test column is locked at 1 of 6, the other five blocked behind L-21** | Sessions 7 and 8 / unmapped | Lifecycle contract at `04-lifecycle-contract.md` (`cecfbbcbc`), six rules and five gaps F1 to F5. F2 fixed at `0ffd15466`, corrected at `3392c20c4` and `fb78d444c`. F1 measured and ruled option D at `c5b2817e2` and `1979aa7f6`, recorded as L-19. **F3 found that `onunload` releases the write-incident registry while every view is still mounted and dispatch-capable, disarming all three of its readers at once** — fixed at `f5a7f219e`, locked by `tests/plugin/unloadWithViewOpen.test.ts`, with `openViewOnLeaf` promoted to `tests/helpers/plugin.ts` at `45c88a73e`. F4 and F5 measured clean across all five arms and locked at `4da7258ee` and `c5456b239`. **Next action:** none in this package. L-21 is an owner decision, not work. |
| BP-04 | Precise non-drag corner editing | P1 | BP-00; integrate after BP-03 | Interaction addition | **UPDATED 2026-09-21 (session 13): Action 1 now HAS its artifact (`3c0e01d21`), so of the two items this row names only ONE is left — the Deliverable's real-screenshot clause, which needs a vault run. The package is STILL NOT marked closed. The original text follows.** **ALL THREE SLICES LANDED. The user outcome is delivered and every ACCEPTANCE criterion is met — and the package is NOT marked closed**, because two items no gate here can reach are outstanding (L-31: Action 1 has no artifact, and the Deliverable's real-screenshot clause needs a vault run). **The closability call, criterion by criterion, is at the end of this cell.** Slice A 2026-09-20 at `6546f402c` (+ `152a3c18c`); slice A2 at `8bfd6dd6a`, `b6b6a1f27`, `e2d524a9b`; **slice B at `1f2cf7cf8`, its documentation half at `73af5eb95`, its fix round at `2cf585a40`**. Discovery opened it 2026-09-19. | Session 9 discovery / session 10 slice A / session 11 slice A2 / **session 12 slice B** | Discovery and an independent review of it are at `.superpowers/sdd/01-improvement-plan/s9-task3-*` (GITIGNORED — the next session must read both, and the review corrects the discovery in three places). **Verified at source:** every path the plan's "starting points" names still exists, and `ReversibleMoveZoneCommand` IS the canonical single-zone corner-move command — guarded, ledger-conditioned, undoable, and its docblock's "no second class" claim survives a whole-tree grep. **So plan action 6 is satisfied by shipped code**, as are the coordinate spec (`editor.area.coordinates-hint` states metres from plan origin, X right, Y down, in both locales, matching `Viewport.worldToScreen`), the retyped-vs-rounded mechanism (`outlineProposal`'s `CoordinateEdits`) and the locale number parser (`parseCoordinateMetres`, comma and point). Geometry carries plain `number` millimetres — NOT `Decimal` and not a string, which is worth knowing because money and quantities each behave differently. Action 5 is NOT removable: curves exist as `CurvedPolygon.bulges`, but the policy is one function (`preservePointCurves`) and bulge is chord-relative, so arcs rescale rather than flatten. **The plan's own STOP fired in BOTH directions and reading either component by its name gives the wrong answer:** `AreaCornerEditor.vue` looks like the feature and edits only a draft buffer (`areaCornerInput.ts` → `tool-manager.ts` → `draw-polygon-tool.ts`, `this.buffer`, no repository — and the review found all THREE `editCorner` implementations are in-memory, so this holds by construction rather than by routing), while `OutlinePointsForm.vue` really does edit saved geometry but is wired to spatial ELEMENTS, not Zones. **What the review corrected, and the next brief must carry:** the reuse claim overreaches — `OutlinePointsForm.vue` renders every corner at once with NO chosen-corner state and `render-state.ts` has no per-vertex field at all, while BP-04's contract and action 3 are per-corner, so that is the package's largest UNBUDGETED work and it lands in two files discovery's budget table never named; `validateCurvedBoundary` is not exported, so a node test naming it directly would not compile under `build`'s type-check of `tests/**`; and "three dispatch sites" is six, one of the two omitted being the path the proposed first slice rides. Slice A's real template is `roomResizeAction.ts`, not `roomEditLifecycle`/`commitField`. Slice B needs exactly two new user-facing strings and **German is NOT written** (L-15). **SLICE A SHIPPED 2026-09-20 at `6546f402c`, with a docblock pointer at `152a3c18c`** — `src/presentation/editor/resize/zoneOutlineAction.ts` plus one wiring line each in `editorFormActions.ts` and `runtime.ts`, and `tests/presentation/editor/resize/zoneOutline.e2e.test.ts`. Four production files, zero locale changes, **zero new strings and no German**. Independently reviewed: spec **PASS**, quality **PASS WITH FINDINGS**, with six watched-reds re-driven by the reviewer itself and a seventh it added to prove the dispatcher spy was not vacuous. **Three of session 9's own statements were refuted at source by session 10 before any code was written, and two of them are corrections to THIS ROW:** (1) **there is no `'Area'` ZoneType** — `ZoneType.ts` declares seven values and `'Area'` is not among them, so "covers Room AND Area" means EVERY type and the predicate is `accepts: () => true`, written as a category because a list of seven omits the eighth silently (ruling R-S10-2); (2) **slice A needed ZERO new strings and L-15 was never engaged** — four existing keys already written in both locales cover every slot, the dialog title reusing `editor.element.edit`, which is fully generic in both (ruling R-S10-1, and its unchecked German half is now L-25); (3) the template is `metadata/areaDetailsAction.ts` rather than `roomResizeAction.ts`, because it is the only existing action that already widens `accepts` past Room and it costs ONE runtime member instead of two (ruling R-S10-3). **What slice A does NOT deliver, stated in its own docblock and not only here:** BP-04's per-corner contract and its action 3. `OutlinePointsForm` renders every corner at once and holds no chosen-corner state; that work is **slice A2** in `tools/render-state.ts` and `layers/InteractionLayer.vue` (ruling R-S10-4). The reach is **slice B**, and until it lands **no gate can see that this action is unreachable** — recorded as L-24. **SLICE A2 SHIPPED 2026-09-20 at `8bfd6dd6a`**, 17 files / 449 insertions: `RenderState.highlightedVertex` (one nullable index, cleared in `reset()`, a SECOND field rather than a richer `previewPolygon` because `SelectTool` is that field's second writer — ruling R-S11-3), a `VERTEX_HANDLE_HIGHLIGHT_RADIUS_PX` the `InteractionLayer` draws the chosen handle at, a new `resize/CornerChooser.vue` reusing `AreaCornerEditor.vue`'s affordance shape (R-S11-2), an **opt-in** `highlight` prop on the shared `OutlinePointsForm` leaving `elementEditPresentation.ts` byte-unchanged (R-S11-1), and a `?outline=1` harness knob with three capture rows. **Zero locale changes and zero minted strings again** — five existing keys in both locales, so L-15 was never engaged for a THIRD consecutive slice where copy was expected to be needed. **Two of the handoff's own premises were refuted at source before any code was written:** (1) `OutlinePointsForm` is **SHARED** — `elementEditPresentation.ts` is a second production importer the handoff never names, so "the right substrate" was not a free choice; (2) **"no per-corner state exists anywhere" is too wide** — true of RENDER state, false of the codebase, because `add/AreaCornerEditor.vue` already carries the whole affordance (a chosen-corner index, a numbered list, a per-row control, a `role="status"` announcement) and session 10 met its `areaCorners` runtime member as a NAME COLLISION without following the signal. A third, smaller: three usable keys exist rather than the two named, `editor.area.corner-position` being the accessible row label. **Independently reviewed: spec PASS, quality PASS WITH FINDINGS (15).** The reviewer's own unasked mutation is what earned the round: `interactionLayer.test.ts` compared the rendered radius to **the same constant the renderer read**, so setting that constant to `2` — drawing the chosen corner SMALLER than its siblings, **the highlight inverted** — left both test files green at 28 passed, as did `10`, which draws the mark larger than the grab region, the exact defect `handleMetrics.test.ts` names in words at the assertion next door. `handleMetrics.ts`'s header claimed that ordering *"is a check rather than this paragraph"* and it was not one. Fixed at `b6b6a1f27` as ORDERINGS following the polygon family's shape, watched red three ways. That round also pinned the narrow capture row's WIDTH (it had been reducible to a byte-identical duplicate of the wide row with `tests/build` green), addressed the e2e's `[role="status"]` assertion by name after it was shown to read the form's pre-existing sibling status region, closed the axe gap the implementer had disclosed — **proving the scan live with three probes rather than trusting green** — and corrected two false docblock clauses. **In that round the FIX AGENT corrected the REVIEWER and the controller verified it at source:** the review's "every writer stores unexpanded corner points" misses a SIXTH, `designer/tools/draw-detail-tool.ts`, which assigns an already-expanded `polygonPolyline` to `previewPolygon` on the same class — so writing the review's sentence verbatim would have shipped a fresh false claim into the docblock being fixed for exactly that offence. **What A2 does NOT deliver**, found by the controller opening the captures and reported by no agent: the corner list is ADDITIVE rather than replacing the fieldsets (L-26), and at 460 px the modal covers the canvas so the highlight cannot be seen at all (L-27). The eight-corner layout case is unphotographed — the densest seeded zone has five corners. **SLICE B IS UNBLOCKED AS OF 2026-09-20: the release owner supplied the German.** The action label is **en `Edit corners`** (BP-04's own words in its interaction contract) and **de `Eckpunkte bearbeiten`**. **L-15 is SATISFIED for this string — it is owner-supplied, not agent-minted — and for this string only.** Measured before recording rather than assumed: `grep` over both locale files finds **no existing pair** for it, so unlike slices A and A2 (which each needed zero new strings) **slice B really does need one new key**. The controller's recommendation, which slice B's implementer should confirm rather than inherit, is `editor.area.edit-corners` for consistency with the `editor.area.*` family slice A2 already draws from — noting the trade that R-S10-2 established "area" as the UI's word for a non-Room zone while this action accepts every `ZoneType`, so a zone-neutral namespace is defensible too. Both spellings are sentence case, which `tests/build/localeModuleSentenceCase.test.ts` requires. Slice B remains the ONLY thing between BP-04 and closable, and landing it makes L-24 moot. **SLICE B SHIPPED 2026-09-20 at `1f2cf7cf8`** — 7 files, 197 insertions: an `edit-outline` context-menu entry in `useCanvasMenuActions` and a new `resize/ZoneOutlineAction.vue` mounted from `SpatialInspectorActions.vue` for both the `room` and `area` record kinds, **both calling the one function `runtime.zoneOutline.editZoneOutline`** (CLAUDE.md's "one action, every input"). The menu entry is a SIBLING of the Room/non-Room `rename` ternary rather than an arm of it, because `accepts` is `() => true`. The second entry pushed `useCanvasMenuActions` to 101 lines against its 100-line budget, so the zone's own edits were extracted to `zoneEditActions` the way `promoteActions` already is; the extraction is behaviour-preserving (the push-order swap of `detailPlans`/`delete` is invisible — different groups, stable per-group sort) and the function now sits at **97 of 100**, measured with a padding probe rather than counted. **One key, both locales, the owner's copy verbatim** — so **L-15 is satisfied for this string and for no other**. **CI green on all five jobs at `1f2cf7cf8`**, which resolved the implementer's one disclosed risk (`analyze` had not seen the extraction). **Three controller premises were refuted before or during the work**, all recorded in the session 12 log: the perspective guard is about **Renovate**, not Review; the key name is **`editor.area.outline`**, not the recommended `editor.area.edit-corners`, because the `corner` stem already carries six keys and a seventh differing by one `s` is a substitution no gate can see; and the narrow capture row was refuted, reinstated and re-refuted **on its reason while its conclusion survived**. **An unexpected corroboration the implementer found by reading the design spec rather than the code:** the 2026-09-12 side panels spec §3 already names this inspector row, in this position, with **exactly** `data-rp-action="edit-outline"` — PR #149 removed the feature mid-plan, and slice B restores a row a design document has been specifying all along. **WHAT THE INDEPENDENT REVIEW AND THE INDEPENDENT ACCEPTANCE AUDIT FOUND, AGREEING FROM OPPOSITE DIRECTIONS:** the case named *"offers the menu entry on every zone type"* drove **one Room** — the reviewer proved it by mutation (moving `edit-outline` into the Room arm left **33 tests passing across 4 files**), the audit by reading the body (`renovationEditor` creates `zoneType: 'Room'` named `'Studio'`; the assertion is `toContain('Edit Studio')`). The controller's narrowing, which neither summary made: the case ABOVE it does exercise a Garden, but through the **inspector** door — **the hole was the MENU door on a non-Room specifically**, sitting under acceptance criterion 1. **FIXED at `2cf585a40`** along with four other items: the narrow capture row (behind a new `?details` knob, because changing the shared `selectZoneOnceReady` would silently reopen the drawer under `plan-editor-outline-narrow`, **L-27's only evidence**); `zoneOutlineAction.ts`'s docblock, false in three clauses and **rewritten NARROWER than the brief asked** because the fix agent refused the controller's sentence and proved reachability IS checked; *one history entry*, now `toHaveBeenCalledTimes(1)` **and** post-undo `canUndo === false`, each of which alone passes a different double; and *fresh repository reload*, a reopened `stackFoundation` over the same vault bytes. **The scoped re-review returned PASS WITH FINDINGS and verified every fix with a stronger mutation than was asked for** — deleting `toHaveBeenCalledTimes(1)` with the double-dispatch mutation in place to prove both assertions load-bearing, and byte-patching the `.rpgeo` sidecar between write and reopen to prove the reload test re-parses vault bytes. **THE CLOSABILITY CALL, criterion by criterion.** **Acceptance (6/6 met):** *every supported Room/Area corner selectable without dragging* — met, and asserted at BOTH doors on a non-Room since `2cf585a40`; *the preview matches the final saved coordinates* — met **as written**, and the audit REFUTED the assumption that L-22 falsifies it, because what diverges there is **valid versus refused, not coordinates**, and preview and save come from the same `outlineProposal` (**the wider reading — "what previews as acceptable is what saves" — IS false**, and that is the honest caveat); *untouched points and relationships unchanged* — met via `preservePointCurves`; *comma/point input in the supported locales* — met; *a peer edit refuses the stale draft* — met via `expected: version` spanning both files; *undo restores the exact prior geometry* — met. **Named tests: the figure is CONTESTED as of 2026-09-21 and BOTH readings are recorded here rather than one being picked — this is a STOP that fired.** The only published MEASUREMENT is `s12-acceptance-audit-report.md:85`'s own Net line, **`8 covered, 3 partial, 1 absent`** — the 3 partial being *rotated room*, *one history entry* and *constrained-layout focus*, and the 1 absent being *fresh repository reload* — and that same report's §1 Net at `:63` says **five of six acceptance criteria are checked by a GATE** while all six are MET, A3's "relationships" half being true by construction rather than by assertion. **That audit ran BEFORE the fix round.** **`10 covered, 2 partial, 0 absent` is a DERIVATION from the fix round, not a re-run of the audit**: `2cf585a40` did add `toHaveBeenCalledTimes(1)` plus a post-undo `canUndo === false` for *one history entry*, and a reopened `stackFoundation` over the same vault bytes for *fresh repository reload*, and its own report states that *rotated room* and *constrained-layout focus* still stand — so the arithmetic is sound and **nobody has re-run the audit to confirm it**. Session 13's controller ruled the 10/2/0 figure WRONG against the audit's published Net (R-S13-43), having found the session 13 handoff repeating it as though measured; that ruling is recorded here, and so is the derivation it did not weigh. **Do not quote either figure without its date and its instrument; the cheap way to settle it is to re-run the audit.** The superseded sentence, which stated the derived figure flatly, read: "Named tests: 10 covered, 2 partial, 0 absent (was 8/3/1 before the fix round). The two partial: rotated room is unit-level only at the door, and constrained-layout focus drives 460 px in `tests/harness/zoneOutline.test.ts` but leaves keyboard focus there unchecked while visual focus is ungradeable in jsdom at all." **Actions: 2–6 satisfied, Action 1 NOT** (no interaction specification document — L-31). **Deliverable: the smallest complete path, the updated user guide (`73af5eb95`) and behavioural tests are delivered; the real-screenshot clause is NOT satisfied and cannot be from here** (L-31). **So: closable against its Acceptance sentence, not against Action 1 or the Deliverable.** It is left OPEN rather than closed, because a package closed against criteria nobody checked is worse than one left open. **SESSION 13 — ACTION 1 SHIPPED at `3c0e01d21`, docs only.** `docs/superpowers/specs/2026-09-21-bp04-numeric-corner-editing-spec.md`, 312 lines, six sections one per Action, written AFTER slices A, A2 and B landed so every clause carries a file and a line rather than an intention; the 2026-09-12 side-panels design gains an APPENDED `## Amendment 1` and the two documents now point at each other. See L-31 for its home argument and for the thirteen-hour narrowing it records. **So the closability call moves by exactly one row: Actions 1–6 are now all satisfied, and the Deliverable's real-screenshot clause is the single remaining item — it needs a vault run and cannot be done from here.** Two things changed UNDER this package the same session without being BP-04 work: `outlineProposal`'s default `accepts` is now `simpleAreaOutline`, so the corner dialog refuses a self-crossing outline (L-29), and the submit button reads `dialog.form.submit` rather than "Apply name" (L-30, closed at `78b851ab2`). Both are recorded in the new spec. **And the refusal COPY got worse rather than better**: the sentence that dialog shows for a whole-outline refusal now answers three different causes — see the new L-33. |
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
| L-01 | **Closed for the Plan Editor only**, 2026-09-17, at `36a4c92f7..4966cbe7b`. A second Plan Editor pane on the same plan IS now gated by an open incident. | Closed by BP-02 slice 4 | 2026-09-16, closed 2026-09-17 | The shared `rp-save-state` store seeds a vault-pause ref from `activeWriteIncidentRegistry()?.anyOpen()` at setup, and each `ItemView` mounts its own Pinia (ADR-004), so a pane opened while an incident is open is gated from its first frame. An already-open pane catches up at its first refused write, because `withSaveStateTracking` now also marks on the gate's own refusal code. **The gesture itself is untestable here** — `duplicateLeaf` has zero hits in the repository and `FakeWorkspace` has no split and no layout restore (L-03) — so it rests on a mechanism test plus the unrun manual case `docs/tests/cases/Two panes on one plan under an open write incident.md`. | **Does not on its own unblock G1**, and the reason is L-13: the Asset Designer is not gated at all, so an open incident is still bypassed by opening a different SURFACE rather than a second pane. Two residues of this row are now L-14 (not reactive; a restored leaf seeds clean) and L-15 (copy). |
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
| L-11 | **Limitation.** What is OUTSIDE the vault-wide pause is neither listed nor checked anywhere | Measured 2026-09-17; stated, not fixed | 2026-09-17 | Measured by reading all thirteen reversible adapters against the single gate: `grep -rn "activeWriteIncidentRegistry()" src/` prints six lines and exactly one is the gate, inside `guardCommand`, which returns one door. **Outside:** delete-zone undo, assign-asset undo, both override adapters, `evidenceRename.ts`'s host-rename listener, and ADR-0034's geometry sidecar. **Inside:** create-zone, move, the two zone edits closed this session, calibrate. **Unmeasured:** `ReversibleSetPlanBackground`'s undo. **Measured 2026-09-18 (session 6):** the Asset designer edits are INSIDE the pause on their forward door and OUTSIDE it on their undo — see L-13 and L-16. | `docs/using-planning-recovery.md` now names the SHAPE and says outright that nothing lists or checks the set — no "only", no count. Three consecutive review rounds narrowed that sentence to something still wider than the truth before anyone measured it. Closing the category is L-06's subject. |
| L-12 | **CLOSED 2026-09-18** at `e118f61d4`. The user-guide sentence now says what the code does. | Closed by session 6, on a release owner's ruling | 2026-09-17, closed 2026-09-18 | The owner ruled the intended meaning was "version-checked", and the replacement word was VERIFIED before it was written rather than after: `relocateEvidence.ts:50` saves as `deps.plans.save(changed.value, loaded.version)` — the version the read returned, not a fresh read at write time — and `ObsidianPlanRepository` refuses on it twice, at `:183` before writing and again inside the `processFrontMatter` transaction at `:283`, so it is not a read-time TOCTOU window. `docs/using-planning-recovery.md:128` now reads "version-checked Plan writes". | The path is still OUTSIDE the vault-wide pause and L-11 still says so; this row only stops the guide claiming otherwise. The implementer was briefed to STOP and report rather than invent a different word if the path had turned out not to be version-checked. |
| L-13 | **RECLASSIFIED 2026-09-18, not closed: a FEEDBACK gap, not a data-safety hole.** The Asset Designer's forward writes ARE refused while an incident is open. | Reclassified by session 6's measurement; the 2026-09-17 row this replaces rested on an ASSUMPTION nobody had driven | 2026-09-17, reclassified 2026-09-18 | The 2026-09-17 finding — that `grep -rn "writesBlocked()" src/` returns call sites only under `src/presentation/editor/`, so the designer's correct `writesBlocked` value is read by nothing — is **still true and unchanged**. What was never measured is the sentence beside it, in `designerIncidentGate.test.ts`'s own header: *"Every write it dispatches is refused by the guarded doors underneath."* That is now checked. `tests/presentation/designer/designerIncidentRefusal.test.ts` builds the bundle through the REAL `guardAssetDesign` — which both shared designer harnesses (`designerRig.ts`, `assetDesignHarness.ts`) do NOT, building raw command instances instead, so no designer test in this repository could observe the gate at all before this one. It asserts: both the NOTE door (`setHeight`) and the GEOMETRY door (`setAnchor`) refuse with `WRITES_PAUSED_CODE` **and leave their port unwritten** — the data-safety half, since a refusal raised after the write would pass the code assertion and fail this one — plus a CATEGORY case iterating every command member of the guarded bundle, both doors each, discovered by shape, with the excluded `get` query asserted by name and a found-something-at-all floor. All three go red when the gate is removed; the controller ran that revert itself. | **What is left is the affordance, which is L-14's shape and is accepted there**: the user sees an enabled control that refuses on use. **G1 is NOT unblocked by this reclassification** — a release owner ruled on 2026-09-18 that the designer's UNDO half, which this same measurement found writes through raw ports while an incident is open, is a NEW limitation (L-16) and G1 stays blocked on it. |
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
| L-34 | **Limitation, NEW 2026-09-21.** Four more shipped strings tell the user to open the diagnostics report and give them no way to do it | Measured by session 14 during the diagnostics recon; scoped out deliberately | 2026-09-21 | The Plan Editor half of the inversion is closed (`b226b6c67`), but the recon measured that **five** shipped strings name that report, not one. Still action-less: `view.project.some-plans-unreadable` (two renderers), `zone.listing-incomplete`, `asset.listing-incomplete`, and `view.asset-library.some-unreadable` — whose button opens a **note**, not the report. The project-list half of the original inversion is also untouched: it has the report and no sentence pointing at it. | Does not block a first beta on its own; it is the status quo on four surfaces. **Cheaper than it was**, because `b226b6c67` built the composition-root callback seam these would reuse. Revisit as one slice rather than four patches. Recorded in `docs/issues/The diagnostics snapshot has no surface that reaches it.md`, second amendment. |
| L-35 | **Limitation, NEW 2026-09-21, and it is about the harness rather than the product.** The `?unreadable=N` capture draws every zone while the strip says two could not be read and are **not drawn** | Found by the controller driving the harness in a browser; priced and deliberately not fixed by the fix round | 2026-09-21 | Verified by the controller at 1280 and 460 in a real browser, and again in `harness-shots/plan-editor-unreadable-narrow.png`: the error band is correct and the button is a real `button` with the accessible name **Show diagnostics report**, but the canvas behind it still draws all four zones. In production an unreadable zone genuinely is not drawn, so the FIXTURE disagrees with the product. Pruning was costed and refused as too coupled — it reaches `HARNESS_STRUCTURE`s walls, `zoneInspectorAnswering`, and the sacrifice zone that `?stale` **throws** without. A caveat now sits directly above the two `SHOTS` rows, where a reader of the pictures meets it. | No shipped code is affected — the knob is harness-only. The risk is a **misleading picture**, which this project has already paid for once. **The earlier mitigation of "there is no capture to misread" is now spent**, because this work added two. Revisit by pruning the drawn set as its own increment. A separate recommendation from the same round: make `mountPlanEditorHarness` **refuse** a discarded knob combination loudly, turning a silently wrong capture into a failing one. |
| L-36 | **Limitation, NEW 2026-09-21 — an OWNER copy question, deliberately not decided.** English describes the two axis labels of one form in two different registers | Measured by session 14; left alone on a ruling | 2026-09-21 | `en/structure.ts` reads `Starting horizontal coordinate (m)` for x and (now) `Start Y (m)` for y, while German writes a symmetric pair. **Git cannot settle why**: `git log -L` returns one entry, both lines born in `866ccc38e` with those values, and `Start x (m)` has never existed in any English locale file. **But the gate can.** Writing `Start x (m)` at clean HEAD with the acronym widening OFF **reports** (a lowercase `x` is a finding, because `brands.js` carries `X` and the rule demands the brand casing) while `Start y (m)` does not — and the rule was already live when `866ccc38e` was authored. So that author faced exactly "finding on x, none on y", and shipped a long phrase on x and an untouched y. That is the signature of copy bent around the rule, which `eslint.config.mjs`s own docblock forbids. | **Left alone deliberately, and the session did not make it worse** — `en.y` and `de.y` agreed before and agree now. Both remedies are copy judgements no measurement decides: restoring `Start X (m)` trades a more descriptive label for a terser one, and the better symmetry (a long-form y) needs real translated German, which **L-15 blocks**. Revisit when an owner rules on minting, alongside L-33s residue. |

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
| G1 — data trust | **Unchanged by session 14 as well, which touched none of L-06, L-19 or L-21 and deliberately did not absorb or decide any of them.** Not evaluated, and **unchanged by session 13, which touched none of L-06, L-19 or L-21** — **BP-03's five gaps are now closed or accepted, and the L-06 category remains**; L-13 and L-16 are closed; L-19 and L-21 are accepted limitations, each carrying an open release-owner question | BP-01's rebind survival is implemented and tested. BP-03: F2 closed with a measured regression; F1 measured, ruled and documented, its arm question needing one vault run; **F3 found and fixed a real P0 and its column is locked at 1 of 6**; F4 and F5 measured clean and locked. Two owner calls stand between here and an evaluation — L-19's cold arm is a duplicate-project risk, and L-21 asks whether a still-mounted view may write to the vault at all once `onunload` has run. Neither is the controller's to decide and neither has been run in a vault. |
| G2 — core journey | **UPDATED 2026-09-21 (session 14). L-33 is CLOSED** (`b512f2db6`), and the fix was not the shape its row proposed: the code-to-copy mapping was costed and **refused on measurement** because it buys nothing user-visible, and what shipped is a one-line key swap to the both-locale `error.category.geometry` — **recorded as a deliberate departure from a declared fallback-tier convention, not as a clean win**, with the minted-sentence alternative surfaced as an owner question. Its measurement fired a STOP that **prevented a regression**: `editor.resize.invalid` has THREE render sites and is CORRECT at two, so editing the string would have broken the room width/depth dialog; `5f3895acd` now pins both correct sites, after a reviewer swapped the key at both and 179 tests stayed green. **The diagnostics-surface inversion is HALF closed** (`b226b6c67`): the Plan Editor`s `unreadable-zones` row has its door, injected as a callback from the composition root because `presentation/` may not reach `src/plugin/`, landing on the same public method the palette command and the settings row already call — **no locale string minted**. **L-32 stands unchanged.** **BP-04`s test figures are SETTLED by re-running the audit: 10 covered / 2 partial / 0 absent, confirmed on this tree**, moving that reading from a derivation nobody checked to a measurement — though item 3`s recorded *reason* is now stale while its verdict holds. **Three new limitations, and none of them found by a gate: L-34** (four more shipped surfaces name the diagnostics report and offer no way to reach it), **L-35** (the new `?unreadable` capture draws zones the strip says are not drawn and distorts the Floor Inspector through the same fake) and **L-36** (English describes one form`s two axis labels in two registers, an owner copy question left undecided). A lint rule`s **vocabulary** was widened rather than its copy bent (`63ecd9fd9`), after the controller`s own typo ruling was measured false — an uppercase `X` passes the marketplace sentence-case rule only because a social network is named X. **One German string was touched, by exactly two characters, under a narrow recorded ruling** that permits a case change to a standalone Latin axis letter and nothing wider. **FOUR generations of the same wider-than-its-check overclaim were found and closed this session**, the last three each introduced by the commit fixing the previous one, and the fourth closed by **deletion** rather than correction (`2ce9b424e`). G2 still waits on BP-05 to BP-07. **No full `npm run check` was run locally this session, deliberately — CI on the pull request is the report, and no CI run was cancelled.** **Nothing here has been run in an Obsidian vault.** The superseded session 13 text follows. **UPDATED 2026-09-21 (session 13).** **One of BP-04's two unreachable-from-here items is now DONE**: Action 1 has its artifact (`docs/superpowers/specs/2026-09-21-bp04-numeric-corner-editing-spec.md`, `3c0e01d21`), so L-31 is half closed and **the Deliverable's real-screenshot clause is the only BP-04 item left that cannot be done from here** — it needs a vault run. **L-29's WRITE side is NARROWED, not open and not closed**: all four editor write doors now refuse a self-crossing outline (`e9b982706`, `7c38db05c`, `0ad89aea3`, `74cfe8647`), with CI success at `7c38db05c` (run 35577104683) and `0ad89aea3` (run 35585566311) and `74cfe8647`'s run 35589022563 **still in flight when this row was written**. What L-29 does NOT cover: the asset designer's own two doors, SDD §26's "shown spatially" clause which nothing satisfies, and any detection, migration or diagnostic for crossing outlines already in vaults — so a Requirement figure derived from one is **still wrong and still silent**. **L-30 is CLOSED** (`78b851ab2`). **L-23 and L-22 are untouched and stand**, and L-23 was left open deliberately so that a predicate would not decide an owner question by accident. **Two new limitations were opened by LOOKING rather than by a gate: L-32** (no capture in this repository has ever shown a dialog's actions row) and **L-33** (one sentence answers three different whole-outline refusals, and this session's own predicate added the third). G2 still waits on BP-05 to BP-07. **No full `npm run check` was run locally this session, deliberately, under the parallel-work rule — CI on the pull request is the report.** **Nothing here has been run in an Obsidian vault.** The superseded session 12 text follows. Not evaluated, and **not advanced to a user** yet. **BP-04 is now reachable in the UI from two doors and all three slices are CI-green** (`1f2cf7cf8`, `73af5eb95`, `2cf585a40`), so the sentence this row carried for two sessions — "nothing in the UI opens either" — **is no longer true and L-24 is closed**. What G2 still waits on is BP-05–BP-07, plus BP-04's own two unreachable-from-here items (L-31: no interaction specification, and a real-screenshot clause needing a vault run). **Three geometry holes were measured this session and none is fixed** — L-23 is LIVE (a vertex drag writes a zero-area Zone to the vault), L-29 is new and refused by nothing at all, L-22 stands; together they are one geometry-validation decision with a trust-boundary cost. The superseded text follows. BP-04 slices A **and A2** are implemented and CI-green, and **nothing in the UI opens either** — the reach is slice B, which is blocked on the OWNER | BP-04–BP-07. BP-04's domain half ships already (`ReversibleMoveZoneCommand`), so the package is smaller than the plan assumed in that direction and LARGER in another: **that larger half is now BUILT** — session 11's slice A2 added the per-corner selection state BP-04's contract needs, in `tools/render-state.ts` and `layers/InteractionLayer.vue`, two files no budget table ever named. Slice A delivered the whole-outline numeric path (`6546f402c`, `152a3c18c`); **slice A2 the chosen-corner list and the canvas highlight (`8bfd6dd6a`, `b6b6a1f27`, `e2d524a9b`)**; slice B is blocked on OWNER COPY rather than on work (L-15), and it is the **only** thing left before BP-04 is closable. **A2's own limitations, found by capture and by nothing else: L-26** (the corner list is additive, so the dialog roughly doubled in height) and **L-27** (at a sidebar's width the modal covers the canvas, so the highlight cannot be seen at the one width BP-04's test case 12 is about). L-24 records that no gate can see slice A's unreachability in either direction, and L-25 that the German half of its reused title key has no instrument. L-22 and L-23 remain open, neither caused by BP-04 and neither fixed. **Nothing here has been run in an Obsidian vault.** |
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
