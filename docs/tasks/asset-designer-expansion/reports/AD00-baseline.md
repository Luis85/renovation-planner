# Baseline report — AD00

Date / reviewer: 2026-09-16 / lead agent (serial execution, no subagents — see "Execution mode" below)
Selected branch / exact SHA: `renovation-planner-asset-designer-bc5539` @ `f3a8864a9e9e14c3e39c9adf6c06bdf0f2fa6a52`
Reviewed-plan reference SHA: `d77e7c5eba5e6518b93a5be4606532ceab3a77eb` — present in this repository, an **ancestor of HEAD by 14 commits**. Used as reference evidence only; nothing was reset to it.
Dirty/uncommitted user work and preservation plan: `git status --short` is **empty**. No user work to preserve in this worktree. 100 other worktrees exist (`git worktree list`); none was touched.
Applicable repository instructions: root `CLAUDE.md` (read in full), `docs/development/sdds/obsidian-renovation-planner-SDD.md` (authority over CLAUDE.md), ADR-0014/ADR-0015, `docs/requirements/Asset designer.md` + `Asset Designer Foundations.md`. No `AGENTS.md` at the root.
Node/npm/Obsidian/browser/platform: Node **v24.20.0** (inside `engines.node` `^22.22.2 || ^24.15.0 || >=26.0.0`), npm **11.18.0**, Windows 11 (win32), `package-lock.json` present. Obsidian: **not available in this environment**. Headless browser: **not available** — `scripts/chromium.mjs` refuses (`No Chromium build found … D:\dev-cache\playwright\chromium-1234\chrome-win64\chrome.exe`).
Disposable test-vault path: `tests/vault/**` (fixtures, read-only here). `npm run test-build` deploys into this repository's own `.obsidian/plugins/`, which is disposable; **not run** in this task.

## Execution mode

The orchestrator prompt asks for up to three parallel workers. This session's operating
instructions forbid spawning agents unless asked, and the runbook's own fallback applies:
*"Do not assume a subagent tool exists: use the same prompts sequentially when the host offers no
parallel delegation."* **Everything below was executed serially by one agent. No work was
delegated, and nothing here is reported as if it had been.**

## Current capabilities

| Capability | Current source/control | Tests/evidence | Disposition |
|---|---|---|---|
| Designer view, per asset, keyed by `assetId` in Obsidian view state | `presentation/designer/AssetDesignerView.ts`, registered in `plugin/RenovationPlannerPlugin.ts:251` | `tests/plugin/assetDesignerWiring.test.ts`, `tests/presentation/designer/assetDesignerView.test.ts` | retain |
| Four shell regions (toolbar / canvas / inspector / status) + `DialogHost` | `AssetDesignerRoot.vue` | `assetDesignerRoot.test.ts`, `regionsReachable.test.ts` (import-graph walk) | retain |
| Toolbar: pan, select, trace footprint, trace clearance, draw rect, draw circle, trace detail, set anchor, set facing, calibrate, undo, redo | `tools/registerDesignerTools.ts` (`DESIGNER_TOOL_LABELS`), `DesignerToolbar.vue` | `designerTools.test.ts`, `designerToolbar.test.ts` | retain |
| **Single**-part selection (`footprint` \| `clearance` \| `detail:<id>` \| `anchor` \| `facing`) with transform / points / bend modes | `selection/designerSelection.ts`, `DesignerSelectionModes.vue`, `designer-select-tool.ts` | `designerSelection.test.ts`, `designerSelectionInspector.test.ts` | **improve** (AD08 multi-select) |
| Snapping, alignment guides, zoom-following grid, grid readout | `selection/dragSnap.ts`, `snapCandidates.ts`, `grid/designerGrid.ts`, `DesignerGestureLayer.vue` | `designerSnapGrid.test.ts`, `designerGesture.test.ts` | retain (shipped 2026-09-15 iteration, increment 1 of 3) |
| Set / edit dimensions — **scales** a measured footprint, replaces only when shapeless or pending | `AssetDesignerRoot.vue:editDimensions`, `domain/asset/shapeEdits.ts:scaleDesignToDimensions`, `domain/asset/scaleSolve.ts` | `assetDimensions.test.ts`; spec `2026-09-16-asset-designer-consolidate-design.md` §3/§4 | **retain — R05 and the curved-size half of R06 are already fixed** |
| Presets (tables, seating, sanitary, plants/beds) with preview + replace warning | `domain/asset/presets/*`, `presets/AssetPresetForm.vue` | `assetPresetFlow.test.ts`, `assetPresetForm.test.ts`, four harness preset shots | retain |
| Background (spec sheet) pick, missing/unreadable notices | `plugin/assetBackgroundPicker.ts`, `layers/backgroundLayer.ts` | `backgroundPicker.test.ts`, `designerBackground.test.ts` | retain |
| Per-asset calibration, shared `CalibrateTool`, per-group pending flags | `commands/asset/CalibrateAsset.ts`, `domain/asset/captureAwaitsScale.ts` | `designerCalibration.test.ts` | retain |
| Clearance boundary, anchor, facing, height | `commands/asset/SetAssetClearance|SetAssetAnchor|SetAssetFacing|SetAssetHeight.ts` | `assetCommands.test.ts`, `designerInspector.test.ts` | retain |
| Undo / redo per leaf, two write ledgers (note + sidecar) | `application/editor/asset/ReversibleAssetDesignCommands.ts`, `designerCommands.ts` | `assetDesignLocking.test.ts`, `designerWriteChain.test.ts` | improve (AD03 — see R09 below) |
| One serial write chain per leaf, with **four documented bypasses** | `selection/editShape.ts:createWriteChain` docblock | `designerWriteChain.test.ts`, `designerRefresh.test.ts` | **improve** (AD03) |
| Failure / missing / stale / loading states, save-state indicator | `AssetDesignerRoot.vue` `failure`, `staleAfterRefresh`, `SaveStateIndicator` | `designerRefresh.test.ts`, `designerCrossLeaf.test.ts` | retain |
| Mobile gate (`Platform.isMobile` refuses command and view) | `plugin/assetDesignerCommands.ts:99`, `AssetDesignerView.ts:182` | `assetDesignerCommands.test.ts` | retain — **do not weaken** |
| Multi-selection, groups, alignment/distribution/repeat, Parts panel, open polylines | — **absent** | — | **missing** (AD08–AD11) |
| Product logo, account chrome, compass, "fits well" approval, second save workflow | — **absent** | — | missing **and must stay missing** (plan §4 correction table) |

## Consumers and persistence

| Contract/model | Current schema/version or type | Reader/writer/render/export/revision consumers | Migration or compatibility implication |
|---|---|---|---|
| Asset geometry sidecar (`.rpgeo`, one per asset, library `Geometry/`) | reads **v1 and v2**, emits **v2**; `z.literal(3)` refused (`assetGeometry.test.ts:179`) | `AssetGeometryStore`, `ObsidianAssetGeometrySidecar`, `GetAssetDesign`, `ListAssetOutlines` | **No v3 allocated in this checkout.** Re-resolve before AD04; a durable group/open-line field needs the bump *and* the older-build refusal already present. |
| `AssetShape` (footprint, clearance, details, anchor, facing, three pending flags) | `domain/asset/AssetShape.ts` | 54 modules import it (designer layers/tools/inspector, commands, queries, plan placement, library) | A structural change touches every one; AD04 must stay independently compilable. |
| `AssetDetail` (closed curved outline, semantic `name`, `line`, `pending`) | `domain/asset/AssetDetail.ts` | only 6 importers: `AssetShape`, `detailEdits`, `presetGeometry`, `assetPlacement`, `DesignerSelectionInspector.vue` | Narrow blast radius — the open-line discriminant (C02) lands here first. |
| Plan placement projection | `domain/spatial/assetPlacement.ts:placedOutline` | plan editor `AssetLayer.vue`, `AssetShapes.vue`, `elementFootprint.ts`, `transformBox.ts`, `select-tool.ts` | **Flattens arcs at `PLAN_ARC_TOLERANCE_MM` then stretches per axis**; the designer keeps bulges. The divergence is recorded in that file's header with its trigger (native ellipse/path in `CurvedPolygon`). |
| Library mark (20 px thumbnail) | `ListAssetOutlines` → `AssetMark.vue` | library rows | Draws the **footprint only**, arcs flattened at 1 mm. Details/clearance deliberately omitted at that size — a stated decision, not a gap. |
| Note frontmatter (height, category, price basis) | `assetFrontmatter.ts`, `assetMapper.ts` | `ObsidianAssetRepository`, library inspector | `noteVersion` and `geometryVersion` are **separate** and must stay so (C08). |
| **Export paths** | **none exist** | — | There is no export subsystem in `src/` (no PDF/print/render-to-file). C10's "every current export path" is, today, **the plan canvas and the library mark**. AD05/AD14 must be rescoped accordingly. |
| **Revision / approval consumers** | **none exist** | `docs/requirements/Plan revisions.md` is a requirement, not code | No plan can be approved, so nothing frozen can be silently redrawn. AD14's obligation is **explicit capability gating**, not historical preservation — and the repository already took that decision on 2026-09-16 (snapshot at approval, owed beneath Plan revisions). |

## Commands actually executed

| Command | Commit/environment | Exit code | Passed/failed/not run | Evidence |
|---|---|---|---|---|
| `npm run build` (`vue-tsc -noEmit && vite build`) | `f3a8864a9`, Node 24.20.0, win32 | 0 | **passed** | 1472 modules, `dist/main.js` 1,929.24 kB (gzip 566.57), `dist/styles.css` 172.73 kB, built in 7.78 s |
| `npm run lint` (`oxlint --deny-warnings && eslint . --max-warnings 0`) | same | 0 | **passed** | 5 m 31 s wall on this machine |
| `npm run test:coverage` | same | _pending_ | _see addendum_ | first attempt was invalidated by my own concurrent lint run (see "Contention" below) |
| `npm run analyze` (fallow) | same | — | **not run** | blocked behind the suite in `check` |
| `npm run audit` | same | — | **not run** | separate gate, not attempted |
| `npm run harness-shot` | same | — | **not run** | `scripts/chromium.mjs` refuses: no pinned Chromium on disk, and `RP_CHROMIUM_EXECUTABLE` is unset |
| `npm run test-build` + real Obsidian session | — | — | **not run** | no Obsidian available in this environment |

### Contention (recorded because it produced a false red)

The first `npm run check` was backgrounded; I then ran `npm run lint` in the foreground while it
was in `tests/build/`. Six cases in `network-boundary.test.ts` and four in `lint-edited.test.ts`
went red — the ESLint-boot contention `CLAUDE.md` names by name. That run was **killed and
discarded**, not reported. The suite was re-run alone.

## Visual/host baseline

Screenshots and exact surface/theme/width: **none captured.** `npm run harness-shot` cannot run
without a Chromium binary; the script deliberately refuses to substitute one silently. The fixed
shot table already contains the designer in dark, light, narrow (460 px), four presets and the
selection modes (`scripts/harness-shot.mjs:669-710`), so the capture obligation for AD06 is
*blocked on a browser*, not on missing shots.
Real Obsidian tests executed: **none.** `docs/tests/cases/Design an Asset.md` exists and its Runs
table is honestly empty.
Unavailable verification and reason: headless captures (no Chromium — remedy `npx playwright
install chromium` or `RP_CHROMIUM_EXECUTABLE=…`), Obsidian smoke tests (no host), `npm run audit`
(not attempted), appearance in a themed vault.

## Decisions needed before AD01

**Current arc-stretch/symbol specification:** taken and written down. Designer keeps bulges and
solves the typed extent (`scaleSolve.ts`, `scaleDesignToDimensions`); the plan flattens then
stretches. The divergence is documented in `assetPlacement.ts`'s header with its trigger. **C04's
"lock proportional scaling for curved geometry" contradicts this shipped decision** and must be
reconciled in AD01 rather than implemented.

**Current revision/approval behavior:** nothing can be approved. Decision taken 2026-09-16: an
approved revision *snapshots* the shapes it references; the obligation now sits beneath
`docs/requirements/Plan revisions.md`, not beneath this epic. C11/AD14 must adopt this, not re-decide it.

**Current mobile designer gate:** `Platform.isMobile` refuses both the command and the view.
Preserve (C12).

**Current preset catalogue and creation lifecycle:** four groups (`tables`, `seating`, `sanitary`,
`plantsBeds`) via `AssetPresetForm.vue`, with a replace warning. Creation of the asset itself is
`NewAssetForm.vue` / `CreateAsset`.

**Actual infrastructure and harness paths:** `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts`
and `AssetGeometryStore.ts` (the shortened path SOURCES.md flags as not found is confirmed absent —
do not create one). Harness: `npm run harness` (`?view=asset-designer`, `&theme=light`, `&preset=`,
`&select=`, `&mode=`), `npm run harness-shot [entry]`, `-- --width=460`.

**Ongoing branches/work overlapping this plan:** the repository runs **its own asset-designer
roadmap**, approved in brainstorming and recorded as dated specs:
`2026-09-13-asset-designer-symbols-design.md`, `2026-09-15-asset-designer-snapping-and-guides-design.md`
(increment 1 of 3 shipped; **dimensions-on-canvas and rulers are still owed**),
`2026-09-16-asset-designer-consolidate-design.md` (shipped). 100 worktrees exist; none carries
uncommitted asset-designer work reachable from here. Integration branch: this worktree's own
branch, `renovation-planner-asset-designer-bc5539`, at `f3a8864a9`.

## Plan delta

**Existing requirement/use-case mappings.** Epic `Asset designer` → Feature `Asset Designer
Foundations` (Active) → 13 stories: 10 Done (`Trace an object's footprint`, `Calibrate an object's
own drawing`, `Capture a clearance boundary…`, `Give a new asset its dimensions`, `Open the designer
on one asset`, `Place an anchor and set a facing direction`, `Record how tall an object is`,
`Select part of an object's shape`, `Start an asset from a preset`, `Delete an asset without
stranding its shape`), 3 Active (`Choose a technical drawing for an object`, `Read and correct an
object's dimensions`, `Undo a design gesture`). Sibling features `Door Designer`, `Stair Designer`,
`Window Designer` are unstarted. **AD00–AD17 must map onto this tree; they must not become a second
backlog.**

**Tasks already satisfied, with evidence.**

- **AD02 is largely done.** R05 (`editDimensions` replacing a detail-free footprint with a
  rectangle) was fixed at `adec599f0`; R06's curved-size half was fixed at `b9d014858` /
  `2f8c84647` (`solveScale`, `scaleDesignToDimensions`), reviewed at `d253f727e`. What remains of
  AD02 is the *policy* question C03/C04 raise — an explicit "replace footprint" action (recorded
  out of scope with a trigger, spec §6) and whether nonuniform scaling of curved geometry should be
  locked (the repository decided **not** to lock it).
- **AD04's migration premise is partly stale.** v1→v2 with future refusal already ships; no
  migration table exists for asset geometry and the spec records why (§6), with its trigger being
  exactly the open geometry AD11 wants.
- **AD14 is a gating task, not a preservation task** — nothing can be approved yet.
- **AD05's export half has no subject** — there is no export path in `src/`.

**Tasks to amend/split.**

1. **AD01** must *reconcile* with three accepted decisions rather than freeze new ones: the
   arc-stretch policy (C04 conflicts with shipped behaviour), the recoverability trigger (C11/§2),
   and the pending-clearance-on-scale finding, which the repository deliberately **parked with a
   trigger** (`e87a08827`, spec §6) — C07's "refuse the resize" default would reopen a closed
   decision.
2. **AD02** shrinks to the unreconciled policy items above.
3. **AD05/AD14** rescope to the two real consumers (plan placement, library mark) plus explicit
   capability gating.
4. The repository's own owed increments — **dimensions on canvas** and **rulers** — are in no AD
   card and belong in the wave plan, since AD08/AD09 build over the same canvas.
5. **Doc drift found during the audit:** `Asset Designer Foundations.md` still says *"There is no
   selection tool"* and lists a toolbar without Select, which shipped. One-line fix, no code.

**Risks and release blockers.**

- **Verification ceiling:** no Obsidian and no Chromium here. Under runbook §10 that means the beta
  **cannot be labelled ready** from this environment regardless of how much is implemented.
- The gate costs ~5.5 min for lint alone on this machine; the full `check` is long. Parallel gate
  runs produce false reds (demonstrated above) — one gate at a time, `check:fast` between edits.
- Bundle is already 1.93 MB; every new dependency is visible.
- 100 worktrees share this repository's administration; no AD work may reset or delete any of them.
