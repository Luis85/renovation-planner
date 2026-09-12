# Wall Tool Join-and-Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a wall chain start AND end on an existing wall's body, cutting each host at the join when the chain is saved, with the join visible as a status line and a canvas cut mark while drawing.

**Architecture:** A new pure domain resolver (`wallJoin.ts`) answers where a cursor lands on a wall body; the draft (`structureDraft.ts`) records a start and an end `WallSplit` and applies them through the existing `splitWall` before validation, preview and save; `StructureTool` composes endpoint snapping with the resolver and auto-finishes on an end join; the form and `WallDraftOverlay` read the draft's joins for feedback. Nothing changes in `StructureCommand` or persistence: the cut structure is the structure the existing command writes.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Konva via vue-konva, Vitest (node for domain, jsdom for presentation), the repository's own `tests/helpers/*` rigs.

**Spec:** `docs/superpowers/specs/2026-09-12-wall-tool-join-and-split-design.md` — read it first; the plan argues from it.

## Global Constraints

- Layer bans are lint: `src/domain/**` may import nothing from `vue`, `pinia`, `konva`, `obsidian` or from `presentation/`/`application/`/`infrastructure/`.
- `max-lines` 400 and `max-lines-per-function` 100 per file/function in `src/**` (skip blank and comments); `tests/**` files 450.
- UI text goes through `tr(...)` with a key in BOTH `src/presentation/i18n/locales/en/structure.ts` and `.../de/structure.ts`; English values are sentence case. Never a literal in a `.setText`/`text:`/`addCommand name`.
- No hard-coded colours in `styles/` or Konva configs: use `tokens.accent` etc.
- Coverage floors 99/99/99/98: every new branch needs a test that reaches it. Read `coverage-final.json` for changed files rather than trusting the summary line.
- Inner loop: `npm run check:fast -- <test paths>`; before each commit that ends a task: `npm run check:fast` over the touched test directories. `npm run check` ONCE at the end (Task 9). Never run two gates at once.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work in this worktree: `C:\Projects\renovation-planner\.claude\worktrees\wall-tool-improvements-b9fd00`, branch `claude/wall-tool-improvements-b9fd00`. Run `npm ci` first if `node_modules` is empty.
- Every file below is addressed by name; line numbers are for orientation at the time of writing and may have moved.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/domain/spatial/wallJoin.ts` (new) | `resolveWallJoin`: cursor → best body join or null | 1 |
| `tests/domain/spatial/wallJoin.test.ts` (new) | resolver cases | 1 |
| `tests/domain/spatial/splitWall.test.ts` | lock: two sequential cuts on one wall | 1 |
| `src/presentation/editor/structure/structureDraft.ts` | `joins`, `pending`, `drawnOn` for both cuts, `endOnWall`, `snapWallPoint.axis`, `draftStructure` builds on the cut floor | 2 |
| `tests/presentation/editor/structureDraft.test.ts` | draft cases; two `snapWallPoint` expectations gain `axis: true` | 2 |
| `src/presentation/editor/structure/StructureTool.ts` | pointerMove resolves a pending join; pointerDown starts, ends and auto-finishes | 3 |
| `tests/presentation/editor/structure/StructureTool.test.ts` | tool cases | 3 |
| `src/presentation/editor/structure/structureTask.ts` | `addNumeric` joins at 1 mm; `undoPoint` clears joins | 4 |
| `tests/presentation/editor/structureLifecycle.test.ts` | numeric join and undo cases via the `structureEditor` rig | 4 |
| `src/presentation/i18n/locales/{en,de}/structure.ts` | two new keys, one reworded | 5 |
| `src/presentation/editor/structure/StructureTaskForm.vue` | status line names the join | 5 |
| `src/presentation/editor/structure/WallDraftOverlay.vue` | `cuts` prop → `wall-draft-cut` lines | 6 |
| `src/presentation/editor/structure/StructureLayer.vue` | computes `cuts` from the draft | 6 |
| `tests/presentation/editor/finalOverviewPresentation.test.ts` | form line + cut marks + pre-cut preview via the rig | 5, 6 |
| `docs/tests/cases/Draw connected walls and openings.md`, `docs/development/agent-guide-increment-history.md`, spec status | records | 8 |

---

### Task 1: The join resolver (domain)

**Files:**
- Create: `src/domain/spatial/wallJoin.ts`
- Create: `tests/domain/spatial/wallJoin.test.ts`
- Modify: `tests/domain/spatial/splitWall.test.ts`

**Interfaces:**
- Consumes: `projectOntoWall`, `alongWall`, `wallLength`, `wallTangent`, `Wall` from `src/domain/spatial/Structure.ts`; `circularEdgeIntersections` from `src/core/geometry/circularIntersections.ts`; `Point` from `src/core/geometry/Point.ts`.
- Produces (later tasks import these by name):
  ```ts
  export interface WallJoin { readonly wallId: string; readonly offset: number; readonly point: Point; readonly perpendicular: boolean }
  export interface JoinQuery { readonly walls: readonly Wall[]; readonly point: Point; readonly tolerance: number; readonly from?: Point; readonly ray?: Point }
  export function resolveWallJoin(query: JoinQuery): WallJoin | null
  ```

- [ ] **Step 1: Write the failing tests**

`tests/domain/spatial/wallJoin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveWallJoin } from '../../../src/domain/spatial/wallJoin';
import { alongWall, wallLength, type Wall } from '../../../src/domain/spatial/Structure';

const north: Wall = { id: 'wall-north', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
const east: Wall = { id: 'wall-east', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, height: 2400, thickness: 150 };
// A semicircle (bulge 1), centre (2000, 0), radius 2000; which side it bends to is the bulge sign's business, so the cases read its midpoint rather than assume one.
const arc: Wall = { id: 'wall-arc', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, bulge: 1 };
const arcMid = alongWall(arc, wallLength(arc) / 2), inward = -Math.sign(arcMid.y);
const walls = [north, east];

describe('resolveWallJoin', () => {
	it('lands the nearest point on a wall body within tolerance, rounded to whole millimetres', () => {
		expect(resolveWallJoin({ walls, point: { x: 1234.4, y: 6 }, tolerance: 8 })).toEqual({ wallId: 'wall-north', offset: 1234, point: { x: 1234, y: 0 }, perpendicular: false });
	});
	it('answers null off every wall and null within tolerance of a wall end, which is an endpoint snap and not a cut', () => {
		expect(resolveWallJoin({ walls, point: { x: 1234, y: 9 }, tolerance: 8 })).toBeNull();
		expect(resolveWallJoin({ walls, point: { x: 3995, y: 2 }, tolerance: 8 })).toBeNull();
		expect(resolveWallJoin({ walls, point: { x: 4, y: 2 }, tolerance: 8 })).toBeNull();
	});
	it('prefers the foot of the perpendicular from the previous point when the cursor is near it', () => {
		const join = resolveWallJoin({ walls, point: { x: 1505, y: 3 }, tolerance: 8, from: { x: 1500, y: 1200 } });
		expect(join).toEqual({ wallId: 'wall-north', offset: 1500, point: { x: 1500, y: 0 }, perpendicular: true });
		// Too far from the foot: the nearest point wins, not perpendicular.
		expect(resolveWallJoin({ walls, point: { x: 1520, y: 3 }, tolerance: 8, from: { x: 1500, y: 1200 } })).toEqual({ wallId: 'wall-north', offset: 1520, point: { x: 1520, y: 0 }, perpendicular: false });
	});
	it('picks the closest wall when two are in reach, and a perpendicular foot over a nearer plain point', () => {
		const corner = [north, { ...east, start: { x: 1000, y: 0 }, end: { x: 1000, y: 3000 }, id: 'wall-stem' }];
		expect(resolveWallJoin({ walls: corner, point: { x: 1002, y: 500 }, tolerance: 8 })?.wallId).toBe('wall-stem');
		expect(resolveWallJoin({ walls: corner, point: { x: 1005, y: 6 }, tolerance: 8, from: { x: 1003, y: 1200 } })).toMatchObject({ wallId: 'wall-north', perpendicular: true });
	});
	it('projects radially onto a curved wall', () => {
		// 6 mm inside the arc's midpoint, on the radius: the nearest arc point is the midpoint, half way along.
		const join = resolveWallJoin({ walls: [arc], point: { x: arcMid.x, y: arcMid.y + inward * 6 }, tolerance: 8 });
		expect(join?.wallId).toBe('wall-arc');
		expect(join?.point.x).toBeCloseTo(arcMid.x, 0); expect(join?.point.y).toBeCloseTo(arcMid.y, 0);
		expect(join?.offset).toBe(Math.round(wallLength(arc) / 2));
	});
	it('intersects the Shift ray with the wall so the constrained angle stays exact', () => {
		// From (1500, 1200) straight up (the constrained point is on the ray, 5 mm short of the wall).
		const join = resolveWallJoin({ walls, point: { x: 1500, y: 5 }, tolerance: 8, from: { x: 1500, y: 1200 }, ray: { x: 1500, y: 5 } });
		expect(join).toEqual({ wallId: 'wall-north', offset: 1500, point: { x: 1500, y: 0 }, perpendicular: true });
		// A 45° ray from (1000, 1000) meets the north wall at (2000, 0): not perpendicular.
		const diagonal = resolveWallJoin({ walls, point: { x: 1996, y: 4 }, tolerance: 8, from: { x: 1000, y: 1000 }, ray: { x: 1996, y: 4 } });
		expect(diagonal).toEqual({ wallId: 'wall-north', offset: 2000, point: { x: 2000, y: 0 }, perpendicular: false });
		// The ray misses the wall by more than the tolerance: null, no fallback to the nearest point.
		expect(resolveWallJoin({ walls, point: { x: 1500, y: 20 }, tolerance: 8, from: { x: 1500, y: 1200 }, ray: { x: 1500, y: 20 } })).toBeNull();
		// A zero-length ray (cursor on the anchor) is no ray.
		expect(resolveWallJoin({ walls, point: { x: 1500, y: 1200 }, tolerance: 8, from: { x: 1500, y: 1200 }, ray: { x: 1500, y: 1200 } })).toBeNull();
	});
	it('intersects the Shift ray with a curved wall', () => {
		// A vertical ray from the centre's side, stopping 5 mm short of the arc's midpoint: radial, so perpendicular.
		const from = { x: arcMid.x, y: arcMid.y / 2 }, ray = { x: arcMid.x, y: arcMid.y + inward * 5 };
		const join = resolveWallJoin({ walls: [arc], point: ray, tolerance: 8, from, ray });
		expect(join?.point.y).toBeCloseTo(arcMid.y, 0); expect(join?.perpendicular).toBe(true);
	});
});
```

Append to `tests/domain/spatial/splitWall.test.ts` inside the `describe`:

```ts
	it('takes a second cut on the same wall, named against the half the second cut falls on', () => {
		const plain = { ...structure, openings: [], boundaries: [] };
		const first = expectOk(splitWall(plain, 'wall-a', 1000, 'wall-second-half'));
		// The second cut lies past the first, so it names the second half at an offset measured from ITS start.
		const second = expectOk(splitWall(first.structure, 'wall-second-half', 2000, 'wall-third'));
		expect(second.point).toEqual({ x: 3000, y: 0 });
		expect(second.structure.walls.map(item => [item.id, item.start.x, item.end.x])).toEqual([['wall-a', 0, 1000], ['wall-second-half', 1000, 3000], ['wall-third', 3000, 4000], ['wall-b', 4000, 4000]]);
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/domain/spatial/wallJoin.test.ts tests/domain/spatial/splitWall.test.ts`
Expected: `wallJoin.test.ts` fails to import (`Cannot find module`); the `splitWall` case passes already (it is a lock, not a change).

- [ ] **Step 3: Write the resolver**

`src/domain/spatial/wallJoin.ts`:

```ts
import type { Point } from '../../core/geometry/Point';
import { circularEdgeIntersections } from '../../core/geometry/circularIntersections';
import { alongWall, projectOntoWall, wallLength, wallTangent, type Wall } from './Structure';

/** A point on a wall's BODY where a new wall may join it, cutting the host there when saved. */
export interface WallJoin { readonly wallId: string; readonly offset: number; readonly point: Point; readonly perpendicular: boolean }
/**
 * `point` is the cursor (already Shift-constrained when `ray` is given); `from` the chain's last
 * point; `ray` the constrained point itself, which lies on the ray from `from` — present only
 * while Shift is held, when the ray's intersection with the wall replaces the projected candidates
 * so the 15° step stays exact rather than drifting by a projection.
 */
export interface JoinQuery { readonly walls: readonly Wall[]; readonly point: Point; readonly tolerance: number; readonly from?: Point; readonly ray?: Point }

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const perpendicularTo = (wall: Wall, offset: number, from: Point, to: Point): boolean => {
	const tangent = wallTangent(wall, offset), length = distance(from, to);
	return length > 0 && Math.abs((tangent.x * (to.x - from.x) + tangent.y * (to.y - from.y)) / length) <= 1e-6;
};

/** `offset` on `wall` as a join, or null within `tolerance` of either end: an end is an endpoint snap, never a cut. */
function joinAt(wall: Wall, offset: number, tolerance: number, perpendicular: boolean): WallJoin | null {
	const rounded = Math.round(offset);
	if (rounded <= tolerance || rounded >= wallLength(wall) - tolerance) return null;
	return { wallId: wall.id, offset: rounded, point: alongWall(wall, rounded), perpendicular };
}

/** Shift held: where the ray from `from` through `ray`, carried `tolerance` further, crosses the wall. */
function rayJoin(wall: Wall, query: JoinQuery, from: Point, ray: Point): WallJoin | null {
	const reach = distance(from, ray);
	if (reach === 0) return null;
	const end = { x: ray.x + (ray.x - from.x) / reach * query.tolerance, y: ray.y + (ray.y - from.y) / reach * query.tolerance };
	const hits = circularEdgeIntersections({ start: from, end, bulge: 0 }, { start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 });
	const nearest = hits.points.filter(hit => distance(hit, query.point) <= query.tolerance).sort((a, b) => distance(a, query.point) - distance(b, query.point))[0];
	if (!nearest) return null;
	const offset = projectOntoWall(wall, nearest).offset;
	return joinAt(wall, offset, query.tolerance, perpendicularTo(wall, offset, from, ray));
}

/** No Shift: the foot of the perpendicular from `from` when the cursor is near it, else the nearest body point. */
function freeJoin(wall: Wall, query: JoinQuery): WallJoin | null {
	if (query.from) {
		const foot = projectOntoWall(wall, query.from);
		if (foot.fraction > 0 && foot.fraction < 1 && distance(foot.point, query.point) <= query.tolerance) {
			const candidate = joinAt(wall, foot.offset, query.tolerance, true);
			if (candidate) return candidate;
		}
	}
	const nearest = projectOntoWall(wall, query.point);
	return nearest.distance <= query.tolerance ? joinAt(wall, nearest.offset, query.tolerance, false) : null;
}

/** The wall body the cursor lands on, or null. A perpendicular foot beats a nearer plain point, so a right angle is not lost to a closer wall. */
export function resolveWallJoin(query: JoinQuery): WallJoin | null {
	let best: { join: WallJoin; away: number } | null = null;
	for (const wall of query.walls) {
		const candidate = query.from && query.ray ? rayJoin(wall, query, query.from, query.ray) : freeJoin(wall, query);
		if (!candidate) continue;
		const away = distance(candidate.point, query.point);
		if (!best || (candidate.perpendicular && !best.join.perpendicular) || (candidate.perpendicular === best.join.perpendicular && away < best.away)) best = { join: candidate, away };
	}
	return best?.join ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/domain/spatial/wallJoin.test.ts tests/domain/spatial/splitWall.test.ts`
Expected: PASS. If the arc case's `offset` is off by one, the arc length rounding differs from `Math.round(Math.PI * 1000)`: replace the expectation with `expect(join?.offset).toBeCloseTo(Math.PI * 1000, -1)`; do not loosen the straight-wall cases.

- [ ] **Step 5: Lint and commit**

Run: `npm run check:fast -- tests/domain/spatial`
Expected: oxlint clean, vue-tsc clean, tests pass.

```bash
git add src/domain/spatial/wallJoin.ts tests/domain/spatial/wallJoin.test.ts tests/domain/spatial/splitWall.test.ts
git commit -m "feat(domain): resolve where a cursor joins a wall body

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The draft records a start and an end join

**Files:**
- Modify: `src/presentation/editor/structure/structureDraft.ts`
- Modify: `tests/presentation/editor/structureDraft.test.ts`

**Interfaces:**
- Consumes: `resolveWallJoin`, `WallJoin` from Task 1; `splitWall` (unchanged).
- Produces:
  ```ts
  // on the reactive draft (createStructureDraft):
  joins: { start: WallSplit | null; end: WallSplit | null }
  pending: WallJoin | null
  export interface WallSplit { readonly wallId: string; readonly offset: number; readonly id: string; readonly point: Point }  // now exported
  export function endOnWall(draft: StructureDraft, existing: Structure, join: WallJoin): boolean
  export function snapWallPoint(point, points, walls, tolerance): { point: Point; snapped: boolean; axis?: true }
  export function draftStructure(draft, existing?): Structure | null   // draw-wall builds on the floor WITH the draft's cuts applied
  ```
  `startFromWall` keeps its signature and now writes `draft.joins.start`. `draft.split` no longer exists.

- [ ] **Step 1: Write the failing tests**

In `tests/presentation/editor/structureDraft.test.ts`, change the import line to add `endOnWall`:

```ts
import { createStructureDraft, addWallPoint, draftStructure, mintStructure, numericWallPoint, openingFromDraft, snapWallPoint, wallsFromDraft, pickHost, validateDraftStructure, isStructureTool, startFromWall, wallStartRefused, endOnWall } from '../../../src/presentation/editor/structure/structureDraft';
```

In the case `'snaps to the closest endpoint first, then axes, with exact numeric input unaffected'`, the two axis expectations gain the `axis` flag:

```ts
		expect(snapWallPoint({ x: 5, y: 500 }, [{ x: 0, y: 0 }], [], 8)).toEqual({ point: { x: 0, y: 500 }, snapped: true, axis: true });
		expect(snapWallPoint({ x: 500, y: 5 }, [{ x: 0, y: 0 }], [], 8)).toEqual({ point: { x: 500, y: 0 }, snapped: true, axis: true });
```

In the case `'starts at a wall end within tolerance and refuses …'`, replace `expect(atEnd.split).toBeNull();` with `expect(atEnd.joins.start).toBeNull();`.

Append these cases inside the `describe`:

```ts
	it('ends a chain on a wall body by cutting it there, and drops the cut with the point', () => {
		const draft = createStructureDraft();
		expect(addWallPoint(draft, { x: 2000, y: 1500 }, WALL_LOOP)).toBe(true);
		expect(endOnWall(draft, WALL_LOOP, { wallId: 'wall-a', offset: 2000, point: { x: 2000, y: 0 }, perpendicular: true })).toBe(true);
		expect(draft.points).toEqual([{ x: 2000, y: 1500 }, { x: 2000, y: 0 }]);
		expect(draft.joins.end).toMatchObject({ wallId: 'wall-a', offset: 2000, point: { x: 2000, y: 0 } });
		const walls = expectOk(validateDraftStructure(draft, WALL_LOOP, [])).walls;
		expect(walls.map(wall => wall.id)).toEqual(['wall-a', draft.joins.end?.id, 'wall-b', 'wall-c', 'wall-d', 'wall-draft-0']);
		expect(walls[0].end).toEqual({ x: 2000, y: 0 });
		// The preview builds on the cut floor too, so the host renders as two halves while drawing.
		expect(expectDefined(draftStructure(draft, WALL_LOOP), 'preview').walls).toHaveLength(6);
		// Popping the last point leaves the recorded join, and the cut no longer applies.
		draft.points.pop();
		expect(addWallPoint(draft, { x: 2500, y: 1500 }, WALL_LOOP)).toBe(true);
		expect(expectOk(validateDraftStructure(draft, WALL_LOOP, [])).walls).toHaveLength(5);
	});
	it('ends a chain on the wall it started from, naming the half the end falls on', () => {
		const draft = createStructureDraft();
		expect(startFromWall(draft, WALL_LOOP, 'wall-a', { x: 1000, y: 0 }, 8)).toBe(true);
		expect(addWallPoint(draft, { x: 1000, y: 1500 }, WALL_LOOP)).toBe(true);
		expect(addWallPoint(draft, { x: 3000, y: 1500 }, WALL_LOOP)).toBe(true);
		// Resolved against the UNCUT floor, as the tool resolves a pending join: wall-a at 3000.
		expect(endOnWall(draft, WALL_LOOP, { wallId: 'wall-a', offset: 3000, point: { x: 3000, y: 0 }, perpendicular: true })).toBe(true);
		const start = expectDefined(draft.joins.start, 'start join'), end = expectDefined(draft.joins.end, 'end join');
		expect(end.wallId).toBe(start.id); expect(end.offset).toBe(2000);
		const walls = expectOk(validateDraftStructure(draft, WALL_LOOP, [])).walls;
		expect(walls.map(wall => [wall.id, wall.start.x, wall.end.x]).slice(0, 3)).toEqual([['wall-a', 0, 1000], [start.id, 1000, 3000], [end.id, 3000, 4000]]);
	});
	it('refuses an end inside an opening and records nothing', () => {
		const existing = { ...WALL_LOOP, openings: [{ id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
		const draft = createStructureDraft();
		expect(addWallPoint(draft, { x: 900, y: 1500 }, existing)).toBe(true);
		expect(endOnWall(draft, existing, { wallId: 'wall-a', offset: 900, point: { x: 900, y: 0 }, perpendicular: true })).toBe(false);
		expect(draft.error?.code).toBe('spatial.opening-split'); expect(draft.joins.end).toBeNull(); expect(draft.points).toHaveLength(1);
		expect(endOnWall(draft, existing, { wallId: 'wall-gone', offset: 900, point: { x: 900, y: -5000 }, perpendicular: false })).toBe(false);
		expect(draft.error?.code).toBe('spatial.host-missing');
	});
	it('treats an end join that lands exactly on a wall end as a plain point', () => {
		const draft = createStructureDraft();
		// From (3000, 1500) rather than (4000, 1500): a wall up to the corner along wall-b's line would be collinear overlap, refused as today.
		expect(addWallPoint(draft, { x: 3000, y: 1500 }, WALL_LOOP)).toBe(true);
		expect(endOnWall(draft, WALL_LOOP, { wallId: 'wall-a', offset: 4000, point: { x: 4000, y: 0 }, perpendicular: false })).toBe(true);
		expect(draft.joins.end).toBeNull(); expect(draft.points[1]).toEqual({ x: 4000, y: 0 });
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/presentation/editor/structureDraft.test.ts`
Expected: FAIL — `endOnWall` is not exported; the `axis` and `joins` expectations fail.

- [ ] **Step 3: Rewrite the join half of `structureDraft.ts`**

Replace the `WallSplit` interface, `createStructureDraft`, `draftStructure`, `validateDraftStructure`, `drawnOn`, `wallStart`, `startFromWall`, `addWallPoint` and `snapWallPoint` with the following (keep everything else — `wallsFromDraft`, `openingFromDraft`, `wallStartRefused`, `numericWallPoint`, `mintStructure`, `pickHost` — as it is). Add the import `import { resolveWallJoin, type WallJoin } from '../../../domain/spatial/wallJoin';`.

```ts
/** A wall the chain starts or ends in the middle of, cut at `point` when the walls are saved. */
export interface WallSplit { readonly wallId: string; readonly offset: number; readonly id: string; readonly point: Point }
export function createStructureDraft() {
	const swing: OpeningSwingDraft = { hinge: 'start', side: 'left', angle: '90' };
	return reactive({ kind: 'draw-wall', points: [] as Point[], cursor: null as Point | null, snapped: false,
		joins: { start: null as WallSplit | null, end: null as WallSplit | null }, pending: null as WallJoin | null,
		swing,
		busy: false, loading: false, conflict: false, error: null as AppError | null, room: false, roomName: '',
		text: { x: '0', y: '0', length: '', angle: '0', height: '2.4', thickness: '0.15', hostId: '', offset: '0', width: '0.9', openingHeight: '2.1', sill: '0' },
	});
}
export type StructureDraft = ReturnType<typeof createStructureDraft>;
```

```ts
/** The draft's walls on the floor it is drawn on — with its cuts applied, so a preview and a save see one picture. A refused cut previews on the uncut floor; validation reports it. */
export function draftStructure(draft: StructureDraft, existing: Structure = EMPTY_STRUCTURE): Structure | null {
	if (draft.kind === 'draw-wall') {
		const walls = wallsFromDraft(draft), base = drawnOn(draft, draft.points, existing), floor = base.ok ? base.value : existing;
		return walls && walls.length > 0 ? { ...floor, walls: [...floor.walls, ...walls] } : null;
	}
	const opening = openingFromDraft(draft);
	return opening ? { ...existing, openings: [...existing.openings, opening] } : null;
}

export function validateDraftStructure(draft: StructureDraft, existing: Structure, roomIds: readonly string[]) {
	if (draft.kind !== 'draw-wall' && draft.kind !== 'place-opening' && !parseSwingDraft(draft.swing)) return err(spatialError('opening-swing'));
	if (draft.kind === 'draw-wall' && draft.text.length !== '') return err(spatialError('pending'));
	const base = drawnOn(draft, draft.points, existing);
	if (!base.ok) return base;
	const proposed = draftStructure(draft, existing);
	if (!proposed) return err(spatialError('wall-dimensions'));
	if (draft.room && (!closedChain(draft.points) || !draft.roomName.trim())) return err(spatialError('boundary'));
	return validateStructure(proposed, roomIds);
}

/**
 * The floor a chain of `points` is drawn on: `existing` with the start cut applied while the chain
 * still starts at it, THEN the end cut while the chain still ends at it. Sequential, because the end
 * join is resolved against the floor with the start cut already made (`endOnWall`), so two cuts on
 * one wall name whichever half each falls on.
 */
function drawnOn(draft: StructureDraft, points: readonly Point[], existing: Structure): Result<Structure, ValidationError> {
	let floor = existing;
	const { start, end } = draft.joins;
	for (const [split, anchor] of [[start, points[0]], [end, points.length > 1 ? points[points.length - 1] : undefined]] as const) {
		if (!split || !anchor || !samePoint(anchor, split.point)) continue;
		const cut = splitWall(floor, split.wallId, split.offset, split.id);
		if (!cut.ok) return cut;
		floor = cut.value.structure;
	}
	return ok(floor);
}

/** Where a wall drawn from `point` on `wallId` starts: an end within `tolerance`, else a whole-millimetre cut. */
function wallStart(existing: Structure, wallId: string, point: Point, tolerance: number): Result<{ point: Point; split: WallSplit | null }, ValidationError> {
	const wall = existing.walls.find(item => item.id === wallId);
	if (!wall) return err(spatialError('host-missing'));
	const length = wallLength(wall), along = projectOntoWall(wall, point).offset, id = createEntityId('wall');
	const offset = along <= tolerance ? 0 : along >= length - tolerance ? length : Math.round(along);
	const cut = splitWall(existing, wallId, offset, id);
	if (!cut.ok) return cut;
	return ok({ point: cut.value.point, split: cut.value.structure === existing ? null : { wallId, offset, id, point: cut.value.point } });
}
export const wallStartRefused = (existing: Structure, wallId: string, point: Point, tolerance: number): boolean => !wallStart(existing, wallId, point, tolerance).ok;

/** Starts the chain on a wall at the point nearest `point`, so the new wall joins it there. */
export function startFromWall(draft: StructureDraft, existing: Structure, wallId: string, point: Point, tolerance: number): boolean {
	const start = wallStart(existing, wallId, point, tolerance);
	if (!start.ok) { draft.error = start.error; return false; }
	draft.joins.start = start.value.split;
	return addWallPoint(draft, start.value.point, existing);
}

/**
 * Ends the chain on a wall body at `join`, cutting the host there when the chain is saved. `join`
 * was resolved against the UNCUT floor (what the canvas shows), so it is re-found on the floor
 * with the start cut applied: the wall under `join.point` there is the half it falls on. A point
 * that turns out to be a wall end is a plain point and records no cut.
 */
export function endOnWall(draft: StructureDraft, existing: Structure, join: WallJoin): boolean {
	const base = drawnOn(draft, draft.points, existing);
	if (!base.ok) { draft.error = base.error; return false; }
	const host = base.value.walls.map(wall => ({ wall, ...projectOntoWall(wall, join.point) })).filter(hit => hit.distance <= 1).sort((a, b) => a.distance - b.distance)[0];
	if (!host) { draft.error = spatialError('host-missing'); return false; }
	const offset = Math.round(host.offset), id = createEntityId('wall');
	const cut = splitWall(base.value, host.wall.id, offset, id);
	if (!cut.ok) { draft.error = cut.error; return false; }
	const previous = draft.joins.end;
	draft.joins.end = cut.value.structure === base.value ? null : { wallId: host.wall.id, offset, id, point: cut.value.point };
	if (addWallPoint(draft, cut.value.point, existing)) return true;
	draft.joins.end = previous;
	return false;
}

export function addWallPoint(draft: StructureDraft, point: Point, existing: Structure): boolean {
	if (draft.busy || draft.loading || draft.conflict || !validSpatialPoint(point) || closedChain(draft.points)) return false;
	if (draft.points.length && samePoint(draft.points[draft.points.length - 1], point)) { draft.error = spatialError('wall-dimensions'); return false; }
	const points = [...draft.points, point];
	const walls = wallsFromDraft({ ...draft, points }), base = drawnOn(draft, points, existing);
	if (!base.ok) { draft.error = base.error; return false; }
	const checked = walls ? validateStructure({ ...base.value, walls: [...base.value.walls, ...walls] }, existing.boundaries.map(b => b.roomId)) : null;
	if (!checked?.ok) { draft.error = checked ? checked.error : spatialError('wall-dimensions'); return false; }
	draft.points = points; draft.error = null; draft.cursor = null; draft.pending = null;
	return true;
}
```

```ts
/** Endpoint snap first (a candidate POINT), then the previous point's axes; `axis` marks the second so a caller can let a wall-body join take precedence over it. */
export function snapWallPoint(point: Point, points: readonly Point[], walls: readonly Wall[], tolerance: number): { point: Point; snapped: boolean; axis?: true } {
	const candidates = [...points, ...walls.flatMap(wall => [wall.start, wall.end])];
	const close = candidates.map(candidate => ({ point: candidate, distance: Math.hypot(candidate.x - point.x, candidate.y - point.y) })).filter(candidate => candidate.distance <= tolerance).reduce<{ point: Point; distance: number } | undefined>((best, hit) => !best || hit.distance < best.distance ? hit : best, undefined);
	if (close) return { point: close.point, snapped: true };
	const last = points[points.length - 1];
	if (!last) return { point, snapped: false };
	const x = Math.abs(last.x - point.x) <= tolerance ? last.x : point.x;
	const y = Math.abs(last.y - point.y) <= tolerance ? last.y : point.y;
	const snapped = x !== point.x || y !== point.y;
	return snapped ? { point: { x, y }, snapped, axis: true } : { point, snapped };
}
```

Note the `resolveWallJoin` import is not used by this file yet (Tasks 3 and 4 use it); if `no-unused-vars` fires, import only `type WallJoin` here.

- [ ] **Step 4: Fix the one other reader of `draft.split`**

Run: `grep -rn "\.split\b" src/presentation/editor/structure src/presentation/editor/selection tests/presentation/editor | grep -v "\.split('" | grep -v "\.split(\"" `
Expected: no hits outside the lines you just edited. (`useCanvasMenuActions.ts` uses `wallStartRefused`, not the field.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/presentation/editor/structureDraft.test.ts tests/presentation/editor/structureDraftAdmission.test.ts tests/presentation/editor/structure`
Expected: PASS.

- [ ] **Step 6: Line budget, lint, commit**

Run: `npx eslint src/presentation/editor/structure/structureDraft.ts --max-warnings 0`
Expected: clean. If `max-lines` (400) fires, move `WallSplit`, `drawnOn`, `wallStart`, `wallStartRefused`, `startFromWall` and `endOnWall` into a new `src/presentation/editor/structure/wallJoinDraft.ts` that imports `addWallPoint` and `StructureDraft` from `structureDraft.ts` (`drawnOn` is then exported from there and imported back into `structureDraft.ts` for `draftStructure`/`addWallPoint` — a cycle of two modules, which TypeScript and Vite accept for function-only exports; verify with `npm run check:fast`), and update the test's import line accordingly.

```bash
git add src/presentation/editor/structure tests/presentation/editor/structureDraft.test.ts
git commit -m "feat(editor): a wall draft records a start and an end join, each a deferred cut

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The tool resolves a pending join, starts and ends by click, auto-finishes

**Files:**
- Modify: `src/presentation/editor/structure/StructureTool.ts`
- Modify: `tests/presentation/editor/structure/StructureTool.test.ts`

**Interfaces:**
- Consumes: `resolveWallJoin` (Task 1); `endOnWall`, `startFromWall`, `snapWallPoint` with `axis` (Task 2); `draft.pending`, `draft.joins`.
- Produces: no new exports. Behaviour contract for Task 4 and 6: `draft.pending` is set on `pointerMove` whenever the cursor lands on a wall body and cleared otherwise; `pointerDown` on a pending join with points already placed calls `deps.finish()` once when the end join is recorded.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/structure/StructureTool.test.ts` inside the `describe`. Add `shiftPointerAt` to the helper import (`import { toolContext, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';`), import `WALL_LOOP` from `'../../../helpers/structure'` and `createEditorSnapService` from `'../../../../src/presentation/editor/snapping/editorSnapping'`.

```ts
	function wallTool(structure = WALL_LOOP) {
		const draft = createStructureDraft();
		const finish = vi.fn<() => void>();
		const tool = new StructureTool('draw-wall', { draft, structure: () => structure, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish, blocked: () => false });
		tool.activate(toolContext().context);
		return { draft, finish, tool };
	}
	it('shows a pending join while the cursor is on a wall body, and none at an endpoint or in free space', () => {
		const { draft, tool } = wallTool();
		tool.pointerMove(pointerAt(1234.4, 5));
		expect(draft.pending).toMatchObject({ wallId: 'wall-a', offset: 1234, perpendicular: false });
		expect(draft.cursor).toEqual({ x: 1234, y: 0 }); expect(draft.snapped).toBe(true);
		tool.pointerMove(pointerAt(3996, 3));
		expect(draft.pending).toBeNull(); expect(draft.cursor).toEqual({ x: 4000, y: 0 });
		tool.pointerMove(pointerAt(2000, 1500));
		expect(draft.pending).toBeNull(); expect(draft.snapped).toBe(false);
	});
	it('starts the chain on a wall body with a click, cutting the host, and keeps drawing', () => {
		const { draft, finish, tool } = wallTool();
		tool.pointerDown(pointerAt(1000.3, 4));
		expect(draft.points).toEqual([{ x: 1000, y: 0 }]);
		expect(draft.joins.start).toMatchObject({ wallId: 'wall-a', offset: 1000 });
		expect(draft.pending).toBeNull(); expect(finish).not.toHaveBeenCalled();
	});
	it('ends the chain on a wall body with a click and finishes at once, preferring the perpendicular foot', () => {
		const { draft, finish, tool } = wallTool();
		tool.pointerDown(pointerAt(2000, 1500));
		// Slightly off the perpendicular foot: the foot at (2000, 0) wins.
		tool.pointerMove(pointerAt(2004, 3));
		expect(draft.pending).toMatchObject({ wallId: 'wall-a', offset: 2000, perpendicular: true });
		tool.pointerDown(pointerAt(2004, 3));
		expect(draft.points).toEqual([{ x: 2000, y: 1500 }, { x: 2000, y: 0 }]);
		expect(draft.joins.end).toMatchObject({ wallId: 'wall-a', offset: 2000 });
		expect(finish).toHaveBeenCalledOnce();
	});
	it('does not finish when the end is refused, and leaves the chain in place', () => {
		const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 };
		const { draft, finish, tool } = wallTool({ ...WALL_LOOP, openings: [door] });
		tool.pointerDown(pointerAt(900, 1500));
		tool.pointerDown(pointerAt(900, 3));
		expect(draft.points).toHaveLength(1); expect(draft.error?.code).toBe('spatial.opening-split');
		expect(finish).not.toHaveBeenCalled();
	});
	it('keeps the Shift angle exact by intersecting the constrained ray with the wall', () => {
		const { draft, tool } = wallTool();
		tool.pointerDown(pointerAt(1000, 1000));
		// 45° from (1000, 1000) reaches wall-a at (2000, 0); the raw cursor is a few mm off the line.
		tool.pointerMove(shiftPointerAt(1997, 6));
		expect(draft.pending).toMatchObject({ wallId: 'wall-a', offset: 2000, perpendicular: false });
		expect(draft.cursor).toEqual({ x: 2000, y: 0 });
	});
	it('offers no join while snapping is switched off', () => {
		const draft = createStructureDraft();
		const tool = new StructureTool('draw-wall', { draft, structure: () => WALL_LOOP, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(), blocked: () => false });
		// `enabled` is a getter over the callback the service is built with, so a disabled service is built, not assigned.
		tool.activate({ ...toolContext().context, snapService: createEditorSnapService(() => false) });
		tool.pointerMove(pointerAt(1234, 5));
		expect(draft.pending).toBeNull(); expect(draft.cursor).toEqual({ x: 1234, y: 5 }); expect(draft.snapped).toBe(false);
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/presentation/editor/structure/StructureTool.test.ts`
Expected: the six new cases FAIL (`pending` undefined / never set; `joins.start` null; `finish` not called).

- [ ] **Step 3: Implement the tool**

Replace `pointerDown` and `pointerMove` in `src/presentation/editor/structure/StructureTool.ts`, and extend `cancel` and `editCorner`; add the imports `import { resolveWallJoin } from '../../../domain/spatial/wallJoin';` and `endOnWall, startFromWall` from `./structureDraft`:

```ts
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary' || !this.context || this.deps.blocked()) return;
		this.pointerMove(event);
		const draft = this.deps.draft;
		if (this.id !== 'draw-wall') { if (draft.snapped) this.deps.finish(); return; }
		if (!draft.cursor) return;
		const join = draft.pending, structure = this.deps.structure();
		if (!join) { addWallPoint(draft, draft.cursor, structure); return; }
		if (!draft.points.length) { startFromWall(draft, structure, join.wallId, join.point, this.tolerance()); return; }
		// A click landing on a wall body is the chain's natural end: continuing past it would cross the wall.
		if (endOnWall(draft, structure, join) && draft.joins.end) this.deps.finish();
	}
	pointerMove(event: EditorPointerEvent): void {
		if (!this.context || this.deps.blocked()) return;
		const tolerance = this.tolerance(), draft = this.deps.draft;
		if (this.id !== 'draw-wall') { pickHost(draft, event.worldPoint, this.deps.structure().walls, tolerance); return; }
		const from = draft.points.at(-1), constrained = constrainDrawingPoint(from, event.worldPoint, event.modifiers.shift, this.context.snapService);
		if (!this.context.snapService.enabled) { draft.cursor = constrained; draft.snapped = false; draft.pending = null; return; }
		const walls = this.deps.structure().walls, snapped = snapWallPoint(constrained, draft.points, walls, tolerance);
		// An endpoint or previous-point snap wins outright; an axis snap yields to a wall body under the cursor.
		const join = snapped.snapped && !snapped.axis ? null : resolveWallJoin({ walls, point: constrained, tolerance, from, ...(event.modifiers.shift && from ? { ray: constrained } : {}) });
		draft.pending = join;
		draft.cursor = join ? join.point : snapped.point;
		draft.snapped = join !== null || snapped.snapped;
	}
	private tolerance(): number { return Math.min(100, 8 * (this.context?.viewport.worldPerScreenPixel() ?? 1)); }
```

```ts
	cancel(): void {
		if (this.deps.draft.busy) return;
		const draft = this.deps.draft;
		draft.points = []; draft.cursor = null; draft.pending = null; draft.text.length = ''; draft.room = false; draft.joins.start = null; draft.joins.end = null;
	}
	editCorner(index: number, point: null): boolean {
		if (this.deps.blocked() || point !== null || (index !== -1 && index !== this.deps.draft.points.length - 1)) return false;
		const draft = this.deps.draft;
		draft.points.pop(); draft.room = false; draft.joins.end = null;
		if (!draft.points.length) draft.joins.start = null;
		return true;
	}
```

Check `EditorContext['viewport']` really exposes `worldPerScreenPixel()` (it does in `tests/helpers/tool-context.ts`) and that `snapService.enabled` is a readable boolean on `SnapService` — `StructureTool` already reads it today.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/presentation/editor/structure tests/presentation/editor/structureDraft.test.ts tests/presentation/editor/snapping`
Expected: PASS, including the pre-existing `'owns only temporary pointer work…'` case in `structureDraft.test.ts`, which drives `editCorner` and `cancel`.

- [ ] **Step 5: Lint and commit**

Run: `npm run check:fast -- tests/presentation/editor/structure tests/presentation/editor/structureDraft.test.ts`
Expected: clean.

```bash
git add src/presentation/editor/structure/StructureTool.ts tests/presentation/editor/structure/StructureTool.test.ts
git commit -m "feat(editor): the wall tool joins a wall body at a click, starting or ending the chain

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Numeric entry joins at 1 mm; undo clears joins

**Files:**
- Modify: `src/presentation/editor/structure/structureTask.ts`
- Modify: `tests/presentation/editor/structureLifecycle.test.ts`

**Interfaces:**
- Consumes: `resolveWallJoin`; `endOnWall`, `startFromWall`; `draft.joins`.
- Produces: none new. `task.addNumeric()` returns `true` when a typed point joined; `finish` is invoked by it after an end join.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/structureLifecycle.test.ts` inside its `describe` (the file already has `rig`, `start`, `seeded`, `settle`, `settleUntil`, `expectOk`, `WALL_LOOP`):

```ts
	it('joins a typed point that lands on a wall body, at one millimetre, and finishes on a typed end', async () => {
		const value = await rig(); await seeded(value);
		const task = await start(value);
		// (2, 0) in metres lies on wall-a's body: a numeric START join.
		task.draft.text.x = '2'; task.draft.text.y = '0';
		expect(task.addNumeric()).toBe(true);
		expect(task.draft.joins.start).toMatchObject({ wallId: 'wall-a', offset: 2000 });
		// 3 m at 90° lands on wall-c (y = 3000): a numeric END join, saved at once.
		task.draft.text.length = '3'; task.draft.text.angle = '90';
		expect(task.addNumeric()).toBe(true);
		await settleUntil(() => value.runtime.activeToolId.value === 'select', 'the chain saved and the tool returned to Select');
		const saved = expectOk(await value.geometry.read(value.plan.id)).document.structure;
		expect(saved?.walls).toHaveLength(7);
		expect(saved?.walls.filter(wall => wall.start.x === 2000 || wall.end.x === 2000).map(wall => [wall.start, wall.end])).toEqual(expect.arrayContaining([[{ x: 0, y: 0 }, { x: 2000, y: 0 }], [{ x: 2000, y: 0 }, { x: 4000, y: 0 }], [{ x: 2000, y: 0 }, { x: 2000, y: 3000 }]]));
	});
	it('drops the end join with Undo point and the start join with the first point', async () => {
		const value = await rig(); await seeded(value);
		const task = await start(value);
		task.draft.text.x = '1'; task.draft.text.y = '0'; expect(task.addNumeric()).toBe(true);
		task.draft.text.length = '1'; task.draft.text.angle = '90'; expect(task.addNumeric()).toBe(true);
		expect(task.draft.joins.start).not.toBeNull();
		task.undoPoint(); expect(task.draft.points).toHaveLength(1); expect(task.draft.joins.start).not.toBeNull();
		task.undoPoint(); expect(task.draft.points).toHaveLength(0); expect(task.draft.joins.start).toBeNull();
	});
```

If `value.geometry` is not on the `structureEditor` rig, read `tests/helpers/structureEditor.ts` and `tests/harness/referenceWorkspace.ts` for the sidecar's name on the returned object and use that; `seeded` in this same file already reads through it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/presentation/editor/structureLifecycle.test.ts -t "typed point"`
Expected: FAIL — `joins.start` is null (a numeric point never joins today) or the save is refused with `spatial.intersection`.

- [ ] **Step 3: Implement**

In `src/presentation/editor/structure/structureTask.ts`, import `resolveWallJoin` from `'../../../domain/spatial/wallJoin'` and add `endOnWall, startFromWall` to the `./structureDraft` import (`startFromWall` is already imported). Replace `addNumeric` and `undoPoint`:

```ts
	/** A typed point that lies on a wall body — within one millimetre, since typed geometry is whole-millimetre — joins it exactly as a click there. */
	function addNumeric(): boolean {
		if (blocked.value) return false;
		const point = numericWallPoint(draft);
		if (!point) { draft.error = spatialError('numeric'); return false; }
		const structure = project.structure, join = resolveWallJoin({ walls: structure.walls, point, tolerance: 1 });
		const added = !join ? addWallPoint(draft, point, structure)
			: !draft.points.length ? startFromWall(draft, structure, join.wallId, join.point, 1)
			: endOnWall(draft, structure, join);
		if (!added) return false;
		draft.text.length = '';
		if (draft.joins.end) void finish();
		return true;
	}
	function undoPoint(): void {
		if (blocked.value) return;
		draft.points.pop(); draft.room = false; draft.error = null; draft.joins.end = null;
		if (!draft.points.length) draft.joins.start = null;
	}
```

`finish` is declared below `addNumeric` as a function declaration, so the forward reference is fine.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/presentation/editor/structureLifecycle.test.ts tests/presentation/editor/structureDraft.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run check:fast -- tests/presentation/editor/structureLifecycle.test.ts`

```bash
git add src/presentation/editor/structure/structureTask.ts tests/presentation/editor/structureLifecycle.test.ts
git commit -m "feat(editor): a typed wall point joins a wall body at one millimetre

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Strings and the form's status line

**Files:**
- Modify: `src/presentation/i18n/locales/en/structure.ts`
- Modify: `src/presentation/i18n/locales/de/structure.ts`
- Modify: `src/presentation/editor/structure/StructureTaskForm.vue`
- Modify: `tests/presentation/editor/finalOverviewPresentation.test.ts`

**Interfaces:**
- Consumes: `draft.pending` (Task 2/3).
- Produces: keys `editor.structure.joins`, `editor.structure.joins-perpendicular`; reworded `editor.structure.error.opening-split`.

- [ ] **Step 1: Write the failing test**

Append to `tests/presentation/editor/finalOverviewPresentation.test.ts` (it already imports `structureEditor`, `settle`, `settleUntil`, `expectDefined`, `tr`, `useEditorStore`, Konva; add `pointerAt` from `'../../helpers/tool-context'` and `WALL_LOOP` from `'../../helpers/structure'` if absent, and `expectOk` from `'../../helpers/domain'`):

```ts
it('names the wall a chain would join, and where, in the form status line', async () => {
	const rig = await structureEditor(); cleanups.push(rig.unmount);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
	await settle();
	const task = rig.runtime.structureTask;
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
	const tools = rig.runtime.toolManager;
	tools.pointerDown(pointerAt(2000, 1500)); await settle();
	tools.pointerMove(pointerAt(2003, 4)); await settle();
	expect(rig.wrapper.get('.rp-structure-task').text()).toContain(tr('editor.structure.joins-perpendicular', { n: '1', m: '2' }));
	tools.pointerMove(pointerAt(1200, 4)); await settle();
	expect(rig.wrapper.get('.rp-structure-task').text()).toContain(tr('editor.structure.joins', { n: '1', m: '1.2' }));
	tools.pointerMove(pointerAt(1200, 800)); await settle();
	expect(rig.wrapper.get('.rp-structure-task').text()).toContain(tr('editor.structure.unsnapped'));
});
```

`ToolManager.pointerDown`/`pointerMove` forward to the active tool, which is how `structureLifecycle.test.ts` already drives it; never construct a second `StructureTool` here. `formatMetres` is `Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })` over metres, so 2000 mm prints `2` and 1200 mm prints `1.2`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/presentation/editor/finalOverviewPresentation.test.ts -t "names the wall"`
Expected: FAIL — the key does not exist (type error in `tr`) or the text is absent.

- [ ] **Step 3: Add the strings**

`src/presentation/i18n/locales/en/structure.ts`, after `'editor.structure.unsnapped'`:

```ts
	'editor.structure.joins': 'Joins wall {n} at {m} m',
	'editor.structure.joins-perpendicular': 'Joins wall {n} at {m} m, at a right angle',
```

and reword:

```ts
	'editor.structure.error.opening-split': 'A new wall cannot start or end inside a door, window or opening. Choose a point beside it.',
```

`src/presentation/i18n/locales/de/structure.ts`, after `'editor.structure.unsnapped'`:

```ts
	'editor.structure.joins': 'Trifft Wand {n} bei {m} m',
	'editor.structure.joins-perpendicular': 'Trifft Wand {n} bei {m} m, im rechten Winkel',
```

and reword:

```ts
	'editor.structure.error.opening-split': 'Eine neue Wand kann nicht in einer Tür, einem Fenster oder einer Öffnung beginnen oder enden. Einen Punkt daneben wählen.',
```

Run `npx vitest run tests/presentation/i18n` — the locale suites check that both languages carry every key.

- [ ] **Step 4: The form reads the pending join**

In `src/presentation/editor/structure/StructureTaskForm.vue`, add `import { useProjectStore } from '../../stores/ProjectStore';` and `const project = useProjectStore();` after `const task = …`, and replace `snapFeedback`:

```ts
const snapFeedback = computed(() => {
	const join = draft.pending;
	if (!join) return tr(draft.snapped ? 'editor.structure.snapped' : 'editor.structure.unsnapped');
	const params = { n: String(project.structure.walls.findIndex(wall => wall.id === join.wallId) + 1), m: formatMetres(join.offset) };
	return tr(join.perpendicular ? 'editor.structure.joins-perpendicular' : 'editor.structure.joins', params);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/presentation/editor/finalOverviewPresentation.test.ts tests/presentation/i18n tests/build/localeModuleSentenceCase.test.ts`
Expected: PASS. The `.vue` edit-loop hook runs ESLint on the SFC; fix what it reports before moving on.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/i18n/locales/en/structure.ts src/presentation/i18n/locales/de/structure.ts src/presentation/editor/structure/StructureTaskForm.vue tests/presentation/editor/finalOverviewPresentation.test.ts
git commit -m "feat(editor): the wall form says which wall a chain would join, and where

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Cut marks on the overlay and a pre-cut preview

**Files:**
- Modify: `src/presentation/editor/structure/WallDraftOverlay.vue`
- Modify: `src/presentation/editor/structure/StructureLayer.vue`
- Modify: `tests/presentation/editor/finalOverviewPresentation.test.ts`

**Interfaces:**
- Consumes: `draft.joins`, `draft.pending`; `wallTangent` from `Structure.ts`; `useDrawnStructure` (unchanged: Task 2 made `draftStructure` build on the cut floor, which is what it reads).
- Produces: overlay prop `cuts: readonly WallCut[]` with `export interface WallCut { readonly point: Point; readonly tangent: Point; readonly thickness: number }` exported from `WallDraftOverlay.vue`'s script; Konva node name `wall-draft-cut`.

- [ ] **Step 1: Write the failing test**

Append to `tests/presentation/editor/finalOverviewPresentation.test.ts`:

```ts
it('marks each cut a wall chain would make and previews the host already cut', async () => {
	const rig = await structureEditor(); cleanups.push(rig.unmount);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
	await settle();
	const task = rig.runtime.structureTask, stage = expectDefined(rig.stage, 'stage');
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
	const tools = rig.runtime.toolManager;
	expect(stage.find('.wall-draft-cut')).toHaveLength(0);
	expect(stage.find('.wall-body')).toHaveLength(1); // WALL_LOOP is one closed run.
	// Hovering a body: one pending mark, across the wall (vertical on the horizontal wall-a), thickness + 16 px long.
	tools.pointerMove(pointerAt(1000, 3)); await settle();
	const editor = useEditorStore(rig.pinia), zoom = editor.viewport.zoom;
	const pending = stage.find<Konva.Line>('.wall-draft-cut');
	expect(pending).toHaveLength(1);
	const [x1, y1, x2, y2] = pending[0].points();
	expect(x1).toBeCloseTo(1000); expect(x2).toBeCloseTo(1000);
	expect(Math.abs(y2 - y1)).toBeCloseTo(150 + 16 / zoom);
	// Clicking there starts the chain: the start mark stays while the cursor leaves the wall.
	tools.pointerDown(pointerAt(1000, 3)); tools.pointerMove(pointerAt(1000, 1500)); await settle();
	expect(stage.find('.wall-draft-cut')).toHaveLength(1);
	// Placing a free point then hovering wall-c: start mark + pending mark, and the preview's wall-a is two halves.
	tools.pointerDown(pointerAt(1000, 1500)); tools.pointerMove(pointerAt(1000, 2996)); await settle();
	expect(stage.find('.wall-draft-cut')).toHaveLength(2);
	// Three walls now meet at (1000, 0) — the two halves and the draft — so `wallPasses` no longer chains the loop into one run: the host is drawn cut.
	expect(stage.find('.wall-body').length).toBeGreaterThan(1);
	rig.runtime.returnToSelect(); await settle();
	expect(stage.find('.wall-draft-cut')).toHaveLength(0);
});
```

`StructureLayer.vue` draws one `wall-edge` and one `wall-body` line per run, so `.wall-body` counts runs. Keep the assertion about the host being CUT (more runs than the one loop), not about an exact number.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/presentation/editor/finalOverviewPresentation.test.ts -t "marks each cut"`
Expected: FAIL — no `.wall-draft-cut` nodes.

- [ ] **Step 3: The overlay draws cuts**

In `src/presentation/editor/structure/WallDraftOverlay.vue` `<script setup>`, extend the props and add the geometry:

```ts
export interface WallCut { readonly point: Point; readonly tangent: Point; readonly thickness: number }
const props = defineProps<{ points: readonly Point[]; cursor: Point | null; tokens: ThemeTokens; zoom: number; viewport: BoundingBox; cuts: readonly WallCut[] }>();
/** A tick across the host at the cut, a little longer than the wall is thick, in world units. */
function cutPoints(cut: WallCut): number[] {
	const length = Math.hypot(cut.tangent.x, cut.tangent.y) || 1, half = (cut.thickness + 16 / props.zoom) / 2;
	const nx = -cut.tangent.y / length * half, ny = cut.tangent.x / length * half;
	return [cut.point.x - nx, cut.point.y - ny, cut.point.x + nx, cut.point.y + ny];
}
```

`export interface` inside `<script setup>` is allowed by `vue/`'s compiler for types; if `vue-tsc` or lint refuses it, move `WallCut` to a sibling `src/presentation/editor/structure/wallCut.ts` and import it in both SFCs.

In the template, after the `wall-draft-outline` `VLine`:

```vue
		<VLine
			v-for="(cut, index) in cuts"
			:key="`cut-${index}`"
			:config="{ name: 'wall-draft-cut', points: cutPoints(cut), stroke: tokens.accent, strokeWidth: 2 / zoom, listening: false }"
		/>
```

- [ ] **Step 4: The layer computes cuts**

In `src/presentation/editor/structure/StructureLayer.vue`, change the `Structure` import to `import { samePoint, wallTangent, type Wall } from '../../../domain/spatial/Structure';`, import `type WallCut` from `./WallDraftOverlay.vue`, and add after `wallDraftPoints`:

```ts
/** Every cut the chain would make: its start and end joins and the join under the cursor, one mark per distinct point. A start or pending join names a wall of the floor; an end join may name a half that exists only in the drawn (pre-cut) structure. */
const cuts = computed<readonly WallCut[]>(() => {
	if (runtime.activeToolId.value !== 'draw-wall') return [];
	const marks = [task.draft.joins.start, task.draft.joins.end, task.draft.pending].filter((mark): mark is NonNullable<typeof mark> => mark !== null);
	return marks.flatMap(mark => {
		const wall = project.structure.walls.find(item => item.id === mark.wallId) ?? structure.value.walls.find(item => item.id === mark.wallId);
		return wall ? [{ point: mark.point, tangent: wallTangent(wall, mark.offset), thickness: wall.thickness }] : [];
	}).filter((cut, index, all) => all.findIndex(other => samePoint(other.point, cut.point)) === index);
});
```

and pass it: add `:cuts="cuts"` to the `<WallDraftOverlay …/>` element.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/presentation/editor/finalOverviewPresentation.test.ts tests/presentation/editor/structureLifecycle.test.ts tests/harness/accessibility.test.ts`
Expected: PASS. If `vue-tsc` (via `npm run check:fast`) complains that `WallDraftOverlay.vue` is mounted elsewhere without `cuts`, grep `WallDraftOverlay` under `src/` and `tests/` and pass `:cuts="[]"` at any other mount.

- [ ] **Step 6: Lint and commit**

Run: `npm run check:fast -- tests/presentation/editor`

```bash
git add src/presentation/editor/structure/WallDraftOverlay.vue src/presentation/editor/structure/StructureLayer.vue tests/presentation/editor/finalOverviewPresentation.test.ts
git commit -m "feat(editor): mark where a wall chain will cut its hosts, and preview them cut

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Coverage read for the changed files

**Files:** none modified unless a gap is found.

- [ ] **Step 1: Run coverage**

Run: `npm run test:coverage`
Expected: thresholds hold. Then read the per-file figures for the changed files:

```bash
node -e "const c=require('./coverage/coverage-final.json');for(const f of Object.keys(c).filter(k=>/wallJoin|structureDraft|StructureTool|structureTask|StructureTaskForm|WallDraftOverlay|StructureLayer/.test(k))){const s=c[f];const b=Object.values(s.b).flat();console.log(f.split(/[\\/]/).pop(),'branches',b.filter(n=>n===0).length,'of',b.length,'unhit; fns',Object.values(s.f).filter(n=>n===0).length,'unhit')}"
```

- [ ] **Step 2: Close every unhit arm in the new code**

For each unhit branch in `wallJoin.ts`, `structureDraft.ts` (`drawnOn`, `endOnWall`), `StructureTool.ts` or `structureTask.ts`, add a case to the matching test file from Tasks 1–4 that reaches it (an unreachable guard is removed instead, per CLAUDE.md). Likely arms: `perpendicularTo` with `length === 0`; `endOnWall`'s `addWallPoint` failure restoring `previous` (drive it by making the end point equal the previous point: `addWallPoint(draft, { x: 2000, y: 0 })` then `endOnWall` with the same point → `wall-dimensions`, join restored to null); the layer's `?? structure.value.walls.find` fallback (an end join on a half: Task 2's same-wall case through the rig, or hover after ending on the start wall).

- [ ] **Step 3: Commit**

```bash
git add tests
git commit -m "test(editor): reach every arm of the wall join

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Records

**Files:**
- Modify: `docs/tests/cases/Draw connected walls and openings.md` (traceability table)
- Modify: `docs/development/agent-guide-increment-history.md` (append a section)
- Modify: `docs/superpowers/specs/2026-09-12-wall-tool-join-and-split-design.md` (status line, §10)

- [ ] **Step 1: Traceability row**

Append to the table in `docs/tests/cases/Draw connected walls and openings.md`:

```md
| A chain starting or ending on a wall body cuts the host at the join (endpoint, perpendicular and Shift-ray snaps, two cuts on one wall, opening refusal, auto-finish, numeric 1 mm join, status line and cut marks) | `tests/domain/spatial/wallJoin.test.ts`, `splitWall.test.ts`, `structureDraft.test.ts`, `tests/presentation/editor/structure/StructureTool.test.ts`, `structureLifecycle.test.ts`, `finalOverviewPresentation.test.ts` |
```

- [ ] **Step 2: Increment history**

Append to `docs/development/agent-guide-increment-history.md`:

```md
## Wall joins: start and end on a wall body, 2026-09-12

**What landed.** A wall chain can END on an existing wall's body, and the wall tool's own first click
can START one there; both cut the host at the join when the chain is saved, through the same
`splitWall` the context menu's "New wall from here" already deferred to. `src/domain/spatial/wallJoin.ts`
answers where a cursor lands on a body — endpoint first (answered as null, so the draft's endpoint
snap wins and nothing is cut), then the foot of the perpendicular from the previous point, then the
nearest body point; with Shift the constrained ray is intersected with the wall so the 15° step stays
exact. The draft holds `joins.start` and `joins.end`, applied in that order by `drawnOn`, and the end
join is resolved against the floor with the start cut already made, which is what makes two cuts on
one wall name the right half without a special case. A click landing on a body with points already
placed auto-finishes. Numeric entry joins at 1 mm. The form names the join ("Joins wall 3 at 1.20 m,
at a right angle") and the overlay draws a `wall-draft-cut` tick across each host; the preview builds
on the cut floor so the host renders as two halves while drawing.

**What was refused.** An intermediate corner joining a wall (a per-point split list for a case not in
hand), a chain crossing a wall mid-segment, and a fixed `harness-shot` of the mark: the base plan-editor
harness has no structure services and the reference workspace seeds no walls, so the look was checked
by drawing in `npm run harness` at `?view=plan-editor&reference` rather than by a headless capture.

**Spec:** `docs/superpowers/specs/2026-09-12-wall-tool-join-and-split-design.md`.
```

- [ ] **Step 3: Spec status**

In the spec, set `**Status:**` to `implemented by \`docs/superpowers/plans/2026-09-12-wall-tool-join-and-split.md\`` and replace the last bullet of §10 (`One harness-shot …`) with: `- The mark's look is checked by drawing in the browser harness at \`?view=plan-editor&reference\` (Task 9 of the plan); no fixed headless shot, since neither harness fixture seeds walls AND structure services together.`

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: record the wall join increment

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Full gate and a look at it

- [ ] **Step 1: The definition of done**

Run: `npm run check`
Expected: build, lint (both linters, `--max-warnings 0`), coverage-thresholded tests and fallow all green. Fix anything red in the task that owns the file and re-run; never run this alongside another gate.

- [ ] **Step 2: Draw it in the browser**

Start the harness (via the Browser pane's `preview_start` with a `.claude/launch.json` entry for `npm run harness` on its port, or `npm run harness` in a terminal) and open `?view=plan-editor&reference&theme=light`. Add → Wall. Click four corners to draw a rectangle and Finish. Add → Wall again: click on the left wall's body (a cut tick appears, the status line names the wall), move across and hover the right wall's body (the tick follows the perpendicular foot, the status line says "at a right angle"), click. The chain saves, the tool returns to Select, and the two hosts are each two walls. Repeat once in the dark scheme. Take a screenshot of the mid-join state for the pull request.

- [ ] **Step 3: Undo**

Ctrl+Z once: the partition and both cuts disappear together. Ctrl+Y: they return.

- [ ] **Step 4: Push and open the pull request**

```bash
git push -u origin claude/wall-tool-improvements-b9fd00
```

Open a pull request against `main` titled `Join a new wall into an existing wall and split it`, whose body summarises §1 of the spec, lists what was refused (§9), links the spec and the plan, attaches the screenshot, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
