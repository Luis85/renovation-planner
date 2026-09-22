# Task report — W16-C (AD15 validation matrix row T32, geometry half)

Outcome: implemented, for **half** the row — see "What this does not close".
Owner / worktree / branch: card W16-C / `.worktrees/ad07` / `w16c-theme-flip`
Base commit / candidate commit: `1157ed28d` / `ea2a562b9`, plus the fix-round commit on top of it
(six integrator/reviewer findings, all of them prose or one character of capture; none changes what
the case drives or asserts)
Accepted contract revision: wave 16 base
Allowed scope and shared-file leases: one MODIFY (`tests/presentation/designer/designerTheme.test.ts`)
and one CREATE (this report). No harness fixture under `tests/helpers/` was opened for writing —
`tests/helpers/assetShapes.ts` in particular is IMPORTED and not touched, so the collision risk the
card flagged against W16-A does not arise. Nothing under `src/`, no locale table, no styles partial,
no other test file, not `AD15-validation-matrix.md`, not `state.json`.

## The gap, verified before anything was written

The card said the file has three cases and none flips the theme and re-asserts geometry. Checked at
source rather than taken on trust:

```
$ grep -n "it(\|describe(" tests/presentation/designer/designerTheme.test.ts
116:describe('the designer palette and a theme change', () => {
117:	it('re-resolves the drawn stroke when Obsidian reports a css-change', async () => {
133:	it('unsubscribes with the view', async () => {
144:describe('the designer canvas and the monitor the window is on', () => {
150:	it('resizes every layer backing store when the device pixel ratio changes', async () => {
```

Three cases, and each was read rather than inferred from its name. The css-change case changes ONE
variable (`--text-normal`) on `document.body`, fires the recorded listeners and asserts ONE value —
`footprintStroke(stage)` moves from `rgb(1, 2, 3)` to `rgb(9, 8, 7)`. It asserts no coordinate. The
other two are a subscription-lifetime case and a device-pixel-ratio case, neither of which touches
the palette's effect on the scene. `ls tests/presentation/designer/` was run first and no
neighbouring file covers it either. **The gap is real and was not already closed under another
name.**

## What was written

One case in the existing `the designer palette and a theme change` describe:
**`moves the whole palette and not one drawn coordinate`**.

It drives the real seam the card named, not a hand-set palette. The flip is a whole palette written
onto `document.body` — the element `useThemeTokens` falls back to, which is all the designer ever
reads since `DesignerCanvas` passes `ref(null)` as its root — followed by the recorded `onThemeChange`
listeners firing, which is the same `css-change` door the existing case uses. The variables are
derived from `THEME_TOKENS` rather than transcribed, deduplicated because two token names share
`--text-normal` and two share `--text-muted`, so a token added to that table joins the flip instead
of sitting outside it.

**Why the comparison can fail rather than comparing a fixture to itself.** Every config behind
`GEOMETRY_NODES` is a `computed` over `tokens.value` in `DesignerCanvas` — `footprintOutline`,
`detailOutlines`, `footprintEdge`, `clearanceOutline`, `anchorMark` and `facingArrow` each take the
palette as a parameter — so a theme change genuinely re-runs the point packing for all of them. The
capture is therefore read off the SCENE (`stage.find('.asset-…')`, then `points()` for a line and
`x/y/radius` for the anchor) on both sides of the flip, never from the `AssetShape` the theme path
cannot reach.

**That sentence is narrower than the one this report carried at `ea2a562b9`**, which said "every
drawn config on this canvas". That was false and is corrected here and in both docblocks that
repeated it: `designerLayerConfig('asset-footprint', transform)` and its four siblings are built
inline in the template and take no tokens, and `transform`, `worldPerPixel`, `grid`, `shape`,
`background` and `pixelsPerWorldUnit` are `computed`s over things that are not the palette
(`grep -n "designerLayerConfig(\|^const .* = computed" src/presentation/designer/DesignerCanvas.vue`).
The claim with a check under it is the one about `GEOMETRY_NODES`. **The over-claim travelled into
the review prompt and was repeated back rather than caught there, so it survived one full round of
review by being agreed with** — which is the argument for re-measuring a sentence at the code even
when a reviewer has already passed it.

Three properties the case holds beyond the headline assertion:

- **The capture must have found something.** `expect(Object.entries(…).filter(([, nodes]) => nodes.length === 0)).toEqual([])`
  fails if any selector reached nothing — a renamed node, an unrendered layer, a stage that never
  mounted — which would otherwise make the comparison an empty object against an empty object.
- **The flip must have TAKEN.** `expect(footprintStroke(stage)).not.toBe(light.stroke)` fails if the
  palette did not actually move, which would make "geometry unchanged" true for the wrong reason.
- **The fixture is `editableShape()`**, which carries a footprint, a clearance, two details (so the
  restroke draws at all), an anchor and a facing. The file's own `assetDesign()` shape has no
  clearance and no details and would leave three of the seven selectors empty.

`context()` and `mountDesigner()` gained one optional `shape` parameter each; the three existing
cases call them unchanged.

## Two docblock claims that were narrowed after a grep, in the same edit

Both were written wider than the code and both were corrected before committing, per the repository's
"a docblock stating a count or an only gets the grep in the SAME edit" rule:

- `GEOMETRY_NODES` was introduced as "every node the designer draws whose config carries a
  coordinate". False. `grep -oE "name: '[a-z-]+'" src/presentation/designer/DesignerCanvas.vue | sort -u`
  prints **ten** names; the list holds **seven**. The three omitted are
  `asset-selection-outline`, `asset-selection-handle` and `asset-rotate-stem` — the selection's marks,
  which draw nothing in a case that selects nothing. The docblock now states the narrower claim and
  carries that grep so the next reader re-runs it.
- The fixture note called `editableShape()` "the one shape that puts every geometry-bearing node on
  the stage". False: `tests/helpers/assetShapes.ts` also exports `toiletShape` and
  `shapeWithOpenGraphic`, either of which would fill the same list. The sentence now says so.

## Fix round — six findings, each re-measured here before it was applied

The reviewer cleared the card's whole risk (the capture reads the scene and never the `AssetShape`;
the anti-tautology guard sits in the same case immediately before the geometry comparison; the
dedupe loses no token — 14 names over 12 distinct variables). Six corrections followed, none of
which changes what the case drives or asserts. **Every one was verified against the code here rather
than taken from the message**, which is the point of the round that produced finding 2:

1. **The line count was stale.** The evidence table said 299; `wc -l` prints **340** now. The 299 was
   taken before the candidate commit's own docblock narrowing and never re-run. Corrected in the
   table, with the reason beside it.
2. **"Every layer config … is a `computed` over the resolved palette" was false, in three places** —
   the file header, the case docblock and this report. Re-measured with
   `grep -n "designerLayerConfig(\|^const .* = computed" src/presentation/designer/DesignerCanvas.vue`:
   the five `designerLayerConfig(…)` calls are inline template expressions taking no tokens, and
   `transform`, `worldPerPixel`, `grid`, `shape`, `background` and `pixelsPerWorldUnit` are
   `computed`s over things that are not the palette. All three sites now say *every config behind
   `GEOMETRY_NODES`*. **This over-claim was repeated back in the review prompt rather than caught
   there**, so it survived a full review round by being agreed with — a reviewer's pass is not a
   measurement.
3. **The geometry half is not wholly closed** — see "What this does not close". Verified at source in
   all three modules; the acceptance cell and the `GEOMETRY_NODES` docblock now both say so.
4. **`nodesNamed`'s docblock over-claimed the lint rule's scope.** "Reads any `.find(ident)` as an
   array iterator" is false; the rule keys on a **bare-identifier receiver**. Probed directly rather
   than accepted: a four-form fixture reports `stage.find(sel)` and stays silent on
   `harness.wrapper.find(sel)`, `obj.inner.find(sel)` and the template-literal form — which is why
   `rig.wrapper.find(OPACITY)` in `designerReferenceView.test.ts` lints clean today, corroborated by
   grep. The workaround and the core claim survive; only the scope sentence was wrong.
5. **`drawnGeometry` captured the live `points()` array.** Now `[...(node as Konva.Line).points()]`,
   matching `tests/presentation/editor/scene.test.ts`'s own before/after spelling. Not a defect today
   — the builders allocate a fresh array per computed run — and worth one character, since that same
   file elsewhere asserts reference IDENTITY between frames, which is exactly the property an aliased
   capture would silently depend on.
6. **The `GEOMETRY_NODES` docblock mischaracterised the grid.** `CanvasGrid.vue` renders a
   `<div class="rp-canvas-grid">` and names no Konva node at all, so it is outside the grep's
   universe for a different reason than the background and gesture layers; and
   `editor/elements/RotateArrowIcon.vue`, which does name nodes and does take `tokens`, was missing
   from that list. Both corrected.

The mutation evidence below was **re-run against the fixed file**, because finding 5 changed the
capture and a red quoted from a different tree is not evidence about this one. The failure is
byte-identical; only the reported line number moved.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Matrix row **T32**, GEOMETRY half — "…without geometry changes" (`ACCEPTANCE-AND-QA.md` line 87, read at source) | **closed for the committed design's seven marks; OPEN for the selection's and the gesture's** | `designerTheme.test.ts` "moves the whole palette and not one drawn coordinate": every distinct `THEME_TOKENS` variable flipped on `document.body`, the real `onThemeChange` listeners fired, seven node selectors' coordinates compared across it | `selectionMarks`, `RotateArrowIcon` and `DesignerGestureLayer` all take `tokens` and all emit coordinates; none is asserted across a flip, because this case selects nothing and draws no gesture. A mount that does both is a card, not a fix |
| Matrix row **T32**, VISIBILITY/OCCLUSION half — "Theme changes preserve line visibility/occlusion" | **not closed, and not closeable here** | none attempted | jsdom has no rendering engine. See below |
| The flip is driven through the product's seam, not past it | holds | the case sets CSS variables and fires `context.onThemeChange`'s listeners; it never assigns a `ThemeTokens` object | The class half of a real flip is not driven — see "Verification not performed" |
| The geometry assertion can fail | **watched red twice** | quoted verbatim below | — |

## Watched red — mutation 1, the geometry assertion

The restroke path was made scheme-dependent in the smallest way that should move geometry:
`footprintEdge` in `src/presentation/designer/layers/detailsLayer.ts` rebuilt its points from
`tokens.zoneStroke.length`, which differs between the two palettes (`rgb(250, 1, 0)` is 14 characters,
`rgb(5, 1, 0)` is 12). Verbatim:

```
 FAIL  |suite| tests/presentation/designer/designerTheme.test.ts > the designer palette and a theme change > moves the whole palette and not one drawn coordinate
AssertionError: expected { …(7) } to deeply equal { …(7) }

- Expected
+ Received

@@ -114,18 +114,18 @@
        0,
      ],
    ],
    ".asset-footprint-edge": [
      [
-       -486,
-       -286,
-       514,
-       -286,
-       514,
-       314,
-       -486,
-       314,
+       -488,
+       -288,
+       512,
+       -288,
+       512,
+       312,
+       -488,
+       312,
      ],
    ],
    ".asset-footprint-outline": [
      [
        -500,

 ❯ tests/presentation/designer/designerTheme.test.ts:319:32

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

The failure names the one node the mutation reaches (`.asset-footprint-edge`), leaves
`.asset-footprint-outline` — which the mutation does not touch — showing its unchanged `-500`, and
the other three cases in the file stay green. The offset is exactly the two-character difference
between the light and dark colour strings. **The mutation was reverted with
`git checkout -- src/presentation/designer/layers/detailsLayer.ts` and `git status --short` then
showed only the test file modified; `footprintEdge` was re-read to confirm it is the original
one-line body.** No `src/` change is in this commit.

## Watched red — mutation 2, the anti-tautology guard

The guard that the flip actually took was checked separately, because a case that compared geometry
across a flip that never happened would be green and worthless. The `for (const listener of
themeListeners) listener();` line was removed from the case; verbatim:

```
 FAIL  |suite| tests/presentation/designer/designerTheme.test.ts > the designer palette and a theme change > moves the whole palette and not one drawn coordinate
AssertionError: expected 'rgb(250, 1, 0)' not to be 'rgb(250, 1, 0)' // Object.is equality
 ❯ tests/presentation/designer/designerTheme.test.ts:317:38
```

Restored from a copy taken before the mutation; `git diff --stat` afterwards showed the one expected
file. **Both halves of the case are therefore load-bearing: one fails when geometry moves, the other
fails when nothing moves at all.**

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerTheme.test.ts` | candidate, worktree `ad07` | `Test Files 1 passed (1)` / `Tests 4 passed (4)` | final run after the docblock narrowing, 22.06s |
| same, with `footprintEdge` mutated | temporary | `Tests 1 failed \| 3 passed (4)` | quoted verbatim above, mutation reverted |
| same, with the listener fire removed | temporary | `1 failed` on the stroke guard | quoted verbatim above, restored |
| `npx eslint tests/presentation/designer/designerTheme.test.ts` | candidate | exit 0, no output | run explicitly, because the edit-loop hook runs ESLint only for `.vue` |
| `npx oxlint tests/presentation/designer/designerTheme.test.ts` | candidate | exit 0, no output — read as the EXIT CODE, since oxlint prints nothing when clean | — |
| `wc -l` on the edited file | fix round | **340 lines**, under the `tests/**` cap | re-measured; this cell said 299 at `ea2a562b9`, a figure taken before that commit's own docblock narrowing and never re-run |
| `npx vue-tsc -noEmit` | fix round | exit 0 | whole-tree type check, which is what covers `tests/**`; it was listed as unrun at `ea2a562b9` and is not |
| `git ls-files --eol` on both files touched | candidate | `i/lf w/lf` for each; no line-ending change introduced | — |

One lint finding was met and worked around rather than suppressed: oxlint's
`unicorn/no-array-callback-reference` takes the identifier in `stage.find(name)` for a function
reference handed to an array iterator. **The rule keys on a BARE-IDENTIFIER receiver**, which is
narrower than the "any `.find(ident)`" this report and the docblock first claimed, and the narrower
shape is measured: a four-form probe reports `stage.find(sel)` and stays silent on
`harness.wrapper.find(sel)`, `obj.inner.find(sel)` and the template-literal form. That is why
`rig.wrapper.find(OPACITY)` in `designerReferenceView.test.ts` passes an identifier to `.find` and
lints clean today. The wrapper `nodesNamed` uses the template literal, with the measurement in its
docblock. No inline suppression was used — this repository forbids them and
`tests/build/suppressions.test.ts` would catch one — and the rule stays ON in this file, so a future
reader who simplifies the template literal away fails lint immediately rather than silently.

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage` and `npm run analyze` were NOT
  run.** The card reserves them for the integrator: two full gates at once on this shared machine
  thrash and produce a wrong red, which is the failure mode CLAUDE.md names for a destroyed
  `coverage/.tmp/coverage-N.json` and for `tests/build/` ESLint boots exceeding their `beforeAll`
  budget. The coverage floors, `eslint .` over the whole tree and fallow are therefore unrun on this
  branch. (`vue-tsc -noEmit` IS run — see the table above; it is none of the four reserved commands,
  touches no `coverage/` and boots no ESLint, so it carries none of the contention this rule exists
  for.) The change adds one case and no `src/` line, so it should
  not move a floor — that is a prediction, not a measurement, and CI is the instrument.
- **No suite outside the one file was run.** `context()` and `mountDesigner()` changed signature, but
  both are module-local to `designerTheme.test.ts`; nothing else imports them. Not separately
  verified against the whole `tests/presentation/designer/` directory.
- **Nothing was run in a vault** (`npm run test-build`), and no capture was taken
  (`npm run harness-shot`). Both are the only instruments that could address the half of the row
  below, and neither is available to this card.
- **The `.theme-light` / `.theme-dark` class half of a real flip is not driven.** Obsidian toggles
  that class on `body` and its stylesheet redeclares the variables under those selectors; jsdom
  cascades no stylesheet, so the class would be inert here and setting it would be theatre that a
  reviewer could mistake for the mechanism. What is driven is the RESOLVED half, which is the half
  `resolveThemeTokens` reads and therefore the whole of what reaches a Konva config. The case's
  docblock says exactly this rather than claiming a fuller flip.
- **No browser/host/migration/performance check applies** — this card adds no schema, no runtime
  wiring and no rendered surface.

## What this does not close

**T32's visibility/occlusion half is untouched, and jsdom is why.** The row asks for "Theme changes
preserve line visibility/occlusion without geometry changes" at layer *Visual + geometry*. jsdom has
no rendering engine: Konva draws into a backing canvas nobody looks at, nothing is laid out, and no
pixel is compared. Whether a stroke is legible against its ground after a flip, and whether one line
covers another, is unobservable in this suite at any effort — the same limit `layers.test.ts`'s own
header states ("These cases hold the geometry and the vocabulary; they do not hold the picture") and
the same one CLAUDE.md records against the accessibility suite for colour contrast. **A vault, or a
`harness-shot` capture in both schemes, is the only instrument for that half.** This card makes no
claim about it, and the matrix row should not be graded `pass` on this work alone.

**The geometry half is closed for the COMMITTED DESIGN's marks and open for the selection's and the
gesture's** — this is the fix round's correction to a cell that read `closed` at `ea2a562b9`, and it
is the finding that decides the grade. Three token-consuming geometry producers are asserted across
no flip, verified at source rather than reasoned about:

- `selectionMarks` (`src/presentation/designer/layers/selectionLayer.ts`) takes `tokens: ThemeTokens`
  and emits `points: flatPoints(run.points)` for the outline run, `x`/`y` for each handle mark and a
  two-point rotate stem.
- `RotateArrowIcon.vue` (`src/presentation/editor/elements/`) takes `tokens` and emits a `VRect`
  whose `x`/`y`/`width`/`height` are real coordinates, under `rotation-handle-button`.
- `DesignerGestureLayer.vue` takes `tokens` and emits `points: previewFlat` under `detail-preview`.

None is reachable from this case, which selects nothing and draws no gesture. **Covering them needs a
mount that does both, which is a card and not a fix** — the card brief said so explicitly and this
report agrees rather than stretching the existing case to reach them.

The matrix itself was deliberately NOT edited — it is outside this card's lease. On the evidence
here row T32 stays **partial**, with three components rather than two: geometry closed for the
committed design's seven marks, geometry outstanding for the selection's and the gesture's, and
visual/occlusion outstanding.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — no `src/` file is modified.
Undo/no-op/conflict/failure coverage: not applicable; this card adds a test only.
Identity/unit/quantity/calibration invariants: untouched. The case asserts world-millimetre
coordinates are unchanged across a palette change, which is adjacent to the unit invariants but does
not exercise calibration.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: the commit is one test file and one report; reverting it restores
the base exactly.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
