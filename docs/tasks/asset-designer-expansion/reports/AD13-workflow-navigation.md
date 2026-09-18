# Task report — AD13 (navigation half)

Outcome: **partially implemented** — the navigation ships and is tested; the hand-off that would
arm the plan editor's placement tool with the asset is **blocked on three files outside this
lease** and is filed as an integration change request below.
Owner / worktree / branch: AD13 navigation worker · `.worktrees/ad13a` · `ad13a-workflow`
Base commit / candidate commit: `ae6bb2a63` / **`3b6c895d4`** (the fix round; the reviewed
candidate was `cc9cb4d92`, recorded at `5c0ffbf35`)
Review outcome: **REQUEST CHANGES**, six findings, fixed in the round recorded in
[Fix round](#fix-round--what-the-review-returned-and-what-changed) — read that section before the
rest of this report, which is the pre-review account with the corrections marked in place.
Accepted contract revision: `r1`
Allowed scope and shared-file leases: `AssetDesignerRoot.vue`, `AssetDesignerContext.ts`,
`AssetDesignerView.ts`, `inspector/DesignerInspector.vue` plus new `DesignerUse*.vue`,
`plugin/assetDesignerDeps.ts`, `plugin/RenovationPlannerPlugin.ts`,
`plugin/renovationProjectOpenSeams.ts`, `plugin/assetDesignerCommands.ts`,
`infrastructure/obsidian/workspace/revealPlanEditor.ts`, `library/AssetLibraryView.ts`
(additive only), `i18n/locales/{en,de}/assetWorkflow.ts`, new test files under `tests/`.
**Nothing outside that list was edited** — `git diff --name-only` against the base is the check.
`plugin/assetDesignerCommands.ts` was leased and turned out to need no change.

## Fix round — what the review returned, and what changed

The reviewer returned **REQUEST CHANGES** with six findings. Criterion 1 was adjudicated in the
shipped design's favour: the button is an honest partial step rather than a live control that does
nothing, on a fact this report had not argued and the reviewer found —
`src/presentation/editor/add/AddMenu.vue:71` already binds an asset picker inside the plan editor,
so a user who arrives is not stranded and the gesture shortens a five-step journey to four.
Criterion 1 stays **unmet with a trigger** (ICR 1), and the never-draw-a-refusing-control rule does
not bite.

| # | Finding | What was done |
|---|---|---|
| **F1** | BLOCKING. `src/plugin/RenovationPlannerPlugin.ts` at **405** counted lines against the 400 cap, so this diff turned `npm run check` red | **Fixed by extraction.** `usePlan` is composed inside `assetDesignerDeps` off the `root` and `app` it already receives, so the import and the five-line `options` literal both leave the plugin file; the options object is now INLINE in the `assetDesignerDeps(...)` call, which also drops the `const options` line. `npx eslint` on that file: **exit 1 before, exit 0 after**; counted lines **405 → 399**, against a base of exactly **400**. No budget raised and no suppression (none is available — `linterOptions.noInlineConfig`) |
| **F2** | Required. A double press stacked two plan pickers: `new PlanSuggestModal(...).open()` with nothing tracking an open one, and `usePlan()` synchronous up to `.open()` | **Fixed**, through the F5 extraction. `planPicker` refuses while one of its own pickers is open, the shape `assetPlacementTask.pickPlaceable` spells as `if (dialogs.current !== null) return null` (that is Pinia and `plugin/` cannot reach it, so the flag is the closure's). Released through `onClose`, so a dismissal and both orderings of a choice all re-arm it. Two cases, both watched red. **The release CHAINS the inherited `onClose` rather than replacing it** — `obsidian.d.ts` declares `onClose` on `Modal` only, so whether `SuggestModal` implements teardown of its own is unknowable from here and the mock's is a no-op; a bare assignment would shadow it and leak a scope per dismissal, and no gate here could see that. Disclosed as the one thing about this fix that rests on a fake being thinner than Obsidian |
| **F3** | Required. The cited assertion proved nothing: `expect(open.state?.state).toEqual({ planId: GROUND })` passes whether or not the leaf was re-stated | **Verified and fixed.** Confirmed by temporarily re-stating the existing leaf in `revealCandidate` with BOTH assertion forms in the case: the old one passed and the new `expect(open.state).toBe(before)` failed in the same run. The case now carries the identity form, cites the sibling that owns the property, and its comment records the vacuous version. Criterion 2's evidence row is corrected below |
| **F4** | Your call. A plan reached this way never entered the `Continue` group | **Fixed rather than disclosed.** The seam now takes `rememberContinue` and records `{ projectId, planId }` on `'opened'`, on the same condition `openPlanPicker` uses. The already-open arm deliberately does NOT — it has a `planId` off a leaf's view state and no project — and the docblock states that, with why no record is owed there. Two cases, both watched red |
| **F5** | Recommended. The seam's tail was a structural clone of `openPlanPicker`'s | **Taken, and half-closed on purpose.** `planPicker` is the extraction and it closes F2 and F4 with it. It is NOT adopted by `openPlanPicker`, because `src/plugin/planEditorCommands.ts` is outside this lease — so the clone family survives until one call-site swap, which is named in ICR 5 below rather than left for `npm run analyze` to find |
| **F6** | Informational, your call. The picker's placeholder is `tr('command.open-plan-editor')`, a palette command's name | **Declined, with reasoning.** Two counts. The string is a description of what choosing DOES — it opens the plan editor, which is exactly what this gesture does — so it is imprecise about provenance rather than wrong about behaviour. And `PlanSuggestModal` is in `presentation/modals/`, outside this lease: parameterising a placeholder means editing a shared file and threading an argument through its one other caller, for a cosmetic gain. If the integrator wants it, the string goes in the `{en,de}/assetWorkflow.ts` pair and the modal takes an optional placeholder |

**What the fix round did NOT touch**, each by instruction: `styles/designer.css` (ICR 3, the
integrator's), the asset hand-off and `ProjectOrigin` (ICR 1, the integrator's — and the reviewer
found that plan incomplete, a fourth file being owed because `PlanEditorView.getState()` persists
`this.origin` into the workspace layout and nothing clears it), and the mobile `checkCallback`
(ICR 4, ruled owed after integration).

**One thing the fix round could not leave room for, stated because it was asked for.** ICR 4 adds
about four code lines to `RenovationPlannerPlugin.ts`, and that file is at **399** of 400 after
this extraction — one line. There is no further extraction available inside it that is not churn on
lines this branch never touched: `indexScanCompleted` and `openLibrary` both close over `this`, and
everything this diff added to the file is already gone. The obvious source of the lines, when ICR 4
is taken, is collapsing the four three-line `callback: () => { this.xxx(); },` bodies to the
one-line form this file already uses elsewhere — worth eight. That belongs in ICR 4's own change,
where it is a prerequisite rather than unrelated reformatting.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/i18n/locales/en/assetWorkflow.ts` | The one new string, `designer.inspector.use-in-plan` | yes |
| `src/presentation/i18n/locales/de/assetWorkflow.ts` | Its German counterpart, Sie register (no imperative verb in it at all) | yes |
| `src/presentation/designer/inspector/DesignerUsePlan.vue` | NEW. The "Use in plan" control and the predicate that decides whether it is drawn | yes (`DesignerUse*` prefix) |
| `src/presentation/designer/inspector/DesignerInspector.vue` | Mounts it, beside `Open library`; carries the optional `usePlan` prop through | yes |
| `src/presentation/designer/AssetDesignerRoot.vue` | Binds `:use-plan="context.usePlan"` | yes (integrator lease) |
| `src/presentation/designer/AssetDesignerContext.ts` | `AssetDesignerDeps.usePlan?: () => void` | yes (integrator lease) |
| `src/presentation/designer/AssetDesignerView.ts` | Passes it from deps into the leaf's context | yes |
| `src/plugin/assetDesignerDeps.ts` | COMPOSES the seam off `root`/`app` (fix round, F1) and takes `rememberContinue` in `options` (REQUIRED there) | yes (integrator lease) |
| `src/plugin/RenovationPlannerPlugin.ts` | Binds `rememberContinue` into the designer bundle's inline options; `open-asset-library`'s docblock records why its mobile `checkCallback` is ICR 4 rather than this change. Net **one line below** its base count after the fix round | yes (integrator lease) |
| `src/plugin/renovationProjectOpenSeams.ts` | NEW `planPicker` (the guarded one-picker door, fix round F2/F5) and NEW seam `assetDesignerUsePlan` — which plan, then the one shared reveal door, then the Continue record | yes |
| `src/infrastructure/obsidian/workspace/revealPlanEditor.ts` | Exports `planIdOf`, so `plugin/` asks "which plan is this leaf on" the same way the matcher does | yes |
| `src/presentation/library/AssetLibraryView.ts` | Additive: the mobile gate in `onOpen` | yes (additive only) |
| `tests/plugin/assetDesignerUsePlan.test.ts` | NEW. The destination rule, the shared activation, cancel, empty vault, no index — plus the fix round's four cases (one picker per tick, the guard's release, the Continue record and its absent-project arm) and F3's corrected identity assertion | yes |
| `tests/presentation/designer/designerUsePlan.test.ts` | NEW. The control's predicate and the whole binding chain through the real root | yes |
| `tests/presentation/library/assetLibraryMobile.test.ts` | NEW. The library's own refusal and that nothing is mounted behind it | yes |

## What was built, and the channel decision stated

**"Use in plan" in the designer inspector** → `AssetDesignerContext.usePlan` →
`assetDesignerUsePlan` (composition root) → **exactly one documented destination rule**:

- **one plan open in a Plan Editor** (ids deduplicated, so two leaves on one plan is still one
  plan) → continue into that leaf;
- **anything else** — none open, or two different ones — → the EXISTING `PlanSuggestModal` over the
  Project Index's plan entries;
- **no plans in the vault, or no index composed at all** → `notify(tr('plan.none'))`, no picker.

Every accepted destination goes through `renovationProjectOpenPlan`, the same binding the palette
command and the project surface take, so there is one activation and one fault mapping — no second
picker and no second reveal (AD08-R1's shape rule, and CLAUDE.md's "one action, every input").

**How the asset is handed to the opened editor: it is NOT, and that is a blocked channel rather
than an omission.** Traced before writing anything:

1. `revealPlanEditor(deps, type, planId, origin?)` carries an `origin` and
   `prepareEditorArrival` writes `{ ...state, planId, origin }` onto the leaf — the only route
   into an editor that is ALREADY open (`revealCandidate` sets a view state on a leaf it created
   and on no other, which is exactly why continuing into an open plan preserves its camera).
2. That `origin` is `ProjectOrigin` (`src/application/navigation/ProjectDestination.ts`), whose
   optional members are `roomId`, `workId`, `costId`. `projectOriginFrom` whitelists those three
   by name, so an `assetId` added to the object literal does not type-check and, cast past that,
   would be **stripped** on the way into `PlanEditorView`.
3. Worse than inert: the bare `{ planId }` that survives reaches `useEditorArrival.reveal`, whose
   `recordFor` finds nothing, so it raises `notifyWarning(tr('schedule.return-missing'))` and
   answers `false` — a spurious warning about a record nobody asked for. **Measured by reading
   those three functions, not by shipping it.**

So this half passes **no `origin`**, the control's docblock states its reach, and the ICR below is
the change that completes it. Putting an asset-arming mechanism anywhere in this lease instead
would be a second placement path, which the card, the contracts and the dispatch all refuse.

**"Plan → Edit shared asset → return" — half of it exists and half is somebody else's door.**
The RETURN is what this ships and is what criterion 2 names: because `assetDesignerUsePlan`
prefers a Plan Editor already open and `revealCandidate` never re-states an existing leaf's view
state, returning to the plan leaves its selection and camera exactly as the user left them. The
OUTBOUND door — a control on a placed asset in the plan editor that opens the designer — **does
not exist anywhere in `src/`** (`grep -rn "openDesigner\|ASSET_DESIGNER" src/` outside
`src/presentation/designer/` prints only the plugin shell, the two designer command/deps modules
and the library's own binding). Adding it means editing the plan editor's element inspector, which
is outside this lease; it is ICR 2.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| 1 — a measured preset reaches a real plan at its canonical size and orientation | **unmet, with a trigger** (reviewer's adjudication; this report first called it "partially met") | The navigation half is met: `tests/plugin/assetDesignerUsePlan.test.ts` opens the Plan Editor on the chosen plan and on the one already open. Size and orientation are `domain/spatial/assetPlacement`'s and AD05's, untouched here | The gesture does not ARM the placement tool, so the user picks the asset once more inside the editor — `AddMenu.vue:71`'s picker, so the journey is four steps rather than stranded. ICR 1 is the trigger |
| 2 — returning to the original plan preserves selection/viewport as the host state contract supports | **met — on the SIBLING's evidence, not on this file's** | `tests/infrastructure/obsidian/workspace/revealPlanEditor.test.ts` → `does not re-set the view state of a leaf it found`: `expect(existing.state).toBe(before)`, an identity check a re-state cannot survive, at the layer that owns the property. `assetDesignerUsePlan.test.ts`'s own case now carries that same `toBe` form through the seam — its FIRST version asserted `open.state?.state` deep-equal and proved nothing, which is F3 and is measured in the fix round's red table | Whether Obsidian's own pane restores scroll is not checkable here; `FakeLeaf` records asks |
| 2b — a plan reached this way enters the `Continue` group | **met** (fix round, F4) | `records the Continue context for the plan it picked` and `records nothing for a picked plan whose entry names no project` | The already-open arm records nothing, deliberately and for a stated reason — the seam's docblock carries it |
| 4 (this half's paths) — no asset ID or reference points to an orphan after cancel or failure | **met for the paths added** | `creates and reveals nothing when the pick is dismissed`; and no path in this half writes to the vault at all — the seam creates a leaf or a notice and nothing else | Duplication's multi-file recovery is the other worker's |
| 6 — unsupported mobile navigation follows the actual platform gate instead of opening a broken designer | **met at ONE of the designer's two sites** | `tests/presentation/library/assetLibraryMobile.test.ts`: the surface draws the shared desktop-only sentence and mounts nothing behind it — one element under `contentEl` against fifteen with the gate removed. That is the load-bearing site, and the only one that answers a leaf restored from a workspace layout. The designer's own two gates are unchanged | The palette half (`open-asset-library` as a `checkCallback`) is **not shipped** — it reddens two existing cases in `tests/plugin/registration.test.ts`, which is outside this lease. ICR 4. Also `ViewRoot`'s "Open library" button stays ungated, exactly as its "Open in designer" button is — noted in `AssetLibraryView.onOpen`'s docblock, not fixed here |
| 3, 5 | **not this half** | Duplicate as new asset and usage scope are the second worker's items 3–5 | — |

## Executed checks

All on `ad13a-workflow`, Windows 11, Node from the worktree's copied `node_modules`,
`TEMP=TMP=D:/tmp-claude`.

| Command | Exit code | Evidence |
|---|---|---|
| `npx vue-tsc -noEmit` (whole tree, `src/` + `tests/`) | 0 | no output |
| `npx vitest run tests/plugin/assetDesignerUsePlan.test.ts` | 0 | 8 passed |
| `npx vitest run tests/presentation/designer/designerUsePlan.test.ts` | 0 | 7 passed |
| `npx vitest run tests/presentation/library/assetLibraryMobile.test.ts` | 0 | 4 passed |
| `npm run check:fast -- tests/presentation/designer tests/presentation/library tests/presentation/views` | 0 | 149 files, 1834 tests passed (includes `regionsReachable.test.ts` and `assetDesignerRoot.test.ts`) |
| `npm run check:fast -- tests/plugin tests/build/libraryComponentStyles.test.ts tests/build/registration-locality.test.ts tests/build/localeModuleSentenceCase.test.ts tests/presentation/i18n` | 0 | 58 files, 628 tests passed |
| `npm run check:fast -- tests/harness` | 0 | 32 files, 388 tests passed (the axe-core scans over the real mounted surfaces) |
| the same plugin batch WITH the `checkCallback` in place | **1** | 2 failed / 828 passed — `registration.test.ts` `opens the asset library from its own command` and `reports a real activation fault …`. See ICR 4 |
| `node scripts/lint-edited.mjs` per edited file (the repository's own edit-loop hook) | 0 on every file after fixes | it reported and I fixed: an unused import in the seam, a duplicate `notify` import, `DesignerUsePlan` imported-but-not-rendered in the inspector, and five `unicorn/no-array-callback-reference` hits from handing `wrapper.find` a constant |

### Tests watched FAILING first, and what the red said

Every invariant below was reverted, run, seen red, and restored.

**A note on HOW, corrected after review.** The first version of this paragraph described a
discipline — each break asserting that its own replacement text was found, because a patch that
silently matches nothing leaves a green run looking like a passing test (which happened once, at
break 4's first attempt). The reviewer looked for a shipped artifact for that and found none,
correctly: there is no helper in the diff and there never was. It is a description of how the
breaks were driven — each one applied by a throwaway script asserting `count(old) == 1` before
writing, so a stale anchor throws instead of no-opping — and not something the tree holds or
anybody can re-run. Read it as method, not as a check.

| Break | Red | What the failure said |
|---|---|---|
| 1. `const only = undefined` — never continue into an open editor | 2 failed / 6 passed | `expected [ PlanSuggestModal{ …(5) } ] to have a length of +0 but got 1`, on both the one-open and two-leaves-one-plan cases |
| 2. drop the `new Set(...)` dedupe | 1 failed / 7 passed | same message, on `treats two leaves showing the same plan as that one plan` alone |
| 3. `.map(planId => planId ?? 'undefined')` instead of filtering | 1 failed / 7 passed | `expected [] to have a length of 1 but got +0` — the picker was never opened, because a stateless leaf read as one plan |
| 4. `plans.length === -1` — no empty-vault notice | 2 failed / 6 passed | `expected [] to deeply equal [ Array(1) ]` twice (no plans, and no index) |
| 5. root stops binding `:use-plan` | 1 failed / 6 passed | `expected false to be true` on `is carried from the leaf context through the root to the inspector` — the `lockedGraphics` defect, caught |
| 6. predicate weakened to `usePlan !== undefined` alone | 2 failed / 5 passed | `expected true to be false` on both refused shapes |
| 7. library mobile gate deleted | 2 failed / 2 passed | `expected undefined to be 'This surface is not available on mobi…'` and `expected [ 'renovation-asset-library', …(14) ] to deeply equal [ 'rp-view-message' ]` |
| 8. `open-asset-library` as a `checkCallback` (the change I then REVERTED) | 2 failed / 828 passed in `tests/plugin` | `expected [] to have a length of 1` and `expected undefined to be 'error'`, both in `registration.test.ts`, which drives that command through `command?.callback?.()`. Optional chaining is why it fails on the assertion rather than on the call. This is the measurement behind ICR 4 |

### Fix round — checks and reds

All on `ad13a-workflow`, same box, `TEMP=TMP=D:/tmp-claude`.

| Command | Exit code | Evidence |
|---|---|---|
| `npx eslint src/plugin/RenovationPlannerPlugin.ts --max-warnings 0` **before** | **1** | `1209:1 error File has too many lines (405). Maximum allowed is 400 max-lines` |
| the same command **after** | **0** | no output |
| the same file under `--rule '{"max-lines":["error",{"max":1,…}]}'` | 1 (by construction) | `File has too many lines (399)` — and the BASE content through `--stdin --stdin-filename` reports **400**, so the file is one line below where it started |
| `npx eslint` on all three changed source files | 0 | no output |
| `npx vue-tsc -noEmit` (whole tree, `src/` + `tests/`) | 0 | no output |
| `npx vitest run tests/plugin/assetDesignerUsePlan.test.ts` | 0 | 13 passed (8 before the round) |
| `npm run check:fast -- tests/plugin tests/presentation/designer tests/presentation/library tests/build/registration-locality.test.ts tests/build/libraryComponentStyles.test.ts` | 0 | 132 files, 1541 tests passed |
| `npm run check:fast -- tests/plugin tests/presentation/designer tests/presentation/library tests/infrastructure/obsidian/workspace tests/build/registration-locality.test.ts tests/build/localeModuleSentenceCase.test.ts` | 0 | 138 files, 1669 tests passed — `tests/infrastructure/obsidian/workspace` added because F3's evidence now cites a case in that directory and F2 reasons about `revealCandidate` |

Each break below was applied by a script that refuses a stale anchor, run, seen red, reverted.

| Break | Red | What the failure said |
|---|---|---|
| **A (F3).** Re-state the existing leaf inside `revealCandidate`, with BOTH the old and the new assertion in the case | 1 failed / 11 passed | `AssertionError: expected { Object (type, active, ...) } to be { Object (type, state) } // Object.is equality`. The old `toEqual({ planId: GROUND })` sits ABOVE it in the same case and PASSED — which is the measurement F3 asked for: the old form is vacuous and the new one is not |
| **B (F2).** Drop `if (picking) return;` | 1 failed / 11 passed | `expected [ PlanSuggestModal{ …(6) }, …(1) ] to have a length of 1 but got 2`, on `opens one picker for two presses in the same tick` |
| **C (F2).** Keep the guard, drop the `onClose` release | 1 failed / 11 passed | `expected [ PlanSuggestModal{ …(5) } ] to have a length of 2 but got 1`, on `asks again after a picker is dismissed` — the flag-never-cleared defect, which is a button that works once per session. **Re-watched (C2) after the release was rewritten to chain the inherited hook**, with the identical red, because a break watched against a different spelling of the code is not a break watched |
| **D (F4).** Drop the `rememberContinue` call | 1 failed / 11 passed | `expected [] to deeply equal [ { …(2) } ]` |
| **E (F4).** Keep the call, drop the `plan.projectId !== undefined` guard | 1 failed / 11 passed | `expected [ { projectId: undefined, …(1) } ] to deeply equal []` — a context with a hole where its project should be |
| **F (F4).** Weaken `outcome === 'opened'` to `outcome !== undefined` | 1 failed / 12 passed | `expected [ { …(2) } ] to deeply equal []`, on `records nothing when the reveal fails` — the condition's THIRD arm, driven so the new branch is not an untested arm hiding inside a slack metric |

**One case passed trivially and was rewritten because of break 7.** `mounts no catalogue behind
the refusal` first asked for `.rp-al-shelves` to be absent and for one child element — both of
which are TRUE of a mounted library that has not finished reading. It stayed green with the gate
deleted. It now compares every class under `contentEl` as a list, which can be true of nothing but
the refusal alone; break 7 then reddened it (15 elements against 1). This is the whole argument
for watching a test fail rather than writing it and moving on.

## Verification not performed

**Unchanged by the fix round**, and worth restating because that round is where a red was found
that all of the checks below would have caught: `npm run check` is still the definition of done and
is still the integrator's, so `eslint .` over the whole tree and the coverage floors remain
unverified by me. What the fix round DID add at that boundary is a direct `npx eslint` on each
changed source file, which is the instrument that found F1 and the one that now reports exit 0 on
all three.

- **`npm run check` (the definition of done), `npm run test:coverage` and `npm run analyze`** —
  not run, by dispatch instruction: the integrator runs those serially, and two heavy commands on
  this box produce wrong reds. So the coverage floors (99/99/99/98) and **`eslint .`** — the layer
  bans, `WRITE_BOUNDARY`, `I18N_LITERAL_BAN` and `NOTICE_TEXT_BAN` — are unverified by me. The
  per-file hook ran oxlint on every edited file and ESLint on every edited `.vue`, which is not
  the same thing and does not stand in for it.
- **`npm run test-build` and every manual case under `docs/tests/`** — impossible: no Obsidian in
  this environment. So the library's mobile refusal, the new button's appearance beside its three
  siblings, and whether a real Obsidian pane restores an editor's scroll on reveal are all
  **unverified in a host**. Criterion 2's evidence is the mechanism plus a fake that records asks,
  not a vault.
- **`npm run harness-shot`** — impossible: no pinned Chromium here and no `RP_CHROMIUM_EXECUTABLE`
  named. This matters more than usual for this change, because the one visual defect I know I am
  shipping (ICR 3, the unstyled button) is exactly the kind only a capture shows.
- **`npm run harness`** — not run; it needs a browser and a person.
- **Two projects sharing a definition, and failure-after-note-creation/before-sidecar-save** (the
  card's Required verification) — not exercised: both are about the duplication and usage-scope
  half, which is the second worker's.
- **The rest of `tests/` and the rest of `tests/build/`** — not run. What I did run is the four
  directories this change can reach plus the three build checks most likely to be disturbed by it
  (`libraryComponentStyles` for an emitted class, `registration-locality` for a registration,
  `localeModuleSentenceCase` for the new string); everything else is the integrator's full gate.

## Integration change requests

Precise, and none of these files was touched.

**ICR 1 — the asset hand-off channel (three files).** Needed for criterion 1 to be fully met.

1. `src/application/navigation/ProjectDestination.ts`: add `readonly assetId?: string` to
   `ProjectOrigin`, and add `'assetId'` to the `['roomId', 'workId', 'costId'] as const` key list
   in `projectOriginFrom` (that loop already does the trimming and the optional-spread, so this is
   two edits, both one token).
2. `src/presentation/editor/renovation/editorArrival.ts`: `reveal(origin)` must take an
   `origin.assetId` arm BEFORE its `recordFor`/`target` logic, and arm placement instead of
   selecting a record. Today an origin with no `roomId`/`workId`/`costId` falls through to
   `notifyWarning(tr('schedule.return-missing'))`, which is why this half passes no origin at all.
3. The arming primitive: `src/presentation/editor/elements/assetPlacementTask.ts` needs
   `choose`-without-the-picker — resolve the id through `context.queries.assetShapes`, refuse
   through the existing `REFUSALS` map, `Object.assign` the draft and `runtime.setTool('place-asset')`
   — exposed to `editorArrival` through `spatialEditing.ts`/`runtime.ts`. `choose` already contains
   every one of those steps; the split is picker versus known id, not new behaviour.
   Then `assetDesignerUsePlan` passes `{ planId, assetId }` as the origin and
   `DesignerUsePlan.vue`'s docblock narrows to what it then does.
4. **A FOURTH file, found by the reviewer and not by me** — recorded so the plan is not read as
   complete: `PlanEditorView.getState()` persists `this.origin` into the workspace layout and
   nothing ever clears it, so an `{ planId, assetId }` origin would survive an Obsidian restart
   and re-arm the placement tool weeks later. The integrator is handling ICR 1 and this with it.

**ICR 2 — the outbound "Edit shared asset" door from a plan.** A control on a selected asset
placement that calls `renovationProjectOpenAsset(...)` (already composed, already used by the
library and the project surface). It belongs in the plan editor's element inspector
(`src/presentation/editor/elements/AssetPlacementDetails.vue` or its `EntityInspector` host) plus a
`PlanEditorDeps` member and one composition-root binding in `planEditorDeps.ts`. No new mechanism:
the door, the coalescing and the fault mapping all exist.

**WITHDRAWN BY THE INTEGRATOR (session four): this door already exists and is already drawn. No
work is owed and none was done.** The request's premise — *"A control on a selected asset placement
that calls `renovationProjectOpenAsset(...)`"* being absent — is false, and it was false before this
package began. Measured rather than argued, in the order a reader can re-run:

- `EditorNavigation` (`src/presentation/editor/PlanEditorContext.ts`) already declares
  `asset?(assetId: string): Promise<void>`, with the docblock *"Open (or reveal) an asset's designer
  leaf — a placement's Inspector."*
- `editorWorkspaceNavigation.ts` binds it to `renovationProjectOpenAsset(workspace, logger)`, and
  `planEditorDeps.ts` composes that bundle as `navigation`. So a real vault's Plan Editor has it.
- It is drawn at **two** sites, and both use the predicate rule rather than `:disabled`:
  `AssetPlacementDetails.vue`'s `v-if="context.navigation?.asset && answer?.kind !== 'missing'"`
  over `data-rp-action="open-asset-designer"`, and `useCanvasMenuActions.ts`'s `designerActions`,
  which returns `[]` when the navigation is unbound or the asset is missing.
- `editor.asset.open-designer` exists in **both** locales (`{en,de}/assetPlacement.ts`).
- `tests/presentation/editor/assetPlacementInspector.test.ts` asserts both sites, including the
  missing-asset arm: `expect(asset).toHaveBeenCalledWith(radiator.id)` for the Inspector button and
  `expect(action().exists()).toBe(false)` for a placement whose asset is gone.
- `git log -S "open-asset-designer"` names `999b39230`, *"feat(editor): asset placement inspector
  with replace, designer and material"* — well before this expansion.

**Why it was missed, said plainly, because the shape repeats.** The survey looked for the door under
the names this card was thinking in — a `PlanEditorDeps` member, a `planEditorDeps.ts` binding — and
the door exists under a different one, as a member of an already-composed `navigation` bundle. A
grep for the FUNCTION (`renovationProjectOpenAsset`) would have found it in one step and a grep for
the proposed WIRING did not, which is this repository's own rule about measuring a set with an
instrument that can see all of it, met from the direction where the thing being measured already
exists. Neither the worker nor the reviewer caught it; the integrator did, while sizing the card.

**ICR 3 — three CSS selector-list additions, and one line in a file I do own.**
`styles/designer.css` styles the inspector's flat buttons as
`.rp-designer-inspector .rp-designer-{edit-dimensions,start-preset,open-library}` in three rules
(base, `:hover`, `:focus-visible`). `.rp-designer-use-plan` should join all three, and
`DesignerUsePlan.vue`'s `<button>` should then carry that class (its template comment marks the
spot). **Done in one change, because doing half is worse than neither:**
`tests/build/libraryComponentStyles.test.ts` refuses a class the assembled sheet does not declare
and its exemption set is asserted by exact membership, so naming the class here without the rules
would hand over a red gate. **The disclosed consequence of shipping without it:** the button
renders with Obsidian's default raised chrome between two flat bordered siblings. It works and it
is legible; it does not match. `styles/designer.css` is AD06's file and is in nobody's wave-4 row
that I can see, so this may simply be the integrator's to take. **Confirmed at review: it is the
integrator's**, and the three factual claims in this ICR — the refusal, the 385-to-388 lines against
the 400 cap, and a class-less button reddening nothing because `buttonClassGroups()` skips elements
with no `rp-*` class — were each verified independently.

**ICR 4 — `open-asset-library`'s mobile `checkCallback`, and the two test call sites with it.**
In `src/plugin/RenovationPlannerPlugin.ts` (a file I do own) replace that command's `callback`
with `checkCallback: (checking) => { if (Platform.isMobile) return false; if (!checking)
this.openAssetLibrary(); return true; }` — the exact shape `open-asset-designer` and
`new-project` already carry — and in `tests/plugin/registration.test.ts` change
`command?.callback?.()` to `command?.checkCallback?.(false)` in the two cases
`opens the asset library from its own command` and
`reports a real activation fault opening the asset library from its own command`, plus the
first of those two docblocks, which calls it "a plain callback exactly like the other two above".
I wrote and reverted this rather than shipping it: that test file is outside the lease, and
optional chaining makes those two cases fail on their assertions rather than at the call, so
shipping the source half alone would hand over a red gate. **The review ruled it owed AFTER
integration**, on the ground that a mobile user reaching the library from the palette today gets
the honest desktop-only refusal rather than a broken catalogue, so C12's substance already holds.
**It also needs about four code lines in a file that has one** — see the fix round's closing note
for the extraction that pays for them. The written-and-deleted test for it
was `tests/plugin/assetLibraryCommandGate.test.ts` (id and name kept, both `checking` arms off
mobile, both arms on mobile with the leaf count proving nothing is revealed) — worth re-adding
with the change rather than reconstructing.

**ICR 5 — one call-site swap that closes the picker clone** (fix round, F5). `planPicker` in
`src/plugin/renovationProjectOpenSeams.ts` is the extracted three steps — index entries, the
no-plans notice, the guarded modal — and `openPlanPicker` in `src/plugin/planEditorCommands.ts`
still spells them itself, because that file is outside this lease. The swap is its body becoming
`planPicker(host.app, host.root.persistence?.index, plan => { … })`, with one wrinkle worth
naming: that function reads `host.root.persistence?.index` PER CALL so a settings save cannot
leave it on a replaced root, while `planPicker` takes the index by value, so the picker must be
built per press there or the parameter made a thunk. The seam here takes it by value correctly,
because the whole designer bundle is rebuilt per `rebind`. Until the swap, `npm run analyze` can
still see the clone family — disclosed rather than discovered, since that gate has not been run on
this branch.

## Data and integration implications

Schema/migration change: **none.** No DTO, no schema literal, no mapper, no migration.
Relevant renderer/export/revision consumers: **none touched.** Placement geometry, the library
mark and the authoring canvas are all untouched; C10's three consumers are unchanged.
Undo/no-op/conflict/failure coverage: **nothing in this half writes to the vault** — still true
after the fix round, and read it narrowly, because that round did add a write: see the amendment
below, which is to local storage and not to a note. So there is no
command, no history entry and no version to conflict. A cancelled pick and an empty vault are the
two no-ops and both have cases. A failed reveal is answered where it already was — inside
`revealCandidate`, once per activation, through the `view.plan-editor.reveal-failed` mapping this
seam shares with the palette command.
Identity/unit/quantity/calibration invariants: untouched. The control's predicate READS
`dimensions`/`dimensionsUnscaled` and computes nothing.
Shared root/runtime/locales wiring still required: **none outstanding for this half.** The locale
pair was pre-wired by the integrator and now carries one key; the root, the view, the deps bundle
and the composition root are all bound in this change and the binding is asserted through the real
root. ICRs 1–3 and 5 above are the wiring this half could not do.
Undo/no-op/conflict/failure coverage, AMENDED by the fix round: the Continue record is the one
thing this half now writes, and it is not a vault write and not a command — it is a per-device
local-storage slot through the plugin's own memoised `ContinueContextStore`, whose `write` cannot
reject. It is written on `'opened'` only, so a failed reveal and a dismissed pick both leave it
untouched, and both arms have a case.
Rollback/recovery considerations: the whole change is additive and reversible by revert. The one
behaviour change a user could notice on a downgrade is `open-asset-library` going back to a plain
callback, which only affects whether it appears in a mobile palette.

## Reviewer and integrator acceptance

**Reviewer outcome and findings:** REQUEST CHANGES, five findings; fix round complete and
integrated. The reviewer also found the FOURTH file of ICR 1 (`PlanEditorView.getState`'s uncleared
origin) that neither the plan nor the worker had.

**Integrated commit:** `cca169291` (session three).

**Post-integration checks/evidence.** All six gates exited 0 at `cca169291`. The integrator then
discharged three of this half's five change requests:

- **ICR 3** — `644b9687f`. The class and its three selector-list rules together. Watched failing
  with the rules reverted and the class kept: *"names no class nothing styles, beyond the two
  documented exemptions"* gave `expected [ 'rp-designer-use-plan' ] to deeply equal []`.
  `styles/designer.css` 385 → 388 against its 400 cap, the figure this report predicted.
- **ICR 4** — `66710b1eb`. The mobile `checkCallback`, the two `registration.test.ts` call sites,
  and `assetLibraryCommandGate.test.ts` re-added rather than reconstructed. Watched failing with
  the plain callback restored: all three cases gave `expected undefined to be false/true`, there
  being no `checkCallback` to call. Paid for by collapsing four command bodies to the one-line
  braced form, the file having been at 399 of 400 counted lines.
- **ICR 5** — `cca169291`, in the same session that raised it.

**ICR 2 is WITHDRAWN, not done** — the door already existed. The withdrawal and its measurements
are written at ICR 2 above rather than only here.

**ICR 1 is NOT done and is the reason criterion 1 stays unmet.** It is dispatched as wave 5's
*AD13 hand-off* card, with all four files in its lease, and the `getState` question is written into
the lease as the worker's to ANSWER rather than to inherit.

**Final status: integrated.** NOT verified: no Obsidian and no pinned Chromium in this environment,
so `npm run test-build` was never run, no manual case under `docs/tests/` was walked, and nothing
this half draws — the `Use in plan` button included, now that it is finally styled — has had a
layout, contrast or hit-size check.
