# Task report — W17-C (AD15 validation matrix row T32, the selection's and the gesture's geometry)

Outcome: implemented, for the geometry half of the row and for the three producers W16-C named as
open — see "What this does not close", which is shorter than W16-C's and is still not empty.
Owner / worktree / branch: card W17-C / `.worktrees/ad10` / `w17c-selection-gesture-flip`
Base commit / candidate commit: `480dbbc85` / `1394864e2`, plus the fix-round commit on top of it
(one blocking finding and four smaller ones; the blocking one changed what the check compares, so
its red was re-taken against the fixed tree)
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
| Matrix row **T32**, GEOMETRY half — the SELECTION's marks | **closed** | `designerTheme.test.ts` "moves the selection's palette and not one of its marks": a real Select press, a real click that selects the footprint, every distinct `THEME_TOKENS` variable flipped, `css-change` fired through the context, five selectors compared across it — on ten attributes per non-line node (`x`, `y`, `width`, `height`, `offsetX`, `offsetY`, `cornerRadius`, `rotation`, `scaleX`, `scaleY`), which is every field of `mark()` that positions or shapes a mark | the four beyond `x`/`y`/`width`/`height` were added in the fix round; the first round's capture read four and was green for an `offsetX` mutation, measured |
| Matrix row **T32**, GEOMETRY half — the GESTURE's preview | **closed for a draw tool's preview** | "moves the gesture's palette and not one of its preview coordinates": the flip happens BETWEEN the press and the release, with `.detail-preview` on the stage | the marquee, the polygon sketch and the snap guides are that layer's siblings and are asserted across no flip — see "What this does not close" |
| Matrix row **T32**, GEOMETRY half — the committed design's marks | closed by W16-C, unchanged here | that card's case still green in this file (6 of 6) | — |
| Matrix row **T32**, VISIBILITY/OCCLUSION half | **not closed, and not closeable here** | none attempted | jsdom has no rendering engine. See below |
| Both new cases can fail on geometry | **watched red, once per producer** | quoted verbatim below, both mutations reverted | — |
| Both new cases can fail on a flip that did not happen | **watched red** | quoted verbatim below | — |

## Fix round — one blocking finding and four smaller ones

All five were re-measured at the code here before being acted on, and one of the five was
measured rather than accepted.

**F1 (blocking) — CONFIRMED at the code, and the stronger arm taken.** `mark()` in
`selectionLayer.ts` emits eight positioning/shape fields and the capture read four:
`offsetX: radius` and `offsetY: radius` TRANSLATE the drawn mark, `cornerRadius` is
`style === 'square' || style === 'diamond' ? 0 : radius` and is `3 * worldPerPixel` on
`.rotation-handle-button`, and `rotation: 45` is spread in for a `'diamond'`, which is what
`HANDLE_STYLE`'s `edge` entry makes a Bend edges handle. Every one comes from the same
`tokens`-taking function whose `x` the first round mutated.

**The arm taken is the first — strengthen the capture — and not the second, for two reasons.**
The case name is the guarantee a failure report prints, and narrowing it to *"…and not one of its
`x`, `y`, `width` or `height`"* would leave the code weak and the prose merely accurate, which is
the wrong half of the "write the guarantee to the check" rule when the check is the cheap thing to
move: the fix is four expressions inside an existing `toEqual`, with nothing to rebalance. And the
dropped fields are not incidental neighbours — `offsetX`/`offsetY` decide WHERE the mark lands, so
a capture without them is not a narrower version of the claim but a different one.
`coordinatesOf`'s fall-through now returns `x`, `y`, `width`, `height`, `offsetX`, `offsetY`,
`cornerRadius`, `rotation`, `scaleX`, `scaleY`. The last two are included because they are the
rotate arrow icon group's `radius / 12` — the report's own "not asserted" caveat from the first
round, closed rather than restated.

**The review's prediction was reproduced here rather than taken on trust**, because it is the whole
argument for the finding. With `offsetX: radius + tokens.accent.length` live in `selectionLayer.ts`
and `coordinatesOf`'s fall-through narrowed back to the four-field version, this file answered
`Test Files  1 passed (1)` / `Tests  6 passed (6)` — the mark moves on screen and the case is green.
The same mutation against the FIXED capture is mutation 1 below.

**F2 — CONFIRMED, and the docblock now names it.** Three node kinds reach the fall-through, not the
two the docblock listed: the handle marks and the rotate backing are `<VRect>`s and
`.rotation-handle-icon` is a `<VGroup>`, whose `width`/`height` default to `0` and are therefore
equal on both sides of every flip. That is the same tautology `SELECTION_NODES` cites to exclude the
outer `rotation-handle` group, so leaving it unremarked inside a member the list KEPT was the real
defect. `coordinatesOf`'s docblock now names the group, says which two of its numbers are inert, and
says why it stays anyway: its `x`/`y` are `at.x - radius`/`at.y - radius` and its scales are
`radius / 12`, four real numbers pinning `radius`, where the outer group has none at all.

**F3 — CONFIRMED, and the row is corrected.** `git show 1394864e2:… | wc -l` prints **497**, not the
495 the table carried; 495 was measured before that commit's last docblock edit and never re-run —
the same defect W16-C's own fix round recorded against a 299. The number for THIS commit is measured
below and is different again, because the fix round added prose.

**F4 — accepted, no code change.** Recorded as a caveat under mutation 2.

**F5 — accepted.** The note is in `mountDesigner`'s own docblock, which is where the next author
stands, rather than in this report where nobody adding a case would look.

## Watched red — mutation 1, the selection's coordinates, against the FIXED capture

`mark()` in `src/presentation/designer/layers/selectionLayer.ts` was made to derive its `offsetX`
from a token — `offsetX: radius + tokens.accent.length` — which is the field F1 named and the one the
pre-fix capture could not see (`rgb(250, 4, 0)` is 14 characters, `rgb(5, 4, 0)` is 12). The tail of
the diff, verbatim; each handle mark now shows ten numbers rather than four, and the fifth is the
one that moves:

```
-       54,
+       52,
        40,
        0,
        0,
        1,
        1,
@@ -83,11 +83,11 @@
      [
        -500,
        300,
        80,
        80,
-       54,
+       52,
        40,
        0,
        0,
        1,
        1,
@@ -95,11 +95,11 @@
      [
        -500,
        0,
        80,
        80,
-       54,
+       52,
        40,
        0,
        0,
        1,
        1,

 ❯ tests/presentation/designer/designerTheme.test.ts:489:53
    487|
    488|   expect(strokeOf(rig.stage, '.asset-selection-outline')).not.toBe(lig…
    489|   expect(drawnGeometry(rig.stage, SELECTION_NODES)).toEqual(light.geom…
       |                                                     ^
    490|  });
    491|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

`offsetX` moves 54 → 52 while `offsetY` holds at 40 and `cornerRadius`, `rotation` and the two
scales hold at 0, 0, 1, 1 — an x-only mutation showing through a capture that can now see it.
Reverted with `git checkout -- src/presentation/designer/layers/selectionLayer.ts`, confirmed by
re-reading `offsetX: radius,` at source.

## Watched red — mutation 1a, the same field's `x`, quoted from the FIRST-ROUND tree

The first round mutated `x: at.x + tokens.accent.length` instead, and that quote is kept below
rather than re-taken. **The reason it still holds is structural and not an assumption**: the fixed
capture is a strict SUPERSET of the one this red was taken against — the same first four numbers,
plus six more — and a `toEqual` over a superset cannot pass where the subset failed. Only the `❯`
line number and the numbers-per-mark in the diff have moved. Verbatim, the header and the tail of
the diff; the diff names all eight handle marks and its middle is elided where marked:

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
`git checkout -- src/presentation/designer/layers/DesignerGestureLayer.vue`. Quoted from the
first-round tree and still exact: the fix round changed only `coordinatesOf`'s fall-through, and a
`.detail-preview` is a `Konva.Line`, so it never reaches that branch — only the `❯` line number has
moved.

**This red is NOT uniquely held by this case, and reads as stronger evidence than it is.**
`designerDrawDetails.test.ts` drives the same draw-rect gesture at the same world coordinates and
pins `.detail-preview`'s eight `points` with `toBeCloseTo`, so the same mutation would have reddened
it too; the first round's "the other five cases in the file stay green" is true and says nothing
about that file. Mutation 1 is the clean one — `layers.test.ts` pins only counts for those
selectors.

**And a limit of the technique, which applies to both cases.** What is unique to this card is the
ACROSS-A-RE-RESOLVE line, and no mutation isolates it: a token-to-coordinate leak moves coordinates
at a fixed palette too, so any mutation strong enough to redden these cases reddens a
fixed-palette pin as well wherever one exists. The mutations are evidence the capture is live and
reaches the right nodes; the flip is what mutation 3 covers, and the pair is the whole of what can
be shown from here.

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
shows the expected two files. Quoted from the first-round tree; the fix round changed neither guard
nor `strokeOf`, so only the `❯` line numbers have moved.

The third guard is `emptySelectors`, which fails when a selector reaches NOTHING — the other
direction of the same tautology. It is not separately mutated: mutation 3 is the evidence that the
capture is live, and the five selection selectors populate at all only because the selection and the
tool are both real. **The review round found a property here that this card did not claim**: because
`strokeOf` answers `undefined` for an absent node, an absent node fails BOTH guards rather than
neither — `undefined !== undefined` is false, so the flip-took guard reddens on a missing node as
well as on a missing flip. Recorded because it is true and was not designed in.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerTheme.test.ts` | fix round | `Test Files  1 passed (1)` / `Tests  6 passed (6)` | final run, 22.55s |
| same | first round | `Test Files  1 passed (1)` / `Tests  6 passed (6)` | 119.12s |
| same, with `mark()`'s **`offsetX`** mutated | fix round, temporary | `Tests  1 failed \| 5 passed (6)` | quoted verbatim above, mutation reverted — the F1 red against the FIXED capture |
| same mutation, with `coordinatesOf` narrowed back to its four-field form | fix round, temporary | `Test Files  1 passed (1)` / `Tests  6 passed (6)` | the F1 prediction reproduced here rather than accepted; both changes reverted |
| same, with `mark()`'s `x` mutated | first round, temporary | `Tests  1 failed \| 5 passed (6)` | quoted verbatim above, mutation reverted |
| same, with `previewFlat` mutated | temporary | `Tests  1 failed \| 5 passed (6)` | quoted verbatim above, mutation reverted |
| same, with both `fireThemeChange()` calls removed | temporary | `Tests  2 failed \| 4 passed (6)` | quoted verbatim above, restored |
| `npx vitest run tests/presentation/designer/` | candidate | `Test Files  70 passed (70)` / `Tests  972 passed (972)` | run because `designerRig.ts` is shared by that whole directory and its `onThemeChange` behaviour changed |
| `npx vitest run` over the three `tests/harness/accessibilityDesigner*.test.ts` files | candidate | `Test Files  3 passed (3)` / `Tests  8 passed (8)` | the only rig consumers outside `tests/presentation/designer/`, found with `grep -rln "helpers/designerRig" tests/` |
| `npx oxlint` on both touched files | both rounds | exit 0, no output — read as the EXIT CODE, since oxlint prints nothing when clean | — |
| `npx eslint` on both touched files | both rounds | exit 0, no output | run explicitly, because the edit-loop hook runs ESLint only for `.vue` |
| `npx vue-tsc -noEmit` | both rounds | exit 0 | the whole-tree type check, which is what covers `tests/**`; the rig's interface gained a required member and the fix round added a `getAttr` cast, so this is the instrument for both |
| `wc -l` on both touched files | fix round | **543** and 558 | under the `tests/**` cap, corroborated by the clean `eslint` above |
| `git show 1394864e2:… \| wc -l` | fix round | **497** | F3: the first round's table said 495, a figure taken before that commit's own last docblock edit and never re-run. Corrected here, with the same failure recorded against W16-C's 299 |

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
  Its CHILDREN are covered, so nothing the arrow positions with is outside the comparison.
- **`rotation-handle-icon`'s `width`/`height` are inert.** Two of that group's ten numbers are
  Konva's `Node` defaults of `0` and cannot move; the other eight — including the `scaleX`/`scaleY`
  the first round listed here as uncovered, which the fix round added — are real. Recorded because a
  member kept in a list for a reason has to state which of its numbers carry that reason.
- **A LINE's transform is not compared**, only its `points`. That is complete for the producers here
  rather than short: `OutlineConfig` in `footprintLayer.ts` declares no `x`, `y`, offset or scale, so
  a line on this canvas positions with `points` alone. It would stop being complete the day a layer
  builder gave a line a transform, and nothing would report that — the argument is at the config
  type, not in a check.
- **Nothing stops a future rig case in this file from breaking the trailing pixel-ratio case.**
  `mountDesigner` answers `Konva.stages[0]` and the rig cases mint into the same module-level
  registry; today they take `Konva.stages.at(-1)` and unmount in an `onTestFinished`, so index 0 is
  always `mountDesigner`'s own. A rig case added without that unmount would make the last case
  assert about the wrong stage SILENTLY. The note is in `mountDesigner`'s docblock, where the next
  author is standing; there is no check under it.

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
