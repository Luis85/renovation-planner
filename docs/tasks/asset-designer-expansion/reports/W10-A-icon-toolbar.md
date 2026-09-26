# Task report — W10-A (AD18 items 3 and 6)

Outcome: **implemented**, with one deliberate narrowing of the card's literal instruction, argued
below under *What I believe is wrong in the card*.
Owner / worktree / branch: W10-A / `.worktrees/ad07` / `ad18-icon-toolbar`
Base commit / candidate commit: `862f663b1` / **the tip of `ad18-icon-toolbar`, reported in the
hand-off message.** A commit cannot carry its own hash: the first revision of this line named
`ba740aa11`, which was the pre-amend object and therefore never the candidate — exactly how that
goes wrong, and why the line no longer tries.
Accepted contract revision: `r1`
Allowed scope and shared-file leases: the wave 10 table's W10-A row. **Nothing outside it was
edited.** In particular `tests/helpers/designerRig.ts`, `tests/presentation/designer/designerToolbar.test.ts`,
`tests/helpers/editorIconNodes.ts` and `{en,de}/editor.ts` were read and left alone.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/DesignerToolbar.vue` | The three runs the template draws, and the `MODES` rows joined to their glyphs | yes — EDIT |
| `src/presentation/designer/tools/designerToolIcons.ts` | **NEW.** `DESIGNER_TOOL_ICONS` — the glyph and the `'tool' \| 'shape'` group per tool, total over `DESIGNER_TOOL_LABELS`. A module beside that table, for the same reason that table is one | yes — CREATE under `src/presentation/designer/`, granted explicitly in the fix round |
| `src/presentation/designer/DesignerToolButton.vue` | **NEW.** One button: a native glyph, the label beside it, and the label again as `aria-label` | yes — CREATE under `src/presentation/designer/` |
| `styles/designer-toolbar.css` | **NEW.** The icon/label box, the width at which the text is hidden, the shape group, and item 6's rail caps | yes — CREATE a partial under `styles/` |
| `styles/index.css` | ONE `@import` line for that partial, and nothing else | yes — integrator lease, additive only |
| `src/presentation/i18n/locales/en/designerToolbarIcons.ts` | `designer.shapes.group` — the shape group's name, keyed for the SHAPE rather than for the toolbar, per the user's ruling | yes — EDIT |
| `src/presentation/i18n/locales/de/designerToolbarIcons.ts` | Its German half | yes — EDIT |
| `tests/presentation/designer/designerIconToolbar.test.ts` | **NEW.** Nine cases over the mounted toolbar and the declared stylesheet | yes — CREATE any test file |
| `docs/tasks/asset-designer-expansion/reports/W10-A-icon-toolbar.md` | This report | yes — the card's deliverable 2 |

`designer.css` was NOT touched (397 lines against the 400-line cap, as the card warned), and
neither were `designer-selection.css` or `designer-narrow.css`, both of which were leased and
turned out not to be needed — the second deliberately, see *the disjoint container query* below.

## What was built

**Item 3 — the icon toolbar.** All fourteen buttons are now `DesignerToolButton`: a `HostIcon`
(native `setIcon`) plus the label, with `aria-label` carrying the same string at every width.
`styles/designer-toolbar.css` hides the visible label below **80rem**, so at every leaf narrower
than 1280px the toolbar is icons and the accessible name is the `aria-label`.

**The shape group.** The four drawing tools (`draw-rect`, `draw-rounded-rect`, `draw-circle`,
`draw-line`) are gathered into one `role="group"` named `designer.shapes.group` ("Basic shapes"),
and `src/presentation/designer/tools/designerToolIcons.ts` carries a `group: 'tool' | 'shape'`
field per tool. **What wave 11 has to do**: change where the `'shape'` rows are drawn. Concretely
— `import { DESIGNER_TOOL_ICONS }`, filter `group === 'shape'`, render those four in the `Add`
rail, and delete `SHAPE_MODES`/`.rp-designer-shape-tools` from the toolbar; `LEADING_MODES` and
`TRAILING_MODES` then concatenate into one loop.

**That import is the fix round's second finding and it was a real defect, not a wording one.**
This table began as a `const` inside `DesignerToolbar.vue`'s `<script setup>`, and a script-setup
binding is NOT a module export — so the `Add` rail, being a new component, could not have read it
at all. The sentence promised something the structure refused. The table moved into a module
beside `DESIGNER_TOOL_LABELS`, which already lives in `tools/` for this identical reason; no
value changed in the move, and the type-level totality moved with it (the import is a `import
type`, since `keyof typeof` is all this module asks of that table — so there is no runtime edge
to the registration module and the icons are importable from wherever the rail ends up). The locale key and
the `role="group"` wrapper move with them, which is why the key is `designer.shapes.*` and not
`designer.toolbar.*`. Nothing else in the toolbar is redrawn, and the tool table
(`DESIGNER_TOOL_LABELS`) does not change at all, so the tools stay registered and reachable while
the buttons move.

**Item 6 — canvas proportion.** The decision taken, and the losing side:

- **Taken: rails capped at a share of the container** — `.rp-designer-parts` at
  `min(11rem, 22cqi)` and `.rp-designer-inspector` at `min(14rem, 28cqi)`, inside
  `@container rp-designer (width >= 35rem)`. `22 + 28 = 50`, so the two rails never take more
  than half the leaf and the canvas never takes less. Both caps bite only below 800px, so 1280 is
  byte-for-byte what it was; at 580 the arithmetic gives **128 / 290 / 162** where the audit
  measured 176 / 180 / 224 — canvas 31.0% → **50.0%**.
- **Refused: a second breakpoint.** A stepped rail width is right at one width inside the
  560–900px band and wrong across the rest of it, and it adds a third state to a shell that
  already has two.
- **The cost, on the rail side, because the canvas does not gain from nowhere.** Across
  560–800px the inspector goes from a fixed 224px to **157–224px** and the Parts panel from 176px
  to **123–176px**. That lands on a panel already known to be too narrow: AD18's "Two smaller
  things found in the same pass" records `Used in plans` wrapping badly AT 224px —
  `Loft conversion — 1 placement(s)` over two lines with the hyphen orphaned — so this makes a
  known-bad wrap worse rather than introducing a new one, across exactly the band it targets.
  Taken anyway: the canvas is the subject of the surface and was the smallest of the three
  columns, where the inspector's cost is a wrapped line in a panel that already scrolls. **How
  much worse is deliberately NOT estimated** — nothing here lays text out, so a number from
  arithmetic would be a guess wearing a decimal point; the integrator is rendering and measuring
  it. The same paragraph is in `styles/designer-toolbar.css`, where the decision is.
- **Refused because it cannot work: `flex-shrink`.** The canvas is `flex: 1`, whose basis is 0, so
  the three bases sum to 400px inside a 580px container — POSITIVE free space, which the canvas
  grows into and where no shrink factor is ever consulted. A rail that shrinks has to be a
  function of the container width, which is what `cqi` is.
- **The 35rem floor is the complement of `designer-narrow.css`'s stacking query, deliberately.**
  The two blocks are DISJOINT rather than ordered, so `styles/index.css`'s import order decides
  nothing here — below 35rem the body is a column and both rails take `width: auto`, and a cap
  reaching in there would pin a stacked rail to 22% of the leaf. This is also why that file was
  not edited: `designerNarrowQueryResolved.test.ts` reads `styles/designer-narrow.css` and no
  other partial, and keeping the new rules out of it keeps that instrument's scope exactly as its
  own header describes it.

`min()` and `cqi` survive the build's lightningcss minification — checked by running
`assembleStyles()` and `transform({ minify: true })` and reading the output back (evidence in
*Executed checks*), because a unit the minifier dropped would be a silent no-op.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD18 item 3: the toolbar uses `HostIcon` | met | `grep -rn "HostIcon" src/presentation/designer/` printed **3 lines** after the change (0 before): the import and the element in `DesignerToolButton.vue`, plus the sentence in `DesignerToolbar.vue`'s docblock that says so. `grep -rln HostIcon src/presentation/editor/ \| wc -l` = **40** | the Plan Editor comparison is a file count against a line count; they are different measurements and the docblock says which is which |
| Item 3: the label becomes the accessible name | met | `names every button with the label it used to spell as text, and draws one glyph in each` — 14 `aria-label`s equal to the 14 `t('en', …)` labels, 14 glyphs | none |
| Item 3: no glyph is silently substituted | met | `records the three requested glyphs the harness has no fixture for, and no others` pins `['anchor', 'circle', 'squircle']` | those three draw EMPTY in `npm run harness`; see *Verification not performed* |
| The user's ruling: shape buttons iconified in place, liftable later | met | `holds exactly the four drawing tools, under a name of its own`; `group` field in the icon table | wave 11 still has to build the rail |
| Item 6: canvas is the largest column in 560–900px | **declared, not rendered** | `caps both rails at half the leaf between them, above the width where the body stacks` pins both declarations and the `22 + 28 = 50` arithmetic they are built from | jsdom resolves no `cqi`; a browser must confirm |
| AD06 criterion (controls do not overlap or vanish) | unchanged | no region was removed or repositioned; the toolbar's `flex-wrap` and the stacked layout are untouched | none |
| Existing toolbar behaviour | unchanged | `tests/presentation/designer/designerToolbar.test.ts` — **`Tests 44 passed (44)`, file not edited**, including its exact 14-button order, its "no button carries a `title`" case and its active-class/`aria-pressed` pair | none. **This line read "52 cases" in the first revision and that was wrong**: 52 was the PASSING count of a two-file run in which one case of the other file was failing, misattributed to this file alone. Re-run alone at the fix-round tip, it prints 44. The one sentence offered as this report's strongest evidence carried a count nobody re-ran |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | candidate, Windows, Node from the worktree | 0, no output | run twice, after each of the two component shapes |
| `npx oxlint --deny-warnings <6 changed files>` | candidate | 0, no output | run by hand because every edit here was scripted and therefore invisible to `scripts/lint-edited.mjs` |
| `npx eslint --max-warnings 0 <6 changed files>` | candidate | 0, no output | same reason; this is where the Vue ruleset lives |
| `npx vitest run tests/presentation/designer` (68 files) | candidate | **68 passed, 939 tests** | the whole designer directory, including the untouched `designerToolbar.test.ts` |
| `npx vitest run tests/presentation/designer/designerToolbar.test.ts` — ALONE | fix round | **`Test Files  1 passed (1)`, `Tests  44 passed (44)`** | the re-measured count. The first revision of this report said 52, which was a two-file run's PASSING total (53 cases, one failing in the other file) misattributed to this one |
| `npx vitest run designerIconToolbar + designerToolbar + designerViewMenu + tests/build/styles.test.ts` | fix round | **4 passed, 140 tests** | after the `DESIGNER_TOOL_ICONS` extraction and the element-qualified button selector; `designerViewMenu.test.ts` added because that `<summary>` is what the qualification protects |
| `npx vue-tsc -noEmit`, `npx oxlint`, `npx eslint --max-warnings 0` on the new module and the toolbar | fix round | 0, no output | the extraction's own `import type` correction came from `scripts/lint-edited.mjs` reporting `consistent-type-imports` |
| `npx vitest run tests/build/styles.test.ts` | candidate | **79 passed** | the assembler: the 400-line cap, the unresolved-import refusal and SDD §84's colour check over the new partial |
| `npx vitest run tests/harness/accessibility.test.ts accessibilityDesignerSelection.test.ts assetDesignerSelectKnob.test.ts harness.test.ts` | candidate | **90 passed** | axe-core over the mounted surfaces, with the new `role="group"` and the new `aria-label`s in place |
| `npx vitest run tests/presentation/i18n …` | candidate | **131 passed** | the new locale key against both tables |
| `node -e "assembleStyles() → lightningcss transform({minify:true})"` | candidate | printed `@container rp-designer (width>=35rem){… width:min(11rem,22cqi)}` and `@container rp-designer (width<80rem){… display:none}` | proves the minifier keeps `cqi` and `min()` rather than dropping them |

### Watched failing first — verbatim

Every invariant asserted in a new comment was reverted, run, seen red, and restored.

**1. The accessible name.** Removed `:aria-label="tr(label)"` from `DesignerToolButton.vue`:

```
 FAIL  |suite| tests/presentation/designer/designerIconToolbar.test.ts > every toolbar button is an icon with a name > names every button with the label it used to spell as text, and draws one glyph in each
AssertionError: expected [ undefined, undefined, …(12) ] to deeply equal [ 'Pan', 'Select', …(12) ]

- Expected
+ Received

  [
-   "Pan",
-   "Select",
-   "Trace footprint",
…
+   undefined,
+   undefined,
```

and, in the same run, the group case:

```
 FAIL  |suite| … > the Basic shapes group > holds exactly the four drawing tools, under a name of its own
AssertionError: expected [ undefined, undefined, …(2) ] to deeply equal [ 'Draw rectangle', …(3) ]
```

**2. A distinct glyph per button.** Changed `draw-circle`'s icon from `circle` to `minus`, which
is already `draw-line`'s:

```
 FAIL  |suite| … > asks for a distinct glyph per button, which is all that tells them apart once the text is hidden
AssertionError: expected 13 to be 14 // Object.is equality

- Expected
+ Received

- 14
+ 13
```

and the missing-fixture pin caught the same edit from the other side, which is what makes it an
instrument rather than a note:

```
 FAIL  |suite| … > records the three requested glyphs the harness has no fixture for, and no others
AssertionError: expected [ 'anchor', 'squircle' ] to deeply equal [ 'anchor', 'circle', 'squircle' ]
```

**3. The label is hidden only under the container query.** Lifted the `display: none` rule out of
`@container rp-designer (width < 80rem)`:

```
 FAIL  |suite| … > what the stylesheet declares > draws the button text only at 80rem and wider
AssertionError: expected [] to deeply equal [ { type: 'keyword', value: 'none' } ]
```

**4a. The button rule reaches no element that is not a button.** Dropped `button` from
`.rp-designer-tools button.rp-designer-tool-button`, which is what an ordinary tidy-up would do
— and which would hand `DesignerViewMenu`'s `<summary>` an `inline-flex` nobody asked for, since
that summary carries `.rp-designer-tool-button` and is the fifteenth such element in this
toolbar:

```
 FAIL  |suite| … > what the stylesheet declares > lays the button out as an icon beside its text, and reaches no element that is not a button
AssertionError: expected [] to deeply equal [ { type: 'pair', …(3) } ]
```

**4. The rail caps sum to half the leaf.** Changed the inspector cap from `28cqi` to `30cqi`:

```
 FAIL  |suite| … > what the stylesheet declares > caps both rails at half the leaf between them, above the width where the body stacks
AssertionError: expected [ { type: 'length-percentage', …(1) } ] to deeply equal [ { type: 'length-percentage', …(1) } ]
@@
                  "type": "dimension",
                  "value": {
                    "unit": "cqi",
-                   "value": 28,
+                   "value": 30,
```

**5. The one red I did not plant.** `pressed` and `disabled` began as props of
`DesignerToolButton`, and Vue casts an ABSENT prop declared `boolean` to `false` — so Undo and
Redo rendered `aria-pressed="false"`, announcing themselves as toggles that happen to be off:

```
 FAIL  |suite| … > gives the history pair no pressed state at all, where a mode button has one either way
AssertionError: expected 'false' to be undefined

- Expected:
undefined

+ Received:
"false"
```

The fix is that the component takes the label and the glyph and nothing about state: the caller
passes `aria-pressed`, the active class, `disabled` and `@click` as ordinary attributes, which
fall through to the single root element. An attribute the caller does not pass is then simply
absent, and the component never has to model the difference. `DesignerToolButton.vue`'s docblock
carries that account with the verbatim failure in it.

## Per-file coverage

`npx vitest run tests/presentation/designer --coverage`, scoped to the three changed source files
with the repository thresholds set to 0 so the run reports rather than gates. Read per file from a
`json-summary` reporter, because the text table collapses several files into one line:

| File | Stmts | Branches | Funcs | Lines | Units |
|---|---|---|---|---|---|
| `DesignerToolbar.vue` | 100% | 100% | 100% | 100% | 22 / 8 / 11 / 20 |
| `DesignerToolButton.vue` | 100% | 100% | 100% | 100% | 2 / 0 / 0 / 2 |
| `tools/designerToolIcons.ts` | 100% | 100% | 100% | 100% | 1 / 0 / 0 / 1 |

**Zero uncovered units on all four metrics, counted in UNITS as the guide asks** — not "the
percentage did not visibly move". The toolbar's statement and line totals fell by one each when
the icon table moved out of it, which is the extraction and not a lost test.

**Read this narrowly.** It is a per-file reading over the designer suite, NOT the repository
threshold, and coverage of a file is a property of the WHOLE suite — a run this narrow
under-reports any arm another directory's test reaches. The gate is the integrator's
`npm run test:coverage`.

**Five files in that run failed and none of it is this change**, stated rather than hidden. The
same five-ish set failed the same way before the fix round (four then, every one
`Test timed out in 5000ms` at 7.2–9.0s, plus one `[vitest-pool]: Failed to start forks worker`) —
the timeout-under-load pattern CLAUDE.md names, on a shared box under coverage. **The same
directory was re-run WITHOUT coverage at the fix-round tip and is `Test Files  68 passed (68)`,
`Tests  939 passed (939)`.** A failing file can only REMOVE coverage from the report, so the 100%
above is not flattered by them.

## Verification not performed

Never blank; each with its reason.

- **`npm run check`, `npm run test:coverage`, `npm run analyze`, `npm run lint` (whole tree),
  `npm run build`.** Forbidden to this card — they are the integrator's and this box is shared.
  What that leaves unseen: `eslint .` over files I did not lint by hand, the real coverage floors,
  fallow's dead-file/duplication/dependency findings, and a real `vite build`. **The likeliest
  fallow finding is named rather than left to be discovered**: `DesignerToolbar.vue`'s template
  draws `DesignerToolButton` in three seven-line blocks that differ only in which list they loop
  over, because Vue has no way to wrap a SUBRANGE of one `v-for` in a grouping element and the
  shape group has to sit where those four buttons already sit (moving them would change the DOM
  order `designerToolbar.test.ts` pins exactly). If it is reported, the honest fix is wave 11's —
  once the shape rows move to the `Add` rail the three blocks collapse back into one.
- **The whole test suite.** Run: `tests/presentation/designer` (68 files), four
  `tests/harness/` files, `tests/presentation/i18n`, `tests/build/styles.test.ts`. NOT run:
  everything else, including `tests/build/lint-scope.test.ts`, `tests/build/suppressions.test.ts`
  and the other `tests/presentation/` directories. Nothing I touched is imported outside the
  designer, the locale tables and the stylesheet, but that is an argument, not a run.
- **Any rendered measurement.** There is no pinned Chromium in this environment
  (`playwright-core` pins a revision the cache does not hold), so `npm run harness`,
  `npm run harness-shot` and `npm run concept-shots` were all NOT run. **Every layout claim in
  this report is declared-and-unrendered.** Specifically unverified: that the icon row fits one
  row at 580px, that 80rem is the right width to switch the labels at, that the capped rails
  actually leave the canvas 50% at 580px, and that the icon buttons clear a 24×24 target.
- **`npm run test-build` and a vault.** Not run. So: whether Obsidian's installed catalogue
  answers `squircle`, `circle`, `anchor`, `land-plot` and `square-dashed` at all, and whether
  Obsidian draws its own tooltip from these `aria-label`s — the sentence the icon-only state rests
  on. `HostIcon` never substitutes, so an unanswered name renders as an empty button in a vault
  too. **This is the highest-risk unverified thing in the change** and it is one glance in a live
  vault.
- **The three missing harness fixtures.** `tests/fixtures/editor-icons/` has no `circle`, no
  `squircle` and no `anchor`, so those three buttons draw EMPTY in the browser harness and in any
  capture. Adding them is out of lease twice over: the SVG bytes must come from the pinned Lucide
  revision (`2bfb9bb1…`), which this offline worktree does not carry, and the harness renders from
  `tests/helpers/editorIconNodes.ts`, a generated map I do not hold — an SVG added alone would
  change nothing. **I refused to transcribe the three from memory**: that would be fabricated
  artwork wearing a pinned-revision provenance, which is exactly what that directory's README
  exists to prevent. The exact set is pinned by a test, so closing it is a red test rather than a
  silent improvement.
- **The narrow-leaf `display` guard is the integrator's call, not mine, and it is taken.**
  `designerNarrowQueryResolved.test.ts`'s header asserts its blind spot is empty — that the
  designer's narrow rules "contain no `display`, `visibility` or `content-visibility` at all" —
  and this change ships the first `display: none` to reach a designer toolbar control at a narrow
  leaf, from a third partial that guard does not read. My earlier framing (that leaving
  `designer-narrow.css` alone preserves that instrument's stated scope) is true of the LEASE and
  dodges the fact that the guarded surface is no longer fully guarded. Recorded here so it is not
  discovered later; the integrator has taken it.
- **Screen-reader behaviour.** No case here proves that a `role="group"` with an `aria-label`
  inside a `role="toolbar"` is announced usefully, only that the attributes are present and valid
  (axe-core agrees, in jsdom, which grades neither contrast nor focus visibility nor hit size).

## Data and integration implications

Schema/migration change: **none.** No domain type, no note format, no sidecar field.
Relevant renderer/export/revision consumers: none — this is presentation and stylesheet only.
Undo/no-op/conflict/failure coverage: unchanged. The Undo and Redo buttons keep the same handlers
and the same disabled conditions; only their markup changed.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: **none.** `{en,de}/editor.ts` already spread
`designerToolbarIcons{En,De}`, so the one new key is live; `styles/index.css` already imports the
new partial. Nothing is left for the integrator to wire.
Rollback/recovery considerations: the change is additive and reversible file-by-file. Reverting
`styles/designer-toolbar.css` plus its `@import` restores the previous proportions and the
always-visible labels without touching the components; reverting the two components restores the
text toolbar.

## Fix round — what the independent review changed

Four things, on top of `84d76fde1`.

1. **The "52 cases" count was wrong; it is 44.** Re-run alone: `Tests  44 passed (44)`. 52 was a
   two-file run's passing total with one case failing in the other file, misattributed. The
   sentence this report offered as its strongest evidence carried a number nobody re-ran — the
   rule this repository names most, broken inside the report that cites it. Corrected in the
   acceptance table with the arithmetic shown. The candidate-commit line was wrong the same way
   (it named the pre-amend object) and no longer tries to name a hash at all.
2. **`TOOL_ICONS` moved to `src/presentation/designer/tools/designerToolIcons.ts`.** The
   forward-compatibility claim was FALSE as written: a `<script setup>` binding is not a module
   export, so the `Add` rail — a new component — could not have imported the table however the
   sentence read. The table is now a module beside `DESIGNER_TOOL_LABELS`, which lives in that
   directory for this identical reason. No value changed; the import is an `import type`, since
   `keyof typeof` is all it asks of the label table.
3. **The rail-side cost of the item-6 caps is written down**, in the partial's own comment and in
   the decision list above: the inspector goes 224px → **157–224px** and Parts 176px → **123–176px**
   across 560–800, on a panel AD18 already records as wrapping badly at 224px. Not estimated
   further — the integrator is rendering it.
4. **One thing the review did not ask for, found while writing item 3.** The button rule was
   unqualified, and a fifteenth element in this toolbar carries `.rp-designer-tool-button` and is
   not a button: `DesignerViewMenu`'s `<summary>`. It is now
   `.rp-designer-tools button.rp-designer-tool-button`, with the reason in the partial and a case
   pinning the spelling, watched red first.

**Sustained, and recorded here so the corrections travel**: criticism 1 undercounted its own
evidence — `grep -rln toolbarButton tests/` is **17 files**, not "roughly ten". Criticism 2 is
RESOLVED by the integrator's rendered measurement (the View summary wraps on its own at 1280, so
65.9px is one tool row and two visual rows) and **the 80rem threshold stands**; the partial and
the report both carry that resolution now, because the next reader meets the same impossible 3.1px
otherwise. The narrow-leaf `display` guard is the integrator's call and is noted under
*Verification not performed*.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

---

## What I believe is wrong in the card

Stated because the card asks for it, and because one of these is a narrowing of its literal
instruction rather than a quibble.

**1. "The label … becomes its accessible name" reads as icon-only at every width, and icon-only at
every width cannot be built inside this lease.** `tests/helpers/designerRig.ts`'s `toolbarButton`
resolves a button by `button.text() === label`, and `designerToolbar.test.ts` asserts the exact
14-label order, the active button's `.text()` and the history group's `.text()` — all read from
the button's TEXT. Icon-only buttons make `text()` empty, which reddens those cases and
every other file that presses a tool through the rig. **The first revision of this paragraph said
"roughly ten" and undercounted its own evidence**: `grep -rln toolbarButton tests/` is **17
files**. Both `designerRig.ts` and `designerToolbar.test.ts` are integrator-owned.

What I built instead is the **Plan Editor's own shipped answer**, which the card's own C12
citation points at: `editor-task-bar.css`'s `@container (max-width: 439px)` hides
`.rp-primary-actions__label` and leaves "a named 44px icon button", with `aria-label` carrying the
name at every width (`FloatingPrimaryActions.vue`). Labelled above 80rem, icon-only below it. That
fits the lease exactly, needs no foreign edit, and — because 80rem is 1280px — gives the icon
toolbar at every leaf width a user is realistically at.

The switching width is the one number here that is a JUDGEMENT rather than a measurement, and it
is bracketed rather than derived: the audit measured one row at 1280 and two rows at 760, so
80rem shows the text exactly where it was measured to fit and hides it everywhere it was measured
to wrap. Where the ICON row starts to wrap is unknown and needs a browser.

**If you want icon-only at every width**, grant me `tests/helpers/designerRig.ts` (one line:
resolve a button by `aria-label` as well as text) and `designerToolbar.test.ts` (three assertions
that read `.text()`), and it is a ten-line follow-up on top of this branch. That is a decision
about the product, not about the tests, which is why I have not taken it unilaterally.

**2. RESOLVED BY THE INTEGRATOR, and I was half right.** Kept with its answer rather than
deleted, because the answer is the useful part. The integrator rendered the pre-W10-A toolbar at
a real 1280 viewport: `.rp-designer-toolbar`'s own `getBoundingClientRect().height` IS 65.9, so
that figure was never a mismeasurement. What reconciles it with the row counts is a fifteenth
element — `View`, inside `.rp-view-menu`, which also carries `.rp-designer-tool-button` — wrapping
to `top: 70` while all fourteen TOOL buttons sit at `top: 32`. So 1280 is one tool row and two
visual rows, and at 760 `View` sits 2px below the second tool row, which is the 3.1px that looked
impossible. AD18's heights and its row counts are both right and measure different things, which
that document never says. **The consequence for this change: the 80rem threshold stands**, since
the tools are one row at 1280. The original objection follows.

**2 (as filed). The three toolbar-height figures cannot all be measuring the same thing, and one
of them is load-bearing for my 80rem.** As given: **65.9px / 1 row at 1280**, **69px / 2 rows at 760**,
**107px / 3 rows at 580**. The second row therefore costs **3.1px** and the third costs **38px**.
A row is a row; 38px is the believable one, which makes 65.9 and 69 both suspect — 38px per row
would put one row near 38 and two near 76. `.rp-designer-toolbar` declares
`min-height: var(--size-4-8)` (32px) and no vertical padding, and a `--font-ui-small` button with
`var(--size-4-1)` padding and a 1px border comes to roughly 27px, which agrees with ~38 for a
padded row and not with 66 for one.

I could not re-measure — there is no browser here — so I carried the figures as the card gave
them and took the ROW COUNTS rather than the heights, which are the half the 80rem breakpoint
rests on. **If 1280 turns out to be two rows, 80rem is wrong and should come down**; nothing else
in this change moves with it, because the caps and the markup do not depend on that number. Worth
re-measuring with the ELEMENT named — `.rp-designer-toolbar` and `.rp-designer-header` are
siblings in `AssetDesignerRoot.vue`, checked, so conflating them is not the explanation and I do
not have one. *(The explanation was the View button. See above.)*

**3. The card's icon-fixture permission is not sufficient for its own purpose.** "You may ADD a
missing fixture under `tests/fixtures/editor-icons/`" cannot produce a drawn icon on its own,
because the harness renders from `tests/helpers/editorIconNodes.ts` — not from the SVG files —
and that file is not leased. A future card that wants fixtures needs both, plus the pinned Lucide
revision.

**4. One thing the card does not mention and the next card will meet.**
`DesignerSelectionModes.vue` renders its three buttons with `.rp-designer-tool-button` and VISIBLE
text, and it is not in this lease. So at a narrow leaf the toolbar is icons with three text
buttons in the middle of it whenever an outline is selected. That is not a defect against any
ruling — those buttons say what a gesture DOES, which no glyph here would — but it is a visible
inconsistency, and iconifying them is a decision (their tooltips already carry the gesture, so
the label is the only thing naming the mode).
