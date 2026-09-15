# Plan Editor Transform Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A selected item or placed asset on the plan shows an eight-handle transform box that resizes it by dragging; a placed asset stores its own absolute width and depth.

**Architecture:** Geometry-first, exactly like the existing rotation arrow: pure frame/resize arithmetic (core → domain → `presentation/editor/elements/transformBox.ts`), a `SelectTool` gesture (`ElementResize`) hit tested by `resolveSelectionTarget`, the write through `elementActions`' existing guarded renovation command, and a `listening: false` drawing on the `InteractionLayer`. Assets gain `SpatialElement.size` (plan geometry schema 15).

**Tech Stack:** TypeScript, Vue 3 SFCs, vue-konva, Pinia, zod, Vitest (node + jsdom).

**Spec:** `docs/superpowers/specs/2026-09-15-plan-editor-transform-box-design.md`

## Global Constraints

- No new dependencies. `core/`, `domain/`, `application/` import no `vue`, `pinia`, `konva` or `obsidian`.
- Every user-visible string goes through `tr`; each new key exists in `en` AND `de`, sentence case.
- No hard-coded colours: Konva configs take `ThemeTokens` values.
- Source files ≤ 400 non-blank non-comment lines, functions ≤ 100 lines; test files ≤ 450.
- Exact values: `TRANSFORM_BOX_PADDING_PX = 12`, `TRANSFORM_HANDLE_SIZE_PX = 8`, minimum side 1 mm, maximum side 1e6 mm, size-match tolerance 0.5 mm, schema 15 size `width`/`depth` positive and ≤ 1e6.
- Handle order everywhere: clockwise from the frame's top-left, `(index + 4) % 8` is the handle held still.
- Export nothing only a test uses (fallow `unused-exports`); name no private type in an exported signature (fallow `private-type-leaks` is an error).
- Inner loop per task: `npm run check:fast -- <test paths>` AND `npx eslint <changed files>` (check:fast skips ESLint, which owns the Vue rules and budgets). Do NOT run `npm run check` locally; CI runs it.
- Commit messages end with exactly: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` (this overrides any trailer your own tooling suggests).
- Watch each new test fail before writing the code that passes it.

---

### Task 1: Shared box-handle arithmetic in core

**Files:**
- Create: `src/core/geometry/boxHandles.ts`
- Modify: `src/presentation/designer/selection/handles.ts` (remove `BOX_COLUMN`, `BOX_ROW`, `boxHandlePoint`)
- Modify: `src/presentation/designer/selection/selectionDrag.ts` (remove local `boxResize`)
- Test: `tests/core/geometry/boxHandles.test.ts`

**Interfaces:**
- Produces: `BOX_HANDLE_COUNT: 8`; `boxHandlePoint(box: BoundingBox, index: number): Point`; `boxResize(box: BoundingBox, index: number, to: Point, shift: boolean): { readonly factors: { readonly sx: number; readonly sy: number }; readonly origin: Point }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { BOX_HANDLE_COUNT, boxHandlePoint, boxResize } from '../../../src/core/geometry/boxHandles';

const box = { min: { x: 0, y: 0 }, max: { x: 400, y: 200 } };

describe('box handles', () => {
	it('places eight handles clockwise from the top-left', () => {
		expect(Array.from({ length: BOX_HANDLE_COUNT }, (_, index) => boxHandlePoint(box, index))).toEqual([
			{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 100 },
			{ x: 400, y: 200 }, { x: 200, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 },
		]);
	});

	it('resizes from a corner about the opposite corner', () => {
		expect(boxResize(box, 4, { x: 800, y: 300 }, false)).toEqual({ factors: { sx: 2, sy: 1.5 }, origin: { x: 0, y: 0 } });
	});

	it('holds a side handle’s other axis at exactly 1', () => {
		expect(boxResize(box, 3, { x: 600, y: 999 }, false)).toEqual({ factors: { sx: 1.5, sy: 1 }, origin: { x: 0, y: 100 } });
	});

	it('keeps proportions with Shift, taking whichever factor strays further from 1', () => {
		expect(boxResize(box, 4, { x: 800, y: 300 }, true).factors).toEqual({ sx: 2, sy: 2 });
		expect(boxResize(box, 3, { x: 600, y: 100 }, true).factors).toEqual({ sx: 1.5, sy: 1.5 });
	});

	it('answers a non-positive factor when dragged past the fixed side', () => {
		expect(boxResize(box, 4, { x: -100, y: 200 }, false).factors.sx).toBeLessThan(0);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/core/geometry/boxHandles.test.ts`
Expected: FAIL — cannot resolve `src/core/geometry/boxHandles`.

- [ ] **Step 3: Create `src/core/geometry/boxHandles.ts`**

```ts
import type { BoundingBox } from './BoundingBox';
import type { Point } from './Point';

/** Per box handle, clockwise from the top-left: which of min, middle, max it takes on each axis. */
const BOX_COLUMN = [0, 1, 2, 2, 2, 1, 0, 0] as const;
const BOX_ROW = [0, 0, 0, 1, 2, 2, 2, 1] as const;

/** Eight handles: four corners and four side midpoints. */
export const BOX_HANDLE_COUNT = BOX_COLUMN.length;

/**
 * Where box handle `index` sits — and, asked for `(index + 4) % 8`, the corner or side midpoint a
 * resize from `index` holds still, which is why the drag arithmetic asks this rather than a copy.
 * Shared by the asset designer's Transform mode and the plan editor's transform box.
 */
export function boxHandlePoint(box: BoundingBox, index: number): Point {
	return {
		x: [box.min.x, (box.min.x + box.max.x) / 2, box.max.x][BOX_COLUMN[index]],
		y: [box.min.y, (box.min.y + box.max.y) / 2, box.max.y][BOX_ROW[index]],
	};
}

/**
 * The factors and fixed point of a box-handle resize. The moved handle follows `to`, and the handle
 * opposite it holds still, so a factor is the new span over the old one along each axis the handle
 * moves — a side handle's other axis is exactly 1, because both midpoints are computed identically.
 * Dragged past the fixed side, a factor goes non-positive; the caller refuses it.
 *
 * Shift keeps proportions: both factors become whichever strays further from 1, for a side handle
 * as for a corner.
 */
export function boxResize(
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
```

- [ ] **Step 4: Point the designer at it**

Run `git grep -n "boxHandlePoint\|boxResize\|BOX_COLUMN" -- src tests` and update every importer it prints.

In `src/presentation/designer/selection/handles.ts`: delete the `BOX_COLUMN`/`BOX_ROW` constants and the whole `boxHandlePoint` function with its docblock; add `import { BOX_HANDLE_COUNT, boxHandlePoint } from '../../../core/geometry/boxHandles';`; replace

```ts
		...BOX_COLUMN.map((_, index): SelectionHandle => ({ role: { kind: 'box', index }, at: boxHandlePoint(box, index) })),
```

with

```ts
		...Array.from({ length: BOX_HANDLE_COUNT }, (_, index): SelectionHandle => ({ role: { kind: 'box', index }, at: boxHandlePoint(box, index) })),
```

In `src/presentation/designer/selection/selectionDrag.ts`: delete the local `boxResize` function and its docblock; change `import { boxHandlePoint, type HandleRole } from './handles';` to `import type { HandleRole } from './handles';`; add `import { boxResize } from '../../../core/geometry/boxHandles';`. The call site `boxResize(box.value, role.index, to, options.shift)` is unchanged.

- [ ] **Step 5: Run the new test and the designer's**

Run: `npm run check:fast -- tests/core/geometry/boxHandles.test.ts tests/presentation/designer`
Expected: PASS.
Run: `npx eslint src/core/geometry/boxHandles.ts src/presentation/designer/selection/handles.ts src/presentation/designer/selection/selectionDrag.ts tests/core/geometry/boxHandles.test.ts`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/core/geometry/boxHandles.ts src/presentation/designer/selection/handles.ts src/presentation/designer/selection/selectionDrag.ts tests/core/geometry/boxHandles.test.ts
git commit -m "refactor(geometry): share box-handle resize arithmetic from core

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: A placement's own size in the domain

**Files:**
- Modify: `src/domain/spatial/SpatialElement.ts`
- Modify: `src/domain/spatial/assetPlacement.ts`
- Test: `tests/domain/spatial/placementSize.test.ts`

**Interfaces:**
- Produces: `SpatialElement.size?: Dimensions` (from `domain/asset/AssetShape`)
- Produces: `placedOutline(element: Pick<SpatialElement, 'points' | 'size'>, shape: AssetShape): PlacedOutline` (widened)
- Produces: `placementBox(element: Pick<SpatialElement, 'size'>, shape: AssetShape): BoundingBox` — footprint box in the placement frame (anchor at origin, shape axes), stretched by the size
- Produces: `resizedPlacement(element: Pick<SpatialElement, 'points' | 'size'>, shape: AssetShape, factors: { readonly sx: number; readonly sy: number }, fixed: Point): { readonly points: readonly [Point, Point]; readonly size: Dimensions | undefined } | null`
- Produces: `withPlacementSize<T extends SpatialElement>(element: T, size: Dimensions | undefined): T`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { placedOutline, placementBox, placementPoints, resizedPlacement, withPlacementSize } from '../../../src/domain/spatial/assetPlacement';

const rounded = (points: readonly Point[]): Point[] => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const rect = (w: number, d: number): Point[] => [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];
function shape(patch: Partial<AssetShape> = {}): AssetShape {
	return { footprint: { points: rect(1000, 600) }, footprintOrigin: 'typed', footprintPending: false, clearancePending: false, anchorPending: false, clearance: null, anchor: { x: 0, y: 0 }, facing: 0, details: [], ...patch };
}
function placement(anchor: Point, heading: number, size?: { width: number; depth: number }): SpatialElement {
	return { id: 'element-asset', kind: 'asset', assetId: 'asset-1', points: placementPoints(anchor, heading), ...(size ? { size } : {}) };
}

describe('a placement’s own size', () => {
	it('draws exactly the library outline without a size', () => {
		expect(rounded(placedOutline(placement({ x: 1000, y: 2000 }, 0), shape()).footprint))
			.toEqual([{ x: 500, y: 1700 }, { x: 1500, y: 1700 }, { x: 1500, y: 2300 }, { x: 500, y: 2300 }]);
	});

	it('stretches footprint, clearance and details about the shape anchor before turning them', () => {
		const element = placement({ x: 0, y: 0 }, Math.PI / 2, { width: 2000, depth: 300 });
		const outline = placedOutline(element, shape({ clearance: { points: rect(1200, 800) }, details: [{ id: 'd', name: 'd', outline: { points: rect(200, 100) }, line: 'solid', pending: false }] }));
		// 2× along the shape's x and ½× along its y, then a quarter turn: x' = −y, y' = x.
		expect(rounded(outline.footprint)).toEqual([{ x: 150, y: -1000 }, { x: 150, y: 1000 }, { x: -150, y: 1000 }, { x: -150, y: -1000 }]);
		expect(rounded(outline.clearance ?? [])).toEqual([{ x: 200, y: -1200 }, { x: 200, y: 1200 }, { x: -200, y: 1200 }, { x: -200, y: -1200 }]);
		expect(rounded(outline.details[0].points)).toEqual([{ x: 25, y: -200 }, { x: 25, y: 200 }, { x: -25, y: 200 }, { x: -25, y: -200 }]);
	});

	it('boxes the stretched footprint in the placement frame, anchor at the origin', () => {
		expect(placementBox(placement({ x: 5000, y: 5000 }, 1.2, { width: 2000, depth: 300 }), shape({ anchor: { x: -500, y: 0 } })))
			.toEqual({ min: { x: 0, y: -150 }, max: { x: 2000, y: 150 } });
	});

	it.each([0, Math.PI / 2, Math.PI / 6])('keeps the fixed corner where it was on the plan at heading %s', heading => {
		const element = placement({ x: 1000, y: 1000 }, heading), library = shape();
		const before = placedOutline(element, library).footprint[0];
		// Stretch 1.5 × by 5/3 × about the corner the footprint starts at, (−500, −300) in the frame.
		const resized = resizedPlacement(element, library, { sx: 1.5, sy: 1000 / 600 }, { x: -500, y: -300 });
		if (!resized) throw new Error('Expected a resize');
		expect(resized.size?.width).toBeCloseTo(1500, 9);
		expect(resized.size?.depth).toBeCloseTo(1000, 9);
		const after = placedOutline(withPlacementSize({ ...element, points: resized.points }, resized.size), library).footprint[0];
		expect(after.x).toBeCloseTo(before.x, 6);
		expect(after.y).toBeCloseTo(before.y, 6);
		expect(Math.atan2(resized.points[1].y - resized.points[0].y, resized.points[1].x - resized.points[0].x)).toBeCloseTo(Math.atan2(Math.sin(heading), Math.cos(heading)), 12);
	});

	it('stores no size once a resize lands back within half a millimetre of the library', () => {
		const element = placement({ x: 0, y: 0 }, 0, { width: 2000, depth: 600 });
		expect(resizedPlacement(element, shape(), { sx: 0.50024, sy: 1 }, { x: 0, y: 0 })?.size).toBeUndefined();
		expect(resizedPlacement(element, shape(), { sx: 0.5006, sy: 1 }, { x: 0, y: 0 })?.size).toEqual({ width: expect.closeTo(1001.2, 6), depth: 600 });
	});

	it('neither stretches nor resizes a footprint whose extent is not representable', () => {
		const huge = shape({ footprint: { points: [{ x: -1e308, y: 0 }, { x: 1e308, y: 0 }, { x: 1e308, y: 10 }] } });
		const sized = placement({ x: 0, y: 0 }, 0, { width: 10, depth: 10 });
		expect(placedOutline(sized, huge).footprint).toEqual(placedOutline(placement({ x: 0, y: 0 }, 0), huge).footprint);
		expect(resizedPlacement(sized, huge, { sx: 2, sy: 2 }, { x: 0, y: 0 })).toBeNull();
	});

	it('sets or physically removes the size, and only an asset may carry a positive one up to a kilometre', () => {
		const sized = placement({ x: 0, y: 0 }, 0, { width: 900, depth: 400 });
		expect(withPlacementSize(sized, undefined)).not.toHaveProperty('size');
		expect(withPlacementSize(placement({ x: 0, y: 0 }, 0), { width: 1, depth: 2 }).size).toEqual({ width: 1, depth: 2 });
		expect(validSpatialElement(sized)).toBe(true);
		const item: SpatialElement = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] };
		expect(validSpatialElement({ ...item, size: { width: 900, depth: 400 } })).toBe(false);
		for (const size of [{ width: 0, depth: 400 }, { width: 900, depth: -1 }, { width: Number.NaN, depth: 400 }, { width: 900, depth: 1e6 + 1 }]) {
			expect(validSpatialElement({ ...sized, size })).toBe(false);
		}
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/domain/spatial/placementSize.test.ts`
Expected: FAIL — `placementBox`, `resizedPlacement`, `withPlacementSize` are not exported.

- [ ] **Step 3: Add the field and its rule to `src/domain/spatial/SpatialElement.ts`**

Add `import type { Dimensions } from '../asset/AssetShape';` beside the other imports. In `interface SpatialElement`, after `color?`:

```ts
	/** An asset placement's own width and depth along its library shape's axes, world mm; absent while it keeps the library's size. Only an `'asset'` carries one. */
	readonly size?: Dimensions;
```

Above `validSpatialElement`, add:

```ts
/** A placement's own size may not exceed a kilometre, the bound every other element measure takes. */
const MAX_PLACEMENT_MM = 1e6;

/** A color only on an item or placement, from its vocabulary; a size only on a placement, both sides finite, positive and in bound. */
function validPlacementFacts(element: SpatialElement): boolean {
	if (element.color !== undefined && (!itemColorKind(element.kind) || !isItemColor(element.color))) return false;
	return element.size === undefined || (element.kind === 'asset'
		&& [element.size.width, element.size.depth].every(side => Number.isFinite(side) && side > 0 && side <= MAX_PLACEMENT_MM));
}
```

In `validSpatialElement`, replace the line

```ts
	if (element.color !== undefined && (!itemColorKind(element.kind) || !isItemColor(element.color))) return false;
```

with

```ts
	if (!validPlacementFacts(element)) return false;
```

- [ ] **Step 4: Stretch, box and resize in `src/domain/spatial/assetPlacement.ts`**

Replace the imports block with:

```ts
import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { Point } from '../../core/geometry/Point';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../core/geometry/curvePolyline';
import { boundingBoxOf } from '../../core/geometry/operations';
import { unwrap } from '../../core/result/Result';
import type { DetailLine } from '../asset/AssetDetail';
import { dimensionsOf, type AssetShape, type Dimensions } from '../asset/AssetShape';
import type { SpatialElement } from './SpatialElement';
```

After `const FACING_POINT_MM = 1000;` add:

```ts
/** Within this many millimetres of the library's size on both sides, a placement stores no size of its own. */
const SIZE_MATCH_MM = 0.5;
```

Replace `place` and `placedOutline` with:

```ts
/** How far a placement's own size stretches its library shape along the shape's x and y; 1 × 1 without one, or when the library has no representable extent. */
function placementScale(element: Pick<SpatialElement, 'size'>, shape: AssetShape): { readonly x: number; readonly y: number } {
	const library = dimensionsOf(shape.footprint);
	return element.size && library.ok ? { x: element.size.width / library.value.width, y: element.size.depth / library.value.depth } : { x: 1, y: 1 };
}

function place(points: readonly Point[], shape: AssetShape, heading: number, at: Point, scale: { readonly x: number; readonly y: number }): Point[] {
	const turn = heading - shape.facing, cos = Math.cos(turn), sin = Math.sin(turn);
	return points.map(point => {
		const dx = (point.x - shape.anchor.x) * scale.x, dy = (point.y - shape.anchor.y) * scale.y;
		return { x: at.x + dx * cos - dy * sin, y: at.y + dx * sin + dy * cos };
	});
}

/** The asset's footprint, clearance and details in world millimetres, arcs flattened: stretched by the placement's own size, turned by heading − facing about the asset anchor, moved onto the placement anchor. */
export function placedOutline(element: Pick<SpatialElement, 'points' | 'size'>, shape: AssetShape): PlacedOutline {
	const heading = placementHeading(element), anchor = element.points[0], scale = placementScale(element, shape);
	const onPlan = (outline: CurvedPolygon): Point[] => place(flattened(outline), shape, heading, anchor, scale);
	return {
		footprint: onPlan(shape.footprint),
		clearance: shape.clearance ? onPlan(shape.clearance) : null,
		details: shape.details.map(detail => ({ points: onPlan(detail.outline), line: detail.line })),
	};
}
```

Append:

```ts
/**
 * The footprint's curve-aware box in the PLACEMENT FRAME — the anchor at the origin, x along the
 * library shape's x (turned onto the plan by heading − facing) — stretched by the placement's own size.
 * `unwrap`: every shape reaching a plan has been through `validateAssetShape`, whose footprint always has a box.
 */
export function placementBox(element: Pick<SpatialElement, 'size'>, shape: AssetShape): BoundingBox {
	const box = unwrap(boundingBoxOf(shape.footprint)), scale = placementScale(element, shape), { anchor } = shape;
	return {
		min: { x: (box.min.x - anchor.x) * scale.x, y: (box.min.y - anchor.y) * scale.y },
		max: { x: (box.max.x - anchor.x) * scale.x, y: (box.max.y - anchor.y) * scale.y },
	};
}

/**
 * The placement a box resize leaves (plan editor transform box design, Geometry): `factors` stretch the
 * placement frame about `fixed`, a point in that frame which stays put on the plan. The anchor moves by
 * `fixed ⊙ (1 − factors)` turned onto the plan, the heading is kept, and a size back within half a
 * millimetre of the library's is stored as none. `null` when the library has no representable extent.
 */
export function resizedPlacement(
	element: Pick<SpatialElement, 'points' | 'size'>,
	shape: AssetShape,
	factors: { readonly sx: number; readonly sy: number },
	fixed: Point,
): { readonly points: readonly [Point, Point]; readonly size: Dimensions | undefined } | null {
	const library = dimensionsOf(shape.footprint);
	if (!library.ok) return null;
	const scale = placementScale(element, shape), heading = placementHeading(element), anchor = element.points[0];
	const size = { width: library.value.width * scale.x * factors.sx, depth: library.value.depth * scale.y * factors.sy };
	const local = { x: fixed.x * (1 - factors.sx), y: fixed.y * (1 - factors.sy) };
	const turn = heading - shape.facing, cos = Math.cos(turn), sin = Math.sin(turn);
	const moved = { x: anchor.x + local.x * cos - local.y * sin, y: anchor.y + local.x * sin + local.y * cos };
	const matches = Math.abs(size.width - library.value.width) <= SIZE_MATCH_MM && Math.abs(size.depth - library.value.depth) <= SIZE_MATCH_MM;
	return { points: placementPoints(moved, heading), size: matches ? undefined : size };
}

/** The element with `size` set, or with the key physically removed when there is none — the way a reset color removes `color`. */
export function withPlacementSize<T extends SpatialElement>(element: T, size: Dimensions | undefined): T {
	const { size: previous, ...plain } = element;
	void previous;
	return (size === undefined ? plain : { ...plain, size }) as T;
}
```

- [ ] **Step 5: Run the tests**

Run: `npm run check:fast -- tests/domain`
Expected: PASS, including the unchanged `tests/domain/spatial/assetPlacement.test.ts` and `tests/domain/spatial/itemColor.test.ts`.
Run: `npx eslint src/domain/spatial/SpatialElement.ts src/domain/spatial/assetPlacement.ts tests/domain/spatial/placementSize.test.ts`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/domain/spatial/SpatialElement.ts src/domain/spatial/assetPlacement.ts tests/domain/spatial/placementSize.test.ts
git commit -m "feat(domain): an asset placement can carry its own width and depth

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Plan geometry schema 15

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts` (schema 14 block and below)
- Modify: `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` (`hasItemColor`, `writtenSchema`, read validation)
- Modify: `src/application/commands/spatial/sameGeometryDocument.ts`
- Test: `tests/infrastructure/persistence/dto/placementSizeSchema.test.ts`

**Interfaces:**
- Consumes: `SpatialElement.size` (Task 2)
- Produces: `PlanGeometrySchemaV15` (exported), `PlanGeometryDTO['schemaVersion']` includes `15`; a sidecar with any element `size` is written at schema 15.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { PlanGeometrySchemaV15 } from '../../../../src/infrastructure/persistence/dto/planGeometry';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { MigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { sameGeometryDocument } from '../../../../src/application/commands/spatial/sameGeometryDocument';

const placement: SpatialElement = { id: 'element-sofa', kind: 'asset', assetId: 'asset-sofa', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
const structure = { walls: [], openings: [], boundaries: [], elements: [placement] };
const old = { schemaVersion: 14, planId: 'floor', revision: 0, unit: 'mm', calibration: null, objects: [], structure };
const sized = { ...old, schemaVersion: 15, structure: { ...structure, elements: [{ ...placement, size: { width: 1800, depth: 900 } }] } };

it('includes a placement’s own size in document equality', () => {
	const document = { calibration: null, objects: [], structure };
	expect(sameGeometryDocument(document, { ...document, structure: sized.structure })).toBe(false);
	expect(sameGeometryDocument({ ...document, intended: structure }, { ...document, intended: sized.structure })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...structure, elements: [{ ...placement }] } })).toBe(true);
});

it('migrates schema 14 without inventing a size and reads a size at 15', () => {
	const migrations = new MigrationRunner(); migrations.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS);
	expect(PlanGeometrySchemaV15.parse(migrations.migrateToLatest('plan-geometry', old, 14)).structure?.elements?.[0]).not.toHaveProperty('size');
	expect(old.schemaVersion).toBe(14);
	expect(PlanGeometrySchemaV15.parse(sized).structure?.elements?.[0].size).toEqual({ width: 1800, depth: 900 });
});

it('refuses a size on anything but an asset, a non-positive or oversized side, and a file from a newer build', () => {
	const item = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], size: { width: 1, depth: 1 } };
	for (const invalid of [item, { ...placement, size: { width: 0, depth: 900 } }, { ...placement, size: { width: 1800, depth: 1e6 + 1 } }]) {
		expect(PlanGeometrySchemaV15.safeParse({ ...sized, structure: { ...structure, elements: [invalid] } }).success).toBe(false);
	}
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(migration => migration.toVersion <= 14));
	expect(() => previous.migrateToLatest('plan-geometry', sized, 15)).toThrow('newer than this build supports');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/infrastructure/persistence/dto/placementSizeSchema.test.ts`
Expected: FAIL — `PlanGeometrySchemaV15` is not exported.

- [ ] **Step 3: Declare schema 15 in `planGeometry.ts`**

Replace everything from the line `/** Schema 14 adds placement colors without letting schema-13 readers silently strip them. */` to the end of the file with:

```ts
/** Schema 14 adds placement colors without letting schema-13 readers silently strip them. */
const colorRule = (element: { readonly kind: string; readonly color?: string }) => element.color === undefined || itemColorKind(element.kind);
const COLOR_MESSAGE = { message: 'Only an item or asset placement can carry a color.' };
const SpatialElementSchemaV14 = SpatialElementShapeV12.extend({ color: z.enum(ITEM_COLORS).optional() })
	.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE).refine(draftingRule, DRAFTING_MESSAGE).refine(colorRule, COLOR_MESSAGE);
const StructureSchemaV14 = StructureSchemaV13.extend({ elements: z.array(SpatialElementSchemaV14).optional() });
export const PlanGeometrySchemaV14 = PlanGeometrySchemaV13.extend({ schemaVersion: z.literal(14), structure: StructureSchemaV14.optional(), intended: StructureSchemaV14.optional() });
/** Schema 15: an asset placement's own width and depth (plan editor transform box design, Data), so a schema-14 build refuses the file rather than dropping it. */
const PlacementSizeSchema = z.object({ width: z.number().positive().max(1e6), depth: z.number().positive().max(1e6) });
const sizeRule = (element: { readonly kind: string; readonly size?: unknown }) => element.size === undefined || element.kind === 'asset';
const SpatialElementSchemaV15 = SpatialElementShapeV12.extend({ color: z.enum(ITEM_COLORS).optional(), size: PlacementSizeSchema.optional() })
	.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE).refine(draftingRule, DRAFTING_MESSAGE).refine(colorRule, COLOR_MESSAGE)
	.refine(sizeRule, { message: 'Only an asset placement can carry its own size.' });
const StructureSchemaV15 = StructureSchemaV13.extend({ elements: z.array(SpatialElementSchemaV15).optional() });
export const PlanGeometrySchemaV15 = PlanGeometrySchemaV14.extend({ schemaVersion: z.literal(15), structure: StructureSchemaV15.optional(), intended: StructureSchemaV15.optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9, PlanGeometrySchemaV10, PlanGeometrySchemaV11, PlanGeometrySchemaV12, PlanGeometrySchemaV13, PlanGeometrySchemaV14, PlanGeometrySchemaV15]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV15>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 };
```

- [ ] **Step 4: Migration 14 → 15**

In `plan-geometry.migrations.ts`, after the `fromVersion: 13, toVersion: 14` entry, add:

```ts
}, {
	fromVersion: 14, toVersion: 15,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 15 } : input,
```

(the closing `}];` stays last).

- [ ] **Step 5: Write and read schema 15 in `PlanGeometryStore.ts`**

Run `git grep -n "hasItemColor" -- src` and confirm `writtenSchema` is its only caller. Replace

```ts
/** Explicit user content requires a reader that understands placement colors. */
function hasItemColor(dto: Pick<PlanGeometryDTO, 'structure' | 'intended'>): boolean {
	return [dto.structure, dto.intended].some(structure => structure?.elements?.some(element => element.color !== undefined));
}
```

with

```ts
/** Explicit placement facts require a reader that understands them: a placement's own size needs schema 15, a color 14. */
function placementSchema(dto: Pick<PlanGeometryDTO, 'structure' | 'intended'>): 15 | 14 | null {
	const elements = [dto.structure, dto.intended].flatMap(structure => structure?.elements ?? []);
	if (elements.some(element => element.size !== undefined)) return 15;
	return elements.some(element => element.color !== undefined) ? 14 : null;
}
```

In `writtenSchema`, replace `	if (hasItemColor(dto)) return 14;` with

```ts
	const placement = placementSchema(dto);
	if (placement !== null) return placement;
```

Change the import `import { PlanGeometrySchema, PlanGeometrySchemaV14 } from '../../persistence/dto/planGeometry';` to `import { PlanGeometrySchema, PlanGeometrySchemaV15 } from '../../persistence/dto/planGeometry';` and `const validated = PlanGeometrySchemaV14.safeParse(migrated);` to `const validated = PlanGeometrySchemaV15.safeParse(migrated);`.

- [ ] **Step 6: Compare the size in `sameGeometryDocument.ts`**

In `structureContent`, change the element tuple's tail `element.flipped ?? null, element.color ?? null])] : null;` to:

```ts
element.flipped ?? null, element.color ?? null, element.size ? [element.size.width, element.size.depth] : null])] : null;
```

- [ ] **Step 7: Run the tests**

Run: `npm run check:fast -- tests/infrastructure tests/application tests/domain`
Expected: PASS (including `itemColor.test.ts`, `wallSidesPersistence.test.ts`, `structurePersistence.test.ts`).
Run: `npx eslint src/infrastructure/persistence/dto/planGeometry.ts src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts src/infrastructure/obsidian/repositories/PlanGeometryStore.ts src/application/commands/spatial/sameGeometryDocument.ts tests/infrastructure/persistence/dto/placementSizeSchema.test.ts`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/persistence/dto/planGeometry.ts src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts src/infrastructure/obsidian/repositories/PlanGeometryStore.ts src/application/commands/spatial/sameGeometryDocument.ts tests/infrastructure/persistence/dto/placementSizeSchema.test.ts
git commit -m "feat(persistence): plan geometry schema 15 stores a placement's own size

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Transform box geometry

**Files:**
- Modify: `src/presentation/editor/handleMetrics.ts` (append two constants)
- Create: `src/presentation/editor/elements/transformBox.ts`
- Test: `tests/presentation/editor/elements/transformBox.test.ts`

**Interfaces:**
- Consumes: `BOX_HANDLE_COUNT`, `boxHandlePoint`, `boxResize` (Task 1); `placementBox`, `placementHeading`, `resizedPlacement` (Task 2)
- Produces:
  - `TRANSFORM_BOX_PADDING_PX = 12`, `TRANSFORM_HANDLE_SIZE_PX = 8` in `handleMetrics.ts`
  - `interface TransformBox { readonly element: SpatialElement; readonly origin: Point; readonly u: Point; readonly box: BoundingBox; readonly shape?: AssetShape }` — world = origin + a·u + b·v, v = u turned a quarter anticlockwise
  - `interface ResizedGeometry { readonly points: readonly Point[]; readonly size?: Dimensions | undefined }`
  - `itemTransformBox(element: SpatialElement): TransformBox | null`
  - `assetTransformBox(element: SpatialElement, shape: AssetShape): TransformBox`
  - `transformHandlePoints(frame: TransformBox, worldPerPixel: number): Point[]` — padded, world
  - `transformHandleWorld(frame: TransformBox, index: number): Point` — unpadded, world
  - `transformBoxSize(frame: TransformBox): Dimensions`
  - `resizeTransformBox(frame: TransformBox, index: number, to: Point, shift: boolean): ResizedGeometry | null`
  - `sizedTransformBox(frame: TransformBox, size: Dimensions): ResizedGeometry | null` — about the box centre

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import { rotate } from '../../../../src/core/geometry/operations';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { placedOutline, placementPoints, withPlacementSize } from '../../../../src/domain/spatial/assetPlacement';
import { assetTransformBox, itemTransformBox, resizeTransformBox, sizedTransformBox, transformBoxSize, transformHandlePoints, transformHandleWorld } from '../../../../src/presentation/editor/elements/transformBox';
import { expectDefined } from '../../../helpers/domain';

const rounded = (points: readonly Point[]): Point[] => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const item: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] };

describe('item transform box', () => {
	it('frames an axis-aligned item along its first edge, with padded handles clockwise from the top-left', () => {
		const frame = expectDefined(itemTransformBox(item), 'item frame');
		expect(frame.box).toEqual({ min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } });
		expect(transformBoxSize(frame)).toEqual({ width: 1000, depth: 500 });
		expect(transformHandlePoints(frame, 2)).toEqual([
			{ x: 476, y: 476 }, { x: 1000, y: 476 }, { x: 1524, y: 476 }, { x: 1524, y: 750 },
			{ x: 1524, y: 1024 }, { x: 1000, y: 1024 }, { x: 476, y: 1024 }, { x: 476, y: 750 },
		]);
		expect(transformHandleWorld(frame, 4)).toEqual({ x: 1500, y: 1000 });
	});

	it('stretches an item about the handle opposite the one dragged, and keeps proportions with Shift', () => {
		const frame = expectDefined(itemTransformBox(item), 'item frame');
		const doubled = [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }];
		expect(resizeTransformBox(frame, 4, { x: 2500, y: 1500 }, false)).toEqual({ points: doubled });
		expect(resizeTransformBox(frame, 7, { x: 0, y: 9999 }, false)).toEqual({ points: [{ x: 0, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 0, y: 1000 }] });
		expect(resizeTransformBox(frame, 4, { x: 2500, y: 1000 }, true)).toEqual({ points: doubled });
	});

	it('refuses a side under a millimetre, flipped past the fixed side or over a kilometre, and an outline with no area', () => {
		const frame = expectDefined(itemTransformBox(item), 'item frame');
		expect(resizeTransformBox(frame, 4, { x: 500.5, y: 1500 }, false)).toBeNull();
		expect(resizeTransformBox(frame, 4, { x: 100, y: 1500 }, false)).toBeNull();
		expect(resizeTransformBox(frame, 4, { x: 2e6, y: 1500 }, false)).toBeNull();
		expect(itemTransformBox({ ...item, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] })).toBeNull();
		expect(itemTransformBox({ ...item, points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }] })).toBeNull();
	});

	it('frames a turned item along its own edge, so a resize keeps it rectangular', () => {
		const turned = { ...item, points: rotate({ points: item.points }, Math.PI / 6, { x: 1000, y: 750 }).points };
		const frame = expectDefined(itemTransformBox(turned), 'turned frame');
		expect(transformBoxSize(frame).width).toBeCloseTo(1000, 9);
		expect(transformBoxSize(frame).depth).toBeCloseTo(500, 9);
		const far = transformHandleWorld(frame, 4);
		const resized = expectDefined(resizeTransformBox(frame, 4, { x: far.x + 100 * Math.cos(Math.PI / 6), y: far.y + 100 * Math.sin(Math.PI / 6) }, false), 'resize').points;
		const side = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
		expect(side(resized[0], resized[1])).toBeCloseTo(1100, 6);
		expect(side(resized[1], resized[2])).toBeCloseTo(500, 6);
		expect(rounded([resized[0]])).toEqual(rounded([turned.points[0]]));
		expect((resized[1].x - resized[0].x) * (resized[2].x - resized[1].x) + (resized[1].y - resized[0].y) * (resized[2].y - resized[1].y)).toBeCloseTo(0, 6);
	});
});

describe('placement transform box', () => {
	const library: AssetShape = { footprint: { points: [{ x: -400, y: -300 }, { x: 400, y: -300 }, { x: 400, y: 300 }, { x: -400, y: 300 }] }, footprintOrigin: 'typed', footprintPending: false, clearancePending: false, anchorPending: false, clearance: null, anchor: { x: 0, y: 0 }, facing: 0, details: [] };
	const placement: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: placementPoints({ x: 1000, y: 1000 }, Math.PI / 2) };

	it('frames a placement on its anchor, turned by heading minus facing, around its footprint', () => {
		const frame = assetTransformBox(placement, library);
		expect(frame.box).toEqual({ min: { x: -400, y: -300 }, max: { x: 400, y: 300 } });
		expect(rounded(transformHandlePoints(frame, 0).filter((_, index) => index % 2 === 0))).toEqual(rounded(placedOutline(placement, library).footprint));
	});

	it('resizes a placement into its own size, holding the opposite corner on the plan', () => {
		const frame = assetTransformBox(placement, library), fixedBefore = transformHandleWorld(frame, 0), far = transformHandleWorld(frame, 4);
		// The frame's x runs down the plan's +y at a quarter turn: 400 further along it and 200 further across it.
		const resized = expectDefined(resizeTransformBox(frame, 4, { x: far.x - 200, y: far.y + 400 }, false), 'resize');
		expect(resized.size).toEqual({ width: expect.closeTo(1200, 6), depth: expect.closeTo(800, 6) });
		const after = assetTransformBox(withPlacementSize({ ...placement, points: resized.points }, resized.size), library);
		expect(rounded([transformHandleWorld(after, 0)])).toEqual(rounded([fixedBefore]));
	});

	it('applies a typed size about the box centre and resets to the library size as no size at all', () => {
		const frame = assetTransformBox(placement, library);
		const wide = expectDefined(sizedTransformBox(frame, { width: 1600, depth: 600 }), 'wide');
		expect(wide.size).toEqual({ width: expect.closeTo(1600, 6), depth: expect.closeTo(600, 6) });
		const widened = withPlacementSize({ ...placement, points: wide.points }, wide.size);
		const reset = expectDefined(sizedTransformBox(assetTransformBox(widened, library), { width: 800, depth: 600 }), 'reset');
		expect(reset.size).toBeUndefined();
		expect(rounded(reset.points.slice(0, 1))).toEqual(rounded(placement.points.slice(0, 1)));
		expect(sizedTransformBox(frame, { width: 0.5, depth: 600 })).toBeNull();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/elements/transformBox.test.ts`
Expected: FAIL — cannot resolve `transformBox`.

- [ ] **Step 3: Append to `src/presentation/editor/handleMetrics.ts`**

```ts
/**
 * How far outside an item's or placement's outline its transform box and handles are drawn, so the
 * item's own vertex dots stay grabbable beside the corner handles (plan editor transform box design, Decision 3).
 */
export const TRANSFORM_BOX_PADDING_PX = 12;
/** The drawn side of a transform box handle square; the grab reach is `VERTEX_GRAB_RADIUS_PX`, like a vertex. */
export const TRANSFORM_HANDLE_SIZE_PX = 8;
```

- [ ] **Step 4: Create `src/presentation/editor/elements/transformBox.ts`**

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import { BOX_HANDLE_COUNT, boxHandlePoint, boxResize } from '../../../core/geometry/boxHandles';
import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape, Dimensions } from '../../../domain/asset/AssetShape';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { placementBox, placementHeading, resizedPlacement } from '../../../domain/spatial/assetPlacement';
import { TRANSFORM_BOX_PADDING_PX } from '../handleMetrics';

/** No side of a resized item or placement is shorter than this, world mm. */
const MIN_SIDE_MM = 1;
/** Nor longer than a kilometre, the bound `validSpatialElement` holds a placement's size to. */
const MAX_SIDE_MM = 1e6;

/**
 * A selected item's or placement's resize frame (plan editor transform box design): world = origin + a·u + b·v,
 * where `v` is `u` turned a quarter anticlockwise. `box` is the outline's extent in (a, b); `shape` is present
 * exactly for an asset placement, whose frame is `placementBox`'s.
 */
export interface TransformBox {
	readonly element: SpatialElement;
	readonly origin: Point;
	readonly u: Point;
	readonly box: BoundingBox;
	readonly shape?: AssetShape;
}

/** What a resize writes: new points, and for a placement its own size — absent while it matches the library. */
export interface ResizedGeometry {
	readonly points: readonly Point[];
	readonly size?: Dimensions | undefined;
}

type Frame = Pick<TransformBox, 'origin' | 'u'>;
const toWorld = (frame: Frame, local: Point): Point =>
	({ x: frame.origin.x + local.x * frame.u.x - local.y * frame.u.y, y: frame.origin.y + local.x * frame.u.y + local.y * frame.u.x });
function toLocal(frame: Frame, world: Point): Point {
	const dx = world.x - frame.origin.x, dy = world.y - frame.origin.y;
	return { x: dx * frame.u.x + dy * frame.u.y, y: -dx * frame.u.y + dy * frame.u.x };
}
const withinLimits = (width: number, depth: number): boolean => width >= MIN_SIDE_MM && depth >= MIN_SIDE_MM && width <= MAX_SIDE_MM && depth <= MAX_SIDE_MM;

/** An item's frame follows its first edge of non-zero length; `null` for an outline with no such edge, or a side outside the limits. */
export function itemTransformBox(element: SpatialElement): TransformBox | null {
	const { points } = element;
	const index = points.findIndex((point, at) => { const next = points[(at + 1) % points.length]; return next.x !== point.x || next.y !== point.y; });
	if (index < 0) return null;
	const start = points[index], end = points[(index + 1) % points.length], length = Math.hypot(end.x - start.x, end.y - start.y);
	const frame = { origin: start, u: { x: (end.x - start.x) / length, y: (end.y - start.y) / length } };
	const box = unwrap(boundingBoxOf({ points: points.map(point => toLocal(frame, point)) }));
	return withinLimits(box.max.x - box.min.x, box.max.y - box.min.y) ? { element, ...frame, box } : null;
}

/** A placement's frame is its own: the anchor at the origin, the library shape's x turned onto the plan by heading − facing. */
export function assetTransformBox(element: SpatialElement, shape: AssetShape): TransformBox {
	const turn = placementHeading(element) - shape.facing;
	return { element, shape, origin: element.points[0], u: { x: Math.cos(turn), y: Math.sin(turn) }, box: placementBox(element, shape) };
}

export function transformBoxSize(frame: TransformBox): Dimensions {
	return { width: frame.box.max.x - frame.box.min.x, depth: frame.box.max.y - frame.box.min.y };
}

/** The eight handles in world coordinates, clockwise from the frame's top-left, on the box grown by the padding at this camera. What is drawn and what is hit. */
export function transformHandlePoints(frame: TransformBox, worldPerPixel: number): Point[] {
	const pad = TRANSFORM_BOX_PADDING_PX * worldPerPixel, { min, max } = frame.box;
	const grown = { min: { x: min.x - pad, y: min.y - pad }, max: { x: max.x + pad, y: max.y + pad } };
	return Array.from({ length: BOX_HANDLE_COUNT }, (_, index) => toWorld(frame, boxHandlePoint(grown, index)));
}

/** The unpadded point a handle stands for, in world coordinates: where a drag adds the pointer's travel. */
export function transformHandleWorld(frame: TransformBox, index: number): Point {
	return toWorld(frame, boxHandlePoint(frame.box, index));
}

function scaled(frame: TransformBox, factors: { readonly sx: number; readonly sy: number }, fixed: Point): ResizedGeometry | null {
	if (frame.shape) return resizedPlacement(frame.element, frame.shape, factors, fixed);
	return { points: frame.element.points.map(point => {
		const local = toLocal(frame, point);
		return toWorld(frame, { x: fixed.x + (local.x - fixed.x) * factors.sx, y: fixed.y + (local.y - fixed.y) * factors.sy });
	}) };
}

/**
 * The geometry handle `index` dragged to `to` (world) leaves, or `null` when a side would be under a millimetre,
 * over a kilometre, or flipped past the fixed side. An item's points stretch in its frame about the opposite
 * handle; a placement moves its anchor and takes its own size.
 */
export function resizeTransformBox(frame: TransformBox, index: number, to: Point, shift: boolean): ResizedGeometry | null {
	const { factors, origin } = boxResize(frame.box, index, toLocal(frame, to), shift), size = transformBoxSize(frame);
	return withinLimits(size.width * factors.sx, size.depth * factors.sy) ? scaled(frame, factors, origin) : null;
}

/** A typed width and depth, applied about the box centre: the Inspector's resize. `null` outside the same limits a drag has. */
export function sizedTransformBox(frame: TransformBox, size: Dimensions): ResizedGeometry | null {
	if (!withinLimits(size.width, size.depth)) return null;
	const current = transformBoxSize(frame), { min, max } = frame.box;
	return scaled(frame, { sx: size.width / current.width, sy: size.depth / current.depth }, { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 });
}
```

- [ ] **Step 5: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/elements/transformBox.test.ts`
Expected: PASS. If a rounding assertion fails by `-0`, the fix is the `+ 0` in `rounded`, not the source.
Run: `npx eslint src/presentation/editor/handleMetrics.ts src/presentation/editor/elements/transformBox.ts tests/presentation/editor/elements/transformBox.test.ts`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/handleMetrics.ts src/presentation/editor/elements/transformBox.ts tests/presentation/editor/elements/transformBox.test.ts
git commit -m "feat(editor): transform box frames and resize arithmetic for items and placements

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The resize gesture in SelectTool

**Files:**
- Modify: `src/presentation/editor/selection/resolveSelectionTarget.ts`
- Create: `src/presentation/editor/elements/ElementResize.ts`
- Modify: `src/presentation/editor/tools/select-tool.ts`
- Modify: `src/presentation/editor/tools/registerEditorTools.ts`
- Modify: `src/presentation/editor/tools/render-state.ts` (`hoveredTargetKind`)
- Modify: `src/presentation/editor/surface/cursor.ts`
- Test: `tests/presentation/editor/selection/resizeTarget.test.ts`, `tests/presentation/editor/elements/elementResize.test.ts`, `tests/presentation/editor/tools/selectToolResize.test.ts`

**Interfaces:**
- Consumes: `TransformBox`, `ResizedGeometry`, `resizeTransformBox`, `transformHandleWorld`, `transformHandlePoints` (Task 4)
- Produces:
  - `SelectionTarget` gains `{ readonly kind: 'resize'; readonly id: string; readonly handleIndex: number }`; `resolveSelectionTarget` input gains `resizeHandles?: { readonly id: string; readonly points: readonly Point[] }`
  - `interface ElementResizeDeps { transformBox?: () => TransformBox | null; previewResize?: (id: string | null, next?: ResizedGeometry) => void; commitResize?: (id: string, next: ResizedGeometry, original: SpatialElement) => void }`
  - `class ElementResize { active: boolean; start(context, event, frame: TransformBox, index: number); move(context, event); finish(context, event); cancel() }`
  - `SelectToolDeps` and `EditorToolDeps` extend `ElementResizeDeps`
  - `RenderState.hoveredTargetKind` and `cursor.ts`'s input accept `'resize'`, mapped to `rp-plan-canvas-grab`

- [ ] **Step 1: Write the failing target test** — `tests/presentation/editor/selection/resizeTarget.test.ts`

```ts
import { expect, it } from 'vitest';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';

const item = { id: 'element-item', kind: 'object' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }] };
const points = [{ x: -12, y: -12 }, { x: 500, y: -12 }, { x: 1012, y: -12 }, { x: 1012, y: 250 }, { x: 1012, y: 512 }, { x: 500, y: 512 }, { x: -12, y: 512 }, { x: -12, y: 250 }];
const base = { candidates: [item], selectedIds: [item.id], handleToleranceWorld: 8, resizeHandles: { id: item.id, points } };

it('answers a transform box handle for the one selected element, below its vertex handle and above its body', () => {
	expect(resolveSelectionTarget({ ...base, worldPoint: { x: 1014, y: 514 } })).toEqual({ kind: 'resize', id: item.id, handleIndex: 4 });
	expect(resolveSelectionTarget({ ...base, worldPoint: { x: -12, y: 250 } })).toEqual({ kind: 'resize', id: item.id, handleIndex: 7 });
	const crowded = { ...base, resizeHandles: { id: item.id, points: [{ x: -4, y: -4 }, ...points.slice(1)] } };
	expect(resolveSelectionTarget({ ...crowded, worldPoint: { x: -2, y: -2 } })).toEqual({ kind: 'handle', id: item.id, vertexIndex: 0 });
	expect(resolveSelectionTarget({ ...base, worldPoint: { x: 500, y: 250 } })).toEqual({ kind: 'body', id: item.id });
});

it('offers no transform box handle to a multi-selection, another selection, a Shift-cleared selection or Alt cycling', () => {
	const other = { ...item, id: 'element-other', points: item.points.map(point => ({ x: point.x + 5000, y: point.y })) };
	const at = { x: 1012, y: 512 };
	expect(resolveSelectionTarget({ ...base, candidates: [item, other], selectedIds: [item.id, other.id], worldPoint: at })).toBeNull();
	expect(resolveSelectionTarget({ ...base, candidates: [item, other], selectedIds: [other.id], worldPoint: at })).toBeNull();
	expect(resolveSelectionTarget({ ...base, selectedIds: [], worldPoint: at })).toBeNull();
	expect(resolveSelectionTarget({ ...base, worldPoint: at, cycle: true })).toBeNull();
});
```

- [ ] **Step 2: Write the failing gesture test** — `tests/presentation/editor/elements/elementResize.test.ts`

```ts
import { expect, it, vi } from 'vitest';
import { ElementResize, type ElementResizeDeps } from '../../../../src/presentation/editor/elements/ElementResize';
import { itemTransformBox } from '../../../../src/presentation/editor/elements/transformBox';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { pointerAt, shiftPointerAt, toolContext } from '../../../helpers/tool-context';
import { expectDefined } from '../../../helpers/domain';

const item: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }] };
const frame = expectDefined(itemTransformBox(item), 'item frame');
const wider = [{ x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1000 }, { x: 0, y: 1000 }];

function rig(options: Parameters<typeof toolContext>[0] = {}) {
	const commitResize = vi.fn<NonNullable<ElementResizeDeps['commitResize']>>(), previewResize = vi.fn<NonNullable<ElementResizeDeps['previewResize']>>();
	return { context: toolContext(options).context, commitResize, previewResize, resize: new ElementResize({ commitResize, previewResize }) };
}

it('drags from where the handle was pressed, previews, and commits the release once against the original element', () => {
	const { context, commitResize, previewResize, resize } = rig();
	// Pressed on the padded far corner, 12 px outside (1000, 500) at 1 mm/px.
	resize.start(context, pointerAt(1012, 512), frame, 4);
	resize.move(context, pointerAt(1262, 1012));
	expect(previewResize).toHaveBeenLastCalledWith(item.id, { points: [{ x: 0, y: 0 }, { x: 1250, y: 0 }, { x: 1250, y: 1000 }, { x: 0, y: 1000 }] });
	resize.finish(context, pointerAt(1512, 1012)); resize.finish(context, pointerAt(1512, 1012));
	expect(commitResize).toHaveBeenCalledExactlyOnceWith(item.id, { points: wider }, item);
	expect(previewResize).toHaveBeenLastCalledWith(item.id, { points: wider });
	expect(resize.active).toBe(false);
});

it('treats a press without travel as a click, and Shift as keep proportions', () => {
	const { context, commitResize, previewResize, resize } = rig();
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.move(context, pointerAt(1013, 512)); resize.finish(context, pointerAt(1013, 512));
	expect(commitResize).not.toHaveBeenCalled(); expect(previewResize).toHaveBeenLastCalledWith(null);
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.finish(context, shiftPointerAt(2012, 612));
	expect(commitResize).toHaveBeenCalledWith(item.id, { points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 0, y: 1000 }] }, item);
});

it('keeps the last valid preview past a limit and cancels a release there', () => {
	const { context, commitResize, previewResize, resize } = rig();
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.move(context, pointerAt(1262, 1012));
	const last = previewResize.mock.calls.at(-1);
	resize.move(context, pointerAt(-500, 1012));
	expect(previewResize.mock.calls.at(-1)).toEqual(last);
	resize.finish(context, pointerAt(-500, 1012));
	expect(commitResize).not.toHaveBeenCalled(); expect(previewResize).toHaveBeenLastCalledWith(null); expect(resize.active).toBe(false);
});

it('snaps the dragged handle against the plan minus the element, draws guides and clears them', () => {
	const excluded: string[][] = [];
	const { context, commitResize, resize } = rig({ snapCandidates: exclude => { excluded.push([...(exclude ?? [])]); return { vertices: [{ x: 1504, y: 1000 }] }; } });
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.move(context, pointerAt(1512, 1012));
	expect(context.renderState.snapGuides.length).toBeGreaterThan(0);
	expect(excluded.every(ids => ids.includes(item.id))).toBe(true);
	resize.finish(context, pointerAt(1512, 1012));
	expect(commitResize.mock.calls[0]?.[1].points[1]).toEqual({ x: 1504, y: 0 });
	expect(context.renderState.snapGuides).toEqual([]);
});

it('never starts while writes are blocked, with Alt or without a commit, and gives up when writes block mid-drag', () => {
	const { context, commitResize, resize } = rig();
	resize.start(toolContext({ writesBlocked: true }).context, pointerAt(1012, 512), frame, 4); expect(resize.active).toBe(false);
	const alt = pointerAt(1012, 512); resize.start(context, { ...alt, modifiers: { ...alt.modifiers, alt: true } }, frame, 4); expect(resize.active).toBe(false);
	const bare = new ElementResize({}); bare.start(context, pointerAt(1012, 512), frame, 4); expect(bare.active).toBe(false);
	let blocked = false;
	const blockable = { ...context, writesBlocked: () => blocked };
	resize.start(blockable, pointerAt(1012, 512), frame, 4); blocked = true; resize.move(blockable, pointerAt(1512, 1012)); expect(resize.active).toBe(false);
	blocked = false; resize.start(blockable, pointerAt(1012, 512), frame, 4); resize.move(blockable, pointerAt(1512, 1012)); blocked = true; resize.finish(blockable, pointerAt(1512, 1012));
	expect(commitResize).not.toHaveBeenCalled(); expect(resize.active).toBe(false);
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.finish(context, { ...pointerAt(1512, 1012), button: 'secondary' }); expect(resize.active).toBe(true);
	resize.cancel(); resize.move(context, pointerAt(0, 0)); resize.finish(context, pointerAt(0, 0));
	expect(commitResize).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Write the failing tool test** — `tests/presentation/editor/tools/selectToolResize.test.ts`

```ts
import { expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { itemTransformBox } from '../../../../src/presentation/editor/elements/transformBox';
import { cursorClassFor } from '../../../../src/presentation/editor/surface/cursor';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

const item: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }] };
const wider = [{ x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1000 }, { x: 0, y: 1000 }];

function rig(overrides: Partial<SelectToolDeps> = {}) {
	setActivePinia(createPinia());
	const { context } = toolContext();
	const commitResize = vi.fn<NonNullable<SelectToolDeps['commitResize']>>(), previewResize = vi.fn<NonNullable<SelectToolDeps['previewResize']>>(), moveElement = vi.fn<NonNullable<SelectToolDeps['moveElement']>>();
	const tool = new SelectTool({
		spatialObjects: () => [item],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
		transformBox: () => itemTransformBox(item), commitResize, previewResize, moveElement,
		...overrides,
	});
	tool.activate(context);
	context.selection.select([item.id as EntityId<string>]);
	return { tool, context, commitResize, previewResize, moveElement };
}

it('predicts a transform box handle on hover with the grab cursor, then resizes from it instead of moving the item', () => {
	const { tool, context, commitResize, moveElement } = rig();
	tool.pointerMove(pointerAt(1012, 512));
	expect(context.renderState.hoveredTargetKind).toBe('resize');
	expect(cursorClassFor({ activeToolId: 'select', panPhase: 'idle', hoveredObjectId: item.id, hoveredTargetKind: 'resize' })).toBe('rp-plan-canvas-grab');
	tool.pointerDown(pointerAt(1012, 512));
	expect(tool.hasDraft()).toBe(true);
	tool.pointerMove(pointerAt(1512, 1012)); tool.pointerUp(pointerAt(1512, 1012));
	expect(commitResize).toHaveBeenCalledExactlyOnceWith(item.id, { points: wider }, item);
	expect(moveElement).not.toHaveBeenCalled();
});

it('abandons a resize on cancel and offers no handles when the facade answers no box', () => {
	const { tool, commitResize, previewResize } = rig();
	tool.pointerDown(pointerAt(1012, 512)); tool.pointerMove(pointerAt(1512, 1012));
	expect(tool.cancelGeometryGesture()).toBe(true);
	expect(previewResize).toHaveBeenLastCalledWith(null);
	tool.pointerUp(pointerAt(1512, 1012));
	expect(commitResize).not.toHaveBeenCalled();
	const none = rig({ transformBox: () => null });
	none.tool.pointerMove(pointerAt(1012, 512));
	expect(none.context.renderState.hoveredTargetKind).toBeNull();
});
```

- [ ] **Step 4: Run the three tests to verify they fail**

Run: `npm run check:fast -- tests/presentation/editor/selection/resizeTarget.test.ts tests/presentation/editor/elements/elementResize.test.ts tests/presentation/editor/tools/selectToolResize.test.ts`
Expected: FAIL — `ElementResize` does not exist; `resolveSelectionTarget` answers `body`/`null` where `resize` is expected.

- [ ] **Step 5: Add the target to `resolveSelectionTarget.ts`**

Add `| { readonly kind: 'resize'; readonly id: string; readonly handleIndex: number }` to `SelectionTarget` after the `rotation` member. Add after `handleAt`:

```ts
/** A transform box handle of the one selected element (plan editor transform box design, Interaction). */
function resizeAt(input: {
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
	readonly resizeHandles?: { readonly id: string; readonly points: readonly Point[] };
}): SelectionTarget {
	const handles = input.resizeHandles;
	if (!handles || input.selectedIds.length !== 1 || input.selectedIds[0] !== handles.id) return null;
	const handleIndex = handles.points.findIndex(point => distance(point, input.worldPoint) <= input.handleToleranceWorld);
	return handleIndex < 0 ? null : { kind: 'resize', id: handles.id, handleIndex };
}
```

In `resolveSelectionTarget`'s input type add, after `rotationHandle`:

```ts
	/** The selected element's padded transform box handles, world points in handle order. */
	readonly resizeHandles?: { readonly id: string; readonly points: readonly Point[] };
```

and replace `const decoration = input.selectedIds.length > 1 ? badgeAt(input) : handleAt(input);` with

```ts
		const decoration = input.selectedIds.length > 1 ? badgeAt(input) : handleAt(input) ?? resizeAt(input);
```

In the function's docblock, change "a single selection's vertex handle or a multi-selection badge" to "a single selection's vertex handle, then its transform box handle, or a multi-selection badge".

- [ ] **Step 6: Create `src/presentation/editor/elements/ElementResize.ts`**

```ts
import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../handleMetrics';
import { resizeTransformBox, transformHandleWorld, type ResizedGeometry, type TransformBox } from './transformBox';

export interface ElementResizeDeps {
	/** The one selected item's or placement's transform box, or `null` where none is offered. */
	transformBox?: () => TransformBox | null;
	previewResize?: (id: string | null, next?: ResizedGeometry) => void;
	commitResize?: (id: string, next: ResizedGeometry, original: SpatialElement) => void;
}

interface Gesture {
	readonly frame: TransformBox;
	readonly index: number;
	readonly start: Point;
	readonly context: EditorContext;
	dragging: boolean;
}

/**
 * A transform box handle drag (plan editor transform box design, Interaction). A press is not yet a
 * resize; travel past the click epsilon starts it. The handle's unpadded point plus the pointer's travel
 * is snapped, the opposite handle holds still, and past a limit the last valid preview stays up.
 */
export class ElementResize {
	private gesture: Gesture | null = null;
	constructor(private readonly deps: ElementResizeDeps) {}
	get active(): boolean { return this.gesture !== null; }

	start(context: EditorContext, event: EditorPointerEvent, frame: TransformBox, index: number): void {
		if (context.writesBlocked() || event.modifiers.alt || !this.deps.commitResize) return;
		this.gesture = { frame, index, start: event.worldPoint, context, dragging: false };
	}

	/** The geometry at `event`: `null` below the click epsilon or past a limit. Writes the snap guides. */
	private resized(gesture: Gesture, event: EditorPointerEvent): ResizedGeometry | null {
		const { context, frame } = gesture, scale = context.viewport.worldPerScreenPixel();
		if (Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) > CLICK_EPSILON_PX * scale) gesture.dragging = true;
		if (!gesture.dragging) return null;
		const handle = transformHandleWorld(frame, gesture.index);
		const raw = { x: handle.x + event.worldPoint.x - gesture.start.x, y: handle.y + event.worldPoint.y - gesture.start.y };
		const snap = context.snapService.snapPointWithGuides(raw, context.snapCandidates([frame.element.id]), SNAP_TOLERANCE_PX * scale);
		context.renderState.snapGuides = snap.guides;
		return resizeTransformBox(frame, gesture.index, snap.point, event.modifiers.shift);
	}

	move(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture) return;
		if (context.writesBlocked()) { this.cancel(); return; }
		const next = this.resized(gesture, event);
		if (next) this.deps.previewResize?.(gesture.frame.element.id, next);
	}

	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const next = context.writesBlocked() ? null : this.resized(gesture, event);
		context.renderState.snapGuides = [];
		if (!next) { this.cancel(); return; }
		// Left previewing at the drop; the write clears it once read back, as a move's does.
		this.gesture = null;
		this.deps.previewResize?.(gesture.frame.element.id, next);
		this.deps.commitResize?.(gesture.frame.element.id, next, gesture.frame.element);
	}

	cancel(): void {
		if (this.gesture) this.gesture.context.renderState.snapGuides = [];
		this.gesture = null;
		this.deps.previewResize?.(null);
	}
}
```

- [ ] **Step 7: Wire it into `select-tool.ts`**

1. Imports — add:
```ts
import { ElementResize, type ElementResizeDeps } from '../elements/ElementResize';
import { transformHandlePoints } from '../elements/transformBox';
```
2. `export interface SelectToolDeps extends ElementMoveDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {` → `export interface SelectToolDeps extends ElementMoveDeps, ElementResizeDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {`
3. Beside `private readonly elementRotation: ElementRotation;` add `private readonly elementResize: ElementResize;`, and in the constructor body add `this.elementResize = new ElementResize(deps);`.
4. Replace `startDirectGesture` with:
```ts
	private startDirectGesture(context: EditorContext, event: EditorPointerEvent, target: Exclude<SelectionTarget, null>, control: RotationControlGeometry | null | undefined): boolean {
		if (target.kind !== 'rotation' && target.kind !== 'label' && target.kind !== 'resize') return false;
		if (!this.canMutateGeometry()) { selectSpatial(context.selection, target.id, event.modifiers.shift); return true; }
		if (target.kind === 'rotation') this.startRotation(context, event, target.id, control);
		else if (target.kind === 'resize') this.startResize(context, event, target.handleIndex);
		else this.labelMove.start(context, event, target.id);
		return true;
	}
	private startResize(context: EditorContext, event: EditorPointerEvent, index: number): void {
		const frame = this.deps.transformBox?.();
		if (frame) this.elementResize.start(context, event, frame, index);
	}
```
5. `pointerMove`: after `if (this.elementRotation.active) { this.elementRotation.move(context, event); return; }` add `if (this.elementResize.active) { this.elementResize.move(context, event); return; }`
6. `pointerUp`: after `if (this.elementRotation.active && this.context) { this.elementRotation.finish(this.context, event); return; }` add `if (this.elementResize.active && this.context) { this.elementResize.finish(this.context, event); return; }`
7. `cancelGeometryGesture`: add `&& !this.elementResize.active` to the early-return condition (after `!this.elementRotation.active`), and change `this.elementMove.cancel(); this.elementRotation.cancel(); this.labelMove.cancel();` to `this.elementMove.cancel(); this.elementRotation.cancel(); this.elementResize.cancel(); this.labelMove.cancel();`
8. `hasDraft`: add `|| this.elementResize.active` before `|| this.labelMove.active`.
9. `targetAt`: after `const rotation = this.rotationAt(context, event);` add `const frame = this.deps.transformBox?.() ?? null;` and in the `resolveSelectionTarget({ ... })` argument, after `rotationHandle: rotation.decoration,` add:
```ts
			resizeHandles: frame ? { id: frame.element.id, points: transformHandlePoints(frame, context.viewport.worldPerScreenPixel()) } : undefined,
```

- [ ] **Step 8: Types, cursor and registration**

- `render-state.ts`: `hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | null = null;` → `hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | 'resize' | null = null;`
- `cursor.ts`: in the inputs interface, `readonly hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | null;` → `readonly hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | 'resize' | null;`; and in the select arm replace `inputs.hoveredTargetKind === 'handle' || inputs.hoveredTargetKind === 'rotation' || inputs.hoveredTargetKind === 'label'` with `inputs.hoveredTargetKind === 'handle' || inputs.hoveredTargetKind === 'rotation' || inputs.hoveredTargetKind === 'label' || inputs.hoveredTargetKind === 'resize'`.
- `registerEditorTools.ts`: add `import type { ElementResizeDeps } from '../elements/ElementResize';`; `export interface EditorToolDeps extends ElementMoveDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {` → `export interface EditorToolDeps extends ElementMoveDeps, ElementResizeDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {`; in `new SelectTool({ ... })`, after `previewElement: deps.previewElement,` add `transformBox: deps.transformBox, previewResize: deps.previewResize, commitResize: deps.commitResize,`.

- [ ] **Step 9: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/selection tests/presentation/editor/elements tests/presentation/editor/tools tests/presentation/editor/snapping`
Expected: PASS.
Run: `npx eslint src/presentation/editor/selection/resolveSelectionTarget.ts src/presentation/editor/elements/ElementResize.ts src/presentation/editor/tools/select-tool.ts src/presentation/editor/tools/registerEditorTools.ts src/presentation/editor/tools/render-state.ts src/presentation/editor/surface/cursor.ts tests/presentation/editor/selection/resizeTarget.test.ts tests/presentation/editor/elements/elementResize.test.ts tests/presentation/editor/tools/selectToolResize.test.ts`
Expected: no output (`select-tool.ts` measured 341 counted lines before this task, under the 400 cap).

- [ ] **Step 10: Commit**

```bash
git add src/presentation/editor/selection/resolveSelectionTarget.ts src/presentation/editor/elements/ElementResize.ts src/presentation/editor/tools/select-tool.ts src/presentation/editor/tools/registerEditorTools.ts src/presentation/editor/tools/render-state.ts src/presentation/editor/surface/cursor.ts tests/presentation/editor/selection/resizeTarget.test.ts tests/presentation/editor/elements/elementResize.test.ts tests/presentation/editor/tools/selectToolResize.test.ts
git commit -m "feat(editor): resize gesture from transform box handles in the select tool

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The resize write, the box facade and replace

**Files:**
- Modify: `src/presentation/editor/elements/elementActions.ts`
- Modify: `src/presentation/editor/elements/spatialEditing.ts`
- Modify: `src/presentation/editor/elements/assetPlacementTask.ts` (`replace`)
- Create: `tests/helpers/transformBox.ts`
- Test: `tests/presentation/editor/transformBox.e2e.test.ts`

**Interfaces:**
- Consumes: `withPlacementSize` (Task 2); `itemTransformBox`, `assetTransformBox`, `TransformBox`, `ResizedGeometry`, `sizedTransformBox`, `resizeTransformBox` (Task 4); `ElementResizeDeps` (Task 5)
- Produces on `runtime.elementActions`:
  - `transformBox: ComputedRef<TransformBox | null>` — one selected `object` (architecture layer shown) or placeable `asset` (asset layer shown), while `blocked` and `active` are both false
  - `resize(id: string, next: ResizedGeometry, original: SpatialElement): Promise<void>` — stale-refused when kind, points, stair or size differ from `original`
  - `previewResize(id: string | null, next?: ResizedGeometry): void`
- Produces: `tests/helpers/transformBox.ts` exporting `CABINET: NamedSpatialElement` and `selectedItemRig()`

- [ ] **Step 1: Create the shared rig helper `tests/helpers/transformBox.ts`**

```ts
import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import { assetPlacementRig } from './assetPlacement';
import { expectOk } from './domain';
import { settle } from './editor';

export const CABINET: NamedSpatialElement = { id: 'element-cabinet', kind: 'object', name: 'Cabinet', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] };

/** An asset placement rig with one item saved and selected: where a transform box starts. */
export async function selectedItemRig() {
	const rig = await assetPlacementRig(); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, CABINET), rig.runtime.structureTask.ledger)));
	await settle(); rig.selection.select([CABINET.id as never]); await settle();
	return rig;
}
```

- [ ] **Step 2: Write the failing test** — `tests/presentation/editor/transformBox.e2e.test.ts`

```ts
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { CABINET, selectedItemRig } from '../../helpers/transformBox';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { resizeTransformBox, sizedTransformBox } from '../../../src/presentation/editor/elements/transformBox';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import * as notices from '../../../src/presentation/notices/notify';

type Rig = Awaited<ReturnType<typeof assetPlacementRig>>;
const mounted: Rig[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const rig of mounted.splice(0)) rig.unmount(); });
const shown = (rig: Rig, id: string) => rig.project.structure.elements?.find(element => element.id === id);

it('resizes a selected item through its transform box in one undoable write', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'item box');
	await rig.runtime.elementActions.resize(CABINET.id, expectDefined(resizeTransformBox(frame, 4, { x: 2500, y: 1500 }, false), 'resize'), frame.element); await settle();
	expect(shown(rig, CABINET.id)?.points).toEqual([{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }]);
	expect(shown(rig, CABINET.id)).not.toHaveProperty('size');
	await rig.runtime.undo(); await settle(); expect(shown(rig, CABINET.id)?.points).toEqual(CABINET.points);
	await rig.runtime.redo(); await settle(); expect(shown(rig, CABINET.id)?.points[2]).toEqual({ x: 2500, y: 1500 });
});

it('previews the resized geometry and refuses a resize whose element changed since the gesture captured it', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'item box');
	const next = expectDefined(resizeTransformBox(frame, 4, { x: 2500, y: 1500 }, false), 'resize');
	rig.runtime.elementActions.previewResize(CABINET.id, next);
	expect(rig.runtime.elementActions.preview.value?.points).toEqual(next.points);
	rig.runtime.elementActions.previewResize(null);
	expect(rig.runtime.elementActions.preview.value).toBeNull();
	const refusal = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	await rig.runtime.elementActions.resize(CABINET.id, next, { ...frame.element, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] });
	expect(refusal).toHaveBeenCalledOnce();
	expect(shown(rig, CABINET.id)?.points).toEqual(CABINET.points);
});

it('gives one placement its own size at schema 15 and resets it, leaving the asset and another placement alone', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig); rig.changePlan(); await settle();
	const sofa = await rig.saveAsset('Sofa'), first = await rig.place(sofa.id, { x: 1000, y: 1000 }), second = await rig.place(sofa.id, { x: 2500, y: 1000 });
	const library = await rig.stack.assets.getById(sofa.id);
	rig.selection.select([first as never]);
	await settleUntil(() => rig.runtime.elementActions.transformBox.value !== null, 'placement box');
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	expect(rig.runtime.elementActions.transformBox.value).toBeNull();
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'placement box');
	await rig.runtime.elementActions.resize(first, expectDefined(sizedTransformBox(frame, { width: 1600, depth: 900 }), 'sized'), frame.element); await settle();
	expect(shown(rig, first)?.size).toEqual({ width: 1600, depth: 900 });
	expect(shown(rig, second)).not.toHaveProperty('size');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(15);
	expect(await rig.stack.assets.getById(sofa.id)).toEqual(library);
	const refusal = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	// The pre-resize frame no longer matches: same points, different size.
	await rig.runtime.elementActions.resize(first, expectDefined(sizedTransformBox(frame, { width: 1000, depth: 600 }), 'stale'), frame.element);
	expect(refusal).toHaveBeenCalledOnce(); expect(shown(rig, first)?.size).toEqual({ width: 1600, depth: 900 });
	refusal.mockRestore();
	const sized = expectDefined(rig.runtime.elementActions.transformBox.value, 'sized box');
	await rig.runtime.elementActions.resize(first, expectDefined(sizedTransformBox(sized, { width: 800, depth: 600 }), 'reset'), sized.element); await settle();
	expect(shown(rig, first)).not.toHaveProperty('size');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBeLessThan(15);
});

it('offers a box only for one selected item or placeable placement in Plan, with its layer shown', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	const box = () => rig.runtime.elementActions.transformBox.value, workspace = useWorkspaceStore(rig.pinia);
	expect(box()?.element.id).toBe(CABINET.id);
	rig.session.perspective = 'renovate'; await settle(); expect(box()).toBeNull();
	rig.session.perspective = 'plan'; await settle(); expect(box()).not.toBeNull();
	workspace.toggleLayer('architecture'); await settle(); expect(box()).toBeNull();
	workspace.toggleLayer('architecture'); await settle();
	rig.selection.select([CABINET.id, rig.room.id] as never); await settle(); expect(box()).toBeNull();
	rig.selection.select([rig.room.id as never]); await settle(); expect(box()).toBeNull();
	const missing = await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	rig.selection.select([missing as never]); await settle(); expect(box()).toBeNull();
});

it('drops a placement’s own size when it is replaced by another asset', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig); rig.changePlan(); await settle();
	const sofa = await rig.saveAsset('Sofa'), chair = await rig.saveAsset('Chair'), id = await rig.place(sofa.id, { x: 1000, y: 1000 });
	rig.selection.select([id as never]);
	await settleUntil(() => rig.runtime.elementActions.transformBox.value !== null, 'placement box');
	const frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'placement box');
	await rig.runtime.elementActions.resize(id, expectDefined(sizedTransformBox(frame, { width: 1600, depth: 900 }), 'sized'), frame.element); await settle();
	void rig.runtime.elementTask.assets.replace(id, [{ id: chair.id, name: 'Chair' }]); await settle();
	rig.dialogs.resolve({ id: chair.id });
	await settleUntil(() => shown(rig, id)?.assetId === chair.id, 'replaced asset');
	expect(shown(rig, id)).not.toHaveProperty('size');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/transformBox.e2e.test.ts`
Expected: FAIL — `transformBox` / `resize` / `previewResize` are undefined on `elementActions`.

- [ ] **Step 4: Add the facade and the write to `elementActions.ts`**

Imports — add:
```ts
import { withPlacementSize } from '../../../domain/spatial/assetPlacement';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { assetTransformBox, itemTransformBox, type ResizedGeometry, type TransformBox } from './transformBox';
```

After the `const blocked = computed(...)` line add:
```ts
	const shapes = useAssetShapeStore(), workspace = useWorkspaceStore();
	/** The one selected item's or placeable placement's transform box, while a geometry write could start (plan editor transform box design, Interaction). */
	const transformBox = computed<TransformBox | null>(() => {
		const element = selection.selectedIds.length === 1 && !blocked.value && !active.value ? project.structure.elements?.find(item => item.id === String(selection.selectedIds[0])) : undefined;
		if (element?.kind === 'object') return workspace.layerVisibility.architecture ? itemTransformBox(element) : null;
		const shape = element?.kind === 'asset' && element.assetId && workspace.layerVisibility.asset ? shapes.shapeOf(element.assetId) : null;
		return shape && element ? assetTransformBox(element, shape) : null;
	});
```

Replace the whole `async function move(...) { ... }` and `function previewElement(...) { ... }` with:
```ts
	/** The saved element is still the one the gesture captured: kind, points, stair, and a placement's size where the gesture captured it. */
	function unchanged(element: SpatialElement, original: SpatialElement, withSize: boolean): boolean {
		return element.kind === original.kind && JSON.stringify(element.points) === JSON.stringify(original.points) && JSON.stringify(element.stair) === JSON.stringify(original.stair)
			&& (!withSize || JSON.stringify(element.size) === JSON.stringify(original.size));
	}
	async function reshape(id: string, original: SpatialElement, withSize: boolean, change: (element: NamedSpatialElement) => NamedSpatialElement): Promise<void> {
		const epoch = rotationEpoch;
		try {
			await operate(id, async ({ baseline, element }) => {
				if (epoch !== rotationEpoch) return;
				if (!unchanged(element, original, withSize)) { notifyOperationFailure(staleWriteRefusal()); return; }
				if (!context.commands.renovation) return;
				const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, change(element)), runtime.structureTask.ledger));
				if (alive && !result.ok) notifyOperationFailure(result.error);
			});
		} finally {
			// A pointer drop leaves its preview up until here; `operate` refusing before its own `finally` must not strand it.
			if (preview.value?.id === id) preview.value = null;
		}
	}
	/** A body or vertex drag: new points, every other fact — a placement's size included — kept. */
	function move(id: string, points: readonly Point[], original: SpatialElement): Promise<void> {
		return reshape(id, original, false, element => ({ ...element, points }));
	}
	/** A transform box or Inspector resize: new points, and a placement's own size set or removed. */
	function resize(id: string, next: ResizedGeometry, original: SpatialElement): Promise<void> {
		return reshape(id, original, true, element => withPlacementSize({ ...element, points: next.points }, next.size));
	}
	function previewReshape(id: string | null, change?: (element: SpatialElement) => SpatialElement): void {
		const element = project.structure.elements?.find(item => item.id === id), name = project.plan?.spatialElements?.find(item => item.id === id)?.name;
		preview.value = alive && !blocked.value && element && name && change ? { ...change(element), name } : null;
	}
	function previewElement(id: string | null, points?: readonly Point[]): void {
		previewReshape(id, points ? element => ({ ...element, points }) : undefined);
	}
	function previewResize(id: string | null, next?: ResizedGeometry): void {
		previewReshape(id, next ? element => withPlacementSize({ ...element, points: next.points }, next.size) : undefined);
	}
```

Change the return to:
```ts
	return { edit, remove, setLoadBearing, setColor, flip, removeMany: removal.remove, removeManyActive: removal.active, move, resize, active, blocked, preview, previewElement, previewResize, transformBox };
```

- [ ] **Step 5: Bind it in `spatialEditing.ts`**

Add `import type { ElementResizeDeps } from './ElementResize';`. Change the bindings type to `const toolBindings: ElementMoveDeps & ElementResizeDeps & RotationGestureDeps & SelectionInteractions & LabelMoveDeps = {` and after `elementWritesBlocked: ...,` add:
```ts
		transformBox: () => elementActions.transformBox.value,
		previewResize: elementActions.previewResize,
		commitResize: (id, next, original) => { void elementActions.resize(id, next, original); },
```

- [ ] **Step 6: Drop the size on replace in `assetPlacementTask.ts`**

Add `import { withPlacementSize } from '../../../domain/spatial/assetPlacement';` and in `replace` change
`if (!(await write({ ...current, assetId: picked.id, name })) && draft.error) notifyOperationFailure(draft.error);` to
```ts
	// A different asset starts at its own library size (plan editor transform box design, Geometry).
	if (!(await write(withPlacementSize({ ...current, assetId: picked.id, name }, undefined))) && draft.error) notifyOperationFailure(draft.error);
```

- [ ] **Step 7: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/transformBox.e2e.test.ts tests/presentation/editor/itemColors.test.ts tests/presentation/editor/assetPlacementInspector.test.ts tests/presentation/editor/elementMoveAdmission.test.ts tests/presentation/editor/elementRecovery.test.ts tests/presentation/editor/elementInteractionGuards.test.ts tests/presentation/editor/elements.test.ts --testTimeout=20000`
Expected: PASS.
Run: `npx eslint src/presentation/editor/elements/elementActions.ts src/presentation/editor/elements/spatialEditing.ts src/presentation/editor/elements/assetPlacementTask.ts tests/helpers/transformBox.ts tests/presentation/editor/transformBox.e2e.test.ts`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/editor/elements/elementActions.ts src/presentation/editor/elements/spatialEditing.ts src/presentation/editor/elements/assetPlacementTask.ts tests/helpers/transformBox.ts tests/presentation/editor/transformBox.e2e.test.ts
git commit -m "feat(editor): write transform box resizes through the guarded element command

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Draw the transform box

**Files:**
- Create: `src/presentation/editor/elements/TransformBoxHandles.vue`
- Modify: `src/presentation/editor/layers/InteractionLayer.vue`
- Test: `tests/presentation/editor/transformBoxHandles.test.ts`

**Interfaces:**
- Consumes: `runtime.elementActions.transformBox`, `runtime.elementActions.preview` (Task 6); `transformHandlePoints` (Task 4); `TRANSFORM_HANDLE_SIZE_PX` (Task 4)
- Produces: Konva nodes named `transform-box` (group), `transform-box-outline` (one line), `transform-box-handle` (eight rects)

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import Konva from 'konva';
import { CABINET, selectedItemRig } from '../../helpers/transformBox';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { transformHandlePoints } from '../../../src/presentation/editor/elements/transformBox';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldPerScreenPixel, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';

const mounted: Awaited<ReturnType<typeof selectedItemRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const handles = () => expectDefined(Konva.stages.at(-1), 'stage').find('.transform-box-handle');

it('draws eight handles and a padded outline for a selected item, and none for a multi-selection or in Renovate', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	await settleUntil(() => handles().length === 8, 'box handles');
	expect(expectDefined(Konva.stages.at(-1), 'stage').find('.transform-box-outline')).toHaveLength(1);
	rig.selection.select([CABINET.id, rig.room.id] as never); await settle();
	expect(handles()).toHaveLength(0);
	rig.selection.select([CABINET.id as never]); rig.session.perspective = 'renovate'; await settle();
	expect(handles()).toHaveLength(0);
});

it('fills the hovered handle and hides the box while the element previews a move', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	await settleUntil(() => handles().length === 8, 'box handles');
	const editor = useEditorStore(rig.pinia), frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'item box');
	const first = transformHandlePoints(frame, worldPerScreenPixel(editor.viewport, STAGE_PIXELS))[0];
	editor.setPointer(worldToScreen(first, editor.viewport, STAGE_PIXELS));
	rig.runtime.renderState.hoveredTargetKind = 'resize'; await settle();
	const fills = handles().map(node => (node as Konva.Rect).fill());
	expect(fills[0]).not.toBe(fills[1]);
	expect(new Set(fills.slice(1)).size).toBe(1);
	rig.runtime.elementActions.previewElement(CABINET.id, CABINET.points.map(point => ({ x: point.x + 100, y: point.y }))); await settle();
	expect(handles()).toHaveLength(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/transformBoxHandles.test.ts --testTimeout=20000`
Expected: FAIL — the `box handles` wait times out.

- [ ] **Step 3: Create `src/presentation/editor/elements/TransformBoxHandles.vue`**

```vue
<script setup lang="ts">
/**
 * The selected item's or placement's transform box (plan editor transform box design, Interaction): a
 * padded outline and eight handles in STAGE PIXELS, like every other handle on the `InteractionLayer`,
 * and `listening: false` — `SelectTool` hit tests the same `transformHandlePoints`. Hidden while that
 * element's own move or resize preview is up and while anything rotates; mounted before the rotation
 * arrow, which paints above it and is hit tested before it.
 */
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import type { ThemeTokens } from '../theme/themeTokens';
import { STAGE_PIXELS, worldPerScreenPixel, worldToScreen } from '../viewport/Viewport';
import { TRANSFORM_HANDLE_SIZE_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';
import { transformHandlePoints } from './transformBox';

const props = defineProps<{ tokens: ThemeTokens }>();
const runtime = useEditorRuntime(), editor = useEditorStore();
const drawn = computed(() => {
	const frame = runtime.elementActions.transformBox.value;
	if (!frame || runtime.elementActions.preview.value?.id === frame.element.id || runtime.renderState.rotationInteraction !== null) return null;
	const worldPerPixel = worldPerScreenPixel(editor.viewport, STAGE_PIXELS), world = transformHandlePoints(frame, worldPerPixel), pointer = editor.pointerWorld;
	const hovered = runtime.renderState.hoveredTargetKind === 'resize' && pointer !== null
		? world.findIndex(point => Math.hypot(point.x - pointer.x, point.y - pointer.y) <= VERTEX_GRAB_RADIUS_PX * worldPerPixel) : -1;
	const screen = world.map(point => worldToScreen(point, editor.viewport, STAGE_PIXELS));
	return {
		outline: [0, 2, 4, 6].flatMap(index => [screen[index].x, screen[index].y]),
		squares: screen.map((at, index) => ({ x: at.x - TRANSFORM_HANDLE_SIZE_PX / 2, y: at.y - TRANSFORM_HANDLE_SIZE_PX / 2, hovered: index === hovered })),
	};
});
</script>

<template>
	<VGroup
		v-if="drawn"
		:config="{ name: 'transform-box', listening: false }"
	>
		<VLine
			:config="{
				name: 'transform-box-outline',
				points: drawn.outline,
				closed: true,
				stroke: props.tokens.accent,
				strokeWidth: 1,
				dash: [4, 3],
				listening: false,
			}"
		/>
		<VRect
			v-for="(square, index) in drawn.squares"
			:key="index"
			:config="{
				name: 'transform-box-handle',
				x: square.x,
				y: square.y,
				width: TRANSFORM_HANDLE_SIZE_PX,
				height: TRANSFORM_HANDLE_SIZE_PX,
				fill: square.hovered ? props.tokens.accent : props.tokens.canvasBackground,
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				listening: false,
			}"
		/>
	</VGroup>
</template>
```

- [ ] **Step 4: Mount it in `InteractionLayer.vue`**

Add `import TransformBoxHandles from '../elements/TransformBoxHandles.vue';` beside the `ObjectRotationHandle` import. Immediately before `<VGroup :config="{ name: 'rotation-handle-viewport', ...viewportTransform(editorStore.viewport) }">` insert:

```vue
		<TransformBoxHandles :tokens="props.tokens" />
```

- [ ] **Step 5: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/transformBoxHandles.test.ts tests/presentation/editor/transformBox.e2e.test.ts tests/harness/accessibility.test.ts --testTimeout=20000`
Expected: PASS.
Run: `npx eslint src/presentation/editor/elements/TransformBoxHandles.vue src/presentation/editor/layers/InteractionLayer.vue tests/presentation/editor/transformBoxHandles.test.ts`
Expected: no output (fix any `vue/*` formatting it reports exactly as reported).

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/elements/TransformBoxHandles.vue src/presentation/editor/layers/InteractionLayer.vue tests/presentation/editor/transformBoxHandles.test.ts
git commit -m "feat(editor): draw the transform box and its handles on the interaction layer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Width and depth in the asset Inspector

**Files:**
- Create: `src/presentation/editor/elements/AssetSizeFields.vue`
- Modify: `src/presentation/editor/elements/AssetPlacementDetails.vue`
- Modify: `src/presentation/i18n/locales/en/assetPlacement.ts`, `src/presentation/i18n/locales/de/assetPlacement.ts`
- Test: `tests/presentation/editor/assetPlacementInspector.test.ts` (append)

**Interfaces:**
- Consumes: `assetTransformBox`, `sizedTransformBox`, `transformBoxSize` (Task 4); `runtime.elementActions.resize`, `.blocked`, `.active` (Task 6)
- Produces: inputs `input[name="asset-width"]`, `input[name="asset-depth"]`; button `[data-rp-action="reset-asset-size"]`; keys `editor.asset.width`, `editor.asset.depth`, `editor.asset.reset-size`

- [ ] **Step 1: Append the failing tests to `tests/presentation/editor/assetPlacementInspector.test.ts`**

Add `import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';` to the imports, then append:

```ts
it('sizes a placement from the Inspector about its centre and resets it to the library size', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const inspector = await selectPlaced(rig, id, 1);
	expect(inspector.find('[data-rp-action="reset-asset-size"]').exists()).toBe(false);
	expect(inspector.get<HTMLInputElement>('input[name="asset-width"]').element.value).toBe(formatMetres(800));
	await inspector.get('input[name="asset-width"]').setValue(formatMetres(1200));
	await inspector.get('input[name="asset-width"]').trigger('change');
	await settleUntil(() => rig.project.structure.elements?.[0]?.size !== undefined, 'sized placement');
	expect(rig.project.structure.elements?.[0]?.size).toEqual({ width: 1200, depth: 600 });
	expect(rig.project.structure.elements?.[0]?.points[0]).toEqual({ x: 1000, y: 1000 });
	const sized = rig.wrapper.get('.rp-element-inspector');
	expect(sized.text()).toContain(tr('editor.asset.dimensions', { width: formatMetres(1200), depth: formatMetres(600) }));
	for (const [field, text] of [['asset-depth', 'not a length'], ['asset-width', 'not a length'], ['asset-depth', '0.0004']] as const) {
		await sized.get(`input[name="${field}"]`).setValue(text); await sized.get(`input[name="${field}"]`).trigger('change'); await settle();
		expect(rig.project.structure.elements?.[0]?.size).toEqual({ width: 1200, depth: 600 });
	}
	expect(sized.get<HTMLInputElement>('input[name="asset-depth"]').element.value).toBe(formatMetres(600));
	await sized.get('[data-rp-action="reset-asset-size"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0]?.size === undefined, 'reset placement');
	expect(rig.wrapper.get('.rp-element-inspector').find('[data-rp-action="reset-asset-size"]').exists()).toBe(false);
});

it('holds the size fields read-only while a save is in flight, and offers none outside Plan or for a missing asset', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await selectPlaced(rig, id, 1);
	const save = useSaveStateStore(rig.pinia);
	save.beginSaving(); await settle();
	const width = rig.wrapper.get('.rp-element-inspector input[name="asset-width"]');
	expect(width.attributes('readonly')).toBeDefined(); expect(width.attributes('aria-disabled')).toBe('true');
	const command = vi.spyOn(rig.renovation, 'command');
	await width.setValue(formatMetres(1500)); await width.trigger('change'); await settle();
	expect(command).not.toHaveBeenCalled();
	save.resolveNeutral();
	rig.session.perspective = 'renovate'; await settle();
	expect(rig.wrapper.find('.rp-element-inspector input[name="asset-width"]').exists()).toBe(false);
	rig.session.perspective = 'plan';
	const gone = await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	rig.selection.select([gone as never]); await settle();
	expect(rig.wrapper.find('.rp-element-inspector input[name="asset-width"]').exists()).toBe(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run check:fast -- tests/presentation/editor/assetPlacementInspector.test.ts --testTimeout=20000`
Expected: FAIL — no `input[name="asset-width"]`.

- [ ] **Step 3: Add the strings**

In `en/assetPlacement.ts`, after `'editor.asset.add-material': 'Add as material',` add:
```ts
	'editor.asset.width': 'Width (m)',
	'editor.asset.depth': 'Depth (m)',
	'editor.asset.reset-size': 'Reset to library size',
```
In `de/assetPlacement.ts`, after `'editor.asset.add-material': 'Als Baustoff hinzufügen',` add:
```ts
	'editor.asset.width': 'Breite (m)',
	'editor.asset.depth': 'Tiefe (m)',
	'editor.asset.reset-size': 'Auf Bibliotheksgröße zurücksetzen',
```

- [ ] **Step 4: Create `src/presentation/editor/elements/AssetSizeFields.vue`**

```vue
<script setup lang="ts">
/**
 * A placement's own width and depth (plan editor transform box design, Inspector): typed in metres and
 * applied about the placement's centre through the same resize write a handle drag takes, or reset to the
 * library's size. Its own component so every prop is non-null: the parent mounts it only for a placeable
 * shape in Plan.
 */
import { computed, ref, watch } from 'vue';
import type { AssetShape, Dimensions } from '../../../domain/asset/AssetShape';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { formatMetres, parseMetres } from '../shell/formatLength';
import { assetTransformBox, sizedTransformBox, transformBoxSize } from './transformBox';

const props = defineProps<{ element: SpatialElement; shape: AssetShape; library: Dimensions }>();
const runtime = useEditorRuntime();
const frame = computed(() => assetTransformBox(props.element, props.shape));
const text = ref({ width: '', depth: '' });
function showSize(): void {
	const size = transformBoxSize(frame.value);
	text.value = { width: formatMetres(size.width), depth: formatMetres(size.depth) };
}
watch(frame, showSize, { immediate: true });
const busy = computed(() => runtime.elementActions.blocked.value || runtime.elementActions.active.value);
function applySize(size: Dimensions): void {
	const resized = sizedTransformBox(frame.value, size);
	if (resized && !busy.value) void runtime.elementActions.resize(props.element.id, resized, props.element);
}
function commitSize(): void {
	const width = parseMetres(text.value.width), depth = parseMetres(text.value.depth);
	if (width.ok && depth.ok) applySize({ width: width.mm, depth: depth.mm });
	showSize();
}
</script>

<template>
	<div class="rp-dialog-actions">
		<label class="rp-dialog-field">{{ tr('editor.asset.width') }}<input
			v-model="text.width"
			name="asset-width"
			type="text"
			inputmode="decimal"
			:readonly="busy"
			:aria-disabled="busy"
			@change="commitSize"
		></label>
		<label class="rp-dialog-field">{{ tr('editor.asset.depth') }}<input
			v-model="text.depth"
			name="asset-depth"
			type="text"
			inputmode="decimal"
			:readonly="busy"
			:aria-disabled="busy"
			@change="commitSize"
		></label>
		<button
			v-if="element.size"
			type="button"
			data-rp-action="reset-asset-size"
			:aria-disabled="busy"
			@click="applySize(library)"
		>
			{{ tr('editor.asset.reset-size') }}
		</button>
	</div>
</template>
```

- [ ] **Step 5: Mount it and report the drawn size in `AssetPlacementDetails.vue`**

Add imports:
```ts
import { assetTransformBox, transformBoxSize } from './transformBox';
import AssetSizeFields from './AssetSizeFields.vue';
```
Replace the `summary` computed with:
```ts
const summary = computed(() => {
	const value = answer.value;
	if (value === null) return '';
	if (value.kind !== 'placeable') return tr(REASONS[value.kind]);
	// The placement's size as drawn: its own, or the library's.
	const size = transformBoxSize(assetTransformBox(props.element, value.shape));
	return tr('editor.asset.dimensions', { width: formatMetres(size.width), depth: formatMetres(size.depth) });
});
```
In the template, directly after `<p>{{ summary }}</p>` insert:
```vue
	<AssetSizeFields
		v-if="answer?.kind === 'placeable' && session.perspective === 'plan'"
		:element="element"
		:shape="answer.shape"
		:library="answer.dimensions"
	/>
```

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/assetPlacementInspector.test.ts tests/presentation/i18n tests/build/localeModuleSentenceCase.test.ts --testTimeout=20000`
Expected: PASS. If the `'0.0004'` row writes a size, `parseMetres` accepted a sub-millimetre depth and `sizedTransformBox` must refuse it — check which gate answered and keep the assertion.
Run: `npx eslint src/presentation/editor/elements/AssetSizeFields.vue src/presentation/editor/elements/AssetPlacementDetails.vue src/presentation/i18n/locales/en/assetPlacement.ts src/presentation/i18n/locales/de/assetPlacement.ts tests/presentation/editor/assetPlacementInspector.test.ts`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/elements/AssetSizeFields.vue src/presentation/editor/elements/AssetPlacementDetails.vue src/presentation/i18n/locales/en/assetPlacement.ts src/presentation/i18n/locales/de/assetPlacement.ts tests/presentation/editor/assetPlacementInspector.test.ts
git commit -m "feat(editor): type or reset a placement's width and depth in the Inspector

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Manual case and branch verification

**Files:**
- Create: `docs/tests/cases/Resize an item or asset on the plan.md`

- [ ] **Step 1: Write the manual case**

```markdown
---
type: Test case
sources:
  - 2026-09-15-plan-editor-transform-box-design
status: Ready
---

# Resize an item or asset on the plan

Covers the transform box on one selected Item (`object`) and one placed library asset, in Plan.
Browser automation and the jsdom suite are supplemental; this case has not been run in a vault.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + obsidian | Draw a rectangle Item and select it | A dashed box stands just outside the outline with eight square handles; the corner dots stay grabbable; the rotation arrow still shows |
| suite + obsidian | Drag the far corner handle outward, release | The Item grows about the opposite corner; one history entry; Undo restores the exact points |
| suite + obsidian | Drag a side handle; then a corner with Shift held | A side handle changes one dimension only; Shift keeps the proportions |
| suite + obsidian | Rotate the Item 30°, then drag a corner handle | The box follows the Item's own edge; the Item stays rectangular |
| suite + obsidian | Drag a handle past the opposite side and release | The last valid preview shows while dragging; release writes nothing |
| suite + obsidian | Place a library asset, select it, drag a corner handle | The placement grows, the opposite corner stays put; the Inspector shows the new width × depth and Reset to library size |
| suite + obsidian | Open the same asset in a second place on the plan | The second placement keeps the library size; the asset in the library is unchanged |
| suite + obsidian | Type a width in the Inspector; then press Reset to library size | The placement resizes about its centre; reset removes its own size |
| suite + obsidian | Replace the resized asset with another | The new asset draws at its own library size |
| suite | Switch to Renovate or Review; select two items | No box and no size fields |
| obsidian | Save, reopen the vault, reopen the plan | Resized Item points and the placement's own size survive; the sidecar reads schema 15 |
| obsidian | Open the plan with a build from before this change | The plan is refused as newer than the build supports, never silently shrunk |

## Runs

Not yet run in a vault.
```

- [ ] **Step 2: Run the branch's inner gates**

Run: `npm run check:fast -- tests/core tests/domain tests/infrastructure tests/application tests/presentation/editor tests/presentation/designer tests/presentation/i18n tests/harness --testTimeout=20000`
Expected: PASS.
Run: `npx eslint $(git diff --name-only origin/main...HEAD -- src tests | tr '\n' ' ')`
Expected: no output.
Run: `npx fallow dead-code` and `npx fallow dupes`
Expected: no finding in a file this branch touched. An `unused-exports` finding on a new export means the export is test-only — make it module-private and test through the exported function that uses it.

- [ ] **Step 3: Look at it**

Start the harness preview (`.claude/launch.json`, or `npm run harness` through the Browser pane's `preview_start`), open the Plan Editor view with an item selected — `tests/harness/page.ts` lists the knobs; the `item` knob's `saved` state selects a placed asset — and take a screenshot of the selected box in the light and dark schemes and at a 460 px width. Confirm the handles sit outside the outline and do not cover the rotation arrow's glyph. Record what the screenshot showed in the PR description.

- [ ] **Step 4: Commit**

```bash
git add "docs/tests/cases/Resize an item or asset on the plan.md"
git commit -m "docs(tests): manual case for resizing items and assets on the plan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
