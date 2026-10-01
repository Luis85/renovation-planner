# AD01 — screen states, ownership and the mockup ruling

Contract revision `r1`, 2026-09-16, baseline `f3a8864a9e9e14c3e39c9adf6c06bdf0f2fa6a52`.
Companion to [DECISIONS.md](DECISIONS.md); where the two disagree, DECISIONS.md's r1 table wins.

**Every "today" column below is read off the code at that baseline, not off a mockup.** A state
marked *exists* has a named component and at least one test; a state marked *absent* has neither,
and the task that owes it is named.

## 1. Screen states S00–S11

| ID | State | Today | Owner |
|---|---|---|---|
| **S00** | Initial / loading / missing / unreadable / stale | **exists in full.** `AssetDesignerRoot.vue`: `designer.loading` line while `design === null`; `failure` computed routing three ways — `isMissingAsset` → headline + **Close leaf** (not a retry, because the note is not coming back), `surfaceFor(...)==='session-failure'` → no retry (the composition root wired nothing), otherwise `trError(failed)` + **Retry**; `staleAfterRefresh` → `.rp-designer-notice` when a post-write read-back failed while content is still drawn. Background missing/unreadable get their own two notices | AD03 (no change owed unless a new door can fail) |
| **S01** | Main workspace | **exists.** Four regions — `.rp-designer-toolbar`, `.rp-designer-canvas`, `.rp-designer-inspector`, `.rp-designer-status` — plus a sibling `DialogHost`. Status row carries the Shift hint, the grid step and `SaveStateIndicator`. Held by `assetDesignerRoot.test.ts` (regions) and `regionsReachable.test.ts` (import-graph walk) | AD06 |
| **S02** | Preset selection and parameters | **exists.** `AssetPresetForm.vue` over `domain/asset/presets/` (tables, seating, sanitary, plants/beds), `presetPreview.ts`, `props.replaces` warning when a design would be replaced, cancel writes nothing. Reached from the inspector's **Start from preset** | AD07 (gallery presentation only) |
| **S03** | Measurement-first creation | **exists, split over two surfaces.** `NewAssetForm.vue` / `CreateAsset` makes the asset; `AssetDimensionsDialog.vue` via `editDimensions` gives it a size. The empty state's action and the inspector's Set/Edit dimensions call **one** function so they cannot drift | AD07 |
| **S04** | Reference setup, calibration, tracing, unscaled notices | **exists.** `assetBackgroundPicker.ts` → `SetAssetBackground`; shared `CalibrateTool`; `backgroundLayer.ts`; `designer.dimensions.unscaled` warning; per-group pending flags (`footprintPending` / `clearancePending` / `anchorPending`). Background lock/opacity: **absent** | AD07, AD12 |
| **S05** | Single-part transform / points / bend | **exists.** `DesignerSelectionModes.vue` (`transform` \| `points` \| `bend`), `designer-select-tool.ts`, `handles.ts`, `partExtent.ts` numeric resize with the secant solver, `dragSnap.ts` + guides + grid | AD02 residual, AD08 |
| **S06** | Multiple parts selected | **absent.** `DesignerSelection` is one part at a time by construction | **AD08**, AD10 |
| **S07** | Parts panel | **absent.** No list of parts anywhere; `Asset Designer Foundations.md` states a single object has nothing to layer, which is about z-order, not about a finder | **AD09** |
| **S08** | Open line / polyline and rounded-shape authoring | **half.** Rounded exists — `bulges` on every outline, bend mode, draw-circle. Open lines are **absent**: `AssetDetail` is a closed outline with area rules | **AD11** (needs AD04's schema) |
| **S09** | Footprint / clearance / placement view | **exists.** `clearanceLayer.ts`, `anchorLayer.ts`, set-anchor and set-facing tools, height in the inspector. No numeric four-side clearance helper, no explicit review state | AD12 |
| **S10** | Preview / use in plan | **exists outside the designer.** `AssetPlacementTool.ts`, `AssetLayer.vue`, `AssetShapes.vue`, `AssetSuggestModal.ts`. The designer offers no "use in a plan" navigation and the library offers "open in designer" | AD13 |
| **S11** | Conflict / save failure / recovery, compact leaf | **exists.** Two write ledgers per leaf, expected-version conflicts, `designerCrossLeaf.test.ts`, `designerRefresh.test.ts`; the 460 px narrow shot is already in the capture table | AD03, AD06, AD15 |

**Focus, keyboard and compact rules that already hold and must not be re-invented.**
Delete and Ctrl+D are bound on the canvas element and refuse three cases — a key whose target is
not that element, any tool but Select, and a press still held on the selection. Escape cancels the
gesture before it clears a selection. Numeric drafts stay raw text until committed. The inspector
is a sibling region, so a Backspace in one of its fields never reaches the canvas listener. The
designer's status region deliberately carries **no** `role`, because the Shift hint is a standing
note and not an announced event.

## 2. File ownership for waves 2 onward

Integrator-owned by default — no worker edits these without a lease:

`AssetDesignerRoot.vue`, `runtime.ts`, `AssetDesignerContext.ts`, `ports.ts`,
`tools/registerDesignerTools.ts`, `stores/assetDesignStore.ts`, every locale module under
`presentation/i18n/locales/`, `plugin/RenovationPlannerPlugin.ts`, `plugin/assetDesignerDeps.ts`,
`infrastructure/persistence/dto/assetGeometry.ts` (the schema-version literal),
`domain/asset/AssetShape.ts`, `package.json`, `package-lock.json`, `eslint.config.mjs`,
`.oxlintrc.json`, `vitest.config.ts`, `.fallowrc.json`, `scripts/harness-shot.mjs`,
`docs/development/sdds/`, `docs/development/adrs/`.

Task-owned, disjoint, safe to work in parallel if the leases hold:

| Task | Its own files |
|---|---|
| AD02 | `domain/asset/shapeEdits.ts`, `scaleSolve.ts`, `selection/partExtent.ts` |
| AD03 | `selection/editShape.ts`, `application/editor/asset/ReversibleAssetDesignCommands.ts` |
| AD04 | `domain/asset/AssetDetail.ts`, the DTO schemas, `infrastructure/persistence/mappers/` |
| AD05 | `domain/spatial/assetPlacement.ts`, `presentation/editor/elements/`, `library/AssetMark.vue`, `application/queries/ListAssetOutlines.ts` |
| AD06 | `styles/designer.css`, `DesignerToolbar.vue`, `DesignerViewMenu.vue` |
| AD07 | `presets/`, `views/NewAssetForm.vue`, `dialogs/AssetDimensionsDialog.vue` |
| AD08 | `selection/designerSelection.ts`, `designer-select-tool.ts`, `selection/hitTest.ts`, `selectionDrag.ts` |
| AD09 | a new `presentation/designer/parts/` directory |
| AD10 | `domain/asset/detailEdits.ts` plus a new grouping module in `domain/asset/` |
| AD11 | `tools/draw-detail-tool.ts` plus a new open-line tool |
| AD12 | `layers/clearanceLayer.ts`, `anchorLayer.ts`, `commands/asset/CalibrateAsset.ts` |
| AD13 | `library/`, `modals/AssetSuggestModal.ts`, `infrastructure/obsidian/workspace/revealAssetDesigner.ts` |

Two standing rules the repository already enforces and every task inherits: a component under
`src/presentation/designer/` that is not reachable by import from `AssetDesignerView.ts` fails
`regionsReachable.test.ts`, and a tool implemented without an entry in `DESIGNER_TOOL_LABELS`
cannot be registered at all — the record type is total over that table's keys.

## 3. The concept boards, ruled

| Board element | Ruling | Status at r1 |
|---|---|---|
| Central canvas, Add/Parts left, properties right | **implement** — adapt to leaf width | canvas + inspector exist; Parts is AD09 |
| Vanity example | **existing/reuse** as a fixture; dimensions illustrative | AD15 |
| Logo, marketing banner, account shell | **defer permanently** — host chrome supplies context | absent; keep absent |
| Save / Save asset button beside autosave | **correct** — one persistence model, `SaveStateIndicator` | absent; keep absent |
| Library drawn beside the designer | **correct** — a related surface, not a second permanent sidebar | library is its own view |
| Green "fits well" | **defer permanently** — no automatic fit certification | absent; keep absent |
| Fixed clearance numbers | **correct** — user input, never sample values as standards | authored boundary only |
| Back-centre anchor, front arrows | **correct** — derive from the shipped facing convention, never from the board | `set-facing-tool.ts` is the authority |
| North compass | **defer permanently** — front direction is not geographic north | absent; keep absent |
| White background, fixed blue | **correct** — host theme variables, light and dark validated | `styles/` uses Obsidian variables; the build refuses a hard-coded colour |
| Freehand / advanced path icons | **defer** until authoring, persistence, render and export all exist | absent; AD11 brings open lines only |
| Texture-heavy artwork | **defer** — optional decoration, not a subsystem | absent |
