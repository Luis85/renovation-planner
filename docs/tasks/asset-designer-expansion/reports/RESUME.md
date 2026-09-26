# RESUME — session twenty's hand-off, for the manual-walk session

**Rewritten 2026-09-26, replacing session nineteen's packet wholesale.** An appended hand-off goes
stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody marks it
ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha.** Confirm it: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 2 --json databaseId,workflowName,headSha,status`, then read BOTH workflows (CI and E2E) by run id |
| Last green sha | Named, with its CI and E2E run ids, in the delivery note at the end of AD18-R26 to R29 in [`DECISIONS.md`](../contracts/DECISIONS.md) |
| `origin/main` | Last merged at `61fbf1588` (PR #238) as `305d70ce2` on 2026-09-25. Fetch and check `git merge-base HEAD origin/main` before assuming nothing has moved; ask the user before merging |

## The next session's job: walk the 26 human steps

**The manual pass is 26 steps now, not 241.** Session twenty audited every clause of the walk
([`MANUAL-PASS-audit.md`](MANUAL-PASS-audit.md)), built tests for every clause a test could settle, and
retagged every step whose clauses are all asserted (`e2e` or `suite`, AD18-R28) so the index's counting
command no longer counts it. Run that command from [`MANUAL-PASS.md`](MANUAL-PASS.md); it should print
11 / 1 / 0 / 2 / 5 / 1 / 6. **Do not trust this line; run the command.**

What is left, by case, and why a person is the only instrument for it:

| Case | Steps | Why a person |
|---|---|---|
| Design an Asset | 7, 56, 57, 70, 88b, 89, 92, 103, 104, 109, 121 | legibility and "reads as" (7's scale bar, 57, 70's numbers, 103, 104, 109), a screen reader (88b), Electron's native menu (92), stated judgements (56, 121), and 89's Cmd+G, which needs a macOS leg nobody runs |
| Take an asset into a plan | 23 | judgement (how the two door labels read side by side) |
| Calibrate a sheet | 29, 32 | judgement (29); a screen reader announcing the notice (32 — its name, live region and Tab reachability are automated) |
| Recover an asset design | 2, 6, 8, 20, 34 | judgements (20, 34); host clauses no test can pin honestly: 2's canvas and selection after a read-only chmod (no `src/` lever makes it fail), and 6/8's "Obsidian raises the change unprompted" (the host's timing is recorded, not asserted — the plugin's half is) |
| Two designers | 10 | judgement (would you notice the silent failure) |
| Browse the library | 1, 3, 11, 17, 31, 33 | legibility at 20 px and "reads as" (1, 3, 33), "unusable" at any width (11), a stated open judgement (17), and 31, which cannot fail until Obsidian records leaf history for the library view |

**Walk every one of them in a real vault** (`npm run test-build`, into this repository, which is a
vault), and fill each case's own Runs table and Outcome section. An aggregate "looks good" is not a
filled Runs table.

## What this session shipped

- **E2E runs on Linux again.** It had been red since W24-A: herbstluftwm tiles, so the window ignored
  every resize. A floating rule fixed 17 of 21; the other four were Windows-only pins and one real
  defect (the Placement point group's `Custom` split `Custo`/`m` in Linux's wider font — the grid now
  wraps the group, not the word). The desktop legs are sharded in two (AD18-R29).
- **The audit** — eight read-only auditors, one independent review, 29 mutations (7 stayed green, each
  a row that had read as covered). 177 of 241 steps were fully discharged before anything was built.
- **Eight build tasks**, each independently reviewed, closing the 36 host and 37 suite clauses the
  audit found open (AD18-R26): new e2e files `assetDesignerRecoveryWalk*`, `assetDesignerWalk{Host,
  Reload,Keys}`, `assetDesignerInput`, `assetLibraryWalk`, `twoDesignersDrag`, and new vitest files
  across `tests/presentation/`, `tests/application/` and `tests/plugin/`. **Every clause built this
  round went through the mutation gate**; the evidence is committed in
  [`AD18-walk-automation-evidence.md`](AD18-walk-automation-evidence.md).
- **The seven case files rewritten** (AD18-R27, R28): 215 steps retagged, the contradicted rows
  rewritten to what the build does, the audit's over-claims and omissions corrected. Four reviewers
  re-read every retag against its test body and found none wrong.

**Read the gating claim narrowly.** Clauses built this round were each watched red under a mutation of
exactly that clause. Clauses already discharged before this round were checked by reading the test
body; the audit mutated a sample of 29 of them and 7 did not hold (all since corrected). A retagged
step is one whose every clause a named test asserts — not one whose every clause was mutation-gated.

## Known behaviour: the walk must NOT file these as new defects

Every item here is pinned by a test that turns red the day the behaviour changes (AD18-R27 rewrote the
case rows to say so). They are recorded, not fixed:

- **Obsidian's graph view takes Ctrl+G in a default vault**, so Group never runs by that chord until the
  user unbinds `graph:open` (Compose 43, 49, 51; Design 90a, 90b, 95).
- **Focus after Group from a Parts row stays on the row**, not the canvas (Compose 48).
- **A duplicated or undone hidden part comes back shown** (Compose 7c).
- **Edit dimensions on a traced, uncalibrated asset retypes its outline** and leaves a pending
  clearance unscaled and hidden (Calibrate 36a).
- **The asset's Edit dimensions drops a rounded rectangle's Corner radius row** (Design 102).
- **A pointer click on the canvas draws no focus ring**; Tab does (Design 105).
- **One trace point placed does not block Ctrl+Z** (Design 120).
- **The basin's Width figure sits under the clearance offset** and is reached by keyboard (Design 125).
- **The Add rail is one column at the default 680 px leaf** (Design 76).
- **A drag held across a PEER leaf's write is dropped silently**: plain "Saved", no badge, no toast
  (Two designers 8).
- **Dragging a designer tab into a split MOVES it**; only the tab menu's Split right/down duplicate it
  (Two designers 1).
- **The library's category vocabulary is closed; the funnel shows until a tile is selected; a closed
  and reopened library forgets Grid and the category; the narrow sidebar pushes the grid aside rather
  than overlaying it** (Browse 22, 27, 30, 26). The category icon is centred on the tile (Browse 32).
- **Obsidian reconciles an external `.rpgeo` edit on its own**, typically within a second, and heals a
  repaired one about half a second later — so a "press Try again after repairing" exists only in the
  race before the host reacts (Recover 37).
- Carried over and still true: a typed width on a curved part can move its depth with no warning; a
  drag past a curved part's reach stops at the nearest size silently; a miss of exactly 0.5 mm does not
  warn; a hidden clearance re-shows after any read-back that changes it; a pointer resting in the
  canvas's 40 px edge band pans the camera; Ctrl+Z does nothing in a focused `<select>` or on the
  corner-radius slider; Ctrl+Z/Ctrl+Y are claimed even with nothing to undo.

## Recorded, not fixed

- **Calibrate step 36 (a `suite` row) now contradicts the rewritten 36a in the same file**: it says the
  clearance scales with Edit dimensions on a traced, uncalibrated asset, which 36a's pinning test shows it
  does not. It sat outside the audited tiers. It needs a ruling or an AD18-R27-style rewrite.
- **Test-hygiene items from the whole-round review** (`final-review-round6.md` in the gitignored ledger
  lists them all): `assetDesignerWalkReload.e2e.ts`'s toggle loop is shaped to dodge a fallow clone and
  wants a shared `togglePlugin` helper; test-to-test clones (`pressRow`/`showClearance`, the use-plan
  picker rig) belong in `tests/helpers/`; the active-designer selector and `FIXTURE_PNG` are copied across
  e2e files; two `assetTileMarkEdge.test.ts` cases duplicate `assetTileStyles.test.ts`; a `?? '{}'`
  calibration check in the reload walk passes on a missing key; round-transient prose ("owned by a
  different task this round", the workflow's "this round adds up to ~36 cases") should be reworded.
- **One unexplained red**: `assetDesigner.e2e.ts` *keeps every shape…* failed once in three runs under an
  unrelated mutation. Watch it as a possible flake.
- Still open from earlier rounds: `unrecoveredWrite` is drawn on no designer surface; the browser
  harness never calls `activateNotices()`; `arcArc`'s residual cusp class; the held-drag ceiling.

## CI, e2e, and this machine

- **`npm run test:e2e` runs locally** on this Windows machine (about two minutes per file, one Obsidian
  at a time). **This worktree has its own `node_modules`** — an install here touches no other checkout.
- **Windows and Linux differ, and CI is Linux.** Fonts are wider there and timings differ: never pin a
  pixel width, a wrap, or a host timing measured on one platform. `herbstluftwm` must keep its floating
  rule, or every sized case fails.
- **Parallel agents need two lock files** in the gitignored ledger (`mutation.lock`, `e2e.lock`): an e2e
  build compiles `src/`, so a neighbour's temporary mutation lands in it. Two runs were lost to exactly
  that before the locks existed. Waits are single bounded commands, never background loops.
- **An account usage limit stopped every running agent at once** mid-round; agents resumed with their
  context intact. Stagger dispatches.
- Only fallow's `Failed:` line and its `N above threshold` gate. A lone red Windows leg on
  `tests/gates/network-boundary.test.ts` is a known flake: `gh run rerun <id> --failed`.
- **A second known flake, in E2E:** `assetHandoffMore.e2e.ts` *shows no plan scope until Duplicate…*
  timed out once in its setup (the armed Plan Editor banner never appeared) on the 1.13.7 desktop
  shard 2/2, on a docs-only commit (E2E run 36273510691, attempt 1), and passed on the re-run. Every
  earlier run this session passed it. Re-run once; twice in a row is a defect to investigate.
- Seven shell loops from ANOTHER session were polling `/d/tmp-rp/s21-final2/m2.log` on this machine and
  were left alone; that log had stopped changing.

## The rule this session paid for

**A hand-off's numbers are claims too, including the ones this session wrote about itself.** The pasted
brief said no e2e case opened the designer (W24-A had built 144); the audit's own first pass claimed zero
over-claims in two tables that had seven between them; a task brief's verification command (`vitest list
--shard`) could not see sharding; and the whole-round review had to cut this session's own summary from
"about 200 clauses, each gated" to what was true. Each was caught only because somebody re-read the
source instead of the summary.
