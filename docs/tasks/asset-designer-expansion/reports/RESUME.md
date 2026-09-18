# RESUME — session four's hand-off

**Rewritten 2026-09-18, replacing session two's packet wholesale.** That version predated three
integrations and two rulings and was stale in a way a reader could not detect, which is why this
file is rewritten rather than appended to.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
**Nothing has been pushed, merged to `main`, or tagged.** `main` is untouched.

## Where the work stands

**`HEAD` is the last commit on this branch** — deliberately not named here, because the commit
that records a session's gate run cannot contain its own SHA, and the first version of this line
went stale the moment it was written. `git log --oneline` is the list. Ten commits this session:

| SHA | What |
|---|---|
| `23930a0de` | AD13 duplicate half integrated, with the design-spec §8 Amendment 6 and the Amendment 2 correction in the same commit |
| `cde0e8444` | ADQ integrated (background opacity + reference deletion), carrying its one deliberate red |
| `c64acda60` | The wire — that red turned green, and `removeBackground` made required |
| `644b9687f` | AD13 ICR 3 — the `Use in plan` button's class and its rules |
| `66710b1eb` | AD13 ICR 4 — `open-asset-library`'s mobile gate |
| `593a38b55` | `listPlansUsingAsset` relocated into the query bundle |
| `fd9bab2e3` | Ledger, integration queue, both AD13 report halves, the ADQ report, wave-5 leases, this file |
| `f2a09d940` | The two `analyze` findings this wave introduced, cleared by factoring |
| `dba8a71d0` | The unused imports that extraction left behind |
| `21e39e269` | This file's gate section, rewritten once all six were green |

**AD13 and ADQ are both `integrated` in `state.json`, and neither is `verified`.** AD14 is
`planned` and unblocked. AD15 and AD16 remain `blocked` and were not touched.

## Gates — all six green, and how to read the coverage leg

**All six gates pass on `4521f6acf`, the wave-5 integration SHA** — `build`,
`oxlint --deny-warnings`, `eslint . --max-warnings 0`, `vue-tsc -noEmit`, `test:coverage` and
`analyze`, every one exit 0. **1050 test files, 11591 tests, 1 skipped, ZERO failures**, at
**99.22 / 98.04 / 99.26 / 99.67** against floors 99/98/99/98, in 23.5 minutes. `analyze` reports
0 dead files, 0 dead exports of 2392, no private type leaks, no duplication and 0 complexity
findings above threshold.

The paragraphs below describe an EARLIER SHA and are kept because the contention lesson in them is
the durable part, not the SHA. `analyze` reports **0 dead files,
0 dead exports of 2390, no private type leaks, no duplication and 0 complexity findings above
threshold**.

**`test:coverage` exited 0 on `f2a09d940`** — the commit one before HEAD, which differs only by
five unused imports — with **1046 of 1046 test files passing, 11552 tests, 0 failures**, in
**20.3 minutes**, at **99.22 / 98.05 / 99.26 / 99.67** against floors 99/98/99/98.

**On `dba8a71d0` the same leg exited 1, and it is contention rather than a red tree — proven, not
assumed.** 17 failures, **all timeouts, zero assertions**, over a 43-minute run. All 13 named files
were re-run alone on a quiet box and **all 13 passed, 688 tests, exit 0**. The floors were met even
in the degraded run (99.21 / 98.03 / 99.24 / 99.67). The two bad runs this session produced
DISJOINT failure sets, which is the signature CLAUDE.md already records for this.

**Why the box behaves this way, because it will happen again.** It has **7.8 GB of RAM** and another
Claude session works concurrently in the `renovation-planner-beta-handoff-e80bb5` worktree. With
both running, free RAM fell to **0.1 GB** and the machine paged rather than computed: one test case
took **20.5 minutes**, and the first coverage attempt ran **7h50m** for 192 of 1043 files before
being killed — a ~43-hour projection. Alone, the same suite is 20 minutes.

**Check the box before starting anything heavy:**
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`. Zero node processes means the window is
open. Two CLAUDE.md figures are stale and were re-measured here: **the suite is 1046 test files**,
not 362/459, and `test:coverage` is 20 minutes at best on this machine rather than ~200 s.

**One process lesson worth carrying.** `scripts/lint-edited.mjs` hooks `PostToolUse` on Edit and
Write only, so a refactor done with `sed` or a python script is INVISIBLE to it. Five unused imports
survived the `loadAssetEntity` extraction that way and were caught by the full gate instead of by
the cheap loop that exists to catch them. Prefer the editor tools for source edits, or run
`npx oxlint <files>` by hand after a scripted one.

## Wave 5 is DISPATCHED, REVIEWED and INTEGRATED — the package's last two cards

Both cards were cut from `044e11f52`, a commit that CONTAINS their lease rows, which is the fix for
wave 4's lease-timing failure. Verified disjoint mechanically before either was merged: zero files
in common.

- **AD13 hand-off** — candidate `2e228e4d3`, integrated at **`4521f6acf`** together with ICR 1-H.
  Review returned REQUEST CHANGES with nine findings; a fix round addressed all nine.
  **AD13 acceptance criterion 1 is now MET end to end.**
- **AD14** — candidate `55cd03dee`, integrated at **`7908969d3`** with its change request applied in
  the same commit. Review returned APPROVE FOR INTEGRATION plus six accuracy findings, all fixed.

**Every wave-4 and wave-5 lease is RELEASED.** `.worktrees/ad13c` and `.worktrees/ad14` hold their
branches and can be reused for the next wave the way these two reused wave-4 checkouts.

## What is left, and none of it is code this environment can close

1. **AD13 criterion 3 must NOT be ticked on the library half alone.** Usage scope is drawn before a
   DUPLICATE, which provably changes nothing for the plans it lists — the panel's own copy says the
   original is kept. The gesture that DOES change them is editing an asset's geometry, in the
   designer, where no scope precedes it. Closing it needs either the scope read reaching the
   designer (`ListPlansUsingAsset` now lives in `AssetLibraryQueryServices`, so that is a second
   consumer rather than a second query) or a ruling that a geometry edit needs no scope because undo
   covers it. That ruling has to be MADE: the two surfaces currently answer one question differently
   by accident.
2. **AD15 and AD16 stay `blocked`**, and nothing in this session changed that. Runbook §10: no
   Obsidian and no pinned Chromium, so the beta may not be labelled ready from here.
3. **Nothing drawn by any card in this package has been photographed or walked.** The sharpest
   single exposure is AD14's new clearance-review block: a second bordered section directly beneath
   the clearance helper's, no heading of its own, carrying the longest sentence in the designer
   inspector — and invisible to every `accessibility*.test.ts`, because it draws nothing unless the
   flag is set. A live-vault pass and a 460 px capture should start there.
4. `npm audit` — its own CI job, not run here.

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
