# Task report — W16-C (AD15 validation matrix row T32, geometry half)

Outcome: implemented, for **half** the row — see "What this does not close".
Owner / worktree / branch: card W16-C / `.worktrees/ad07` / `w16c-theme-flip`
Base commit / candidate commit: `1157ed28d` / see the commit this report is in
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

**Why the comparison can fail rather than comparing a fixture to itself.** Every drawn config on this
canvas is a `computed` over `tokens.value` in `DesignerCanvas` — `footprintOutline`, `detailOutlines`,
`footprintEdge`, `clearanceOutline`, `anchorMark` and `facingArrow` each take the palette as a
parameter — so a theme change genuinely re-runs the point packing for all of them. The capture is
therefore read off the SCENE (`stage.find('.asset-…')`, then `points()` for a line and `x/y/radius`
for the anchor) on both sides of the flip, never from the `AssetShape` the theme path cannot reach.

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

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Matrix row **T32**, GEOMETRY half — "…without geometry changes" (`ACCEPTANCE-AND-QA.md` line 87, read at source) | **closed** | `designerTheme.test.ts` "moves the whole palette and not one drawn coordinate": every distinct `THEME_TOKENS` variable flipped on `document.body`, the real `onThemeChange` listeners fired, seven node selectors' coordinates compared across it | — |
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

 ❯ tests/presentation/designer/designerTheme.test.ts:262:32

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
 ❯ tests/presentation/designer/designerTheme.test.ts:260:38
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
| `wc -l` on the edited file | candidate | 299 lines, under the `tests/**` cap | — |
| `git ls-files --eol` on both files touched | candidate | `i/lf w/lf` for each; no line-ending change introduced | — |

One lint finding was met and worked around rather than suppressed: oxlint's
`unicorn/no-array-callback-reference` reads `stage.find(name)` as an array iterator handed a function
reference. Three call forms were probed against oxlint directly; the identifier form is the only one
that reports, and the template-literal form is what the wrapper `nodesNamed` uses, with that
measurement written into its docblock. No inline suppression was used — this repository forbids them
and `tests/build/suppressions.test.ts` would catch one.

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage` and `npm run analyze` were NOT
  run.** The card reserves them for the integrator: two full gates at once on this shared machine
  thrash and produce a wrong red, which is the failure mode CLAUDE.md names for a destroyed
  `coverage/.tmp/coverage-N.json` and for `tests/build/` ESLint boots exceeding their `beforeAll`
  budget. The coverage floors, `eslint .` over the whole tree, `vue-tsc` over `tests/**` and fallow
  are therefore all unrun on this branch. The change adds one case and no `src/` line, so it should
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

The matrix itself was deliberately NOT edited — it is outside this card's lease. The integrator has
what is needed to regrade row T32 from *partial* to *geometry closed, visual outstanding*.

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
