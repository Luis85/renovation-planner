# Task report — AD11 (expose open lines and rounded-shape authoring)

Outcome: **implemented, not verified** — every acceptance criterion has automated evidence below,
and nothing has been run in Obsidian, in a browser or under the full `npm run check`. **Review round
1 is answered** (see [that section](#review-round-1--findings-and-corrections)); the two blocking
findings are fixed with cases watched red, and this worker still does not mark itself verified.
Owner / worktree / branch: AD11 (CANVAS) / `.worktrees/ad11` / `ad11-open-lines`
Base commit / candidate commit: `c5436082d` / the tip of `ad11-open-lines`. Four commits sit on
the base: `1ae488069`, a preserved WIP from an interrupted predecessor session and deliberately not
amended; `651cb48db`, which carries the implementation and the first version of this report;
`eab8cb00c`, recording that SHA, which a report naming its own commit cannot avoid; and the
**review-fix commit on top of it**, which carries the corrections in
[Review round 1](#review-round-1--findings-and-corrections). Nothing is amended and nothing from the
reviewed candidate is reverted.
Accepted contract revision: `r1`
Allowed scope and shared-file leases: `tools/draw-detail-tool.ts` and the new open-line tool;
`tools/registerDesignerTools.ts`; `domain/asset/AssetDetail.ts` (additive);
`domain/asset/shapeEdits.ts`; `inspector/DesignerSelectionInspector.vue`;
`selection/partExtent.ts`; `i18n/locales/{en,de}/assetOpenLines.ts`; `styles/designer-object.css`;
any new file under `tests/`. **Granted at review**, for the corrections only:
`designer/DesignerToolbar.vue`, `designer/DesignerSelectionModes.vue`,
`editor/surface/cursor.ts`, `editor/snapping/editorSnapping.ts` and
`tests/presentation/designer/designerToolbar.test.ts`. (`DesignerToolbar.vue` was leased and turned
out not to need an edit: the narrowing belongs entirely to the component it mounts.)

**This report covers two sessions.** A predecessor implemented most of the feature and was killed
part-way through its discipline pass; its work is preserved at `1ae488069`. This session audited
that work, corrected it, completed the watched-red pass and closed the coverage gaps. The
[inherited work](#the-inherited-work) section is the account of what was kept, changed and
reverted.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/tools/draw-line-tool.ts` (new) | `DrawLineTool`: click to place, Enter or a click on the last vertex to finish, Escape to discard, one `OpenDetail` written through the existing `detailWrite` chain | Yes |
| `src/presentation/designer/tools/registerDesignerTools.ts` | Registers `draw-line` and `draw-rounded-rect`; `detailOn`/`detailWrite` take a `DetailGeometry` instead of a `CurvedPolygon` | Yes |
| `src/presentation/designer/tools/draw-detail-tool.ts` | `roundedRectOutline`, the third outline builder beside `rectOutline` and `circleOutline` | Yes |
| `src/domain/asset/AssetDetail.ts` | Adds `DetailGeometry`; corrects the union's docblock, which claimed the two arms name their geometry differently (they have both been `outline` since AD04's own amendment) | Yes (the type); the docblock correction is beyond "additive" — see ICR 9 |
| `src/domain/asset/shapeEdits.ts` | `partPoints` and `mapPartOutline`; `moveOutline`/`rotateOutline`/`resizeBox` re-pointed at it so a transform keeps a graphic's kind. `outlineOf` is UNCHANGED | Yes |
| `src/presentation/designer/selection/partExtent.ts` | `partMeasure` (both kinds, through `detailBox`), `PartBox` as a named type, the zero-extent refusal | Yes |
| `src/presentation/designer/inspector/DesignerSelectionInspector.vue` | Geometry fields return for an open graphic; one sentence saying solid/dashed is a line's pattern and never a fill | Yes |
| `src/presentation/i18n/locales/{en,de}/assetOpenLines.ts` | Two toolbar labels, the open-graphic sentence, the `asset.extent-not-scalable` refusal | Yes |
| `styles/designer-object.css` | `.rp-designer-open-graphic`, the muted status line under a selected line's heading | Yes |
| `src/domain/asset/detailEdits.ts` | `NewDetail` widened from the closed arm to a union over both | **No** — ICR 1 |
| `src/domain/asset/presets/presetGeometry.ts` | `roundedRect`, appended | **No** — ICR 2 |
| `src/presentation/editor/tools/editor-tool.ts` | `'draw-line'` and `'draw-rounded-rect'` added to `ToolId` | **No** — ICR 3 |
| `src/presentation/editor/tools/render-state.ts` | `previewClosed`, defaulting to `true` | **No** — ICR 4 |
| `src/presentation/editor/surface/keyboard.ts` | `'draw-line'` added to `finishesOnEnter` | **No** — ICR 5 |
| `src/presentation/designer/layers/DesignerGestureLayer.vue` | Binds the preview's `closed` to `previewClosed` | **No** — ICR 6 |
| `src/presentation/designer/layers/selectionLayer.ts` | `selectedRun`: a selected detail is restroked through `detailPolyline`, so a path is drawn at all | **No** — ICR 7 |
| `src/presentation/designer/selection/dragSnap.ts` | `snapBody` takes points; the body arm asks `partPoints`. Fixes a crash | **No** — ICR 8 |
| `tests/presentation/designer/tools/drawLineTool.test.ts` (new) | The tool's guards, report doors and in-flight windows, driven directly | Yes |
| `tests/presentation/designer/selection/partMeasure.test.ts` (new) | Which parts `partMeasure` measures, the curved-path reading, its two "not there" arms | Yes |
| `tests/presentation/editor/elements/placedOpenGraphic.test.ts` (new) | C10's third consumer: an open graphic drawn on a plan | Yes |
| `tests/domain/asset/openGraphicEdits.test.ts` (new) | The domain split between point-wise transforms and ring-only edits; add, duplicate, delete, group | Yes |
| `tests/presentation/designer/designerDrawOpenLines.test.ts` (new) | Both new tools through the real toolbar and canvas, asserted against the sidecar | Yes |
| `tests/domain/asset/presets/presetGeometry.test.ts` | `roundedRect`'s area, bulges, centre and ceiling | **No** — ICR 2 |
| `tests/presentation/designer/designerSelectionInspector.test.ts` | The open-graphic section rewritten from "withholds" to "measures" | **No** — ICR 10 |
| `tests/presentation/designer/designerToolbar.test.ts` | Two labels in the pinned order; at review, the precise-cursor `it.each`, the Shift-hint split and the two open-graphic mode cases | **No** — ICR 10, then leased at review |
| `src/presentation/designer/DesignerSelectionModes.vue` | An open graphic is offered Transform alone, with a tooltip naming the gesture it really has | Leased at review — F1 |
| `src/presentation/editor/surface/cursor.ts` | `draw-line` and `draw-rounded-rect` added to `PRECISE_TOOLS` | Leased at review — F2 |
| `src/presentation/editor/snapping/editorSnapping.ts` | `draw-line` added to `CONSTRAINING_TOOLS`; the docblock records why `draw-rounded-rect` is not | Leased at review — F3 |
| `src/presentation/designer/tools/draw-line-tool.ts` (again) | `finish`'s docblock: all three excluded refusals named | Yes — F4 |
| `src/presentation/editor/tools/render-state.ts` (again) | `previewClosed`'s docblock: `previewPolygon`'s third reader named | **No** — ICR 4, F5 |
| `src/presentation/i18n/locales/{en,de}/assetOpenLines.ts` (again) | The Transform-for-an-open-graphic tooltip; the German refusal moved to the du of the family it joins | Yes — F1, F7 |
| `tests/presentation/designer/selectionLayer.test.ts` | A selected open graphic's restroke, and a graphic the shape has not got | **No** — ICR 10 |
| `tests/presentation/designer/tools/designerSelectSnapping.test.ts` | A body drag of an open graphic | **No** — ICR 10 |

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| An open polyline remains open after save, reopen, duplication, grouping and export | Met | Save/reopen: every case in `designerDrawOpenLines.test.ts` reads `rig.document()`, the sidecar as it stands on "disk". Duplication and grouping: `openGraphicEdits.test.ts` — *duplicates as an open graphic*, *groups and ungroups as a member like any other*. "Export" is r1's three consumers — see [C10](#c10-the-three-consumers) | Real-vault save/reopen unrun |
| One line stroke with zero width or height can be valid without applying the closed-area validator | Met | `openGraphicEdits.test.ts` *accepts a flat two-point line, which no closed-area rule would* (box 1000 x 0); `designerDrawOpenLines.test.ts` *writes a flat two-point line* through the real tool | — |
| Radius bounds are explicit; changed dimensions cannot produce invalid corner geometry | Met, by construction rather than by a check | `CORNER_FRACTION` is a quarter of the shorter side, so the radius is always strictly under the half at which two of the eight points coincide. No radius is stored, so no later edit maintains one. `presetGeometry.test.ts` *is refused by the constructor above the half-side ceiling* pins the ceiling and that `createCurvedPolygon` refuses beyond it | The intent is not recoverable after an edit; r1's C04 approximation applies to a later nonuniform resize, as the docblocks state |
| All new tools are mounted, accessible and cancellable; completion returns to Select unless repeat is explicit | Met | `designerToolbar.test.ts` pins both labels in the toolbar's order; `designerDrawOpenLines.test.ts` asserts `activeToolId() === 'select'` after each completion and the two-press Escape behaviour; `drawLineTool.test.ts` covers `cancel`/`abandonGesture`/`deactivate`. Accessibility: `accessibilityDesignerSelection.test.ts` and `accessibility.test.ts` pass with the two new buttons (48 tests). **Since F2 and F3** both tools also carry the crosshair every other drawing tool has, and the line tool advertises the Shift constraint it was already honouring | jsdom axe cannot grade contrast, focus ring or hit size; that the `-precise` class resolves to `crosshair` is checked by nothing here, as `cursor.ts`'s own docblock says |
| No fake thin polygon or silently flattened unsupported geometry is written | Met | `designerDrawOpenLines.test.ts` asserts `kind: 'open'` on what reached the sidecar; the widening is held at the COMPILER — narrowing `NewDetail` back to the closed arm makes `registerDesignerTools.ts:169` fail with *Type `"open"` is not assignable to type `"closed"`*, measured | — |
| Unsupported property fields are absent or explain their limitation rather than doing nothing | Met **after the review fix** — it was NOT met at `eab8cb00c` | `designer.selection.open-graphic` is drawn for a line and not for a ring (`designerSelectionInspector.test.ts`); a flat line's Depth answers `asset.extent-not-scalable` in `[role="alert"]` rather than silently refusing under the wrong code. **And, since F1**, Edit points and Bend edges are absent for an open graphic rather than enabled and inert, with Transform's tooltip stating the handles a path does not get — `designerToolbar.test.ts` *offers an open graphic only Transform, and tells it what Transform can still do* | — |

### C10: the three consumers

r1 settles that "every current export path" means three things. Each was checked, and how:

1. **Authoring canvas.** `detailsLayer.ts` and now `selectionLayer.ts` both read a detail through
   `detailIsClosed`/`detailPolyline`. Verified by reading plus `selectionLayer.test.ts`'s new
   *restrokes it as an OPEN run* case (watched red — see below). AD05 had taught `detailsLayer`;
   it had NOT taught `selectionLayer`, which is ICR 7.
2. **Library mark.** `ListAssetOutlines.ts` builds its outline from `polygonPolyline(shape.footprint)`
   and reads `shape.details` nowhere — verified by reading the file. A footprint is a
   `CurvedPolygon` by type, so an open graphic cannot reach this consumer at all and there is
   nothing to assert. No test added, deliberately.
3. **Plan placement.** `assetPlacement.placedOutline` carries `closed: detailIsClosed(detail)` per
   graphic (AD05, covered by `assetPlacement.test.ts`), and `assetShapeConfig` turns that into a
   Konva config. **That source half was already correct and this card changed none of it**:
   `assetShapeConfig` has carried `closed: detail.closed` and the arm for an open one since AD05's
   `f1cbe86ef`, an ancestor of this branch's base, and `assetShapeConfig.ts` does not appear in this
   diff at all. What had never been filled was the ARM — no case in the presentation suite had ever
   driven it — so this session added `placedOpenGraphic.test.ts`: unclosed, unfilled, dashed arm
   included, and both endpoints kept. Both of its cases were watched red, which is what tells a
   never-filled arm from an absent one. (An earlier wording of this paragraph read *"the presentation
   half had no open-graphic case, so this session added…"* in a way that credited AD11 with the source
   change as well; corrected at review, finding 6. **Only the test is new.**)
   `elementFootprint.ts` and `transformBox.ts` read
   `placed.footprint` only, so neither sees a detail of either kind.

## Executed checks

Environment: Windows 11, node from the worktree's own `node_modules`, `TEMP=D:/tmp-claude` (the
C: volume has no free space). Another agent was running, so heavy commands were run one at a time
and `npm run check` was deliberately not run — see *Verification not performed*.

| Command | Exit code / result | Evidence |
|---|---|---|
| `npx vue-tsc -noEmit` | 0 | `tests/**` type-checks with `src/**`, so every test file above is compiled |
| `npx oxlint --deny-warnings src tests` | 0, no output | Run again after each later edit |
| `npx eslint <each of the 15 changed source files> --max-warnings 0` | 0 | Includes the two `.vue` files, where the Vue ruleset lives |
| `npx eslint <each of the 10 changed test files> --max-warnings 0` | 0 | — |
| `node scripts/styles-assemble.mjs` | 0 | The build's stylesheet half: partial cap, resolvable import, no hard-coded colour |
| `npx vitest run tests/presentation/designer tests/domain/asset tests/presentation/editor/elements tests/infrastructure/obsidian/repositories/assetGeometrySidecarDetails.test.ts tests/infrastructure/persistence/dto/assetGeometry.test.ts tests/domain/spatial` | 0 — **109 files, 1414 tests passed** | The full affected surface: designer, domain, plan placement, sidecar and schema |
| `npx vitest run tests/harness/accessibilityDesignerSelection.test.ts tests/harness/accessibility.test.ts` | 0 — 48 tests passed | axe-core over the mounted designer with the two new toolbar buttons |
| `npx vitest run tests/domain/asset` (after the final docblock edit) | 0 — 320 tests passed | — |
| `npx vitest run --coverage --coverage.all=false --coverage.reportsDirectory=D:/tmp-claude/cov-ad11c …` over `tests/presentation/designer tests/domain/asset tests/presentation/editor/elements`, and a second run over `tests/presentation/editor tests/presentation/designer` | 0 | **Every file this branch touches reports zero uncovered branches and zero uncovered functions.** The reports directory is redirected out of the repository so the run cannot collide with another agent's `coverage/.tmp/` |

**Review round 1** (same machine, same constraints, one heavy command at a time):

| Command | Exit code / result | Evidence |
|---|---|---|
| `npx vitest run tests/presentation/designer/designerToolbar.test.ts` (before the source fixes) | 1 — **4 failed, 39 passed** | The watched red for F1, F2 and F3; messages in the table below |
| `npx vitest run tests/presentation/designer/designerToolbar.test.ts` (after) | 0 — **43 passed** | — |
| `npx vue-tsc -noEmit` | 0 | Whole program, `tests/**` included |
| `npx oxlint --deny-warnings src tests` | 0, no output | — |
| `npx eslint <the 8 files this round touched> --max-warnings 0` | 0 | Includes `DesignerSelectionModes.vue`, where the Vue ruleset lives |
| `npx vitest run tests/presentation/designer tests/presentation/editor` | 0 — **448 files, 3914 tests passed** | Both surfaces `cursor.ts` and `editorSnapping.ts` are shared by, the plan editor included: adding two designer ids to either list changes nothing there, and this is what says so |
| `npx vitest run tests/presentation/designer/designerToolbar.test.ts` under each of the two re-taken mutations, then restored | 1, 1, then 0 — 43 passed | The watched-red rows below |

### Watched red

Every new invariant was reverted or mutated, run, seen red, and restored. What each red said:

| Invariant | Mutation | What red said |
|---|---|---|
| `dragSnap` body arm asks `partPoints` | back to `outlineOf(...) as CurvedPolygon` | `TypeError: Cannot read properties of null (reading 'points')` — the crash the card would otherwise ship |
| `selectionLayer.selectedRun` reads a detail kind-aware | back to `outlineOf` + `polygonPolyline`, `closed: true` | `expected undefined to deeply equal [ -300, -200, 0, -200, 0, 100 ]` |
| `DesignerGestureLayer` binds `previewClosed` | `closed: true` | `expected true to be false` |
| `keyboard.finishesOnEnter` knows `'draw-line'` | term removed | 5 cases red, incl. `expected undefined to match object { id: 'detail-1', kind: 'open', … }` |
| `partExtent`'s zero-extent refusal | guard removed | `expected 'A part cannot be scaled to nothing or…' to be 'This line is flat along that axis…'` — see the correction below |
| `shapeEdits.mapPartOutline` keeps kind | `moveOutline` back to `editOutline` | 2 cases red, including the per-segment bulge one |
| Inspector measures through `partMeasure` | back to `partBox(outlineOf(...))` | 7 cases red, `TypeError: Cannot read properties of null (reading 'points')` |
| `partMeasure` measures a detail through `detailBox` | `boundingBoxOf(detail.outline)` | `Error: Every boundary edge needs one curve value.` |
| `endsRun` targets the LAST vertex | `at(0)` | *finishes on a click back on the last vertex* red |
| `roundedRect`'s quarter-circle corners | bulges `1` | 3 cases red across two files, incl. the size `[1062, 662]` vs `[1000, 600]` |
| `NewDetail` is a union | back to the closed arm | `vue-tsc`: *Type `"open"` is not assignable to type `"closed"`* at `registerDesignerTools.ts:169` |
| `DrawLineTool.abandonGesture` keeps the buffer | routed through `reset` | `expected false to be true` |
| `DrawLineTool`'s `finishing` guard | removed from `finish` | two dispatches for one gesture |
| `DrawLineTool`'s generation check before completing | removed | 2 cases red, `expected [ 'detail-7' ] to deeply equal []` |
| `DrawLineTool`'s generation check in the `finally` | removed | three dispatches where two were expected |
| `assetShapeConfig` draws a placed line unclosed | `closed: true` | *draws it unclosed and unfilled* red |
| A placed line keeps its last point | `.slice(0, -1)` on `graphicOnPlan` | `expected [ 900, 1000 ] to deeply equal [ 900, 1000, 1100, 1000 ]` |

**Review round 1**, same method — the test written first, run, seen red, then the source fix:

| Invariant | Mutation | What red said |
|---|---|---|
| `draw-line` takes the precise cursor | the id absent from `PRECISE_TOOLS` (its state before the fix) | `expected false to be true` on `rig.canvasEl.classList.contains('rp-plan-canvas-precise')` |
| `draw-rounded-rect` takes the precise cursor | as above | the same, for the second id |
| `draw-line` advertises the Shift constraint | the id absent from `CONSTRAINING_TOOLS` (its state before the fix) | `Error: Cannot call text on an empty DOMWrapper` — no `.rp-designer-hint` element exists at all |
| An open graphic is offered Transform alone | `v-for="mode in MODES"` (its state before the fix) | `expected [ [ 'Transform', …(1) ], …(2) ] to deeply equal [ [ 'Transform', …(1) ] ]` — three buttons drawn where one was expected, `Edit points` and `Bend edges` printed in the received list |
| …and a CLOSED part still gets all three | `openGraphic` narrowed to `details.some((detail) => detail.kind === 'open')`, ignoring which part is selected | `expected [ 'Transform' ] to deeply equal [ 'Transform', 'Edit points', 'Bend edges' ]` on the footprint, which is the case that exists to catch a predicate that answers about the shape instead of about the selection |

The first red of the open-graphic case was taken before `designer.selection.mode.transform.open`
existed, so `t` answered `undefined` on the EXPECTED side of that comparison; the row above is the
re-taken one, with the key in place and only the `v-for` reverted, so the received side is the whole
of the evidence.

**One mutation came back GREEN and the claim was withdrawn rather than kept.** `publish` was changed
to always copy the buffer, under a docblock asserting that publishing the live buffer freezes the
preview because `reactive()`'s setter compares the raw value. Reverting the copy and asserting the
preview after two clicks with no pointer move between them left the suite green, so the copy stays
on the narrow argument (do not hand a consumer your own growing array) and the sharper claim — and
the case that could not tell the two apart — were deleted. The docblock records this.

## Verification not performed

- **`npm run check` in full.** Never run, at the dispatcher's instruction: another agent was working
  on this machine, and a second full gate produces a wrong red (destroyed `coverage/.tmp` entries,
  `tests/build/` ESLint boots over budget) rather than a slow one. `eslint .` over the WHOLE tree,
  `vite build`, `fallow` and the coverage THRESHOLDS are therefore unrun. ESLint ran over every
  changed file individually; the tree-wide run is CI's.
- **`npm run analyze` (fallow).** Unrun. Two things it could report that nothing here has checked:
  a **template cognitive-complexity** breach (`DesignerSelectionInspector.vue` gained one `v-if`
  paragraph; three templates in the previous wave breached and had to be factored at integration),
  and a **clone family** between `drawLineTool.test.ts` and `drawDetailTool.test.ts`, which share a
  `rig`/`deferredWrite` shape deliberately. Both are integration-time findings.
- **`npm run build`.** Unrun; `vue-tsc -noEmit` and `scripts/styles-assemble.mjs` cover its two
  halves separately, but the Vite bundle step and the bundle size were not measured.
- **Obsidian.** Nothing was run in a vault. `npm run test-build` is the only place appearance and
  any assumed API are verified, and no Obsidian is available here. Specifically unverified: what the
  two new toolbar buttons look like, whether the open-graphic sentence wraps acceptably in a narrow
  leaf, and whether the dashed accent restroke of a selected line reads as a selection.
- **Browser harness and captures.** `npm run harness`, `npm run harness-shot` and
  `npm run concept-shots` were all unrun; no pinned Chromium is installed on this machine and
  installing one was forbidden. No screenshot in this report, because none was taken. The captures
  are the only instrument for spacing, wrapping, overflow, contrast and hit size, and they have
  caught ten defects `npm run check` could not — so the two new toolbar buttons and the inspector's
  new paragraph have had NO layout check of any kind.
- **The `tests/build/` and `tests/release/` projects.** Unrun. `registration-locality`,
  `lint-scope`, `suppressions` and `i18n-literal-boundary` are the ones most likely to have an
  opinion about a change of this shape; none of them was executed.
- **The wider suite.** `tests/application`, `tests/plugin`, `tests/presentation/views`,
  `tests/presentation/library` and `tests/infrastructure` beyond the two named files were not run.
  `vue-tsc` compiled all of them, so no signature change is hiding there, but no behaviour outside
  the listed directories was executed.
- **Migration.** None owed — see below.

**Still not performed after review round 1**, and the three the round ADDS to the list:

- Everything above remains unrun: no `npm run check`, no `analyze`, no `build`, no Obsidian, no
  harness, no captures, no `tests/build/`, no `tests/release/`, and the wider suite outside
  `tests/presentation` and the directories named in the first table.
- **Nobody has SEEN the F1 fix.** What a user meets with a line selected — one mode button in a
  group sized for three, and whether its tooltip is discoverable at all — is a layout and discovery
  question, and every instrument for those (`npm run harness-shot`, a vault) was unavailable. The
  suite proves the buttons are absent and the tooltip is bound; it cannot say the result reads
  well, and a group of one is exactly the shape a capture would be worth taking of.
- **Nothing checks that `rp-plan-canvas-precise` resolves to a crosshair** for the two ids F2 added,
  or for any other id. `cursor.ts`'s own docblock says so: the keyword lives in
  `styles/editor-cursors.css` and `docs/tests/cases/Canvas Navigation.md` is its only instrument.
  F2 puts two ids on a list that is asserted; it does not put a cursor on a screen anybody looked at.
- **The German is still machine-quality.** F7 moved one string's register to match the family it
  sits in and closed a comma splice; it did not get a German speaker to read any of the five
  strings, and "matches its neighbours" is a weaker claim than "is good German".

## Data and integration implications

**Schema/migration change:** none. Schema 3 already carries the open arm (AD04); this card writes
what that schema was allocated for and allocates nothing. `assetGeometry.test.ts` and
`assetGeometrySidecarDetails.test.ts` were run unchanged and pass.

**Relevant renderer/export/revision consumers:** the three r1 names, accounted for
[above](#c10-the-three-consumers). There is no export subsystem and none was added.

**Undo/no-op/conflict/failure coverage:** one finished run is one history entry
(`designerDrawOpenLines.test.ts` *is one undo entry*, driving the real Undo button). A run of fewer
than two vertices, an Escape, a repeated vertex and a duplicate finish all write nothing and create
no entry. A domain refusal (no shape) reports through `reportInvalidInput` and dispatches nothing; a
DISPATCHED refusal reports through `reportRejected`, and **the buffer survives both** — a user's
placed vertices are never destroyed by a `no`. A write landing after the tool was switched away, or
after Escape started a new run, completes nothing and does not touch the new gesture's state; both
windows have cases and both were watched red. A version conflict reaches the tool as an ordinary
dispatched refusal on that same path — `drawLineTool.test.ts` drives it with
`vault.unexpected-failure` and **not** with a real conflict, which is a narrower check than the
phrase "version conflict" would suggest.

**Identity/unit/quantity/calibration invariants:** the new graphic takes the id `addDetail` assigns
and the name `line` / `rounded-rectangle`, exactly as the box and the circle do; nothing generates
an id twice (the redo path rebuilds through the same `detailOn`). Drawing over an uncalibrated sheet
marks the graphic `pending`, asserted. The rounded rectangle stores points and bulges and no radius,
so there is no parameter for a later edit to maintain dishonestly.

**Shared root/runtime/locales wiring still required:** none — `assetOpenLines` was already spread
into `en/editor.ts` by the wave-three scaffold at the base commit, and both new tools register
through the existing `registerDesignerTools` map. **German is machine-quality**: the four strings
were written by a previous agent session and have not been reviewed by a German speaker.

**Rollback/recovery considerations:** reverting this branch removes the only way to CREATE an open
graphic but leaves every reader of one in place, which is the state AD04 through AD10 shipped and
is coherent. A vault that had already saved an open graphic keeps it; the reverted build reads it
(schema 3 is unchanged), draws it, and refuses its geometry fields again. No data is lost by a
rollback.

## The inherited work

`1ae488069` is a WIP commit preserving a predecessor session killed mid-discipline-pass. Its own
message says it is not a handoff. Everything below is this session's audit of it.

### Kept unchanged

`draw-line-tool.ts`'s structure, `mapPartOutline`/`partPoints`, `partMeasure`, the inspector's
return of the geometry fields, `roundedRect`/`roundedRectOutline`, the two registrations, the
locale entries, the stylesheet rule, and all six of its test files. It was competent work: every
test it wrote passes, and the three highest-risk things it could have got wrong it got right —
`outlineOf` did NOT widen, `selectionExists` was NOT routed through an edit's guard (AD09's bug is
not reintroduced; `designerSelection.ts` still asks the shape's own parts), and the open arm reaches
the shape through the one existing `addDetail` door rather than a second one.

### Changed

- **Deleted an unreachable guard in `finish()`** and replaced it with `unwrap`. Its comment claimed
  `createCurvedPath` could refuse *"two clicks a snap pulled onto one another"*; that is false —
  `pointerDown` never pushes a landing `coincident` with one already held, and `coincident` is a
  `<= 1e-6` ball while `path-degenerate` asks only for a point exactly unequal to the first. The
  branch could never have been covered and cost one it could never pay back.
- **Removed a dead `last === undefined` arm in `endsRun`**, which the length guard beside it already
  excludes.
- **`publish` now copies the buffer** rather than handing the render state the tool's own growing
  array — on the narrow argument stated above, the sharper one having been measured and withdrawn.
- **Corrected `partExtent`'s zero-extent docblock.** It said `solveScale` *"would step factors
  forever"*. `solveScale` stops at `MAX_STEPS = 4`, and it never steps at all here because its first
  factor is `target / 0` and `resizeBox` refuses a non-finite one. Measured by removing the guard:
  the user gets `asset.invalid-scale` — *"a part cannot be scaled to nothing"* — for a value that is
  not nothing. The guard is worth keeping for the SENTENCE, and the docblock now says so.
- **Rewrote `outlineOf`'s caller list.** It named *"the four `src/` readers a grep for `outlineOf`
  prints"* and listed four. `grep -rn 'outlineOf(' src/` prints **eight call sites in six files**
  once this module and `AssetShelf.vue`'s same-named local are dropped. The rewrite is in the file,
  with each site and what it now does with an open graphic, and it records that the first rewrite of
  it said "seven" while listing eight.
- **Seventeen test cases added** — nine in `drawLineTool.test.ts`, three in `partMeasure.test.ts`,
  two in `placedOpenGraphic.test.ts`, two in `openGraphicEdits.test.ts` and one in
  `selectionLayer.test.ts` — eight of them closing branches nothing exercised: `abandonGesture` vs
  `cancel`, the double-finish guard, both generation guards, the dispatched refusal, `partMeasure`'s
  curved and missing arms, `selectionLayer`'s missing detail, `withOutline`'s clearance arm (which
  the predecessor's own refactor stranded, since `moveVertex`/`setBulge` are now its only callers),
  grouping an open graphic, and plan placement.

### Reverted

Nothing. Each of the eight out-of-lease edits was examined against "could the card be delivered
without it", and all eight answered no. They are listed as integration change requests below rather
than left silently in the diff.

### What could not be verified about it

Whether the predecessor's German strings are idiomatic; whether the two new toolbar buttons and the
inspector's new paragraph lay out acceptably (no capture, no vault); and whether the gesture *feels*
right — the grab radius for "click the last vertex again" is `POLYGON_CLOSE_GRAB_RADIUS_PX`,
borrowed from the polygon tool and never tried by a person with a mouse.

## Integration change requests

Each is a file outside AD11's lease that this session kept. All are additive, all are covered, and
all were checked to leave the plan editor's behaviour unchanged.

1. **`src/domain/asset/detailEdits.ts` — AD10's file.** `NewDetail` widened from `Omit<ClosedDetail,
   'id'>` to a union over both arms, plus the two-arm spread in `addDetail` that
   `mapDetailOutline`'s own comment already explains. **Irreducible**: `addDetail` is the ONE door
   into a shape's graphics, and the type it takes is declared beside it. It could not live in
   `AssetDetail.ts` — moving the TYPE there would still leave `addDetail`'s body needing the same
   widening, and the function is not AD11's to move. Measured as load-bearing: narrowing it back
   fails the compiler at `registerDesignerTools.ts:169`. 27 diff lines, all additive; `detailEdits.ts`
   reports zero uncovered branches and functions.
2. **`src/domain/asset/presets/presetGeometry.ts` — AD07's area.** `roundedRect` appended, 32 lines,
   nothing above it touched. `rect` and `circle` — the geometry of the two existing draw tools —
   live here, and `QUARTER_BULGE` is this module's constant; building a rounded rectangle anywhere
   else would be a second home for the arc vocabulary in a presentation file that today delegates
   all three of its outlines to this one. Its test cases are appended to `presetGeometry.test.ts`
   for the same reason.
3. **`src/presentation/editor/tools/editor-tool.ts`** — two members added to `ToolId`. Unavoidable:
   `ToolManager` is keyed by `ToolId` and the designer registers into it. The docblock paragraph
   above the union was extended to say what the two are.
4. **`src/presentation/editor/tools/render-state.ts` — explicitly forbidden by the dispatcher, and
   kept.** `previewClosed`, a field defaulting to `true` plus one line in `clear()`. The reason it
   cannot be avoided: `DesignerGestureLayer` receives `renderState` and nothing else, so closedness
   has to travel on that object or the layer needs a second source of truth. **Three things were
   checked rather than assumed.** (a) **Corrected at review (finding 5).** The narrow claim holds:
   `grep -rn previewClosed src/` prints `DesignerGestureLayer` as the field's only reader. The WIDER
   claim this item made did not — it said the only other reader of `previewPolygon` is
   `InteractionLayer.vue`, and `grep -rn previewPolygon src/` prints a THIRD,
   `src/presentation/editor/resize/RoomDimensionLabels.vue`, at four sites. The conclusion is
   unchanged, because that file hard-codes `closed: true` in the config it builds for a room being
   resized and so cannot see this field either — but the sentence was offered as grepped and was not
   what the grep printed, which is the failure shape `CLAUDE.md` names twice and which this card had
   already corrected twice in `outlineOf`'s own docblock. The field's docblock now carries both
   claims with the two greps that produce them.
   (b) Every existing WRITER of `previewPolygon` (`select-tool`, `rotationActions`,
   `roomDimensionAction`, `roomResizeAction`) leaves the new field alone and gets the default, so
   the plan editor cannot change behaviour. (c) It adds **no branch and no function** — a field
   initialiser and an assignment — and `render-state.ts` reports zero uncovered branches and
   functions over `tests/presentation/editor` + `tests/presentation/designer`.
5. **`src/presentation/editor/surface/keyboard.ts`** — `'draw-line'` added to `finishesOnEnter`.
   The asset designer composes `EditorSurface`/`keyDoors`, so this table is the designer's Enter as
   well as the plan editor's. Without it the tool has no keyboard completion at all, which is the
   card's *"mounted, accessible and cancellable"*. Removing the term turns five cases red, measured.
   `keyboard.ts` reports zero uncovered branches.
6. **`src/presentation/designer/layers/DesignerGestureLayer.vue`** — one attribute bound to (4).
   Without it the preview draws a closing edge the write does not contain, which is the wrong
   picture rather than a missing one.
7. **`src/presentation/designer/layers/selectionLayer.ts`** — `selectedRun`. **A defect the card
   creates**: `selectionMarks` asked `outlineOf`, which answers `null` for a path, so a selected
   open graphic was restroked as nothing at all — invisible while nothing could create one, live the
   moment the line tool selects what it drew. It reads a detail through `detailPolyline`/
   `detailIsClosed`, the kind-aware pair every other surface already uses, and widens
   `OutlineConfig`'s literal `closed: true` to `boolean` for the selected-outline config only.
8. **`src/presentation/designer/selection/dragSnap.ts`** — **a crash the card creates.** `hitDesign`
   has hit a path by its stroke since AD05; `dragTarget`'s body arm did
   `outlineOf(...) as CurvedPolygon` and then read `.points` on it. Reverting the fix produces
   `TypeError: Cannot read properties of null (reading 'points')`, measured. `snapBody` takes points
   now; the box-handle arm still takes a `CurvedPolygon` and is closed-only by construction, because
   `selectionHandles` draws no box handle on a path.
9. **`src/domain/asset/AssetDetail.ts`'s union docblock** — inside AD11's lease, but the lease says
   *additive* and this is a rewrite. It is a correction: the paragraph claimed *"the geometry
   property is named differently on each arm on purpose"*, which was false from the day AD04 amended
   its own §3 to keep both arms on `outline` and hold the guarantee with `CurvedPath`'s brand
   instead. The `OpenDetail` docblock ten lines above already said the true thing, so the file
   contradicted itself. Flagged rather than reverted, because restoring a false paragraph to respect
   a lease is the worse trade.
10. **Five existing test files edited** (`presetGeometry`, `designerSelectionInspector`,
    `designerToolbar`, `selectionLayer`, `designerSelectSnapping`). The lease grants new files under
    `tests/`; these are the homes of the behaviour that changed, and the pinned toolbar-order array
    and the inspector's "withholds every field" case could not be left as they were. Where a new
    home was available this session took one instead — `drawLineTool.test.ts`,
    `partMeasure.test.ts` and `placedOpenGraphic.test.ts` are new files precisely to avoid editing
    `partExtent.test.ts` and `assetShapeConfig.test.ts`.

## Review round 1 — findings and corrections

An independent review returned REQUEST CHANGES on `eab8cb00c` with two behavioural gaps and three
documentation inaccuracies, and verdicted all eight out-of-lease edits JUSTIFIED with none to be
reverted. Nothing above was undone. Four further files were leased for the corrections:
`DesignerToolbar.vue`, `DesignerSelectionModes.vue`, `editor/surface/cursor.ts`,
`editor/snapping/editorSnapping.ts`, plus `tests/presentation/designer/designerToolbar.test.ts`.

| # | Finding | What was done |
|---|---|---|
| F1 | **Blocking.** Edit points, Bend edges and Transform were all live on an open graphic and all three drew nothing — `selectionHandles` opens with `outlineOf`, which answers `null` for a path, so it returns `[]` in every mode. Reachable on the card's FIRST gesture, since `completeDetail` returns to Select with the new line selected | `DesignerSelectionModes` draws Transform ALONE for an open graphic. **Dropped, not `:disabled`** — AD10's accepted shape, stated in `DesignerArrangePanel.vue`'s own docblock. Transform stays because its gesture works (body drag, and the inspector's centre/size/rotate-by), and its tooltip now says which gesture that is: *"A line has no resize or rotate handles: drag it to move it, or set its centre, size and rotation in the fields below"* |
| F2 | **Blocking.** `draw-line` and `draw-rounded-rect` were absent from `PRECISE_TOOLS`, so both drew with the default cursor — the only two drawing tools on the surface without a crosshair, one of them literally the same `DrawDetailTool` class as `draw-rect` | Both added to `PRECISE_TOOLS`, and both added to the existing `it.each(['draw-rect', 'draw-circle', 'trace-detail'])` in `designerToolbar.test.ts`. That file's enumeration of the designer surface's ids was updated with them in the same edit |
| F3 | `DrawLineTool.landingPoint` honours Shift but `draw-line` was not in `CONSTRAINING_TOOLS`, so `AssetDesignerRoot`'s hint never appeared | One array entry. `draw-rounded-rect` deliberately stays OUT (`DrawDetailTool` constrains nothing, same as `draw-rect`), and a new case asserts BOTH directions. The list's docblock records the split |
| F4 | `DrawLineTool.finish` said *"the other two refusals"*; `validatePathPoints` has three arms and the docblock accounted for one that is not one of them, leaving `path-non-finite-coordinate` unnamed | All three named, with the call's own shape (points, no bulges) excluding `curve-edge-count` and the bulge-edge rules outright. `path-non-finite-coordinate` is stated as an ARGUMENT rather than a filter — the only refusal here that is — with the `clampZoom`/`constrainDrawingPoint`/snap chain it rests on, what it costs if wrong (`unwrap` throws inside a pointer handler where the sibling `DrawDetailTool` refuses gracefully), and why the branch was not bought. **The `path-degenerate` guard was NOT restored**; the reviewer confirmed its removal correct |
| F5 | `previewClosed`'s docblock undercounted `previewPolygon`'s readers | Corrected in the docblock and in ICR 4(a) above, both written from what `grep -rn previewPolygon src/` prints |
| F6 | C10 §3 credited this card with an `assetShapeConfig` source change it did not make | Reworded. `f1cbe86ef` (AD05) is an ancestor of the base and `assetShapeConfig.ts` is not in this diff — verified with `git merge-base --is-ancestor` and `git diff --name-only`. Only the test is new |
| F7 | `de/assetOpenLines.ts`'s `asset.extent-not-scalable` used Sie while the `asset.*` refusal family it joins (`de/assetArrange.ts`) uses du, and it carried a comma splice | Matched to **`de/assetArrange.ts`**, named in the file's docblock as what it was matched to — *"Entsperre es"*, *"Hebe diese zuerst auf"*, *"nimm es aus der Auswahl"*. Now *"Drehe sie oder verschiebe ein Ende"*, and the splice is closed with *"daher"*. The wider `editor.*` table stays Sie; the docblock says the repository is split and that the family is what a new string can be held to. The new `designer.selection.mode.transform.open` is du for the same reason. **Still machine-quality German**, unreviewed by a speaker |
| F8 | `roundedRect` at exactly half the shorter side is untested | **Not added, deliberately.** `CORNER_FRACTION` is `1/4`, no radius is stored and no caller can pass one, so the value is unreachable from the product in this build; `presetGeometry.test.ts` already pins the ceiling ABOVE it (*"is refused by the constructor above the half-side ceiling"*), which is the arm a wrong `CORNER_FRACTION` would cross. Adding it means a further edit to an out-of-lease file (ICR 2) for a boundary nothing can reach. **The trigger to add it is a caller that can choose the fraction** — the moment a radius becomes a parameter, exactly-half is the first case to write |

**Out of lease, found while fixing F1, not touched:** `AssetDesignerRoot.vue`'s `hintKey` answers
`designer.hint.shift-transform` for `isOutlineSelection(focused) && mode === 'transform'`, which is
true of an open graphic. Under Transform a path offers only a body drag, and that docblock itself
says *"a body, vertex, bend or anchor drag ignores [Shift]"* — so the hint advertises a modifier that
does nothing, the same defect shape as F1 one file over. `AssetDesignerRoot.vue` is on this task's
forbidden list and no lease was requested for it. The fix is one more condition on that computed.

## Also worth the integrator's attention

- **`src/domain/asset/arrangeDetails.ts` carries a paragraph this card made stale**, and it is a
  file AD11 may not touch. It reads: *"The two disagree about an OPEN graphic, and that is AD11's to
  reconcile rather than this module's… `selection/partExtent.ts`'s `outlineOf` answers `null` for a
  path, so every SINGLE-part gesture in the designer refuses a line outright."* AD11 reconciled it —
  `partMeasure` routes a detail through the same `detailBox` that module measures by — so the
  contradiction the paragraph describes no longer exists. Someone with that file's lease should
  shorten it.
- **`AD10-R1`'s mixed-selection refusal now applies to a kind that can exist.** A selection mixing a
  pending line with a measured graphic is refused by `arrangeDetails.participants` exactly as any
  other mix is; nothing here changes that, and nothing here tests it for the open arm specifically.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. This worker's completion statement is not this
field, and this task is **not verified**.
