# Task report — W21-A (dimension collision)

**Rounds 2 and 3 amend this report throughout.** Round 2 answered ten review findings (three claims
here were WRONG and one arm had not been measured); ROUND 3 answers a browser re-capture that
confirmed the fix and refused the charter — two labels still had no reachable point — and closes it
with a second rule about the UNION of covering labels. Round 3 is at the foot and is the authority
where it and an earlier section disagree.

Round 2: What changed is in "Round 2" at the foot; the sections above are
corrected in place where round 1 was wrong, with the correction marked. Nothing that was true in
round 1 was removed.

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
label height away, repeatedly, up to four steps; earlier wins.** It is `spreadLabels` in
`dimensionFigures.ts` — pure, in stage pixels — and the component hands it the points
`worldToScreen` has just produced and draws what comes back.

Three decisions inside that sentence, each with its losing side stated below:

- **The predicate is "same row, overlapping column", not "the boxes intersect."** Every label is the
  same HEIGHT, so a pair on genuinely different rows leaves a strip of the lower one exposed
  whatever their widths; only a pair within a few pixels of one row can swallow another whole. The
  tolerance is **8 px vertically and 15 px horizontally**. The horizontal number is a CONTAINMENT
  bound — a label is lost when a later one covers it whole, which needs their centres within
  `(wider − narrower) / 2`, about 13 px across this surface's readings — and NOT the label's own
  ~40 px width, which is what round 1 used. Round 2 measured the difference and retuned it; the
  table is under `SAME_COLUMN_PX` and in the round-2 section below.
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
| **ROUND 2 — step only EXACTLY coincident anchors** (the narrower arm round 1 never measured) | Measured across ten cameras from `MIN_ZOOM` to 0.5 under `All dimensions`, counting labels left more than 90% covered by a later one: **17** against the shipped rule's **9**, against 36 with no rule at all. It fixes less than half the defect, because a wide reading swallows a narrow one whole without landing on it — `-1050` is ~46 px and `0` is ~20 px, so a 10 px offset hides the second entirely and this arm leaves it. | It is genuinely cheaper: 20 placements moved against 60, and it holds the SELECTED resting state at literally zero movement, which the shipped rule does not (see F2 below). That is a real cost and it is the reason this was close. |
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
| AD18-R14: no drawn label is impossible to click | **MET as measured, round 3** — a browser re-capture of round 2 found two labels with no reachable point, and round 3 closes them | "leaves every label of the vanity’s All dimensions frame a strip, at the camera it opens with" reconstructs the capture's own 26-label frame, asserts the two dead labels BY NAME without the rule and none with it, measured on a grid sample rather than by the rule's own arithmetic | Two escapes remain, both named in `spreadLabels`: a pair just over `SAME_ROW_PX` apart is pressable but may not be legible, and a jam that exhausts `MAX_STEPS` repeats a slot — bounded at five distinct slots for six labels, asserted rather than hoped for. Still a rule about ANCHORS and a MODELLED box, so a vault at a larger UI font is outside it |
| AD18-R14: the resting state stays at ZERO overlapping pairs | met | "returns an anchor untouched when nothing else wants its row" (pure) and "moves neither label of the unselected resting state" (mounted, asserting the overall pair at exactly `48px`/`18px` and `-2px`/`48px`) | **Round 2 corrected the evidence.** Round 1 cited a case called "moves nothing in the resting state, with or without a selection" whose SELECTION arm asserted `toContainEqual` on exactly the two labels that do not move, while the module's own table recorded two that do. The floor AD18-R14 sets is the state it MEASURED — nothing selected, two labels — and that is untouched; the selected state is a different one and moves two of its eight |
| A selected part's labels: what moves, named | met, ROUND 2 | "moves two of the eight labels a selected part draws, and names them" — the full list by exact array in DOM order | Three of those eight anchors shared y = 48 before this card, so the movement is a fix rather than a regression. The claim was the defect, not the behaviour |
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
| `grep -n "^export" src/presentation/designer/dimensions/dimensionFigures.ts` | candidate, AFTER the change | three lines, in this order: `DimensionFigure` (a type, line 46), `dimensionFigures`, `spreadLabels` | the header's "two exported FUNCTIONS" sentence. **Round 2 corrected it**: it had called the type the THIRD line while this very row listed it first |
| `wc -l` over the changed files | candidate, round 2 | `dimensionFigures.ts` **439**, `DesignerDimensions.vue` **314**, `dimensionCollision.test.ts` **274**, `styles/designer-dimensions.css` **112** | **Round 2 corrected these.** Round 1 reported 381 and 308, both taken before its last edit and neither re-run |

### Reds watched in round 1, verbatim

**Read these against ROUND 1 code**, which is what they were run on: the constant was still called
`LABEL_BOX`, its width was 40, and two cases have since been renamed. They are kept as the record of
what was watched rather than rewritten to match the current tree. Round 2 has its own reds at the
foot of this report.

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

| Branch | Measured counts (round 2) | Driven by |
|---|---|---|
| `sharesRow`'s `&&` — the column test, then the row test | `[1042, 232]` | both arms: 810 of the 1042 calls short-circuit on the column test alone, which is "a column apart", the new containment-bound case, and every real figure set. (Round 1 read `[1084, 603]`; the narrower reach short-circuits far more often, which is the retune visible in the counter) |
| `spreadLabels`: `anchor.y < stage.height / 2 ? +height : -height` | `[312, 118]` | "steps a coincident label away from the nearer edge in the %s half", the two-row `it.each`, plus every mounted case for the first arm |
| `spreadLabels`: `steps < MAX_STEPS && covered(at)` | `[430, 497]` | both arms. The LEFT arm answering false — the cap — is driven by "stops pushing a label after four steps, and the sixth then hides the fifth", and is visible in that case's assertions rather than in the counter, since istanbul counts the operands and not the loop's exit reason |
| `spreadLabels`, the `covered` arrow, the `placed.some` arrow | all called | every case; every case with more than one anchor for the two arrows |

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
3. **Does a moved label still read as belonging to what it measures?** On this repository's own
   fixture a label is pushed up to 60 px off its anchor (90 px before round 2's retune), and the cap
   allows 120. At fit zoom that can be most of the shape's height. If a staggered label reads as
   measuring the wrong part, the chooser arm in the table above is the one to re-open.
4. **Is the 15 px containment bound right for the real font?** It is derived from a width model
   (~14 px of border and padding plus ~6.4 px per tabular digit, fitted to AD18-R14's measured
   33.4 px) and nothing here can check that model against what Obsidian actually draws — least of
   all a five-glyph SIGNED reading like `-1050`, which `gapOf` really does produce. Too narrow and a
   wide label still swallows a narrow one; too wide and it moves labels that were never at risk,
   which is what round 1's 40 px did.
5. **Is `SAME_ROW_PX = 8` legible or merely pressable?** The strip it guarantees is at the BOTTOM of
   a 30 px box whose digits are centred, so between roughly 8 and 20 px of separation the lower
   label can be clicked while its number is still hidden. Raising it buys legibility by moving more
   labels. This is a judgement only a screen can make.
6. **Hide a part and watch the unrelated labels jump.** Dropping `detail-1` from the view moves
   `overall-width` and `overall-depth` even though neither measures it, because the sweep is over
   the whole list. Cheaper to reproduce than the drag jitter below and the same class of surprise.
7. **Stability under a drag.** The stagger is recomputed each frame, so a label can snap between
   slots as a part moves across a threshold. Nothing here can see that. Drag a part with
   `All dimensions` on and watch whether the numbers jitter.
8. **The open FIELD over a staggered label.** `placement` is fed the moved point, so a label pushed
   across the stage's middle now opens its form the other way. That is correct by construction and
   has never been seen.
9. **Zoomed in.** AD18-R14 measured 31 → 13 overlaps over three wheel steps. At a zoom where nothing
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
2. **`dimensionFigures.ts` is at 439 lines and `DesignerDimensions.vue` at 314** (round 2 figures,
   `src/`'s budget, but the pure module now holds two rules in two coordinate spaces. If a third
   arrives, a `labelSpread.ts` beside it is the seam — it was refused here only because a new source
   file is not in this card's lease.

## Round 2 — the ten findings

**Three claims in round 1 were wrong; one arm had not been measured; the rest are prose that was
wider than its check.** Everything below was verified at the code before it was applied.

### F9 — the arm not measured. DECISION: keep the wider predicate, but RETUNE it.

**Measured here rather than taken on report.** Ten cameras from `MIN_ZOOM` (0.01) to 0.5, under
`All dimensions` — 140 placements — counting labels left more than 90% covered by a LATER one,
using a width model fitted to AD18-R14's measured 33.4 px box:

| predicate | left covered | moved |
|---|---|---|
| none (today's defect) | 36 | 0 |
| exact coincidence only (the reviewer's arm) | 17 | 20 |
| 10 px | 7 | 54 |
| 12 px | 8 | 58 |
| **15 px (taken)** | **8** | **60** |
| 40 px (round 1) | 9 | 79 |

The reviewer's arm reproduces exactly as reported at the opening camera — `All dimensions` moves 2
rather than 5, a selected part moves 0 rather than 2 — and that measurement is correct. **It is
also not the whole picture: across the camera range it leaves 17 labels covered against 9.** The
reason is structural rather than about this fixture. A label is lost when a later one covers it
WHOLE, which needs their centres within `(wider − narrower) / 2`, not at zero: `-1050` is about
46 px and a one-glyph `0` — which a zero gap draws — about 20 px, so a 13 px offset hides the
narrow one completely and an exact-coincidence rule leaves it. The narrow arm gives up the property
AD18-R14 actually asks for, and it gives it up in the direction of the original defect.

**But the reviewer was right that 40 was the wrong number, and F4 was pointing at the same thing
from the other side.** 40 was the label's own WIDTH; the quantity that matters is the containment
bound, about 13 px. Retuning to **15** — the smallest measured value that clears the bound with a
margin — is strictly better than round 1 on both axes: one fewer label covered and **19 fewer
placements moved**. `SAME_COLUMN_PX` carries the table and the derivation. `LABEL_BOX` is gone,
replaced by `LABEL_HEIGHT_PX` and `SAME_COLUMN_PX`, which are two different quantities and were
never one object.

**What the retune costs:** a partial overlap between 15 and 40 px of horizontal offset is now left
alone. Those are clickable and they are ugly, and "ugly" is the half no gate here can grade.

### F1 — the cap produces exact coincidence. CONFIRMED. Prose changed; behaviour NOT.

Verified at the assertion: all six anchors share `x: 48` and the fifth and sixth both land on
`y: 138`, so the fifth is painted under the sixth and cannot be pressed — AD18-R14's own defect,
asserted green under a docblock calling it "a partial overlap and therefore still clickable". Both
false sentences are replaced, and the test now **asserts the residual first**
(`expect(placed[4]).toEqual(placed[5])`), so it is pinned rather than incidental.

**The behaviour is unchanged, and that is a decision rather than an omission.** Neither alternative
dominates. Stepping past the cap until the point is free restores distinctness and pays by pushing
a label off a canvas that is `overflow: hidden`, which is unreachable AND invisible; and at
`MIN_ZOOM` — where this is reachable at all — it would scatter labels hundreds of pixels from what
they measure. The arm that actually closes it is a chooser over a jammed group, which needs a
locale string this card may not add. The suggested "always clickable, sometimes badly placed" holds
only while the canvas does not clip, which it does.

### F2 — "moves nothing … with or without a selection" moved two labels. CONFIRMED.

Verified: the selection arm asserted `toContainEqual` on `detail-detail-1-width` and
`overall-width`, which are precisely the two that stay. Split into two cases and both renamed:
"moves neither label of the unselected resting state" (exact array — the floor AD18-R14 measures)
and "moves two of the eight labels a selected part draws, and names them" (exact array, DOM order,
so a future retune cannot move a third quietly). The acceptance row that cited the false name is
corrected above, and the component docblock now says the selected state moves two.

**The behaviour is a fix, not a regression**, and the report says so: three of those eight anchors
sat on y = 48 before this card, so the selected state was never at zero overlaps. After round 2's
retune the two that move are `detail-detail-1-offset-left` (+30) and `overall-depth` (+60).

### F3 — the grep sentence. CONFIRMED and corrected.

`grep -n "^export"` prints `DimensionFigure` at line 46, `dimensionFigures` at 272 and
`spreadLabels` at 372. The header called the type the third line. It now says FIRST, which is what
this report's own evidence row said all along — the docblock contradicted the transcript of the
same command, in the same commit.

### F4, F5, F6, F7, F8 — taken, all of them

- **F4** (the threshold's justification) — taken twice over. The column reach is re-derived as a
  containment bound and names the signed five-glyph case explicitly; `SAME_ROW_PX` now says it
  guarantees PRESSABLE and not READABLE, and names the 8-to-20 px band in which the lower label's
  digits may still be hidden. Both are on the browser list.
- **F5** (the direction rule's conditions) — taken. `spreadLabels` states that clipping is
  prevented while the stage is at least 240 px tall, and that `EditorStore` initialises `stageSize`
  to `{ 0, 0 }`, so until the resize observer first reports every anchor reads as the bottom half
  and every step goes up. Transient, and now written down.
- **F6** (hiding a part relocates unrelated labels) — taken, added to the browser list as item 6,
  with the mechanism: the sweep is over the whole list, so removing a member re-runs it for all.
- **F7** (the reachability test is narrower than claimed) — taken. The acceptance row is rewritten,
  the test docblock says it pins DISTINCT POSITIONS and not reachability, and `spreadLabels`' "What
  this does NOT claim" names all three escapes: a 1 px offset, two later labels straddling an
  earlier one, and the cap.
- **F8** (line counts) — confirmed and corrected; round 1's numbers were taken before its last
  edit. The current counts are in the executed-checks table and were re-run.

### Nothing above was found to be wrong

Every finding reproduced at the code. The only place this round departs from the recommendation is
F9, and it departs by taking the finding's REASON (40 was the wrong quantity) without taking its
conclusion (drop to exact coincidence) — on a measurement that had not been run, the camera sweep
rather than the single opening camera.

### Reds watched in round 2, verbatim

6. **The column reach back to the label WIDTH** (`SAME_COLUMN_PX = 40`, round 1's value):
   `× leaves a pair whose boxes overlap but whose readings cannot contain each other`
   `AssertionError: expected [ { x: 48, y: 18 }, { x: 68, y: 48 } ] to deeply equal [ { x: 48, y: 18 }, { x: 68, y: 18 } ]`
   `× keeps the part’s own label on the anchor and steps the overall one off it`
   `AssertionError: expected [ …(14) ] to deep equally contain [ 'overall-width', '48px', '78px' ]`
   `Tests 2 failed | 11 passed (13)`
7. **The column reach UNDER the containment bound** (`SAME_COLUMN_PX = 0.5`, the F9 arm):
   `× leaves no two labels on one row across the whole All dimensions set`
   `AssertionError: expected [ …(4) ] to deeply equal []`
   `× moves two of the eight labels a selected part draws, and names them`
   `AssertionError: expected [ …(8) ] to deeply equal [ …(8) ]`
   `Tests 2 failed | 11 passed (13)` — four pairs still sharing a row is that arm's cost, in red.
8. **The cap removed** (`MAX_STEPS = 99`), so the residual this card now PINS disappears:
   `× stops pushing a label after four steps, and the sixth then hides the fifth`
   `AssertionError: expected { x: 48, y: 138 } to deeply equal { x: 48, y: 168 }`
   `Tests 1 failed | 12 passed (13)` — the residual assertion is deliberately FIRST in the case,
   since vitest stops at the first failing expect and it is what the docblock is about.

### Round 2 checks

| Command | Result |
|---|---|
| `npx vitest run tests/presentation/designer/dimensions/` | `Test Files 3 passed (3) / Tests 72 passed (72)` |
| `npx vitest run tests/presentation/designer/` | `Test Files 77 passed (77) / Tests 1073 passed (1073)` |
| coverage for the two changed files, scratch reports directory | still **zero** uncovered statements, functions and branch arms |
| `npx vue-tsc -noEmit`, `npx eslint …`, `npx oxlint …`, `node scripts/styles-assemble.mjs` | exit 0, no output |
| `wc -l` | 439 / 314 / 274 / 112 |

Unchanged from round 1 and still NOT run: `npm run check`, `check:fast`, `test:coverage` and
`analyze`; any browser at any width; any manual vault case; any axe scan of the staggered state;
and every test directory outside `tests/presentation/designer/`.

## Round 3 — closing the union case the browser found

**The re-capture confirmed the fix and refused the charter**, and it was right on both counts: the
exact-coincidence defect AD18-R14 was written about is gone, and two labels still had no reachable
point anywhere in their box. Round 2's own "What this does NOT claim" had named the mechanism —
*"two LATER labels that straddle an earlier one, covering it between them while sharing a row with
neither"* — so this round closes a gap that was disclosed rather than one that was hidden. Being
disclosed is not being fixed.

### What was added: a SECOND rule, about the union

A candidate slot is now refused when it would EITHER sit on an already-placed label's row — the
pairwise rule, unchanged — OR leave one with no clear strip at all once every label drawn over it is
counted **together**. The second is not a widening of the first and cannot be expressed as one: the
capture's victim had three coverers at 8.1, 10.5 and 19.1 px, every one correctly outside
`SAME_ROW_PX`, which together blanketed its whole 30 px height.

Three things had to arrive with it:

- **A label's WIDTH, from the digits it draws.** `spreadLabels` now takes `{ at, value }` per label
  instead of a bare point, because "does this cover that" is a question about boxes and the box's
  width is the number's glyph count. The model — 14 px of chrome plus 6.4 px per tabular digit — is
  the one round 2 derived, and **the re-capture validated it to within 0.2 px at three widths**
  (20.5 / 26.9 / 33.4 measured against 20.4 / 26.8 / 33.2 predicted). It still models one font at
  one size and says so.
- **`SPAN_SLACK_PX = 4`** — how much of a victim's width a coverer may leave showing and still count
  as covering it. A four-pixel strip down a label's side is not a hit target.
- **`MIN_BAND_PX = 10`** — how much of a label's height must stay clear of everything drawn over it.
  Ten pixels is a third of the box across its full width. **Measured, not chosen**: twelve keeps the
  overlap count at the fit camera but starts moving four of a selected part's eight labels instead
  of two, and that is the floor. Ten is the largest value that holds it.

### And one thing CHANGED at the cap, which the ruling asked me to flag

**The cap's step count is unchanged at four. What happens when it runs out is not.** It used to take
the last slot it had stepped to, so two labels that both ran out landed on one point — F1's
residual. It now scores the five candidate slots by the widest band each leaves the worst-affected
label and takes the best. That is free: the same five positions, one of which it was going to pick
anyway.

**On the browser-measured frame this is the whole of the difference between one dead label and
none** — reverting just this, with the union rule left in, leaves `clearance-offset-top` unreachable
(red 10 below). The residual is not gone and is now precisely statable: five slots cannot hold six
labels, so one must repeat another. What changed is WHICH it repeats — the emptiest, not the last.

### What was measured, and the arms refused

Over the **real vanity preset** (26 labels), at the **real `fitViewport` camera**, on a 1280 x 800
stage, with "unreachable" sampled on a grid across each box exactly as the capture's
`elementFromPoint` sweep does — **and counted only for labels lying fully inside the canvas**, which
is the integrator's own instrument lesson taken rather than re-learned:

| rule | unreachable @fit | unreachable, 7 cameras | moved | pairs @fit | pairs, 7 cameras |
|---|---|---|---|---|---|
| none (the defect) | 2 | 7 | 0 | 30 | 156 |
| pairwise only (round 2) | 1 | 6 | 59 | 12 | 102 |
| **pairwise + union (shipped)** | **0** | **0** | **56** | **14** | **85** |
| every intersecting pair | 1 | 5 | 89 | 18 | 107 |
| union alone, no pairwise | 0 | 0 | 27 | 22 | 127 |

**Two arms refused, for opposite reasons.**

- **Separate every intersecting pair.** Moves half again as many labels (89) and STILL leaves five
  unreachable, because the extra movement exhausts `MAX_STEPS` far more often — which is the same
  arm round 2 refused, now refused again with a better instrument and for a sharper reason: it does
  not even buy the property it costs so much for.
- **Drop the pairwise rule, keep only the union one.** Genuinely tempting and the closest call of
  the three rounds: 0 unreachable everywhere at **less than half the movement** (27 against 56).
  It is refused because it gives back most of the overlap reduction this card exists for —
  22 overlapping pairs at the fit camera against 14, where the defect started at 30. The losing
  side is real: a quieter rule that moves 29 fewer labels is on the table if a browser pass decides
  the movement reads worse than the overlap does.

A finer sweep of the two thresholds is in the module: every combination of span slack {0, 4, 8, 12}
and band {6, 8, 10, 12, 14} reached **zero unreachable at every camera**, so the two numbers were
chosen on movement and on the selected-state floor rather than on reachability, which none of them
threatened.

### The floors, held

| state | before this round | after |
|---|---|---|
| unselected resting, `editableShape` | 2 labels, 0 moved, 0 overlapping pairs | **unchanged** — asserted by exact array |
| unselected resting, vanity at fit | 2 labels, 0 moved, 0 unreachable, 0 pairs | **unchanged** |
| selected part, `editableShape` | 8 labels, **2** moved | **2** — the same exact array, byte for byte |
| selected part, vanity at fit | 8 labels, 4 moved, 0 unreachable | **4**, 0 unreachable — unchanged |

The selected-state exact-array case is what pins the `MIN_BAND_PX = 10` choice: at 12 it goes red
with four labels moving (red 11b).

### My prediction for the re-capture

Stated as numbers, at 1280, vanity, `All dimensions`, the fit camera:

- **Labels completely unclickable: 0.** This is the claim. My model says 0 at the fit camera and at
  every other camera I measured; I would treat any non-zero as a failure of this round.
- **Overlapping pairs: 16.** My model reads 12 for the merged rule where the capture read 14, so it
  under-reads by about 2; it reads 14 for this one. **I will be wrong if the count is outside
  14–18.** The rise of about 2 is the price of the union rule and is the only regression I expect.
- **Resting state: 2 labels, 0 overlapping pairs, 0 unclickable.** Unchanged.
- **Zoomed in one step and two:** unreachable stays 0, overlapping pairs fall. My model reads 13 and
  2 at 1.5x and 2x, against the merged rule's 16 and 2 — so this round should read BETTER than the
  merged one at every camera except the fit one.

### Reds watched in round 3, verbatim

9. **The union half removed from `hides`, pairwise only** — the merged rule:
   `× keeps a strip of a narrow label clear when three wider ones would blanket it together`
   `AssertionError: expected 0 to be greater than 0`
   `× moves the second of two coverers that are each harmless alone`
   `AssertionError: expected { x: 600, y: 132 } to not deeply equal { x: 600, y: 132 }`
   `Tests 2 failed | 14 passed (16)`
10. **The scored fallback removed, taking the last slot stepped to** — union rule left in:
    `× leaves every label of the vanity’s All dimensions frame a strip, at the camera it opens with`
    `AssertionError: expected [ 'clearance-offset-top' ] to deeply equal []`
    `Tests 1 failed | 16 passed (17)` — one of the capture's own two dead labels, by name.
    **This red is why that case exists**: the first attempt at it passed all seventeen smaller cases
    with the fallback reverted, and only the real 26-label frame could tell the two apart.
11. **`MIN_BAND_PX` raised to 12**, the value the selected-state floor refuses:
    `× moves two of the eight labels a selected part draws, and names them`
    `AssertionError: expected [ …(8) ] to deeply equal [ …(8) ]`
    `Tests 1 failed | 17 passed (18)`
12. **The width model made a single nominal width** (`GLYPH_PX * 3` for every label):
    `× covers a one-glyph reading with a four-glyph one that a single nominal width would miss`
    `AssertionError: expected { x: 612, y: 129 } to not deeply equal { x: 612, y: 129 }`
    `Tests 1 failed | 17 passed (18)` — this case was ADDED in this round because the first attempt
    at the mutation passed everything, so the model was a claim with nothing under it.
13. **`freeBand` dropping the gap after the last cut** (`return widest`):
    eleven cases red, including
    `× stops pushing a label after four steps, and then repeats a slot rather than inventing one`
    `AssertionError: expected [ 18, 18, 18, 18, 18 ] to deeply equal [ 18, 48, 78, 108, 138 ]`
    and `× leaves every label of the vanity’s All dimensions frame a strip…`
    `AssertionError: expected [ 'detail-detail-1-offset-top', …(1) ] to deeply equal []`
    `Tests 11 failed | 6 passed (17)`
14. **`SPAN_SLACK_PX` widened to a whole label height (30)**:
    `× leaves a pair whose boxes overlap but whose readings cannot contain each other`
    `AssertionError: expected [ { x: 48, y: 18 }, { x: 68, y: 48 } ] to deeply equal [ { x: 48, y: 18 }, { x: 68, y: 18 } ]`
    plus three more — `Tests 4 failed | 14 passed (18)`

### Round 3 checks

| Command | Result |
|---|---|
| `npx vitest run tests/presentation/designer/dimensions/` | `Test Files 3 passed (3) / Tests 77 passed (77)` |
| `npx vitest run tests/presentation/designer/` | `Test Files 77 passed (77) / Tests 1078 passed (1078)` |
| coverage for the two changed files, scratch reports directory | **zero** uncovered statements, functions and branch arms — held across eight branch points in the new code |
| `npx vue-tsc -noEmit`, `npx eslint …`, `npx oxlint …`, `node scripts/styles-assemble.mjs` | exit 0, no output |
| `wc -l` | `dimensionFigures.ts` 568, `DesignerDimensions.vue` 318, `dimensionCollision.test.ts` 423, `styles/designer-dimensions.css` 112 (unchanged, still leased and still untouched) |

Still NOT run, unchanged from rounds 1 and 2: `npm run check`, `check:fast`, `test:coverage`,
`analyze`; any browser at any width; any manual vault case; any axe scan; and every test directory
outside `tests/presentation/designer/`.

**`dimensionFigures.ts` is 568 lines**, which is worth flagging rather than burying: it now holds
two rules in two coordinate spaces and the pure module is the largest file in this lease. A
`labelSpread.ts` beside it is the seam if a third arrives; a new source file is still outside this
card's lease.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
