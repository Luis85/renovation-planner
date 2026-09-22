# Task report — W19-A (dimensions on canvas)

**Round 2 amends this report throughout.** Nine reviewer findings, two of which blocked. What
changed is in "Round 2" at the foot; the sections above are corrected in place where round 1 was
wrong, with the correction marked. Nothing that was true in round 1 was removed.

Outcome: implemented
Owner / worktree / branch: W19-A · `.worktrees/ad11` · `w19a-dimensions-on-canvas`
Base commit / candidate commit: `3e2bc2032` / recorded by the integrator at hand-off
Accepted contract revision: `r1`
Allowed scope and shared-file leases: the Wave 19 row for this card, including the three
integrator-owned files sub-let in writing (`runtime.ts`, `AssetDesignerRoot.vue`, the one
`@import` line in `styles/index.css`). **`AssetDesignerRoot.vue` was sub-let and is NOT touched** —
see "Changed files".

## What this delivers

The approved spec's increment 2 in full, as AD18-R11 authorises it: overall width × depth along
the footprint, the selected part's size and its four offsets to the footprint edges, each value a
button that opens an inline field, every number read from the drag PREVIEW, an `All dimensions`
view toggle, and no numbers on an unscaled part. Mechanism unchanged from the spec's decision
table: a DOM overlay in `EditorSurface`'s overlay slot, positioned by `worldToScreen`, mounted
beside `DesignerRulers`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/dimensions/dimensionFigures.ts` (new) | The pure half: which parts are measured, what each figure reads, where it is drawn, and the edit typing one back writes. The `rulers/rulerMarks.ts` shape. | yes |
| `src/presentation/designer/dimensions/DesignerDimensions.vue` (new) | The overlay: `worldToScreen`, the button/field swap, focus hand-off, the dispatch through `editShape`. | yes |
| `src/presentation/designer/DesignerCanvas.vue` | Mounts it in the overlay slot, second of three, with why that order is not merely about reading. | yes |
| `src/presentation/designer/DesignerViewMenu.vue` | The fourth row, `All dimensions`, and the header paragraph for it. | yes |
| `src/presentation/designer/runtime.ts` | The leaf-local `allDimensions` ref and its AD18-R12 account. | yes (sub-let) |
| `src/presentation/designer/rulers/DesignerRulers.vue` | **Only** the pointer-events sentence AD18-R11 mandates. | yes |
| `styles/designer-rulers.css` | **Only** the same sentence. | yes |
| `styles/designer-dimensions.css` (new) | The overlay's rules, including the `none`/`auto` pointer pair. 108 lines against the 400 cap. | yes |
| `styles/index.css` | The one `@import` line. | yes (sub-let) |
| `src/presentation/i18n/locales/{en,de}/assetDimensionsOnCanvas.ts` (new) | Eight nouns, two frames, one refusal, the toggle's label. German typed `Record<keyof typeof …En, string>`. | yes |
| `src/presentation/i18n/locales/{en,de}/editor.ts` | The import + spread lines, one each. | yes |
| `tests/presentation/designer/dimensions/{dimensionFigures,designerDimensions}.test.ts` (new) | Own tests. | yes |

**Two leased files are deliberately UNCHANGED, and both are findings rather than omissions.**

- **`src/presentation/designer/grid/designerGrid.ts` — no fifth call, so no docblock edit.** The
  lease anticipated one and the sentence is still correct. `grep -rn "designerGrid(" src/` prints
  five lines: the declaration plus **four** calls (`designerCandidateSupply`,
  `AssetDesignerRoot.gridStep`, `DesignerCanvas.grid`, `DesignerRulers.model`) — exactly the four
  the docblock names. This overlay never asks: a ruler needs the grid's ORIGIN so a reading agrees
  with the tick it sits on, while a dimension is a distance between two parts and has no origin to
  agree about. Its zero is the footprint's own edge, read through `partMeasure`.
- **`src/presentation/designer/AssetDesignerRoot.vue` — sub-let and not needed.** `DesignerCanvas`
  forwards its default slot into the overlay slot, so mounting the overlay inside `DesignerCanvas`
  reaches the right place with no wiring in the root. The narrower diff is the correct one.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| §0: overall width × depth along the footprint | met | `dimensionFigures.test.ts` "measures the footprint with nothing selected, and nothing else" — 1000/600 at (0, −300) and (−500, 0) | — |
| §0: the selected part's size | met | same file, "measures a selected part's size and its four offsets…" | — |
| §0: its offsets to the footprint edges | met | same case; gaps 100/500/200/200 for `detail-1`, each drawn at the middle of its own gap | — |
| §0: **not** per-edge lengths (decision table) | met | the figure list is asserted by exact array in three cases; nothing per-edge exists | — |
| §0: each value a button opening an inline field | met | `designerDimensions.test.ts` "swaps the button for a focused field…" — real `<button>` → real `<form>` + focused `<input inputmode="decimal">` | — |
| §0: updated live from the drag preview | met | "follows the gesture's preview rather than the committed shape"; red watched (RED 5) | — |
| §0: an `All dimensions` view toggle | met | "widens to every part when the View menu's All dimensions is ticked", driving the real `data-rp-view="all-dimensions"` checkbox | — |
| §0: no numbers on an unscaled part | met, in **two** halves | design-wide: "draws nothing at all over an unscaled design". per-part: "measures no pending part, neither selected nor under the toggle" and the pending/absent clearance pair | see note below |
| Decision table: DOM overlay in the overlay slot, by `worldToScreen` | met | "mounts in the canvas overlay…" asserts `.rp-plan-overlay` contains it, and the label's `left`/`top` are the stage pixels | — |
| AD18-R11: the labels accept a press | met | the whole field-opening group runs through real clicks on real buttons in that slot | — |
| AD18-R11: correct the false pointer-events sentence in both files | met | `DesignerRulers.vue` header and `styles/designer-rulers.css` header both rewritten; a THIRD copy found and NOT taken — see "Outside the lease" | a test docblock still carries it |
| AD18-R12: the toggle is a leaf-local `ref`, not persisted | met | `runtime.ts` `allDimensions = ref(false)`; nothing in `EditorViewPreferences` or `useViewPreferences.ts` was touched — `git diff --name-only` shows neither | — |
| AD18-R11 binding: every number reads the preview | met | RED 5 | — |
| AD18-R11 binding: only the grid step/origin read the committed shape | met vacuously | this overlay reads no grid at all; `DesignerCanvas.grid` and `DesignerRulers` are unchanged | — |
| C12: every enabled control reachable and functional; tests exercise real command wiring | met | the mounted cases dispatch through the real `editShape`/`SetAssetShape` on the real rig and assert what the vault read back | — |
| C12: a control that cannot do what is asked says why | met | the three-input refusal case and the mapped-domain-refusal case; the field stays open either way | — |
| C08: writes join the leaf's one chain | met by construction | every edit goes through `runtime.editShape`, whose header records that every write door joins the chain | — |

**Note on the unscaled criterion.** §0 says *"no numbers on an unscaled **part**"*, singular. The
rulers read that at the DESIGN (`dimensionsUnscaled`), which is right for a ruler. Dimensions are
per part, so this card reads it at both levels: `dimensionsUnscaled` withholds every figure
including the overall pair (the component), and a `pending` detail or clearance withholds its own
six (the pure module) — the same rule `DesignerSelectionInspector`'s `pendingPart` applies to the
same part's length fields. Had only the design-wide gate been built, `editableShape()`'s pending
`detail-2` would have drawn six millimetre readings over placeholder pixels.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/dimensions/dimensionFigures.test.ts` | candidate, Windows, node | `Test Files 1 passed (1) / Tests 19 passed (19)` | own file |
| `npx vitest run tests/presentation/designer/dimensions/designerDimensions.test.ts` | candidate, jsdom | `Test Files 1 passed (1) / Tests 19 passed (19)` | own file |
| `npx vitest run tests/presentation/designer/` | candidate | `Test Files 76 passed (76) / Tests 1038 passed (1038)` | includes `regionsReachable`, `assetDesignerRoot`, `designerViewMenu`, `designerRulers`, `designerStyles` |
| `npx vitest run tests/presentation/i18n tests/build/styles.test.ts tests/build/localeModuleSentenceCase.test.ts tests/harness` | candidate | `3 failed \| 680 passed`, all three TIMEOUTS under load; re-run alone: `Test Files 3 passed (3) / Tests 57 passed (57)` | the three were `accessibility.test.ts`, `accessibilityPropertyTree.test.ts`, `fixture.test.ts` — none about this card |
| `npx vitest run tests/build` | candidate | `1 failed \| 1305 passed`; `lint-edited.test.ts` SFC case at 60363ms — the documented ESLint-boot budget under load. Re-run alone: `Test Files 1 passed (1) / Tests 11 passed (11)` | CLAUDE.md's own hazard; no budget was raised |
| `npx vue-tsc -noEmit` | candidate | no output | whole tree, `src/` + `tests/` |
| `npx eslint <every changed .ts/.vue>` and `npx eslint src/presentation/designer/` | candidate | no output, exit 0 | — |
| `npx oxlint src/presentation/designer/dimensions/ …` | candidate | no output, exit 0 | oxlint prints nothing when clean; exit code read |
| `node scripts/styles-assemble.mjs` | candidate | exit 0 | the new partial resolves and carries no hard-coded colour |
| `wc -l styles/designer-dimensions.css` | candidate | 108 | under the 400 cap |
| `grep -rn "designerGrid(" src/` | candidate | 5 lines: 1 declaration, 4 calls | the FOUR-consumer sentence is still exact |

### Reds watched, verbatim

Each fix reverted, the suite run, the red read, the fix restored.

1. **`gapOf` made unsigned** (`Math.abs`):
   `× reads a gap as negative where the part reaches outside the footprint`
   `AssertionError: expected 200 to be -200 // Object.is equality` — `Tests 1 failed | 18 passed (19)`
2. **The per-part pending gate removed** (`drawable = shape.details`; clearance not gated):
   `× draws every drawable part under the toggle, each exactly as a selection draws it` —
   `AssertionError: expected [ 'detail-detail-1-width', …(19) ] to deeply equal [ 'detail-detail-1-width', …(13) ]`
   `× measures no pending part, neither selected nor under the toggle` —
   `AssertionError: expected [ 'detail-detail-2-width', …(7) ] to deeply equal [ 'overall-width', 'overall-depth' ]`
   `× measures no pending clearance under the toggle` —
   `AssertionError: expected true to be false // Object.is equality` — `Tests 3 failed | 16 passed (19)`
3. **The offset edit closed over the RENDER's boxes** instead of re-measuring:
   `× measures the offset off the shape the edit is handed, not the one that was drawn`
   `AssertionError: expected -50 to be -150 // Object.is equality` — `Tests 1 failed | 18 passed (19)`
4. **Every offset written as `dx`**:
   `× moves a part along y for the top offset` / `× moves a part along y for the bottom offset`
   `AssertionError: expected 200 to be 300 // Object.is equality` — `Tests 2 failed | 17 passed (19)`
5. **The overlay reading the COMMITTED shape** (`drawn = view.shape`):
   `× follows the gesture's preview rather than the committed shape`
   `AssertionError: expected [ [ 'overall-width', '1000' ], …(1) ] to deep equally contain [ 'overall-width', '2400' ]`
   `Tests 1 failed | 18 passed (19)`
6. **`pointer-events: auto` removed from the controls** (container's `none` left in place):
   `× takes no pointer on the container and gives it back to the controls`
   `AssertionError: expected [] to deeply equal [ { name: 'pointer-events', …(1) } ]` — `Tests 1 failed | 18 skipped (19)`
7. **The `All dimensions` row removed from the View menu**:
   `× widens to every part when the View menu's All dimensions is ticked`
   `Error: Unable to get .rp-designer-tools [data-rp-view="all-dimensions"] within: <div class="renovation-asset-designer">`
8. **The overlay never mounted in `DesignerCanvas`**:
   `× mounts in the canvas overlay and measures the footprint with nothing selected`
   `Error: Unable to get .rp-designer-dimensions within: <div class="renovation-asset-designer">`

### One defect the reds found in this card's own code

The input's `ref` sits inside a `v-for`, where **Vue collects template refs into an ARRAY**. Typed
as a single element it was a live array at runtime — `TypeError: input.focus is not a function`,
ten unhandled rejections — while every assertion about the field itself stayed green, because an
unfocused field renders perfectly well. The type now says `HTMLInputElement[]` and the component's
comment records the measurement.

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage` and `npm run analyze` were NOT
  run.** The card forbids them to workers — they are the integrator's, and two at once thrash the
  shared machine. So: **no coverage figure was measured for this card**, no `eslint .` over the
  whole tree, no `fallow` (dead exports, duplication, dependency hygiene), and no `vite build`.
  The branch-by-branch account below is what stands in, and it is an argument rather than a
  measurement.
- **No browser, at any width.** The in-app browser is the integrator's instrument. **Every
  appearance claim in this card is UNRENDERED.** jsdom computes no layout, so nothing here has
  seen: where a label actually lands, whether a label occludes the drawing or the rulers' strips,
  whether two labels collide on a small part (a 200 mm detail at a zoomed-out camera puts six
  anchors inside a few dozen pixels — the likeliest real defect in this card), whether the open
  form is clipped by the canvas edge, whether it is legible at a 460 px leaf, or contrast, focus
  ring and hit size. `npm run harness-shot` and `npm run test-build` were not run.
- **AD18-R10's canvas-share binding was not re-measured.** It binds the ruler card; this overlay
  is absolutely positioned inside `.rp-plan-canvas` and declares no layout property that could
  displace a column, which the stylesheet case pins as a DECLARATION. Whether the column is still
  50.0% at 580 is a rendered measurement and was not taken.
- **No manual case was run in a vault**, and none was written — `docs/` is the integrator's this
  wave, which is also why `docs/tests/cases/` carries nothing for this surface yet.
- **axe reaches the buttons but not the open field.** `accessibilityDesignerSelection.test.ts`
  mounts the real designer over `toiletShape()`, so the overall pair IS in that scan and it passed.
  No scan opens a dimension field, so the form's `aria-label`, its `<label>`/input association and
  its `role="alert"` are ungraded by axe. They are asserted structurally by this card's own cases
  and by nothing else.
- **The German copy was not reviewed by a German speaker.** The wording argument is in the module's
  own docblock and rests on greps of the existing table (`Versatz` returns nothing; `Abstand` is
  already `editor.drafting.offset` and `editor.structure.offset`; the formal register matches
  `editor.drafting.offset-invalid`).
- **Two `tests/build` / `tests/harness` files timed out under load and passed alone.** Named above
  with both results. Nothing about them touches this card, and no budget was raised.

### Every branch this card introduces, and what drives each

`dimensionFigures.ts`

| Branch | Driven by |
|---|---|
| `measuredParts`: `all` true / false | "draws every drawable part under the toggle…" / every other case |
| `measuredParts`: `selection === null` | "measures the footprint with nothing selected" |
| `measuredParts`: `selection.kind === 'detail'` / `'clearance'` / neither | the detail cases / the clearance case / the footprint-anchor-facing `it.each` |
| `measuredParts`: `shape.clearance === null` and `clearancePending` | the two-arm `it.each` "measures no %s clearance under the toggle" |
| `measuredParts`: `!detail.pending` both ways | "measures no pending part…" (pending) and every detail case (not) |
| `measuredParts`: the selected id matches / does not | the detail cases / "draws nothing for a selected detail the shape has lost" |
| `gapOf`: `sign === 1` / `−1` | left and top / right and bottom, each with its own case |
| `offsetFigures`: `axis === 'x'` / `'y'` for `at`, `near` and the displacement | the x pair and the y `it.each`, which also asserts the other axis did not move |
| the offset edit: `current === null` | "refuses an offset for a part the shape no longer has" |
| `dimensionFigures`: `part.kind === 'detail'` / not, for the key | the detail cases / the clearance case |

`DesignerDimensions.vue`

| Branch | Driven by |
|---|---|
| `view === null` | not driven — see below |
| `view.dimensionsUnscaled` both ways | "draws nothing at all over an unscaled design" / every other case |
| `preview ?? view.shape` both ways | "follows the gesture's preview…" |
| `drawn === null` | "draws nothing for a design with no shape" |
| `editing` found / not found | every field case / "refuses a submission whose figure is no longer measured" |
| `open`: `input === undefined` | not driven — see below |
| `close`: the button found / not | every close case / the withdrawal case |
| `submit`: `figure === null` | the withdrawal case |
| `submit`: `text.trim() === ''` and `!Number.isFinite` | the three-input refusal `it.each` (`''`, `'   '`, `'wide'`) |
| `submit`: `!result.ok` both ways | "shows a refused write's own mapped message" / the two writing cases |
| template: form vs button; `refusal !== null` | every field case |

**ROUND 2 CORRECTION: this list was wrong in three ways and is superseded by a MEASUREMENT.**
It named three arms; the instrument showed four, and two rows of the table above cited a case that
could not reach the code they claimed (the withdrawal case never submits — it asserts the form is
gone). Round 2 removed two of the arms as structurally unreachable, drove the rest, and re-measured:
**both files now carry zero uncovered statements, functions and branches.** The evidence is under
"Round 2". The paragraph below is kept as the record of what round 1 believed.

**Round 1's three arms, NOT driven and disclosed rather than defended.**

- `view === null` in `figures`. `AssetDesignerRoot` mounts the canvas only over a design it has
  already read, so a mounted overlay never sees `null`. It is kept because `design` is a store ref
  typed nullable and the alternative is a cast on a value that genuinely IS null before hydration.
  `DesignerRulers`' own model carries the identical arm for the identical reason.
- `open`: `input === undefined` after the tick. Reachable only if a peer's write withdraws the
  figure inside the same tick the field is drawn; the rig cannot schedule that.
- `close`: `root.value === null`. The overlay's own root is always mounted when `close` runs.

All three are cheap to see in `coverage-final.json` for these two files, which is the instrument
the threshold is not. **The integrator should read that file for this card rather than the summary
line** — three branches is ~0.1pp and invisible to a 98% floor.

## Outside the lease — reported, not taken

1. **AD18-R11's false pointer-events sentence has a THIRD copy, exactly where the ruling predicted
   a sibling would carry it.** `tests/presentation/designer/rulers/designerRulers.test.ts`, in the
   docblock of "takes no pointer and no layout from the canvas": *"The overlay slot's wrapper
   carries `@pointerdown.stop` and its three siblings, so a ruler that accepted a press would eat
   the gesture rather than sit over it."* Same non-sequitur, same wording family. That file is not
   in this card's lease (it is the ruler card's test, not this card's own). `grep -rn "eat the
   gesture\|accepting a press\|accepted a press\|swallow the gesture" src/ tests/ styles/` is the
   full census: after this card's two corrections, that test docblock is the only live copy left
   outside `DECISIONS.md` itself, where AD18-R9's original statement stands and AD18-R11 already
   quotes and refutes it.
2. **`tests/presentation/designer/assetDimensions.test.ts`'s reader list for `dimensionsUnscaled`
   was already stale at the base commit, and this card makes it staler.** Its docblock lists
   `AssetDesignerRoot`, `DesignerSelectionInspector`, `DesignerUsePlan`, `DesignerInspector` and
   `AssetInspectorShape` — and omits `DesignerRulers`, which has read the flag since W17-B. It
   also says outright *"Run it rather than trusting this list"*, so it is self-disclaiming; this is
   the exact incident that file's own paragraph records, one card later. `DesignerDimensions` is
   now a seventh reader. Not fixed: that file is not in this card's lease.

Both are one-sentence edits for whoever holds those files.

## Data and integration implications

Schema/migration change: **none.** Nothing here reaches a note, a sidecar or a version. Every
write is an existing `ShapeEdit` (`resizeToExtent`, `moveOutline`) dispatched through the runtime's
existing `editShape`, so it is one `SetAssetShape` on the leaf's one write chain with the same
`expected` version a canvas gesture or an Inspector field takes. No new command, no new port.

Relevant renderer/export/revision consumers: none. Dimensions are an editing aid and not output
(C10) — they reach no layer, no thumbnail, no placement and no export. The toggle reaches nothing
the vault holds.

Undo/no-op/conflict/failure coverage (**round 2: the no-op half of this paragraph was wrong and is
corrected under "Round 2", F1**). Undo and redo are the runtime's, unchanged — a write from
this overlay pushes exactly the entry an Inspector field's does. Failure is covered in both
families: a value the field can hold and the geometry cannot (`designer.dimension.unavailable`,
no dispatch at all, so no undo entry), and a refusal the domain answers (through `trError`, field
stays open). A submission whose figure has been withdrawn dispatches nothing. ~~**No no-op suppression was added**: typing back the number a figure already shows dispatches a
real edit … Left that way deliberately … Worth a reviewer's eye.~~ **That paragraph was WRONG and
the judgement it offered was not one this card had to make.** C03 is an accepted contract and says
it verbatim; the reviewer was right and round 2 fixes both of its clauses. See "Round 2", F1.

Identity/unit/quantity/calibration invariants: every figure is world millimetres and is drawn only
where the part it measures is scaled — the two-level gate above. The button's text is
`Math.round`ed to whole millimetres, matching what `DesignerInspector` shows; the value typed in is
what the domain receives, so a curve-aware extent still goes through `solveScale`. A gap is SIGNED,
so a part overhanging the footprint reads negative and round-trips.

Shared root/runtime/locales wiring still required: **none outstanding.** `runtime.ts` carries the
ref, `DesignerCanvas` mounts the overlay, `DesignerViewMenu` binds the row, `{en,de}/editor.ts`
spread the new module, `styles/index.css` imports the partial. `AssetDesignerRoot.vue` needed no
change and `designerGrid.ts` needed no change — both argued above.

Rollback/recovery considerations: reverting this card removes an overlay and a menu row and leaves
no residue — nothing was persisted, no schema moved, and the two corrected sentences are prose. The
only cross-file coupling is the `@import` line and the two locale spreads, which fail the build
loudly rather than silently if half-reverted.

---

# Round 2 — the reviewer's nine findings

Candidate: this branch's second commit. Same narrow gates. Lease unchanged plus
`tests/presentation/designer/rulers/designerRulers.test.ts`, granted in writing for the third-copy
item.

**Eight of nine applied. One instruction inside F1 was checked and found WRONG, and the correct
fix is the opposite of what it said** — measured as a red, below.

| # | Finding | Outcome |
|---|---|---|
| F1 | The no-op is a C03 violation, both clauses | applied; **the prescribed comparison was backwards** |
| F2 | No active-tool gate | applied |
| F3 | The depth edit is executed by no test | applied |
| F4 | The undriven-branch account is wrong in three ways | applied — two guards removed, the rest driven |
| F5 | `All dimensions` draws over HIDDEN parts | applied |
| F6 | The draft is never cleared when its figure is withdrawn | applied |
| F7 | The open form is clipped, deterministically, on open | applied |
| F8 | Two new grep sentences are false | applied, both |
| F9 | `DesignerViewMenu`'s header contradicts its template | applied |
| — | The third copy of AD18-R11's refuted sentence | applied |
| note | `designer.dimension.unavailable` is narrower than its behaviour | applied |

## F1 — the no-op, and the one instruction that was wrong

**Confirmed at the code, in full.** C03: *"Typing the current value, Escape and cancelling a
dialog create no command/history entry … Do not quantize canonical values merely because the
inspector displays rounded measurements."* C05: *"A cancelled/refused/no-op gesture is none."*
Nothing downstream answers it — `createEditShape`'s only no-op door is `if (next === null) return
ok('no-write')` and my edits returned a `Result`; `SetAssetShapeCommand` holds
`const ALWAYS_CHANGED: ShapeUnchanged = () => false` under a docblock saying nothing is compared,
deliberately. So typing back the shown number wrote a vault revision. **Measured, not argued:**
removing the fix turns the mounted case red with `AssertionError: expected 2 to be 1` on
`geometryVersion.revision`.

The figure now answers `null` for a no-op, through one `unchanged(typed, current)` used by all
three families.

**The instruction I did not follow.** The brief said: *"comparing the typed number against the
ROUNDED display value is not enough, because that is exactly the case that loses the 0.6 mm."*
**That is backwards, and the red proves which way round it goes.** With `unchanged` comparing
against the CANONICAL value alone, the rounded case fails:

```
× answers no-write for the ROUNDED number the field actually showed
AssertionError: expected { ok: true, value: { …(11) } } to be null
```

A 999.6 mm footprint opens a field reading `1000`; comparing against 999.6 finds them different
and writes 1000, quantizing the six tenths away. Comparing against the ROUNDED value is exactly
what stops that. `unchanged` therefore refuses **both** spellings of "the current value" —
`typed === current || typed === Math.round(current)` — because both are things a user may have
typed meaning "leave it". The cost is the one `AssetDesignerRoot.editDimensions` already accepted
in prose for the whole-design form: 1000 cannot be typed onto a 999.6 part through this field,
because that gesture is indistinguishable from leaving it alone.

Escape and Cancel were already clean; the brief says so and the existing `it.each` covers them.

## F2 — the active-tool gate

**Confirmed.** `grep -n activeToolId` over the component returned nothing; the overall pair anchors
on the middles of the footprint's top and left edges, which is the outline a user traces against,
with `pointer-events: auto` at all times.

One correction to the brief's arithmetic, which does not change the fix: it says seven tools. The
surface registers **eleven** (`DESIGNER_TOOL_LABELS`) — the seven named plus `set-anchor`,
`set-facing`, `calibrate` and `select`. So ten of them are click or drag gestures on the drawing.

`MEASURING_TOOLS` is `[null, 'select']`, stated as the ALLOWED set so a tool added later is out
until somebody decides it is in. `null` is camera mode, which matters: it is what the designer
opens in, and gating on `'select'` alone would have hidden the headline feature on open.

## F3 — the depth edit

**Confirmed by the instrument, not by reading.** Both arrow functions on that line had zero hits.
Driven now, and the red is real: transposing `'depth'` to `'width'` gives
`AssertionError: expected [ -100, 100 ] to deeply equal [ -50, 50 ]`.

## F4 — the guards, removed rather than driven

**Confirmed, including the misattribution.** Two of the arms are structurally unreachable from the
DOM — the form renders only inside the `v-for` entry of a currently measured figure and only while
`draft` is set, so a submit event cannot arrive without either. `submit` now takes the figure and
the text as ARGUMENTS from the template, which deletes the `editing` computed, the `figure === null`
guard and the `?? ''` fallback together. That is the repository's own rule applied rather than a
branch driven into existence.

The third arm — `if (input === undefined)` in `open()` — is a real timing race and is now DRIVEN,
by mutating the store synchronously in the tick `open()` is waiting out.

## F5 — hidden parts

**Confirmed.** `DesignerCanvas` drops hidden details through `partView.hidden`, so labels would
have floated over nothing. `dimensionFigures` now takes the hidden set and filters `drawable` with
it, so the selection path and the toggle path share one answer. `locked` is deliberately not asked
beside it, per the brief, and there is now a case pinning that decision rather than its absence.

## F6 — the stale draft

**Confirmed, and reproduced.** A `watch` on `figures` clears the draft and the refusal when the
open figure leaves. Focus still falls to `<body>` in that moment and the docblock says so plainly:
there is nothing in the overlay to hand it to, and taking it to the canvas on a peer's write would
move a user who was typing elsewhere.

## F7 — the clipping

**Confirmed structurally**: `.rp-plan-canvas` is `overflow: hidden`, `FIT_PADDING_PX` is 48, and
`translate(-50%, -100%)` lifted every form entirely above its anchor. The brief was right that this
is answerable from the code.

**The repair states no SIZE**, which is the part worth reviewing. A form anchored in the top half
grows down and one in the left half grows right, so it always grows into the canvas — only which
side of the middle the anchor is on is asked. `RoomDimensionLabels` clamps with hard-coded pixel
constants instead; that is the same fix with the stylesheet's box written down twice, and this
surface can avoid it because its field is anchored on a point rather than fitted between a taskbar
and a rail. The `transform` moved out of `designer-dimensions.css` entirely so there is one
answer, and the stylesheet says why it no longer holds one.

## F8 and F9 — the sentences

Both grep sentences confirmed false and both rewritten from what the grep prints **after** the
change. (a) `grep -rln "rp-designer-dimension" styles/` prints two files, the second being the
prose mention my own AD18-R11 correction inserted — caught inside the commit that made it, which
is the exact trap `grid/designerGrid.ts` two directories away spells out. (b) `Versatz` prints one
line: that sentence.

F9 confirmed: the template order is grid, snap, all-dimensions, reference-opacity, so both
"third row"/"fourth row" sentences were false. Rewritten to address each row by NAME, with the
ordering decision stated — the unconditional row sits before the conditional one so the rows that
are always there keep a fixed order.

## The copy note

Applied. `designer.dimension.unavailable` said "whole millimetres" while the field parses with
`Number` and accepts a decimal, and it was also the message for the `figure === null` arm that F4
deleted. Now "Type a size in millimetres." / "Geben Sie ein Maß in Millimetern ein.", and the
module's docblock records that a wrong why is not a why.

## Reds watched in round 2, verbatim

1. **`unchanged` returning `false` — no no-op door at all.** Seven `it.each` rows plus the rounded
   case: `AssertionError: expected { ok: true, value: { …(11) } } to be null`, `Tests 8 failed | 23 passed (31)`.
2. **`unchanged` comparing against the canonical value ONLY** — C03's quantization clause:
   `× answers no-write for the ROUNDED number the field actually showed`
   `AssertionError: expected { ok: true, value: { …(11) } } to be null` — `Tests 1 failed | 30 passed (31)`.
3. **The depth edit transposed to `'width'`:**
   `× resizes a part along depth, about its own centre` — `AssertionError: expected [ -100, 100 ] to deeply equal [ -50, 50 ]`
   `× answers no-write when detail-detail-1-depth is typed its own value, 200` — `Tests 2 failed | 29 passed (31)`.
4. **The hidden filter removed:**
   `× measures no hidden part, neither selected nor under the toggle`
   `AssertionError: expected [ 'detail-detail-1-width', …(7) ] to deeply equal [ 'overall-width', 'overall-depth' ]`.
5. **The active-tool gate removed:** three rows —
   `× withdraws every figure while designer.toolbar.trace-footprint is the active tool` (and `draw-rect`, `set-anchor`)
   `AssertionError: expected [ [ 'overall-width', '1000' ], …(1) ] to deeply equal []` — `Tests 3 failed | 23 passed (26)`.
6. **`placement` restored to the fixed lift:**
   `× grows an open field away from the nearer canvas edge, and centres a button on its mark`
   `AssertionError: expected 'translate(-50%, -100%)' to be 'translate(0, 0)'`.
7. **The draft-clearing watch emptied:**
   `× clears a draft whose figure was withdrawn, so re-selecting opens a button and not a stale field`
   `AssertionError: expected [ DOMWrapper{ …(3) } ] to have a length of +0 but got 1`.
8. **The mounted C03 case, to prove its assertion is not vacuous** — with `unchanged` returning
   `false`: `× writes nothing when the value typed is the one already shown`
   `AssertionError: expected 2 to be 1 // Object.is equality`. A real vault revision moved.

## Branches added in round 2, and what drives each

| Branch | Driven by |
|---|---|
| `unchanged`: `typed === current` | the seven-row `it.each` |
| `unchanged`: `typed === Math.round(current)` | "answers no-write for the ROUNDED number the field actually showed" |
| `resized`: `box !== null` both ways | every size case / "refuses rather than answering no-write when the part is gone" |
| `measuredParts`: `hidden.has(id)` both ways | "measures no hidden part…" / every other case |
| `figures`: `MEASURING_TOOLS.includes(...)` both ways | the three-tool `it.each` / "draws them under Select…" |
| `placement`: `isOpen` both ways | the button transform and the two field cases |
| `placement`: the x and y quadrant ternaries, both arms each | "grows an open field away from the nearer canvas edge" and "…up and left when its mark sits in the far quadrant" |
| the `watch`: `field === null` / found / not found | ordinary renders / "clears a draft whose figure was withdrawn" |
| `open`: `input === undefined` both ways | every field case / "focuses nothing when the figure is withdrawn in the tick its field was drawn" |

Two branches were REMOVED rather than driven — `submit`'s `figure === null` and the `?? ''`
fallback — by passing both from the template. An unreachable guard costs a branch it can never pay
back.

## The corrected undriven-branch list — MEASURED

`npx vitest run tests/presentation/designer/dimensions/ --coverage` with `reportsDirectory` pointed
at a scratch path (so nothing touches the shared `coverage/`), read out of `coverage-final.json`
per file:

```
== DesignerDimensions.vue   | uncovered stmts 0 fns 0 partial branches 0
== dimensionFigures.ts      | uncovered stmts 0 fns 0 partial branches 0
```

**The list is empty.** Round 1 named three arms and reasoned about them; the instrument found four,
two of which should not have existed. This is the card's own "read `coverage-final.json` for the
changed files, the threshold cannot see one arm" instruction turned on itself.

## Round 2 gates

| Command | Result |
|---|---|
| `npx vitest run tests/presentation/designer/dimensions/dimensionFigures.test.ts` | `Test Files 1 passed (1) / Tests 31 passed (31)` |
| `npx vitest run tests/presentation/designer/dimensions/designerDimensions.test.ts` | `Test Files 1 passed (1) / Tests 28 passed (28)` |
| `npx vitest run tests/presentation/designer/ tests/presentation/i18n tests/build/styles.test.ts` | `Test Files 82 passed (82) / Tests 1260 passed (1260)` |
| `npx vitest run tests/harness` | `Test Files 34 passed (34) / Tests 399 passed (399)` — includes the three designer axe scans |
| `npx vue-tsc -noEmit` | no output |
| `npx eslint` over every changed file, `npx oxlint` over the same | no output, exit 0 |
| `node scripts/styles-assemble.mjs` | exit 0; partial now 112 lines against the 400 cap |

## Round 2: still not verified

Everything round 1 listed stays true, with one item REMOVED from it and one narrowed:

- **The clipping is no longer an unrendered claim** — F7 was answerable from the code and is fixed
  and tested at the transform. What is still unrendered is whether the form, now growing into the
  canvas, overlaps a neighbouring label on a small part.
- **No browser, at any width.** Still the integrator's instrument. Where a label lands, whether two
  collide on a 200 mm detail at a zoomed-out camera, contrast, focus ring and hit size: unseen.
- **`npm run check`, `check:fast`, `test:coverage` and `analyze` still NOT run** — forbidden to
  workers. The coverage figure above is a NARROW measurement over two files with thresholds off,
  not the gate; no `eslint .`, no `fallow`, no `vite build`.
- **No manual case in a vault**, and none written — `docs/` remains the integrator's.
- **axe still does not open a dimension field.** The buttons are scanned and pass; the form's
  `aria-label`, its label/input association and its `role="alert"` are asserted structurally here
  and by nothing else.
- **The German copy is still unreviewed by a German speaker.**
- **F2's defect itself was never observed in a browser.** The gate is reasoned from the mechanism —
  bubble-phase `.stop`, `pointer-events: auto`, the anchors' positions — and tested at the tool id.
  That a press on a label under `trace-footprint` really did eat the vertex is not something any
  instrument here can show.

## Outside the lease after round 2

`tests/presentation/designer/assetDimensions.test.ts`'s stale `dimensionsUnscaled` reader list is
**unchanged and still owed** — it omits `DesignerRulers` and now also `DesignerDimensions`. Not in
the lease. The third-copy item WAS granted and is done: after this round,
`grep -rn "eat the gesture\|accepting a press\|accepted a press\|swallow the gesture" src/ tests/ styles/`
prints four lines, every one an attributed quote inside the refutation that corrects it, and no
live copy anywhere.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status:
