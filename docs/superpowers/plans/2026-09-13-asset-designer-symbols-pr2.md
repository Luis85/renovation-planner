# Asset designer symbols, PR 2 (selection, part editing, drawing tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A renovator selects one part of an asset's design — footprint, clearance, a detail, the anchor or the facing — and moves, resizes, rotates, reshapes, bends, duplicates, reorders or deletes it, draws new details, and scales a curved design by typed dimensions, every gesture one undoable write.

**Architecture:** Every edit is a pure domain function over `AssetShape` (`src/domain/asset/shapeEdits.ts`) answering a validated shape or a refusal; presentation dispatches the result through the existing reversible `SetAssetShape` adapter, conditional on the version the leaf read. The selection and its mode live in the designer's per-leaf `assetDesignStore`; hit-testing, handle placement and drag arithmetic are pure presentation modules under `src/presentation/designer/selection/`; a designer `select` tool drives them and delegates Bend edges to the plan editor's `CurveTool`.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Konva via vue-konva, vitest 4 (jsdom per file), Obsidian plugin API.

**Spec:** [`docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`](../specs/2026-09-13-asset-designer-symbols-design.md) — Decisions 9–11, the "Inspector for the selection" half of Presentation, the matching Testing bullets, and **Amendment 1** (read it: it records the item-curve measurement, the five extra edit functions, the six refusal codes and the selection details decided while planning).

## Global Constraints

- **Layers:** `presentation → application → domain → core`; `infrastructure → application ports → domain → core`. No `vue`, `pinia`, `konva` or `obsidian` in `core/`, `domain/`, `application/`. `presentation/dialogs/` may not import application, infrastructure, plugin or `core/events`.
- **Nothing writes to the vault outside `infrastructure/`.**
- **Budgets (ESLint, blank lines and comments not counted):** `src/**` ≤ 400 lines per file, ≤ 100 lines per function, complexity ≤ 16, max-params 5; `tests/**` ≤ 450 lines per file. `src/presentation/i18n/locales/en.ts` is at 399/400 and `de.ts` at 398/400 — **add no keys there**; every new key goes in `src/presentation/i18n/locales/en/assetSymbols.ts` and `src/presentation/i18n/locales/de/assetSymbols.ts` (already spread through `locales/{en,de}/editor.ts`; the `de` record is typed `Record<keyof typeof assetSymbolsEn, string>`, so a missing German string is a build error). `src/presentation/designer/runtime.ts` is ~417 lines with comments — count ESLint's figure before adding to it, and move new runtime helpers into `src/presentation/designer/selection/` modules when it would pass 400.
- **Every user-visible string in `en` AND `de`.** English UI text is sentence case (lint-enforced). German avoids du-form imperatives. A refusal code `asset.<code>` is shown through `trError`, which looks up the locale key equal to the code — so each new code in Global Constraint "Refusal codes" gets a key of exactly that name.
- **Refusal codes (spec Amendment 1), all through `assetError(code, message)`:** `part-not-found`, `vertex-out-of-range`, `invalid-scale`, `detail-at-limit`, `no-details`, `details-await-scale`.
- **No hard-coded colours in CSS** — Obsidian CSS variables only. Styles live in `styles/*.css` partials (≤ 400 lines each), never in a `.vue` `<style>` block. Canvas colours come from `ThemeTokens`.
- **No inline styles**, no `innerHTML`, no global `app`.
- **No new dependencies.**
- **Geometry conventions:** millimetres; y grows DOWN the screen; outlines wound top-left → top-right → bottom-right → bottom-left, with which a positive bulge bows outward. Translation, rotation and positive scaling leave a bulge unchanged; only a mirror flips its sign, and nothing in this PR mirrors (a non-positive scale is refused as `asset.invalid-scale`).
- **One gesture = one `SetAssetShape` dispatch = one undo entry, applied whole or refused whole.** A domain refusal is reported through `reportInvalidInput` (or shown in the inspector) and dispatches NOTHING. Every dispatch goes through the leaf's mapped `toolDispatcher` / `EditorContext.commandDispatcher`, never a command's own `execute`.
- **Every selection gesture passes `expected: design.geometryVersion`** (the store's `AssetDesignDto.geometryVersion` at the moment the gesture started) in `SetAssetShapeInput`, so a peer write since the read refuses it (PBI extension 4b).
- **A selection writes nothing.** Selecting, changing mode and hovering never dispatch.
- **Plan editor selection behaviour does not change** (PBI acceptance criterion 6). `src/presentation/editor/tools/select-tool.ts` and `escapeRouting.ts` are not edited.
- **`src/application/commands/asset/SetAssetShape.ts` must not contain the word "undo"** anywhere (comments included) — `tests/application/events/reversibleWritePathDiscovery.test.ts` would then demand a census entry.
- **Fallow:** every new export must have a `src/` consumer (a test-only consumer is an `unused-exports` finding); no copied logic blocks (clone detector). Annotate a local with its class type where fallow must resolve a member (`const tool: DesignerSelectTool = …`).
- **Coverage floors are 99/99/99/98, counted per branch arm.** Write the test for every arm with the code; do not add a guard no test can reach — delete it instead.
- **Inner loop per task:** `npm run check:fast -- <test paths>` (oxlint + `vue-tsc -noEmit` + vitest on the paths). It omits ESLint (and oxlint does not read `.vue`), so before each commit also run `npx eslint <every src/test file you touched>`. Do **not** run the full `npm run check` locally — CI runs it on the PR. Run commands in the FOREGROUND with a generous timeout (up to 600000 ms); a backgrounded command never wakes you. If a vitest case times out, re-run with `npm run check:fast -- <paths> --testTimeout=20000` before believing it.
- **A task that widens a shared contract** (`AssetShape`, `EditorContext`, `ToolId`, a command bundle, `RenderState`, `DESIGNER_TOOL_LABELS`, `assetDesignStore`'s returned members) also runs `npm run check:fast -- tests/presentation tests/helpers` before committing.
- **TDD:** write the test, run it and watch it FAIL for the stated reason, then implement. If an expectation in this plan is wrong, STOP and report it — never edit the expectation to match the code.
- **IDE diagnostic blocks that appear mid-edit are usually stale.** Trust `vue-tsc` output.
- **If `node_modules` in the worktree is empty, run `npm ci` first.**
- **No `git stash`. No subagents.**
- **Commits** end with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` (this overrides any model name you would otherwise write).

---

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `src/domain/asset/shapeEdits.ts` (new) | `OutlinePart`, outline edits, anchor/facing/clearance edits, `scaleDesign` | 1 |
| `src/domain/asset/detailEdits.ts` (new) | `NewDetail`, `nextDetailId`, detail add/duplicate/delete/reorder/update, `fitFootprintToDetails` | 2 |
| `src/domain/asset/captureAwaitsScale.ts` (new), `src/application/commands/asset/updateAssetShape.ts` | the capture rule, moved to the domain | 2 |
| `src/presentation/i18n/locales/{en,de}/assetSymbols.ts` | every new string | 1, 2, 6, 9, 10 |
| `src/presentation/designer/selection/designerSelection.ts` (new) | `DesignerSelection`, `SelectionMode`, `partKey`, `selectionExists`, `sameSelection` | 3 |
| `src/presentation/designer/selection/handles.ts` (new) | `selectionHandles` — where a selection's handles sit | 3 |
| `src/presentation/designer/selection/hitTest.ts` (new) | `hitDesign` — the six-step hit order | 3 |
| `src/presentation/designer/selection/snapCandidates.ts` (new) | `designerSnapCandidates` | 3 |
| `src/presentation/designer/layers/anchorLayer.ts` | exports `facingTip` | 3 |
| `src/presentation/designer/stores/assetDesignStore.ts` | `selection`, `mode`, `preview`, pruning on hydrate | 3 |
| `src/presentation/designer/selection/selectionDrag.ts` (new) | `draggedShape` — drag arithmetic per handle role | 4 |
| `src/presentation/designer/tools/designer-select-tool.ts` (new) | the `select` tool: Transform and Edit points | 5 |
| `src/presentation/designer/tools/registerDesignerTools.ts`, `runtime.ts`, `DesignerCanvas.vue`, `DesignerToolbar.vue`, `DesignerSelectionModes.vue` (new), `layers/selectionLayer.ts` (new), `layers/detailsLayer.ts`, `src/presentation/editor/tools/editor-tool.ts` | wiring, drawing the selection and preview, mode control, Escape | 6 |
| `designer-select-tool.ts` | Bend edges through `CurveTool` | 7 |
| `src/presentation/designer/designerKeys.ts` (new), `AssetDesignerRoot.vue`, `DesignerCanvas.vue` | Delete, arrows, Ctrl+D | 8 |
| `src/presentation/designer/inspector/DesignerSelectionInspector.vue` (new, may split), `DesignerInspector.vue`, `styles/designer.css` | inspector per selection | 9 |
| `src/presentation/designer/tools/draw-detail-tool.ts` (new), `registerDesignerTools.ts`, `layers/DesignerGestureLayer.vue`, `src/presentation/editor/snapping/editorSnapping.ts` | `draw-rect`, `draw-circle`, `trace-detail` | 10 |
| `AssetDesignerRoot.vue`; `src/presentation/editor/elements/{assetShapeConfig.ts,AssetShapes.vue}` | Set dimensions → `scaleDesign`; plan-side footprint restroke and carry-overs | 11 |
| `tests/harness/{assetDesigner,page}.ts`, `scripts/harness-shot.mjs`, `docs/tests/cases/Design an Asset.md`, `docs/requirements/*.md`, `docs/issues/*.md`, `CHANGELOG.md` | captures, manual steps, backlog, changelog | 12 |

---

## Planning conflicts

The task sections below were drafted against a fixed interface outline by three drafters. Where the outline was
wrong against the real code, the drafter recorded it here and drafted the task against the fix — so the tasks
already contain every fix. Kept for review: each is a decision a reviewer may want to question.

### A — Tasks 1–4

<!--
OUTLINE CONFLICT notes (drafted against the fix in each case):

OUTLINE CONFLICT 1 — `moveVertex` "(`preservePointCurves`)". `preservePointCurves` answers a `Result`
whose `curve-topology-ambiguous` arm needs a CHANGED point count; a vertex move never changes it, so
routing through it adds a refusal arm no test can reach (coverage floor 98% branches, Global
Constraint "do not add a guard no test can reach"). Fix: `{ ...outline, points }` — the same rule
(bulges kept because the count is unchanged) without the dead arm. Behaviour identical.

OUTLINE CONFLICT 2 — Task 4 "let the outline lookup answer part-not-found through Task 1's functions
(no extra branch)". A box or rotate drag needs the outline's BOX before it can call `resizeBox` /
`rotateOutline` (factors and centre come from it), so a lookup that can miss happens before any
Task 1 function is reached. Fix: one private `boxOf` whose null arm answers `err(partNotFound(part))`
and IS tested (a stale selection with a box role). This needs `partNotFound` exported from
`shapeEdits.ts` (also used by `detailEdits.ts` so the refusal has one spelling) — an export the
outline does not list.

OUTLINE CONFLICT 3 (addition, not a contradiction) — `handles.ts` also exports
`boxHandlePoint(box, index): Point`, consumed by `selectionDrag.ts`: the fixed origin of a resize from
handle i is exactly handle (i + 4) % 8's point, so the drag asks the handle module instead of keeping
a second copy of the handle layout.

Every expected number in Tasks 1–4 was executed against the real `src/` in a scratch copy (122 tests
green, `tsc --strict` clean, oxlint clean with the worktree's `.oxlintrc.json`, every new module at
100% statements/branches/functions/lines under v8).
-->

### B — Tasks 5–8

# Draft — Tasks 5, 6, 7 and 8

#### OUTLINE CONFLICT notes (each drafted against the proposed fix)

1. **OUTLINE CONFLICT: "a generation counter … exactly as `SetFacingTool` does".** `SetFacingTool` has
   no counter — its docblock records deleting one (`src/presentation/designer/tools/set-facing-tool.ts`,
   "No generation counter, and its absence is a decision"). The counters that exist are
   `DrawPolygonTool`'s and `CalibrateTool`'s. The need is real here (the preview is cleared AFTER the
   dispatch settles). Fix: `DesignerSelectTool` keeps `previewGeneration`, bumped every time it WRITES a
   preview (not at press), and a settling commit clears the preview only if no preview was written
   since. Bumping at press would strand an earlier gesture's preview under a later click on a handle
   (a handle press calls no `select`, so nothing else clears it). The refusal is reported
   unconditionally, per `SetFacingTool`'s rule.
2. **OUTLINE CONFLICT: vertex/anchor snap tolerance.** The outline's
   `snapService.snapPoint(worldPoint, candidates)` uses `EDITOR_SNAP_SERVICE`'s world-fixed
   `SNAP_TOLERANCE_MM = 8` (`editorSnapping.ts`), which is 0.8 px at the designer's default camera
   (10 mm per px) — snapping would be unobservable. `DrawPolygonTool` passes
   `SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel()` (`draw-polygon-tool.ts:325`). Fix: pass
   that third argument.
3. **OUTLINE CONFLICT: Bend target `{ kind: 'room', geometry: whole outline }`.** `CurveTool.pointerDown`
   takes `curveEdges(target).find(...)` — the FIRST edge whose midpoint is within 22 px, not the nearest.
   On the toilet's tank at the rig's default camera the right edge's midpoint is 21.5 px from the top
   edge's, so pressing the right midpoint bends the TOP edge. Fix (no plan-editor change): the target is
   a single-edge `kind: 'wall'` built from the edge `hitDesign` found
   (`{ points: [start, end], bulges: [bulge, 0] }`); `curveEdges`' wall arm yields exactly index 0, and
   `set(0, bulge)` writes `setBulge(shape, part, hitEdge, bulge)`. `bulgeAt` reads only start/end, so the
   sign convention is unchanged. `target()`'s `null` arm is not written: the select tool forwards
   `pointerDown` to the curve tool only on an edge-handle hit, and `CurveTool.hasDraft()` (the other
   caller) is never asked, so that arm is unreachable.
4. **OUTLINE CONFLICT (budget premise):** `runtime.ts` is **189** ESLint-counted lines (measured with
   `max-lines` at 1), not ~417 — but `buildRuntime` is **97 of 100** under `max-lines-per-function`
   (measured the same way). The wiring below adds a net **+1** line to `buildRuntime`: `selectToolDeps`
   is a module-level function (like `calibrationDeps`), `editShape` is one line in the return object, and
   the `const returnToCamera` line is deleted in favour of an inline `returnToSelect`. `createEditShape`
   lives in `src/presentation/designer/selection/editShape.ts` anyway, so its three arms are tested as a
   pure function (it is `createEditShape(design, write)`, two parameters rather than one `deps`).
5. **Refinement, not a conflict:** Delete/Backspace also ignores an OS autorepeat and an IME
   composition (`plainPress` from `editor/surface/keyboard.ts`): a held Delete would otherwise dispatch a
   second, stale write before the first refresh landed.

### C — Tasks 9–12

OUTLINE CONFLICT: `styles/designer.css` is 366 lines today and Task 6 adds the mode control's rules to it; the assembler (`scripts/styles-assemble.mjs`, `MAX_LINES = 400`, raw lines) refuses a partial over 400. Task 9's rules (~45 lines) cannot also go there. Fix: Task 9 creates `styles/designer-selection.css` and adds `@import "./designer-selection.css";` after `@import "./designer.css";` in `styles/index.css` (line 76 today).

OUTLINE CONFLICT: Task 10's detail `pending` needs `design.calibration` and `design.background`, but the only design reader `registerDesignerTools` receives after Task 6 is `DesignerSelectToolDeps.design()`, which answers `{ shape, geometryVersion }` only. Fix: `DesignerToolDeps` gains `readonly detailPending: (shape: AssetShape) => boolean`, built in `runtime.ts` over `captureAwaitsScale`.

OUTLINE CONFLICT (mild, file list): Task 9 must also edit `tests/presentation/designer/designerInspector.test.ts` — `DesignerInspector` gains three REQUIRED props, so its bare mount stops type-checking without them.

OUTLINE CONFLICT (mild, file list): adding rows to `docs/tests/cases/Design an Asset.md` makes the tier table in `docs/tests/suites/Smoke Test the Editor.md` ("The triage column", 110/54/153/14/13, "344 steps") stale. Task 12 re-runs that section's two greps and updates the table and its total sentence. Step 5 of `Design an Asset.md` ("Six tool buttons … Pan, Trace footprint …") becomes false with Tasks 6 and 10 and is corrected in Task 12.

Not a conflict, measured: `elementFootprint(element, shapeOf)` for an asset whose shape reads is exactly `placedOutline(element, shape).footprint` (`src/presentation/editor/elements/elementFootprint.ts` line 16), so Task 11 derives `footprint` from `placed.footprint` without changing behaviour and keeps `elementFootprint` for the placeholder arm.


These four tasks are drafted against the tree AFTER Tasks 1–8. Where an edit quotes text a previous task writes (`DESIGNER_TOOL_LABELS` after Task 6, `returnToSelect`, `selectTool`, `editShape`), the quoted text is the outline's decided text; where Tasks 6 or 8 may have reshaped a line in `AssetDesignerRoot.vue` or `runtime.ts`, the step says what to look for.

### D — Controller rulings on the drafts

- Task 5's `tests/helpers/designerSelection.ts` builds `TOILET` from Task 3's `toiletShape()` (`tests/helpers/assetShapes.ts`) rather than a second copy of the preset build.
- Task 9's Delete and Duplicate buttons should call Task 8's `selectionKeyActions(store, editShape)` when its signature fits, rather than a second copy of delete / duplicate-and-select; if they keep their own, `npx fallow dupes` must stay clean.
- The backlog notes this PR closes finish on 2026-09-14; `Start an asset from a preset.md` finishes on 2026-09-13, the day #197 merged.

---

### Task 1: Outline edits in the domain — `src/domain/asset/shapeEdits.ts`

**Files:**
- Create: `src/domain/asset/shapeEdits.ts`
- Create: `tests/helpers/assetShapes.ts`
- Test: `tests/domain/asset/shapeEdits.test.ts`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`
- Modify (test): `tests/presentation/i18n/toUserMessage.test.ts` (three `MINTED` rows — the table that proves a code resolves to its own copy rather than the category sentence; ~424 counted lines today, +3)

**Interfaces:**
- Consumes: `validateAssetShape(shape): Result<AssetShape, ValidationError>` (`AssetShape.ts`), `assetError(code, message)` (`Asset.errors.ts`), `translate`, `rotate` (`core/geometry/operations.ts` — both spread the polygon they map, so `bulges` survive; `scale` is uniform only and is NOT used).
- Produces:
```ts
export type OutlinePart =
  | { readonly kind: 'footprint' }
  | { readonly kind: 'clearance' }
  | { readonly kind: 'detail'; readonly id: string };
/** The outline a part names, or null when the shape has no such part. */
export function outlineOf(shape: AssetShape, part: OutlinePart): CurvedPolygon | null;
export function moveOutline(shape: AssetShape, part: OutlinePart, by: Vector): Result<AssetShape, ValidationError>;
export function moveVertex(shape: AssetShape, part: OutlinePart, index: number, to: Point): Result<AssetShape, ValidationError>;
export function setBulge(shape: AssetShape, part: OutlinePart, edge: number, bulge: number): Result<AssetShape, ValidationError>;
export function resizeBox(shape: AssetShape, part: OutlinePart, factors: { readonly sx: number; readonly sy: number }, origin: Point): Result<AssetShape, ValidationError>;
export function rotateOutline(shape: AssetShape, part: OutlinePart, radians: number, origin: Point): Result<AssetShape, ValidationError>;
export function moveAnchor(shape: AssetShape, to: Point): Result<AssetShape, ValidationError>;
export function setFacing(shape: AssetShape, radians: number): Result<AssetShape, ValidationError>;
export function removeClearance(shape: AssetShape): Result<AssetShape, ValidationError>;
export function scaleDesign(shape: AssetShape, sx: number, sy: number): Result<AssetShape, ValidationError>;
// addition (OUTLINE CONFLICT 2): one spelling of the refusal, used by detailEdits.ts and selectionDrag.ts
export function partNotFound(part: OutlinePart): ValidationError;
```

- [ ] **Step 1: Write the failing test**

Create `tests/helpers/assetShapes.ts`:

```ts
/**
 * Asset shapes the part-edit, selection and drag suites act on, built through the domain's own
 * validation so a fixture cannot stand in for a shape the domain would refuse.
 */
import { validateAssetShape, type AssetShape } from '../../src/domain/asset/AssetShape';
import { circle, rect } from '../../src/domain/asset/presets/presetGeometry';
import { expectOk } from './domain';

/** The bulge of a quarter-circle edge — what `circle` gives each of its four edges. */
export const QUARTER = Math.tan(Math.PI / 8);

/**
 * Every kind of part at round numbers: a 1000 x 600 footprint centred on the origin, a 1400 x 1000
 * clearance reaching 400 further toward +y, a straight solid `detail-1` ("top", 400 x 200 centred on
 * (-200, 0)) and a curved, dashed, PENDING `detail-2` ("bowl", a circle of diameter 200 centred on
 * (250, 0)). Anchor at the origin, facing +x.
 */
export function editableShape(overrides: Partial<AssetShape> = {}): AssetShape {
	return expectOk(
		validateAssetShape({
			footprint: rect(1000, 600),
			footprintOrigin: 'typed',
			footprintPending: false,
			clearance: rect(1400, 1000, 0, 200),
			clearancePending: false,
			anchor: { x: 0, y: 0 },
			anchorPending: false,
			facing: 0,
			details: [
				{ id: 'detail-1', name: 'top', outline: rect(400, 200, -200, 0), line: 'solid', pending: false },
				{ id: 'detail-2', name: 'bowl', outline: circle(200, 250, 0), line: 'dashed', pending: true },
			],
			...overrides,
		}),
	);
}
```

Create `tests/domain/asset/shapeEdits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { circle } from '../../../src/domain/asset/presets/presetGeometry';
import {
	moveAnchor,
	moveOutline,
	moveVertex,
	outlineOf,
	removeClearance,
	resizeBox,
	rotateOutline,
	scaleDesign,
	setBulge,
	setFacing,
	type OutlinePart,
} from '../../../src/domain/asset/shapeEdits';
import { editableShape, QUARTER } from '../../helpers/assetShapes';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Spec 2026-09-13 Decision 9 and Amendment 1: every part edit answers a validated shape or a
 * refusal. `editableShape` puts every kind of part at round numbers, so a straight result is
 * compared exactly and one that went through trigonometry is compared through `near`.
 */
const FOOTPRINT: OutlinePart = { kind: 'footprint' };
const CLEARANCE: OutlinePart = { kind: 'clearance' };
const TOP: OutlinePart = { kind: 'detail', id: 'detail-1' };
const BOWL: OutlinePart = { kind: 'detail', id: 'detail-2' };
const MISSING: OutlinePart = { kind: 'detail', id: 'detail-9' };
const ALL_QUARTERS = [QUARTER, QUARTER, QUARTER, QUARTER];

const near = (pairs: readonly (readonly [number, number])[]) =>
	pairs.map(([x, y]) => ({ x: expect.closeTo(x, 9), y: expect.closeTo(y, 9) }));

describe('outlineOf', () => {
	it('names the footprint, the clearance and a detail by id', () => {
		const shape = editableShape();
		expect(outlineOf(shape, FOOTPRINT)).toBe(shape.footprint);
		expect(outlineOf(shape, CLEARANCE)).toBe(shape.clearance);
		expect(outlineOf(shape, BOWL)).toBe(shape.details[1].outline);
	});

	it('answers null for a clearance the shape has not got and for an unknown detail', () => {
		expect(outlineOf(editableShape({ clearance: null }), CLEARANCE)).toBeNull();
		expect(outlineOf(editableShape(), MISSING)).toBeNull();
	});
});

describe('moveOutline', () => {
	it('moves the footprint and keeps its origin and pending flag', () => {
		const traced = editableShape({ footprintOrigin: 'traced', footprintPending: true });
		const moved = expectOk(moveOutline(traced, FOOTPRINT, { dx: 10, dy: -20 }));
		expect(moved.footprint.points).toEqual([{ x: -490, y: -320 }, { x: 510, y: -320 }, { x: 510, y: 280 }, { x: -490, y: 280 }]);
		expect([moved.footprintOrigin, moved.footprintPending]).toEqual(['traced', true]);
	});

	it('moves a pending curved detail as itself, and leaves its neighbour alone', () => {
		const before = editableShape();
		const moved = expectOk(moveOutline(before, BOWL, { dx: 0, dy: 50 }));
		const bowl = moved.details[1];
		expect([bowl.id, bowl.name, bowl.line, bowl.pending]).toEqual(['detail-2', 'bowl', 'dashed', true]);
		expect(bowl.outline.points).toEqual(near([[250, -50], [350, 50], [250, 150], [150, 50]]));
		expect(bowl.outline.bulges).toEqual(ALL_QUARTERS);
		expect(moved.details[0]).toEqual(before.details[0]);
	});

	it('moves the clearance', () => {
		const moved = expectOk(moveOutline(editableShape(), CLEARANCE, { dx: 5, dy: 5 }));
		expect(moved.clearance?.points).toEqual([{ x: -695, y: -295 }, { x: 705, y: -295 }, { x: 705, y: 705 }, { x: -695, y: 705 }]);
	});

	it('refuses a part the shape has not got', () => {
		expect(expectErr(moveOutline(editableShape(), MISSING, { dx: 1, dy: 0 })).code).toBe('asset.part-not-found');
		expect(expectErr(moveOutline(editableShape({ clearance: null }), CLEARANCE, { dx: 1, dy: 0 })).code).toBe('asset.part-not-found');
	});
});

describe('moveVertex', () => {
	it('moves one corner of the footprint', () => {
		const moved = expectOk(moveVertex(editableShape(), FOOTPRINT, 2, { x: 600, y: 400 }));
		expect(moved.footprint.points).toEqual([{ x: -500, y: -300 }, { x: 500, y: -300 }, { x: 600, y: 400 }, { x: -500, y: 300 }]);
	});

	it('keeps a curved outline curved, because the point count is unchanged', () => {
		const moved = expectOk(moveVertex(editableShape(), BOWL, 0, { x: 250, y: -110 }));
		expect(moved.details[1].outline.points[0]).toEqual({ x: 250, y: -110 });
		expect(moved.details[1].outline.bulges).toEqual(ALL_QUARTERS);
	});

	it('refuses a move that leaves the footprint enclosing no area', () => {
		const triangle = editableShape({ footprint: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] } });
		expect(expectErr(moveVertex(triangle, FOOTPRINT, 2, { x: 50, y: 0 })).code).toBe('asset.degenerate-footprint');
	});

	it.each([4, -1, 1.5])('refuses vertex index %s of a four-corner outline', (index) => {
		expect(expectErr(moveVertex(editableShape(), FOOTPRINT, index, { x: 0, y: 0 })).code).toBe('asset.vertex-out-of-range');
	});

	it('refuses a detail the shape has not got', () => {
		expect(expectErr(moveVertex(editableShape(), MISSING, 0, { x: 0, y: 0 })).code).toBe('asset.part-not-found');
	});
});

describe('setBulge', () => {
	it('bends one straight edge, writing a bulge for every edge', () => {
		const bent = expectOk(setBulge(editableShape(), TOP, 1, 0.5));
		expect(bent.details[0].outline.bulges).toEqual([0, 0.5, 0, 0]);
	});

	it('replaces one edge of a curved outline and keeps the others', () => {
		const straightened = expectOk(setBulge(editableShape(), BOWL, 2, 0));
		expect(straightened.details[1].outline.bulges).toEqual([QUARTER, QUARTER, 0, QUARTER]);
	});

	it('refuses a bend past a semicircle under the outline’s own code', () => {
		expect(expectErr(setBulge(editableShape(), FOOTPRINT, 0, 1.5)).code).toBe('asset.invalid-footprint');
	});

	it('refuses an edge the outline has not got', () => {
		expect(expectErr(setBulge(editableShape(), FOOTPRINT, 4, 0.2)).code).toBe('asset.vertex-out-of-range');
	});
});

describe('resizeBox', () => {
	it('scales the footprint about a fixed corner, each axis by its own factor', () => {
		const resized = expectOk(resizeBox(editableShape(), FOOTPRINT, { sx: 1.5, sy: 0.5 }, { x: -500, y: -300 }));
		expect(resized.footprint.points).toEqual([{ x: -500, y: -300 }, { x: 1000, y: -300 }, { x: 1000, y: 0 }, { x: -500, y: 0 }]);
	});

	/**
	 * The spec's stated behaviour: arcs stay circular through their new chords. A circle of diameter
	 * 200 doubled along x keeps four quarter arcs, now through chords of 100√5 with radius 50√10 —
	 * so its width is exactly 400 and its depth bulges past the top and bottom corners to 100√10 − 100.
	 */
	it('keeps bulges through a non-uniform resize', () => {
		const resized = expectOk(resizeBox(editableShape(), BOWL, { sx: 2, sy: 1 }, { x: 250, y: 0 }));
		const bowl = resized.details[1];
		expect(bowl.outline.bulges).toEqual(ALL_QUARTERS);
		expect([bowl.id, bowl.line, bowl.pending]).toEqual(['detail-2', 'dashed', true]);
		const box = expectOk(boundingBoxOf(bowl.outline));
		expect(box.max.x - box.min.x).toBeCloseTo(400, 6);
		expect(box.max.y - box.min.y).toBeCloseTo(100 * Math.sqrt(10) - 100, 6);
	});

	it.each([
		[0, 1],
		[1, -2],
		[Number.NaN, 1],
		[1, Number.POSITIVE_INFINITY],
	])('refuses the factors %s by %s', (sx, sy) => {
		expect(expectErr(resizeBox(editableShape(), FOOTPRINT, { sx, sy }, { x: 0, y: 0 })).code).toBe('asset.invalid-scale');
	});

	it('refuses a clearance the shape has not got', () => {
		const refused = resizeBox(editableShape({ clearance: null }), CLEARANCE, { sx: 2, sy: 2 }, { x: 0, y: 0 });
		expect(expectErr(refused).code).toBe('asset.part-not-found');
	});
});

describe('rotateOutline', () => {
	it('turns the footprint a quarter about the origin', () => {
		const turned = expectOk(rotateOutline(editableShape(), FOOTPRINT, Math.PI / 2, { x: 0, y: 0 }));
		expect(turned.footprint.points).toEqual([{ x: 300, y: -500 }, { x: 300, y: 500 }, { x: -300, y: 500 }, { x: -300, y: -500 }]);
	});

	it('preserves bulges', () => {
		const turned = expectOk(rotateOutline(editableShape(), BOWL, Math.PI / 2, { x: 250, y: 0 }));
		expect(turned.details[1].outline.points).toEqual(near([[350, 0], [250, 100], [150, 0], [250, -100]]));
		expect(turned.details[1].outline.bulges).toEqual(ALL_QUARTERS);
	});

	it('refuses a detail the shape has not got', () => {
		expect(expectErr(rotateOutline(editableShape(), MISSING, 1, { x: 0, y: 0 })).code).toBe('asset.part-not-found');
	});
});

describe('moveAnchor and setFacing', () => {
	it('moves the anchor and keeps its pending flag', () => {
		const moved = expectOk(moveAnchor(editableShape({ anchorPending: true }), { x: 10, y: 20 }));
		expect(moved.anchor).toEqual({ x: 10, y: 20 });
		expect(moved.anchorPending).toBe(true);
	});

	it('refuses an anchor that is not a finite point', () => {
		expect(expectErr(moveAnchor(editableShape(), { x: Number.NaN, y: 0 })).code).toBe('asset.invalid-anchor');
	});

	it('passes the facing through validation, which folds it into one turn', () => {
		expect(expectOk(setFacing(editableShape(), 3 * Math.PI)).facing).toBeCloseTo(Math.PI, 12);
	});

	it('refuses a facing that is not a finite angle', () => {
		expect(expectErr(setFacing(editableShape(), Number.POSITIVE_INFINITY)).code).toBe('asset.invalid-facing');
	});
});

describe('removeClearance', () => {
	it('removes the clearance and its pending flag, which validation refuses on an absent clearance', () => {
		const removed = expectOk(removeClearance(editableShape({ clearancePending: true })));
		expect([removed.clearance, removed.clearancePending]).toEqual([null, false]);
	});

	it('refuses a shape with no clearance', () => {
		expect(expectErr(removeClearance(editableShape({ clearance: null }))).code).toBe('asset.part-not-found');
	});
});

describe('scaleDesign', () => {
	it('scales every part about the anchor, which does not move, and carries pending flags', () => {
		const scaled = expectOk(scaleDesign(editableShape({ anchor: { x: 100, y: 0 } }), 2, 0.5));
		expect(scaled.anchor).toEqual({ x: 100, y: 0 });
		expect(scaled.footprint.points).toEqual([{ x: -1100, y: -150 }, { x: 900, y: -150 }, { x: 900, y: 150 }, { x: -1100, y: 150 }]);
		expect(scaled.clearance?.points).toEqual([{ x: -1500, y: -150 }, { x: 1300, y: -150 }, { x: 1300, y: 350 }, { x: -1500, y: 350 }]);
		expect(scaled.details[0].outline.points).toEqual([{ x: -900, y: -50 }, { x: -100, y: -50 }, { x: -100, y: 50 }, { x: -900, y: 50 }]);
		expect(scaled.details[1].pending).toBe(true);
	});

	it('keeps a circle’s bulges under a non-uniform scale, doubling its width', () => {
		const round = editableShape({ footprint: circle(200), clearance: null, details: [] });
		const scaled = expectOk(scaleDesign(round, 2, 1));
		expect(scaled.footprint.bulges).toEqual(ALL_QUARTERS);
		const box = expectOk(boundingBoxOf(scaled.footprint));
		expect(box.max.x - box.min.x).toBeCloseTo(400, 6);
		expect(scaled.clearance).toBeNull();
	});

	it('refuses a factor that is not a finite positive number', () => {
		expect(expectErr(scaleDesign(editableShape(), 0, 1)).code).toBe('asset.invalid-scale');
	});
});
```

In `tests/presentation/i18n/toUserMessage.test.ts`, add three rows to `MINTED`:

old:
```ts
	['asset.preset-incoherent', 'Validation', 'error.category.validation', 'domain/asset/presets/presetGeometry.ts'],
```
new:
```ts
	['asset.preset-incoherent', 'Validation', 'error.category.validation', 'domain/asset/presets/presetGeometry.ts'],
	// The symbols spec's part edits (Amendment 1).
	['asset.part-not-found', 'Validation', 'error.category.validation', 'domain/asset/shapeEdits.ts'],
	['asset.vertex-out-of-range', 'Validation', 'error.category.validation', 'domain/asset/shapeEdits.ts'],
	['asset.invalid-scale', 'Validation', 'error.category.validation', 'domain/asset/shapeEdits.ts'],
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run check:fast -- tests/domain/asset/shapeEdits.test.ts tests/presentation/i18n/toUserMessage.test.ts`

Expected: `vue-tsc` reports `TS2307: Cannot find module '../../../src/domain/asset/shapeEdits'`; vitest fails `shapeEdits.test.ts` on the unresolved import, and the three new `MINTED` cases (`asset.part-not-found`, `asset.vertex-out-of-range`, `asset.invalid-scale` "resolves its own copy rather than the Validation category sentence") fail because no locale key exists yet, so `toUserMessage` answers the category sentence.

- [ ] **Step 3: Implement**

Create `src/domain/asset/shapeEdits.ts`:

```ts
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { rotate, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import { validateAssetShape, type AssetShape } from './AssetShape';

/**
 * Part edits (asset designer symbols spec, Decision 9 and Amendment 1): pure functions over an
 * `AssetShape`, each answering a VALIDATED shape or a refusal. A gesture computes its whole result
 * here and presentation dispatches it through `SetAssetShape`, so a drag, a typed width and its undo
 * each describe one shape rather than a sequence of partial writes.
 *
 * **Every function ends in `validateAssetShape`**, which is what makes a degenerate outline, a
 * non-finite coordinate or a bulge past a semicircle a refusal under the codes validation already
 * owns. No edit re-asks those questions, so none can disagree with the constructor about what a
 * valid shape is.
 *
 * **Bulges ride along unchanged** through translation, rotation and POSITIVE scaling, uniform or
 * not: a non-uniform scale keeps each arc circular through its new chord, which the spec states as
 * behaviour. Only a mirror flips a bulge's sign, which is why a non-positive factor is refused as
 * `asset.invalid-scale` rather than handled. `translate` and `rotate` spread the polygon they map,
 * so they carry `bulges`; `operations.ts`'s `scale` is uniform only, hence `scaled` below.
 *
 * **Pending flags are carried, never re-decided**: an edit to a group captured in background pixels
 * leaves it in pixel space, and only the calibration that converts it clears the flag.
 * `removeClearance` is the one edit that writes a flag, because validation refuses a pending flag on
 * an absent clearance.
 */

/** Which outline an edit names: the footprint, the clearance, or a detail by id. */
export type OutlinePart =
	| { readonly kind: 'footprint' }
	| { readonly kind: 'clearance' }
	| { readonly kind: 'detail'; readonly id: string };

/** The outline a part names, or null when the shape has no such part. */
export function outlineOf(shape: AssetShape, part: OutlinePart): CurvedPolygon | null {
	if (part.kind === 'footprint') return shape.footprint;
	if (part.kind === 'clearance') return shape.clearance;
	return shape.details.find((detail) => detail.id === part.id)?.outline ?? null;
}

/**
 * "The part an edit names is not there" — a clearance the shape has not got, or a detail id it does
 * not carry. Exported because the detail edits and the designer's drag arithmetic ask the same
 * question, and one spelling keeps the count of the places it is asked knowable.
 */
export function partNotFound(part: OutlinePart): ValidationError {
	return assetError('part-not-found', `This design has no such part: ${JSON.stringify(part)}.`);
}

function indexIn(outline: CurvedPolygon, index: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < outline.points.length;
}

function outOfRange(outline: CurvedPolygon, index: number): ValidationError {
	return assetError(
		'vertex-out-of-range',
		`${String(index)} is not a corner or edge of an outline with ${String(outline.points.length)} corners.`,
	);
}

/** `null` when both factors are finite and positive; the refusal otherwise. */
function scaleRefusal(sx: number, sy: number): ValidationError | null {
	if ([sx, sy].every((factor) => Number.isFinite(factor) && factor > 0)) return null;
	return assetError('invalid-scale', `A scale factor must be a finite positive number; got ${String(sx)} x ${String(sy)}.`);
}

/** Each axis scaled about `origin` on its own; bulges are carried by the spread. */
function scaled(outline: CurvedPolygon, sx: number, sy: number, origin: Point): CurvedPolygon {
	return {
		...outline,
		points: outline.points.map((point) => ({ x: origin.x + (point.x - origin.x) * sx, y: origin.y + (point.y - origin.y) * sy })),
	};
}

/** The shape with one part's outline replaced; a detail keeps its id, name, line and pending flag. */
function withOutline(shape: AssetShape, part: OutlinePart, outline: CurvedPolygon): AssetShape {
	if (part.kind === 'footprint') return { ...shape, footprint: outline };
	if (part.kind === 'clearance') return { ...shape, clearance: outline };
	return { ...shape, details: shape.details.map((detail) => (detail.id === part.id ? { ...detail, outline } : detail)) };
}

/** Find the part, edit its outline, write it back and validate the whole shape: every outline edit's one path. */
function editOutline(
	shape: AssetShape,
	part: OutlinePart,
	edit: (outline: CurvedPolygon) => Result<CurvedPolygon, ValidationError>,
): Result<AssetShape, ValidationError> {
	const outline = outlineOf(shape, part);
	if (outline === null) return err(partNotFound(part));
	const edited = edit(outline);
	if (isErr(edited)) return edited;
	return validateAssetShape(withOutline(shape, part, edited.value));
}

export function moveOutline(shape: AssetShape, part: OutlinePart, by: Vector): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => ok(translate(outline, by)));
}

/**
 * One corner moved. The point count is unchanged, so every edge keeps its bulge — the spread is
 * `preservePointCurves`' rule without that function's topology-change arm, which a vertex move
 * cannot reach and which would therefore be a refusal no test could drive.
 */
export function moveVertex(shape: AssetShape, part: OutlinePart, index: number, to: Point): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => {
		if (!indexIn(outline, index)) return err(outOfRange(outline, index));
		return ok({ ...outline, points: outline.points.map((point, at) => (at === index ? to : point)) });
	});
}

/** One edge's bulge replaced. Writes a value for EVERY edge, so a straight outline gains a full list with zeros elsewhere. */
export function setBulge(shape: AssetShape, part: OutlinePart, edge: number, bulge: number): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => {
		if (!indexIn(outline, edge)) return err(outOfRange(outline, edge));
		const bulges = outline.points.map((_, at) => (at === edge ? bulge : (outline.bulges?.[at] ?? 0)));
		return ok({ points: outline.points, bulges });
	});
}

/** Scales one outline about `origin`, each axis by its own factor; the caller picks the fixed corner or side. */
export function resizeBox(
	shape: AssetShape,
	part: OutlinePart,
	factors: { readonly sx: number; readonly sy: number },
	origin: Point,
): Result<AssetShape, ValidationError> {
	const refused = scaleRefusal(factors.sx, factors.sy);
	if (refused !== null) return err(refused);
	return editOutline(shape, part, (outline) => ok(scaled(outline, factors.sx, factors.sy, origin)));
}

export function rotateOutline(shape: AssetShape, part: OutlinePart, radians: number, origin: Point): Result<AssetShape, ValidationError> {
	return editOutline(shape, part, (outline) => ok(rotate(outline, radians, origin)));
}

export function moveAnchor(shape: AssetShape, to: Point): Result<AssetShape, ValidationError> {
	return validateAssetShape({ ...shape, anchor: to });
}

/** The angle passes straight through: validation is what folds it into `[0, 2π)`. */
export function setFacing(shape: AssetShape, radians: number): Result<AssetShape, ValidationError> {
	return validateAssetShape({ ...shape, facing: radians });
}

/** The clearance removed with its pending flag. The footprint has no counterpart: without one there is no shape. */
export function removeClearance(shape: AssetShape): Result<AssetShape, ValidationError> {
	if (shape.clearance === null) return err(partNotFound({ kind: 'clearance' }));
	return validateAssetShape({ ...shape, clearance: null, clearancePending: false });
}

/**
 * Every outline scaled about the ANCHOR, so the point a plan positions the asset by stays where it
 * is. What "Set dimensions" uses on a shape with details or curves (Amendment 1).
 */
export function scaleDesign(shape: AssetShape, sx: number, sy: number): Result<AssetShape, ValidationError> {
	const refused = scaleRefusal(sx, sy);
	if (refused !== null) return err(refused);
	const about = (outline: CurvedPolygon): CurvedPolygon => scaled(outline, sx, sy, shape.anchor);
	return validateAssetShape({
		...shape,
		footprint: about(shape.footprint),
		clearance: shape.clearance === null ? null : about(shape.clearance),
		details: shape.details.map((detail) => ({ ...detail, outline: about(detail.outline) })),
	});
}
```

In `src/presentation/i18n/locales/en/assetSymbols.ts`:

old:
```ts
	'asset.preset-incoherent': 'Those values do not describe a shape that can be built.',
```
new:
```ts
	'asset.preset-incoherent': 'Those values do not describe a shape that can be built.',
	'asset.part-not-found': 'That part is no longer in the design.',
	'asset.vertex-out-of-range': 'That corner or edge is not on the outline.',
	'asset.invalid-scale': 'A part cannot be scaled to nothing or flipped.',
```

In `src/presentation/i18n/locales/de/assetSymbols.ts`:

old:
```ts
	'asset.preset-incoherent': 'Diese Werte ergeben keine Form, die sich bauen lässt.',
```
new:
```ts
	'asset.preset-incoherent': 'Diese Werte ergeben keine Form, die sich bauen lässt.',
	'asset.part-not-found': 'Dieser Teil ist nicht mehr im Entwurf.',
	'asset.vertex-out-of-range': 'Diese Ecke oder Kante liegt nicht auf dem Umriss.',
	'asset.invalid-scale': 'Ein Teil lässt sich weder auf nichts verkleinern noch spiegeln.',
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run check:fast -- tests/domain/asset/shapeEdits.test.ts tests/presentation/i18n/toUserMessage.test.ts`

Expected: oxlint and `vue-tsc` clean; both files pass (`shapeEdits.test.ts`: 36 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/domain/asset/shapeEdits.ts src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/domain/asset/shapeEdits.test.ts tests/helpers/assetShapes.ts tests/presentation/i18n/toUserMessage.test.ts`

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/domain/asset/shapeEdits.ts src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/domain/asset/shapeEdits.test.ts tests/helpers/assetShapes.ts tests/presentation/i18n/toUserMessage.test.ts
git commit -m "$(cat <<'EOF'
feat(asset): outline edits as pure domain functions

Move, reshape, bend, resize, rotate and scale an asset's footprint,
clearance or a detail, plus the anchor, facing and clearance removal —
each answering a validated shape or a refusal (symbols spec Decision 9,
Amendment 1). Bulges ride through every positive transform.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Detail edits and the capture rule — `detailEdits.ts`, `captureAwaitsScale.ts`

**Files:**
- Create: `src/domain/asset/detailEdits.ts`, `src/domain/asset/captureAwaitsScale.ts`
- Modify: `src/application/commands/asset/updateAssetShape.ts` (delete its private `captureAwaitsScale`, import the domain one)
- Test: `tests/domain/asset/detailEdits.test.ts`, `tests/domain/asset/captureAwaitsScale.test.ts`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`
- Modify (test): `tests/presentation/i18n/toUserMessage.test.ts` (three `MINTED` rows)

**Interfaces:**
- Consumes: `partNotFound(part: OutlinePart): ValidationError` (Task 1), `validateAssetShape`, `boundingBoxOf(shape: CurvedPolygon): Result<BoundingBox, GeometryError>`, `translate`.
- Produces:
```ts
// detailEdits.ts
export interface NewDetail { readonly name: string; readonly outline: CurvedPolygon; readonly line: DetailLine; readonly pending: boolean }
/** `detail-<n>` with n one above the highest numeric suffix among ids of that form, `detail-1` for none. */
export function nextDetailId(shape: AssetShape): string;
export function addDetail(shape: AssetShape, detail: NewDetail): Result<AssetShape, ValidationError>;          // appended (topmost), id = nextDetailId(shape)
export function duplicateDetail(shape: AssetShape, id: string, offset: Vector): Result<AssetShape, ValidationError>; // copy inserted at index+1, id = nextDetailId(shape), outline translated by offset, same name/line/pending
export function deleteDetail(shape: AssetShape, id: string): Result<AssetShape, ValidationError>;
export function reorderDetail(shape: AssetShape, id: string, direction: 'forward' | 'backward'): Result<AssetShape, ValidationError>; // forward = one step later in the array
export function updateDetail(shape: AssetShape, id: string, changes: { readonly name?: string; readonly line?: DetailLine }): Result<AssetShape, ValidationError>;
export function fitFootprintToDetails(shape: AssetShape): Result<AssetShape, ValidationError>;
export const DUPLICATE_OFFSET_MM = 100;

// captureAwaitsScale.ts — the rule moved verbatim from updateAssetShape.ts
export function captureAwaitsScale(calibrated: boolean, hasBackground: boolean, shape: AssetShape | null): boolean;
// === !calibrated && (hasBackground || shape === null || shape.footprintPending)
```

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/asset/detailEdits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	addDetail,
	deleteDetail,
	DUPLICATE_OFFSET_MM,
	duplicateDetail,
	fitFootprintToDetails,
	nextDetailId,
	reorderDetail,
	updateDetail,
} from '../../../src/domain/asset/detailEdits';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { rect } from '../../../src/domain/asset/presets/presetGeometry';
import { editableShape, QUARTER } from '../../helpers/assetShapes';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Spec 2026-09-13 Decision 9 and Amendment 1: the edits that change which details a shape has, their
 * order and their labels. `editableShape` carries a straight solid `detail-1` and a curved, dashed,
 * PENDING `detail-2`, so every copy and move below can be asked what it carried.
 */
const ids = (shape: AssetShape): string[] => shape.details.map((detail) => detail.id);
const OFFSET = { dx: DUPLICATE_OFFSET_MM, dy: DUPLICATE_OFFSET_MM };

/** `editableShape` with no detail awaiting a scale, which fitting to details needs. */
function scaledShape(overrides: Partial<AssetShape> = {}): AssetShape {
	return editableShape({ details: editableShape().details.map((detail) => ({ ...detail, pending: false })), ...overrides });
}

describe('nextDetailId', () => {
	it('starts at detail-1', () => {
		expect(nextDetailId(editableShape({ details: [] }))).toBe('detail-1');
	});

	it('goes one above the highest numbered id and ignores ids of another form', () => {
		const [top, bowl] = editableShape().details;
		expect(nextDetailId(editableShape({ details: [{ ...top, id: 'detail-3' }, { ...bowl, id: 'seat' }] }))).toBe('detail-4');
	});
});

describe('addDetail', () => {
	it('appends the detail on top under the next id', () => {
		const added = expectOk(addDetail(editableShape(), { name: 'seat', outline: rect(100, 100, 0, 200), line: 'solid', pending: false }));
		expect(ids(added)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(added.details[2]).toEqual({
			id: 'detail-3',
			name: 'seat',
			line: 'solid',
			pending: false,
			outline: { points: [{ x: -50, y: 150 }, { x: 50, y: 150 }, { x: 50, y: 250 }, { x: -50, y: 250 }] },
		});
	});

	it('refuses an outline that encloses no area', () => {
		const flat = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }] };
		expect(expectErr(addDetail(editableShape(), { name: 'flat', outline: flat, line: 'solid', pending: false })).code).toBe('asset.degenerate-detail');
	});
});

describe('duplicateDetail', () => {
	it('inserts the copy directly above the original, offset, under the next id', () => {
		const duplicated = expectOk(duplicateDetail(editableShape(), 'detail-1', OFFSET));
		expect(ids(duplicated)).toEqual(['detail-1', 'detail-3', 'detail-2']);
		const copy = duplicated.details[1];
		expect([copy.name, copy.line, copy.pending]).toEqual(['top', 'solid', false]);
		expect(copy.outline.points).toEqual([{ x: -300, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: -300, y: 200 }]);
	});

	it('copies a curved, dashed, pending detail with its bulges', () => {
		const duplicated = expectOk(duplicateDetail(editableShape(), 'detail-2', OFFSET));
		expect(ids(duplicated)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		const copy = duplicated.details[2];
		expect([copy.name, copy.line, copy.pending]).toEqual(['bowl', 'dashed', true]);
		expect(copy.outline.points[1]).toEqual({ x: 450, y: 100 });
		expect(copy.outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(duplicateDetail(editableShape(), 'detail-9', OFFSET)).code).toBe('asset.part-not-found');
	});
});

describe('deleteDetail', () => {
	it('removes the detail and keeps the rest in order', () => {
		expect(ids(expectOk(deleteDetail(editableShape(), 'detail-1')))).toEqual(['detail-2']);
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(deleteDetail(editableShape(), 'detail-9')).code).toBe('asset.part-not-found');
	});
});

describe('reorderDetail', () => {
	it('brings a detail forward, one later in the array', () => {
		expect(ids(expectOk(reorderDetail(editableShape(), 'detail-1', 'forward')))).toEqual(['detail-2', 'detail-1']);
	});

	it('sends a detail backward, one earlier in the array', () => {
		expect(ids(expectOk(reorderDetail(editableShape(), 'detail-2', 'backward')))).toEqual(['detail-2', 'detail-1']);
	});

	it.each([
		['detail-2', 'forward'],
		['detail-1', 'backward'],
	] as const)('refuses to move %s %s past the end of the drawing order', (id, direction) => {
		expect(expectErr(reorderDetail(editableShape(), id, direction)).code).toBe('asset.detail-at-limit');
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(reorderDetail(editableShape(), 'detail-9', 'forward')).code).toBe('asset.part-not-found');
	});
});

describe('updateDetail', () => {
	it('renames with the name trimmed and changes the line, leaving other details alone', () => {
		const before = editableShape();
		const updated = expectOk(updateDetail(before, 'detail-1', { name: '  seat  ', line: 'dashed' }));
		expect([updated.details[0].name, updated.details[0].line]).toEqual(['seat', 'dashed']);
		expect(updated.details[1]).toEqual(before.details[1]);
	});

	it('keeps the existing name when the new one is blank', () => {
		const updated = expectOk(updateDetail(editableShape(), 'detail-2', { name: '   ' }));
		expect([updated.details[1].name, updated.details[1].line]).toEqual(['bowl', 'dashed']);
	});

	it('changes only the line when no name is given', () => {
		const updated = expectOk(updateDetail(editableShape(), 'detail-1', { line: 'dashed' }));
		expect([updated.details[0].name, updated.details[0].line]).toEqual(['top', 'dashed']);
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(updateDetail(editableShape(), 'detail-9', { name: 'x' })).code).toBe('asset.part-not-found');
	});
});

describe('fitFootprintToDetails', () => {
	/** The top spans x -400..0 and the bowl's arcs reach x 150..350, both y -100..100. */
	it('writes the typed rectangle around every detail’s curve-aware extent, and changes nothing else', () => {
		const before = scaledShape({ footprintOrigin: 'traced', footprintPending: true });
		const fitted = expectOk(fitFootprintToDetails(before));
		expect(fitted.footprint.points).toEqual([
			{ x: expect.closeTo(-400, 9), y: expect.closeTo(-100, 9) },
			{ x: expect.closeTo(350, 9), y: expect.closeTo(-100, 9) },
			{ x: expect.closeTo(350, 9), y: expect.closeTo(100, 9) },
			{ x: expect.closeTo(-400, 9), y: expect.closeTo(100, 9) },
		]);
		expect([fitted.footprintOrigin, fitted.footprintPending]).toEqual(['typed', false]);
		expect([fitted.clearance, fitted.details, fitted.anchor]).toEqual([before.clearance, before.details, before.anchor]);
	});

	it('refuses a shape with no details', () => {
		expect(expectErr(fitFootprintToDetails(editableShape({ details: [] }))).code).toBe('asset.no-details');
	});

	it('refuses while any detail is still in background pixels', () => {
		expect(expectErr(fitFootprintToDetails(editableShape())).code).toBe('asset.details-await-scale');
	});

	it('refuses a detail whose outline cannot be measured', () => {
		const broken: AssetShape = {
			...scaledShape(),
			details: [{ id: 'detail-1', name: 'broken', line: 'solid', pending: false, outline: { points: [{ x: Number.NaN, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] } }],
		};
		expect(expectErr(fitFootprintToDetails(broken)).code).toBe('asset.invalid-detail');
	});
});
```

Create `tests/domain/asset/captureAwaitsScale.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { captureAwaitsScale } from '../../../src/domain/asset/captureAwaitsScale';
import { editableShape } from '../../helpers/assetShapes';

/**
 * The capture rule, asked directly now that a draw tool asks it in presentation before any command
 * runs. `setAssetAttributes.test.ts` still drives every arm through a real command, which is where
 * what a user PLACES is held; this holds the three arms in the order they are asked.
 */
const TYPED = editableShape();
const TRACED_PENDING = editableShape({ footprintOrigin: 'traced', footprintPending: true });

describe('captureAwaitsScale', () => {
	it.each<readonly [string, boolean, boolean, AssetShape | null, boolean]>([
		['a calibrated surface, whatever else is on it', true, true, TRACED_PENDING, false],
		['an uncalibrated background, even beside a typed footprint', false, true, TYPED, true],
		['no background and no footprint yet', false, false, null, true],
		['no background around a footprint still awaiting its own scale', false, false, TRACED_PENDING, true],
		['no background around a typed footprint', false, false, TYPED, false],
	])('answers %s', (_label, calibrated, hasBackground, shape, expected) => {
		expect(captureAwaitsScale(calibrated, hasBackground, shape)).toBe(expected);
	});
});
```

In `tests/presentation/i18n/toUserMessage.test.ts` (after Task 1's rows):

old:
```ts
	['asset.invalid-scale', 'Validation', 'error.category.validation', 'domain/asset/shapeEdits.ts'],
```
new:
```ts
	['asset.invalid-scale', 'Validation', 'error.category.validation', 'domain/asset/shapeEdits.ts'],
	['asset.detail-at-limit', 'Validation', 'error.category.validation', 'domain/asset/detailEdits.ts'],
	['asset.no-details', 'Validation', 'error.category.validation', 'domain/asset/detailEdits.ts'],
	['asset.details-await-scale', 'Validation', 'error.category.validation', 'domain/asset/detailEdits.ts'],
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run check:fast -- tests/domain/asset tests/application/commands/asset tests/presentation/i18n/toUserMessage.test.ts`

Expected: `vue-tsc` reports `TS2307` for `src/domain/asset/detailEdits` and `src/domain/asset/captureAwaitsScale`; vitest fails both new test files on the unresolved imports and the three new `MINTED` cases (no locale key, so the category sentence is answered). Every existing `tests/application/commands/asset` and `tests/domain/asset` case still passes.

- [ ] **Step 3: Implement**

Create `src/domain/asset/captureAwaitsScale.ts`:

```ts
import type { AssetShape } from './AssetShape';

/**
 * Do coordinates captured on this surface RIGHT NOW await a scale, or are they already true
 * millimetres? The one answer, asked once per write by `updateAssetShape` and by a draw tool
 * building a detail in presentation before any command runs.
 *
 * **It used to be `!calibrated`, and that was wrong in a way the shipped UI could reach.**
 * Create an asset with a Width and a Depth typed: the designer opens on a drawn 1200 x 800
 * rectangle, in true millimetres, with no background and no calibration. Click *Set anchor*
 * and click a point on it — the coordinates are millimetres, and `!calibrated` recorded them
 * as pending. Pick a background, calibrate, and `rescaled()` faithfully multiplied that
 * anchor by `scaleCorrection` while correctly leaving the typed footprint alone. The anchor
 * lands outside the object, permanently, with `anchorPending` now false so nothing marks it.
 * The same shape for a clearance traced around a typed footprint. Found by a whole-branch
 * review, and reachable entirely through the shipped surface.
 *
 * The three arms, in the order they are asked and for the reason each is asked:
 *
 * - **Calibrated: no.** A scale exists and every coordinate on this surface is in it. This
 *   arm is the whole of what the old rule got right.
 * - **An UNCALIBRATED BACKGROUND: yes.** A spec sheet with no scale is drawn at the
 *   placeholder one source pixel per millimetre, and it is the reason the user is pointing
 *   where they are pointing. This is the arm that keeps `calibrateAsset.test.ts`'s "converts
 *   a pending clearance and leaves a typed footprint alone" a state the UI can still produce:
 *   a clearance traced on a sheet beside a typed footprint really is in the sheet's space.
 * - **No background: yes only while the OBJECT is not already in millimetres.** With no sheet
 *   there is nothing else on the canvas to point at, so a capture is in whatever frame the
 *   object's own footprint establishes. A typed footprint (never pending) establishes
 *   millimetres; a traced-and-still-pending one establishes the placeholder frame it was
 *   drawn in; no footprint at all establishes nothing, and a first outline drawn freehand
 *   still has to be convertible by the calibration that follows it.
 *
 * **What it deliberately does NOT resolve, because nothing can:** an uncalibrated background
 * BESIDE a typed footprint overlays two frames, and a single click cannot say which one the
 * user meant. The second arm resolves that towards the sheet, which is the dominant intent —
 * a user who has just picked a spec sheet is tracing it — and it is an approximation rather
 * than a fact.
 *
 * **In the domain since the symbols spec's Amendment 1.** It was module-private in
 * `updateAssetShape.ts`, its only caller then; a detail drawn over an uncalibrated background is
 * pending "by the rule tracing already follows", and a draw tool builds that detail before any
 * command runs, so the rule moved here and both callers ask it. It takes three plain facts rather
 * than the sidecar document, because presentation holds a design DTO and not a document. Every
 * case about what a user PLACES still drives a real command (`setAssetAttributes.test.ts`);
 * `captureAwaitsScale.test.ts` holds the arms themselves.
 */
export function captureAwaitsScale(calibrated: boolean, hasBackground: boolean, shape: AssetShape | null): boolean {
	if (calibrated) return false;
	if (hasBackground) return true;
	return shape === null || shape.footprintPending;
}
```

Modify `src/application/commands/asset/updateAssetShape.ts`.

Edit 1 — import:

old:
```ts
import { validateAssetShape } from '../../../domain/asset/AssetShape';
```
new:
```ts
import { validateAssetShape } from '../../../domain/asset/AssetShape';
import { captureAwaitsScale } from '../../../domain/asset/captureAwaitsScale';
```

Edit 2 — delete the private function and its docblock (it now lives, rewritten as above, in the domain):

old:
```ts
/**
 * Do coordinates captured on this surface RIGHT NOW await a scale, or are they already true
 * millimetres? The one answer, asked once per write and handed to whichever command is
 * proposing a change.
 *
 * **It used to be `!calibrated`, and that was wrong in a way the shipped UI could reach.**
 * Create an asset with a Width and a Depth typed: the designer opens on a drawn 1200 x 800
 * rectangle, in true millimetres, with no background and no calibration. Click *Set anchor*
 * and click a point on it — the coordinates are millimetres, and `!calibrated` recorded them
 * as pending. Pick a background, calibrate, and `rescaled()` faithfully multiplied that
 * anchor by `scaleCorrection` while correctly leaving the typed footprint alone. The anchor
 * lands outside the object, permanently, with `anchorPending` now false so nothing marks it.
 * The same shape for a clearance traced around a typed footprint. Found by a whole-branch
 * review, and reachable entirely through the shipped surface.
 *
 * The three arms, in the order they are asked and for the reason each is asked:
 *
 * - **Calibrated: no.** A scale exists and every coordinate on this surface is in it. This
 *   arm is the whole of what the old rule got right.
 * - **An UNCALIBRATED BACKGROUND: yes.** A spec sheet with no scale is drawn at the
 *   placeholder one source pixel per millimetre, and it is the reason the user is pointing
 *   where they are pointing. This is the arm that keeps `calibrateAsset.test.ts`'s "converts
 *   a pending clearance and leaves a typed footprint alone" a state the UI can still produce:
 *   a clearance traced on a sheet beside a typed footprint really is in the sheet's space.
 * - **No background: yes only while the OBJECT is not already in millimetres.** With no sheet
 *   there is nothing else on the canvas to point at, so a capture is in whatever frame the
 *   object's own footprint establishes. A typed footprint (never pending) establishes
 *   millimetres; a traced-and-still-pending one establishes the placeholder frame it was
 *   drawn in; no footprint at all establishes nothing, and a first outline drawn freehand
 *   still has to be convertible by the calibration that follows it.
 *
 * **What it deliberately does NOT resolve, because nothing can:** an uncalibrated background
 * BESIDE a typed footprint overlays two frames, and a single click cannot say which one the
 * user meant. The second arm resolves that towards the sheet, which is the dominant intent —
 * a user who has just picked a spec sheet is tracing it — and it is an approximation rather
 * than a fact. The reported defect is not in that state: it has no background at all.
 *
 * **Module-private, and that is a fallow finding rather than a preference.** Its only caller is
 * `updateAssetShape` below, in this file; exported, `npm run analyze` reports it as an unused
 * export. Nothing in `tests/` imports it either, and deliberately: every case about this rule
 * drives a real command, because what a reader needs held is that the anchor a user PLACES is
 * not flagged, never that a predicate answers `false`.
 */
function captureAwaitsScale(
	document: AssetGeometryDocument,
	background: AssetBackgroundRef | null,
): boolean {
	if (document.calibration !== null) return false;
	if (background !== null) return true;
	return document.shape === null || document.shape.footprintPending;
}

export async function updateAssetShape(
```
new:
```ts
export async function updateAssetShape(
```

Edit 3 — the call:

old:
```ts
		const candidate = change(document.shape, captureAwaitsScale(document, read.value.background));
```
new:
```ts
		const candidate = change(
			document.shape,
			captureAwaitsScale(document.calibration !== null, read.value.background !== null, document.shape),
		);
```

(`AssetGeometryDocument` and `AssetBackgroundRef` stay imported: `next: AssetGeometryDocument` and `AssetDesignRead.background` still use them.)

Create `src/domain/asset/detailEdits.ts`:

```ts
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import type { Vector } from '../../core/geometry/Vector';
import { boundingBoxOf, translate } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';
import type { DetailLine } from './AssetDetail';
import { validateAssetShape, type AssetShape } from './AssetShape';
import { partNotFound } from './shapeEdits';

/**
 * The edits that change WHICH details a shape has, or their order and labels (asset designer
 * symbols spec, Decision 9 and Amendment 1). Beside `shapeEdits.ts` rather than inside it because
 * those reshape one outline and these reshape the list; both answer a validated shape or a refusal.
 */

/** How far a duplicate lands from its original, along +x and +y (Amendment 1). */
export const DUPLICATE_OFFSET_MM = 100;

/** A detail as a tool proposes it: everything but the id, which the shape assigns. */
export interface NewDetail {
	readonly name: string;
	readonly outline: CurvedPolygon;
	readonly line: DetailLine;
	readonly pending: boolean;
}

const NUMBERED_ID = /^detail-(\d+)$/;

/**
 * `detail-<n>` with n one above the highest numeric suffix among ids of that form, `detail-1` for
 * none. One above the HIGHEST rather than the count, so deleting `detail-1` of two cannot hand the
 * next detail the id `detail-2` still carries.
 */
export function nextDetailId(shape: AssetShape): string {
	let highest = 0;
	for (const detail of shape.details) {
		const match = NUMBERED_ID.exec(detail.id);
		if (match !== null) highest = Math.max(highest, Number(match[1]));
	}
	return `detail-${String(highest + 1)}`;
}

function detailIndex(shape: AssetShape, id: string): Result<number, ValidationError> {
	const index = shape.details.findIndex((detail) => detail.id === id);
	return index < 0 ? err(partNotFound({ kind: 'detail', id })) : ok(index);
}

/** Appended, so the new detail draws on top. */
export function addDetail(shape: AssetShape, detail: NewDetail): Result<AssetShape, ValidationError> {
	return validateAssetShape({ ...shape, details: [...shape.details, { ...detail, id: nextDetailId(shape) }] });
}

/** A copy directly above the original, offset by `offset`, with its name, line and pending flag. */
export function duplicateDetail(shape: AssetShape, id: string, offset: Vector): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const original = shape.details[found.value];
	const copy = { ...original, id: nextDetailId(shape), outline: translate(original.outline, offset) };
	const details = [...shape.details.slice(0, found.value + 1), copy, ...shape.details.slice(found.value + 1)];
	return validateAssetShape({ ...shape, details });
}

export function deleteDetail(shape: AssetShape, id: string): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	return validateAssetShape({ ...shape, details: shape.details.filter((detail) => detail.id !== id) });
}

/** One step in the drawing order: `forward` is one later in the array, which draws over its neighbour. */
export function reorderDetail(shape: AssetShape, id: string, direction: 'forward' | 'backward'): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const to = found.value + (direction === 'forward' ? 1 : -1);
	if (to < 0 || to >= shape.details.length) {
		return err(assetError('detail-at-limit', `Detail "${id}" cannot move ${direction}; it is already at that end of the drawing order.`));
	}
	const details = [...shape.details];
	details[found.value] = shape.details[to];
	details[to] = shape.details[found.value];
	return validateAssetShape({ ...shape, details });
}

/**
 * A name is TRIMMED, and a blank one keeps the name the detail had rather than refusing: the
 * inspector commits on blur, and a cleared field is a user who has not finished typing, not a
 * request for a detail with no name.
 */
export function updateDetail(
	shape: AssetShape,
	id: string,
	changes: { readonly name?: string; readonly line?: DetailLine },
): Result<AssetShape, ValidationError> {
	const found = detailIndex(shape, id);
	if (isErr(found)) return found;
	const original = shape.details[found.value];
	const trimmed = changes.name?.trim() ?? '';
	const name = trimmed === '' ? original.name : trimmed;
	const line = changes.line ?? original.line;
	return validateAssetShape({
		...shape,
		details: shape.details.map((detail, index) => (index === found.value ? { ...detail, name, line } : detail)),
	});
}

/**
 * The footprint replaced by the rectangle around every detail's CURVE-AWARE extent, as a typed,
 * unpending outline; nothing else changes.
 *
 * Refused while any detail awaits a scale: a typed footprint is millimetres by definition, so one
 * drawn around background pixels would launder them into millimetres the calibration then leaves
 * alone. A detail whose outline cannot be measured is refused under the detail's own code — the
 * shape handed in is not assumed to have been validated.
 */
export function fitFootprintToDetails(shape: AssetShape): Result<AssetShape, ValidationError> {
	if (shape.details.length === 0) return err(assetError('no-details', 'There are no details to fit the footprint to.'));
	if (shape.details.some((detail) => detail.pending)) {
		return err(assetError('details-await-scale', 'A detail is still in background pixels, so no footprint in millimetres can be fitted to it.'));
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const detail of shape.details) {
		const box = boundingBoxOf(detail.outline);
		if (isErr(box)) return err(assetError('invalid-detail', box.error.message));
		minX = Math.min(minX, box.value.min.x);
		minY = Math.min(minY, box.value.min.y);
		maxX = Math.max(maxX, box.value.max.x);
		maxY = Math.max(maxY, box.value.max.y);
	}
	return validateAssetShape({
		...shape,
		footprint: { points: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] },
		footprintOrigin: 'typed',
		footprintPending: false,
	});
}
```

In `src/presentation/i18n/locales/en/assetSymbols.ts`:

old:
```ts
	'asset.invalid-scale': 'A part cannot be scaled to nothing or flipped.',
```
new:
```ts
	'asset.invalid-scale': 'A part cannot be scaled to nothing or flipped.',
	'asset.detail-at-limit': 'That detail is already at the end of the drawing order.',
	'asset.no-details': 'This design has no details to fit the footprint to.',
	'asset.details-await-scale': 'A detail is still unscaled. Calibrate before fitting the footprint to the details.',
```

In `src/presentation/i18n/locales/de/assetSymbols.ts`:

old:
```ts
	'asset.invalid-scale': 'Ein Teil lässt sich weder auf nichts verkleinern noch spiegeln.',
```
new:
```ts
	'asset.invalid-scale': 'Ein Teil lässt sich weder auf nichts verkleinern noch spiegeln.',
	'asset.detail-at-limit': 'Dieses Detail steht bereits am Ende der Zeichenreihenfolge.',
	'asset.no-details': 'Dieser Entwurf hat keine Details, an die der Umriss angepasst werden könnte.',
	'asset.details-await-scale': 'Ein Detail ist noch nicht skaliert. Vor dem Anpassen des Umrisses an die Details muss kalibriert werden.',
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npm run check:fast -- tests/domain/asset tests/application/commands/asset tests/presentation/i18n/toUserMessage.test.ts`

Expected: oxlint and `vue-tsc` clean; all pass — `detailEdits.test.ts` 22 tests, `captureAwaitsScale.test.ts` 5, and every pre-existing `tests/application/commands/asset/*` case unchanged (the move is behaviour-preserving).

- [ ] **Step 5: Lint**

Run: `npx eslint src/domain/asset/detailEdits.ts src/domain/asset/captureAwaitsScale.ts src/application/commands/asset/updateAssetShape.ts src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/domain/asset/detailEdits.test.ts tests/domain/asset/captureAwaitsScale.test.ts tests/presentation/i18n/toUserMessage.test.ts`

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/domain/asset/detailEdits.ts src/domain/asset/captureAwaitsScale.ts src/application/commands/asset/updateAssetShape.ts src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/domain/asset/detailEdits.test.ts tests/domain/asset/captureAwaitsScale.test.ts tests/presentation/i18n/toUserMessage.test.ts
git commit -m "$(cat <<'EOF'
feat(asset): detail edits, and the capture rule moved to the domain

Add, duplicate, delete, reorder and relabel details, and fit the
footprint to them. captureAwaitsScale leaves updateAssetShape for the
domain so a draw tool can ask it before any command runs (Amendment 1).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The selection model — types, handles, hit order, snap candidates, store

**Files:**
- Create: `src/presentation/designer/selection/designerSelection.ts`, `src/presentation/designer/selection/handles.ts`, `src/presentation/designer/selection/hitTest.ts`, `src/presentation/designer/selection/snapCandidates.ts`
- Modify: `src/presentation/designer/layers/anchorLayer.ts` (export `facingTip`), `src/presentation/designer/stores/assetDesignStore.ts`, `tests/helpers/assetShapes.ts` (add `toiletShape`)
- Test: `tests/presentation/designer/selection/designerSelection.test.ts`, `tests/presentation/designer/selection/handles.test.ts`, `tests/presentation/designer/selection/hitTest.test.ts`, `tests/presentation/designer/selection/snapCandidates.test.ts`, `tests/presentation/designer/assetDesignStoreSelection.test.ts`

All five test files run in node (no DOM, no SFC reached; the store test follows `tests/presentation/stores/assetSelectionStore.test.ts` — `setActivePinia(createPinia())`, no jsdom directive).

**Interfaces:**
- Consumes: `OutlinePart`, `outlineOf` (Task 1); `boundingBoxOf`, `distance` (`operations.ts`); `arcPoint(edge, 0.5)` (`circularArc.ts`); `curvedContains(shape, point)` (`curveContains.ts`); `unwrap` (`core/result/Result.ts`); `VERTEX_GRAB_RADIUS_PX`, `ROTATION_HANDLE_OFFSET_PX` (`editor/handleMetrics.ts`); `SnapCandidates` (`editor/snapping/snap-service.ts`).
- Produces:
```ts
// designerSelection.ts
export type DesignerSelection = OutlinePart | { readonly kind: 'anchor' } | { readonly kind: 'facing' };
export type SelectionMode = 'transform' | 'points' | 'bend';
export function isOutlineSelection(selection: DesignerSelection | null): selection is OutlinePart;
/** 'footprint' | 'clearance' | 'detail:<id>' | 'anchor' | 'facing' — the exclusion key snap candidates take. */
export function partKey(selection: DesignerSelection): string;
export function sameSelection(a: DesignerSelection | null, b: DesignerSelection | null): boolean;
/** Does the part still exist on this shape? A null shape has no parts. */
export function selectionExists(shape: AssetShape | null, selection: DesignerSelection): boolean;

// anchorLayer.ts
export function facingTip(shape: AssetShape, worldPerPixel: number): Point; // anchor + FACING_LENGTH_PX * worldPerPixel along facing; facingArrow uses it

// handles.ts
export type HandleRole =
  | { readonly kind: 'box'; readonly index: number }   // 0 TL, 1 T, 2 TR, 3 R, 4 BR, 5 B, 6 BL, 7 L
  | { readonly kind: 'rotate' }
  | { readonly kind: 'vertex'; readonly index: number }
  | { readonly kind: 'edge'; readonly index: number };
export interface SelectionHandle { readonly role: HandleRole; readonly at: Point }
export function selectionHandles(shape: AssetShape, selection: DesignerSelection | null, mode: SelectionMode, worldPerPixel: number): SelectionHandle[];
// addition (OUTLINE CONFLICT 3): consumed by selectionDrag.ts
export function boxHandlePoint(box: BoundingBox, index: number): Point;

// hitTest.ts
export type DesignerHit =
  | { readonly kind: 'handle'; readonly role: HandleRole }
  | { readonly kind: 'part'; readonly selection: DesignerSelection }
  | null;
export function hitDesign(shape: AssetShape, point: Point, state: { readonly selection: DesignerSelection | null; readonly mode: SelectionMode; readonly worldPerPixel: number }): DesignerHit;

// snapCandidates.ts
export function designerSnapCandidates(shape: AssetShape | null, exclude: Iterable<string>): SnapCandidates;

// useAssetDesignStore gains, and returns:
selection: Ref<DesignerSelection | null>;
mode: Ref<SelectionMode>;
preview: ShallowRef<AssetShape | null>;
select(next: DesignerSelection | null): void;
setMode(next: SelectionMode): void;
setPreview(shape: AssetShape | null): void;
```

- [ ] **Step 1: Write the failing selection-module tests**

Modify `tests/helpers/assetShapes.ts`:

old:
```ts
import { validateAssetShape, type AssetShape } from '../../src/domain/asset/AssetShape';
import { circle, rect } from '../../src/domain/asset/presets/presetGeometry';
import { expectOk } from './domain';
```
new:
```ts
import { validateAssetShape, type AssetShape } from '../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../src/domain/asset/presets/catalogue';
import { circle, defaultValues, rect } from '../../src/domain/asset/presets/presetGeometry';
import { expectDefined, expectOk } from './domain';
```

and append at the end of the file:

```ts

/**
 * The toilet preset at its defaults: footprint 380 wide with a semicircular front reaching y = 350,
 * clearance x -390..390 by y -350..950, `detail-1` the tank (x -190..190, y -350..-150), `detail-2`
 * the bowl (x -152..152, y -125..325), anchor at the origin, facing +y.
 */
export function toiletShape(): AssetShape {
	const toilet = expectDefined(
		ASSET_PRESETS.find((preset) => preset.id === 'toilet'),
		'the toilet preset',
	);
	return expectOk(toilet.build(defaultValues(toilet)));
}
```

Create `tests/presentation/designer/selection/designerSelection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	isOutlineSelection,
	partKey,
	sameSelection,
	selectionExists,
	type DesignerSelection,
} from '../../../../src/presentation/designer/selection/designerSelection';
import { editableShape } from '../../../helpers/assetShapes';

/** Spec 2026-09-13 Decision 10: what the designer can select, and how two selections compare. */
const FOOTPRINT: DesignerSelection = { kind: 'footprint' };
const CLEARANCE: DesignerSelection = { kind: 'clearance' };
const TOP: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const ANCHOR: DesignerSelection = { kind: 'anchor' };
const FACING: DesignerSelection = { kind: 'facing' };

describe('the designer selection', () => {
	it.each<readonly [DesignerSelection | null, boolean]>([
		[FOOTPRINT, true],
		[CLEARANCE, true],
		[TOP, true],
		[ANCHOR, false],
		[FACING, false],
		[null, false],
	])('isOutlineSelection(%o) is %s', (selection, expected) => {
		expect(isOutlineSelection(selection)).toBe(expected);
	});

	it('keys each part, a detail by its id', () => {
		expect([FOOTPRINT, CLEARANCE, TOP, ANCHOR, FACING].map((selection) => partKey(selection))).toEqual([
			'footprint',
			'clearance',
			'detail:detail-1',
			'anchor',
			'facing',
		]);
	});

	it('compares selections by the part they name, not by identity', () => {
		expect(sameSelection(null, null)).toBe(true);
		expect(sameSelection(null, FOOTPRINT)).toBe(false);
		expect(sameSelection(FOOTPRINT, null)).toBe(false);
		expect(sameSelection({ kind: 'detail', id: 'detail-1' }, TOP)).toBe(true);
		expect(sameSelection(TOP, BOWL)).toBe(false);
		expect(sameSelection(FOOTPRINT, CLEARANCE)).toBe(false);
	});

	it('says whether the part a selection names is still on the shape', () => {
		const shape = editableShape();
		expect(selectionExists(null, ANCHOR)).toBe(false);
		expect(selectionExists(shape, FOOTPRINT)).toBe(true);
		expect(selectionExists(shape, CLEARANCE)).toBe(true);
		expect(selectionExists(editableShape({ clearance: null }), CLEARANCE)).toBe(false);
		expect(selectionExists(shape, BOWL)).toBe(true);
		expect(selectionExists(shape, { kind: 'detail', id: 'detail-9' })).toBe(false);
		expect(selectionExists(shape, FACING)).toBe(true);
	});
});
```

Create `tests/presentation/designer/selection/handles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { selectionHandles } from '../../../../src/presentation/designer/selection/handles';
import { editableShape, toiletShape } from '../../../helpers/assetShapes';

/**
 * Spec 2026-09-13 Decision 10: where a selection's handles sit in each mode. `editableShape`'s
 * `detail-1` spans x -400..0 by y -100..100, and `detail-2` is a circle of radius 100 on (250, 0).
 */
const TOP: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const HALF_DIAGONAL = 50 * Math.SQRT2;

describe('selectionHandles', () => {
	it.each<readonly [string, DesignerSelection | null]>([
		['no selection', null],
		['the anchor', { kind: 'anchor' }],
		['the facing', { kind: 'facing' }],
		['an unknown detail', { kind: 'detail', id: 'detail-9' }],
	])('offers nothing for %s', (_label, selection) => {
		expect(selectionHandles(editableShape(), selection, 'transform', 1)).toEqual([]);
	});

	it('offers nothing for a clearance the shape has not got', () => {
		expect(selectionHandles(editableShape({ clearance: null }), { kind: 'clearance' }, 'points', 1)).toEqual([]);
	});

	it('transform: eight box handles clockwise from the top-left, then the rotate handle above the top centre', () => {
		expect(selectionHandles(editableShape(), TOP, 'transform', 2)).toEqual([
			{ role: { kind: 'box', index: 0 }, at: { x: -400, y: -100 } },
			{ role: { kind: 'box', index: 1 }, at: { x: -200, y: -100 } },
			{ role: { kind: 'box', index: 2 }, at: { x: 0, y: -100 } },
			{ role: { kind: 'box', index: 3 }, at: { x: 0, y: 0 } },
			{ role: { kind: 'box', index: 4 }, at: { x: 0, y: 100 } },
			{ role: { kind: 'box', index: 5 }, at: { x: -200, y: 100 } },
			{ role: { kind: 'box', index: 6 }, at: { x: -400, y: 100 } },
			{ role: { kind: 'box', index: 7 }, at: { x: -400, y: 0 } },
			// 18 screen pixels above the box at two millimetres per pixel.
			{ role: { kind: 'rotate' }, at: { x: -200, y: -136 } },
		]);
	});

	it('transform: the box is the curve-aware extent, so the toilet’s front arc is inside it', () => {
		const handles = selectionHandles(toiletShape(), { kind: 'footprint' }, 'transform', 1);
		expect(handles[4]).toEqual({ role: { kind: 'box', index: 4 }, at: { x: expect.closeTo(190, 9), y: expect.closeTo(350, 9) } });
	});

	it('points: one handle per vertex, at the vertex', () => {
		const shape = editableShape();
		expect(selectionHandles(shape, TOP, 'points', 1)).toEqual(
			shape.details[0].outline.points.map((at, index) => ({ role: { kind: 'vertex', index }, at })),
		);
	});

	it('bend: one handle per edge at its midpoint, on a straight outline', () => {
		expect(selectionHandles(editableShape(), TOP, 'bend', 1).map((handle) => handle.at)).toEqual([
			{ x: -200, y: -100 },
			{ x: 0, y: 0 },
			{ x: -200, y: 100 },
			{ x: -400, y: 0 },
		]);
	});

	it('bend: an edge that curves has its handle on the arc, not on the chord', () => {
		const handles = selectionHandles(editableShape(), BOWL, 'bend', 1);
		expect(handles.map((handle) => handle.role)).toEqual([0, 1, 2, 3].map((index) => ({ kind: 'edge', index })));
		expect(handles.map((handle) => handle.at)).toEqual([
			{ x: expect.closeTo(250 + HALF_DIAGONAL, 9), y: expect.closeTo(-HALF_DIAGONAL, 9) },
			{ x: expect.closeTo(250 + HALF_DIAGONAL, 9), y: expect.closeTo(HALF_DIAGONAL, 9) },
			{ x: expect.closeTo(250 - HALF_DIAGONAL, 9), y: expect.closeTo(HALF_DIAGONAL, 9) },
			{ x: expect.closeTo(250 - HALF_DIAGONAL, 9), y: expect.closeTo(-HALF_DIAGONAL, 9) },
		]);
	});
});
```

Create `tests/presentation/designer/selection/hitTest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { facingTip } from '../../../../src/presentation/designer/layers/anchorLayer';
import type { DesignerSelection, SelectionMode } from '../../../../src/presentation/designer/selection/designerSelection';
import { hitDesign, type DesignerHit } from '../../../../src/presentation/designer/selection/hitTest';
import { toiletShape } from '../../../helpers/assetShapes';

/**
 * Spec 2026-09-13 Decision 10's hit order, as a table over one toilet at one millimetre per screen
 * pixel, so the grab radius is 8 mm. The toilet: footprint x -190..190 with its semicircular front
 * reaching y 350; clearance x -390..390 by y -350..950; tank (`detail-1`) x -190..190 by y -350..-150;
 * bowl (`detail-2`) x -152..152 by y -125..325 around the anchor at the origin; facing +y, so the
 * facing tip is at (0, 44).
 */
const TOILET = toiletShape();
const SEATED: AssetShape = {
	...TOILET,
	details: [...TOILET.details, { id: 'detail-3', name: 'seat', outline: rect(100, 100, 0, 250), line: 'solid', pending: false }],
};
const NO_CLEARANCE: AssetShape = { ...TOILET, clearance: null, clearancePending: false };

const FOOTPRINT: DesignerSelection = { kind: 'footprint' };
const CLEARANCE: DesignerSelection = { kind: 'clearance' };
const TANK: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const ANCHOR: DesignerSelection = { kind: 'anchor' };
const FACING: DesignerSelection = { kind: 'facing' };

const part = (selection: DesignerSelection): DesignerHit => ({ kind: 'part', selection });

describe('hitDesign', () => {
	it.each<readonly [string, AssetShape, Point, DesignerSelection | null, SelectionMode, DesignerHit]>([
		['1: a box handle of the selection, outside every part', TOILET, { x: 190, y: 352 }, FOOTPRINT, 'transform', { kind: 'handle', role: { kind: 'box', index: 4 } }],
		// The bowl's rotate handle sits 18 px above its box, at (0, -143); this point is also inside the tank.
		['1: a handle drawn over a detail is the handle', TOILET, { x: 0, y: -150.5 }, BOWL, 'transform', { kind: 'handle', role: { kind: 'rotate' } }],
		['1: a vertex handle in Edit points', TOILET, { x: 192, y: -148 }, TANK, 'points', { kind: 'handle', role: { kind: 'vertex', index: 2 } }],
		['1: an edge handle in Bend edges', TOILET, { x: 193, y: -95 }, FOOTPRINT, 'bend', { kind: 'handle', role: { kind: 'edge', index: 1 } }],
		['2: the anchor, over the bowl it sits in', TOILET, { x: 3, y: 0 }, null, 'transform', part(ANCHOR)],
		['2: the selected anchor, which offers no handles', TOILET, { x: 0, y: 0 }, ANCHOR, 'transform', part(ANCHOR)],
		['2: the facing tip', TOILET, { x: 0, y: 47 }, null, 'transform', part(FACING)],
		['3: a detail over the footprint is the detail', TOILET, { x: 0, y: 250 }, null, 'transform', part(BOWL)],
		['3: the topmost of two overlapping details', SEATED, { x: 0, y: 250 }, null, 'transform', part({ kind: 'detail', id: 'detail-3' })],
		['3: the tank', TOILET, { x: 0, y: -300 }, FOOTPRINT, 'transform', part(TANK)],
		['4: inside both footprint and clearance is the footprint', TOILET, { x: 150, y: 0 }, null, 'transform', part(FOOTPRINT)],
		['5: the clearance band, outside the footprint', TOILET, { x: 300, y: 0 }, null, 'transform', part(CLEARANCE)],
		['6: nothing', TOILET, { x: 1000, y: 0 }, null, 'transform', null],
		['6: outside a footprint that has no clearance', NO_CLEARANCE, { x: 300, y: 0 }, null, 'transform', null],
	])('%s', (_label, shape, point, selection, mode, expected) => {
		expect(hitDesign(shape, point, { selection, mode, worldPerPixel: 1 })).toEqual(expected);
	});

	it('scales the grab radius with the camera: 8 screen pixels at 10 mm per pixel reach 80 mm', () => {
		expect(hitDesign(TOILET, { x: 75, y: 0 }, { selection: null, mode: 'transform', worldPerPixel: 10 })).toEqual(part(ANCHOR));
	});

	it('finds the facing tip where the arrow draws it', () => {
		expect(facingTip(TOILET, 2)).toEqual({ x: expect.closeTo(0, 9), y: expect.closeTo(88, 9) });
	});
});
```

Create `tests/presentation/designer/selection/snapCandidates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { partKey } from '../../../../src/presentation/designer/selection/designerSelection';
import { designerSnapCandidates } from '../../../../src/presentation/designer/selection/snapCandidates';
import { toiletShape } from '../../../helpers/assetShapes';

/** Spec 2026-09-13 Decision 10: Edit points snaps onto footprint and detail vertices and the anchor. */
describe('designerSnapCandidates', () => {
	it('offers nothing before a shape exists', () => {
		expect(designerSnapCandidates(null, [])).toEqual({});
	});

	it('offers the footprint’s and every detail’s vertices and the anchor, and never the clearance’s', () => {
		const shape = toiletShape();
		expect(designerSnapCandidates(shape, []).vertices).toEqual([
			...shape.footprint.points,
			...shape.details[0].outline.points,
			...shape.details[1].outline.points,
			shape.anchor,
		]);
	});

	it('leaves out the parts being dragged, named by their part keys', () => {
		const shape = toiletShape();
		const exclude = new Set(['footprint', partKey({ kind: 'detail', id: 'detail-2' }), 'anchor']);
		expect(designerSnapCandidates(shape, exclude).vertices).toEqual(shape.details[0].outline.points);
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run check:fast -- tests/presentation/designer/selection`

Expected: `vue-tsc` reports `TS2307` for the four `src/presentation/designer/selection/*` modules and `TS2305: Module '".../layers/anchorLayer"' has no exported member 'facingTip'`; vitest fails all four files on the unresolved imports.

- [ ] **Step 3: Implement the selection modules and `facingTip`**

Create `src/presentation/designer/selection/designerSelection.ts`:

```ts
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';

/** What the designer can select, one at a time (symbols spec, Decision 10): an outline, the anchor, or the facing. */
export type DesignerSelection = OutlinePart | { readonly kind: 'anchor' } | { readonly kind: 'facing' };

/** How a selected outline is handled: its box, its vertices, or its edges' bulges. */
export type SelectionMode = 'transform' | 'points' | 'bend';

export function isOutlineSelection(selection: DesignerSelection | null): selection is OutlinePart {
	return selection !== null && selection.kind !== 'anchor' && selection.kind !== 'facing';
}

/** 'footprint' | 'clearance' | 'detail:<id>' | 'anchor' | 'facing' — the exclusion key snap candidates take. */
export function partKey(selection: DesignerSelection): string {
	return selection.kind === 'detail' ? `detail:${selection.id}` : selection.kind;
}

/** The same PART, compared by key: two detail selections are the same when their ids are. */
export function sameSelection(a: DesignerSelection | null, b: DesignerSelection | null): boolean {
	return a === null || b === null ? a === b : partKey(a) === partKey(b);
}

/** Does the part still exist on this shape? A null shape has no parts. */
export function selectionExists(shape: AssetShape | null, selection: DesignerSelection): boolean {
	if (shape === null) return false;
	return isOutlineSelection(selection) ? outlineOf(shape, selection) !== null : true;
}
```

Create `src/presentation/designer/selection/handles.ts`:

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { arcPoint } from '../../../core/geometry/circularArc';
import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf } from '../../../domain/asset/shapeEdits';
import { ROTATION_HANDLE_OFFSET_PX } from '../../editor/handleMetrics';
import { isOutlineSelection, type DesignerSelection, type SelectionMode } from './designerSelection';

export type HandleRole =
	| { readonly kind: 'box'; readonly index: number }
	| { readonly kind: 'rotate' }
	| { readonly kind: 'vertex'; readonly index: number }
	| { readonly kind: 'edge'; readonly index: number };

export interface SelectionHandle {
	readonly role: HandleRole;
	readonly at: Point;
}

/** Per box handle, clockwise from the top-left: which of min, middle, max it takes on each axis. */
const BOX_COLUMN = [0, 1, 2, 2, 2, 1, 0, 0] as const;
const BOX_ROW = [0, 0, 0, 1, 2, 2, 2, 1] as const;

/**
 * Where box handle `index` sits — and, asked for `(index + 4) % 8`, the corner or side midpoint a
 * resize from `index` holds still, which is why the drag arithmetic asks this rather than a copy.
 */
export function boxHandlePoint(box: BoundingBox, index: number): Point {
	return {
		x: [box.min.x, (box.min.x + box.max.x) / 2, box.max.x][BOX_COLUMN[index]],
		y: [box.min.y, (box.min.y + box.max.y) / 2, box.max.y][BOX_ROW[index]],
	};
}

/**
 * The handles a selection offers in a mode (symbols spec, Decision 10). `[]` for no selection, for
 * the anchor or the facing — each is dragged as itself — and for a part the shape lacks. The box is
 * the outline's curve-aware extent, so an arc bowing past its corners is inside it.
 *
 * `unwrap` rather than a refusal arm: every shape reaching here has been through
 * `validateAssetShape`, whose outlines always have a box.
 */
export function selectionHandles(
	shape: AssetShape,
	selection: DesignerSelection | null,
	mode: SelectionMode,
	worldPerPixel: number,
): SelectionHandle[] {
	if (!isOutlineSelection(selection)) return [];
	const outline = outlineOf(shape, selection);
	if (outline === null) return [];
	const { points } = outline;
	if (mode === 'points') return points.map((at, index): SelectionHandle => ({ role: { kind: 'vertex', index }, at }));
	if (mode === 'bend') {
		return points.map((start, index): SelectionHandle => ({
			role: { kind: 'edge', index },
			at: arcPoint({ start, end: points[(index + 1) % points.length], bulge: outline.bulges?.[index] ?? 0 }, 0.5),
		}));
	}
	const box = unwrap(boundingBoxOf(outline));
	return [
		...BOX_COLUMN.map((_, index): SelectionHandle => ({ role: { kind: 'box', index }, at: boxHandlePoint(box, index) })),
		{ role: { kind: 'rotate' }, at: { x: boxHandlePoint(box, 1).x, y: box.min.y - ROTATION_HANDLE_OFFSET_PX * worldPerPixel } },
	];
}
```

Create `src/presentation/designer/selection/hitTest.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import { curvedContains } from '../../../core/geometry/curveContains';
import { distance } from '../../../core/geometry/operations';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { VERTEX_GRAB_RADIUS_PX } from '../../editor/handleMetrics';
import { facingTip } from '../layers/anchorLayer';
import type { DesignerSelection, SelectionMode } from './designerSelection';
import { selectionHandles, type HandleRole, type SelectionHandle } from './handles';

export type DesignerHit =
	| { readonly kind: 'handle'; readonly role: HandleRole }
	| { readonly kind: 'part'; readonly selection: DesignerSelection }
	| null;

const part = (selection: DesignerSelection): DesignerHit => ({ kind: 'part', selection });

/** The nearest handle within `radius`, or null. */
function nearestHandle(handles: readonly SelectionHandle[], point: Point, radius: number): SelectionHandle | null {
	let best: SelectionHandle | null = null;
	let bestDistance = radius;
	for (const handle of handles) {
		const gap = distance(handle.at, point);
		if (gap <= bestDistance) {
			best = handle;
			bestDistance = gap;
		}
	}
	return best;
}

/**
 * What a press at `point` lands on, in the spec's deterministic order (Decision 10, PBI extension
 * 1b): the selection's own handles; the anchor, then the facing tip; details, topmost first; the
 * footprint; the clearance band; nothing. Each step is asked only when every earlier one declined,
 * which is what makes a handle drawn over a detail the handle, a detail over the footprint the
 * detail, and the clearance a BAND — by the time it is asked the point is already outside the
 * footprint.
 *
 * The grab radius is `VERTEX_GRAB_RADIUS_PX` screen pixels at every zoom, the plan editor's own.
 */
export function hitDesign(
	shape: AssetShape,
	point: Point,
	state: { readonly selection: DesignerSelection | null; readonly mode: SelectionMode; readonly worldPerPixel: number },
): DesignerHit {
	const radius = VERTEX_GRAB_RADIUS_PX * state.worldPerPixel;
	const handle = nearestHandle(selectionHandles(shape, state.selection, state.mode, state.worldPerPixel), point, radius);
	if (handle !== null) return { kind: 'handle', role: handle.role };
	if (distance(shape.anchor, point) <= radius) return part({ kind: 'anchor' });
	if (distance(facingTip(shape, state.worldPerPixel), point) <= radius) return part({ kind: 'facing' });
	const detail = shape.details.findLast((candidate) => curvedContains(candidate.outline, point));
	if (detail !== undefined) return part({ kind: 'detail', id: detail.id });
	if (curvedContains(shape.footprint, point)) return part({ kind: 'footprint' });
	if (shape.clearance !== null && curvedContains(shape.clearance, point)) return part({ kind: 'clearance' });
	return null;
}
```

(`findLast` is available: `tsconfig.json`'s `lib` carries `ES2023.Array`.)

Create `src/presentation/designer/selection/snapCandidates.ts`:

```ts
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapCandidates } from '../../editor/snapping/snap-service';
import { partKey } from './designerSelection';

/**
 * Vertices of the footprint and every detail, plus the anchor — minus the parts whose partKey is in
 * `exclude`. Clearance vertices are not candidates. `{}` for a null shape.
 */
export function designerSnapCandidates(shape: AssetShape | null, exclude: Iterable<string>): SnapCandidates {
	if (shape === null) return {};
	const skip = new Set(exclude);
	return {
		vertices: [
			...(skip.has('footprint') ? [] : shape.footprint.points),
			...shape.details
				.filter((detail) => !skip.has(partKey({ kind: 'detail', id: detail.id })))
				.flatMap((detail) => detail.outline.points),
			...(skip.has('anchor') ? [] : [shape.anchor]),
		],
	};
}
```

Modify `src/presentation/designer/layers/anchorLayer.ts`.

Edit 1 — import:

old:
```ts
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
```
new:
```ts
import type { Point } from '../../../core/geometry/Point';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
```

Edit 2 — the length's docblock, which said nothing grabs the arrow:

old:
```ts
 * Declared here rather than in `handleMetrics.ts`, which is deliberate: that module is about
 * vertex marks and the regions that GRAB them, and nothing grabs this arrow — Task B5's
 * set-facing tool takes a drag anywhere on the canvas and reads its direction. A length in a
 * module about grab targets would invite the next author to treat it as one.
 */
```
new:
```ts
 * Declared here rather than in `handleMetrics.ts`, which is deliberate: that module is about
 * vertex marks and the regions that GRAB them, and these are drawn sizes. The arrow's TIP has been
 * grabbable since the symbols spec's Decision 10 — the select tool's hit order asks `facingTip`
 * below — but by `VERTEX_GRAB_RADIUS_PX` around that point, so the length is still what the arrow
 * draws and not a grab region. Task B5's set-facing tool still takes a drag anywhere on the canvas.
 */
```

Edit 3 — the shared tip:

old:
```ts
export function anchorMark(
```
new:
```ts
/**
 * The far end of the facing arrow: the anchor plus `FACING_LENGTH_PX` screen pixels along the
 * facing. One statement of where the tip is, shared by the arrow drawn here and the select tool's
 * hit order, so the point a user grabs is the point they see.
 */
export function facingTip(shape: AssetShape, worldPerPixel: number): Point {
	const length = FACING_LENGTH_PX * worldPerPixel;
	return { x: shape.anchor.x + Math.cos(shape.facing) * length, y: shape.anchor.y + Math.sin(shape.facing) * length };
}

export function anchorMark(
```

Edit 4 — `facingArrow` uses it (same arithmetic, so `layers.test.ts`'s exact expectations stand):

old:
```ts
	const { x, y } = shape.anchor;
	const length = FACING_LENGTH_PX * worldPerPixel;
	const head = FACING_HEAD_PX * worldPerPixel;
	const tipX = x + dx * length;
	const tipY = y + dy * length;
```
new:
```ts
	const { x, y } = shape.anchor;
	const head = FACING_HEAD_PX * worldPerPixel;
	const { x: tipX, y: tipY } = facingTip(shape, worldPerPixel);
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npm run check:fast -- tests/presentation/designer/selection tests/presentation/designer/layers.test.ts`

Expected: oxlint and `vue-tsc` clean; all pass (`designerSelection` 9 tests, `handles` 10, `hitTest` 16, `snapCandidates` 3; `layers.test.ts` unchanged and green).

- [ ] **Step 5: Write the failing store test**

Create `tests/presentation/designer/assetDesignStoreSelection.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import type { AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { assetDesign } from '../../helpers/assetDesign';
import { toiletShape } from '../../helpers/assetShapes';

/**
 * Spec 2026-09-13 Decision 10 and Amendment 1: the selection lives in the designer's own store, per
 * leaf, writes nothing, and clears when what it names stops existing. The store is asked directly;
 * the canvas that reads it is the rig's subject.
 */
const BOWL = { kind: 'detail', id: 'detail-2' } as const;
const OPTIONS = { indexScanCompleted: true } as const;
const VAULT_FAILED: AssetDesignError = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'the vault could not be read' };

function answering(shape: AssetShape | null): AssetDesignerQueryServices {
	return { getAssetDesign: () => Promise.resolve(ok(assetDesign({ shape }))) };
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('the designer selection in the design store', () => {
	it('starts with nothing selected, in Transform, with no preview', () => {
		const store = useAssetDesignStore();
		expect([store.selection, store.mode, store.preview]).toEqual([null, 'transform', null]);
	});

	it('keeps the mode when the same part is chosen again, and resets it for a different part', () => {
		const store = useAssetDesignStore();
		store.select({ kind: 'footprint' });
		store.setMode('points');
		store.select({ kind: 'footprint' });
		expect(store.mode).toBe('points');
		store.select(BOWL);
		expect([store.selection, store.mode]).toEqual([BOWL, 'transform']);
	});

	it('drops an in-flight preview whenever a selection is chosen', () => {
		const store = useAssetDesignStore();
		store.setPreview(toiletShape());
		expect(store.preview).not.toBeNull();
		store.select(null);
		expect(store.preview).toBeNull();
	});

	it('keeps a selection whose part the next read still has', async () => {
		const store = useAssetDesignStore();
		await store.hydrate(answering(toiletShape()), 'asset-1', OPTIONS);
		store.select(BOWL);
		await store.hydrate(answering(toiletShape()), 'asset-1', OPTIONS);
		expect(store.selection).toEqual(BOWL);
	});

	it('drops a selection whose detail the next read no longer has', async () => {
		const store = useAssetDesignStore();
		const toilet = toiletShape();
		await store.hydrate(answering(toilet), 'asset-1', OPTIONS);
		store.select(BOWL);
		await store.hydrate(answering({ ...toilet, details: toilet.details.slice(0, 1) }), 'asset-1', OPTIONS);
		expect(store.selection).toBeNull();
	});

	it('drops the selection when a read fails and the design goes with it', async () => {
		const store = useAssetDesignStore();
		await store.hydrate(answering(toiletShape()), 'asset-1', OPTIONS);
		store.select({ kind: 'anchor' });
		await store.hydrate({ getAssetDesign: () => Promise.resolve(err(VAULT_FAILED)) }, 'asset-1', OPTIONS);
		expect([store.status, store.selection]).toEqual(['failed', null]);
	});
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npm run check:fast -- tests/presentation/designer/assetDesignStoreSelection.test.ts`

Expected: `vue-tsc` reports `TS2339: Property 'select'` / `'setMode'` / `'setPreview'` / `'selection'` / `'mode'` / `'preview'` does not exist on the store; vitest fails all six cases — five on `store.select is not a function` / `store.setPreview is not a function`, and the first comparing `[undefined, undefined, undefined]` with `[null, 'transform', null]`.

- [ ] **Step 7: Implement the store**

Modify `src/presentation/designer/stores/assetDesignStore.ts`.

Edit 1 — imports:

old:
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { isErr } from '../../../core/result/Result';
import type { AssetDesignDto, AssetDesignError } from '../../../application/queries/GetAssetDesign';
import type { AssetDesignerQueryServices } from '../../read-models/assetDesignerQueries';
```
new:
```ts
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { isErr } from '../../../core/result/Result';
import type { AssetDesignDto, AssetDesignError } from '../../../application/queries/GetAssetDesign';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { AssetDesignerQueryServices } from '../../read-models/assetDesignerQueries';
import { sameSelection, selectionExists, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
```

Edit 2 — state and doors, after `stale`:

old:
```ts
	const stale = ref(false);

	/**
	 * The ticket every
```
new:
```ts
	const stale = ref(false);

	/**
	 * The designer's selection (symbols spec, Decision 10): one part at a time, per leaf, writing
	 * nothing. It names a PART rather than holding a copy of one, so every read of the design is
	 * the truth about what is selected, and `hydrate` drops a selection whose part a write or an
	 * undo has removed.
	 */
	const selection = ref<DesignerSelection | null>(null);
	const mode = ref<SelectionMode>('transform');
	/**
	 * A gesture's in-flight shape, drawn instead of `design.shape` while a drag is live. Shallow:
	 * a validated shape is replaced whole on every move and never mutated, so deep reactivity
	 * would only proxy geometry nothing edits in place.
	 */
	const preview = shallowRef<AssetShape | null>(null);

	/** Choosing a DIFFERENT part resets the mode to Transform; re-choosing the selected part keeps it (Amendment 1). */
	function select(next: DesignerSelection | null): void {
		if (!sameSelection(selection.value, next)) mode.value = 'transform';
		selection.value = next;
		preview.value = null;
	}

	function setMode(next: SelectionMode): void {
		mode.value = next;
	}

	function setPreview(shape: AssetShape | null): void {
		preview.value = shape;
	}

	/**
	 * The ticket every
```

Edit 3 — `fail`:

old:
```ts
		design.value = null;
		error.value = cause;
		status.value = 'failed';
```
new:
```ts
		design.value = null;
		error.value = cause;
		status.value = 'failed';
		// Nothing is drawn, so nothing can be selected.
		selection.value = null;
```

Edit 4 — `hydrate`'s success arm:

old:
```ts
		design.value = found.value;
		status.value = 'ready';
```
new:
```ts
		design.value = found.value;
		// A delete, or an undo that removed a detail, leaves nothing for the selection to name.
		if (selection.value !== null && !selectionExists(found.value.shape, selection.value)) selection.value = null;
		status.value = 'ready';
```

Edit 5 — returned members:

old:
```ts
	return { design, error, status, stale, hydrate };
```
new:
```ts
	return { design, error, status, stale, hydrate, selection, mode, preview, select, setMode, setPreview };
```

- [ ] **Step 8: Run it and watch it pass, then the widened-contract sweep**

Run: `npm run check:fast -- tests/presentation/designer/assetDesignStoreSelection.test.ts`

Expected: 6 passed.

The store's returned members widened (Global Constraint), so also run: `npm run check:fast -- tests/presentation tests/helpers`

Expected: green; no existing designer, refresh or root case changes.

- [ ] **Step 9: Lint**

Run: `npx eslint src/presentation/designer/selection/designerSelection.ts src/presentation/designer/selection/handles.ts src/presentation/designer/selection/hitTest.ts src/presentation/designer/selection/snapCandidates.ts src/presentation/designer/layers/anchorLayer.ts src/presentation/designer/stores/assetDesignStore.ts tests/helpers/assetShapes.ts tests/presentation/designer/selection/designerSelection.test.ts tests/presentation/designer/selection/handles.test.ts tests/presentation/designer/selection/hitTest.test.ts tests/presentation/designer/selection/snapCandidates.test.ts tests/presentation/designer/assetDesignStoreSelection.test.ts`

Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add src/presentation/designer/selection/designerSelection.ts src/presentation/designer/selection/handles.ts src/presentation/designer/selection/hitTest.ts src/presentation/designer/selection/snapCandidates.ts src/presentation/designer/layers/anchorLayer.ts src/presentation/designer/stores/assetDesignStore.ts tests/helpers/assetShapes.ts tests/presentation/designer/selection/designerSelection.test.ts tests/presentation/designer/selection/handles.test.ts tests/presentation/designer/selection/hitTest.test.ts tests/presentation/designer/selection/snapCandidates.test.ts tests/presentation/designer/assetDesignStoreSelection.test.ts
git commit -m "$(cat <<'EOF'
feat(designer): the selection model — parts, handles, hit order, store

What the asset designer can select, where each mode's handles sit, the
six-step hit order as a table, Edit points' snap candidates, and the
per-leaf selection, mode and preview in the design store, pruned when a
read no longer has the selected part (symbols spec Decision 10).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Drag arithmetic — `src/presentation/designer/selection/selectionDrag.ts`

**Files:**
- Create: `src/presentation/designer/selection/selectionDrag.ts`
- Test: `tests/presentation/designer/selection/selectionDrag.test.ts` (node)

**Interfaces:**
- Consumes: `moveAnchor`, `moveOutline`, `moveVertex`, `outlineOf`, `partNotFound`, `resizeBox`, `rotateOutline`, `setFacing`, `OutlinePart` (Task 1); `DesignerSelection`, `isOutlineSelection`, `HandleRole`, `boxHandlePoint` (Task 3).
- Produces:
```ts
export type DragRole = { readonly kind: 'body' } | Exclude<HandleRole, { readonly kind: 'edge' }>;
export interface DragStart {
  readonly shape: AssetShape;               // the design the gesture started on
  readonly selection: DesignerSelection;
  readonly role: DragRole;
  readonly from: Point;                     // world point of the press
}
export interface DragOptions { readonly shift: boolean; readonly snapRotation: (radians: number) => number }
/** The shape this drag would write if released at `to`. `to` is already snapped by the caller where snapping applies. */
export function draggedShape(start: DragStart, to: Point, options: DragOptions): Result<AssetShape, ValidationError>;
```

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/designer/selection/selectionDrag.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { draggedShape, type DragOptions, type DragStart } from '../../../../src/presentation/designer/selection/selectionDrag';
import { editableShape, QUARTER } from '../../../helpers/assetShapes';
import { expectErr, expectOk } from '../../../helpers/domain';

/**
 * Spec 2026-09-13 Decision 10 and Amendment 1: what a drag would write, per role. `editableShape`'s
 * `detail-1` ("top") spans x -400..0 by y -100..100 — box handles TL (-400,-100), T (-200,-100),
 * TR (0,-100), R (0,0), BR (0,100), B (-200,100), BL (-400,100), L (-400,0) — and `detail-2`
 * ("bowl") is a circle of radius 100 on (250, 0).
 */
const SHAPE = editableShape();
const FOOTPRINT: DesignerSelection = { kind: 'footprint' };
const TOP: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const STEP = Math.PI / 12;
const snapToStep = (radians: number): number => Math.round(radians / STEP) * STEP;
const FREE: DragOptions = { shift: false, snapRotation: snapToStep };
const SHIFT: DragOptions = { shift: true, snapRotation: snapToStep };
const ORIGIN: Point = { x: 0, y: 0 };

const near = (pairs: readonly (readonly [number, number])[]) =>
	pairs.map(([x, y]) => ({ x: expect.closeTo(x, 9), y: expect.closeTo(y, 9) }));

function drag(start: Omit<DragStart, 'shape'>, to: Point, options: DragOptions = FREE) {
	return draggedShape({ shape: SHAPE, ...start }, to, options);
}

describe('a body drag', () => {
	it('moves the footprint by the pointer’s travel', () => {
		const moved = expectOk(drag({ selection: FOOTPRINT, role: { kind: 'body' }, from: ORIGIN }, { x: 30, y: -40 }));
		expect(moved.footprint.points).toEqual([{ x: -470, y: -340 }, { x: 530, y: -340 }, { x: 530, y: 260 }, { x: -470, y: 260 }]);
	});

	it('moves a detail, bulges and all, and nothing else', () => {
		const moved = expectOk(drag({ selection: BOWL, role: { kind: 'body' }, from: { x: 250, y: 0 } }, { x: 260, y: 10 }));
		expect(moved.details[1].outline.points).toEqual(near([[260, -90], [360, 10], [260, 110], [160, 10]]));
		expect(moved.details[1].outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
		expect([moved.details[0], moved.footprint]).toEqual([SHAPE.details[0], SHAPE.footprint]);
	});
});

describe('a box handle drag', () => {
	it('moves both axes from a corner, holding the opposite corner', () => {
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 4 }, from: { x: 0, y: 100 } }, { x: 200, y: 300 }));
		expect(resized.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 300 }, { x: -400, y: 300 }]);
	});

	it('moves one axis from a side, holding the opposite side', () => {
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 3 }, from: ORIGIN }, { x: 100, y: 55 }));
		expect(resized.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -400, y: 100 }]);
	});

	it('keeps proportions from a corner with Shift, taking the factor that strays further from 1', () => {
		// x by 1.5, y by 1.25: 1.5 wins.
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 4 }, from: { x: 0, y: 100 } }, { x: 200, y: 150 }, SHIFT));
		expect(resized.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 200 }, { x: -400, y: 200 }]);
	});

	it('keeps proportions from a side with Shift, scaling the other axis about the fixed side’s midpoint', () => {
		// The bottom handle doubles the depth, so the width doubles about x = -200.
		const resized = expectOk(drag({ selection: TOP, role: { kind: 'box', index: 5 }, from: { x: -200, y: 100 } }, { x: 0, y: 300 }, SHIFT));
		expect(resized.details[0].outline.points).toEqual([{ x: -600, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 300 }, { x: -600, y: 300 }]);
	});

	it.each([
		['onto', -400],
		['past', -450],
	])('refuses a right handle dragged %s the left edge', (_label, x) => {
		const refused = drag({ selection: TOP, role: { kind: 'box', index: 3 }, from: ORIGIN }, { x, y: 0 });
		expect(expectErr(refused).code).toBe('asset.invalid-scale');
	});

	it('answers part-not-found for a selection the design no longer has', () => {
		const stale = drag({ selection: { kind: 'detail', id: 'detail-9' }, role: { kind: 'box', index: 0 }, from: ORIGIN }, ORIGIN);
		expect(expectErr(stale).code).toBe('asset.part-not-found');
	});
});

describe('a rotate handle drag', () => {
	it('turns the outline about its box centre by the pointer’s swept angle, keeping bulges', () => {
		const turned = expectOk(drag({ selection: BOWL, role: { kind: 'rotate' }, from: { x: 350, y: 0 } }, { x: 250, y: 100 }));
		expect(turned.details[1].outline.points).toEqual(near([[350, 0], [250, 100], [150, 0], [250, -100]]));
		expect(turned.details[1].outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('snaps the swept angle with Shift', () => {
		const snapRotation = vi.fn<(radians: number) => number>(snapToStep);
		const raw = (50 * Math.PI) / 180;
		const to = { x: -200 + 100 * Math.cos(raw), y: 100 * Math.sin(raw) };
		const turned = expectOk(drag({ selection: TOP, role: { kind: 'rotate' }, from: ORIGIN }, to, { shift: true, snapRotation }));
		expect(snapRotation).toHaveBeenCalledWith(expect.closeTo(raw, 9));
		// 50 degrees snaps to 45, about the top's centre (-200, 0).
		const half = Math.SQRT1_2;
		expect(turned.details[0].outline.points).toEqual(
			near([
				[-200 - 100 * half, -300 * half],
				[-200 + 300 * half, 100 * half],
				[-200 + 100 * half, 300 * half],
				[-200 - 300 * half, -100 * half],
			]),
		);
	});
});

describe('the other drags', () => {
	it('moves a vertex to the pointer', () => {
		const moved = expectOk(drag({ selection: TOP, role: { kind: 'vertex', index: 2 }, from: ORIGIN }, { x: 50, y: 150 }));
		expect(moved.details[0].outline.points).toEqual([{ x: -400, y: -100 }, { x: 0, y: -100 }, { x: 50, y: 150 }, { x: -400, y: 100 }]);
	});

	it('moves the anchor by the pointer’s travel', () => {
		const moved = expectOk(drag({ selection: { kind: 'anchor' }, role: { kind: 'body' }, from: { x: 5, y: 5 } }, { x: 20, y: 0 }));
		expect(moved.anchor).toEqual({ x: 15, y: -5 });
	});

	it('turns the facing to the pointer’s bearing from the anchor', () => {
		const turned = expectOk(drag({ selection: { kind: 'facing' }, role: { kind: 'body' }, from: ORIGIN }, { x: 0, y: 100 }));
		expect(turned.facing).toBeCloseTo(Math.PI / 2, 12);
	});

	it('snaps the facing’s bearing with Shift', () => {
		// atan2(90, 100) is about 42 degrees, which snaps to 45.
		const turned = expectOk(drag({ selection: { kind: 'facing' }, role: { kind: 'body' }, from: ORIGIN }, { x: 100, y: 90 }, SHIFT));
		expect(turned.facing).toBeCloseTo(Math.PI / 4, 12);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run check:fast -- tests/presentation/designer/selection/selectionDrag.test.ts`

Expected: `vue-tsc` reports `TS2307: Cannot find module '../../../../src/presentation/designer/selection/selectionDrag'`; vitest fails the file on the unresolved import.

- [ ] **Step 3: Implement**

Create `src/presentation/designer/selection/selectionDrag.ts`:

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, isErr, ok, unwrap, type Result } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import {
	moveAnchor,
	moveOutline,
	moveVertex,
	outlineOf,
	partNotFound,
	resizeBox,
	rotateOutline,
	setFacing,
	type OutlinePart,
} from '../../../domain/asset/shapeEdits';
import { isOutlineSelection, type DesignerSelection } from './designerSelection';
import { boxHandlePoint, type HandleRole } from './handles';

/** A body drag, or a handle. An `edge` handle is Bend edges', which `CurveTool` drives, so it is not a role here. */
export type DragRole = { readonly kind: 'body' } | Exclude<HandleRole, { readonly kind: 'edge' }>;

export interface DragStart {
	/** The design the gesture started on. */
	readonly shape: AssetShape;
	readonly selection: DesignerSelection;
	readonly role: DragRole;
	/** World point of the press. */
	readonly from: Point;
}

export interface DragOptions {
	readonly shift: boolean;
	readonly snapRotation: (radians: number) => number;
}

/** The selected outline's box, or `part-not-found` for a selection the shape no longer has. */
function boxOf(shape: AssetShape, part: OutlinePart): Result<BoundingBox, ValidationError> {
	const outline = outlineOf(shape, part);
	return outline === null ? err(partNotFound(part)) : ok(unwrap(boundingBoxOf(outline)));
}

/**
 * The factors and fixed point of a box-handle resize. The moved handle follows `to`, and the handle
 * opposite it holds still, so a factor is the new span over the old one along each axis the handle
 * moves — a side handle's other axis is exactly 1, because both midpoints are computed identically.
 * Dragged past the fixed side, a factor goes non-positive and `resizeBox` refuses it.
 *
 * Shift keeps proportions: both factors become whichever strays further from 1, for a side handle
 * as for a corner.
 */
function boxResize(
	box: BoundingBox,
	index: number,
	to: Point,
	shift: boolean,
): { readonly factors: { readonly sx: number; readonly sy: number }; readonly origin: Point } {
	const handle = boxHandlePoint(box, index);
	const origin = boxHandlePoint(box, (index + 4) % 8);
	const sx = handle.x === origin.x ? 1 : (to.x - origin.x) / (handle.x - origin.x);
	const sy = handle.y === origin.y ? 1 : (to.y - origin.y) / (handle.y - origin.y);
	if (!shift) return { factors: { sx, sy }, origin };
	const uniform = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
	return { factors: { sx: uniform, sy: uniform }, origin };
}

/**
 * The shape this drag would write if released at `to` (symbols spec, Decision 10 and Amendment 1).
 * `to` is already snapped by the caller where snapping applies. Pure: the tool calls it on every move
 * for the preview and once more at release for the write, so the two cannot disagree.
 *
 * The anchor and the facing have no handles, so their drags ignore `role`: the anchor moves by the
 * pointer's travel, and the facing takes the pointer's bearing from the anchor.
 */
export function draggedShape(start: DragStart, to: Point, options: DragOptions): Result<AssetShape, ValidationError> {
	const { shape, selection, role, from } = start;
	if (!isOutlineSelection(selection)) {
		if (selection.kind === 'anchor') {
			return moveAnchor(shape, { x: shape.anchor.x + to.x - from.x, y: shape.anchor.y + to.y - from.y });
		}
		const bearing = Math.atan2(to.y - shape.anchor.y, to.x - shape.anchor.x);
		return setFacing(shape, options.shift ? options.snapRotation(bearing) : bearing);
	}
	if (role.kind === 'body') return moveOutline(shape, selection, { dx: to.x - from.x, dy: to.y - from.y });
	if (role.kind === 'vertex') return moveVertex(shape, selection, role.index, to);
	const box = boxOf(shape, selection);
	if (isErr(box)) return box;
	if (role.kind === 'box') {
		const { factors, origin } = boxResize(box.value, role.index, to, options.shift);
		return resizeBox(shape, selection, factors, origin);
	}
	const centre = { x: (box.value.min.x + box.value.max.x) / 2, y: (box.value.min.y + box.value.max.y) / 2 };
	const by = Math.atan2(to.y - centre.y, to.x - centre.x) - Math.atan2(from.y - centre.y, from.x - centre.x);
	return rotateOutline(shape, selection, options.shift ? options.snapRotation(by) : by, centre);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run check:fast -- tests/presentation/designer/selection/selectionDrag.test.ts`

Expected: oxlint and `vue-tsc` clean; 15 passed.

- [ ] **Step 5: Lint**

Run: `npx eslint src/presentation/designer/selection/selectionDrag.ts tests/presentation/designer/selection/selectionDrag.test.ts`

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/selection/selectionDrag.ts tests/presentation/designer/selection/selectionDrag.test.ts
git commit -m "$(cat <<'EOF'
feat(designer): drag arithmetic for a selection

What a body, box, rotate or vertex drag would write, including Shift's
proportional resize and snapped rotation, and the anchor's and facing's
own drags — one pure function the select tool asks for its preview and
its write alike (symbols spec Decision 10, Amendment 1).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The designer `select` tool — Transform and Edit points

**Files:**
- Create: `src/presentation/designer/tools/designer-select-tool.ts`
- Create: `tests/helpers/designerSelection.ts` (the toilet fixture, point helpers and the unit rig — shared by Tasks 6, 7 and 8, so no test file carries a copy)
- Test: `tests/presentation/designer/tools/designerSelectTool.test.ts`

**Interfaces:**
- Consumes: `hitDesign`, `DesignerHit` (`selection/hitTest.ts`), `DesignerSelection`, `SelectionMode`, `partKey` (`selection/designerSelection.ts`), `designerSnapCandidates` (`selection/snapCandidates.ts`, test helper only), `facingTip` (`layers/anchorLayer.ts`, tests only), `draggedShape`, `DragStart`, `DragRole` (`selection/selectionDrag.ts`) — all exactly as the outline declares them.
- Produces:
```ts
export interface DesignerSelectToolDeps {
  readonly design: () => { readonly shape: AssetShape; readonly geometryVersion: EntityVersion } | null; // null = nothing drawn yet
  readonly selection: () => DesignerSelection | null;
  readonly mode: () => SelectionMode;
  readonly select: (next: DesignerSelection | null) => void;
  readonly setPreview: (shape: AssetShape | null) => void;
  /** One reversible SetAssetShape write, conditional on `expected`. */
  readonly createCommand: (shape: AssetShape, expected: EntityVersion) => UndoableCommand;
  readonly reportRejected: (error: AppError) => void;     // a dispatched refusal
  readonly reportInvalidInput: (error: AppError) => void; // a domain refusal at release; nothing dispatched
}
export class DesignerSelectTool implements EditorTool {
  readonly id: ToolId = 'select';
  constructor(deps: DesignerSelectToolDeps);
  activate(context: EditorContext): void; deactivate(): void;
  pointerDown(event: EditorPointerEvent): void; pointerMove(event: EditorPointerEvent): void; pointerUp(event: EditorPointerEvent): void;
  cancel(): void; abandonGesture(): void; hasDraft(): boolean; tracksPointer(): boolean;
}
```

Geometry the cases rely on, all read from `TOILET` (the `toilet` preset at its defaults), never typed in: the tank `detail-1` is the straight rectangle `(-190,-350) (190,-350) (190,-150) (-190,-150)`; the bowl `detail-2` is the stadium on `(-152,27) (152,27) (152,173) (-152,173)` with bulges `[1,0,1,0]`; footprint vertex 2 is `(190,160)`; anchor `(0,0)`, facing `π/2`. The unit context is one world millimetre per pixel, so the grab radius is 8 mm and the click epsilon 4 mm.

- [ ] **Step 1: Write the shared fixture helper** — `tests/helpers/designerSelection.ts`:

```ts
/**
 * Fixtures for the asset designer's selection (symbols spec, Decision 10): a toilet built by its REAL
 * preset, a point just inside an outline, and the unit rig `DesignerSelectTool` is driven by.
 *
 * Shared rather than copied, so the unit suites and the mounted ones name one shape and one set of
 * points — and so every coordinate a case uses is DERIVED from the preset, never typed beside it.
 */
import type { AppError } from '../../src/core/errors/AppError';
import type { CurvedPolygon } from '../../src/core/geometry/CurvedPolygon';
import type { Point } from '../../src/core/geometry/Point';
import { ok } from '../../src/core/result/Result';
import type { DispatchResult } from '../../src/application/commands/DispatchOutcome';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { AssetShape } from '../../src/domain/asset/AssetShape';
import type { DesignerSelection, SelectionMode } from '../../src/presentation/designer/selection/designerSelection';
import { designerSnapCandidates } from '../../src/presentation/designer/selection/snapCandidates';
import { DesignerSelectTool } from '../../src/presentation/designer/tools/designer-select-tool';
import { expectDefined, observationToken } from './domain';
import { toiletShape } from './assetShapes';
import { toolContext, type ToolContextHarness, type ToolContextOptions } from './tool-context';

/** The toilet at its default size: a round-fronted footprint, a front clearance, `detail-1` the tank, `detail-2` the bowl. */
export const TOILET: AssetShape = toiletShape(); // Task 3's fixture, one definition

/** A detail of `TOILET`'s outline by id, so a case names the part rather than an array index. */
export function detailOutline(id: string): CurvedPolygon {
	return expectDefined(TOILET.details.find((detail) => detail.id === id), `detail ${id}`).outline;
}

/**
 * Ten millimetres above an outline's lowest corner point, on its horizontal centre. Inside the tank,
 * the bowl's straight middle and the footprint alike — and more than a grab radius from the anchor at
 * both cameras the suites use (8 mm in the unit rig, 80 mm in the mounted one).
 */
export function justInsideBottom(outline: CurvedPolygon): Point {
	const xs = outline.points.map((point) => point.x);
	return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...outline.points.map((point) => point.y)) - 10 };
}

/** The version every unit-rig design reads as, so a case can assert the write was made conditional on it. */
export const DESIGN_VERSION: EntityVersion = { revision: 7, observed: observationToken('geometry-7') };

export interface SelectToolRigOptions {
	/** Default `TOILET`; `null` is an asset nobody has drawn on. */
	readonly shape?: AssetShape | null;
	readonly selection?: DesignerSelection | null;
	readonly mode?: SelectionMode;
	readonly context?: ToolContextOptions;
}

export interface SelectToolRig {
	readonly tool: DesignerSelectTool;
	readonly harness: ToolContextHarness;
	/** Every `select` call, in order. */
	readonly selected: (DesignerSelection | null)[];
	/** Every `setPreview` call, in order. */
	readonly previews: (AssetShape | null)[];
	/** Every write built, with the version it was made conditional on. */
	readonly written: { readonly shape: AssetShape; readonly expected: EntityVersion }[];
	readonly rejected: AppError[];
	readonly invalid: AppError[];
}

/**
 * `DesignerSelectTool` over the real hit order, the real drag arithmetic and the REAL snap service
 * (`tool-context.ts`'s subclass), with the store's four members replaced by recorders. The snap
 * candidates are the designer's own function over the same shape the tool reads.
 */
export function selectToolRig(options: SelectToolRigOptions = {}): SelectToolRig {
	const shape = options.shape === undefined ? TOILET : options.shape;
	let selection = options.selection ?? null;
	const mode = options.mode ?? 'transform';
	const selected: SelectToolRig['selected'] = [];
	const previews: SelectToolRig['previews'] = [];
	const written: SelectToolRig['written'] = [];
	const rejected: AppError[] = [];
	const invalid: AppError[] = [];
	const harness = toolContext({
		snapCandidates: (exclude) => designerSnapCandidates(shape, exclude ?? []),
		...options.context,
	});
	const tool = new DesignerSelectTool({
		design: () => (shape === null ? null : { shape, geometryVersion: DESIGN_VERSION }),
		selection: () => selection,
		mode: () => mode,
		select: (next) => {
			selected.push(next);
			selection = next;
		},
		setPreview: (next) => {
			previews.push(next);
		},
		createCommand: (next, expected) => {
			written.push({ shape: next, expected });
			return {
				execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
				undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
			};
		},
		reportRejected: (error) => {
			rejected.push(error);
		},
		reportInvalidInput: (error) => {
			invalid.push(error);
		},
	});
	return { tool, harness, selected, previews, written, rejected, invalid };
}
```

- [ ] **Step 2: Write the failing test** — `tests/presentation/designer/tools/designerSelectTool.test.ts`:

```ts
/**
 * `DesignerSelectTool` driven directly (asset designer symbols spec, Decision 10): Transform and Edit
 * points against the real hit order, drag arithmetic and snap service, at one world millimetre per
 * pixel.
 *
 * The mounted half — the toolbar reaching the tool, the canvas drawing its preview, a real write and
 * its undo — is `designerSelection.test.ts`. What only this file can reach is what a real pointer
 * stream cannot discriminate: a secondary release, a gesture cancelled or abandoned mid-drag, a tool
 * switched away mid-drag, and a write settling after a LATER gesture has drawn its own preview.
 */
import { describe, expect, it } from 'vitest';
import type { AppError } from '../../../../src/core/errors/AppError';
import type { Point } from '../../../../src/core/geometry/Point';
import { ok } from '../../../../src/core/result/Result';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { facingTip } from '../../../../src/presentation/designer/layers/anchorLayer';
import { flushGesture, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';
import {
	DESIGN_VERSION,
	TOILET,
	detailOutline,
	justInsideBottom,
	selectToolRig,
} from '../../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const BOWL = detailOutline('detail-2');
const IN_BOWL = justInsideBottom(BOWL);
const TANK_SELECTED = { kind: 'detail', id: 'detail-1' } as const;
const TL = TANK.points[0];
const BR = TANK.points[2];

/** A point of the tank scaled ×2 about its top-left corner — where the bottom-right handle is dragged to. */
const doubled = (point: Point): Point => ({ x: TL.x + 2 * (point.x - TL.x), y: TL.y + 2 * (point.y - TL.y) });

const REFUSAL: DispatchResult = {
	ok: false,
	error: { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } as AppError,
};

describe('selecting', () => {
	it('selects the detail under a click and dispatches nothing', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x, IN_BOWL.y));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		expect(rig.harness.dispatched).toHaveLength(0);
		expect(rig.written).toEqual([]);
	});

	it('clears the selection for a click on nothing, and starts no drag', () => {
		const rig = selectToolRig({ selection: TANK_SELECTED });
		rig.tool.activate(rig.harness.context);

		// Outside the clearance, which reaches x = 390 and y = 950.
		rig.tool.pointerDown(pointerAt(1000, 1000));

		expect(rig.selected).toEqual([null]);
		expect(rig.tool.hasDraft()).toBe(false);
	});

	it('does nothing before activation, after deactivation, or on an asset with no shape', () => {
		const rig = selectToolRig();
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.activate(rig.harness.context);
		rig.tool.deactivate();
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		const shapeless = selectToolRig({ shape: null });
		shapeless.tool.activate(shapeless.harness.context);
		shapeless.tool.pointerDown(pointerAt(0, 0));

		expect(rig.selected).toEqual([]);
		expect(shapeless.selected).toEqual([]);
		expect(shapeless.tool.hasDraft()).toBe(false);
	});

	it('does nothing for a secondary press', () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y, 'secondary'));

		expect(rig.selected).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(false);
	});
});

describe('moving a part', () => {
	it('moves a dragged detail in one write, conditional on the version the press read', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.harness.dispatched).toHaveLength(1);
		expect(rig.written).toHaveLength(1);
		expect(rig.written[0]?.expected).toBe(DESIGN_VERSION);
		const bowl = rig.written[0]?.shape.details.find((detail) => detail.id === 'detail-2')?.outline;
		expect(bowl?.points).toEqual(BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })));
		expect(bowl?.bulges).toEqual(BOWL.bulges);
		// Previewed while it ran, and the preview cleared only once the write had settled.
		expect(rig.previews).toHaveLength(3);
		expect(rig.previews[1]).not.toBeNull();
		expect(rig.previews[2]).toBeNull();
	});

	it('writes nothing, and previews nothing, for a press that never travels past the click epsilon', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 3, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 3, IN_BOWL.y));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.previews).toEqual([]);
	});

	it('moves the anchor onto a detail vertex within the snap tolerance', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);
		const vertex = BOWL.points[1];

		rig.tool.pointerDown(pointerAt(TOILET.anchor.x, TOILET.anchor.y));
		rig.tool.pointerMove(pointerAt(vertex.x - 2, vertex.y - 2));
		rig.tool.pointerUp(pointerAt(vertex.x - 2, vertex.y - 2));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'anchor' }]);
		expect(rig.written[0]?.shape.anchor).toEqual(vertex);
	});

	it('turns the facing by the drag’s bearing from the anchor, onto the step while shift is held', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);
		const tip = facingTip(TOILET, 1);

		rig.tool.pointerDown(pointerAt(tip.x, tip.y));
		rig.tool.pointerMove(shiftPointerAt(100, 10));
		rig.tool.pointerUp(shiftPointerAt(100, 10));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'facing' }]);
		// atan2(10, 100) is 5.7 degrees, nearer the 0 step than the 15 degree one.
		expect(rig.written[0]?.shape.facing).toBe(0);
	});
});

describe('a selected outline', () => {
	it('in Transform, resizes from the corner handle dragged, about the opposite corner', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED });
		rig.tool.activate(rig.harness.context);
		const to = doubled(BR);

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(to.x, to.y));
		rig.tool.pointerUp(pointerAt(to.x, to.y));
		await flushGesture();

		// A handle press belongs to the selection it is drawn around and selects nothing new.
		expect(rig.selected).toEqual([]);
		expect(rig.written[0]?.shape.details[0]?.outline.points).toEqual(TANK.points.map(doubled));
	});

	it('refuses a resize that crosses the opposite edge at release, reports it, and writes nothing', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED });
		rig.tool.activate(rig.harness.context);
		const valid = doubled(BR);
		const crossed = { x: TL.x - 100, y: valid.y };

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(valid.x, valid.y));
		rig.tool.pointerMove(pointerAt(crossed.x, crossed.y));
		rig.tool.pointerUp(pointerAt(crossed.x, crossed.y));
		await flushGesture();

		// The crossing move kept the last valid preview rather than drawing nothing; the release cleared it.
		expect(rig.previews).toHaveLength(2);
		expect(rig.previews[0]).not.toBeNull();
		expect(rig.previews[1]).toBeNull();
		expect(rig.invalid.map((error) => error.code)).toEqual(['asset.invalid-scale']);
		expect(rig.written).toEqual([]);
		expect(rig.harness.dispatched).toHaveLength(0);
	});

	it('in Edit points, snaps a dragged vertex onto a footprint vertex', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED, mode: 'points' });
		rig.tool.activate(rig.harness.context);
		const corner = TOILET.footprint.points[2];

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(corner.x - 4, corner.y - 3));
		rig.tool.pointerUp(pointerAt(corner.x - 4, corner.y - 3));
		await flushGesture();

		expect(rig.written[0]?.shape.details[0]?.outline.points).toEqual([TANK.points[0], TANK.points[1], corner, TANK.points[3]]);
	});

	/** Replaced deliberately by Task 7, which gives this press to `CurveTool`. */
	it('in Bend edges, starts nothing from an edge handle until the bend gesture is wired', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED, mode: 'bend' });
		rig.tool.activate(rig.harness.context);
		const midpoint = { x: (TANK.points[0].x + TANK.points[1].x) / 2, y: TANK.points[0].y };

		rig.tool.pointerDown(pointerAt(midpoint.x, midpoint.y));
		rig.tool.pointerMove(pointerAt(midpoint.x, midpoint.y - 50));
		rig.tool.pointerUp(pointerAt(midpoint.x, midpoint.y - 50));
		await flushGesture();

		expect(rig.selected).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.written).toEqual([]);
	});
});

describe('an interrupted gesture', () => {
	it('drops the drag and its preview on Escape and on an interruption, writing nothing', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		// Escape asks this before it cancels, so a drag in flight is abandoned before a selection is cleared.
		expect(rig.tool.hasDraft()).toBe(true);
		rig.tool.cancel();
		expect(rig.tool.hasDraft()).toBe(false);
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.abandonGesture();
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.written).toEqual([]);
	});

	it('clears its preview when it is switched away mid-drag', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.deactivate();
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.written).toEqual([]);
	});

	it('commits nothing for a drag whose release names another button', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y, 'secondary'));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(true);
	});

	it('follows the pointer only once a press has travelled past the click epsilon', () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		// A hover and a stray release with no press behind them hold nothing and draw nothing.
		rig.tool.pointerMove(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x, IN_BOWL.y));
		expect(rig.previews).toEqual([]);
		expect(rig.tool.tracksPointer()).toBe(false);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		expect(rig.tool.tracksPointer()).toBe(false);
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		expect(rig.tool.tracksPointer()).toBe(true);
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		expect(rig.tool.tracksPointer()).toBe(false);
	});
});

describe('a write the vault refuses', () => {
	it('is reported, and the preview still cleared', async () => {
		const rig = selectToolRig({ context: { commandDispatcher: { run: () => Promise.resolve(REFUSAL) } } });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.rejected.map((error) => error.code)).toEqual(['vault.unexpected-failure']);
		expect(rig.previews.at(-1)).toBeNull();
	});

	/**
	 * The generation guard: an earlier gesture's write settling must not wipe the preview a LATER
	 * gesture has drawn. Remove the guard and the last preview recorded here is `null`.
	 */
	it('leaves a later gesture’s preview standing when an earlier write settles under it', async () => {
		let settle!: (result: DispatchResult) => void;
		const rig = selectToolRig({
			context: {
				commandDispatcher: {
					run: () =>
						new Promise<DispatchResult>((resolve) => {
							settle = resolve;
						}),
				},
			},
		});
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
		settle(ok('wrote'));
		await flushGesture();

		expect(rig.previews.at(-1)).not.toBeNull();
	});
});
```

- [ ] **Step 3: Run it and watch it fail**

`npm run check:fast -- tests/presentation/designer/tools/designerSelectTool.test.ts`

Expected: `vue-tsc` reports `Cannot find module '../../src/presentation/designer/tools/designer-select-tool'` from `tests/helpers/designerSelection.ts`, and vitest fails the file on the same missing import.

- [ ] **Step 4: Implement** — `src/presentation/designer/tools/designer-select-tool.ts`:

```ts
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { Result } from '../../../core/result/Result';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';
import { partKey, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { hitDesign } from '../selection/hitTest';
import { draggedShape, type DragRole, type DragStart } from '../selection/selectionDrag';

/**
 * What `DesignerSelectTool` needs beyond its `EditorContext`: the leaf's design and selection store,
 * read PER CALL (a design leaf re-reads after every write), and one reversible write.
 */
export interface DesignerSelectToolDeps {
	readonly design: () => { readonly shape: AssetShape; readonly geometryVersion: EntityVersion } | null; // null = nothing drawn yet
	readonly selection: () => DesignerSelection | null;
	readonly mode: () => SelectionMode;
	readonly select: (next: DesignerSelection | null) => void;
	readonly setPreview: (shape: AssetShape | null) => void;
	/** One reversible SetAssetShape write, conditional on `expected`. */
	readonly createCommand: (shape: AssetShape, expected: EntityVersion) => UndoableCommand;
	readonly reportRejected: (error: AppError) => void; // a dispatched refusal
	readonly reportInvalidInput: (error: AppError) => void; // a domain refusal at release; nothing dispatched
}

/** What a press read of the design: the shape a gesture edits and the version its write is conditional on. */
type PressedDesign = NonNullable<ReturnType<DesignerSelectToolDeps['design']>>;

interface Drag {
	readonly context: EditorContext;
	readonly start: DragStart;
	readonly version: EntityVersion;
	/** Latched once the pointer has travelled past the click epsilon; a press that never does is a click. */
	moved: boolean;
}

/**
 * The asset designer's Select tool (symbols spec, Decision 10): a click selects by `hitDesign`'s
 * order, a drag moves the part or works the handle it started on, and the release is ONE conditional
 * `SetAssetShape` write.
 *
 * **Not the Plan Editor's `SelectTool`**, which selects zones and elements by id through the shared
 * selection store; this surface selects a PART of one shape, held in its own `assetDesignStore`.
 *
 * **Conditional on the design the press read** (spec Amendment 1): the version is captured at the
 * press and passed as `expected`, so a peer's write during the drag refuses this one rather than
 * being overwritten by a shape computed from the older design.
 *
 * **The preview is cleared only after the write settles**, so the canvas never flashes back to the
 * old shape before the refresh lands. That is what `previewGeneration` guards: an earlier gesture's
 * write settling must not clear a preview a LATER gesture has drawn since. It is bumped when a preview
 * is WRITTEN, not at a press — a later click on a handle writes none, and bumping at its press would
 * strand the earlier preview on the canvas. The refusal itself is reported whatever happened since
 * (`SetFacingTool`'s rule: a generation guards gesture-owned state, never the report of a write that
 * really was attempted).
 */
export class DesignerSelectTool implements EditorTool {
	readonly id: ToolId = 'select';

	private context: EditorContext | null = null;
	private drag: Drag | null = null;
	private previewGeneration = 0;

	constructor(private readonly deps: DesignerSelectToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
	}

	deactivate(): void {
		this.dropGesture();
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		const design = this.deps.design();
		if (context === null || design === null || event.button !== 'primary') return;
		const selection = this.deps.selection();
		const hit = hitDesign(design.shape, event.worldPoint, {
			selection,
			mode: this.deps.mode(),
			worldPerPixel: context.viewport.worldPerScreenPixel(),
		});
		if (hit === null) {
			this.deps.select(null);
			return;
		}
		if (hit.kind === 'part') {
			this.deps.select(hit.selection);
			this.begin(context, design, hit.selection, { kind: 'body' }, event.worldPoint);
			return;
		}
		// Bend edges is `CurveTool`'s gesture (Task 7); until it is wired an edge handle starts nothing.
		if (hit.role.kind === 'edge') return;
		// A handle is only ever drawn around a selection — `selectionHandles` answers `[]` for none — so
		// the selection it belongs to is never null here, and no guard is written for it.
		this.begin(context, design, selection as DesignerSelection, hit.role, event.worldPoint);
	}

	pointerMove(event: EditorPointerEvent): void {
		const drag = this.drag;
		if (drag === null || !this.passedEpsilon(drag, event.worldPoint)) return;
		this.preview(this.shapeAt(drag, event));
	}

	pointerUp(event: EditorPointerEvent): void {
		const drag = this.drag;
		if (drag === null || event.button !== 'primary') return;
		this.drag = null;
		if (!this.passedEpsilon(drag, event.worldPoint)) return;
		this.release(drag.context, this.shapeAt(drag, event), drag.version);
	}

	cancel(): void {
		this.dropGesture(); // no command dispatched
	}

	/** The whole gesture is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.dropGesture();
	}

	/** A press with no release yet — so Escape mid-drag abandons the drag before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null;
	}

	/** Every drag computes from the event's world point, so edge scrolling may carry it once it is a drag. */
	tracksPointer(): boolean {
		return this.drag?.moved === true;
	}

	private begin(context: EditorContext, design: PressedDesign, selection: DesignerSelection, role: DragRole, from: Point): void {
		this.drag = { context, start: { shape: design.shape, selection, role, from }, version: design.geometryVersion, moved: false };
	}

	/** Measured in SCREEN pixels through the camera as it stands now — `handleMetrics.ts`'s `CLICK_EPSILON_PX`. */
	private passedEpsilon(drag: Drag, point: Point): boolean {
		drag.moved ||= distance(drag.start.from, point) > CLICK_EPSILON_PX * drag.context.viewport.worldPerScreenPixel();
		return drag.moved;
	}

	/**
	 * The shape a release here would write — ONE function for the preview and the commit, so the two
	 * cannot differ. A vertex and the anchor snap to the other parts' vertices (never to themselves:
	 * `partKey` excludes the dragged part), at the screen tolerance `DrawPolygonTool` snaps with; a body
	 * move, a box handle and the facing take the raw point.
	 */
	private shapeAt(drag: Drag, event: EditorPointerEvent): Result<AssetShape, ValidationError> {
		const { context, start } = drag;
		const snaps = start.role.kind === 'vertex' || (start.role.kind === 'body' && start.selection.kind === 'anchor');
		const to = snaps
			? context.snapService.snapPoint(
				event.worldPoint,
				context.snapCandidates([partKey(start.selection)]),
				SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel(),
			)
			: event.worldPoint;
		return draggedShape(start, to, {
			shift: event.modifiers.shift,
			snapRotation: (radians) => context.snapService.snapRotation(radians),
		});
	}

	/** A refused intermediate position keeps the last valid preview rather than drawing nothing. */
	private preview(next: Result<AssetShape, ValidationError>): void {
		if (!next.ok) return;
		this.previewGeneration += 1;
		this.deps.setPreview(next.value);
	}

	private release(context: EditorContext, next: Result<AssetShape, ValidationError>, version: EntityVersion): void {
		if (!next.ok) {
			// Pre-dispatch: nothing was built, so the notice door is the only place this can be said.
			this.deps.setPreview(null);
			this.deps.reportInvalidInput(next.error);
			return;
		}
		void this.commit(context, next.value, version);
	}

	private async commit(context: EditorContext, shape: AssetShape, version: EntityVersion): Promise<void> {
		const generation = this.previewGeneration;
		const result = await context.commandDispatcher.run(this.deps.createCommand(shape, version));
		if (generation === this.previewGeneration) this.deps.setPreview(null);
		if (!result.ok) this.deps.reportRejected(result.error);
	}

	private dropGesture(): void {
		this.drag = null;
		this.deps.setPreview(null);
	}
}
```

- [ ] **Step 5: Run it and watch it pass**

`npm run check:fast -- tests/presentation/designer/tools/designerSelectTool.test.ts tests/presentation/designer/tools/designerToolUnits.test.ts`

Expected: oxlint and `vue-tsc` clean; both files pass (the second is the neighbouring suite over the same `tool-context.ts`, untouched).

- [ ] **Step 6: Lint**

`npx eslint src/presentation/designer/tools/designer-select-tool.ts tests/helpers/designerSelection.ts tests/presentation/designer/tools/designerSelectTool.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/presentation/designer/tools/designer-select-tool.ts tests/helpers/designerSelection.ts tests/presentation/designer/tools/designerSelectTool.test.ts
git commit -m "feat(designer): select tool for Transform and Edit points

A click selects a part of the asset's shape by the stated hit order; a drag
moves it or works the handle it started on, and the release is one
SetAssetShape write conditional on the version the press read.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 6: Wiring — the tool registered, drawn, reachable and undoable

**Files:**
- Create: `src/presentation/designer/selection/editShape.ts`, `src/presentation/designer/layers/selectionLayer.ts`, `src/presentation/designer/DesignerSelectionModes.vue`
- Modify: `src/presentation/designer/layers/detailsLayer.ts`, `src/presentation/designer/layers/backgroundLayer.ts` (`DesignerLayerName`), `src/presentation/designer/tools/registerDesignerTools.ts`, `src/presentation/designer/runtime.ts`, `src/presentation/designer/DesignerCanvas.vue`, `src/presentation/designer/DesignerToolbar.vue`, `src/presentation/editor/tools/editor-context.ts` (one stale comment line), `styles/designer.css`, `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`
- Test (new): `tests/presentation/designer/selection/editShape.test.ts`, `tests/presentation/designer/selectionLayer.test.ts`, `tests/presentation/designer/designerSelection.test.ts`
- Test (updated deliberately): `tests/presentation/designer/layers.test.ts`, `tests/presentation/designer/designerToolbar.test.ts`, `tests/presentation/designer/designerEscapeRouting.test.ts`, `tests/presentation/designer/designerTools.test.ts`, `tests/presentation/designer/designerBackground.test.ts`, `tests/presentation/designer/designerRefresh.test.ts`

**Interfaces:**
- Consumes: `DesignerSelectTool`, `DesignerSelectToolDeps` (Task 5); `isOutlineSelection`, `DesignerSelection`, `SelectionMode`, `selectionHandles`, `designerSnapCandidates`, `facingTip`, store `selection`/`mode`/`preview`/`select`/`setMode`/`setPreview` (Task 3); `outlineOf` (Task 1).
- Produces:
```ts
// registerDesignerTools.ts
export const DESIGNER_TOOL_LABELS = { select: 'designer.toolbar.select', 'trace-footprint': …, 'trace-clearance': …, 'set-anchor': …, 'set-facing': …, calibrate: … }
// DesignerToolDeps gains:  readonly selectTool: DesignerSelectToolDeps;  and  readonly returnToSelect: () => void  (replaces returnToCamera)

// selection/editShape.ts
export type EditShape = (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>;
export function createEditShape(
  design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null,
  write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>,
): EditShape;

// runtime.ts — DesignerRuntime gains
readonly editShape: (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>; // declared as `EditShape`

// layers/detailsLayer.ts
export function footprintEdge(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): OutlineConfig | null;
// DetailOutlineConfig gains  readonly id: string

// layers/selectionLayer.ts
export interface HandleMarkConfig { … }
export function selectionMarks(shape: AssetShape | null, selection: DesignerSelection | null, mode: SelectionMode, tokens: ThemeTokens, worldPerPixel: number): { readonly outline: OutlineConfig | null; readonly handles: readonly HandleMarkConfig[] };
export function selectionFrame(shape: AssetShape, selection: DesignerSelection | null, worldPerPixel: number): BoundingBox | null; // Shift+2's box
```

Every handle mark is a Konva `Rect` — a square has `cornerRadius: 0`, a round mark `cornerRadius` equal to its radius — so the selection layer renders ONE `v-for` of `VRect` with no `<template>` fragment inside a `VLayer` (the per-layer reindex hazard `layers.test.ts` records for `GestureSketch`).

#### 6A — the pure modules

- [ ] **Step 1: Write the failing tests**

`tests/presentation/designer/selection/editShape.test.ts`:

```ts
/**
 * `createEditShape` — the ONE door a click- or field-bound shape edit takes (spec Amendment 1): read
 * the design, run a pure edit, and dispatch a conditional write only when the edit succeeded.
 */
import { describe, expect, it } from 'vitest';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../../src/core/result/Result';
import { assetError } from '../../../../src/domain/asset/Asset.errors';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { createEditShape } from '../../../../src/presentation/designer/selection/editShape';
import { DESIGN_VERSION, TOILET } from '../../../helpers/designerSelection';

function writes(): { readonly calls: { shape: AssetShape; expected: EntityVersion }[]; write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult> } {
	const calls: { shape: AssetShape; expected: EntityVersion }[] = [];
	return {
		calls,
		write: (shape, expected) => {
			calls.push({ shape, expected });
			return Promise.resolve(ok('wrote'));
		},
	};
}

const shifted = (shape: AssetShape) => ok({ ...shape, anchor: { x: 10, y: 0 } });

describe('createEditShape', () => {
	it('writes nothing, and resolves no-write, when nothing has been read or nothing drawn', async () => {
		const recorder = writes();
		let edits = 0;
		const count = (shape: AssetShape) => {
			edits += 1;
			return ok(shape);
		};

		const unread = await createEditShape(() => null, recorder.write)(count);
		const shapeless = await createEditShape(() => ({ shape: null, geometryVersion: DESIGN_VERSION }), recorder.write)(count);

		expect(unread).toEqual(ok('no-write'));
		expect(shapeless).toEqual(ok('no-write'));
		expect(edits).toBe(0);
		expect(recorder.calls).toEqual([]);
	});

	it('resolves a refused edit as that refusal, without dispatching', async () => {
		const recorder = writes();
		const refusal = assetError('part-not-found', 'That part is not on this shape.');

		const result = await createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write)(() => err(refusal));

		expect(result).toEqual(err(refusal));
		expect(recorder.calls).toEqual([]);
	});

	it('writes the edited shape once, conditional on the version it read, and resolves the write', async () => {
		const recorder = writes();

		const result = await createEditShape(() => ({ shape: TOILET, geometryVersion: DESIGN_VERSION }), recorder.write)(shifted);

		expect(result).toEqual(ok('wrote'));
		expect(recorder.calls).toHaveLength(1);
		expect(recorder.calls[0]?.shape.anchor).toEqual({ x: 10, y: 0 });
		expect(recorder.calls[0]?.expected).toBe(DESIGN_VERSION);
	});
});
```

`tests/presentation/designer/selectionLayer.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * What the designer draws for a selection, and what `Shift+2` frames — as data (symbols spec,
 * Decision 10). jsdom only because the palette is resolved the way the canvas resolves it.
 * `layers.test.ts` holds that the mounted canvas renders these configs at all.
 */
import { describe, expect, it } from 'vitest';
import { resolveThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { facingTip } from '../../../src/presentation/designer/layers/anchorLayer';
import { selectionFrame, selectionMarks } from '../../../src/presentation/designer/layers/selectionLayer';
import { TOILET, detailOutline } from '../../helpers/designerSelection';

const TOKENS = resolveThemeTokens(document.documentElement);
const TANK = detailOutline('detail-1');
const TANK_SELECTED = { kind: 'detail', id: 'detail-1' } as const;
const NO_CLEARANCE = { ...TOILET, clearance: null };

describe('selectionMarks', () => {
	it('draws nothing without a shape or without a selection', () => {
		expect(selectionMarks(null, TANK_SELECTED, 'transform', TOKENS, 1)).toEqual({ outline: null, handles: [] });
		expect(selectionMarks(TOILET, null, 'transform', TOKENS, 1)).toEqual({ outline: null, handles: [] });
	});

	it('restrokes a selected outline in the accent and draws eight square box handles and a round rotate handle', () => {
		const marks = selectionMarks(TOILET, TANK_SELECTED, 'transform', TOKENS, 1);

		expect(marks.outline?.points).toEqual(TANK.points.flatMap((point) => [point.x, point.y]));
		expect(marks.outline?.stroke).toBe(TOKENS.accent);
		expect(marks.outline?.strokeWidth).toBe(2);
		expect(marks.outline?.listening).toBe(false);
		expect(marks.handles.filter((handle) => handle.cornerRadius === 0)).toHaveLength(8);
		expect(marks.handles.filter((handle) => handle.cornerRadius === 4)).toHaveLength(1);
		const topLeft = marks.handles.find((handle) => handle.x === TANK.points[0].x && handle.y === TANK.points[0].y);
		expect(topLeft).toMatchObject({ width: 8, height: 8, offsetX: 4, offsetY: 4, cornerRadius: 0, fill: TOKENS.canvasBackground, stroke: TOKENS.accent, listening: false });
	});

	it('draws one round handle per vertex in Edit points', () => {
		const marks = selectionMarks(TOILET, TANK_SELECTED, 'points', TOKENS, 1);

		expect(marks.handles.map((handle) => ({ x: handle.x, y: handle.y }))).toEqual(TANK.points);
		expect(marks.handles.every((handle) => handle.cornerRadius === 4)).toBe(true);
	});

	it('sizes the marks in screen pixels at any zoom', () => {
		const marks = selectionMarks(TOILET, TANK_SELECTED, 'points', TOKENS, 10);

		expect(marks.handles[0]).toMatchObject({ width: 80, offsetX: 40, cornerRadius: 40 });
	});

	it('draws nothing for a selected part the shape does not have', () => {
		expect(selectionMarks(NO_CLEARANCE, { kind: 'clearance' }, 'transform', TOKENS, 1)).toEqual({ outline: null, handles: [] });
	});

	it('rings the anchor, or the facing tip, at the grab radius and leaves it unfilled', () => {
		const anchor = selectionMarks(TOILET, { kind: 'anchor' }, 'transform', TOKENS, 1);
		const facing = selectionMarks(TOILET, { kind: 'facing' }, 'transform', TOKENS, 1);
		const tip = facingTip(TOILET, 1);

		expect(anchor.outline).toBeNull();
		expect(anchor.handles).toHaveLength(1);
		expect(anchor.handles[0]).toMatchObject({ x: TOILET.anchor.x, y: TOILET.anchor.y, width: 16, cornerRadius: 8, stroke: TOKENS.accent });
		expect(anchor.handles[0]).not.toHaveProperty('fill');
		expect(facing.handles[0]).toMatchObject({ x: tip.x, y: tip.y });
	});
});

describe('selectionFrame', () => {
	it('frames nothing with no selection, or for a part the shape does not have', () => {
		expect(selectionFrame(TOILET, null, 1)).toBeNull();
		expect(selectionFrame(NO_CLEARANCE, { kind: 'clearance' }, 1)).toBeNull();
	});

	it('frames a selected outline’s box', () => {
		expect(selectionFrame(TOILET, TANK_SELECTED, 1)).toEqual({ min: TANK.points[0], max: TANK.points[2] });
	});

	it('frames the anchor, or the facing tip, as a point', () => {
		const tip = facingTip(TOILET, 10);

		expect(selectionFrame(TOILET, { kind: 'anchor' }, 10)).toEqual({ min: TOILET.anchor, max: TOILET.anchor });
		expect(selectionFrame(TOILET, { kind: 'facing' }, 10)).toEqual({ min: tip, max: tip });
	});
});
```

Edits to `tests/presentation/designer/layers.test.ts` (pure half):

old:
```ts
import { detailOutlines } from '../../../src/presentation/designer/layers/detailsLayer';
```
new:
```ts
import { detailOutlines, footprintEdge } from '../../../src/presentation/designer/layers/detailsLayer';
```

old:
```ts
		expect(detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE)[0].points.length).toBeGreaterThan(8);
		expect(footprintOutline(circular, TOKENS, UNIT_SCALE)?.points.length).toBeGreaterThan(8);
	});
});
```
new:
```ts
		expect(detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE)[0].points.length).toBeGreaterThan(8);
		expect(footprintOutline(circular, TOKENS, UNIT_SCALE)?.points.length).toBeGreaterThan(8);
	});

	/**
	 * A solid detail is filled with the canvas colour, so one drawn against the footprint covers the
	 * inner half of the footprint's stroke. The footprint is stroked AGAIN, unfilled, over the details —
	 * and only when there are details, since otherwise nothing can cover it.
	 */
	it('restrokes the footprint over its details, unfilled, and only when there are details', () => {
		expect(footprintEdge(null, TOKENS, UNIT_SCALE)).toBeNull();
		expect(footprintEdge(BASE, TOKENS, UNIT_SCALE)).toBeNull();
		expect(footprintEdge(WITH_DETAILS, TOKENS, UNIT_SCALE)).toEqual(footprintOutline(WITH_DETAILS, TOKENS, UNIT_SCALE));
		expect(footprintEdge(WITH_DETAILS, TOKENS, UNIT_SCALE)).not.toHaveProperty('fill');
	});

	/** The canvas keys each detail node by its id, so a reorder moves nodes rather than repainting them. */
	it('carries each detail’s id on its config', () => {
		expect(detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE).map((detail) => detail.id)).toEqual(['d1', 'd2']);
	});
});
```

(`useAssetDesignStore` is used by the 6B mounted cases below; it is imported here so the import block is edited once.)

- [ ] **Step 2: Run them and watch them fail**

`npm run check:fast -- tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/layers.test.ts`

Expected: `vue-tsc` reports `Cannot find module …/selection/editShape` and `…/layers/selectionLayer`, and `Module '"…/detailsLayer"' has no exported member 'footprintEdge'`; vitest fails the three files on those imports.

- [ ] **Step 3: Implement**

`src/presentation/designer/selection/editShape.ts`:

```ts
import type { ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { AssetShape } from '../../../domain/asset/AssetShape';

/**
 * One whole-shape edit of the leaf's current design (symbols spec, Amendment 1): a pure edit from
 * `shapeEdits.ts`/`detailEdits.ts`, dispatched as ONE `SetAssetShape` conditional on the version the
 * leaf read, or not dispatched at all.
 *
 * It RESOLVES every outcome rather than reporting one, so a field can show a refusal beside itself
 * and a key binding can hand it to `notifyIfRefused` — which sends a pre-write `Validation` refusal to
 * a notice and a write-boundary one to the save indicator, so one door serves both halves.
 */
export type EditShape = (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>;

/**
 * `design` is read PER CALL — a designer leaf edits and re-reads without remounting. Nothing read yet,
 * or nothing drawn, is `no-write`: there is no shape for an edit to act on, which is not a refusal.
 */
export function createEditShape(
	design: () => { readonly shape: AssetShape | null; readonly geometryVersion: EntityVersion } | null,
	write: (shape: AssetShape, expected: EntityVersion) => Promise<DispatchResult>,
): EditShape {
	return async (edit) => {
		const current = design();
		if (current === null || current.shape === null) return ok('no-write');
		const next = edit(current.shape);
		if (!next.ok) return err(next.error);
		return write(next.value, current.geometryVersion);
	};
}
```

`src/presentation/designer/layers/selectionLayer.ts`:

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf } from '../../../domain/asset/shapeEdits';
import { VERTEX_GRAB_RADIUS_PX, VERTEX_HANDLE_RADIUS_PX } from '../../editor/handleMetrics';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { boundsOfZones } from '../../editor/viewport/zoneExtent';
import { isOutlineSelection, type DesignerSelection, type SelectionMode } from '../selection/designerSelection';
import { selectionHandles } from '../selection/handles';
import { facingTip } from './anchorLayer';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * What the designer draws for its selection (symbols spec, Decision 10): the selected outline
 * restroked in the accent, a mark per handle the active mode offers, and a ring on the anchor or the
 * facing tip. Every mark is sized in SCREEN pixels on a world-space layer, like `anchorLayer.ts`.
 *
 * **One Konva `Rect` per mark**, square or round by `cornerRadius`, so the canvas renders a single
 * `v-for` and never a `<template>` fragment inside its `VLayer`.
 */
export interface HandleMarkConfig {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly offsetX: number;
	readonly offsetY: number;
	/** `0` for a box handle; the radius for a round one, which makes the rect a circle. */
	readonly cornerRadius: number;
	/** Absent on the anchor/facing ring, which must not hide the mark it surrounds. */
	readonly fill?: string;
	readonly stroke: string;
	readonly strokeWidth: number;
	readonly strokeScaleEnabled: false;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
}

const SELECTED_STROKE_PX = 2;
const HANDLE_STROKE_PX = 1.5;

/** The ring is drawn at the GRAB radius, so it shows exactly the region a press will take. */
const RING_RADIUS_PX = VERTEX_GRAB_RADIUS_PX;

type PointSelection = Exclude<DesignerSelection, { readonly kind: 'footprint' | 'clearance' | 'detail' }>;

function pointOf(shape: AssetShape, selection: PointSelection, worldPerPixel: number): Point {
	return selection.kind === 'anchor' ? shape.anchor : facingTip(shape, worldPerPixel);
}

function mark(at: Point, radius: number, style: 'square' | 'round' | 'ring', tokens: ThemeTokens): HandleMarkConfig {
	return {
		x: at.x,
		y: at.y,
		width: radius * 2,
		height: radius * 2,
		offsetX: radius,
		offsetY: radius,
		cornerRadius: style === 'square' ? 0 : radius,
		...(style === 'ring' ? {} : { fill: tokens.canvasBackground }),
		stroke: tokens.accent,
		strokeWidth: HANDLE_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
	};
}

export function selectionMarks(
	shape: AssetShape | null,
	selection: DesignerSelection | null,
	mode: SelectionMode,
	tokens: ThemeTokens,
	worldPerPixel: number,
): { readonly outline: OutlineConfig | null; readonly handles: readonly HandleMarkConfig[] } {
	if (shape === null || selection === null) return { outline: null, handles: [] };
	if (!isOutlineSelection(selection)) {
		return { outline: null, handles: [mark(pointOf(shape, selection, worldPerPixel), RING_RADIUS_PX * worldPerPixel, 'ring', tokens)] };
	}
	const outline = outlineOf(shape, selection);
	return {
		outline: outline === null
			? null
			: {
				points: flatPoints(polygonPolyline(outline, ARC_TOLERANCE_PX * worldPerPixel)),
				closed: true,
				stroke: tokens.accent,
				strokeWidth: SELECTED_STROKE_PX,
				strokeScaleEnabled: false,
				listening: false,
				perfectDrawEnabled: false,
			},
		handles: selectionHandles(shape, selection, mode, worldPerPixel).map((handle) =>
			mark(handle.at, VERTEX_HANDLE_RADIUS_PX * worldPerPixel, handle.role.kind === 'box' ? 'square' : 'round', tokens),
		),
	};
}

/**
 * What `Shift+2` frames: a selected outline's curve-aware box, or the anchor or facing tip as a point
 * (`fitViewport` keeps the zoom and centres on a point). `null` — nothing to frame — with no
 * selection or for a part the shape does not have.
 */
export function selectionFrame(shape: AssetShape, selection: DesignerSelection | null, worldPerPixel: number): BoundingBox | null {
	if (selection === null) return null;
	if (!isOutlineSelection(selection)) {
		const at = pointOf(shape, selection, worldPerPixel);
		return { min: at, max: at };
	}
	const outline = outlineOf(shape, selection);
	return boundsOfZones(outline === null ? [] : [outline]);
}
```

Edits to `src/presentation/designer/layers/detailsLayer.ts`:

old:
```ts
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';
```
new:
```ts
import { ARC_TOLERANCE_PX, flatPoints, footprintOutline, type OutlineConfig } from './footprintLayer';
```

old:
```ts
export interface DetailOutlineConfig extends OutlineConfig {
	readonly fill?: string;
}
```
new:
```ts
export interface DetailOutlineConfig extends OutlineConfig {
	/** The detail's own id — what the canvas keys its node by, so a reorder moves nodes rather than repainting them. */
	readonly id: string;
	readonly fill?: string;
}
```

old:
```ts
	return shape.details.map((detail) => ({
		points: flatPoints(polygonPolyline(detail.outline, ARC_TOLERANCE_PX * worldPerPixel)),
```
new:
```ts
	return shape.details.map((detail) => ({
		id: detail.id,
		points: flatPoints(polygonPolyline(detail.outline, ARC_TOLERANCE_PX * worldPerPixel)),
```

Append at the end of the file:
```ts

/**
 * The footprint's stroke again, unfilled, drawn LAST in the details layer: a solid detail is filled
 * with the canvas colour, so one lying against the footprint covers the inner half of its stroke and
 * the outline of record reads thinner exactly where a detail meets it. `null` with no details, when
 * nothing can cover it and a second stroke would be ink for nothing.
 */
export function footprintEdge(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): OutlineConfig | null {
	if (shape === null || shape.details.length === 0) return null;
	return footprintOutline(shape, tokens, worldPerPixel);
}
```

- [ ] **Step 4: Run them and watch them pass**

`npm run check:fast -- tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/layers.test.ts`

Expected: all three pass (the mounted `layers.test.ts` cases are unchanged so far and still see six layers).

#### 6B — registered, drawn, reachable

- [ ] **Step 5: Write the failing tests**

`tests/presentation/designer/designerSelection.test.ts` (new):

```ts
/**
 * @vitest-environment jsdom
 *
 * The designer's Select tool, MOUNTED (symbols spec, Decision 10): reached through the real toolbar,
 * driven by pointer streams a hand can produce, writing through the real reversible adapter to a real
 * sidecar. `tools/designerSelectTool.test.ts` is the unit half; this file is what proves a user can get
 * to any of it, and that what it writes is one undoable, conditional revision.
 *
 * Every coordinate is read from the toilet preset (`tests/helpers/designerSelection.ts`). At the rig's
 * camera one pixel is ten millimetres, so the grab radius is 80 mm and the click epsilon 40 mm.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const BOWL = detailOutline('detail-2');
const IN_BOWL = justInsideBottom(BOWL);
const IN_TANK = justInsideBottom(TANK);

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

async function detailPoints(rig: DesignerRig, id: string): Promise<readonly Point[] | undefined> {
	return (await rig.document()).shape?.details.find((detail) => detail.id === id)?.outline.points;
}

/** Point-for-point within a micrometre: a rig point crosses the camera twice on its way to the tool. */
function expectNear(actual: readonly Point[] | undefined, expected: readonly Point[]): void {
	expect(actual).toHaveLength(expected.length);
	expected.forEach((point, index) => {
		expect(actual?.[index]?.x).toBeCloseTo(point.x, 6);
		expect(actual?.[index]?.y).toBeCloseTo(point.y, 6);
	});
}

/**
 * One pointer event with the primary bit as a device sets it: held on a press and a move, clear on the
 * release. The stale-read case needs to await between the moves and the release, which `drag()` cannot.
 */
function pointer(rig: DesignerRig, type: 'pointerdown' | 'pointermove' | 'pointerup', world: Point): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(
		new PointerEvent(type, { button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }),
	);
}

describe('selecting a part', () => {
	it('selects the bowl with a click, and writes nothing', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		const before = await rig.document();

		click(rig, IN_BOWL);
		await settle();

		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });
		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	it('selects nothing and writes nothing on an asset that has no shape yet', async () => {
		const rig = await designerRig({ shape: null });
		await press(rig, 'designer.toolbar.select');

		click(rig, { x: 0, y: 0 });
		await settle();

		expect(useAssetDesignStore(rig.pinia).selection).toBeNull();
		expect((await rig.document()).shape).toBeNull();
		rig.unmount();
	});
});

describe('dragging a selected part', () => {
	it('moves the bowl in one write that one Undo takes back', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		await settle();
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })));

		await press(rig, 'designer.toolbar.undo');

		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points);
		// Nothing left to undo: the drag was exactly one history entry.
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});

	/**
	 * PBI extension 4b: a drag made against a design a peer has since rewritten is REFUSED rather than
	 * overwriting the peer. The peer's write lands between the press — which read the old version — and
	 * the release, so the refusal is the version check's and not a race's.
	 */
	it('refuses a drag made against a design a peer rewrote mid-gesture', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_BOWL);
		await settle();

		const peerWrite = rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 });
		pointer(rig, 'pointerdown', IN_BOWL);
		pointer(rig, 'pointermove', { x: IN_BOWL.x + 50, y: IN_BOWL.y });
		pointer(rig, 'pointermove', { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		expectOk(await peerWrite);
		pointer(rig, 'pointerup', { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		await settle();

		const shape = (await rig.document()).shape;
		expect(shape?.facing).toBe(0);
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points);
		rig.unmount();
	});

	it('snaps a dragged vertex onto a footprint vertex in Edit points', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_TANK);
		await settle();
		await press(rig, 'designer.selection.mode.points');
		const corner = TOILET.footprint.points[2];

		drag(rig, TANK.points[2], { x: corner.x - 10, y: corner.y - 10 });
		await settle();

		expect(await detailPoints(rig, 'detail-1')).toEqual([TANK.points[0], TANK.points[1], corner, TANK.points[3]]);
		rig.unmount();
	});
});

describe('the mode control', () => {
	it('is offered only for a selected outline under Select, and switches the mode', async () => {
		const rig = await designerRig({ shape: TOILET });
		const modes = () => rig.wrapper.find('.rp-designer-selection-modes');
		const store = useAssetDesignStore(rig.pinia);
		await press(rig, 'designer.toolbar.select');
		expect(modes().exists()).toBe(false);

		click(rig, IN_BOWL);
		await settle();
		expect(modes().attributes('role')).toBe('radiogroup');
		expect(modes().attributes('aria-label')).toBe(t('en', 'designer.selection.mode'));
		expect(modes().findAll('[role="radio"]').map((radio) => radio.text())).toEqual([
			t('en', 'designer.selection.mode.transform'),
			t('en', 'designer.selection.mode.points'),
			t('en', 'designer.selection.mode.bend'),
		]);
		expect(modes().find('[aria-checked="true"]').text()).toBe(t('en', 'designer.selection.mode.transform'));

		await press(rig, 'designer.selection.mode.points');
		expect(store.mode).toBe('points');
		expect(modes().find('[aria-checked="true"]').text()).toBe(t('en', 'designer.selection.mode.points'));

		// The anchor is a point, not an outline: no modes for it.
		click(rig, TOILET.anchor);
		await settle();
		expect(modes().exists()).toBe(false);

		// And none under any other tool, whatever is selected.
		click(rig, IN_BOWL);
		await settle();
		await press(rig, 'designer.toolbar.pan');
		expect(modes().exists()).toBe(false);
		rig.unmount();
	});
});
```

Edits to `tests/presentation/designer/layers.test.ts` (mounted half):

old:
```ts
import { detailOutlines, footprintEdge } from '../../../src/presentation/designer/layers/detailsLayer';
```
new:
```ts
import { detailOutlines, footprintEdge } from '../../../src/presentation/designer/layers/detailsLayer';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
```

old:
```ts
	/**
	 * `Shift+2` frames the SELECTION, and this canvas has nothing selectable on it until Task
	 * B5. A fit with nothing to frame does NOTHING — `boundsOfZones`' own rule — because a jump
	 * to nowhere costs the user the view they had and says nothing about why.
	 */
	it('does nothing on the selection shortcut, because nothing on this canvas is selectable yet', async () => {
```
new:
```ts
	/**
	 * `Shift+2` frames the SELECTION. A fit with nothing to frame does NOTHING — `boundsOfZones`' own
	 * rule — because a jump to nowhere costs the user the view they had and says nothing about why.
	 * Renamed deliberately: the canvas HAS a selection since the symbols spec's Decision 10, so the old
	 * title's reason ("nothing is selectable yet") stopped being true while the behaviour stood.
	 */
	it('does nothing on the selection shortcut while nothing is selected', async () => {
```

old:
```ts
	/** And nothing to frame at all, for an asset whose shape has not been drawn yet. */
```
new:
```ts
	/** A selected detail is what `Shift+2` fits — its own box, not the design's. */
	it('frames the selected detail on the selection shortcut', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;
		useAssetDesignStore(designer.pinia).select({ kind: 'detail', id: 'd2' });

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit2');

		const d2 = { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } };
		expect(store.viewport).toEqual(fitViewport(d2, { width: 800, height: 600 }, 48, before.zoom));
		designer.unmount();
	});

	/** And nothing to frame at all, for an asset whose shape has not been drawn yet. */
```

old:
```ts
	it('draws the six layers, beneath-to-above, with the background first and the gesture last', async () => {
		const designer = await mountDesigner(assetDesign());

		expect(designer.stage?.getLayers().map((layer) => layer.name())).toEqual([
			'asset-background',
			'asset-footprint',
			'asset-details',
			'asset-clearance',
			'asset-anchor',
			'asset-gesture',
		]);
```
new:
```ts
	it('draws the seven layers, beneath-to-above, with the background first and the gesture last', async () => {
		const designer = await mountDesigner(assetDesign());

		// `asset-selection` joined above the committed picture and below the gesture (symbols spec,
		// Decision 10): a handle sits over every part it can be drawn across, and a gesture over it.
		expect(designer.stage?.getLayers().map((layer) => layer.name())).toEqual([
			'asset-background',
			'asset-footprint',
			'asset-details',
			'asset-clearance',
			'asset-anchor',
			'asset-selection',
			'asset-gesture',
		]);
```

old:
```ts
		expect(designer.stage?.getLayers().map((layer) => layer.listening())).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
		]);
		designer.unmount();
	});
```
new:
```ts
		expect(designer.stage?.getLayers().map((layer) => layer.listening())).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		]);
		designer.unmount();
	});

	/** The selection is DRAWN, not merely computed: the restroke and one mark per handle, on the stage. */
	it('draws a selected detail’s outline and its nine Transform handles', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));
		useAssetDesignStore(designer.pinia).select({ kind: 'detail', id: 'd2' });
		await settle();

		expect(designer.stage?.findOne('.asset-selection-outline')).toBeDefined();
		expect(designer.stage?.find('.asset-selection-handle')).toHaveLength(9);
		designer.unmount();
	});

	/** A gesture's preview replaces the committed design on the canvas until its write settles. */
	it('draws a gesture’s preview in place of the committed design', async () => {
		const designer = await mountDesigner(assetDesign());
		useAssetDesignStore(designer.pinia).setPreview({ ...BASE, footprint: expectOk(footprintFromDimensions(2000, 1000)) });
		await settle();

		const line = designer.stage?.findOne('.asset-footprint-outline') as Konva.Line | undefined;
		expect(line?.points()).toEqual([-1000, -500, 1000, -500, 1000, 500, -1000, 500]);
		designer.unmount();
	});

	it('restrokes the footprint as the details layer’s last node, and only over details', async () => {
		const detailed = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));
		const layer = detailed.stage?.findOne<Konva.Layer>('.asset-details');
		expect(layer?.getChildren().at(-1)?.name()).toBe('asset-footprint-edge');
		detailed.unmount();

		const plain = await mountDesigner(assetDesign());
		expect(plain.stage?.findOne('.asset-footprint-edge')).toBeUndefined();
		plain.unmount();
	});
```

Edit to `tests/presentation/designer/designerBackground.test.ts`:

old:
```ts
			'asset-clearance',
			'asset-anchor',
			'asset-gesture',
		]);
	});
```
new:
```ts
			'asset-clearance',
			'asset-anchor',
			'asset-selection',
			'asset-gesture',
		]);
	});
```

Edit to `tests/presentation/designer/designerToolbar.test.ts`:

old:
```ts
	it('offers Pan, the five design tools, Undo and Redo — and no Select, because nothing here is selectable', async () => {
		const rig = await designerRig();
		const labels = rig.wrapper.findAll('.rp-designer-tools button').map((button) => button.text());
		expect(labels).toEqual([
			t('en', 'designer.toolbar.pan'),
			t('en', 'designer.toolbar.trace-footprint'),
```
new:
```ts
	/**
	 * Select is back (symbols spec, Decision 10) — with its candidates (`hitDesign`) and its gesture
	 * (`DesignerSelectTool`), the condition `registerDesignerTools.ts` set for returning it. This list
	 * is updated deliberately with that change and stays EXACT.
	 */
	it('offers Pan, Select, the five design tools, Undo and Redo', async () => {
		const rig = await designerRig();
		const labels = rig.wrapper.findAll('.rp-designer-tools button').map((button) => button.text());
		expect(labels).toEqual([
			t('en', 'designer.toolbar.pan'),
			t('en', 'designer.toolbar.select'),
			t('en', 'designer.toolbar.trace-footprint'),
```

Edit to `tests/presentation/designer/designerTools.test.ts`:

old:
```ts
	/**
	 * Task 10 gave `DrawPolygonTool` a required `onCompleted`, which the Plan Editor binds to
	 * `returnToSelect`. The designer registers no `select` tool at all (see the FIVE-tools note
	 * on `DESIGNER_TOOL_LABELS`), so both traces bind it to camera mode instead — the same
	 * substitution `DesignerCanvas.vue`'s `routeEscape` wiring already makes for its
	 * `returned-to-select` arm.
	 */
	it('a closed footprint leaves no active tool, since this surface has no Select to return to', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		expect(rig.activeToolId()).toBe('trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();

		expect(rig.activeToolId()).toBeNull();
		rig.unmount();
	});
```
new:
```ts
	/**
	 * Task 10 gave `DrawPolygonTool` a required `onCompleted`, which the Plan Editor binds to
	 * `returnToSelect`. The designer bound it to camera mode while it registered no `select` tool;
	 * the symbols spec's Decision 10 registered one, so a completed trace returns to Select here too.
	 * Updated deliberately with that change.
	 */
	it('a closed footprint returns to Select', async () => {
		const rig = await designerRig({ shape: null });

		await activate(rig, 'designer.toolbar.trace-footprint');
		expect(rig.activeToolId()).toBe('trace-footprint');
		tracePolygon(rig, TRIANGLE);
		await settle();

		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});
```

Edit to `tests/presentation/designer/designerRefresh.test.ts`:

old:
```ts
	 * every context this leaf builds answers `false` and no registered tool ever asks: the five
	 * in `registerDesignerTools` have no `select` tool (its own header says so), and only
	 * `SelectTool` reads `context.writesBlocked()`. A probe tool registered under the unused
	 * `'select'` id is what reaches the REAL context `buildRuntime` builds — the same object a
	 * real tool would have received — without reaching past `ToolManager`'s own public door.
```
new:
```ts
	 * every context this leaf builds answers `false` and no registered tool ever asks: only the Plan
	 * Editor's `SelectTool` reads `context.writesBlocked()`, and the designer's own
	 * `DesignerSelectTool` does not. A probe tool registered under `'measure'` — an id this surface
	 * does not register; it was `'select'` until the designer registered a Select tool, when
	 * `ToolManager.register` began refusing the duplicate — is what reaches the REAL context
	 * `buildRuntime` builds, without reaching past `ToolManager`'s own public door.
```

old:
```ts
		const probe: EditorTool = {
			id: 'select',
```
new:
```ts
		const probe: EditorTool = {
			id: 'measure',
```

old:
```ts
		runtime.toolManager.setActiveTool('select');
```
new:
```ts
		runtime.toolManager.setActiveTool('measure');
```

`tests/presentation/designer/designerEscapeRouting.test.ts` — replace the header and the first `describe` (the arrow `describe` stays until Task 8):

old:
```ts
/**
 * @vitest-environment jsdom
 *
 * Task 9 widened `EditorSurface`'s Escape branch from an unconditional `cancelGesture()` to
 * `routeEscape` — and this surface is the asset designer's too (`DesignerCanvas.vue` mounts the
 * same component `PlanCanvas.vue` does). The designer registers no `select` tool at all
 * (`registerDesignerTools` names `trace-footprint`, `trace-clearance`, `set-anchor`,
 * `set-facing` and `calibrate`), so `routeEscape`'s `returned-to-select` arm — which always asks
 * for `'select'` — would throw `no tool is registered for id 'select'` the first time a user
 * pressed Escape over a tool with nothing drawn. `DesignerCanvas.vue`'s `escapeSetTool` is the
 * wiring that answers for that: it substitutes camera mode (`null`, this surface's own neutral
 * state — see that file's header) for the id `routeEscape` never learns is unavailable here.
 */
import { describe, expect, it } from 'vitest';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { designerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/settle';

function key(canvas: HTMLElement, init: KeyboardEventInit): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('Escape on the asset designer surface', () => {
	it('returns an empty gesture to camera mode rather than throwing for a missing Select tool', async () => {
		const rig = await designerRig();
		rig.toolbarButton('Set anchor').click();
		expect(rig.activeToolId()).toBe('set-anchor');

		expect(() => key(rig.canvasEl, { key: 'Escape' })).not.toThrow();

		expect(rig.activeToolId()).toBeNull();
		rig.unmount();
	});

	it('clears a selection in camera mode, the same as the Plan Editor', async () => {
		const rig = await designerRig();
		useSelectionStore(rig.pinia).select(['zone-a' as never]);

		key(rig.canvasEl, { key: 'Escape' });

		expect(useSelectionStore(rig.pinia).selectedIds).toEqual([]);
		rig.unmount();
	});
});
```
new:
```ts
/**
 * @vitest-environment jsdom
 *
 * Escape on the asset designer's surface, which mounts the same `EditorSurface` the Plan Editor does
 * and so takes `routeEscape` unchanged.
 *
 * **Updated deliberately with the symbols spec's Decision 10.** While the designer registered no
 * `select` tool, `DesignerCanvas.vue`'s `escapeSetTool` substituted camera mode for the
 * `returned-to-select` arm, and these cases asserted that substitution. The designer now registers
 * `DesignerSelectTool` and keeps its selection in its own `assetDesignStore`, so the substitution is
 * gone and the cases assert the Plan Editor's order: an empty creation tool returns to Select, and
 * Select with a selection clears it.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { click, designerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';
import { settle } from '../../helpers/settle';

function key(canvas: HTMLElement, init: KeyboardEventInit): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('Escape on the asset designer surface', () => {
	it('returns a creation tool with nothing drawn to Select', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		expect(rig.activeToolId()).toBe('trace-footprint');

		key(rig.canvasEl, { key: 'Escape' });

		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	it('clears the designer’s selection under Select, and stays in Select', async () => {
		const rig = await designerRig({ shape: TOILET });
		rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
		await settle();
		click(rig, justInsideBottom(detailOutline('detail-2')));
		await settle();
		const store = useAssetDesignStore(rig.pinia);
		expect(store.selection).toEqual({ kind: 'detail', id: 'detail-2' });

		key(rig.canvasEl, { key: 'Escape' });

		expect(store.selection).toBeNull();
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});
});
```

- [ ] **Step 6: Run them and watch them fail**

`npm run check:fast -- tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/layers.test.ts tests/presentation/designer/designerToolbar.test.ts tests/presentation/designer/designerEscapeRouting.test.ts tests/presentation/designer/designerTools.test.ts tests/presentation/designer/designerBackground.test.ts tests/presentation/designer/designerRefresh.test.ts`

Expected: `vue-tsc` fails on `'designer.toolbar.select'` and `'designer.selection.mode*'` not being assignable to `StringKey`; vitest reports `no designer toolbar button labelled` for Select, the layer lists missing `asset-selection`, `activeToolId` `null` where `select` is expected, and `Shift+2` leaving the viewport unchanged. `designerRefresh.test.ts` passes both before and after (its probe id change is what keeps it passing once `select` is registered).

- [ ] **Step 7: Implement**

`src/presentation/designer/layers/backgroundLayer.ts`:

old:
```ts
	| 'asset-anchor'
	| 'asset-gesture';
```
new:
```ts
	| 'asset-anchor'
	| 'asset-selection'
	| 'asset-gesture';
```

`src/presentation/designer/tools/registerDesignerTools.ts`:

old:
```ts
import { SetAnchorTool } from './set-anchor-tool';
import { SetFacingTool } from './set-facing-tool';
```
new:
```ts
import { DesignerSelectTool, type DesignerSelectToolDeps } from './designer-select-tool';
import { SetAnchorTool } from './set-anchor-tool';
import { SetFacingTool } from './set-facing-tool';
```

old:
```ts
/**
 * FIVE tools and no Select. The designer shipped a `SelectTool` over an empty candidate set
 * with a move factory that threw, under a docblock saying Task B8 would give the surface a
 * selection; B8 shipped an inspector that reads the design and no selection, and the button
 * stayed — a live control that did nothing but stop a primary-button pan, which slice 14's
 * amendment refuses. Selection returns with the first thing on this canvas that can be
 * selected and moved, and it returns with its candidates and its gesture together.
 */
export const DESIGNER_TOOL_LABELS = {
	'trace-footprint': 'designer.toolbar.trace-footprint',
```
new:
```ts
/**
 * Select is FIRST, and it is back on the condition this note used to set for it. The designer once
 * shipped a `SelectTool` over an empty candidate set with a move factory that threw — a live control
 * that did nothing but stop a primary-button pan, which slice 14's amendment refuses — and it was
 * withdrawn until selection could return "with its candidates and its gesture together". The symbols
 * spec's Decision 10 is that return: `hitDesign` is its candidates (footprint, clearance, details,
 * anchor, facing, in a stated order) and `DesignerSelectTool` its gesture.
 */
export const DESIGNER_TOOL_LABELS = {
	select: 'designer.toolbar.select',
	'trace-footprint': 'designer.toolbar.trace-footprint',
```

old:
```ts
	/**
	 * Where a completed trace hands control back to (Task 10). This surface registers no
	 * `select` tool — see this file's own FIVE-tools note above `DESIGNER_TOOL_LABELS` — so
	 * `runtime.ts` binds this to camera mode (`setTool(null)`) rather than to Select.
	 */
	readonly returnToCamera: () => void;
}

export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
	const { assetId, edits, returnToCamera } = deps;
```
new:
```ts
	/** Where a completed trace hands control back to (Task 10): Select, as on a plan. */
	readonly returnToSelect: () => void;
	/** The Select tool's own deps — the leaf's design store and one conditional shape write. */
	readonly selectTool: DesignerSelectToolDeps;
}

export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
	const { assetId, edits, returnToSelect } = deps;
```

old:
```ts
	const tools: Readonly<Record<DesignerToolId, EditorTool>> = {
		// `createdId` is `null` for both traces,
```
new:
```ts
	const tools: Readonly<Record<DesignerToolId, EditorTool>> = {
		select: new DesignerSelectTool(deps.selectTool),
		// `createdId` is `null` for both traces,
```

old:
```ts
				reportInvalidInput: deps.reportInvalidInput,
				// The designer registers no `select` tool (see the FIVE-tools note above), so a
				// completed trace returns to camera mode rather than to a tool that does not exist.
				onCompleted: returnToCamera,
			}),
```
new:
```ts
				reportInvalidInput: deps.reportInvalidInput,
				onCompleted: returnToSelect,
			}),
```

old:
```ts
				reportInvalidInput: deps.reportInvalidInput,
				// Same reason as `trace-footprint` above: no Select tool here, so completing a
				// clearance trace hands control back to camera mode.
				onCompleted: returnToCamera,
			}),
```
new:
```ts
				reportInvalidInput: deps.reportInvalidInput,
				onCompleted: returnToSelect,
			}),
```

`src/presentation/designer/runtime.ts` — `buildRuntime` is 97/100 under `max-lines-per-function`; these edits leave it at 98 (check with `npx eslint --rule '{"max-lines-per-function": ["error", {"max": 1, "skipBlankLines": true, "skipComments": true}]}' src/presentation/designer/runtime.ts` and read the `'buildRuntime'` line):

old:
```ts
import { registerDesignerTools, type DesignerToolDeps } from './tools/registerDesignerTools';
```
new:
```ts
import { registerDesignerTools, type DesignerToolDeps } from './tools/registerDesignerTools';
import type { DesignerSelectToolDeps } from './tools/designer-select-tool';
import { designerSnapCandidates } from './selection/snapCandidates';
import { createEditShape, type EditShape } from './selection/editShape';
```
(`AssetId`, `ReversibleAssetDesignCommands`, `reportDispatchFailure` and `notifyOperationFailure`, which `selectToolDeps` below names, are already imported by this file.)

old:
```ts
	readonly activeToolId: Ref<ToolId | null>;
	readonly setTool: (id: ToolId | null) => void;
}
```
new:
```ts
	readonly activeToolId: Ref<ToolId | null>;
	readonly setTool: (id: ToolId | null) => void;
	/**
	 * One whole-shape edit of the design this leaf read, dispatched through `toolDispatcher` as ONE
	 * `SetAssetShape` conditional on that read's `geometryVersion` — or not at all when the edit
	 * refuses or nothing is drawn (`selection/editShape.ts`). RESOLVES, like `commitHeight`, so a field
	 * can place a refusal beside itself; a key binding hands the result to `notifyIfRefused`.
	 */
	readonly editShape: EditShape;
}
```

old:
```ts
function buildRuntime(context: AssetDesignerContext): DesignerRuntime {
```
new:
```ts
/**
 * The Select tool's deps (symbols spec, Decision 10), built here rather than inline for
 * `calibrationDeps`' reason: `buildRuntime` sits at its 100-line budget. Every member reads the store
 * PER CALL, and the write is the reversible adapter conditional on the version the gesture read.
 */
function selectToolDeps(
	store: ReturnType<typeof useAssetDesignStore>,
	edits: ReversibleAssetDesignCommands,
	assetId: AssetId,
): DesignerSelectToolDeps {
	return {
		design: () => {
			const design = store.design;
			return design?.shape ? { shape: design.shape, geometryVersion: design.geometryVersion } : null;
		},
		selection: () => store.selection,
		mode: () => store.mode,
		select: (next) => store.select(next),
		setPreview: (shape) => store.setPreview(shape),
		createCommand: (shape, expected) => edits.setShape({ assetId, shape, expected }),
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
	};
}

function buildRuntime(context: AssetDesignerContext): DesignerRuntime {
```

old:
```ts
			// The designer's tools snap to nothing (spec §4.2); the shared service is the identity here.
			snapCandidates: () => ({}),
```
new:
```ts
			// The footprint's and every detail's vertices and the anchor, minus the part being dragged
			// (symbols spec, Decision 10). Read PER CALL, like `subject.calibration` above.
			snapCandidates: (exclude) => designerSnapCandidates(store.design?.shape ?? null, exclude ?? []),
```

old:
```ts
	 * Hoisted above `registerDesignerTools` (Task 10) so `returnToCamera` exists in time to be
	 * threaded into the two trace tools' `onCompleted` below — `toolManager` is already built
	 * at this point, which is all `createToolSwitch` needs.
	 */
	const { activeToolId } = storeToRefs(editor);
	const setTool = createToolSwitch(toolManager, activeToolId);
	// This surface registers no `select` tool (see `DESIGNER_TOOL_LABELS`'s own note), so a
	// completed trace returns to camera mode — `setTool(null)` — rather than to a tool that
	// does not exist.
	const returnToCamera = (): void => setTool(null);

	registerDesignerTools(toolManager, {
		assetId,
		edits,
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
		returnToCamera,
		...calibrationDeps(useDialogStore(), store),
	});
```
new:
```ts
	 * Hoisted above `registerDesignerTools` (Task 10) so `setTool` exists in time to be threaded
	 * into the two trace tools' `onCompleted` below — `toolManager` is already built at this point,
	 * which is all `createToolSwitch` needs.
	 */
	const { activeToolId } = storeToRefs(editor);
	const setTool = createToolSwitch(toolManager, activeToolId);

	registerDesignerTools(toolManager, {
		assetId,
		edits,
		reportRejected: reportDispatchFailure,
		reportInvalidInput: notifyOperationFailure,
		// A completed trace returns to Select, which this surface registers since Decision 10.
		returnToSelect: () => setTool('select'),
		selectTool: selectToolDeps(store, edits, assetId),
		...calibrationDeps(useDialogStore(), store),
	});
```

old:
```ts
		activeToolId,
		setTool,
	};
}
```
new:
```ts
		activeToolId,
		setTool,
		editShape: createEditShape(() => store.design, (shape, expected) => toolDispatcher.run(edits.setShape({ assetId, shape, expected }))),
	};
}
```

`src/presentation/editor/tools/editor-context.ts` (comment only; the designer's answer changed):

old:
```ts
	 * One supply for every tool (smart alignment guides increment, spec §4); the designer
	 * answers an empty set.
```
new:
```ts
	 * One supply for every tool (smart alignment guides increment, spec §4); the designer
	 * answers its footprint's and details' vertices and its anchor (`designerSnapCandidates`).
```

`src/presentation/designer/DesignerSelectionModes.vue` (new):

```vue
<script setup lang="ts">
/**
 * The three modes a selected outline is edited in (asset designer symbols spec, Decision 10) —
 * Transform, Edit points, Bend edges — so a rectangle's box handles and its vertex handles never
 * compete for one pointer.
 *
 * Mounted by `DesignerToolbar` only while Select is active and an OUTLINE is selected; the anchor and
 * the facing have no modes. Choosing a mode writes nothing: it is `assetDesignStore.setMode`, and the
 * store resets it to Transform whenever a different part is selected.
 *
 * **Its buttons ARE `.rp-designer-tool-button`s**, inside the toolbar's `.rp-designer-tools`, so the
 * flat-button rules and the active-state rule that already win Obsidian's
 * `button:not(.clickable-icon)` contest (`buttonSpecificity.test.ts`) style them — no second button
 * rule to argue. `styles/designer.css` adds only the group's own rule.
 */
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import type { SelectionMode } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';

const store = useAssetDesignStore();

const MODES: readonly { readonly id: SelectionMode; readonly label: StringKey }[] = [
	{ id: 'transform', label: 'designer.selection.mode.transform' },
	{ id: 'points', label: 'designer.selection.mode.points' },
	{ id: 'bend', label: 'designer.selection.mode.bend' },
];
</script>

<template>
	<div
		class="rp-designer-selection-modes"
		role="radiogroup"
		:aria-label="tr('designer.selection.mode')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.id"
			type="button"
			role="radio"
			class="rp-designer-tool-button"
			:class="{ 'rp-designer-tool-active': store.mode === mode.id }"
			:aria-checked="store.mode === mode.id"
			:title="tr(mode.label)"
			@click="store.setMode(mode.id)"
		>
			{{ tr(mode.label) }}
		</button>
	</div>
</template>
```

`src/presentation/designer/DesignerToolbar.vue`:

old:
```ts
import { DESIGNER_TOOL_LABELS } from './tools/registerDesignerTools';
import { useDesignerRuntime } from './runtime';

const runtime = useDesignerRuntime();
```
new:
```ts
import { DESIGNER_TOOL_LABELS } from './tools/registerDesignerTools';
import { useDesignerRuntime } from './runtime';
import { isOutlineSelection } from './selection/designerSelection';
import { useAssetDesignStore } from './stores/assetDesignStore';
import DesignerSelectionModes from './DesignerSelectionModes.vue';

const runtime = useDesignerRuntime();
const designStore = useAssetDesignStore();
```

old:
```html
			{{ tr(mode.label) }}
		</button>
		<span class="rp-designer-toolbar-spacer" />
```
new:
```html
			{{ tr(mode.label) }}
		</button>
		<DesignerSelectionModes v-if="runtime.activeToolId.value === 'select' && isOutlineSelection(designStore.selection)" />
		<span class="rp-designer-toolbar-spacer" />
```

`src/presentation/designer/DesignerCanvas.vue`:

old:
```ts
import type { StringKey } from '../i18n/locales/en';
import type { ToolId } from '../editor/tools/editor-tool';
import { useEditorStore } from '../stores/EditorStore';
```
new:
```ts
import type { StringKey } from '../i18n/locales/en';
import { useEditorStore } from '../stores/EditorStore';
```

old:
```ts
import { STAGE_PIXELS, viewportTransform, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { useSelectionStore } from '../editor/selection/selection-store';
import { useAssetDesignerContext } from './AssetDesignerContext';
```
new:
```ts
import { STAGE_PIXELS, viewportTransform, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { useAssetDesignerContext } from './AssetDesignerContext';
```

old:
```ts
import { detailOutlines } from './layers/detailsLayer';
import { anchorMark, facingArrow } from './layers/anchorLayer';
```
new:
```ts
import { detailOutlines, footprintEdge } from './layers/detailsLayer';
import { anchorMark, facingArrow } from './layers/anchorLayer';
import { selectionFrame, selectionMarks } from './layers/selectionLayer';
```

old:
```ts
const { design } = storeToRefs(useAssetDesignStore());
```
new:
```ts
const designStore = useAssetDesignStore();
const { design, selection, mode, preview } = storeToRefs(designStore);
```

old:
```ts
/**
 * The selection store, for `EditorSurface`'s Escape routing alone — none of this surface's five
 * registered tools ever call `context.selection.select(...)`, so `selectedIds` never leaves
 * `[]` today. Wired anyway, the way `PlanCanvas.vue` wires the SAME store class: a second
 * `useSelectionStore()` call resolves to one Pinia instance per app, so this is not a second
 * store to keep in step with the one `runtime.ts` already hands every tool through
 * `EditorContext.selection` — it is that store, read here.
 */
const selection = useSelectionStore();

/**
```
new:
```ts
/**
```

old:
```ts
/**
 * `routeEscape`'s `returned-to-select` arm always asks for the Plan Editor's neutral tool,
 * `'select'` — a tool this surface never registers (`registerDesignerTools` names
 * `trace-footprint`, `trace-clearance`, `set-anchor`, `set-facing` and `calibrate`, and no
 * `select`). `runtime.setTool('select')` would throw `no tool is registered for id 'select'`
 * the first time a user pressed Escape over an empty-buffered trace or a not-yet-pressed
 * anchor/facing tool. Camera mode — `null` — is this surface's own neutral state (see the
 * file header: "Camera mode is still what 'no active tool' means"), so that is what this
 * surface returns to instead; `routeEscape` itself is unaware of the substitution; the
 * outcome it reports back is unread here.
 */
function escapeSetTool(id: ToolId | null): void {
	setTool(id === 'select' ? null : id);
}

const transform
```
new:
```ts
const transform
```

old:
```ts
const shape = computed(() => design.value?.shape ?? null);
```
new:
```ts
/**
 * What every world layer draws: a gesture's in-flight PREVIEW while one is live, else the committed
 * design. `DesignerSelectTool` clears the preview only once its write has settled and the refresh has
 * landed, so the canvas never flashes back to the old shape in between.
 */
const shape = computed(() => preview.value ?? design.value?.shape ?? null);
```

old:
```ts
const details = computed(() => detailOutlines(shape.value, tokens.value, worldPerPixel.value));
```
new:
```ts
const details = computed(() => detailOutlines(shape.value, tokens.value, worldPerPixel.value));
const footprintEdgeLine = computed(() => footprintEdge(shape.value, tokens.value, worldPerPixel.value));
const marks = computed(() => selectionMarks(shape.value, selection.value, mode.value, tokens.value, worldPerPixel.value));
```

old:
```ts
 * `Shift+2` frames the SELECTION and answers `null`, because there is nothing selectable on
 * this canvas yet. A fit with nothing to frame does nothing, which is `boundsOfZones`' own
 * rule: a jump to nowhere costs the user the view they had and says nothing about why.
 *
 * The box itself is `designFrame` (`runtime.ts`), which Apply preset fits to as well, so the two
 * cannot frame the same design differently.
 */
function framedBounds(all: boolean): BoundingBox | null {
	const current = shape.value;
	if (!all || current === null) return null;
	return designFrame(current);
}
```
new:
```ts
 * `Shift+2` frames the SELECTION — `selectionFrame`, `null` with nothing selected. A fit with nothing
 * to frame does nothing, which is `boundsOfZones`' own rule: a jump to nowhere costs the user the view
 * they had and says nothing about why.
 *
 * The whole-design box is `designFrame` (`runtime.ts`), which Apply preset fits to as well, so the two
 * cannot frame the same design differently.
 */
function framedBounds(all: boolean): BoundingBox | null {
	const current = shape.value;
	if (current === null) return null;
	return all ? designFrame(current) : selectionFrame(current, selection.value, worldPerPixel.value);
}
```

old:
```html
		:set-tool="escapeSetTool"
		:has-selection="() => selection.selectedIds.length > 0"
		:clear-selection="() => selection.clear()"
```
new:
```html
		:set-tool="setTool"
		:has-selection="() => designStore.selection !== null"
		:clear-selection="() => designStore.select(null)"
```

old:
```html
					<VLine
						v-for="(detail, index) in details"
						:key="index"
						:config="{ ...detail, name: 'asset-detail' }"
					/>
				</VLayer>
```
new:
```html
					<VLine
						v-for="detail in details"
						:key="detail.id"
						:config="{ ...detail, name: 'asset-detail' }"
					/>
					<VLine
						v-if="footprintEdgeLine !== null"
						:config="{ ...footprintEdgeLine, name: 'asset-footprint-edge' }"
					/>
				</VLayer>
```

old:
```html
				<!--
					Screen space and LAST: the gesture in progress sits over every committed
```
new:
```html
				<!--
					The selection: above every committed part it can be drawn across, below the gesture.
				-->
				<VLayer :config="designerLayerConfig('asset-selection', transform)">
					<VLine
						v-if="marks.outline !== null"
						:config="{ ...marks.outline, name: 'asset-selection-outline' }"
					/>
					<VRect
						v-for="(handle, index) in marks.handles"
						:key="index"
						:config="{ ...handle, name: 'asset-selection-handle' }"
					/>
				</VLayer>
				<!--
					Screen space and LAST: the gesture in progress sits over every committed
```

`styles/designer.css` — append after the `.rp-designer-hint` rule at the end of the file:

```css

/*
 * The selection's mode control (asset designer symbols spec, Decision 10), in the toolbar only while
 * Select holds an outline. Its buttons are `.rp-designer-tool-button`s, so the flat-button and
 * active-state rules above already style them; this only groups the three and sets them off from the
 * tools with a rule on the leading edge.
 */
.rp-designer-selection-modes {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
	padding-inline-start: var(--size-4-2);
	border-inline-start: 1px solid var(--background-modifier-border);
}
```

`src/presentation/i18n/locales/en/assetSymbols.ts` — insert before the closing (after whatever Tasks 1–2 appended):

old:
```ts
} as const;
```
new:
```ts
	'designer.toolbar.select': 'Select',
	'designer.selection.mode': 'Selection mode',
	'designer.selection.mode.transform': 'Transform',
	'designer.selection.mode.points': 'Edit points',
	'designer.selection.mode.bend': 'Bend edges',
} as const;
```

`src/presentation/i18n/locales/de/assetSymbols.ts`:

old:
```ts
};
```
new:
```ts
	'designer.toolbar.select': 'Auswählen',
	'designer.selection.mode': 'Auswahlmodus',
	'designer.selection.mode.transform': 'Transformieren',
	'designer.selection.mode.points': 'Punkte bearbeiten',
	'designer.selection.mode.bend': 'Kanten biegen',
};
```

- [ ] **Step 8: Run it and watch it pass** — the shared contracts widened (`DESIGNER_TOOL_LABELS`, `DesignerLayerName`, `DesignerRuntime`, the designer's snap candidates), so the whole presentation suite runs:

`npm run check:fast -- tests/presentation tests/helpers`

Expected: all green, including `regionsReachable.test.ts` (`DesignerSelectionModes.vue` is reached through `DesignerToolbar.vue`) and `assetDesignerRoot.test.ts`'s overlay cases (the designer still opens in camera mode). `runtime.editShape`'s two wiring lambdas are first CALLED by Task 8's rig cases; `createEditShape` itself is covered here.

- [ ] **Step 9: Lint**

`npx eslint src/presentation/designer/selection/editShape.ts src/presentation/designer/layers/selectionLayer.ts src/presentation/designer/layers/detailsLayer.ts src/presentation/designer/layers/backgroundLayer.ts src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/runtime.ts src/presentation/designer/DesignerCanvas.vue src/presentation/designer/DesignerToolbar.vue src/presentation/designer/DesignerSelectionModes.vue src/presentation/editor/tools/editor-context.ts src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/layers.test.ts tests/presentation/designer/designerToolbar.test.ts tests/presentation/designer/designerEscapeRouting.test.ts tests/presentation/designer/designerTools.test.ts tests/presentation/designer/designerBackground.test.ts tests/presentation/designer/designerRefresh.test.ts`

- [ ] **Step 10: Commit**

```bash
git add src/presentation/designer/selection/editShape.ts src/presentation/designer/layers/selectionLayer.ts src/presentation/designer/layers/detailsLayer.ts src/presentation/designer/layers/backgroundLayer.ts src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/runtime.ts src/presentation/designer/DesignerCanvas.vue src/presentation/designer/DesignerToolbar.vue src/presentation/designer/DesignerSelectionModes.vue src/presentation/editor/tools/editor-context.ts styles/designer.css src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/selection/editShape.test.ts tests/presentation/designer/selectionLayer.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/designer/layers.test.ts tests/presentation/designer/designerToolbar.test.ts tests/presentation/designer/designerEscapeRouting.test.ts tests/presentation/designer/designerTools.test.ts tests/presentation/designer/designerBackground.test.ts tests/presentation/designer/designerRefresh.test.ts
git commit -m "feat(designer): Select in the toolbar, drawn, snapping and undoable

Registers the designer's Select tool, draws the selection and a gesture's
preview on a new asset-selection layer, offers Transform / Edit points /
Bend edges for a selected outline, and returns Escape and completed traces
to Select. Adds runtime.editShape, one conditional SetAssetShape per edit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 7: Bend edges through `CurveTool`

**Files:**
- Modify: `src/presentation/designer/tools/designer-select-tool.ts`
- Test (new): `tests/presentation/designer/tools/designerSelectBend.test.ts`
- Test (updated deliberately): `tests/presentation/designer/tools/designerSelectTool.test.ts` (its "starts nothing from an edge handle" case is removed — that press is now a bend), `tests/presentation/designer/designerSelection.test.ts` (one rig case)

**Interfaces:**
- Consumes: `CurveTool`, `CurveToolActions` (`src/presentation/editor/curves/CurveTool.ts`), `CurveTarget` (`curveDraft.ts`), `setBulge`, `outlineOf`, `OutlinePart` (Task 1), `partKey` (Task 3).
- Produces: no new export. `DesignerSelectTool`'s signature is unchanged; in `bend` mode an edge-handle press is a bend, committed on release as ONE `SetAssetShape` conditional on the version the press read.

The target handed to `CurveTool` is ONE edge (`kind: 'wall'`), not the whole outline — the plan's "Planning conflicts" section, conflict B3, records why.

- [ ] **Step 1: Write the failing test** — `tests/presentation/designer/tools/designerSelectBend.test.ts`:

```ts
/**
 * Bend edges in the designer's Select tool (asset designer symbols spec, Decision 10): the plan
 * editor's `CurveTool`, bound to ONE edge of the selected outline, previewing through the leaf's store
 * and committing a single conditional write on release.
 *
 * The tank's top edge is straight, 380 mm long, and its midpoint is where Bend edges draws its handle.
 * A bulge is twice the arc's depth over its chord, so a pointer 50 mm off the edge's middle, away from
 * the outline's inside, is a bulge of 100 / 380 — positive, which bows outward on this winding.
 */
import { describe, expect, it } from 'vitest';
import { flushGesture, pointerAt } from '../../../helpers/tool-context';
import { detailOutline, selectToolRig, type SelectToolRig } from '../../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const TOP = { x: (TANK.points[0].x + TANK.points[1].x) / 2, y: TANK.points[0].y };
const CHORD = TANK.points[1].x - TANK.points[0].x;
const RISE = 50;

function bendRig(): SelectToolRig {
	const rig = selectToolRig({ selection: { kind: 'detail', id: 'detail-1' }, mode: 'bend' });
	rig.tool.activate(rig.harness.context);
	return rig;
}

describe('bending an edge', () => {
	it('writes one command bowing the pressed edge, every other edge left straight', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		// Escape asks this before it cancels, and edge scrolling asks the other.
		expect(rig.tool.hasDraft()).toBe(true);
		expect(rig.tool.tracksPointer()).toBe(true);
		rig.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));
		await flushGesture();

		expect(rig.harness.dispatched).toHaveLength(1);
		const outline = rig.written[0]?.shape.details[0]?.outline;
		expect(outline?.bulges?.[0]).toBeCloseTo((2 * RISE) / CHORD, 12);
		expect(outline?.bulges?.slice(1)).toEqual([0, 0, 0]);
		expect(outline?.points).toEqual(TANK.points);
		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.tool.tracksPointer()).toBe(false);
	});

	it('writes nothing for a click on an edge midpoint that never moves', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(false);
	});

	it('writes nothing and clears the preview when Escape cancels a bend', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		rig.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		expect(rig.previews.at(-1)).not.toBeNull();
		rig.tool.cancel();
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));
		await flushGesture();

		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.written).toEqual([]);
	});

	it('writes nothing and clears the preview when a bend is interrupted, or the tool switched away', async () => {
		const interrupted = bendRig();
		interrupted.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		interrupted.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		interrupted.tool.abandonGesture();
		interrupted.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));

		const switched = bendRig();
		switched.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		switched.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		switched.tool.deactivate();
		switched.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));
		await flushGesture();

		expect(interrupted.previews.at(-1)).toBeNull();
		expect(interrupted.written).toEqual([]);
		expect(switched.previews.at(-1)).toBeNull();
		expect(switched.written).toEqual([]);
	});
});
```

Edit to `tests/presentation/designer/tools/designerSelectTool.test.ts` — remove the case Task 5 marked for replacement:

old:
```ts

	/** Replaced deliberately by Task 7, which gives this press to `CurveTool`. */
	it('in Bend edges, starts nothing from an edge handle until the bend gesture is wired', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED, mode: 'bend' });
		rig.tool.activate(rig.harness.context);
		const midpoint = { x: (TANK.points[0].x + TANK.points[1].x) / 2, y: TANK.points[0].y };

		rig.tool.pointerDown(pointerAt(midpoint.x, midpoint.y));
		rig.tool.pointerMove(pointerAt(midpoint.x, midpoint.y - 50));
		rig.tool.pointerUp(pointerAt(midpoint.x, midpoint.y - 50));
		await flushGesture();

		expect(rig.selected).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.written).toEqual([]);
	});
});
```
new:
```ts
});
```

Edit to `tests/presentation/designer/designerSelection.test.ts` — append after the `describe('the mode control', …)` block:

```ts

describe('bending an edge', () => {
	it('bows the tank’s top edge in one write under Bend edges', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_TANK);
		await settle();
		await press(rig, 'designer.selection.mode.bend');
		const top = { x: (TANK.points[0].x + TANK.points[1].x) / 2, y: TANK.points[0].y };

		drag(rig, top, { x: top.x, y: top.y - 50 });
		await settle();

		const tank = (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-1')?.outline;
		expect(tank?.bulges?.[0]).toBeCloseTo((2 * 50) / (TANK.points[1].x - TANK.points[0].x), 6);
		expect(tank?.bulges?.slice(1)).toEqual([0, 0, 0]);
		rig.unmount();
	});
});
```

(At the rig's camera the right edge's midpoint is 21.5 px from the top one — this case is what fails if the target is ever widened back to the whole outline and the press is moved to the right edge.)

- [ ] **Step 2: Run it and watch it fail**

`npm run check:fast -- tests/presentation/designer/tools/designerSelectBend.test.ts tests/presentation/designer/designerSelection.test.ts`

Expected: the first bend case fails `expect(rig.tool.hasDraft()).toBe(true)` (Task 5 starts nothing from an edge handle) and, past that, `dispatched` has length 0; the rig case finds `tank.bulges` `undefined`.

- [ ] **Step 3: Implement** — edits to `src/presentation/designer/tools/designer-select-tool.ts` (the text Task 5 wrote):

old:
```ts
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import { distance } from '../../../core/geometry/operations';
```
new:
```ts
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { distance } from '../../../core/geometry/operations';
```

old:
```ts
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
```
new:
```ts
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, setBulge, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { CurveTool } from '../../editor/curves/CurveTool';
import type { CurveTarget } from '../../editor/curves/curveDraft';
import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
```

old:
```ts
	/** Latched once the pointer has travelled past the click epsilon; a press that never does is a click. */
	moved: boolean;
}
```
new:
```ts
	/** Latched once the pointer has travelled past the click epsilon; a press that never does is a click. */
	moved: boolean;
}

/** A Bend edges gesture: one edge of the selected outline, handed to `CurveTool` as a one-edge target. */
interface Bend {
	readonly context: EditorContext;
	readonly design: PressedDesign;
	readonly selection: OutlinePart;
	/** The edge's index in the OUTLINE; the curve tool only ever sees it as edge 0. */
	readonly edge: number;
	readonly target: CurveTarget;
	/** The bulge the curve tool last set; `null` while the press has not moved, which writes nothing. */
	bulge: number | null;
}
```

old:
```ts
 * really was attempted).
 */
export class DesignerSelectTool implements EditorTool {
```
new:
```ts
 * really was attempted).
 *
 * **Bend edges is the plan editor's `CurveTool`, not a copy of it**: an edge-handle press in `bend`
 * mode is forwarded to one `CurveTool` built over this tool's own `CurveToolActions`, whose `set`
 * previews `setBulge` and whose `finish` commits through the same `release` a drag does.
 */
export class DesignerSelectTool implements EditorTool {
```

old:
```ts
	private context: EditorContext | null = null;
	private drag: Drag | null = null;
	private previewGeneration = 0;

	constructor(private readonly deps: DesignerSelectToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
	}

	deactivate(): void {
		this.dropGesture();
		this.context = null;
	}
```
new:
```ts
	private context: EditorContext | null = null;
	private drag: Drag | null = null;
	private bend: Bend | null = null;
	private previewGeneration = 0;
	/**
	 * Its actions are asked only while a bend exists — `pointerDown` forwards to it only on an edge
	 * handle, and its `hasDraft` (true for any target) is never asked — so `target` and `set` read
	 * `bend` without a null arm. `blocked` and `busy` share one never-true function; `choose`, `stop`
	 * and `cancel` have nothing to do, because `dropGesture` clears the preview beside every call that
	 * reaches them.
	 */
	private readonly curve: CurveTool;

	constructor(private readonly deps: DesignerSelectToolDeps) {
		const never = (): boolean => false;
		const nothing = (): void => undefined;
		this.curve = new CurveTool({
			target: () => (this.bend as Bend).target,
			blocked: never,
			busy: never,
			set: (_index, bulge) => this.bendTo(bulge),
			choose: nothing,
			stop: nothing,
			cancel: nothing,
			finish: () => this.finishBend(),
		});
	}

	activate(context: EditorContext): void {
		this.context = context;
		this.curve.activate(context);
	}

	deactivate(): void {
		this.curve.deactivate();
		this.dropGesture();
		this.context = null;
	}
```

old:
```ts
		// Bend edges is `CurveTool`'s gesture (Task 7); until it is wired an edge handle starts nothing.
		if (hit.role.kind === 'edge') return;
```
new:
```ts
		if (hit.role.kind === 'edge') {
			// An edge handle is drawn only in Bend edges, around an outline the shape has.
			this.beginBend(context, design, selection as OutlinePart, hit.role.index);
			this.curve.pointerDown(event);
			return;
		}
```

old:
```ts
	pointerMove(event: EditorPointerEvent): void {
		const drag = this.drag;
		if (drag === null || !this.passedEpsilon(drag, event.worldPoint)) return;
		this.preview(this.shapeAt(drag, event));
	}

	pointerUp(event: EditorPointerEvent): void {
		const drag = this.drag;
		if (drag === null || event.button !== 'primary') return;
		this.drag = null;
```
new:
```ts
	pointerMove(event: EditorPointerEvent): void {
		if (this.bend !== null) {
			this.curve.pointerMove(event);
			return;
		}
		const drag = this.drag;
		if (drag === null || !this.passedEpsilon(drag, event.worldPoint)) return;
		this.preview(this.shapeAt(drag, event));
	}

	pointerUp(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		if (this.bend !== null) {
			// `CurveTool` takes the release's own bulge and drops its drag; `finish` then commits.
			this.curve.pointerUp(event);
			this.curve.finish();
			return;
		}
		const drag = this.drag;
		if (drag === null) return;
		this.drag = null;
```

old:
```ts
	cancel(): void {
		this.dropGesture(); // no command dispatched
	}

	/** The whole gesture is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.dropGesture();
	}

	/** A press with no release yet — so Escape mid-drag abandons the drag before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null;
	}

	/** Every drag computes from the event's world point, so edge scrolling may carry it once it is a drag. */
	tracksPointer(): boolean {
		return this.drag?.moved === true;
	}
```
new:
```ts
	cancel(): void {
		this.curve.cancel();
		this.dropGesture(); // no command dispatched
	}

	/** Every gesture here is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.curve.abandonGesture();
		this.dropGesture();
	}

	/** A press with no release yet — so Escape mid-gesture abandons it before it clears the selection. */
	hasDraft(): boolean {
		return this.drag !== null || this.bend !== null;
	}

	/** Both gestures compute from the event's world point, so edge scrolling may carry them. */
	tracksPointer(): boolean {
		return this.bend !== null || this.drag?.moved === true;
	}
```

old:
```ts
	private dropGesture(): void {
		this.drag = null;
		this.deps.setPreview(null);
	}
}
```
new:
```ts
	private dropGesture(): void {
		this.drag = null;
		this.bend = null;
		this.deps.setPreview(null);
	}

	/**
	 * ONE edge as a `kind: 'wall'` target, whose `curveEdges` arm yields only edge 0: `CurveTool` takes
	 * the FIRST edge whose midpoint is within 22 px, so a whole-outline target bends a neighbour of the
	 * edge `hitDesign` found on any outline small on screen. `bulgeAt` reads only the edge's start and
	 * end, so the bulge's sign is the closed ring's.
	 */
	private beginBend(context: EditorContext, design: PressedDesign, selection: OutlinePart, edge: number): void {
		// An edge handle is drawn only on an outline the shape has, so this lookup cannot miss here.
		const outline = outlineOf(design.shape, selection) as CurvedPolygon;
		const start = outline.points[edge];
		const end = outline.points[(edge + 1) % outline.points.length];
		this.bend = {
			context,
			design,
			selection,
			edge,
			bulge: null,
			target: { id: partKey(selection), kind: 'wall', name: '', geometry: { points: [start, end], bulges: [outline.bulges?.[edge] ?? 0, 0] } },
		};
	}

	private bendTo(bulge: number): void {
		const bend = this.bend as Bend;
		bend.bulge = bulge;
		this.preview(setBulge(bend.design.shape, bend.selection, bend.edge, bulge));
	}

	private finishBend(): void {
		const bend = this.bend as Bend;
		this.bend = null;
		if (bend.bulge === null) return;
		this.release(bend.context, setBulge(bend.design.shape, bend.selection, bend.edge, bend.bulge), bend.design.geometryVersion);
	}
}
```

- [ ] **Step 4: Run it and watch it pass**

`npm run check:fast -- tests/presentation/designer/tools/designerSelectBend.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts tests/presentation/designer/designerSelection.test.ts tests/presentation/editor/curves`

Expected: all green; the plan editor's curve suites are unchanged because `CurveTool.ts` is not edited.

- [ ] **Step 5: Lint**

`npx eslint src/presentation/designer/tools/designer-select-tool.ts tests/presentation/designer/tools/designerSelectBend.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts tests/presentation/designer/designerSelection.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/tools/designer-select-tool.ts tests/presentation/designer/tools/designerSelectBend.test.ts tests/presentation/designer/tools/designerSelectTool.test.ts tests/presentation/designer/designerSelection.test.ts
git commit -m "feat(designer): Bend edges through the plan editor's CurveTool

In Bend edges an edge-midpoint drag bows that one edge, previewed through
the leaf's store and committed as one conditional SetAssetShape. The curve
tool sees a one-edge target so it cannot pick a neighbouring edge.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 8: Keyboard — Delete, arrows, Ctrl+D

**Files:**
- Create: `src/presentation/designer/designerKeys.ts`
- Modify: `src/presentation/designer/AssetDesignerRoot.vue` (`@keydown` on `.rp-designer-canvas`), `src/presentation/designer/DesignerCanvas.vue` (`nudge-selection`), `src/presentation/editor/surface/EditorSurface.vue` (one stale comment line about the designer's no-op nudge; no code)
- Test (new): `tests/presentation/designer/designerKeys.test.ts`, `tests/presentation/designer/designerKeyboard.test.ts`
- Test (updated deliberately): `tests/presentation/designer/designerEscapeRouting.test.ts` (the arrow case)

**Interfaces:**
- Consumes: `runtime.editShape` / `EditShape` (Task 6); `deleteDetail`, `duplicateDetail`, `nextDetailId`, `DUPLICATE_OFFSET_MM` (Task 2); `moveOutline`, `moveAnchor`, `removeClearance` (Task 1); store `selection`/`select` (Task 3); `plainPress` (`editor/surface/keyboard.ts`); `notifyIfRefused` (`editor/report-failure.ts`).
- Produces:
```ts
export interface DesignerKeyPress { readonly key: string; readonly ctrlKey: boolean; readonly metaKey: boolean; readonly altKey: boolean; readonly shiftKey: boolean; readonly repeat: boolean; readonly isComposing: boolean; preventDefault(): void }
export interface DesignerKeyDoors { readonly selection: DesignerSelection | null; deleteSelection(): void; duplicateSelection(): void }
/** true when the press was one of these shortcuts (and was handled). Delete/Backspace with no modifiers on a detail or clearance → deleteSelection; Ctrl/Meta+D (no Alt, no Shift, not repeat) on a detail → duplicateSelection and preventDefault. Everything else → false. */
export function designerShortcut(event: DesignerKeyPress, doors: DesignerKeyDoors): boolean;
// private helper this task adds, consumed by both components:
export function selectionKeyActions(
  store: { readonly selection: DesignerSelection | null; select(next: DesignerSelection | null): void },
  editShape: EditShape,
): { readonly deleteSelection: () => Promise<void>; readonly duplicateSelection: () => Promise<void>; readonly nudgeSelection: (by: Vector) => Promise<void> };
```

Routing checked against the real `keyDoors.ts`: `EditorSurface` calls `nudgeSelection` for an arrow pressed on the canvas (`isCanvasKey`, not a repeat, no gesture in flight). Delete, Backspace and Ctrl+D fall through every door there — `finishShortcut` claims Backspace only for `draw-wall`/element tools, `fitShortcut` returns `false` for any Ctrl chord or a key other than `f`/`Digit1`/`Digit2`, and only Escape calls `stopPropagation` — so they bubble to `.rp-designer-canvas`. The inspector is a SIBLING region, so an inspector input's keydown never reaches that listener.

- [ ] **Step 1: Write the failing tests**

`tests/presentation/designer/designerKeys.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The designer's selection shortcuts as pure decisions (`designerShortcut`), and the three edits they
 * and the arrow keys dispatch (`selectionKeyActions`) over a fake `editShape` that applies each edit to
 * the toilet preset — so what an action WOULD write is asserted without a vault. jsdom only for the
 * notice a refused duplicate raises. `designerKeyboard.test.ts` is the mounted half.
 */
import { describe, expect, it } from 'vitest';
import type { AppError, ValidationError } from '../../../src/core/errors/AppError';
import { ok, type Result } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { designerShortcut, selectionKeyActions, type DesignerKeyPress } from '../../../src/presentation/designer/designerKeys';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/settle';
import { TOILET, detailOutline } from '../../helpers/designerSelection';

installObsidianDom();

const DETAIL: DesignerSelection = { kind: 'detail', id: 'detail-2' };

function pressed(init: Partial<DesignerKeyPress>): { readonly event: DesignerKeyPress; readonly prevented: () => boolean } {
	let prevented = false;
	const event: DesignerKeyPress = {
		key: '',
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		repeat: false,
		isComposing: false,
		...init,
		preventDefault: () => {
			prevented = true;
		},
	};
	return { event, prevented: () => prevented };
}

function doors(selection: DesignerSelection | null): { readonly calls: string[]; readonly doors: Parameters<typeof designerShortcut>[1] } {
	const calls: string[] = [];
	return {
		calls,
		doors: {
			selection,
			deleteSelection: () => {
				calls.push('delete');
			},
			duplicateSelection: () => {
				calls.push('duplicate');
			},
		},
	};
}

const HANDLED: readonly (readonly [string, Partial<DesignerKeyPress>, DesignerSelection, string])[] = [
	['Delete on a detail', { key: 'Delete' }, DETAIL, 'delete'],
	['Backspace on the clearance', { key: 'Backspace' }, { kind: 'clearance' }, 'delete'],
	['Ctrl+D on a detail', { key: 'd', ctrlKey: true }, DETAIL, 'duplicate'],
	['Cmd+D on a detail', { key: 'd', metaKey: true }, DETAIL, 'duplicate'],
	['Ctrl+D with Caps Lock on', { key: 'D', ctrlKey: true }, DETAIL, 'duplicate'],
];

const IGNORED: readonly (readonly [string, Partial<DesignerKeyPress>, DesignerSelection | null])[] = [
	['Delete on the footprint', { key: 'Delete' }, { kind: 'footprint' }],
	['Delete on the anchor', { key: 'Delete' }, { kind: 'anchor' }],
	['Delete with nothing selected', { key: 'Delete' }, null],
	['Shift+Delete', { key: 'Delete', shiftKey: true }, DETAIL],
	['Ctrl+Backspace', { key: 'Backspace', ctrlKey: true }, DETAIL],
	['an autorepeated Delete', { key: 'Delete', repeat: true }, DETAIL],
	['Ctrl+D on the clearance', { key: 'd', ctrlKey: true }, { kind: 'clearance' }],
	['Ctrl+Shift+D', { key: 'D', ctrlKey: true, shiftKey: true }, DETAIL],
	['Ctrl+Alt+D', { key: 'd', ctrlKey: true, altKey: true }, DETAIL],
	['an autorepeated Ctrl+D', { key: 'd', ctrlKey: true, repeat: true }, DETAIL],
	['Ctrl+D mid-composition', { key: 'd', ctrlKey: true, isComposing: true }, DETAIL],
	['a bare d', { key: 'd' }, DETAIL],
	['an unrelated key', { key: 'x' }, DETAIL],
];

describe('designerShortcut', () => {
	it.each(HANDLED)('handles %s', (_name, init, selection, door) => {
		const { event, prevented } = pressed(init);
		const recorded = doors(selection);

		expect(designerShortcut(event, recorded.doors)).toBe(true);
		expect(recorded.calls).toEqual([door]);
		// Only the chord has a browser default worth taking away; a bare Delete on a focused canvas has none.
		expect(prevented()).toBe(door === 'duplicate');
	});

	it.each(IGNORED)('ignores %s', (_name, init, selection) => {
		const { event, prevented } = pressed(init);
		const recorded = doors(selection);

		expect(designerShortcut(event, recorded.doors)).toBe(false);
		expect(recorded.calls).toEqual([]);
		expect(prevented()).toBe(false);
	});
});

const REFUSED: DispatchResult = { ok: false, error: { category: 'Validation', code: 'asset.part-not-found', message: 'x' } as AppError };

function actionsOver(selection: DesignerSelection | null, answer: DispatchResult = ok('wrote')) {
	const selected: (DesignerSelection | null)[] = [];
	const edited: Result<AssetShape, ValidationError>[] = [];
	const actions = selectionKeyActions(
		{
			selection,
			select: (next) => {
				selected.push(next);
			},
		},
		(edit) => {
			edited.push(edit(TOILET));
			return Promise.resolve(answer);
		},
	);
	return { actions, selected, edited };
}

function shapeOf(result: Result<AssetShape, ValidationError> | undefined): AssetShape | undefined {
	return result?.ok === true ? result.value : undefined;
}

describe('selectionKeyActions', () => {
	it('deletes a selected detail, and removes a selected clearance', async () => {
		const detail = actionsOver(DETAIL);
		const clearance = actionsOver({ kind: 'clearance' });

		await detail.actions.deleteSelection();
		await clearance.actions.deleteSelection();

		expect(shapeOf(detail.edited[0])?.details.map((each) => each.id)).toEqual(['detail-1']);
		expect(shapeOf(clearance.edited[0])?.clearance).toBeNull();
	});

	it('nudges an outline or the anchor, and writes nothing for the facing or for no selection', async () => {
		const outline = actionsOver(DETAIL);
		const anchor = actionsOver({ kind: 'anchor' });
		const facing = actionsOver({ kind: 'facing' });
		const nothing = actionsOver(null);

		await outline.actions.nudgeSelection({ dx: 10, dy: 0 });
		await anchor.actions.nudgeSelection({ dx: 0, dy: 100 });
		await facing.actions.nudgeSelection({ dx: 10, dy: 0 });
		await nothing.actions.nudgeSelection({ dx: 10, dy: 0 });

		const bowl = shapeOf(outline.edited[0])?.details.find((each) => each.id === 'detail-2')?.outline.points;
		expect(bowl).toEqual(detailOutline('detail-2').points.map((point) => ({ x: point.x + 10, y: point.y })));
		expect(shapeOf(anchor.edited[0])?.anchor).toEqual({ x: TOILET.anchor.x, y: TOILET.anchor.y + 100 });
		expect(facing.edited).toEqual([]);
		expect(nothing.edited).toEqual([]);
	});

	it('duplicates a detail and selects the copy it wrote', async () => {
		const harness = actionsOver(DETAIL);

		await harness.actions.duplicateSelection();

		expect(shapeOf(harness.edited[0])?.details.map((each) => each.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(harness.selected).toEqual([{ kind: 'detail', id: 'detail-3' }]);
	});

	it('selects nothing for a refused duplicate, and says why', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const harness = actionsOver(DETAIL, REFUSED);

		await harness.actions.duplicateSelection();
		await settle();

		expect(harness.selected).toEqual([]);
		expect(Notice.shown).toHaveLength(1);
	});
});
```

`tests/presentation/designer/designerKeyboard.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The designer's selection keys, MOUNTED (symbols spec, Decision 10): Delete and Ctrl+D on the canvas
 * region, the arrows through `EditorSurface`'s own nudge, each one conditional `SetAssetShape` and one
 * undo entry, written to a real sidecar. `designerKeys.test.ts` holds the decisions and the arms.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { settle } from '../../helpers/editor';
import { click, designerRig, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');

function key(target: Element, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

async function selectAt(rig: DesignerRig, world: Point): Promise<void> {
	await press(rig, 'designer.toolbar.select');
	click(rig, world);
	await settle();
}

async function bowlPoints(rig: DesignerRig): Promise<readonly Point[] | undefined> {
	return (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points;
}

describe('Delete', () => {
	it('deletes the selected detail, and the selection goes with it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'Delete' });
		await settle();

		expect((await rig.document()).shape?.details.map((detail) => detail.id)).toEqual(['detail-1']);
		expect(useAssetDesignStore(rig.pinia).selection).toBeNull();
		rig.unmount();
	});

	it('removes the selected clearance with Backspace', async () => {
		const rig = await designerRig({ shape: TOILET });
		const corner = TOILET.clearance?.points[2] as Point;
		// Inside the clearance's far corner: outside the footprint and every detail.
		await selectAt(rig, { x: corner.x - 50, y: corner.y - 50 });
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'clearance' });

		key(rig.canvasEl, { key: 'Backspace' });
		await settle();

		expect((await rig.document()).shape?.clearance).toBeNull();
		rig.unmount();
	});

	it('does nothing to the footprint, which cannot be deleted', async () => {
		const rig = await designerRig({ shape: TOILET });
		// Inside the footprint, right of the bowl and below the tank.
		await selectAt(rig, { x: TOILET.footprint.points[1].x - 15, y: 0 });
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'footprint' });
		const before = await rig.document();

		key(rig.canvasEl, { key: 'Delete' });
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	it('deletes nothing for a Backspace typed in the inspector, a sibling of the canvas region', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));
		const height = rig.wrapper.find('.rp-designer-inspector input[name="height"]');

		key(height.element, { key: 'Backspace' });
		await settle();

		expect((await rig.document()).shape?.details).toHaveLength(2);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });
		rig.unmount();
	});
});

describe('Ctrl+D', () => {
	it('adds a copy 100 mm down and right, selects it, and one Undo removes it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'd', ctrlKey: true });
		await settle();

		const details = (await rig.document()).shape?.details;
		expect(details?.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(details?.[2]?.outline.points).toEqual(BOWL.points.map((point) => ({ x: point.x + 100, y: point.y + 100 })));
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-3' });

		await press(rig, 'designer.toolbar.undo');
		expect((await rig.document()).shape?.details).toHaveLength(2);
		rig.unmount();
	});
});

describe('the arrow keys', () => {
	it('nudge a detail 10 mm, or 100 mm with Shift, one undo entry each', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'ArrowRight' });
		await settle();
		key(rig.canvasEl, { key: 'ArrowDown', shiftKey: true });
		await settle();
		expect(await bowlPoints(rig)).toEqual(BOWL.points.map((point) => ({ x: point.x + 10, y: point.y + 100 })));

		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points.map((point) => ({ x: point.x + 10, y: point.y })));
		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});

	it('move a selected anchor, and leave a selected facing alone', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, TOILET.anchor);

		key(rig.canvasEl, { key: 'ArrowLeft' });
		await settle();
		expect((await rig.document()).shape?.anchor).toEqual({ x: TOILET.anchor.x - 10, y: TOILET.anchor.y });

		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'facing' });
		const before = await rig.document();
		key(rig.canvasEl, { key: 'ArrowUp' });
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});
});
```

Edit to `tests/presentation/designer/designerEscapeRouting.test.ts` (the arrow case, updated deliberately):

old:
```ts
/**
 * `DesignerCanvas.vue:113`'s `nudgeSelection` is the inert half of E8/Task 14: this surface's
 * own `selection` never holds anything (see that file's header), so `EditorSurface`'s arrow-key
 * routing still calls the prop — there is nothing here for it to move, and the case is that
 * calling it does nothing rather than throwing or writing.
 */
describe('an arrow key on the asset designer surface', () => {
	it('reaches the inert nudgeSelection without throwing or writing to the sidecar', async () => {
		const rig = await designerRig();
```
new:
```ts
/**
 * An arrow key reaches `DesignerCanvas`'s `nudgeSelection` whatever is selected — `EditorSurface` does
 * not ask. Updated deliberately from "the inert nudge" when the designer gained a selection (symbols
 * spec, Decision 10): with NOTHING selected it still writes nothing. `designerKeyboard.test.ts` is
 * where a selected part moves.
 */
describe('an arrow key on the asset designer surface', () => {
	it('writes nothing with nothing selected', async () => {
		const rig = await designerRig({ shape: TOILET });
```

- [ ] **Step 2: Run them and watch them fail**

`npm run check:fast -- tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts tests/presentation/designer/designerEscapeRouting.test.ts`

Expected: `vue-tsc` reports `Cannot find module '…/presentation/designer/designerKeys'`; vitest fails `designerKeys.test.ts` on that import and `designerKeyboard.test.ts` on unchanged documents (no listener, and the canvas's nudge is still a no-op). The escape file's arrow case passes before and after.

- [ ] **Step 3: Implement** — `src/presentation/designer/designerKeys.ts`:

```ts
import type { Vector } from '../../core/geometry/Vector';
import { DUPLICATE_OFFSET_MM, deleteDetail, duplicateDetail, nextDetailId } from '../../domain/asset/detailEdits';
import { moveAnchor, moveOutline, removeClearance } from '../../domain/asset/shapeEdits';
import { notifyIfRefused } from '../editor/report-failure';
import { plainPress } from '../editor/surface/keyboard';
import type { DesignerSelection } from './selection/designerSelection';
import type { EditShape } from './selection/editShape';

/**
 * The asset designer's selection keys (symbols spec, Decision 10). Delete and Ctrl+D are decided HERE
 * and bound on the canvas REGION by `AssetDesignerRoot`, because `EditorSurface` routes neither and
 * lets both bubble; the arrows are `EditorSurface`'s own nudge, which `DesignerCanvas` answers with
 * `selectionKeyActions(...).nudgeSelection`. Every edit is one `editShape`, so one conditional write
 * and one undo entry, and every refusal goes through `notifyIfRefused`.
 */

/** What `designerShortcut` reads of a key event — a real `KeyboardEvent` satisfies it structurally. */
export interface DesignerKeyPress {
	readonly key: string;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly altKey: boolean;
	readonly shiftKey: boolean;
	readonly repeat: boolean;
	readonly isComposing: boolean;
	preventDefault(): void;
}

export interface DesignerKeyDoors {
	readonly selection: DesignerSelection | null;
	deleteSelection(): void;
	duplicateSelection(): void;
}

/**
 * A bare Delete or Backspace on a part that can go: a detail, or the clearance. The footprint cannot
 * be deleted (spec Decision 9), and the anchor and the facing are not parts one removes. An autorepeat
 * is refused too — a held key would dispatch a second, stale delete before the first refresh landed.
 */
function deletes(event: DesignerKeyPress, kind: DesignerSelection['kind'] | undefined): boolean {
	return plainPress(event) && !event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace') && (kind === 'detail' || kind === 'clearance');
}

/** Ctrl+D, or Cmd+D, on a detail. The character rather than the physical key, so Caps Lock still reads as `d`. */
function duplicates(event: DesignerKeyPress, kind: DesignerSelection['kind'] | undefined): boolean {
	return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !event.repeat && !event.isComposing && event.key.toLowerCase() === 'd' && kind === 'detail';
}

/** true when the press was one of these shortcuts (and was handled). Delete/Backspace with no modifiers on a detail or clearance → deleteSelection; Ctrl/Meta+D (no Alt, no Shift, not repeat) on a detail → duplicateSelection and preventDefault. Everything else → false. */
export function designerShortcut(event: DesignerKeyPress, doors: DesignerKeyDoors): boolean {
	const kind = doors.selection?.kind;
	if (deletes(event, kind)) {
		doors.deleteSelection();
		return true;
	}
	if (!duplicates(event, kind)) return false;
	event.preventDefault();
	doors.duplicateSelection();
	return true;
}

/**
 * The three edits a selection key dispatches, over the leaf's store and its `editShape`. Arrow-function
 * properties, so a component may destructure one without an unbound `this`.
 *
 * `deleteSelection` and `duplicateSelection` are reached only through `designerShortcut`, which offers
 * them for a detail or a clearance and for a detail respectively — so neither re-asks what it was
 * offered for. The selection clears itself after a delete: the refresh re-reads a shape without the
 * part, and the store prunes a selection that names nothing.
 */
export function selectionKeyActions(
	store: { readonly selection: DesignerSelection | null; select(next: DesignerSelection | null): void },
	editShape: EditShape,
): {
	readonly deleteSelection: () => Promise<void>;
	readonly duplicateSelection: () => Promise<void>;
	readonly nudgeSelection: (by: Vector) => Promise<void>;
} {
	return {
		deleteSelection: () => {
			const selection = store.selection;
			return notifyIfRefused(editShape((shape) => (selection?.kind === 'detail' ? deleteDetail(shape, selection.id) : removeClearance(shape))));
		},
		duplicateSelection: async () => {
			const { id } = store.selection as Extract<DesignerSelection, { readonly kind: 'detail' }>;
			let copy = '';
			const result = await editShape((shape) => {
				copy = nextDetailId(shape);
				return duplicateDetail(shape, id, { dx: DUPLICATE_OFFSET_MM, dy: DUPLICATE_OFFSET_MM });
			});
			// The refresh has landed by the time a dispatch resolves, so the copy exists to be selected.
			if (result.ok) store.select({ kind: 'detail', id: copy });
			await notifyIfRefused(Promise.resolve(result));
		},
		nudgeSelection: (by) => {
			const selection = store.selection;
			// A facing is a direction: a nudge has no meaning for it, and nothing is written.
			if (selection === null || selection.kind === 'facing') return Promise.resolve();
			return notifyIfRefused(
				editShape((shape) =>
					selection.kind === 'anchor'
						? moveAnchor(shape, { x: shape.anchor.x + by.dx, y: shape.anchor.y + by.dy })
						: moveOutline(shape, selection, by),
				),
			);
		},
	};
}
```

`src/presentation/designer/AssetDesignerRoot.vue`:

old:
```ts
import { provideDesignerRuntime } from './runtime';
import { isMissingAsset, useAssetDesignStore } from './stores/assetDesignStore';
```
new:
```ts
import { provideDesignerRuntime } from './runtime';
import { isMissingAsset, useAssetDesignStore } from './stores/assetDesignStore';
import { designerShortcut, selectionKeyActions } from './designerKeys';
```

old:
```ts
const { design, error, status, stale } = storeToRefs(useAssetDesignStore());
```
new:
```ts
const designStore = useAssetDesignStore();
const { design, error, status, stale } = storeToRefs(designStore);
```

old:
```ts
onMounted(() => {
	void runtime.hydrate();
});
```
new:
```ts
/**
 * Delete and Ctrl+D for the designer's selection (symbols spec, Decision 10), on the CANVAS region:
 * `EditorSurface` routes neither and lets both bubble from the canvas, while the inspector is a
 * sibling region, so a Backspace typed in one of its fields never reaches this listener.
 */
const keyActions = selectionKeyActions(designStore, runtime.editShape);
function onCanvasKeyDown(event: KeyboardEvent): void {
	designerShortcut(event, {
		selection: designStore.selection,
		deleteSelection: () => {
			void keyActions.deleteSelection();
		},
		duplicateSelection: () => {
			void keyActions.duplicateSelection();
		},
	});
}

onMounted(() => {
	void runtime.hydrate();
});
```

old:
```html
			<div class="rp-designer-canvas">
```
new:
```html
			<div
				class="rp-designer-canvas"
				@keydown="onCanvasKeyDown"
			>
```

`src/presentation/designer/DesignerCanvas.vue`:

old:
```ts
import DesignerGestureLayer from './layers/DesignerGestureLayer.vue';
```
new:
```ts
import DesignerGestureLayer from './layers/DesignerGestureLayer.vue';
import { selectionKeyActions } from './designerKeys';
```

old:
```ts
const { toolManager, renderState, setTool } = useDesignerRuntime();
```
new:
```ts
const { toolManager, renderState, setTool, editShape } = useDesignerRuntime();
```

old:
```ts
/**
 * E8's fix is scoped to the Plan Editor's Zones (Task 14) — this surface's own `selection`
 * never holds anything (see above), so there is nothing an arrow key here could ever move.
 * A named function rather than an inline template arrow: a bare `() => Promise.resolve()`
 * in the template reads `Promise` off the render context instead of the module scope.
 */
const nudgeSelection = (): Promise<void> => Promise.resolve();
```
new:
```ts
/**
 * An arrow key nudges the designer's selection (symbols spec, Decision 10) by `EditorSurface`'s own
 * `arrowVector` — 10 mm a press, 100 mm with Shift — as one conditional shape write per press: an
 * outline moves, the anchor moves, and a facing or no selection writes nothing.
 */
const { nudgeSelection } = selectionKeyActions(designStore, editShape);
```

`src/presentation/editor/surface/EditorSurface.vue` (comment only):

old:
```ts
	 * same reason `setTool` is — this file holds no `runtime.ts` — and the asset designer's
	 * own mounter passes a no-op: none of its tools ever populate `selection`, so there is
	 * never anything for it to move.
```
new:
```ts
	 * same reason `setTool` is — this file holds no `runtime.ts` — and the asset designer's
	 * own mounter moves its own selection, a part of one shape (`designer/designerKeys.ts`).
```

- [ ] **Step 4: Run them and watch them pass**

`npm run check:fast -- tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts tests/presentation/designer/designerEscapeRouting.test.ts tests/presentation/designer/assetDesignerRoot.test.ts tests/presentation/designer/layers.test.ts tests/presentation/editor`

Expected: all green. `tests/presentation/editor` is included because `EditorSurface.vue` was touched (comment only) and `keyboard.ts`'s `plainPress` gained a consumer.

- [ ] **Step 5: Lint**

`npx eslint src/presentation/designer/designerKeys.ts src/presentation/designer/AssetDesignerRoot.vue src/presentation/designer/DesignerCanvas.vue src/presentation/editor/surface/EditorSurface.vue tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts tests/presentation/designer/designerEscapeRouting.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/designerKeys.ts src/presentation/designer/AssetDesignerRoot.vue src/presentation/designer/DesignerCanvas.vue src/presentation/editor/surface/EditorSurface.vue tests/presentation/designer/designerKeys.test.ts tests/presentation/designer/designerKeyboard.test.ts tests/presentation/designer/designerEscapeRouting.test.ts
git commit -m "feat(designer): Delete, Ctrl+D and arrow keys for the selection

Delete removes a selected detail or clearance, Ctrl+D duplicates a detail
100 mm off and selects the copy, and the arrows nudge an outline or the
anchor 10 mm (Shift: 100 mm). Each is one conditional, undoable write.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

#### For Tasks 9–12 (facts these drafts create that the outline does not state)

- **`runtime.editShape` resolves `err` for BOTH a domain refusal and a dispatched one.** Route either with
  `notifyIfRefused(runtime.editShape(...))`: `reportDispatchFailure` sends a pre-write `Validation`
  refusal to a notice and a write-boundary one to the save indicator. The inspector (Task 9) should keep
  the raw `Result` for its `role="alert"` line and notify nothing itself.
- **`selectionKeyActions(store, editShape)` (`designerKeys.ts`) already implements delete, duplicate
  (select the copy) and nudge.** Task 9's Delete/Duplicate buttons should call it rather than re-spell
  `deleteDetail`/`nextDetailId`; its signature is in Task 8.
- **Shared test fixtures live in `tests/helpers/designerSelection.ts`**: `TOILET`, `detailOutline(id)`,
  `justInsideBottom(outline)`, `DESIGN_VERSION`, `selectToolRig(...)`. Reuse them rather than rebuilding
  the preset; a second copy is a fallow clone.
- **`DESIGNER_TOOL_LABELS` starts with `select`.** Task 10 inserts its three tools after
  `'trace-clearance'`; `designerToolbar.test.ts`'s exact list currently reads Pan, Select, Trace
  footprint, Trace clearance, Set anchor, Set facing, Calibrate, Undo, Redo.
- **`DrawPolygonToolDeps.onCompleted` is `() => void`**, so `trace-detail`'s "select the new detail"
  must close over the id computed when its command was built. `returnToSelect` is already in
  `DesignerToolDeps`.
- **The designer's snap candidates are no longer empty.** `DrawPolygonTool` calls
  `context.snapCandidates()` with no argument, so every trace (and Task 10's `trace-detail`) now snaps to
  footprint and detail vertices and the anchor within 8 screen px. No existing designer rig trace lands
  within 80 mm of a candidate other than an identical point (checked: `designerTools.test.ts`'s
  `TRIANGLE` on `TYPED` starts on the anchor it snaps to).
- **Seven layers, not six**: `asset-selection` sits between `asset-anchor` and `asset-gesture`. The
  order is pinned in BOTH `layers.test.ts` and `designerBackground.test.ts`.
- **`buildRuntime` is at 98/100 `max-lines-per-function` after Task 6.** Any further runtime member
  (Task 10's draw-tool deps) must be built in a module-level helper, as `selectToolDeps` is.
- **`designerRefresh.test.ts` registers a probe tool under an id the designer does not register**
  (now `'measure'`). Task 10 must not register `measure`, or pick another probe id in that edit.
- **Harness (Task 12):** the mode control exists only while Select is active AND an outline is
  selected; its radios are `.rp-designer-tool-button`s inside `.rp-designer-tools`, so
  `.rp-designer-selection-modes [aria-checked="true"]` is a valid capture selector. The designer still
  OPENS in camera mode, so the harness must press Select before calling `store.select`. The anchor and
  facing selections draw a ring (`VRect` with `cornerRadius`) named `asset-selection-handle`.
- **Manual case (Task 12) should check two things no gate can:** that Obsidian's own hotkeys do not take
  Ctrl+D or Delete before the canvas region's `keydown` listener sees them, and that Shift proportional
  resize / rotation snap are discoverable — `constrainsAngle` does not list `'select'`, so no Shift hint
  shows under Select.
- **For Task 4's drafter/controller:** an anchor body drag is `moveAnchor(anchor + (to − from))` with
  `to` snapped. If the press is not exactly on the anchor (anything within the 8 px grab radius), the
  snapped POINTER lands on the vertex and the anchor lands that press offset away from it. Tasks 5–8
  assert the snap only for a press exactly on the anchor. Snapping `anchor + (to − from)` instead would
  make the snap land the anchor itself.
- **`editShape`'s two runtime wiring lambdas are first called by Task 8's rig cases.** Task 6's commit
  covers `createEditShape` only, which the PR-level coverage gate accepts.

---

### Task 9: The inspector for the selection

**Files:**
- Create: `src/presentation/designer/inspector/DesignerSelectionInspector.vue`
- Create: `styles/designer-selection.css`
- Modify: `styles/index.css`
- Modify: `src/presentation/designer/inspector/DesignerInspector.vue`
- Modify: `src/presentation/designer/AssetDesignerRoot.vue`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`
- Test: `tests/presentation/designer/designerSelectionInspector.test.ts` (new)
- Test: `tests/presentation/designer/designerInspector.test.ts` (new required props, one new case)
- Test: `tests/harness/accessibilityDesignerSelection.test.ts` (new)

**Interfaces:**
- Consumes (Task 1, `src/domain/asset/shapeEdits.ts`): `export type OutlinePart = …`; `export function outlineOf(shape: AssetShape, part: OutlinePart): CurvedPolygon | null;` `export function moveOutline(shape: AssetShape, part: OutlinePart, by: Vector): Result<AssetShape, ValidationError>;` `export function resizeBox(shape: AssetShape, part: OutlinePart, factors: { readonly sx: number; readonly sy: number }, origin: Point): Result<AssetShape, ValidationError>;` `export function rotateOutline(shape: AssetShape, part: OutlinePart, radians: number, origin: Point): Result<AssetShape, ValidationError>;` `export function moveAnchor(shape: AssetShape, to: Point): Result<AssetShape, ValidationError>;` `export function setFacing(shape: AssetShape, radians: number): Result<AssetShape, ValidationError>;` `export function removeClearance(shape: AssetShape): Result<AssetShape, ValidationError>;`
- Consumes (Task 2, `src/domain/asset/detailEdits.ts`): `export function nextDetailId(shape: AssetShape): string;` `export function duplicateDetail(shape: AssetShape, id: string, offset: Vector): Result<AssetShape, ValidationError>;` `export function deleteDetail(shape: AssetShape, id: string): Result<AssetShape, ValidationError>;` `export function reorderDetail(shape: AssetShape, id: string, direction: 'forward' | 'backward'): Result<AssetShape, ValidationError>;` `export function updateDetail(shape: AssetShape, id: string, changes: { readonly name?: string; readonly line?: DetailLine }): Result<AssetShape, ValidationError>;` `export function fitFootprintToDetails(shape: AssetShape): Result<AssetShape, ValidationError>;` `export const DUPLICATE_OFFSET_MM = 100;`
- Consumes (Task 3): `export type DesignerSelection = OutlinePart | { readonly kind: 'anchor' } | { readonly kind: 'facing' };` `export function partKey(selection: DesignerSelection): string;` `export function selectionExists(shape: AssetShape | null, selection: DesignerSelection): boolean;` store `selection: Ref<DesignerSelection | null>`, `select(next: DesignerSelection | null): void`.
- Consumes (Task 6, `DesignerRuntime`): `readonly editShape: (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>`
- Produces: `DesignerInspector.vue` props `selection: DesignerSelection | null`, `editShape: (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>`, `select: (next: DesignerSelection | null) => void`. `DesignerSelectionInspector.vue` takes `design`, `selection` (non-null), `editShape`, `select`. No new TypeScript exports.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/designer/designerSelectionInspector.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The inspector for the selection (asset designer symbols spec, Presentation; Amendment 1).
 *
 * Mounted BARE with a fake `editShape` that applies the edit it is handed to the fixture, so every
 * case asserts the shape the control would write rather than which function it happened to name.
 * The last case mounts the real designer, because a component proven bare and bound to nothing is
 * the slice-7 shape this repository refuses.
 *
 * The fixture is the Toilet preset at its defaults: a 380 × 700 round-fronted footprint, detail-1
 * the tank, detail-2 the bowl (a stadium whose curve-aware box is 304 × 450 centred on (0, 100),
 * corner points (±152, 27) and (±152, 173), bulges [1, 0, 1, 0]), anchor at the origin, facing π/2.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerSelectionInspector from '../../../src/presentation/designer/inspector/DesignerSelectionInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { Point } from '../../../src/core/geometry/Point';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import {
	deleteDetail,
	fitFootprintToDetails,
	reorderDetail,
	updateDetail,
} from '../../../src/domain/asset/detailEdits';
import { moveAnchor, removeClearance, setFacing } from '../../../src/domain/asset/shapeEdits';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';

type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

const toiletPreset = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
if (toiletPreset === undefined) throw new Error('the catalogue has a toilet');
const TOILET = expectOk(toiletPreset.build(defaultValues(toiletPreset)));

const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };

function mountFor(selection: DesignerSelection, shape: AssetShape | null = TOILET, answer?: DispatchResult) {
	const applied: Result<AssetShape, ValidationError>[] = [];
	const editShape = vi.fn((edit: ShapeEdit): Promise<DispatchResult> => {
		// Only reached for a mounted section, which exists only over a shape.
		const result = edit(shape as AssetShape);
		applied.push(result);
		return Promise.resolve(answer ?? (result.ok ? ok('wrote') : err(result.error)));
	});
	const select = vi.fn<(next: DesignerSelection | null) => void>();
	const wrapper = mount(DesignerSelectionInspector, {
		props: { design: assetDesign({ shape }), selection, editShape, select },
	});
	return { wrapper, editShape, select, applied };
}

async function change(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const control = wrapper.find(`[name="${name}"]`);
	(control.element as HTMLInputElement | HTMLSelectElement).value = value;
	await control.trigger('change');
	await flushPromises();
}

function numberFields(wrapper: VueWrapper): Record<string, string> {
	return Object.fromEntries(
		wrapper.findAll('input[type="number"]').map((input) => [input.attributes('name'), (input.element as HTMLInputElement).value]),
	);
}

function buttons(wrapper: VueWrapper): (string | undefined)[] {
	return wrapper.findAll('button').map((button) => button.attributes('name'));
}

function outlineOfDetail(result: Result<AssetShape, ValidationError> | undefined, id: string) {
	if (result === undefined) throw new Error('no edit was applied');
	const found = expectOk(result).details.find((detail) => detail.id === id);
	if (found === undefined) throw new Error(`no detail ${id} in the applied shape`);
	return found.outline;
}

function expectNear(points: readonly Point[], expected: readonly (readonly [number, number])[]): void {
	expect(points).toHaveLength(expected.length);
	points.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index][0], 6);
		expect(point.y).toBeCloseTo(expected[index][1], 6);
	});
}

describe('what the inspector offers for each kind of part', () => {
	it('draws a detail’s name, line, centre, size and rotation, with its four actions', () => {
		const { wrapper } = mountFor(BOWL);

		expect(wrapper.find('h3').text()).toBe(t('en', 'designer.selection.detail'));
		expect((wrapper.find('[name="detail-name"]').element as HTMLInputElement).value).toBe('bowl');
		expect((wrapper.find('[name="detail-line"]').element as HTMLSelectElement).value).toBe('solid');
		expect(numberFields(wrapper)).toEqual({ 'centre-x': '0', 'centre-y': '100', width: '304', depth: '450', 'rotate-by': '0' });
		expect(buttons(wrapper)).toEqual(['bring-forward', 'send-backward', 'duplicate', 'delete']);
	});

	it('draws the footprint’s size and Fit to details, and nothing a detail has', () => {
		const { wrapper } = mountFor({ kind: 'footprint' });

		expect(wrapper.find('h3').text()).toBe(t('en', 'designer.selection.footprint'));
		expect(numberFields(wrapper)).toEqual({ width: '380', depth: '700' });
		expect(buttons(wrapper)).toEqual(['fit-to-details']);
		expect(wrapper.find('[name="detail-name"]').exists()).toBe(false);
	});

	it('offers no Fit to details on a design that has no details', () => {
		const { wrapper } = mountFor({ kind: 'footprint' }, { ...TOILET, details: [] });

		expect(buttons(wrapper)).toEqual([]);
	});

	it('draws only Delete for the clearance', () => {
		const { wrapper } = mountFor({ kind: 'clearance' });

		expect(numberFields(wrapper)).toEqual({});
		expect(buttons(wrapper)).toEqual(['delete']);
	});

	it('draws the anchor’s position and the facing’s angle in whole degrees', () => {
		expect(numberFields(mountFor({ kind: 'anchor' }).wrapper)).toEqual({ 'position-x': '0', 'position-y': '0' });
		expect(numberFields(mountFor({ kind: 'facing' }).wrapper)).toEqual({ angle: '90' });
	});

	/** PBI extension 2a: no control for a part the asset does not carry. */
	it('draws nothing for a part the shape lacks', () => {
		expect(mountFor({ kind: 'detail', id: 'detail-9' }).wrapper.find('.rp-designer-selection').exists()).toBe(false);
		expect(mountFor({ kind: 'clearance' }, { ...TOILET, clearance: null }).wrapper.find('.rp-designer-selection').exists()).toBe(false);
		expect(mountFor({ kind: 'footprint' }, null).wrapper.find('.rp-designer-selection').exists()).toBe(false);
	});
});

describe('what a field commits', () => {
	it.each([
		['centre-x', '50', [[-102, 27], [202, 27], [202, 173], [-102, 173]]],
		['centre-y', '150', [[-152, 77], [152, 77], [152, 223], [-152, 223]]],
		['width', '608', [[-304, 27], [304, 27], [304, 173], [-304, 173]]],
		['depth', '900', [[-152, -46], [152, -46], [152, 246], [-152, 246]]],
	] as const)('commits %s = %s as ONE edit about the bowl’s box, keeping its rounded ends', async (name, value, expected) => {
		const { wrapper, editShape, applied } = mountFor(BOWL);

		await change(wrapper, name, value);

		expect(editShape).toHaveBeenCalledTimes(1);
		const outline = outlineOfDetail(applied[0], 'detail-2');
		expectNear(outline.points, expected);
		expect(outline.bulges).toEqual([1, 0, 1, 0]);
	});

	it('rotates by the degrees typed about the box centre, then resets the field to 0', async () => {
		const { wrapper, applied } = mountFor(BOWL);

		await change(wrapper, 'rotate-by', '90');

		expectNear(outlineOfDetail(applied[0], 'detail-2').points, [[73, -52], [73, 252], [-73, 252], [-73, -52]]);
		expect((wrapper.find('[name="rotate-by"]').element as HTMLInputElement).value).toBe('0');
	});

	it.each([
		['position-x', '50', moveAnchor(TOILET, { x: 50, y: 0 })],
		['position-y', '-20', moveAnchor(TOILET, { x: 0, y: -20 })],
	] as const)('moves the anchor through %s', async (name, value, expected) => {
		const { wrapper, applied } = mountFor({ kind: 'anchor' });

		await change(wrapper, name, value);

		expect(applied).toEqual([expected]);
	});

	it('sets the facing from degrees', async () => {
		const { wrapper, applied } = mountFor({ kind: 'facing' });

		await change(wrapper, 'angle', '180');

		expect(applied).toEqual([setFacing(TOILET, Math.PI)]);
	});

	it('renames a detail and changes its line through updateDetail', async () => {
		const { wrapper, applied } = mountFor(BOWL);

		await change(wrapper, 'detail-name', 'seat');
		await change(wrapper, 'detail-line', 'dashed');

		expect(applied).toEqual([
			updateDetail(TOILET, 'detail-2', { name: 'seat' }),
			updateDetail(TOILET, 'detail-2', { line: 'dashed' }),
		]);
	});

	it('commits nothing for a field emptied and left', async () => {
		const { wrapper, editShape } = mountFor(BOWL);

		await change(wrapper, 'width', '');

		expect(editShape).not.toHaveBeenCalled();
	});

	it('shows a refusal in one alert, and clears it with the next commit that lands', async () => {
		const { wrapper } = mountFor(BOWL);

		await change(wrapper, 'width', '0');
		expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.invalid-scale'));

		await change(wrapper, 'width', '608');
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
	});
});

describe('what an action commits', () => {
	it('disables Bring forward on the topmost detail and Send backward on the bottom one', () => {
		const top = mountFor(BOWL).wrapper;
		const bottom = mountFor({ kind: 'detail', id: 'detail-1' }).wrapper;

		expect((top.find('[name="bring-forward"]').element as HTMLButtonElement).disabled).toBe(true);
		expect((top.find('[name="send-backward"]').element as HTMLButtonElement).disabled).toBe(false);
		expect((bottom.find('[name="bring-forward"]').element as HTMLButtonElement).disabled).toBe(false);
		expect((bottom.find('[name="send-backward"]').element as HTMLButtonElement).disabled).toBe(true);
	});

	it.each([
		['send-backward', BOWL, reorderDetail(TOILET, 'detail-2', 'backward')],
		['bring-forward', { kind: 'detail', id: 'detail-1' }, reorderDetail(TOILET, 'detail-1', 'forward')],
		['delete', BOWL, deleteDetail(TOILET, 'detail-2')],
		['delete', { kind: 'clearance' }, removeClearance(TOILET)],
		['fit-to-details', { kind: 'footprint' }, fitFootprintToDetails(TOILET)],
	] as const)('commits %s on %o', async (name, selection, expected) => {
		const { wrapper, applied } = mountFor(selection);

		await wrapper.find(`[name="${name}"]`).trigger('click');
		await flushPromises();

		expect(applied).toEqual([expected]);
	});

	it('duplicates a detail directly above it and selects the copy', async () => {
		const { wrapper, applied, select } = mountFor(BOWL);

		await wrapper.find('[name="duplicate"]').trigger('click');
		await flushPromises();

		expect(expectOk(applied[0]).details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(select).toHaveBeenCalledWith({ kind: 'detail', id: 'detail-3' });
	});

	it('selects nothing when the duplicate is refused, and says why', async () => {
		const refusal = err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } as const);
		const { wrapper, select } = mountFor(BOWL, TOILET, refusal);

		await wrapper.find('[name="duplicate"]').trigger('click');
		await flushPromises();

		expect(select).not.toHaveBeenCalled();
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
	});
});

describe('the inspector in the mounted designer', () => {
	it('writes a typed width through the leaf as one undoable write', async () => {
		const rig = await designerRig({ shape: TOILET });
		useAssetDesignStore(rig.pinia).select(BOWL);
		await settle();

		const input = rig.wrapper.find('.rp-designer-selection [name="width"]');
		(input.element as HTMLInputElement).value = '608';
		await input.trigger('change');
		await settle();

		const bowl = (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-2');
		expectNear(bowl?.outline.points ?? [], [[-304, 27], [304, 27], [304, 173], [-304, 173]]);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(false);
		rig.unmount();
	});
});
```

Edit `tests/presentation/designer/designerInspector.test.ts`:

old:
```ts
import { assetDesign } from '../../helpers/assetDesign';
import { t } from '../../../src/presentation/i18n/strings';
```
new:
```ts
import { assetDesign } from '../../helpers/assetDesign';
import { t } from '../../../src/presentation/i18n/strings';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
```

old:
```ts
function mountInspector(options: Parameters<typeof buildDesign>[0] = {}) {
	return mount(DesignerInspector, {
		props: {
			design: buildDesign(options),
			setHeight,
			editDimensions,
			startFromPreset,
			logger: recorder,
		},
	});
}
```
new:
```ts
function mountInspector(options: Parameters<typeof buildDesign>[0] = {}, selection: DesignerSelection | null = null) {
	return mount(DesignerInspector, {
		props: {
			design: buildDesign(options),
			setHeight,
			editDimensions,
			startFromPreset,
			logger: recorder,
			selection,
			// Never called by these cases: `designerSelectionInspector.test.ts` owns what a selection commits.
			editShape: vi.fn<() => Promise<DispatchResult>>().mockResolvedValue(ok('no-write')),
			select: vi.fn<(next: DesignerSelection | null) => void>(),
		},
	});
}
```

old:
```ts
	it('draws no dimensions block at all for a shapeless asset', () => {
```
new:
```ts
	it('draws a section for the selected part only while something is selected', () => {
		expect(mountInspector().find('.rp-designer-selection').exists()).toBe(false);
		expect(mountInspector({}, { kind: 'footprint' }).find('.rp-designer-selection').exists()).toBe(true);
	});

	it('draws no dimensions block at all for a shapeless asset', () => {
```

Create `tests/harness/accessibilityDesignerSelection.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The asset designer with a detail selected — its inspector section, the refusal alert's home and
 * the mode control — scanned under the ceiling `accessibility.test.ts`'s header states;
 * `runOptions` is shared through `./axeOptions`. Mounted through `designerRig`, the real designer,
 * so the scan grades the markup a user gets rather than a fixture.
 */
import axe from 'axe-core';
import { expect, it } from 'vitest';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';
import { ASSET_PRESETS } from '../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../src/domain/asset/presets/presetGeometry';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import { expectOk } from '../helpers/domain';
import { settle } from '../helpers/editor';
import { designerRig } from '../helpers/designerRig';

it('reports no violations for the designer with a detail selected', { timeout: HARNESS_SCAN_MS }, async () => {
	const toilet = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
	if (toilet === undefined) throw new Error('the catalogue has a toilet');
	const rig = await designerRig({ shape: expectOk(toilet.build(defaultValues(toilet))) });
	try {
		useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-2' });
		await settle();

		expect(rig.wrapper.find('.rp-designer-selection [name="detail-name"]').exists()).toBe(true);
		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

		expect(results.violations).toEqual([]);
	} finally {
		rig.unmount();
	}
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run check:fast -- tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts
```

Expected: `vue-tsc` fails first — `Cannot find module '../../../src/presentation/designer/inspector/DesignerSelectionInspector.vue'`, `'selection' does not exist in type` for `DesignerInspector`'s props, and `Argument of type '"designer.selection.detail"' is not assignable to parameter of type 'StringKey'`. With types ignored, vitest fails `designerSelectionInspector.test.ts` on the missing module, `designerInspector.test.ts`'s new case on `.rp-designer-selection` not existing, and the axe case on `[name="detail-name"]` not existing.

- [ ] **Step 3: Implement**

Create `src/presentation/designer/inspector/DesignerSelectionInspector.vue`:

```vue
<script setup lang="ts">
/**
 * The inspector for ONE selected part (asset designer symbols spec, "Inspector for the selection",
 * and Amendment 1): a detail's name, line, centre, size and a rotate-by field, with ordering,
 * duplicate and delete; the footprint's size and Fit to details; the clearance's delete; the
 * anchor's position; the facing's angle.
 *
 * **Every control is one `editShape` call over a pure domain edit**, so a field, a button and a
 * canvas gesture reach the vault through the same `SetAssetShape` door with the same `expected`
 * version (Decision 10). It holds no store and dispatches nothing itself — `DesignerInspector`
 * hands it the design, the selection and the two doors — which is what lets its test mount it bare.
 *
 * Numbers show whole millimetres and whole degrees and commit on `change` (blur or Enter). A refusal
 * `editShape` answers is shown in ONE alert and cleared by the next commit that lands. Rotate-by
 * applies and resets to 0: a detail stores no rotation to show.
 *
 * A part the shape lacks renders nothing (PBI extension 2a). The store prunes such a selection on
 * its next read; this guard covers the frame between the two.
 */
import { computed, ref } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap, type Result } from '../../../core/result/Result';
import type { DetailLine } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import {
	deleteDetail,
	duplicateDetail,
	DUPLICATE_OFFSET_MM,
	fitFootprintToDetails,
	nextDetailId,
	reorderDetail,
	updateDetail,
} from '../../../domain/asset/detailEdits';
import {
	moveAnchor,
	moveOutline,
	outlineOf,
	removeClearance,
	resizeBox,
	rotateOutline,
	setFacing,
	type OutlinePart,
} from '../../../domain/asset/shapeEdits';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { selectionExists, type DesignerSelection } from '../selection/designerSelection';

type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

const props = defineProps<{
	design: AssetDesignDto;
	selection: DesignerSelection;
	editShape: (edit: ShapeEdit) => Promise<DispatchResult>;
	select: (next: DesignerSelection | null) => void;
}>();

interface NumberField {
	readonly name: string;
	readonly label: StringKey;
	readonly value: number;
	readonly edit: (value: number) => ShapeEdit;
	readonly resets?: true;
}

interface Action {
	readonly name: string;
	readonly label: StringKey;
	readonly disabled: boolean;
	readonly run: () => void;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const exists = computed(() => selectionExists(props.design.shape, props.selection));
/** Read only inside the `exists` guard, which answers false for a shapeless design — hence the cast. */
const shape = computed(() => props.design.shape as AssetShape);
const refusal = ref<AppError | null>(null);

/** One write; the refusal it answers is shown, and a write that lands clears the last one. */
async function commit(edit: ShapeEdit): Promise<boolean> {
	const result = await props.editShape(edit);
	refusal.value = result.ok ? null : result.error;
	return result.ok;
}

/** The part's curve-aware box. `outlineOf` answers an outline here because `exists` holds. */
function boxOf(part: OutlinePart): { readonly centre: Point; readonly width: number; readonly depth: number } {
	const box = unwrap(boundingBoxOf(outlineOf(shape.value, part) as CurvedPolygon));
	return {
		centre: { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 },
		width: box.max.x - box.min.x,
		depth: box.max.y - box.min.y,
	};
}

function sizeFields(part: OutlinePart): NumberField[] {
	const { centre, width, depth } = boxOf(part);
	return [
		{ name: 'width', label: 'designer.preset.field.width', value: width, edit: (value) => (current) => resizeBox(current, part, { sx: value / width, sy: 1 }, centre) },
		{ name: 'depth', label: 'designer.preset.field.depth', value: depth, edit: (value) => (current) => resizeBox(current, part, { sx: 1, sy: value / depth }, centre) },
	];
}

function detailFields(part: OutlinePart): NumberField[] {
	const { centre } = boxOf(part);
	return [
		{ name: 'centre-x', label: 'designer.selection.centre-x', value: centre.x, edit: (value) => (current) => moveOutline(current, part, { dx: value - centre.x, dy: 0 }) },
		{ name: 'centre-y', label: 'designer.selection.centre-y', value: centre.y, edit: (value) => (current) => moveOutline(current, part, { dx: 0, dy: value - centre.y }) },
		...sizeFields(part),
		{ name: 'rotate-by', label: 'designer.selection.rotate-by', value: 0, edit: (value) => (current) => rotateOutline(current, part, radians(value), centre), resets: true },
	];
}

function anchorFields(): NumberField[] {
	const { x, y } = shape.value.anchor;
	return [
		{ name: 'position-x', label: 'designer.selection.position-x', value: x, edit: (value) => (current) => moveAnchor(current, { x: value, y }) },
		{ name: 'position-y', label: 'designer.selection.position-y', value: y, edit: (value) => (current) => moveAnchor(current, { x, y: value }) },
	];
}

const fields = computed((): readonly NumberField[] => {
	const selection = props.selection;
	switch (selection.kind) {
		case 'detail':
			return detailFields(selection);
		case 'footprint':
			return sizeFields(selection);
		case 'clearance':
			return [];
		case 'anchor':
			return anchorFields();
		case 'facing':
			return [{ name: 'angle', label: 'designer.selection.angle', value: (shape.value.facing * 180) / Math.PI, edit: (value) => (current) => setFacing(current, radians(value)) }];
	}
});

/** The selected detail as a one-item list, so the template's closures see it without a narrowing to lose. */
const selectedDetails = computed(() =>
	shape.value.details.filter((item) => props.selection.kind === 'detail' && item.id === props.selection.id),
);

async function duplicate(id: string): Promise<void> {
	const copy = nextDetailId(shape.value);
	if (await commit((current) => duplicateDetail(current, id, { dx: DUPLICATE_OFFSET_MM, dy: DUPLICATE_OFFSET_MM }))) {
		props.select({ kind: 'detail', id: copy });
	}
}

function detailActions(id: string): Action[] {
	const details = shape.value.details;
	const index = details.findIndex((item) => item.id === id);
	return [
		{ name: 'bring-forward', label: 'designer.selection.bring-forward', disabled: index === details.length - 1, run: () => void commit((current) => reorderDetail(current, id, 'forward')) },
		{ name: 'send-backward', label: 'designer.selection.send-backward', disabled: index === 0, run: () => void commit((current) => reorderDetail(current, id, 'backward')) },
		{ name: 'duplicate', label: 'designer.selection.duplicate', disabled: false, run: () => void duplicate(id) },
		{ name: 'delete', label: 'designer.selection.delete', disabled: false, run: () => void commit((current) => deleteDetail(current, id)) },
	];
}

const actions = computed((): readonly Action[] => {
	const selection = props.selection;
	if (selection.kind === 'detail') return detailActions(selection.id);
	if (selection.kind === 'footprint') {
		return shape.value.details.length > 0
			? [{ name: 'fit-to-details', label: 'designer.selection.fit-to-details', disabled: false, run: () => void commit(fitFootprintToDetails) }]
			: [];
	}
	if (selection.kind === 'clearance') {
		return [{ name: 'delete', label: 'designer.selection.delete', disabled: false, run: () => void commit(removeClearance) }];
	}
	return [];
});

function onName(id: string, event: Event): void {
	const name = (event.target as HTMLInputElement).value;
	void commit((current) => updateDetail(current, id, { name }));
}

function onLine(id: string, event: Event): void {
	const line = (event.target as HTMLSelectElement).value as DetailLine;
	void commit((current) => updateDetail(current, id, { line }));
}

/** An emptied field commits nothing; `Number('')` would otherwise write a zero nobody typed. */
async function onNumber(field: NumberField, event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const value = input.value.trim() === '' ? Number.NaN : Number(input.value);
	if (!Number.isFinite(value)) return;
	if ((await commit(field.edit(value))) && field.resets === true) input.value = '0';
}
</script>

<template>
	<section
		v-if="exists"
		class="rp-designer-selection"
		:data-kind="selection.kind"
	>
		<h3 class="rp-designer-panel-title">
			{{ tr(`designer.selection.${selection.kind}`) }}
		</h3>
		<template
			v-for="item in selectedDetails"
			:key="item.id"
		>
			<label class="rp-designer-field">
				{{ tr('designer.selection.name') }}
				<input
					type="text"
					name="detail-name"
					:value="item.name"
					@change="onName(item.id, $event)"
				>
			</label>
			<label class="rp-designer-field">
				{{ tr('designer.selection.line') }}
				<select
					name="detail-line"
					:value="item.line"
					@change="onLine(item.id, $event)"
				>
					<option value="solid">
						{{ tr('designer.selection.line.solid') }}
					</option>
					<option value="dashed">
						{{ tr('designer.selection.line.dashed') }}
					</option>
				</select>
			</label>
		</template>
		<label
			v-for="field in fields"
			:key="field.name"
			class="rp-designer-field"
		>
			{{ tr(field.label) }}
			<input
				type="number"
				:name="field.name"
				step="any"
				inputmode="decimal"
				:value="Math.round(field.value)"
				@change="(event: Event) => void onNumber(field, event)"
			>
		</label>
		<div
			v-if="actions.length > 0"
			class="rp-designer-selection-actions"
		>
			<button
				v-for="action in actions"
				:key="action.name"
				type="button"
				class="rp-designer-selection-button"
				:name="action.name"
				:disabled="action.disabled"
				@click="action.run()"
			>
				{{ tr(action.label) }}
			</button>
		</div>
		<p
			v-if="refusal !== null"
			role="alert"
			class="rp-designer-selection-error"
		>
			{{ trError(refusal) }}
		</p>
	</section>
</template>
```

Create `styles/designer-selection.css`:

```css
/*
 * The asset designer inspector's section for the selected part (asset designer symbols spec,
 * "Inspector for the selection"). Its own partial because `designer.css` sits within a few lines of
 * the assembler's 400-line cap. Obsidian variables only, no colour literal (SDD §84).
 */

.rp-designer-selection {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
	margin: 0 0 var(--size-4-4);
	padding-bottom: var(--size-4-2);
	border-bottom: 1px solid var(--background-modifier-border);
}

.rp-designer-selection-actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
}

/*
 * Qualified with `.rp-designer-inspector`: Obsidian's `button:not(.clickable-icon)` scores (0,1,1)
 * and beats a bare class (`tests/build/buttonSpecificity.test.ts`).
 * REVIEWED CLONE: the flat bordered button is written once per component by necessity — the
 * argument is on `.rp-designer-tool-button` in `designer.css`.
 */
.rp-designer-inspector .rp-designer-selection-button {
	/* fallow-ignore-next-line code-duplication */
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-small);
	color: var(--text-normal);
	background-color: transparent;
	box-shadow: none;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	cursor: pointer;
}

.rp-designer-inspector .rp-designer-selection-button:hover {
	background-color: var(--background-modifier-hover);
}

/* The ring, for the reason `designer.css`'s toolbar `:focus-visible` comment gives. */
.rp-designer-inspector .rp-designer-selection-button:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

.rp-designer-inspector .rp-designer-selection-button:disabled {
	color: var(--text-faint);
	background-color: transparent;
	cursor: default;
}

/* A refused edit: the design is unchanged, so this is an error about the typed value, not a warning. */
.rp-designer-selection-error {
	margin: 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-error);
}
```

Edit `styles/index.css`:

old:
```css
@import "./designer.css";
```
new:
```css
@import "./designer.css";
@import "./designer-selection.css";
```

Edit `src/presentation/designer/inspector/DesignerInspector.vue` (script):

old:
```ts
import { ok } from '../../../core/result/Result';
```
new:
```ts
import { ok, type Result } from '../../../core/result/Result';
import type { ValidationError } from '../../../core/errors/AppError';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { partKey, type DesignerSelection } from '../selection/designerSelection';
import DesignerSelectionInspector from './DesignerSelectionInspector.vue';
```

old:
```ts
	startFromPreset: () => Promise<void>;
	logger: Logger;
}>();
```
new:
```ts
	startFromPreset: () => Promise<void>;
	logger: Logger;
	/** The part the canvas has selected, `null` for none; its section is keyed by part, so choosing another starts it fresh. */
	selection: DesignerSelection | null;
	editShape: (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>;
	select: (next: DesignerSelection | null) => void;
}>();
```

Edit the template:

old:
```html
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.inspector') }}
		</h2>
```
new:
```html
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.inspector') }}
		</h2>
		<DesignerSelectionInspector
			v-if="selection !== null"
			:key="partKey(selection)"
			:design="design"
			:selection="selection"
			:edit-shape="editShape"
			:select="select"
		/>
```

Edit `src/presentation/designer/AssetDesignerRoot.vue`. Script — find the line that reads the design store (today the one below; if Task 8 already holds the store in a `const`, add `selection` to that destructure and reuse the const instead of adding a second):

old:
```ts
const { design, error, status, stale } = storeToRefs(useAssetDesignStore());
```
new:
```ts
const designStore = useAssetDesignStore();
const { design, error, status, stale, selection } = storeToRefs(designStore);
```

Template:

old:
```html
					:start-from-preset="startFromPreset"
					:logger="context.logger"
				/>
```
new:
```html
					:start-from-preset="startFromPreset"
					:logger="context.logger"
					:selection="selection"
					:edit-shape="runtime.editShape"
					:select="designStore.select"
				/>
```

Edit `src/presentation/i18n/locales/en/assetSymbols.ts`:

old:
```ts
	'designer.preset.field.pillows': 'Pillows',
```
new:
```ts
	'designer.preset.field.pillows': 'Pillows',
	'designer.selection.detail': 'Detail',
	'designer.selection.footprint': 'Footprint',
	'designer.selection.clearance': 'Clearance',
	'designer.selection.anchor': 'Anchor',
	'designer.selection.facing': 'Facing',
	'designer.selection.name': 'Name',
	'designer.selection.line': 'Line',
	'designer.selection.line.solid': 'Solid',
	'designer.selection.line.dashed': 'Dashed',
	'designer.selection.centre-x': 'Centre x in millimetres',
	'designer.selection.centre-y': 'Centre y in millimetres',
	'designer.selection.rotate-by': 'Rotation to apply in degrees',
	'designer.selection.position-x': 'Position x in millimetres',
	'designer.selection.position-y': 'Position y in millimetres',
	'designer.selection.angle': 'Angle in degrees',
	'designer.selection.bring-forward': 'Bring forward',
	'designer.selection.send-backward': 'Send backward',
	'designer.selection.duplicate': 'Duplicate',
	'designer.selection.delete': 'Delete',
	'designer.selection.fit-to-details': 'Fit to details',
```

Edit `src/presentation/i18n/locales/de/assetSymbols.ts`:

old:
```ts
	'designer.preset.field.pillows': 'Kissen',
```
new:
```ts
	'designer.preset.field.pillows': 'Kissen',
	'designer.selection.detail': 'Detail',
	'designer.selection.footprint': 'Umriss',
	'designer.selection.clearance': 'Freiraum',
	'designer.selection.anchor': 'Ankerpunkt',
	'designer.selection.facing': 'Ausrichtung',
	'designer.selection.name': 'Name',
	'designer.selection.line': 'Linie',
	'designer.selection.line.solid': 'Durchgezogen',
	'designer.selection.line.dashed': 'Gestrichelt',
	'designer.selection.centre-x': 'Mitte x in Millimetern',
	'designer.selection.centre-y': 'Mitte y in Millimetern',
	'designer.selection.rotate-by': 'Drehung in Grad',
	'designer.selection.position-x': 'Position x in Millimetern',
	'designer.selection.position-y': 'Position y in Millimetern',
	'designer.selection.angle': 'Winkel in Grad',
	'designer.selection.bring-forward': 'Nach vorne',
	'designer.selection.send-backward': 'Nach hinten',
	'designer.selection.duplicate': 'Duplizieren',
	'designer.selection.delete': 'Löschen',
	'designer.selection.fit-to-details': 'An Details anpassen',
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npm run check:fast -- tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts tests/presentation/designer/regionsReachable.test.ts tests/presentation/designer/assetDimensions.test.ts tests/build/libraryComponentStyles.test.ts tests/build/buttonSpecificity.test.ts tests/build/styles.test.ts
```

Expected: oxlint clean, `vue-tsc` clean, every case green. `regionsReachable` stays green because `DesignerSelectionInspector.vue` is imported by `DesignerInspector.vue`; `libraryComponentStyles` finds every new class (`rp-designer-selection`, `-actions`, `-button`, `-error`) declared in the assembled sheet; `buttonSpecificity` accepts the (0,2,0) button rule. If a case times out, re-run with `--testTimeout=20000` before believing it.

- [ ] **Step 5: Lint**

```bash
npx eslint src/presentation/designer/inspector/DesignerSelectionInspector.vue src/presentation/designer/inspector/DesignerInspector.vue src/presentation/designer/AssetDesignerRoot.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts
npx fallow dupes
```

Expected: no ESLint finding (sentence case on the new English strings, `max-lines` on both `.vue` files). `fallow dupes` reports no new group; if it reports `designer-selection.css` against `designer.css` at a line other than `padding`, move the `fallow-ignore-next-line code-duplication` directive to sit directly above the line it names and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/inspector/DesignerSelectionInspector.vue src/presentation/designer/inspector/DesignerInspector.vue src/presentation/designer/AssetDesignerRoot.vue styles/designer-selection.css styles/index.css src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/designerSelectionInspector.test.ts tests/presentation/designer/designerInspector.test.ts tests/harness/accessibilityDesignerSelection.test.ts
git commit -m "feat(designer): an inspector section for the selected part

A detail shows its name, line, centre, size and a rotate-by field with bring
forward, send backward, duplicate and delete; the footprint its size and Fit to
details; the clearance a delete; the anchor its position; the facing its angle.
Every control is one editShape write, and a refusal is shown in one alert.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 10: Drawing tools for details

**Files:**
- Create: `src/presentation/designer/tools/draw-detail-tool.ts`
- Modify: `src/presentation/designer/tools/registerDesignerTools.ts`
- Modify: `src/presentation/designer/runtime.ts`
- Modify: `src/presentation/editor/tools/editor-tool.ts`
- Modify: `src/presentation/editor/snapping/editorSnapping.ts`
- Modify: `src/presentation/designer/layers/DesignerGestureLayer.vue`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`
- Test: `tests/presentation/designer/tools/drawDetailTool.test.ts` (new, unit)
- Test: `tests/presentation/designer/designerDrawDetails.test.ts` (new, rig)
- Test: `tests/presentation/designer/designerToolbar.test.ts` (exact list, updated deliberately)

**Interfaces:**
- Consumes (Task 2): `export interface NewDetail { readonly name: string; readonly outline: CurvedPolygon; readonly line: DetailLine; readonly pending: boolean }` `export function nextDetailId(shape: AssetShape): string;` `export function addDetail(shape: AssetShape, detail: NewDetail): Result<AssetShape, ValidationError>;` `export function captureAwaitsScale(calibrated: boolean, hasBackground: boolean, shape: AssetShape | null): boolean;`
- Consumes (presets): `rect(width, depth, cx, cy)`, `circle(diameter, cx, cy)` from `src/domain/asset/presets/presetGeometry.ts`.
- Consumes (Task 6): `DesignerToolDeps.selectTool: DesignerSelectToolDeps` (`design()`, `createCommand(shape, expected)`, `select(next)`), `DesignerToolDeps.returnToSelect: () => void`, `DESIGNER_TOOL_LABELS` = select, trace-footprint, trace-clearance, set-anchor, set-facing, calibrate.
- Produces:
```ts
export interface DrawDetailToolDeps {
  readonly id: ToolId;                                           // 'draw-rect' | 'draw-circle'
  readonly outlineFor: (from: Point, to: Point) => CurvedPolygon | null; // null = no area
  /** Build the write for a completed outline: a domain refusal, or the command plus the id the new detail will have. */
  readonly commandFor: (outline: CurvedPolygon) => Result<{ readonly command: UndoableCommand; readonly detailId: string }, ValidationError>;
  readonly reportRejected: (error: AppError) => void;
  readonly reportInvalidInput: (error: AppError) => void;
  /** After a successful write: select the new detail and return to Select. */
  readonly onCompleted: (detailId: string) => void;
}
export class DrawDetailTool implements EditorTool { … }
export const rectOutline: (from: Point, to: Point) => CurvedPolygon | null;
export const circleOutline: (centre: Point, rim: Point) => CurvedPolygon | null;
```
- Produces (widened contracts): `ToolId` gains `'draw-rect' | 'draw-circle' | 'trace-detail'`; `DESIGNER_TOOL_LABELS` order select, trace-footprint, trace-clearance, draw-rect, draw-circle, trace-detail, set-anchor, set-facing, calibrate; `DesignerToolDeps` gains `readonly detailPending: (shape: AssetShape) => boolean` (see the OUTLINE CONFLICT note at the top).

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/designer/tools/drawDetailTool.test.ts`:

```ts
/**
 * `DrawDetailTool` and its two outline builders, driven DIRECTLY — the guards, the preview, the
 * three report doors and a write that lands after the tool was switched away, none of which the
 * mounted designer can discriminate. `designerDrawDetails.test.ts` drives the registered tools
 * through the real toolbar and canvas and asserts what reached the sidecar.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../../src/core/result/Result';
import type { AppError, ValidationError } from '../../../../src/core/errors/AppError';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../../src/core/geometry/curvePolyline';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import {
	circleOutline,
	DrawDetailTool,
	rectOutline,
	type DrawDetailToolDeps,
} from '../../../../src/presentation/designer/tools/draw-detail-tool';
import { flushGesture, pointerAt, toolContext, type ToolContextOptions } from '../../../helpers/tool-context';

const COMMAND: UndoableCommand = {
	execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
	undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
};
const REFUSAL: ValidationError = { category: 'Validation', code: 'asset.degenerate-detail', message: 'x' };
const QUARTER = Math.tan(Math.PI / 8);

function rig(options: ToolContextOptions = {}, overrides: Partial<DrawDetailToolDeps> = {}) {
	const harness = toolContext(options);
	const outlines: CurvedPolygon[] = [];
	const completed: string[] = [];
	const rejected: AppError[] = [];
	const invalid: AppError[] = [];
	const tool = new DrawDetailTool({
		id: 'draw-rect',
		outlineFor: rectOutline,
		commandFor: (outline) => {
			outlines.push(outline);
			return ok({ command: COMMAND, detailId: 'detail-7' });
		},
		reportRejected: (error) => rejected.push(error),
		reportInvalidInput: (error) => invalid.push(error),
		onCompleted: (detailId) => completed.push(detailId),
		...overrides,
	});
	return { harness, tool, outlines, completed, rejected, invalid };
}

describe('the outlines a drag describes', () => {
	it('boxes two corners in either order, wound from the top-left', () => {
		const expected = { points: [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 500 }, { x: 200, y: 500 }] };

		expect(rectOutline({ x: 600, y: 500 }, { x: 200, y: 200 })).toEqual(expected);
		expect(rectOutline({ x: 200, y: 500 }, { x: 600, y: 200 })).toEqual(expected);
	});

	it('describes no box with no width or no depth', () => {
		expect(rectOutline({ x: 200, y: 200 }, { x: 200, y: 500 })).toBeNull();
		expect(rectOutline({ x: 200, y: 200 }, { x: 600, y: 200 })).toBeNull();
	});

	it('draws a circle through the rim from the centre, as four quarter arcs', () => {
		const outline = circleOutline({ x: 300, y: 300 }, { x: 300, y: 500 });

		const expected = [[300, 100], [500, 300], [300, 500], [100, 300]];
		outline?.points.forEach((point, index) => {
			expect(point.x).toBeCloseTo(expected[index][0], 9);
			expect(point.y).toBeCloseTo(expected[index][1], 9);
		});
		expect(outline?.points).toHaveLength(4);
		expect(outline?.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('describes no circle when the rim is the centre', () => {
		expect(circleOutline({ x: 300, y: 300 }, { x: 300, y: 300 })).toBeNull();
	});
});

describe('DrawDetailTool', () => {
	it('previews the box while dragging and writes one command for it on release', async () => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		expect(r.tool.hasDraft()).toBe(true);
		expect(r.tool.tracksPointer()).toBe(true);
		r.tool.pointerMove(pointerAt(600, 500));
		const box = rectOutline({ x: 200, y: 200 }, { x: 600, y: 500 }) as CurvedPolygon;
		expect(r.harness.context.renderState.previewPolygon).toEqual(polygonPolyline(box, 0.25));
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.outlines).toEqual([box]);
		expect(r.harness.dispatched).toEqual([COMMAND]);
		expect(r.completed).toEqual(['detail-7']);
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		expect(r.tool.hasDraft()).toBe(false);
		expect(r.tool.tracksPointer()).toBe(false);
	});

	it('flattens a circle’s preview at a quarter of a screen pixel through the current camera', () => {
		const r = rig({ worldPerScreenPixel: 10 }, { id: 'draw-circle', outlineFor: circleOutline });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(300, 300));
		r.tool.pointerMove(pointerAt(300, 500));

		const outline = circleOutline({ x: 300, y: 300 }, { x: 300, y: 500 }) as CurvedPolygon;
		expect(r.harness.context.renderState.previewPolygon).toEqual(polygonPolyline(outline, 2.5));
	});

	it('clears the preview while the pointer rests where the box has no area, and writes nothing there', async () => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerMove(pointerAt(600, 500));
		r.tool.pointerMove(pointerAt(200, 500));
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		r.tool.pointerUp(pointerAt(200, 500));
		await flushGesture();

		expect(r.outlines).toEqual([]);
		expect(r.harness.dispatched).toEqual([]);
		expect(r.completed).toEqual([]);
	});

	it('snaps the press and the release onto a candidate vertex', async () => {
		const r = rig({ snapCandidates: () => ({ vertices: [{ x: 0, y: 0 }, { x: 100, y: 50 }] }) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(5, 5));
		r.tool.pointerUp(pointerAt(96, 47));
		await flushGesture();

		expect(r.outlines).toEqual([rectOutline({ x: 0, y: 0 }, { x: 100, y: 50 })]);
	});

	it('reports a refusal of its own and dispatches nothing', async () => {
		const r = rig({}, { commandFor: () => err(REFUSAL) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.invalid).toEqual([REFUSAL]);
		expect(r.harness.dispatched).toEqual([]);
		expect(r.completed).toEqual([]);
	});

	it('reports a dispatched refusal and completes nothing', async () => {
		const refused: DispatchResult = err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' });
		const r = rig({ commandDispatcher: { run: () => Promise.resolve(refused) } });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.rejected.map((error) => error.code)).toEqual(['vault.unexpected-failure']);
		expect(r.completed).toEqual([]);
	});

	/**
	 * A write that lands after the user switched tools must not select the new detail and pull
	 * them back to Select out of whatever they are doing now. The write itself still landed.
	 */
	it('completes nothing when the tool was switched away while the write was in flight', async () => {
		let settle!: (result: DispatchResult) => void;
		const r = rig({
			commandDispatcher: {
				run: () =>
					new Promise<DispatchResult>((resolve) => {
						settle = resolve;
					}),
			},
		});
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		r.tool.deactivate();
		settle(ok('wrote'));
		await flushGesture();

		expect(r.completed).toEqual([]);
	});

	it('draws nothing before activation, for a secondary button, or for a release no press began', async () => {
		const r = rig();
		r.tool.deactivate();
		r.tool.cancel();
		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.pointerMove(pointerAt(100, 100));
		r.tool.pointerUp(pointerAt(100, 100));

		r.tool.activate(r.harness.context);
		r.tool.pointerUp(pointerAt(100, 100));
		r.tool.pointerDown(pointerAt(0, 0, 'secondary'));
		r.tool.pointerMove(pointerAt(100, 100));
		r.tool.pointerUp(pointerAt(100, 100, 'secondary'));
		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.pointerUp(pointerAt(100, 100, 'secondary'));
		await flushGesture();

		expect(r.outlines).toEqual([]);
		expect(r.harness.dispatched).toEqual([]);
	});

	it.each(['cancel', 'abandonGesture'] as const)('drops the drag and its preview on %s, dispatching nothing', async (exit) => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerMove(pointerAt(600, 500));
		r.tool[exit]();
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		expect(r.tool.hasDraft()).toBe(false);
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.harness.dispatched).toEqual([]);
	});
});
```

Create `tests/presentation/designer/designerDrawDetails.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The designer's three detail tools (asset designer symbols spec, Decision 11), driven through the
 * real toolbar and canvas: what each writes to the sidecar, that a detail captured over an
 * uncalibrated sheet awaits its scale, that the new detail is selected with Select active again,
 * and that every refusal writes nothing.
 *
 * Geometry note: the rig's default camera is 10 mm per screen pixel, so the snap tolerance is
 * 80 mm; every point below sits more than that from the fixture's corners (±1000) and its anchor
 * (the origin). Coordinates are compared to 6 places because a point travels world → screen →
 * world through the camera.
 */
import { describe, expect, it } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import type { Point } from '../../../src/core/geometry/Point';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig, drag, tracePolygon, type DesignerRig } from '../../helpers/designerRig';

const SQUARE = expectOk(shapeFromDimensions(2000, 2000));
const QUARTER = Math.tan(Math.PI / 8);

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

function expectNear(points: readonly Point[], expected: readonly (readonly [number, number])[]): void {
	expect(points).toHaveLength(expected.length);
	points.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index][0], 6);
		expect(point.y).toBeCloseTo(expected[index][1], 6);
	});
}

async function details(rig: DesignerRig) {
	return (await rig.document()).shape?.details ?? [];
}

describe('drawing a rectangle detail', () => {
	it('writes one solid detail with the dragged corners, selects it and returns to Select', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		const [drawn, ...rest] = await details(rig);
		expect(rest).toEqual([]);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'rectangle', line: 'solid', pending: false });
		expectNear(drawn.outline.points, [[200, 200], [600, 200], [600, 500], [200, 500]]);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	it('marks the detail as awaiting a scale when it is drawn over an uncalibrated sheet', async () => {
		const rig = await designerRig({ shape: SQUARE, background: true });
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		expect((await details(rig)).map((detail) => detail.pending)).toEqual([true]);
		rig.unmount();
	});

	it('is one undo entry', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');
		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		await press(rig, 'designer.toolbar.undo');

		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	it('writes nothing for a drag with no area, and stays on the tool', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 200, y: 500 });
		await settle();

		expect(await details(rig)).toEqual([]);
		expect(rig.activeToolId()).toBe('draw-rect');
		rig.unmount();
	});

	it('reports a drag on an asset with no shape and writes nothing', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const rig = await designerRig();
		await press(rig, 'designer.toolbar.draw-rect');

		drag(rig, { x: 200, y: 200 }, { x: 600, y: 500 });
		await settle();

		expect(Notice.shown).toHaveLength(1);
		expect((await rig.document()).shape).toBeNull();
		rig.unmount();
	});
});

describe('drawing a circle detail', () => {
	it('writes four quarter arcs through the rim, centred where the drag began', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-circle');

		drag(rig, { x: 300, y: 300 }, { x: 300, y: 500 });
		await settle();

		const [drawn] = await details(rig);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'circle', line: 'solid' });
		expectNear(drawn.outline.points, [[300, 100], [500, 300], [300, 500], [100, 300]]);
		expect(drawn.outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
		rig.unmount();
	});
});

describe('tracing a detail', () => {
	it('completes the traced outline into a detail, selects it, returns to Select, and undoes as one entry', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.trace-detail');

		tracePolygon(rig, [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 500 }]);
		await settle();

		const [drawn] = await details(rig);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'outline', line: 'solid', pending: false });
		expectNear(drawn.outline.points, [[200, 200], [600, 200], [600, 500]]);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(rig.activeToolId()).toBe('select');

		// The wrapper command's own `undo` — the only caller that reaches it.
		await press(rig, 'designer.toolbar.undo');
		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	it('reports an outline that encloses no area, and writes nothing', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.trace-detail');

		tracePolygon(rig, [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 600, y: 200 }]);
		await settle();

		expect(Notice.shown).toHaveLength(1);
		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	it('advertises the Shift constraint, which the box and circle tools do not take', async () => {
		const rig = await designerRig({ shape: SQUARE });
		const hint = () => rig.wrapper.find('.rp-designer-hint');

		await press(rig, 'designer.toolbar.trace-detail');
		expect(hint().exists()).toBe(true);
		await press(rig, 'designer.toolbar.draw-rect');
		expect(hint().exists()).toBe(false);
		rig.unmount();
	});
});
```

Edit `tests/presentation/designer/designerToolbar.test.ts` — the exact list, deliberately:

old:
```ts
			t('en', 'designer.toolbar.trace-clearance'),
			t('en', 'designer.toolbar.set-anchor'),
```
new:
```ts
			t('en', 'designer.toolbar.trace-clearance'),
			t('en', 'designer.toolbar.draw-rect'),
			t('en', 'designer.toolbar.draw-circle'),
			t('en', 'designer.toolbar.trace-detail'),
			t('en', 'designer.toolbar.set-anchor'),
```

If the `it(...)` title Task 6 gave that case counts the design tools, rename it to `'offers Pan, Select, every design tool, Undo and Redo, in that order'`.

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run check:fast -- tests/presentation/designer/tools/drawDetailTool.test.ts tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/designerToolbar.test.ts
```

Expected: `vue-tsc` fails on `Cannot find module '../../../../src/presentation/designer/tools/draw-detail-tool'` and `Argument of type '"designer.toolbar.draw-rect"' is not assignable to parameter of type 'StringKey'`. With types ignored, vitest fails the unit file on the missing module, every rig case with `no designer toolbar button labelled Draw rectangle` (`Draw circle`, `Trace detail`), and the toolbar's exact-list case on the three missing labels.

- [ ] **Step 3: Implement**

Create `src/presentation/designer/tools/draw-detail-tool.ts`:

```ts
import type { AppError, ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { Result } from '../../../core/result/Result';
import { circle, rect } from '../../../domain/asset/presets/presetGeometry';
import { SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from '../../editor/tools/editor-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';

export interface DrawDetailToolDeps {
	/** `'draw-rect'` or `'draw-circle'`: one class, two registered tools, as `DrawPolygonTool` is. */
	readonly id: ToolId;
	/** The outline a drag from `from` to `to` describes; `null` when it encloses no area. */
	readonly outlineFor: (from: Point, to: Point) => CurvedPolygon | null;
	/** Build the write for a completed outline: a domain refusal, or the command plus the id the new detail will have. */
	readonly commandFor: (outline: CurvedPolygon) => Result<{ readonly command: UndoableCommand; readonly detailId: string }, ValidationError>;
	/** A DISPATCHED refusal. */
	readonly reportRejected: (error: AppError) => void;
	/** A refusal made before anything was dispatched — slice 17's split. */
	readonly reportInvalidInput: (error: AppError) => void;
	/** After a successful write: select the new detail and return to Select. */
	readonly onCompleted: (detailId: string) => void;
}

/** The in-flight preview's arcs are flattened to a quarter of a screen pixel — the designer layers' own figure. */
const PREVIEW_TOLERANCE_PX = 0.25;

/** The axis-aligned box of two corners, wound from the top-left; `null` with no width or no depth. */
export const rectOutline = (from: Point, to: Point): CurvedPolygon | null =>
	from.x === to.x || from.y === to.y
		? null
		: rect(Math.abs(to.x - from.x), Math.abs(to.y - from.y), (from.x + to.x) / 2, (from.y + to.y) / 2);

/** A circle about `centre` through `rim`, as the presets draw one; `null` when the rim is the centre. */
export const circleOutline = (centre: Point, rim: Point): CurvedPolygon | null => {
	const radius = distance(centre, rim);
	return radius === 0 ? null : circle(2 * radius, centre.x, centre.y);
};

/**
 * A detail drawn by one primary drag (asset designer symbols spec, Decision 11): the press records
 * the snapped start, a move previews the outline in `RenderState.previewPolygon` (drawn by
 * `DesignerGestureLayer`), the release builds the outline and writes it as ONE command.
 *
 * **A generation counter guards `onCompleted` and nothing else.** It selects a detail and switches
 * the tool, which is gesture-owned state a user who has since switched tools must keep; the
 * refusal report stays unconditional, for the reason `SetFacingTool`'s docblock records.
 */
export class DrawDetailTool implements EditorTool {
	readonly id: ToolId;

	private context: EditorContext | null = null;
	private start: Point | null = null;
	private generation = 0;

	constructor(private readonly deps: DrawDetailToolDeps) {
		this.id = deps.id;
	}

	activate(context: EditorContext): void {
		this.context = context;
		this.drop(context);
	}

	deactivate(): void {
		if (this.context !== null) this.drop(this.context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;
		this.start = this.snapped(context, event.worldPoint);
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		const start = this.start;
		if (context === null || start === null) return;
		const outline = this.deps.outlineFor(start, this.snapped(context, event.worldPoint));
		context.renderState.previewPolygon =
			outline === null ? null : polygonPolyline(outline, PREVIEW_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
	}

	pointerUp(event: EditorPointerEvent): void {
		const context = this.context;
		const start = this.start;
		if (context === null || start === null || event.button !== 'primary') return;
		const outline = this.deps.outlineFor(start, this.snapped(context, event.worldPoint));
		this.drop(context);
		if (outline === null) return;
		const write = this.deps.commandFor(outline);
		if (!write.ok) {
			this.deps.reportInvalidInput(write.error);
			return;
		}
		void this.dispatch(context, write.value);
	}

	cancel(): void {
		if (this.context !== null) this.drop(this.context); // no command dispatched
	}

	/** The whole gesture is press-to-release, so an interruption abandons exactly what `cancel()` does. */
	abandonGesture(): void {
		this.cancel();
	}

	hasDraft(): boolean {
		return this.start !== null;
	}

	/** The outline's far corner trails the pointer from a world-fixed start for the whole drag. */
	tracksPointer(): boolean {
		return this.start !== null;
	}

	private snapped(context: EditorContext, point: Point): Point {
		return context.snapService.snapPoint(point, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
	}

	/** Ends the gesture: no start, no preview, and a write still in flight no longer owns what follows it. */
	private drop(context: EditorContext): void {
		this.start = null;
		this.generation += 1;
		context.renderState.previewPolygon = null;
	}

	private async dispatch(context: EditorContext, write: { readonly command: UndoableCommand; readonly detailId: string }): Promise<void> {
		const generation = this.generation;
		const result = await context.commandDispatcher.run(write.command);
		if (!result.ok) {
			this.deps.reportRejected(result.error);
			return;
		}
		if (generation === this.generation) this.deps.onCompleted(write.detailId);
	}
}
```

Edit `src/presentation/editor/tools/editor-tool.ts`:

old:
```ts
 * over a parameter it does nothing with. The last four members are the designer's — a
 * `DrawPolygonTool` registered twice under two ids for the footprint and the clearance, plus
 * its own two point-and-drag tools — and no manager ever holds tools from both surfaces, so a
```
new:
```ts
 * over a parameter it does nothing with. The last seven members are the designer's — a
 * `DrawPolygonTool` registered three times, for the footprint, the clearance and a traced
 * detail, its two point-and-drag tools, and `DrawDetailTool` registered twice for a box and a
 * circle — and no manager ever holds tools from both surfaces, so a
```

old:
```ts
	| 'set-anchor'
	| 'set-facing';
```
new:
```ts
	| 'set-anchor'
	| 'set-facing'
	| 'draw-rect'
	| 'draw-circle'
	| 'trace-detail';
```

Edit `src/presentation/editor/snapping/editorSnapping.ts`:

old:
```ts
	'trace-clearance',
	'set-facing',
```
new:
```ts
	'trace-clearance',
	'trace-detail',
	'set-facing',
```

Edit `src/presentation/designer/tools/registerDesignerTools.ts`.

Imports — old:
```ts
import { DrawPolygonTool } from '../../editor/tools/draw-polygon-tool';
```
new:
```ts
import { DrawPolygonTool } from '../../editor/tools/draw-polygon-tool';
import type { UndoableCommand } from '../../editor/tools/undoable-command';
import type { ValidationError } from '../../../core/errors/AppError';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { err, ok, type Result } from '../../../core/result/Result';
import { assetError } from '../../../domain/asset/Asset.errors';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { addDetail, nextDetailId } from '../../../domain/asset/detailEdits';
import { circleOutline, DrawDetailTool, rectOutline } from './draw-detail-tool';
```
(If Task 6 already imports `AssetShape` or `Result` here, merge rather than duplicate the line.)

The table — old:
```ts
	'trace-clearance': 'designer.toolbar.trace-clearance',
	'set-anchor': 'designer.toolbar.set-anchor',
```
new:
```ts
	'trace-clearance': 'designer.toolbar.trace-clearance',
	'draw-rect': 'designer.toolbar.draw-rect',
	'draw-circle': 'designer.toolbar.draw-circle',
	'trace-detail': 'designer.toolbar.trace-detail',
	'set-anchor': 'designer.toolbar.set-anchor',
```

The deps — old:
```ts
	/** Asks the user to accept that rescale; `true` proceeds. Never called when the above is false. */
	readonly confirmRecalibration: () => Promise<boolean>;
```
new:
```ts
	/** Asks the user to accept that rescale; `true` proceeds. Never called when the above is false. */
	readonly confirmRecalibration: () => Promise<boolean>;
	/**
	 * Whether a detail added to `shape` right now awaits a scale — `captureAwaitsScale` over the
	 * leaf's calibration and background, which `selectTool.design()` does not carry (Decision 11:
	 * "by the rule tracing already follows").
	 */
	readonly detailPending: (shape: AssetShape) => boolean;
```

Module-private helpers — old:
```ts
export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
```
new:
```ts
type DetailWrite = Result<{ readonly command: UndoableCommand; readonly detailId: string }, ValidationError>;

/**
 * The ONE write all three detail tools build: `addDetail` over the design the leaf read, pending by
 * the capture rule, conditional on that design's version. The id is computed with the command so
 * the tool can select the detail the write will create.
 */
function detailWrite(deps: DesignerToolDeps, name: string, outline: CurvedPolygon): DetailWrite {
	const design = deps.selectTool.design();
	if (design === null) return err(assetError('part-not-found', 'Draw a footprint before adding details.'));
	const detailId = nextDetailId(design.shape);
	const added = addDetail(design.shape, { name, outline, line: 'solid', pending: deps.detailPending(design.shape) });
	if (!added.ok) return err(added.error);
	return ok({ command: deps.selectTool.createCommand(added.value, design.geometryVersion), detailId });
}

/** A drawn detail is selected once written, and every draw returns to Select (Amendment 1). */
function completeDetail(deps: DesignerToolDeps, detailId: string): void {
	deps.returnToSelect();
	deps.selectTool.select({ kind: 'detail', id: detailId });
}

/**
 * Trace detail is `DrawPolygonTool`, whose completion must answer a command. A domain refusal
 * therefore becomes a command that resolves that refusal — `DrawPolygonTool` reports it through
 * `reportRejected` and keeps the user's vertices. One function serves as both halves, because a
 * refused command is never recorded and so its `undo` is never reached.
 */
function traceDetailTool(deps: DesignerToolDeps): DrawPolygonTool {
	let tracedId = '';
	return new DrawPolygonTool({
		id: 'trace-detail',
		completion: {
			commandFor: (geometry) => {
				const write = detailWrite(deps, 'outline', geometry);
				if (!write.ok) {
					const refuse = () => Promise.resolve(err(write.error));
					return { execute: refuse, undo: refuse, createdId: null };
				}
				tracedId = write.value.detailId;
				const { command } = write.value;
				return { execute: () => command.execute(), undo: () => command.undo(), createdId: null };
			},
		},
		reportRejected: deps.reportRejected,
		reportInvalidInput: deps.reportInvalidInput,
		// Reached only after a successful close, which is the only path that set `tracedId`.
		onCompleted: () => completeDetail(deps, tracedId),
	});
}

export function registerDesignerTools(manager: ToolManager, deps: DesignerToolDeps): void {
```

The record — old:
```ts
		'set-anchor': new SetAnchorTool({
```
new:
```ts
		'draw-rect': new DrawDetailTool({
			id: 'draw-rect',
			outlineFor: rectOutline,
			commandFor: (outline) => detailWrite(deps, 'rectangle', outline),
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
			onCompleted: (detailId) => completeDetail(deps, detailId),
		}),
		'draw-circle': new DrawDetailTool({
			id: 'draw-circle',
			outlineFor: circleOutline,
			commandFor: (outline) => detailWrite(deps, 'circle', outline),
			reportRejected: deps.reportRejected,
			reportInvalidInput: deps.reportInvalidInput,
			onCompleted: (detailId) => completeDetail(deps, detailId),
		}),
		'trace-detail': traceDetailTool(deps),
		'set-anchor': new SetAnchorTool({
```

Edit `src/presentation/designer/runtime.ts`.

Imports — old:
```ts
import type { AssetShape } from '../../domain/asset/AssetShape';
```
new:
```ts
import type { AssetShape } from '../../domain/asset/AssetShape';
import { captureAwaitsScale } from '../../domain/asset/captureAwaitsScale';
import type { AssetDesignDto } from '../../application/queries/GetAssetDesign';
```

The registration call — old:
```ts
		reportInvalidInput: notifyOperationFailure,
```
new:
```ts
		reportInvalidInput: notifyOperationFailure,
		// Asked only after `selectTool.design()` answered a design, so `store.design` is set here.
		detailPending: (shape) => {
			const { calibration, background } = store.design as AssetDesignDto;
			return captureAwaitsScale(calibration !== null, background !== null, shape);
		},
```

If `buildRuntime` now passes ESLint's 100-line function budget, move those four lines into `calibrationDeps`'s sibling: a `function detailDeps(store: ReturnType<typeof useAssetDesignStore>): Pick<DesignerToolDeps, 'detailPending'>` beside `calibrationDeps`, spread into the call as `...detailDeps(store)`.

Edit `src/presentation/designer/layers/DesignerGestureLayer.vue` (script):

old:
```ts
import { storeToRefs } from 'pinia';
```
new:
```ts
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
```

old:
```ts
function toScreen(point: Point) {
	return worldToScreen(point, viewport.value, STAGE_PIXELS);
}
```
new:
```ts
function toScreen(point: Point) {
	return worldToScreen(point, viewport.value, STAGE_PIXELS);
}

/** A draw tool's in-flight detail (`DrawDetailTool`), already flattened in world space; projected here. */
const previewFlat = computed(
	() => props.renderState.previewPolygon?.flatMap((point) => {
		const at = toScreen(point);
		return [at.x, at.y];
	}) ?? null,
);
```

Template — old:
```html
			:measurement="props.renderState.measurement"
		/>
	</VLayer>
```
new:
```html
			:measurement="props.renderState.measurement"
		/>
		<VLine
			v-if="previewFlat !== null"
			:config="{
				name: 'detail-preview',
				points: previewFlat,
				closed: true,
				dash: [4, 4],
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				strokeScaleEnabled: false,
				listening: false,
			}"
		/>
	</VLayer>
```

Edit `src/presentation/i18n/locales/en/assetSymbols.ts`:

old:
```ts
	'designer.preset.field.pillows': 'Pillows',
```
new:
```ts
	'designer.preset.field.pillows': 'Pillows',
	'designer.toolbar.draw-rect': 'Draw rectangle',
	'designer.toolbar.draw-circle': 'Draw circle',
	'designer.toolbar.trace-detail': 'Trace detail',
```

Edit `src/presentation/i18n/locales/de/assetSymbols.ts`:

old:
```ts
	'designer.preset.field.pillows': 'Kissen',
```
new:
```ts
	'designer.preset.field.pillows': 'Kissen',
	'designer.toolbar.draw-rect': 'Rechteck zeichnen',
	'designer.toolbar.draw-circle': 'Kreis zeichnen',
	'designer.toolbar.trace-detail': 'Detail nachzeichnen',
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npm run check:fast -- tests/presentation/designer/tools/drawDetailTool.test.ts tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/designerToolbar.test.ts tests/presentation/designer/designerGesture.test.ts tests/presentation/designer/layers.test.ts
npm run check:fast -- tests/presentation tests/helpers
```

Expected: both green. The first proves the three tools; the second is the widened-contract run (`ToolId`, `DESIGNER_TOOL_LABELS`, `DesignerToolDeps`), which is where a total record over `ToolId` or a toolbar count elsewhere would surface. `designerToolbar.test.ts`'s `it.each(TOOLS)` cases now activate and mark all nine designer tools. If a case times out, re-run that path with `--testTimeout=20000` before believing it.

- [ ] **Step 5: Lint**

```bash
npx eslint src/presentation/designer/tools/draw-detail-tool.ts src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/runtime.ts src/presentation/editor/tools/editor-tool.ts src/presentation/editor/snapping/editorSnapping.ts src/presentation/designer/layers/DesignerGestureLayer.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/tools/drawDetailTool.test.ts tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/designerToolbar.test.ts
npx fallow dupes
npx fallow dead-code
```

Expected: no ESLint finding (`runtime.ts` under `max-lines` 400 and `max-lines-per-function` 100 — apply the `detailDeps` split from Step 3 if either fires). `fallow dupes` shows no new group: the preview `VLine` config deliberately lists its properties in a different order from `InteractionLayer.vue`'s `geometry-preview`; if a group between the two is still reported, record it inline with a reason above a `fallow-ignore-next-line code-duplication` directive on the line fallow names. `fallow dead-code` reports no unused export (`rectOutline`, `circleOutline`, `DrawDetailTool` and `DrawDetailToolDeps` all have their `src/` consumer in `registerDesignerTools.ts`; `DrawDetailToolDeps` is consumed through `DrawDetailTool`'s constructor signature — if fallow flags it anyway, drop its `export` and import nothing by that name in the test, typing `overrides` as `Partial<ConstructorParameters<typeof DrawDetailTool>[0]>`).

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/tools/draw-detail-tool.ts src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/runtime.ts src/presentation/editor/tools/editor-tool.ts src/presentation/editor/snapping/editorSnapping.ts src/presentation/designer/layers/DesignerGestureLayer.vue src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts tests/presentation/designer/tools/drawDetailTool.test.ts tests/presentation/designer/designerDrawDetails.test.ts tests/presentation/designer/designerToolbar.test.ts
git commit -m "feat(designer): draw rectangle, draw circle and trace detail

Three tools add a detail as one conditional SetAssetShape write: a dragged box, a
circle dragged from its centre, and a traced outline through DrawPolygonTool. A
detail captured over an uncalibrated sheet awaits its scale by the capture rule;
the new detail is selected and the toolbar returns to Select. The toolbar's
exact list gains the three buttons after Trace clearance.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 11: "Set dimensions" scales a curved design; plan-side carry-overs

**Files:**
- Modify: `src/presentation/designer/AssetDesignerRoot.vue` (`editDimensions`)
- Modify: `src/presentation/editor/elements/assetShapeConfig.ts`
- Modify: `src/presentation/editor/elements/AssetShapes.vue`
- Test: `tests/presentation/designer/assetDimensions.test.ts` (two new cases)
- Test: `tests/presentation/editor/elements/assetShapeConfig.test.ts` (two new cases)
- Test: `tests/presentation/editor/assetLayer.test.ts` (one new mounted case — the only thing that renders `AssetShapes.vue` with details, so the `v-if` on the edge has a true arm)

**Interfaces:**
- Consumes (Task 1): `export function scaleDesign(shape: AssetShape, sx: number, sy: number): Result<AssetShape, ValidationError>;`
- Consumes (Task 6): `DesignerRuntime.editShape: (edit: (shape: AssetShape) => Result<AssetShape, ValidationError>) => Promise<DispatchResult>`
- Consumes: `hasCurves(shape: CurvedPolygon): boolean` (`src/core/geometry/CurvedPolygon.ts`), `dimensionsOf(footprint: CurvedPolygon): Result<Dimensions, GeometryError>` (`src/domain/asset/AssetShape.ts`), `unwrap` (`src/core/result/Result.ts`), `notifyIfRefused(operation: Promise<DispatchResult | null>): Promise<void>` (`src/presentation/editor/report-failure.ts`).
- Produces: `assetShapeConfig(...)` returns `edge: { name: 'asset-footprint-edge'; points; closed: true; stroke; strokeWidth; listening: false } | null` — `null` when the placement has no details or no readable shape. No new export.

- [ ] **Step 1: Write the failing test**

Edit `tests/presentation/designer/assetDimensions.test.ts`.

Imports — old:
```ts
import { installResizeObserver } from '../../helpers/layout';
```
new:
```ts
import { installResizeObserver } from '../../helpers/layout';
import type { Point } from '../../../src/core/geometry/Point';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { circle, defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
```

Helpers — old:
```ts
describe('the designer’s dimensions dialog', () => {
```
new:
```ts
function expectNear(points: readonly Point[] | undefined, expected: readonly (readonly [number, number])[]): void {
	expect(points).toHaveLength(expected.length);
	points?.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index][0], 6);
		expect(point.y).toBeCloseTo(expected[index][1], 6);
	});
}

const toiletPreset = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
if (toiletPreset === undefined) throw new Error('the catalogue has a toilet');
/** 380 × 700, anchored at the origin: a round front, a tank, a stadium bowl and a front clearance. */
const TOILET = expectOk(toiletPreset.build(defaultValues(toiletPreset)));

describe('the designer’s dimensions dialog', () => {
```

New cases — old (the last case of the first `describe`):
```ts
		const stored = await harness.sidecar.read(harness.assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('typed');
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
	});
});
```
new:
```ts
		const stored = await harness.sidecar.read(harness.assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('typed');
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
	});

	/**
	 * Symbols spec, Decision 9 and Amendment 1: a design with details is SCALED about its anchor, not
	 * replaced by a rectangle that would throw the tank and the bowl away. ×2 on both axes, so every
	 * coordinate doubles and every bulge stays what it was.
	 */
	it('scales a design with details about its anchor, keeping every curve, as one undoable write', async () => {
		const harness = await seeded();
		await harness.seed(TOILET);
		const before = (await harness.document()).shape;
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 760, depth: 1400 });
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(fromDimensions).not.toHaveBeenCalled();
		const scaled = (await harness.document()).shape;
		expectNear(scaled?.footprint.points, [[-380, -700], [380, -700], [380, 320], [-380, 320]]);
		expect(scaled?.footprint.bulges).toEqual([0, 0, 1, 0]);
		expectNear(scaled?.clearance?.points, [[-780, -700], [780, -700], [780, 1900], [-780, 1900]]);
		expectNear(scaled?.details[0].outline.points, [[-380, -700], [380, -700], [380, -300], [-380, -300]]);
		expectNear(scaled?.details[1].outline.points, [[-304, 54], [304, 54], [304, 346], [-304, 346]]);
		expect(scaled?.details[1].outline.bulges).toEqual([1, 0, 1, 0]);
		expect(scaled?.anchor).toEqual({ x: 0, y: 0 });

		const undo = wrapper.findAll('.rp-designer-tools button').find((button) => button.text() === t('en', 'designer.toolbar.undo'));
		await undo?.trigger('click');
		await flushPromises();

		expect((await harness.document()).shape).toEqual(before);
	});

	/** The other arm of the same rule: no details, but a curved footprint, is still scaled — about an anchor that is NOT the origin. */
	it('scales a design whose footprint curves, even with no details', async () => {
		const harness = await seeded();
		await harness.seed({ ...drawn(), footprint: circle(1000), clearance: null });
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 2000, depth: 2000 });
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');
		const setShape = vi.spyOn(harness.bundle.setShape, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(fromDimensions).not.toHaveBeenCalled();
		expect(setShape).toHaveBeenCalledTimes(1);
		const footprint = (await harness.document()).shape?.footprint;
		// `drawn()`'s anchor is (5, 5), so x' = 2x − 5 and y' = 2y − 5.
		expectNear(footprint?.points, [[-5, -1005], [995, -5], [-5, 995], [-1005, -5]]);
		const quarter = Math.tan(Math.PI / 8);
		expect(footprint?.bulges).toEqual([quarter, quarter, quarter, quarter]);
	});
});
```

(The existing `'retypes a TRACED footprint as typed…'` case is the plain arm: `drawn()` has no details, a straight footprint and a straight, non-null clearance, and it must stay green unchanged. The existing empty-state case is the shapeless arm.)

Edit `tests/presentation/editor/elements/assetShapeConfig.test.ts` — old:
```ts
	it('draws no details for a placement whose shape cannot be read', () => {
		expect(assetShapeConfig(element, () => null, state).details).toEqual([]);
	});
```
new:
```ts
	it('draws no details for a placement whose shape cannot be read', () => {
		expect(assetShapeConfig(element, () => null, state).details).toEqual([]);
	});

	/** A solid detail fills over the inner half of the footprint's stroke; the edge restrokes it on top. */
	it('restrokes the footprint as an unfilled, non-listening edge when the placement has details', () => {
		const withDetails = { ...shape, details: [{ id: 'd1', name: 'seat', outline: square(100), line: 'solid' as const, pending: false }] };
		const config = assetShapeConfig(element, () => withDetails, state);
		expect(config.edge).toMatchObject({ name: 'asset-footprint-edge', points: config.footprint.points, closed: true, stroke: 'ink', strokeWidth: 2, listening: false });
		expect(config.edge).not.toHaveProperty('fill');
		expect(assetShapeConfig(element, () => withDetails, { ...state, selected: true }).edge).toMatchObject({ stroke: 'accent', strokeWidth: 3 });
	});

	it('draws no edge without details, or without a readable shape', () => {
		expect(assetShapeConfig(element, () => shape, state).edge).toBeNull();
		expect(assetShapeConfig(element, () => null, state).edge).toBeNull();
	});
```

Edit `tests/presentation/editor/assetLayer.test.ts`.

Imports — old:
```ts
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
```
new:
```ts
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { expectOk } from '../../helpers/domain';
```

Append at the end of the file:
```ts

it('restrokes a placed symbol’s outline after its details, so a solid detail cannot hide the edge', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const toilet = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
	if (toilet === undefined) throw new Error('the catalogue has a toilet');
	const asset = await rig.saveAsset('Toilet', false);
	expectOk(await new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry).write(asset.id, { calibration: null, shape: expectOk(toilet.build(defaultValues(toilet))) }));
	await rig.place(asset.id, { x: 1000, y: 1000 });
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 1, 'asset shapes'); await settle();

	const names = rig.stage.findOne<Konva.Group>('.element-asset')?.getChildren().map((node) => node.name()) ?? [];
	expect(names.filter((name) => name === 'asset-footprint-edge')).toHaveLength(1);
	expect(names.lastIndexOf('asset-detail')).toBeGreaterThan(-1);
	expect(names.indexOf('asset-footprint-edge')).toBeGreaterThan(names.lastIndexOf('asset-detail'));
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run check:fast -- tests/presentation/designer/assetDimensions.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts tests/presentation/editor/assetLayer.test.ts
```

Expected: `vue-tsc` fails on `Property 'edge' does not exist on type` in `assetShapeConfig.test.ts`. With types ignored: both new `assetDimensions` cases fail at `expect(fromDimensions).not.toHaveBeenCalled()` (today's code always takes `setFootprintFromDimensions`); both `assetShapeConfig` cases fail (`edge` is `undefined`); the `assetLayer` case fails with `expected [] to have a length of 1`.

- [ ] **Step 3: Implement**

Edit `src/presentation/designer/AssetDesignerRoot.vue` (script).

Imports — old:
```ts
import type { AssetShape } from '../../domain/asset/AssetShape';
```
new:
```ts
import { dimensionsOf, type AssetShape } from '../../domain/asset/AssetShape';
import { scaleDesign } from '../../domain/asset/shapeEdits';
import { hasCurves } from '../../core/geometry/CurvedPolygon';
import { unwrap } from '../../core/result/Result';
import { notifyIfRefused } from '../editor/report-failure';
```

The gesture — old:
```ts
async function editDimensions(): Promise<void> {
```
new:
```ts
/**
 * Does Set dimensions SCALE this design rather than replace it (symbols spec, Decision 9 and
 * Amendment 1)? A shape with details, or with a curved footprint or clearance edge, is scaled about
 * its anchor so the drawing survives; a plain polygon keeps the replace-with-rectangle it always had.
 */
function scalesDrawing(shape: AssetShape | null): shape is AssetShape {
	return (
		shape !== null &&
		(shape.details.length > 0 || [shape.footprint, ...(shape.clearance === null ? [] : [shape.clearance])].some(hasCurves))
	);
}

async function editDimensions(): Promise<void> {
```

old:
```ts
	if (result === null) return;
	await runtime.setFootprintFromDimensions(result.width, result.depth);
}
```
new:
```ts
	if (result === null) return;
	if (!scalesDrawing(current?.shape ?? null)) {
		await runtime.setFootprintFromDimensions(result.width, result.depth);
		return;
	}
	// The ratio is taken against the shape the write is computed from, so it cannot disagree with the
	// design `editShape` makes conditional. `dimensionsOf` answers for any validated footprint.
	await notifyIfRefused(
		runtime.editShape((shape) => {
			const measured = unwrap(dimensionsOf(shape.footprint));
			return scaleDesign(shape, result.width / measured.width, result.depth / measured.depth);
		}),
	);
}
```

Edit `src/presentation/editor/elements/assetShapeConfig.ts` — old:
```ts
	const { selected, tokens, zoom } = state, shape = element.assetId ? shapeOf(element.assetId) : null;
	const footprint = elementFootprint(element, shapeOf), anchor = element.points[0], heading = placementHeading(element);
	const placed = shape ? placedOutline(element, shape) : null;
	const clearance = placed && (selected || state.hovered) ? placed.clearance : null;
	const ink = selected ? tokens.accent : tokens.zoneStroke;
	return {
		id: element.id,
		footprint: { name: shape ? 'asset-footprint' : 'asset-placeholder', points: flat(footprint), closed: true, stroke: ink,
			strokeWidth: (selected ? 3 : 2) / zoom, fill: tokens.canvasBackground, dash: shape ? [] : [6 / zoom, 4 / zoom] },
```
new:
```ts
	const { selected, tokens, zoom } = state, shape = element.assetId ? shapeOf(element.assetId) : null;
	// Placed ONCE: for a readable shape `elementFootprint` answers exactly `placed.footprint`, so it is kept for the placeholder alone.
	const placed = shape ? placedOutline(element, shape) : null;
	const footprint = placed ? placed.footprint : elementFootprint(element, shapeOf), anchor = element.points[0], heading = placementHeading(element);
	const clearance = placed && (selected || state.hovered) ? placed.clearance : null;
	const ink = selected ? tokens.accent : tokens.zoneStroke;
	const outline = { points: flat(footprint), closed: true, stroke: ink, strokeWidth: (selected ? 3 : 2) / zoom };
	return {
		id: element.id,
		footprint: { ...outline, name: shape ? 'asset-footprint' : 'asset-placeholder', fill: tokens.canvasBackground, dash: shape ? [] : [6 / zoom, 4 / zoom] },
```

old:
```ts
			...(detail.line === 'solid' ? { fill: tokens.canvasBackground } : { dash: [4 / zoom, 3 / zoom] }) })),
```
new:
```ts
			...(detail.line === 'solid' ? { fill: tokens.canvasBackground } : { dash: [4 / zoom, 3 / zoom] }) })),
		// Drawn after the details: a solid detail's fill covers the inner half of the footprint's stroke, so the edge is restroked on top, unfilled.
		edge: placed && placed.details.length > 0 ? { ...outline, name: 'asset-footprint-edge', listening: false } : null,
```

Edit `src/presentation/editor/elements/AssetShapes.vue` — old:
```html
			<VLine
				v-for="(detail, index) in shape.details"
				:key="index"
				:config="detail"
			/>
```
new:
```html
			<VLine
				v-for="(detail, index) in shape.details"
				:key="index"
				:config="detail"
			/>
			<VLine
				v-if="shape.edge"
				:config="shape.edge"
			/>
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npm run check:fast -- tests/presentation/designer/assetDimensions.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts tests/presentation/editor/assetLayer.test.ts tests/presentation/editor/assetShapeLoader.test.ts tests/presentation/editor/assetPlacementInspector.test.ts tests/presentation/designer/assetPresetFlow.test.ts
```

Expected: every case green, the pre-existing ones unchanged — in particular every existing `assetShapeConfig` case (the footprint's `points`, `stroke` and `dash` are identical, only built from `placed.footprint`), and every existing `assetDimensions` case (a plain `drawn()` shape and the shapeless empty state still take `setFootprintFromDimensions`).

- [ ] **Step 5: Lint**

```bash
npx eslint src/presentation/designer/AssetDesignerRoot.vue src/presentation/editor/elements/assetShapeConfig.ts src/presentation/editor/elements/AssetShapes.vue tests/presentation/designer/assetDimensions.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts tests/presentation/editor/assetLayer.test.ts
npx fallow dupes
```

Expected: no finding. The toilet fixture is three lines in `assetDimensions.test.ts` and `assetLayer.test.ts` beside the same lines in `assetPresetFlow.test.ts` and `designerSelectionInspector.test.ts`; if `fallow dupes` groups them, move them into `tests/helpers/assetDesignHarness.ts` as `export function presetShape(id: PresetId): AssetShape` and import it in all four files.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/AssetDesignerRoot.vue src/presentation/editor/elements/assetShapeConfig.ts src/presentation/editor/elements/AssetShapes.vue tests/presentation/designer/assetDimensions.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts tests/presentation/editor/assetLayer.test.ts
git commit -m "feat(designer): Set dimensions scales a design with details or curves

A shape with details or a curved footprint or clearance edge is scaled about its
anchor through scaleDesign, as one conditional write; a plain polygon keeps the
typed rectangle. On a plan, a placed symbol with details restrokes its outline
over them, so a solid detail no longer hides the object's edge.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 12: Captures, manual steps, backlog, changelog

**Files:**
- Modify: `tests/harness/assetDesigner.ts`, `tests/harness/page.ts`
- Modify: `scripts/harness-shot.mjs`
- Test: `tests/build/harness-shot.test.ts` (the fixed-shot table pin, plus one case for the new knobs)
- Modify: `docs/tests/cases/Design an Asset.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md` (the triage tier figures)
- Modify: `docs/requirements/Select part of an object's shape.md`, `docs/requirements/Start an asset from a preset.md`
- Modify: `docs/issues/The designer offers no selection, because nothing there was selectable.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes (Task 3): `export type DesignerSelection = …`, `export type SelectionMode = 'transform' | 'points' | 'bend';`, store `select(next)`, `setMode(next)`.
- Consumes (Task 6): the Select toolbar button labelled `designer.toolbar.select`, `.rp-designer-selection-modes` with `[aria-checked]` radios.
- Consumes (Task 9): `.rp-designer-selection[data-kind="<kind>"]`.
- Produces: `mountAssetDesignerHarness(root: HTMLElement, presetId: string | null = null, selection: { readonly select: string; readonly mode: string } | null = null): MountedAssetDesigner`; harness knobs `&select=footprint|clearance|anchor|facing|<detail id>` and `&mode=transform|points|bend` on `?view=asset-designer`, honoured only beside `&preset=`.

- [ ] **Step 1: Pin the four captures first (the failing test)**

Edit `tests/build/harness-shot.test.ts`.

The table — old:
```ts
			'asset-designer-preset-tree',
			'asset-library-actions',
```
new:
```ts
			'asset-designer-preset-tree',
			'asset-designer-select-anchor',
			'asset-designer-select-bend',
			'asset-designer-select-points',
			'asset-designer-select-transform',
			'asset-library-actions',
```

A case for the knobs — old:
```ts
	it('seeds the designer with a preset through the harness knob', () => {
		expect(shot('asset-designer-preset-toilet')).toMatchObject({ query: '?view=asset-designer&preset=toilet' });
	});
```
new:
```ts
	it('seeds the designer with a preset through the harness knob', () => {
		expect(shot('asset-designer-preset-toilet')).toMatchObject({ query: '?view=asset-designer&preset=toilet' });
	});

	/**
	 * The selection captures (symbols spec, Testing: "each selection mode"). `&select=` is honoured
	 * only beside `&preset=`, so a shot that lost its preset would photograph an empty designer and
	 * still pass the name check; each shot also waits on a mark that exists only once the knob landed.
	 */
	it('takes each selection mode and the anchor through the knobs that reach them', () => {
		const four = ['asset-designer-select-transform', 'asset-designer-select-points', 'asset-designer-select-bend', 'asset-designer-select-anchor'];

		expect(four.filter((name) => query(name).get('view') === 'asset-designer' && query(name).has('preset'))).toEqual(four);
		expect(query('asset-designer-select-transform').get('select')).toBe('detail-2');
		expect(query('asset-designer-select-transform').get('mode')).toBeNull();
		expect(query('asset-designer-select-points').get('mode')).toBe('points');
		expect(query('asset-designer-select-bend').get('mode')).toBe('bend');
		expect(query('asset-designer-select-bend').get('theme')).toBe('light');
		expect(query('asset-designer-select-anchor').get('select')).toBe('anchor');
	});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run check:fast -- tests/build/harness-shot.test.ts
```

Expected: `defines exactly the fixed shots this file lists, in both directions` fails (the four names are missing from `SHOTS`), and the new case throws `no shot named asset-designer-select-transform`.

- [ ] **Step 3: Implement the knobs and the captures**

Edit `tests/harness/assetDesigner.ts`.

Imports — old:
```ts
import { ok } from '../../src/core/result/Result';
```
new:
```ts
import type { App } from 'vue';
import { ok } from '../../src/core/result/Result';
import { tr } from '../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import type { DesignerSelection, SelectionMode } from '../../src/presentation/designer/selection/designerSelection';
```

The mount — old:
```ts
export function mountAssetDesignerHarness(root: HTMLElement, presetId: string | null = null): MountedAssetDesigner {
```
new:
```ts
/** `&select=` spells a part as `partKey` does, minus the `detail:` prefix a URL has no need for. */
function harnessSelection(select: string): DesignerSelection {
	return select === 'footprint' || select === 'clearance' || select === 'anchor' || select === 'facing'
		? { kind: select }
		: { kind: 'detail', id: select };
}

/**
 * Presses the REAL Select button, then sets the leaf's selection and mode through its own store —
 * once the fixture has hydrated: a macrotask runs after every microtask `onOpen`'s read queues. The
 * leaf's Pinia is reached through the Vue app `AssetDesignerView` mounts on its host element.
 * Harness-only: no production seam exists for this, and none is added.
 */
function selectInHarness(view: AssetDesignerView, selection: { readonly select: string; readonly mode: string }): void {
	setTimeout(() => {
		const host = view.contentEl.querySelector('.renovation-asset-designer-view') as HTMLElement & { __vue_app__: App };
		const button = Array.from(view.contentEl.querySelectorAll<HTMLButtonElement>('.rp-designer-tools button')).find(
			(candidate) => candidate.textContent?.trim() === tr('designer.toolbar.select'),
		);
		button?.click();
		const store = useAssetDesignStore(host.__vue_app__.config.globalProperties.$pinia);
		store.select(harnessSelection(selection.select));
		const mode: SelectionMode = selection.mode === 'points' || selection.mode === 'bend' ? selection.mode : 'transform';
		store.setMode(mode);
	}, 0);
}

/**
 * `selection` is `?select=`/`&mode=`, honoured only beside a preset: a shapeless fixture has no part
 * to select, and a capture of one would photograph a selection nobody could make.
 */
export function mountAssetDesignerHarness(
	root: HTMLElement,
	presetId: string | null = null,
	selection: { readonly select: string; readonly mode: string } | null = null,
): MountedAssetDesigner {
```

old:
```ts
	void view.onOpen();

	return { leafEl, view };
}
```
new:
```ts
	void view.onOpen();
	if (presetId !== null && selection !== null) selectInHarness(view, selection);

	return { leafEl, view };
}
```

Edit `tests/harness/page.ts`.

Header — old:
```ts
 * (Task B10) opens the asset designer the same way, `?view=asset-library` (Task 17) opens the
```
new:
```ts
 * (Task B10) opens the asset designer the same way — `&preset=<id>` seeding a preset and, beside
 * it, `&select=<part>` and `&mode=<mode>` selecting one part in one mode — `?view=asset-library` (Task 17) opens the
```

Mount — old:
```ts
			? mountAssetDesignerHarness(document.body, params.get('preset')).view
```
new:
```ts
			? mountAssetDesignerHarness(
				document.body,
				params.get('preset'),
				params.has('select') ? { select: params.get('select') ?? '', mode: params.get('mode') ?? 'transform' } : null,
			).view
```

Edit `scripts/harness-shot.mjs` — old:
```js
	{ name: 'asset-designer-preset-tree', query: '?view=asset-designer&preset=tree', selector: ASSET_DESIGNER_VIEW },
```
new:
```js
	{ name: 'asset-designer-preset-tree', query: '?view=asset-designer&preset=tree', selector: ASSET_DESIGNER_VIEW },
	// The selection (symbols spec, Decision 10): one capture per mode and one of the anchor, through the
	// designer harness's `&select=`/`&mode=` knobs. Each waits on marks that exist only once the knob
	// has landed — the pressed mode and that part's inspector section — so a capture cannot be taken of
	// the designer before its selection. Transform on the toilet's bowl (a detail over the footprint);
	// Edit points on the toilet's footprint; Bend edges on the curved table's footprint, light, because
	// that is the shot whose accent edge handles sit on arcs; the anchor has no mode control at all.
	{
		name: 'asset-designer-select-transform',
		query: '?view=asset-designer&preset=toilet&select=detail-2',
		selector: [ASSET_DESIGNER_VIEW, '.rp-designer-selection-modes [aria-checked="true"]', '.rp-designer-selection[data-kind="detail"]'],
	},
	{
		name: 'asset-designer-select-points',
		query: '?view=asset-designer&preset=toilet&select=footprint&mode=points',
		selector: [ASSET_DESIGNER_VIEW, '.rp-designer-selection-modes [aria-checked="true"]', '.rp-designer-selection[data-kind="footprint"]'],
	},
	{
		name: 'asset-designer-select-bend',
		query: '?view=asset-designer&preset=curved-table&select=footprint&mode=bend&theme=light',
		selector: [ASSET_DESIGNER_VIEW, '.rp-designer-selection-modes [aria-checked="true"]', '.rp-designer-selection[data-kind="footprint"]'],
	},
	{
		name: 'asset-designer-select-anchor',
		query: '?view=asset-designer&preset=toilet&select=anchor',
		selector: [ASSET_DESIGNER_VIEW, '.rp-designer-selection[data-kind="anchor"]'],
	},
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npm run check:fast -- tests/build/harness-shot.test.ts tests/harness
```

Expected: green — the table and the new case in `harness-shot.test.ts`, and every `tests/harness` case, including `harnessSurfaces.test.ts` and `accessibility.test.ts`, which call `mountAssetDesignerHarness(document.body)` with neither new argument and so never reach `selectInHarness`.

- [ ] **Step 5: Capture and LOOK**

```bash
npm run harness-shot
```

Expected: exits 0 and writes `harness-shots/asset-designer-select-transform.png`, `asset-designer-select-points.png`, `asset-designer-select-bend.png` and `asset-designer-select-anchor.png` beside the existing shots. If it stops on a missing Chromium, report that verbatim rather than claiming the captures — `RP_CHROMIUM_EXECUTABLE=/path/to/chrome npm run harness-shot` is the one named substitute, and its captures are approximate.

- [ ] **Step 6: Open every new PNG under `harness-shots/` and check**

Open each of the four with the Read tool and check, writing down what was seen:
- **handles on the right part** — transform: eight square handles and a round rotate handle on the BOWL's box (the rounded detail nearest the front), not on the footprint; points: one round handle on each of the toilet footprint's four corners; bend: one handle at the middle of each of the curved table's four edges, the two long ones ON the arcs; anchor: an accent ring on the anchor dot and no box handles anywhere;
- **the right mode** — the mode control shows Transform / Edit points / Bend edges pressed respectively, and is absent from the anchor shot;
- **nothing clipped** — the selected outline, its handles and the rotate handle sit inside the canvas; the inspector section is fully visible without horizontal scroll; the toolbar's buttons are fully spelled out;
- **whole-mm numbers** — transform's inspector reads Centre x 0, Centre y 100, Width 304, Depth 450, Rotation 0; points' reads Width 380, Depth 700; anchor's reads Position x 0, Position y 0 — no decimals anywhere.

Any mismatch is a defect in Task 6 or Task 9 to fix before committing, not a capture to accept.

- [ ] **Step 7: The manual steps**

Edit `docs/tests/cases/Design an Asset.md`.

Step 5 — old:
```md
| 5 | `browser` | Look at the toolbar | Six tool buttons on one line — Pan, Trace footprint, Trace clearance, Set anchor, Set facing, Calibrate — plus Undo/Redo dimmed at the right |
```
new:
```md
| 5 | `browser` | Look at the toolbar | Ten tool buttons — Pan, Select, Trace footprint, Trace clearance, Draw rectangle, Draw circle, Trace detail, Set anchor, Set facing, Calibrate — plus Undo/Redo dimmed at the right, wrapping onto a second row where the pane is too narrow for one |
```

New sections — old:
```md
## Deliberately NOT checked
```
new:
```md
## Steps — a preset adjusted by selection

Preconditions: a THIRD asset, created from the Renovation project view with no width or depth,
its designer open with no background, and **Start from preset → Toilet** applied at its defaults
(Dimensions read 380 × 700 mm). It is a fresh asset so nothing on it is pending and nothing was
calibrated. The toilet's details: the **tank**, the straight one across the back, and the **bowl**,
the rounded one in front of it; the anchor dot sits inside the bowl.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 29 | `suite` | Click Select, then click inside the bowl away from the anchor dot | The bowl is outlined in the accent colour with eight square handles and one round rotate handle above it; a mode control reads Transform, Edit points, Bend edges with Transform pressed; the Inspector shows a "Detail" section reading Name bowl, Line Solid, Centre x 0, Centre y 100, Width 304, Depth 450; Undo stays dimmed | Decision 10's hit order — a detail over the footprint is the detail — and "a selection writes nothing" |
| 30 | `suite` | Press Right arrow twice, then Shift+Down once | The bowl moves right, then further down; the Inspector reads Centre x 20, then Centre y 200 | Arrows nudging 10 mm and Shift 100 mm through `moveOutline`, one write per press |
| 31 | `suite` | Press Undo three times | The bowl is back at Centre x 0, Centre y 100 | Each nudge being exactly one undo entry |
| 32 | `suite` | Drag the bowl's bottom-right handle outward and release, then press Undo | While dragging, the bowl grows and keeps its rounded ends; on release Width and Depth have grown; Undo restores 304 × 450 | `resizeBox` keeping bulges, and the drag's preview committing as one write |
| 33 | `suite` | Click the tank, choose Bend edges, drag the tank's front edge handle toward the bowl and release; then press Undo | That one edge bows toward the bowl while the other three stay straight; Undo straightens it | The plan editor's `CurveTool` bound to a detail outline through `CurveToolActions` |
| 34 | `obsidian` | With the tank selected, press Ctrl+D (Cmd+D on macOS) | A copy of the tank appears 100 mm right and 100 mm down, drawn above the original, and it is the selection; its Name reads tank | Ctrl+D reaching the canvas region rather than an Obsidian hotkey, and `duplicateDetail` inserting above the original and selecting `nextDetailId` |
| 35 | `obsidian` | Press Delete | The copy disappears and the Inspector shows no Detail section | Delete reaching the canvas region rather than Obsidian's keymap, and the selection clearing once the part no longer exists |
| 36 | `suite` | Click inside the footprint beside the bowl (between the bowl's side and the footprint's side), then press "Fit to details" | The Inspector showed a "Footprint" section with Fit to details; afterwards the round front is gone and Dimensions read 380 × 675 mm | `fitFootprintToDetails` writing the box of the tank and the bowl as a typed rectangle |
| 37 | `suite` | Press Undo | The round-fronted footprint returns and Dimensions read 380 × 700 mm | The fit being one undo entry |
| 38 | `suite` | With the footprint selected, choose Edit points, drag its back-left corner about 100 mm further left and release, then press Undo | A round handle sits on each of the four corners; the dragged corner follows the pointer and the round front stays round; Undo restores it | Vertex handles through the snap service, and `moveVertex` keeping the curves of the edges it does not touch |
| 39 | `suite` | Click exactly on the anchor dot, type 50 into "Position x in millimetres" and press Enter; then press Undo | The Inspector shows an "Anchor" section and no mode control; the dot moves 50 mm right; Undo puts it back | The anchor winning over the bowl beneath it (hit order step 2) and the Inspector's commit on Enter |
| 40 | `suite` | Click Draw rectangle and drag a box inside the footprint, clear of every corner; then press Undo | A solid rectangle detail appears, is the selection, and the toolbar shows Select pressed again; Undo removes it | `draw-rect` → `addDetail`, the new detail selected, and every draw returning to Select |
| 41 | `browser` | Select the bowl again and narrow the pane to about 460 px | The toolbar and the mode control wrap rather than truncate, and every field of the Detail section stays readable without scrolling sideways | The mode control and the inspector section at a sidebar leaf's real width, which no fixed capture takes |
| 42 | `suite` | Click on empty canvas outside the clearance | The selection clears and the mode control disappears | PBI extension 1a — a click on nothing clears rather than keeping the previous selection |
| 43 | `suite` | Click "Edit dimensions", type width 760 and depth 1400, and save; then press Undo | The whole symbol doubles about the anchor — footprint, round front, tank and bowl — and Dimensions read 760 × 1400 mm; Undo restores 380 × 700 | Set dimensions taking `scaleDesign` on a design with details, where a plain rectangle would have replaced the drawing |

## Steps — a plain item promoted to the library

Preconditions: a project with a floor that has walls and one Room, open in the Plan Editor —
[[Add an item to the asset library]]'s own.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 44 | `obsidian` | Follow [[Add an item to the asset library]] steps 1 to 8 with a rectangle item named `Cabinet` | The item redraws as a placement with exactly the outline it had, and its Inspector offers Open in designer | Promotion storing an item's outline exactly (`centredFootprint` → `SetAssetFootprint`) |
| 45 | `obsidian` | Choose Open in designer | A designer tab opens on `Cabinet` with its footprint drawn, no details, and no unscaled warning | The promoted asset reaching the designer as a measured footprint |
| 46 | `suite` | Click Select, then click inside the footprint | A "Footprint" section shows Width and Depth equal to the Dimensions line, and no Fit to details button | PBI extension 2a — no control for details the asset does not carry |

There is deliberately no step promoting a CURVED item: a plan item carries no curve today, so
promotion has nothing to lose (the symbols spec's Amendment 1, "Plan items carry no curves"). That
step belongs to the commit that adds `bulges` to `SpatialElement`.

## Deliberately NOT checked
```

(The Runs table is left as it is: not run.)

Edit `docs/tests/suites/Smoke Test the Editor.md` — re-run the section's own two greps rather than incrementing, and write what they print:

```bash
grep -rhoE '^\| [0-9]+[a-z]? \| `(suite|browser|obsidian|desktop|judgement)` \|' docs/tests/cases/*.md | grep -oE 'suite|browser|obsidian|desktop|judgement' | sort | uniq -c
grep -ohE '^\s*[0-9]+[a-z]?\.\s+`(suite|browser|obsidian|desktop|judgement)`' 'docs/tests/cases/Canvas Navigation.md' | grep -oE 'suite|browser|obsidian|desktop|judgement' | sort | uniq -c
```

Measured before this task on this branch: table rows suite 108, browser 51, obsidian 170, desktop 8, judgement 12 (349); list steps suite 4, browser 5, obsidian 2, desktop 6, judgement 1 (18). This task's rows add suite 13, browser 1, obsidian 4. So the greps should print, summed across both, **suite 125, browser 57, obsidian 176, desktop 14, judgement 13 — 367 table rows plus 18 list steps, 385**. If they print anything else, write what they print and say why in the paragraph below.

The table — old:
```md
| `suite` | The pass condition is DOM state, a render model, a command outcome or a vault file — expressible in the jsdom suite with no new infrastructure | 110 |
```
new:
```md
| `suite` | The pass condition is DOM state, a render model, a command outcome or a vault file — expressible in the jsdom suite with no new infrastructure | 125 |
```
old:
```md
| `browser` | Needs a real engine: layout, the CSS cascade, focus BEHAVIOUR or a visible focus ring, paint, or an input grammar jsdom cannot produce. Not focus ASSIGNMENT — jsdom models `activeElement`, so "the caret lands on Start" is `suite` | 54 |
```
new:
```md
| `browser` | Needs a real engine: layout, the CSS cascade, focus BEHAVIOUR or a visible focus ring, paint, or an input grammar jsdom cannot produce. Not focus ASSIGNMENT — jsdom models `activeElement`, so "the caret lands on Start" is `suite` | 57 |
```
old:
```md
| `obsidian` | Needs Obsidian itself — its chrome, keymap, workspace, settings pane, language, `Notice`, its copy of pdf.js, or its file explorer | 153 |
```
new:
```md
| `obsidian` | Needs Obsidian itself — its chrome, keymap, workspace, settings pane, language, `Notice`, its copy of pdf.js, or its file explorer | 176 |
```
(`desktop` 14 and `judgement` 13 are unchanged.)

The total — old:
```md
**344 steps across TWENTY-ONE cases, re-run in the edit that added [[Recover from a stale read]]
and [[Reload a room]] — 327 table rows across twenty table-form cases plus the same 17 list steps
in [[Canvas Navigation]].**
```
new:
```md
**385 steps — 367 table rows plus 18 list steps in [[Canvas Navigation]] — re-run in the edit that
added the selection steps to [[Design an Asset]].** The table read 344 until that edit while the
greps already printed 349 + 18 over the tree it was taken from: increments between the two had
added rows without re-running them, which is why this figure was read off the greps rather than
taken as 344 plus the eighteen rows that edit added. What follows is the previous measurement's
own account, kept as history.
```

- [ ] **Step 8: The backlog notes**

Edit `docs/requirements/Select part of an object's shape.md` — frontmatter old:
```md
status: New
started: ""
finished: ""
```
new:
```md
status: Done
started: "2026-09-13"
finished: "2026-09-14"
```

old:
```md
## Open question

**Whether the first version edits whole parts or individual vertices.** Moving a whole clearance
boundary and dragging one footprint vertex are different capabilities with different hit-testing:
the first needs one hit-test per part, the second needs vertex handles, a grab radius and a
tolerance in screen pixels. Raised rather than assumed, because building the second when only the
first was wanted is most of the cost.
```
new:
```md
## Open question — answered

**Whether the first version edits whole parts or individual vertices.** Moving a whole clearance
boundary and dragging one footprint vertex are different capabilities with different hit-testing:
the first needs one hit-test per part, the second needs vertex handles, a grab radius and a
tolerance in screen pixels. Raised rather than assumed, because building the second when only the
first was wanted is most of the cost.

**Answered: both**, as three modes on one selection, so a rectangle's corner handles and its vertex
handles never compete for one pointer — Transform moves, resizes and rotates the whole part, Edit
points drags its vertices, Bend edges bows its edges — and a detail is a selectable part beside the
four this item names. The hit order and the modes are Decisions 9 and 10 of
`docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`; its Amendment 1 records what
was decided while planning. The plan is `docs/superpowers/plans/2026-09-13-asset-designer-symbols-pr2.md`.
```

Edit `docs/requirements/Start an asset from a preset.md` — old:
```md
status: In progress
started: "2026-09-13"
finished: ""
```
new:
```md
status: Done
started: "2026-09-13"
finished: "2026-09-13"
```

Edit `docs/issues/The designer offers no selection, because nothing there was selectable.md` — frontmatter old:
```md
status: New
started: ""
finished: ""
```
new:
```md
status: Done
started: "2026-09-13"
finished: "2026-09-14"
```

Append at the end of the file:
```md

## Outcome

Selection came back on 2026-09-13, with its candidates and its gesture together — the condition
this note set. The candidates are `hitDesign` (`src/presentation/designer/selection/hitTest.ts`), a
stated six-step hit order over the footprint, the clearance, each detail, the anchor and the
facing; the gesture is `DesignerSelectTool`
(`src/presentation/designer/tools/designer-select-tool.ts`), whose every drag is one conditional
`SetAssetShape` write. The inspector reads the selection, and the toolbar's exact-list test was
changed deliberately in the same pull request to offer Select again.

The trigger this note named — a correction a renovator cannot make by redrawing — was not waited
for: a preset gives an asset a tank and a bowl that nothing else can nudge, which is that trigger
arriving by construction. The design is `docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`
(Decisions 9–11 and Amendment 1); the plan is
`docs/superpowers/plans/2026-09-13-asset-designer-symbols-pr2.md`.
```

- [ ] **Step 9: The changelog**

Edit `CHANGELOG.md` — old:
```md
### Added

- Plan editor: draw structural Posts and Beams
```
new:
```md
### Added

- Asset designer: select the footprint, the clearance, a detail, the anchor or the facing and change just that part — move, resize and rotate it with handles (Transform), drag its corners (Edit points) or bow its edges (Bend edges); nudge it with the arrow keys, duplicate a detail with Ctrl+D and delete a detail or the clearance with Delete. The Inspector edits the selected part's position, size, rotation, name, line and drawing order, the anchor's position and the facing's angle, and fits the footprint to its details. Draw rectangle, Draw circle and Trace detail add details, and a detail drawn over an uncalibrated spec sheet waits for its scale. Set dimensions scales a design with details or curved edges about its anchor instead of replacing it with a rectangle. Every change is one undoable write, refused when another pane changed the asset first.
- Plan editor: a placed asset with details redraws its outline over them, so a solid detail no longer hides the edge of the object.
- Plan editor: draw structural Posts and Beams
```

- [ ] **Step 10: Lint**

```bash
npx eslint tests/harness/assetDesigner.ts tests/harness/page.ts tests/build/harness-shot.test.ts
npx oxlint scripts/harness-shot.mjs
```

Expected: no finding (`tests/build/harness-shot.test.ts` stays under the 450-line test budget, counted without comments).

- [ ] **Step 11: Commit**

```bash
git add tests/harness/assetDesigner.ts tests/harness/page.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts "docs/tests/cases/Design an Asset.md" "docs/tests/suites/Smoke Test the Editor.md" "docs/requirements/Select part of an object's shape.md" "docs/requirements/Start an asset from a preset.md" "docs/issues/The designer offers no selection, because nothing there was selectable.md" CHANGELOG.md
git commit -m "docs(designer): selection captures, manual steps, backlog and changelog

The designer harness takes &select= and &mode= beside &preset=, and harness-shot
captures each selection mode and the anchor. Design an Asset gains a toilet
adjusted by selection and a plain item promoted to the library; the triage
figures are re-run. Select part of an object's shape, Start an asset from a
preset and the no-selection issue are done.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

