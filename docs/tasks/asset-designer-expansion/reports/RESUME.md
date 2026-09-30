# RESUME — hand-off after the UI critique round's Task 7, for the next session

**Rewritten 2026-09-30, replacing session twenty-one's packet wholesale.** An appended hand-off
goes stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT** (confirmed
`gh pr view 230`, 2026-09-30). **Nobody marks it ready, tags it or publishes it without asking the
user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha reliably.** Confirm it: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 6 --json databaseId,workflowName,headSha,status,conclusion`. This file's own parent commit is `80923a50b` (Task 7's own MANUAL-PASS re-derivation); nothing has been pushed past it and no CI run covers it. Re-check before trusting anything recorded here. |
| Last fully green (CI **and** E2E) | `e8e64709d` (run `36625020490`/`36625020796`, 2026-09-29) — **this predates the whole UI critique round** (`git merge-base --is-ancestor e8e64709d 2c55b9c9d` confirms it is an ancestor of the round's own base). Every commit inside the round that HAS run shows CI green and **E2E red** on an unrelated, pre-existing flake (see "Open: the empty-catalogue notice flake" below), most recently `649eb4489` (run `36744859592` CI success / `36744859635` E2E failure, 2026-09-30). |
| `origin/main` | Last merged at `61fbf1588` (PR #238). `git merge-base HEAD origin/main` prints the same sha as `origin/main`'s own tip — the branch is up to date — and **553** commits ahead of it (`git rev-list --count origin/main..HEAD`, 2026-09-30). Fetch and re-check before assuming that still holds; ask the user before merging. |

## What Task 7 of the UI critique round did (this file's own author)

Task 7 brought the docs in line with what Tasks 1–6 and the whole-round fix wave shipped
(AD18-R39 to AD18-R42): retagged and cited case rows in five `docs/tests/cases/` files, added the
round's own section to `AD18-walk-automation-evidence.md`, wrote the delivery note for
AD18-R39–R42 into `DECISIONS.md` (with a one-line pointer from AD18-R7 to its amendment), corrected
`execution/state.json`'s AD18-R41 entry (it named "resizeBox with a pivot"; the shipped code is
`dimensionFigures.ts`'s `reached`/`settled`, a stretch/restore loop of up to 6 rounds at 0.01mm then
a shift — appended as a correction entry, since the file's own convention is append-only), amended
the library design spec for the 113→119 key-count moves and corrected `strings.test.ts`'s own "not a
spec amendment" claim now that one exists, and re-derived MANUAL-PASS's count: **still 22**, no step
retired or added by this round. It touched no `src/`, `styles/` or `tests/e2e/` file, per its own
ownership (the one exception is the sentence pair in `strings.test.ts` it was explicitly granted).
Its own report is `.superpowers/sdd/uic-task-7-report.md` (gitignored).

## What the UI critique round (AD18-R39 to AD18-R42) shipped — NONE of it walked in a vault yet

Seven tasks, base `2c55b9c9d`, each independently reviewed, plus one whole-round fix wave
(`75b4a9551`, `8b3259571`, `82d3970f0`, `518721058`). Full accounting, including every mutation, is
`DECISIONS.md`'s own delivery note and `AD18-walk-automation-evidence.md`'s "UI critique round"
section; this is the summary a walker needs before touching any of the affected surfaces.

- **Stale notice and asset-price text contrast (WCAG 1.4.3), Task 1 (`452afd2a5`).**
  `.rp-designer-notice` measured ~2.73:1 light, now ≥4.5:1 in both themes;
  `.rp-asset-price-orphan`/`-unreadable` measured ~2.95:1, same fix. Guarded by
  `designerRecoveryLegibility.e2e.ts`.
- **A multi-selection draws every member, Task 2 (`c70f031da`).** Before this round the canvas drew
  only the LAST part pressed (`selected.at(-1)`); now every drawn member restrokes and, with two or
  more still drawn, one dashed frame (1px, accent, under the restrokes) draws round their combined
  box. **The frame and Align disagree on purpose**: the frame is drawn only round the set's DRAWN
  members, while `DesignerArrangePanel`'s Align acts on every selected member regardless of
  visibility — `selectionLayer.ts`'s own docblock states it in one sentence, "a hidden member is in
  the alignment and not in the frame." **Not yet eyeballed**: the frame's appearance (dashed 4/3, 1px,
  palette-follows-theme, drawn under the restrokes rather than over them) has no human judgement
  behind it yet — Task 2's own concern.
- **Library tiles and the inspector Shape preview draw an asset's details, not the footprint alone
  (AD18-R39), Task 3 (`e9914dcb0`, `298e733de`, `f91019d6b`).** The 20px list row is UNCHANGED
  (footprint only, per design spec §3.4). **Not yet eyeballed**: the vanity's tap-hole detail is about
  3×3 px on a 4rem tile — close to a dot — larger in the inspector preview; Task 3's own concern
  flagged it for the integrator's eye. **The harness fixture now ALSO draws details, as of the fix
  wave's T3-M2 (`82d3970f0`)** — Task 3's own report said it did not, and that is now stale:
  `tests/harness/assetLibrary.ts`'s `measured()` takes a `details` array (default `[]`), and two
  seeds carry them — the worktop gets a closed, solid sink cut-out, the scaffold tower two dashed,
  open cross-braces. `npm run harness`/`harness-shot` should show them; nobody has looked.
- **One dialog footer, Cancel then a primary Save/Submit, Task 4 (`202f172d9`, fix round
  `97382122b`).** `FormSubmitRow` (used by `NewProjectForm`, `NewPlanForm`, `NewAssetForm` and the
  asset-preset gallery) now draws one sticky row; the submit wears `mod-cta` with a deliberate AA-fill
  colour mix that outranks the theme's own pairing (measured failing at 3.43:1/4.26:1 on this button).
  **About 18 other Plan-editor forms are NOT converted** (`KnownDistanceForm`, `RoomNameForm`,
  `RoomDimensionsForm`, `AreaDetailsForm`, `ReferenceSetupForm`, the `StructureTaskForm` family and
  others) — they still draw their OWN submit markup, stacked under `FormDialog`'s own Cancel row, two
  rows as before. What DID change for them: their body now scrolls instead of the whole panel, and
  Cancel stays fixed below the scroller — **on a long form, Cancel stays visible while Save (inside
  the scrolling body) can scroll out of view**, the opposite of the claimed dialog's one-row behaviour.
  `styles/editor-reference-viewport.css:3`'s own `.rp-dialog-body { min-height: 0; overflow-y: auto }`
  rule for the reference-setup dialog is now **redundant** (the same rule ships globally in
  `styles/dialogs.css`), not removed by this round since that file is outside Task 4's lease.
- **The clearance's reach reads as a positive distance per side; a typed reach moves only that edge
  (AD18-R40/R41), Task 5 (`613032f2e`, `e809f3a77`, fix round `649eb4489`).** A flush (0mm) clearance
  side now draws NO label — the vanity's own dimension frame dropped from 26 to 23 labels as a
  result, and the "15 overlapping pairs" figure from AD18-R14's own measurement was counted at 26 and
  has never been re-derived at 23 (the guard's own comment says so). An inward clearance side (tracing
  or a negative setback) still reads signed, e.g. "-200 mm". **A typed reach that the clearance
  cannot reach exactly now WARNS, reusing the generic size-landed sentence**
  (`designer.typed-size.landed`, "The typed size is out of reach for this shape. It now measures … mm.")
  rather than a reach-specific one — a reach-specific sentence needs a locale module Task 5 does not
  own, recorded as a concern in its own report. Other, untouched sides settle within 0.01mm of where
  they were (a stretch/restore loop, up to 6 rounds — see the `state.json` correction Task 7 added).
- **Locale counts gain singular forms, Task 6 (`f5cf4472f`, fix round `d61f98693`) plus AD18-R42
  (fix wave I1, `8b3259571`).** Task 6 split four bare `{count}` keys into `.one`/`.other`
  (`view.asset-library.assets`, `.search.results`, `.some-unreadable`, `.used-in.project`), fixing the
  reported "1 assets"/"1 note(s)" bugs. **AD18-R42 then amended AD18-R7** (which had deliberately kept
  the `(s)` shorthand on every usage count): the two remaining keys,
  `view.asset-library.used-in-plans.plan` and `.unreadable`, get the same split, through one shared
  helper (`src/presentation/library/usedInPlansLabels.ts`) rather than a per-caller ternary — the
  ternary version tripped `fallow dupes`. `strings.test.ts`'s pin moved 113→117→119; both moves are now
  recorded in the library design spec's own Amendment 8 (Task 7).
- **The whole-round review's fix wave** closed one Critical (the New asset dialog is unreachable on
  mobile — `Platform.isMobile` disables the door in both places it is offered — so
  `dialogFooter.e2e.ts`'s cases now run desktop-only) and several Important/Minor findings, the
  sharpest being **`ConfirmDialog`'s non-danger confirm now wears `mod-cta` PLUGIN-WIDE, not only in
  the asset designer** — it is a shared component with callers outside this package, so every plain
  confirm dialog anywhere in the plugin is now primary-styled the same way.

## The next session's job: walk the 22 human steps

**The manual pass is still 22 steps, across the same seven cases — re-derived by Task 7 against the
tree this round left (case-file prose corrections included), and unchanged from session
twenty-one's number.** Run the counting command from [`MANUAL-PASS.md`](MANUAL-PASS.md) yourself —
do not trust the number in this file.

**AD18-R35 was RULED (session twenty-two, before the UI critique round) but is NOT YET BUILT.** It
retires five of the 22 steps by ruling, each with a re-open trigger recorded in `DECISIONS.md`
(Design 89's Windows-can't-take-the-Mac-clause, Design 121's third clause, Take 23's two intended
names, Browse 17's shipped single-line Notes input, Recover 20's recorded "no, a known gap"). Nobody
has retagged the rows or recomputed the count for it — `DECISIONS.md`'s own text says "the rows are
retagged and the count recomputed in the build session, not here" and names the expected result
**22 → 17 (7/0/0/2/3/1/4), to be re-derived, not trusted from that line.** This is a SEPARATE piece
of work from walking the 22 below; do it first if the next session has the room, since walking a
step that is about to retire by ruling wastes the same time batching a walk exists to save.

Below is every step still open, by case, with why a person is the only instrument for it and — for
a step a new test now stands beside — which guard runs there. **A guard is a real test that must
pass the mutation gate; it closes a measurable PART of the clause and the step keeps its human tier
regardless**, because the "reads as"/"legible"/"noticeably" reading itself has no instrument. None of
the 22 rows below changed FUNCTIONALLY this round — Task 7 corrected stale prose in two of the
cases' own automated citations (Design an Asset step 70's label count and "15 pairs" staleness
flag; step 125's now-nonexistent `clearance-offset-top` citation), but the guards and their numbers
are unchanged.

| Case | Step | Why a person | Guard beside it |
|---|---|---|---|
| Design an Asset | 7 | the 1000mm scale bar's readability | `assetDesignerLegibility.e2e.ts` (drawn-contrast floor, 3:1, at the layer's own opacity) |
| Design an Asset | 56 | whether the drawing still has "enough" room at a sidebar-width leaf | `assetDesignerGeometry.e2e.ts` (nine-tenths-of-axis floor at a 580px leaf) |
| Design an Asset | 57 | legible at thumbnail size; recognisably not the Washbasin card | `assetDesignerLegibility.e2e.ts` (3:1 stroke contrast) and `assetDesignerPresetPixels.e2e.ts` (pixel-diff floor between the two cards) |
| Design an Asset | 70 | whether a crowded dimension number is READABLE (the clickable half is closed) | `assetDesignerLegibility.e2e.ts` (4.5:1 contrast / host-font-size floor on every label, now polling for **23** labels, not 26 — AD18-R40 dropped the clearance's three flush sides) |
| Design an Asset | 89 | a real Mac's Obsidian taking the ⌘ arm (the label itself is now closed — row corrected from "Cmd+G" to "⌘+G", AD18-R31) | `designerContextMenuMac.test.ts` (vitest, `Platform.isMacOS = true`); no macOS E2E leg exists here |
| Design an Asset | 103 | Object tab layout "reads as" board 01's own compact/grouped look | none — the board is a generated concept image, not a render of this scene |
| Design an Asset | 104 | Add rail / Arrange icons read on sight, without hovering | none — icon-meaning recognition has no instrument |
| Design an Asset | 109 | whether the overall label "reads as detached" from its own dimension line | `assetDesignerGeometry.e2e.ts` (label-to-line and off-drawing geometry floor) |
| Design an Asset | 121 | the comparative judgement itself (Ctrl+Z swallowed vs. Ctrl+G falling through, "checked by eye") | none for this clause — the row's other two clauses are already asserted (A) |
| Take an asset from the library into a plan | 23 | "Edit shape" (library) vs. "Open in designer" (plan) reading as one destination under two names | none — no property any instrument could hold |
| Compose an asset from parts | — | **none left.** Every clause in this case is closed — this round added three new `suite`/`browser` rows (13's drawing detail, 17's frame note, 52a's frame/Align gap) but none is human-tier |
| Calibrate a sheet and reserve space | 29 | whether the notice reads as belonging to the Clearance block above it, or as a fourth unnamed block. Re-asked in full under AD18-R33 — the 2026-09-19 walk's answer is not carried forward, since the block has had rounds since | none — no instrument for either clause |
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

**Browse the asset library also gained a discharged (non-human) detail clause this round**: step
20's Grid tile now draws the asset's details (AD18-R39) beside the footprint the list row still
draws alone — `assetLibraryTileDetails.e2e.ts` and `assetMarkDetails.test.ts` (including the
inspector preview) cite it, and the Automated table's old "the path `d` equals the row's" citation
is narrowed to the FIRST (footprint) path, since a vanity tile now draws four.

**Walk every one of them in a real vault** (`npm run test-build`, into this repository, which is a
vault). Fill each case's own Runs table and Outcome section — **an aggregate "looks good" is not a
filled Runs table**; the 2026-09-19 walk produced exactly that and the matrix had to say so.

## Known behaviour: the walk must NOT file these as new defects

Carried forward from session twenty-one (unchanged unless marked), plus this round's own additions
at the end:

- **Obsidian's graph view takes Ctrl+G in a default vault**, so Group never runs by that chord until
  the user unbinds `graph:open` (Compose 43, 49, 51; Design 90a, 90b, 95).
- **Focus after Group from a Parts row stays on the row**, not the canvas (Compose 48).
- **A duplicated or undone hidden part comes back shown** (Compose 7c).
- **Edit dimensions on a traced, uncalibrated asset retypes its outline** and leaves a pending
  clearance unscaled, with no review notice — and hidden, if it was hidden (Calibrate 36 and 36a).
- **The asset's Edit dimensions drops a rounded rectangle's Corner radius row** (Design 102).
- **A pointer click on the canvas draws no focus ring**; Tab does (Design 105).
- **One trace point placed does not block Ctrl+Z** (Design 120).
- **The basin's Width figure is reached by keyboard, not a click** (Design 125) — **what covers it
  changed this round**: it used to sit under the clearance's own `clearance-offset-top` label; that
  label no longer exists (AD18-R40 drops every flush clearance side), and what covers it now is
  unpinned and platform-font-dependent (measured on Windows 2026-09-30: `clearance-width` at
  1023×800, `detail-detail-3-depth` at 1400×900). The case still reaches it by keyboard regardless.
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
  2026-09-29, `0a0f8b7e1`; see prior sessions' notes for the mechanism).

**New this round (UI critique round, AD18-R39 to AD18-R42):**

- **A multi-selection draws every member, with one dashed frame round the drawn ones** (Compose 13,
  17, 52a). A hidden member is in the Align math and not in the frame — by design, not a bug; see
  the round summary above.
- **Library Grid tiles and the inspector Shape preview draw an asset's footprint plus its details**;
  the 20px List row stays footprint-only (Browse 20). The harness fixture now also draws details for
  two of its seeds (the worktop, the scaffold tower).
- **The clearance's per-side figures are a positive REACH, not a signed gap**; a flush (0mm) side
  draws no label at all; a typed reach moves only that one edge; an inward side still reads signed
  (Design 61a–61d). A reach that cannot land warns with the generic size-landed sentence, not a
  reach-specific one.
- **New-project/plan/asset dialogs draw one footer row, Cancel then Save, with Save wearing a
  deliberate AA-fill `mod-cta`** (Create a Project steps 2, 3). About 18 other Plan-editor forms are
  unconverted and still stack two rows, but their body now scrolls with Cancel pinned below it.
- **Every plain (non-`danger`) `ConfirmDialog` confirm in the whole plugin now wears `mod-cta`**, not
  only inside the asset designer — a consequence of the fix wave's AD18-R42 work landing on a shared
  component.
- **Four asset-library count strings gained singular forms** ("1 asset", "1 matching asset", "1 asset
  note could not be read…", "{name} — 1 requirement"), and two more usage-count strings followed
  under AD18-R42 ("1 placement", "1 note could not be read, so this list may be incomplete").

## Not yet eyeballed by anyone — for the integrator or the next walker

- **The multi-selection frame's appearance** (dashed 4/3, 1px, accent, drawn under the restrokes,
  palette-follows-theme) — Task 2's own concern.
- **The vanity's tap-hole detail, about 3×3px on a 4rem library tile** — close to a dot; larger in
  the inspector preview — Task 3's own concern.
- **The library tiles' and inspector preview's details**, generally: Task 3 could not run
  `npm run harness`/`harness-shot` and predicted the picture from the code path rather than
  measuring it. The harness fixture now draws details for two seeds (see above); nobody has looked
  at either the harness or a real vault's tiles yet.
- **The shared dialog footer's hover state and the ~18 unconverted Plan-editor forms' new
  scroll-with-pinned-Cancel behaviour** on a genuinely long form — predicted from the CSS, not
  watched.

## Open: the empty-catalogue notice flake — under separate investigation

**Reserved for the controller. Another agent is investigating this concurrently; do not overwrite
its findings, and do not draw conclusions from this paragraph until it reports back.**

`tests/e2e/assetDesignerBasics.e2e.ts`'s *"prefixes the empty-catalogue notice with Information and
clears it after about six seconds"* has failed on the 1.13.7 desktop shard across several recent
commits on this branch, including `649eb4489` inside this round (`AssertionError: expected [ '' ] to
include 'This vault has no assets yet.'`), while passing on other legs and other runs of the same
commit. `.superpowers/sdd/notice-investigation-report.md` (gitignored) carries that agent's evidence
so far — refuted hypotheses ("a stale notice from an earlier case", "a different notice", "the text
had not rendered yet"), and the case's own DOM captures showing the notice mid-enter-animation. This
paragraph is intentionally left without a conclusion.

## Rows this pass cannot reach, and who can

Unchanged from session twenty-one:

- **U06** is REFUSED as written, not merely unrun — there is no freeze/issue workflow to exercise.
  It needs a product decision, not a walker.
- **AD16 item 1** (benchmarks) is blocked on a benchmark harness this repository does not have
  (`npm run perf` is deliberately absent) and a host; a walker cannot discharge it.
- **AD16 item 2** (accessibility) is partly reachable and deliberately not claimed: the jsdom axe
  scans verify no colour contrast, no visible focus indicator and no hit-target size.
- **AD16 item 3** (moderated novice usability) needs people. Not fakeable and not faked.

## The `src/` findings this pass looks at

Unchanged from session twenty-one — `unrecoveredWrite` is set by the designer and drawn on no
designer surface (B19, B20, record-only by the user's own 2026-09-22 decision), and
`settings.units` binds a control, persists and is read by nothing outside `src/plugin/settings/`,
which is plugin-wide, predates this expansion, and is not this pass's to fix.

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
- **A Windows window resize skips widths that a Linux one reaches** (556→572px above 35rem,
  700→728px above 45rem) — AD18-R34's defect lived at 568px, Linux only. Drive a width sweep at
  widths reachable on both platforms.
- Only fallow's `Failed:` line and its `N above threshold` gate. A lone red Windows leg on
  `tests/gates/network-boundary.test.ts` is a known flake: `gh run rerun <id> --failed`.
- **A known E2E flake:** `assetHandoffMore.e2e.ts` timed out once in setup on the 1.13.7 desktop
  shard 2/2, on a docs-only commit, and passed on re-run. Re-run once; twice in a row is a defect to
  investigate.
- **A second, currently-active E2E flake:** `assetDesignerBasics.e2e.ts`'s empty-catalogue notice
  case — see "Open: the empty-catalogue notice flake" above; under separate investigation.

**New this round, reported by the user rather than found by any agent**: on this machine, the
`obsidian://` protocol handler is registered to the `npm run test:e2e` harness's CACHED Obsidian
binary (`node_modules/.cache/obsidian`) rather than to the user's own installed Obsidian — so an
`obsidian://` link clicked outside a deliberate e2e run opens the cached, test-only copy instead of
the vault the user actually works in. Unverified by any agent or test; recorded here as the user's
own observation about THIS machine, not a claim about the plugin or about Windows generally. Worth
checking before it causes a confusing manual-walk session — a walker who clicks such a link expecting
their normal vault may land somewhere else entirely.

## Recorded, not fixed

Carried forward from session twenty-one, still open:

- `designerParity.ts`'s `hotkeysOf` lacks the chord normalisation `boundTo` has (harmless today).
- Calibrate 21l's canvas-half assertion was never watched red (the disk half gates the clause).
- Design 120's realistic order (Escape, release, Ctrl+Z) is not driven.
- **A note for the next reader:** vitest's `expect.any(Object)` accepts `null`
  (`typeof null === 'object'`); pair it with `not.toBeNull()` when null must fail.
- `unrecoveredWrite` is drawn on no designer surface; the browser harness never calls
  `activateNotices()`; `arcArc`'s residual cusp class; the held-drag ceiling.
- Design spec §5.4's "An entry LEAVING the listing invalidates its mark" gap was closed 2026-09-29
  (`hydrate` now forgets departed ids; `assetLibraryMarkLeaving.test.ts`).

**This round's own items, recorded rather than fixed:**

- **AD18-R35's retag (22 → 17 expected) is RULED but not built** — see "The next session's job"
  above. This is the single biggest piece of outstanding, well-defined work.
- **Not eyeballed by anyone** — see the dedicated section above (frame appearance, tap-hole size,
  harness/vault tile details, the long-form dialog scroll behaviour).
- **The fix wave's own three concerns** (from `.superpowers/sdd/uic-fixwave-report.md`, gitignored):
  the new tile/preview details are a code-path prediction, not a measurement; commit `518721058` is
  labelled "docblocks" but also carries a one-line behaviourless refactor (T5-M3); Task I1 touched
  two files its brief had not named (`tests/e2e/assetHandoffMore.e2e.ts`,
  `src/application/queries/ListPlansUsingAsset.ts`) because the plural-split forced it to.
- **The empty-catalogue notice flake** — see its own dedicated section above, reserved for the
  controller.
