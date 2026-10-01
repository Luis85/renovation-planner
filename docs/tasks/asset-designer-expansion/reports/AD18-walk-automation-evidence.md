# AD18 walk-automation evidence (AD18-R26 to AD18-R29, and round 2: AD18-R30 to AD18-R34)

**What this is.** A compact, per-task, per-clause table of the mutation evidence Tasks 1–8 of this
round produced, compiled from `.superpowers/sdd/task-{1..8}-report.md` (including each task's own
fix rounds, appended in the same file). Those reports live under `.superpowers/`, which is
gitignored (root `.gitignore:70`), so this file is the one committed copy of what they measured.
It reproduces only what a report actually recorded — no mutation is invented or reconstructed for
a row that has none.

**A second round is appended below the first.** `MANUAL-PASS-audit-2.md`'s follow-up audit
(AD18-R30 to AD18-R34) reused the same report paths, `.superpowers/sdd/task-{1..6,7a,7b}-report.md`
— round 1's own Tasks 1–8 had already been folded into the section above before round 2's tasks
wrote to those same gitignored filenames. The appended sections carry the same accounting for the
six tasks `AD18-walk-automation-2-plan.md` built (Tasks 1–6); Task 7 (7a, 7b) retagged case rows and
cited these tests by name, adding no mutation of its own, matching the convention below for round
1's Tasks 9–11.

**How to read a row.** *Mutation* is `file · change` (condensed from the report's own wording).
*Outcome* is the new test's own result under that mutation, plus what the neighbour set did (a
neighbour going red on the SAME clause is called out; a neighbour going red on a DIFFERENT,
narrower fact is noted as "not a discharge" per the mutation-gate rule that a neighbour can fail at
a prerequisite without ever asserting the clause). Every mutation was made under
`.superpowers/sdd/mutation.lock`, run once, and restored with `git checkout -- <file>` before the
next — `git status --short src styles` came back clean before and after every one, per each task's
own report.

**Scope.** Task 1 sharded the E2E workflow's desktop legs and touched no product clause, so it has
no mutation table. Tasks 9–11 (the tier definition, the case rewrites, the count) are retag and
prose work over the clauses Tasks 2–8 closed; their own citations point here, and are not a second source of mutations.

---

## Task 2 — Recover, the host clauses (bucket B)

Commit `ded3a93bd`, fix round `df76ba5e6`. Files: `tests/e2e/assetDesignerRecoveryWalk.e2e.ts`,
`tests/e2e/assetDesignerRecoveryWalkRestore.e2e.ts`, `tests/e2e/recovery.ts` (helpers).

| Step | Clause | Test (file · name) | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| 6 | early notice clears with no press before a drag | `assetDesignerRecoveryWalk.e2e.ts` · *draws the same canvas and selection…, and retires the early notice with no press* | `VaultChangeAdapter.ts` · debounce `?? 500` → `?? 5000` | **RED** — notice still existing after 2000 ms. Neighbours (`assetDesignerRecovery.e2e.ts`) GREEN. |
| 8 | notice arrives with no press, within ~1 s | same test · *raises the notice unprompted…* | same mutation, same run | **RED** — notice still not existing after 2000 ms. Neighbour (stale-notice case) GREEN — it falls back to a manual reconcile. |
| 21 | second gesture persists and is drawn on reopen | `assetDesignerRecoveryWalkRestore.e2e.ts` · *keeps both gestures across a tab closed by hand…* | `selection/editShape.ts` · `createEditShape` returns `ok('no-write')` for the 2nd gesture | **RED** — revision 2 expected 3. Neighbour case cannot reach this (drives one gesture per leaf). |
| 21 | Redo dimmed on reopen | same case | `DesignerToolbar.vue` · Redo `:disabled` forced `false` | **RED** — expected non-null disabled. |
| 21 | nothing warned before the tab closed | same case | `AssetDesignerView.ts` · `new Modal(this.app).open()` in `onClose` | **RED** — a modal-container appeared where none was expected. |
| 23 | no flash of a failure panel | same case · `reloadWatchingForFailure` (CDP-sampled renderer reload) | `assetDesignStore.ts` · deleted the `isMissingAsset` guard before an index scan completes | **RED** twice (before/after a helper restructure) — panel frames appeared where the case expects zero. |
| 25 | no error logged by unload | `assetDesignerRecoveryWalkRestore.e2e.ts` · *logs no error to the console while the plugin unloads…* | `RenovationPlannerPlugin.ts` · `onunload` disposer loop throws after `dispose()` | **RED** — 5 SEVERE console entries instead of the 1 known-injected one. |
| 26 | same shape after a note move | `assetDesignerRecoveryWalk.e2e.ts` · *keeps the picture through a move…* | `AssetGeometryStore.ts` · `pathFor` resolves beside the note once it leaves the library folder | **RED** — Inspector/canvas diverged from the pre-move picture. |
| 26 | same Inspector after a note move | same assertion | `assetDesignStore.ts` · success arm clears selection instead of pruning | **RED** — selection/Inspector diverged. |
| 29 | no new tab opens, of any view type | same case | `AssetDesignerView.ts` · `closeLeaf` → `setViewState({ type: 'empty' })` | **RED** — 11 leaves instead of 10. |
| 29 | no other designer leaf is affected | same case | `AssetDesignerView.ts` · `closeLeaf` → `detachLeavesOfType(ASSET_DESIGNER_VIEW)` | **RED** — the second designer's state vanished. |
| 30 | nothing told you (no notice) | same case | `VaultChangeAdapter.ts` · `onDelete` raises a `Notice` for a `.md` | **RED** — a notice appeared. |
| 30 | nothing offered to remove it (no modal) | same case | `VaultChangeAdapter.ts` · `onDelete` opens a `Modal` | **RED** (twice — first run hit a prerequisite, assertion moved earlier, re-run red on the clause). |
| 30 | record its size | same case (evidence `orphan.json`, 1501 bytes) | `VaultChangeAdapter.ts` · `onDelete` appends a space to the sidecar | **RED** — 1502 vs 1501. |
| 37 | Try again disappears with the notice | same case · *raises the notice unprompted, and a press after the repair retires all three widgets at once* | `AssetDesignerRoot.vue` · button moved to its own `v-if` | **RED** — stale-triple record disagreed. |
| 37 | header's refresh-needed reverts together | same assertion | `AssetDesignerRoot.vue` · header `:stale` binding changed | **RED** — same stale-triple mismatch. |
| 37 | all three clear at the same moment | same assertion | (the two mutations above) | **RED** (same evidence). |
| 37 | canvas shows the repaired file | same case (bowl shift) | `assetDesignStore.ts` · `design.value = found.value` gated on `!stale.value` | **RED** — bowl centre-x stayed 0, not 50. |

**Fix round (`df76ba5e6`) re-measurement — steps 6/8 split into a plugin half and a host half:**

| Clause (revised) | Test | Mutation | Outcome |
| --- | --- | --- | --- |
| Step 8, notice arrives within ~1 s of the HOST reporting the write (plugin half) | `assetDesignerRecoveryWalk.e2e.ts` · `PLUGIN_MS` assertion | `VaultChangeAdapter.ts` · debounce `?? 500` → `?? 5000` | **RED** — `pluginMs` 3771 > 2000. |
| Step 6, early notice clears within the bound of the host reporting the repair (plugin half) | same file | same mutation | **RED** — `pluginMs` 5052 > 2000. |
| Steps 6/8, the HOST raises the change unprompted at all | — | — | **LEFT OPEN, host-dependent.** No src mutation can reach a host fact. Recorded as data only: this run 13–18 ms; earlier probe 1–5 ms (4/4); W23-A saw none in 15 s under load once. Linux unmeasured. |

**Left open (Task 2, unchanged by the fix round):** step 2's "same canvas" and "same selection" —
the assertion passes but no single-edit `src/` mutation can make it false (the host raises `raw`
with no `modify` for the probed attribute change, the plugin subscribes to no `raw`, and even a
`modify` would be absorbed by `EchoWindow`'s mtime:size check). The picture assertion stands as a
pin on host behaviour; the clause is not claimed as discharged.

---

## Task 3 — Design an Asset, the host clauses (bucket B)

Commit `93b729ee7`, fix round `df76ba5e6`. Files: `assetDesignerWalkHost.e2e.ts`,
`assetDesignerWalkReload.e2e.ts`, `assetDesignerWalkKeys.e2e.ts`, plus `designerCanvas.ts` /
`designerParity.ts` helpers.

| Step | Clause | Test (file · name) | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| 7 | sheet drawn right way up | `assetDesignerWalkHost.e2e.ts` · *draws the chosen sheet the right way up…* | `BackgroundLayer.vue` · VImage `scaleY: -1` flip | **RED** — mirror check `[false,false,false]` instead of `[true,true,true]`. Neighbours (`assetDesigner.e2e.ts` 7/7, 4 vitest files, 80/80) GREEN. |
| 8 | `.rpgeo` listed in Obsidian's file explorer | same case (2nd half) | `RenovationPlannerPlugin.ts` · commented out `registerExtensions(['rpgeo'], …)` | **RED** — explorer row never appeared. Neighbour `tests/plugin/registration.test.ts` also reddened, but on a narrower claim (the registration call, not the host's listing) — not treated as a discharge. |
| 24 | calibration survives disable/enable | `assetDesignerWalkReload.e2e.ts` · *keeps the calibration, anchor, facing and height…* | `RenovationPlannerPlugin.ts` · `onload` rewrites every `.rpgeo`'s `calibration: null` | **RED** — Scale row flipped to "Not calibrated". Neighbour `assetDesigner.e2e.ts` GREEN. |
| 24 | anchor survives | same | same site · `onload` resets `shape.anchor` | **RED** — anchor preset changed. |
| 24 | facing survives | same | same site · `onload` resets `shape.facing` | **RED** — facing changed. |
| 24 | height survives | same | same site · `onload` deletes `height` from frontmatter | **RED**, then GREEN twice on reruns (see Task 3 concerns — an uncaptured, unreproduced flake on the neighbour, not on this test). |
| 24 | both open designers reopen | same | `InMemoryProjectIndex.ts` · `rebuild` keeps only the first asset entry | **RED** — the second designer's reopen never found "Reloaded B". |
| 87 | thumbnail outline contrast, both themes | `assetDesignerWalkHost.e2e.ts` · *draws the Inspector thumbnail's outline at 3:1 or more…* | `styles/designer-object.css` · thumbnail stroke colour weakened | **RED** in both themes (1.18:1, 1.17:1 vs the 3:1 floor). Neighbours (2 e2e steps, 3 vitest files, 110/110) GREEN. |
| 96 | cleared-selection Ctrl+G reaches the host | `assetDesignerWalkKeys.e2e.ts` · *leaves a Ctrl+G with nothing selected to the host…* | synthetic: `RenovationPlannerPlugin.ts` a `Mod+G` no-op hotkey bound only while canvas has focus and nothing is pressed | **RED** — host ran the mutation's command, not `graph:open`. Neighbours (`assetDesignerParityMenu.e2e.ts` 3/3) GREEN. |
| 118 | no host binding on Ctrl+Z from the Line dropdown | `assetDesignerWalkKeys.e2e.ts` · *runs no host command for a Ctrl+Z on the Line dropdown or Corner radius slider* | synthetic: `Mod+Z` bound only while a `<select>` holds focus | **RED** at the select call. Neighbours (`assetDesignerFollowupsHistory.e2e.ts` 8/8) GREEN. |
| 118 | same, Corner radius slider | same | synthetic: same binding, range input | **RED** at the slider call; the select call passed. |
| 121 | no host binding fires on an exhausted Ctrl+Z | `assetDesignerWalkKeys.e2e.ts` · *runs no host command… once nothing is left to undo* | synthetic: `Mod+Z` bound only while Undo is `disabled` | **RED**. Neighbours (`assetDesignerFollowupsHistory.e2e.ts` 8/8, `assetDesigner.e2e.ts` 7/7) GREEN. |

**Fix round 1 (`df76ba5e6`) — re-verified with additional mutations:**

| Clause | Mutation | Outcome |
| --- | --- | --- |
| 7, a y-up camera (not a node-level flip) | `BackgroundLayer.vue` VLayer config flipped about the sheet | **RED** — left/above screen-space check disagreed; the raw pixel check stayed green, confirming the rewritten instrument (`drawnSheet`, screen-space samples) is the one that needed to move. |
| 7, a CSS mirror | `styles/designer-object.css` · canvas `transform: scaleY(-1)` | **RED** — `cssMirrors` found a match. |
| 7, node flip (re-run on the rewritten code) | `BackgroundLayer.vue` VImage flip | **RED** — pixel check failed as before. |
| 96, natural mutation | `designerKeys.ts` · `canGroup` widened to also match zero selection | **RED** at the unbound-half assertion. Also reddened 2 vitest cases on the same unit-level claim, and 1 unrelated `assetDesignerParityMenu.e2e.ts` case on a different clause (step 92's menu-on-non-graphic check). |
| 118, natural mutation (optional) | `RenovationPlannerPlugin.ts` · an unconditional `Mod+Z` command | **RED** at `expectHostIdle`; step 121's neighbour also reddened at a prerequisite (the host claims every Ctrl+Z), explaining why 121's own mutations had to be situational. |
| 24, calibration VALUE (added in the fix round) | `RenovationPlannerPlugin.ts` · `onload` doubles `pixelsPerWorldUnit` | **RED** — drawn sheet size and sidecar value both changed while the Scale row's text stayed "Calibrated" (a gap the text-only Scale row check cannot see). |

**Rejected mutation, recorded (step 96):** a view `Scope` returning `false` for empty-selection
Ctrl+G also suppressed `graph:open` for single- and two-part selections (a `Scope` returning
`undefined` still blocks the parent scope) — too broad, replaced by the dynamic-binding mutation
above.

**Left open (Task 3):** none of the in-scope B rows. Steps 73, 89, 97 (Task 4), and step 121's
"Ctrl+Z still claimed" (Task 5, bucket D) were out of this task's scope. Step 7's "scale bar
readable" stays bucket C (judgement).

---

## Task 4 — input the driver lacks, and the layout-only clauses

Commit `8a3ea3579`, fix round folded into `046997229`. Files: `assetDesignerInput.e2e.ts`,
`assetLibraryWalk.e2e.ts`, `twoDesignersDrag.e2e.ts`, `library.ts` (`resizeTo`).

| Case / step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 97 | real ContextMenu key (browser-trusted) reaches the canvas | `assetDesignerInput.e2e.ts` · *opens the right-click menu from the real ContextMenu key…* | `designerMenu.ts` · `event.key === 'ContextMenu'` narrowed to `&& !event.isTrusted` | **RED** — an extra bubble event escaped. Neighbour `designerContextMenu.test.ts` GREEN (28/28) — it dispatches a synthetic, untrusted key, so it cannot see this. |
| Design 73 | name checkable by Obsidian's own hover tooltip | `assetDesignerInput.e2e.ts` · *shows the library door's name in Obsidian's own hover tooltip…* | `styles/designer-header.css` · `--no-tooltip: true` added | **RED** — no tooltip text appeared. Neighbour reads `aria-label` instead, so it stayed GREEN. |
| Design 70 | every All-dimensions number has a clickable point | `assetDesignerInput.e2e.ts` · *leaves every number… a point a click lands on* | `styles/designer-dimensions.css` · label min-height 24px → 64px (taller than the model) | **RED** — 2+ labels became unreachable. Suite + `tests/gates/styles.test.ts` (216/216) GREEN — they test the label MODEL, not the rendered host box. |
| Calibrate 32 | real Tab reaches "Mark clearance as reviewed" from the control before it | `assetDesignerInput.e2e.ts` · *reaches Mark clearance as reviewed with one Tab…* | `DesignerClearanceToggle.vue` · `@keydown.tab.prevent` on the switch | **RED**. Task 7's vitest pair GREEN (7/7). A `tabindex="2"` variant stayed GREEN — a finding, not a gap: nothing tabbable follows the switch, so Tab still wraps to the button. |
| Browse 11 | rail rung boundaries (35rem / 45rem) render | `assetLibraryWalk.e2e.ts` · *gives the selection the whole pane under 35rem, a 240px rail from 35rem and 280px from 45rem* | `styles/asset-library-inspector.css` · `< 35rem` breakpoint moved to `30rem` | **RED** — rail measured 240px in a container the text still pins at 35rem. `tests/gates/styles.test.ts` + suite (79/79, 327/327) GREEN — text-pin only. |
| Browse 11 | rail widens 240px → 280px at 45rem | same | `styles/asset-library-inspector.css` · `flex-basis: 240px` → `260px` | **RED**. Suite GREEN. |
| Browse 26 | sidebar opens BESIDE the grid, narrowing it → **CONTRARY** | `assetLibraryWalk.e2e.ts` · *lays the funnel's sidebar beside the grid…, narrowing the grid rather than covering it* | `styles/asset-library-grid.css` · `.rp-al-categories { position: absolute; z-index: 1 }` (makes the case row's ORIGINAL "overlay" claim true) | **RED** on the disjoint-boxes check under the mutation — confirming today's build does NOT overlay; the existing `assetLibraryNarrow.e2e.ts` stayed GREEN under this same mutation, which is itself the audit's point: that case cannot distinguish overlay from push. |
| Two designers 1 | tab drag moves the one leaf, never duplicates it → host fact, **CONTRARY to the audit's original "yields two leaves" clause** | `twoDesignersDrag.e2e.ts` · *moves the one designer into a new split when its tab is dragged there, and never duplicates it* | **No `src`/`styles` lever exists** — Obsidian's own `onDragLeaf` handler is what decides this. | Measured instead of mutated: tab groups go 1→2, `leafStates` stays a single-element array, the moved leaf still draws its name. Assertions depend on the drop having happened, so they cannot pass vacuously. |

**Left open / not asserted:** none of Task 4's own rows. Browse 26 and Two designers 1 are CONTRARY
findings, both later folded into the case rewrites (AD18-R27).

---

## Task 5 — Design an Asset, the suite gaps (bucket D)

Commit `32a742b3c`. Eight new files, 15 cases, no `src`/`styles` change in the final state.

| Step | Clause | Test (file · name) | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| 27 | tank sits against the wall (wall-snapped composition) | `placementAtToilet.test.ts` · *sits its tank against $name and points its bowl into the room* (×4 walls) | **M5c** `assetPlacementDraft.ts` · `reach` computed with `backDepth` taken in the wrong frame | **RED** ×4. 47 neighbour files GREEN — M5/M5b (turn, raw back-depth) also reddened, but on the INGREDIENT, never the wall-snapped composition, so M5c is the clause's own mutation. |
| 32b | no selection change during the hold | `designerHeldPressSelection.test.ts` · *changes neither the selection nor the drawing until that write lands, then carries on from it* | **M7** `designer-select-tool.ts` · `select(null)` added before `hold(event)` | **RED**. Already covered at tool level by `designerSelectHold.test.ts` (8 cases) — this test adds the MOUNTED leaf, not a first discharge. |
| 58 | canvas matches the thumbnail | `presetThumbnailCanvas.test.ts` · *draws… the footprint and the three parts its gallery card draws* | **M8** `presetPreview.ts` · built at each field's `min` instead of `defaultValues` | **RED** — extent mismatch. 6 neighbours GREEN. **M8b** (`details.slice(0,-1)`) also RED — length mismatch. |
| 72 | icon before the words, DOM order | `designerHeaderIconOrder.test.ts` · *draws the arrow-left icon before the words, in DOM order* | **M1** `DesignerHeader.vue` · icon moved after the label span | **RED** (children-order deep-equal). 38 neighbour cases GREEN. |
| 81 | scale bar stepped to match the rulers | `designerScaleBarRulers.test.ts` · *spans a whole number of ruler steps…* (81-camera sweep) | **M2b** `DesignerScaleBar.vue` · step floor at 10px instead of the rulers' 12 | **RED** at one zoom in the sweep. 60 neighbours GREEN. M2 (own step series) also RED, but the reddened neighbour (`designerScaleBar.test.ts`) never reads the rulers, so it is not a discharge. |
| 102a | corners round through the whole drag (clamped arm + drawn line) | `designerRoundedRectMidDrag.test.ts` · *draws round corners at every stop…* (4 stops) | **M9** `designer-select-tool.ts` · `movePointer` previews with `shift: true` | **RED**. The KEPT arm was already covered by `selectionDragRoundedRect.test.ts` + 2 snapping cases (also RED under M9); this test adds the clamped arm and the drawn Konva line. |
| 107 | typed solve, not a plain stretch | `selectionDragToiletBowl.test.ts` · *lands the size the pointer asks for…, and not a plain stretch* (×4) | **M6** `selectionDrag.ts` · `keptCurves` forced to always `return null` | **RED** ×4. **Already covered** — about 28 neighbour cases across 5 files reddened on the SAME property; this test adds the step's own input, not a first discharge. |
| 120 | Escape mid-gesture, then Ctrl+Z undoes normally | `designerHistoryKeysWalk.test.ts` · *declines Ctrl+Z while a rectangle is held, then undoes normally once Escape has cancelled it* | **M4** `tool-manager.ts` · `cancelGesture` drops the in-flight flag reset | **RED**. 2 neighbour files RED on the ingredient (the flag itself), never on the chord driven through the designer root. |
| 121 | Ctrl+Z claimed with nothing to undo | same file · *is still claimed and goes no further, though nothing changes* | **M3** `historyShortcut.ts` · returns `false` before `preventDefault` when nothing to undo/redo | **RED** — `defaultPrevented` false. 10 neighbour files (127 cases) GREEN, matching the review's own 87-green measurement. |

**Headline finding, recorded rather than hidden:** three D rows (32b, 102a's kept arm, 107) were
already discharged by pre-existing vitest cases before this task ran — the mutation gate showed a
neighbour reddening ON the clause itself, not on a prerequisite. This task's own tests still close
the mounted/host-input gap beside them; they are not claimed as the first discharge for those three.

**Left open:** none assigned to this task. Step 120's pin is narrower than the step's full wording
(the chord is checked before the release, not after — `ToolManager.pointerUp` clears the flag on
release regardless, so the case's own docblock says so rather than overclaiming).

---

## Task 6 — Recover and Two designers, the suite gaps (bucket D)

Files: `designerRecoveryScreenState.test.ts` (new), and (after fix round 1)
`assetGeometryOrphanDiagnostics.test.ts` replacing a first-pass `.test-d.ts`.

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Recover 3 | no notice paragraph after a refused write | `designerRecoveryScreenState.test.ts` · "draws no notice, no failure panel, and dims no mode tool" | `AssetDesignerRoot.vue` · `staleAfterRefresh` dropped its `stale.value` half | **RED** — notice appeared where none should. Neighbour `assetDesignerRoot.test.ts` (26 cases) GREEN — its own stale-strip case never asserts the notice's ABSENCE in the steady state. |
| Recover 3 | no failure panel | same test | `AssetDesignerRoot.vue` · `failure` computed given an extra save-error branch | **RED** — panel appeared. Neighbour GREEN (26/26). |
| Recover 3 | every tool still live | same test | `DesignerToolbar.vue` · mode buttons bound to `disabled` on save-error | **RED**. Neighbours (`assetDesignerRoot.test.ts` + `designerToolbar.test.ts`, 78 cases) GREEN. |
| Two designers 8 | no dialog appears | same file · "opens no dialog (Two designers on one asset, step 8)" | `AssetDesignerRoot.vue` · added a `watch` opening a confirm dialog on save-error | **RED** — a `.rp-dialog` appeared. Neighbours (43 cases across 3 files) GREEN; searched first for a pre-existing `.rp-dialog`-absence check on a write refusal and found none. |
| Recover 5 | the bowl springs back (preview cleared regardless of outcome) | same file · "clears the preview and leaves the design store's own shape untouched" | `designer-select-tool.ts` · `commit()`'s preview-clear narrowed to only the success arm | **RED** — `store.preview` held the failed drag's shape. Neighbours (`designerSelection.test.ts`, `designerWriteChain.test.ts`, `assetDesignerRoot.test.ts`, 43 cases) GREEN — none reads `.preview` after a refusal. |
| Recover 7 | same bowl position + Inspector still shows fields | same file · "keeps the footprint, the selection and the Inspector's own fields" | `assetDesignStore.ts` · keep-previous branch given an added `design.value = null` | **RED** — footprint undefined. This is the SAME mutation the audit already recorded for `designerRefresh.test.ts`'s two height-reading cases (also reddened, on their own scalar field, never on footprint/selection/Inspector DOM — isolated independently to confirm this test's assertions are not piggy-backing on that overlap). |
| Recover 7 | same selection | same file, isolated | `assetDesignStore.ts` · keep-previous branch given `selected.value = []` (design left untouched) | **RED** — selection cleared while the footprint assertion above it passed, proving "same selection" is not implied by "design kept". Neighbours (65 cases) GREEN. |
| Recover 30 | no diagnostic names the orphaned sidecar | *(fix round 1)* `assetGeometryOrphanDiagnostics.test.ts` — real `GetDiagnosticsSnapshotQuery` over a real repository stack, note deleted, sidecar left, index rebuilt | `GetDiagnosticsSnapshot.ts` · `execute()`'s `validationIssues` array given one hardcoded appended entry | **RED** — `expected [ {...} ] to deeply equal []`. Two pre-existing `getDiagnosticsSnapshot.test.ts` cases also reddened under the SAME mutation, but on a narrower clause (mapping a ledger's existing content verbatim, not a real orphan scenario) — read at the assertion, not the redness alone, and not treated as a duplicate. |

**Rejected instrument, corrected in fix round 1:** Recover 30 was first pinned with a
`.test-d.ts` compile-time `@ts-expect-error` on `ledger.record('asset-geometry', …)`. The
coordinator found it proved only that ONE spelling of the gap fails to compile, while
`ledger.record('asset', …)` — the kind assets already use — type-checks fine and says nothing
about the diagnostics report's actual output, which is what step 30's pass condition is about. It
was deleted and replaced by the runtime test tabled above.

**Left open:** none of Task 6's eight assigned clauses (Recover 3 ×3, Recover 5 ×1, Recover 7 ×3,
Two designers 8's "no dialog"). Two designers 8's other D-adjacent row ("nothing anywhere is
paused") was already discharged by the pre-existing `designerRefresh.test.ts`'s `writesBlocked`
case, per the audit, and was not one of this task's rows.

---

## Task 7 — Calibrate, the suite gaps (bucket D)

Commit `f1046922a`. Files: `designerCalibrationPendingLines.test.ts`,
`designerClearanceReviewName.test.ts`, `designerHiddenClearanceWalk.test.ts`.

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| 9 | anchor's pending line is gone | `designerCalibrationPendingLines.test.ts` · *drops every pending line, the anchor's and the graphics', with the outline's, and the hint* | **M1** `CalibrateAsset.ts` · `anchorPending: false` → left at `shape.anchorPending` | **RED** — the anchor's pending line remained. 52 neighbour files GREEN — nothing else re-reads `anchorPending` at all. |
| 9 | graphic/detail's pending line is gone | same test | **M2** `CalibrateAsset.ts` · detail `pending: false` → left at `detail.pending`; **M2b** `DesignerReferenceStatus.vue` reads details non-reactively | **RED** both. `calibrateAssetDetails.test.ts` also reddened on M2, but on the domain FLAG only (already credited by the audit) — the panel-chain gap is what this test closes. |
| 21f | a press on a hidden handle starts a marquee | `designerHiddenClearanceWalk.test.ts` · *answers a press where its handle was with a marquee* | **M3** `designer-select-tool.ts` · `press` swallows a hit on a hidden clearance handle | **RED** — no marquee band. 28 neighbour files GREEN, including the existing "takes no drag…" case, which asserts a different fact (nothing written, not that a marquee starts). |
| 21f | marks reappear exactly as they were | same file · *draws its marks again exactly where and as they were, in %s mode* (transform/points/bend) | **M4** `DesignerCanvas.vue` · a `watch` resets mode on a hide/show cycle | **RED** in points and bend (10 marks vs 5); transform stayed green (that mode cannot see this mutation). 11 neighbour files GREEN. |
| 21l | clearance unaffected by a footprint nudge | same file · *keeps its geometry on disk and on the canvas, and stays hidden* | **M5** `shapeEdits.ts` · `moveOutline` also translates the clearance | **RED**. 35 neighbour files GREEN. |
| 32 | button reachable by Tab | `designerClearanceReviewName.test.ts` · *is a tab stop… and its computed name is exactly Mark clearance as reviewed* | **M7** `DesignerClearanceReview.vue` · `tabindex="-1"` | **RED**. 5 neighbour files GREEN. |
| 32 | accessible name exact | same test | **M6** `DesignerClearanceReview.vue` · `aria-label="Dismiss"` | **RED** — axe-computed name mismatched. 5 neighbour files GREEN. |

**CONTRARY check (step 9, not CONTRARY):** the review asked whether `CalibrateAsset.ts`'s
`rescaled` might be leaving a flag uncleared. The new test drives a real calibration on an asset
with all four pending groups; all four lines and the hint disappear. The mutations above show what
was previously untested, not a defect — build behaviour confirmed correct.

**Left open:** step 32's screen-reader announcement clause stays bucket C (no instrument). Step
32's Tab clause is pinned narrowly — it proves the button is in the sequential focus order in
jsdom, not that focus arrives there from a given starting point in a real host (that half is what
`assetDesignerWalkKeys.e2e.ts` step 121 and Task 4's `assetDesignerInput.e2e.ts` cover instead).

---

## Task 8 — Take into a plan and Browse, the suite gaps (bucket D) and Browse 32 (RULING)

Six new files, no existing test edited.

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Take 9 | a row for the copy joins the shelves | `assetLibraryDuplicateRow.test.ts` · *adds the copy's row to the shelves once the catalogue change is announced* | `AssetLibraryStore.ts` · re-hydrate gated on `change.replaced.length > 0` instead of `change.catalogue` | **RED** — the new row never appeared. Neighbour `assetLibraryRootDoors.test.ts` also reddened, on the SAME shared re-hydrate call, confirming it only ever counted calls, never rows — the gap this test closes. |
| Take 14 | hand-off asset replaces whatever the Add menu last armed | `editorArrivalAssetOverride.test.ts` · *replaces an asset the Add menu already armed with the one the hand-off names* | `assetPlacementTask.ts` · `arm` keeps the already-armed id instead of the hand-off's | **RED** — draft kept the Add-menu asset. Neighbours (11 tests) GREEN — neither arms the Add menu first. |
| Take 15 | choosing a plan in the picker opens THAT plan, armed with the same asset | `assetDesignerUsePlanChoice.test.ts` · *reveals the plan chosen — not the other one — armed with the same asset* | `revealPlanEditor.ts` · candidate filter widened to match every Plan Editor leaf | **RED** — the wrong (first) leaf was revealed and armed. Disclosed collateral: 3 cases in that file's OWN lower-layer suite also reddened on the same mechanism, for scenarios with no picker involved — expected sharing, not redundancy. |
| Take 16 | nothing armed after a dismissed picker (two leaves open) | same file · *arms neither already-open Plan Editor when the picker is dismissed* | `renovationProjectOpenSeams.ts` · `planPicker`'s `onClose` given a simulated "defaults to the first candidate" | **RED** — the first leaf's state object was reassigned. Neighbours (36 tests) fully GREEN — the existing dismiss case never inspects leaf state. |
| Take 21 | asset's footprint drawn in the hand-off's designer leaf | `assetDesignerHandoffFootprint.test.ts` · *draws the asset's footprint on the canvas the hand-off's designer leaf opens* | `DesignerCanvas.vue` · footprint `<VLine v-if>` forced false | **RED** — no footprint node. Disclosed collateral: a different task's `layers.test.ts` also reddened (same `v-if`), but it mounts the root directly and never drives the real `AssetDesignerView` lifecycle — this test is the first to tie the hand-off's leaf lifecycle to a rendered shape. |
| Take 22 | "Open in designer" listed under the plans group | `canvasMenuAssetDesignerGroup.test.ts` · *lists "Open in designer" first…, under the plans group* | `useCanvasMenuActions.ts` · `designerActions` group changed `'plans'` → `'edit'` | **RED** on the `group` field (position alone would not have caught this mutation, since nothing else preceded it in the fixture's list — the field assertion is what discharges the clause). Neighbours (33 tests) GREEN. |
| Browse 32 (RULING, not a fix) | mark shares no edge with the tile's name/size | `assetTileMarkEdge.test.ts` (stylesheet-only, node environment) | 3 isolated mutations: (1) `.rp-al-mark` `align-self: center → stretch`; (2) `.rp-al-tile__category-icon` same; (3) `.rp-al-tile__name` gains `align-self: center` | (1) **RED**, and pre-existing `assetTileStyles.test.ts` ALSO reddened on the identical assertion — genuine duplication, cited rather than re-closed. (2) and (3) **RED**, with `assetTileStyles.test.ts` fully GREEN both times — new, non-duplicate coverage. This pins a STYLESHEET fact only; it does not measure a rendered pixel offset in any browser. |

**Left open / CONTRARY:** none — all six D clauses and the one RULING clause were closed or pinned
as above.

---

## What this leaves unquantified

This file tables what Tasks 2–8 mutated for the ~71 clauses they built or closed this round (36 B +
37 D, minus the two B clauses AD18-R26 declined to build: Design 89's Cmd+G needs a macOS leg this
project has no way to run, and Browse 31 cannot fail until Obsidian records leaf history for this
view). It says nothing new about the far larger set of pre-existing bucket-A clauses the retag
(Task 9–11) carried over from W23-A/W24-A's own tables — those were audited by reading, and
`MANUAL-PASS-audit.md` records that 29 of them were sampled by mutation, with 7 of the 29 not
holding (all seven since corrected, per the same audit). This file is not a re-audit of that set.

---

# Round 2: AD18-R30 to AD18-R34

Authority: `MANUAL-PASS-audit-2.md`'s second clause audit and `AD18-walk-automation-2-plan.md`.
Compiled from `.superpowers/sdd/task-{1..6}-report.md` as this round's own Tasks 1–6 left them
(including each task's own fix rounds, appended in the same report file). Task 7 (7a, 7b) retagged
case-file rows and cited these tests by name; it built no mutation of its own and has no table here.
Every row below tags its CLAUSE, not the step it sits beside: **GUARD** (a P clause — the test closes
a measurable part of it; the "reads as"/spoken/real-Mac judgement itself stays with a person, whatever
tier the step is left at) or **DISCHARGE** (the clause itself is fully settled, with nothing left over
for a person). A step can carry a DISCHARGE for one clause and still keep its human tier on another —
Design 89's ⌘-label clause and Browse 33's stroke-weight clause both discharge this way without moving
their step, per the same task reports' own language.

## Task 1 (round 2) — the two suite gaps: Design 89's macOS label and Browse 33's stroke parity (bucket D)

Commit `9a89cb4e2`. Files: `tests/presentation/designer/designerContextMenuMac.test.ts` (new),
`tests/presentation/library/assetTileStrokeParity.test.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 89 (DISCHARGE of the ⌘-label clause; the step keeps `obsidian` on its separate B clause, AD18-R31) | the menu shows the macOS modifier on macOS | `designerContextMenuMac.test.ts` · *labels Group, Ungroup and Duplicate with ⌘, leaving Delete as Del* | `designerMenu.ts` · the `items` computed's `mod = modifierLabel()` hard-coded to `mod = 'Ctrl'` | **RED** — expected `['⌘+G','⌘+Shift+G','⌘+D','Del']`, got the Ctrl-labelled array. Neighbours `designerContextMenu.test.ts` and `platformModifier.test.ts` stayed GREEN (34 passed). A wider first-pass mutation directly on `modifierLabel()` had also reddened `platformModifier.test.ts`'s own assertion of that function — a different clause sharing the mutated line, not a duplicate of this one — which is why the gate mutation above targets the call site instead. |
| Browse 33 (DISCHARGE of the stroke-weight clause; the step keeps `obsidian` on its separate P and C clauses) | same stroke weight as the mark, not thinner | `assetTileStrokeParity.test.ts` · *declares the same stroke weight as the mark, not a separately hand-pinned one* | `styles/asset-library-grid.css` · `.rp-al-mark`'s `stroke-width` `1.5px` → `2px` | **RED** — magnitude 2 against 1.5. Neighbour `assetTileStyles.test.ts`'s own *holds the icon's stroke at the mark's own 1.5px…* case stayed GREEN (it checks each side against the hand-typed literal `'1.5'`, never against each other) — the exact D gap the audit named. |

## Task 2 (round 2) — the accessibility tree: Design 88b (discharge) and Calibrate 32 (guard)

Commit `f25503971`, fix round `53aedcbae`. Files: `tests/e2e/axTree.ts` (new helper),
`tests/e2e/assetDesignerAxTree.e2e.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 88b (DISCHARGE, AD18-R30) | the screen reader announces nothing, from the label's own text up, after a commit and after the minute tick | `assetDesignerAxTree.e2e.ts` · *keeps the save-state label out of every live region, after a commit and after the minute tick* | `DesignerHeader.vue` · `<SaveStateIndicator … role="status" />` | **RED** — `liveChain` expected `[]`, got `["status:polite"]`. Neighbour `assetDesignerParity.e2e.ts`'s DOM-ancestor walk also went RED, on its own "not a live region" A clause — a different instrument, not a duplicate. A second mutation (wrapping the label in `<output>`, an implicit live region) reddened only the new AX case; the DOM-walk neighbour stayed GREEN, since it cannot see an implicit role. A third mutation made only the SECOND moment ("Saved N min ago") a live region; that reddened only the post-tick read, showing the second moment is load-bearing. |
| Design 88b (DISCHARGE, fix round 1, Minor 1) | announces nothing ANYWHERE in the document, not only the label's own ancestry | same test, widened · the same case's `heard()` check across every live region | `save-state-store.ts` · `settle` given an added `notify('Saved')` call | **RED** — `heard()` returned `['status:Information Saved (×2)']` where `[]` was expected. Neighbour `assetDesignerParity.e2e.ts` stayed GREEN. |
| Calibrate 32 (GUARD, AD18-R30) | a screen reader receives a polite status and the button's exact computed name | `assetDesignerAxTree.e2e.ts` · *hands a screen reader a polite status and a named button once a resize flags the clearance* | `DesignerClearanceReview.vue` · dropped `role="status"` from the notice `<p>` | **RED** — role `paragraph`, `live` undefined. Neighbour `assetReference.e2e.ts`'s `[role="status"]` locator also went RED (its own, already-A "is a live region" clause). A second mutation (`aria-live="off"` on the notice) reddened only the new AX case (`live` undefined against `polite`); the neighbour stayed GREEN (selector and text still matched). A third mutation (`aria-label="Dismiss"` on the button) reddened the AX case's name assertion; `assetReference.e2e.ts` stayed GREEN (visible-text selector) while `designerClearanceReviewName.test.ts` (jsdom, its own pre-existing A clause) also caught it independently. |

## Task 3 (round 2) — Design 92, "nothing opens" (bucket B, reworded by AD18-R32)

Commit `2b9332b9e`, fix round `f88169e1a` (in the same file). File: `tests/e2e/assetDesignerNoMenu.e2e.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 92 (DISCHARGE, AD18-R32) | right-clicking the footprint outline, the anchor dot or the facing arrow opens nothing: no designer menu, no Obsidian menu, native or DOM | `assetDesignerNoMenu.e2e.ts` · *opens nothing, designer or Obsidian, native or DOM, on the footprint outline, the anchor dot and the facing arrow* | `designerMenu.ts` · `show()` opens an Obsidian `Menu` where a non-null part has no ability | **RED**, 6 of 6 soft assertions, at both `nativeMenus` preference values and all three points — `domMenus`/`hostMenuCalls` populated where the case expects none. Neighbour `assetDesignerParityMenu.e2e.ts -t "withholds it over every non-graphic"` stayed GREEN (it asserts only the designer's own, already-A menu clause). A second mutation (`contenteditable="true"` on the canvas, forcing the HOST's own native edit menu on the main-process branch the first mutation cannot reach) also reddened all 6, on the `contextMenuEvents` assertion, at both preference values. |

## Task 4 (round 2) — legibility guards: contrast and size (bucket P)

Commit `ef8fb0c04`, fix round `32483cd11`. Files: `tests/e2e/legibility.ts` (shared helper, new),
`tests/e2e/assetDesignerLegibility.e2e.ts` (new), `tests/e2e/assetLibraryLegibility.e2e.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 7 (GUARD) | the 1000mm scale bar is readable | `assetDesignerLegibility.e2e.ts` · *draws the reference sheet's scale bar at 3:1 or more against its paper, at the layer's own opacity* | `runtime.ts` · `backgroundOpacity = ref(1)` → `ref(0.02)` | **RED** — measured ratio 1.046 against the 3:1 floor. Neighbour `designerReferenceView.test.ts` also went RED, on the layer's opacity PROPERTY at the start of its fade walk (a prerequisite, not a drawn-contrast assertion). A discriminating fix-round mutation on `BackgroundLayer.vue`'s `VImage` opacity prop reddened only the new case; the neighbour stayed GREEN (its own layer node's opacity stayed 1). |
| Design 57 (GUARD) | legible at thumbnail size | `assetDesignerLegibility.e2e.ts` · *draws every preset card's lines at 3:1 or more in both themes, at a width the thumbnail's scale does not shrink* | `styles/designer.css` · removed `vector-effect: non-scaling-stroke` from the preset preview's `__footprint`/`__detail` rule | **RED** — 42 of 43 lines thinned by the thumbnail's own scale. No neighbour asserts this rule; the width half has no lower bound (a 0.2px non-scaling stroke would still pass), which the docblock now names. |
| Design 70 (GUARD) | every number is readable | `assetDesignerLegibility.e2e.ts` · *draws every All dimensions number at 4.5:1 or more in both themes, no smaller than the host's smallest UI text* | `styles/designer-dimensions.css` · `.rp-designer-dimension__value` font-size `var(--font-ui-smaller)` → `calc(var(--font-ui-smaller) - 1px)` | **RED** — 26 labels under the floor. A second mutation (`color: var(--text-normal)` → `var(--text-faint)`) reddened the contrast half in both themes. No existing test pins the label's font size or colour against a floor. |
| Browse 33 (GUARD) | noticeably fainter than a real design's mark | `assetLibraryLegibility.e2e.ts` · *draws a design-less tile's category icon at lower contrast than a designed tile's mark, in both themes* | `styles/asset-library-grid.css` · `.rp-al-tile__category-icon` colour `var(--text-faint)` → `var(--text-muted)` | **RED** — light 6.6869 not less than 6.6869; dark 8.128 not less than 8.128. A discriminating mutation (`opacity: 0.3` added to `.rp-al-mark`) reddened only this guard; the existing *design-less* case (which asserts only that the faint and muted TOKENS differ, not their relative magnitude) stayed GREEN. |

## Task 5 (round 2) — geometry guards (bucket P), and AD18-R34's defect

Commit `1871ad804`, fix rounds `97893193a` and `eca317ae6`. Files:
`tests/e2e/assetDesignerGeometry.e2e.ts` (new), `tests/e2e/assetLibraryWidthSweep.e2e.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 109 (GUARD) | the overall label sits on its own dimension line and off the drawing | `assetDesignerGeometry.e2e.ts` · *draws the overall width on its own line and off the drawing, at the fitted camera and under the ruler* | `dimensionFigures.ts` · `overallSlot`'s slide-along-line step skipped (`false && along(box) \|\| out(box)`) | **RED** — under the ruler, the label landed on the footprint (235.71 against a 206.48 floor). Neighbours `designerDimensionsResting.test.ts` and `restingLabels.test.ts` (pure jsdom placement arithmetic) also went RED, on the model-level rule; the e2e adds the rendered frame (real stage, CSS box, drawn path). A fix-round CSS-only mutation (`translate: 0 50%` added to `.rp-designer-dimension`) reddened ONLY the e2e case, with the full node suite (127 files, 1669 tests) green — proof of an e2e-only gap. |
| Design 56 (GUARD) | room is left for the drawing at a sidebar-width leaf | `assetDesignerGeometry.e2e.ts` · *leaves at least nine tenths of each canvas axis to the drawing beside the rulers, at a 580 px leaf* | `styles/designer-rulers.css` · `--rp-designer-ruler-size` `18px` → `30px` | **RED** — 0.8966 below the 0.9 floor. Neighbours `designerPolish.test.ts` and `restingLabels.test.ts` also went RED, but as parity pins between two copies of the same constant, not as assertions of "room". |
| Recover 34 (GUARD) | the retry button reads as an action, not a bar of chrome | `assetDesignerGeometry.e2e.ts` · *keeps the stale notice’s Try again narrower than half its notice and its leaf, set against the notice* | `styles/designer-recovery.css` · `align-self: flex-start` removed | **RED** — button 671px against a 339.5px floor (half the leaf). Neighbour `designerRecoveryStyles.test.ts` also went RED, but on the DECLARATION only, not the rendered box — the existing pin the audit already recorded. |
| Browse 11 (GUARD) | no intermediate width at which the panel is unusable | `assetLibraryWidthSweep.e2e.ts` · *clips, overflows and overlaps no control at every 20px from 460px to a full pane and every 4px above each rung, with an asset selected* | `styles/asset-library-inspector.css` · `min-width: 480px` added to `.rp-al-inspector` | **RED** — 90 faults from 460px on. Neighbour `assetLibraryWalk.e2e.ts` also went RED, but on its own rung-WIDTH clause (a different, already-A fact). **AD18-R34 (2026-09-28):** the guard, unmutated, went RED on real Linux CI (E2E run 36345605529, 1.13.7 and latest, desktop shard 1/2) at a 568px container Windows never reaches — the Create-your-own card's `New asset` button overhung the rail. Ruled: fix the CSS rather than excuse the guard. `styles/asset-library-grid.css`'s create-card rules were widened to wrap (`flex-wrap`, the body's `flex: 1 1 10rem`, the button's `max-width: 100%` / `white-space: normal`); the guard's prior tolerance for that one fault was removed, so it is now strict with nothing exempt. Reverting the CSS fix (`git checkout -- styles/asset-library-grid.css`) reddens the guard again at 572px (`273–377.34 shows 273–376`), pinning the fix. |

## Task 6 (round 2) — pixel guards: Design 57 and Browse 3 (bucket P)

Commit `aef50af85`, fix rounds `f266d3f9d`, `716fe2646` and `ebec4d669`. Files: `tests/e2e/pixels.ts` (shared
helper, new), `tests/e2e/assetDesignerPresetPixels.e2e.ts` (new), `tests/e2e/assetLibraryMarkPixels.e2e.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| Design 57 (GUARD) | recognisably not the Washbasin card | `assetDesignerPresetPixels.e2e.ts` · *paints the vanity's card differently from the washbasin's in more than a tenth of their ink* | `presetPreview.ts` · `presetThumbnail` returns the washbasin's own thumbnail for `vanity` | **RED**, at both 1x and 2x device-pixel ratio — 0 of their ink differing against the 0.1 floor. Neighbour `assetDesignerDimensionsRulers.e2e.ts -t "offers the vanity"` also went RED, but at a PREREQUISITE (`toHaveLength(4)`, the card's own path count), never reaching a pixel comparison. A narrower, discriminating mutation (the washbasin's picture plus a fourth, respelled-and-dashed path — same painted pixels, different path data) left that neighbour fully GREEN (including its own `d`-differ check) while this guard still went RED at both ratios — the gap the audit named. |
| Browse 3 (GUARD) | distinguishable at 20px | `assetLibraryMarkPixels.e2e.ts` · *paints the five mark states as five different drawings at 20px, and one state's two rows as the same* | `styles/asset-mark.css` · removed `stroke-dasharray: 2 2` from `.rp-al-mark--unscaled` | **RED** — measured/unscaled painted alike (0 differing). Neighbour `assetMark.test.ts`'s *declares .rp-al-mark--unscaled with the ONE property that distinguishes it from measured* also went RED, on the declaration's EXISTENCE, not the painted result. A narrower mutation (the dasharray declaration kept, its pattern changed from `2 2` to `2 0` so the line paints solid) left that neighbour fully GREEN (32 files, 405 tests) while this guard still went RED. A fix round (`716fe2646`, after CI run 36345605529 found both clean runs failing on Linux) restaged every capture at a fixed, whole-pixel position and re-reads both cases at emulated 1x and 2x, whatever the host's own ratio; the mutations above were re-run and stayed RED at both ratios, with the neighbour still GREEN. **That diagnosis was wrong.** The guard went red again on Linux CI (run `36476196536`) with the identical `[0, 26, 0]` signature; fix round `ebec4d669` downloaded and diffed both failed runs' artifacts and found the chair's captured copy byte-identical to the case's own held *pending* picture in BOTH — a late re-read had invalidated the row's mark and redrawn it as *not yet read* between the class poll and the capture, on Linux, in about 1 of 4 runs. Device-pixel-ratio was never the mechanism: the sofa's own in-row capture (first red run) and staged capture (second) are byte-identical, so that row was already on a whole-pixel phase before staging existed. The real fix: `capture` now checks a row's expected state class in the SAME synchronous step as the clone, retrying every 100ms for up to 10s before failing with a named error, so a copy can only be taken of a row already showing its expected state — deterministic by construction, not merely staged at a fixed position. Replayed locally (a held read across one 1x capture): red with the old capture (`[0, 32, 0]`), green with the fixed one. **The route to *not yet read* changed on 2026-09-29 (flash fix, `0a0f8b7e1`):** the held pending capture used to modify SOFA's sidecar under the open library with its read held; since §5.4's amendment a drawn row keeps its mark across a re-read, so that route went RED against the fix (`expected 'rp-al-mark rp-al-mark--unscaled' to be 'rp-al-mark rp-al-mark--pending'`). The guard now holds the read, closes and reopens the library, and captures SOFA's FIRST read — the same `AssetMark` element and `rp-al-mark--pending` drawing; the at-rest captures, taken before the reopen, are unchanged. Re-run green on Windows. |

**Left open (round 2):** none of Tasks 1–6's clauses — every P and D clause the plan assigned was
built and passed the mutation gate above. Design 89's real-Mac arm and Recover 6/8's host-timing
half are B clauses the rulings explicitly declined to build (AD18-R31, AD18-R33); they have no
mutation table because no `src/` change reaches a host fact.

## Flash fix (2026-09-29, user request) — not part of AD18-R26 to AD18-R34

Commit `0a0f8b7e1`. Files: `src/presentation/library/viewportMarks.ts`,
`tests/presentation/stores/assetLibraryMarkRefresh.test.ts` (new), `tests/e2e/assetLibraryMarkRefresh.e2e.ts`
(new), `tests/e2e/assetLibraryMarkPixels.e2e.ts` (route above). Recorded apart from the round's tables so
their counts stand; no case step is retagged by it.

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — (design spec §5.4, amended 2026-09-29; no case step) | a drawn row keeps its mark while it is re-read, never drawing *not yet read* in between | `assetLibraryMarkRefresh.e2e.ts` · *keeps a drawn row's mark while it is re-read, never drawing "not yet read" in between* | `viewportMarks.ts` · `invalidate` deletes every id's mark (the old forget-first), drawn or not | **RED** — every class the mark took was `{measured, pending, unscaled}` against `{measured, unscaled}`. The four vitest cases in `assetLibraryMarkRefresh.test.ts` reddened on the same mutation, each on the held mark's own assertion; no neighbour in `tests/presentation/stores` or `tests/presentation/library` did. |

---

## UI critique round (AD18-R39 to AD18-R42)

**What this is.** The same compact, per-task, per-clause mutation table as the two rounds above,
for the UI critique round's seven tasks and its one whole-round fix wave — compiled from
`.superpowers/sdd/uic-task-{1..6}-report.md` and `.superpowers/sdd/uic-fixwave-report.md`
(gitignored, per this file's own header note). None of this round's clauses is a manual-pass case
step, so the *Step* column reads `—` throughout; *Clause* names the bug or behaviour the mutation
targets instead. Base `2c55b9c9d`. Every mutation was made under
`.superpowers/sdd/mutation.lock`/`e2e.lock`, run once, and restored, per each task's own report.

### Task 1 — stale notice and asset-price text contrast (WCAG 1.4.3)

Commit `452afd2a5`. File: `tests/e2e/designerRecoveryLegibility.e2e.ts` (new).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | `.rp-designer-notice` text reads at 4.5:1 or more against its background, both themes | *draws the stale notice’s text at 4.5:1 or more against its background, in both themes* | `styles/designer-notice.css` · `color: var(--text-normal)` → `var(--text-warning)` | **RED** — light 2.7326:1 (matches the rule's own prior "~2.73:1" comment). Restored: light 14.72:1, dark 10.55:1. |
| — | `.rp-asset-price-orphan`/`.rp-asset-price-unreadable` text reads at 4.5:1 or more, both themes | *draws `--text-warning` at 4.5:1 or more against the price row’s real, inherited background, in both themes* | `styles/asset-prices.css` · same `color` revert | **RED** — light 2.9531:1 for both classes (measured failing before the fix, not assumed). Restored: light 15.91:1, dark 12.19:1. The notice case stayed GREEN in this run, proving the mutation was isolated to its own clause. |

### Task 2 — a multi-selection draws every member, with one frame round the bounds

Commit `c70f031da`. Files: `src/presentation/designer/layers/selectionLayer.ts`,
`src/presentation/designer/DesignerCanvas.vue`. Tests: `selectionSetMarks.test.ts` (pure, new, 54
cases), `designerMultiSelectionMarks.test.ts` (mounted rig, new, 13 cases),
`assetDesignerMultiSelection.e2e.ts` (real host, new, 1 case).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | the canvas draws every member, not only the last selected | `designerMultiSelectionMarks.test.ts` | `DesignerCanvas.vue` · draws `selected.value.slice(-1)` only | **RED** (rig) — `expected { outlines: 1, bounds: +0, handles: 8 } to deeply equal { outlines: 2, bounds: 1, handles: 8 }`, 12 of 13 cases. |
| — | same clause, real host | `assetDesignerMultiSelection.e2e.ts` | same mutation | **RED** (e2e) — `AssertionError: expected 1 to be 2` (restroke-count poll). |
| — | `selectionSetMarks` restrokes every non-primary member | `selectionSetMarks.test.ts` | `members.slice(-1)` in both internal loops | **RED** — 23 of 54 failed. |
| — | the primary is never restroked a second time | same | `sameSelection` exclusion dropped | **RED** — 29 of 54 failed. |
| — | the frame draws only with 2+ members still on the shape | same | frame condition `boxes.length < 1` | **RED** — 19 of 54 failed. |
| — | a Parts-hidden member is drawn by neither the restroke nor the frame | `designerMultiSelectionMarks.test.ts` | `DesignerCanvas.vue` · per-member `drawnSelection` skipped | **RED** — 2 of 13 failed: `expected { outlines: 2, bounds: 1, handles: 8 } to deeply equal { outlines: 1, bounds: +0, handles: 8 }`. |
| — | the frame spans the union of every drawn member's box, not the primary's alone | `assetDesignerMultiSelection.e2e.ts` | frame built from `boxes.slice(-1)` (primary only) | **RED** (e2e) — `AssertionError: the frame spans both parts: expected false to be true`. |

### Task 3 — library tiles and the inspector preview draw the asset's details (AD18-R39)

Commits `e9914dcb0` (implementation + unit tests), `298e733de` (real-host e2e + spec amendment),
`f91019d6b` (two claims narrowed, no `src/` change). Files: `src/application/queries/ListAssetOutlines.ts`,
`src/presentation/library/AssetMark.vue`, `AssetTile.vue`, `AssetInspectorShape.vue`,
`styles/asset-mark.css`. Tests: `listAssetOutlinesDetails.test.ts` (new, 3 cases),
`assetMarkDetails.test.ts` (new, 9 cases), `assetLibraryTileDetails.e2e.ts` (new, real host).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | the batch's details are read, not dropped | `listAssetOutlinesDetails.test.ts`/`assetMarkDetails.test.ts` | `details` sliced to `[]` | **RED** — 8 cases, e.g. `expected [] to deeply equal [[true,true],…]`. |
| — | a detail's `dashed` flag survives the batch and the mark | same | forced `dashed: false` | **RED** — batch array and the mark's class list both wrong. |
| — | a detail's `closed` flag survives | same | forced `closed: true` | **RED** — batch `[true,true,true]` vs `[…,false]`; mark `[true×4]`. |
| — | detail coordinates stay in the footprint's own mm, not re-scaled | same | detail coordinates divided by 1000 | **RED** — `[-0.38,0.38,…]` vs `[-380,…]`; mark box `[9.99,10.01,10,10]`. |
| — | `withDetails` actually gates drawing | `assetMarkDetails.test.ts` | `props.withDetails ?` forced `true ?` | **RED** — the two row cases (no prop) drew length 4, not 1. |
| — | details are placed by the FOOTPRINT's own fit, not their own bounds | same | detail placement used its own min corner | **RED** — `[2,17.2,5.5,14.1]` vs `[2.4,17.6,5.5,14.1]`. |
| — | an open graphic's detail gets no closing `Z` | same | `Z` always appended | **RED** — open-graphic case, `[true×4]`. |
| — | the dashed class is applied per detail | same | dashed class forced `false` | **RED** — class list mismatch. |
| — | an `unscaled` outline's details still draw | same | unscaled arm not drawn | **RED** — `expected [] to have a length of 3`. |
| — | `AssetTile.vue` passes `with-details` | same | tile mounted without `with-details` | **RED** — tile path length 1, not 4. |
| — | the `none` state draws no mark | same | `v-if="true"` forced (none draws a mark) | **RED** — `expected true to be false`. |
| — | `AssetInspectorShape.vue` passes `with-details` | same | inspector mounted without `with-details` | **RED** — `[false]` vs `[false,true,true,true]`. |
| — | tile path counts (real host) | `assetLibraryTileDetails.e2e.ts` | tile mounted without details | **RED** — `expected [1,1,1] to deeply equal [4,1,3]`. |
| — | a detail's stroke is thinner than the footprint's | same | detail stroke forced to `1.5px` (the footprint's own weight) | **RED** — `thinner than the footprint: expected 1.5 to be less than 1.5`. |
| — | a detail inherits the footprint's own colour | same | detail `color: var(--text-faint)` | **RED** — `expected 'rgb(102, 102, 102)' to be 'rgb(179, 179, 179)'`. |
| — | the row mark (20px, no prop) draws the footprint only | same | row forced to draw details | **RED** — `the 20px row mark, footprint only: expected 4 to be 1`. |
| — | the inspector preview draws the details | same | inspector mounted without details | **RED** — `expected 1 to be 4`. |
| — | only the carcass detail is dashed | same | dashed class dropped from the carcass | **RED** — `[false,false,false]` vs `[true,false,false]`. |
| — | a detail sits inside the footprint's own client rect | same | details shifted +400mm | **RED** — `detail 0: right: expected 336.46 to be less than or equal to 313.14`. |
| — | a detail's contrast equals the footprint's | same | detail `stroke-opacity: 0.5` | **RED** — `light: a detail's contrast: expected 2.23 to be close to 6.69`. |

### Task 4 — one dialog footer, Cancel then a primary Save/Submit

Commit `202f172d9`, fix round `97382122b`. Files: `src/presentation/dialogs/formFooter.ts` (new),
`FormDialog.vue`, `FormSubmitRow.vue`, `src/presentation/designer/presets/AssetPresetForm.vue`,
`styles/dialogs.css`, `styles/designer-presets.css`. Tests: `formFooter.test.ts` (new, 7 cases),
`tests/e2e/dialogFooter.e2e.ts` (new, 3 cases across both commits).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | claiming the footer suppresses FormDialog's own Cancel row | `formFooter.test.ts` | `footer?.claim()` dropped | **RED** — button count 2, not 1, in both the one-row and preset cases. |
| — | the row draws Cancel then Save, in that order | same | Cancel before Save reordered | **RED** — `expected [ 'submit', 'cancel', 'submit' ] to deeply equal [ 'cancel', 'submit' ]`. |
| — | the submit carries `mod-cta` | same | class dropped | **RED** — `expected [ 'rp-dialog-button' ] to include 'mod-cta'`. |
| — | the submit stays a real `type="submit"` inside the form | same | `type="button"` | **RED** — order array and `button[type="submit"]` lookup both failed. |
| — | the submit is not detached from its form by a `form=` attribute | same | `form="elsewhere"` added | **RED** — `expected null to be <form …>`; submit spy called 0 times. |
| — | FormDialog's own Cancel row is truly gone once claimed | same | that row's `v-if` forced `false → true`-equivalent drop | **RED** — a non-claiming (KnownDistance) case lost its expected Cancel row. |
| — | Cancel is `aria-disabled`, not `disabled`, while busy (focus reachability) | same | `aria-disabled`/`:disabled` both applied | **RED** — a disabled-input read where a button was expected. |
| — | a standalone `FormSubmitRow` (no dialog) draws the submit alone | same | row Cancel forced `v-if="true"` outside a provider | **RED** — `TypeError: Cannot read properties of null (reading 'busy')`. |
| — | the preset form's Apply goes through `FormSubmitRow`, not its own row | `assetPresetForm.test.ts` (existing, selector updated) | `AssetPresetForm.vue` kept its own Apply row | **RED** — button count 2, not 1. |
| — | choosing a preset scrolls its fields into view | `formFooter.test.ts` | `scrollIntoView` call dropped from `choose()` | **RED** — spy called 0 times, not 1. |
| — | the scroll targets `{ block: 'start' }` | same | `{ block: 'nearest' }` | **RED** — `expected [ { block: 'nearest' } ] to deeply equal [ { block: 'start' } ]`. |
| — | Cancel then Save, real host | `dialogFooter.e2e.ts` | old two-row layout restored | **RED** — button count 2, not 1. |
| — | Save renders after Cancel on screen, real host | same | submit-before-Cancel order | **RED** — `expected 765.98 to be greater than or equal to 890.5`. |
| — | Save's AA fill measures ≥4.5:1 in both themes | same | the `.mod-cta` AA-fill override removed | **RED** — `expected 3.4255 to be greater than or equal to 4.5`. |
| — | Enter submits the real form (submit not detached) | same | `form="elsewhere"` | **RED** — dialog stayed open past the wait. |
| — | narrow-window footer stays one row | same | `@media (max-width:600px){flex-direction:column}` added | **RED** — `expected 38 to be less than or equal to 1`. |
| — | choosing a preset scrolls Apply into view, real host | same | `scrollIntoView` dropped | **RED** — `expected 782.36 to be less than or equal to 725`. |
| — | the footer stays pinned (sticky) while the body scrolls | same | footer `position: static` | **RED** — `expected 1216.36 to be less than or equal to 784`. |
| — | a field scrolled under the pinned row is brought out by Tab (fix round, WCAG 2.2 SC 2.4.11) | `dialogFooter.e2e.ts` (fix round) | `scroll-padding-block-end` removed | **RED** — `expected 758.86 to be less than or equal to 726`; field stayed at 729–759, under the row at 725–767. |
| — | the hover fill still clears 4.5:1 (fix round) | same | hover rule removed | **RED** — `expected 'rgba(117, 91, 183, 1)' not to be 'rgba(117, 91, 183, 1)'` (no change under hover). |
| — | hover uses the AA recipe, not the host's own accent hover (fix round) | same | hover fill = `var(--interactive-accent-hover)` | **RED** — `expected 2.754 to be greater than or equal to 4.5`. |
| — | a REFUSED (disabled) Apply keeps its resting fill under the pointer (fix round) | same | hover rule missing `:not([aria-disabled='true'])` | **RED** — `expected 'rgba(174, 149, 233, 1)' to be 'rgba(162, 130, 237, 1)'`. |

### Task 5 — the clearance's reach reads positive per side; a typed reach moves that edge only (AD18-R41)

Commits `613032f2e` (ruling recorded), `e809f3a77` (reach read and single-edge edit), fix round
`649eb4489` (a reach that misses warns; other sides settle within 0.01mm). File:
`src/presentation/designer/dimensions/dimensionFigures.ts`. Tests:
`clearanceReach.test.ts` (new, 41 cases), `clearanceReachLanding.test.ts` (new, fix round),
`dimensionFigures.test.ts` (existing, rewritten cases).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | the clearance's offset reads as a positive reach, not a signed gap | `clearanceReach.test.ts` | `value: drawn` (signed value restored) | **RED** — 24 of the directory's cases, e.g. `rect-table: each side reads its positive reach…`. |
| — | a flush (0mm reach) side draws no label | same | the zero-reach filter removed | **RED** — 18 cases, including `dimensionFigures.test.ts`'s *draws every drawable part under the toggle, each exactly as a selection draws it*. |
| — | a typed reach moves only that edge, not the whole clearance | same | typed reach translated via `shifted(…, -typed)` (the old whole-clearance move) | **RED** — 18 cases, including *takes the vanity’s front from 600 to 800 and leaves its back flush with the footprint* and every preset's *`{preset}`: moves each drawn side alone, out and in*. |
| — | the solve passes are along/across/along, not one pass | same | one pass only | **RED** — 3 cases: round-table, oval-table, curved-on-one-side (the sides that actually drift under one stretch). |
| — | the fixed edge stays exactly where it was | same | fixed edge swapped for the moving one | **RED** — 18 cases. |
| — | a reach is omitted below 0.5mm rounding, kept at 0.6mm | same | rounding check `!== 0` instead of `Math.round(...) === 0` | **RED** — 2 cases: reach 0.4 and −0.4. |
| — | other sides settle within `SETTLED_MM` (fix round) | `clearanceReach.test.ts`/`dimensionFigures.test.ts` | `typed` dropped from the reach figures | **RED** — 2 cases (the typed-extents unit case and the warn-on-miss case). |
| — | `MAX_ROUNDS` actually bounds the loop at the measured precision (fix round) | same | `MAX_ROUNDS = 2` (the original three-pass shape) | **RED** — 2 cases (a rounded-reading case and a `QUAD` refusal case). |
| — | the clearance's locale label names a reach, not an offset (fix round) | `tests/presentation/i18n` | offset label kept on the clearance | **RED** — 2 cases: `clearanceReach.test.ts`'s *names the clearance’s sides as reaches and leaves a detail’s as offsets*, and the aria-label check. |
| — | the along-only extent request is not enough on its own (fix round) | `clearanceReach.test.ts` | `typed` asks for the along extent only | **RED** — 1 case, the typed-extents case. |
| — | a restore-stretch refusal is not swallowed (fix round) | same | restore refusal swallowed | **RED** — 1 case. |
| — | `MAX_ROUNDS = 1` is not enough (fix round) | same | `MAX_ROUNDS = 1` | **RED** — 5 cases: round table, oval table, curved-on-one-side, rounded-reading, `QUAD` refusal. |
| — | the vanity's rendered label reads `clearance-offset-bottom 600 mm` (real host) | `clearanceReachLanding.test.ts` route (landing e2e) | `value: drawn` (M1 above) | **RED** (e2e) — `expected [ 'clearance-offset-bottom -600 mm' ] to deeply equal [ 'clearance-offset-bottom 600 mm' ]`. |
| — | flush sides draw no label (real host) | same | zero-reach filter removed (M2 above) | **RED** (e2e) — `expected [ 'clearance-offset-left 0 mm', …(3) ] …`. |
| — | a reach that cannot land WARNS with the landed size (fix round) | `clearanceReachLanding.test.ts` | `typed` dropped from the reach figures (F1 above) | **RED** — *warns with the size the clearance landed at, as a typed Width does*: `expected [] to deeply equal [ Array(1) ]`. |
| — | untouched sides stay within 0.01mm under `MAX_ROUNDS = 2` (fix round) | same | `MAX_ROUNDS = 2` | **RED** — `- "bottom": 629, + "bottom": 635` (a rounded-reading fixture). |

### Task 6 — locale counts gain singular forms

Commit `f5cf4472f`, fix round `d61f98693`. Files: `src/presentation/i18n/locales/{en,de}-assetLibrary.ts`,
`src/presentation/i18n/locales/{en,de}/assetArrange.ts`, `eslint.config.mjs`. Tests:
`assetLibraryRoot.test.ts`, `assetLibraryFilterSearch.test.ts`, `assetInspectorUsedIn.test.ts`,
`designerArrangePanel.test.ts`, `tests/presentation/i18n/strings.test.ts`,
`tests/gates/localeModuleSentenceCase.test.ts`.

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | the `LEADING_COUNT_PATTERN` sentence-case exemption exists | `localeModuleSentenceCase.test.ts` -t "leading-count" | `ignoreRegex` reverted to `[UNIT_SYMBOLS_PATTERN]` | **RED** — 1 failed (the pattern was absent). |
| — | the footer reads "1 asset", not "1 assets" | `assetLibraryRoot.test.ts` -t "reads a single asset without a plural" | `assetCount` reverted to its bare `.other`-only form | **RED** — `expected '1 assets' to be '1 asset'` (the exact reported bug, reproduced). |
| — | the repair-strip notice names a singular note | `assetLibraryRoot.test.ts` -t "names the headline with a singular note" | `headline` reverted to `.other`-only | **RED** — `expected '1 asset notes could not be read…' to be '1 asset note could not be read…'`. |
| — | the search live region announces a singular match | `assetLibraryFilterSearch.test.ts` -t "announces the match count" | `matchCount` reverted to `.other`-only | **RED** — `expected '1 matching assets' to be '1 matching asset'`. |
| — | the *Used in* row names a singular requirement | `assetInspectorUsedIn.test.ts` -t "names a single requirement" | `label` reverted to `.other`-only | **RED** — `expected '… 1 requirements' to be '… 1 requirement'`. |
| — | the Repeat form's preview names a singular copy | `designerArrangePanel.test.ts` -t "previews a single copy" | `preview` reverted to `.other`-only | **RED** — `expected '1 copies, each 100 mm…' to be '1 copy, 100 mm…'`. |
| — | `LEADING_COUNT_PATTERN` exempts only the three named strings, not every "digits, space, lowercase" sentence (fix round) | `tests/gates/localeModuleSentenceCase.test.ts` (new negative case, `evaluateSentenceCase` driven directly with the real resolved `ignoreRegex`) | `LEADING_COUNT_PATTERN` reverted to the unanchored `'^\\d+ [a-z]'` | **RED** — `expected true to be false` on `'3 items removed. yes, all of them.'`: the whole sentence, including its unrelated second half, was silently exempted. |

### The whole-round review's fix wave

Commits `75b4a9551` (C1), `8b3259571` (I1), `82d3970f0` (M-f, T3-M2), `518721058` (I2, M-b, M-c,
M-d, M-g, T5-M3, T5-M4).

| Step | Clause | Test | Mutation | Outcome |
| --- | --- | --- | --- | --- |
| — | C1: the New asset dialog is unreachable on mobile, so `dialogFooter.e2e.ts` runs desktop-only | `dialogFooter.e2e.ts` (`desktop(...)` wrapper) | — (verification, not a `src/` mutation: `RenovationProjectView` provides `readOnly: Platform.isMobile`, and `ViewRoot.vue`/`ProjectList.vue` both bind `:disabled="readOnly"` on the New asset door) | Confirmed by running under `OBSIDIAN_UI=mobile-emulation`: 3 skipped, 0 failed, against 3 passed on desktop. |
| — | I1 (AD18-R42): `used-in-plans.plan`/`.unreadable` get singular forms through every real caller | `designerUsageScope.test.ts`, `assetUsageDuplicate.test.ts` (new) | every caller's `=== 1` mutated to `=== -1` | **RED** — all 5 new/updated cases, e.g. `Received: "1 notes could not be read…"` and `Received: "Kitchen (Flat refit) — 1 placements"`. |
| — | I1: the library's own unreadable-only key still reads singular | same suite | library's unreadable-only mutation | **RED** — its own case, independently. |
| — | I1: after extracting `usedInPlansLabels.ts`, the shared helper is what the caller relies on | same | `=== 1` mutated inside `usedInPlansLabels.ts` | **RED** — 5 cases, the same as the per-caller mutation, proving the helper is load-bearing rather than decorative. |
| — | M-f: Set dimensions' submit and a plain confirm's confirm both wear the AA-fill `mod-cta` selector; a `danger` confirm never does | `formFooter.test.ts` (new jsdom block, real `DialogHost`) | the `mod-cta` class removed and the old (no-`mod-cta`-on-plain-confirm) `ConfirmDialog` binding restored | **RED** — `expected null to be <button …>`, for both Set dimensions and the plain confirm; the `danger` case stayed correctly `null` throughout. |

**Left open (this round):** Task 3's own report said the harness fixture
(`tests/harness/assetLibrary.ts`) built outlines with no details, so `npm run harness`/`harness-shot`
would draw the old footprint-only tiles — **that is now stale**: the fix wave's T3-M2
(`82d3970f0`) gave `measured()` a `details` parameter (default `[]`) and two seeds now carry them
(the worktop, the scaffold tower), so the harness draws details too. Neither the harness nor a real
vault's tiles has been LOOKED AT by anyone, mutated or not — that half of the concern stands. The
multi-selection frame's palette-follows-theme is asserted nowhere (Task 2's own concern) either.
Neither clause has a test to redden.
