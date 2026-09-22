# Task report — W21-A (dimension collision)

Outcome: implemented
Owner / worktree / branch: W21-A · `.worktrees/ad13c` · `w21a-dimension-collision`
Base commit / candidate commit: `b1dd2588f` / recorded by the integrator at hand-off
Accepted contract revision: `r1`
Allowed scope and shared-file leases: the Wave 21 row for this card —
`presentation/designer/dimensions/DesignerDimensions.vue`,
`presentation/designer/dimensions/dimensionFigures.ts`, `styles/designer-dimensions.css` and this
card's own tests. **No locale module was created and none was needed** (W20-A holds
`{en,de}/editor.ts` this wave): collision avoidance turned out to be geometry, exactly as the lease
predicted, and adds no user-visible string.

## What this delivers

AD18-R14's collision avoidance for the `All dimensions` state, as one pure rule plus its wiring.

**The rule, in one sentence: a label that would land on an already-placed label's ROW steps one full
label-box height away, repeatedly, up to four steps; earlier wins.** It is `spreadLabels` in
`dimensionFigures.ts` — pure, in stage pixels — and the component hands it the points
`worldToScreen` has just produced and draws what comes back.

Three decisions inside that sentence, each with its losing side stated below:

- **The predicate is "same row, overlapping column", not "the boxes intersect."** Every label is the
  same HEIGHT, so a pair on genuinely different rows leaves a strip of the lower one exposed
  whatever their widths; only a pair within a few pixels of one row can swallow another whole. The
  tolerance is 8 px vertically against the label box's 40 px width.
- **The step direction is away from the nearer stage edge** — down from the top half, up from the
  bottom half — which is the rule `DesignerDimensions.placement` already uses for an open field, and
  for the same reason: `.rp-plan-canvas` is `overflow: hidden` and `DesignerCanvas` fits an opened
  asset with `FIT_PADDING_PX`'s 48 px of margin, so an unconditional outward step would push the
  overall pair off the top edge, where it is clipped rather than merely moved. A clipped label is a
  total loss; a label pushed inward over the drawing is not.
- **Earlier wins, and "earlier" is `dimensionFigures`' own order** — a part's own figures first, the
  overall pair appended last. So the label with the more specific subject keeps its true anchor and
  the outer measurement stacks off it, which is how a drafting dimension chain reads. That order is
  also the mechanism of the defect: `.concat(overall)` is why the overall label was always painted
  last and always took the click.

**Nothing is hidden and nothing is suppressed.** Every figure `dimensionFigures` answers is still
drawn, still reads its own value and still opens its own field.

## The arms refused, and their losing sides

| Arm | Why it loses | What is lost by refusing it |
|---|---|---|
| **Separate every pair whose BOXES intersect** (the obvious reading of "collision avoidance") | Measured over `editableShape()` at the designer's opening camera, where the whole shape is ~100 px across: it moves **6 of 8** labels for a selected `detail-1` and **12 of 14** under `All dimensions`, pushing three and five of them respectively to the 120 px cap — and a label AT the cap is one the sweep did not resolve. So it buys a scattered overlay and still leaves overlaps. The numbers are in `spreadLabels`' docblock as a table. | Genuine partial overlaps survive: two labels 20 px apart vertically still clip each other's box. They are READABLE-at-a-glance worse and CLICKABLE either way, which is the line AD18-R14 draws. |
| **Suppress a label that exactly duplicates another's position** | The surface's one job is measuring; a measuring surface that answers "the clearance is this wide" by not drawing the number has failed at it more completely than one that draws it 30 px lower. And it needs a specificity rank that nothing else in this tree has. | It is the smallest possible diff and moves nothing at all, so the resting picture and the drag picture are both provably unchanged. That is a real cost of what shipped — see "stability under a drag" below. |
| **Explicit paint/hit order (`z-index`) so the most specific label wins** | It does not fix the defect. Three labels in one box remain three labels in one box; re-ordering only changes WHICH two are unreachable. | Nothing, on its own. It would have been a cheap partial if the fix had to be CSS-only, and it is the one candidate that needs no pure rule. |
| **Collapse a coincident group into one label that opens a chooser** | New interaction, new markup, and a chooser needs a NEW LOCALE STRING — which this card may not create, W20-A holding `{en,de}/editor.ts`. Under the lease this arm was not available to take. | It is the only arm that keeps every label on its true anchor AND makes every measurement reachable. If a browser pass finds the stagger reads badly, this is the arm to re-open — with a locale lease. |
| **Stagger along each figure's own measured axis** (widths up, depths left) | Needs an `axis` field on `DimensionFigure`, a second ternary per read, and the "away from the edge" clipping rule has to be answered twice. One vertical axis gives the stronger guarantee — equal-height boxes stepped a full height apart cannot contain one another, whatever their widths — for less code. | A depth label stepped vertically slides along the left edge it measures rather than away from it. On a short part that reads slightly worse than a horizontal stagger would. |

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/dimensions/dimensionFigures.ts` | `spreadLabels`, `sharesRow` and the three constants, plus the header paragraph saying the module now has a second exported function that works in pixels. `dimensionFigures` itself is untouched. | yes |
| `src/presentation/designer/dimensions/DesignerDimensions.vue` | The `figures` computed calls `spreadLabels` over the stage points, and draws from what it returns; header and `placement` docblocks updated. | yes |
| `tests/presentation/designer/dimensions/dimensionCollision.test.ts` (new) | This card's own tests: seven pure cases on the rule, three mounted cases on the overlay. | yes |

**`styles/designer-dimensions.css` is leased and deliberately UNCHANGED, and that is a finding
rather than an omission.** The stagger is written into the inline `left`/`top` the template already
writes; nothing about a rule changes. Two claims in that file's own header were re-checked against
the tree after this change rather than assumed:

- `grep -rln "rp-designer-dimension" styles/` still prints exactly `designer-dimensions.css` and
  `designer-rulers.css` — the sentence about no rule elsewhere winning at equal specificity is
  still exact.
- Its one `z-index` (the `:has(.rp-designer-dimension__form)` rule, lifting an open form) is
  unaffected and still correct. **Both source docblocks that describe the defect were NARROWED for
  it**: they had said "every wrapper is `z-index: auto`", which the open-form rule makes false, and
  now say that among the BUTTONS paint and hit order is DOM order. `wc -l` still reads **112**
  against the 400 cap.

**A `z-index` per figure was available and was not added.** With no two labels on one row, there is
nothing among the buttons for a stacking order to decide, and an inline `z-index` would be a second
answer to a question the geometry has already settled.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD18-R14: the `All dimensions` state gets collision avoidance | met | `dimensionCollision.test.ts` "leaves no two labels on one row across the whole All dimensions set" — the same set, at the same camera, asserted to share a row BEFORE and not after | the anchors' rule, not the rendered boxes — see below |
| AD18-R14: no drawn label is impossible to click | met, NARROWED | the exact-coincidence pair `clearance-width` / `overall-width` is drawn at two different `top` values; the mounted case asserts every drawn label has a distinct `left|top` | jsdom computes no layout, so "impossible to click" is reached through the POSITIONS, not through hit-testing |
| AD18-R14: the resting state stays at ZERO overlapping pairs | met | "returns an anchor untouched when nothing else wants its row" (pure) and "moves nothing in the resting state, with or without a selection" (mounted, asserting the overall pair at exactly `48px`/`18px` and `-2px`/`48px`) | — |
| AD18-R14: the resting state stays at TWO labels | met | the mounted resting case asserts the full list by exact array; `designerDimensions.test.ts`'s own "mounts in the canvas overlay…" still asserts the same two at the same pixels, unchanged and green | — |
| AD18-R14: nothing hidden | met by construction | `spreadLabels` returns one point per anchor and the component maps index-for-index; no figure is dropped anywhere | — |
| Lease: no new locale string | met | `git diff --name-only` names no file under `src/presentation/i18n/` | — |
| Lease: `styles/index.css` untouched | met | same diff | — |
| Settled things not reopened (`writesBlocked`, the tool gate, C03's no-op comparison, the signed-gap convention) | met | `dimensionFigures`, `unchanged`, `gapOf`, `offsetFigures` and `MEASURING_TOOLS` are byte-identical; the diff touches only the module header, the new tail, and the `figures` computed | — |
| "If your change touches how a figure is positioned, it must still read the preview" | met | the preview binding is upstream of the change — `spreadLabels` receives points derived from `preview.value ?? view.shape` and cannot see which — and `designerDimensions.test.ts`'s "follows the gesture's preview rather than the committed shape" is still green | — |
| Both files keep ZERO uncovered statements, functions and branches | met, MEASURED | `coverage-final.json` read for both files: `uncovered statements: [] | functions: [] | branches: []` | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/dimensions/` | candidate, Windows | `Test Files 3 passed (3) / Tests 70 passed (70)` | this card's 11 plus W19-A's 38 and 21, all green |
| `npx vitest run tests/presentation/designer/` | candidate | `Test Files 77 passed (77) / Tests 1071 passed (1071)` | includes `regionsReachable`, `assetDesignerRoot`, `designerViewMenu`, `designerRulers`, `designerStyles` |
| `npx vitest run tests/harness tests/build/styles.test.ts` | candidate | `Test Files 35 passed (35) / Tests 478 passed (478)`, exit 0 | run in the background after exceeding the shell's 120 s window; it took 127.7 s |
| `npx vitest run … --coverage --coverage.reportsDirectory=<scratch> --coverage.include='src/presentation/designer/dimensions/**'` | candidate | both changed files: no uncovered statement, function or branch | the shared `coverage/` was never written to |
| `npx vue-tsc -noEmit` | candidate | exit 0, no output | whole tree, `src/` + `tests/` |
| `npx eslint src/presentation/designer/dimensions/ tests/presentation/designer/dimensions/` | candidate | exit 0, no output | — |
| `npx oxlint src/presentation/designer/dimensions/ tests/presentation/designer/dimensions/` | candidate | exit 0 (prints nothing when clean; the code was read, not the silence) | — |
| `node scripts/styles-assemble.mjs` | candidate | exit 0 | run although the partial is unchanged, since the stylesheet is in this lease |
| `wc -l styles/designer-dimensions.css` | candidate | **112**, against the 400 cap | unchanged by this card |
| `grep -rln "rp-designer-dimension" styles/` | candidate, AFTER the change | `designer-dimensions.css`, `designer-rulers.css` | the partial header's own sentence, re-verified rather than trusted |
| `grep -n "^export" src/presentation/designer/dimensions/dimensionFigures.ts` | candidate, AFTER the change | three lines — `DimensionFigure` (type), `dimensionFigures`, `spreadLabels` | the header's "two exported FUNCTIONS" sentence was written from this output, and says why the grep prints three |

### Reds watched, verbatim

Each change reverted, the file run, the red read, the change restored. A WIP commit was taken first,
because `git checkout --` against the BASE silently discarded two earlier edits in this session —
recorded here because it is the kind of thing a later reader would otherwise reconstruct from a
confusing diff.

1. **The component skips `spreadLabels`** and draws the raw `worldToScreen` points:
   `× draws no two All dimensions labels at one point`
   `AssertionError: expected 12 to be 14 // Object.is equality`
   `× keeps the part’s own label on the anchor and steps the overall one off it`
   `AssertionError: expected [ …(14) ] to deep equally contain [ 'overall-width', '48px', '108px' ]`
   `Tests 2 failed | 9 passed (11)` — the `12 to be 14` is the defect itself: fourteen labels
   occupying twelve distinct points.
2. **The step direction made unconditional** (`const step = LABEL_BOX.height;`):
   `× steps a coincident label away from the nearer edge in the bottom half`
   `AssertionError: expected { x: 48, y: 590 } to deeply equal { x: 48, y: 530 }`
   `Tests 1 failed | 10 passed (11)` — 590 on a 600 px stage is the label walking off the bottom.
3. **The cap removed** (`MAX_STEPS = 99`):
   `× stops pushing a label after four steps and lets the rest overlap`
   `AssertionError: expected [ 18, 48, 78, 108, 138, 168 ] to deeply equal [ 18, 48, 78, 108, 138, 138 ]`
   `Tests 1 failed | 10 passed (11)`
4. **The refused WIDER predicate** (`SAME_ROW_PX = 30`, the full box height):
   `× leaves a label that is only a row apart where it asked to be`
   `AssertionError: expected [ { x: 48, y: 18 }, { x: 48, y: 68 } ] to deeply equal [ { x: 48, y: 18 }, { x: 48, y: 38 } ]`
   `× keeps the part’s own label on the anchor and steps the overall one off it`
   `AssertionError: expected [ …(14) ] to deep equally contain [ 'clearance-width', '48px', '18px' ]`
   `× moves nothing in the resting state, with or without a selection`
   `AssertionError: expected [ …(8) ] to deep equally contain [ 'overall-width', '48px', '18px' ]`
   `Tests 3 failed | 8 passed (11)` — note the third: the wider predicate breaks the resting-state
   floor with a part selected, which is the constraint this card was told it may not trade.
5. **Every anchor treated as covered** (`covered` answering `true` once anything is placed):
   all eleven cases red, including
   `× returns an anchor untouched when nothing else wants its row`
   `AssertionError: expected [ Array(2) ] to deeply equal [ { x: 48, y: 18 }, { x: -2, y: 48 } ]`
   and `× moves nothing in the resting state, with or without a selection`
   `AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]` — `Tests 11 failed (11)`.

### Every branch this card introduces, and what drives each

Read from `coverage-final.json` for the changed files, not reasoned. **Three branch points and
three functions, all in `dimensionFigures.ts`; `DesignerDimensions.vue` gains no branch at all** —
the `figures` computed gained a second `.map` and an `index`, not a conditional.

| Branch | Measured counts | Driven by |
|---|---|---|
| `sharesRow`'s `&&` — the column test, then the row test | `[1084, 603]` | both arms: 481 of the 1084 calls short-circuit on the column test alone, which is the "a column apart" case and every real figure set |
| `spreadLabels`: `anchor.y < stage.height / 2 ? +height : -height` | `[306, 114]` | "steps a coincident label away from the nearer edge in the %s half", the two-row `it.each`, plus every mounted case for the first arm |
| `spreadLabels`: `steps < MAX_STEPS && covered(at)` | `[420, 501]` | both arms. The LEFT arm answering false — the cap — is driven by "stops pushing a label after four steps", and is visible in that case's assertion rather than in the counter, since istanbul counts the operands and not the loop's exit reason |
| `spreadLabels` (function) | 154 calls | every case |
| the `covered` arrow | 501 calls | every case with more than one anchor |
| the `placed.some` arrow | 1084 calls | every case with more than one anchor |

Both files measure **zero** uncovered statements, functions and branches, which is the level W19-A
left them at.

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage` and `npm run analyze` were NOT
  run.** The card forbids them to workers. So: no `eslint .` over the whole tree, no `fallow` (dead
  exports, duplication, dependency hygiene — `spreadLabels` has exactly one production caller and a
  test, so an unused-export finding is not expected, but that is an argument and not a run), no
  `vite build`, and no coverage FLOOR check. The per-file coverage figure above was taken with
  `--coverage.reportsDirectory` pointed at a scratch path, so the shared `coverage/` was not
  touched.
- **No test outside `tests/presentation/designer/`, `tests/harness/` and `tests/build/styles.test.ts`
  was run.** Those three were, and are green; the rest of `tests/build/`, `tests/application/`,
  `tests/domain/`, `tests/infrastructure/` and `tests/release/` were not, on the card's narrow-gates
  rule. Nothing in this diff reaches them — the change is one presentation module and one SFC — but
  that is a prediction and not a result.
- **NO BROWSER, at any width. Every appearance claim in this card is UNRENDERED**, and this is the
  card's central limitation rather than a footnote: jsdom computes no layout, so no test here can
  measure a box, an overlap or a hit. `npm run harness-shot` and `npm run test-build` were not run.
  What a browser pass has to check is listed in its own section below.
- **No manual case was written or run in a vault.** `docs/tests/cases/` is not in this lease.
- **No axe scan covers the staggered state.** `accessibilityDesignerSelection.test.ts` mounts the
  designer in its RESTING state, which this card provably does not change; nothing scans the overlay
  with `All dimensions` on.
- **The German copy was not reviewed and no copy was written** — this card adds no string.

## What only a browser can settle

Every one of these is a measurement no gate in this repository performs. The first three are the
ones that decide whether this fix is right.

1. **Re-run AD18-R14's own measurement.** `?view=asset-designer`, the vanity shape, a 1280 leaf, at
   the camera `DesignerCanvas` fits on mount, with `All dimensions` on. The defect table read 26
   labels / 31 overlapping pairs, with three in one box. The claim this card supports is only the
   LAST of those: no label should now be fully covered. **The overlapping-pair count is expected to
   fall, not to reach zero** — the rule deliberately leaves partial overlaps alone, and a report of
   "still N overlapping pairs" is not by itself a failure of this fix.
2. **Click every label in that state.** The whole charter is that an unreachable control is the
   defect; the only honest proof is pressing each one and getting its field.
3. **Does a moved label still read as belonging to what it measures?** On the vanity shape a label
   was pushed up to 90 px off its anchor in this repository's own fixture, and the cap allows 120.
   At fit zoom that can be most of the shape's height. If a staggered label reads as measuring the
   wrong part, the chooser arm in the table above is the one to re-open.
4. **Is the 40 x 30 px `LABEL_BOX` model big enough?** It is AD18-R14's measured box with the width
   rounded up for a four-digit reading, and nothing here can check it against a real font. A model
   too NARROW leaves near-coincident labels unresolved; too wide, it moves labels that did not need
   moving.
5. **Stability under a drag.** The stagger is recomputed each frame, so a label can snap between
   slots as a part moves across a threshold. Nothing here can see that. Drag a part with
   `All dimensions` on and watch whether the numbers jitter.
6. **The open FIELD over a staggered label.** `placement` is fed the moved point, so a label pushed
   across the stage's middle now opens its form the other way. That is correct by construction and
   has never been seen.
7. **Zoomed in.** AD18-R14 measured 31 → 13 overlaps over three wheel steps. At a zoom where nothing
   collides, this rule is a no-op and the picture should be identical to the wave-19 one.

## Data and integration implications

Schema/migration change: **none.** Nothing here reads or writes an `Asset`, a sidecar or a note.
Relevant renderer/export/revision consumers: **none.** `spreadLabels` is called from one place,
`DesignerDimensions.vue`'s `figures` computed, and its output reaches only two CSS properties.
Undo/no-op/conflict/failure coverage: **untouched.** No command, no dispatch, no history entry; the
C03 no-op comparison (`unchanged`) and the signed-gap convention (`gapOf`) are byte-identical.
Identity/unit/quantity/calibration invariants: **untouched.** The rule operates in stage PIXELS,
after `worldToScreen`; no world millimetre is read, written or rounded by it, and the branded
`ScreenPoint` is what keeps that true at the type level rather than by convention.
Shared root/runtime/locales wiring still required: **none.** No locale key, no runtime field, no
registration; `AssetDesignerRoot.vue` and `runtime.ts` are untouched.
Rollback/recovery considerations: the change is one function and one call site. Reverting the call
site restores the wave-19 behaviour exactly, which is what red 1 above demonstrates.

## Outside the lease — reported, not taken

Nothing was found that needs another card's file. Two observations, neither acted on:

1. **`designerDimensions.test.ts` (W19-A's) has no case asserting a label position under
   `All dimensions`**, which is why this card's change could not have been caught there. That file
   is not in this lease and was not edited; the new coverage lives in
   `dimensionCollision.test.ts` beside it.
2. **`dimensionFigures.ts` is at 381 lines and `DesignerDimensions.vue` at 308**, both well inside
   `src/`'s budget, but the pure module now holds two rules in two coordinate spaces. If a third
   arrives, a `labelSpread.ts` beside it is the seam — it was refused here only because a new source
   file is not in this card's lease.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
