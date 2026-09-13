# Smart Alignment Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a zone, a zone vertex, an element or a drawing cursor is dragged in the Plan Editor, snap it to existing geometry (vertex, then edge, then x/y axis alignment) and draw a dashed guide saying why, with preview and commit going through one call.

**Architecture:** `SnapService` grows two methods that return the snapped answer AND its guide segments; `EditorContext` grows one `snapCandidates(exclude)` supply built from the project store; every positional gesture switches from `snapPoint(x, {})` to those two methods and writes the guides into the existing `renderState.snapGuides`, which the existing `SnapGuides.vue` already draws. No new component, no new preference.

**Tech Stack:** TypeScript, Vue 3 SFCs (touched only in one `computed`), Konva via vue-konva (untouched), vitest with the `tests/helpers/tool-context.ts` harness.

**Spec:** `docs/superpowers/specs/2026-09-13-smart-alignment-guides-design.md`

## Global Constraints

- Layering (CLAUDE.md, SDD §8): `presentation → application → domain → core`. `snap-service.ts` imports only from `core/`. Nothing here names `obsidian`, `konva` or a store below `presentation/`.
- No `.ts` suffix on `src/` imports (a lint ban on this branch's `main`).
- `max-lines` 400 (blank lines and comments skipped) per `src/` file; `select-tool.ts` is at 467 raw lines and close to that budget, so its edits go through two small private helpers rather than inline blocks. `tests/**` files have a 450 cap; `selectTool.test.ts` is at its budget, so new select-tool cases go in a NEW file.
- No user-visible literal strings: the banner hint reuses the existing `editor.room.snapped` key. No new locale keys are needed.
- `npm run check:fast -- <paths>` between edits; `npm run check` runs in CI on the PR. Never run two gates at once.
- Commit after each task. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Every new test is watched RED before the code that makes it green.

## Deviations from the spec, decided while planning (all smaller than the spec)

1. **No per-entity memo (spec §4.2).** `snapCandidates(exclude)` recomputes `roomSnapCandidates` on every call. A pointer move runs it once over every zone and element on the plan, which is a linear pass over a few hundred points. The two existing `computed` memos (draw-room's in `registerEditorTools.ts`, the element task's in `elementTask.ts`) are removed rather than generalised. Marked with a `ponytail:` comment naming the upgrade path.
2. **Exclusion ids are `string`, not `EntityId`.** `ZoneDto.id` and `SpatialElement.id` are both plain strings at the call sites; a brand would cost a cast at every one of them.
3. **The moving features of a body move are its vertices plus the box centre (spec §3.3 named six box features).** A box's min and max on an axis ARE some vertex's coordinate, so as alignment candidates they add nothing; the centre is the one feature no vertex carries. A guide therefore starts at the matched vertex or at the centre, never at a box edge's midpoint.
4. **The banner hint stays inside the creation-task banner.** `TemporaryToolBanner.vue` draws only while a creation task is active (`v-if="task !== null"`), so widening `showSnapHint` covers the polygon, area and element tools, and Select gets guides on the canvas with no text hint. That is what the spec's §5 sentence amounts to once the banner's own gate is read.

## File map

| File | Responsibility in this increment |
| --- | --- |
| `src/presentation/editor/snapping/snap-service.ts` | `alignments` on `SnapCandidates`; `snapPointWithGuides`, `snapTranslation`; `snapPoint` becomes a wrapper |
| `src/presentation/editor/snapping/roomSnapCandidates.ts` | `alignments` in the answer; `exclude` parameter; zone type requires `id` |
| `src/presentation/editor/handleMetrics.ts` | `SNAP_TOLERANCE_PX = 8`, the one number every Plan Editor snap call scales by the camera |
| `src/presentation/editor/tools/editor-context.ts` | `snapCandidates` member and dep |
| `src/presentation/editor/runtime.ts` | builds `snapCandidates` from the project store |
| `src/presentation/designer/runtime.ts` | supplies `() => ({})` |
| `src/presentation/editor/tools/select-tool.ts` | body move and vertex drag through the service, preview = commit, guides cleared |
| `src/presentation/editor/elements/ElementMove.ts` | same for element body and vertex |
| `src/presentation/editor/tools/draw-room-tool.ts` | `snapPointWithGuides`; own `snapCandidates` dep removed |
| `src/presentation/editor/tools/registerEditorTools.ts` | `roomCandidates` computed removed |
| `src/presentation/editor/elements/ElementTool.ts`, `elementTask.ts` | `candidates` dep removed, `context.snapCandidates()` used |
| `src/presentation/editor/tools/draw-polygon-tool.ts` | `landingPoint` through `snapPointWithGuides`; docblock rewritten |
| `src/presentation/editor/shell/TemporaryToolBanner.vue` | `showSnapHint` no longer keyed on `draw-room` |
| `tests/helpers/tool-context.ts` | `snapCandidates` option; override moves to `snapPointWithGuides` |
| `tests/presentation/editor/snapping/snapServiceGuides.test.ts` | NEW: both new methods |
| `tests/presentation/editor/tools/selectToolAlignmentGuides.test.ts` | NEW: preview = commit, guides, exclusion |
| `docs/tests/cases/Alignment guides while dragging.md` | NEW manual case, unrun |
| `docs/development/agent-guide-increment-history.md` | entry for this increment |

---

### Task 1: `SnapService.snapPointWithGuides` and the `alignments` candidate field

**Files:**
- Modify: `src/presentation/editor/snapping/snap-service.ts`
- Create: `tests/presentation/editor/snapping/snapServiceGuides.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SnapCandidates { vertices?; edges?; readonly alignments?: readonly Point[] }
  export interface SnapResult { readonly point: Point; readonly guides: LineSegment[] }
  snapPointWithGuides(point: Point, candidates: SnapCandidates, toleranceMm?: number): SnapResult
  ```
  `snapPoint(point, candidates, tol)` is unchanged in signature and now equals `snapPointWithGuides(...).point`.

- [ ] **Step 1: Write the failing tests**

Create `tests/presentation/editor/snapping/snapServiceGuides.test.ts`:

```ts
/**
 * The two `SnapService` entries that answer WITH their guides (smart alignment guides
 * increment, spec §3): `snapPointWithGuides` for one dragged point and `snapTranslation` for a
 * body move. Precedence is vertex, then edge, then x/y axis alignment decided independently —
 * pinned here with the case where the later stage is strictly nearer and still loses.
 */
import { describe, expect, it } from 'vitest';
import { SnapService } from '../../../../src/presentation/editor/snapping/snap-service';

const TOLERANCE = 10;
const service = () => new SnapService({ gridSpacingMm: 100, toleranceMm: TOLERANCE, angleStepRadians: Math.PI / 2 });
const disabled = () => new SnapService({ gridSpacingMm: 100, toleranceMm: TOLERANCE, angleStepRadians: Math.PI / 2 }, () => false);

describe('SnapService.snapPointWithGuides', () => {
	it('answers the input with no guides when nothing is within tolerance', () => {
		expect(service().snapPointWithGuides({ x: 0, y: 0 }, { vertices: [{ x: 50, y: 50 }], alignments: [{ x: 50, y: 50 }] }))
			.toEqual({ point: { x: 0, y: 0 }, guides: [] });
	});

	it('a vertex within tolerance wins over a strictly nearer alignment, with one guide pointer → vertex', () => {
		const result = service().snapPointWithGuides({ x: 0, y: 0 }, { vertices: [{ x: 8, y: 0 }], alignments: [{ x: 1, y: 40 }] });
		expect(result.point).toEqual({ x: 8, y: 0 });
		expect(result.guides).toEqual([{ start: { x: 0, y: 0 }, end: { x: 8, y: 0 } }]);
	});

	it('an edge within tolerance wins over an alignment, with one guide pointer → projection', () => {
		const result = service().snapPointWithGuides({ x: 50, y: 6 }, { edges: [{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }], alignments: [{ x: 49, y: 40 }] });
		expect(result.point).toEqual({ x: 50, y: 0 });
		expect(result.guides).toEqual([{ start: { x: 50, y: 6 }, end: { x: 50, y: 0 } }]);
	});

	it('aligns x and y independently and both may fire, one guide per axis from the landed point', () => {
		const result = service().snapPointWithGuides({ x: 103, y: 204 }, { alignments: [{ x: 100, y: 500 }, { x: 900, y: 200 }] });
		expect(result.point).toEqual({ x: 100, y: 200 });
		expect(result.guides).toEqual([
			{ start: { x: 100, y: 200 }, end: { x: 100, y: 500 } },
			{ start: { x: 100, y: 200 }, end: { x: 900, y: 200 } },
		]);
	});

	it('aligns one axis and leaves the other where the pointer is', () => {
		const result = service().snapPointWithGuides({ x: 103, y: 700 }, { alignments: [{ x: 100, y: 500 }] });
		expect(result.point).toEqual({ x: 100, y: 700 });
		expect(result.guides).toEqual([{ start: { x: 100, y: 700 }, end: { x: 100, y: 500 } }]);
	});

	it('takes the NEAREST alignment on an axis, not the first', () => {
		const result = service().snapPointWithGuides({ x: 103, y: 0 }, { alignments: [{ x: 110, y: 1 }, { x: 100, y: 2 }] });
		expect(result.point.x).toBe(100);
		expect(result.guides[0]?.end).toEqual({ x: 100, y: 2 });
	});

	it('a disabled service answers the input with no guides even with a vertex under the pointer', () => {
		expect(disabled().snapPointWithGuides({ x: 0, y: 0 }, { vertices: [{ x: 0, y: 0 }], alignments: [{ x: 0, y: 0 }] }))
			.toEqual({ point: { x: 0, y: 0 }, guides: [] });
	});

	it('snapPoint is the point half of the same answer', () => {
		const candidates = { alignments: [{ x: 100, y: 500 }] };
		const s = service();
		expect(s.snapPoint({ x: 103, y: 0 }, candidates)).toEqual(s.snapPointWithGuides({ x: 103, y: 0 }, candidates).point);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/snapping/snapServiceGuides.test.ts`
Expected: type errors on `alignments` and `snapPointWithGuides` (vue-tsc), and the vitest run failing with `snapPointWithGuides is not a function`.

- [ ] **Step 3: Implement**

In `src/presentation/editor/snapping/snap-service.ts`:

Add to the imports:

```ts
import type { Vector } from '../../../core/geometry/Vector';
import { extentOf } from '../../../core/geometry/operations';
```
(`distance` and `project` are already imported from `operations`; merge into one import line.)

Extend `SnapCandidates`:

```ts
export interface SnapCandidates {
	readonly vertices?: readonly Point[];
	readonly edges?: readonly (LineSegment & { readonly bulge?: number })[];
	/**
	 * Every point whose x or y is worth lining up with — a neighbour's vertices and box
	 * centres. Read by the axis-alignment stage only, after vertex and edge have declined.
	 */
	readonly alignments?: readonly Point[];
}

/** A snapped point and the guide segments that say why it landed there. */
export interface SnapResult {
	readonly point: Point;
	readonly guides: LineSegment[];
}
```

Add a module-level helper beside `nearestWithinTolerance`:

```ts
/**
 * The alignment whose `axis` coordinate is nearest `value` within `tolerance`, else `null`.
 * Strictly-closer wins, so a tie keeps the first in iteration order — the same rule
 * `nearestWithinTolerance` pins for points.
 */
function nearestAlignment(value: number, alignments: readonly Point[], axis: 'x' | 'y', tolerance: number): Point | null {
	let best: Point | null = null;
	let bestDistance = Infinity;
	for (const candidate of alignments) {
		const d = Math.abs(candidate[axis] - value);
		if (d <= tolerance && d < bestDistance) {
			bestDistance = d;
			best = candidate;
		}
	}
	return best;
}
```

Replace the `snapPoint` method body and add `snapPointWithGuides` above it:

```ts
	/**
	 * `snapPoint` with the reason attached. Precedence is vertex > edge > axis alignment > the
	 * original point (spec §3.2). The first two answer one guide from the pointer to where it
	 * landed; the axis stage decides x and y independently and answers one guide PER AXIS that
	 * fired, from the landed point to the alignment it matched — which is axis-aligned by
	 * construction, and is what the canvas draws as the dashed "lined up with" line.
	 */
	snapPointWithGuides(point: Point, candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): SnapResult {
		if (!this.enabled) return { point, guides: [] };
		const vertex = this.snapToVertex(point, candidates.vertices ?? [], toleranceMm);
		if (vertex !== null) return { point: vertex, guides: [{ start: point, end: vertex }] };
		const edge = this.snapToEdge(point, candidates.edges ?? [], toleranceMm);
		if (edge !== null) return { point: edge, guides: [{ start: point, end: edge }] };
		const alignments = candidates.alignments ?? [];
		const alongX = nearestAlignment(point.x, alignments, 'x', toleranceMm);
		const alongY = nearestAlignment(point.y, alignments, 'y', toleranceMm);
		const landed = { x: alongX?.x ?? point.x, y: alongY?.y ?? point.y };
		const guides: LineSegment[] = [];
		if (alongX !== null) guides.push({ start: landed, end: alongX });
		if (alongY !== null) guides.push({ start: landed, end: alongY });
		return { point: landed, guides };
	}

	snapPoint(point: Point, candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): Point {
		return this.snapPointWithGuides(point, candidates, toleranceMm).point;
	}
```

Keep the existing `snapPoint` docblock about precedence, moved onto `snapPointWithGuides`.

- [ ] **Step 4: Run to verify it passes, and that the old suite still does**

Run: `npm run check:fast -- tests/presentation/editor/snapping`
Expected: all green, including `snapService.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/snapping/snap-service.ts tests/presentation/editor/snapping/snapServiceGuides.test.ts
git commit -m "Add snapPointWithGuides and the alignments candidate stage to SnapService

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `SnapService.snapTranslation`

**Files:**
- Modify: `src/presentation/editor/snapping/snap-service.ts`
- Modify: `tests/presentation/editor/snapping/snapServiceGuides.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TranslationSnap { readonly correction: Vector; readonly guides: LineSegment[] }
  snapTranslation(moving: readonly Point[], candidates: SnapCandidates, toleranceMm?: number): TranslationSnap
  ```
  The caller has ALREADY translated `moving` by the raw pointer delta; `correction` is the extra vector to add to every point.

- [ ] **Step 1: Write the failing tests**

Append to `snapServiceGuides.test.ts`:

```ts
describe('SnapService.snapTranslation', () => {
	const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
	const NONE = { correction: { dx: 0, dy: 0 }, guides: [] };

	it('answers zero with no guides when nothing is within tolerance, and for an empty moving set', () => {
		expect(service().snapTranslation(square, { vertices: [{ x: 500, y: 500 }], alignments: [{ x: 500, y: 500 }] })).toEqual(NONE);
		expect(service().snapTranslation([], { vertices: [{ x: 0, y: 0 }] })).toEqual(NONE);
	});

	it('a vertex pair within tolerance wins over a nearer axis alignment; correction is ONE vector', () => {
		// The square's (100, 100) corner is 8 from the candidate vertex (108, 100); an alignment at x=101 is nearer.
		const result = service().snapTranslation(square, { vertices: [{ x: 108, y: 100 }], alignments: [{ x: 101, y: 900 }] });
		expect(result.correction).toEqual({ dx: 8, dy: 0 });
		expect(result.guides).toEqual([{ start: { x: 100, y: 100 }, end: { x: 108, y: 100 } }]);
	});

	it('the NEAREST vertex pair decides when several are within tolerance', () => {
		const result = service().snapTranslation(square, { vertices: [{ x: 109, y: 0 }, { x: 0, y: 103 }] });
		expect(result.correction).toEqual({ dx: 0, dy: 3 });
	});

	it('an edge projection within tolerance wins over an axis alignment', () => {
		// The corner (100, 0) projects onto the edge y=-6 at (100, -6); an alignment at y=-1 is nearer.
		const result = service().snapTranslation(square, { edges: [{ start: { x: 0, y: -6 }, end: { x: 200, y: -6 } }], alignments: [{ x: 900, y: -1 }] });
		// Both (0, 0) and (100, 0) project at distance 6; the first in iteration order keeps the tie.
		expect(result.correction).toEqual({ dx: 0, dy: -6 });
		expect(result.guides).toEqual([{ start: { x: 0, y: 0 }, end: { x: 0, y: -6 } }]);
	});

	it('aligns the box centre on x and a vertex on y, independently, each guide from the corrected feature', () => {
		// centre (50, 50): alignment x=53 pulls it right by 3 (every vertex is 47+ away). y=104 is 4 from
		// the y=100 vertices; (100, 100) is the first of them in iteration order, so it is the feature.
		const result = service().snapTranslation(square, { alignments: [{ x: 53, y: 900 }, { x: 900, y: 104 }] });
		expect(result.correction).toEqual({ dx: 3, dy: 4 });
		expect(result.guides).toEqual([
			{ start: { x: 53, y: 54 }, end: { x: 53, y: 900 } },
			{ start: { x: 103, y: 104 }, end: { x: 900, y: 104 } },
		]);
	});

	it('an inner vertex is an x feature, so an L-shape aligns on its notch', () => {
		const lShape = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 100 }, { x: 0, y: 100 }];
		// The notch at x=60 is 2 from the alignment at 62; the centre (50) is 12 away, outside tolerance.
		const result = service().snapTranslation(lShape, { alignments: [{ x: 62, y: 900 }] });
		expect(result.correction).toEqual({ dx: 2, dy: 0 });
		expect(result.guides).toEqual([{ start: { x: 62, y: 40 }, end: { x: 62, y: 900 } }]);
	});

	it('a disabled service answers zero with no guides', () => {
		expect(disabled().snapTranslation(square, { vertices: [{ x: 0, y: 0 }] })).toEqual(NONE);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/snapping/snapServiceGuides.test.ts`
Expected: `snapTranslation is not a function`.

- [ ] **Step 3: Implement**

Add to `snap-service.ts`, after `SnapResult`:

```ts
/** The extra vector a body move applies to EVERY point, and the guides that say why. */
export interface TranslationSnap {
	readonly correction: Vector;
	readonly guides: LineSegment[];
}

const NO_TRANSLATION: TranslationSnap = { correction: { dx: 0, dy: 0 }, guides: [] };

/** The nearest (moving point, landing) pair `land` answers within tolerance, else `null`. */
function nearestPair(moving: readonly Point[], land: (from: Point) => Point | null): { from: Point; to: Point } | null {
	let best: { from: Point; to: Point } | null = null;
	let bestDistance = Infinity;
	for (const from of moving) {
		const to = land(from);
		if (to === null) continue;
		const d = distance(from, to);
		if (d < bestDistance) {
			bestDistance = d;
			best = { from, to };
		}
	}
	return best;
}

/** The moving feature and alignment with the smallest |delta| on `axis` within tolerance. */
function nearestAxisMatch(features: readonly Point[], alignments: readonly Point[], axis: 'x' | 'y', tolerance: number): { feature: Point; to: Point; delta: number } | null {
	let best: { feature: Point; to: Point; delta: number } | null = null;
	for (const feature of features) {
		const to = nearestAlignment(feature[axis], alignments, axis, tolerance);
		if (to === null) continue;
		const delta = to[axis] - feature[axis];
		if (best === null || Math.abs(delta) < Math.abs(best.delta)) best = { feature, to, delta };
	}
	return best;
}
```

Add the method to the class, after `snapPoint`:

```ts
	/**
	 * A body move's snap (spec §3.3). `moving` is the shape ALREADY translated by the raw
	 * pointer delta; the answer is one more vector to add to every point, so a move stays a
	 * translation and can never deform the shape. Stages, in precedence: the nearest moving
	 * vertex to a candidate vertex; the nearest moving vertex to an edge; then per axis, the
	 * smallest delta between any moving FEATURE (its vertices plus the box centre — a box's
	 * min and max on an axis are already some vertex's coordinate) and any alignment
	 * coordinate. Guides: the point stages draw pre-correction vertex → landing; the axis
	 * stage draws the corrected feature → alignment, which is a straight axis-aligned line.
	 */
	snapTranslation(moving: readonly Point[], candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): TranslationSnap {
		if (!this.enabled || moving.length === 0) return NO_TRANSLATION;
		const pair = nearestPair(moving, (from) => this.snapToVertex(from, candidates.vertices ?? [], toleranceMm))
			?? nearestPair(moving, (from) => this.snapToEdge(from, candidates.edges ?? [], toleranceMm));
		if (pair !== null) {
			return { correction: { dx: pair.to.x - pair.from.x, dy: pair.to.y - pair.from.y }, guides: [{ start: pair.from, end: pair.to }] };
		}
		const alignments = candidates.alignments ?? [];
		const { minX, maxX, minY, maxY } = extentOf(moving);
		const features = [...moving, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }];
		const alongX = nearestAxisMatch(features, alignments, 'x', toleranceMm);
		const alongY = nearestAxisMatch(features, alignments, 'y', toleranceMm);
		const correction: Vector = { dx: alongX?.delta ?? 0, dy: alongY?.delta ?? 0 };
		const guides: LineSegment[] = [];
		if (alongX !== null) guides.push({ start: { x: alongX.feature.x + correction.dx, y: alongX.feature.y + correction.dy }, end: alongX.to });
		if (alongY !== null) guides.push({ start: { x: alongY.feature.x + correction.dx, y: alongY.feature.y + correction.dy }, end: alongY.to });
		return { correction, guides };
	}
```

Note on the "box centre" test: `features` is the four vertices plus the centre (50, 50). On x, alignment 53 is 3 from the centre and 47 from every vertex, so the centre wins and its guide starts at the corrected centre (53, 54). On y, alignment 104 is 4 from both y=100 vertices; `(100, 100)` comes first in iteration order and strict-less keeps it, so the guide starts at the corrected vertex (103, 104). That is what the expected guides say.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/snapping`
Expected: green. If the L-shape case disagrees on which feature won, re-read the fixture: the inner vertex at x=60 is 2 from 62 and the centre at x=50 is 12 away (outside tolerance), so the vertex must win.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/snapping/snap-service.ts tests/presentation/editor/snapping/snapServiceGuides.test.ts
git commit -m "Add SnapService.snapTranslation for rigid body moves with guides

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `roomSnapCandidates` gains alignments and an exclusion set

**Files:**
- Modify: `src/presentation/editor/snapping/roomSnapCandidates.ts`
- Modify: `tests/presentation/editor/tools/roomSnapping.test.ts` (the two `roomSnapCandidates` cases; fixtures gain ids)

**Interfaces:**
- Produces:
  ```ts
  export function roomSnapCandidates(
    zones: Iterable<{ readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }>,
    structure: Structure,
    exclude: ReadonlySet<string> = new Set(),
  ): SnapCandidates   // now always carries `alignments`
  ```

- [ ] **Step 1: Write the failing test**

In `tests/presentation/editor/tools/roomSnapping.test.ts`, add `id` to the two zone fixtures that lack one (`[{ points }, { points: [{ x: 8, y: 9 }] }]` becomes `[{ id: 'zone-a', points }, { id: 'zone-b', points: [{ x: 8, y: 9 }] }]`), then add after the first top-level `it`:

```ts
it('lists alignments — zone vertices, zone box centres, wall endpoints, element points — and drops an excluded entity entirely', () => {
 const zone = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }] };
 const object = { id: 'element-object', kind: 'object' as const, points: [{ x: 500, y: 500 }, { x: 600, y: 500 }, { x: 600, y: 600 }] };
 const wall = { id: 'wall-a', start: { x: 1000, y: 0 }, end: { x: 2000, y: 0 }, height: 2400, thickness: 150 };
 const structure = { walls: [wall], openings: [], boundaries: [], elements: [object] };
 const all = roomSnapCandidates([zone], structure);
 expect(all.alignments).toEqual(expect.arrayContaining([...zone.points, { x: 100, y: 50 }, wall.start, wall.end, ...object.points]));
 expect(all.alignments).toHaveLength(4 + 1 + 2 + 3);
 const without = roomSnapCandidates([zone], structure, new Set(['zone-a', 'element-object']));
 expect(without.vertices).toEqual([wall.start, wall.end]);
 expect(without.edges).toHaveLength(1);
 expect(without.alignments).toEqual([wall.start, wall.end]);
});
```

That wall literal carries the same fields as `WALL_LOOP`'s walls in `tests/helpers/structure.ts` (`id`, `start`, `end`, `height`, `thickness`).

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/tools/roomSnapping.test.ts`
Expected: `alignments` is `undefined` (length assertion fails) and the exclusion case still lists the zone's vertices.

- [ ] **Step 3: Implement**

Replace `src/presentation/editor/snapping/roomSnapCandidates.ts` with:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Structure } from '../../../domain/spatial/Structure';
import { openingPoints } from '../../../domain/spatial/Structure';
import { extentOf } from '../../../core/geometry/operations';
import type { SnapCandidates } from './snap-service';

interface SnapZone { readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }

/**
 * Existing zone boundaries, wall centre lines, opening endpoints and element geometry as snap
 * candidates; this projection never changes ownership. `alignments` is every vertex plus each
 * zone's box centre, for the axis stage. An entity whose id is in `exclude` contributes nothing,
 * so a dragged zone or element never snaps or aligns to itself.
 */
export function roomSnapCandidates(zones: Iterable<SnapZone>, structure: Structure, exclude: ReadonlySet<string> = new Set()): SnapCandidates {
 const vertices: Point[] = [], edges: (LineSegment & { readonly bulge?: number })[] = [], alignments: Point[] = [];
 for (const zone of zones) {
  if (exclude.has(zone.id)) continue;
  vertices.push(...zone.points); alignments.push(...zone.points);
  if (zone.points.length < 2) continue;
  const { minX, maxX, minY, maxY } = extentOf(zone.points);
  alignments.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
  zone.points.forEach((point, index) => edges.push({ start: point, end: zone.points[(index + 1) % zone.points.length], ...(zone.bulges?.[index] ? { bulge: zone.bulges[index] } : {}) }));
 }
 for (const wall of structure.walls) { vertices.push(wall.start, wall.end); alignments.push(wall.start, wall.end); edges.push({ start: wall.start, end: wall.end, ...(wall.bulge ? { bulge: wall.bulge } : {}) }); }
 for (const opening of structure.openings) vertices.push(...openingPoints(opening, structure.walls));
 for (const element of structure.elements ?? []) {
  if (exclude.has(element.id)) continue;
  vertices.push(...element.points); alignments.push(...element.points);
  element.points.slice(1).forEach((point, index) => edges.push({ start: element.points[index], end: point }));
  if (element.kind === 'object' && element.points.length > 2) edges.push({ start: element.points[element.points.length - 1], end: element.points[0] });
 }
 return { vertices, edges, alignments };
}
```

The existing vertex count assertion (`4 + WALL_LOOP.walls.length * 2 + 2`) is unchanged: opening points are vertices but not alignments, and the single-point zone adds a vertex and no centre.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/tools/roomSnapping.test.ts tests/presentation/editor/elements.test.ts`
Expected: green. `elementTask.ts` still compiles because `ZoneDto` carries `id`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/snapping/roomSnapCandidates.ts tests/presentation/editor/tools/roomSnapping.test.ts
git commit -m "roomSnapCandidates: alignments list and an exclusion set

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `EditorContext.snapCandidates`, the tolerance constant, and every context builder

**Files:**
- Modify: `src/presentation/editor/tools/editor-context.ts`
- Modify: `src/presentation/editor/handleMetrics.ts`
- Modify: `src/presentation/editor/runtime.ts` (the `createEditorContext` call inside `buildRuntime`, around line 698)
- Modify: `src/presentation/designer/runtime.ts` (its `createEditorContext` call, around line 264)
- Modify: `tests/helpers/tool-context.ts`
- Modify: `tests/helpers/calibrateHarness.ts` (its context literal, around line 133)
- Modify: `tests/presentation/editor/tools/editorContext.test.ts` (`stubDeps`, `SPEC_MEMBERS`, the "eight" wording)
- Modify: `tests/presentation/editor/tools/gestureTransaction.test.ts` (its deps literal, around line 141)

**Interfaces:**
- Produces:
  ```ts
  // editor-context.ts
  EditorContext.snapCandidates: (exclude?: Iterable<string>) => SnapCandidates
  EditorContextDeps.snapCandidates: EditorContext['snapCandidates']
  // handleMetrics.ts
  export const SNAP_TOLERANCE_PX = 8;
  // tests/helpers/tool-context.ts
  ToolContextOptions.snapCandidates?: EditorContext['snapCandidates']   // (exclude?) => SnapCandidates; default () => ({})
  ```
  `harnessSnapService(overridePoint)` now overrides `snapPointWithGuides` (answering `{ point: override(point), guides: [] }`), and no longer overrides `snapPoint`.

- [ ] **Step 1: Write the failing tests**

In `tests/presentation/editor/tools/editorContext.test.ts`:

- Add `'snapCandidates'` to `SPEC_MEMBERS`.
- Rename the case `'DoD 11: has exactly the eight spec members, nothing more and nothing fewer'` to `'DoD 11: has exactly the nine spec members, nothing more and nothing fewer'`, and change the header's "exactly the eight spec members" to "exactly the nine spec members (eight from the slice-6 spec plus `snapCandidates`, the smart alignment guides increment)".
- In the pass-through case beside `expect(context.snapService).toBe(deps.snapService);` add `expect(context.snapCandidates).toBe(deps.snapCandidates);`.
- In `stubDeps()` add `snapCandidates: () => ({}),` after `snapService`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/tools/editorContext.test.ts`
Expected: type error on `snapCandidates` in `EditorContextDeps`, and the member-list case failing on the extra key.

- [ ] **Step 3: Implement the context**

In `src/presentation/editor/tools/editor-context.ts`, change the `SnapService` import to `import type { SnapCandidates, SnapService } from '../snapping/snap-service';` and add to `EditorContext` after `snapService`:

```ts
	/**
	 * The geometry a gesture may snap or align to — every zone, wall, opening and element on
	 * the subject — minus the entities in `exclude`, so a dragged item never snaps to itself.
	 * One supply for every tool (smart alignment guides increment, spec §4); the designer
	 * answers an empty set.
	 */
	readonly snapCandidates: (exclude?: Iterable<string>) => SnapCandidates;
```

Add to `EditorContextDeps` after `snapService`: `snapCandidates: EditorContext['snapCandidates'];` and to `createEditorContext`'s returned literal after `snapService: deps.snapService,`: `snapCandidates: deps.snapCandidates,`.

In `src/presentation/editor/handleMetrics.ts` add, with the other constants:

```ts
/** Snap and alignment tolerance in screen pixels, scaled by the camera at every call. */
export const SNAP_TOLERANCE_PX = 8;
```

In `src/presentation/editor/runtime.ts`, inside `buildRuntime` (which already has `projectStore` in scope), add the import `import { roomSnapCandidates } from './snapping/roomSnapCandidates';` and, in the `createEditorContext({...})` literal after `snapService: ...,`:

```ts
			// ponytail: recomputed per call over every zone and element; a per-entity memo is the
			// upgrade if a plan ever carries enough vertices for a pointer move to notice.
			snapCandidates: (exclude = []) => roomSnapCandidates(projectStore.zones.values(), projectStore.structure, new Set(exclude)),
```

In `src/presentation/designer/runtime.ts`, in its `createEditorContext({...})` literal after `snapService: EDITOR_SNAP_SERVICE,`:

```ts
			// The designer's tools snap to nothing (spec §4.2); the shared service is the identity here.
			snapCandidates: () => ({}),
```

- [ ] **Step 4: Update the harnesses**

`tests/helpers/tool-context.ts`:

- Add to `ToolContextOptions`: `/** What a tool may snap or align to, given what it is dragging. Default: nothing. */ readonly snapCandidates?: EditorContext['snapCandidates'];`
- Replace the `snapPoint` override in `HarnessSnapService` with:

```ts
	override snapPointWithGuides(point: Point, candidates: SnapCandidates, toleranceMm?: number): SnapResult {
		return this.overridePoint === undefined
			? super.snapPointWithGuides(point, candidates, toleranceMm)
			: { point: this.overridePoint(point), guides: [] };
	}
```
  and import `SnapResult` alongside `SnapCandidates`. `snapPoint` needs no override now: the base one delegates.
- In the context literal add `snapCandidates: options.snapCandidates ?? (() => ({})),` after `snapService`.

`tests/helpers/calibrateHarness.ts`: add `snapCandidates: () => ({}),` after `snapService: harnessSnapService(),`.

`tests/presentation/editor/tools/gestureTransaction.test.ts`: add `snapCandidates: () => ({}),` after its `snapService:` line.

- [ ] **Step 5: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/tools tests/presentation/editor/snapping tests/presentation/designer`
Expected: green. vue-tsc must be clean over the whole tree, which is how any context builder this list missed is found: a missing `snapCandidates` is a type error.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/tools/editor-context.ts src/presentation/editor/handleMetrics.ts src/presentation/editor/runtime.ts src/presentation/designer/runtime.ts tests/helpers/tool-context.ts tests/helpers/calibrateHarness.ts tests/presentation/editor/tools/editorContext.test.ts tests/presentation/editor/tools/gestureTransaction.test.ts
git commit -m "EditorContext.snapCandidates: one candidate supply for every tool

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Select tool — body move and vertex drag snap on preview and commit, with guides

**Files:**
- Modify: `src/presentation/editor/tools/select-tool.ts` (`pointerMove` body/vertex branches, `pointerUp` body/vertex branches, `discardGesture`)
- Modify: `tests/presentation/editor/tools/selectTool.test.ts` (the case `'a body move is a RIGID translation even when the snap moves the anchor'`)
- Create: `tests/presentation/editor/tools/selectToolAlignmentGuides.test.ts`

**Interfaces:**
- Consumes: `snapTranslation`, `snapPointWithGuides`, `context.snapCandidates`, `SNAP_TOLERANCE_PX`.
- Produces: two private helpers on `SelectTool`:
  ```ts
  private movedBody(context: EditorContext, gesture: BodyGesture, by: Vector): Point[]
  private movedVertex(context: EditorContext, gesture: VertexGesture, worldPoint: Point): Point[]
  ```
  Both write `context.renderState.snapGuides`.

- [ ] **Step 1: Rewrite the rigid-translation case to use real candidates**

In `selectTool.test.ts`, replace the body of `'a body move is a RIGID translation even when the snap moves the anchor'` with:

```ts
		// The snap used to be applied to every vertex INDEPENDENTLY, which is not a
		// translation: with live candidates one corner lands on a guide while the opposite
		// corner stays put, so a "move" silently changes the zone's shape and area. One
		// correction from `snapTranslation`, applied to every point.
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		setActivePinia(createPinia());
		const { context, rejections } = toolContext({
			commandDispatcher: { run: () => Promise.resolve(ok('wrote')) },
			// One neighbour vertex 8 mm left of where the dragged square's first corner lands.
			snapCandidates: () => ({ vertices: [{ x: 40, y: 0 }] }),
		});
		const h: Harness = { context, gestures: [], rejections };
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(58, 10)); // delta (+48, 0); corner lands on (48, 0), 8 from (40, 0), snaps

		expect(h.gestures).toHaveLength(1);
		// Every point moved by the SAME corrected delta (+40, 0): still a 100 x 100 square.
		expect(h.gestures[0].forward.points).toEqual([
			{ x: 40, y: 0 },
			{ x: 140, y: 0 },
			{ x: 140, y: 100 },
			{ x: 40, y: 100 },
		]);
```

- [ ] **Step 2: Write the new failing cases**

Create `tests/presentation/editor/tools/selectToolAlignmentGuides.test.ts`:

```ts
/**
 * Smart alignment guides in the select tool (spec §6): the drag PREVIEW goes through the same
 * snap as the commit, guides are drawn while the gesture is live and gone when it is not, and
 * the dragged zone is excluded from its own candidates. Its own file because
 * `selectTool.test.ts` is at its line budget.
 */
import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import type { SnapCandidates } from '../../../../src/presentation/editor/snapping/snap-service';
import { ok } from '../../../../src/core/result/Result';
import type { Point } from '../../../../src/core/geometry/Point';
import { flushGesture as flush, pointerAt, toolContext } from '../../../helpers/tool-context';

const square: readonly Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

function rig(snapCandidates: (exclude?: Iterable<string>) => SnapCandidates) {
	setActivePinia(createPinia());
	const gestures: { forward: readonly Point[] }[] = [];
	const excluded: string[][] = [];
	const { context } = toolContext({
		commandDispatcher: { run: () => Promise.resolve(ok('wrote')) },
		snapCandidates: (exclude) => { excluded.push([...(exclude ?? [])]); return snapCandidates(exclude); },
	});
	const tool = new SelectTool({
		spatialObjects: () => [{ id: 'zone-a', points: square }],
		createMoveGesture: (_id, forward) => {
			gestures.push({ forward: forward.points });
			const command: UndoableCommand = { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) };
			return command;
		},
		reportRejected: () => undefined,
		reportInvalidInput: () => undefined,
	});
	tool.activate(context);
	return { tool, context, gestures, excluded };
}

describe('SelectTool alignment guides', () => {
	it('the body preview is snapped exactly as the commit is, and guides show mid-drag and clear on release', async () => {
		const { tool, context, gestures } = rig(() => ({ alignments: [{ x: 300, y: 900 }] }));
		tool.pointerDown(pointerAt(10, 10));
		tool.pointerMove(pointerAt(207, 10)); // raw delta +197: right edge at 297, 3 from x=300
		expect(context.renderState.previewPolygon?.[1]).toEqual({ x: 300, y: 0 });
		expect(context.renderState.previewPolygon?.[0]).toEqual({ x: 200, y: 0 });
		expect(context.renderState.snapGuides).toEqual([{ start: { x: 300, y: 0 }, end: { x: 300, y: 900 } }]);
		const previewed = context.renderState.previewPolygon;
		tool.pointerUp(pointerAt(207, 10));
		await flush();
		expect(gestures[0]?.forward).toEqual(previewed);
		expect(context.renderState.snapGuides).toEqual([]);
	});

	it('a vertex drag snaps on preview and commit alike and excludes its own zone', async () => {
		const { tool, context, gestures, excluded } = rig((exclude) => ([...(exclude ?? [])].includes('zone-a') ? { vertices: [{ x: 504, y: 100 }] } : { vertices: [{ x: 100, y: 100 }] }));
		tool.pointerDown(pointerAt(10, 10)); // select first: handles exist only on a selected zone
		tool.pointerUp(pointerAt(10, 10));
		await flush();
		tool.pointerDown(pointerAt(100, 100)); // the (100, 100) vertex handle, index 2
		tool.pointerMove(pointerAt(500, 100));
		expect(context.renderState.previewPolygon?.[2]).toEqual({ x: 504, y: 100 });
		expect(context.renderState.snapGuides).toEqual([{ start: { x: 500, y: 100 }, end: { x: 504, y: 100 } }]);
		tool.pointerUp(pointerAt(500, 100));
		await flush();
		expect(gestures[0]?.forward[2]).toEqual({ x: 504, y: 100 });
		expect(excluded.every((ids) => ids.includes('zone-a'))).toBe(true);
		expect(excluded.length).toBeGreaterThan(0);
	});

	it('cancel, abandonGesture and deactivate clear the guides', () => {
		for (const end of ['cancel', 'abandonGesture', 'deactivate'] as const) {
			const { tool, context } = rig(() => ({ alignments: [{ x: 300, y: 900 }] }));
			tool.pointerDown(pointerAt(10, 10));
			tool.pointerMove(pointerAt(207, 10));
			expect(context.renderState.snapGuides).toHaveLength(1);
			tool[end]();
			expect(context.renderState.snapGuides).toEqual([]);
		}
	});

	it('a click without a drag leaves no guides behind', async () => {
		const { tool, context } = rig(() => ({ vertices: [{ x: 5, y: 0 }] }));
		tool.pointerDown(pointerAt(10, 10));
		tool.pointerUp(pointerAt(10, 10));
		await flush();
		expect(context.renderState.snapGuides).toEqual([]);
	});
});
```

The first case's guide: the raw translation puts vertices at x ∈ {197, 297} and the centre at 247; `(297, 0)` is the first feature 3 from the alignment, so after the +3 correction the guide runs from `(300, 0)` to `(300, 900)`. The vertex grab in the second case follows the existing `'dragging a vertex replaces exactly that index'` case in `selectTool.test.ts`: select with a click first, then press on the vertex, inside `VERTEX_GRAB_RADIUS_PX` at scale 1.

- [ ] **Step 3: Run to verify they fail**

Run: `npm run check:fast -- tests/presentation/editor/tools/selectToolAlignmentGuides.test.ts tests/presentation/editor/tools/selectTool.test.ts`
Expected: the new file fails on `previewPolygon[1]` (`{ x: 297, y: 0 }` today) and on empty `snapGuides`; the rewritten rigid case fails because `pointerUp` snaps against `{}`.

- [ ] **Step 4: Implement**

In `src/presentation/editor/tools/select-tool.ts`:

Import `SNAP_TOLERANCE_PX` from `'../handleMetrics'` alongside the other metrics.

Add two private methods (place them just before `pointerMove`):

```ts
	/**
	 * The dragged zone translated by `by` and then corrected by ONE `snapTranslation` — so the
	 * shape stays rigid — with the guides written. `pointerMove` and `pointerUp` both call this,
	 * which is what makes the preview unable to drift from the commit.
	 */
	private movedBody(context: EditorContext, gesture: Extract<Gesture, { kind: 'body' }>, by: Vector): Point[] {
		const translated = translate(gesture.original, by).points;
		const snap = context.snapService.snapTranslation(translated, context.snapCandidates([gesture.zoneId]), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		context.renderState.snapGuides = snap.guides;
		return translated.map((point) => ({ x: point.x + snap.correction.dx, y: point.y + snap.correction.dy }));
	}

	private movedVertex(context: EditorContext, gesture: Extract<Gesture, { kind: 'vertex' }>, worldPoint: Point): Point[] {
		const snap = context.snapService.snapPointWithGuides(worldPoint, context.snapCandidates([gesture.zoneId]), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		context.renderState.snapGuides = snap.guides;
		const points = [...gesture.original.points];
		points[gesture.index] = snap.point;
		return points;
	}
```

`Gesture` is the module-level union declared above the class (`{ kind: 'body'; zoneId; original; startWorld }` and `{ kind: 'vertex'; zoneId; original; index; startWorld }`), so both `Extract`s resolve without naming anything new.

Replace the body of `pointerMove` from `if (this.gesture.kind === 'body') {` to the end of the method with:

```ts
		if (this.gesture.kind === 'body') {
			const by: Vector = {
				dx: event.worldPoint.x - this.gesture.startWorld.x,
				dy: event.worldPoint.y - this.gesture.startWorld.y,
			};
			context.renderState.previewPolygon = this.movedBody(context, this.gesture, by);
			return;
		}
		context.renderState.previewPolygon = this.movedVertex(context, this.gesture, event.worldPoint);
```

In `pointerUp`, replace the block from `let forwardPoints: Point[];` through the `else { ... }` with:

```ts
		const forwardPoints = gesture.kind === 'body'
			? this.movedBody(context, gesture, by)
			: this.movedVertex(context, gesture, event.worldPoint);
		context.renderState.snapGuides = [];
```

Delete the now-unused comment block about "ONE snap, of the translated first vertex" (its content moved onto `movedBody`'s docblock). In the click-not-drag early return (`if (Math.hypot(by.dx, by.dy) <= CLICK_EPSILON_PX * worldPerPixel) {`), add `context.renderState.snapGuides = [];` beside `previewPolygon = null`.

In `discardGesture`, inside `if (context !== null) { ... }`, add `context.renderState.snapGuides = [];`.

- [ ] **Step 5: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/tools`
Expected: green, including `selectToolDropPreview.test.ts`, `selectToolLabelDrag.test.ts` and `zoneLockClickThrough.test.ts`. Then run `npx eslint src/presentation/editor/tools/select-tool.ts` and confirm no `max-lines` finding; if there is one, move the two helpers' docblocks to one line each before anything else.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/tools/select-tool.ts tests/presentation/editor/tools/selectTool.test.ts tests/presentation/editor/tools/selectToolAlignmentGuides.test.ts
git commit -m "Select tool: snap the drag preview as the commit, draw alignment guides

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Element body and vertex moves

**Files:**
- Modify: `src/presentation/editor/elements/ElementMove.ts`
- Modify: `tests/presentation/editor/elementMoveAdmission.test.ts`

**Interfaces:**
- Consumes: `snapTranslation`, `snapPointWithGuides`, `context.snapCandidates`, `SNAP_TOLERANCE_PX`.

- [ ] **Step 1: Write the failing test**

Append to `tests/presentation/editor/elementMoveAdmission.test.ts`:

```ts
it('snaps a body move rigidly against the plan minus itself, draws guides, and clears them on finish and cancel', () => {
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>(), previewElement = vi.fn<NonNullable<ElementMoveDeps['previewElement']>>();
	const excluded: string[][] = [];
	const { context } = toolContext({ snapCandidates: (exclude) => { excluded.push([...(exclude ?? [])]); return { alignments: [{ x: 1003, y: 900 }] }; } });
	const move = new ElementMove({ moveElement, previewElement });
	const object = { id: 'element-object', kind: 'object' as const, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
	move.start(context, pointerAt(0, 0), object); move.move(pointerAt(900, 0));
	// Raw delta +900 puts the right edge at 1000, 3 from the alignment: corrected to 1003 for every point.
	expect(previewElement).toHaveBeenLastCalledWith(object.id, [{ x: 903, y: 0 }, { x: 1003, y: 0 }, { x: 1003, y: 100 }]);
	// (1000, 0) is the first feature 3 from the alignment; corrected, the guide starts there.
	expect(context.renderState.snapGuides).toEqual([{ start: { x: 1003, y: 0 }, end: { x: 1003, y: 900 } }]);
	expect(excluded.every((ids) => ids.includes(object.id))).toBe(true);
	move.finish(context, pointerAt(900, 0));
	expect(moveElement).toHaveBeenCalledWith(object.id, [{ x: 903, y: 0 }, { x: 1003, y: 0 }, { x: 1003, y: 100 }], object);
	expect(context.renderState.snapGuides).toEqual([]);
	move.start(context, pointerAt(0, 0), object); move.move(pointerAt(900, 0)); expect(context.renderState.snapGuides).toHaveLength(1);
	move.cancel(); expect(context.renderState.snapGuides).toEqual([]);
});

it('snaps a vertex drag through the guided point snap', () => {
	const moveElement = vi.fn<NonNullable<ElementMoveDeps['moveElement']>>();
	const { context } = toolContext({ snapCandidates: () => ({ vertices: [{ x: 504, y: 0 }] }) });
	const move = new ElementMove({ moveElement });
	const path = { id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
	move.start(context, pointerAt(0, 0), path, 0); move.move(pointerAt(500, 0));
	expect(context.renderState.snapGuides).toEqual([{ start: { x: 500, y: 0 }, end: { x: 504, y: 0 } }]);
	move.finish(context, pointerAt(500, 0));
	expect(moveElement.mock.calls[0]?.[1]).toEqual([{ x: 504, y: 0 }, { x: 1000, y: 0 }]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/elementMoveAdmission.test.ts`
Expected: preview called with the raw `+900` points; `snapGuides` empty.

- [ ] **Step 3: Implement**

In `src/presentation/editor/elements/ElementMove.ts`, change the `CLICK_EPSILON_PX` import to `import { CLICK_EPSILON_PX, SNAP_TOLERANCE_PX } from '../handleMetrics';` and replace `points(event)`:

```ts
	private points(event: EditorPointerEvent): Point[] {
		const gesture = this.gesture;
		if (!gesture) return [];
		const { context } = gesture, tolerance = SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel();
		const candidates = context.snapCandidates([gesture.element.id]);
		if (gesture.vertexIndex !== undefined) {
			const points = [...gesture.points], anchor = points[gesture.vertexIndex === 0 ? 1 : gesture.vertexIndex - 1];
			const constrained = constrainDrawingPoint(anchor, event.worldPoint, event.modifiers.shift, context.snapService);
			const snap = context.snapService.snapPointWithGuides(constrained, candidates, tolerance);
			context.renderState.snapGuides = snap.guides;
			points[gesture.vertexIndex] = snap.point;
			return points;
		}
		const translated = gesture.points.map(original => ({ x: original.x + event.worldPoint.x - gesture.start.x, y: original.y + event.worldPoint.y - gesture.start.y }));
		const snap = context.snapService.snapTranslation(translated, candidates, tolerance);
		context.renderState.snapGuides = snap.guides;
		return translated.map(point => ({ x: point.x + snap.correction.dx, y: point.y + snap.correction.dy }));
	}
```

In `finish`, after `const points = this.points(event), moved = ...;` add `context.renderState.snapGuides = [];`. In `cancel`, add `this.gesture?.context.renderState.snapGuides = [];` as the FIRST statement — the optional-chain assignment is not valid TypeScript, so spell it:

```ts
	cancel(): void { if (this.gesture) this.gesture.context.renderState.snapGuides = []; this.gesture = null; this.deps.previewElement?.(null); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/elementMoveAdmission.test.ts tests/presentation/editor/elements.test.ts tests/presentation/editor/stairGestureGuards.test.ts`
Expected: green. The existing arrow-constraint case's `toBeCloseTo(-600, 9)` still holds: with no candidates, `snapPointWithGuides` is the identity.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/elements/ElementMove.ts tests/presentation/editor/elementMoveAdmission.test.ts
git commit -m "ElementMove: rigid snapped translation and guided vertex drag

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Draw-room, element and polygon drawing tools read the shared candidates

**Files:**
- Modify: `src/presentation/editor/tools/draw-room-tool.ts` (`DrawRoomToolDeps`, `snapped`)
- Modify: `src/presentation/editor/tools/registerEditorTools.ts` (drop `roomCandidates` and the `roomSnapCandidates`/`computed` imports if now unused)
- Modify: `src/presentation/editor/elements/ElementTool.ts` (drop `candidates` dep, use context)
- Modify: `src/presentation/editor/elements/elementTask.ts` (drop the `candidates` computed and its import)
- Modify: `src/presentation/editor/tools/draw-polygon-tool.ts` (`landingPoint`, guide clearing)
- Modify: `tests/presentation/editor/tools/roomSnapping.test.ts` (`armed()`)
- Modify: `tests/presentation/editor/elements.test.ts` (wherever `new ElementTool(` passes `candidates`)
- Modify: `tests/presentation/editor/tools/drawPolygonTool.test.ts`
- Modify: `tests/helpers/drawPolygonHarness.ts` (`harness()` options gain `snapCandidates`, passed through to `toolContext`)

**Interfaces:**
- `DrawRoomToolDeps` loses `snapCandidates`. `ElementTool`'s deps lose `candidates`. Both read `context.snapCandidates()`.
- `harness(options: { worldPerScreenPixel?: number; snapCandidates?: EditorContext['snapCandidates'] })` in `drawPolygonHarness.ts`.

- [ ] **Step 1: Write the failing tests**

`roomSnapping.test.ts` `armed()`: remove `snapCandidates:` from the `DrawRoomTool` deps and put the same candidates on the context:

```ts
 const tool = new DrawRoomTool({ draft, defaultName: () => 'Room 1' });
 const { context } = toolContext({ worldPerScreenPixel: 10, snapCandidates: () => ({ vertices: [{ x: 0, y: 0 }, { x: 4000, y: 3000 }], edges: [{ start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } }] }) });
```

Add one case to the `describe`:

```ts
 it('draws an axis guide when a corner lines up with a neighbour and nothing is within point tolerance', () => {
  const draft = useRoomDraftStore(), tool = new DrawRoomTool({ draft, defaultName: () => 'Room 1' });
  const { context } = toolContext({ worldPerScreenPixel: 10, snapCandidates: () => ({ alignments: [{ x: 6000, y: 9000 }] }) });
  const actual = { ...context, snapService: EDITOR_SNAP_SERVICE }; tool.activate(actual);
  tool.pointerDown(pointerAt(1000, 1000)); tool.pointerMove(pointerAt(5950, 2000));
  expect(draft.rect).toEqual({ x: 1000, y: 1000, width: 5000, depth: 1000 });
  expect(actual.renderState.snapGuides).toEqual([{ start: { x: 6000, y: 2000 }, end: { x: 6000, y: 9000 } }]);
 });
```

`elements.test.ts`: find each `new ElementTool(id, {...})` literal, remove its `candidates:` entry, and pass the same candidates through `toolContext({ snapCandidates: ... })` for the case that asserts snapping (if none asserts snapping, drop the entry and nothing else).

`drawPolygonTool.test.ts`: append inside the main `describe`:

```ts
	it('the landing point aligns to a neighbour on one axis and the guide is drawn, then cleared with the sketch', () => {
		const h = harness({ snapCandidates: () => ({ alignments: [{ x: 300, y: 900 }] }) });
		const tool = build(h);
		tool.activate(h.context);
		tool.pointerDown(at(0, 0));
		tool.pointerMove(at(297, 50));
		expect(h.context.renderState.polygonSketch?.nextVertex).toEqual({ x: 300, y: 50 });
		expect(h.context.renderState.snapGuides).toEqual([{ start: { x: 300, y: 50 }, end: { x: 300, y: 900 } }]);
		tool.cancel();
		expect(h.context.renderState.snapGuides).toEqual([]);
	});
```

In `tests/helpers/drawPolygonHarness.ts`, widen `harness`'s options to `{ worldPerScreenPixel?: number; snapCandidates?: EditorContext['snapCandidates'] }` (import `EditorContext` as a type from `src/presentation/editor/tools/editor-context` if the file does not already) and pass `snapCandidates: options.snapCandidates` into its `toolContext({...})` call beside `worldPerScreenPixel`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run check:fast -- tests/presentation/editor/tools/roomSnapping.test.ts tests/presentation/editor/tools/drawPolygonTool.test.ts tests/presentation/editor/elements.test.ts`
Expected: type errors on the removed dep (`snapCandidates`/`candidates` still required), then the axis cases failing on unsnapped coordinates.

- [ ] **Step 3: Implement**

`draw-room-tool.ts`: remove `readonly snapCandidates: () => SnapCandidates;` from `DrawRoomToolDeps` and the `SnapCandidates` import; import `SNAP_TOLERANCE_PX` beside `CLICK_EPSILON_PX`; replace `snapped`:

```ts
	private snapped(point: Point, context: EditorContext): Point {
		const snap = context.snapService.snapPointWithGuides(point, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		context.renderState.snapGuides.push(...snap.guides);
		return snap.point;
	}
```

`registerEditorTools.ts`: delete the `roomCandidates` computed line; register `new DrawRoomTool({ draft: roomDraft, defaultName: defaultRoomName })`; remove the `roomSnapCandidates` import and the `computed` import if nothing else in the file uses it.

`ElementTool.ts`: remove `candidates(): SnapCandidates;` from the deps type and the `SnapCandidates` import; import `SNAP_TOLERANCE_PX` from `'../handleMetrics'`; replace the last line of `pointerMove`:

```ts
		const snap = context.snapService.snapPointWithGuides(constrained, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		this.deps.draft.cursor = snap.point;
		context.renderState.snapGuides = snap.guides;
```
and clear guides where the cursor goes: `abandonGesture(): void { this.deps.draft.cursor = null; if (this.context) this.context.renderState.snapGuides = []; }`, and the same line at the start of `cancel()` and `deactivate()`.

`elementTask.ts`: delete the `candidates` computed (line 29) and `candidates: () => candidates.value,` from the `ElementTool` deps; remove the `roomSnapCandidates` import.

`draw-polygon-tool.ts`: import `SNAP_TOLERANCE_PX` from `'../handleMetrics'` (merge with any existing import from that module); replace `landingPoint`:

```ts
	/**
	 * Order: constrain, THEN snap — a vertex or edge within tolerance is a real feature of the
	 * drawing while a constrained ray is a straight-edge the user is holding against it, which
	 * is the precedence CAD gives object snap over polar tracking. Observable since the smart
	 * alignment guides increment gave this tool real candidates; before that both tools handed
	 * `snapPoint` an empty set and the order was unobservable.
	 */
	private landingPoint(context: EditorContext, event: EditorPointerEvent): Point {
		const anchor = this.buffer.at(-1);
		const constrained = constrainDrawingPoint(anchor, event.worldPoint, event.modifiers.shift, context.snapService);
		const snap = context.snapService.snapPointWithGuides(constrained, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		context.renderState.snapGuides = snap.guides;
		return snap.point;
	}
```
Wherever the tool writes `context.renderState.polygonSketch = null` (line 331 and any other), write `context.renderState.snapGuides = [];` on the next line. Read `deactivate`, `cancel` and `abandonGesture` (lines 172, 245, 264) and make sure each reaches one of those sites or clears the guides itself.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor`
Expected: green across the editor directory (this task touches three tools and their registration, so the whole directory is the right scope). Then `npm run analyze` must report no new `unused-exports`/`unused-files`: `roomSnapCandidates` still has its caller in `runtime.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/tools/draw-room-tool.ts src/presentation/editor/tools/registerEditorTools.ts src/presentation/editor/elements/ElementTool.ts src/presentation/editor/elements/elementTask.ts src/presentation/editor/tools/draw-polygon-tool.ts tests/presentation/editor/tools/roomSnapping.test.ts tests/presentation/editor/elements.test.ts tests/presentation/editor/tools/drawPolygonTool.test.ts
git commit -m "Drawing tools snap through the shared candidates with guides

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The banner's snap hint follows the guides, not the tool

**Files:**
- Modify: `src/presentation/editor/shell/TemporaryToolBanner.vue` (line 99)
- Modify: `tests/presentation/editor/shell/temporaryToolBanner.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe` in `temporaryToolBanner.test.ts`:

```ts
	it('shows the snapped hint under any creation tool once guides exist, not only under draw-room', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-polygon');
		await settle();
		expect(harness.wrapper.find('.rp-task-banner').text()).not.toContain(t('en', 'editor.room.snapped'));
		runtime.renderState.snapGuides = [{ start: { x: 0, y: 0 }, end: { x: 0, y: 100 } }];
		await settle();
		expect(harness.wrapper.find('.rp-task-banner').text()).toContain(t('en', 'editor.room.snapped'));
		runtime.renderState.snapGuides = [];
		await settle();
		expect(harness.wrapper.find('.rp-task-banner').text()).not.toContain(t('en', 'editor.room.snapped'));
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:fast -- tests/presentation/editor/shell/temporaryToolBanner.test.ts`
Expected: the hint is absent under `draw-polygon` with guides set.

- [ ] **Step 3: Implement**

In `TemporaryToolBanner.vue` line 99:

```ts
const showSnapHint = computed(() => runtime.renderState.snapGuides.length > 0);
```

Read the docblock above it; if it says the hint is draw-room's, change that sentence to "shown under whichever creation task has a guide on the canvas".

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:fast -- tests/presentation/editor/shell`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/shell/TemporaryToolBanner.vue tests/presentation/editor/shell/temporaryToolBanner.test.ts
git commit -m "Banner snap hint keys on guides present, not on draw-room

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Manual case, increment history, and the gate

**Files:**
- Create: `docs/tests/cases/Alignment guides while dragging.md`
- Modify: `docs/development/agent-guide-increment-history.md` (append a section)
- Modify: `docs/superpowers/specs/2026-09-13-smart-alignment-guides-design.md` (status line points at this plan)

- [ ] **Step 1: Write the manual case**

Create `docs/tests/cases/Alignment guides while dragging.md`:

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 95
sources:
  - Smart alignment guides design spec §3 (precedence), §5 (rendering), §6 (callers)
  - Interaction spec §22 (snapping is automatic and visible)
status: Ready
---

# Alignment guides while dragging

The smart alignment guides increment: dragging a room, a room corner, an element or a drawing
cursor snaps it to existing geometry and draws a dashed guide with a dot at what it matched.
`docs/superpowers/specs/2026-09-13-smart-alignment-guides-design.md` is the design and
`docs/superpowers/plans/2026-09-13-smart-alignment-guides.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
floor with at least two rooms not touching each other. **Create sample renovation project**
seeds one. Snap is ON in the view menu (the magnet in the status bar reads on).

## Why a human is the only instrument for four of these

Every snap decision below is driven in `tests/presentation/editor/snapping/snapServiceGuides.test.ts`
and every gesture in `selectToolAlignmentGuides.test.ts`, `elementMoveAdmission.test.ts`,
`roomSnapping.test.ts` and `drawPolygonTool.test.ts`. Outside all of it:

1. **Whether the guide is legible against the plan.** `SnapGuides.vue` draws a 1 px dashed
   accent line; jsdom draws nothing and the fixed harness shots cannot hold a pointer mid-drag.
2. **Whether 8 screen pixels is the right pull.** Too wide and a room cannot be placed just
   beside another; too narrow and the guide never appears. A number picked, not measured.
3. **Whether the drop lands where the guide said.** The suite proves preview equals commit;
   only a vault shows the written room after the read-back.
4. **Whether the Snap toggle silences it all.** The service reads the preference through a
   getter; a live toggle mid-session is the host's own reactivity.

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Select a room. Drag it slowly until its left edge is within a few pixels of another room's left edge. | The room jumps so the edges share an x; a vertical dashed line joins them with a dot at the neighbour. |
| 2 | Keep dragging past. | The guide disappears and the room follows the pointer again. |
| 3 | Drag until the room's centre lines up with the neighbour's centre. | A guide through both centres. |
| 4 | Drag a corner of the room onto a corner of the neighbour. | The corner lands exactly on it; one short guide from the pointer to the corner, no axis line. |
| 5 | Release. Undo. Redo. | The room is where the guide said; undo and redo restore each position. |
| 6 | Add → Room, drag a rectangle whose right edge nears a neighbour's edge. | Guide and snap as in step 1; the banner reads "Snapped to nearby geometry." |
| 7 | Turn Snap off in the view menu, repeat step 1. | No guide, no jump. |
| 8 | Turn Snap on, press Escape mid-drag. | The room returns, no guide remains on the canvas. |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row is an expectation derived from the spec and the suite. |

## Outcome

Written after the first walk.
```

- [ ] **Step 2: Append the increment history entry**

At the end of `docs/development/agent-guide-increment-history.md`, add:

```markdown
## Smart alignment guides, 2026-09-13

Spec: `docs/superpowers/specs/2026-09-13-smart-alignment-guides-design.md`; plan:
`docs/superpowers/plans/2026-09-13-smart-alignment-guides.md`, whose header lists four
deviations, all smaller than the spec.

**What landed.** `SnapService.snapPointWithGuides` and `snapTranslation`
(`src/presentation/editor/snapping/snap-service.ts`): vertex, then edge, then x/y axis
alignment against a new `alignments` candidate list, each answer carrying the `LineSegment`
guides that say why. `snapPoint` is the point half of the first. `EditorContext.snapCandidates(exclude)`
is the ONE supply, built in `editor/runtime.ts` from `roomSnapCandidates` (now with `alignments`
and an exclusion set); the designer answers `{}`. Every positional gesture switched from
`snapPoint(x, {})` — which had made the select tool's and `ElementMove`'s snapping the identity
since slice 6 — to the two methods at `SNAP_TOLERANCE_PX` (8, `handleMetrics.ts`) scaled by the
camera. The select tool's drag PREVIEW now goes through the same call as the commit, which the
service docblock had claimed of every tool and the select tool had not done. Guides draw through
the unchanged `SnapGuides.vue`; the banner hint keys on guides present rather than on
`draw-room`.

**What was found on the way.** The select tool's body move was snapping at the configured 8 mm
regardless of zoom, so at any working zoom it never fired; the draw-room and element tools had
already been scaling 8 px by the camera. The two `computed` candidate memos (draw-room's and the
element task's) were duplicates of each other and are gone.

**Deferred**, named in the spec's §8: full-extent guide lines, equal-spacing guides, an
alignment-tolerance setting, walls joining the shared stage, a suppress-snap modifier. The
manual case `docs/tests/cases/Alignment guides while dragging.md` is written and unrun.
```

- [ ] **Step 3: Point the spec at the plan**

In the spec's `**Status:**` line, append: `The implementation plan derived from it is \`docs/superpowers/plans/2026-09-13-smart-alignment-guides.md\`.`

- [ ] **Step 4: Run the fast gate over the whole presentation tree, then the full gate once**

Run: `npm run check:fast -- tests/presentation tests/helpers`
Expected: green.

Then, with no other gate running on the machine: `npm run check`
Expected: green. If coverage fails on a branch in `snap-service.ts`, read `coverage/coverage-final.json` for that file and add the missing case to `snapServiceGuides.test.ts` rather than lowering anything. If `tests/build/` files time out in `beforeAll`, re-run `npx vitest run --project build-lint --no-file-parallelism` before believing it (CLAUDE.md, "The linter in the edit loop").

- [ ] **Step 5: Commit**

```bash
git add docs/tests/cases/"Alignment guides while dragging.md" docs/development/agent-guide-increment-history.md docs/superpowers/specs/2026-09-13-smart-alignment-guides-design.md
git commit -m "Record the smart alignment guides increment: manual case, history, spec pointer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Push and open the pull request**

```bash
git push -u origin claude/plan-editor-alignment-guidelines-ea41e1
```

Then open a PR titled "Smart alignment guides while dragging on the plan canvas" whose body summarises the history entry above, ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, and treat a red CI leg as the report to act on.
