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

Measured at three widths: **880 px @1280 (69 % of the shell) → 360 px @760 (47 %) → 180 px @580
(31 %)**. Both rails are fixed — `.rp-designer-parts` 176 px, `.rp-designer-inspector` 224 px at
every width measured — so the canvas absorbs 100 % of the loss. `designer-narrow.css` stacks the
columns only below **35 rem (560 px)**, which puts the worst case immediately ABOVE its own
breakpoint, where the canvas is narrower than the inspector alone.

AD06's acceptance criterion is *"controls do not overlap the drawing or disappear offscreen"*.
Nothing overlaps, so that gate passes while the ADOPT row fails. Wave 8's W8-B card now resolves
that container query against the mounted tree, so a regression here is at last visible to a test —
but only for `display`-shaped hiding, which is a different question from proportion.

### 5. A wrapping text toolbar, against the Plan Editor's own convention

14–15 text buttons. Measured: 1174 px of buttons in a 1264 px toolbar at 1280 (the View menu
already wraps); **2 rows at 760 px; 4 rows and 107 px — a tenth of the leaf height — at 580 px**.
The widest single label, `Draw rounded rectangle`, is 157 px.

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

Both boards tab this panel; they disagree on the tab set (see above), so the split is a decision
this package has to take rather than copy.

### 7. Reference tracing is guided once, in prose, then not at all

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

## Two smaller things found in the same pass

- **`Used in plans` wraps badly at 224 px** — `Loft conversion — 1 placement(s)` renders over two
  lines with the hyphen orphaned, and the copy is the untranslated plural spelling
  `placement(s)`. Visible in both themes.
- **`Show grid` defaults off.** A measurement surface opens with no visible scale reference and no
  zoom readout at the same time. Neither alone is a defect; together they are what makes the empty
  canvas read as a blank void rather than a drawing board.

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
