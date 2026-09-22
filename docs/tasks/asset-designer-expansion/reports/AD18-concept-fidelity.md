# AD18 — Asset Designer concept fidelity

**Status: planned. Authorized by the user on 2026-09-19**, in these words: *"proceed implementing
the design when wave 8 and AD15/16 are finished"*, after they walked the live vault and said the
surface *"overall it also does not look like the design-concepts I provided in
`docs/user-experience/renovation-planner-asset-designer-plan`"*.

This is a NEW body of work. It is not AD15 validation and it is not AD16 release preparation; it is
the gap between the shipped designer and the concept boards, minus everything the plan deliberately
removed. It is numbered AD18 because AD17 is already taken by post-beta portability.

## The authority, and the trap

`references/01-overall-look-and-feel.png` and `references/02-interaction-concepts.png` are **not the
specification.** `README.md` of that package says so — *"These are the original generated boards,
not screenshots of implemented functionality. The plan's correction table overrides their
conflicting controls and copy"* — and `IMPLEMENTATION-PLAN.md` §4 closes with *"The contract
document is authoritative over the images for these points."*

**So the first rule of this work package: a board element that is absent is not automatically a
defect.** Every item below is classified against §4's twelve correction rows and against
`contracts/DECISIONS.md`'s rulings, and anything governed by one of those is OUT OF SCOPE by
decision rather than by omission.

### Deliberately absent — confirmed correct, do NOT implement

Each is governed by a named §4 row or ruling, and each was checked against the shipped code rather
than assumed:

| Board element | Governed by |
|---|---|
| Product mark and *"Simple to start. Powerful when you need it."* banner | §4 row 3 |
| A `Save asset` button beside automatic save (board 02 draws one) | §4 row 4 — ships `SaveStateIndicator` only |
| The library as a permanent second sidebar inside the designer leaf | §4 row 5 — ships as its own view behind an `Open library` door |
| The green *"Looks good at plan scale / Fits well"* card | §4 row 6 |
| Fixed 300 / 700 / 100 mm clearance values | §4 row 7 — ships `DesignerClearanceHelper` + `DesignerClearanceReview` per **AD14-R1** |
| The north compass in board 02's canvas corner | §4 row 9 |
| White backgrounds and fixed blue styling | §4 row 10 — the shipped surface is host-token themed in both schemes |
| The freehand icon in Basic shapes | §4 row 11 |
| Wood-grain vanity artwork | §4 row 12 — ships as wireframe |
| Board 02's `Lock reference` step (step 3 of its Trace checklist) | **AD12-R1** — *"already true by construction, so no control is owed"* |

One item to record as CLOSED rather than open: AD12-R1 called background **opacity** *"a genuine
gap"*. It has since shipped — `DesignerViewMenu.vue`'s third row binds `runtime.backgroundOpacity`,
consumed at `DesignerCanvas.vue`'s `:opacity="backgroundOpacity"`.

### An inconsistency inside the boards themselves

Board 01 draws the inspector with **three** tabs — `Object | Style | Reference`. Board 02 draws it
with **two** — `Object | Properties`. They disagree, so neither can be cited as the target without
a decision. This is exactly the kind of thing §4 exists to settle and does not.

## The gaps, ranked by cost to a user

Each measured against the running harness rather than read off a template, except where marked.

### 1. No header — the asset is unidentifiable from the leaf

Both boards put a bar across the top: back-to-library, the asset name with a rename affordance,
save state, and the contextual actions. **There is no header element.** `AssetDesignerRoot.vue`'s
children are `.rp-designer-toolbar`, `.rp-designer-body`, `.rp-designer-status`; the one
`.view-header` on the page is Obsidian's own leaf chrome.

**This is AD06 implementation item 1, and AD06 was marked `integrated` without it** — re-opened to
`in_progress` on 2026-09-19. The justification recorded in `state.json` was *"No header chrome, per
C12"*, and that citation is wrong: C12 bans an *"account, logo, compass or **marketing** header"*,
which is the same thing AD06 item 1's own *"no account/logo chrome"* already excludes. The two
documents agree a restrained header is wanted.

Cost, measured: `getDisplayText()` returns `tr('view.asset-designer.name')` for every designer leaf,
so three open designers are titled identically, and the asset name sits about 263 px down a
scrolling 224 px inspector. **What already exists and must not be duplicated**: `DesignerInspector.vue`
draws `.rp-designer-asset-name`, and its own comment records why the leaf title was left alone —
the Plan Editor does the same, so changing one surface alone would make the two disagree. A header
that restates the name means deciding whether the inspector keeps drawing it; two places answering
"which asset is this" is the shape this repository refuses everywhere it has a name for it.

`EditorContextBar.vue` is the shipped pattern next door.

### 2. No zoom readout

The designer has a real camera — a Pan tool, `MIN_ZOOM`, a wheel door — and nothing anywhere states
its scale. Board 02 puts `100%` with a dropdown beside undo/redo. On a surface whose entire job is
millimetres, a user who scrolls out cannot tell what scale they are drawing at, and unlike the
dimension labels and the legend it is recoverable from nowhere else.

`StatusBar.vue` already computes `{{ tr('editor.zoom') }} {{ zoomPercent }}` for the Plan Editor,
alongside grid, snap and scale. The designer's own status region carries one word (`Saved`) in the
resting state across the full leaf width.

**Cheapest real gain in the package**, and the one with the most shipped precedent to copy.

### 3. The `Add` half of the Add/Parts rail does not exist

**CLOSED before session fourteen, and recorded here because this document was behind the tree.**
`DesignerAddPanel.vue` exists, is imported by `AssetDesignerRoot.vue` and is mounted above
`DesignerPartsPanel` in the same left region. Every element this section named as missing is now
present or explicitly ruled out: the rail's `role="tab"` count stays **0 by AD18-R5** (stacked,
not tabbed), the presets stay a **modal by AD18-R6**, and the shape buttons **MOVED rather than
duplicated, by AD18-R3**. The preset search field this section attributes to board 02 already
ships, inside that modal.

**This section carried no closure line for two sessions while the code was in the tree**, and
`RESUME.md` inherited that and proposed it to session fourteen as outstanding work. What is left
is not a gap but a LOOK: the rail's height cost at a 460 px leaf, named as unmeasured by
AD18-R5 and by W11-A's own report, and checkable by no gate here.

**§4 row 1 is one of only two ADOPT rows**: *"Large central canvas, Add/Parts on the left,
contextual properties on the right — adopt the composition and adapt it to actual Obsidian leaf
dimensions."*

Three of its four elements shipped. `AssetDesignerRoot.vue` declares one left region,
`.rp-designer-parts` → `DesignerPartsPanel`; there is no Add panel, no tab control (`[role="tab"]`
count in the rendered shell: 0). Presets are a modal — `AssetPresetGallery` is imported by
`AssetPresetForm.vue` and nowhere else — reached from an inspector button. Basic shapes are text
buttons in the top toolbar. Board 02 adds a **search field** over the preset categories.

So the novice's two entry paths, "start from a preset" and "draw a shape", are two unrelated
mechanisms in two unrelated places, and neither is where the board puts them.

Note the preset gallery is now board-shaped in itself: the thumbnail card was fixed on 2026-09-19
(`fe82a15bf`) and draws picture-above-label. It is still behind a modal behind an inspector button.

### 4. The canvas is the smallest column at ordinary leaf widths

Measured at three widths, and **re-measured independently by the integrator, reproducing the audit
exactly**: `.rp-designer-parts` / canvas / `.rp-designer-inspector` are **176 / 880 / 224 at 1280
(canvas 68.8 % of the shell) → 176 / 360 / 224 at 760 (47.4 %) → 176 / 180 / 224 at 580 (31.0 %)**.
Both rails are fixed at every width measured, so the canvas absorbs 100 % of the loss. At 580 the
body is still `flex-direction: row` — the stack has not engaged. `designer-narrow.css` stacks the
columns only below **35 rem (560 px)**, which puts the worst case immediately ABOVE its own
breakpoint, where the canvas is narrower than the inspector alone.

AD06's acceptance criterion is *"controls do not overlap the drawing or disappear offscreen"*.
Nothing overlaps, so that gate passes while the ADOPT row fails. Wave 8's W8-B card now resolves
that container query against the mounted tree, so a regression here is at last visible to a test —
but only for `display`-shaped hiding, which is a different question from proportion.

**CLOSED 2026-09-22 (session thirteen) by ruling AD18-R10. The figures above are superseded and the
item had been standing open on numbers its own fix had already moved.** Re-measured in a browser
after the rail work: **68.8 % at 1280, 50.0 % at 760, 50.0 % at 580**, against the 68.8 / 47.4 / 31.0
recorded above. The rails shrink now, so the canvas no longer absorbs the whole loss, and the worst
case is no longer the width immediately above `designer-narrow.css`'s own breakpoint.

**Whether 50 % satisfies §4 row 1 was a DECISION nobody had taken, not a defect**, and it is now
taken: it does. Row 1's own sentence is what settles it — *"adopt the composition and adapt it to
actual Obsidian leaf dimensions"* — and at a 580 px leaf a two-rail composition leaving the drawing
half the shell is that adaptation rather than a failure of it.

**One obligation falls out of the ruling and binds future work rather than closing with it**: a top
and left ruler takes canvas on both axes at exactly the widths where there is least of it, so
AD18-R10 requires the ruler card to measure its own cost in a real browser, report the figure, and
refuse to ship if the canvas drops below 50 % at 580. **No gate here can check that** — jsdom
computes no layout — so it is a rendered measurement or it is nothing.

**A numbering trap worth naming, because this document uses two schemes and the next reader will
meet both.** These `###` sections run 1–8; the *Sequencing* table below runs 1–7 and is ordered by
cost over effort, so the two disagree. *"Item 6"* means **this section** (canvas proportion) in the
sequencing table's numbering and **the 887 px inspector** in this list's. *"Item 8"* can only be this
list's, because the sequencing table has no 8. Cite a section by its TITLE where it matters.

### 5. A wrapping text toolbar, against the Plan Editor's own convention

**14** text buttons — re-counted by the integrator against the running harness, not inherited.
Toolbar height goes **65.9 px at 1280 → 69 px at 760 → 107 px at 580**, and the buttons occupy
**1 row → 2 rows → 3 rows** over the same span. The widest single label, `Draw rounded rectangle`,
is **157 px** on its own.

**One figure from the first audit is corrected here rather than carried:** it reported *four* rows
at 580 px. Three is what a distinct-`top` count over the buttons returns. The 107 px height it
reported is right, so the conclusion — a tenth of the leaf height spent on a wrapped text toolbar —
survives the correction, but the row count did not and a number nobody re-ran is how the last four
of these got into the ledger.

**AMENDED 2026-09-20, wave 11 base: the three row counts above are PRE-ICON figures, and the
labelled state no longer matches its own breakpoint.** W10-A shipped the icon toolbar and set
`styles/designer-toolbar.css`'s `@container (width < 80rem)` rule from the measurements in this
paragraph — they are what its comment cites, and it states the consequence as *"all fourteen at
`top: 32`"* at 1280. Rendered at the wave-11 base in a real browser, with a real viewport resize:
**ten of the fourteen sit at `top: 32` and four wrap to `top: 70`** — `Set facing`, `Calibrate`,
`Undo`, `Redo` — with `DesignerViewMenu`'s `<summary>` at `top: 72`. Two tool rows, three visual
rows, and `.rp-designer-toolbar` measures **69 px** rather than the 65.9 px recorded above.

**The cause is not a careless measurement; it is a measurement taken of the toolbar BEFORE the
change that was being made to it.** The widest label recorded above, `Draw rounded rectangle` at
**157 px**, measures **179 px** now — the glyph plus `gap: var(--size-4-1)`, about +22 px on every
button — and fourteen of those is what pushes the labelled row over. So the rule shows the text at
exactly the width where the text used to fit. The row counts at 760 and 580 are improved rather than
falsified, because at those widths the labels are hidden and the icons are what is measured: **32 px
and one row at 760** against 69 px and two here, **69 px and two rows at 580** against 107 px and
three. The card's gain is real; the claim about its own boundary is not.

This repository's rule is that the sentence is written from what the measurement printed AFTER the
change. This is that rule caught one wave late, and the correction is recorded here rather than in
`designer-toolbar.css` because that file is card W11-A's lease at the time of writing. **Whether
AD18 item 5 repairs it is arithmetic and not yet a rendering**: removing the four shape buttons
frees 502.0 px of button and four gaps, leaving the ten remaining plus the summary at about 1059.6 px
against 1264 px available — one row, if it holds. It is owed a rendered check on the candidate, and
this sentence is deliberately not written as though that check had happened.

**CLOSED before session fourteen. The rendered check the paragraph above says is owed HAS since
happened, and this document did not record it.** The instrument this section nominated for itself —
`grep -rn "HostIcon" src/presentation/designer/`, recorded above as returning **0** — returns
**3**. The four shape buttons are filtered out of `DesignerToolbar` and drawn by `DesignerAddPanel`
instead (AD18-R3), and `styles/designer-toolbar.css` carries the post-change rendered measurement in
its own docblock, naming a commit, a browser and a per-button `top`: one row at 1280 with the labels
shown, and 69 to 32 at 1280, 32 to 32 at 760, 69 to 32 at 580 across the band.

**Read the closure narrowly, because one figure in it is still unexplained**: at 460 px the region
measures 65.9 px over a single tool row, and nobody knows what takes the second visual row.
`designer-toolbar.css` says so itself. That is a carried-forward LOOK, not the wrapping-text-toolbar
gap this section was written about.

`grep -rn "HostIcon" src/presentation/designer/` returns **0**, against 20+ files under
`src/presentation/editor/`. C12 asks to *"match the current Plan Editor's interaction
conventions"*, and `DesignerToolbar.vue`'s own docblock records that the Plan Editor's text toolbar
**was retired** in favour of a context bar plus a floating Select/Add group.

**Not governed by §4 row 11**, which defers *"freehand/advanced path icons"* — two specific tools,
not iconography as such.

### 6. An 887 px inspector in a 625 px column, untabbed

Measured with a plain footprint selected: `scrollHeight 887` against `clientHeight 625` in a 224 px
column — **42 % below the fold before any clearance or review block appears**. Placement,
Reference, Clearance and the clearance-review answer are all below it.

That figure is STATE-DEPENDENT and the sentence has to say so: with nothing selected the integrator
measured `scrollHeight` and `clientHeight` both at 710 in the same column, so the panel overflows
only once a part is selected. Anyone re-measuring must select a footprint first or they will
conclude there is no problem.

Both boards tab this panel; they disagree on the tab set (see above), so the split is a decision
this package has to take rather than copy.

### 7. Reference tracing is guided once, in prose, then not at all

**CLOSED before session fourteen, and recorded here because this document was behind the tree.**
`DesignerTraceChecklist.vue` exists and draws the five steps — AD12-R1's deleted step 3 absent,
count pinned by a test — with the current row carrying `aria-current="step"` and finished rows a
visually hidden `designer.trace.done`. It is mounted **outside** `DesignerReferenceStatus`'s
`v-if="relevant"` on purpose, so the sequence is no longer prose in an empty state: the guide is
drawn for an asset that has no reference at all.

**This section carried no closure line while the code was in the tree**, and `RESUME.md`
inherited that. What remains is a LOOK rather than a gap, and W10-B's own report named it: whether
the weight change on the current row reads as a highlight at all. AD18-R4 was itself taken
against a rendered description rather than a rendered picture.

Board 02 draws a six-step checklist with the current step highlighted: choose image → calibrate
scale → *lock reference* → trace footprint → add details → verify dimensions.
`DesignerReferenceStatus.vue` ships sheet, scale, a Remove button and pending warnings; the
sequence appears only as prose in the empty state.

**AD12-R1 deletes step 3 and only step 3.** The other five are AD12 card item 1's *"guided
sequence"* and are not ruled out.

### 8. The vanity fixture does not exist — and it is the other ADOPT row

§4 row 2: *"Vanity as an integrated example; adopt as a test fixture."* The shipped preset
catalogue is Tables (Rectangular, Round, Oval, Curved), Seating (Chair, Armchair, Sofa), Bathroom
(Toilet, **Washbasin**, Shower tray, Bathtub), plus plants and beds. There is no vanity preset and
no vanity fixture anywhere.

AD01 §3 assigns this row to **AD15**, which is `in_progress` — so it is not-yet-built rather than
forgotten. Worth naming here because the boards' single worked example exists nowhere in the
product, which is part of why the shipped surface "does not look like" them: every screenshot in
the concepts is of an object the user cannot make.

**AMENDED 2026-09-22 (session thirteen) by ruling AD18-R8: a vanity ships as a PRESET, and the
preset IS the fixture. The ownership sentence above is also stale twice over.**

The user authorized a preset directly — *"add the vanity preset and canvas rulers and also close
existing gaps"* — which is **wider than §4 row 2 asks for**. Row 2 says, at source, *"Adopt as a test
fixture; dimensions are illustrative, not construction recommendations."* Every summary of it says
"vanity" and drops the word that matters. The widening is authorized and is recorded in AD18-R8 so a
later session does not "correct" it back to fixture-only.

**The fixture half was REFUSED rather than forgotten, and this section never said so.** AD15-R2
(2026-09-22) declined a composed-vanity builder in `tests/helpers/assetShapes.ts` on two named
grounds: with no consumer it is a dead export and `npm run analyze` fails on one, and with a consumer
that consumer re-drives `arrangeDetails.test.ts` and `groupEdits.test.ts` under a themed name.
**A preset removes both premises** — it is `src/` product code whose consumers are `ASSET_PRESETS`,
`AssetPresetForm.vue` and `presetThumbnail`, and it is driven by `presets.test.ts`'s existing
`describe.each` rather than by a themed re-drive. So F02's fixture is the preset itself, reached as
`ASSET_PRESETS.find((p) => p.id === 'vanity')`, and no builder is written. AD15-R2's losing side
stands unchanged for the builder it was actually about.

**Board 01's *Include basin* toggle is DROPPED**, under this document's own first rule: it has
nowhere to live (`PresetFieldKey` is a closed ten-key union, `kind` is exactly
`'length' | 'count' | 'angle'`, so there is no boolean and no `height`), and a vanity without a basin
is a cabinet while `washbasin` already ships for the basin-only case. **Wood-grain artwork stays
absent** under §4 row 12 — the thumbnail is derived from the built shape, so nothing is authored.

**The two recorded sizes disagree and both are in this package**: board 01 draws **800 × 450** under
Bathroom, while `references/previous-expansion-concept.md` §11's end-to-end scenario says *"creates a
1,000 × 500 mm vanity"*. The preset takes 800 × 450 as its DEFAULT with a range spanning 1,000 × 500,
so neither document is contradicted.

## Two smaller things found in the same pass

- **`Used in plans` wraps badly at 224 px** — `Loft conversion — 1 placement(s)` renders over two
  lines with the hyphen orphaned, and the copy is the untranslated plural spelling
  `placement(s)`. Visible in both themes.

  **AMENDED 2026-09-20, wave 10 integration: the 224 px half of that sentence is NOT reproducible,
  and the wrap threshold is measured.** Rendered in a browser against the running harness, which is
  the only instrument here that lays text out: at a **224 px** rail the row is **one line** (row box
  191 × 16) with room to spare. Narrowing the rail directly, the second line appears between **224
  and 210 px** — one line at a 191 px row box, two at 177 px. So at the width this bullet names, it
  does not wrap.

  **AMENDED AGAIN 2026-09-21, session ten: the copy half is WITHDRAWN under ruling AD18-R7, and it
  was wrong in both of its words.** It is not *untranslated* — `de/assetDuplicate.ts` spells
  `Platzierung(en)`, so German has it. And it is not a lone *spelling*: `(s)` is a house convention
  this tree argues for in writing, in `en/assetDuplicate.ts`'s own header, which says it was
  *"copied from `view.asset-library.used-in.project` rather than invented"* and refuses a plural
  mechanism because `t` has none. That precedent exists — `en-assetLibrary.ts` spells
  `requirement(s)`. Three keys carry the convention and fixing one leaves the other two two lines
  apart in the same file, so this bullet asked for a change that would make the tree less
  consistent than it found it. `AD18-R7` in `contracts/DECISIONS.md` carries the ruling, the
  commands that measure the convention, and the losing side.

  The orphaned hyphen was never re-checked, because the state it was reported in does not occur at
  the stated width — that half is neither confirmed nor withdrawn.

  **This matters beyond the bullet, because W10-A's review reasoned FROM it.** That review read this
  sentence and concluded the item-6 rail caps make "a known-bad thing 30 % worse". The measurement
  says something different and slightly worse: the caps put the rail at 157–224 px across 560–800,
  so they **INTRODUCE** the second line across that whole band rather than deepening an existing
  one. It remains a 1 → 2 line reflow with no overflow and no clipping, against a canvas that goes
  from 31.0 % to 50.0 % of the shell at 580 — the trade is still worth taking, and it is now
  measured rather than estimated at both ends.

  Where the original reading may have come from, left as a question rather than a claim: a 460 px
  leaf, where `designer-narrow.css` stacks the columns and the inspector is no longer 224 px at all.
  Nobody has re-measured that width, so nobody should say.
- **`Show grid` defaults off.** A measurement surface opens with no visible scale reference and no
  zoom readout at the same time. Neither alone is a defect; together they are what makes the empty
  canvas read as a blank void rather than a drawing board.

  **WITHDRAWN 2026-09-22 (session thirteen). Both halves of the pairing are gone, and the default was
  never a defect.** The zoom readout shipped at `cf305ad88`, so the "at the same time" that carried
  this bullet no longer holds. And the default is a DECISION, taken and written down before this
  bullet was written: the approved snapping spec's §2.6 says *"Defaults as the plan editor's: Grid
  off, Snap on."* A default that matches the surface next door, on purpose, is not a void.

  **A separate inherited claim about this is also false and is recorded here because it reached two
  hand-offs.** It read *"one shared `WorkspaceStore.gridVisible` … flipping the designer flips the
  Plan Editor"*, and nothing about it survives measurement: each view calls `app.use(createPinia())`,
  `WorkspaceStore`'s own header ends *"Each leaf has its own Pinia scope"*, and the per-device slots
  are **different keys** — `assetDesignerDeviceSlots`' `${pluginId}:designer-view` against
  `planEditorDeviceSlots`' `${pluginId}:editor-view`. So §2.6's *"their own slot, separate from the
  plan editor's"* is already satisfied. **The source of the error is one parenthetical** in
  `DesignerCanvas.vue` — *"(its `gridVisible` is shared)"* — which is about layer visibility being a
  Plan Editor concern and reads as though it were about the value. What is genuinely owed is small:
  `assetDesignerDeviceSlots`' docblock asserts that separation in prose and **no test pins that the
  two keys differ.**

## Sequencing, and what each item costs

Ordered by cost-to-user over effort, not by board position.

| # | Item | Shipped precedent to copy | Touches |
|---|---|---|---|
| 1 | Zoom readout in the status region | `StatusBar.vue`'s `zoomPercent` | one region, one locale key |
| 2 | Restrained header | `EditorContextBar.vue` | new region in `AssetDesignerRoot.vue`; **decide** whether the inspector keeps drawing the name |
| 3 | Icon toolbar | `HostIcon.vue`, the Plan Editor's retired-text-toolbar precedent | `DesignerToolbar.vue`, locale keys become `aria-label`s; harness icon fixtures needed |
| 4 | Tabbed inspector | none in this repo — the Plan Editor's side panel is not tabbed | `DesignerInspector.vue`; **needs a decision** on the tab set, which the boards contradict each other on |
| 5 | Add rail | the preset gallery exists; the tab control does not | `AssetDesignerRoot.vue` region, a new panel, and a decision about what happens to the toolbar's shape buttons |
| 6 | Canvas proportion at 560–900 px | `editor-layout.css`'s constrained answer, explicitly refused once for this surface | `designer-narrow.css` — rails that shrink, or a second breakpoint |
| 7 | Guided trace checklist | none | `DesignerReferenceStatus.vue` |

**Items 2, 4, 5 and 6 each need a decision taken before code**, and each of those decisions has a
losing side worth writing down. Items 1 and 3 do not — they have a shipped pattern and a measured
defect.

## What no gate in this repository can check about any of it

Every item here is a claim about APPEARANCE and PROPORTION. jsdom computes no layout, so the suite
cannot see a wrapped toolbar, a fold, or a column share. The instruments that can are:

- `npm run harness` in a real browser, which is how every number above was measured;
- `npm run harness-shot`, **with the caveat that there is no pinned Chromium on this machine** —
  `playwright-core` pins revision 1234 and the cache holds 1223, so captures go through
  `RP_CHROMIUM_EXECUTABLE` and the script announces they are not the pinned build;
- `npm run test-build` and a person, which is how this whole package was found.

A test can pin what a rule DECLARES (`designerStyles.test.ts`) and, since wave 8, what a container
query RESOLVES to against a mounted tree (`designerNarrowQueryResolved.test.ts`). Neither is a
measurement of the rendered result, and no item here should be reported as verified on one.

---

## Items 1, 2 and 4 are DELIVERED, and item 2 was RENDERED before this was written

Item 1 (zoom readout) `cf305ad88`; items 2 and 4 (header, `Object | Reference` tabs) merged at
`f0500806b` under rulings AD18-R1 and AD18-R2.

**The card itself could not see either surface drawn** — no pinned Chromium, and jsdom lays nothing
out — and its report said so. The integrator then drew both in a real browser against the running
harness, which is the one instrument here that applies layout. **Everything below is a rendered
measurement, not a template read.**

### What renders correctly

| At 1280 | Measured |
|---|---|
| Header region / title bar | 1280 × 32 / 1264 × 19.5 |
| Asset name | 1201.5 px, NOT clipped |
| Tab strip | 207 × 31, `Object` `aria-selected="true"` `tabindex="0"`, `Reference` `tabindex="-1"` |
| Tab panels | both `tabindex="0"`, `aria-controls` and `aria-labelledby` cross-linked, `Reference` at `display: none` |
| Header landmark | `<header aria-label="Asset designer header">` |
| Heading outline | `h2` Kitchen island → `h2` Parts → `h2` Inspector → `h3` Asset → `h4` Used in plans. **No `h1` anywhere** |

**Item 4's problem is measurably solved at this state**: `.rp-designer-inspector` reports
`scrollHeight` 678 against `clientHeight` **678** — it no longer overflows, where the untabbed
panel was 887 px of content in a 625 px column. Read that narrowly: it is the resting state with
nothing selected, not the worst case the 887 figure came from.

At 460 px the body stacks to `flex-direction: column`, the header stays 32 px, the name is unclipped
and the document takes no horizontal scroll.

### The reviewer's highest-risk case, measured — REAL but BOUNDED

W9-A's reviewer named one thing no instrument here could reach: `tests/harness/assetDesigner.ts`
binds neither `openLibrary` nor `usePlan`, so **the only header a capture can ever photograph is
name + save state**, and the worry was that at a 460 px sidebar leaf those two buttons against a
shrinkable name could reduce the asset name "to an ellipsis and a letter or two".

Measured by injecting both buttons into the rendered title bar at 460 px, in the real markup order:

| Name | Name box | Clipped? |
|---|---|---|
| `Kitchen island` (14 chars) | 140 px | no |
| `Kitchen island with breakfast bar` (33) | 140 px | **yes**, ellipsis, ~21 chars visible |
| 66 characters | 140 px | **yes**, ellipsis, ~21 chars visible |

Title bar stays 30 px, nothing overflows, no horizontal scroll. So the degradation is GRACEFUL and
the feared outcome does not occur — about twenty-one characters survive, not two.

**What is still worth a decision**: the two buttons take **143.6 + 81.6 = 225 px of 460**, more than
the 140 px left to the name they sit beside, at exactly the width where identifying the asset is
hardest. That is not a defect against any ruling and no gate can see it; it is a proportion
question, and it belongs with **item 3 (icon toolbar)** and **item 6 (canvas proportion at
560–900 px)** rather than being fixed alone — the same answer that would shrink those labels to
icons would fix this.

**The injection is a probe, not a fixture.** It proves what the layout does with those two controls
present; it does not make them present in any capture. Closing that properly means the harness
fixture binding both doors, which is AD18's own outstanding item and is a decision about
`tests/harness/assetDesigner.ts`'s deliberate `background: null` / unbound-deps posture.
