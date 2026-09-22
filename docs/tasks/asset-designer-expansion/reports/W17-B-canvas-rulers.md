# Task report — W17-B (canvas rulers)

Outcome: implemented
Owner / worktree / branch: card W17-B / `.worktrees/ad07` / `w17b-canvas-rulers`
Base commit / candidate commit: `480dbbc85` / see the branch's single commit
Accepted contract revision: DECISIONS.md **AD18-R9** (authorisation and scope) and **AD18-R10**
(the canvas-share binding); the approved spec is
`docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md` §0, increment 3.
Allowed scope and shared-file leases: as the card states. Nothing outside the lease was edited —
`{en,de}/assetSymbols.ts` and `tests/presentation/designer/designerTheme.test.ts` are untouched,
and `styles/designer.css` (399 lines against the 400 cap) was not opened.

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
| `styles/designer-rulers.css` | New partial (83 lines). `designer.css` is at 399 of 400. | yes |
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
| On this document's step function | met | the component calls `designerGrid`, and `designerGrid.ts`'s own count sentence now reads four with the grep beside it | — |
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
height. At 1280 the canvas is 880 wide and keeps 862. AD18-R10 binds the SHARE and the share is
untouched; this paragraph is here so the occlusion is on the record rather than implied by silence,
because it is the figure a reader would otherwise assume this table covers.

**One defect was found by looking and by nothing else.** At 1280 the left strip drew `250` as
`25(`: three horizontal digits do not fit an 18 px strip at `--font-ui-smaller`, and a four-digit
step is ordinary at a zoomed-out camera. The repair is `writing-mode: vertical-rl` on that strip's
labels — the other repair, a wider strip, is canvas taken away on every design at exactly the
widths this ruling is about. jsdom lays nothing out, so a clipped glyph measures the same as a
fitting one; the suite now pins what the RULE declares and the rendered proof is this section.

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
| 8 | `model`: `box === null` (no extent) | `marks the selected part's extent …` first assertion, and the shapeless case |
| 9 | `model`: `box !== null` | the same case after `select({ kind: 'footprint' })` |
| 10 | template `v-if="model !== null"`, both arms | as 3/4/5 |
| 11 | left strip's `v-if="model.extent !== null"`, both arms | as 8/9 |
| 12 | top strip's `v-if="model.extent !== null"`, both arms | as 8/9 |

No guard was added that no case can reach. The `null` and `dimensionsUnscaled` arms are reachable
only because the component reads the store itself and is mounted alone in the component-level
cases — through the designer's root, `DesignerCanvas` mounts only over a design already read, so
the same two arms written inside `DesignerCanvas` would have been unreachable and would have cost
two branches they could never pay back.

## Verification not performed

Named rather than left blank, per the card's own instruction and CLAUDE.md's parallel-work rule
(the full gate belongs to CI on the pull request, not to a machine other agents are working on):

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`, `build`, `eslint .`** — not run. The
  card forbids them here. Coverage was therefore planned rather than measured: the table above
  enumerates every arm and names its driver, but **no `coverage-final.json` was read**, so the
  claim is an argument and not a measurement. The integrator's run is the instrument.
- **`tests/presentation/` and `tests/harness/` beyond the designer** — not run. The designer
  directory itself was swept green (72 files, 984 tests), which is where an element added to every
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
