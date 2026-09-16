# Opening handles — design

Date: 2026-09-16. Status: approved in chat (approach A; handles only, no readouts).

## Goal

A selected **opening** (`kind: 'door' | 'window' | 'opening'`) on the plan shows direct-manipulation
handles on its host wall, so its width, its position along the wall and — for a door or window — the
side of the wall its leaf swings to can all be changed by pointer without opening a form:

- two **width** grips, one at each edge of the opening;
- one **move** grip at its centre, dragged along the host;
- two **step** arrows, each nudging the opening along the host by a fixed amount;
- two **side** chevrons, one perpendicular to each wall face, each putting the leaf on that side.

The existing inspector form and the existing `move-opening` click-to-place tool both stay. Nothing
here is the only route to any edit.

## Out of scope

The dimension readouts in the reference screenshots — the width repeated on both wall faces with
extension lines, and the floating height/sill label — are **deliberately not built here**. Height
and sill stay in the inspector. This was asked and answered during brainstorming: handles first,
readouts as their own increment once the handles feel right.

## Decisions

1. **Approach A: extend the existing selection-target pipeline.** The editor already has this exact
   trio for items and placements — a pure geometry module (`elements/transformBox.ts`), a gesture
   class (`elements/ElementResize.ts`), and a `listening: false` drawing component
   (`elements/TransformBoxHandles.vue`) whose points `SelectTool` hit tests through
   `resolveSelectionTarget`. Openings get a second instance of that pattern rather than a new
   mechanism.

   Refused: a dedicated `edit-opening` tool, because a mode you must enter before each tweak is
   what direct manipulation exists to remove. Refused: real listening Konva nodes with their own
   handlers, because the interaction layer hears no pointer events by design (SDD §62) and that
   would put a second hit-testing authority on the canvas beside `SelectTool`.

2. **The transforms are DOMAIN functions, not view code.** They are rules about an `Opening`, so
   they live in `src/domain/spatial/openingGeometry.ts` beside `openingOffsetAt`. Only the handle
   LAYOUT is a view concern, because only the layout depends on screen pixels.

3. **One new `SelectionTarget` kind, carrying the grip as data** — not seven kinds and not four:

   ```ts
   | { readonly kind: 'opening-handle'; readonly id: string;
       readonly grip: 'width-start' | 'width-end' | 'move'
                    | 'step-back' | 'step-forward' | 'side-left' | 'side-right' }
   ```

   One branch in `resolveSelectionTarget`, one in `SelectTool`, one entry in `cursor.ts`'s
   `hoveredTargetKind` union. Seven kinds would multiply every one of those by seven for no
   behaviour the discriminator does not already carry.

4. **No model change.** `Opening` already carries `offset`, `width` and `swing`. Every handle writes
   fields that exist.

5. **No snapping on the drags, in this increment.** The step arrows already give exact 10 mm and
   100 mm movement, and snapping a one-dimensional along-wall drag to arbitrary world candidates
   fights the constraint more than it helps. Adding it later is a change at the offset level only.

6. **The handles are a FIFTH collaborator of `createStructureActions`, not an extraction.** See
   *Write path*. This decision replaces a wrong one — see *Amendment 1*.

## Domain transforms

In `src/domain/spatial/openingGeometry.ts`. Each answers a new `Opening`, or `null` for a proposal
that is not worth writing:

| Function | Rule | `null` when |
|---|---|---|
| `resizedOpening(opening, host, end, toOffset)` | The dragged edge moves to `toOffset`; the opposite edge holds still. `offset = min(fixed, moved)`, `width = abs(fixed − moved)` | width would be `0` or less, or the moved edge leaves `[0, wallLength(host)]` |
| `steppedOpening(opening, host, deltaMm)` | `offset + deltaMm`, clamped to `[0, wallLength(host) − width]` | the clamp leaves the offset unchanged |
| `flippedOpening(opening, side)` | `{ ...opening, swing: { ...openingSwing(opening), side } }` | `opening.kind === 'opening'` — there is no leaf to flip |

`flippedOpening` relies on `openingSwing()` materialising the default swing
(`{ hinge: 'start', side: 'left', angle: 90 }` for a door) for an opening that stored none. That is
correct here and is a deliberate exception to that function's "reading an old opening never
materializes new fields" docblock: pressing the chevron IS the user choosing a side, so the write is
the user's, not a read's side effect.

Overlap with neighbouring openings is NOT checked in these functions. It stays
`openingValidationError`'s job at the call site, exactly as `openingMove.ts` already asks it — one
definition of when an opening is legal.

## Handle layout

In `src/presentation/editor/structure/openingHandles.ts`. Given the `Opening`, its host `Wall` and
the camera's `worldPerScreenPixel`, it answers the world points of the marks that should be drawn
AND hit — one function, so what lights up under the pointer is always what a press will act on.

**On the centre-line**, at width fractions `0`, `1/4`, `1/2`, `3/4`, `1`, through the existing
`alongWall(host, opening.offset + f * opening.width)`. Reading them off the host's own arc means a
curved wall is free rather than a special case.

**The chevrons** sit perpendicular to the centre-line, using the same normal and sign convention
`openingSymbol` already uses for the leaf (`normal = { x: tangent.y, y: -tangent.x }`, and `left` is
`+1`). That fixes both signs: the `side-left` chevron is at `+(wallSideExtents(host).a + gap)` and
the `side-right` one at `-(wallSideExtents(host).b + gap)`. Reusing that convention rather than
restating it is what guarantees a chevron is always drawn on the side its `left`/`right` value
means — the two would otherwise be free to disagree, silently and only on some wall headings.

**Crowding.** Five marks on a narrow opening at low zoom is a pile of overlapping targets, so:

- the step arrows are dropped when adjacent mark centres would be under `2 * VERTEX_GRAB_RADIUS_PX`
  apart in screen pixels;
- everything but the move grip is dropped when the two EDGE marks are that close.

The chevrons are never dropped by this rule — they are off the centre-line and cannot collide with
it. They are absent for `kind: 'opening'`, which has no leaf.

Two new constants in `handleMetrics.ts`, which is the one place a screen-pixel number is declared:
`OPENING_HANDLE_RADIUS_PX` and `OPENING_CHEVRON_GAP_PX`. They belong there and the step distances do
NOT: those are world millimetres, and that module's own header is explicit that every number in it
is a screen pixel at every zoom.

The step arrows therefore reuse `NUDGE_STEP_MM` (10) and `NUDGE_STEP_SHIFT_MM` (100) where they
already live, in `surface/keyboard.ts` — both are currently module-private and this increment
exports them. Exporting two constants beats a new module for two numbers, and it is what makes a
step arrow and an arrow key move an opening by the same amount rather than by two numbers that
happen to agree today. A step arrow pressed with Shift takes the 100 mm step, exactly as Shift does
for an arrow key.

## Interaction

**When handles show** — exactly one selected element and it is an opening; Plan perspective; the
`select` tool active. **When a handle WRITES** is a second, stricter question, and it is
`createStructureActions`'s own `geometryUnavailable` that answers it — no other structure edit in
flight, writes not blocked, the save state not `saving`, no dialog open, Plan perspective — reused
rather than restated, exactly as the other four collaborators reuse it. The two questions are
deliberately separate: a handle stays drawn while a write is landing, so the user is not shown the
selection losing its affordances for the length of a save.

**Taps and drags split at the press.** The four arrow grips (`step-*`, `side-*`) commit on
pointer-down and start no gesture. The three circle grips (`width-*`, `move`) start a drag in
`structure/OpeningResize.ts`, shaped like `ElementResize`: a press is not yet an edit, travel past
`CLICK_EPSILON_PX` starts one, the last valid proposal stays previewed when a drag goes somewhere
illegal, and the release commits.

**A drag previews from `projectStore.structure`, synchronously.** The baseline snapshot is needed
for the WRITE, not for the picture, and waiting on an async read before drawing the first preview
frame would make the handle feel detached from the pointer. The preview is therefore optimistic and
the write is still guarded; a baseline that turns out stale refuses the write exactly as it does
today, which is the same asymmetry `openingMove.ts` already lives with.

**Pressing the chevron for the side the leaf is already on is a permitted no-op.** It costs nothing
to allow because the write path already refuses an unchanged document through
`sameGeometryDocument`. Disabling it would be a second state to draw and a second rule to test for
no gain.

## Write path

`createStructureActions` already owns a guarded-write kit and already SHARES it:
`prepareBaseline` (which refuses a snapshot the projection has moved past, through
`staleWriteRefusal`), `reviewedWrite` (preview plus a dispatch that refuses once blocked), and
`unavailable` / `geometryUnavailable`. Four collaborators take that bundle today —
`createWallRotationActions`, `createStructureBulkEdit`, `createWallPointAction` and
`createWallThicknessActions` — and one of its own methods, `moveOpeningToPoint`, is already an
opening write gated on the `select` tool and a single selection.

The handles are a **fifth collaborator**, `structure/openingHandleActions.ts`, taking the same
bundle. `createWallPointAction` is the template to copy: ~40 lines, `active` set around the await,
`prepareBaseline` on the read, the transform against the BASELINE's structure rather than the
store's, `reviewedWrite(...).dispatch(next)`, `notifyOperationFailure` on a refusal,
`notifyFault` on a throw, `active` cleared in `finally`.

`openingMove.ts` and its `move-opening` tool are **not touched by this increment**.

Validation failures keep flowing `openingValidationError` → `spatialMessage`, so this increment adds
no user-facing string and no new locale key.

## Amendment 1 — the write path was designed twice

The first version of Decision 6 and this section called for extracting `openingMove.ts`'s guarded
cycle into a new `structure/openingEdit.ts`, with `openingMove.ts` rewritten as its first caller,
and named that the riskiest edit in the increment. It was written from `openingMove.ts` alone.

It was wrong, and wrong in the expensive direction: `createStructureActions` already had the
extraction, already had four collaborators using it, and already had an opening write among its own
methods. The proposed work would have built a second sharing mechanism beside an existing one and
rewritten a working module to reach it.

Recorded rather than quietly replaced, because the failure is reusable: the module the task names
is not the boundary the answer lives at, and reading only that module is how you end up extracting
something the codebase had already extracted. The cost of the mistake here was zero because it was
caught while writing the plan; the note is so the next reader spends the search instead.

## Files

New:

- `src/presentation/editor/structure/openingHandles.ts` — layout and crowding.
- `src/presentation/editor/structure/OpeningResize.ts` — the drag gesture.
- `src/presentation/editor/structure/openingHandleActions.ts` — the fifth `createStructureActions` collaborator.
- `src/presentation/editor/structure/OpeningHandles.vue` — drawing, screen pixels, `listening: false`.

Edited:

- `src/domain/spatial/openingGeometry.ts` — the three transforms.
- `src/presentation/editor/handleMetrics.ts` — two constants.
- `src/presentation/editor/selection/resolveSelectionTarget.ts` — the new target kind.
- `src/presentation/editor/tools/select-tool.ts` — one branch dispatching taps and drags.
- `src/presentation/editor/surface/cursor.ts` — the cursor for the new kind.
- `src/presentation/editor/layers/InteractionLayer.vue` — mount `OpeningHandles`.
- `src/presentation/editor/structure/structureActions.ts` — construct and return the fifth collaborator.

`select-tool.ts` is near its 400-line budget (`max-lines`, blanks and comments skipped). If the new
branch crosses it, the branch moves to its own module rather than the budget moving.

## Testing

Node tests carry the weight, because the parts that decide anything are pure:

- the three domain transforms, every refusal arm with its own case (coverage floors are
  99/99/99/98 — an untested arm in a tight metric fails outright and one in a slack metric hides);
- `openingHandles.ts`: fraction placement on a straight host and on a curved one, the chevron sides
  against `openingSymbol`'s own convention, and both crowding thresholds at and either side of the
  boundary.

Then:

- `resolveSelectionTarget`: the new kind resolves at `resizeAt`'s priority, only for a single
  selected opening, and Alt still bypasses it to cycle bodies;
- `OpeningResize`: the gesture test mirroring `ElementResize`'s — a press below the click epsilon
  writes nothing, travel past it previews, an illegal drop keeps the last valid preview;
- `OpeningHandles.vue` (jsdom): a door draws seven marks (two width, one move, two step, two
  chevrons), a `kind: 'opening'` five (no chevrons), and a crowded door three — the move grip plus
  its two chevrons, since crowding drops only centre-line marks;
- `openingHandleActions`: a refused transform dispatches nothing, a stale baseline refuses through
  `prepareBaseline`, and `active` is cleared after a throw.

**What no automated gate here can see.** `?view=plan-editor` in the browser harness runs without
renovation services, so `npm run harness-shot` can show the handles DRAWN and positioned at a real
layout — worth capturing, since spacing and hit size are measurements no layout engine in this
repository performs — but cannot show a handle WRITING. That half is a manual case under
`docs/tests/cases/`, written as part of this increment and run in a live vault. An unrun manual case
is a plan to find out, not a finding, so its Runs table says so until someone runs it.
