# Task report — W17-B (canvas rulers)

Outcome: implemented
Owner / worktree / branch: card W17-B / `.worktrees/ad07` / `w17b-canvas-rulers`
Base commit / candidate commit: `480dbbc85` / two commits on the branch — the rulers, then the
review fix round (a second commit rather than an amend, so the round is reviewable on its own).
Accepted contract revision: DECISIONS.md **AD18-R9** (authorisation and scope) and **AD18-R10**
including its *"AMENDED the same day"* clause (the canvas-share binding, settled by the user
while this card's fix round was in flight); the approved spec is
`docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md` §0, increment 3.
Allowed scope and shared-file leases: as the card states. Nothing outside the lease was edited —
`{en,de}/assetSymbols.ts` and `tests/presentation/designer/designerTheme.test.ts` are untouched,
and `styles/designer.css` — at the assembler's 400-line cap — was not opened. **No line count for
that file is written here**: `designer-add.css` records five sibling partials falsified by exactly
that habit and `designer-trace.css` says to run `wc -l` instead, which is a rule this report's first
version broke in two places by carrying a figure in from the card brief.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/rulers/rulerMarks.ts` | New. `rulerLabels` — the labelled marks of a ruler over a visible span, every fifth step, counted from the grid's origin. | yes |
| `src/presentation/designer/rulers/DesignerRulers.vue` | New. The two strips, their tiling, their labels and the selection's extent, as a DOM overlay. | yes |
| `src/presentation/designer/DesignerCanvas.vue` | Mounts `<DesignerRulers />` in `EditorSurface`'s `overlay` slot, before the forwarded `<slot />`. | yes |
| `src/presentation/designer/grid/designerGrid.ts` | Docblock only: the "ONE function for … so the three cannot disagree" sentence rewritten to FOUR, from a grep run after the change. | yes |
| `src/presentation/i18n/locales/en/designerRulers.ts` | New. One string: the pair's accessible name. | yes |
| `src/presentation/i18n/locales/de/designerRulers.ts` | New. Its German half. | yes |
| `src/presentation/i18n/locales/{en,de}/editor.ts` | Import and spread of the two modules, beside `designerTrace`. | yes |
| `styles/designer-rulers.css` | New partial, comfortably under the assembler's 400-line cap and mostly comment — **run `wc -l`; no figure for it is written here either**, see F4 below. `designer.css` is at that cap, which is why the seam exists. | yes |
| `styles/index.css` | `@import "./designer-rulers.css";` after `designer-add.css`. Position is not load-bearing — no other partial declares any selector in it. | yes |
| `tests/presentation/designer/rulers/rulerMarks.test.ts` | New, node. The arithmetic. | yes |
| `tests/presentation/designer/rulers/designerRulers.test.ts` | New, jsdom. What is drawn, where it refuses, where the mounted designer puts it, and what the stylesheet declares. | yes |
| `docs/tasks/asset-designer-expansion/reports/W17-B-canvas-rulers.md` | This report. | yes |

**Not edited, deliberately**: `AssetDesignerRoot.vue` is in the lease and needed no change. The
rulers mount in `DesignerCanvas`, which already computes the camera and the design the component
needs and is itself inside the overlay path; putting the element in the root would have been the
same mount one level further from what it annotates, with no gate seeing a difference.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Top and left millimetre rulers | met | `designerRulers.test.ts` "numbers both strips every five steps, at the stage pixel each mark sits on"; browser screenshots at 1280 dark and 580 light | — |
| Following the camera | met | same case plus "tiles the minor ticks at the step's screen size, anchored on the grid's own origin" — both positions are re-derived from `editor.viewport` per read | — |
| The selection's extent marked | met | "marks the selected part's extent on both strips, and marks nothing while nothing is selected"; measured in the browser after selecting `Bowl`: a 167×3 band on the top strip and a 3×248 band on the left | Not ANNOUNCED — see "screen readers" below |
| The extent follows the gesture | met, in the fix round | "moves the extent band with a gesture's preview while the ruler itself stands still" — the first version read the COMMITTED shape and lagged every drag; see F1 below | — |
| On this document's step function | met | the component calls `designerGrid`; that function's docblock NAMES its four consumers rather than quoting a line count — the first version quoted `grep -rn "designerGrid(" src/` as printing five lines and its own text made the true answer six, which is CLAUDE.md's `registerView` trap | — |
| DOM overlay, not a Konva layer | met | "mounts them in the canvas overlay …" asserts `.rp-plan-overlay` contains the element; nothing was added under `designer/layers/` | — |
| AD18-R10: canvas not below 50% at 580 | met | the browser measurement below: 50.0% before and after, to the hundredth of a pixel | — |
| AD18-R10: the card measures and reports its own cost | met | the table below, taken in Chrome against `npm run harness` | — |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/rulers/rulerMarks.test.ts` against a stub returning `[]` | working tree, before implementing | FAIL | `AssertionError: expected [] to deeply equal [ -25000, +0, 25000, 50000 ]`; `Tests 4 failed \| 1 passed (5)` |
| `npx vitest run tests/presentation/designer/rulers/` | working tree | exit 0 | `Test Files  2 passed (2)` / `Tests  13 passed (13)` |
| Same, with three invariants reverted (see "Red watched" below) | working tree | FAIL | `Tests  3 failed \| 5 passed (8)` |
| `npx vitest run tests/presentation/designer/rulers/` after the `writing-mode` fix and its case | working tree | exit 0 | `Test Files  2 passed (2)` / `Tests  14 passed (14)` |
| Same file with `writing-mode: vertical-rl` deleted | working tree | FAIL | `AssertionError: expected [] to deeply equal [ { name: 'writing-mode', …(1) } ]`; `Tests  1 failed \| 8 passed (9)` — restored |
| `npx vitest run tests/presentation/designer` (the whole directory, the regression sweep for an element added to every designer mount) | working tree | exit 0 | `Test Files  72 passed (72)` / `Tests  984 passed (984)` |
| Same sweep re-run after the F1 fix | working tree | exit 0 | `Test Files  72 passed (72)` / `Tests  985 passed (985)` |
| **Fix round** — `designerRulers.test.ts` with the F1 case added, against the COMMITTED reading | working tree | FAIL | `AssertionError: expected [ '-12px', '120px' ] to deeply equal [ '-72px', '240px' ]`; `Tests  1 failed \| 9 passed (10)` |
| `npx vitest run tests/presentation/designer/rulers/` after the F1 fix | working tree | exit 0 | `Test Files  2 passed (2)` / `Tests  15 passed (15)` |
| F6 looked at in Chrome: pan 40 px at 1280 and re-measure both strips geometrically | working tree | defect reproduced | the left strip lost its `0` and read 250, 500, 750 … `elementFromPoint` is useless here — `pointer-events: none` makes every ruler element transparent to hit-testing, so the overlap is measured as rectangle intersection |
| `npx oxlint` over every new and changed file | working tree | exit 0 (oxlint prints nothing when clean) | — |
| `npx eslint` over `DesignerRulers.vue`, `DesignerCanvas.vue`, both locale modules and `rulerMarks.ts` | working tree | exit 0 | the locale pair goes through `obsidianmd/ui/sentence-case-locale-module` |
| `npm run harness`, Chrome, `?view=asset-designer&preset=toilet` at 1280 and 580, dark and light | working tree | see the measurement below | probes throw on a missed selector |

### Red watched, verbatim

Three invariants reverted in one run, each failing at its own case and nothing else:

- The mount removed from `DesignerCanvas`'s overlay →
  `Error: Unable to get .rp-designer-rulers within: <div class="renovation-asset-designer">…`
- The unscaled gate reduced to `if (view === null) return null;` →
  `AssertionError: expected true to be false // Object.is equality` at
  `designerRulers.test.ts:142` (`draws no ruler at all over an unscaled design`)
- `pointer-events: none` deleted from `.rp-designer-rulers` →
  `AssertionError: expected [] to deeply equal [ { name: 'pointer-events', …(1) } ]`

`Test Files  1 failed (1)` / `Tests  3 failed | 5 passed (8)`. All three restored and re-run green.

## The rendered measurement (AD18-R10)

Chrome against `npm run harness`, `?view=asset-designer&preset=toilet`. Every figure is
`getBoundingClientRect().width`, rounded to 1/100 px, read by a probe that **throws** when a
selector misses — which it did once, loudly, before the page had mounted
(`Error: probe missed: .renovation-asset-designer`), so the instrument is known to be able to fail.
"Before" is the same live page with `.rp-designer-rulers` removed from the DOM and every box
re-measured: a genuine before/after of one layout rather than two builds.

| Viewport | Shell | Parts rail | Canvas | Inspector | Canvas share |
|---|---|---|---|---|---|
| 1280, rulers drawn | 1280 | 176 | 880 | 224 | **68.8%** |
| 1280, rulers removed | 1280 | 176 | 880 | 224 | **68.8%** |
| 580, rulers drawn | 580 | 127.59 | 290.02 | 162.39 | **50.0%** |
| 580, rulers removed | 580 | 127.59 | 290.02 | 162.39 | **50.0%** |
| 580 light, drawn / removed | 580 | 127.59 / 127.59 | 290.01 / 290.01 | 162.4 / 162.4 | **50.0% / 50.0%** |

**The ruler costs the canvas no layout at all**, at either width, in either scheme — identical to
the hundredth of a pixel. That is a consequence of the mechanism the spec had already chosen: two
`position: absolute` strips inside `.rp-plan-canvas` generate no box in the shell's flex row. The
figures reproduce AD18-R10's own re-measurement (68.8% at 1280, 50.0% at 580) exactly, which is the
other half of the evidence that the probe measured the right boxes.

**What the ruler DOES cost is occlusion, and it is not zero.** Each strip is 18 px. At 580 the
canvas box is 290.02 × 812 and the drawing keeps 272.02 × 794 — 93.8% of the width and 97.8% of the
height. At 1280 the canvas is 880 wide and keeps 862.

### Which reading of AD18-R10 binds — asked by this card, SETTLED by the user

The ruling's sentence, *"must not take the canvas below 50% at 580"*, has two readings, and this
card's independent review found them:

- **The canvas COLUMN's share of the shell** — the quantity AD18 item 6 and AD18-R10 themselves
  measured (68.8% / 47.4% / 31.0%, then 68.8% / 50.0% / 50.0%): **50.0% at 580, moved not at all by
  the ruler**, before and after agreeing to the hundredth of a pixel.
- **The DRAWING area left after the rulers' own occlusion** — 272.02 × 794 of a 290.02 × 812 canvas,
  and 272.02 of 580 is **46.9%**, under the floor.

**The user has taken it: the COLUMN's share binds**, recorded in
`contracts/DECISIONS.md` and `execution/state.json` as *"AMENDED the same day: the binding is the
canvas COLUMN's share, and the drawing figure is disclosed beside it"*. The decisive argument is not
the one this report first gave. It is that **the other reading is unsatisfiable rather than
strict**: the column sits at exactly 50.0%, so ANY ruler of any size at 580 falls below that floor,
and AD18-R10 read that way would forbid precisely what AD18-R9 authorises. A binding that cannot be
met by the thing it governs is a drafting fault, not a high standard.

**So the 46.9% is DISCLOSED rather than dissolved, and it is a real cost to a real user** at a
sidebar leaf — 18 px of a 290 px canvas is 6.2% of the drawing spent on the only scale reference the
designer has, since the grid still defaults off. It is written here, in the amendment and in
`DesignerRulers.vue` so that nobody re-derives it later as a discovery.

**The credit belongs to the binding.** AD18-R10 did the work it was taken for: it forced a rendered
measurement no gate in this repository can perform, and that measurement is what turned an
assumption into two numbers. The before/after table above is the artefact that settled the ruling.

The losing side is in the amendment and is not re-argued here, but it is worth knowing where this
report is read: **hiding the rulers below `designer-narrow.css`'s 35 rem breakpoint** would keep the
full 290 px of drawing at the width where there is least of it, for a container-query rule and a
test. If the narrow case is ever reported as too tight, that is the cheap change to make.

**One defect was found by looking and by nothing else.** At 1280 the left strip drew `250` as
`25(`: three horizontal digits do not fit an 18 px strip at `--font-ui-smaller`, and a four-digit
step is ordinary at a zoomed-out camera. The repair is `writing-mode: vertical-rl` on that strip's
labels — the other repair, a wider strip, is canvas taken away on every design at exactly the
widths this ruling is about. jsdom lays nothing out, so a clipped glyph measures the same as a
fitting one; the suite now pins what the RULE declares and the rendered proof is this section.

**A second one of the same family turned up in the fix round. It is ACCEPTED, by this card and by
no ruling** — AD18-R10's amendment settles the canvas's SHARE and says in as many words that it
leaves this open, which is a different question and deliberately kept apart. The top strip is later in the DOM with an opaque background, so a left-strip label whose
mark lands in the top 18 px is painted over. Looked at rather than reasoned about: at 1280 on the
toilet preset, a 40 px pan put the ruler's `0` into that band and the strip then read 250, 500,
750 … with no zero. One mark per axis per camera, and every cheap repair moves the casualty to the
other strip or puts the 18 px in TypeScript as well as in the stylesheet; what would remove it is a
third layer holding both strips' marks above both backgrounds — markup, a possible clash of two
labels in one 18 px square, and a rework of every selector, for one number at one camera.
`styles/designer-rulers.css` carries that argument, and the jsdom case asserting a left label at
`8px` now says in its own comment that it asserts presence and not visibility.

## Branches introduced, and what drives each

| # | Branch | Driven by |
|---|---|---|
| 1 | `rulerLabels`' loop condition `index * spacing <= to`, entered | four `rulerMarks.test.ts` cases |
| 2 | … not entered | `answers nothing for a span no labelled mark falls in` |
| 3 | `model`: `view === null` | `draws no ruler at all over an unscaled design, and none before a design is read` (second half) |
| 4 | `model`: `\|\| view.dimensionsUnscaled` | the same case's first half |
| 5 | `model`: both false | every other jsdom case |
| 6 | `model`: `view.shape === null` | `draws from the world origin for a design nobody has traced yet` |
| 7 | `model`: `view.shape !== null` | the four cases over `assetDesign()`'s footprint |
| 7a | `model`: `preview.value ?? view.shape` taking the PREVIEW | `moves the extent band with a gesture's preview while the ruler itself stands still`, after `setPreview` |
| 7b | … taking the committed shape | every case that sets no preview |
| 8 | `model`: `box === null` (no extent) | `marks the selected part's extent …` first assertion, and the shapeless case |
| 9 | `model`: `box !== null` | the same case after `select({ kind: 'footprint' })` |
| 10 | template `v-if="model !== null"`, both arms | as 3/4/5 |
| 11 | left strip's `v-if="model.extent !== null"`, both arms | as 8/9 |
| 12 | top strip's `v-if="model.extent !== null"`, both arms | as 8/9 |

The fix round added row 7a/7b and nothing else: `box` now reads `preview.value ?? view.shape`, so
the `??` is one more branch point with both arms driven.

No guard was added that no case can reach. The `null` and `dimensionsUnscaled` arms are reachable
only because the component reads the store itself and is mounted alone in the component-level
cases — through the designer's root, `DesignerCanvas` mounts only over a design already read, so
the same two arms written inside `DesignerCanvas` would have been unreachable and would have cost
two branches they could never pay back.

## The fix round, item by item

An independent review returned five findings plus one the user settled. What each cost:

- **F1 (blocking) — the extent band read the COMMITTED shape, and the comment argued against the
  option it took.** Verified at the code first: `DesignerCanvas`'s `shape` is
  `preview ?? design.shape`, `selectionMarks` and `framedBounds(false)` both compute from it, and
  `DesignerSelectTool.preview` calls `setPreview` on every drag move — so every other reading of
  "where the selection is" follows the preview and the committed band was the lag, not the cure.
  **Arm taken: read `preview.value ?? view.shape` for the extent ALONE.** `designerGrid` still takes
  `view.shape`, so §2.4's committed FRAME is untouched; the ruler stands still and the mark on it
  travels. The case asserts both halves in one breath, including that the tiling does not move.
- **F3 — the grep sentence answered about itself.** `grep -rn "designerGrid(" src/` printed SIX
  lines, not the five the docblock claimed, because that sentence introduced the literal into the
  file it was counting — CLAUDE.md's `registerView` trap. The docblock now NAMES the four consumers
  and says outright that it does not spell the call with its bracket, so a future grep answers about
  the code. The acceptance row that cited it was rewritten too.
- **F4 — a stale figure, and the correction went stale inside the same round.** The changed-files
  row said the partial was 83 lines; it was 99 by the time the review read it, the `writing-mode`
  block having landed between, and 123 by the end of this round once the F6 argument was written
  down. Writing 99 would have been the same defect one commit later, so **the row now carries no
  figure at all** — which is F5's rule turned on this report rather than on a stylesheet, and the
  honest form of a count that changes every time somebody explains something.
- **F5 — the sixth partial to write down `designer.css`'s line count.** Two siblings say explicitly
  not to: `designer-add.css` counts five predecessors falsified by it and `designer-trace.css` says
  to run `wc -l` instead. The figure is gone from the partial's header and from both places this
  report repeated it, replaced by the cap and the argument.
- **F6 — a browser-only occlusion, LOOKED AT rather than reasoned about**, which is what the finding
  asked for. At the camera the page opens at, no left label was in the corner at all; panning 40 px
  put the ruler's `0` there and it vanished. Measured as rectangle intersection, because
  `elementFromPoint` answers nothing useful about an overlay that is `pointer-events: none`.
  **Closed by acceptance**, with the alternative costed in the stylesheet: every cheap repair moves
  the casualty to the other strip or duplicates the 18 px into TypeScript, and the repair that
  removes it is a third marks layer above both backgrounds.
- **The AD18-R10 reading** was taken to the user and settled while this round was in flight; the
  section above carries both numbers and the amendment.

## Verification not performed

Named rather than left blank, per the card's own instruction and CLAUDE.md's parallel-work rule
(the full gate belongs to CI on the pull request, not to a machine other agents are working on):

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`, `build`, `eslint .`** — not run. The
  card forbids them here. Coverage was therefore planned rather than measured: the table above
  enumerates every arm and names its driver, but **no `coverage-final.json` was read**, so the
  claim is an argument and not a measurement. The integrator's run is the instrument.
- **`tests/presentation/` and `tests/harness/` beyond the designer** — not run. The designer
  directory itself was swept green twice, before and after the fix round (72 files, 985 tests), which is where an element added to every
  designer mount would break something; nothing wider than that was exercised here.
- **`tests/harness/accessibility*.test.ts`** — not run. The new markup is one `role="img"` with an
  `aria-label` and no focusable content; axe over the designer is the check that would confirm it,
  and it was not run here.
- **`npm run harness-shot`** — not run. No fixed shot was added and none was captured; the browser
  evidence above is live-page measurement and screenshots taken by hand, not pinned captures.
- **`npm run test-build` / a live Obsidian vault** — not run. Appearance inside a THEMED vault is
  unverified; the harness draws Obsidian's default palette only, and every colour here is an
  Obsidian variable precisely so a themed vault follows.
- **Mobile** — not exercised. The designer is reachable on mobile and no narrow-device case was
  driven; the strips are 18 px at every width, which on a phone leaf is a larger share of the
  drawing than the figures above.
- **Performance during a pan** — not measured. The minor ticks are a tiled gradient and only the
  labelled marks are DOM nodes (12 to 18 per axis in the states measured), which is the reason to
  expect it to be cheap; nothing here measured a frame.

## Data and integration implications

Schema/migration change: none. Nothing here reads or writes a note, a sidecar or a setting.
Relevant renderer/export/revision consumers: none — the rulers are a screen-only aid and reach no
document. `designerGrid` gained a fourth consumer and no new behaviour.
Undo/no-op/conflict/failure coverage: not applicable — the component dispatches no command. Over a
failed read the root replaces the canvas with `ViewFailure`, so the rulers are not mounted at all.
Identity/unit/quantity/calibration invariants: **the unscaled rule is the one that matters** — no
ruler is drawn over a design whose coordinates are placeholder pixels (`dimensionsUnscaled`), which
is the same rule the status row's grid step follows, so a millimetre is never put on a number that
is not a measurement.
Shared root/runtime/locales wiring still required: none outstanding. `designerRulersEn`/`De` are
spread in both `editor.ts` composition points in this branch.
Rollback/recovery considerations: deleting `<DesignerRulers />` from `DesignerCanvas.vue`'s overlay
removes the feature entirely; nothing else depends on the component, and the stylesheet partial
would then be an unimported file the build would refuse — so a rollback removes the `@import` too.

### Screen readers, stated narrowly

The pair is one `role="img"` whose `aria-label` names the step (`Rulers in 500 mm steps`), so the
labelled ticks are not read out as a list of loose integers. **The selection's extent is drawn and
not announced.** The Inspector owns this asset's measurements and the spec's increment 2 —
dimensions on canvas, which AD18-R9 records as still owed — owns the selected part's; a second
spoken answer to the same question is what that increment would then have to reconcile.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
