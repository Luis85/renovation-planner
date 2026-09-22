# Task report — W17-C (AD15 validation matrix row T32, the selection's and the gesture's geometry)

Outcome: implemented, for the geometry half of the row and for the three producers W16-C named as
open — see "What this does not close", which is shorter than W16-C's and is still not empty.
Owner / worktree / branch: card W17-C / `.worktrees/ad10` / `w17c-selection-gesture-flip`
Base commit / candidate commit: `480dbbc85` / this commit
Accepted contract revision: wave 17 base
Allowed scope and shared-file leases: two MODIFY (`tests/presentation/designer/designerTheme.test.ts`,
`tests/helpers/designerRig.ts`) and one CREATE (this report). Nothing under `src/` — the two `src/`
edits below were MUTATIONS, made to watch a red and reverted with `git checkout --` before the
commit; `git status --short` shows only the three leased paths. No locale table, no styles partial,
no other test file, not `AD15-validation-matrix.md`, not `state.json`.

## The gap, verified at the tree before anything was written

W16-C's `GEOMETRY_NODES` docblock names three token-consuming geometry producers whose coordinates
no case asserts across a theme flip, and its case reaches none of them because it selects nothing
and draws no gesture. Each was read at source rather than taken from the brief, and the brief was
wrong about one of them:

- `selectionMarks` is an exported FUNCTION in `src/presentation/designer/layers/selectionLayer.ts`,
  not a file. It takes `tokens: ThemeTokens` and emits `points: flatPoints(run.points)` for the
  outline, an `x`/`y` `mark()` per handle and a two-point rotate stem.
- `RotateArrowIcon.vue` lives at `src/presentation/editor/elements/`, NOT under `designer/`. It
  emits `rotation-handle-button` at `x: at.x - backing`, `y: at.y - backing`, and a
  `rotation-handle-icon` group at `at.x - radius`/`at.y - radius`, inside an outer `rotation-handle`
  group that positions nothing.
- `DesignerGestureLayer.vue` emits `name: 'detail-preview'`, `points: previewFlat`,
  `stroke: props.tokens.accent`.

Why no existing case reached them: `DesignerCanvas` drops `handles` and `rotate` under any tool but
Select (`activeToolId.value === 'select' || !isOutlineSelection(...)`), and the preview exists only
between a press and its release, since the layer draws it from `renderState.previewPolygon`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/designer/designerTheme.test.ts` | Two cases in a new describe, two node lists, a generalised capture, and the three docblocks the change makes false rewritten | yes |
| `tests/helpers/designerRig.ts` | `fireThemeChange()`: the rig's `onThemeChange` was `() => () => undefined`, so no case built on it could flip a theme at all | yes |
| `docs/tasks/asset-designer-expansion/reports/W17-C-selection-gesture-flip.md` | this report | yes |

## What was written

One describe — **`the designer selection, the gesture in flight, and a theme change`** — with two
cases, both on `designerRig` rather than this file's own `mountDesigner`, whose context binds
`unavailableAssetDesignerCommands()` and whose tools therefore refuse before drawing anything.

- **`moves the selection's palette and not one of its marks`.** `selecting()` reaches Select by
  pressing its toolbar button, `click(rig, { x: 450, y: -250 })` lands inside `editableShape()`'s
  footprint (x -500..500, y -300..300), right of `detail-1` and clear of `detail-2`'s circle at
  (250, 0) r 200. The selection kind is asserted, so a mis-pick is loud rather than showing up as an
  empty capture. Five selectors: `.asset-selection-outline`, `.asset-selection-handle`,
  `.asset-rotate-stem`, `.rotation-handle-button`, `.rotation-handle-icon`.
- **`moves the gesture's palette and not one of its preview coordinates`.** The draw-rect tool, then
  `held(rig, 'pointerdown', …, 1)` and `held(rig, 'pointermove', …, 1)` — the SHARED helper from
  `designerRig.ts`, not a fourth local clone. `drag()` cannot serve here: it releases in the same
  tick, so no render lands between its move and its release and there would be nothing on the stage
  to flip against. The release is still sent, at the end of the case.

The flip is the same seam W16-C drives — `applyPalette` writes every distinct `THEME_TOKENS`
variable onto `document.body`, then `css-change` is delivered through the context's own
`onThemeChange`. The class half (`.theme-light`/`.theme-dark`) is as inert here as it is there,
because jsdom cascades no stylesheet.

**`fireThemeChange()` is why the rig was in the lease.** `designerRig`'s `onThemeChange` was
`() => () => undefined` — a source that never fires — so the palette could be changed on `body` and
nothing would re-resolve: `useThemeTokens` subscribes once, at setup. The rig now holds the listener
set the way the composition root's source does and exposes one door to fire it. It is a door rather
than a construction option for the reason `faultNextGeometryRead` is: the interesting moment is a
flip with a leaf already on screen and, for the gesture case, a button already held.

## The grep, re-run after the change

```
$ grep -oE "name: '[a-z-]+'" src/presentation/designer/DesignerCanvas.vue | sort -u
name: 'asset-anchor-mark'
name: 'asset-clearance-outline'
name: 'asset-detail'
name: 'asset-facing-head'
name: 'asset-facing-shaft'
name: 'asset-footprint-edge'
name: 'asset-footprint-outline'
name: 'asset-rotate-stem'
name: 'asset-selection-handle'
name: 'asset-selection-outline'
```

**Still ten, and that is the expected answer rather than a surprise**: this card changes no `src/`
file, so the grep's subject did not move. What changed is the side of the comparison this repository
keeps — `GEOMETRY_NODES` named seven of those ten and `SELECTION_NODES` now names the other three, so
the two lists together name all ten, and the docblock says that instead of naming three as
uncovered. Two further greps are quoted in the new docblocks, because those names are in other files
and outside this one's universe:

```
$ grep -oE "name: '[a-z-]+'" src/presentation/editor/elements/RotateArrowIcon.vue | sort -u
name: 'rotation-handle'
name: 'rotation-handle-button'
name: 'rotation-handle-icon'
$ grep -oE "name: '[a-z-]+'" src/presentation/designer/layers/DesignerGestureLayer.vue | sort -u
name: 'detail-preview'
```

`SELECTION_NODES` takes two of the rotate arrow's three and deliberately leaves the outer
`rotation-handle` group out: it has no `x` and no `y`, so it would be an entry equal on both sides of
any flip whatever the code did — the tautology in the other direction from an empty capture.
`GESTURE_NODES` takes the gesture layer's one name and says in its own docblock that
`GestureSketch`, `MarqueeOverlay` and `SnapGuides` — its three siblings, which take `tokens` too —
are NOT covered.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| Matrix row **T32**, GEOMETRY half — the SELECTION's marks | **closed** | `designerTheme.test.ts` "moves the selection's palette and not one of its marks": a real Select press, a real click that selects the footprint, every distinct `THEME_TOKENS` variable flipped, `css-change` fired through the context, five selectors' coordinates compared across it | — |
| Matrix row **T32**, GEOMETRY half — the GESTURE's preview | **closed for a draw tool's preview** | "moves the gesture's palette and not one of its preview coordinates": the flip happens BETWEEN the press and the release, with `.detail-preview` on the stage | the marquee, the polygon sketch and the snap guides are that layer's siblings and are asserted across no flip — see "What this does not close" |
| Matrix row **T32**, GEOMETRY half — the committed design's marks | closed by W16-C, unchanged here | that card's case still green in this file (6 of 6) | — |
| Matrix row **T32**, VISIBILITY/OCCLUSION half | **not closed, and not closeable here** | none attempted | jsdom has no rendering engine. See below |
| Both new cases can fail on geometry | **watched red, once per producer** | quoted verbatim below, both mutations reverted | — |
| Both new cases can fail on a flip that did not happen | **watched red** | quoted verbatim below | — |

## Watched red — mutation 1, the selection's coordinates

`mark()` in `src/presentation/designer/layers/selectionLayer.ts` was made to derive its `x` from a
token — `x: at.x + tokens.accent.length` — which is the smallest way a palette can be made to move a
coordinate (`rgb(250, 4, 0)` is 14 characters, `rgb(5, 4, 0)` is 12). Verbatim, the header and the
tail of the diff; the diff names all eight handle marks and its middle is elided where marked:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/presentation/designer/designerTheme.test.ts > the designer selection, the gesture in flight, and a theme change > moves the selection's palette and not one of its marks
AssertionError: expected { …(5) } to deeply equal { …(5) }
    ".asset-selection-handle": [
```

… (five earlier handle marks, the outline, the stem and the rotate arrow's two nodes) …

```
      [
-       514,
+       512,
        -300,
        80,
        80,
      ],
      [
-       514,
+       512,
        0,
        80,
        80,
      ],
      [
-       514,
+       512,
        300,
        80,
        80,
      ],
      [
-       14,
+       12,
        300,
        80,
        80,
      ],
      [
-       -486,
+       -488,
        300,
        80,
        80,
      ],
      [
-       -486,
+       -488,
        0,
        80,
        80,
      ],
    ],

 ❯ tests/presentation/designer/designerTheme.test.ts:441:53
    439|
    440|   expect(strokeOf(rig.stage, '.asset-selection-outline')).not.toBe(lig…
    441|   expect(drawnGeometry(rig.stage, SELECTION_NODES)).toEqual(light.geom…
       |                                                     ^
    442|  });
    443|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

The offset is exactly the two-character difference between the two palettes' accent strings, the
failure names the selector the mutation reaches, and the other five cases in the file stay green.
Reverted with `git checkout -- src/presentation/designer/layers/selectionLayer.ts`;
`git status --short` then showed only the two leased test files modified.

## Watched red — mutation 2, the gesture preview's coordinates

`previewFlat`'s projection in `src/presentation/designer/layers/DesignerGestureLayer.vue` was made
`return [at.x + props.tokens.accent.length, at.y];`. Verbatim:

```
 FAIL  |suite| tests/presentation/designer/designerTheme.test.ts > the designer selection, the gesture in flight, and a theme change > moves the gesture's palette and not one of its preview coordinates
AssertionError: expected { '.detail-preview': [ [ 85, …(7) ] ] } to deeply equal { '.detail-preview': [ [ 87, …(7) ] ] }

- Expected
+ Received

  {
    ".detail-preview": [
      [
-       87,
+       85,
        68,
-       122,
+       120,
        68,
-       122,
+       120,
        98,
-       87,
+       85,
        98,
      ],
    ],
  }

 ❯ tests/presentation/designer/designerTheme.test.ts:471:51
    469|
    470|   expect(strokeOf(rig.stage, '.detail-preview')).not.toBe(light.stroke…
    471|   expect(drawnGeometry(rig.stage, GESTURE_NODES)).toEqual(light.geomet…
       |                                                   ^
    472|
    473|   held(rig, 'pointerup', { x: 600, y: 500 }, 0);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

Four of the eight numbers shift by 2 and the other four stay put, which is the x-only mutation
showing through. Reverted with
`git checkout -- src/presentation/designer/layers/DesignerGestureLayer.vue`.

## Watched red — mutation 3, the anti-tautology guard

Both `rig.fireThemeChange();` lines were removed from the test file, which is the flip not happening
while everything else stays identical. Both cases fail, on the guard rather than on the geometry:

```
 FAIL  |suite| tests/presentation/designer/designerTheme.test.ts > the designer selection, the gesture in flight, and a theme change > moves the selection's palette and not one of its marks
AssertionError: expected 'rgb(250, 4, 0)' not to be 'rgb(250, 4, 0)' // Object.is equality
 ❯ tests/presentation/designer/designerTheme.test.ts:439:63
    437|   await settle();
    438|
    439|   expect(strokeOf(rig.stage, '.asset-selection-outline')).not.toBe(lig…
       |                                                               ^
    440|   expect(drawnGeometry(rig.stage, SELECTION_NODES)).toEqual(light.geom…
    441|  });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |suite| tests/presentation/designer/designerTheme.test.ts > the designer selection, the gesture in flight, and a theme change > moves the gesture's palette and not one of its preview coordinates
AssertionError: expected 'rgb(250, 4, 0)' not to be 'rgb(250, 4, 0)' // Object.is equality
 ❯ tests/presentation/designer/designerTheme.test.ts:468:54
    466|   await settle();
    467|
    468|   expect(strokeOf(rig.stage, '.detail-preview')).not.toBe(light.stroke…
       |                                                      ^
    469|   expect(drawnGeometry(rig.stage, GESTURE_NODES)).toEqual(light.geomet…
    470|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
```

**The guard is read off the node whose list it guards** — `.asset-selection-outline`'s stroke and
`.detail-preview`'s stroke, both of which ARE `tokens.accent` — rather than off `.asset-footprint`.
That is stronger than a shared guard would be: a build that re-resolved the palette everywhere except
the layer under test fails here and would have passed a footprint-read guard. Restored from a copy
taken before the mutation; `grep -c "rig.fireThemeChange();"` prints 2 again and `git status --short`
shows the expected two files.

The third guard is `emptySelectors`, which fails when a selector reaches NOTHING — the other
direction of the same tautology. It is not separately mutated: mutation 3 is the evidence that the
capture is live, and the five selection selectors populate at all only because the selection and the
tool are both real.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerTheme.test.ts` | candidate, worktree `ad10` | `Test Files  1 passed (1)` / `Tests  6 passed (6)` | final run, 119.12s |
| same, with `mark()` mutated | temporary | `Tests  1 failed \| 5 passed (6)` | quoted verbatim above, mutation reverted |
| same, with `previewFlat` mutated | temporary | `Tests  1 failed \| 5 passed (6)` | quoted verbatim above, mutation reverted |
| same, with both `fireThemeChange()` calls removed | temporary | `Tests  2 failed \| 4 passed (6)` | quoted verbatim above, restored |
| `npx vitest run tests/presentation/designer/` | candidate | `Test Files  70 passed (70)` / `Tests  972 passed (972)` | run because `designerRig.ts` is shared by that whole directory and its `onThemeChange` behaviour changed |
| `npx vitest run` over the three `tests/harness/accessibilityDesigner*.test.ts` files | candidate | `Test Files  3 passed (3)` / `Tests  8 passed (8)` | the only rig consumers outside `tests/presentation/designer/`, found with `grep -rln "helpers/designerRig" tests/` |
| `npx oxlint` on both touched files | candidate | exit 0, no output — read as the EXIT CODE, since oxlint prints nothing when clean | — |
| `npx eslint` on both touched files | candidate | exit 0, no output | run explicitly, because the edit-loop hook runs ESLint only for `.vue` |
| `npx vue-tsc -noEmit` | candidate | exit 0 | the whole-tree type check, which is what covers `tests/**`; the rig's interface gained a required member, so this is the instrument that would find a consumer it broke |
| `wc -l` on both touched files | candidate | 495 and 558 | under the `tests/**` cap, corroborated by the clean `eslint` above |

**One transient red, recorded because it happened and not because it means anything.** The first run
of the three harness files together answered `Test Files  no tests` / `Errors  3 errors` in 60s, with
no error text surviving into the tail that was read. Each file then passed alone, the remaining two
passed as a pair, and the same three-path command passed on a re-run — `Test Files  3 passed (3)`.
That is the shape CLAUDE.md names for this machine under load, and the card's own instruction (re-run
alone before believing a failing file) is what resolved it. No budget was raised and nothing was
quarantined. It is written down rather than dropped because a disappearing red that nobody records is
one the next session rediscovers from scratch.

## Verification not performed

- **`npm run check`, `npm run check:fast`, `npm run test:coverage` and `npm run analyze` were NOT
  run.** The card reserves them for the integrator: two full gates at once on this shared machine
  thrash and produce a WRONG red — a destroyed `coverage/.tmp/coverage-N.json`, and `tests/build/`
  ESLint boots over their `beforeAll` budget. So the coverage floors, `eslint .` over the whole tree,
  the build and stylesheet checks and fallow are all unrun on this branch. The change adds two cases
  and one rig member and no `src/` line, so it should not move a floor — that is a prediction, not a
  measurement, and CI is the instrument. `vue-tsc -noEmit` IS run: it is none of the four, touches no
  `coverage/` and boots no ESLint.
- **No suite outside `tests/presentation/designer/` and those three harness files was run.** In
  particular `tests/build/` is unrun, which is where the line budgets, the suppression scan and the
  regex census live; `eslint` and `vue-tsc` on the two touched files are what stand in, and they are
  narrower than that directory.
- **Nothing was run in a vault** (`npm run test-build`), and no capture was taken
  (`npm run harness-shot`). Both are the only instruments that could address the row's other half,
  and neither is available to this card.
- **The `.theme-light` / `.theme-dark` class half of a real flip is not driven**, for W16-C's reason:
  jsdom cascades no stylesheet, so the class would be inert and setting it would be theatre a
  reviewer could mistake for the mechanism. What is driven is the RESOLVED half, which is the half
  `resolveThemeTokens` reads and therefore the whole of what reaches a Konva config.
- **No browser/host/migration/performance check applies** — this card adds no schema, no runtime
  wiring and no rendered surface.

## What this does not close

- **T32's visibility/occlusion half is untouched, and jsdom is why.** The row asks for "Theme changes
  preserve line visibility/occlusion without geometry changes" at layer *Visual + geometry*. jsdom
  has no rendering engine: Konva draws into a backing canvas nobody looks at, nothing is laid out, no
  pixel is compared. Whether a selection handle is legible against the ground it lands on after a
  flip, and whether the preview is occluded by the shape under it, is unobservable in this suite at
  any effort. A vault, or a `harness-shot` capture in both schemes, is the only instrument.
  **Nothing in this card is evidence about how the theme LOOKS**; it is evidence that a palette
  change moves colours and moves no coordinate.
- **The gesture layer's three SIBLINGS are still asserted across no flip.** `GestureSketch.vue`,
  `MarqueeOverlay.vue` and `SnapGuides.vue` are mounted by `DesignerGestureLayer` from
  `src/presentation/editor/layers/`, each takes `tokens`, and each emits coordinates. This card
  covers the one node `DesignerGestureLayer`'s own template draws. They were left rather than
  stretched into these cases for a mechanical reason as well as a scope one: the marquee is drawn by
  a press on empty canvas, which CLEARS the selection, so one case cannot hold both a selection and a
  marquee at once. That is a card, not a widening.
- **The outer `rotation-handle` group is deliberately uncovered**, and its docblock says so: it
  positions nothing, so including it would add an entry green on both sides of every possible flip.
- **`rotation-handle-icon`'s scale is not asserted.** The capture reads `x`/`y`/`width`/`height` for a
  node that is neither a line nor a circle; that group's `scaleX`/`scaleY` are `radius / 12` and are
  outside what is compared. They derive from `worldPerPixel`, not from a token, which is the argument
  for leaving them — and it is an argument, not a check.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — no `src/` file is modified.
Undo/no-op/conflict/failure coverage: not applicable; this card adds tests and one test-helper door.
Identity/unit/quantity/calibration invariants: untouched. The cases assert that world-millimetre
coordinates are unchanged across a palette change, which is adjacent to the unit invariants but
exercises no calibration.
Shared root/runtime/locales wiring still required: none. `fireThemeChange` is a test helper; the
production source of that event (`AssetDesignerDeps.onThemeChange`) already existed and is unchanged.
Rollback/recovery considerations: the commit is two test files and one report; reverting it restores
the base exactly.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
