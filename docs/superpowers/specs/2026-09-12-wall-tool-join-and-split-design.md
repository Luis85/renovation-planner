# Wall tool — join into a wall and split it

**Date:** 2026-09-12
**Source:** the wall tool as of `main` at `5dfb0725`, whose "New wall from here" context action
(pull request #142) lets a chain START on a wall and cuts the host at save. This increment lets a
chain END on a wall the same way, and lets the tool's own click start one.
**Baseline:** `main` at `5dfb0725`.
**Status:** implemented by `docs/superpowers/plans/2026-09-12-wall-tool-join-and-split.md`

## 1. What this increment delivers

A renovator has drawn the outer walls of a flat and wants a partition. With the wall tool active
they click on the left wall's body, drag across the room and click on the right wall's body. The
partition appears joined to both walls, each host cut at the join so that the T is two walls
meeting end to end, which is the only junction the domain permits (`wallsConflict`). The chain
saves the moment the second click lands, as one undo step, and the tool returns to Select.

While the cursor nears a wall's body the form says which wall it would join and where, and a cut
mark on the canvas shows where the host would be cut. When the foot of the perpendicular from the
previous point is within reach, the cursor lands there, so a partition meets its host at a right
angle without a modifier key. Shift keeps its 15° constraint, exactly.

## 2. Today's gap

- `snapWallPoint` (`src/presentation/editor/structure/structureDraft.ts`) snaps to wall ENDPOINTS
  and to the previous point's axes only. A cursor on a wall's body is a free point.
- `validateStructure` refuses a T junction (`spatial.intersection`), so a chain whose last point
  lands on a wall body is refused at save.
- A chain can start on a wall only through the canvas context menu (`task.drawFrom`), which
  records one `WallSplit` on the draft (`draft.split`) that `drawnOn` applies while the chain
  still starts at the cut. There is no end counterpart.

## 3. Join resolution (domain)

New pure module `src/domain/spatial/wallJoin.ts`, node-tested, no Vue.

```ts
export interface WallJoin { readonly wallId: string; readonly offset: number; readonly point: Point; readonly perpendicular: boolean }
export interface JoinQuery { readonly walls: readonly Wall[]; readonly point: Point; readonly tolerance: number; readonly from?: Point; readonly ray?: Point }
/** The wall body the cursor lands on, or null: an endpoint (`offset` 0 or the length) is not a join. */
export function resolveWallJoin(query: JoinQuery): WallJoin | null;
```

Candidates, in priority:

1. **Endpoint** within `tolerance` — answered as today by the draft's endpoint snap and NOT by
   this function: the resolver returns `null` when its best candidate lies within `tolerance` of
   the wall's start or end, so the caller's endpoint snap wins and no cut is recorded. This is the
   same rule `wallStart` applies (an offset within tolerance of an end is the end).
2. **Perpendicular foot**: `projectOntoWall(wall, from)` when `from` is given, the foot is
   strictly inside the span, and the foot is within `tolerance` of `point`. On an arc the
   projection is radial, so the same call answers a curved wall. `perpendicular: true`.
3. **Nearest point** on any wall body within `tolerance` of `point`, the closest wall winning.
   `perpendicular: false`.

With `ray` given (Shift held: `from` is the anchor and `ray` the constrained point), candidates 2
and 3 are replaced by the intersection of the ray `from → ray` with the wall, via
`circularEdgeIntersections` over a segment from `from` through `ray` extended by `tolerance`, so
the constrained angle stays exact. An intersection within `tolerance` of `point` wins; otherwise
`null`.

`offset` is rounded to whole millimetres and `point` is `alongWall(wall, offset)`, so the point a
join records is exactly the point `splitWall` will cut at.

The resolver does not look at openings: a join inside an opening is refused by `splitWall`
(`opening-split`) when the draft applies it, which is the click's refusal (§5).

## 4. Draft model (`structureDraft.ts`)

`split: WallSplit | null` becomes:

```ts
joins: { start: WallSplit | null; end: WallSplit | null }
pending: WallJoin | null   // the join under the cursor, from pointerMove; null when none
```

- `drawnOn(draft, points, existing)` applies `joins.start` while `points[0]` equals its point,
  THEN `joins.end` while `points.at(-1)` equals its point, each through `splitWall`. Sequential
  application is what makes two cuts on ONE wall correct: the end join is resolved (§5) against
  the floor with the start cut already applied, so it names whichever half it falls on.
- `startFromWall` is unchanged in behaviour and writes `joins.start`. `wallStart` and
  `wallStartRefused` stay for the context menu.
- New `endOnWall(draft, existing, join)`: resolves the split id, records `joins.end` and adds the
  point through `addWallPoint`; on refusal sets `draft.error` and records nothing.
- `snapWallPoint` keeps its signature for endpoint and axis snapping and gains nothing; the tool
  composes it with `resolveWallJoin` (§5). It is the ENDPOINT snap that runs first.
- `mintStructure` and `wallsFromDraft` are unchanged; a cut half keeps its minted id from
  `wallStart`/`endOnWall`.

If the file crosses the 400-line budget, the join half (`WallSplit`, `drawnOn`, `wallStart`,
`startFromWall`, `endOnWall`, `wallStartRefused`) moves to `wallJoinDraft.ts` beside it, with
`structureDraft.ts` re-exporting nothing: callers import from the module that owns the function.

## 5. Tool behaviour

`StructureTool.pointerMove` (draw-wall only):

1. `constrainDrawingPoint` as today.
2. `snapWallPoint` as today. If it snapped to a CANDIDATE POINT (an endpoint or a previous
   point), `pending = null` and done.
3. Otherwise `resolveWallJoin({ walls, point: constrained, tolerance, from: points.at(-1),
   ray: shift ? constrained : undefined })`. A join sets `cursor` to its point, `snapped = true`,
   `pending = join`. None leaves the axis-snapped result and `pending = null`.

`StructureTool.pointerDown` (draw-wall, primary, not blocked):

- `pending` null: `addWallPoint` as today.
- `pending` set and no points: `startFromWall(draft, structure, pending.wallId, pending.point,
  tolerance)`; the chain continues.
- `pending` set and points exist: `endOnWall(draft, structure, pending)`; on success
  `deps.finish()`. A refusal (opening-split, intersection, dimensions) leaves the chain and shows
  the error in the form as today.

Numeric entry (`structureTask.addNumeric`): the computed point is resolved with
`resolveWallJoin({ walls, point, tolerance: 1 })` — one millimetre, since typed geometry is
whole-millimetre. A join with no points is a start; with points it is an end and auto-finishes.

`undoPoint`, `editCorner(-1, null)` and `cancel` clear `joins.end` (and `joins.start` when the
first point goes). `stop` resets the whole draft as today.

`closeLoop` never joins: the first point wins.

The context menu's `drawFrom` is unchanged and shares `startFromWall`.

## 6. Feedback

**Form** (`StructureTaskForm.vue`): the snap status line reads, in order of precedence,
`editor.structure.joins-perpendicular` ("Joins wall {n} at {m} m, at a right angle") when
`pending?.perpendicular`, `editor.structure.joins` ("Joins wall {n} at {m} m") when `pending`,
else the existing snapped/unsnapped text. `{n}` is the wall's 1-based index in
`project.structure.walls`, the numbering `removalSummary` already uses; `{m}` is
`formatMetres(offset)`. English and German.

**Overlay** (`WallDraftOverlay.vue`): a new prop `cuts: readonly { point: Point; tangent: Point;
thickness: number }[]`. Each draws a `VLine` named `wall-draft-cut` across the host: centred on
`point`, perpendicular to `tangent`, length `thickness + 16 / zoom`, stroke `tokens.accent`,
`2 / zoom`, `listening: false`. `StructureLayer.vue` computes the list from `joins.start`,
`joins.end` and `pending` (deduplicated by point) with `wallTangent(wall, offset)` and the host's
thickness, and passes it only while `draw-wall` is active.

**Preview**: `draftStructure(draft, existing)` for `draw-wall` builds on the floor with the
draft's cuts applied (through `drawnOn`; a refused cut falls back to `existing`), so
`drawnStructure.ts` needs no change and the host renders as two halves meeting the new wall while
drawing. Openings and boundaries follow the cut exactly as they will at save.

## 7. Errors and refusals

| Case | Where refused | User sees |
|---|---|---|
| Join inside an opening | `splitWall` → `endOnWall`/`startFromWall` | `editor.structure.error.opening-split`, reworded to cover start AND end |
| Chain returns to the same straight wall | `validateStructure` (collinear overlap) | existing `intersection` message |
| End point equals the previous point | `addWallPoint` | existing `wall-dimensions` |
| Stale floor at save | `StructureCommand` | existing conflict handling |

Nothing cuts until the write succeeds. Cancelling the tool cuts nothing. One history step.

## 8. Decisions recorded

1. Joins at the START and END of a chain only; an intermediate corner never cuts (option 3 of the
   first brainstorm question, refused: it needs a per-point split list for a case not in hand).
2. Snap priority endpoint → perpendicular foot → nearest body point; Shift intersects the ray.
3. A click landing on a wall body with points already placed auto-finishes; the first click does
   not. Continuing past a joined wall would cross it, which the domain refuses anyway.
4. Feedback is the status line plus a canvas cut mark, and the preview draws the host pre-cut.
5. Numeric points join at 1 mm tolerance.

## 9. Not delivered

- Intermediate points joining a wall; a chain crossing an existing wall mid-segment.
- Any change to the canvas context menu beyond sharing `startFromWall`.
- Snapping to a wall body for the opening tools (they already project onto the host).

## 10. Tests

- `tests/domain/spatial/wallJoin.test.ts`: each candidate, priority among them, an endpoint
  within tolerance answering null, the Shift ray on a straight and a curved wall, the 1 mm
  rounding, a far cursor answering null.
- `tests/domain/spatial/splitWall.test.ts`: two sequential cuts on one wall, the second naming
  the correct half.
- `tests/presentation/editor/structureDraft.test.ts`: `endOnWall` records and applies the end
  cut, a popped last point drops it, an opening refusal, start and end on the same wall.
- `tests/presentation/editor/structure/StructureTool.test.ts`: start by click, end by click with
  `finish` called once, a refused end not finishing, `pending` cleared by an endpoint snap.
- Form and overlay cases: the status line text per state; a `wall-draft-cut` line per cut.
- `drawnStructure`: the preview's host is two walls while a start or end join is recorded.
- The mark's look is checked by drawing in the browser harness at `?view=plan-editor&reference` (Task 9 of the plan); no fixed headless shot, since neither harness fixture seeds walls AND structure services together. That check found the tick indistinguishable from the draft segment at a right angle — see the increment history's "Wall joins" section.
