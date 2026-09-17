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

A worker that needs a file not in its row submits a precise integration change request in its report.
It does not edit it, and it does not work around it by putting the logic somewhere it does own.

No leases are held from the first execution session; one agent held everything and released it.

Use independent disposable test data and harness ports. Release a lease only after its owner has committed/handed off or explicitly suspended changes; do not reassign a dirty shared file implicitly.
