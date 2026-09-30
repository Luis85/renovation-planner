# RESUME — hand-off after the open-issues round, for the next session

**Rewritten 2026-10-01, replacing the UI critique round's packet wholesale.** An appended hand-off
goes stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody marks
it ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha reliably.** Confirm it: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 6 --json databaseId,workflowName,headSha,status,conclusion`. The last code commit before this file is `4f1b94a1d` (the round's final-review fix wave); the controller pushes this file together with it. **No CI result is claimed here for `3eb44ac90` or anything after it**: its runs (CI `36784857408`, E2E `36784857535`) were still in progress at hand-off time. Re-check before trusting anything recorded here. |
| Last fully green (CI **and** E2E) | `b35623687` (CI `36767289396`, E2E `36767289281`, 2026-09-30) — the first fully green pair since the UI critique round began. It confirms the empty-catalogue notice fix `9388df519` in CI. Everything after it (this round's Tasks 1-5 and 8, and the fix wave) is what no CI result in this file covers. |
| `origin/main` | Last merged at `61fbf1588` (PR #238). `git merge-base HEAD origin/main` printed that same sha and `git rev-list --count origin/main..HEAD` printed **564** at `4f1b94a1d` (2026-10-01). Fetch and re-check before assuming that still holds; ask the user before merging. |

## What the open-issues round did

Base `b35623687`. It took the items the previous hand-off left recorded-not-fixed and did them, each
independently reviewed, then a final-review fix wave. Its ledger is `.superpowers/sdd/progress.md`
(after "Open-issues round") and the per-task reports are `.superpowers/sdd/oi-task-*-report.md` and
`oi-fixwave-report.md` (all gitignored). What landed, oldest first:

- **AD18-R35 built (Task 1, `21f4c1856`, `2e27fdd3d`).** A new human-tier value, **`ruled`**, for a
  step a ruling has retired; five rows retagged to it; the count moved **22 to 17**. Two designers
  steps 9, 10 and 12 were rewritten or corrected under AD18-R27 (their old premise was false). Detail
  below.
- **A typed clearance reach that misses now warns in a reach's own words (Task 2, `84e902b78`).**
  `designer.typed-reach.landed-{side}` replaces the generic size-landed sentence for a reach. The
  brief's premise that an `offset-*` accessible name was the wrong one was false: the `reach-*` names
  already shipped in `649eb4489`.
- **Harness: library tiles and the inspector read one shape (Task 8, `361205341`).** Also a
  `&select=a,b` designer knob and four new fixed shots: `asset-designer-select-multiple` (+ light) and
  `asset-library-selected-details` (+ dark). Task 6's two reported "defects" in the harness were false
  premises.
- **`hotkeysOf` and `boundTo` share one `spellKey` spelling (Task 4, `347350403`).**
- **Every one of the 18 `FormDialog` forms now ends with `FormSubmitRow` (Task 3, `a8e2b4517`)**, held
  by an AST gate `dialogFormSubmitRow.test.ts` and an e2e `dialogFooter` case. The redundant body rule
  in `styles/editor-reference-viewport.css` was deleted. The brief's `StructureTaskForm` premise was
  false: those are task-bar forms.
- **Design 120's realistic order is driven, and Calibrate 21l's canvas half was watched red (Task 5,
  `3eb44ac90`)** — the e2e case is in `assetDesignerFollowupsHistory.e2e.ts`; the canvas half went red
  in jsdom in `designerHiddenClearanceWalk.test.ts` (line 113).
- **The final-review fix wave (`4f1b94a1d`).**

### Deliberate visible changes a walker must not file as defects (Task 3)

- **Every dialog submit is now primary (`mod-cta`)**, including `PlanningForm`'s, which used to be
  primary only for a new photo.
- **A bare full-width submit is now a right-aligned button on the one footer row.**
- **`ReferenceSetupForm` reads Cancel, Back, Next.**
- **Tab order in a dialog ends Cancel, then submit.**

## The next session's job: walk the 17 human steps

Run the counting command from [`MANUAL-PASS.md`](MANUAL-PASS.md) yourself — do not trust the number in
this file. **I ran it on 2026-10-01 at `4f1b94a1d` and it printed 17**, per case 7 / 0 / 0 / 2 / 3 / 1 / 4
(Design an Asset, Take an asset from the library into a plan, Compose an asset from parts, Calibrate a
sheet and reserve space, Recover an asset design rather than lose it, Two designers on one asset,
Browse the asset library), summing to 17. That is the figure `DECISIONS.md` predicted for AD18-R35.

**The five `ruled` rows leave the walk (AD18-R35), each with a re-open trigger recorded in its own
row and in `DECISIONS.md`:** Design 89 (Windows cannot take the Mac clause), Design 121 (the third
clause), Take 23 (the two intended names), Browse 17 (the shipped single-line Notes input) and Recover
20 (the recorded "no, a known gap"). This lists exactly those five:

```bash
grep -nE '^\| [0-9]+[a-z]? \| `ruled` \|' docs/tests/cases/*.md
```

A walker does not walk them and does not file them as open; a re-open trigger firing is a `DECISIONS.md`
question, not a walk step.

Below is every step still open, by case, rebuilt from the case files' own human-tier rows
(`obsidian`, `desktop`, `judgement`). **A guard is a real test that must pass the mutation gate; it
closes a measurable PART of the clause and the step keeps its human tier regardless**, because the
"reads as"/"legible"/"noticeably" reading itself has no instrument.

| Case | Step | Why a person | Guard beside it |
|---|---|---|---|
| Design an Asset | 7 | the 1000mm scale bar's readability | `assetDesignerLegibility.e2e.ts` (drawn-contrast floor, 3:1, at the layer's own opacity) |
| Design an Asset | 56 | whether the drawing still has "enough" room at a sidebar-width leaf | `assetDesignerGeometry.e2e.ts` (nine-tenths-of-axis floor at a 580px leaf) |
| Design an Asset | 57 | legible at thumbnail size; recognisably not the Washbasin card | `assetDesignerLegibility.e2e.ts` (3:1 stroke contrast) and `assetDesignerPresetPixels.e2e.ts` (pixel-diff floor between the two cards) |
| Design an Asset | 70 | whether a crowded dimension number is READABLE (the clickable half is closed) | `assetDesignerLegibility.e2e.ts` (4.5:1 contrast / host-font-size floor on every label, polling for **23** labels, not 26 — AD18-R40 dropped the clearance's three flush sides) |
| Design an Asset | 103 | Object tab layout "reads as" board 01's own compact/grouped look | none — the board is a generated concept image, not a render of this scene |
| Design an Asset | 104 | Add rail / Arrange icons read on sight, without hovering | none — icon-meaning recognition has no instrument |
| Design an Asset | 109 | whether the overall label "reads as detached" from its own dimension line | `assetDesignerGeometry.e2e.ts` (label-to-line and off-drawing geometry floor) |
| Take an asset from the library into a plan | — | **none left** (step 23 is `ruled`) | — |
| Compose an asset from parts | — | **none left.** Every clause in this case is closed | — |
| Calibrate a sheet and reserve space | 29 | whether the notice reads as belonging to the Clearance block above it, or as a fourth unnamed block. Re-asked in full under AD18-R33 — the 2026-09-19 walk's answer is not carried forward | none — no instrument for either clause |
| Calibrate a sheet and reserve space | 32 | whether a screen reader announces the review notice (three of its four clauses — live region, Tab order, computed name — are closed) | `assetDesignerAxTree.e2e.ts` (AX-tree read: `live: polite`, review text, button name) |
| Recover an asset design rather than lose it | 6 | whether Obsidian raises the repair unprompted at all ("on its own, before you drag") — the plugin's own bound-and-clear half is closed and cited | none — `recovery.ts`'s `noticeAfterEdit` records `hostMs` and asserts no bound on it; a host fact, not a `src/` code path |
| Recover an asset design rather than lose it | 8 | whether Obsidian raises the write event unprompted at all ("within about a second") — same shape as step 6 | none — same `hostMs` mechanism |
| Recover an asset design rather than lose it | 34 | whether the retry button reads as an action belonging to the notice, or as a bar of chrome | `assetDesignerGeometry.e2e.ts` (button width against half the notice/leaf) |
| Two designers on one asset | 10 | rewritten under AD18-R27: from memory of the moment, would a person have noticed that a held drag's edit did not land, and does the leaf alone tell them what to do next | none |
| Browse the asset library | 1 | an empty declared shelf reading as room rather than as clutter | none — jsdom resolves no CSS and no capture shows a themed vault |
| Browse the asset library | 3 | the five outline-state marks distinguishable to an eye at 20px | `assetLibraryMarkPixels.e2e.ts` (pairwise pixel-diff at 20px, 1x and 2x) |
| Browse the asset library | 11 | "no intermediate width at which the panel is unusable" | `assetLibraryWidthSweep.e2e.ts` (strict clip/overflow/overlap sweep from 460px up — see AD18-R34) |
| Browse the asset library | 33 | "noticeably" fainter than a real design's mark (the same-stroke-weight clause is closed by `assetTileStrokeParity.test.ts`) | `assetLibraryLegibility.e2e.ts` (icon-line contrast below mark-line contrast, both themes) |

That is 7 + 0 + 0 + 2 + 3 + 1 + 4 = 17 rows. The "Why a person" column is carried from the previous
packet for the rows that did not change; Two designers 10's is new.

**Walk every one of them in a real vault** (`npm run test-build`, into this repository, which is a
vault). Fill each case's own Runs table and Outcome section — **an aggregate "looks good" is not a
filled Runs table**; the 2026-09-19 walk produced exactly that and the matrix had to say so.

## Known behaviour: the walk must NOT file these as new defects

Carried forward from the previous packets, plus the round additions at the end:

- **Obsidian's graph view takes Ctrl+G in a default vault**, so Group never runs by that chord until
  the user unbinds `graph:open` (Compose 43, 49, 51; Design 90a, 90b, 95).
- **Focus after Group from a Parts row stays on the row**, not the canvas (Compose 48).
- **A duplicated or undone hidden part comes back shown** (Compose 7c).
- **Edit dimensions on a traced, uncalibrated asset retypes its outline** and leaves a pending
  clearance unscaled, with no review notice — and hidden, if it was hidden (Calibrate 36 and 36a).
- **The asset's Edit dimensions drops a rounded rectangle's Corner radius row** (Design 102).
- **A pointer click on the canvas draws no focus ring**; Tab does (Design 105).
- **One trace point placed does not block Ctrl+Z** (Design 120).
- **The basin's Width figure is reached by keyboard, not a click** (Design 125). What covers it is
  unpinned and platform-font-dependent (measured on Windows 2026-09-30: `clearance-width` at
  1023x800, `detail-detail-3-depth` at 1400x900). The case reaches it by keyboard regardless.
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
- A typed width on a curved part can move its depth with no warning; a drag past a curved part's
  reach stops at the nearest size silently; a miss of 0.5mm does not warn; a hidden clearance
  re-shows after any read-back that changes it; a pointer resting in the canvas's 40px edge band
  pans the camera; Ctrl+Z does nothing in a focused `<select>` or on the corner-radius slider;
  Ctrl+Z/Ctrl+Y are claimed even with nothing to undo.
- A wrapped Create-your-own card at the narrowest library widths is the fix, not a defect (AD18-R34).
- A library row no longer flashes back to "not yet read" when its mark is re-read (fixed
  2026-09-29, `0a0f8b7e1`).

**From the UI critique round (AD18-R39 to AD18-R42), still true:**

- **A multi-selection draws every member, with one dashed frame round the drawn ones** (Compose 13,
  17, 52a). A hidden member is in the Align math and not in the frame — by design.
- **Library Grid tiles and the inspector Shape preview draw an asset's footprint plus its details**;
  the 20px List row stays footprint-only (Browse 20).
- **The clearance's per-side figures are a positive REACH, not a signed gap**; a flush (0mm) side
  draws no label at all; a typed reach moves only that one edge; an inward side still reads signed
  (Design 61a-61d).
- **Every plain (non-`danger`) `ConfirmDialog` confirm in the whole plugin wears `mod-cta`**, not only
  inside the asset designer.
- **Asset-library count strings have singular forms** ("1 asset", "1 matching asset", "1 placement" and
  so on).

**New this round:**

- **A typed clearance reach that cannot land warns with a reach-specific sentence**
  (`designer.typed-reach.landed-{side}`), not the generic size-landed one.
- **Every dialog form's submit is primary and sits on one right-aligned footer row**, with Tab order
  ending Cancel then submit, and Reference setup reading Cancel, Back, Next (see "Deliberate visible
  changes" above).
- **Two designers steps 9, 10 and 12 read differently** (rewritten or corrected under AD18-R27). They
  are not regressions.

## Looked at by agents — and NOT yet by a human

Nobody has walked any of this as a person in a vault. What agents did look at:

- **The integrator looked in installed Obsidian 1.13.7 at `edcb8c9d9`:** library tiles draw details,
  including the vanity's basin and tap-hole dot and the toilet's tank and bowl; the inspector preview
  draws details; the list row is footprint-only; New asset is one row, Cancel then Save; a
  multi-selection draws a dashed frame round the tap hole and the basin; the rotate handle overlaps the
  tap hole at 62% zoom — **pre-existing**, not this round's; All dimensions clearance reads 600 mm
  positive and the zero sides are gone.
- **Task 8 looked at its own harness captures after its fix**, in both colour schemes.

**Still not judged by a human:** everything in the two bullets above as a matter of appearance; the
long-form dialog scroll on a real long form in Chromium (only `NamedCatalogueForm` is real-host-tested);
and whether the roughly 3x3px tap-hole detail on a 4rem tile is legible enough to be worth drawing.

## Root-caused and fixed: the empty-catalogue notice red (`9388df519`)

`tests/e2e/assetDesignerBasics.e2e.ts`'s *"prefixes the empty-catalogue notice with Information and
clears it after about six seconds"* failed three times on the 1.13.7 desktop shard 1/2 leg — E2E runs
`36340603832`, `36630319061` and `36744859635` — with
`AssertionError: expected [ '' ] to include 'This vault has no assets yet.'`. **It was a test-helper
defect, not a product one, and not a flake to re-run past.** `designer.notices()` (`tests/e2e/designer.ts`)
read each toast with WebDriver's `getText`, which returns VISIBLE text only. Obsidian builds a notice at
`translateX(350px)` and slides it in over about 100 ms inside `.notice-container`, which clips
(`overflow: hidden`), so a read inside the slide answered `''`. The helper now reads the message element's
`textContent` in one `browser.execute`. **It is confirmed in CI**: `b35623687` is CI `36767289396` and E2E
`36767289281`, both success. **The fix also closes a false pass:** `assetDesignerFollowupsLanding.e2e.ts`'s
`not.toContain(REFUSED)` could pass on a refusal read mid-slide as `''`. Full evidence:
`.superpowers/sdd/notice-investigation-report.md` (gitignored).

**Still unexamined, and no task this round examined it:** why only the 1.13.7 leg failed (both legs run
app 1.13.7; three failures on one named leg is roughly a 1-in-8 chance), and whether the
`noticesCleared` comment in `designer.ts` — one click sometimes left a notice standing on the 1.13.7
Linux leg — shares the slide-in cause.

## Rows this pass cannot reach, and who can

Unchanged:

- **U06** is REFUSED as written, not merely unrun — there is no freeze/issue workflow to exercise.
  It needs a product decision, not a walker.
- **AD16 item 1** (benchmarks) is blocked on a benchmark harness this repository does not have
  (`npm run perf` is deliberately absent) and a host; a walker cannot discharge it.
- **AD16 item 2** (accessibility) is partly reachable and deliberately not claimed: the jsdom axe
  scans verify no colour contrast, no visible focus indicator and no hit-target size.
- **AD16 item 3** (moderated novice usability) needs people. Not fakeable and not faked.

## The `src/` findings this pass looks at

Unchanged — `unrecoveredWrite` is set by the designer and drawn on no designer surface (B19, B20,
record-only by the user's own 2026-09-22 decision), and `settings.units` binds a control, persists and
is read by nothing outside `src/plugin/settings/`, which is plugin-wide, predates this expansion, and is
not this pass's to fix.

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
- **CI's xvfb legs run at `devicePixelRatio` 1; this Windows machine runs at 2.** Do not assume a
  pixel measurement made here transfers to CI without reading both ratios.
- **A Windows window resize skips widths that a Linux one reaches** (556 to 572px above 35rem,
  700 to 728px above 45rem) — AD18-R34's defect lived at 568px, Linux only. Drive a width sweep at
  widths reachable on both platforms.
- Only fallow's `Failed:` line and its `N above threshold` gate. A lone red Windows leg on
  `tests/gates/network-boundary.test.ts` is a known flake: `gh run rerun <id> --failed`.
- **A known E2E flake:** `assetHandoffMore.e2e.ts` timed out once in setup on the 1.13.7 desktop
  shard 2/2, on a docs-only commit, and passed on re-run. Re-run once; twice in a row is a defect to
  investigate. The empty-catalogue notice red looked like a flake and was not — see above.
- **New this round: the `Write` tool was once blocked by the auto-mode classifier for a gitignored
  report; PowerShell worked.** If a write is refused that way, try PowerShell before assuming the path
  is wrong.

**Reported by the user rather than found by any agent, unchanged:** on this machine the `obsidian://`
protocol handler is registered to the `npm run test:e2e` harness's CACHED Obsidian binary
(`node_modules/.cache/obsidian`) rather than to the user's own installed Obsidian, so an `obsidian://`
link clicked outside a deliberate e2e run opens the cached, test-only copy instead of the vault the
user works in. Unverified by any agent or test; the user's own observation about THIS machine. Worth
checking before it causes a confusing manual-walk session.

## Recorded, not fixed

**Out of scope, unchanged:** U06; the AD16 items above; `unrecoveredWrite` drawn on no designer surface
(and the browser harness never calls `activateNotices()`); the `obsidian://` handler observation;
`arcArc`'s residual cusp class; the held-drag ceiling.

**A note for the next reader:** vitest's `expect.any(Object)` accepts `null` (`typeof null ===
'object'`); pair it with `not.toBeNull()` when null must fail.

**Resolved this round, so no longer open:** the AD18-R35 retag; `hotkeysOf`'s missing chord
normalisation; Calibrate 21l never watched red; Design 120's realistic order not driven; the redundant
body rule in `editor-reference-viewport.css`; the reach-warning wording concern; and the "library tile
details not eyeballed" claim for the harness (Tasks 6 and 8).

**New this round, recorded rather than fixed:**

- **Two designers step 13's framing leans on step 12's old premise** (Task 1).
- **The left/top `missed` key mapping of the reach warning is unpinned**, and an inward (negative)
  landed reach would read "reaches -N mm beyond the ... edge" (Task 2). `typedLanding.ts` line 57 is a
  166-character line.
- **`boundTo`'s only caller asserts `[]`, and `spellKey`'s Ctrl-to-Mod, sort and upper-case clauses are
  exercised by no caller** (Task 4).
- **Task 3's leftovers:** (a) `.rp-reference-setup > .rp-dialog-actions` in
  `editor-reference-viewport.css` mostly restates `.rp-dialog-footer`, and its 8px padding leaves
  scroll-padding about 4px short (cut to `z-index: 1`); (c) Reference setup's Back lacks
  `rp-dialog-button`; (d) `FormDialog.vue` has a docblock line of about 170 characters; (e)
  `dialogFooter.e2e.ts` uses fixed 400/150 ms pauses, to become `expect.poll` if Linux flakes.
- **Task 5's new Design 120 case has only been seen green on Windows** — its Escape inside a held action
  chain; watch the Linux E2E leg when `3eb44ac90`'s run reports.
- **Task 8:** the harness's unreadable tile-adhesive asset says "no shape" in its inspector where
  Obsidian presumably shows a read failure (inferred, not checked).
- **Local `npm run analyze` reports a duplicate export `scale`** (`core/geometry/operations.ts` against
  `core/money/Money.ts`) that CI's fallow 3.26.0 does not. Unexplained and local-only; not chased.
- **PR #230 is still a draft, and the auto-fix CI monitor is ON for the controlling session** — a red
  leg on the pushed head is acted on there.
