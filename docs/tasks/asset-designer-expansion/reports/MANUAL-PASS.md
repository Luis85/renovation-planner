# The deferred manual pass

**Decision, 2026-09-21 (session eleven), taken by the user: every vault check in this package is
deferred to ONE terminal pass.** No wave asks for a walk while agent-closable work remains. This
file is the index of what that pass will be; it is deliberately **not** a copy of any step, because
a second copy of a procedure is one that disagrees with the first.

## Why batch them

A walk costs user time and nothing else can buy it. Spending it mid-package pays for a picture of a
tree that later waves then change — U04's walk on 2026-09-21 confirmed seven steps against a build
three integration SHAs old, and every one of them has to be read as a fact about that build. Batched
at the end, one walk grades a tree nobody is still editing.

The cost of NOT batching is real too and is named here rather than glossed: a defect a walk would
have found survives longer, and this repository's record is that its sharpest defects were fakes
accepting what Obsidian refuses, with every gate green. **That trade was made deliberately, not
overlooked.**

## What the pass consists of

**90 human steps across six cases**, measured rather than remembered — re-derived on 2026-09-22
against the finished wave-17/18 tree with the command below, run verbatim as it is printed:

```bash
for f in "Design an Asset" "Take an asset from the library into a plan" \
         "Compose an asset from parts" "Calibrate a sheet and reserve space" \
         "Recover an asset design rather than lose it" "Two designers on one asset"; do
  printf "%-46s %s\n" "$f" \
    "$(grep -cE '^\| [0-9]+[a-z]? \| `(obsidian|desktop|judgement)` \|' "docs/tests/cases/$f.md")"
done
```

| Case | Human steps | Of total | Discharges |
|---|---|---|---|
| [[Design an Asset]] | **25** | 71 | U01 (with the next row) |
| [[Take an asset from the library into a plan]] | 19 | 28 | U01, T34 |
| [[Compose an asset from parts]] | 2 | 38 | U02, U03 (its Repeat section) |
| [[Calibrate a sheet and reserve space]] | 9 | 36 | U04 — **7 already confirmed**, see below |
| [[Recover an asset design rather than lose it]] | 27 | 36 | U05 |
| [[Two designers on one asset]] | 8 | 16 | T12 |

**What waves 17 and 18 ADDED to this pass, and why the total moved from 84 to 90.** A session that
ships a feature grows the walk, and saying so is part of shipping it.

- **Six new steps in [[Design an Asset]]**, in a new section of its own: four for the canvas rulers
  and two for the vanity preset. **Neither has ever been seen in Obsidian.** The rulers were drawn
  and measured in the browser harness, which applies layout but declares none of a themed vault's
  colours; the vanity was measured for geometry and **never looked at as a picture at all**. So these
  are first sightings rather than regression checks, which is what makes them worth a person's time.
  One of the six is a `judgement` step and is the only instrument that can answer it: AD18-R10 was
  settled on the canvas COLUMN's share, which the ruler does not move, and the ruler's 18 px per axis
  of occlusion was **disclosed rather than binding** — 272 px of drawing in a 290 px canvas at a
  580 px leaf. If that reads as too tight, hiding the rulers below the 35 rem breakpoint is the
  recorded remedy and that step is its trigger.
- **Five REWRITTEN steps in [[Recover an asset design rather than lose it]]** — 9, 10, 11, 12a and
  12b — and the count did not move because none was added. This is the half worth reading before
  walking: those steps recorded a defect that **has since been fixed**, so a walker following the old
  text would report a pass as a failure. Step 9 said in as many words that *Saved · refresh needed*
  *"cannot be produced by this surface at all"*; W18-C made it producible, and the step is now a
  regression guard that fails if the bare word comes back. Step 10's *"the comment beside it gives a
  false reason"* is discharged, with its expectation unchanged.

**Two reductions apply and both are already recorded in the cases themselves.** U04's steps 3, 7, 9,
12, 13, 14 and 34 were confirmed in a live vault on the `test-build` of `c69ec364d`, so only its
step 32 (needs a screen reader) and its seven `browser` steps remain — and those seven are
structurally unreachable while `tests/harness/assetDesigner.ts` sets `background: null`. And
**[[Two designers on one asset]] step 11 is the same walk as [[Recover an asset design rather than
lose it]] step 17** — walk one, not both.

## The gate inside the pass

**[[Two designers on one asset]] step 1 decides how much of that case exists.** No control this
plugin owns opens a second designer leaf on one asset, so whether Obsidian will give a walker a pair
at all is unverified by anything. That step names exactly which rows survive if it fails. **Walk it
first**; it costs two minutes and it decides eight steps.

## Rows this pass cannot reach, and who can

- **U06** is REFUSED as written, not merely unrun — there is no freeze/issue workflow to exercise.
  It needs a product decision, not a walker.
- **AD16 item 1** (benchmarks) needed the F12 fixture family, and **the agent half of that split was
  taken by wave 16 on 2026-09-22**. `shapeWithParts` exists at 25, 250 and 1000 parts with its part,
  vertex and curved-edge counts documented and asserted (92/917/3667 vertices, 32/332/1332 curved
  edges), so item 1 is no longer blocked on a fixture that does not exist. **It is still blocked on
  everything else**: §6's conditions are a warmed renderer, recorded hardware and a leaf width, and
  there is no benchmark harness here (`npm run perf` is deliberately absent) and no host. **A walker
  cannot discharge this either** — it needs a benchmark somebody has written, not a pair of eyes, so
  it stays outside this pass in the other direction from the one it used to sit in.
- **AD16 item 2** (accessibility) is partly reachable and deliberately not claimed: the jsdom axe
  scans verify no colour contrast, no visible focus indicator and no hit-target size, because jsdom
  has no rendering engine for any of the three.
- **AD16 item 3** (moderated novice usability) needs people. Not fakeable and not faked.

## The `src/` findings this pass looks at — FOUR now, and a fifth that is not this package's

Recorded as holes by the user's decision rather than fixed, so the pass is where they are
**observed** rather than where they are closed. Each names its steps:

1. The designer's header reads `Saved` beside its own out-of-date strip, and
   `save-state.saved-refresh-needed` cannot be produced on that surface at all — **B9, B11** of
   [[Recover an asset design rather than lose it]]. Against C08's *"Saved must not imply that a
   stale canvas is current"* this is the sharpest open question in the package.
2. `unrecoveredWrite` is set by the designer and drawn nowhere — **B19, B20**.
3. `runtime.ts`'s `writesBlocked` premise contradicts `assetDesignStore.stale`. A comment, not
   behaviour, and no step observes it.
4. **Added 2026-09-22 (wave 16): `PlanAssetUsage.projectId` reaches no view.** Of every `src/` file
   importing `AssetPlanUsage`, the only one naming `projectId` is `ListPlansUsingAsset.ts`, the query
   that produces it; both usage panels — `AssetUsageScope.vue`, and `DesignerUsageScope.vue` through
   `assetDesignerQueries.ts` — map the row to plan name and placement count only. So **two plans both
   named `Kitchen` in different projects draw as two identical lines**, separable only by `:key` and
   `data-plan-id`, neither of which a user sees. The sibling `AssetInspectorUsedIn.vue` keys on
   `projectId` *precisely because* two projects may share one identity — the same hazard with opposite
   answers in one directory. **No step observes it today**, because no case in this pass puts one asset
   in two same-named plans; a walker who wants to see it should make the second project's plan share a
   name with the first's. **Beware the grep**: a bare `projectId` search over `src/presentation/library/`
   is NOT empty, but those hits are `ReferencingGroup` from a different query, and only the
   `AssetPlanUsage`-importer grep settles it.

**And one that is NOT this package's**, recorded here only so it is not rediscovered: `settings.units`
binds a control and persists through `saveSettings`, and **nothing reads it** — measured three ways,
with the display path hard-coded to `'en-US'` in `formatLength.ts` and `formatArea.ts` and both
docblocks naming *"the per-plan units PBI"* as the increment that would change that. It is plugin-wide
and predates the expansion, so no step here looks at it. It does bear on AD16's release-checklist box
*"No unfinished or nonfunctional controls advertised"*, which is ticked.

## What a walker records

Each case carries its own **Runs** table and its own **Outcome** section; fill those, in the case
file, rather than anywhere else. **An aggregate "looks good to me" is not a filled Runs table** —
the 2026-09-19 walk produced exactly that and the matrix had to say so. What moved a row on
2026-09-21 was a per-step checklist with one expected result each, walked against the file.
