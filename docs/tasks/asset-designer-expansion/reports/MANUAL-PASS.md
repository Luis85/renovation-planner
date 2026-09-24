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

**205 human steps across seven cases**, measured rather than remembered — re-derived on
2026-09-24 against the finished AD18-R20/R21 polish-round tree (Task 10), with the command run
verbatim as it is printed. **Do not trust this number; run the command.** It has been 84, then 90,
then 109, then 145, then 179, then 182, then this, and each time the session that moved it was the
session that had just shipped — or, twice now, corrected — the thing it was counting:

```bash
for f in "Design an Asset" "Take an asset from the library into a plan" \
         "Compose an asset from parts" "Calibrate a sheet and reserve space" \
         "Recover an asset design rather than lose it" "Two designers on one asset" \
         "Browse the asset library"; do
  printf "%-46s %s\n" "$f" \
    "$(grep -cE '^\| [0-9]+[a-z]? \| `(obsidian|desktop|judgement)` \|' "docs/tests/cases/$f.md")"
done
```

**[[Browse the asset library]] joins the command and the table below for the first time this
round.** AD18-R18's Grid view is the first user-visible change this package has made to that
case, and a case the command does not name is a case whose steps never reach this total — the
same mistake naming a case here guards against for the other six.

| Case | Human steps | Of total | Discharges |
|---|---|---|---|
| [[Design an Asset]] | **90** | 136 | U01 (with the next row) |
| [[Take an asset from the library into a plan]] | 19 | 28 | U01, T34 |
| [[Compose an asset from parts]] | **14** | 54 | U02, U03 (its Repeat section) |
| [[Calibrate a sheet and reserve space]] | **21** | 52 | U04 — **7 already confirmed**, see below |
| [[Recover an asset design rather than lose it]] | 33 | 42 | U05 |
| [[Two designers on one asset]] | 8 | 16 | T12 |
| [[Browse the asset library]] | **20** | 37 | AD18-R18 (Grid view), AD18-R20/R21 Task 8 (this round) |

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

**What the second parity round (AD18-R17/R18/R19) ADDED, and why the total moved from 145 to
182.** Task 12 of that round's own plan wrote these steps against the merged tree of 2026-09-23,
Tasks 1–11, verified at source rather than from the plan alone, **then a review round added
three more** (named at the end of this list) once it found this file's first draft understating
one behaviour and inventing a mechanism that does not exist. **Thirty-seven new steps across
four cases**, all `obsidian` except one already-`judgement` row this round turned deterministic
(see below):

- **[[Design an Asset]] gained ten**: `59a` (the overall width/depth labels sitting OUTSIDE the
  footprint where there is room, AD18-R17 Task 8); `71a` and `71b` (the resting dimension-label
  overlap floor re-measured at four leaf widths, and a label painting above the canvas key rather
  than under it, both Task 8); `85a` (the legend's Clearance row following a live drag preview,
  Task 6); `88a` and `88b` (the header's own "Saved just now" and the fact its region is NOT live,
  so nothing here is ever announced, AD18-R19); `90a` and `90b` (Ctrl+G/Ctrl+Shift+G now working
  from a focused Parts row too, and never while typing in its Label field, Task 3); `98a` (the
  Corner radius slider committing on release, not on drag, Task 4); and `102a`, a NEW known-gap
  row — a canvas HANDLE resize still drops the Corner radius, which Task 4's own fix does not
  reach. **Step 102 itself changed KIND, not only text**: it was a `judgement` row in the AD18-R16
  section because whether a rounded rectangle should survive a Width/Depth edit was a pending
  ruling; AD18-R17 Task 4 closed that ruling, so 102 now states a deterministic pass condition and
  102a carries the one door left open.
- **[[Calibrate a sheet and reserve space]] gained nine**: `15c` (the Placement point group's
  "Custom" label no longer breaking mid-word, a regression guard for a defect this same round
  found and fixed); `21a` through `21e` (the new **Show clearance** switch — its default, what
  turning it off hides, the three gestures that re-show it, and two NAMED known-gap rows: undo,
  redo and a vault refresh can bring a clearance back still hidden, and switching it off mid-trace
  keeps the eventual commit hidden); `21f`, from the review round (a hidden-but-SELECTED clearance
  keeps its own selection outline and handles, and a handle drag still resizes it — `DesignerCanvas.vue`
  gates the `asset-clearance` layer on `showClearance` but not the `asset-selection` layer beside
  it, and `hitDesign` checks a handle before it checks `clearanceHidden`); and `37`/`38` (the
  read-only **Source & scale** block, Task 5, read for a typed footprint and for a
  traced-and-uncalibrated one).
- **[[Compose an asset from parts]] gained one**: step 39, that a HIDDEN part which is deleted and
  then undone comes back VISIBLE rather than hidden — a recorded, accepted residue of Task 3's
  leaf-local pruning, not a defect.
- **[[Browse the asset library]] is newly counted in the command for the first time — 17 rows,
  not all of them new writing.** Only **12** of those 17 are steps WRITTEN this round: the
  original ten (steps 19–20, 22–24, 26–31 — 19, 21 and 25 are `suite`/`browser` and do not count)
  plus two the review round added, `24a`/`24b`. **The other five (steps 1, 3, 11, 16, 17) already
  existed** and are counted here only because the case itself had never been listed in the command
  before AD18-R18 gave it its first change. What the 12 written rows cover: AD18-R18's Grid view
  end to end — the Grid/List toggle defaulting to List, a tile sharing the list row's own mark and
  size wording, the category sidebar's open vocabulary and its icons, the funnel door and its
  narrow-width auto-hide, the "Show all categories" empty-state action's own focus rule (the
  pressed "All" button when the sidebar is showing, the search field when it is not — `24a`/`24b`),
  the Create-your-own card, the filter reaching the search count and the empty state together, and
  the chosen view and category surviving a close-and-reopen through Obsidian's own view state
  without becoming a navigation. **One claim in the first draft named a mechanism that does not
  exist and the review round removed it**: selecting a tile does not narrow the pane or hide the
  sidebar on its own — the ONLY hide rule is the `@container rp-al (width < 35rem)` query on the
  whole pane (`styles/asset-library-grid.css:324-335`; the container itself at
  `styles/asset-library.css:48`), and step 27 now says so rather than describing a
  selection-driven trigger that was never in the code.

**Two rows were REWRITTEN rather than added, plus two whole sections' worth of "rows this round
makes false" the previous round's own hand-off named directly.** [[Design an Asset]] steps 5 and
23 (the toolbar's tool-list overview and its narrow-sidebar behaviour) no longer describe a
wide-width text label at all — AD18-R17 Task 2 retired it, so both rows now describe an icon-only
toolbar at every width. Step 77 keeps its shape and adds that the zoom icons are now magnifiers,
not the previous round's bare circled minus/plus. Steps 29–31 and 39, and their own preceding
preamble paragraph, are the promised fix for the hand-off naming them: "Horizontal centre" and
"Vertical centre" were never the field names AD18-R17 Task 4 shipped — the paired rows read **X**
and **Y** under a "Position" heading, and Width/Depth under a "Size" heading, with Line and
Order folded shut beneath them. Steps 81–85 (the legend) each gained the parenthetical detail and
the new scale bar Task 6 draws beside them, without changing what each row's own subject is.
[[Calibrate a sheet and reserve space]] steps 15, 18 and 20 are the other three named directly:
15 replaces the retired "Toward the …" sentence with the new Front-direction picker described
above; 18 replaces the deleted "45° from …" fallback (and the test it cited) with the picker's
Custom state and its preview's actual angle; 20 quotes the Clearance hint's CURRENT wording
("What you enter here…", not "These four numbers…") and adds the All-sides field and the
Advanced fold around the four it already named. [[Notices and save state]] rows 13a, 14, 17 and
18 are the fourth: each expected a bare **"Saved"** immediately after a write, which AD18-R19
replaces with **"Saved just now"** on the visible text (a screen reader still hears only "Saved",
which is why the rows say so explicitly now, rather than leaving the two readings to be
conflated) — 18 also drops the claim that "the other stays Saved" universally, since a second
leaf that has already saved this session shows its OWN relative reading instead. Two further rows,
18a and 18b, are new rather than rewritten: the minute tick advancing "just now" to "1 min ago" on
its own, and a screen reader hearing nothing when that tick fires. **The review round corrected
one more claim in row 13a**: its first draft said the second, idempotent write "returns to Saved
just now too", which overstates the code — `settle()` only stamps `savedAt` when the batch held a
real write (`save-state-store.ts:100-109`), so the neutral second assignment leaves the clock
exactly where the first write set it rather than restarting it, and the row now says that.

**What the AD18-R20/R21 polish round (Task 10) ADDED and REWROTE, and why the total moved from
182 to 205.** This round fixed a defect the user hit in a real vault — grouping did nothing from
the state the designer opens in — plus a batch of nine approved polish items, one declined
(DECISIONS.md's own AD18-R20/AD18-R21 entries). **Twenty-three new HUMAN steps land inside the
counted total, across the four of the seven cases this round touched** (Design an Asset,
Compose an asset from parts, Calibrate a sheet and reserve space, Browse the asset library);
[[Notices and save state]] gained two more `obsidian` rows of its own, outside the counted
command's seven cases, so they move nothing above. A further six `suite`/`browser` rows were
also added across those same four cases — real steps in their own files, just not counted toward
this figure, the same convention every earlier round in this narrative follows. **Nine existing
rows were REWRITTEN** because the round made their old text false.

- **[[Compose an asset from parts]] gained eleven**, in a new "grouping from every door, and the
  rest the designer opens in" section (steps 40–50): building a set from the Parts ROWS
  themselves with Shift and with the "Select multiple parts" toggle (40–42, distinct from the
  existing canvas-press steps 13–14); grouping from the state the designer now opens in with no
  tool picked first (43, the reported defect's own reproduction); the Arrange panel's Group
  button, the right-click menu on the canvas and on a Parts row, and Ctrl+G on the canvas and on a
  Parts row, each confirmed reachable from **Pan** as well as from Select (44–49); focus landing on
  the new group's own disclosure after a Group dispatched from a Parts row (48); and the
  right-click menu refusing while a pan gesture is still in flight (50). One more, step 7a, guards
  a generalised fix: a Parts-hidden (not only a clearance-hidden) selected graphic now draws no
  outline or handles either, with the selection kept. Step 12a adds the "Select multiple parts"
  checkbox's new focus ring and 24px row floor (Task 6). **Four rows were REWRITTEN**: steps 5, 6,
  7 and 10, the Parts row's Hide/Show, Lock/Unlock, Isolate and Bring forward controls, are
  icon-only now (AD18-R21 Task 7) — each row's old visible-text instruction ("press Hide") is
  replaced with the icon, its tooltip and its accessible name, and two new rows (10a, 10b) cover
  the row's own wrap at a narrow rail.
- **[[Design an Asset]] gained eight**: 88c, a save from an earlier calendar day naming which day
  on the designer's own header (AD18-R21 Task 9); 95a, Obsidian's own Ctrl+G recorded as NOT also
  firing once the designer's own Ctrl+G had something to group (the companion case to the existing
  step 96, which covers the opposite: nothing groupable, so the key passes through); 102b, the
  Shift-held handle drag of a rounded rectangle scaling its radius WITH the box; and a new "the
  polish round" section (105–109) covering the canvas's own focus ring (inset past the rulers,
  Task 6's two fix rounds), the Add-rail's tiles now sharing one height across both rows (Task 6),
  a curved detail's canvas-handle resize now solving like the Inspector's typed Width/Depth fields
  rather than a plain scale (AD18-R20 Task 13), the small-drawing rule that rests only the overall
  dimension pair below about 240px of footprint (AD18-R21 Task 5), and a `judgement` step
  photographing an overall label slid past its own line's end on the toilet preset at a 1280px
  leaf, against AD18-R14 (Task 5's last fix round). **Two rows were REWRITTEN**: 102a used to
  record a known, accepted gap — a canvas handle drag of a rounded rectangle lost its radius — and
  now states the fix (AD18-R21 Task 4 closes it, the identical clamp the typed path already used).
  29d used to ask a walker to RECORD whether the Detail section's "Line" dropdown had themed
  chrome or a bare browser default; Task 6 styled every designer `<select>`, so it is now a
  deterministic pass condition rather than an open question.
- **[[Calibrate a sheet and reserve space]] gained two, and rewrote three.** 21g is a NEW known-gap
  row: a clearance REPLACED (not born from nothing) by an undo or redo while hidden still stays
  hidden, which is the one case AD18-R20 Task 2's fix does not reach — the present-to-present blind
  spot its own runtime docblock names. 21h adds the "Show clearance" switch's own focus ring and
  row-height fix (Task 6). **Two rows FLIP from "known, accepted behaviour" to "now fixed", and one
  stays a known gap with its reason corrected**: 21d (undo of a removal, or redo of a creation,
  while hidden) used to say the clearance may come back still hidden — AD18-R20 Task 2's read-back
  watch now re-shows it automatically, since that is a birth from nothing, not a replacement. 21f
  (a hidden, selected clearance's own outline and handles) used to say they stayed drawn and
  draggable — AD18-R20 Task 3 fixes this: nothing of the selection draws while it is hidden, and no
  press reaches a handle. 21e (turning the switch off mid-trace, then finishing) is UNCHANGED in
  outcome, but its citation is corrected to say why it is a replacement rather than a birth, which
  is what keeps it different from 21d and 21g.
- **[[Browse the asset library]] gained three**, in a new "the Grid view's polish round" section
  (32–34): every tile's name and size now sharing the mark's own left edge, at one line and at two
  (AD18-R20/R21 Task 8's alignment fix); a design-less tile's category-icon placeholder reading
  quieter than a real design's mark (Task 8's own second fix round, after the integrator measured
  the first version reading HEAVIER); and that placeholder matching its category's own sidebar
  icon, from the one shared lookup both surfaces now read. One further `browser` row (35) is not
  counted in the human total: a not-yet-read tile keeps drawing the pending-dots mark rather than
  flashing the category icon.
- **[[Notices and save state]] gained two, `obsidian` but outside the counted command's seven
  cases** (this file's own command never named it, so neither addition moves the 205 figure): 18c,
  the same dated-save fix seen from the status bar rather than the designer header, and 18d, the
  German word order for it ("Am 23. Sept. um 14:05 gespeichert").

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
