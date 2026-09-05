# Whole-tree review findings — 2026-09-05

The record behind [`../plans/2026-09-05-improvement-and-polish-pass.md`](../plans/2026-09-05-improvement-and-polish-pass.md). Every item here was found by one of eight independent finders (one per layer, one on PR #73's diff, one on CLAUDE.md's claims) and then re-derived by a separate verifier that had to quote the code, reproduce the number with `node -e`, or cite the guard that refutes it. Refuted items are kept, because the next reviewer will find them again.

## Baseline (measured at `a1b3e3c4`, 2026-09-05)

| Instrument | Result |
|---|---|
| `npm run check` | green, exit 0 |
| Test files / tests | 469 files, 6539 passed, 70 skipped (parametrised `runIf` pairs in `layer-boundaries.test.ts`; one `skipIf(!canSymlink)`) |
| Coverage (stmts / branches / funcs / lines) | 99.33 / 98.20 / 99.18 / 99.62 against floors 99 / 98 / 99 / 98 |
| Coverage headroom in UNITS | statements 34, branches 11, functions 5, lines 55 |
| fallow | 0 dead files, 0 dead exports, 0 clones, MI 90.9 |
| Bundle | 958.09 kB (gzip 288.08 kB) from the gate; a second build the same hour printed 965.27 kB — the number in CLAUDE.md is stale either way |

**Functions has about five units of headroom; branches about eleven.** Every task in the plan ships its arms with their tests.

## Verdict key

CONFIRMED — constructed from quoted code or reproduced. PLAUSIBLE — mechanism real, state realistic, not driven here. REFUTED — contradicted by a quoted line, a recorded ruling, or a guard. Severity is from the user's seat: high = data loss or a user locked out of their own work; medium = a wrong screen, a lost gesture, or a silent failure; low = reachable only programmatically, or claim-versus-code.

## Application layer

| Id | Verdict | Sev | Location | Finding | Fix shape |
|---|---|---|---|---|---|
| A1 | CONFIRMED | **high** | `src/application/commands/requirement/reversible-override-commands.ts:136`; `src/presentation/editor/inspector-wiring.ts:136-152` | The two override adapters keep `Snapshot.postVersion` privately and `undo` presents it as `expected`. `inspector-wiring` mints a NEW adapter per edit. Quantity edit (adapter A, rev0→rev1), cost edit (adapter B, rev1→rev2), undo B (→rev3), undo A presents V1 against rev3 → `requirement.revision-conflict`, a Save error, and the first edit is never undone. `WriteLedger.ts:14-19` names this exact sequence as its reason to exist. `overrides.test.ts:97` builds two adapters and stops one undo short. | Take the `WriteLedger` in `ReversibleOverrideBase`; `expected = ledger.lastWritten(id) ?? snapshot.postVersion`; `record` after every write; `observe` + generation check as `reversible-create-zone-command.ts` does. |
| A2 | PLAUSIBLE | medium | `src/application/events/requirementFiguresChangeSource.ts:37` | `CostEstimateChanged`, `RequirementCreated`, `RequirementDeleted`, `RequirementRestored` have no subscriber anywhere in `src/` (28 subscribe sites enumerated). The override path publishes only `CostEstimateChanged`, so a peer Plan Editor leaf on the same plan never refreshes after an override. Needs a second leaf (pane split / restored layout), hence PLAUSIBLE. | Add `CostEstimateChanged` (payload `scope.id`) to the figures source; route the three lifecycle events to the source that refreshes a zone's requirement list. |
| A3 | CONFIRMED | low | `deleteResolution.ts:448-486`, call sites `:523,:526` | `compensate` does not receive `markers` and never clears the marker, success or failure. Next load replays `restoreEntry` against versions compensation already moved past → `sequence.recovery.restore-refused` at ERROR per entry over a correct vault; the marker is cleared at the end of that load. | Pass `markers` into `compensate`; `clearMarker` when `uncompensated === false`. |
| A4 | CONFIRMED | low–med | `deleteResolution.ts:377`; invariant at `:321-323` | The reassign arm's `recalculateInline` publishes `RequirementRecalculated` + `CostEstimateChanged` from inside `applyAll`, before `deleteEntity`, while the `AppliedStep` docblock says announcements are collected "because this whole sequence is compensated on a later failure". With A2 a peer leaf re-reads the intermediate state and never hears the correction. | Ruling R3: narrow the docblock now and record the deferral, or defer the recalculation past `deleteEntity`. |
| A5 | CONFIRMED | medium | `recoverInterruptedSequences.ts:78` (`save`), `:143` (`clear`), outer catch `:173` | The read at `:66` is `.catch`-guarded under a comment that a rejection "would take every later marker with it"; the save on the next line and the clear are bare. One rejecting save abandons every later marker. | Same `.catch(persistenceError(...))` shape on both; the `isErr` arm already exists. |
| A6 | CONFIRMED | medium | `toUserMessage.ts:64-69`; `locales/en.ts` | Nine application-minted codes have no locale entry and no suffix match, so they fall to the category sentence beside siblings that have specific ones: `reference.reassign-target-gone`, `reference.entity-gone`, `reference.resolution-without-set`, `reference.reassign-without-target`, `requirement.not-found`, `requirement.zone-gone`, `requirement.asset-gone`, `zone.nothing-to-undo`, `undo.before-execute`. The guarding test is scoped to `src/infrastructure/`. | Nine rows in `en.ts` + `de.ts`; widen the per-kind scan to `src/application/` with an exclusion table. |
| A7 | CONFIRMED | medium | `deleteResolution.ts:494` (`markers?`), `DeleteZone.ts:50`, `DeleteAsset.ts:46`, `composition-root.ts:269,287,307`, `RenovationPlannerPlugin.ts:783` | The durable-recovery collaborator is optional, the shape `AssetPriceOverrideRepository.ts:103-106` and `recoverInterruptedSequences.ts:18-19` record refusing by name. `ResolutionOps.notify` (`deleteResolution.ts:114`) and `CascadeDeps.notify` (`cascade.ts:23`) — the two named precedents — are still optional too. | Make all three required; tests pass a no-op from `tests/helpers/`. |
| A8 | CONFIRMED | low | `SetRequirementQuantityOverride.ts:142`; rule at `deriveRequirementFigures.ts:108-110` | `previous.amount === current.amount` where `sameMoney` is the house answer; `19.5` vs `19.50` publishes a spurious `CostEstimateChanged`. | `if (sameMoney(previous, current)) return;` |
| A9 | PLAUSIBLE | med–low | `ReversibleCalibratePlan.ts:252-256`; `cascade.ts:33` | `Promise.all` over every zone's `zoneGeometryChanged`, each starting a cascade bounded at 4 → 4 × zones concurrent writes. | `for…of` the publishes, or reuse the cascade's worker pool. |
| A10 | PLAUSIBLE | low–med | `UpdateAsset.ts:79` | Level-1 lock taken only on a kind change; a plain `unitCost` edit can land inside a delete resolution's level-1 region (outcome: a refusal and compensation, not a lost write). The docblock is scoped, not unconditional. | Acquire `[current.id]` unconditionally. |
| A11 | REFUTED | — | `ReversibleAssetDesignCommands.ts` | `markCompensated` has one call site (`SetAssetBackground.ts:239`), wrapped only by the background adapter; the other adapters reading `compensatedVersionOf` would be dead code. | none |
| A12 | CONFIRMED | low | `application/errors.ts:31` | `calculationError` assigns `cause` unconditionally; `persistenceError` spreads it with the reason stated. | Copy the spread. |

## Infrastructure layer

| Id | Verdict | Sev | Location | Finding | Fix shape |
|---|---|---|---|---|---|
| I1 | CONFIRMED | medium | `VaultChangeAdapter.ts:119` (guard `:113`) | `(debounceMs ?? 500) <= 0` guards the synchronous path, then `window.setTimeout(fn, this.deps.debounceMs)` runs with `undefined` → **0 ms**. Production (`composition-root.ts:502`) passes no `debounceMs`. `branches.test.ts:121` passes `undefined` and asserts a flush within 10 ms, which pins the defect. | One hoisted `const delay = this.deps.debounceMs ?? 500`; that test passes `0` or calls `flush()`. |
| I2 | CONFIRMED | low | `SequenceMarkerFileStore.ts:90` | `(raw as {...}).markers` is read one line BEFORE the `raw === null` guard; a file containing `null` throws a TypeError out of `queues.run` as a rejection. Any unparseable file also makes `write` err forever (no repair path). | Move the read below the guard; add a `'null'` body case. |
| I3 | PLAUSIBLE | low | `tests/helpers/fixtureVault.ts:291` | `on()` takes no arguments, returns `{ off }`, no `offref` — the pre-fix shape `vault.ts:389-397` records fixing on the in-memory side. No test today composes `createVaultFileChangeSource` against `openFixtureVault`, so no live throw. CLAUDE.md's "differ in three host fakes and nothing else" is a fourth difference. | Give `FixtureVault` the `listeners`/`on`/`offref` trio. |
| I4 | CONFIRMED | low | `tests/helpers/vault.ts:415,426`; mutators `:281,:301,:322` | `FakeVault.trigger` and `eventListenerCount` have zero callers; `create`/`modify`/`delete` fire no event, so the trash-then-delete-event ordering three production docblocks reason about is driven by nothing. | Fire `trigger` from the mutators; one release-count case. |
| I5 | CONFIRMED | medium | `PlanGeometryStore.ts:75-89` | `delete` trashes whatever file the index path names with no declared-plan check; the asset twin has `declaredAssetOf` (added after a named data-loss defect) and this class's own `readUnlocked:206` already refuses a foreign `planId`. | Mirror as `declaredPlanOf`; refuse only a positive foreign claim. |
| I6 | CONFIRMED | medium | `VaultChangeAdapter.ts:235` (removal `:217`) | On an id swap A→B, `existing?.geometrySidecarPath ?? …` hands A's sidecar to B, and the `??` means it wins even when B has a correct mapping. With I5, deleting B trashes A's geometry. | `(existing?.id === ref.id ? existing.geometrySidecarPath : undefined) ?? index.getGeometrySidecarPath(ref.id)`. |
| I7 | CONFIRMED (known) | medium | `RenovationPlannerPlugin.ts:797-802` | A `TFolder` rename/delete never reaches the adapter; every entry under it keeps its old path until a full rebuild. Recorded PRE-EXISTING in the increment history (~1551-1563) and in `Move the Library.md` steps 12/12b. | Out of this pass (ruling R6): its own increment, `Vault.recurseChildren` on the folder arm. |
| I8 | PLAUSIBLE | low | `ObsidianAssetRepository.ts:107` | The sidecar path hint is read at call time, outside `queues.run`; the plan twin captures inside. `AssetGeometryStore.delete` uses a hint unconditionally and reads an absent file as `ok`, so a stale hint is an orphaned `.rpgeo` reported as success. Window is narrow (different queue instances). | Move the read inside the closure. |
| I9 | PLAUSIBLE | low | `AssetGeometryStore` vs `PlanGeometryStore` | ~90 duplicated lines, but the two diverge structurally (migrations, absence semantics, error payloads). | Leave; revisit at a third sidecar store. |
| I10 | REFUTED | — | `EchoWindow.ts:46-49` | Keyed by path, `forget`/`move` bound it, the no-cap decision is argued at `:155-162` and the collision residue recorded at `:91-93`. | none |
| I11 | PLAUSIBLE (latent) | low | `reveal.ts:59-60` | `JSON.stringify(state, keys)` with an array replacer is a recursive allowlist: a nested object collapses to `{}`. Both callers pass a flat single key today. | Record the flat-state precondition in the docblock, or `Object.fromEntries(entries.toSorted())`. |
| I12 | REFUTED | — | `ObsidianPlanRepository.ts:231` | The no-observation call shape is supported and is the safe direction (`wroteFile`'s docblock `:86-89`). | none |

## Plugin layer

| Id | Verdict | Sev | Location | Finding | Fix shape |
|---|---|---|---|---|---|
| G1 | CONFIRMED | low | `RenovationPlannerPlugin.ts:814-822` | The adapter's debounce timer is not cancelled on unload; `flush()` runs against the retired index and bus (at 0 ms today, 500 ms once I1 lands). The adapter exposes only `flush()`. | Push `() => this.root.persistence?.changeAdapter.flush()` onto `disposers`; a timer case in `registration.test.ts`. |
| G2 | CONFIRMED | medium | `composition-root.ts:206,:310-312,:462`; `repositoryComposition.ts:61-102` | `ReferenceLocks` and every repository's `KeyedQueues` are per ROOT; `applySettings` rebuilds the root mid-write, so an in-flight write's lane is empty in the new root. Docblocks say "one lock set per plugin". `markerStore`/`continueStore` are memoised per session for exactly this reason. | Ruling R7: memoise `ReferenceLocks` per session; narrow the queue docblocks to per-root. |
| G3 | CONFIRMED | medium | `RenovationPlannerPlugin.ts:456-468`; `SettingsTab.ts:246-253` | `saveSettings` applies THEN awaits `saveData`; `queueSettingsWrite` swallows only on its own chain; Obsidian's `setControlValue` says nothing about rejections. A failed `data.json` write reaches nobody while the session already runs on the new setting. `persistLibraryFolder`'s docblock argues write-then-swap for a folder-naming setting, and `projectFolder` is one. | Save first, apply second; wrap in `notifyFault`; a rejecting-`saveData` case. |
| G4 | CONFIRMED | low | `RenovationPlannerPlugin.ts:352,:535` | `startPersistence()` is bare at both sites; `libraryMigration.ts:279-289` wraps the same call because the rebuild READS and can throw. A throw at layout-ready leaves the vault listeners unregistered and no notice. | try/catch inside `startPersistence`. |
| G5 | CONFIRMED | low | `:196-197`, `:805`, `:79` | "first thing unload must stop" over the third disposer; "exactly one step" over three; "flush pending writes" over nothing that flushes. | Correct the three sentences. |
| G6 | CONFIRMED | low | `composition-root.ts:243-248` | "`create-sample-project` is their only caller" — `ViewRoot.vue:222` and `ProjectDetailState.vue:137` dispatch `createProject`/`createPlan`. | Rewrite from a grep. |
| G7 | CONFIRMED | low | `:819` | `onunload`'s catch reads `this.root.logger`; `root!` is assigned after two disposers are pushed. | `(this.root?.logger ?? this.logger)`. |
| G8 | CONFIRMED | low | `libraryMigration.ts:123,:280,:292`; plugin `:512,:535` | One library move runs three full vault scans and three rebuild publishes. | `applySettings` skips the rebuild when the caller just ran it. |
| G9 | PLAUSIBLE | low | `:352` | `onLayoutReady` callback has no lifetime tie; disabling before layout-ready runs a full scan on an unloaded plugin. | `if (!this._loaded) return;` at the top of `startPersistence`. |
| G10 | PLAUSIBLE | low | `:198`, `:525` | The outgoing root's cascade subscriptions are never disposed on a swap; harmless unless something still publishes to the retired bus — which the un-flushed timer (G1) does. | `disposeCascade()` at the top of `applySettings`. |
| N3 | CONFIRMED | medium | `:465-466` | Folded into G3: apply-before-save is destructive for `projectFolder`. | as G3 |
| N4 | CONFIRMED | low | `libraryMigration.ts:292-300` | `saveData` succeeds, `applySettings` throws → reported as `settings.library-persist-failed` ("could not be saved"), which is false. | Distinguish the two arms. |

## Presentation — Renovation project view and price section (PR #73)

| Id | Verdict | Sev | Location | Finding | Fix shape |
|---|---|---|---|---|---|
| V1 | CONFIRMED | medium | `AssetPriceRow.vue:120,:172,:175` | `5b4031ae` added `price.pending` to `priceDisabled` bound to `:disabled`, and deleted `@blur="price.onCommit()"`. Enter disables the focused input; Chromium blurs it to `body`; nothing restores focus. `use-field-commit.ts:321-338` documents a gesture this caller no longer has. `RequirementRow.vue:331-378` is the house shape. | Ruling R2: `:readonly` + `aria-disabled` while pending; keep `:disabled` for `assetStatus !== 'known'`. |
| P1 | CONFIRMED | low | `AssetPriceRow.vue:57` | `/^-?\d+(?:[.,]\d{1,2})?$/` refuses `594.005` while `createMoney` accepts it and the previous build wrote such values. Cancel and Clear are the only exits. `assetPriceList.test.ts:528` pins `'1.234'` as refused. | `\d+` after the separator; drop `'1.234'` from the refuse list. |
| P2 | PLAUSIBLE | low | `RenovationProjectView.ts:172,:180` | `setState` awaits `canLeave()` before assigning `result.history`; whether Obsidian reads it synchronously is unverifiable here. | Assign `history` before the first `await`, reset on refusal; a manual case. |
| P3 | CONFIRMED | medium | `ProjectDetailState.vue:110-113` | `onOpenNote` runs `canLeave()`, whose confirm arm wipes the drafts, but opening the note leaves nothing. Discard destroys drafts; Stay makes the button inert. | Remove `canLeave()` from `onOpenNote`. |
| P5 | CONFIRMED | low | `ProjectDetailStore.ts:71-73` | Docblock: "It DOES clear the rows on a failure" — the PR deleted `assetPrices.value = []` deliberately (`ProjectPrices.vue:42` keeps rows with `refreshBlocked`). | Rewrite the docblock. |
| P6 | CONFIRMED | low | `tests/presentation/views/viewRootProjectDetail.test.ts:242-255` | Docblock names the exact rewrite the PR made as the mutation it is watched failing against; second claim also false (`ViewRoot.vue:171`). | Rewrite. |
| P7 | CONFIRMED | low | `de.ts:350`; `strings.test.ts:161-179` | The field accepts a comma now; the German example still reads `19.50`, and the comment names this trigger. The test checks against `createMoney`, which now blocks the correction. | `19,50`; rework the case to validate against the field's parser. |
| P10 | CONFIRMED | low | `assetPriceList.test.ts:278,:668` (and `:280-296,:313-331`) | Four docblocks describe a `draftToken`/blur-commit mechanism the PR deleted; two are glued to the previous `});`. | Rewrite against the tests they head. |
| P11 | CONFIRMED | medium | `ProjectDetailState.vue:230,:245-251` | `reloadPrices()` and both price subscriptions run in the DETAILS section too, where `ProjectPrices` is not rendered — a vault-wide `listAll` per details open and per catalogue event. `ViewRoot.vue:328-332` states the rule this breaks. | Gate on `section === 'prices'`. |
| P12 | CONFIRMED | low | `ProjectDetail.vue:34` | On `readOnly` the plan empty state is suppressed entirely; a mobile project with zero plans draws a heading and an empty list. `ViewRoot.vue:314` keeps the state and drops only the action. | Mirror `emptyActionLabel`. |
| V3 | CONFIRMED | low | `ViewRoot.vue:214,:380`; plugin `:324-330` | The `new-project` palette command is a plain `callback`; on mobile it navigates and then `onCreateProject` returns silently. | Ruling R4: `checkCallback` false on `Platform.isMobile`. |
| V4 | CONFIRMED | medium | `ProjectDetail.vue:87,:101`; `ProjectDetailStore.ts:195-199` | The `isErr(listed)` arm sets `plansError` without clearing `plans`/`unreadablePlans` (unlike `fail()`), so "N plans could not be read" from the previous read renders beside the failure notice. The `:108` docblock claims "cleared at all three places". | Clear both in that arm. |
| V8 | CONFIRMED | medium | `ProjectDetailState.vue:78-84,:181,:199` | `writeAssetPrice` calls `hydratePrices()` bare (outside `singleFlight`); the continuation derives `savedRefreshFailed` from the shared error ref after its own read was superseded; post-await writes skip `disposed`. | Return the read's outcome from the store and derive from it; re-check `disposed`. |
| V5 | CONFIRMED | low | `notify.ts:562` | `if (surface.kind === 'toast')` — the only zero-count branch in the file (`coverage-final.json`); `surfaceFor(…, explicit-operation)` returns toast for every category. | Drop the `if`. |
| V6 | CONFIRMED | low | `ProjectList.vue:446-451` | Comment says query and disclosure are NOT persisted; lines 113/130/305 persist both and `projectExperience.test.ts:152` asserts it. | Delete the stale clauses. |
| V7 | CONFIRMED | medium | `tests/harness/accessibility.test.ts:962-985` | Only `NewProjectForm` is axe-scanned as dialog content; `NewAssetForm`, `NewPlanForm`, `ConfirmDialog`, `DeleteReference`, `AssetDimensions` never are. | Five more `mountDialogContent` cases. |
| V10 | CONFIRMED (latent) | low | `route-error.ts:43` | `map[error.code]` on a `Record<string,…>`: a code of `constructor` resolves to `Object.prototype.constructor` → `kind: 'field'` with a garbage key. No minted code collides today. | `Object.prototype.hasOwnProperty.call(map, code)`. |
| V11 | PLAUSIBLE | low | `newAssetDialog.ts:56-71`, `ViewRoot.vue:213-238`, `ProjectDetailState.vue:125-169` | Only the double-pass of `busy` is worth sharing. | Optional two-line helper; not scheduled. |
| P4 | REFUTED | — | `AssetPriceRow.vue:113-117` | The Clear button is `v-if="showClear"`; no reachable call with `overridden === false`. | none |
| P8 | REFUTED | — | `RenovationProjectView.ts:330` | Mobile read-only is authorised by `docs/requirements/Bound the mobile surface to what it can actually do.md`, amended in the same PR. Its own criterion 4a (disabled-with-reason, never hidden) is still open and belongs to that PBI. | none here |
| P9 | REFUTED | — | `ProjectList.vue:114,131` | Persistence is authorised by `docs/requirements/Return to the project list with my search context.md`; the archived Home spec is what is stale. | Pointer from the archived spec. |
| V2 | REFUTED (design) | — | `library/`, `designer/` | The PBI above records the plugin-wide scope as open. | none here |

## Presentation — Plan editor and Asset designer

| Id | Verdict | Sev | Location | Finding | Fix shape |
|---|---|---|---|---|---|
| E1 | CONFIRMED | medium | `AddMenu.vue:331-334`; door `:315` | `onBeforeUnmount` calls `props.anchor?.focus()` for all three close doors; the focus-out door fires BECAUSE focus moved, so focus is stolen back. The only statement of intent is the component's header, not a ruling (R16(c) says the menu retires, nothing about focus). | Restore only when focus is still inside the menu. |
| E2 | CONFIRMED | low | `addMenu.test.ts:385-398` | The focus-out case never reads `activeElement` after the move. | Assert `data-rp-action === 'select'`. |
| E3 | CONFIRMED (by ruling) | medium | `save-state-store.ts:91-96`; `warnings.ts:93` | `resolveOk` clears `unrecoveredWrite` for ANY write, including undo/redo and a write to another zone. The trust-path plan pinned exactly this. | Ruling R1: key the flag by entity id. |
| E4 | PLAUSIBLE | medium | `ZoneShape.vue:66-121`; `ZoneLayer.vue:38-44` | Fragment-rooted vue-konva child: `vue-konva.mjs:56`'s `R()` returns `null`, so no `setZIndex` ever runs and paint order is MOUNT order; `models` is rebuilt from a Map per hydrate. Hit order and model order still agree (`registerEditorTools.ts:51-52`), so the divergence is paint vs hit for overlapping zones after a reorder. | One unconditional `<VGroup>` root (the `RoomDraftSketch.vue:158` remedy); an ordering test. |
| E5 | CONFIRMED | low | `EditorSurface.vue:182` | `PRECISE_TOOLS` names three Plan Editor ids; `DesignerCanvas.vue:168-170` mounts the same surface with `trace-footprint`, `trace-clearance`, `set-anchor`, `set-facing`. `CONSTRAINING_TOOLS` (`editorSnapping.ts:65-69`) settled the same question as ONE list. | Add the four ids. |
| E6 | CONFIRMED | low | `EditorSurface.vue`; `docs/issues/The canvas has no budget left for the next input rule.md` | 387 counted lines of 400 (36 template comments are not skipped by `max-lines`); the issue note names `PlanCanvas.vue` (139 lines now). | Repoint the note. |
| E7 | PLAUSIBLE (overstated) | low | `normalize-transform.ts:41`; `snap-service.ts:161,:267` | `normalizeTransformerResult`, `snapToGrid`, `snapResize` have no `src/` caller. `snapRotation` and `snapPoint` DO (via `snapDirection`, four tools). `editorSnapping.ts:17-29` already records the identity-today fact. | Ruling R5: delete the three dead members and their tests. |
| E8 | CONFIRMED | medium | `EditorSurface.vue:1050-1158` | No keyboard path moves a zone or edits a vertex; SDD §85 is binding ("every editor operation"). No issue or PRD item covers it. | Arrow-key nudge dispatching the same move gesture `select-tool` builds. |
| E9 | CONFIRMED | low | `DesignerGestureLayer.vue:60-66,:68` | The clone justification names the fragment-root hazard; `RoomDraftSketch.vue:158` is the VGroup-root remedy, mounted as a child component. Only the plan-editor copy is tested. | Extract the shared sketch/measurement into one VGroup-rooted component. |
| E10 | CONFIRMED | low | `EditorContextBar.vue:22-34` | `<header>` and `<nav>` share one `aria-label` key; the nav holds only spans. | Plain `<div>` for the crumbs. |
| E11 | CONFIRMED | low | `EditorSurface.vue:1146-1149` vs `:1172-1175` | Shift keydown is gated by `isCanvasKey`, keyup is not; the docblock claims a symmetric pair. | Narrow the sentence. |

## Core and domain (no UI path today; all low)

| Id | Verdict | Location | Finding | Fix shape |
|---|---|---|---|---|
| C1 | CONFIRMED | `costPipeline.ts:208` → `Money.ts:201` | NaN/Infinity pass every sign guard; `toFixed(NaN)` throws a raw `DecimalError` from a pipeline whose header promises no throw. Both `src/` callers hand validated finite values. | `!value.isFinite()` arm in `inputError` and `negativeQuantity`. |
| C2 | CONFIRMED | `operations.ts:486-489` | `intersect` returns `ok({NaN,NaN})` when products overflow (`1e200` segments). | Refuse non-finite `t`/`u`. |
| C3 | CONFIRMED | `operations.ts:503-506` | `project` same shape; the one caller drops the NaN by comparison. | Same guard. |
| C4 | CONFIRMED | `AssetShape.ts:126` | `normaliseFacing(-1e-17) === 2π` exactly; `-TAU` → `-0`. `SetAssetFacing` has no UI caller yet. | Fold `>= TAU` to 0. |
| C5 | CONFIRMED | `operations.ts:301` | `perimeter` answers `ok(Infinity)` where `area` refuses. No `src/` caller. | Refuse non-finite total. |
| C6 | CONFIRMED | `Asset.ts:107`; also `definitionDraft.ts:40` | `isNegative()` refuses `-0` as "got 0" against the rule stated four times; the second half of the original candidate (`SetRequirementQuantityOverride.ts:64`) is REFUTED (`String(-0)` is `"0"`). | `lessThan(0)` at both. |
| C7 | PLAUSIBLE | `Zone.ts:84,:95` | Stores the caller's polygon by reference after validating; `createPolygon` copies for the stated reason. No live mutator. | Route through `createPolygon`. |
| C8 | REFUTED | `Zone.ts:118` | Bowtie zones: recorded deferral (SDD §26; `Zone Editing Walkthrough.md:292`). `docs/entities/Spatial object.md:37` contradicts both. | Fix the entity note. |
| C9 | CONFIRMED | `Project.ts:184-185` | `Date` stored by reference on an "Immutable" entity. | `new Date(d.getTime())`. |
| C10 | PLAUSIBLE | `quantityEngine.ts:53,:63` | The header holds; the `:53` docblock ("the rest pass through") is what is false for `'fixed'`. | Fix the docblock. |
| C11 | CONFIRMED | `costPipeline.ts:177`, `Project.ts:42`, `Asset.ts:226`, `AssetPriceOverride.ts:68` | Four hand-spelled negative-money guards; two byte-identical messages under two codes. No refusal recorded. | One helper beside `checkWasteFraction`. |
| C12 | CONFIRMED | `tests/core/units/measurementUnit.test.ts:18-23` | Asserts its own fixture; the `Readonly<Record<…>>` annotation is the instrument. | Delete the case. |
| — | new | `definitionDraft.ts:56-57` | `definitionChanges` parses unguarded; safe only while every caller validates first. | Guard as the sibling does. |
| — | new | `tests/core/geometry/operationsNumericLimits.test.ts` | Covers `area`, `centroid`, `enclosesArea` only. | Cases for C2/C3/C5. |

## Cross-cutting: claims, docs, tooling, styles

| Id | Verdict | Location | Finding | Fix shape |
|---|---|---|---|---|
| X1 | CONFIRMED | `docs/issues/Slice 13 is designed and planned and not yet built.md` | `status: New`, body says no code written; slice 13 is built. | Close with a dated section. |
| X2 | CONFIRMED (framing corrected) | `docs/tasks/12,13,14,16,17,18,19,20,21-*.md` | Nine task docs have `status: ""`; `10` and `15` are `Active`; `Product Backlog.base` keys on `note.status`. | Set each from its own amendments. |
| X3 | CONFIRMED | CLAUDE.md lines 692, 719, 720, 730; `vitest.config.ts:192` | "twelve ESLint-booting files" — the config's own derivation finds 14. | Re-derive or drop the number. |
| X4 | CONFIRMED | `vitest.config.ts:83` | "40 files" — 41 on the date named. | Drop the number. |
| X5 | CONFIRMED | CLAUDE.md:724 vs `vitest.config.ts:185` | 167s vs 156s for one measurement. | One cites the other. |
| X6 | CONFIRMED | `.fallowrc.json` `.test-d.ts` paragraph | Claims tsconfig "names each one directly"; it is four globs, and the hazard argued is inverted. | Rewrite the paragraph. |
| X7 | CONFIRMED | `FormBanner.vue:24` | `rp-form-banner__glyph` declared by no partial, referenced by no test. | Rule in `forms.css`; widen the style test scope. |
| X8 | CONFIRMED | `DesignerInspector.vue:108` | `rp-designer-inspector-panel` same. | Rule in `designer.css`. |
| X9 | CONFIRMED | `AssetRow.vue:103` | `Number(unitCostAmount)` into `Intl.NumberFormat` — the one float on a monetary amount; display-only, 2 dp. No decimal-safe formatter exists. | Record the bound in a comment; not scheduled. |
| X10 | CONFIRMED | CLAUDE.md:1074 | Bundle size stale on the day it names. | Point at `npm run build`. |
| — | holding | — | Settings rows 7/4; leaf doors 2; view types 5 vs Vue roots 4; `.test-d.ts` 8/8; repository stacks 2; `runDetached` at every door; `Money.ts` the only Decimal-for-money module; no vault write outside `infrastructure/`; no live `I18N_LITERAL_BAN` blind-spot violation; engines vs CI; release guard `verify`; no ESLint override trap; `.oxlintrc.json` scope; hook wiring; README scripts; versions; no colour literal. | — |

## What the review did not do

No manual case was run in a vault. P2 (whether Obsidian reads `result.history` synchronously) and the mobile read-only surface (P8/V2) need one. `npm run harness-shot` was not run; nothing here has a layout symptom except E10 and the price row's focus, which a screenshot cannot show either.
