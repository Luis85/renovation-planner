# RESUME — session twenty-one's hand-off, for the manual-walk session

**Rewritten 2026-09-28, replacing session twenty's packet wholesale.** An appended hand-off goes
stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody
marks it ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha.** Confirm it: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 4 --json databaseId,workflowName,headSha,status,conclusion`, then read BOTH workflows (CI and E2E) by run id. This file's parent commit was `7bb94a45b1fb54f58f677932e26d757bc7ca5bda` (Task 8's commit); CI run `36476196439` and E2E run `36476196536` are THAT sha's runs, not necessarily HEAD's — re-check status by run id rather than trusting a status recorded here. Last green at the time of writing was `716fe264685b33303da561c53f3a115cd5327dd0`; everything after it is docs-only. |
| Last green sha | `716fe264685b33303da561c53f3a115cd5327dd0` (Tasks 1–6 plus the AD18-R34 CSS fix, no case-file or MANUAL-PASS edits yet) — CI run `36471871811` and E2E run `36471871858`, both `success`, confirmed by reading the run ids directly |
| `origin/main` | Last merged at `61fbf1588` (PR #238). `git merge-base HEAD origin/main` printed the same sha as origin/main's own tip: the branch is up to date with origin/main (merge-base = its tip, `61fbf1588`) and 515 commits ahead of it (`git rev-list --count origin/main..HEAD` = 515, all of PR #230). Fetch and re-check before assuming that still holds; ask the user before merging |

## The next session's job: walk the 22 human steps

**The manual pass is 22 steps now, across seven cases.** Run the counting command from
[`MANUAL-PASS.md`](MANUAL-PASS.md) yourself — **do not trust the number in this file**; it was 26
at the start of this session and 241 before AD18-R26. This session's own audit
([`MANUAL-PASS-audit-2.md`](MANUAL-PASS-audit-2.md)) read every clause the first audit had left
human or open, against four instruments a probe measured in a real Obsidian 1.13.7 on Windows, and
the user ruled all of what the audit recommended (AD18-R30 to AD18-R34 in
[`DECISIONS.md`](../contracts/DECISIONS.md)).

Below is every step still open, by case, with why a person is the only instrument for it and — for
a step a new test now stands beside — which guard runs there. **A guard is a real test that must
pass the mutation gate; it closes a measurable PART of the clause and the step keeps its human tier
regardless**, because the "reads as"/"legible"/"noticeably" reading itself has no instrument.
`AD18-walk-automation-evidence.md`'s "Round 2" section (below its Round 1 section) carries the
mutation that proves each guard, one row per clause.

| Case | Step | Why a person | Guard beside it |
|---|---|---|---|
| Design an Asset | 7 | the 1000mm scale bar's readability | `assetDesignerLegibility.e2e.ts` (drawn-contrast floor, 3:1, at the layer's own opacity) |
| Design an Asset | 56 | whether the drawing still has "enough" room at a sidebar-width leaf | `assetDesignerGeometry.e2e.ts` (nine-tenths-of-axis floor at a 580px leaf) |
| Design an Asset | 57 | legible at thumbnail size; recognisably not the Washbasin card | `assetDesignerLegibility.e2e.ts` (3:1 stroke contrast) and `assetDesignerPresetPixels.e2e.ts` (pixel-diff floor between the two cards) |
| Design an Asset | 70 | whether a crowded dimension number is READABLE (the clickable half is closed) | `assetDesignerLegibility.e2e.ts` (4.5:1 contrast / host-font-size floor on every label) |
| Design an Asset | 89 | a real Mac's Obsidian taking the ⌘ arm (the label itself is now closed — row corrected from "Cmd+G" to "⌘+G", AD18-R31) | `designerContextMenuMac.test.ts` (vitest, `Platform.isMacOS = true`); no macOS E2E leg exists here |
| Design an Asset | 103 | Object tab layout "reads as" board 01's own compact/grouped look | none — the board is a generated concept image, not a render of this scene |
| Design an Asset | 104 | Add rail / Arrange icons read on sight, without hovering | none — icon-meaning recognition has no instrument |
| Design an Asset | 109 | whether the overall label "reads as detached" from its own dimension line | `assetDesignerGeometry.e2e.ts` (label-to-line and off-drawing geometry floor) |
| Design an Asset | 121 | the comparative judgement itself (Ctrl+Z swallowed vs. Ctrl+G falling through, "checked by eye") | none for this clause — the row's other two clauses are already asserted (A) |
| Take an asset from the library into a plan | 23 | "Edit shape" (library) vs. "Open in designer" (plan) reading as one destination under two names | none — no property any instrument could hold |
| Compose an asset from parts | — | **none left.** Every clause in this case is closed | — |
| Calibrate a sheet and reserve space | 29 | whether the notice reads as belonging to the Clearance block above it, or as a fourth unnamed block. **Re-asked in full under AD18-R33** — the 2026-09-19 walk's answer is not carried forward, since the block has had rounds since | none — no instrument for either clause |
| Calibrate a sheet and reserve space | 32 | whether a screen reader announces the review notice (three of its four clauses — live region, Tab order, computed name — are closed; two of them, the live region and the name, now also read off Chromium's own AX tree) | `assetDesignerAxTree.e2e.ts` (AX-tree read: `live: polite`, review text, button name) |
| Recover an asset design rather than lose it | 6 | whether Obsidian raises the repair unprompted at all ("on its own, before you drag") — the plugin's own bound-and-clear half is closed and cited | none — `recovery.ts`'s `noticeAfterEdit` records `hostMs` and asserts no bound on it; measured 13–18ms and 1–5ms quiet, 15s with no reconcile once under load. This is a host fact, not a `src/` code path |
| Recover an asset design rather than lose it | 8 | whether Obsidian raises the write event unprompted at all ("within about a second") — same shape as step 6 | none — same `hostMs` mechanism |
| Recover an asset design rather than lose it | 20 | would a user know, from what is on screen, that the undo half-succeeded and the vault is inconsistent | none |
| Recover an asset design rather than lose it | 34 | whether the retry button reads as an action belonging to the notice, or as a bar of chrome | `assetDesignerGeometry.e2e.ts` (button width against half the notice/leaf) |
| Two designers on one asset | 10 | whether a person notices the silent drop of a held drag, and whether the leaf alone tells them what to do next | none |
| Browse the asset library | 1 | an empty declared shelf reading as room rather than as clutter | none — jsdom resolves no CSS and no capture shows a themed vault |
| Browse the asset library | 3 | the five outline-state marks distinguishable to an eye at 20px | `assetLibraryMarkPixels.e2e.ts` (pairwise pixel-diff at 20px, 1x and 2x) |
| Browse the asset library | 11 | "no intermediate width at which the panel is unusable" | `assetLibraryWidthSweep.e2e.ts` (strict clip/overflow/overlap sweep from 460px up — see AD18-R34 below) |
| Browse the asset library | 17 | whether the whole note is readable, or it is obvious how to read it | none — the case's own acceptance criterion marks this open by design |
| Browse the asset library | 33 | "noticeably" fainter than a real design's mark (the same-stroke-weight clause is now closed by `assetTileStrokeParity.test.ts`) | `assetLibraryLegibility.e2e.ts` (icon-line contrast below mark-line contrast, both themes) |

**Walk every one of them in a real vault** (`npm run test-build`, into this repository, which is a
vault). Fill each case's own Runs table and Outcome section — **an aggregate "looks good" is not a
filled Runs table**; the 2026-09-19 walk produced exactly that and the matrix had to say so.

## What this session shipped

**Session twenty-one's own second clause audit, then six build tasks and two case-rewrite tasks,
closing what the rulings authorized — narrowly.**

- **The audit** (`MANUAL-PASS-audit-2.md`): two auditors split the 26 steps the first audit had left
  human or open, a probe measured four candidate instruments in a real Obsidian 1.13.7 on Windows
  (Chromium's AX tree over CDP, poll-only; Electron's native-menu hooks; clipped screenshots
  decoded and diffed in the renderer; a macOS leg's package support, read only), and an independent
  review ran nine mutations (seven red, two green by design, to demonstrate an open gap). It added a
  bucket, **P** — proxy-automatable: a measurement settles a named part of a clause, never the
  clause as a person reads it. Recount: 56 clauses, 27 A, 4 B, 11 C, 2 D, 12 P.
- **Rulings AD18-R30 to AD18-R33** (batched, all as the audit recommended): build the 12 P clauses
  as guards, with Design 88b's AX-tree clause DISCHARGING outright (no live ancestor anywhere in the
  document IS the clause, not a proxy for it); a vitest for Design 89's ⌘ label with no macOS E2E
  leg; Design 92 reworded from an unfalsifiable disjunct to "nothing opens" and built; Recover 2 and
  Browse 31 counted as discharged (each is a HOST-PIN — asserted today by a named e2e case, with no
  `src/` mutation able to redden it on this host version) and retagged `e2e`; Recover 6/8's host
  timing stays a recorded measurement, not an assertion; Calibrate 29 re-asked in full.
- **AD18-R34** (2026-09-28, a day later): Task 5's Browse 11 width-sweep guard, unmutated, went red
  on real Linux CI (E2E run `36345605529`, 1.13.7 and latest, desktop shard 1/2) at a 568px library container that
  Windows never reaches — the Create-your-own card's `New asset` button overhung the rail. Ruled:
  fix the CSS, not the guard. `styles/asset-library-grid.css`'s create-card rules now wrap the body
  and the button before either can overhang; the guard's one prior tolerance for that fault is gone,
  so it is strict with nothing exempt.
- **Six build tasks**, each independently reviewed (zero to three fix rounds apiece): Task 1
  (`9a89cb4e2`) — the two suite-only D gaps, Design 89's macOS label and Browse 33's stroke parity.
  Task 2 (`f25503971`, fix `53aedcbae`) — the AX-tree reads for Design 88b (discharge) and Calibrate
  32 (guard), new `tests/e2e/axTree.ts`. Task 3 (`2b9332b9e`, `f88169e1a`) — Design 92's
  "nothing opens" case, new `tests/e2e/assetDesignerNoMenu.e2e.ts`. Task 4 (`ef8fb0c04`, fix
  `32483cd11`) — contrast/size legibility guards for Design 7, 57, 70 and Browse 33. Task 5
  (`1871ad804`, fix rounds `97893193a` and `eca317ae6`) — geometry guards for Design 109, 56,
  Recover 34 and Browse 11, plus the AD18-R34 CSS fix. Task 6 (`aef50af85`, fix rounds `f266d3f9d`
  and `716fe2646`) — pixel-diff guards for Design 57 and Browse 3, new `tests/e2e/pixels.ts`.
- **The case rewrites** (Task 7a `66b625646`, Task 7b `a2b747b24`): Design an Asset moved from 11 to
  9 human steps (88b and 92 retag `e2e`; 7, 56, 57, 70, 109 gain guard citations and keep their tier;
  89's row corrected to ⌘+G); the other five cases with human steps moved from 15 to 13 combined
  (Recover 2 and Browse 31 retag `e2e` under the host-pin ruling; Calibrate 32, Recover 34, Browse 3,
  11 and 33 gain guard citations).
- **Task 8** (`7bb94a45b`): this session's own MANUAL-PASS rewrite and the evidence file's "Round 2"
  section, superseded now by this file and the table above — read `AD18-walk-automation-evidence.md`
  directly for the per-clause mutation table if a citation above needs the underlying red/green.

**Read the "two discharged, two host-pin, the rest guards" claim narrowly.** Design 88b and Design
92 are the only two steps that left the human count this round on the strength of a built test alone
(both DISCHARGE rulings). Recover 2 and Browse 31 left it too, but not because a test settles the
human judgement — each is a HOST-PIN: the clause was already asserted by an existing e2e case, and
the audit could find no `src/` mutation able to turn it red on Obsidian 1.13.7, so the mutation gate
itself cannot keep it open. Every other new **e2e** test is a guard: it narrows what a walker has
to judge by eye, but the step it sits beside stays on the list above. Task 1's two vitests are the
exception: each discharges a whole **D** clause without moving a step, because that step keeps its
tier on a different clause (Design 89's B clause, Browse 33's remaining P and C clauses).

## Known behaviour: the walk must NOT file these as new defects

Carried forward from session twenty (nothing below was touched this round except the one addition at
the end), each pinned by a test that turns red the day the behaviour changes:

- **Obsidian's graph view takes Ctrl+G in a default vault**, so Group never runs by that chord until
  the user unbinds `graph:open` (Compose 43, 49, 51; Design 90a, 90b, 95).
- **Focus after Group from a Parts row stays on the row**, not the canvas (Compose 48).
- **A duplicated or undone hidden part comes back shown** (Compose 7c).
- **Edit dimensions on a traced, uncalibrated asset retypes its outline** and leaves a pending
  clearance unscaled, with no review notice — and hidden, if it was hidden (Calibrate 36 and 36a).
- **The asset's Edit dimensions drops a rounded rectangle's Corner radius row** (Design 102).
- **A pointer click on the canvas draws no focus ring**; Tab does (Design 105).
- **One trace point placed does not block Ctrl+Z** (Design 120).
- **The basin's Width figure sits under the clearance offset** and is reached by keyboard (Design
  125).
- **The Add rail is one column at the default 680px leaf** (Design 76).
- **A drag held across a PEER leaf's write is dropped silently**: plain "Saved", no badge, no toast
  (Two designers 8).
- **Dragging a designer tab into a split MOVES it**; only the tab menu's Split right/down duplicate
  it (Two designers 1).
- **The library's category vocabulary is closed; the funnel shows until a tile is selected; a closed
  and reopened library forgets Grid and the category; the narrow sidebar pushes the grid aside rather
  than overlaying it** (Browse 22, 27, 30, 26). The category icon is centred on the tile (Browse 32).
- **Obsidian reconciles an external `.rpgeo` edit on its own**, typically within a second, and heals a
  repaired one about half a second later — so a "press Try again after repairing" exists only in the
  race before the host reacts (Recover 37).
- Carried over further: a typed width on a curved part can move its depth with no warning; a drag
  past a curved part's reach stops at the nearest size silently; a miss of 0.5mm does not warn; a
  hidden clearance re-shows after any read-back that changes it; a pointer resting in the canvas's
  40px edge band pans the camera; Ctrl+Z does nothing in a focused `<select>` or on the corner-radius
  slider; Ctrl+Z/Ctrl+Y are claimed even with nothing to undo.
- **New this round (AD18-R34): a wrapped Create-your-own card at the narrowest library widths is the
  fix, not a defect.** Below about 572px (Windows) / 568px (Linux) the card's body drops under its
  icon and the `New asset` button wraps to two lines instead of clipping — that wrapped state has not
  itself been looked at in a real vault, per Task 5's own report, so file a NEW defect only if the
  button still overhangs or clips there, not for the wrap itself.

## Recorded, not fixed

Carried forward, still open:

- `designerParity.ts`'s `hotkeysOf` lacks the chord normalisation `boundTo` has (harmless today).
- Calibrate 21l's canvas-half assertion was never watched red (the disk half gates the clause).
- Design 120's realistic order (Escape, release, Ctrl+Z) is not driven.
- **A note for the next reader:** vitest's `expect.any(Object)` accepts `null`
  (`typeof null === 'object'`); pair it with `not.toBeNull()` when null must fail.
- One earlier unexplained red: `assetDesigner.e2e.ts` *keeps every shape…* failed once in three runs
  under an unrelated mutation, in an earlier round. Watch it as a possible flake.
- Still open from earlier rounds: `unrecoveredWrite` is drawn on no designer surface; the browser
  harness never calls `activateNotices()`; `arcArc`'s residual cusp class; the held-drag ceiling.

**This round's own items** (`round7-minors.md`, reconciled by the final review dispatched on
`cecb332b7..7bb94a45b`: two items were fixed in that review's fix wave and two were found not to be
defects, both dropped from this list; the five below are the ones the review recorded rather than
fixed):

- Task 2's clock hook is duplicated between `assetDesignerAxTree.e2e.ts` and the parity case, below
  fallow's duplication threshold.
- `styles/asset-library-grid.css`'s create-card action rule carries a redundant `max-width: 100%`
  (frees a line at the partial's 399/400-line cap).
- The wrapped create-card state (icon on its own row, two-line button) has never been looked at in a
  vault — the item folded into "Known behaviour" above rather than left only here.
- An optional "button stays within its card" relation would widen the AD18-R34 revert mutation's red
  band on Windows; not built.
- Task 6's pixel-diff headroom is thin at 1x: the weakest pair measured 0.268 against a 0.1 floor.

## Machine lessons

Carried forward, still true:

- **`npm run test:e2e` runs locally** on this Windows machine (about two minutes per file, one
  Obsidian at a time). **This worktree has its own `node_modules`** — an install here touches no
  other checkout.
- **Windows and Linux differ, and CI is Linux.** Fonts are wider there and timings differ: never pin
  a pixel width, a wrap, or a host timing measured on one platform. `herbstluftwm` must keep its
  floating rule, or every sized case fails.
- **Parallel agents need two lock files** in the gitignored ledger (`mutation.lock`, `e2e.lock`): an
  e2e build compiles `src/`, so a neighbour's temporary mutation lands in it. Take a lock only when
  it is absent, wait with one bounded command, never a background loop.
- **An account usage limit stopped every running agent at once** in an earlier round; agents resumed
  with their context intact. Stagger dispatches.
- Only fallow's `Failed:` line and its `N above threshold` gate. A lone red Windows leg on
  `tests/gates/network-boundary.test.ts` is a known flake: `gh run rerun <id> --failed`.
- **A known E2E flake:** `assetHandoffMore.e2e.ts` *shows no plan scope until Duplicate…* timed out
  once in its setup on the 1.13.7 desktop shard 2/2, on a docs-only commit (E2E run `36273510691`,
  attempt 1), and passed on the re-run. Re-run once; twice in a row is a defect to investigate.

**New this round:**

- **An auto-mode classifier outage on 2026-09-28** blocked Task 5's fix round 3 (its strict-guard
  commit and probe lines sat uncommitted) and Task 6's fix round 2 (not yet applied): agents stop
  after ten no-verdicts and need a `SendMessage` to resume. Both fix rounds resumed once the user
  said to continue ("weiter") and completed normally.
- **CI's xvfb legs run at `devicePixelRatio` 1; this Windows machine runs at 2.** Task 6's pixel
  guards read both explicitly, via CDP `Emulation.setDeviceMetricsOverride`, regardless of the host's
  own ratio — E2E run `36471871858` confirmed `nativeDevicePixelRatio: 1` in all four Linux pixel
  evidence files. Do not assume a pixel measurement made on this machine transfers to CI without
  reading both ratios.
- **A Windows window resize skips widths that a Linux one reaches.** Above 35rem it jumps from 556px
  to 572px, and above 45rem from 700px to 728px, so a width sweep run only on Windows misses whatever
  sits strictly between those pairs — which is exactly where AD18-R34's defect lived (568px, Linux
  only). Drive a sweep at widths reachable on both platforms, or add a probe that forces the
  in-between width directly rather than resizing a window into it.
- **A new E2E flake:** `assetDesignerBasics.e2e.ts` *prefixes the empty-catalogue notice…* read the
  notice text as `''` once, on the 1.13.7 desktop shard 1/2 (E2E run `36340603832`, attempt 1), on a
  push with no `src/` or `styles/` change. Passed clean on the re-run (attempt 2). Re-run once; twice
  in a row is a defect to investigate.

## The rule this session paid for

**A task brief's own premises are claims too, and this round found four of them false at the point
of building — plus a fifth false claim in one of the build's own metrics, not a brief's premise.**

- **Task 2's brief called Design 88b's second moment "the midnight rollover".** The step's own row
  asks for the visible text to advance to "Saved N min ago" — the minute tick, not midnight. Midnight
  is a different step (88c), already pinned elsewhere. The task built the clause the row actually
  states rather than the one the brief described.
- **Task 5's brief named a mutation target, `RULER_SIZE_PX`, that does not exist in `src/`.** The
  ruler strip's thickness is a CSS custom property, `--rp-designer-ruler-size`; a TypeScript constant
  in the same file, `RULER_PX`, only restates it. The task mutated the real lever instead.
  - **The same task's brief also mis-described Design 109's own mechanism.** It read the row as "the
    label is no farther from its own dimension line than the label's own height" and expected a
    mutation skipping the label's slide-along-the-line step to break that. It does not: the line is
    drawn THROUGH the placed label in every case, mutated or not, so the label-to-line distance is 0
    by construction — that relation cannot go red. What the same mutation does break is the row's
    other clause, "off the drawing" (AD18-R14's own floor), and that is what the built test asserts.
- **Task 3's brief asked for right-click points "clear of every part".** On the toilet preset the
  anchor dot and the facing arrow are drawn over the bowl, and the hit order resolves a press there
  in the bowl's favour by design — neither point is actually clear of a part. Only the footprint
  outline point is. The case row (Task 7a) was corrected not to promise "clear of every part" for the
  points that are not.
- **Task 6's first pixel metric passed on this Windows machine and failed on real Linux CI.** The
  Browse 3 mark-pixel guard, on a clean, unmutated tree, went red on E2E run `36345605529` (1.13.7,
  shard 1/2) with a control reading `[0, 26, 0]` where zero was expected. On this machine, at
  `devicePixelRatio` 2, two captured rows always land on whole pixels; at `devicePixelRatio` 1 on
  Linux they did not, and a sub-pixel row-position phase difference alone read as two different
  drawings. Fixed by staging every capture at one fixed, whole-pixel position before reading it,
  rather than trusting wherever the row happened to lay out.

Each was caught only because the implementing task re-measured the brief's own claim against `src/`
before building the test, rather than building what the brief described.
