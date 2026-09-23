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

**145 human steps across six cases**, measured rather than remembered — re-derived on 2026-09-23
against the finished AD18-R16 parity-round tree with the command below, run verbatim as it is
printed. **Do not trust this number; run the command.** It has been 84, then 90, then 109, then
this, and each time the session that moved it was the session that had just shipped the thing it
was counting:

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
| [[Design an Asset]] | **72** | 118 | U01 (with the next row) |
| [[Take an asset from the library into a plan]] | 19 | 28 | U01, T34 |
| [[Compose an asset from parts]] | 2 | 38 | U02, U03 (its Repeat section) |
| [[Calibrate a sheet and reserve space]] | 11 | 38 | U04 — **7 already confirmed**, see below |
| [[Recover an asset design rather than lose it]] | **33** | 42 | U05 |
| [[Two designers on one asset]] | 8 | 16 | T12 |

**What session fourteen ADDED, and why the total moved from 90 to 109.** A session that ships a
feature grows the walk, and saying so is part of shipping it. **Nineteen new steps**, in two
sections, and the sections matter more than the number.

- **Thirteen in [[Design an Asset]], for dimensions on canvas** — the approved 2026-09-15 spec's
  **increment 2**, the last of that iteration's three and the headline of this session. **Nothing in
  it has been seen in Obsidian.** It was drawn and measured in the browser harness, which applies
  layout but is not a vault. **Two of the thirteen are regression guards rather than first
  sightings**, and both cover defects a review caught before merge: step 63, that typing back the
  number a field already shows writes nothing and pushes no undo entry (C03), and step 67, that
  every dimension label disappears under a draw tool — without which a press on the footprint's top
  or left edge, exactly where a user traces, is taken by a button and the gesture never starts.
  **Step 70 is a `judgement` step over a known residual**: a browser pass measured 14 overlapping
  pairs and **two of 26 labels with no clickable point at all**, and that step is where a person
  says whether what is left matters.
- **Six in [[Recover an asset design rather than lose it]], for the stale notice's `Try again`**
  (**AD18-R13**). **This state cannot be reached by any instrument except a person in a vault** —
  `tests/harness/page.ts` passes its `stale` knob to the PLAN EDITOR branch only, so no fixture and
  no capture can draw it. Step 35 is the one to read first: it guards the defect the card blocked
  itself on rather than shipping, where a retry wired to the blanking read would have replaced a
  design the vault still holds with the failure panel. Step 34 is a `judgement` over **AD18-R15**,
  because the button first rendered the full width of the leaf and a person is the only judge of
  whether the fix reads as an action.

**Three steps were REWRITTEN rather than added, and this is the half that will otherwise waste your
time.** Steps 10 and 12 of [[Recover an asset design rather than lose it]] and its out-of-scope
bullet all said the designer has no `Try again`. It has one now. **Step 10's old text would fail a
passing build** — it read *"There are none"* — and step 12's expectation is UNCHANGED while only
its reason was false: that notice still heals unprompted, and pressing the button to clear it would
itself be a defect.

**Two reductions apply and both are already recorded in the cases themselves.** U04's steps 3, 7, 9,
12, 13, 14 and 34 were confirmed in a live vault on the `test-build` of `c69ec364d`, so only its
step 32 (needs a screen reader) and its seven `browser` steps remain — and those seven are
structurally unreachable while `tests/harness/assetDesigner.ts` sets `background: null`. And
**[[Two designers on one asset]] step 11 is the same walk as [[Recover an asset design rather than
lose it]] step 17** — walk one, not both.

**What session fifteen ADDED, and why the total moved from 109 to 145.** Session fifteen's Task 13
closed the AD18 parity round (AD18-R16, twelve source changes landed as one package), and every one
of them is a first sighting — none has been seen in Obsidian. **Thirty-six new steps, all but two in
[[Design an Asset]]'s own new section.**

- **Thirty-four in [[Design an Asset]]'s new "the parity round (AD18-R16)" section (steps 72–104,
  including 96a)**, covering all twelve tasks: the header's `← Back to library` door (72–73), the
  Add rail's labelled tiles (74–76), the toolbar's zoom cluster (77–80), the canvas legend (81–85),
  Height beside Dimensions (86), the Inspector's asset card (87–88), the canvas/Parts-row context
  menu including the keyboard-only group shortcuts and the one row only a vault can answer — whether
  an un-consumed Ctrl+G reaches Obsidian's own graph-view hotkey, from the canvas (96) and again from
  a Parts row after closing the menu with Escape (96a) — (89–97), the rounded-rectangle Corner radius
  field (98–102, with step 102 a `judgement` rather than a pass/fail: its outcome is known and
  recorded, but whether it is the RIGHT outcome is a ruling still pending), and two `judgement` steps
  over whether Tasks 5, 6, 7 and 9 together read as board 01's own inspector, and whether the Add
  rail's and Arrange panel's new icons read as what they do without hovering (103–104).
- **Two in [[Calibrate a sheet and reserve space]]**: step 15a, that the Placement group's `Custom`
  segment hands off to the real `Set anchor` tool and becomes the pressed segment once the anchor
  sits at neither preset; and step 15b, whether a KEYBOARD-only user can complete that same gesture
  at all — `SetAnchorTool` commits on `pointerDown`, so this is the first time that question has been
  asked of a keyboard rather than assumed answered by the numeric fields beside it.

**Every OTHER row this round touched was REWRITTEN, not added — its step number is unchanged, and
its own text says so. Read this before walking any of them, across three cases.**

- **[[Calibrate a sheet and reserve space]] step 15**: the old two-row `<dl>` ("Placement point: …"
  text plus two plain buttons) is gone, replaced by AD18-R16 Task 8's three-button `role="group"`
  segmented control (Back centre, Centre, Custom); steps 20, 21 and 24 also lost their old field
  labels ("In front", "Behind", "To its left", "To its right" as VISIBLE text) to Task 5's compact
  rows — the full sentences are now each field's accessible name, and the "Behind" field's full
  sentence itself changed too, to "At the back" (a concurrent fixer's own label-containment pass);
  the visible short labels are Front, Back, Left, Right.
- **[[Compose an asset from parts]] steps 12, 18, 19, 21, 24, 26, 27, 28, 29 and 31**: step 12's
  "Select multiple parts" checkbox moved from the Inspector to the Parts panel (Task 7); steps 18,
  19, 21, 28 and 29 lost their align/distribute buttons' visible text to Task 10's icon-only row —
  each is found by its tooltip or accessible name now; steps 24 and 26 each gained an explicit
  "open the disclosure first" action, since Task 6 folded the Transform and Repeat sections behind
  closed-by-default `<details>`; step 27 notes the Repeat disclosure opened at step 26 stays open;
  and step 31's toolbar tool list gained the zoom cluster between Undo/Redo and View (Task 1).
- **[[Take an asset from the library into a plan]] step 12**: its 2026-09-20 amendment already
  pointed at the header for both doors; this round only changes the library door's own text, to
  "← Back to library" with an arrow-left icon, clipped below a sidebar width rather than removed.

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

## The `src/` findings this pass looks at — ONE now, and a second that is not this package's

**This section named FOUR findings and a fifth until 2026-09-22, and three of the four were already
closed when it said so.** That is the failure this whole document exists to prevent, sitting inside
the document: the section above it correctly recorded two of them as fixed while this list went on
asserting the opposite, and a walker reads the list rather than the narrative. Recounted against the
tree rather than edited down from the old text.

**Closed, and named here only so nobody re-finds them as defects:**

- The designer's header reading `Saved` beside its own out-of-date strip — **fixed by W18-C**
  (2026-09-22). `SaveStateIndicator` takes an optional `stale` prop and `AssetDesignerRoot` passes
  the same `staleAfterRefresh` that draws the notice, so the two cannot disagree. The old claim that
  `save-state.saved-refresh-needed` *"cannot be produced on that surface at all"* is false; steps 9,
  11, 12a and 12b are regression guards that fail if the bare word comes back.
- `runtime.ts`'s `writesBlocked` premise contradicting `assetDesignStore.stale` — **fixed by
  W18-C**, a comment rather than behaviour, and the same over-claim was found duplicated in
  `designerRefresh.test.ts`.
- `PlanAssetUsage.projectId` reaching no view — **fixed by W19-B** (2026-09-22). Plan usage rows now
  name the project that holds them, so two plans both called `Kitchen` in different projects no
  longer draw as identical lines. **Read the guarantee narrowly**: it separates two
  differently-named projects and nothing more, so two `Kitchen` plans in two projects BOTH named
  `Flat renovation` still draw identically — the neighbouring `withPathsWhereAmbiguous` is what
  escalates to a path for that, and `ListPlansUsingAsset.ts`'s own header names the residual arm.

**Still open, and the only one this pass observes:**

1. **`unrecoveredWrite` is set by the designer and drawn on no surface the designer renders** —
   **B19, B20**. The designer's dispatcher wraps the save-state tracker and it dispatches at least
   one command that can set the flag, yet `grep -rn "unrecoveredWrite" src/presentation/designer/`
   returns nothing. **The inherited phrase "drawn nowhere" is FALSE and is not repeated here**: the
   flag has nine consumer files, every one of them Plan Editor or Project Work. It stayed
   record-only on 2026-09-22 by the user's decision, and closing it needs a row in
   `AssetDesignerRoot.vue` plus a NEW locale key — `editor.unrecovered` reads *"Inspect the floor's
   note"* and an asset designer cannot borrow it.

**And one that is NOT this package's**, recorded only so it is not rediscovered: `settings.units`
binds a control and persists through `saveSettings`, and **nothing outside `src/plugin/settings/`
reads it** — re-measured 2026-09-22, with the display path hard-coded to `'en-US'` and `m²` in
`formatLength.ts` and `formatArea.ts`, both docblocks naming *"the per-plan units PBI"*. **That is a
PER-PLAN fact, which this global setting could not satisfy even if a reader existed**, so the honest
fix is that PBI rather than a patch. It is plugin-wide and predates the expansion, so no step here
looks at it. It does bear on AD16's release-checklist box *"No unfinished or nonfunctional controls
advertised"*, which is ticked.

## What a walker records

Each case carries its own **Runs** table and its own **Outcome** section; fill those, in the case
file, rather than anywhere else. **An aggregate "looks good to me" is not a filled Runs table** —
the 2026-09-19 walk produced exactly that and the matrix had to say so. What moved a row on
2026-09-21 was a per-step checklist with one expected result each, walked against the file.
