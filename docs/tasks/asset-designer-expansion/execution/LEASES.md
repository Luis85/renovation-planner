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

No leases are held from the first execution session; one agent held everything and released it.

Use independent disposable test data and harness ports. Release a lease only after its owner has committed/handed off or explicitly suspended changes; do not reassign a dirty shared file implicitly.
