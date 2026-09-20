# Task report — W11-A (AD18 item 5, the `Add` rail)

Outcome: implemented
Owner / worktree / branch: card W11-A / `.worktrees/ad07` / `ad18-add-rail`
Base commit / candidate commit: `720fe6b21` / `f9b43fa27`, plus the fix-round commit named in the
fix-round section at the foot of this report. **`802210cf5` appeared here in the first version and is
not a commit anybody should integrate** — it is the same tree minus this file, superseded by the
amend that added the report. Every row below names `f9b43fa27` or later.
Accepted contract revision: `r1`, under rulings AD18-R3, AD18-R5 and AD18-R6 (AD18-R1 and AD08-R1 read as cited reasoning)
Allowed scope and shared-file leases: the wave-11 table's EDIT list, CREATE under `src/presentation/designer/`
and `tests/`, plus the explicit one-file grant for this report. Two files were edited outside the named EDIT
list under the table's own *"EDIT any EXISTING test file that its own change turns red"* clause, and both are
disclosed below.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/DesignerAddPanel.vue` | NEW. The `Add` section: the four shape tools in wave 10's named group, and AD18-R6's preset door | yes (CREATE under `designer/`) |
| `src/presentation/designer/AssetDesignerRoot.vue` | Mounts it into the existing `.rp-designer-parts` rail above `DesignerPartsPanel`; drops the Inspector's `start-from-preset` binding | yes |
| `src/presentation/designer/DesignerToolbar.vue` | Filters the `'shape'` rows out of `MODES`; deletes `SHAPE_START`/`SHAPE_END`/`LEADING_MODES`/`SHAPE_MODES`/`TRAILING_MODES` and the group element; one loop | yes |
| `src/presentation/designer/inspector/DesignerInspector.vue` | Deletes `.rp-designer-start-preset` and the `startFromPreset` prop (AD18-R6) | yes |
| `styles/designer-add.css` | Every new rule: the section, the shape group, the icon-only label state, the flat-button and preset-door clones with their focus rings | yes |
| `styles/designer-toolbar.css` | Deletes the `.rp-designer-shape-tools` rule; leaves a record of where the group went | yes |
| `styles/designer.css` | Drops `.rp-designer-start-preset` from three selector lists; rewrites the comment above them | yes |
| `src/presentation/i18n/locales/{en,de}/designerAdd.ts` | One key, `designer.add` | yes |
| `tests/helpers/designerRig.ts` | `toolbarButton` resolves both homes (the lease's named hazard) | yes — narrow grant |
| `tests/presentation/designer/designerAddRail.test.ts` | NEW. The rail's own cases and its stylesheet's | yes (CREATE under `tests/`) |
| `tests/harness/accessibilityDesignerAdd.test.ts` | NEW. One axe scan that FINDS the rail's controls before grading them | yes (CREATE under `tests/`) |
| `tests/presentation/designer/designerIconToolbar.test.ts` | Toolbar label set derived minus shapes; glyph cases widened to both homes; the group case becomes the toolbar's absence | yes — turned red |
| `tests/presentation/designer/designerToolbar.test.ts` | The exact button list loses the four shapes | yes — turned red |
| `tests/presentation/designer/designerInspector.test.ts` | The preset-door case becomes an assertion of its absence; the prop and its mock go | yes — turned red |
| `tests/presentation/designer/assetDesignerRoot.test.ts` | `.rp-designer-add` added to `REGIONS` | yes — new region |
| `tests/presentation/designer/{designerArrangePanel,designerClearanceReview,designerInspectorTabs,designerUsageScope,designerReferencePanels}.test.ts` | Drop the now-dead `startFromPreset` prop from their `DesignerInspector` mounts | **see disclosure 1** |
| `tests/presentation/designer/designerResponsiveShell.test.ts` | A docblock naming `DesignerInspector.vue` as the second preset door became false | **see disclosure 1** |
| `tests/harness/assetDesigner.ts` | `pressTool` had the identical selector hazard as the rig; `&draw=draw-rect`/`draw-circle` would have silently pressed nothing | **see disclosure 2** |

**Disclosure 1 — six files that were NOT red.** Removing the `startFromPreset` prop from `DesignerInspector`
did not fail type-check: Vue Test Utils accepted the extra prop and `vue-tsc -noEmit` was green with all five
mounts still passing it. They were edited anyway, because a test handing a component a prop that component no
longer declares is rot that the next reader takes as evidence the prop exists. `designerResponsiveShell.test.ts`
was likewise green with a docblock that had become false. Neither is a behaviour change; both are one-line
edits. Integrator: say so if you would rather they had been left.

**Disclosure 2 — `tests/harness/assetDesigner.ts` is a harness helper, not a `*.test.ts`.** It WAS red
(`assetDesignerSelectKnob.test.ts` drives `&draw=draw-rect` and `&draw=draw-circle` through it), so the clause
applies, but the file is named nowhere in the lease table and the card's hazard paragraph named only
`designerRig.ts`. The hazard is the same one and is worse here: `pressTool` answers an unfound button by doing
nothing, so every `asset-designer-draw-*` capture would have photographed a designer with no gesture under a
draw shot's name, with `harness-shot` exiting 0.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD18-R3 — the shapes MOVE, not duplicate | met | `designerAddRail.test.ts` *"leaves every registered tool with exactly one button across the toolbar and the rail"*, driven off `DESIGNER_TOOL_LABELS` over the mounted shell; `designerToolbar.test.ts`'s exact list and `designerIconToolbar.test.ts`'s *"is gone from the toolbar"* are the negative half | none |
| AD18-R3 — `SHAPE_MODES` and `.rp-designer-shape-tools` deleted, one loop over `MODES` | met | `grep -rn "rp-designer-shape-tools" src/ styles/ tests/` prints three lines, all prose or the absence assertion; `DesignerToolbar.vue` has one `v-for` | none |
| AD18-R5 — stacked, not tabbed; the region's gate is not moved | met | `designerAddRail.test.ts` *"keeps its buttons through a refused read, where the Parts panel empties"*; `assetDesignerRoot.test.ts`'s *"keeps every region when the read refuses"* now covers `.rp-designer-add`. `[role="tab"]` count stays 0 | the rail's HEIGHT cost is unmeasured — see below |
| AD18-R6 — the door moves, the Inspector drops its copy | met | `designerAddRail.test.ts` *"carries the preset door…"* (and asserts exactly one `.rp-designer-start-preset` in the whole shell); `designerInspector.test.ts` *"draws no preset door of its own"* | none |
| AD18-R6 — `DesignerEntryPaths` keeps its copy; presets stay a modal | met | `assetEntryPaths.test.ts` and `designerResponsiveShell.test.ts` unchanged and green; `AssetPresetGallery` is still imported only by `AssetPresetForm.vue` | none |
| The lease hazard — `toolbarButton` still resolves both homes | met | `designerAddRail.test.ts` *"activates a rail tool and a toolbar tool alike, through one resolver"*, one button from each home | none |
| No accessibility regression; the Parts panel stays one tab stop | met, within jsdom's ceiling | `accessibilityDesignerAdd.test.ts`: the four rail buttons and the door are FOUND, `.rp-designer-part-list [tabindex="0"]` has length 1, `axe.run` reports no violations | contrast, focus-ring visibility and hit size are disabled in `runOptions` and verified nowhere |
| Locale copy | met, one key | `designer.add` in `{en,de}/designerAdd.ts`; the four `designer.toolbar.draw-*` labels and `designer.inspector.start-preset` are deliberately NOT renamed, per that file's header | the two key names now read stale, by decision |

### Watched-red evidence

Every new invariant was reverted, watched failing, and restored. Verbatim:

**1. The exactly-once union (revert: `DesignerToolbar.vue` stops filtering `group === 'shape'`)**

```
 FAIL  |suite| tests/presentation/designer/designerAddRail.test.ts > the Add rail > leaves every registered tool with exactly one button across the toolbar and the rail
AssertionError: expected [ 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1 ] to deeply equal [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ]
```

**2. The unconditional label rule (revert: wrap it in `@container rp-designer (width < 80rem)`)**

```
 FAIL  |suite| tests/presentation/designer/designerAddRail.test.ts > what the Add rail’s stylesheet declares > hides the rail’s button text with no container query around it
AssertionError: expected [] to deeply equal [ { type: 'keyword', value: 'none' } ]

- Expected
+ Received

- [
-   {
-     "type": "keyword",
-     "value": "none",
-   },
- ]
+ []
```

**3. The widened rig resolver (revert: back to `.rp-designer-tools button`)**

```
 FAIL  |suite| tests/presentation/designer/designerAddRail.test.ts > the Add rail > activates a rail tool and a toolbar tool alike, through one resolver
Error: no designer toolbar button labelled Draw circle
 ❯ Object.toolbarButton tests/helpers/designerRig.ts:387:36
```

Note the SHAPE of that one: a thrown resolver error, not a failed assertion. That is the lease's hazard exactly
— it reads as a missing label and is a missing selector.

**4. The Add section's unconditionality (revert: `v-if="design !== null"` on `<DesignerAddPanel>`)**

```
 FAIL  |suite| tests/presentation/designer/designerAddRail.test.ts > the Add rail > keeps its buttons through a refused read, where the Parts panel empties
AssertionError: expected [] to have a length of 4 but got +0

- Expected
+ Received

- 4
+ 0
```

**5. The focus-ring pair (revert: delete `.rp-designer-add .rp-designer-start-preset:focus-visible`)**

```
 FAIL  |suite| tests/presentation/designer/designerAddRail.test.ts > what the Add rail’s stylesheet declares > gives .rp-designer-add .rp-designer-start-preset a visible focus ring to replace the one it removes
AssertionError: expected [] to deeply equal [ { …(2) } ]
```

**6. The Inspector's absence (revert: re-add a `.rp-designer-start-preset` button to `DesignerInspector.vue`)**

```
 FAIL  |suite| tests/presentation/designer/designerInspector.test.ts > the designer’s inspector > draws no preset door of its own, which AD18-R6 moved into the Add rail
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true
```

### Counts re-measured after the change, not inherited

| Claim | Where it is written | Measured |
|---|---|---|
| `grep -rn "rp-designer-shape-tools" src/ styles/ tests/` | `styles/designer-toolbar.css` | **3** lines — its own two prose lines and the toolbar's absence assertion. The first draft said "nothing"; corrected from what the grep printed |
| `grep -rn "rp-designer-start-preset" src/ styles/` | `styles/designer.css` | **6** lines — the rail's button, the rail's three rules, and that comment's own two lines. No `.rp-designer-inspector` hit |
| `grep -rn "toolbarButton(" tests/` | `tests/helpers/designerRig.ts` | **47** lines in **18** files (`grep -rln`), THREE of them in that file — the declaration, the `select` press in `selecting()`, and the comment stating the count, whose own text contains the string. At the base: 43 in 17. **Corrected in the fix round from 46 and from a helper named `openTool`, which does not exist**; see finding 3/4 below. **The card's "43 call sites across 26 test files" also conflates two greps** — the 26 is `grep -rln "designerRig" tests/`, a different set |
| `grep -rn "HostIcon" src/presentation/designer/` | `DesignerToolbar.vue` | still **3**; the rail draws `DesignerToolButton`, which is the one component importing it. The docblock's count needed no edit; its *scope* sentence did |
| `grep -rn "start-preset" src/presentation/designer/` | `designerResponsiveShell.test.ts` | five lines: one standing door (the rail's), one empty-state door, two stale prose hits in files outside this lease |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | candidate, Windows / Node 24 | 0 | run twice, after the source edits and again after the test edits |
| `npx oxlint src/presentation/designer styles tests/presentation/designer tests/harness/accessibilityDesignerAdd.test.ts tests/helpers/designerRig.ts tests/harness/assetDesigner.ts` | candidate | 0 | silent run |
| `npx eslint` over all twelve hand-edited source/test files | candidate | 0 | |
| `npx vitest run tests/presentation/designer tests/harness/accessibilityDesignerAdd.test.ts tests/harness/assetDesignerSelectKnob.test.ts tests/build/styles.test.ts tests/build/buttonFocusRing.test.ts tests/build/buttonSpecificity.test.ts` | candidate | 1 — **1 failed, 1266 passed** | The one failure was `buttonFocusRing.test.ts` **timing out in 5000ms**, not an assertion. Re-run alone: **96 passed, exit 0**. A contention artifact, per CLAUDE.md's own rule about that directory |
| `npx vitest run tests/build/localeModuleSentenceCase.test.ts` | candidate | 1 — `Hook timed out in 60000ms` at `beforeAll(warmUpEslint, ESLINT_BOOT_MS)` | Re-run with `--no-file-parallelism`: **79 passed, exit 0**. Exactly the ESLint-boot contention CLAUDE.md documents; re-run serially before believing it |
| `npx vitest run tests/build/{styles,buttonFocusRing,buttonSpecificity,buttonBoxNeutralised,libraryComponentStyles}.test.ts tests/presentation/i18n/strings.test.ts` | candidate | 0 — 332 passed | the style, button-specificity and focus-ring category gates over the new partial |
| Six revert-and-watch cycles | candidate ± one reverted line each | all red, all restored | verbatim above; `git status` clean before the commit |

## Verification not performed

**Nothing about the rendered result was verified, and every layout claim below is a declaration.**

- **`npm run check`, `npm run check:fast`, `npm run test:coverage`, `npm run analyze`** — the integrator's, per
  the card. So: **no coverage figure was read for the changed files.** The card's coverage clause is unmet by me
  and is live work for the integrator. What I can say instead of a number: `DesignerAddPanel.vue`'s only branch
  is its `v-for`; the new `v-if`-shaped arm this card adds is the ABSENCE of one (the Add section is
  unconditional), and `designerAddRail.test.ts` drives the section mounted, its buttons pressed, its
  `aria-pressed` in both states, and the panel through a refused read. `AssetDesignerRoot.vue` gained no branch.
  `DesignerToolbar.vue` gained one, the `group === 'shape'` ternary, whose two arms are both driven (the
  toolbar's exact list is the false arm, the rail's list the true one). Read `coverage-final.json` for these
  five files rather than the threshold.
- **`npm run harness`, `npm run harness-shot`, `npm run test-build`** — not run; forbidden by the card, and this
  worktree has no browser I may drive.
- **Whether the `Add` section fits, wraps, or costs the stacked rail too much below 35rem.** AD18-R5 names this
  as an unmeasured cost of its own ruling and it is still unmeasured. jsdom lays nothing out. The integrator's
  own baseline pass says `.rp-designer-parts` has `scrollHeight === clientHeight` at all four widths — exactly
  full at 460 with no slack — so **this card WILL make that panel scroll at a narrow leaf**, and I could not
  measure by how much. That baseline is also the weakest case: `tests/harness/assetDesigner.ts` mounts a
  shapeless asset, so the Parts panel is in its empty state, and a parts-FULL panel is what actually pays.
- **Whether icon-only is the right treatment for the rail.** `styles/designer-add.css` hides
  `.rp-designer-tool-label` at every width. The argument is that the toolbar's 80rem breakpoint measures the
  TOOLBAR's row count, and that the widest shape label — `Draw rounded rectangle`, **179px** in the integrator's
  browser at the BASE — exceeds the rail's own declared cap of `min(11rem, 22cqi)` = 176px before padding. **I
  did not measure that 179px, it is not from this branch, and nothing here resolves `cqi`.** If a rendered pass
  shows labelled buttons would in fact fit, the fix is one rule.
- **Whether four unlabelled glyphs read as "Add" to a user.** A learnability question with no gate. `aria-label`
  is carried at every width and is what Obsidian draws its own tooltip from; that attribute is checked, the
  tooltip is not.
- **The 80rem breakpoint comment in `styles/designer-toolbar.css` was LEFT ALONE**, per the integrator's
  instruction 1. It is known FALSE at the base — the integrator rendered ten of fourteen buttons at `top: 32`
  and four wrapping to `top: 70`, so the "one tool row at 1280" claim and the 65.9px height are both wrong, for
  a measurement taken before the icons were added. The integrator's arithmetic suggests this card repairs it
  (removing 502.0px of button plus four gaps leaves 1059.6px against 1264px available). **That is arithmetic and
  I did not render it**, so no repaired sentence was written from it; the integrator owns re-measuring and the
  pre-icon figures are untouched as the record of where the breakpoint came from.
- **Contrast and hit-target size** of every new control — two axe RULES, disabled in `runOptions` because
  jsdom has no rendering engine to measure either. **Whether a focus indicator is VISIBLE is a third thing and
  is NOT one of them**: axe has no rule for it, so nothing here could enable or disable it, and this bullet
  said "the three rules `axeOptions.ts` disables" in its first version — corrected in the fix round (finding
  10), along with the same error in `accessibilityDesignerAdd.test.ts`'s header. The focus rings are asserted
  to be DECLARED, never to be visible.
- **`fallow`'s duplication verdict on the two REVIEWED CLONE blocks** in `styles/designer-add.css`, and the
  sentence that stood here was FALSE of both. It claimed each directive sat "above the declaration the clone
  starts at": one sat above the SELECTOR and was right only by accident, since that block's first declaration
  is `padding` and the two positions coincide; the other sat above the selector of a block whose first two
  declarations are `width` and `margin`, which is CLAUDE.md's recorded gotcha exactly. The fix round moved it
  inside, above `padding:`, as ONE directive with a stated argument for why `margin: 0` cannot join the
  margin family `designer.css`'s counterpart needs a second directive for. **That argument is reasoning, not a
  measurement** — `npm run analyze` is the integrator's — so if it is wrong fallow reports the directive STALE
  while counting a `margin`-family finding, which is the good failure mode and the remedy is a second
  directive above `margin:`. Still the likeliest thing in this diff to turn the analyze leg red.
- **A vault.** Nothing was run in Obsidian.

## Data and integration implications

Schema/migration change: none. Nothing here reads or writes an asset document.
Relevant renderer/export/revision consumers: none. `startFromPreset` and `runtime.setTool` are unchanged; only
their call sites moved.
Undo/no-op/conflict/failure coverage: unchanged. The preset door is the same function with the same
`dialogs.current !== null` guard, and `assetPresetFlow.test.ts`'s four cases (one dialog for two clicks, cancel
writes nothing, one undo takes the whole preset back, the camera frames it) resolve `.rp-designer-start-preset`
against the mounted root and followed the button into the rail with no edit at all.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: **none.** `styles/designer-add.css`'s `@import` and
`designerAdd.ts`'s spread into `{en,de}/editor.ts` were wired by the integrator in the base commit, and neither
file was touched by this card.
Rollback/recovery considerations: the commit is self-contained. Reverting it restores the shapes to the toolbar
and the door to the Inspector in one step — which is precisely why the wave ran one card: at no commit are the
four shapes drawn in both places or in neither.

### Found true, outside this lease

1. **`src/presentation/designer/DesignerToolButton.vue`'s docblock is now false.** It reads *"`DesignerToolbar.vue`
   draws it in three places (the tools before the shape group, the group itself, and the history pair)"*. After
   this card the toolbar draws it in two, and `DesignerAddPanel.vue` draws it in a third place the sentence does
   not know about. The file is not in the EDIT list and I did not ask for it, because the defect is prose rather
   than behaviour.
2. **Two more stale prose hits**, both naming a selector list that no longer exists:
   `inspector/DesignerClearanceReview.vue` and `inspector/DesignerUsePlan.vue` each spell
   `.rp-designer-{edit-dimensions,start-preset,open-library,use-plan}`. These were ALREADY stale at the base —
   AD18 moved `open-library` and `use-plan` to the header — and this card makes them stalerer by one member.
3. **`styles/designer.css` grew by one line** (397 → 398 against the 400 cap), not by a rule: the comment above
   `.rp-designer-edit-dimensions` had to become a three-panel account of where each selector went. Every RULE
   this card adds is in `designer-add.css`, as the lease requires. Say the word and I will compress it back to
   397.
4. **`designer.parts.empty` still reads true, and better.** The Parts panel's empty line is *"This asset has no
   parts yet. Set its dimensions or start from a preset."* It names no panel and no position, so it survives
   AD18-R6 unchanged — and the door it alludes to now sits directly above that sentence instead of across the
   leaf in the Inspector. No edit needed; checked because the integrator asked.

### Where I think the card asked for the wrong thing

Nowhere, and I want to be precise about that rather than polite. The three rulings are coherent and I would have
argued for the same three. **One instruction in the card is simply inaccurate rather than wrong-headed**: *"43
call sites across 26 test files"* conflates `grep -rn "toolbarButton(" tests/` (43 lines, 17 files at the base)
with `grep -rln "designerRig" tests/` (26 files). It changed nothing about what I built — the hazard is real and
the fix is the same either way — but the comment I was asked to write in `designerRig.ts` would have inherited a
false number, which is the exact failure this repository's own rule about counts exists to catch. It is written
from a fresh measurement instead.

**One thing I would flag for the next card rather than for this one.** The region div is still called
`.rp-designer-parts` while it now holds `Add` above `Parts`. Renaming it to `.rp-designer-rail` is the honest
name and is NOT a one-line change: `designer-parts.css` sets the rail's width, padding, background and border on
it, `designer-narrow.css` gives it its stacked flex share, and `designer-toolbar.css` caps it at
`min(11rem, 22cqi)` — three partials, none of them in this lease, and two of them inside container queries whose
disjointness is itself an argued property. Doing it here would have been three unleased edits for a name.

## Fix round — the twelve findings against `f9b43fa27`

Ten were mine, one (finding 8) is the integrator's own and is untouched here, and one (finding 12) was a
sha in this file. What changed, in one commit on top:

| # | Finding | What was done |
|---|---|---|
| 1 | `.rp-designer-start-preset`'s fallow directive sat above the SELECTOR, where the block's first declarations are `width` and `margin` | Moved inside, above `padding:`. **ONE** directive, not the two `designer.css`'s counterpart carries: that block's first directive suppresses a family whose run starts at `margin: 0 0 var(--size-4-4)`, this one declares `margin: 0`, and no other block in `styles/` pairs `width: 100%` with `margin: 0` — measured in the edit. The reasoning and its failure mode are written at the directive |
| 2 | `pressTool` answered an unfound button with `?.click()` while its own new docblock named the defect | It refuses on the console now, matching `drawInHarness` one function below, and `assetDesignerSelectKnob.test.ts` gained the sibling of that function's existing refusal case. Watched red; verbatim below. No fixed shot depended on the silence — `harness-shot.test.ts`, `harness-shot-designer.test.ts` and the select-knob file all pass |
| 3 | `designerRig.ts` said 46 lines; it prints 47 | 47. The comment's own line contains `toolbarButton(` and is counted — the correction I made right twice elsewhere and missed in the one file the lease granted narrowly |
| 4 | That comment named `openTool`, which does not exist | `selecting()`. `grep -rn "openTool" tests/ src/` now prints nothing |
| 5 | Three population claims in `designer-toolbar.css` ("a FIFTEENTH element" twice, "all fourteen at `top: 32`") | The ordinal is gone from both — the element is NAMED instead, with a clause saying the ordinal was falsified and why a name outlives a census. The 80rem block is rewritten in three paragraphs: where the number came from (AD18's pre-icon figures, KEPT), what falsified it (the icons, about +22px a button, 157→179px, the integrator's base render), and what made it true (this card, the integrator's candidate render). Buttons by name throughout |
| 6 | The same stale "a fifteenth element" in `designerIconToolbar.test.ts` | Same fix, and it records that the stylesheet's copy was falsified in the same commit |
| 7 | Four partials say `designer.css` is 397 lines; `wc -l` is 398 | My two corrected to 398 with the instrument named. **Not compressed**, per the instruction: 398 < 400, and every new RULE went to `designer-add.css` |
| 9 | `DesignerToolbar.vue` said the 80rem rule "decides nothing for the `Add` rail"; `designer-add.css` says it does | The stylesheet is right — that rule is `.renovation-asset-designer .rp-designer-tool-label`, unscoped — so the component's sentence is replaced by the true one, pointing at the partial where the rule lives |
| 10 | The axe header called focus-indicator visibility one of the rules `runOptions` disables | Rewritten as two mechanisms: two axe RULES turned off, and one thing axe has no rule for at all. `accessibility.test.ts`'s "does NOT verify" is cited as the right shape |
| 11 | The stylesheet case locked the WHOLE partial against any conditional rule | Narrowed to the rules that NAME `.rp-designer-add .rp-designer-tool-label`: their conditions must be exactly `['']`. A future `@container` about the rail's own width no longer reddens a case about the label |
| 12 | This report's candidate sha | Corrected, with a line saying why `802210cf5` must not be integrated |

### The eleventh watched-red, verbatim

Finding 2's refusal, reverted to `found?.click()`:

```
 FAIL  |suite| tests/harness/assetDesignerSelectKnob.test.ts > refuses a &draw= tool whose button it cannot find, rather than capturing an idle canvas
AssertionError: expected "error" to be called with arguments: [ StringContaining "Draw rectangle" ]

Number of calls: 0
```

`Number of calls: 0` is the silence itself, which is why that line is the whole finding.

That case reaches the arm by removing `.rp-designer-add-shapes` between the mount and the knobs, which is
deterministic rather than raced: `driveHarness` waits on `editor.stageSize.width > 0` and nothing sets that
until the test's own `resizeTo`. It is also the only honest way in, since every label the knob can name is
rendered today.

### The integrator's rendered numbers, now written into the stylesheet

Every figure below is the INTEGRATOR's, in a real browser, at the commit named — not mine, and not
re-measured here. They are recorded in `styles/designer-toolbar.css` at the rule they are about.

| container | toolbar height, base `720fe6b21` → candidate `f9b43fa27` | tool-button rows |
|---|---|---|
| 1280 | 69 → **32** | 2 → **1** |
| 760 | 32 → 32 | 1 → 1 |
| 580 | 69 → **32** | 2 → **1** |
| 460 | 69 → **65.9** | 2 → **1** |

At 1280 with labels shown, every remaining tool button is at `top: 33` and the View menu's `<summary>` at
`top: 34`. At the base the four that wrapped to `top: 70` were `Set facing`, `Calibrate`, `Undo` and `Redo`.
**At 460 the region is still 65.9px over one button row, and neither the comment nor this report says why** —
nobody chased it, and a guess would be the same defect the rewrite exists to fix.

The rail rendered: labels hidden at every width as declared, four 36px buttons on a 40px pitch, the door full
width, `.rp-designer-add` at 159×97.9 (1280), 150.2×131.9 (760), 110.6×131.9 (580, shapes wrapping 2×2) and
444×97.9 (460). **No horizontal overflow at any width** (`scrollWidth === clientWidth` on
`.rp-designer-parts` at its tightest). AD18-R5's declared cost, measured: `.rp-designer-parts` at 460 goes
from exactly full to **26.5px of scroll** (166/140), it scrolls rather than clips, and **all five Add controls
are above the fold** — what falls below is the parts empty-state message, not a control. Still the shapeless
weakest case. AD18-R6 also bought something nobody predicted: deleting the Inspector's button took that
panel's 460px overflow from 54px to 7px.

**One integrator observation is recorded here as withdrawn rather than carried**: a first pass flagged a
clipped Add button. It was a false positive — `overflow: visible`, nothing clipped — and the 3px is the
harness's own `::after` missing-fixture marker, `squircle` being a longer word than `circle`. A harness
artifact, not a layout defect, written down so the next reader does not re-find it as one.

### The dead label span — asked, not fixed

The integrator asks whether `DesignerToolButton` should still emit `<span class="rp-designer-tool-label">` in
the rail, where `styles/designer-add.css` hides it at every width. **My answer: yes, leave it, and the
sentence that justifies it is the thing that needs narrowing rather than the markup.**

Three reasons, in the order they decide it. **It is not dead in the sense that matters** — `display: none`
removes it from the accessibility tree as well as from the picture, and the accessible name comes from
`aria-label` either way, so the span contributes nothing and costs nothing in either tree. **Removing it means
teaching the component about its container**, which is the one thing that component is built not to know: it
takes a label and a glyph and nothing about state, on purpose and after a recorded correction (`pressed` and
`disabled` were props once, and an absent `boolean` prop cast to `false` made Undo announce itself as a toggle
that happens to be off). A `showLabel` prop or a slot would put a layout decision inside a component whose
whole value is that the stylesheet owns them — and it would be a second authority on a question
`designer-add.css` already answers, which is the shape three of this wave's own rulings refuse. **And the
rail's treatment is not settled**: it is one CSS rule today, reversible in one line if a rendered pass says
labelled buttons should come back at some width. Deleting the span would make that a component change instead.

So the fix is the sentence. `DesignerToolButton.vue`'s *"Both spellings of the label are LIVE, at different
widths, which is why neither is dead markup"* was true of the only container that existed when it was written
and is now true of one of two. The honest narrowing is that the span is live in the TOOLBAR at 80rem and
wider, that the `Add` rail hides it at every width and relies on `aria-label` alone, and that this is
therefore a component whose visible-label state its CONTAINERS decide. That is the integrator's edit to make
(finding 8), and on this evidence it is a narrowed sentence rather than a follow-up card.

### Executed in the fix round

| Command | Result |
|---|---|
| `npx vitest run tests/build/harness-shot.test.ts tests/build/harness-shot-designer.test.ts tests/harness/assetDesignerSelectKnob.test.ts tests/presentation/designer/designerAddRail.test.ts tests/presentation/designer/designerIconToolbar.test.ts tests/harness/accessibilityDesignerAdd.test.ts` | 6 files, 98 tests, exit 0 |
| The finding-2 revert-and-watch cycle | red as quoted, restored |
| `npx vue-tsc -noEmit`, `npx oxlint`, `npx eslint` over every file touched in this round | exit 0 |

Unchanged from the main report: no `npm run` gate was run here either — `check`, `test:coverage` and
`analyze` remain the integrator's, and the coverage read for the changed files is still outstanding. The
fix round adds one new `src/`-adjacent branch, `pressTool`'s `found === undefined` arm, and both of its arms
are driven — the refusal by the new case and the hit by every other `&draw=` and `&select=` case in that file.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
