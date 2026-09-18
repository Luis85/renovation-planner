# RESUME — session four's hand-off

**Rewritten 2026-09-18, replacing session two's packet wholesale.** That version predated three
integrations and two rulings and was stale in a way a reader could not detect, which is why this
file is rewritten rather than appended to.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
**Nothing has been pushed, merged to `main`, or tagged.** `main` is untouched.

## Where the work stands

`HEAD` is **`593a38b55`**. Six commits this session, each verified as described below:

| SHA | What |
|---|---|
| `23930a0de` | AD13 duplicate half integrated, with the design-spec §8 Amendment 6 and the Amendment 2 correction in the same commit |
| `cde0e8444` | ADQ integrated (background opacity + reference deletion), carrying its one deliberate red |
| `c64acda60` | The wire — that red turned green, and `removeBackground` made required |
| `644b9687f` | AD13 ICR 3 — the `Use in plan` button's class and its rules |
| `66710b1eb` | AD13 ICR 4 — `open-asset-library`'s mobile gate |
| `593a38b55` | `listPlansUsingAsset` relocated into the query bundle |

**AD13 and ADQ are both `integrated` in `state.json`, and neither is `verified`.** AD14 is
`planned` and unblocked. AD15 and AD16 remain `blocked` and were not touched.

## The verification shortfall — read this before trusting any gate claim

**No full six-gate run completed on this session's final SHA.** This is the single most important
thing on this page and it is a real shortfall, not a formality.

What WAS run, and passed, on the relevant trees:

- `npm run build`, `npx oxlint --deny-warnings`, `npx eslint . --max-warnings 0`,
  `npx vue-tsc -noEmit` — all exit 0 on `23930a0de`.
- `npx vue-tsc -noEmit` — exit 0 on the tree after every subsequent commit, re-run four times.
- `npm run test:coverage` on `23930a0de` — **exit 1**, with coverage floors MET at
  **99.21 / 98.04 / 99.25 / 99.66** against 99/98/99/98, and 13 failed tests in 9 files.
  **All 14 failures were TIMEOUTS; zero were assertions**, plus one
  `[vitest-pool]: Failed to start forks worker … Timeout waiting for worker to respond`. No failing
  file was one this session touched.
- Targeted suites after each commit: the three designer inspector suites (94 passed), the
  reference view (7 passed), the library + read-models + two stores (396 passed), the registration
  pair (35 passed), the style gate (11 passed).

What was NOT run: `npm run analyze` at any point this session, and `npm run test:coverage` on
anything after `23930a0de`. **The solo re-runs of the nine timed-out files were started and did not
finish** — the first file produced no result in 25 minutes and the run was killed.

**Why, and it is not the code.** This machine has **7.8 GB of RAM** and another Claude session is
working concurrently in the `renovation-planner-beta-handoff-e80bb5` worktree. With both running,
free RAM fell to **0.1 GB** and the box paged rather than computed: one test case took **20.5
minutes**, and the first coverage attempt ran **7h50m** and completed 192 of 1043 files before
being killed — a ~43-hour projection. Restarting at `VITEST_MAX_WORKERS=2` cut the rate from
147 s/file to 7.2 s/file and the run finished in 4.3 hours. Two facts follow:

- **`test:coverage` here is hours, not the ~200 s CLAUDE.md records**, and that file's own rule
  applies to itself: re-measure before reasoning from its numbers.
- **The suite is 1043 test files**, not the 362/459 CLAUDE.md states.

**What the next session owes first:** re-run the nine files alone on a quiet box, then the full six
gates on `HEAD`. Until that is done, treat "integrated" as meaning exactly that and nothing more.
Do not start a heavy run while the other worktree is busy — check with
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` first.

## Wave 5 is WRITTEN but NOT DISPATCHED

`execution/LEASES.md` carries a complete wave-5 table with two disjoint rows, and it is committed
**in the commit its workers branch from** — which is the fix for wave 4's own lease-timing failure,
recorded in that same file. Dispatch needs no further lease work.

- **AD13 hand-off** (`.worktrees/ad13c` · `ad13c-asset-handoff`) — ICR 1, the asset hand-off
  channel. FOUR files: `ProjectDestination.ts` (`assetId?` on `ProjectOrigin` plus `'assetId'` in
  `projectOriginFrom`'s key list), `editorArrival.ts` (an `assetId` arm in `reveal` BEFORE the
  record lookup), `assetPlacementTask.ts` (`choose` split into picker vs known-id, exposed through
  `spatialEditing.ts`), and `PlanEditorView.ts`. **The fourth is the one to brief loudly:**
  `getState()` persists `this.origin` and nothing clears it, so an `{ planId, assetId }` origin
  would survive a restart and re-arm the placement tool weeks later. The worker picks between
  excluding `assetId` from `getState` and clearing it once `useEditorArrival` consumes it, and owes
  the case that fails without its choice. **This is what makes AD13 criterion 1 met**; until it
  lands the criterion stays recorded UNMET with a trigger.
- **AD14** (`.worktrees/ad14` · `ad14-clearance-review`) — the last card in scope. Ruling
  **AD14-R1** already decided its hard question. It owes: `clearanceNeedsReview` on `AssetShape`,
  asset-geometry **schema v4** allocated in the same edit, a MEASURED clearance PRESERVED under a
  whole-object scale while a PENDING one goes on scaling, a `Reviewed` inspector action drawn only
  while the flag is set, **ADR-0034**, C11 r1 row 3's explicit capability gating WITH tests, and
  the two regression fixtures AMENDED rather than deleted (`shapeEdits.test.ts`'s literal
  scaled-clearance points and its bounding-box case, plus
  `2026-09-16-asset-designer-consolidate-design.md` §7's *"every part — clearance and details
  included — is scaled about the anchor"*). Its `styles/designer.css` grant is **ADDITIVE ONLY and
  has twelve lines of room** — the partial is at 388 against a 400 cap.

Both worktrees need `node_modules` robocopied from the integration worktree; do **not** run
`npx playwright install chromium` (it emptied `node_modules` once).

## What changed in the plan, with reasons

- **AD13 ICR 2 is WITHDRAWN — no card, no work.** Its premise ("no such door exists in `src/`") was
  false. `EditorNavigation.asset` is declared, composed in `planEditorDeps.ts`, and drawn at two
  predicated sites (`AssetPlacementDetails.vue` and `useCanvasMenuActions.ts`), with keys in both
  locales and `assetPlacementInspector.test.ts` asserting both including the missing-asset arm. It
  shipped in `999b39230`, before this package. The survey had looked for the proposed WIRING rather
  than for the function.
- **The ADQ wire took the prop-drilled shape, not the recommended one.** `useDesignerRuntime()`
  inside `DesignerInspector` makes it un-mountable outside a leaf, and a pre-existing case mounts it
  bare deliberately; that case failed with *"The asset designer was mounted without a
  DesignerRuntime"*. It also needed a FOURTH file no plan named — seven bare mounts in AD12's panel
  suite.
- **Relocation 2 was backed out after being built.** Folding `guardAssetDuplication` into
  `guardAssetLibrary` needs a `PlanGeometrySidecar` that `composeGuarded` does not have.
- **A new obligation is queued:** usage scope is drawn before a DUPLICATE, which changes nothing,
  while the impactful gesture — editing geometry in the designer — has no scope at all. **AD13
  criterion 3 must not be ticked on the library half alone.**

## Standing constraints

`export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before anything that spawns node. One heavy command
at a time. Never pipe a gate through `tail`. Never bare `git stash`. No Obsidian and no pinned
Chromium here, so `npm run test-build`, every manual case under `docs/tests/`, and every capture
remain impossible — and **the beta may not be labelled ready from this environment** (runbook §10).
