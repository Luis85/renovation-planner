# Smart alignment guides while dragging on the plan canvas

**Date:** 2026-09-13
**Baseline:** `main` at `31fb0c3f`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-13.
Where this document and the SDD disagree, the SDD is the authority (§19 interaction layer,
§21 snapping architecture; interaction spec §22–23).

## 1. What this delivers

While a renovator drags a zone, a zone vertex, an element or a draw-tool cursor, the editor
snaps it into alignment with existing geometry and draws a dashed guide that says why: a
corner landed on a corner, a point landed on an edge, or an edge or centre lined up with a
neighbour's on the x or y axis. The guides are transient, drawn only while the gesture is
live, and honoured by the commit exactly as by the preview.

What exists today, and what is wrong with it:

| Fact | Where |
| --- | --- |
| `SnapService.snapPoint` snaps to vertices and edges only; no axis alignment anywhere | `snapping/snap-service.ts` |
| `SnapGuides.vue` draws a dashed segment plus a target dot, fed only by the draw-room tool | `layers/SnapGuides.vue`, `tools/draw-room-tool.ts` |
| A zone body move and a vertex drag snap against an EMPTY candidate set | `tools/select-tool.ts` (`snapPoint(anchor, {})`) |
| The select tool's drag preview never snaps; only the release does | `select-tool.ts` `pointerMove` translates raw, `pointerUp` snaps |
| `ElementMove` and `draw-polygon-tool` snap against `{}` too | `elements/ElementMove.ts`, `tools/draw-polygon-tool.ts` |
| A per-leaf Snap toggle exists, persisted, in the view menu and status bar | `editorViewPreferencesStore.ts`, `EditorViewMenu.vue`, `StatusBar.vue` |

The snap service's own docblock says a tool calls the same function on `pointerMove` and
`pointerUp` "so a drag's preview can never drift from what actually gets committed". The
select tool does not, and this increment makes that sentence true.

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| Kind of guideline | **Smart guides**: automatic while dragging. No user-placed guidelines. |
| What lines up with what | **Point snap first, then axis alignment.** A vertex within tolerance of a vertex wins outright, then a point on an edge, then the dragged item's box edges and centre line up with neighbours' vertices and centres on x and y independently. |
| Which gestures | **Every positional gesture**: zone body move, zone vertex drag, element body move, element vertex drag, the draw-room rectangle, the polygon and element drawing cursors. |
| Activation | **The existing Snap toggle.** Guides are what snapping looks like when it fires. No new preference, control or locale string for a toggle. |
| Rendering | **The existing `SnapGuides.vue`, unchanged.** A guide runs from the snapped feature to the neighbour feature it matched, dot at the neighbour end. |
| Where it lives | **`SnapService`, extended in place.** One service, one precedence, one candidate supply. A second alignment service beside it was refused. |

## 3. Snap service

`snapping/snap-service.ts`. Nothing here reads a store, a repository or a Konva node; that
constraint is unchanged.

### 3.1 Candidates

`SnapCandidates` gains one optional field:

```ts
readonly alignments?: readonly Point[];
```

Every point whose x or y is worth lining up with. The set is supplied by the caller, as
vertices and edges are today (§4).

### 3.2 `snapPointWithGuides`

```ts
snapPointWithGuides(point, candidates, toleranceMm = config.toleranceMm): { point: Point; guides: LineSegment[] }
```

Precedence, not nearest-wins, as `snapPoint` already documents:

1. **Vertex** within tolerance: answer it, one guide from `point` to the vertex.
2. **Edge** within tolerance: answer the clamped projection, one guide from `point` to it.
3. **Axis alignment**, x and y decided independently: the alignment whose x is nearest
   `point.x` within tolerance sets the answer's x; likewise y. One guide per axis that fired,
   from the answered point to the alignment point it matched. Both may fire, giving two
   guides and a point that moved on both axes.
4. Otherwise `point`, no guides.

A disabled service (`enabled === false`) answers `point` with no guides at every stage.

`snapPoint` becomes `this.snapPointWithGuides(point, candidates, toleranceMm).point`. Its
signature and every existing test are unchanged.

### 3.3 `snapTranslation`

```ts
snapTranslation(moving: readonly Point[], candidates, toleranceMm = config.toleranceMm): { correction: Vector; guides: LineSegment[] }
```

For a body move: the caller translates the original polygon by the raw pointer delta and hands
the translated points in; the answer is the extra correction to apply to every point, so a
move stays a translation and can never deform the shape (the select tool's own comment on why
it snaps one vertex rather than each).

Features of the moving set: its vertices, plus the six box features (min x, max x, centre x,
min y, max y, centre y) computed with `extentOf` from `core/geometry/operations.ts`.

1. **Vertex stage**: the nearest (moving vertex, candidate vertex) pair within tolerance wins
   outright. Correction is that pair's vector; one guide from the moving vertex to the
   candidate.
2. **Edge stage**: the nearest (moving vertex, candidate edge projection) pair within
   tolerance; same shape of answer.
3. **Axis stage**, per axis independently: the smallest |delta| between any moving feature
   coordinate and any alignment coordinate within tolerance. Correction on that axis is that
   delta; one guide per axis from the moving feature (at the moved position) to the
   alignment point.
4. Otherwise zero correction, no guides.

Ties resolve to the first candidate in iteration order, the same deterministic-but-arbitrary
rule `nearestWithinTolerance` already pins.

### 3.4 Tolerance

The configured 8 mm default stays for the asset designer, which composes
`EDITOR_SNAP_SERVICE` and is not touched. Every Plan Editor caller passes
`8 * context.viewport.worldPerScreenPixel()`, which the draw-room and element tools already
do and the select tool does not (8 mm at any zoom is effectively no snap).

## 4. Candidate supply

### 4.1 `roomSnapCandidates`

`snapping/roomSnapCandidates.ts` grows two things:

- an `alignments` list in its answer: every zone vertex, every zone's box centre
  (`extentOf` over the zone's points), every wall endpoint, every element point;
- an `exclude: ReadonlySet<EntityId>` parameter. A zone or element whose id is in the set
  contributes nothing, so a dragged item never snaps or aligns to itself. Walls and openings
  are never excluded by this increment because nothing here drags one (§6).

The zone type it takes today names only `points` and `bulges`; it widens to require `id` as
well, which the store's zones already carry. The one caller is `registerEditorTools.ts`.

### 4.2 `EditorContext.snapCandidates`

`tools/editor-context.ts` gains:

```ts
readonly snapCandidates: (exclude?: Iterable<EntityId>) => SnapCandidates;
```

Built in `registerEditorTools.ts` from the project store, replacing the draw-room-only
`roomCandidates` computed there. Memoised on the store's zones and structure as that computed
is today; the exclusion filter runs per call over the memoised full set, which is a linear
pass over a plan's vertices and is not a cost worth a second cache.

The designer's `createEditorContext` call in `designer/runtime.ts` supplies
`() => ({})`, so its tools keep snapping against nothing, as today.

`DrawRoomTool` and `ElementTool` drop their own `snapCandidates` / `candidates` deps and read
`context.snapCandidates()` instead: one supply, not three.

## 5. Rendering

No new component. Callers write guides to `renderState.snapGuides`; `SnapGuides.vue` draws
them as it does now: dashed accent line, dot at `end`. Every guide this design produces has
the neighbour feature at `end`, so the dot marks what was matched.

Guides are cleared on every `pointerMove` before recomputing, and on gesture end, cancel,
`abandonGesture` and tool deactivate. `RenderState.reset()` already clears the field on a
tool switch.

`TemporaryToolBanner.vue`'s `showSnapHint` is gated on `activeToolId === 'draw-room'`. It
widens to `snapGuides.length > 0` for any tool, since the hint's text describes the guide and
not the tool.

## 6. Callers

| Site | Change |
| --- | --- |
| `select-tool.ts` body move | `pointerMove` and `pointerUp` both translate the original by the raw delta, then apply `snapTranslation(translated, snapCandidates([zoneId]), tol).correction`. The preview polygon written on move IS the polygon committed on release. |
| `select-tool.ts` vertex drag | `snapPointWithGuides(event.worldPoint, snapCandidates([zoneId]), tol)` on both move and release. |
| `elements/ElementMove.ts` body | `snapTranslation`, element id excluded. |
| `elements/ElementMove.ts` vertex | `snapPointWithGuides` after the existing Shift constraint, element id excluded. |
| `tools/draw-room-tool.ts` | `snapPointWithGuides` with `context.snapCandidates()`; its own `snapGuides.push` goes, the service's guides replace it. |
| `tools/draw-polygon-tool.ts` `landingPoint` | `snapPointWithGuides` with real candidates and scaled tolerance; the docblock's "unobservable today" sentence is rewritten since it becomes observable. |
| `elements/ElementTool.ts` | `snapPointWithGuides` with `context.snapCandidates()`. |

Left alone, deliberately:

- `structure/StructureTool.ts`: walls have their own `snapWallPoint` with an axis snap and
  a wall-join resolution that must yield to it. Folding that into the shared stage is its
  own design.
- `elements/ElementRotation.ts`: an angle, not a position; `snapRotation` is unchanged.
- `elements/AssetPlacementTool.ts`: wall-hosted placement through `placementAt`.
- `designer/tools/set-anchor-tool.ts`: the designer supplies no candidates (§4.2), so its
  `snapPoint(…, {})` stays the identity.

The Shift angle constraint keeps its current order everywhere it exists: constrain, then
snap.

## 7. Testing

Every case is watched red before the change that makes it green.

- `tests/presentation/editor/snapping/snapService.test.ts`:
  - `snapPointWithGuides`: vertex beats a nearer alignment; edge beats alignment; x and y
    align independently and both may fire; a point inside tolerance on neither axis answers
    itself with no guides; a disabled service answers the input with no guides; `snapPoint`
    still equals `.point`.
  - `snapTranslation`: a vertex pair wins over a closer axis alignment; the correction is one
    vector for all points (the answer is never a per-point result); a box centre aligns to a
    neighbour's centre; the moving set's own points are not in the candidates (asserted at
    the caller, below) and a moving set with no candidates answers zero.
- `tests/presentation/editor/tools/roomSnapping.test.ts`: `alignments` carries zone
  vertices, box centres, wall endpoints and element points; an excluded id contributes
  nothing.
- `tests/presentation/editor/tools/selectTool.test.ts`: during a body drag,
  `renderState.previewPolygon` equals the polygon the dispatched command carries on release
  (the invariant the service docblock claims); a guide appears in `snapGuides` mid-drag when
  a neighbour is within tolerance and is empty after release, cancel and tool switch; the
  dragged zone is passed as the exclusion.
- One case each in `drawRoomTool.test.ts`, `drawPolygonTool.test.ts` and the element move
  tests that guides appear and clear.
- `tests/presentation/editor/tools/editorContext.test.ts`: the new field is threaded.
- `tests/helpers/tool-context.ts` subclasses the real `SnapService` and needs no change
  beyond a `snapCandidates` stub answering `{}`.
- Harness: `npm run harness-shot` with a mid-drag guide is not capturable (no pointer in a
  fixed shot). One manual case, `docs/tests/cases/Alignment guides while dragging.md`,
  written with an empty Runs table and stated as unrun.

Coverage: the axis stage adds branches in a tight metric; `coverage-final.json` for
`snap-service.ts` and `select-tool.ts` is read after the run, not the summary line.

## 8. Deferred

Named here so they are not rediscovered as omissions:

- Full-extent guide lines spanning both items (Figma style) rather than feature to feature.
- Equal-spacing guides between three or more items.
- A separate alignment tolerance or an "alignment guides" toggle as a tier-4 setting.
- Wall drawing joining the shared alignment stage (§6).
- A modifier key to suppress snapping for one gesture.
