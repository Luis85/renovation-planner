# Asset designer snapping, guides and grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parts of an asset snap while they are moved, resized and drawn — to other parts' corners, edges and alignments, and to a zoom-following grid — with dashed guides, a View menu (Grid, Snap) remembered per device, and a grid-step readout.

**Architecture:** The Plan Editor's one `SnapService` gains a grid stage fed through `SnapCandidates.grid`, so the Plan Editor (which never supplies a grid) is unchanged. The designer supplies richer candidates (edges, alignments) and, while the grid is shown, a grid from one pure function `designerGrid(shape, worldPerPixel)`. Drag snapping moves into `designer/selection/dragSnap.ts`; the select and draw tools publish guides to `RenderState.snapGuides`, which the designer's gesture layer draws with the existing `SnapGuides.vue`. The View menu, its dismissal behaviour and the preference seeding are shared with the Plan Editor through two extracted composables.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Pinia, vue-konva/Konva, Vitest (node + jsdom), axe-core, Playwright captures.

**Spec:** `docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md`

## Global Constraints

- Work in the worktree `C:\Projects\renovation-planner\.claude\worktrees\room-wall-boundaries-288627` on branch `claude/asset-designer-ux-ui-e79b3f`. If `node_modules` is empty, run `npm ci` there first.
- Every commit message ends with exactly `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` — this overrides any trailer naming another model.
- Inner loop per task: `npm run check:fast -- <test paths>` (append `--testTimeout=20000` if cases time out under machine load) **and** `npx eslint <every changed .ts/.vue file>` — `check:fast` omits `eslint .`, which is where the layer bans, Vue rules and `no-deprecated` live. Do not run `npm run check` locally; CI runs it on the PR.
- Before opening the PR: `npx fallow dead-code` and `npx fallow dupes` must report nothing new.
- Budgets: `src/**` 400 counted lines per file, `tests/**` 450, 100 lines per function, complexity 16.
- No user-visible literal strings: new keys go in `src/presentation/i18n/locales/en/assetSymbols.ts` and `…/de/assetSymbols.ts` (`en.ts`/`de.ts` are at budget).
- CSS: Obsidian variables only, no literal colours.
- Values fixed by the spec: tolerance `SNAP_TOLERANCE_PX` (8) × `worldPerScreenPixel`; precedence vertex > edge > axis alignment > grid step > raw; grid steps 1, 5, 10, 50, 100, 500, 1000, 5000 mm, smallest at least 12 px on screen; grid origin = the committed footprint's bounding-box minimum, `{0,0}` with no shape; device key `${pluginId}:designer-view`; defaults Grid off, Snap on.
- The Plan Editor's behaviour does not change: `tests/presentation/editor` stays green throughout.
- Every new case is watched failing before the change that turns it green. Where a task says a case passes before the change (a regression pin or a refactor), that is stated.
- **Mounted-designer tolerance:** at `designerRig`'s default camera (10 mm per pixel) the snap tolerance is 80 mm. If an EXISTING mounted drag case lands somewhere new because of the new targets, do not rewrite its expected value: move that drag's end to a point with no vertex, edge or alignment within 80 mm, say so in a one-line comment, and report it in the task summary.

---

### Task 1: The grid stage in `SnapService`

**Files:**
- Modify: `src/presentation/editor/snapping/snap-service.ts` (`SnapCandidates`, `snapPointWithGuides`, `snapTranslation`, new `SnapGrid` type and `toGrid` helper)
- Test: `tests/presentation/editor/snapping/snapServiceGuides.test.ts`

**Interfaces:**
- Produces: `export interface SnapGrid { readonly step: number; readonly origin: Point }`; `SnapCandidates.grid?: SnapGrid`. `snapPointWithGuides` and `snapTranslation` signatures unchanged.

- [ ] **Step 1: Write the failing tests** — append to `tests/presentation/editor/snapping/snapServiceGuides.test.ts`:

```ts
describe('the grid stage', () => {
	const grid = { step: 50, origin: { x: 10, y: 0 } };
	const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
	const shifted = (dx: number, dy: number) => square.map((point) => ({ x: point.x + dx, y: point.y + dy }));

	it('rounds a point onto the grid counted from its origin, and draws no guide for it', () => {
		// x: 10 + round(113 / 50) * 50 = 110; y: round(77 / 50) * 50 = 100.
		expect(service().snapPointWithGuides({ x: 123, y: 77 }, { grid })).toEqual({ point: { x: 110, y: 100 }, guides: [] });
	});

	it('rounds only the axis an alignment left undecided', () => {
		expect(service().snapPointWithGuides({ x: 103, y: 77 }, { alignments: [{ x: 100, y: 900 }], grid })).toEqual({
			point: { x: 100, y: 100 },
			guides: [{ start: { x: 100, y: 100 }, end: { x: 100, y: 900 } }],
		});
	});

	it('a vertex within tolerance wins over a nearer grid line', () => {
		// The grid line at x = 60 is 2 away; the vertex is 8 away and still wins.
		expect(service().snapPointWithGuides({ x: 58, y: 0 }, { vertices: [{ x: 66, y: 0 }], grid }).point).toEqual({ x: 66, y: 0 });
	});

	it('still rounds onto the grid with automatic snapping off, and onto nothing else', () => {
		expect(disabled().snapPointWithGuides({ x: 123, y: 77 }, { vertices: [{ x: 123, y: 77 }], alignments: [{ x: 120, y: 80 }], grid }))
			.toEqual({ point: { x: 110, y: 100 }, guides: [] });
	});

	it('answers the input object itself with automatic snapping off and no grid', () => {
		const point = { x: 123, y: 77 };
		expect(disabled().snapPointWithGuides(point, { vertices: [point] }).point).toBe(point);
	});

	it('lands a moving set’s minimum corner on the grid with one correction for every point', () => {
		// Minimum (23, 38): x → 10, the origin, nearer than 60; y → 50.
		expect(service().snapTranslation(shifted(23, 38), { grid })).toEqual({ correction: { dx: -13, dy: 12 }, guides: [] });
	});

	it('corrects x by an alignment and y by the grid', () => {
		const result = service().snapTranslation(shifted(3, 38), { alignments: [{ x: 0, y: 900 }], grid });
		expect(result.correction).toEqual({ dx: -3, dy: 12 });
		expect(result.guides).toHaveLength(1);
	});

	it('still lands a moving set on the grid with automatic snapping off', () => {
		expect(disabled().snapTranslation(shifted(23, 38), { vertices: [{ x: 23, y: 38 }], grid }).correction).toEqual({ dx: -13, dy: 12 });
	});

	it('moves nothing for an empty moving set, grid or not', () => {
		expect(service().snapTranslation([], { grid })).toEqual({ correction: { dx: 0, dy: 0 }, guides: [] });
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/presentation/editor/snapping/snapServiceGuides.test.ts`
Expected: FAIL — the grid cases answer the raw point / a zero correction (6 cases red; the identity and empty-set cases pass already).

- [ ] **Step 3: Implement** — in `snap-service.ts`:

Add after the `SnapCandidates` interface's opening docblock, inside the interface:

```ts
	/**
	 * A grid every position may round onto, AFTER vertex, edge and axis alignment have declined — and, unlike
	 * them, whether or not automatic snapping is enabled: a grid is shown by its own choice and snapped to only
	 * while shown, which is the caller's to decide by supplying it. The Plan Editor supplies none.
	 */
	readonly grid?: SnapGrid;
```

Add above `SnapCandidates`:

```ts
/** A grid of `step` millimetres counted from `origin`. */
export interface SnapGrid {
	readonly step: number;
	readonly origin: Point;
}
```

Add beside `roundToStep`:

```ts
/** `value` on `grid` along `axis`, or `value` itself with no grid. */
function toGrid(value: number, grid: SnapGrid | undefined, axis: 'x' | 'y'): number {
	return grid === undefined ? value : grid.origin[axis] + roundToStep(value - grid.origin[axis], grid.step);
}
```

Replace the body of `snapPointWithGuides` (keep its docblock, and change its precedence sentence to "The order is vertex > edge > axis alignment > grid step > the original point (spec §3.2; asset designer snapping spec §3)"):

```ts
	snapPointWithGuides(point: Point, candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): SnapResult {
		const vertex = this.snapToVertex(point, candidates.vertices ?? [], toleranceMm);
		if (vertex !== null) return { point: vertex, guides: [{ start: point, end: vertex }] };
		const edge = this.snapToEdge(point, candidates.edges ?? [], toleranceMm);
		if (edge !== null) return { point: edge, guides: [{ start: point, end: edge }] };
		const alignments = this.enabled ? candidates.alignments ?? [] : [];
		const alongX = nearestAlignment(point.x, alignments, 'x', toleranceMm);
		const alongY = nearestAlignment(point.y, alignments, 'y', toleranceMm);
		const grid = candidates.grid;
		if (alongX === null && alongY === null && grid === undefined) return { point, guides: [] };
		const landed = { x: alongX?.x ?? toGrid(point.x, grid, 'x'), y: alongY?.y ?? toGrid(point.y, grid, 'y') };
		const guides: LineSegment[] = [];
		if (alongX !== null) guides.push({ start: landed, end: alongX });
		if (alongY !== null) guides.push({ start: landed, end: alongY });
		return { point: landed, guides };
	}
```

Replace the body of `snapTranslation` (keep its docblock; add "then, per axis no alignment decided, the grid stage lands the moving set's minimum on `candidates.grid`"):

```ts
	snapTranslation(moving: readonly Point[], candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): TranslationSnap {
		const grid = candidates.grid;
		if (moving.length === 0 || (!this.enabled && grid === undefined)) return { correction: { dx: 0, dy: 0 }, guides: [] };
		const pair = nearestPair(moving, (from) => this.snapToVertex(from, candidates.vertices ?? [], toleranceMm))
			?? nearestPair(moving, (from) => this.snapToEdge(from, candidates.edges ?? [], toleranceMm));
		if (pair !== null) {
			return { correction: { dx: pair.to.x - pair.from.x, dy: pair.to.y - pair.from.y }, guides: [{ start: pair.from, end: pair.to }] };
		}
		const alignments = this.enabled ? candidates.alignments ?? [] : [];
		const { minX, maxX, minY, maxY } = extentOf(moving);
		const features = [...moving, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }];
		const alongX = nearestAxisMatch(features, alignments, 'x', toleranceMm);
		const alongY = nearestAxisMatch(features, alignments, 'y', toleranceMm);
		const correction: Vector = { dx: alongX?.delta ?? toGrid(minX, grid, 'x') - minX, dy: alongY?.delta ?? toGrid(minY, grid, 'y') - minY };
		const guides: LineSegment[] = [];
		if (alongX !== null) guides.push({ start: { x: alongX.feature.x + correction.dx, y: alongX.feature.y + correction.dy }, end: alongX.to });
		if (alongY !== null) guides.push({ start: { x: alongY.feature.x + correction.dx, y: alongY.feature.y + correction.dy }, end: alongY.to });
		return { correction, guides };
	}
```

Update the `enabled` getter's docblock to: `/** Per-surface automatic object snapping — vertex, edge and alignment. A supplied grid is honoured either way; explicit Shift constraints remain available. */`

- [ ] **Step 4: Run the snapping suites and the Plan Editor's tools**

Run: `npm run check:fast -- tests/presentation/editor/snapping tests/presentation/editor/tools`
Expected: PASS, including every pre-existing case (the Plan Editor never supplies `grid`).
Then: `npx eslint src/presentation/editor/snapping/snap-service.ts tests/presentation/editor/snapping/snapServiceGuides.test.ts` — no output.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/snapping/snap-service.ts tests/presentation/editor/snapping/snapServiceGuides.test.ts
git commit -m "feat(snapping): a grid stage after axis alignment, honoured with object snapping off" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The designer's snap targets and its grid

**Files:**
- Modify: `src/presentation/designer/selection/snapCandidates.ts`
- Create: `src/presentation/designer/grid/designerGrid.ts`
- Test: `tests/presentation/designer/selection/snapCandidates.test.ts`, Create `tests/presentation/designer/grid/designerGrid.test.ts`

**Interfaces:**
- Consumes: `SnapGrid`, `SnapCandidates` (Task 1).
- Produces: `designerSnapCandidates(shape: AssetShape | null, exclude: Iterable<string>): SnapCandidates` now with `vertices`, `edges`, `alignments`; `export function designerGrid(shape: AssetShape | null, worldPerPixel: number): SnapGrid`.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe` in `tests/presentation/designer/selection/snapCandidates.test.ts` (add the imports at the top):

```ts
import { QUARTER, editableShape } from '../../../helpers/assetShapes';
```

```ts
	it('offers every outline’s edges with their bulges, so a curved detail is snapped along its arc', () => {
		const { edges } = designerSnapCandidates(editableShape(), []);

		expect(edges).toHaveLength(12);
		expect(edges?.[0]).toEqual({ start: { x: -500, y: -300 }, end: { x: 500, y: -300 }, bulge: 0 });
		expect(edges?.slice(-4).map((edge) => edge.bulge)).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('offers each outline’s vertices and curve-aware box centre, and the anchor, as alignments', () => {
		const shape = editableShape();

		expect(designerSnapCandidates(shape, []).alignments).toEqual([
			...shape.footprint.points, { x: 0, y: 0 },
			...shape.details[0].outline.points, { x: -200, y: 0 },
			...shape.details[1].outline.points, { x: 250, y: 0 },
			shape.anchor,
		]);
	});

	it('leaves the dragged parts out of the edges and the alignments too', () => {
		const shape = editableShape();
		const found = designerSnapCandidates(shape, new Set(['footprint', partKey({ kind: 'detail', id: 'detail-2' }), 'anchor']));

		expect(found.edges).toHaveLength(4);
		expect(found.alignments).toEqual([...shape.details[0].outline.points, { x: -200, y: 0 }]);
	});
```

Create `tests/presentation/designer/grid/designerGrid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { designerGrid } from '../../../../src/presentation/designer/grid/designerGrid';
import { editableShape } from '../../../helpers/assetShapes';

/** Asset designer snapping spec 2026-09-15, §2.4: a step the screen can afford, counted from the footprint's corner. */
describe('designerGrid', () => {
	it.each([
		[0.05, 1],
		[0.25, 5],
		[0.5, 10],
		[1, 50],
		[5, 100],
		[10, 500],
		[100, 5000], // MIN_ZOOM's camera
		[1000, 5000], // past the series, the coarsest step is kept
	])('at %f mm per pixel the step is %i mm — the smallest of the series at least 12 px wide', (worldPerPixel, step) => {
		expect(designerGrid(null, worldPerPixel).step).toBe(step);
	});

	it('counts from the footprint’s top-left corner, so an offset from an edge is a whole number of steps', () => {
		expect(designerGrid(editableShape(), 1).origin).toEqual({ x: -500, y: -300 });
	});

	it('counts from the world origin before there is a footprint', () => {
		expect(designerGrid(null, 1).origin).toEqual({ x: 0, y: 0 });
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/presentation/designer/selection/snapCandidates.test.ts tests/presentation/designer/grid/designerGrid.test.ts`
Expected: FAIL — `edges`/`alignments` are undefined; `designerGrid` cannot be imported.

- [ ] **Step 3: Implement**

Replace `src/presentation/designer/selection/snapCandidates.ts` with:

```ts
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapCandidates } from '../../editor/snapping/snap-service';
import { partKey } from './designerSelection';

/** An outline's segments, each with its own bulge, as `SnapService.snapToEdge` projects onto them. */
function edgesOf(outline: CurvedPolygon): NonNullable<SnapCandidates['edges']> {
	return outline.points.map((start, index) => ({
		start,
		end: outline.points[(index + 1) % outline.points.length],
		bulge: outline.bulges?.[index] ?? 0,
	}));
}

/** The centre of an outline's curve-aware box — the extent the inspector reads dimensions from. */
function centreOf(outline: CurvedPolygon): Point {
	const { min, max } = unwrap(boundingBoxOf(outline));
	return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
}

/**
 * What a designer gesture may snap to (asset designer snapping spec 2026-09-15, §2.2): the vertices and edges of
 * the footprint and every detail, their vertices and box centres to line up with, and the anchor — minus the
 * parts whose partKey is in `exclude`. The clearance is no target. `{}` for a null shape.
 */
export function designerSnapCandidates(shape: AssetShape | null, exclude: Iterable<string>): SnapCandidates {
	if (shape === null) return {};
	const skip = new Set(exclude);
	const outlines = [
		...(skip.has('footprint') ? [] : [shape.footprint]),
		...shape.details
			.filter((detail) => !skip.has(partKey({ kind: 'detail', id: detail.id })))
			.map((detail) => detail.outline),
	];
	const anchor = skip.has('anchor') ? [] : [shape.anchor];
	return {
		vertices: [...outlines.flatMap((outline) => outline.points), ...anchor],
		edges: outlines.flatMap(edgesOf),
		alignments: [...outlines.flatMap((outline) => [...outline.points, centreOf(outline)]), ...anchor],
	};
}
```

Create `src/presentation/designer/grid/designerGrid.ts`:

```ts
import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapGrid } from '../../editor/snapping/snap-service';

/** The steps a designer grid takes, in millimetres. `MIN_ZOOM`'s 100 mm per pixel still finds 5000. */
const STEPS_MM = [1, 5, 10, 50, 100, 500, 1000, 5000] as const;

/** The least screen distance between two grid lines; below it the grid reads as a tint, not as lines. */
const MIN_STEP_PX = 12;

/**
 * The designer's grid at a camera (asset designer snapping spec 2026-09-15, §2.4): the smallest step at least
 * `MIN_STEP_PX` wide on screen, counted from the committed footprint's box minimum — so an offset from the
 * footprint's edge is a whole number of steps — or from the world origin before there is a footprint. ONE
 * function for the drawn grid, the snapped grid and the status readout, so the three cannot disagree.
 */
export function designerGrid(shape: AssetShape | null, worldPerPixel: number): SnapGrid {
	const step = STEPS_MM.find((candidate) => candidate / worldPerPixel >= MIN_STEP_PX) ?? STEPS_MM[STEPS_MM.length - 1];
	return { step, origin: shape === null ? { x: 0, y: 0 } : unwrap(boundingBoxOf(shape.footprint)).min };
}
```

- [ ] **Step 4: Run the designer's selection and tool suites**

Run: `npm run check:fast -- tests/presentation/designer`
Expected: PASS. The unit rigs already read `designerSnapCandidates`, so the new targets reach the existing select-tool cases now: they must stay green (the plan's arithmetic checked the toilet's body, anchor and vertex cases against the new alignments). Apply the Global Constraints' mounted-tolerance rule to any mounted case that moves.
Then `npx eslint` on the four changed files.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/designer/selection/snapCandidates.ts src/presentation/designer/grid/designerGrid.ts tests/presentation/designer/selection/snapCandidates.test.ts tests/presentation/designer/grid/designerGrid.test.ts
git commit -m "feat(designer): edges, alignments and a zoom-following grid as snap targets" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The select and draw tools snap every positional gesture and publish guides

**Files:**
- Create: `src/presentation/designer/selection/dragSnap.ts`
- Modify: `src/presentation/designer/tools/designer-select-tool.ts` (`shapeAt`, `lift`, `press`, `dropGesture`; delete the private `dragTarget` and its docblock; drop the unused `SNAP_TOLERANCE_PX` import)
- Modify: `src/presentation/designer/tools/draw-detail-tool.ts` (`snapped`, `drop`)
- Test: Create `tests/presentation/designer/tools/designerSelectSnapping.test.ts`; modify `tests/presentation/designer/tools/drawDetailTool.test.ts`

**Interfaces:**
- Consumes: `SnapCandidates` with `alignments`/`grid` (Tasks 1–2), `DragStart` (`selection/selectionDrag.ts`), `boxHandlePoint` (`selection/handles.ts`).
- Produces: `export interface DragTarget { readonly to: Point; readonly guides: LineSegment[] }`; `export function dragTarget(context: EditorContext, start: DragStart, event: EditorPointerEvent): DragTarget`.

- [ ] **Step 1: Write the failing tests**

Create `tests/presentation/designer/tools/designerSelectSnapping.test.ts`:

```ts
/**
 * `DesignerSelectTool`'s snapping (asset designer snapping spec 2026-09-15, §2.1 and §4.4), driven directly over
 * the real snap service at one millimetre per pixel — 8 mm of tolerance. Two 100 mm squares on a 1000 x 600
 * footprint: A at x -350..-250, y -200..-100 and B at x 150..250, y 50..150, so every landing below is
 * arithmetic a reader can redo.
 */
import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { designerSnapCandidates } from '../../../../src/presentation/designer/selection/snapCandidates';
import { editableShape } from '../../../helpers/assetShapes';
import { selectToolRig, type SelectToolRig } from '../../../helpers/designerSelection';
import { flushGesture, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';

const A = rect(100, 100, -300, -150);
const B = rect(100, 100, 200, 100);
const SHAPE = editableShape({
	details: [
		{ id: 'detail-1', name: 'rectangle', outline: A, line: 'solid', pending: false },
		{ id: 'detail-2', name: 'rectangle', outline: B, line: 'solid', pending: false },
	],
});
const A_SELECTED = { kind: 'detail', id: 'detail-1' } as const;

const shifted = (outline: CurvedPolygon, dx: number, dy: number) => outline.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
const written = (rig: SelectToolRig, id: string) => rig.written[0]?.shape.details.find((detail) => detail.id === id)?.outline.points;

describe('moving a part', () => {
	it('lines a moved part up with a neighbour’s edge, commits what it previewed, and clears the guide at release', async () => {
		const rig = selectToolRig({ shape: SHAPE });
		rig.tool.activate(rig.harness.context);

		// B's left edge travels to x = -347, 3 mm from A's left edge at -350.
		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(-297, 100));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(-297, 100));
		await flushGesture();

		expect(written(rig, 'detail-2')).toEqual(shifted(B, -500, 0));
		expect(midDrag).toHaveLength(1);
		expect([midDrag[0]?.start.x, midDrag[0]?.end.x]).toEqual([-350, -350]);
		expect(rig.previews.filter((preview) => preview !== null).at(-1)).toEqual(rig.written[0]?.shape);
		expect(rig.harness.context.renderState.snapGuides).toEqual([]);
	});

	it('lands a moved part’s top-left corner on a supplied grid, with no guide for it', async () => {
		const rig = selectToolRig({
			shape: SHAPE,
			context: {
				snapCandidates: (exclude) => ({ ...designerSnapCandidates(SHAPE, exclude ?? []), grid: { step: 50, origin: { x: -500, y: -300 } } }),
			},
		});
		rig.tool.activate(rig.harness.context);

		// Raw travel (37, 12) puts B's corner at (187, 62); the grid from (-500, -300) takes it to (200, 50).
		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(237, 112));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(237, 112));
		await flushGesture();

		expect(written(rig, 'detail-2')).toEqual(shifted(B, 50, 0));
		expect(midDrag).toEqual([]);
	});

	it('clears its guides when the drag is cancelled, and when the tool is switched away', () => {
		const rig = selectToolRig({ shape: SHAPE });
		const context = rig.harness.context;
		rig.tool.activate(context);

		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(-297, 100));
		expect(context.renderState.snapGuides).toHaveLength(1);
		rig.tool.cancel();
		expect(context.renderState.snapGuides).toEqual([]);

		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(-297, 100));
		rig.tool.deactivate();
		expect(context.renderState.snapGuides).toEqual([]);
	});
});

describe('resizing from a box handle', () => {
	it('snaps a corner handle onto a neighbour’s corner', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		// A's bottom-right handle (-250, -100) dropped 5 mm from B's top-left corner (150, 50).
		rig.tool.pointerDown(pointerAt(-250, -100));
		rig.tool.pointerMove(pointerAt(146, 47));
		rig.tool.pointerUp(pointerAt(146, 47));
		await flushGesture();

		expect(written(rig, 'detail-1')).toEqual([{ x: -350, y: -200 }, { x: 150, y: -200 }, { x: 150, y: 50 }, { x: -350, y: 50 }]);
	});

	it('snaps a side handle on the axis it moves, to alignments only, never onto an edge it passes', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		// A's right-middle handle (-250, -150) dropped at (143, 60): 7 mm from B's left edge x = 150, and 7 mm from
		// that EDGE itself — an edge snap would draw a horizontal guide, an alignment draws a vertical one.
		rig.tool.pointerDown(pointerAt(-250, -150));
		rig.tool.pointerMove(pointerAt(143, 60));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(143, 60));
		await flushGesture();

		expect(written(rig, 'detail-1')).toEqual([{ x: -350, y: -200 }, { x: 150, y: -200 }, { x: 150, y: -100 }, { x: -350, y: -100 }]);
		expect(midDrag).toHaveLength(1);
		expect([midDrag[0]?.start.x, midDrag[0]?.end.x]).toEqual([150, 150]);
	});

	/** Passes before this task too: it pins that proportional resize stays unsnapped (spec §2.5). */
	it('takes the raw point and draws no guide while Shift keeps proportions', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(-250, -150));
		rig.tool.pointerMove(shiftPointerAt(143, 60));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(shiftPointerAt(143, 60));
		await flushGesture();

		expect(Math.max(...(written(rig, 'detail-1') ?? []).map((point) => point.x))).toBeCloseTo(143, 9);
		expect(midDrag).toEqual([]);
	});
});
```

Append to the `describe` that holds `'snaps the press and the release onto a candidate vertex'` in `tests/presentation/designer/tools/drawDetailTool.test.ts`:

```ts
	it('draws the guide that decided a landing, and clears it when the drag ends or is cancelled', async () => {
		const r = rig({ snapCandidates: () => ({ alignments: [{ x: 100, y: 900 }] }) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(5, 5));
		r.tool.pointerMove(pointerAt(103, 400));
		const midDrag = r.harness.context.renderState.snapGuides;
		r.tool.pointerUp(pointerAt(103, 400));
		await flushGesture();

		expect(midDrag).toEqual([{ start: { x: 100, y: 400 }, end: { x: 100, y: 900 } }]);
		expect(r.outlines).toEqual([rectOutline({ x: 5, y: 5 }, { x: 100, y: 400 })]);
		expect(r.harness.context.renderState.snapGuides).toEqual([]);

		r.tool.pointerDown(pointerAt(103, 5));
		expect(r.harness.context.renderState.snapGuides).toHaveLength(1);
		r.tool.cancel();
		expect(r.harness.context.renderState.snapGuides).toEqual([]);
	});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/presentation/designer/tools/designerSelectSnapping.test.ts tests/presentation/designer/tools/drawDetailTool.test.ts`
Expected: FAIL — body, grid, corner and side cases land on the raw point; guides are never written. The Shift case passes (stated above).

- [ ] **Step 3: Implement**

Create `src/presentation/designer/selection/dragSnap.ts`:

```ts
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import { unwrap } from '../../../core/result/Result';
import { outlineOf, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { SNAP_TOLERANCE_PX } from '../../editor/handleMetrics';
import type { SnapCandidates } from '../../editor/snapping/snap-service';
import type { EditorContext } from '../../editor/tools/editor-context';
import type { EditorPointerEvent } from '../../editor/tools/editor-tool';
import { isOutlineSelection, partKey } from './designerSelection';
import { boxHandlePoint } from './handles';
import type { DragStart } from './selectionDrag';

/** Where a drag lands — the `to` `draggedShape` is handed — and the guides that say why. */
export interface DragTarget {
	readonly to: Point;
	readonly guides: LineSegment[];
}

interface Snap {
	readonly context: EditorContext;
	readonly candidates: SnapCandidates;
	readonly tolerance: number;
	/** The pointer's travel since the press. */
	readonly travel: Point;
}

const carry = (snap: Snap, feature: Point): Point => ({ x: feature.x + snap.travel.x, y: feature.y + snap.travel.y });

function snapFeature(snap: Snap, feature: Point): DragTarget {
	const result = snap.context.snapService.snapPointWithGuides(carry(snap, feature), snap.candidates, snap.tolerance);
	return { to: result.point, guides: result.guides };
}

/** A body move stays a translation: the outline carried by the travel, corrected by ONE vector. */
function snapBody(snap: Snap, outline: CurvedPolygon, raw: Point): DragTarget {
	const moving = outline.points.map((point) => carry(snap, point));
	const result = snap.context.snapService.snapTranslation(moving, snap.candidates, snap.tolerance);
	return { to: { x: raw.x + result.correction.dx, y: raw.y + result.correction.dy }, guides: result.guides };
}

/**
 * A corner handle snaps like a vertex. A SIDE handle is an edge's midpoint — no feature a vertex or an edge could
 * land on — so it snaps its one moving coordinate to alignments and the grid only, and keeps only the guide along
 * that axis: an x-alignment guide is vertical, a y-alignment guide horizontal.
 */
function snapBoxHandle(snap: Snap, outline: CurvedPolygon, index: number): DragTarget {
	const box = unwrap(boundingBoxOf(outline));
	const handle = boxHandlePoint(box, index);
	const fixed = boxHandlePoint(box, (index + 4) % 8);
	if (handle.x !== fixed.x && handle.y !== fixed.y) return snapFeature(snap, handle);
	const alongX = handle.x !== fixed.x;
	const moved = carry(snap, handle);
	const { alignments, grid } = snap.candidates;
	const result = snap.context.snapService.snapPointWithGuides(moved, { alignments, grid }, snap.tolerance);
	return {
		to: alongX ? { x: result.point.x, y: moved.y } : { x: moved.x, y: result.point.y },
		guides: result.guides.filter((guide) => (alongX ? guide.start.x === guide.end.x : guide.start.y === guide.end.y)),
	};
}

/**
 * Where a designer drag lands (asset designer snapping spec 2026-09-15, §2.1): a vertex, the anchor, a body and a
 * box handle snap against the other parts (`partKey` excludes the dragged one) at the screen tolerance the draw
 * tools use; the facing, the rotate handle and a Shift (proportional) resize take the raw point.
 *
 * **What snaps is the MOVED feature, not the pointer** — the feature where the pointer's travel since the press
 * has carried it. A press a few millimetres off the anchor would otherwise snap the POINTER and land the anchor
 * those millimetres off the vertex it visibly snapped to. The features are handed back differently because
 * `draggedShape` reads them differently: a vertex's and a box handle's `to` is the new POSITION, while the anchor
 * and a body move by `to − from`, so their `to` is `from` carried by the snapped travel.
 */
export function dragTarget(context: EditorContext, start: DragStart, event: EditorPointerEvent): DragTarget {
	const raw = event.worldPoint;
	const { role, selection, shape, from } = start;
	const snap: Snap = {
		context,
		candidates: context.snapCandidates([partKey(selection)]),
		tolerance: SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel(),
		travel: { x: raw.x - from.x, y: raw.y - from.y },
	};
	// A vertex handle is only drawn on an outline the pressed shape has, so no cast below hides a null.
	if (role.kind === 'vertex') return snapFeature(snap, (outlineOf(shape, selection as OutlinePart) as CurvedPolygon).points[role.index]);
	if (selection.kind === 'anchor') {
		const moved = snapFeature(snap, shape.anchor);
		return { to: { x: from.x + moved.to.x - shape.anchor.x, y: from.y + moved.to.y - shape.anchor.y }, guides: moved.guides };
	}
	if (!isOutlineSelection(selection)) return { to: raw, guides: [] };
	const outline = outlineOf(shape, selection) as CurvedPolygon;
	if (role.kind === 'body') return snapBody(snap, outline, raw);
	if (role.kind === 'box' && !event.modifiers.shift) return snapBoxHandle(snap, outline, role.index);
	return { to: raw, guides: [] };
}
```

In `src/presentation/designer/tools/designer-select-tool.ts`:

1. Imports: add `import { dragTarget } from '../selection/dragSnap';`; change the handleMetrics import to `import { CLICK_EPSILON_PX } from '../../editor/handleMetrics';`.
2. Replace `shapeAt` and delete the private `dragTarget` method with its docblock:

```ts
	/**
	 * The shape a release here would write — ONE function for the preview and the commit, so the two cannot differ.
	 * It publishes the guides that decided the landing (`selection/dragSnap.ts`) on the way.
	 */
	private shapeAt(drag: Drag, event: EditorPointerEvent): Result<AssetShape, ValidationError> {
		const { context, start } = drag;
		const target = dragTarget(context, start, event);
		context.renderState.snapGuides = target.guides;
		return draggedShape(start, target.to, {
			shift: event.modifiers.shift,
			snapRotation: (radians) => context.snapService.snapRotation(radians),
		});
	}
```

3. In `lift`, directly after `const next = this.shapeAt(drag, event);` add:

```ts
		// A guide says why a drag in flight is landing where it is; the release ends the drag it explained.
		drag.context.renderState.snapGuides = [];
```

4. In `press`, directly after `this.drag = null;` add `context.renderState.snapGuides = [];`.
5. In `dropGesture`, add first: `if (this.context !== null) this.context.renderState.snapGuides = [];`.

In `src/presentation/designer/tools/draw-detail-tool.ts`:

```ts
	private snapped(context: EditorContext, point: Point): Point {
		const snap = context.snapService.snapPointWithGuides(point, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		context.renderState.snapGuides = snap.guides;
		return snap.point;
	}
```

and in `drop`, after `context.renderState.previewPolygon = null;` add `context.renderState.snapGuides = [];`.

- [ ] **Step 4: Run the designer suites**

Run: `npm run check:fast -- tests/presentation/designer`
Expected: PASS, all existing cases included (mounted-tolerance rule applies).
Then `npx eslint` on the five changed/created files. If `designer-select-tool.ts` reports an unused import, remove it.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/designer/selection/dragSnap.ts src/presentation/designer/tools/designer-select-tool.ts src/presentation/designer/tools/draw-detail-tool.ts tests/presentation/designer/tools/designerSelectSnapping.test.ts tests/presentation/designer/tools/drawDetailTool.test.ts
git commit -m "feat(designer): move, resize and draw snap with guides" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire snapping, guides and the grid into the mounted designer

**Files:**
- Modify: `src/presentation/designer/runtime.ts` (snap service and `snapCandidates` in the `ToolManager` factory)
- Modify: `src/presentation/designer/layers/DesignerGestureLayer.vue` (mount `SnapGuides`)
- Modify: `src/presentation/editor/layers/CanvasGrid.vue` (optional `stepMm`, `origin`)
- Modify: `src/presentation/designer/DesignerCanvas.vue` (mount the grid after `VStage`; narrow the `WorkspaceStore` comment)
- Modify: `src/presentation/editor/snapping/editorSnapping.ts` (delete `EDITOR_SNAP_SERVICE`, update docblock)
- Modify: `tests/presentation/editor/tools/roomSnapping.test.ts`, `tests/presentation/editor/snapping/editorSnapPreference.test.ts`, comments in `tests/helpers/designerRig.ts` and `tests/presentation/designer/designerTools.test.ts`
- Test: Create `tests/presentation/designer/designerSnapGrid.test.ts`

**Interfaces:**
- Consumes: `designerGrid` (Task 2), guides written by tools (Task 3), `createEditorSnapService(enabled)` (existing), `WorkspaceStore.gridVisible`, `EditorStore.snappingEnabled`.
- Produces: `CanvasGrid` props `{ stepMm?: number; origin?: Point }`.

- [ ] **Step 1: Write the failing tests** — create `tests/presentation/designer/designerSnapGrid.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * Snapping and the grid in the MOUNTED designer (asset designer snapping spec 2026-09-15, §4.3 and §5): the runtime
 * supplies the grid only while it is shown and follows the Snap choice, the gesture layer draws the guides a tool
 * publishes, and the grid is drawn above the stage from the footprint's corner. The arithmetic is
 * `snapServiceGuides.test.ts`'s and `designerSelectSnapping.test.ts`'s; this file is the wiring nothing else mounts.
 *
 * At the rig's default camera a pixel is 10 mm, so the tolerance is 80 mm and the grid step 500 mm.
 */
import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { unwrap } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { toiletShape } from '../../helpers/assetShapes';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, move } from '../../helpers/designerRig';
import { detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const PRESS = justInsideBottom(TANK);
/** Far from every part: the tank's corner arrives at (1040, 660), with no target within 80 mm. */
const TRAVEL = { x: 1230, y: 1010 };
const FOOTPRINT_MIN = unwrap(boundingBoxOf(toiletShape().footprint)).min;

async function selectRig() {
	const rig = await designerRig({ shape: toiletShape() });
	rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
	await settle();
	return rig;
}

describe('the grid in the mounted designer', () => {
	it('moves a part by the raw travel while the grid is hidden', async () => {
		const rig = await selectRig();
		try {
			drag(rig, PRESS, { x: PRESS.x + TRAVEL.x, y: PRESS.y + TRAVEL.y });
			await settle();

			const corner = (await rig.document()).shape?.details[0]?.outline.points[0];
			expect(corner?.x).toBeCloseTo(TANK.points[0].x + TRAVEL.x, 6);
			expect(corner?.y).toBeCloseTo(TANK.points[0].y + TRAVEL.y, 6);
		} finally {
			rig.unmount();
		}
	});

	it('lands the part’s top-left corner on the 500 mm grid counted from the footprint’s corner while the grid is shown', async () => {
		const rig = await selectRig();
		try {
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();
			drag(rig, PRESS, { x: PRESS.x + TRAVEL.x, y: PRESS.y + TRAVEL.y });
			await settle();

			// (1040, 660) from the grid origin (-190, -350) in 500 mm steps: x → 810, y → 650.
			const corner = (await rig.document()).shape?.details[0]?.outline.points[0];
			expect(corner?.x).toBeCloseTo(FOOTPRINT_MIN.x + 1000, 6);
			expect(corner?.y).toBeCloseTo(FOOTPRINT_MIN.y + 1000, 6);
		} finally {
			rig.unmount();
		}
	});

	it('draws the grid above the stage, from the footprint’s corner, at the designer’s own step', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			expect(rig.wrapper.find('.rp-canvas-grid').exists()).toBe(false);
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();

			const grid = rig.wrapper.get('.rp-canvas-grid').element as HTMLElement;
			const corner = rig.at(FOOTPRINT_MIN);
			expect(grid.style.backgroundPosition).toBe(`${corner.x}px ${corner.y}px`);
			expect(grid.style.backgroundSize).toBe('50px 50px');
			const stage = rig.canvasEl.querySelector('.konvajs-content') as Element;
			expect(stage.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		} finally {
			rig.unmount();
		}
	});
});

describe('object snapping in the mounted designer', () => {
	/** The tank's top-left corner, and a drop 42 mm from it — inside the tolerance. */
	const CORNER = TANK.points[0];
	const DROP = { x: CORNER.x + 30, y: CORNER.y + 30 };

	it.each([
		[true, CORNER],
		[false, DROP],
	])('with Snap %s, an anchor dropped beside a corner lands at %o', async (enabled, expected) => {
		const rig = await selectRig();
		try {
			useEditorStore(rig.pinia).snappingEnabled = enabled;
			drag(rig, { x: 0, y: 0 }, DROP);
			await settle();

			const anchor = (await rig.document()).shape?.anchor;
			expect(anchor?.x).toBeCloseTo(expected.x, 6);
			expect(anchor?.y).toBeCloseTo(expected.y, 6);
		} finally {
			rig.unmount();
		}
	});

	it('draws the guide a trace would land on while the pointer hovers', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			rig.toolbarButton(t('en', 'designer.toolbar.trace-detail')).click();
			await settle();
			click(rig, { x: 1000, y: 1000 });
			// 30 mm below the tank's top edge, far to its right: only the y alignment is in reach.
			move(rig, { x: 1500, y: CORNER.y + 30 });
			await settle();

			expect(rig.stage.find('.snap-guide').length).toBeGreaterThan(0);
		} finally {
			rig.unmount();
		}
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/presentation/designer/designerSnapGrid.test.ts`
Expected: FAIL — the grid-shown drag lands raw; no `.rp-canvas-grid`; Snap-off anchor still snaps (`EDITOR_SNAP_SERVICE` is always enabled); no `.snap-guide`. The grid-hidden raw case passes (it pins the baseline).

- [ ] **Step 3: Implement**

`src/presentation/designer/runtime.ts`:
- Replace `import { EDITOR_SNAP_SERVICE } from '../editor/snapping/editorSnapping';` with `import { createEditorSnapService } from '../editor/snapping/editorSnapping';`, and add `import { useWorkspaceStore } from '../stores/WorkspaceStore';` and `import { designerGrid } from './grid/designerGrid';`.
- Directly above `const toolManager = new ToolManager(() =>` add:

```ts
	/**
	 * Per leaf, like the Plan Editor's: the View menu's Snap choice is this leaf's `EditorStore.snappingEnabled`,
	 * read at every call. The grid is supplied to snapping only while this leaf's grid is SHOWN (snapping spec §2.4).
	 */
	const snapService = createEditorSnapService(() => editor.snappingEnabled);
	const workspace = useWorkspaceStore();
```

- In the factory, replace the `snapService:` and `snapCandidates:` members with:

```ts
			snapService,
			// The footprint's and every detail's vertices, edges and alignments and the anchor, minus the part being
			// dragged (snapping spec §2.2), and the grid while it is shown. Read PER CALL, like `subject.calibration`.
			snapCandidates: (exclude) => {
				const shape = store.design?.shape ?? null;
				const found = designerSnapCandidates(shape, exclude ?? []);
				return workspace.gridVisible ? { ...found, grid: designerGrid(shape, viewportAdapter.worldPerScreenPixel()) } : found;
			},
```

`src/presentation/editor/snapping/editorSnapping.ts`: delete `export const EDITOR_SNAP_SERVICE = new SnapService(EDITOR_SNAP_CONFIG);`, and replace the header's last paragraph ("The designer retains the shared config-only instance. …") with: `Each surface composes its own instance through \`createEditorSnapService\`, over ONE configuration, with its own leaf's live automatic-snapping preference.` Replace the one-line comment above `createEditorSnapService` with `/** One editing leaf's service: the shared configuration, and that leaf's own Snap choice. */`. Remove the `SnapService` import only if nothing else in the file uses it (the factory does, so it stays).

`tests/presentation/editor/tools/roomSnapping.test.ts`: import `createEditorSnapService` instead of `EDITOR_SNAP_SERVICE`, and at both sites write `snapService: createEditorSnapService(() => true)`.

`tests/presentation/editor/snapping/editorSnapPreference.test.ts`: drop `EDITOR_SNAP_SERVICE` from the import and replace line 20 with:

```ts
		expect(createEditorSnapService(() => true).snapPoint(point, { vertices: [vertex] })).toBe(vertex);
```

`tests/helpers/designerRig.ts` header: replace the sentence "which builds its context from `EDITOR_SNAP_SERVICE` — the same instance and the same 15 degree step the Plan Editor's tools take" with "which builds its context through `createEditorSnapService` — the same configuration and the same 15 degree step the Plan Editor's tools take". `tests/presentation/designer/designerTools.test.ts` (the 15-degree case's docblock): replace "about `EDITOR_SNAP_SERVICE` being the SAME instance the Plan Editor's tools take rather than a second service composed beside it" with "about the designer's service being composed from the SAME configuration the Plan Editor's tools take rather than a second one beside it".

`src/presentation/designer/layers/DesignerGestureLayer.vue`: add `import SnapGuides from '../../editor/layers/SnapGuides.vue';`, add "and the guides a snapping gesture publishes" to the docblock's first sentence, and after the `detail-preview` `VLine` add:

```vue
		<SnapGuides
			:guides="props.renderState.snapGuides"
			:to-screen="toScreen"
			:tokens="props.tokens"
		/>
```

`src/presentation/editor/layers/CanvasGrid.vue` script:

```ts
<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';

/**
 * `stepMm` and `origin` are the asset designer's (snapping spec §5), whose `designerGrid` has already chosen a step the
 * screen can afford and counts it from the footprint's corner. Without them this is the Plan Editor's visual ruler:
 * 100 mm multiples from the world origin, decimated at distant zooms to avoid dense moiré.
 */
const props = defineProps<{ stepMm?: number; origin?: Point }>();
const editor = useEditorStore(), workspace = useWorkspaceStore();
const style = computed(() => {
	const spacing = (props.stepMm ?? 100) * editor.viewport.zoom;
	const pixels = props.stepMm === undefined ? spacing * Math.pow(10, Math.max(0, Math.ceil(Math.log10(16 / spacing)))) : spacing;
	const origin = worldToScreen(props.origin ?? { x: 0, y: 0 }, editor.viewport, STAGE_PIXELS);
	return { backgroundSize: `${pixels}px ${pixels}px`, backgroundPosition: `${origin.x}px ${origin.y}px` };
});
</script>
```

`src/presentation/designer/DesignerCanvas.vue`:
- Imports: `import CanvasGrid from '../editor/layers/CanvasGrid.vue';` and `import { designerGrid } from './grid/designerGrid';`.
- After `const worldPerPixel = computed(...)` add:

```ts
/** The grid as drawn — the COMMITTED design's, so dragging the footprint does not slide the grid under the drag. */
const grid = computed(() => designerGrid(design.value?.shape ?? null, worldPerPixel.value));
```

- In the `BackgroundLayer` template comment, replace "the plan editor's `WorkspaceStore` is a Plan Editor concern" with "layer visibility in the plan editor's `WorkspaceStore` is a Plan Editor concern (its `gridVisible` is shared)".
- Directly after `</VStage>` inside `<template #default="{ size }">` add:

```vue
				<!--
					ABOVE the stage, where the Plan Editor mounts its grid below: a design is usually traced over an opaque
					spec sheet, and a grid under it would snap to lines nobody can see (snapping spec §5).
				-->
				<CanvasGrid
					:step-mm="grid.step"
					:origin="grid.origin"
				/>
```

- [ ] **Step 4: Run the designer and editor suites**

Run: `npm run check:fast -- tests/presentation/designer tests/presentation/editor`
Expected: PASS (mounted-tolerance rule applies to existing mounted drags).
Then `npx eslint` on every changed file, and `npx fallow dead-code` — `EDITOR_SNAP_SERVICE` must no longer be reported anywhere.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/designer/runtime.ts src/presentation/designer/layers/DesignerGestureLayer.vue src/presentation/editor/layers/CanvasGrid.vue src/presentation/designer/DesignerCanvas.vue src/presentation/editor/snapping/editorSnapping.ts tests/presentation/designer/designerSnapGrid.test.ts tests/presentation/editor/tools/roomSnapping.test.ts tests/presentation/editor/snapping/editorSnapPreference.test.ts tests/helpers/designerRig.ts tests/presentation/designer/designerTools.test.ts
git commit -m "feat(designer): the leaf's own snap service, drawn guides and a grid above the stage" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Extract the View menu's dismissal and the view-preference seeding

A refactor with no behaviour change: the existing Plan Editor cases are the test, watched green before and after.

**Files:**
- Create: `src/presentation/composables/use-disclosure-dismissal.ts`
- Create: `src/presentation/editor/shell/useViewPreferences.ts`
- Modify: `src/presentation/editor/shell/EditorViewMenu.vue`, `src/presentation/editor/PlanEditorRoot.vue` (lines 74–80)
- Test (existing, unchanged): `tests/presentation/editor/editorView.test.ts`

**Interfaces:**
- Produces: `export function useDisclosureDismissal(disclosure: Readonly<Ref<HTMLDetailsElement | null>>): (event: KeyboardEvent) => void`; `export function useViewPreferences(preferences: EditorViewPreferences | undefined): void`.

- [ ] **Step 1: Run the cases that pin the current behaviour**

Run: `npx vitest run tests/presentation/editor/editorView.test.ts`
Expected: PASS — in particular "shares grid and snap choices with later plans…", "…restores View focus on plain Escape", and "closes the View menu on a press outside it…".

- [ ] **Step 2: Create the composables**

`src/presentation/composables/use-disclosure-dismissal.ts`:

```ts
import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { listenOnOwner } from './use-owner-listener';

/**
 * A `<details>` menu that closes on a press anywhere outside it and on a plain Escape, handing focus back to its
 * summary — the Plan Editor's View menu and the asset designer's. The press is heard in CAPTURE, so a canvas's own
 * `.stop` cannot hide it, on the document that OWNS the menu, which in a pop-out leaf is not the plugin's
 * `document`. Answers the keydown handler the template binds on the `<details>`.
 */
export function useDisclosureDismissal(disclosure: Readonly<Ref<HTMLDetailsElement | null>>): (event: KeyboardEvent) => void {
	function outside(event: Event): void {
		const menu = disclosure.value as HTMLDetailsElement;
		if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
	}
	let stopOutside: (() => void) | null = null;
	onMounted(() => { stopOutside = listenOnOwner(disclosure.value as HTMLDetailsElement, 'document', 'pointerdown', outside, { capture: true }); });
	onBeforeUnmount(() => { stopOutside?.(); stopOutside = null; });
	return (event: KeyboardEvent): void => {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !disclosure.value) return;
		event.preventDefault();
		disclosure.value.open = false;
		disclosure.value.querySelector('summary')?.focus();
	};
}
```

`src/presentation/editor/shell/useViewPreferences.ts`:

```ts
import { watch } from 'vue';
import type { EditorViewPreferences } from '../PlanEditorContext';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';

/**
 * The View menu's grid and snap choices follow the user from leaf to leaf on this device: seeded once from the
 * device slot, and each written back as it changes. ONE field per write, because this leaf's snapshot of the OTHER
 * choice may be older than another leaf's. `undefined` — no slot bound — keeps the stores' defaults.
 */
export function useViewPreferences(preferences: EditorViewPreferences | undefined): void {
	const editor = useEditorStore(), workspace = useWorkspaceStore();
	const saved = preferences?.read() ?? {};
	workspace.gridVisible = saved.gridVisible ?? workspace.gridVisible;
	editor.snappingEnabled = saved.snappingEnabled ?? editor.snappingEnabled;
	watch(() => workspace.gridVisible, (gridVisible) => preferences?.write({ gridVisible }));
	watch(() => editor.snappingEnabled, (snappingEnabled) => preferences?.write({ snappingEnabled }));
}
```

- [ ] **Step 3: Use them**

`EditorViewMenu.vue` script: remove `onBeforeUnmount, onMounted` from the `vue` import and the `listenOnOwner` import; delete `outside`, `stopOutside`, both lifecycle hooks and `escape`; after `const disclosure = ref<HTMLDetailsElement | null>(null);` add `const escape = useDisclosureDismissal(disclosure);` with `import { useDisclosureDismissal } from '../../composables/use-disclosure-dismissal';`. The template is unchanged.

`PlanEditorRoot.vue`: replace lines 74–80 (the comment, `savedView`, the two seeding lines and both `watch` calls) with:

```ts
useViewPreferences(context.viewPreferences);
```

and add `import { useViewPreferences } from './shell/useViewPreferences';`. Keep line 73's `editor`/`workspace` if lint shows them still used; otherwise drop the unused ones, and drop `watch` from the `vue` import only if nothing else uses it.

- [ ] **Step 4: Run the same cases again**

Run: `npm run check:fast -- tests/presentation/editor`
Expected: PASS, identical to Step 1. Then `npx eslint` on the four files and `npx fallow dupes`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/composables/use-disclosure-dismissal.ts src/presentation/editor/shell/useViewPreferences.ts src/presentation/editor/shell/EditorViewMenu.vue src/presentation/editor/PlanEditorRoot.vue
git commit -m "refactor(editor): share the View menu's dismissal and preference seeding" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The designer's View menu, remembered choices and grid readout

**Files:**
- Create: `src/presentation/designer/DesignerViewMenu.vue`
- Modify: `src/presentation/designer/DesignerToolbar.vue` (mount the menu after `.rp-designer-history`)
- Modify: `src/presentation/designer/AssetDesignerContext.ts` (`AssetDesignerDeps.viewPreferences?`)
- Modify: `src/presentation/designer/AssetDesignerView.ts` (pass it into the context)
- Modify: `src/presentation/designer/AssetDesignerRoot.vue` (seed preferences; grid readout in `.rp-designer-status`)
- Modify: `src/plugin/assetDesignerDeps.ts` (`assetDesignerDeviceSlots`), `src/plugin/RenovationPlannerPlugin.ts` (`assetDesignerViewDeps`)
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`, `styles/designer.css`
- Modify: `tests/helpers/designerRig.ts` (`viewPreferences` option)
- Test: Create `tests/presentation/designer/designerViewMenu.test.ts`; modify `tests/presentation/designer/assetDesignerView.test.ts`, `tests/plugin/assetDesignerWiring.test.ts`, `tests/harness/accessibilityDesignerSelection.test.ts`

**Interfaces:**
- Consumes: `useDisclosureDismissal`, `useViewPreferences` (Task 5); `designerGrid` (Task 2); `EditorViewPreferences` (`editor/PlanEditorContext.ts`); `editorViewPreferencesStore` (infrastructure).
- Produces: `AssetDesignerDeps.viewPreferences?: EditorViewPreferences`; `export function assetDesignerDeviceSlots(adapter: LocalStorageAdapter, pluginId: string, logger: Logger): { viewPreferences: EditorViewPreferences }`; string key `designer.status.grid`; class `.rp-designer-grid-step`; `DesignerRigOptions.viewPreferences?`.

- [ ] **Step 1: Write the failing tests**

In `tests/helpers/designerRig.ts`, add to `DesignerRigOptions`:

```ts
	/** The device slot the View menu's choices are seeded from and written to. Default: none bound. */
	readonly viewPreferences?: AssetDesignerContext['viewPreferences'];
```

and in the `context` literal add `viewPreferences: options.viewPreferences,` beside `closeLeaf`. (This compiles only once `AssetDesignerDeps` gains the member in Step 3; that type error is part of the expected red.)

Create `tests/presentation/designer/designerViewMenu.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The asset designer's View menu, its remembered choices and the grid readout (asset designer snapping spec
 * 2026-09-15, §2.6 and §5), through the real mounted designer.
 */
import { describe, expect, it } from 'vitest';
import { editorViewPreferencesStore } from '../../../src/infrastructure/obsidian/plugin-data/editorViewPreferencesStore';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { toiletShape } from '../../helpers/assetShapes';
import { settle } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';
import { recorder } from '../../helpers/logger';

const input = (rig: Awaited<ReturnType<typeof designerRig>>, view: 'grid' | 'snap') => rig.wrapper.get(`.rp-designer-tools [data-rp-view="${view}"]`);

describe('the designer’s View menu', () => {
	it('shows and hides the grid, and turns automatic snapping off', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			await input(rig, 'grid').setValue(true);
			expect(useWorkspaceStore(rig.pinia).gridVisible).toBe(true);
			expect(rig.wrapper.find('.rp-canvas-grid').exists()).toBe(true);

			await input(rig, 'snap').setValue(false);
			expect(useEditorStore(rig.pinia).snappingEnabled).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	it.each([['designer.toolbar.select'], ['designer.toolbar.pan']] as const)(
		'refuses to change snapping while a press is held on the canvas under %s',
		async (label: StringKey) => {
			const rig = await designerRig({ shape: toiletShape() });
			try {
				rig.toolbarButton(t('en', label)).click();
				await settle();
				const at = rig.at({ x: 0, y: -160 });
				const pointer = (type: string, buttons: number) =>
					rig.canvasEl.dispatchEvent(new PointerEvent(type, { button: 0, buttons, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
				pointer('pointerdown', 1);

				await input(rig, 'snap').setValue(false);

				expect(useEditorStore(rig.pinia).snappingEnabled).toBe(true);
				expect((input(rig, 'snap').element as HTMLInputElement).checked).toBe(true);
				pointer('pointerup', 0);
			} finally {
				rig.unmount();
			}
		},
	);

	it('closes on a plain Escape and hands focus back to its summary', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			const menu = rig.wrapper.get('.rp-designer-tools .rp-view-menu');
			const details = menu.element as HTMLDetailsElement;
			details.open = true;

			await menu.trigger('keydown', { key: 'Escape' });

			expect(details.open).toBe(false);
			expect(document.activeElement).toBe(menu.get('summary').element);
		} finally {
			rig.unmount();
		}
	});

	it('opens with this device’s remembered choices and writes a change back', async () => {
		let stored: unknown = { gridVisible: true, snappingEnabled: false };
		const viewPreferences = editorViewPreferencesStore(
			{ loadLocalStorage: () => stored, saveLocalStorage: (_key, data) => { stored = data; } },
			'designer-view',
			recorder,
		);
		const rig = await designerRig({ shape: toiletShape(), viewPreferences });
		try {
			expect(useWorkspaceStore(rig.pinia).gridVisible).toBe(true);
			expect(useEditorStore(rig.pinia).snappingEnabled).toBe(false);

			await input(rig, 'grid').setValue(false);

			expect(stored).toEqual({ gridVisible: false, snappingEnabled: false });
		} finally {
			rig.unmount();
		}
	});
});

describe('the grid readout', () => {
	it('names the step while the grid is shown, and nothing while it is hidden', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			expect(rig.wrapper.find('.rp-designer-grid-step').exists()).toBe(false);
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();

			// 10 mm per pixel at the rig's camera: the 500 mm step.
			expect(rig.wrapper.get('.rp-designer-status .rp-designer-grid-step').text()).toBe(t('en', 'designer.status.grid', { step: '500' }));
		} finally {
			rig.unmount();
		}
	});

	it('names no step, a measurement, while the footprint is unscaled', async () => {
		const rig = await designerRig({ shape: { ...toiletShape(), footprintPending: true } });
		try {
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();

			expect(rig.wrapper.find('.rp-canvas-grid').exists()).toBe(true);
			expect(rig.wrapper.find('.rp-designer-grid-step').exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});
```

Append to `tests/presentation/designer/assetDesignerView.test.ts`:

```ts
describe('the View menu’s remembered choices', () => {
	it('reach the leaf from the bundle the composition root hands the view', async () => {
		const view = await opened(deps({ viewPreferences: { read: () => ({ gridVisible: true }), write: () => undefined } }));

		expect((view.contentEl.querySelector('[data-rp-view="grid"]') as HTMLInputElement | null)?.checked).toBe(true);
	});
});
```

Append to `tests/plugin/assetDesignerWiring.test.ts` (add `import { assetDesignerDeviceSlots } from '../../src/plugin/assetDesignerDeps';` and `import { recorder } from '../helpers/logger';`):

```ts
/** A key is persisted data like a command id: renaming one strands what every device remembered. */
describe('the asset designer device slot', () => {
	it('keys the View menu choices under the plugin id, apart from the Plan Editor’s', () => {
		const keys: string[] = [];
		const adapter = {
			loadLocalStorage: (key: string): unknown => { keys.push(key); return null; },
			saveLocalStorage: (key: string): void => { keys.push(key); },
		};
		assetDesignerDeviceSlots(adapter, 'plugin-id', recorder).viewPreferences.write({ gridVisible: true });
		expect(keys).toEqual(['plugin-id:designer-view', 'plugin-id:designer-view']);
	});
});
```

Append to `tests/harness/accessibilityDesignerSelection.test.ts` (add `import { useWorkspaceStore } from '../../src/presentation/stores/WorkspaceStore';`):

```ts
/** The View menu open and the grid readout drawn (snapping spec §5): a `<details>` inside the toolbar, and a status line. */
it('reports no violations with the View menu open and the grid shown', { timeout: HARNESS_SCAN_MS }, async () => {
	const rig = await designerRig({ shape: toiletShape() });
	try {
		(rig.wrapper.get('.rp-designer-tools .rp-view-menu').element as HTMLDetailsElement).open = true;
		useWorkspaceStore(rig.pinia).gridVisible = true;
		await settle();

		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

		expect(results.violations).toEqual([]);
	} finally {
		rig.unmount();
	}
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/presentation/designer/designerViewMenu.test.ts tests/presentation/designer/assetDesignerView.test.ts tests/plugin/assetDesignerWiring.test.ts tests/harness/accessibilityDesignerSelection.test.ts`
Expected: FAIL — no `.rp-view-menu` in the designer toolbar, no readout, `assetDesignerDeviceSlots` not exported.

- [ ] **Step 3: Implement**

`src/presentation/designer/DesignerViewMenu.vue`:

```vue
<script setup lang="ts">
/**
 * The asset designer's View menu (snapping spec 2026-09-15, §2.6): Grid shows the designer's grid and lets
 * gestures snap to it; Snap to objects turns vertex, edge and alignment snapping on and off. The same two stores the
 * Plan Editor's `EditorViewMenu` drives, per leaf, with its dismissal (`useDisclosureDismissal`); remembered per
 * device by `AssetDesignerRoot`'s `useViewPreferences`. No zoom or fit actions: nothing asked for them here.
 */
import { ref } from 'vue';
import { useDisclosureDismissal } from '../composables/use-disclosure-dismissal';
import { tr } from '../i18n/strings';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import { useDesignerRuntime } from './runtime';

const editor = useEditorStore(), workspace = useWorkspaceStore();
const runtime = useDesignerRuntime();
const disclosure = ref<HTMLDetailsElement | null>(null);
const escape = useDisclosureDismissal(disclosure);

/** Refused while a press is held — a pan, or a tool's gesture — as `EditorViewMenu` refuses it: a drag's landing must not change under it. */
function toggleSnap(event: Event): void {
	const input = event.target as HTMLInputElement;
	if (editor.dragState === null && !runtime.toolManager.gestureInFlight) editor.snappingEnabled = input.checked;
	input.checked = editor.snappingEnabled;
}
</script>

<template>
	<details
		ref="disclosure"
		class="rp-view-menu"
		@keydown="escape"
	>
		<summary class="rp-designer-tool-button">
			{{ tr('editor.view') }}
		</summary>
		<div class="rp-view-menu__content">
			<label><input
				v-model="workspace.gridVisible"
				type="checkbox"
				data-rp-view="grid"
			>{{ tr('editor.view.grid') }}</label>
			<label><input
				:checked="editor.snappingEnabled"
				type="checkbox"
				data-rp-view="snap"
				@change="toggleSnap"
			>{{ tr('editor.view.snap') }}</label>
		</div>
	</details>
</template>
```

`DesignerToolbar.vue`: add `import DesignerViewMenu from './DesignerViewMenu.vue';`, add to the docblock's first sentence ", undo/redo and the View menu", and after the closing `</div>` of `.rp-designer-history` add `<DesignerViewMenu />`.

`AssetDesignerContext.ts` — add to `AssetDesignerDeps` (and `import type { EditorViewPreferences } from '../editor/PlanEditorContext';`):

```ts
	/**
	 * The View menu's Grid and Snap choices on this device (snapping spec 2026-09-15, §5) — the Plan Editor's store
	 * shape under the designer's OWN key, because an asset is worked at a different scale from a plan. Optional for
	 * `PlanEditorDeps.viewPreferences`'s reason: a surface with no slot bound keeps the defaults.
	 */
	readonly viewPreferences?: EditorViewPreferences;
```

`AssetDesignerView.ts` `mount`: add `viewPreferences: this.deps.viewPreferences,` after `onVaultFileChanged`.

`AssetDesignerRoot.vue` script — imports:

```ts
import { useViewPreferences } from '../editor/shell/useViewPreferences';
import { STAGE_PIXELS, worldPerScreenPixel } from '../editor/viewport/Viewport';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import { designerGrid } from './grid/designerGrid';
```

after `const dialogs = useDialogStore();`:

```ts
useViewPreferences(context.viewPreferences);
const workspace = useWorkspaceStore(), editorStore = useEditorStore();
```

after `hintKey`:

```ts
/**
 * The grid's step for the status row while the grid is shown (snapping spec §2.6), from the SAME `designerGrid` the
 * canvas draws and snaps with. Nothing while the footprint is unscaled: a step there is not a measurement, and a
 * number that is not one is not given a unit ("Read and correct an object's dimensions", criterion 6).
 */
const gridStep = computed<number | null>(() => {
	const current = design.value;
	if (!workspace.gridVisible || current === null || current.dimensionsUnscaled) return null;
	return designerGrid(current.shape, worldPerScreenPixel(editorStore.viewport, STAGE_PIXELS)).step;
});
```

template, inside `.rp-designer-status` between the hint `span` and `<SaveStateIndicator />`:

```vue
			<span
				v-if="gridStep !== null"
				class="rp-designer-grid-step"
			>{{ tr('designer.status.grid', { step: String(gridStep) }) }}</span>
```

`styles/designer.css`, after the `.rp-designer-hint` rule:

```css
/* The grid step: a standing fact about the view, muted like the hint beside it. */
.rp-designer-grid-step {
	color: var(--text-muted);
}
```

`locales/en/assetSymbols.ts`, before the closing `} as const;`:

```ts
	// The status row while the grid is shown (snapping spec 2026-09-15 §2.6); withheld while the footprint is unscaled.
	'designer.status.grid': 'Grid {step} mm',
```

`locales/de/assetSymbols.ts`, before the closing `};`: `'designer.status.grid': 'Raster {step} mm',`

`src/plugin/assetDesignerDeps.ts` — add imports `import type { Logger } from '../application/ports/Logger';`, `import { editorViewPreferencesStore } from '../infrastructure/obsidian/plugin-data/editorViewPreferencesStore';`, `import type { LocalStorageAdapter } from '../infrastructure/obsidian/plugin-data/continueContextStore';` and:

```ts
/**
 * The asset designer's per-device slot: the View menu's choices, under `designer-view` rather than the Plan Editor's
 * `editor-view`. Built per call, for `planEditorDeviceSlots`' reason: it holds nothing past its adapter and key.
 */
export function assetDesignerDeviceSlots(adapter: LocalStorageAdapter, pluginId: string, logger: Logger) {
	return { viewPreferences: editorViewPreferencesStore(adapter, `${pluginId}:designer-view`, logger) };
}
```

`RenovationPlannerPlugin.ts` `assetDesignerViewDeps`:

```ts
	private assetDesignerViewDeps(): AssetDesignerDeps {
		return {
			...assetDesignerDeps(this.root, this.app, { indexScanCompleted: () => this.indexScanCompleted }),
			...assetDesignerDeviceSlots(this.app, this.manifest.id, this.root.logger),
		};
	}
```

with `assetDesignerDeviceSlots` added to its existing `./assetDesignerDeps` import.

- [ ] **Step 4: Run the touched suites**

Run: `npm run check:fast -- tests/presentation/designer tests/presentation/editor tests/plugin tests/harness/accessibilityDesignerSelection.test.ts tests/build/localeModuleSentenceCase.test.ts`
Expected: PASS. Then `npx eslint` on every changed `.ts`/`.vue` file (the Vue rules, `sentence-case-locale-module` and `no-deprecated` are only there), and `npx fallow dupes`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/designer/DesignerViewMenu.vue src/presentation/designer/DesignerToolbar.vue src/presentation/designer/AssetDesignerContext.ts src/presentation/designer/AssetDesignerView.ts src/presentation/designer/AssetDesignerRoot.vue src/plugin/assetDesignerDeps.ts src/plugin/RenovationPlannerPlugin.ts src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts styles/designer.css tests/helpers/designerRig.ts tests/presentation/designer/designerViewMenu.test.ts tests/presentation/designer/assetDesignerView.test.ts tests/plugin/assetDesignerWiring.test.ts tests/harness/accessibilityDesignerSelection.test.ts
git commit -m "feat(designer): a View menu with Grid and Snap, remembered per device, and the grid step in the status row" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Captures, manual rows, CHANGELOG and the spec's amendments

**Files:**
- Modify: `tests/harness/assetDesigner.ts` (`grid` knob), `tests/harness/page.ts` (pass `&grid`)
- Modify: `scripts/harness-shot.mjs` (two shots after `asset-designer-draw-trace-detail`)
- Test: `tests/build/harness-shot.test.ts` (sorted name list), `tests/build/harness-shot-designer.test.ts` (knob pins, width)
- Modify: `docs/tests/cases/Design an Asset.md`, `CHANGELOG.md`, `docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md`

**Interfaces:**
- Consumes: everything above; `.rp-canvas-grid` and `.rp-designer-grid-step` as capture selectors.

- [ ] **Step 1: Write the failing pins**

In `tests/build/harness-shot.test.ts`'s sorted list, insert after `'asset-designer-draw-trace-detail',`:

```ts
			'asset-designer-grid',
			'asset-designer-grid-light',
```

In `tests/build/harness-shot-designer.test.ts`, add to the `it.each` table:

```ts
		['asset-designer-grid', { grid: '', theme: null }],
		['asset-designer-grid-light', { grid: '', theme: 'light' }],
```

and a case:

```ts
	/** The readout shares the status row with the save state, which a sidebar's width is what can crowd. */
	it('takes the light grid shot at a sidebar width and the dark one at the default', () => {
		expect(shot('asset-designer-grid-light').width).toBe(460);
		expect(shot('asset-designer-grid').width).toBeUndefined();
	});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/build/harness-shot.test.ts tests/build/harness-shot-designer.test.ts`
Expected: FAIL — the two shots are not in `SHOTS`.

- [ ] **Step 3: Implement**

`scripts/harness-shot.mjs`, after the `asset-designer-draw-trace-detail` entry:

```js
	// The grid (`&grid`, snapping spec 2026-09-15): drawn above the parts from the footprint's corner, with its step in
	// the status row — light at a sidebar's width, where that readout shares the row with the save state. A spec
	// sheet under it is not capturable (the harness refuses a background document); `Design an Asset` step 51 is.
	{ name: 'asset-designer-grid', query: '?view=asset-designer&preset=toilet&grid', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-canvas-grid', '.rp-designer-grid-step'] },
	{ name: 'asset-designer-grid-light', query: '?view=asset-designer&preset=toilet&grid&theme=light', selector: [ASSET_DESIGNER_VIEW, DESIGNER_READY, '.rp-canvas-grid', '.rp-designer-grid-step'], width: 460 },
```

`tests/harness/assetDesigner.ts`: add `readonly grid?: boolean` to both knob types (`driveHarness` and `mountAssetDesignerHarness`); in `driveHarness`, after the `camera` line, add `if (knobs.grid === true) useWorkspaceStore(pinia).gridVisible = true;` with `import { useWorkspaceStore } from '../../src/presentation/stores/WorkspaceStore';`; and name `&grid` in both docblocks' knob lists. `tests/harness/page.ts`: add `grid: params.has('grid'),` after `pending: params.has('pending'),`, and `&grid` to the header's list of designer knobs.

`docs/tests/cases/Design an Asset.md`: before `## Deliberately NOT checked`, add:

```md
## Steps — snapping, guides and the grid

Preconditions: an asset started from the Toilet preset, open in its designer; step 51 needs an asset with a
calibrated spec sheet.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 47 | `browser` | Click Select, click the bowl and drag it slowly until its left edge nears the tank's left edge | A dashed guide appears as the edges line up, the bowl jumps onto the line, and the guide disappears on release | The guides `DesignerGestureLayer` draws and clears at release — no fixed capture holds a live pointer |
| 48 | `suite` | Open View, tick Show grid, then drag the bowl into open space | The status row reads `Grid … mm`, and the bowl's top-left corner lands on a grid line counted from the footprint's top-left corner | The grid supplied to snapping only while shown, from the footprint's corner (`designerGrid`) |
| 49 | `obsidian` | Untick Snap to objects, close the designer, open another asset's designer, then a Plan Editor | The second designer opens with the grid shown and Snap to objects unticked; the Plan Editor's View menu is unchanged | The designer's own device slot (`designer-view`), apart from the Plan Editor's |
| 50 | `suite` | With the bowl selected in Transform, hold Shift and drag a corner handle past the tank's edge | The bowl keeps its proportions, nothing snaps and no guide is drawn | Proportional resize taking the raw point |
| 51 | `obsidian` | On an asset with a calibrated spec sheet, tick Show grid | The grid lines are visible over the drawing, not hidden behind it | The grid mounted above the stage — the harness refuses a background document, so no capture can show it |
```

and append to the Runs row's text: ` Steps 47 to 51 from the snapping spec (\`docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md\`) and its plan.`

`CHANGELOG.md`, first bullet under `## [Unreleased]` → `### Added`:

```md
- Asset designer: parts snap while you move, resize or draw them — onto the corners and edges of the other parts and into line with their edges and centres, with a dashed guide showing why. A new View menu shows a millimetre grid whose step follows the zoom, counted from the footprint's top-left corner; while it is shown, parts snap to it and the status row names its step. Snap to objects can be turned off on its own, and both choices are remembered on this device.
```

Spec: append an `## Amendments (implementation plan, 2026-09-15)` section stating, one bullet each:
1. `gridStepMm` and `gridOrigin` are one function, `designer/grid/designerGrid.ts`'s `designerGrid(shape, worldPerPixel): SnapGrid`, so the drawn grid, the snapped grid and the readout cannot disagree; its series ends at 5000 mm, which `MIN_ZOOM` still reaches.
2. §4.4's side handle snaps its moving coordinate to **alignments and the grid only** — a side handle is an edge's midpoint, not a feature a vertex or an edge could land on — and keeps only that axis's guide (vertical for x, horizontal for y).
3. Drag snapping lives in `designer/selection/dragSnap.ts` (`dragTarget`), not inside `designer-select-tool.ts`, which keeps the tool under its budget and the arithmetic testable beside it.
4. `EDITOR_SNAP_SERVICE` is deleted: with the designer on `createEditorSnapService`, nothing in `src/` used it.
5. §6's tests landed in new files beside the named ones, which are at or near their line caps: `designerSelectSnapping.test.ts`, `designerSnapGrid.test.ts`, `designerViewMenu.test.ts`, and `tests/presentation/designer/grid/designerGrid.test.ts`.
6. The grid capture cannot show a spec sheet under the grid (the harness refuses a background document); `Design an Asset` step 51 carries that check, and the light grid shot is taken at 460 px for the readout.

- [ ] **Step 4: Run the pins, then capture and look**

Run: `npm run check:fast -- tests/build/harness-shot.test.ts tests/build/harness-shot-designer.test.ts tests/harness`
Expected: PASS.
Then run `npm run harness-shot` and open `harness-shots/asset-designer-grid.png` and `harness-shots/asset-designer-grid-light.png`. Check: grid lines visible over the toilet and aligned with its top-left corner; the `Grid 500 mm` readout (or the step for the framed camera) fully visible beside the save state at 460 px, not truncated or wrapped into the hint. If the capture shows a defect, fix it in `styles/designer.css` and re-capture before committing. If Chromium is missing, set `RP_CHROMIUM_EXECUTABLE` per `scripts/chromium.mjs` or report the capture as not run — never claim it was looked at.

- [ ] **Step 5: Commit**

```bash
git add scripts/harness-shot.mjs tests/build/harness-shot.test.ts tests/build/harness-shot-designer.test.ts tests/harness/assetDesigner.ts tests/harness/page.ts "docs/tests/cases/Design an Asset.md" CHANGELOG.md docs/superpowers/specs/2026-09-15-asset-designer-snapping-and-guides-design.md
git commit -m "test(designer): grid captures, manual snapping rows, changelog and spec amendments" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Before the pull request

- [ ] `npx fallow dead-code` and `npx fallow dupes` report nothing new.
- [ ] `npx vue-tsc --noEmit` is clean (the `tests/**` type-check that `check:fast` also runs — confirm on the finished branch, not mid-task).
- [ ] Push and open the PR against `main`; CI's four `npm run check` legs are the gate. For coverage, read `coverage/coverage-final.json` from a CI or local `npm run test:coverage` run for `snap-service.ts`, `dragSnap.ts`, `snapCandidates.ts`, `designerGrid.ts` and `DesignerViewMenu.vue` rather than the summary line.
