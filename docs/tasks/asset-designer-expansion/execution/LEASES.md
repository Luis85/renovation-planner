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

**Every wave-8 lease is RELEASED as of 2026-09-19.** Both cards are merged, each was reviewed by an
agent that did not write it, each review returned APPROVE conditional, and every condition was
applied in a fix round by the card's own worker before the merge — W8-A at `dded01474` (three prose
corrections), W8-B at `265b3505` (five docblock narrowings plus one integrator finding). Integrated
at `160fab6f5` and `ced90913c`.

Disjointness was verified by intersecting `git diff --name-only` on the FIX-ROUND shas as well as
the candidates: empty both times. Neither card touched `src/`, `styles/` or `docs/` —
`git diff --name-only <base>..<sha> -- src styles docs` returns nothing for both.

**Three corrections travelled UPWARD this wave, which is the part worth keeping.** W8-A's worker
corrected the integrator's `SHAPE` census (four, not five) and then corrected its own reviewer with
a grep (`selection/marquee.test.ts` drives neither rig; it calls the pure `swept` function).
W8-B's worker corrected the integrator on `CLAUDE.md` — the `-- --width=460` spelling is correct
inside its own *given an entry id* paragraph, and that worker's header had lifted it out of
context — which led to the integrator withdrawing an unmeasured causal claim in `1e6f37b6c`. A wave
where the corrections only ever flow downward is one where nobody below is reading.

**The one `src/`-adjacent change this wave is the integrator's and is not a worker's**:
`styles/designer-presets.css`, fixing a defect a USER found in the live vault that no gate here can
see. It is pinned by `tests/build/buttonBoxNeutralised.test.ts`, watched failing on all three
declarations.

**One item is carried forward rather than taken**: moving W8-B's declaration case into
`designerStyles.test.ts`, where it would cost no DOM. Both the reviewer and the worker think it
belongs there; the worker's own caveat is that doing so leaves the mounted guard as the weaker case
standing alone and invites the question of whether that file earns its 47 s. That is a cost
question and a card of its own, not an end-of-wave edit.

## Wave 9 — issued 2026-09-20 (session seven), base is THIS commit, contract revision `r1`

Every wave-8 lease is RELEASED. **One worker, one card**, and the singleness is forced rather than
chosen: AD18 items 2 and 4 both restructure `DesignerInspector.vue` — the header TAKES the asset
name out of it (AD18-R1) and the tabs reorganise what is left (AD18-R2) — so two workers would
collide on that file and on `styles/designer.css`. One card, one tree, no disjointness question to
verify.

**This is the wave's real change of kind: it is the first `src/` card since wave 6.** Waves 7 and 8
were test-only, and both leases leaned on that — "a test adds coverage and can never subtract it".
**That clause does NOT hold here.** Branches sat at 98.07 % against a 98 floor at the last
measurement, about sixteen arms for the whole repository, and a new `v-if` is a new branch. The
card must plan each test WITH its code and read `coverage-final.json` for the CHANGED FILES rather
than trusting the threshold, which cannot see one untested arm in a slack metric.

**No coverage figure has been measured since session six and none may be carried forward as
current** — session seven ran no `test:coverage` at all, because another session held the box.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| **W9-A** — the designer header (AD18 item 2 / AD06 item 1) and the tabbed Inspector (AD18 item 4) | `.worktrees/ad08r` (reused, carries `node_modules`), branch `ad18-header-and-tabs` | EDIT `src/presentation/designer/AssetDesignerRoot.vue`, `src/presentation/designer/inspector/DesignerInspector.vue`, `styles/designer.css`, `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`. CREATE components under `src/presentation/designer/` and partials under `styles/` as needed, plus any test file under `tests/`. Nothing else | wave 9 base, `r1` | issued | reviewed by an agent that did not write it, conditions applied, coverage read per changed file |

**Integrator-owned and sub-let to nobody**: every other file under `src/`, `styles/`, `docs/`,
`package-lock.json`, and every EXISTING test file the card does not need. A file the card discovers
it needs is ASKED for, and the grant is written into this table in the same edit that makes it.

**Two rulings govern this card and both were taken before it** — `contracts/DECISIONS.md`'s AD18-R1
and AD18-R2. Each names the traps as well as the outcome, and the traps are the part to read twice:
the clearance-review notice is a `role="status"` live region that a user has already reported
reading as belonging to the Clearance block above it, so a tab separating the two would destroy the
one judgement answer this package owns.

**`regionsReachable.test.ts` is why a new component cannot be merely created.** It walks the real
import graph from `AssetDesignerView.ts` and requires every `.vue` under `src/presentation/designer/`
to be reachable; `assetDesignerRoot.test.ts` asserts each region is drawn. A header component that
is written and not mounted fails the first; a region dropped while its component survives elsewhere
fails the second.

**Wave 9 grant, recorded AFTER the fact and the lateness is the point.** `styles/index.css` is not
in W9-A's EDIT list, and the card edited it — one line, importing the new `styles/designer-header.css`
partial. The card TEXT required exactly that (*"a new partial may be required, and `styles/index.css`
must import it"*), so the omission was in the table rather than in the work, and the worker disclosed
it in its own report rather than letting it pass.

It is written down here because this table's own rule is that a grant *"is written into this table in
the same edit that makes it, or it does not exist"*. This one was not, so recording it late is the
honest repair and leaving it unrecorded would make the rule decorative. **The lesson for the next
lease: a card that says "create a partial" has already granted the file that imports it, and the
EDIT list has to say so.** `scripts/styles-assemble.mjs` refuses a partial no entry file imports, so
the two are one action and cannot be leased apart.

**Two wave-9 grants, issued 2026-09-20 during W9-A's fix round and written here in the same edit
that makes them**, which is the rule the `styles/index.css` note above was the exception to:

- `tests/presentation/designer/designerUsageScope.test.ts` — so AD18-R1's required check stops being
  held by prose. The ruling obliges the mover to check the usage-scope block still reads as being
  about the asset once the name is gone; the card's argument is correct in the template and NOTHING
  asserts it, so a block inserted between the `Asset` heading and `DesignerUsageScope` would leave
  every test green. That file already mounts with a context, so the block actually draws there.
- `src/presentation/designer/inspector/DesignerUsageScope.vue` — so the stale count the card
  self-reported (five mount sites, now six) is corrected in the same edit as the grep that measures
  it, rather than left for an integrator to patch separately from the evidence.

Both are narrow and neither is a widening of the card. The second exists because the alternative —
the integrator fixing a count in a file the worker is not allowed to touch — splits a sentence from
the measurement that produced it, which is the failure this repository names most often.

## Wave 10 — AD18 items 3, 6 and 7, dispatched 2026-09-20

**Base is THIS commit**, which is what carries the table — per this file's own rule that a wave's
lease table goes in its base commit or before it. Its parent is `c3527450b`, the analyze repair.

**What the user authorized, and what they did not.** Asked directly at the start of session eight,
they took AD18 items 3+6 together, item 5 and item 7 — using the SEQUENCING TABLE's numbering
(3 icon toolbar, 5 Add rail, 6 canvas proportion, 7 guided trace checklist), which is the numbering
the hand-off used and NOT the one the "gaps" section of `AD18-concept-fidelity.md` uses for the
same items. That document numbers the same work 5, 3 and 4 respectively in its prose section. The
authorization is unambiguous because each option named the WORK; the numbers are not, and the next
reader should quote the work rather than the number.

**Item 5 is authorized and is NOT in this wave, and that is a sequencing decision rather than a
narrowing of scope.** Asked as its own question, the user ruled that the Basic-shape buttons MOVE
into the Add rail. That makes item 5 and item 3 two cards over one file — `DesignerToolbar.vue` —
so they cannot hold disjoint leases in one wave. Item 5 goes to wave 11, on top of W10-A.

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| **W10-A** — the icon toolbar (AD18 item 3) and canvas proportion at 560–900 px (AD18 item 6) | `.worktrees/ad07` (reused, carries `node_modules`), branch `ad18-icon-toolbar` | EDIT `src/presentation/designer/DesignerToolbar.vue`, `styles/designer.css` (**cap warning: 397 lines against 400**), `styles/designer-selection.css`, `styles/designer-narrow.css`, `src/presentation/i18n/locales/{en,de}/designerToolbarIcons.ts`, and `styles/index.css` (**integrator lease, ADDITIVE ONLY** — the `@import` line for a partial this card creates, and nothing else in that file). CREATE components under `src/presentation/designer/`, partials under `styles/`, and any test file under `tests/`. May ADD a missing icon fixture under `tests/fixtures/editor-icons/`. Nothing else | wave 10 base, `r1` | issued | reviewed by an agent that did not write it, conditions applied, coverage read per changed file |
| **W10-B** — the guided trace checklist (AD18 item 7) and the empty Reference tab panel | `.worktrees/ad10` (reused, carries `node_modules`), branch `ad18-trace-checklist` | EDIT `src/presentation/designer/inspector/DesignerReferenceStatus.vue`, `styles/designer-trace.css` (**created empty in this commit; its `@import` is already wired, so this card must NOT touch `styles/index.css`**), `src/presentation/i18n/locales/{en,de}/designerTrace.ts`. CREATE components under `src/presentation/designer/inspector/` and any test file under `tests/`. Nothing else | wave 10 base, `r1` | issued | reviewed by an agent that did not write it, conditions applied, coverage read per changed file |

**Disjointness, checked rather than intended.** The intersection of the two rows is empty. The two
locale modules are DIFFERENT modules, which is why this repository splits locale copy per feature;
`{en,de}/editor.ts` is the one composition point and it is the INTEGRATOR's, which is why both
tables were created EMPTY and wired in this commit rather than left for the cards — two cards each
adding an import and a spread line to `editor.ts` is one file in two rows.

**The same reasoning produced `styles/designer-trace.css`.** Both obvious homes for W10-B's rules
are in W10-A's row: `designer-selection.css` declares `.rp-designer-reference` AND
`.rp-designer-tools`/`.rp-designer-tool-button`, and `designer.css` is at the cap. So the partial
and its `@import` were created together by the integrator — `scripts/styles-assemble.mjs` refuses a
partial no entry file imports, so the two are one action and cannot be leased apart. That is wave
9's recorded lesson applied BEFORE the fact rather than after it.

**Integrator-owned and sub-let to nobody**: every other file under `src/`, `styles/`, `docs/`,
`package-lock.json`, `{en,de}/editor.ts`, and every EXISTING test file neither card needs. A file a
card discovers it needs is ASKED for, and the grant is written into this table in the same edit
that makes it.

**The coverage clause from wave 9 still holds and is not softened**: both cards add `src/` code, a
new `v-if` is a new branch, and the branch floor is 98. Plan each test WITH its code and read
`coverage-final.json` for the CHANGED FILES; the threshold cannot see one untested arm in a slack
metric. Measured at the wave base: `npm run check` green, 1065 test files, 11757 passed.

**Neither card may report a layout claim as verified from the suite.** jsdom lays nothing out, so a
wrapped toolbar, a fold and a column share are all invisible to it. `designerStyles.test.ts` pins
what a rule DECLARES and wave 8's resolver pins what a container query RESOLVES to; neither is a
measurement of the rendered result. The integrator has an in-app browser and will render both.

## Wave 11 — AD18 item 5, the `Add` rail, dispatched 2026-09-20

**Base is THIS commit**, per this file's rule that a wave's lease table goes in its base commit or
before it. Its parent is `cd7a42474`, session eight's hand-off.

**ONE card, and that is a finding rather than a shortage of work.** AD18-R3 moves the Basic-shape
buttons out of the toolbar and into the rail, so the toolbar's deletion and the rail's creation are
one atomic change — the four shapes must be drawn in exactly one place at every commit, and a wave
that split them would have an intermediate state with the shapes in both or in neither. Three
workers is a maximum, not a quota. The user was asked whether to run a second card on the
carried-forward corrections and declined for this wave.

**Two rulings were taken before dispatch**, in `contracts/DECISIONS.md` and in `execution/state.json`
in the same edit, which is the discipline AD12-R1 and then AD18-R1/R2 each cost this package once:
**AD18-R5** (the rail STACKS `Add` above `Parts`, it is not a tab pair) and **AD18-R6** (the `Add`
section carries the preset door and the Inspector drops its copy).

| Task | Worker/worktree | Exact files or nonoverlapping scope | Base/contract | Status | Release condition |
|---|---|---|---|---|---|
| **W11-A** — the `Add` rail (AD18 item 5), under AD18-R3, AD18-R5 and AD18-R6 | `.worktrees/ad07` (reused, carries `node_modules`), branch `ad18-add-rail` cut from this commit | EDIT `src/presentation/designer/AssetDesignerRoot.vue`, `src/presentation/designer/DesignerToolbar.vue`, `src/presentation/designer/inspector/DesignerInspector.vue`, `styles/designer-add.css` (**created empty in this commit; its `@import` is already wired, so this card must NOT touch `styles/index.css`**), `styles/designer-toolbar.css`, `styles/designer.css` (**cap: 397 lines against 400 — deletions welcome, additions must go in `designer-add.css`**), `src/presentation/i18n/locales/{en,de}/designerAdd.ts`, and `tests/helpers/designerRig.ts` (**narrow grant, `toolbarButton` only** — see the hazard below). CREATE components under `src/presentation/designer/`, and any test file under `tests/`. EDIT any EXISTING test file that its own change turns red. Nothing else | wave 11 base, `r1` | **released, integrated `912c51bae`** | met: reviewed by an agent that did not write it (twelve findings, ten returned and fixed at `1fdb75f36`), conditions applied, coverage left to CI |

**Integrator-owned and sub-let to nobody**: `{en,de}/editor.ts`, `styles/index.css`, every other file
under `src/`, `styles/` and `docs/`, and `package-lock.json`. A file the card discovers it needs is
ASKED for, and the grant is written into this table in the same edit that makes it.

**The lease hazard this wave has, which no previous one did.** `tests/helpers/designerRig.ts`'s
`toolbarButton(label)` resolves a control by `wrapper.findAll('.rp-designer-tools button')` and then
by `.text()`. There are **43** call sites across **26** test files (`grep -rn "toolbarButton("
tests/ | wc -l`, `grep -rln "designerRig" tests/ | wc -l`, taken at this commit). Moving the four
shape buttons OUT of `.rp-designer-tools` breaks every caller that asks for one by label, and those
failures will look like the card's own bug rather than like the helper's scope. The helper is
therefore IN the lease — narrowly, for that resolver — and the card owes a sentence in its report
saying what the resolver now means. Note the failure is a SELECTOR failure and not a text one:
jsdom applies no CSS, so `styles/designer-toolbar.css`'s `display: none` on the label below 80rem
never affects `.text()`.

**Two hand-off claims this base corrects, both read against the code rather than inherited.**

- *"Board 02 also puts a search field over the preset categories"* implies one is missing. **It is
  not.** `AssetPresetForm.vue` has carried a `type="search"` bound to `query` since AD07, with
  group-dropping, a `designer.preset.no-matches` message and a roving tab stop that survives the
  search re-flowing the gallery. What item 5 moves is the DOOR to that modal, not the search.
- *"Shape keys are named `designer.shapes.*`, not `designer.toolbar.*`, so they outlive the
  toolbar"* is **true of exactly one key**. `designer.shapes.group` is the shape GROUP's label,
  minted by W10-A for precisely that reason. The four BUTTON labels are `designer.toolbar.draw-rect`
  / `-rounded-rect` / `-circle` / `-line` in `DESIGNER_TOOL_LABELS` and are unchanged. They are
  deliberately NOT renamed here — `en/designerAdd.ts`'s header carries the argument — so the card
  should expect those key names to look stale and must not spend its lease on a rename.

**The coverage clause still holds and is not softened**: this card adds `src/` code, a new `v-if`
is a new branch, and the branch floor is 98. Plan each test WITH its code and read
`coverage-final.json` for the CHANGED FILES; the threshold cannot see one untested arm in a slack
metric.

**This card may not report a layout claim as verified from the suite.** jsdom lays nothing out, so
the rail's height, what the `Add` section costs the stacked rail below 35rem — which AD18-R5's own
text names as an unmeasured cost of that ruling — and whether the shape buttons still fit are all
invisible to it. `designerStyles.test.ts` pins what a rule DECLARES and wave 8's resolver pins what
a container query RESOLVES to; neither is a measurement of a rendered result. The integrator has an
in-app browser and will render it.

### Wave 11 closed

Candidate `f9b43fa27`, fix round `1fdb75f36`, merged `912c51bae`, integrator repairs `f33c14d88`.

**Disjointness was not checkable this wave and that is worth saying rather than claiming it was.**
One card holds no intersection with another card, so the check this file prescribes — intersect
`git diff --name-only <base>..<sha>` across rows — has nothing to intersect. What replaced it is a
LEASE COMPLIANCE read: the changed-file list against the single row. Everything matched except
`tests/harness/assetDesigner.ts`, a harness fixture rather than a `.test.ts`, which the row's
*"EDIT any EXISTING test file that your own change turns red"* does not cleanly cover — and it did
not turn red, it failed SILENTLY, which is the whole reason it needed editing. **Granted after the
fact, deliberately and recorded as such**: the reviewer confirmed `assetDesignerSelectKnob.test.ts`
does go red without it, so the file was genuinely load-bearing, and the edit closed a fake kinder
than the real thing. A lease that had anticipated it would have said "any existing test file or
harness fixture".

**The `tests/helpers/designerRig.ts` hazard this wave's table predicted was real and its figures
were wrong.** The row says *"43 call sites across 26 test files"*; it conflates two greps, which
the card caught and the reviewer confirmed independently. At the base `grep -rn "toolbarButton("
tests/` is 43 lines in **17** files, and 26 is `grep -rln "designerRig" tests/`. Both commands are
printed side by side in that row, which is where the conflation came from. The hazard itself
behaved exactly as predicted: a thrown resolver, not a failed assertion.

## Wave 12 — the unreachable guard in `DesignerInspector.vue`, dispatched 2026-09-21

**ONE card, and the wave started as two.** The second — AD18's `placement(s)` bullet — was
WITHDRAWN before dispatch rather than narrowed, under ruling **AD18-R7**: the integrator read the
locale file the bullet was about and found `en/assetDuplicate.ts`'s own header already argues the
opposite in writing. The card would have asked for the wrong thing, and a card asking for the wrong
thing cannot be closed by testing harder. Nothing in `src/` ships from it; the AD18 bullet is
amended and the ruling carries the losing side.

**So disjointness has nothing to intersect this wave.** What replaces the prescribed
`git diff --name-only <base>..<sha>` intersection is a LEASE COMPLIANCE read of the single row's
changed-file list — the same substitution wave 11 recorded, for the same reason.

| Card | Worktree | Lease | Contract | Status | Conditions |
|---|---|---|---|---|---|
| **W12-A** — delete the unreachable first term of `showUnscaledDimensions` | `.worktrees/ad10` (reused, carries `node_modules`), branch `w12a-unreachable-guard` cut from this commit | EDIT `src/presentation/designer/inspector/DesignerInspector.vue` and `tests/presentation/designer/assetDimensions.test.ts`. EDIT any EXISTING test file **or harness fixture** that its own change turns red. CREATE any test file under `tests/`. Nothing else — no locale file, no stylesheet, no other component | wave 12 base, `r1` | dispatched | reviewed by an agent that did not write it; every count in a rewritten sentence printed by a command run AFTER the change |

### What this card is, and the one thing that makes it unusual

`DesignerInspector.vue`'s `showUnscaledDimensions` reads
`props.design.dimensions !== null && props.design.dimensionsUnscaled`. **The first term is
unreachable**, and the component's own docblock already says so and already records the
measurement that proves it. The card's job is to delete the term, and to replace a docblock that
explains why a redundant guard is KEPT with one that points at where the guarantee actually lives.

**There is no failing test to watch for the deletion itself, and the card must not invent one.** An
unreachable arm cannot be made to fail; a test that appeared to do so would be testing a
hand-built DTO rather than the query, which is precisely the state the producing invariant
excludes. The watched-red belongs to the SENTENCE the card writes, not to the deletion:

- The new docblock will claim the producing invariant is pinned in
  `tests/application/queries/getAssetDesign.test.ts`. **That pin exists** — the integrator verified
  it rather than forwarding the old docblock's claim; it is asserted at three places in that file.
- So: break `GetAssetDesign`'s `dimensionsUnscaled` assignment in the worktree, run that file, and
  report the red VERBATIM. Restore. That is the evidence the comment is not an unchecked one.

### Hazards, as commands rather than as figures

- **`assetDimensions.test.ts` carries a stale "only"** — it says *"`DesignerInspector` was the ONLY
  reader of `dimensionsUnscaled` in the tree"*. That is false and it is falser than the hand-off
  recorded: the hand-off named one missed reader, and `grep -rn "dimensionsUnscaled" src/` prints
  more. **Run that grep after the change and write the sentence from what it prints** — do not
  inherit a number from this table, from the hand-off, or from the old comment. Count the readers,
  and note that the grep also matches PROSE that merely names the field; this package has miscounted
  exactly that way five times.
- **Removing a branch arm moves coverage.** The branch floor is 98 and the change is in `src/`.
  Coverage is the integrator's and CI's, not the card's — but read `coverage-final.json` for
  `DesignerInspector.vue` if anything looks surprising, because the threshold cannot see one arm.
- **The docblock above the computed is long and argues for the opposite outcome.** Replace it; do
  not leave a paragraph defending a guard that is gone. It also cites sibling test files by name —
  check each still exists before repeating it.
- `DesignerInspector.vue` has a cognitive-complexity history: session eight turned CI red on this
  exact file's template at cognitive 17 against `maxCognitive` 15. A deletion should move that the
  safe way, but run `npx eslint` on the file rather than assuming it.

### Wave 12 closed

Candidate `078e3dc84`, fix round `871802a74`, merged fast-forward, integrator repair `9dc85914b`.

**Lease compliance rather than disjointness**, as the wave's own table predicted: one card has
nothing to intersect. `git diff --name-only 82838abe3..871802a74` returns the two leased files,
the two granted mid-wave, and the card's report. Nothing outside.

**Two lease extensions were granted DURING the fix round and are recorded as granted rather than
discovered afterwards**, which is the difference from wave 11's `assetDesigner.ts` grant.
`tests/application/queries/getAssetDesign.test.ts` was granted so the card could pin the conjunct
that had been resting on `dimensionsOf`'s return type — the reviewer's sharpest finding, and the
house rule says write the guarantee to the check wherever the check can reach it cheaply. The card
was given BOTH arms explicitly (add the assertion, or narrow the sentence and say why) because an
unexamined answer is the only unacceptable one; it took the assertion, as a new case rather than by
widening an `it.each` whose own docblock says the opposite thing. `designerInspector.test.ts` was
granted for a stale claim the reviewer found that neither the card nor the integrator had swept for.

**The correction that matters most this wave ran UPWARD, twice.** The card corrected the
integrator's brief about how many places pin the invariant, and was right. The integrator then
corrected the hand-off, the card and the reviewer about the `only reader` sentence being false — it
was true when written, and the integrator had been the one who told the card otherwise. Both copies
now carry the diagnosis and a command instead of a count.


## Wave 13 — harness fixtures for the three unrendered glyphs, dispatched 2026-09-21

**Authorized by the user in the same message that discharged the risk**: they walked a real vault,
reported all five icon-only buttons drawing a glyph, and asked for the fixtures *"to be able to run
proper tests"*.

**The integrator fetched the three SVGs rather than leaving it to the card**, because provenance is
a shared-file concern. `tests/fixtures/editor-icons/README.md` pins Lucide revision
`2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`, and all three were fetched from exactly that revision
(HTTP 200 each) and checked for encoding: LF, no BOM, trailing newline, matching
`rectangle-horizontal.svg` byte-for-byte in style. That last check is not ceremony —
`tests/build/encoding.test.ts` refuses a BOM, and this repository has already lost a lint run to one.

| Card | Worktree | Lease | Contract | Status | Conditions |
|---|---|---|---|---|---|
| **W13-A** — the three harness icon fixtures | `.worktrees/ad11` (reused, carries `node_modules`), branch `w13a-icon-fixtures` cut from this commit | CREATE `tests/fixtures/editor-icons/{circle,squircle,anchor}.svg`. EDIT `tests/fixtures/editor-icons/README.md`, `tests/helpers/editorIconNodes.ts`, `tests/presentation/designer/designerIconToolbar.test.ts`. EDIT `src/presentation/designer/tools/designerToolIcons.ts` **COMMENT TEXT ONLY — no executable line may change**. EDIT any EXISTING test file or harness fixture that its own change turns red. CREATE any test file under `tests/`. Nothing else | wave 13 base, `r1` | dispatched | reviewed by an agent that did not write it; the inverted assertion watched red BEFORE the fixtures land and green after |

### The hazard that is also the instrument

`tests/presentation/designer/designerIconToolbar.test.ts` **asserts the absence as an exact set**:

```js
expect(missing.toSorted()).toEqual(['anchor', 'circle', 'squircle']);
```

It goes red, **by design** — its own docblock says so: *"Pinned as an exact set rather than a count
so that it moves in both directions: adding one of the three fixtures (which needs
`tests/helpers/editorIconNodes.ts`, the generated node map) turns this red, and so does a new tool
quietly introducing a fourth gap."* That is a case written in anticipation of this wave.

**It must be RE-SITED, never deleted.** Half its purpose survives intact and is the half that still
has work to do: a new tool introducing a gap. The set becomes empty and the case's subject becomes
"this surface has no unrendered glyph", which is a stronger claim than the one it replaces.

### What the lease has to say out loud

- **The node map has NO generator.** `grep -rn editorIconNodes scripts/` prints nothing; the README
  calls the entries *"mechanically transcribed"*, which means by hand. Both halves are required —
  an SVG without a map entry renders nothing and the fixture permission alone is insufficient for
  its own purpose, which the session-nine hand-off states as *"grant both or neither"*.
- **`designerToolIcons.ts` carries two sentences the user's vault walk falsified** — that the three
  are marked `data-icon-missing` in the harness, and that whether the catalogue answers `squircle`
  *"is verified nowhere in this repository"*. The first is what this card changes; the second was
  changed by a person in a vault. Hence the comment-only grant on a `src/` file.
- **Record the vault verification narrowly.** The Obsidian VERSION was not recorded, so it is one
  installed catalogue, one machine, one date — more than existed before, less than a pinned claim.
  The README's own house style for this is the *"whether the installed host catalogue answers X is
  not verified here"* sentence, which for these three is now answerable and must not be overstated.

### Wave 13 closed

Candidate `129dcbfb8`, fix round `25aad5294`, merged fast-forward. One card, so lease compliance
replaced disjointness again: the changed-file list is the ten files the row grants, the `src/` edit
comment-only, verified with `git diff -U0` filtered of comment lines.

**The review found a defect the card's own change created, and it is the most transferable thing in
this wave.** Inverting the missing-set assertion to the empty set removed the LAST positive producer
of `data-icon-missing` from the suite — every other occurrence in `tests/**` is a negative. The
reviewer reached that by exhaustive grep and could not execute it, being read-only, and said so. The
integrator executed it: deleting `parent.dataset.iconMissing = canonicalName;` from the fake left
**10 files and 197 tests green** while turning eight cases vacuous at once.

**The card then refused the reviewer's suggested site and argued a better one**, which is the
behaviour this package wants from a fix round. The guard went in `tests/helpers/obsidianIcons.test.ts`,
beside the module that writes the marker, rather than in the node-map file — because the hole opened
precisely because the only positive statement lived in a CONSUMER that a later wave was right to
empty, and putting the replacement in another consumer repeats the shape. Same mutation after the
fix: 1 failed of 198, and the failure is the new guard.

**An unrequested test file was kept on merit, not waved through.** `editorIconNodes.test.ts` compares
every map entry against its SVG, closing a gap the README's "mechanically transcribed" had left open
with no generator and nothing re-running it. The reviewer was asked to judge it and did: 64 files
against 64 map keys, no duplicate instrument, parses rather than greps, twelve established siblings
in `tests/helpers/`. It also had one case DELETED as redundant against its own neighbour.

**What the suite still cannot do was done by hand.** `npm run harness` plus the in-app browser: 14
icon bearers, zero missing, and a 72px probe screenshot confirming the five draw a rectangle, a
rounded square, a circle, a dash and an anchor. A test proves the entry is reached and reproduces the
upstream nodes; it cannot prove the picture is a circle.


## Wave 14 — AD15 partial rows that need no host, dispatched 2026-09-21

**Authorized by the user** after the integrator split AD15's partial rows into those needing a
vault and those needing only a test. **Ten rows were proposed and SEVEN are dispatched**, because
three turned out not to be test work at all. That triage is the wave's first deliverable and it
happened before any card was written:

- **T20 is STRUCTURAL, not a missing test.** `validateMembers` in `AssetShape.ts` checks each member
  against `known`, the set of GRAPHIC ids. A group id is not in that set, so a group naming another
  group is already refused as `dangling-group-member` — by the case that exists. Nesting is neither
  separately expressible nor separately refusable, and a "refuses a nested group" case would be the
  dangling path under a misleading name.
- **T13 needs a `src/` change, not a test.** `AssetRepository` and `AssetGeometrySidecar` both import
  the SAME `EntityVersion` from `./versioning`. A compiler-level refusal means branding a type across
  two ports and their call sites.
- **T01 may be a feature gap.** A replacement warning exists at `en.ts` — but it is the UNSCALED one,
  gated on `dimensionsUnscaled`. Presets warn and clearance warns; whether a MEASURED footprint is
  replaced silently is an open question.

All three are put to the user as rulings rather than guessed at.

| Card | Worktree | Lease | Contract | Status | Conditions |
|---|---|---|---|---|---|
| **W14-A** — AD15 rows **T28** and **T30**, the plan-symbol output half | `.worktrees/ad07`, branch `w14a-plan-symbol-output` | EDIT `tests/presentation/editor/elements/assetShapeConfig.test.ts`. CREATE any test file under `tests/`. EDIT any EXISTING test file or harness fixture its own change turns red. **No `src/` change** | wave 14 base, `r1` | dispatched | reviewed by an agent that did not write it |
| **W14-B** — AD15 rows **T07**, **T21** and **T41**, designer presentation | `.worktrees/ad10`, branch `w14b-designer-presentation` | EDIT `tests/presentation/designer/designerArrangePanel.test.ts`, `tests/presentation/designer/layers.test.ts`, `tests/presentation/designer/designerCrossLeaf.test.ts`. CREATE any test file under `tests/`. EDIT any EXISTING test file or harness fixture its own change turns red. **No `src/` change** | wave 14 base, `r1` | dispatched | reviewed by an agent that did not write it |
| **W14-C** — AD15 rows **F08/T16** and **T37**, fixtures and mirror | `.worktrees/ad11`, branch `w14c-fixtures-and-mirror` | CREATE files under `tests/vault/legacy-schema/`. EDIT `tests/vault/legacy-schema/README.md`, `tests/infrastructure/persistence/dto/assetGeometry.test.ts`, `tests/domain/asset/referenceFrame.test.ts`. CREATE any test file under `tests/`. EDIT any EXISTING test file or harness fixture its own change turns red. **No `src/` change** | wave 14 base, `r1` | dispatched | reviewed by an agent that did not write it |

**Disjointness holds by file and was checked before dispatch**, not after: A owns one file under
`tests/presentation/editor/elements/`, B owns three under `tests/presentation/designer/`, C owns
`tests/vault/legacy-schema/`, one file under `tests/infrastructure/` and one under `tests/domain/`.
No path appears in two rows. It will be re-checked by intersecting
`git diff --name-only <base>..<sha>` across all three candidates AND their fix-round shas.

**`AD15-validation-matrix.md` is NOT leased to any card.** The integrator regrades it, because three
cards each editing the same table is the merge this package has already paid for once, and because a
row's grade is a judgement about evidence rather than part of writing the test.

### The instruction every card carries, and it is the point of this wave

**If a row turns out to be STRUCTURAL rather than a missing test, say so and do not force a test.**
Three of the ten already were. A row whose behaviour is unreachable, or already covered under
another name, earns a written argument and a regrade — never a case that asserts the absence of a
state the types cannot express, which CLAUDE.md warns costs a branch it can never pay back. **A card
that reports "this row needs no test, and here is why" has succeeded, not failed.**


## Wave 15 — the two manual cases AD15 names no case file for, dispatched 2026-09-21

**Authorized by the user** in these words: *"do both, start with the 10 rows"*. The ten rows shipped
as wave 14; this is the second half. **T12 and U05 are the only two open matrix rows that have no
written case at all** — the matrix names a case file for U01 through U04 and pointedly names none
for these two, so there is no procedure to walk, only a plan.

**Why these two are worth a human's time when most open rows are not.** Every leaf in this suite is
a `FakeLeaf` that records asks rather than behaving. Real multi-leaf conflict behaviour has been
observed by nothing, ever. That is a structural blindness rather than thin coverage, and it is what
both cards are pointed at.

### What the integrator established BEFORE writing either brief, and what it costs a card to ignore

Two read-only reconnaissance agents read the designer's conflict and recovery paths. Four facts
decide whether a step is real, and a case written without them would walk a procedure that cannot
produce the state it names:

- **No plugin control opens a second leaf on one asset.** The palette command, the asset library's
  **Edit shape** and the project view's create flow all funnel into one `revealAssetDesigner`, which
  matches on `assetId` and reveals the existing leaf (`revealAssetDesigner.ts`, `reveal.ts`). A
  second leaf must come from Obsidian's own tab split or a restored layout, and **whether Obsidian
  offers that for a third-party `ItemView` is host behaviour this repository cannot settle.**
- **An idle second leaf does not conflict — it refreshes.** `updateAssetShape` publishes
  `AssetDesignChanged`, every leaf subscribes through `createAssetDesignChangeSource`, and each one
  re-reads within a tick. The conflict window is a **held gesture**: a Select or Bend drag captures
  `geometryVersion` at the press (`designer-select-tool.ts`), so the only hand-reproducible recipe is
  press-and-hold in one leaf, write in the other, release.
- **Redrawing identical geometry is `no-write`, not a conflict** (`updateAssetShape.ts`, pinned by
  `setAssetFootprint.test.ts`). A walker who repeats a gesture to "check it still conflicts" gets a
  clean indicator and the wrong conclusion.
- **A failed WRITE and a failed READ-BACK surface in two different widgets and neither mentions the
  other**: the header's save-state word for the write, an additive `<p role="status">` at the foot of
  the shell for the read. The designer has no stale strip with buttons, no **Try again**, no
  **Open source note**, and nothing is paused.

### Two `src/` findings recorded as RECORDED HOLES, by the user's decision, not fixed

Both were verified by the integrator at source rather than taken on a subagent's report. Neither is
authorized work; each becomes a step whose expected result is what the code does today, on the
pattern `docs/tests/cases/Recover from a stale read.md` step 4a already uses.

- **The designer's header reads `Saved` while its own strip says the canvas may be out of date.**
  `DesignerHeader.vue` mounts `SaveStateIndicator`, which derives `saved-refresh-needed` from
  `useProjectStore().stale` and `planningReadState` — and `AssetDesignerView.ts` gives the designer
  its own Pinia, where neither is ever hydrated. That component's own docblock says it reads *"THIS
  Plan Editor's own store"*. So `save-state.saved-refresh-needed` is in the locale table, is asserted
  by plan-editor tests, and **cannot be produced by the asset designer**. A case expecting it would
  be wrong about the build rather than finding a defect in it.
- **`unrecoveredWrite` is set by the designer and drawn nowhere.** Its readers are
  `PlanEditorRoot.vue`, `elementActions.ts`, `rotationActions.ts`, `DraftRecovery.vue` and
  `shell/warnings.ts` — every one of them the Plan Editor. A half-undone background undo stamps the
  flag and the user sees the same two words any other failure gives.

| Card | Worktree | Lease | Contract | Status | Conditions |
|---|---|---|---|---|---|
| **W15-A** — matrix row **T12**, two leaves and the expected-version conflict | `.worktrees/ad07`, branch `w15a-two-leaf-conflict` | CREATE `docs/tests/cases/Two designers on one asset.md` and `docs/tasks/asset-designer-expansion/reports/W15-A-two-leaf-conflict.md`. READ anything. **No other file is written at all** — not the suite, not the matrix, not `src/`, not `tests/` | wave 15 base, `r1` | dispatched | reviewed by an agent that did not write it |
| **W15-B** — matrix row **U05**, recover rather than lose work | `.worktrees/ad10`, branch `w15b-recover-not-lose` | CREATE `docs/tests/cases/Recover an asset design rather than lose it.md` and `docs/tasks/asset-designer-expansion/reports/W15-B-recover-not-lose.md`. READ anything. **No other file is written at all** — not the suite, not the matrix, not `src/`, not `tests/` | wave 15 base, `r1` | dispatched | reviewed by an agent that did not write it |

**Disjointness is two files each, both named after the card and will be re-checked by intersecting
`git diff --name-only <base>..<sha>` across both candidates AND their fix-round shas** — wave 14's
W14-C gained two paths from a mid-wave lease extension, so a candidate-only check is not enough.

**Three shared files are the INTEGRATOR's and are leased to neither card**, because both cards would
otherwise edit all three: `docs/tests/suites/Smoke Test the Editor.md` (its `## Cases` list and its
five-tier step census, which is re-derived by grep and never incremented),
`reports/AD15-validation-matrix.md`, and the `contracts/DECISIONS.md` / `execution/state.json` pair.

### The instruction both cards carry, and it is the point of this wave

**A fault setup nobody has produced is a plan, not a procedure.** Wave 14's lesson was that three of
ten rows asked for the wrong thing; this wave's equivalent risk is a step naming a fault that cannot
be produced by hand. Derive every fault from the code, say which read or write each one breaks, and
**where no hand-reproducible setup exists, say so and narrow the case** rather than invent one. A
card reporting "this clause cannot be walked, and here is the code that says why" has succeeded.

## Wave 16 — the three matrix halves a test can close, dispatched 2026-09-22

**The triage that produced this wave is its own deliverable, and it found MORE rulings than cards.**
Eleven rows were read at source against the tree. Three carry a half a jsdom test can honestly
close; eight do not, and those land as ruling **AD15-R2** rather than as work. One of the eleven —
**T25** — turned out to be a STALE ROW rather than an open one: commit `ef1ba2dff` (2026-09-19,
*"close T25's two residual gaps"*) added both cases the row names as missing, and the matrix has
been edited three times since without regrading it. That is a correction, not a decision, and it is
recorded as one.

**No card in this wave writes `src/`, a locale table, a styles partial or a document outside its own
report.** The three `src/` findings stay recorded-only by the user's decision, asked a second time
because the session's scope had changed since the first.

| | |
|---|---|
| Base | this commit — the table below is IN it, not granted after the fact |
| Contract | `r1` |
| Cards | three, the maximum, and each one independently reviewed by an agent that did not write it |

| Card | Worktree | Lease | Contract | Status | Conditions |
|---|---|---|---|---|---|
| **W16-A** — matrix row **F12**, the 25/250/1000 part fixture family | `.worktrees/ad11`, branch `w16a-part-fixtures` | MODIFY `tests/helpers/assetShapes.ts`. CREATE `tests/domain/asset/partFixtures.test.ts` and `docs/tasks/asset-designer-expansion/reports/W16-A-part-fixtures.md`. MAY CREATE **one** new helper under `tests/helpers/` if `assetShapes.ts` would exceed its cap, naming it in the report. READ anything. **No other file is written** — not `src/`, not a locale, not a styles partial, not the matrix | wave 16 base, `r1` | dispatched | reviewed by an agent that did not write it |
| **W16-B** — matrix row **F10**, one definition across two projects | `.worktrees/ad10`, branch `w16b-two-project-scope` | MODIFY `tests/application/queries/listPlansUsingAsset.test.ts`. CREATE `docs/tasks/asset-designer-expansion/reports/W16-B-two-project-scope.md`. READ anything. **No other file is written** | wave 16 base, `r1` | dispatched | reviewed by an agent that did not write it |
| **W16-C** — matrix row **T32**, a theme flip that leaves geometry alone | `.worktrees/ad07`, branch `w16c-theme-flip` | MODIFY `tests/presentation/designer/designerTheme.test.ts`. CREATE `docs/tasks/asset-designer-expansion/reports/W16-C-theme-flip.md`. MAY MODIFY an existing harness fixture under `tests/helpers/` **only** if the flip cannot be driven without one, naming it in the report and reporting the collision risk with W16-A. READ anything. **No other file is written** | wave 16 base, `r1` | dispatched | reviewed by an agent that did not write it |

**Disjointness is two files each and will be re-checked by intersecting `git diff --name-only
<base>..<sha>` across all three candidates AND their fix-round shas** — wave 14's W14-C gained two
paths from a mid-wave lease extension, so a candidate-only check is not enough. The one path two
cards could collide on is `tests/helpers/`, which is why W16-A names the file it may add to and
W16-C is told to report rather than take a second one silently.

**Four things are the INTEGRATOR's and are leased to no card**:
`reports/AD15-validation-matrix.md`, the `contracts/DECISIONS.md` / `execution/state.json` pair,
`reports/MANUAL-PASS.md`, and `reports/RESUME.md`. A card that believes a matrix row is wrong says
so in its report; it does not edit the row.

### The instruction every card in this wave carries

**A row that wants no test has to be allowed to say so, and T25 is why.** This wave exists because
eight of eleven rows turned out not to be test work, and one of the three that looked open had
already been closed nine days earlier by a commit whose message says exactly that. So: **run `ls`
on the directory before believing a gap exists**, list every `it(` in the file you are about to add
to, and if the case you were asked for is already there under another name, **report that and write
nothing**. A card reporting *"this row needs no test, and here is the commit that closed it"* has
succeeded.

**And write the guarantee to the check.** Each of these three rows has a half that stays open after
the card is done — F12's measurement needs a host, F10's frozen half cannot exist (`r1` row 3), and
T32's visibility half is unreachable because jsdom has no rendering engine. Say in the report which
half you closed and which you did not, in the row's own words, so the integrator can regrade from
the report rather than re-deriving it.
