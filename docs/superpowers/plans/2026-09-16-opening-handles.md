# Opening handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A selected door, window or opening on the plan canvas shows handles that change its width, slide it along its host wall, step it by a fixed distance, and put a door or window leaf on either wall face — with no form and no mode switch.

**Architecture:** A second instance of the editor's existing handle pattern. A pure layout module answers the world points that are both drawn and hit; `resolveSelectionTarget` resolves a press on one into a typed target; `SelectTool` dispatches taps straight to a write and circles into a drag gesture; a `listening: false` Konva component draws them. The write goes through `createStructureActions`'s existing guarded-write kit as a fifth collaborator, exactly as `createWallPointAction` does.

**Tech Stack:** TypeScript, Vue 3 `<script setup>` SFCs, `vue-konva`, Pinia, Vitest (node + jsdom).

**Spec:** [`docs/superpowers/specs/2026-09-16-opening-handles-design.md`](../specs/2026-09-16-opening-handles-design.md) — read it before Task 1. Amendment 1 in that document records a write-path decision that was made and then reversed; the plan below follows the amended decision.

## Global Constraints

Copied from `CLAUDE.md` and the spec. Every task's requirements implicitly include this section.

- **Definition of done is `npm run check`** (build + lint + coverage-thresholded tests + fallow). Between edits use `npm run check:fast -- <paths>`; run the full gate in CI on the pull request, not locally, so parallel sessions do not thrash `coverage/`.
- **Layering:** `presentation → application → domain → core`. `domain/` and `core/` may not name `vue`, `pinia`, `konva` or `obsidian`. Enforced by `no-restricted-imports`; a violation fails lint.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches) and only ever rise. Every refusal arm added in this plan needs a case; one branch is ~0.035pp, below what the summary line prints, so a figure that did not move is not evidence that nothing moved.
- **`max-lines` is 400** per `src/**` file (blanks and comments skipped), `max-lines-per-function` 100, `complexity` 16.
- **No literal user-visible strings** at the six call sites `I18N_LITERAL_BAN` guards, and no bare string literal or `.message`/`.stack` read as a direct argument to `notify`/`notifySuccess`/`notifyWarning`/`new Notice`. This increment adds **no new locale key** — every message it can produce already exists.
- **No hard-coded colours in CSS**; use an Obsidian CSS variable (SDD §84). This increment adds no stylesheet partial — the handles are Konva shapes taking `ThemeTokens`.
- **Nothing writes to the vault outside `infrastructure/`.** All writes here go through `context.commands.structure`.
- **A comment stating an invariant gets a test that fails without it**, and the test is watched failing before the fix is restored.
- **Attribution:** end every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/spatial/openingGeometry.ts` *(modify)* | The three pure transforms: `resizedOpening`, `steppedOpening`, `flippedOpening`. |
| `src/presentation/editor/handleMetrics.ts` *(modify)* | Two new screen-pixel constants. |
| `src/presentation/editor/surface/keyboard.ts` *(modify)* | Export the two step distances it already declares. |
| `src/presentation/editor/structure/openingHandles.ts` *(create)* | Where the marks are, and which of them are drawn at this zoom. |
| `src/presentation/editor/structure/openingHandleActions.ts` *(create)* | The guarded write: read a baseline, transform, validate, dispatch. |
| `src/presentation/editor/structure/structureActions.ts` *(modify)* | Construct and re-export that fifth collaborator. |
| `src/presentation/editor/selection/resolveSelectionTarget.ts` *(modify)* | The `opening-handle` target kind. |
| `src/presentation/editor/surface/cursor.ts` *(modify)* | The cursor for that kind. |
| `src/presentation/editor/structure/OpeningResize.ts` *(create)* | The width/move drag gesture. |
| `src/presentation/editor/tools/select-tool.ts` *(modify)* | Supply the handles to the resolver; dispatch taps and drags. |
| `src/presentation/editor/tools/registerEditorTools.ts` *(modify)* | Pass the new deps to `SelectTool`. |
| `src/presentation/editor/runtime.ts` *(modify)* | Wire the actions into `registerEditorTools`. |
| `src/presentation/editor/structure/OpeningHandles.vue` *(create)* | Draw them. |
| `src/presentation/editor/layers/InteractionLayer.vue` *(modify)* | Mount the component. |

---

### Task 1: The three domain transforms

**Files:**
- Modify: `src/domain/spatial/openingGeometry.ts`
- Test: `tests/domain/spatial/openingGeometry.test.ts`

**Interfaces:**
- Consumes: `Opening`, `OpeningSwing`, `Wall`, `wallLength` from `./Structure`; `openingSwing` from `./openingSwing` — all already imported by this file.
- Produces:
  - `resizedOpening(opening: Opening, host: Wall, end: 'start' | 'end', toOffset: number): Opening | null`
  - `steppedOpening(opening: Opening, host: Wall, deltaMm: number): Opening | null`
  - `flippedOpening(opening: Opening, side: OpeningSwing['side']): Opening | null`

Background you need: an `Opening` is stored **host-relative** — `offset` is millimetres from the host wall's start along its centre-line, `width` is millimetres along the same line. It never stores world points. `wallLength(host)` is the host's arc length.

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/spatial/openingGeometry.test.ts`. Add `resizedOpening, steppedOpening, flippedOpening` to the existing import from `../../../src/domain/spatial/openingGeometry`, and `type OpeningSwing` to the existing import from `../../../src/domain/spatial/Structure`. The file already declares `wall` (4000 mm long, horizontal) and `door` (`offset: 800, width: 900`) at the top — reuse both.

```ts
it('moves one edge of an opening and holds the other still', () => {
	const wider = resizedOpening(door, wall, 'start', 500);
	expect(wider).toEqual({ ...door, offset: 500, width: 1200 });
	const narrower = resizedOpening(door, wall, 'end', 1200);
	expect(narrower).toEqual({ ...door, offset: 800, width: 400 });
	// Dragging one edge past the other is a flip, not a negative width: the edges swap roles.
	const flipped = resizedOpening(door, wall, 'start', 2000);
	expect(flipped).toEqual({ ...door, offset: 1700, width: 300 });
});

it('refuses a width edit that collapses the opening or leaves the host', () => {
	expect(resizedOpening(door, wall, 'start', 1700)).toBeNull();   // onto the fixed edge: zero width
	expect(resizedOpening(door, wall, 'end', 800)).toBeNull();      // onto the fixed edge from the other side
	expect(resizedOpening(door, wall, 'start', -1)).toBeNull();     // before the host's start
	expect(resizedOpening(door, wall, 'end', 4001)).toBeNull();     // past the host's end
	expect(resizedOpening(door, wall, 'end', Number.NaN)).toBeNull();
});

it('steps an opening along its host and clamps it to the ends', () => {
	expect(steppedOpening(door, wall, 100)).toEqual({ ...door, offset: 900 });
	expect(steppedOpening(door, wall, -100)).toEqual({ ...door, offset: 700 });
	// Clamped, not refused: a step that would overshoot lands on the end.
	expect(steppedOpening(door, wall, -5000)).toEqual({ ...door, offset: 0 });
	expect(steppedOpening(door, wall, 5000)).toEqual({ ...door, offset: 3100 });
});

it('refuses a step that changes nothing and one it cannot measure', () => {
	expect(steppedOpening({ ...door, offset: 0 }, wall, -100)).toBeNull();
	expect(steppedOpening({ ...door, offset: 3100 }, wall, 100)).toBeNull();
	expect(steppedOpening(door, wall, 0)).toBeNull();
	expect(steppedOpening(door, wall, Number.NaN)).toBeNull();
	// An opening wider than its host has no legal range at all.
	expect(steppedOpening({ ...door, width: 5000 }, wall, 100)).toBeNull();
});

it('puts a leaf on either wall face and materialises the default swing to do it', () => {
	// `door` stores no swing; pressing a chevron IS the user choosing one, so the default is written out.
	expect(flippedOpening(door, 'right')).toEqual({ ...door, swing: { hinge: 'start', side: 'right', angle: 90 } });
	const hinged: OpeningSwing = { hinge: 'end', side: 'left', angle: 45 };
	expect(flippedOpening({ ...door, swing: hinged }, 'right')).toEqual({ ...door, swing: { ...hinged, side: 'right' } });
	// Re-choosing the side the leaf is already on is permitted; the write path refuses the no-op document.
	expect(flippedOpening({ ...door, swing: hinged }, 'left')).toEqual({ ...door, swing: hinged });
	// A plain opening has no leaf.
	expect(flippedOpening({ ...door, kind: 'opening' }, 'right')).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run check:fast -- tests/domain/spatial/openingGeometry.test.ts
```

Expected: FAIL. The first errors are from `vue-tsc`/the transform — `resizedOpening`, `steppedOpening` and `flippedOpening` are not exported by `openingGeometry`.

- [ ] **Step 3: Write the implementation**

Append to `src/domain/spatial/openingGeometry.ts`. Add `type OpeningSwing` to the existing `./Structure` import.

```ts
/**
 * A width drag moves ONE edge and holds the other still, so an edit changes `offset` and `width`
 * together. Dragging an edge past its partner swaps their roles rather than producing a negative
 * width — `Math.min` decides which is the offset, so the opening is always stated the one legal way.
 *
 * Off-host is REFUSED rather than clamped, deliberately: the gesture above keeps the last valid
 * proposal on screen (`OpeningResize`), so a drag past the wall's end freezes at the last legal
 * width instead of sliding along it, which is what `ElementResize` already does for an item.
 */
export function resizedOpening(opening: Opening, host: Wall, end: 'start' | 'end', toOffset: number): Opening | null {
	const length = wallLength(host);
	if (!Number.isFinite(toOffset) || !Number.isFinite(length) || toOffset < 0 || toOffset > length) return null;
	const fixed = end === 'start' ? opening.offset + opening.width : opening.offset;
	const width = Math.abs(fixed - toOffset);
	return width > 0 ? { ...opening, offset: Math.min(fixed, toOffset), width } : null;
}

/**
 * A step arrow slides the opening along its host by a fixed distance. CLAMPED rather than refused
 * at the ends — a tap is a discrete act with nothing to keep previewing, so landing on the end is
 * the useful answer — and `null` only once the clamp leaves the offset where it already was, which
 * is what keeps a tap at the end out of the undo stack.
 */
export function steppedOpening(opening: Opening, host: Wall, deltaMm: number): Opening | null {
	const limit = wallLength(host) - opening.width;
	if (!Number.isFinite(deltaMm) || !Number.isFinite(limit) || limit < 0) return null;
	const offset = Math.max(0, Math.min(limit, opening.offset + deltaMm));
	return offset === opening.offset ? null : { ...opening, offset };
}

/**
 * A side chevron puts the leaf on that wall face. It materialises the default swing for an opening
 * that stored none — a deliberate exception to `openingSwing`'s "reading never materializes new
 * fields", because this is not a read: the press IS the user choosing a side, so the write is
 * theirs. Choosing the side already held is permitted and answers the unchanged opening; the write
 * path refuses the resulting no-op document through `sameGeometryDocument`.
 */
export function flippedOpening(opening: Opening, side: OpeningSwing['side']): Opening | null {
	const swing = openingSwing(opening);
	return swing === null ? null : { ...opening, swing: { ...swing, side } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run check:fast -- tests/domain/spatial/openingGeometry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Check the branch coverage of the file you changed**

```bash
npx vitest run --coverage tests/domain/spatial/openingGeometry.test.ts
```

Open `coverage/coverage-final.json` and confirm `src/domain/spatial/openingGeometry.ts` has no uncovered branch inside the three new functions. The threshold cannot see a single arm; this read can.

- [ ] **Step 6: Commit**

```bash
git add src/domain/spatial/openingGeometry.ts tests/domain/spatial/openingGeometry.test.ts
git commit -m "feat(openings): resize, step and flip an opening as pure transforms

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Where the handles are

**Files:**
- Create: `src/presentation/editor/structure/openingHandles.ts`
- Modify: `src/presentation/editor/handleMetrics.ts`
- Modify: `src/presentation/editor/surface/keyboard.ts`
- Test: `tests/presentation/editor/structure/openingHandles.test.ts`

**Interfaces:**
- Consumes: Task 1's file only for its types; `alongWall`, `wallTangent` from `domain/spatial/Structure`; `wallSideExtents`, `wallSideNormal` from `domain/spatial/wallSides`; `openingSwing` from `domain/spatial/openingSwing`.
- Produces:
  - `type OpeningGrip = 'width-start' | 'step-back' | 'move' | 'step-forward' | 'width-end' | 'side-left' | 'side-right'`
  - `interface OpeningHandle { readonly grip: OpeningGrip; readonly point: Point }`
  - `openingHandles(opening: Opening, host: Wall, worldPerPixel: number): readonly OpeningHandle[]`
  - `OPENING_HANDLE_RADIUS_PX`, `OPENING_CHEVRON_GAP_PX` from `handleMetrics.ts`
  - `NUDGE_STEP_MM`, `NUDGE_STEP_SHIFT_MM` newly **exported** from `surface/keyboard.ts`

Background: `wallSideNormal(tangent, 'a')` is `{ x: tangent.y, y: -tangent.x }` — the same vector `openingSymbol` multiplies by `+1` for a `left` swing. So **wall side `a` is the `left` side and side `b` is the `right` side**, and using `wallSideNormal` rather than restating the arithmetic is what keeps the chevron on the face its value means.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structure/openingHandles.test.ts`:

```ts
import { expect, it } from 'vitest';
import { openingHandles } from '../../../../src/presentation/editor/structure/openingHandles';
import { openingSymbol } from '../../../../src/domain/spatial/openingGeometry';
import { alongWall, type Opening, type Wall } from '../../../../src/domain/spatial/Structure';
import { OPENING_CHEVRON_GAP_PX } from '../../../../src/presentation/editor/handleMetrics';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
const grips = (handles: readonly { grip: string }[]) => handles.map(handle => handle.grip);

it('places the centre-line marks at quarters of the opening, along the host', () => {
	const handles = openingHandles(door, wall, 1);
	expect(grips(handles)).toEqual(['width-start', 'step-back', 'move', 'step-forward', 'width-end', 'side-left', 'side-right']);
	expect(handles[0].point).toEqual(alongWall(wall, 800));
	expect(handles[2].point).toEqual(alongWall(wall, 1400));
	expect(handles[4].point).toEqual(alongWall(wall, 2000));
});

it('follows a curved host rather than a straight chord', () => {
	const host = { ...wall, bulge: 0.5 };
	const handles = openingHandles(door, host, 1);
	expect(handles[2].point).toEqual(alongWall(host, 1400));
	expect(handles[2].point.y).not.toBe(0);
});

it('puts each chevron on the wall face its swing value means', () => {
	// `openingSymbol` draws a left-swinging leaf on one side; the left chevron must be on that side.
	const leaf = openingSymbol({ ...door, swing: { hinge: 'start', side: 'left', angle: 90 } }, wall);
	const left = openingHandles(door, wall, 1).find(handle => handle.grip === 'side-left');
	const right = openingHandles(door, wall, 1).find(handle => handle.grip === 'side-right');
	expect(Math.sign(left!.point.y)).toBe(Math.sign(leaf.leaf[1].y - leaf.leaf[0].y));
	expect(Math.sign(right!.point.y)).toBe(-Math.sign(left!.point.y));
	// Off the centre-line by the face's own extent plus the gap; this wall's faces are 100 mm each.
	expect(Math.abs(left!.point.y)).toBeCloseTo(100 + OPENING_CHEVRON_GAP_PX);
});

it('measures the chevron off an asymmetric wall face rather than half its thickness', () => {
	const host = { ...wall, sideExtents: { a: 50, b: 150 } };
	const handles = openingHandles(door, host, 1);
	expect(Math.abs(handles.find(handle => handle.grip === 'side-left')!.point.y)).toBeCloseTo(50 + OPENING_CHEVRON_GAP_PX);
	expect(Math.abs(handles.find(handle => handle.grip === 'side-right')!.point.y)).toBeCloseTo(150 + OPENING_CHEVRON_GAP_PX);
});

it('drops the step arrows, then everything but the move grip, as the marks crowd together', () => {
	// Separation between adjacent centre-line marks is width / 4; the floor is 16 screen pixels.
	expect(grips(openingHandles(door, wall, 1200 / 4 / 16))).toContain('step-back');
	expect(grips(openingHandles(door, wall, 1200 / 4 / 16 + 0.001))).not.toContain('step-back');
	expect(grips(openingHandles(door, wall, 1200 / 4 / 16 + 0.001))).toEqual(['width-start', 'move', 'width-end', 'side-left', 'side-right']);
	expect(grips(openingHandles(door, wall, 1200 / 16 + 0.001))).toEqual(['move', 'side-left', 'side-right']);
});

it('draws no chevron for an opening with no leaf', () => {
	expect(grips(openingHandles({ ...door, kind: 'opening' }, wall, 1))).toEqual(['width-start', 'step-back', 'move', 'step-forward', 'width-end']);
	expect(grips(openingHandles({ ...door, kind: 'window' }, wall, 1))).toContain('side-left');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingHandles.test.ts
```

Expected: FAIL — `openingHandles` and `OPENING_CHEVRON_GAP_PX` do not exist.

- [ ] **Step 3: Add the two constants**

Append to `src/presentation/editor/handleMetrics.ts`:

```ts
/**
 * The radius of a selected opening's own handles — its two width grips, its move grip and its two
 * step arrows. Its own constant rather than a reuse of `VERTEX_HANDLE_RADIUS_PX`: these are drawn
 * larger because five of them share one opening's width and a user aims at a specific one, so a
 * future change to a zone's vertex dot must not silently move them.
 *
 * The GRAB radius is `VERTEX_GRAB_RADIUS_PX`, like every other handle — see the module comment on
 * why a pointing target is deliberately larger than the mark drawn for it.
 */
export const OPENING_HANDLE_RADIUS_PX = 7;

/**
 * How far OUTSIDE a wall face an opening's side chevron is drawn. Measured from the face rather
 * than from the centre-line, so an asymmetric wall (`sideExtents`) puts each chevron clear of its
 * own face instead of burying one inside the wall body.
 */
export const OPENING_CHEVRON_GAP_PX = 18;
```

- [ ] **Step 4: Export the two step distances**

In `src/presentation/editor/surface/keyboard.ts`, change the two existing declarations from module-private to exported, and give them the docblock the move earns:

```ts
/**
 * How far one arrow-key press — or one press of a selected opening's step arrow — moves what is
 * selected, in world millimetres. Exported so the two doors take the SAME distance rather than two
 * numbers that happen to agree today.
 */
export const NUDGE_STEP_MM = 10;
/** The same step with Shift held, at either door. */
export const NUDGE_STEP_SHIFT_MM = 100;
```

Nothing else in that file changes; its local uses still resolve.

- [ ] **Step 5: Write the layout module**

Create `src/presentation/editor/structure/openingHandles.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import { alongWall, wallTangent, type Opening, type Wall } from '../../../domain/spatial/Structure';
import { openingSwing } from '../../../domain/spatial/openingSwing';
import { wallSideExtents, wallSideNormal } from '../../../domain/spatial/wallSides';
import { OPENING_CHEVRON_GAP_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';

/**
 * Where a selected opening's handles are — the ONE answer, used by the component that draws them
 * and by `resolveSelectionTarget` through `SelectTool`, so what lights up under the pointer is
 * always what a press will act on. Two functions here would be two places for them to disagree.
 *
 * World coordinates, not screen: the caller converts. `worldPerPixel` is taken only to decide which
 * marks are far enough apart to be worth drawing, which is the one question that depends on zoom.
 */
export type OpeningGrip = 'width-start' | 'step-back' | 'move' | 'step-forward' | 'width-end' | 'side-left' | 'side-right';
export interface OpeningHandle { readonly grip: OpeningGrip; readonly point: Point }

/** Adjacent marks closer than this in screen pixels are a pile of overlapping targets, not five handles. */
const MIN_SEPARATION_PX = VERTEX_GRAB_RADIUS_PX * 2;

const CENTRE_LINE: readonly { readonly grip: OpeningGrip; readonly fraction: number }[] = [
	{ grip: 'width-start', fraction: 0 },
	{ grip: 'step-back', fraction: 0.25 },
	{ grip: 'move', fraction: 0.5 },
	{ grip: 'step-forward', fraction: 0.75 },
	{ grip: 'width-end', fraction: 1 },
];
const EDGES: readonly OpeningGrip[] = ['width-start', 'move', 'width-end'];

/**
 * The chevrons are NOT subject to the crowding rule above: they sit off the centre-line, so they
 * cannot collide with marks on it however narrow the opening gets. They are absent for
 * `kind: 'opening'`, which has no leaf to put anywhere.
 *
 * `wallSideNormal(tangent, 'a')` is the same vector `openingSymbol` multiplies by `+1` for a `left`
 * swing, so side `a` IS the left face. Asking the domain for it rather than restating the
 * arithmetic here is what stops the chevron and the leaf drifting onto opposite faces.
 */
function chevrons(opening: Opening, host: Wall, worldPerPixel: number): readonly OpeningHandle[] {
	if (openingSwing(opening) === null) return [];
	const middle = opening.offset + opening.width / 2;
	const at = alongWall(host, middle), tangent = wallTangent(host, middle);
	const sides = wallSideExtents(host), gap = OPENING_CHEVRON_GAP_PX * worldPerPixel;
	return ([['side-left', 'a'], ['side-right', 'b']] as const).map(([grip, side]) => {
		const normal = wallSideNormal(tangent, side), reach = sides[side] + gap;
		return { grip, point: { x: at.x + normal.x * reach, y: at.y + normal.y * reach } };
	});
}

export function openingHandles(opening: Opening, host: Wall, worldPerPixel: number): readonly OpeningHandle[] {
	const minimum = MIN_SEPARATION_PX * worldPerPixel;
	const marks = opening.width / 4 >= minimum ? CENTRE_LINE
		: opening.width >= minimum ? CENTRE_LINE.filter(mark => EDGES.includes(mark.grip))
		: CENTRE_LINE.filter(mark => mark.grip === 'move');
	return [
		...marks.map(mark => ({ grip: mark.grip, point: alongWall(host, opening.offset + mark.fraction * opening.width) })),
		...chevrons(opening, host, worldPerPixel),
	];
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingHandles.test.ts tests/presentation/editor/handleMetrics.test.ts
```

Expected: PASS, including the existing `handleMetrics` test.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/structure/openingHandles.ts src/presentation/editor/handleMetrics.ts src/presentation/editor/surface/keyboard.ts tests/presentation/editor/structure/openingHandles.test.ts
git commit -m "feat(openings): lay out a selected opening's handles on its host

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The guarded write

**Files:**
- Create: `src/presentation/editor/structure/openingHandleActions.ts`
- Modify: `src/presentation/editor/structure/structureActions.ts`
- Test: `tests/presentation/editor/structure/openingHandleActions.test.ts`

**Interfaces:**
- Consumes: Task 1's transforms (the caller passes one in); `StructureReviewState` from `./structureBulkEdit`; `openingValidationError` from `domain/spatial/structureGeometry`; `spatialMessage` from `./spatialMessage`.
- Produces, on the object `createStructureActions` returns:
  - `applyOpening(id: string, transform: (opening: Opening, host: Wall) => Opening | null): Promise<void>`
  - `previewOpening(id: string | null, next?: Opening): void`

Background — **read this before writing any code.** `createStructureActions` already owns and shares a guarded-write kit, and four collaborators already take it: `createWallRotationActions`, `createStructureBulkEdit`, `createWallPointAction`, `createWallThicknessActions`. **Open `src/presentation/editor/structure/wallPointAction.ts` and copy its shape** — it is the smallest of the four and does exactly what this task needs. The pieces:

- `state.unavailable()` — refuses while another structure edit is in flight, while writes are blocked, or while a dialog is open.
- `state.prepareBaseline(read)` — answers `{ snapshot, recovery }`. A `null` snapshot means the read failed or the projection has moved past it; it has already notified, and `recovery` (when present) must be awaited.
- `state.reviewedWrite(services, snapshot).dispatch(next)` — the write, refused once blocked.
- `state.preview` — a `Ref<Structure | null>` that `useDrawnStructure` already draws in preference to the store's structure. Writing it is the whole of showing a drag ghost.

Do **not** touch `openingMove.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structure/openingHandleActions.test.ts`.

Two setup facts this module forces, both of which the sibling collaborators' tests already deal with — find one with `grep -rl "createWallPointAction\|createStructureActions" tests/` and copy how it handles them:

- `createOpeningHandleActions` calls `useProjectStore()`, so **the test needs an active Pinia**: `setActivePinia(createPinia())` in a `beforeEach`, and the store's `structure` seeded with the fixture below. Without it the first call throws with no mention of Pinia in the message.
- It calls `onBeforeUnmount` outside a component instance. The siblings accept the resulting Vue warning; do the same rather than mounting a component for it.

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
```

```ts
import { expect, it, vi } from 'vitest';
import { createOpeningHandleActions } from '../../../../src/presentation/editor/structure/openingHandleActions';
import type { Opening, Structure, Wall } from '../../../../src/domain/spatial/Structure';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 900, height: 2100, sill: 0 };
const structure: Structure = { walls: [wall], openings: [door], boundaries: [] };
const snapshot = { document: { objects: [], structure, calibration: null } } as never;

beforeEach(() => {
	setActivePinia(createPinia());
	// `previewOpening` builds its ghost from the STORE's structure, so the store has to hold one.
	useProjectStore().structure = structure;
});

function harness(overrides: Partial<Parameters<typeof createOpeningHandleActions>[1]> = {}) {
	const dispatch = vi.fn().mockResolvedValue({ ok: true, value: undefined });
	const preview = { value: null as Structure | null }, active = { value: false };
	const read = vi.fn().mockResolvedValue({ ok: true, value: snapshot });
	const context = { planId: 'plan-a', commands: { structure: { read, command: vi.fn() }, logger: { error: vi.fn() } } } as never;
	const actions = createOpeningHandleActions(context, {
		active, preview,
		unavailable: () => false,
		prepareBaseline: () => ({ snapshot, recovery: null }),
		reviewedWrite: () => ({ preview: (value: Structure | null) => { preview.value = value; }, dispatch }),
		...overrides,
	} as never);
	return { actions, dispatch, preview, active, read };
}

it('reads a baseline, transforms the opening it finds there, and dispatches the result', async () => {
	const { actions, dispatch, active } = harness();
	await actions.applyOpening('opening-a', opening => ({ ...opening, offset: 1200 }));
	expect(dispatch).toHaveBeenCalledTimes(1);
	expect(dispatch.mock.calls[0][0].openings[0].offset).toBe(1200);
	expect(active.value).toBe(false);
});

it('transforms the BASELINE opening, never the one the store is showing', async () => {
	const { actions, dispatch } = harness();
	const seen: Opening[] = [];
	await actions.applyOpening('opening-a', opening => { seen.push(opening); return { ...opening, offset: 0 }; });
	expect(seen[0]).toEqual(door);
});

it('dispatches nothing when the transform refuses, when the opening is gone, or when its host is', async () => {
	const refused = harness();
	await refused.actions.applyOpening('opening-a', () => null);
	expect(refused.dispatch).not.toHaveBeenCalled();
	const missing = harness();
	await missing.actions.applyOpening('opening-elsewhere', opening => opening);
	expect(missing.dispatch).not.toHaveBeenCalled();
});

it('dispatches nothing when the proposal fails opening validation', async () => {
	const { actions, dispatch } = harness();
	// Wider than its host: `openingValidationError` refuses it.
	await actions.applyOpening('opening-a', opening => ({ ...opening, width: 9000 }));
	expect(dispatch).not.toHaveBeenCalled();
});

it('dispatches nothing and clears the preview when the edit is unavailable', async () => {
	const { actions, dispatch, preview } = harness({ unavailable: () => true });
	preview.value = structure;
	await actions.applyOpening('opening-a', opening => ({ ...opening, offset: 0 }));
	expect(dispatch).not.toHaveBeenCalled();
	expect(preview.value).toBeNull();
});

it('awaits the recovery a stale baseline hands back and writes nothing', async () => {
	const recovery = vi.fn().mockResolvedValue(undefined);
	const { actions, dispatch } = harness({ prepareBaseline: () => ({ snapshot: null, recovery: recovery() }) });
	await actions.applyOpening('opening-a', opening => opening);
	expect(dispatch).not.toHaveBeenCalled();
	expect(recovery).toHaveBeenCalled();
});

it('releases the in-flight flag after a read throws', async () => {
	const { actions, active } = harness();
	// Replace the read with one that throws, after construction.
	await expect(actions.applyOpening('opening-a', () => { throw new Error('boom'); })).resolves.toBeUndefined();
	expect(active.value).toBe(false);
});

it('previews one changed opening against the store structure, and clears on null', () => {
	const { actions, preview } = harness();
	actions.previewOpening('opening-a', { ...door, offset: 1500 });
	expect(preview.value?.openings[0].offset).toBe(1500);
	actions.previewOpening(null);
	expect(preview.value).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingHandleActions.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the collaborator**

Create `src/presentation/editor/structure/openingHandleActions.ts`:

```ts
import { onBeforeUnmount } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Opening, Structure, Wall } from '../../../domain/spatial/Structure';
import { openingValidationError } from '../../../domain/spatial/structureGeometry';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { notifyFault, notifyWarning } from '../../notices/notify';
import { spatialMessage } from './spatialMessage';
import type { StructureReviewState } from './structureBulkEdit';

/**
 * A selected opening's canvas handles, writing through the SAME admission, stale-baseline check and
 * reviewed write the single wall edit uses — the fifth collaborator to take that bundle, beside
 * `createWallPointAction`, `createWallThicknessActions`, `createWallRotationActions` and
 * `createStructureBulkEdit`. One undo reverts one handle press.
 *
 * The transform is handed the opening AND host found in the BASELINE, never the ones the store is
 * drawing: the store's copy is what the preview was computed against and may be a frame behind the
 * document this write is about to land on.
 */
export function createOpeningHandleActions(context: PlanEditorContext,
	state: Pick<StructureReviewState, 'active' | 'preview' | 'unavailable' | 'prepareBaseline' | 'reviewedWrite'>) {
	const project = useProjectStore();
	let alive = true;
	onBeforeUnmount(() => { alive = false; });

	/** The drag ghost: the store's structure with one opening replaced. `useDrawnStructure` draws it. */
	function previewOpening(id: string | null, next?: Opening): void {
		state.preview.value = alive && id !== null && next
			? { ...project.structure, openings: project.structure.openings.map(item => item.id === id ? next : item) }
			: null;
	}

	async function applyOpening(id: string, transform: (opening: Opening, host: Wall) => Opening | null): Promise<void> {
		const services = context.commands.structure;
		if (state.unavailable() || !services) { previewOpening(null); return; }
		state.active.value = true;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!alive) return;
			const { snapshot, recovery } = state.prepareBaseline(read);
			const structure = snapshot?.document.structure;
			if (!snapshot || !structure) { await recovery; return; }
			const opening = structure.openings.find(item => item.id === id);
			const host = structure.walls.find(wall => wall.id === opening?.hostId);
			const next = opening && host ? transform(opening, host) : null;
			if (!next) return;
			const proposed: Structure = { ...structure, openings: structure.openings.map(item => item.id === id ? next : item) };
			const invalid = openingValidationError(next, proposed);
			// `spatialMessage` is a call, not a literal, so this passes NOTICE_TEXT_BAN and stays translated.
			if (invalid) { notifyWarning(spatialMessage(invalid)); return; }
			const result = await state.reviewedWrite(services, snapshot).dispatch(proposed);
			if (alive && !result.ok) notifyOperationFailure(result.error);
		} catch (cause) {
			if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed');
		} finally {
			if (alive) { state.active.value = false; previewOpening(null); }
		}
	}

	return { applyOpening, previewOpening };
}
```

Add `notifyOperationFailure` to the `../../notices/notify` import — the snippet above uses it in the dispatch arm.

- [ ] **Step 4: Wire it into `structureActions.ts`**

In `src/presentation/editor/structure/structureActions.ts`:

1. Add the import beside the other collaborator imports:

```ts
import { createOpeningHandleActions } from './openingHandleActions';
```

2. Construct it beside `wallPoint` (after `prepareBaseline` and `reviewedWrite` are declared — they are function declarations, so they hoist; place the call next to the existing `createWallPointAction` line):

```ts
const openingHandleActions = createOpeningHandleActions(context, { active, preview, unavailable: geometryUnavailable, prepareBaseline, reviewedWrite });
```

3. Spread it into the return, beside `...wallPoint`:

```ts
return { edit, moveOpeningToPoint, remove, preview, previewWall, active, thickness, faceHighlight, ...rotation, ...bulk, ...wallPoint, ...openingHandleActions };
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run check:fast -- tests/presentation/editor/structure/ tests/presentation/editor/selection/
```

Expected: PASS, including every existing structure test.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/structure/openingHandleActions.ts src/presentation/editor/structure/structureActions.ts tests/presentation/editor/structure/openingHandleActions.test.ts
git commit -m "feat(openings): write a handle edit through the shared structure review

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Resolving a press on a handle

**Files:**
- Modify: `src/presentation/editor/selection/resolveSelectionTarget.ts`
- Modify: `src/presentation/editor/surface/cursor.ts`
- Test: `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`
- Test: `tests/presentation/editor/surface/cursor.test.ts` *(find the existing file with `grep -rl cursorClassFor tests/`)*

**Interfaces:**
- Consumes: `OpeningGrip`, `OpeningHandle` from Task 2.
- Produces:
  - a new `SelectionTarget` member: `{ readonly kind: 'opening-handle'; readonly id: string; readonly grip: OpeningGrip }`
  - a new optional input: `openingHandles?: { readonly id: string; readonly handles: readonly OpeningHandle[] }`
  - `'opening-handle'` added to `CursorInputs['hoveredTargetKind']` and to the grab list

Background: `resolveSelectionTarget` is the ONE answer to "what would a click here select", asked by both the hover prediction and the click, so the two cannot disagree. Its decoration chain runs vertex handle → transform box handle → caption → body, and `cycle` (Alt) bypasses the whole chain.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`, following that file's existing shape for building an input object:

```ts
it('resolves a press on a selected opening handle, by grip', () => {
	const handles = [{ grip: 'width-start' as const, point: { x: 100, y: 0 } }, { grip: 'side-left' as const, point: { x: 150, y: -120 } }];
	const input = { candidates: [], selectedIds: ['opening-a'], worldPoint: { x: 103, y: 0 }, handleToleranceWorld: 8,
		openingHandles: { id: 'opening-a', handles } };
	expect(resolveSelectionTarget(input)).toEqual({ kind: 'opening-handle', id: 'opening-a', grip: 'width-start' });
	expect(resolveSelectionTarget({ ...input, worldPoint: { x: 150, y: -118 } })).toEqual({ kind: 'opening-handle', id: 'opening-a', grip: 'side-left' });
});

it('ignores opening handles out of reach, for another id, or with the selection not on that opening', () => {
	const handles = [{ grip: 'move' as const, point: { x: 100, y: 0 } }];
	const base = { candidates: [], worldPoint: { x: 100, y: 0 }, handleToleranceWorld: 8 };
	expect(resolveSelectionTarget({ ...base, selectedIds: ['opening-a'], worldPoint: { x: 120, y: 0 }, openingHandles: { id: 'opening-a', handles } })).toBeNull();
	expect(resolveSelectionTarget({ ...base, selectedIds: ['wall-a'], openingHandles: { id: 'opening-a', handles } })).toBeNull();
	expect(resolveSelectionTarget({ ...base, selectedIds: ['opening-a', 'wall-a'], openingHandles: { id: 'opening-a', handles } })).toBeNull();
	expect(resolveSelectionTarget({ ...base, selectedIds: ['opening-a'] })).toBeNull();
});

it('lets Alt cycle bodies past an opening handle', () => {
	const handles = [{ grip: 'move' as const, point: { x: 100, y: 0 } }];
	const target = resolveSelectionTarget({ candidates: [], selectedIds: ['opening-a'], worldPoint: { x: 100, y: 0 },
		handleToleranceWorld: 8, cycle: true, openingHandles: { id: 'opening-a', handles } });
	expect(target).toBeNull();   // no candidates to cycle to, and the handle was bypassed
});
```

And in the cursor test file:

```ts
it('promises a grab over an opening handle', () => {
	expect(cursorClassFor({ panPhase: 'idle', activeToolId: 'select', hoveredObjectId: 'opening-a', hoveredTargetKind: 'opening-handle' })).toBe('rp-plan-canvas-grab');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run check:fast -- tests/presentation/editor/selection/resolveSelectionTarget.test.ts tests/presentation/editor/surface/cursor.test.ts
```

Expected: FAIL — `openingHandles` is not a known input property, and `'opening-handle'` is not assignable to `hoveredTargetKind`.

- [ ] **Step 3: Add the target kind and its resolver**

In `src/presentation/editor/selection/resolveSelectionTarget.ts`:

1. Import the types:

```ts
import type { OpeningGrip, OpeningHandle } from '../structure/openingHandles';
```

2. Add the union member, after the `resize` one:

```ts
	| { readonly kind: 'opening-handle'; readonly id: string; readonly grip: OpeningGrip }
```

3. Add the resolver beside `resizeAt`:

```ts
/** A handle of the one selected opening — its width grips, its move grip, its step arrows and its side chevrons. */
function openingHandleAt(input: {
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
	readonly openingHandles?: { readonly id: string; readonly handles: readonly OpeningHandle[] };
}): SelectionTarget {
	const set = input.openingHandles;
	if (!set || input.selectedIds.length !== 1 || input.selectedIds[0] !== set.id) return null;
	const hit = set.handles.find(handle => distance(handle.point, input.worldPoint) <= input.handleToleranceWorld);
	return hit ? { kind: 'opening-handle', id: set.id, grip: hit.grip } : null;
}
```

4. Add the input property to `resolveSelectionTarget`'s parameter type, beside `resizeHandles`:

```ts
	/** The selected opening's own handles, world points with the grip each one means. */
	readonly openingHandles?: { readonly id: string; readonly handles: readonly OpeningHandle[] };
```

5. Put it in the decoration chain. An opening has no vertex handles (`hasPointHandles('opening')` is false and its kind is not `'wall'`, so `handleAt` answers `null` for one) and no transform box, so the order between the three is not contested — it is stated anyway so a future kind cannot silently reorder it:

```ts
		const decoration = input.selectedIds.length > 1 ? badgeAt(input) : handleAt(input) ?? openingHandleAt(input) ?? resizeAt(input);
```

6. Update the docblock's priority sentence to name the new step — it currently reads "a single selection's vertex handle, then its transform box handle". It must read "a single selection's vertex handle, then its opening handle, then its transform box handle".

In `src/presentation/editor/surface/cursor.ts`:

7. Add `'opening-handle'` to `CursorInputs['hoveredTargetKind']`'s union, and to the grab test in `cursorClassFor`:

```ts
	readonly hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | 'resize' | 'opening-handle' | null;
```

```ts
		return inputs.hoveredTargetKind === 'handle' || inputs.hoveredTargetKind === 'rotation' || inputs.hoveredTargetKind === 'label' || inputs.hoveredTargetKind === 'resize' || inputs.hoveredTargetKind === 'opening-handle' ? 'rp-plan-canvas-grab' : 'rp-plan-canvas-target';
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run check:fast -- tests/presentation/editor/selection/ tests/presentation/editor/surface/
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/selection/resolveSelectionTarget.ts src/presentation/editor/surface/cursor.ts tests/presentation/editor/selection/resolveSelectionTarget.test.ts tests/presentation/editor/surface/cursor.test.ts
git commit -m "feat(openings): resolve a press on an opening handle to its grip

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The width and move drag

**Files:**
- Create: `src/presentation/editor/structure/OpeningResize.ts`
- Test: `tests/presentation/editor/structure/openingResize.test.ts`

**Interfaces:**
- Consumes: `resizedOpening` (Task 1); `openingOffsetAt`, `projectOntoWall` from the domain; `CLICK_EPSILON_PX` from `handleMetrics`; `EditorContext`, `EditorPointerEvent` from `../tools/`.
- Produces:
  - `interface OpeningResizeDeps { openingTarget?: (id: string) => { opening: Opening; host: Wall } | null; previewOpening?: (id: string | null, next?: Opening) => void; commitOpening?: (id: string, next: Opening) => void }`
  - `class OpeningResize` with `active`, `start(context, event, id, grip)`, `move(context, event)`, `finish(context, event)`, `cancel()`

Background — **open `src/presentation/editor/elements/ElementResize.ts` and copy its shape.** It is the same gesture with different arithmetic: a press is not yet an edit, travel past `CLICK_EPSILON_PX` starts one, a proposal outside the limits leaves the last valid preview standing, and the release commits while the preview stays up until the write is read back.

The one difference: this gesture is **one-dimensional**. The pointer is projected onto the host wall and only the resulting offset matters, so there is no snapping and no snap-guide write (spec Decision 5).

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structure/openingResize.test.ts`. Build the `EditorContext` and `EditorPointerEvent` doubles the way the existing `tests/presentation/editor/elementResize.test.ts` does — find it with `grep -rl "new ElementResize" tests/` and reuse that file's helpers rather than writing new ones.

```ts
import { expect, it, vi } from 'vitest';
import { OpeningResize } from '../../../../src/presentation/editor/structure/OpeningResize';
import type { Opening, Wall } from '../../../../src/domain/spatial/Structure';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 900, height: 2100, sill: 0 };

function harness() {
	const previewOpening = vi.fn(), commitOpening = vi.fn();
	const resize = new OpeningResize({ openingTarget: () => ({ opening: door, host: wall }), previewOpening, commitOpening });
	// `worldPerScreenPixel` of 1 makes CLICK_EPSILON_PX (4) four world millimetres.
	const context = { writesBlocked: () => false, viewport: { worldPerScreenPixel: () => 1 } } as never;
	const at = (x: number) => ({ worldPoint: { x, y: 0 }, button: 'primary', modifiers: { shift: false, alt: false } }) as never;
	return { resize, previewOpening, commitOpening, context, at };
}

it('is not an edit until the pointer has travelled past the click epsilon', () => {
	const { resize, previewOpening, context, at } = harness();
	resize.start(context, at(1250), 'opening-a', 'width-end');
	expect(resize.active).toBe(true);
	resize.move(context, at(1252));
	expect(previewOpening).not.toHaveBeenCalled();
	resize.move(context, at(1300));
	expect(previewOpening).toHaveBeenCalledWith('opening-a', { ...door, offset: 800, width: 500 });
});

it('drags the move grip by the opening centre, keeping its whole width on the host', () => {
	const { resize, previewOpening, context, at } = harness();
	resize.start(context, at(1250), 'opening-a', 'move');
	resize.move(context, at(2000));
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 1550 });
	// Dragged past the end, the whole width still sits on the host.
	resize.move(context, at(9000));
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 3100 });
});

it('leaves the last valid preview standing when a drag goes somewhere illegal', () => {
	const { resize, previewOpening, context, at } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.move(context, at(2500));
	const valid = previewOpening.mock.calls.length;
	resize.move(context, at(-50));   // before the host's start: refused
	expect(previewOpening).toHaveBeenCalledTimes(valid);
});

it('commits on release and keeps the preview up for the write to clear', () => {
	const { resize, commitOpening, previewOpening, context, at } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.move(context, at(2500));
	resize.finish(context, at(2500));
	expect(commitOpening).toHaveBeenCalledWith('opening-a', { ...door, offset: 800, width: 1700 });
	expect(previewOpening).toHaveBeenLastCalledWith('opening-a', { ...door, offset: 800, width: 1700 });
	expect(resize.active).toBe(false);
});

it('commits nothing for a press that never became a drag, and clears the preview', () => {
	const { resize, commitOpening, previewOpening, context, at } = harness();
	resize.start(context, at(1700), 'opening-a', 'width-end');
	resize.finish(context, at(1701));
	expect(commitOpening).not.toHaveBeenCalled();
	expect(previewOpening).toHaveBeenLastCalledWith(null);
});

it('starts nothing while writes are blocked, with Alt held, or for an opening it cannot find', () => {
	const blocked = harness();
	blocked.resize.start({ ...blocked.context, writesBlocked: () => true } as never, blocked.at(1250), 'opening-a', 'move');
	expect(blocked.resize.active).toBe(false);
	const alt = harness();
	alt.resize.start(alt.context, { ...alt.at(1250), modifiers: { shift: false, alt: true } } as never, 'opening-a', 'move');
	expect(alt.resize.active).toBe(false);
	const gone = new OpeningResize({ openingTarget: () => null, previewOpening: vi.fn(), commitOpening: vi.fn() });
	gone.start(blocked.context, blocked.at(1250), 'opening-a', 'move');
	expect(gone.active).toBe(false);
});

it('cancels to no preview', () => {
	const { resize, previewOpening, context, at } = harness();
	resize.start(context, at(1250), 'opening-a', 'move');
	resize.cancel();
	expect(resize.active).toBe(false);
	expect(previewOpening).toHaveBeenLastCalledWith(null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingResize.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the gesture**

Create `src/presentation/editor/structure/OpeningResize.ts`:

```ts
import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { projectOntoWall } from '../../../domain/spatial/Structure';
import { openingOffsetAt, resizedOpening } from '../../../domain/spatial/openingGeometry';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';

/** Which of a selected opening's three circle grips is being dragged; the arrows are taps, not drags. */
export type OpeningDragGrip = 'width-start' | 'width-end' | 'move';

export interface OpeningResizeDeps {
	/** The opening and its host as the CANVAS has them, for previewing; the write re-reads its own baseline. */
	readonly openingTarget?: (id: string) => { readonly opening: Opening; readonly host: Wall } | null;
	readonly previewOpening?: (id: string | null, next?: Opening) => void;
	readonly commitOpening?: (id: string, next: Opening) => void;
}

interface Gesture {
	readonly id: string;
	readonly grip: OpeningDragGrip;
	readonly opening: Opening;
	readonly host: Wall;
	readonly start: { readonly x: number; readonly y: number };
	readonly context: EditorContext;
	dragging: boolean;
}

/**
 * A width or move grip drag. The same shape as `ElementResize` — a press is not yet an edit, travel
 * past the click epsilon starts one, an illegal proposal leaves the last valid preview standing,
 * and the drop stays previewed until the write is read back — with one difference: this gesture is
 * ONE-DIMENSIONAL. The pointer is projected onto the host and only the offset it lands at matters,
 * so there is no snap and no snap-guide write (opening handles design, Decision 5).
 *
 * The move grip goes through `openingOffsetAt`, which is the function the click-to-place tool
 * already uses, so a drag and a click put the opening in the same place rather than two places that
 * agree by coincidence.
 */
export class OpeningResize {
	private gesture: Gesture | null = null;
	constructor(private readonly deps: OpeningResizeDeps) {}
	get active(): boolean { return this.gesture !== null; }

	start(context: EditorContext, event: EditorPointerEvent, id: string, grip: OpeningDragGrip): void {
		const found = this.deps.openingTarget?.(id);
		if (!found || context.writesBlocked() || event.modifiers.alt || !this.deps.commitOpening) return;
		this.gesture = { id, grip, opening: found.opening, host: found.host, start: event.worldPoint, context, dragging: false };
	}

	/** The opening at `event`: `null` below the click epsilon, or where the transform itself refuses. */
	private proposed(gesture: Gesture, event: EditorPointerEvent): Opening | null {
		const scale = gesture.context.viewport.worldPerScreenPixel();
		if (Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) > CLICK_EPSILON_PX * scale) gesture.dragging = true;
		if (!gesture.dragging) return null;
		if (gesture.grip === 'move') {
			const offset = openingOffsetAt(gesture.host, event.worldPoint, gesture.opening.width);
			return offset === null ? null : { ...gesture.opening, offset };
		}
		const at = projectOntoWall(gesture.host, event.worldPoint).offset;
		return resizedOpening(gesture.opening, gesture.host, gesture.grip === 'width-start' ? 'start' : 'end', at);
	}

	move(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture) return;
		if (context.writesBlocked()) { this.cancel(); return; }
		const next = this.proposed(gesture, event);
		if (next) this.deps.previewOpening?.(gesture.id, next);
	}

	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const next = context.writesBlocked() ? null : this.proposed(gesture, event);
		if (!next) { this.cancel(); return; }
		// Left previewing at the drop; the write clears it once read back, as `ElementResize` does.
		this.gesture = null;
		this.deps.previewOpening?.(gesture.id, next);
		this.deps.commitOpening?.(gesture.id, next);
	}

	cancel(): void {
		this.gesture = null;
		this.deps.previewOpening?.(null);
	}
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingResize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/structure/OpeningResize.ts tests/presentation/editor/structure/openingResize.test.ts
git commit -m "feat(openings): drag an opening's width and position along its host

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Wiring it to the pointer

**Files:**
- Modify: `src/presentation/editor/tools/select-tool.ts`
- Modify: `src/presentation/editor/tools/registerEditorTools.ts`
- Modify: `src/presentation/editor/runtime.ts`
- Test: `tests/presentation/editor/structure/openingHandleGestures.test.ts` *(create)*

**Interfaces:**
- Consumes: `openingHandles` (Task 2), `applyOpening`/`previewOpening` (Task 3), the `opening-handle` target (Task 4), `OpeningResize` + `OpeningResizeDeps` (Task 5), `NUDGE_STEP_MM`/`NUDGE_STEP_SHIFT_MM` (Task 2).
- Produces, on `SelectToolDeps`:
  - `openingHandles?: () => { readonly id: string; readonly handles: readonly OpeningHandle[] } | null`
  - `stepOpening?: (id: string, deltaMm: number) => void`
  - `flipOpening?: (id: string, side: 'left' | 'right') => void`
  - and, through `extends OpeningResizeDeps`, `openingTarget` / `previewOpening` / `commitOpening`

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structure/openingHandleGestures.test.ts`, driving a real `SelectTool` with stub deps.

**Lift `makeContext` and `press`/`release` from the existing `SelectTool` test** — find it with `grep -rl "new SelectTool" tests/`. That file already builds an `EditorContext` with a selection store, a viewport, `writesBlocked`, `snapCandidates` and a `renderState`, and this test needs the same one. Do not hand-build a second.

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import { openingHandles } from '../../../../src/presentation/editor/structure/openingHandles';
import type { Opening, Wall } from '../../../../src/domain/spatial/Structure';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
/** The handles as the tool will see them, so a press lands exactly where one is drawn. */
const handles = openingHandles(door, wall, 1);
const pointOf = (grip: string) => handles.find(handle => handle.grip === grip)!.point;

beforeEach(() => { setActivePinia(createPinia()); });

function harness(overrides: Record<string, unknown> = {}) {
	const stepOpening = vi.fn(), flipOpening = vi.fn(), previewOpening = vi.fn(), commitOpening = vi.fn();
	const context = makeContext({ selectedIds: ['opening-a'] });   // from the sibling SelectTool test
	const tool = new SelectTool({
		...selectDepsFor(context),                                  // likewise
		canMutateGeometry: () => true,
		spatialObjects: () => [{ id: 'opening-a', kind: 'opening', points: [wall.start, wall.end] }],
		openingHandles: () => ({ id: 'opening-a', handles }),
		openingTarget: () => ({ opening: door, host: wall }),
		stepOpening, flipOpening, previewOpening, commitOpening,
		...overrides,
	});
	tool.activate(context);
	const at = (point: { x: number; y: number }, shift = false) =>
		({ worldPoint: point, button: 'primary', modifiers: { shift, alt: false } }) as never;
	return { tool, context, at, stepOpening, flipOpening, previewOpening, commitOpening };
}

it('steps the opening forward and back from its arrow grips, by the shift step with shift held', () => {
	const { tool, at, stepOpening } = harness();
	tool.pointerDown(at(pointOf('step-forward')));
	expect(stepOpening).toHaveBeenCalledWith('opening-a', 10);
	tool.pointerDown(at(pointOf('step-back')));
	expect(stepOpening).toHaveBeenLastCalledWith('opening-a', -10);
	tool.pointerDown(at(pointOf('step-forward'), true));
	expect(stepOpening).toHaveBeenLastCalledWith('opening-a', 100);
});

it('flips the leaf from either chevron', () => {
	const { tool, at, flipOpening } = harness();
	tool.pointerDown(at(pointOf('side-left')));
	expect(flipOpening).toHaveBeenCalledWith('opening-a', 'left');
	tool.pointerDown(at(pointOf('side-right')));
	expect(flipOpening).toHaveBeenLastCalledWith('opening-a', 'right');
});

it('starts a drag from a width or move grip, and no drag at all from an arrow', () => {
	const dragged = harness();
	dragged.tool.pointerDown(dragged.at(pointOf('width-end')));
	dragged.tool.pointerMove(dragged.at({ x: 2500, y: 0 }));
	expect(dragged.previewOpening).toHaveBeenCalled();
	const tapped = harness();
	tapped.tool.pointerDown(tapped.at(pointOf('step-forward')));
	tapped.tool.pointerMove(tapped.at({ x: 2500, y: 0 }));
	expect(tapped.previewOpening).not.toHaveBeenCalled();
});

it('commits a width drag on release', () => {
	const { tool, at, commitOpening } = harness();
	tool.pointerDown(at(pointOf('width-end')));
	tool.pointerMove(at({ x: 2500, y: 0 }));
	tool.pointerUp(at({ x: 2500, y: 0 }));
	expect(commitOpening).toHaveBeenCalledWith('opening-a', { ...door, offset: 800, width: 1700 });
});

it('selects the opening instead of editing it when geometry cannot be mutated', () => {
	const { tool, context, at, stepOpening, previewOpening } = harness({ canMutateGeometry: () => false });
	tool.pointerDown(at(pointOf('step-forward')));
	expect(stepOpening).not.toHaveBeenCalled();
	expect(previewOpening).not.toHaveBeenCalled();
	expect(context.selection.selectedIds.map(String)).toEqual(['opening-a']);
});

it('abandons an opening drag when the gesture is cancelled', () => {
	const { tool, at, previewOpening, commitOpening } = harness();
	tool.pointerDown(at(pointOf('move')));
	tool.pointerMove(at({ x: 2500, y: 0 }));
	expect(tool.cancelGeometryGesture()).toBe(true);
	expect(previewOpening).toHaveBeenLastCalledWith(null);
	expect(commitOpening).not.toHaveBeenCalled();
});
```

`makeContext` and `selectDepsFor` are this plan's names for whatever the sibling test already calls its two builders — use its names, and if it inlines them rather than naming them, inline them here too.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingHandleGestures.test.ts
```

Expected: FAIL — `SelectToolDeps` has no `stepOpening`.

- [ ] **Step 3: Extend `SelectTool`**

In `src/presentation/editor/tools/select-tool.ts`:

1. Import:

```ts
import { OpeningResize, type OpeningResizeDeps } from '../structure/OpeningResize';
import type { OpeningHandle } from '../structure/openingHandles';
import { NUDGE_STEP_MM, NUDGE_STEP_SHIFT_MM } from '../surface/keyboard';
```

2. Add `OpeningResizeDeps` to `SelectToolDeps extends …`, and the three doors to the interface body:

```ts
	/** The selected opening's handles, or `null` where none are offered; the same points that are drawn. */
	readonly openingHandles?: () => { readonly id: string; readonly handles: readonly OpeningHandle[] } | null;
	readonly stepOpening?: (id: string, deltaMm: number) => void;
	readonly flipOpening?: (id: string, side: 'left' | 'right') => void;
```

3. Add the gesture field beside `elementResize`:

```ts
	private readonly openingResize = new OpeningResize(this.deps);
```

Match however the neighbouring gestures are constructed in that class — if `elementResize` is built in the constructor body, build this one there too.

4. In `targetAt`, supply the handles:

```ts
			openingHandles: this.deps.openingHandles?.() ?? undefined,
```

5. In `startDirectGesture`, admit the kind and dispatch it:

```ts
		if (target.kind !== 'rotation' && target.kind !== 'label' && target.kind !== 'resize' && target.kind !== 'opening-handle') return false;
```

```ts
		else if (target.kind === 'opening-handle') this.startOpeningGrip(context, event, target);
```

6. Add the dispatcher. A tap and a drag are decided here and nowhere else:

```ts
	/**
	 * The arrows are TAPS — they write on the press and start no gesture, because there is nothing
	 * to preview between a press and a release. The circles are drags. Shift takes the larger step,
	 * the same one Shift takes on an arrow key.
	 */
	private startOpeningGrip(context: EditorContext, event: EditorPointerEvent, target: { readonly id: string; readonly grip: OpeningGrip }): void {
		if (target.grip === 'step-back' || target.grip === 'step-forward') {
			const step = event.modifiers.shift ? NUDGE_STEP_SHIFT_MM : NUDGE_STEP_MM;
			this.deps.stepOpening?.(target.id, target.grip === 'step-back' ? -step : step);
			return;
		}
		if (target.grip === 'side-left' || target.grip === 'side-right') {
			this.deps.flipOpening?.(target.id, target.grip === 'side-left' ? 'left' : 'right');
			return;
		}
		this.openingResize.start(context, event, target.id, target.grip);
	}
```

Import `OpeningGrip` alongside `OpeningHandle`.

7. Add it to the three gesture chains, beside `elementResize` in each:

- `pointerMove`: `if (this.openingResize.active) { this.openingResize.move(context, event); return; }`
- `finishElementGesture`: `if (this.openingResize.active) { this.openingResize.finish(context, event); return true; }`
- `cancelGeometryGesture`: add `|| this.openingResize.active` to the early-return test, and `this.openingResize.cancel();` to the body.

8. **Check the budget:**

```bash
npx eslint src/presentation/editor/tools/select-tool.ts
```

If `max-lines` fires, move `startOpeningGrip` into `src/presentation/editor/structure/openingGripDispatch.ts` as a free function taking `(deps, openingResize, context, event, target)` and call it from `startDirectGesture`. Do not raise the budget.

- [ ] **Step 4: Wire the deps through**

In `src/presentation/editor/tools/registerEditorTools.ts`, add the six doors to `EditorToolDeps` (it already extends `ElementResizeDeps`, so add `OpeningResizeDeps` the same way) and forward them in the `new SelectTool({ … })` literal:

```ts
			openingHandles: deps.openingHandles, stepOpening: deps.stepOpening, flipOpening: deps.flipOpening,
			openingTarget: deps.openingTarget, previewOpening: deps.previewOpening, commitOpening: deps.commitOpening,
```

In `src/presentation/editor/runtime.ts`, at the `registerEditorTools(toolManager, { … })` call, add the implementations. `structureActions` is already in scope there, and so are `projectStore` and `workspace`/`session` through the surrounding composition:

```ts
		openingTarget: (id) => {
			const opening = projectStore.structure.openings.find(item => item.id === id);
			const host = projectStore.structure.walls.find(wall => wall.id === opening?.hostId);
			return opening && host ? { opening, host } : null;
		},
		openingHandles: () => {
			const ids = selection.selectedIds;
			const opening = ids.length === 1 ? projectStore.structure.openings.find(item => item.id === String(ids[0])) : undefined;
			const host = projectStore.structure.walls.find(wall => wall.id === opening?.hostId);
			return opening && host
				? { id: opening.id, handles: openingHandles(opening, host, worldPerScreenPixel(editorStore.viewport, STAGE_PIXELS)) }
				: null;
		},
		previewOpening: structureActions.previewOpening,
		commitOpening: (id, next) => { void structureActions.applyOpening(id, () => next); },
		stepOpening: (id, deltaMm) => { void structureActions.applyOpening(id, (opening, host) => steppedOpening(opening, host, deltaMm)); },
		flipOpening: (id, side) => { void structureActions.applyOpening(id, opening => flippedOpening(opening, side)); },
```

Two things to notice, and both are the point of routing every door through `applyOpening`:

- `commitOpening` ignores the baseline's opening and writes the dragged one. That is correct — the drag's arithmetic was done against what the user could see, and `applyOpening` still validates it against the baseline structure and still refuses a stale one.
- `stepOpening` and `flipOpening` transform the **baseline's** opening, so two taps in quick succession accumulate rather than the second overwriting the first.

Use whatever the surrounding code already calls the selection store and editor store in that function; if `worldPerScreenPixel`/`STAGE_PIXELS` are not already imported in `runtime.ts`, import them from `./viewport/Viewport`.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run check:fast -- tests/presentation/editor/
```

Expected: PASS. This is the first task whose blast radius is the whole editor test directory — run all of it, not just the new file.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/tools/select-tool.ts src/presentation/editor/tools/registerEditorTools.ts src/presentation/editor/runtime.ts tests/presentation/editor/structure/openingHandleGestures.test.ts
git commit -m "feat(openings): dispatch opening handle taps and drags from Select

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Drawing the handles

**Files:**
- Create: `src/presentation/editor/structure/OpeningHandles.vue`
- Modify: `src/presentation/editor/layers/InteractionLayer.vue`
- Test: `tests/presentation/editor/structure/openingHandlesComponent.test.ts` *(create)*

**Interfaces:**
- Consumes: `openingHandles` (Task 2), `OPENING_HANDLE_RADIUS_PX`, `OPENING_CHEVRON_GAP_PX`, `ThemeTokens`, `worldToScreen`/`worldPerScreenPixel`/`STAGE_PIXELS` from `../viewport/Viewport`.
- Produces: a component taking `{ tokens: ThemeTokens }`, mounted inside the `InteractionLayer`'s `VLayer`.

Background — **open `src/presentation/editor/elements/TransformBoxHandles.vue` and copy its shape.** Everything on the `InteractionLayer` works in STAGE PIXELS and is `listening: false`; world points go through `worldToScreen` in a `computed`, which is what keeps a handle a constant size at every zoom. The layer hears no pointer events at all — `SelectTool` does the hit testing from the same `openingHandles` call — so do not add a `listening: true` node, a `mouseover` or a cursor here.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structure/openingHandlesComponent.test.ts`.

**This file mounts a component, so it needs `// @vitest-environment jsdom` at the top** — a node-environment spec that reaches a `.vue` file is refused outright by `scripts/vitest-no-ssr-sfc.mjs`, naming the file.

Lift the mount helper from the sibling Konva-component test (`grep -rl "TransformBoxHandles" tests/`), including how it seeds the stores and how it reads nodes back out of a `vue-konva` tree in jsdom — `nodesOf` below is this plan's name for whatever that file already uses.

```ts
// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import OpeningHandles from '../../../../src/presentation/editor/structure/OpeningHandles.vue';
import type { Opening, Structure, Wall } from '../../../../src/domain/spatial/Structure';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
const structure: Structure = { walls: [wall], openings: [door], boundaries: [] };

beforeEach(() => { setActivePinia(createPinia()); });

/** Mounts the component against a seeded editor, and answers every Konva config it drew. */
function drawn(options: { structure?: Structure; selectedIds?: string[]; zoom?: number; perspective?: string } = {}) {
	const wrapper = mountHandles(OpeningHandles, {   // the sibling test's helper
		structure: options.structure ?? structure,
		selectedIds: options.selectedIds ?? ['opening-a'],
		zoom: options.zoom ?? 1,
		perspective: options.perspective ?? 'plan',
	});
	return nodesOf(wrapper);
}

it('draws seven marks for a selected door', () => {
	// Two width circles, one move circle, two step arrows, two chevrons.
	expect(drawn()).toHaveLength(7);
});

it('draws five for a plain opening, none of them a chevron', () => {
	const openings = [{ ...door, kind: 'opening' as const }];
	const nodes = drawn({ structure: { ...structure, openings } });
	expect(nodes).toHaveLength(5);
	expect(nodes.every(node => node.name !== 'opening-chevron')).toBe(true);
});

it('draws three for a crowded door — the move grip and its two chevrons', () => {
	// At this zoom the centre-line marks are under the separation floor; the chevrons are off it.
	const nodes = drawn({ zoom: 0.01 });
	expect(nodes).toHaveLength(3);
	expect(nodes.filter(node => node.name === 'opening-chevron')).toHaveLength(2);
});

it('draws nothing with no selection, a multi-selection, or a selected wall', () => {
	expect(drawn({ selectedIds: [] })).toHaveLength(0);
	expect(drawn({ selectedIds: ['opening-a', 'wall-a'] })).toHaveLength(0);
	expect(drawn({ selectedIds: ['wall-a'] })).toHaveLength(0);
});

it('draws nothing outside the Plan perspective', () => {
	expect(drawn({ perspective: 'renovate' })).toHaveLength(0);
	expect(drawn({ perspective: 'review' })).toHaveLength(0);
});

it('listens for no pointer events, on every node it draws', () => {
	// The interaction layer hears nothing; `SelectTool` hit tests the same points from geometry.
	expect(drawn().every(node => node.listening === false)).toBe(true);
});

it('takes every colour from the theme tokens', () => {
	// No literal colour: each stroke or fill is one of the tokens the component was handed.
	const tokens = new Set(Object.values(themeTokensUsed));   // the sibling test's token fixture
	for (const node of drawn()) {
		for (const colour of [node.fill, node.stroke].filter(Boolean)) expect(tokens.has(colour as string)).toBe(true);
	}
});
```

The `name` values (`'opening-chevron'`, and one per grip family) are yours to choose in Step 3 — pick them there and make these assertions match.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run check:fast -- tests/presentation/editor/structure/openingHandlesComponent.test.ts
```

Expected: FAIL — the component does not exist.

- [ ] **Step 3: Write the component**

Create `src/presentation/editor/structure/OpeningHandles.vue`. Draw the width and move grips as `VCircle` at `OPENING_HANDLE_RADIUS_PX`, the step arrows as `VCircle` of the same radius in a second colour, and the chevrons as `VLine` chevron strokes. Take every colour from `props.tokens` — **no literal colour anywhere**, which SDD §84's check would refuse in a stylesheet and which review refuses here.

Gate the whole group on the same conditions Task 6's `openingHandles` door gates on plus the perspective, mirroring how `TransformBoxHandles.vue` returns `null` from its `drawn` computed:

```ts
const drawn = computed(() => {
	if (renovationSession.perspective !== 'plan' || runtime.activeToolId.value !== 'select') return null;
	// … resolve the single selected opening and its host, exactly as runtime.ts's `openingHandles` does
});
```

If that resolution is more than a few lines, export it from `openingHandles.ts` as `selectedOpeningHandles(structure, selectedIds, worldPerPixel)` and call it from BOTH here and `runtime.ts` — the two must never be able to disagree about which handles exist, and a second hand-written copy is exactly how they would.

- [ ] **Step 4: Mount it**

In `src/presentation/editor/layers/InteractionLayer.vue`, import it and mount it beside `<TransformBoxHandles>`:

```vue
		<OpeningHandles :tokens="props.tokens" />
```

Add one sentence to that file's docblock naming the new family, since its header lists what the layer draws.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run check:fast -- tests/presentation/editor/ tests/harness/
```

Expected: PASS. `tests/harness/accessibility*.test.ts` scans the real mounted Plan Editor, so a malformed node shows up there.

- [ ] **Step 6: Look at it**

```bash
npm run harness-shot -- --width=460
```

Then open `harness-shots/` and look at the plan-editor captures in both schemes. These captures have caught ten defects the whole of `npm run check` could not — every one a measurement no layout engine in this repository performs. Check: are the marks distinguishable at 460 px, do the chevrons clear the wall faces, is the step arrow far enough from the move grip to aim at?

If the pinned Chromium is absent, the script refuses rather than hunting a substitute. `npx playwright install chromium` is the fix on a laptop; in a container, set `RP_CHROMIUM_EXECUTABLE=/path/to/chrome` — the capture then prints that it is not the pinned build, so the caveat travels with the picture. If neither is available, say so in the PR rather than skipping silently.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/structure/OpeningHandles.vue src/presentation/editor/layers/InteractionLayer.vue tests/presentation/editor/structure/openingHandlesComponent.test.ts
git commit -m "feat(openings): draw a selected opening's handles on the interaction layer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The half no gate can see

**Files:**
- Create: `docs/tests/cases/Adjust an opening with its canvas handles.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md`

**Interfaces:** none — this task ships documentation and a live-vault procedure.

Background: `?view=plan-editor` in the browser harness runs **without renovation services**, so a handle press there fails with a save error. The captures in Task 6 prove the handles are drawn and positioned; nothing automated in this repository can prove one writes. That is what this case is for.

- [ ] **Step 1: Write the case**

Follow the shape of an existing case in `docs/tests/cases/` — including its Runs table. Steps, each with an expected result:

1. `npm run test-build`, open the vault, run **Create sample project** from the palette.
2. Draw a wall, place a door on it, select the door. → Seven handles appear.
3. Drag an end circle outward. → The opening widens from that edge only; the other edge does not move. Release. → The width persists; the note on disk shows the new `width` and `offset`.
4. Undo. → The previous width returns.
5. Drag the centre circle along the wall. → The opening slides, keeping its width. Drag past the wall's end. → It stops with its whole width on the wall.
6. Press a green arrow. → The opening moves 10 mm. Shift-press it. → 100 mm.
7. Press the orange chevron on the far side of the wall. → The door's swing arc redraws on that side. Press the near one. → It comes back.
8. Press a chevron on a plain opening. → There is no chevron to press.
9. Repeat step 3 against a **curved** wall. → The handles sit on the arc, not on a straight chord.
10. Switch to Renovate, then Review. → No handles in either.
11. Zoom far out. → The step arrows disappear, then everything but the centre grip; nothing overlaps.

- [ ] **Step 2: State plainly that it has not been run**

The case's Runs table gets no row until someone runs it in a vault. An unrun manual case is a plan to find out, not a finding — do not record it as walked, and say in the pull request description that it is outstanding.

- [ ] **Step 3: Link it from the suite**

Add the case to `docs/tests/suites/Smoke Test the Editor.md` beside the other opening cases.

- [ ] **Step 4: Run the full gate**

```bash
npm run check
```

Expected: PASS — all four steps. If two sessions are working in this repository at once, push and let CI run this instead; two local gates thrash `coverage/.tmp/` and produce a wrong red rather than a slow one.

- [ ] **Step 5: Commit**

```bash
git add docs/tests/cases/ docs/tests/suites/
git commit -m "docs(openings): a live-vault case for the handles no gate can drive

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Plan self-review

Run against the spec after Task 8, before opening the pull request.

**Spec coverage:** Goal → Tasks 1–7. Out of scope (readouts) → nothing implements them; confirm no task drew a dimension label. Decision 1 (approach A) → Tasks 4, 5, 7. Decision 2 (domain transforms) → Task 1. Decision 3 (one target kind) → Task 4. Decision 4 (no model change) → confirm `Opening` in `Structure.ts` is untouched. Decision 5 (no snapping) → confirm `OpeningResize` writes no `snapGuides`. Decision 6 + Amendment 1 (fifth collaborator) → Task 3; confirm `openingMove.ts` has no diff. Handle layout → Task 2. Interaction → Tasks 5, 6. Write path → Task 3. Testing → every task's own steps, plus Task 8.

**Type consistency:** `OpeningGrip` is the name in Tasks 2, 4 and 6; `OpeningDragGrip` is the narrower three-member type in Task 5 only. `applyOpening`/`previewOpening` are the names in Tasks 3 and 6. `openingHandles` is both the module and the `SelectToolDeps` door — that is deliberate and they resolve differently at each site.

**One thing to verify rather than assume:** Task 6's `runtime.ts` snippet names `selection` and `editorStore`. Those are this plan's names for whatever that function already calls them. Read the surrounding code and use its names; do not introduce a second store handle.
