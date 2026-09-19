# Active file and resource leases

The orchestrator owns this ledger. It supplements conservative lock groups in manifest.json; it never grants a worker permission to edit unlisted shared files.

## Wave 2 — issued 2026-09-17, base `13f82f82e`, contract revision `r1`

Three workers, three worktrees under `.worktrees/` inside the integration worktree, three branches
off one base. **No file appears in two rows.** That is checked rather than intended: the locale
table every one of them wanted was split into three module pairs in the base commit for exactly
this reason, and `styles/designer-narrow.css` is deliberately in nobody's row because two of them
could plausibly want it.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| AD07 | `.worktrees/ad07` · `ad07-entry-paths` | `presentation/designer/AssetDesignerRoot.vue` (**integrator lease**), `presentation/components/EmptyState.vue` (**integrator lease, ADDITIVE ONLY** — see the correction below), `presentation/designer/presets/**`, `presentation/emptyStates/**`, `presentation/dialogs/AssetDimensionsDialog.vue`, `presentation/views/NewAssetForm.vue`, `domain/asset/presets/**`, `i18n/locales/{en,de}/assetEntryPaths.ts`, `styles/designer.css`, plus — issued at the review-fix round — a new `styles/designer-presets.css` and the ONE `@import` line for it in `styles/index.css`, its own tests | `13f82f82e` / `r1` | issued; review-fix round in progress | candidate committed and handed off |
| AD08r | `.worktrees/ad08r` · `ad08r-marquee` | `presentation/designer/selection/{designerSelection,hitTest,selectionDrag}.ts` plus a new marquee module in that directory, `presentation/designer/tools/designer-select-tool.ts`, `presentation/designer/layers/DesignerGestureLayer.vue`, `i18n/locales/{en,de}/assetMarquee.ts`, its own tests | `13f82f82e` / `r1` | issued | candidate committed and handed off |
| AD10 | `.worktrees/ad10` · `ad10-arrange` | `domain/asset/detailEdits.ts` plus new composition modules in `domain/asset/`, `presentation/designer/inspector/{DesignerInspector,DesignerSelectionInspector}.vue` plus new components in that directory, `i18n/locales/{en,de}/assetArrange.ts`, `styles/designer-selection.css`, its own tests | `13f82f82e` / `r1` | issued | candidate committed and handed off |

## Wave 3 — issued 2026-09-17, base `c5436082d`, contract revision `r1`

Wave 2's three leases are RELEASED; all three cards are integrated and gated. Two workers now, on
the two cards whose prerequisites wave 2 satisfied.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| AD11 | `.worktrees/ad11` · `ad11-open-lines` | `tools/draw-detail-tool.ts` plus a new open-line tool, `tools/registerDesignerTools.ts` (**integrator lease**), `domain/asset/AssetDetail.ts` (**integrator lease**, additive), `domain/asset/shapeEdits.ts` (**integrator lease** — `outlineOf`'s deliberate `null` is what this card relaxes), `inspector/DesignerSelectionInspector.vue`, `selection/partExtent.ts`, `i18n/locales/{en,de}/assetOpenLines.ts`, `styles/designer-object.css`, its own tests | `c5436082d` / `r1` | issued | candidate committed and handed off |
| AD12 | `.worktrees/ad12` · `ad12-reference` | `layers/{clearanceLayer,anchorLayer,backgroundLayer}.ts`, `tools/{set-anchor-tool,set-facing-tool}.ts`, `application/commands/asset/CalibrateAsset.ts` and its neighbours, `inspector/DesignerInspector.vue` plus NEW `DesignerReference*`/`DesignerClearance*` components, `assetBackgroundPicker.ts`, `i18n/locales/{en,de}/assetReference.ts`, `styles/designer-selection.css`, its own tests | `c5436082d` / `r1` | issued | candidate committed and handed off |

**Three integrator-owned files are sub-let to AD11 and the reason is worth stating**, because two of
them are the model: `registerDesignerTools.ts` (a tool with no `DESIGNER_TOOL_LABELS` entry cannot be
registered at all — the record type is total over that table's keys), `AssetDetail.ts` and
`shapeEdits.ts`. AD11's whole subject is the open arm those files were shaped around, so holding them
back would mean the card could ship a model with no gestures, which is what AD04 already did
deliberately and what this card exists to finish.

**The new-component NAME prefixes in AD12's row are load-bearing.** Both cards add components to
`presentation/designer/inspector/`, which is one directory; the prefix is what keeps them from
colliding without giving either worker the other's files.

**Held by the integrator throughout, and not sub-let to anyone this wave:** `runtime.ts`,
`AssetDesignerContext.ts`, `ports.ts`, `tools/registerDesignerTools.ts`,
`stores/assetDesignStore.ts`, `DesignerCanvas.vue`, `DesignerToolbar.vue`,
`presentation/designer/parts/**`, `domain/asset/AssetShape.ts`, `domain/asset/AssetDetail.ts`,
`domain/asset/shapeEdits.ts`, `i18n/locales/{en,de}.ts` and `{en,de}/editor.ts`,
`plugin/RenovationPlannerPlugin.ts`, the schema-version literal, `styles/index.css`,
`styles/designer-narrow.css`, `package.json` and every quality config.

A worker that needs one of those submits a precise integration change request in its report. It
does not edit it and does not work around it by putting the logic somewhere it does own.

**A correction, recorded because the ledger was wrong and a reviewer caught it.**
`presentation/components/EmptyState.vue` was granted to AD07 in its dispatch brief and was NOT
written into this table. The worker's report then described it as leased, which made the worker's
own report the only place the permission existed — exactly what this ledger's opening sentence says
it must never be (*"it never grants a worker permission to edit unlisted shared files"*). The grant
itself was sound and the edit was genuinely additive, so nothing is withdrawn; the row above now
says so. **The failure was the integrator's bookkeeping, not the worker's scope**, and it is written
here rather than quietly patched because a lease ledger that is corrected silently is one nobody can
audit afterwards.

## Wave 4 — issued 2026-09-17 (session three), base `ae6bb2a63`, contract revision `r1`

Wave 3's two leases are RELEASED; both cards are integrated and gated. **Three workers**, on the two
cards left in scope plus the integration queue. AD14 is deliberately NOT in this wave — it depends on
AD13 and on ruling AD14-R1, and gets wave 5 to itself.

**AD13 is split across two workers and is still ONE card.** It is sized L and its own survey found
that four of its six implementation items need application-layer code that does not exist at all — no
duplicate-asset command, no asset-to-plan usage query, no designer-to-plan door. One worker producing
that as a single diff is a diff one reviewer reads badly, and last session's whole argument for the
review step is that reviews caught what no gate could. So the work is split and the REPORT is not:
one `reports/AD13-*.md`, one row in `state.json` keyed `AD13`, two candidate SHAs. **No AD13a or
AD13b task is created in the ledger**, because a task invented to describe a dispatch is a task
nobody closes.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| AD13 nav | `.worktrees/ad13a` · `ad13a-workflow` | `presentation/designer/AssetDesignerRoot.vue` (**integrator lease**), `AssetDesignerContext.ts` (**integrator lease**), `AssetDesignerView.ts`, `inspector/DesignerInspector.vue` plus NEW `inspector/DesignerUse*.vue`, `plugin/assetDesignerDeps.ts` (**integrator lease**), `plugin/RenovationPlannerPlugin.ts` (**integrator lease**), `plugin/renovationProjectOpenSeams.ts`, `plugin/assetDesignerCommands.ts`, `infrastructure/obsidian/workspace/revealPlanEditor.ts`, `presentation/library/AssetLibraryView.ts` (the mobile gate, ADDITIVE ONLY), `i18n/locales/{en,de}/assetWorkflow.ts`, its own tests | `ae6bb2a63` / `r1` | issued | candidate committed and handed off |
| AD13 dup | `.worktrees/ad13b` · `ad13b-duplicate` | NEW `application/commands/asset/DuplicateAsset.ts`, `application/commands/asset/CreateAsset.ts`, NEW `application/queries/ListPlansUsingAsset.ts`, `presentation/library/{AssetInspector,AssetInspectorUsedIn,AssetLibraryDeps}.*` plus NEW `presentation/library/AssetUsage*.vue`, `plugin/assetLibraryDeps.ts`, `plugin/guardedServices.ts`, `plugin/guardedAssetLibrary.ts`, `i18n/locales/{en,de}/assetDuplicate.ts`, its own tests | `ae6bb2a63` / `r1` | issued | candidate committed and handed off |
| Queue | `.worktrees/adq` · `adq-reference-view` | `presentation/designer/runtime.ts` (**integrator lease**), `DesignerCanvas.vue` (**integrator lease**), `DesignerViewMenu.vue` (**integrator lease**), `layers/backgroundLayer.ts`, `inspector/DesignerReferenceStatus.vue`, `plugin/assetBackgroundPicker.ts`, `application/commands/asset/SetAssetBackground.ts`, `application/editor/asset/ReversibleAssetDesignCommands.ts`, `i18n/locales/{en,de}/assetReferenceView.ts`, its own tests | `ae6bb2a63` / `r1` | issued | candidate committed and handed off |

**Six integrator-owned files are sub-let this wave and the reason is one reason, met three times.**
AD10 shipped a prop optional with a permissive default while the root did not bind it, so its
locked-part rule could never fire and **no gate could see it** — the defect that costs most here is a
wire nobody made, not a file two people touched. Holding `AssetDesignerRoot.vue`,
`AssetDesignerContext.ts`, `assetDesignerDeps.ts` and `RenovationPlannerPlugin.ts` back from the one
card that needs the whole chain would guarantee that shape again. They go to AD13 nav, which is the
only card reaching for them this wave. `runtime.ts`, `DesignerCanvas.vue` and `DesignerViewMenu.vue`
go to the Queue worker for the same reason: AD12-R1 named those three by name as where background
opacity lives.

**One known contention, named up front rather than discovered.** The Queue worker's
delete-a-reference control lives in `DesignerReferenceStatus.vue`, whose props are threaded by
`DesignerInspector.vue` — which is AD13 nav's file. That is **two lines** and it is NOT sub-let in
both directions. The Queue worker submits a precise integration change request for them **and writes
the assertion that fails without them**, in the idiom AD10's reviewer prescribed and
`lint-edited.test.ts` already uses for its own hook registration. The integrator applies the two
lines at integration and that assertion is what turns green. An unwired callback is otherwise
invisible to all six gates, which is the whole of why this row exists.

**Lease amendment, issued 2026-09-17 at the ADQ review-fix round, and written here rather than into
the dispatch message.** The ADQ reviewer asked for two files the original row did not carry, and both
are granted to that worker for its fix round:
`src/presentation/editor/layers/background/BackgroundLayer.vue` (**ADDITIVE ONLY** — declare an
`opacity?: number` defaulting to `1` and put it in the Konva config, which is what stops the whole
current binding from depending on Vue attribute fallthrough that `props.config` would silently win
over) and `tests/application/commands/asset/assetReferenceReplacement.test.ts` (a three-line header
claim this candidate FALSIFIED — it says deleting a reference has no door because
`SetAssetBackgroundInput.path` is a bare string, which stopped being true at `70937e5af`). Neither
file is in any other wave-4 row; both were checked against the two AD13 rows before granting.

**This is written down because the previous session's identical grant was not.**
`presentation/components/EmptyState.vue` was granted to AD07 in a dispatch brief and never entered
this table, which made the worker's own report the only place the permission existed — exactly what
this ledger's opening sentence forbids, and a reviewer caught it.

**What is NOT granted, and must land as an INTEGRATOR commit instead:** the
`DesignerInspector.vue:324` binding of `:remove-background`, the matching removal of the `?` from
`removeBackground` in `DesignerReferenceStatus.vue`'s `defineProps`, and the deletion of the
now-uncompilable "draws no control when nothing is bound to it" case. Those three are ONE commit and
cannot be split: dropping the `?` before the binding lands turns `vue-tsc` red, and
`DesignerInspector.vue` belongs to AD13 nav for the whole of this wave. So the integrator applies
all three after AD13 nav integrates, which is also when AD12-R2's queue row becomes tickable — the
reviewer's finding 3 is that until then no user can reach the gesture at all.

**Background opacity is deliberately NOT an inspector control.** AD12-R1 calls it a leaf-local view
preference and names the three files it lives in; putting it in the view menu instead of the
inspector is what keeps the Queue worker out of `DesignerInspector.vue` for everything except the one
contention above.

**`PlanSuggestModal` is REUSED, never re-written.** `src/presentation/modals/PlanSuggestModal.ts` is
already a `FuzzySuggestModal` over the project index's plan entries and `planEditorCommands.ts`
already drives it. AD13 nav imports it. A second plan picker would be a second answer to "which plan
did you mean", which is the shape AD08-R1 refused for "which part did you mean".

**Held by the integrator throughout, and not sub-let to anyone this wave:** `ports.ts`,
`tools/registerDesignerTools.ts`, `stores/assetDesignStore.ts`, `DesignerToolbar.vue`,
`presentation/designer/parts/**`, `domain/asset/AssetShape.ts`, `domain/asset/AssetDetail.ts`,
`domain/asset/shapeEdits.ts`, `infrastructure/persistence/dto/assetGeometry.ts` and the
`SCHEMA_VERSION` literal in `AssetGeometryStore.ts`, `i18n/locales/{en,de}.ts` and
`{en,de}/editor.ts`, `styles/index.css`, `package.json` and every quality config. **The four schema
and aggregate files in that list are what AD14 will need in wave 5**, which is the other reason AD14
is not running beside these three.

**The locale tables were created EMPTY by the integrator before this wave was dispatched** —
`assetWorkflow`, `assetDuplicate`, `assetReferenceView` and `assetClearanceReview`, each an
`{en,de}` pair already imported and spread into `{en,de}/editor.ts`. That is the wave-2 trick
repeated: one shared table is a file three workers append to, and one empty pair per card is what
makes the rows above disjoint without anybody negotiating. **A pair whose card adds no strings is
deleted at integration**, as `assetMarquee`'s was.

**Wave 4's own lease-timing failure, recorded rather than fixed silently, because it is a WEAKER
form of the `EmptyState.vue` failure this ledger already corrects once above.** The table above was
committed at `584bb2f19` — **three minutes AFTER `ae6bb2a63`, which is the base all three wave-4
workers branched from**. So every lease was real, agreed and written down, and **invisible in every
tree it governed**: a worker checking its own worktree for its row found a file whose wave-4 section
did not exist yet, and each could only re-describe its lease from the prose of its dispatch message.
That is the same defect as a grant recorded only in a dispatch brief, arriving through a different
door — the ledger was right and unreachable instead of wrong.

Nothing about wave 4 is withdrawn; the leases held and the three candidates were disjoint, which was
verified mechanically at integration (`git diff --name-only ae6bb2a63..<sha>` for each, pairwise
empty). **The rule it produces binds from here on: a wave's lease table goes IN its base commit or
BEFORE it, never after.** Wave 5 below is the first table to satisfy it — it is committed in the
commit its workers branch from, so the row is present in every worktree that the row governs from
the moment that worktree exists.

## Wave 5 — issued 2026-09-18 (session four), base is THIS commit, contract revision `r1`

Wave 4's three leases are RELEASED: AD13 nav, AD13 dup and the Queue card are all integrated and
their branches are closed. **Two workers**, on the last card in scope plus the one AD13 integration
change request that is a card rather than an integrator edit.

**The base is the commit that carries this table** — that is the whole point of the paragraph above,
and it is why no SHA is named here: naming one would mean writing it after the fact, which is the
failure being corrected. Both workers branch from a commit that CONTAINS this section, so the row
governing a worktree is present in that worktree from the moment it exists. In practice they were
cut from the branch tip once all six gates were green on it, which satisfies that and is strictly
better than the commit this table first appeared in: the tip also carries the integrator's wire,
the two ICR discharges and the `analyze` fixes, all of which touch files these rows name.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| AD13 hand-off (ICR 1) | `.worktrees/ad13c` · `ad13c-asset-handoff` | `application/navigation/ProjectDestination.ts`, `presentation/editor/renovation/editorArrival.ts`, `presentation/editor/elements/assetPlacementTask.ts`, `presentation/editor/elements/spatialEditing.ts`, `presentation/editor/runtime.ts` (**ADDITIVE ONLY** — expose the arming primitive, change nothing already there), `presentation/views/PlanEditorView.ts` (**integrator lease** — the `getState` origin question below), `presentation/designer/inspector/DesignerUsePlan.vue` (**integrator lease**, docblock + the origin it passes), its own tests plus `tests/plugin/assetDesignerUsePlan.test.ts` | `044e11f52` / `r1` | DISPATCHED 2026-09-18 | candidate committed and handed off |
| AD14 | `.worktrees/ad14` · `ad14-clearance-review` | `domain/asset/AssetShape.ts` (**integrator lease**), `domain/asset/shapeEdits.ts`, `infrastructure/persistence/dto/assetGeometry.ts` (**integrator lease**), the `SCHEMA_VERSION` literal in `infrastructure/persistence/AssetGeometryStore.ts` (**integrator lease**), the asset-geometry mappers, `application/commands/asset/SetAssetClearance.ts` and the clearance arms `grep` names, NEW `presentation/designer/inspector/DesignerClearanceReview.vue`, `presentation/designer/inspector/DesignerInspector.vue` (**integrator lease, ADDITIVE ONLY** — one mount line), `styles/designer.css` (**integrator lease, ADDITIVE ONLY** — see the cap warning below), `i18n/locales/{en,de}/assetClearanceReview.ts`, NEW `docs/development/adrs/ADR-0034-*.md` (**integrator lease**), its own tests | `044e11f52` / `r1` | DISPATCHED 2026-09-18 | candidate committed and handed off |

**Disjointness was verified by listing both rows' files and intersecting them, not by intention.**
The intersection is empty. Neither row touches anything the other names, and neither touches a file
the integrator is editing in this same session — the three that would otherwise collide
(`DesignerInspector.vue`, `DesignerUsePlan.vue`, `styles/designer.css`) all receive their integrator
edit BEFORE this wave is dispatched, which is what makes an ADDITIVE-ONLY grant on them safe.

**Six integrator-owned files are sub-let this wave, and every grant is in the table above rather
than in a dispatch message** — the rule this ledger's opening sentence states and which has now been
broken twice in this package's history, once by scope (`EmptyState.vue`) and once by timing (wave 4).

**`styles/designer.css` carries a hard cap and AD14 must know the number before it starts.** The
partial is at **388 lines after this session's ICR 3 edit**, against `MAX_LINES = 400` in
`scripts/styles-assemble.mjs` — so there are **twelve lines of room and no more**, and the build
fails rather than warns. The intended shape fits easily: the `Reviewed` control is one more flat
inspector button, so it joins the three existing
`.rp-designer-inspector .rp-designer-{edit-dimensions,start-preset,open-library,use-plan}` selector
lists at three lines total. Anything larger is an integration change request for a new partial, not
a judgement call, because `styles/index.css` is integrator-owned and a partial no entry file imports
fails the build too.

**The `getState` question is AD13 hand-off's to ANSWER, not to inherit.** `PlanEditorView.getState()`
persists `this.origin` into Obsidian's workspace layout and nothing clears it, so an
`{ planId, assetId }` origin would survive a restart and re-arm the placement tool weeks later on a
leaf reopened for something else. Either exclude `assetId` from `getState` or clear it once
`useEditorArrival` has consumed it — both are defensible, the worker picks one, and whichever it
picks needs the case that fails without it. This was found by AD13 nav's REVIEWER and by neither the
plan nor the worker, which is why it is written into the lease rather than left in a report.

**AD15 and AD16 remain `blocked` and this wave does not change that.** Runbook §10: no Obsidian and
no pinned Chromium in this environment, so the beta may not be labelled ready from here. AD17 is
post-beta and out of scope.

## Wave 6 — issued 2026-09-18 (session five), base is THIS commit, contract revision `r1`

Every wave-5 lease is RELEASED: both cards are integrated and all six gates were green on
`4521f6acf`. **Two workers**, on the two acceptance criteria this package left unmet in code —
neither is a new work-package card, and neither gets a `state.json` key of its own. AD13-C3 sits
under AD13's existing row the way the hand-off card did; AD07-H sits under AD07's, because it is
that card's own Amendment 1 with its trigger fired.

**The base is the commit that carries this table**, for wave 4's recorded reason. Both workers
branch from a commit that CONTAINS this section and ruling **AD13-R1**, so the row and the ruling
governing a worktree are present in that worktree from the moment it exists.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| AD13-C3 — the designer's usage scope (ruling AD13-R1) | `.worktrees/ad13c` · `ad13c3-designer-usage-scope` | `plugin/guardedAssetLibrary.ts`, `plugin/assetLibraryDeps.ts`, `plugin/assetDesignerDeps.ts`, `presentation/read-models/assetDesignerQueries.ts`, NEW `presentation/designer/inspector/DesignerUsageScope.vue`, `presentation/designer/inspector/DesignerInspector.vue` (**integrator lease, ADDITIVE ONLY** — the mount and its comment, nothing already there), `styles/designer-object.css` (**integrator lease, ADDITIVE ONLY**), NEW `presentation/i18n/locales/{en,de}/assetUsageScope.ts` plus the ONE import and ONE spread line each in `presentation/i18n/locales/{en,de}.ts` (**integrator lease, ADDITIVE ONLY**), its own tests | THIS commit / `r1` | DISPATCHED 2026-09-18 | candidate committed and handed off |
| AD07-H — the optional descriptive height at creation (AD07 Amendment 1) | `.worktrees/ad14` · `ad07h-creation-height` | `application/commands/asset/CreateAsset.ts`, `presentation/views/NewAssetForm.vue`, NEW numeric-field-row component under `presentation/views/`, `presentation/i18n/locales/{en,de}/newAssetFootprint.ts`, `styles/` **only** the partial that already declares the New asset dialog's field rules and only if a rule is genuinely needed, its own tests | THIS commit / `r1` | DISPATCHED 2026-09-18 | candidate committed and handed off |

**Disjointness was verified by listing both rows' files and intersecting them, not by intention.**
The intersection is empty. The two locale modules each row names are DIFFERENT modules, which is the
whole reason this repository splits locale copy per feature; only AD13-C3 touches `en.ts`/`de.ts` at
all, and then by one import and one spread line, because `newAssetFootprintEn` is already spread
there.

**Three integrator-owned files are sub-let this wave, all to AD13-C3, and every grant is in this
table rather than in a dispatch message** — the rule this ledger's opening sentence states and which
this package has broken twice, once by scope and once by timing.

**The style cap is measured, and it is why neither row names `styles/designer.css`.** That partial is
at **388 lines** against `MAX_LINES = 400` in `scripts/styles-assemble.mjs` — twelve lines and the
build fails rather than warns. `styles/designer-object.css` is at **61**, its own header scopes it to
*"the designer Inspector's OBJECT block: which asset this is, the way back to the catalogue"*, and a
statement of which plans place THIS asset is exactly that block. So AD13-C3's rules go there, and no
`styles/index.css` edit is owed — a new partial would need that entry-file line, and an entry file
importing a partial that does not yet exist fails the build in the worker's own tree.

**`styles/designer-object.css`'s position in `index.css` is load-bearing** and its header says so:
these rules were authored at the END of `designer.css`, so an equal-specificity pair is decided by
order. Append to that partial; do not reorder it and do not move a rule into it from elsewhere.

**AD15 and AD16 remain `blocked` and this wave does not change that.** Runbook §10: no Obsidian and
no pinned Chromium in this environment, so the beta may not be labelled ready from here. AD17 is
post-beta and out of scope.

A worker that needs a file not in its row submits a precise integration change request in its report.
It does not edit it, and it does not work around it by putting the logic somewhere it does own.

No leases are held from the first execution session; one agent held everything and released it.

Use independent disposable test data and harness ports. Release a lease only after its owner has committed/handed off or explicitly suspended changes; do not reassign a dirty shared file implicitly.

## Wave 7 — issued 2026-09-19 (session six), base is THIS commit, contract revision `r1`

Every wave-6 lease is RELEASED: both cards are integrated and all six gates were green on
`f28a63095`. **Three workers**, on the three thinnest rows of `reports/AD15-validation-matrix.md`.
None is a new work-package card and none gets a `state.json` key of its own; each closes a
VALIDATION gap in a package whose code obligations are met, so each sits under AD15's row.

**The base is the commit that carries this table**, for wave 4's recorded reason — a lease that
lands three minutes after the tree it governs is a lease that is real and invisible.

**Every one of these cards is TEST-ONLY, and that is the lease's load-bearing clause.** Each
worker creates exactly ONE new file and touches no other. A card that discovers it needs a `src/`
edit STOPS and reports rather than taking one: `src/` is integrator-owned this wave, and a
worker's proposed source fix is a hypothesis until the integrator has measured it. Disjointness is
therefore by construction and is still verified mechanically before any merge.

**Why test-only is also the coverage answer.** Branches sit at 98.05% against a 98 floor — about
eleven arms for the whole repository. A test adds coverage and can never subtract it, so no card
in this wave can move a floor in the wrong direction. A `src/` edit could, which is the second
reason the clause is there.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| **T25** — the designer's DOM-level gesture cancellation | `.worktrees/ad07` (reused, carries `node_modules`), branch `ad15-t25-gestures` | CREATE `tests/presentation/designer/designerCanvasGestureOwnership.test.ts`. No other file, in `tests/` or `src/` | wave 7 base, `r1` | **RELEASED** — integrated `416314f7f` | reviewed, conditions applied in a fix round |
| **T40** — quantity and cost isolation under a GRAPHIC write | `.worktrees/ad08r` (reused), branch `ad15-t40-isolation` | CREATE `tests/application/commands/asset/designerWriteIsolation.test.ts`. No other file, in `tests/` or `src/` | wave 7 base, `r1` | **RELEASED** — integrated `90f5b478d` | reviewed, conditions applied in a fix round |
| **T42** — the designer's compact pane, rendered rather than declared | `.worktrees/ad10` (reused), branch `ad15-t42-compact` | CREATE `tests/presentation/designer/designerResponsiveShell.test.ts`. No other file, in `tests/` or `src/` | wave 7 base, `r1` | **RELEASED** — integrated `69775e5e9` | reviewed, conditions applied in a fix round |

**Integrator-owned and sub-let to nobody this wave**: every file under `src/`, `styles/`,
`docs/tasks/asset-designer-expansion/`, `package-lock.json`, and every EXISTING file under
`tests/`. A worker that wants one asks; the grant is written into this table in the same edit that
makes it, or it does not exist.

**AD15 and AD16 remain `blocked` and this wave does not change that.** Runbook §10: Obsidian is
installed on this machine but no agent here can walk a 45-step human case, and the pinned Chromium
is absent — `playwright-core` pins revision 1234 and the cache holds 1223. The captures this
session cites were taken through `RP_CHROMIUM_EXECUTABLE` against that 1223 build, which the
script itself announces is not the pinned one, so they are approximate and every report that cites
one says so. The beta may not be labelled ready from here.

**Every wave-7 lease is RELEASED as of 2026-09-19.** All three cards are merged, each was reviewed by an agent
that did not write it, each review returned APPROVE conditional, and every condition was applied in a fix round by
the card’s own worker before the merge. Disjointness was verified on the FIX-ROUND shas as well as on the
candidates, by intersecting `git diff --name-only` pairwise: empty in all three pairs, both times. No worker
touched `src/` or `styles/`; `git diff --name-only <base>..<sha> -- src styles` is empty for all three.

**The worktree column was corrected after the fact and the correction is the point.** It first named three trees
that do not exist (`ad15-t25`, `ad15-t40`, `ad15-t42`); the wave actually reused `ad07`, `ad08r` and `ad10`,
which already carry `node_modules`, with `git switch -c` off the base. A lease table naming a tree nobody worked
in is the wave-4 failure in a different costume — real, and invisible to anyone reading it.

One integrator-owned `src/` edit was taken this wave and is NOT a worker’s: `dropMarquee`’s docblock in
`designer-select-tool.ts`, which named three interruption mechanisms where `EditorSurface` drives two, and whose
third clause described the opposite of what happens. It was found by T25’s reviewer and verified independently
before the edit.

## Wave 8 — issued 2026-09-19 (session seven), base is THIS commit, contract revision `r1`

Every wave-7 lease is RELEASED, as that table's own closing paragraph records. **Two workers, not
three**, and the reduction is a measurement rather than restraint: the hand-off named four
remaining items, and items 2 and 3 turn out to be ONE card, because they touch the same two files.

`RESUME.md` item 2 factors `band`, `selecting`, `held`, `SHAPE`, `FROM` and `TO` out of
`designerCanvasGestureOwnership.test.ts` and `designerMarqueeCanvas.test.ts`; item 3 closes T25's
two residual gaps, whose subject IS the first of those files. Split across two workers they would
collide on both files and on `tests/helpers/designerRig.ts`, and the second would want helpers the
first is still moving. Merged, disjointness holds by construction again — for a different reason
than wave 7's, and the reason has to be stated because the clause it replaces is gone.

**Wave 7's "exactly ONE new file per card" clause does NOT hold this wave, deliberately.** Card
W8-A edits three existing files, one of which (`tests/helpers/designerRig.ts`) is a shared helper
every designer test imports. That is an explicit GRANT out of the integrator-owned pool, written
into this table in the same edit that makes it. What replaces the clause as the disjointness
guarantee: W8-B creates exactly one new file and names no file W8-A names, so the two file sets
are disjoint by inspection and are still verified mechanically with `git diff --name-only` before
any merge.

**Both cards remain TEST-ONLY, and the coverage argument is unchanged.** Branches sit at 98.07%
against a 98 floor — 427 uncovered of 22232, about sixteen arms for the whole repository. A test
adds coverage and can never subtract it. A card that discovers it needs a `src/` edit STOPS and
reports rather than taking one; `src/` is integrator-owned and a worker's proposed source fix is a
hypothesis until the integrator has measured it.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| **W8-A** — factor the designer gesture rig's duplicated helpers, and close T25's two residual gaps | `.worktrees/ad07` (reused, carries `node_modules`), branch `ad15-w8-gesture-rig` | EDIT `tests/helpers/designerRig.ts`, `tests/presentation/designer/designerCanvasGestureOwnership.test.ts`, `tests/presentation/designer/designerMarqueeCanvas.test.ts`. No other file, in `tests/` or `src/` | wave 8 base, `r1` | issued | reviewed by an agent that did not write it, conditions applied, disjointness verified |
| **W8-B** — resolve the designer's container query by hand against the mounted tree | `.worktrees/ad10` (reused, carries `node_modules`), branch `ad15-w8-container-query` | CREATE one new `*.test.ts` under `tests/presentation/designer/`. No other file, in `tests/` or `src/` | wave 8 base, `r1` | issued | reviewed by an agent that did not write it, conditions applied, disjointness verified |

**Integrator-owned and sub-let to nobody this wave**: every file under `src/`, `styles/`,
`docs/`, `package-lock.json`, and every file under `tests/` not named in the table above.

**W8-B's honest framing is part of its lease.** `designerResponsiveShell.test.ts` already records
that the blind spot this card closes is EMPTY today — the `@container rp-designer (width < 35rem)`
block declares no `display`, `visibility` or `content-visibility` at all, which that file states
and which was re-read against `styles/designer-narrow.css` before this lease was issued. So the
card is a guard against a FUTURE `display: none`, and its report must say so rather than implying
it found a defect. A worker that concludes the assertion would be theatre says so and stops; that
is a finding, not a failure to deliver.

**AD15 and AD16: the live-vault blocker is DISCHARGED this session and the beta is still not
labelled ready.** The user walked the pass themselves and reported on it; runbook §10's condition
was "an actual Obsidian session cannot be run", and it now can and has been. Whether the beta
ships is the user's call and is not taken here.

**The integrator's own census in the wave 8 base commit message is WRONG, and the correction is
recorded here because a commit message cannot be edited.** It says `SHAPE`'s spelling "appears in
five" files. It appears in five, but one of them —
`tests/presentation/designer/tools/designerSelectSnapping.test.ts` — is
`editableShape({ details: [...] })`, a DIFFERENT shape under the same name. The clone is
**four**: the two leased files plus `selection/selectionDrag.test.ts` and `selection/marquee.test.ts`.
W8-A's worker measured that and corrected it, and W8-A's independent reviewer re-measured it a
third time and agreed (`git grep "const SHAPE" 07d961321 -- tests/` prints six, of which exactly
four are a bare `editableShape()`; the sixth is `selection/partMeasure.test.ts`'s
`shapeWithOpenGraphic()`). None of the prose in either candidate states a number, so nothing in
the shipped diffs inherited the error — only this table's own base commit did.

This is the guide's "measure a set with an instrument that can see all of it" rule met from the
integrator's side: `grep -rln "const SHAPE = editableShape"` answers a question about a SPELLING,
and it was used as the evidence for a question about a VALUE.
