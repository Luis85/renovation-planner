# Plan Editor Asset Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place Asset library assets on a Plan as two-point spatial elements whose footprint is derived from the library, count them into materials through a `placement-count` rule, and draw, select, rotate, replace and inspect them in the Plan editor.

**Architecture:** A placement is `SpatialElement { kind: 'asset', assetId, points: [anchor, facingPoint] }` stored in the plan geometry sidecar beside objects (schema 9). Pure domain functions derive its world outline from an `AssetShape`, a 10 mm probe decides its room, and the requirement measurement counts probes per room. The editor reads shapes through one optional query into a per-leaf Pinia store; hit-testing, drawing and the Inspector read that store; a new `place-asset` tool writes through the existing `RenovationCommand`.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, vue-konva, Zod, Vitest (node + jsdom), Obsidian plugin API 1.13.

**Spec:** `docs/superpowers/specs/2026-09-10-plan-editor-asset-placement-design.md` (amended 2026-09-11). Read it before Task 1.

## Global Constraints

- Definition of done per commit: `npm run check` green. Between edits use `npm run check:fast -- <paths>`. Never run two gates at once.
- `src/presentation/editor/runtime.ts` (400/400 counted lines) and `src/presentation/editor/surface/EditorSurface.vue` (400/400) are NOT edited.
- Max 400 counted lines per `src/` file (`skipBlankLines`, `skipComments`); complexity ≤ 16; max 5 params.
- Every user-visible string goes through `tr`/`t` with a key in BOTH `en` and `de`; English is sentence case.
- No literal colours anywhere in `src/` or `styles/`; canvas colours come from `ThemeTokens`.
- Layer rule: `presentation → application → domain → core`; nothing writes to the vault outside `infrastructure/`.
- A comment that states an invariant gets a test that is watched failing first.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Room membership probe distance: `10` mm. New facing point distance: `1000` mm. Placeholder half-size: `250` mm.
- Plan geometry sidecar latest schema: `9`. Requirement note latest schema: `4`.

## Prerequisite

- [ ] **Install dependencies in this worktree** (its `node_modules` is empty; five `tests/build` files fail without it).

```bash
npm ci
```

Expected: exits 0; `node_modules/.bin/vitest` exists.

---

### Task 1: Asset element kind and placement geometry (domain)

**Files:**
- Modify: `src/domain/spatial/SpatialElement.ts`
- Create: `src/domain/spatial/assetPlacement.ts`
- Modify: `src/application/commands/spatial/sameGeometryDocument.ts`
- Create: `tests/domain/spatial/assetPlacement.test.ts`
- Modify: `tests/domain/spatialElements.test.ts`

**Interfaces:**
- Produces:
  - `SpatialElementKind` includes `'asset'`; `SpatialElement.assetId?: string`
  - `MEMBERSHIP_PROBE_MM = 10`, `FACING_POINT_MM = 1000`
  - `placementHeading(element: Pick<SpatialElement, 'points'>): number`
  - `placementPoints(anchor: Point, heading: number): readonly [Point, Point]`
  - `placedOutline(element: Pick<SpatialElement, 'points'>, shape: AssetShape): PlacedOutline` where `PlacedOutline = { footprint: readonly Point[]; clearance: readonly Point[] | null }`
  - `membershipProbe(element: Pick<SpatialElement, 'points'>): Point`
  - `backDepth(shape: AssetShape): number`

- [ ] **Step 1: Write the failing geometry tests**

Create `tests/domain/spatial/assetPlacement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { rotate } from '../../../src/core/geometry/operations';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { backDepth, membershipProbe, placedOutline, placementHeading, placementPoints } from '../../../src/domain/spatial/assetPlacement';

const rounded = (points: readonly Point[]): Point[] => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const rect = (w: number, d: number): Point[] => [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];
function shape(patch: Partial<AssetShape> = {}): AssetShape {
	return { footprint: { points: rect(1000, 600) }, footprintOrigin: 'typed', footprintPending: false, clearancePending: false, anchorPending: false, clearance: null, anchor: { x: 0, y: 0 }, facing: 0, ...patch };
}

describe('asset placement geometry', () => {
	it('translates a centred, unrotated footprint onto the anchor', () => {
		const element = { points: placementPoints({ x: 1000, y: 2000 }, 0) };
		expect(rounded(placedOutline(element, shape()).footprint)).toEqual([{ x: 500, y: 1700 }, { x: 1500, y: 1700 }, { x: 1500, y: 2300 }, { x: 500, y: 2300 }]);
		expect(placedOutline(element, shape()).clearance).toBeNull();
	});

	it('turns by the placement heading minus the asset facing, about an off-centre anchor', () => {
		// The asset faces +y and is anchored on its back edge; placed facing +x at (1000, 1000).
		const element = { points: placementPoints({ x: 1000, y: 1000 }, 0) };
		const footprint = rounded(placedOutline(element, shape({ anchor: { x: 0, y: -300 }, facing: Math.PI / 2 })).footprint);
		expect(footprint).toEqual([{ x: 1000, y: 1500 }, { x: 1000, y: 500 }, { x: 1600, y: 500 }, { x: 1600, y: 1500 }]);
	});

	it('places the clearance with the same transform as the footprint', () => {
		const element = { points: placementPoints({ x: 0, y: 0 }, Math.PI) };
		const outline = placedOutline(element, shape({ clearance: { points: rect(1200, 800) } }));
		expect(rounded(outline.clearance ?? [])).toEqual(rounded(rotate({ points: rect(1200, 800) }, Math.PI, { x: 0, y: 0 }).points));
	});

	it('derives the same footprint from rotated stored points as from rotating the derived footprint', () => {
		const element = { points: placementPoints({ x: 700, y: -300 }, 0.4) }, pivot = { x: 2500, y: 900 }, angle = 1.1;
		const rotatedPoints = { points: rotate({ points: element.points }, angle, pivot).points };
		expect(rounded(placedOutline(rotatedPoints, shape({ anchor: { x: 100, y: 50 }, facing: 0.3 })).footprint))
			.toEqual(rounded(rotate({ points: placedOutline(element, shape({ anchor: { x: 100, y: 50 }, facing: 0.3 })).footprint }, angle, pivot).points));
	});

	it('reads the heading from the two stored points and puts the facing point 1000 mm out', () => {
		const [anchor, facing] = placementPoints({ x: 10, y: 20 }, 0);
		expect(anchor).toEqual({ x: 10, y: 20 });
		expect(facing).toEqual({ x: 1010, y: 20 });
		expect(placementHeading({ points: [{ x: 0, y: 0 }, { x: 0, y: 5 }] })).toBeCloseTo(Math.PI / 2);
	});

	it('probes 10 mm in front of the anchor', () => {
		expect(rounded([membershipProbe({ points: [{ x: 0, y: 0 }, { x: 0, y: 1000 }] })])).toEqual([{ x: 0, y: 10 }]);
	});

	it('measures how far the footprint reaches behind the anchor, never negative', () => {
		expect(backDepth(shape())).toBe(500);
		expect(backDepth(shape({ facing: Math.PI / 2 }))).toBeCloseTo(300);
		expect(backDepth(shape({ anchor: { x: -500, y: 0 } }))).toBe(0);
		expect(backDepth(shape({ anchor: { x: -800, y: 0 } }))).toBe(0);
	});
});
```

- [ ] **Step 2: Add failing validation and comparison cases**

In `tests/domain/spatialElements.test.ts`, add inside the describe block:

```ts
	it('accepts an asset placement only as two distinct points carrying an asset id', () => {
		const asset: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
		expect(validSpatialElement(asset)).toBe(true);
		for (const invalid of [
			{ ...asset, points: [asset.points[0]] },
			{ ...asset, points: [...asset.points, { x: 0, y: 5 }] },
			{ ...asset, points: [asset.points[0], asset.points[0]] },
			{ ...asset, assetId: undefined },
			{ ...asset, assetId: '' },
			{ ...line, assetId: 'asset-radiator' },
			{ ...line, kind: 'object' as const, assetId: 'asset-radiator' },
		]) expect(validSpatialElement(invalid)).toBe(false);
	});
	it('treats a changed asset id as a changed geometry document', () => {
		const asset: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-a', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
		const document = { objects: [], calibration: null, structure: { ...EMPTY_STRUCTURE, elements: [asset] } };
		expect(sameGeometryDocument(document, { ...document, structure: { ...EMPTY_STRUCTURE, elements: [{ ...asset, assetId: 'asset-b' }] } })).toBe(false);
	});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run check:fast -- tests/domain/spatial/assetPlacement.test.ts tests/domain/spatialElements.test.ts`
Expected: FAIL — `assetPlacement` module not found; `'asset'` not assignable to `SpatialElementKind`.

- [ ] **Step 4: Widen the element model**

In `src/domain/spatial/SpatialElement.ts` replace the kind union, the interface and the kinds array, and add the asset arms to `validSpatialElement`:

```ts
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement' | 'stair' | 'arrow' | 'asset';
export interface SpatialElement {
	readonly id: string;
	readonly kind: SpatialElementKind;
	/** Object outlines close implicitly; linear elements keep ordered open points; an asset is `[anchor, facingPoint]`. */
	readonly points: readonly Point[];
	readonly stair?: StairOptions;
	/** Only an `'asset'` placement carries one, and it always does; its outline is derived from that asset. */
	readonly assetId?: string;
}
```

```ts
const SPATIAL_ELEMENT_KINDS: readonly SpatialElementKind[] = ['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset'];
```

```ts
export function validSpatialElement(element: SpatialElement): boolean {
	if (!element.id.startsWith('element-') || !SPATIAL_ELEMENT_KINDS.includes(element.kind)) return false;
	if (!element.points.every(point => [point.x, point.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9))) return false;
	if ((element.kind === 'asset') !== (element.assetId !== undefined)) return false;
	if (element.kind === 'stair') return element.stair !== undefined && stairPlanGeometry(element.points, element.stair) !== null;
	if (element.stair !== undefined) return false;
	if (element.kind === 'asset') return !!element.assetId && element.points.length === 2 && Math.hypot(element.points[1].x - element.points[0].x, element.points[1].y - element.points[0].y) > 0;
	if (element.kind === 'object') return element.points.length >= 3;
	if (element.kind === 'measurement' && element.points.length !== 2) return false;
	return element.points.length >= 2 && element.points.slice(1).every((point, index) => Math.hypot(point.x - element.points[index].x, point.y - element.points[index].y) > 0);
}
```

- [ ] **Step 5: Create the placement geometry module**

Create `src/domain/spatial/assetPlacement.ts`:

```ts
import type { Point } from '../../core/geometry/Point';
import type { AssetShape } from '../asset/AssetShape';
import type { SpatialElement } from './SpatialElement';

/**
 * A placement stores only `[anchor, facingPoint]`; everything drawn or measured is derived here
 * from the library's `AssetShape`, so a designer correction reaches every plan. Move, rotate and
 * group transforms map both stored points, which preserves position and heading at once.
 */
export const MEMBERSHIP_PROBE_MM = 10;
export const FACING_POINT_MM = 1000;

export interface PlacedOutline {
	readonly footprint: readonly Point[];
	readonly clearance: readonly Point[] | null;
}

type Placed = Pick<SpatialElement, 'points'>;

export function placementHeading(element: Placed): number {
	const [anchor, facing] = element.points;
	return Math.atan2(facing.y - anchor.y, facing.x - anchor.x);
}

export function placementPoints(anchor: Point, heading: number): readonly [Point, Point] {
	return [{ x: anchor.x, y: anchor.y }, { x: anchor.x + FACING_POINT_MM * Math.cos(heading), y: anchor.y + FACING_POINT_MM * Math.sin(heading) }];
}

function place(points: readonly Point[], shape: AssetShape, heading: number, at: Point): Point[] {
	const turn = heading - shape.facing, cos = Math.cos(turn), sin = Math.sin(turn);
	return points.map(point => {
		const dx = point.x - shape.anchor.x, dy = point.y - shape.anchor.y;
		return { x: at.x + dx * cos - dy * sin, y: at.y + dx * sin + dy * cos };
	});
}

/** The asset's footprint and clearance in world millimetres: turned by heading − facing about the asset anchor, moved onto the placement anchor. */
export function placedOutline(element: Placed, shape: AssetShape): PlacedOutline {
	const heading = placementHeading(element), anchor = element.points[0];
	return { footprint: place(shape.footprint.points, shape, heading, anchor), clearance: shape.clearance ? place(shape.clearance.points, shape, heading, anchor) : null };
}

/** The point that decides which room a placement belongs to: 10 mm in front of the anchor, so a wall-snapped anchor counts in the room it faces. */
export function membershipProbe(element: Placed): Point {
	const heading = placementHeading(element), anchor = element.points[0];
	return { x: anchor.x + MEMBERSHIP_PROBE_MM * Math.cos(heading), y: anchor.y + MEMBERSHIP_PROBE_MM * Math.sin(heading) };
}

/** How far the footprint reaches behind the anchor along the asset's own facing; 0 when nothing is behind it. */
export function backDepth(shape: AssetShape): number {
	const cos = Math.cos(shape.facing), sin = Math.sin(shape.facing);
	const along = shape.footprint.points.map(point => (point.x - shape.anchor.x) * cos + (point.y - shape.anchor.y) * sin);
	return Math.max(0, -Math.min(...along));
}
```

- [ ] **Step 6: Compare the asset id in geometry documents**

In `src/application/commands/spatial/sameGeometryDocument.ts`, change the element tuple (currently ending in `element.stair ? [...] : null])`) to append the asset id:

```ts
			(s.elements ?? []).toSorted((a, b) => a.id.localeCompare(b.id, 'en')).map(element => [element.id, element.kind, element.points.map(point),
				element.stair ? [element.stair.width, element.stair.treads, element.stair.direction] : null, element.assetId ?? null])] : null;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/domain/spatial/assetPlacement.test.ts tests/domain/spatialElements.test.ts tests/domain`
Expected: PASS.

- [ ] **Step 8: Watch one invariant fail**

Temporarily delete the line `if ((element.kind === 'asset') !== (element.assetId !== undefined)) return false;`, run `npm run check:fast -- tests/domain/spatialElements.test.ts`, confirm the asset validation case goes red, restore the line.

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add src/domain/spatial/SpatialElement.ts src/domain/spatial/assetPlacement.ts src/application/commands/spatial/sameGeometryDocument.ts tests/domain/spatial/assetPlacement.test.ts tests/domain/spatialElements.test.ts
git commit -m "feat(domain): asset placement element kind and derived outline

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Plan geometry sidecar schema 9

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts`
- Modify: `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- Modify: `tests/plugin/persistence-wiring.test.ts`
- Modify: `tests/application/commands/stairArrowGeometry.test.ts`
- Create: `tests/application/commands/assetPlacementGeometry.test.ts`

**Interfaces:**
- Consumes: `SpatialElement` with `kind: 'asset'`, `assetId` (Task 1); `placementPoints` (Task 1).
- Produces: `PlanGeometrySchemaV9`; `PlanGeometryDTO['schemaVersion']` includes `9`; a sidecar holding an asset element is written at 9 and read back with `assetId` intact.

- [ ] **Step 1: Write the failing round-trip test**

Create `tests/application/commands/assetPlacementGeometry.test.ts`:

```ts
import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectOk } from '../../helpers/domain';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { placementPoints } from '../../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';

const radiator: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: placementPoints({ x: 2000, y: 475 }, Math.PI / 2) };
const cabinet: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }] };

it('round-trips an asset placement at schema 9 and refuses it to a schema-8 reader as newer', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const document = { ...baseline.document, structure: { ...WALL_LOOP, elements: [radiator, cabinet] }, intended: { ...WALL_LOOP, elements: [radiator] } };
	expectOk(await rig.geometry.write(rig.plan.id, document, baseline.version));
	const saved = expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id));
	expect(saved.document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(9);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 8));
	expect(() => older.migrateToLatest('plan-geometry', dto, 9)).toThrow('newer than this build supports');
});

it('writes the lowest schema that holds the content once the last asset is gone', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...WALL_LOOP, elements: [cabinet] } }, baseline.version));
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(4);
	expect(PLAN_GEOMETRY_MIGRATIONS.at(-1)?.migrate({ schemaVersion: 8, revision: 2 })).toEqual({ schemaVersion: 9, revision: 2 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run check:fast -- tests/application/commands/assetPlacementGeometry.test.ts`
Expected: FAIL — the write refuses (`plan-geometry.schema-invalid` or the element enum), or `schemaVersion` is 8.

- [ ] **Step 3: Declare schema 9**

In `src/infrastructure/persistence/dto/planGeometry.ts`, drop `export` from `PlanGeometrySchemaV8` (its only importer is `PlanGeometryStore.ts`, which moves to V9 below), and append after it:

```ts
const SpatialElementSchemaV9 = z.object({
	id: z.string().startsWith('element-'), kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset']),
	points: z.array(SpatialPointSchema), stair: StairOptionsSchema.optional(), assetId: z.string().min(1).optional(),
}).refine(element => element.kind === 'stair' ? element.stair !== undefined : element.stair === undefined)
	.refine(element => (element.kind === 'asset') === (element.assetId !== undefined), { message: 'An asset placement, and only an asset placement, names its asset.' });
const StructureSchemaV9 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV9).optional() });
export const PlanGeometrySchemaV9 = PlanGeometrySchemaV8.extend({ schemaVersion: z.literal(9), structure: StructureSchemaV9.optional(), intended: StructureSchemaV9.optional() });
```

Then replace the union and DTO lines:

```ts
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV9>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };
```

- [ ] **Step 4: Read and write at 9**

In `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts`:

```ts
import { PlanGeometrySchema, PlanGeometrySchemaV9 } from '../../persistence/dto/planGeometry';
```

First line of `writtenSchema`:

```ts
	if ([dto.structure, dto.intended].some(structure => structure?.elements?.some(element => element.kind === 'asset'))) return 9;
```

In `readUnlocked`:

```ts
		const validated = PlanGeometrySchemaV9.safeParse(migrated);
```

- [ ] **Step 5: Append the migration**

In `plan-geometry.migrations.ts`, append after the 7 → 8 step:

```ts
}, {
	fromVersion: 8, toVersion: 9,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 9 } : input,
}];
```

- [ ] **Step 6: Move the two version pins**

`tests/plugin/persistence-wiring.test.ts`: `'plan-geometry': 8,` → `'plan-geometry': 9,`.

`tests/application/commands/stairArrowGeometry.test.ts`, last line of the third test:

```ts
	expect(expectDefined(PLAN_GEOMETRY_MIGRATIONS.find(step => step.toVersion === 8), 'schema8 step').migrate({ schemaVersion: 7, revision: 3 })).toEqual({ schemaVersion: 8, revision: 3 });
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/application/commands tests/plugin/persistence-wiring.test.ts tests/infrastructure`
Expected: PASS.

- [ ] **Step 8: Gate and commit**

```bash
npm run check
git add src/infrastructure/persistence/dto/planGeometry.ts src/infrastructure/obsidian/repositories/PlanGeometryStore.ts src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts tests/plugin/persistence-wiring.test.ts tests/application/commands/stairArrowGeometry.test.ts tests/application/commands/assetPlacementGeometry.test.ts
git commit -m "feat(persistence): plan geometry sidecar schema 9 for asset placements

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The `placement-count` quantity rule and requirement schema 4

**Files:**
- Modify: `src/domain/requirement/RequirementSource.ts`
- Modify: `src/application/event-handlers/requirement/onPlanningChanged.ts:22`
- Modify: `src/application/commands/renovation/materialPlanning.ts:70`
- Modify: `src/application/commands/renovation/planningLinks.ts:23`
- Modify: `src/application/commands/requirement/contextualFigures.ts:16`
- Modify: `src/application/queries/buildRequirementRow.ts:314`
- Modify: `src/infrastructure/obsidian/repositories/planningReferentialGuard.ts:32`
- Modify: `src/infrastructure/persistence/dto/requirementFrontmatter.ts`
- Modify: `src/infrastructure/persistence/mappers/requirementMapper.ts`
- Modify: `src/infrastructure/persistence/migration/entities/requirement/requirement.migrations.ts`
- Modify: `src/infrastructure/obsidian/repositories/digest.ts`, `tests/infrastructure/obsidian/repositories/digest.test.ts`
- Modify: `src/presentation/i18n/locales/en/planning.ts`, `src/presentation/i18n/locales/de/planning.ts`
- Create: `tests/domain/placementQuantities.test.ts`
- Modify: `tests/infrastructure/persistence/elementVersions.test.ts`, `tests/plugin/persistence-wiring.test.ts`

**Interfaces:**
- Consumes: `membershipProbe` (Task 1).
- Produces: `QUANTITY_RULES` includes `'placement-count'`; `sourceMeasurement(source, roomId, geometry, unit, assetId?: string)`.

- [ ] **Step 1: Write the failing rule test**

Create `tests/domain/placementQuantities.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sourceMeasurement, type QuantityGeometry, type RequirementSource } from '../../src/domain/requirement/RequirementSource';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import { placementPoints } from '../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../src/domain/spatial/SpatialElement';
import { expectOk } from '../helpers/domain';

const source: RequirementSource = { planId: 'plan', targetId: 'room-west', workId: '', outcomeId: '', state: 'current', rule: 'placement-count', manual: '0', coverage: '1', lot: '', minimum: '' };
const west = { id: 'room-west', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] };
const east = { id: 'room-east', points: [{ x: 4000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 4000, y: 3000 }] };
const placed = (id: string, assetId: string, x: number, y: number, heading: number): SpatialElement => ({ id, kind: 'asset', assetId, points: placementPoints({ x, y }, heading) });
// Both anchors sit exactly on the shared wall face x = 4000; one faces west, one faces east.
const elements = [placed('element-a', 'asset-radiator', 1000, 1000, 0), placed('element-b', 'asset-radiator', 4000, 1500, Math.PI), placed('element-c', 'asset-radiator', 4000, 2000, 0), placed('element-d', 'asset-sink', 2000, 2000, 0)];
const geometry: QuantityGeometry = { objects: [west, east], structure: { ...EMPTY_STRUCTURE, elements } };

describe('placement-count', () => {
	it('counts this asset\'s placements whose probe lies in the room, a shared-wall anchor only in the room it faces', () => {
		expect(expectOk(sourceMeasurement(source, 'room-west', geometry, 'piece', 'asset-radiator')).toString()).toBe('2');
		expect(expectOk(sourceMeasurement({ ...source, targetId: 'room-east' }, 'room-east', geometry, 'piece', 'asset-radiator')).toString()).toBe('1');
		expect(expectOk(sourceMeasurement(source, 'room-west', geometry, 'piece', 'asset-sink')).toString()).toBe('1');
	});
	it('answers zero rather than refusing when nothing is placed', () => {
		expect(expectOk(sourceMeasurement(source, 'room-west', { ...geometry, structure: EMPTY_STRUCTURE }, 'piece', 'asset-radiator')).toString()).toBe('0');
	});
	it('reads the intended structure only for an intended source', () => {
		const intended = { ...EMPTY_STRUCTURE, elements: [elements[0]] };
		expect(expectOk(sourceMeasurement({ ...source, state: 'intended' }, 'room-west', { ...geometry, intended }, 'piece', 'asset-radiator')).toString()).toBe('1');
		expect(expectOk(sourceMeasurement(source, 'room-west', { ...geometry, intended }, 'piece', 'asset-radiator')).toString()).toBe('2');
	});
	it('refuses a missing asset id, a non-piece unit, a missing room and a target that is not the room', () => {
		expect(sourceMeasurement(source, 'room-west', geometry, 'piece').ok).toBe(false);
		expect(sourceMeasurement(source, 'room-west', geometry, 'm2', 'asset-radiator').ok).toBe(false);
		expect(sourceMeasurement(source, 'room-gone', geometry, 'piece', 'asset-radiator').ok).toBe(false);
		expect(sourceMeasurement({ ...source, targetId: 'room-east' }, 'room-west', geometry, 'piece', 'asset-radiator').ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run check:fast -- tests/domain/placementQuantities.test.ts`
Expected: FAIL — `'placement-count'` is not assignable to the rule union.

- [ ] **Step 3: Implement the rule**

In `src/domain/requirement/RequirementSource.ts`:

```ts
import { area, contains, perimeter } from '../../core/geometry/operations';
import { membershipProbe } from '../spatial/assetPlacement';
```

```ts
export const QUANTITY_RULES = ['room-area', 'room-perimeter', 'wall-gross', 'wall-net', 'wall-length', 'opening-area', 'element-length', 'object-area', 'count', 'placement-count', 'manual'] as const;
```

Add above `sourceMeasurement`:

```ts
/** How many placements of `assetId` probe inside the room, in the source's state; zero is an answer, a missing room is not. */
function placementCount(source: RequirementSource, roomId: string, geometry: QuantityGeometry, assetId: string | undefined): number | null {
	const room = geometry.objects.find(item => item.id === roomId);
	if (!room || source.targetId !== roomId || !assetId) return null;
	const structure = (source.state === 'intended' ? geometry.intended ?? geometry.structure : geometry.structure) ?? EMPTY_STRUCTURE;
	return (structure.elements ?? []).filter(element => {
		if (element.kind !== 'asset' || element.assetId !== assetId) return false;
		const inside = contains(room, membershipProbe(element));
		return inside.ok && inside.value;
	}).length;
}
```

Replace `sourceMeasurement`:

```ts
/** Raw world measurement for the existing quantity engine; no synthetic room outline. */
export function sourceMeasurement(source: RequirementSource, roomId: string, geometry: QuantityGeometry, unit: MeasurementUnit, assetId?: string) {
	if (!validRequirementSource(source)) return err(sourceError());
	if (source.rule === 'placement-count') {
		const counted = placementCount(source, roomId, geometry, assetId);
		return counted !== null && unit === 'piece' ? ok(new Decimal(counted)) : err(sourceError());
	}
	if (source.rule === 'manual') {
		const factor = unit === 'm' ? 1000 : unit === 'm2' ? 1_000_000 : 1;
		if (!['m', 'm2', 'piece'].includes(unit) || !measurement({ ...source, rule: 'count' }, roomId, geometry)) return err(sourceError());
		return ok(new Decimal(source.manual).mul(factor));
	}
	const result = measurement(source, roomId, geometry);
	return result && result.unit === unit && Number.isFinite(result.raw) && result.raw >= 0 ? ok(new Decimal(result.raw)) : err(sourceError());
}
```

- [ ] **Step 4: Pass the asset id at every call site**

Each call gains the requirement's asset id as the fifth argument (all six sites already hold it):

- `onPlanningChanged.ts:22`: `sourceMeasurement(entity.source, entity.origin.zoneId, geometry.value.document, entity.unit, entity.assetId)`
- `materialPlanning.ts:70`: `sourceMeasurement(input.source, input.roomId, baseline.geometry.document, selected.asset.unit, input.assetId)`
- `planningLinks.ts:23`: `sourceMeasurement(source, requirement.origin.zoneId, baseline.geometry.document, requirement.unit, requirement.assetId)`
- `contextualFigures.ts:16`: `sourceMeasurement(source, requirement.origin.zoneId, geometry.value.document, asset.unit, requirement.assetId)`
- `buildRequirementRow.ts:314`: `sourceMeasurement(requirement.source, requirement.origin.zoneId, geometry.value.document, requirement.unit, requirement.assetId)`
- `planningReferentialGuard.ts:32`, both calls: append `, requirement.assetId`.

Then verify nothing was missed:

Run: `git grep -n "sourceMeasurement(" -- src`
Expected: every `src/` call except the definition passes five arguments.

- [ ] **Step 5: Label the rule**

`src/presentation/i18n/locales/en/planning.ts`, after `"planning.rule.count"`:

```ts
	"planning.rule.placement-count": "Placements of this asset in the room",
```

`src/presentation/i18n/locales/de/planning.ts`, after `"planning.rule.count"`:

```ts
	"planning.rule.placement-count": "Platzierungen dieses Objekts im Raum",
```

- [ ] **Step 6: Write the failing schema-4 test**

In `tests/infrastructure/persistence/elementVersions.test.ts`, add:

```ts
	it('writes a placement-count source at schema 4 and refuses it to a schema-3 reader as newer', () => {
		const requirement = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'zone', zoneId: createZoneId() },
			source: { planId: 'plan', targetId: 'room', workId: '', outcomeId: '', state: 'current', rule: 'placement-count', manual: '0', coverage: '1', lot: '', minimum: '' } });
		const dto = requirementToPersistence(requirement, 2);
		expect(dto['schema-version']).toBe(4); expect(expectOk(requirementFromPersistence(dto)).source?.rule).toBe('placement-count');
		const old = new MigrationRunner(); old.registerAll('requirement', REQUIREMENT_MIGRATIONS.filter(step => step.toVersion <= 3));
		expect(() => old.migrateToLatest('requirement', dto, 4)).toThrow('newer than this build supports');
	});
```

In `tests/plugin/persistence-wiring.test.ts`: `requirement: 3,` → `requirement: 4,`.

Run: `npm run check:fast -- tests/infrastructure/persistence/elementVersions.test.ts`
Expected: FAIL — `schema-version` is 2.

- [ ] **Step 7: Implement schema 4**

`src/infrastructure/persistence/dto/requirementFrontmatter.ts`:

```ts
const RequirementFrontmatterSchemaV3 = RequirementFrontmatterSchemaV2.extend({ 'schema-version': z.literal(3) });
export const RequirementFrontmatterSchemaV4 = RequirementFrontmatterSchemaV3.extend({ 'schema-version': z.literal(4) });
export const RequirementFrontmatterSchema = z.union([RequirementFrontmatterSchemaV1, RequirementFrontmatterSchemaV2, RequirementFrontmatterSchemaV3, RequirementFrontmatterSchemaV4]);
```

`src/infrastructure/obsidian/repositories/digest.ts` and `tests/infrastructure/obsidian/repositories/digest.test.ts`: replace every `RequirementFrontmatterSchemaV3` with `RequirementFrontmatterSchemaV4` (import and table entry).

`src/infrastructure/persistence/mappers/requirementMapper.ts`: add above `requirementToPersistence`:

```ts
/** The lowest schema that holds this source: an older build refuses a rule it does not know as newer, never as corrupt. */
function requirementSchemaVersion(source: Requirement['source']): 1 | 2 | 3 | 4 {
	if (!source) return 1;
	if (source.rule === 'placement-count') return 4;
	return source.rule === 'element-length' || source.rule === 'object-area' ? 3 : 2;
}
```

and in the returned object:

```ts
		'schema-version': requirementSchemaVersion(requirement.source),
```

`requirement.migrations.ts`:

```ts
export const REQUIREMENT_MIGRATIONS = [1, 2, 3].map(version => discriminatorMigration(version, version + 1));
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/domain tests/infrastructure tests/application tests/plugin/persistence-wiring.test.ts`
Expected: PASS.

- [ ] **Step 9: Watch the probe fail**

In `placementCount`, temporarily replace `membershipProbe(element)` with `element.points[0]`; run `npm run check:fast -- tests/domain/placementQuantities.test.ts`; confirm the shared-wall case goes red; restore.

- [ ] **Step 10: Gate and commit**

```bash
npm run check
git add -A src tests
git commit -m "feat(requirements): placement-count quantity rule and requirement schema 4

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The editor reads asset shapes

**Files:**
- Create: `src/presentation/read-models/assetShapes.ts`
- Modify: `src/presentation/read-models/planEditorQueries.ts`
- Modify: `src/plugin/composition-root.ts` (the `createPlanEditorQueries({ … })` call)
- Create: `src/presentation/stores/AssetShapeStore.ts`
- Create: `src/presentation/editor/elements/assetShapeLoader.ts`
- Modify: `src/presentation/editor/elements/spatialEditing.ts`
- Modify: `tests/harness/referenceWorkspace.ts`
- Create: `tests/helpers/assetPlacement.ts`
- Create: `tests/presentation/read-models/assetShapes.test.ts`
- Create: `tests/presentation/editor/assetShapeLoader.test.ts`

**Interfaces:**
- Consumes: `AssetDesignDto`, `AssetDesignError`, `GetAssetDesignQuery` (existing); `placementPoints` (Task 1).
- Produces:
  - `type AssetShapeAnswer = { kind: 'placeable'; name: string; shape: AssetShape; dimensions: Dimensions } | { kind: 'no-shape' | 'unscaled'; name: string } | { kind: 'missing' | 'unreadable' }`
  - `assetShapeAnswer(found: Result<AssetDesignDto, AssetDesignError>): AssetShapeAnswer`
  - `readAssetShapes(get: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>, ids: readonly string[]): Promise<ReadonlyMap<string, AssetShapeAnswer>>`
  - `PlanEditorQueryServices.assetShapes?(ids: readonly string[]): Promise<ReadonlyMap<string, AssetShapeAnswer>>`
  - `useAssetShapeStore()` → `{ answers: ShallowRef<ReadonlyMap<string, AssetShapeAnswer>>; set(next): void; answerFor(id: string): AssetShapeAnswer | null; shapeOf(id: string): AssetShape | null }`
  - `watchAssetShapes(context: PlanEditorContext): void`
  - Test helper `assetPlacementRig(navigation?)` → renovation rig plus `saveAsset(name: string, designed?: boolean): Promise<Asset>` and `place(assetId: string, anchor: Point, heading?: number, name?: string): Promise<string>`

- [ ] **Step 1: Write the failing answer test**

Create `tests/presentation/read-models/assetShapes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { expectOk } from '../../helpers/domain';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { assetShapeAnswer, readAssetShapes } from '../../../src/presentation/read-models/assetShapes';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';

const shape = expectOk(shapeFromDimensions(800, 600));
const dto = (patch: Partial<AssetDesignDto>): AssetDesignDto => ({ assetId: 'asset-a', name: 'Radiator', height: null, background: null, calibration: null, shape, dimensions: { width: 800, depth: 600 }, clearanceExtent: null, dimensionsUnscaled: false, noteVersion: { revision: 1 }, geometryVersion: { revision: 1 }, ...patch } as AssetDesignDto);

describe('asset shape answers', () => {
	it('maps every design read onto what placing needs', () => {
		expect(assetShapeAnswer(ok(dto({})))).toEqual({ kind: 'placeable', name: 'Radiator', shape, dimensions: { width: 800, depth: 600 } });
		expect(assetShapeAnswer(ok(dto({ shape: null, dimensions: null })))).toEqual({ kind: 'no-shape', name: 'Radiator' });
		expect(assetShapeAnswer(ok(dto({ shape: { ...shape, footprintPending: true } })))).toEqual({ kind: 'unscaled', name: 'Radiator' });
		expect(assetShapeAnswer(err({ category: 'Reference', code: 'asset.not-found', message: '' }))).toEqual({ kind: 'missing' });
		expect(assetShapeAnswer(err({ category: 'Persistence', code: 'asset-geometry.corrupt', message: '' }))).toEqual({ kind: 'unreadable' });
	});
	it('reads each distinct id once and answers every requested id', async () => {
		const execute = vi.fn(async () => ok(dto({})));
		const answers = await readAssetShapes({ execute }, ['asset-a', 'asset-b', 'asset-a']);
		expect(execute).toHaveBeenCalledTimes(2);
		expect([...answers.keys()]).toEqual(['asset-a', 'asset-b']);
	});
});
```

Run: `npm run check:fast -- tests/presentation/read-models/assetShapes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the answers**

Create `src/presentation/read-models/assetShapes.ts`:

```ts
import type { Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetShape, Dimensions } from '../../domain/asset/AssetShape';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { Query } from '../../application/queries/Query';

/**
 * What placing an asset needs to know about it, settled PER ASSET: one unreadable sidecar makes
 * one placement a placeholder and leaves the rest of the floor drawn.
 */
export type AssetShapeAnswer =
	| { readonly kind: 'placeable'; readonly name: string; readonly shape: AssetShape; readonly dimensions: Dimensions }
	| { readonly kind: 'no-shape' | 'unscaled'; readonly name: string }
	| { readonly kind: 'missing' | 'unreadable' };

export function assetShapeAnswer(found: Result<AssetDesignDto, AssetDesignError>): AssetShapeAnswer {
	if (!found.ok) return { kind: found.error.code === 'asset.not-found' ? 'missing' : 'unreadable' };
	const { name, shape, dimensions } = found.value;
	if (shape === null || dimensions === null) return { kind: 'no-shape', name };
	if (shape.footprintPending) return { kind: 'unscaled', name };
	return { kind: 'placeable', name, shape, dimensions };
}

export async function readAssetShapes(get: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>, ids: readonly string[]): Promise<ReadonlyMap<string, AssetShapeAnswer>> {
	const unique = [...new Set(ids)];
	return new Map(await Promise.all(unique.map(async id => [id, assetShapeAnswer(await get.execute(id as AssetId))] as const)));
}
```

Run: `npm run check:fast -- tests/presentation/read-models/assetShapes.test.ts`
Expected: PASS.

- [ ] **Step 3: Expose the query**

In `src/presentation/read-models/planEditorQueries.ts`:

```ts
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { AssetId } from '../../domain/asset/AssetId';
import { readAssetShapes, type AssetShapeAnswer } from './assetShapes';
```

Add to `PlanEditorQueryServices`:

```ts
	/**
	 * The shapes placements are drawn and measured from, per asset. Optional for the reason the
	 * slice-10 members are: a rig with no asset library answers nothing, and every placement is
	 * then drawn as a placeholder rather than hidden.
	 */
	assetShapes?(assetIds: readonly string[]): Promise<ReadonlyMap<string, AssetShapeAnswer>>;
```

Add to the `createPlanEditorQueries` deps type:

```ts
	readonly getAssetDesign?: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>;
```

At the start of the function body, before `return {`:

```ts
	const getAssetDesign = queries.getAssetDesign;
```

As the first member of the returned object:

```ts
		...(getAssetDesign ? { assetShapes: (ids: readonly string[]) => readAssetShapes(getAssetDesign, ids) } : {}),
```

In `src/plugin/composition-root.ts`, inside `createPlanEditorQueries({`:

```ts
				getAssetDesign: guarded.assetDesign.get,
```

- [ ] **Step 4: Create the store and the loader**

Create `src/presentation/stores/AssetShapeStore.ts`:

```ts
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import type { AssetShape } from '../../domain/asset/AssetShape';
import type { AssetShapeAnswer } from '../read-models/assetShapes';

/** The shapes of the assets this leaf's placements name; `null` from `answerFor` means not read yet. */
export const useAssetShapeStore = defineStore('asset-shapes', () => {
	const answers = shallowRef<ReadonlyMap<string, AssetShapeAnswer>>(new Map());
	function set(next: ReadonlyMap<string, AssetShapeAnswer>): void { answers.value = next; }
	function answerFor(assetId: string): AssetShapeAnswer | null { return answers.value.get(assetId) ?? null; }
	function shapeOf(assetId: string): AssetShape | null {
		const answer = answers.value.get(assetId);
		return answer?.kind === 'placeable' ? answer.shape : null;
	}
	return { answers, set, answerFor, shapeOf };
});
```

Create `src/presentation/editor/elements/assetShapeLoader.ts`:

```ts
import { computed, onScopeDispose, watch } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';

/** Re-read shapes whenever the set of placed assets changes or the catalogue does; the latest read wins. */
export function watchAssetShapes(context: PlanEditorContext): void {
	const project = useProjectStore(), shapes = useAssetShapeStore();
	const ids = computed(() => [...new Set([project.structure, project.intended].flatMap(structure => structure?.elements ?? [])
		.flatMap(element => element.kind === 'asset' && element.assetId ? [element.assetId] : []))].toSorted());
	let ticket = 0;
	async function load(): Promise<void> {
		const read = context.queries.assetShapes, mine = ++ticket;
		if (!read) return;
		const answers = await read(ids.value);
		if (mine === ticket) shapes.set(answers);
	}
	// Detached: `readAssetShapes` settles every id and the guarded query maps throws to results, so nothing rejects.
	watch(() => ids.value.join('\n'), () => { void load(); }, { immediate: true });
	onScopeDispose(context.onCatalogueChanged(() => { void load(); }));
}
```

In `src/presentation/editor/elements/spatialEditing.ts`, import `watchAssetShapes` and call it as the first line of `createSpatialEditing`:

```ts
	watchAssetShapes(context);
```

- [ ] **Step 5: Answer shapes in the reference workspace and add the rig helper**

In `tests/harness/referenceWorkspace.ts`:

```ts
import { GetAssetDesignQuery } from '../../src/application/queries/GetAssetDesign';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { readAssetShapes } from '../../src/presentation/read-models/assetShapes';
```

Inside `queries: { ...base.queries,`:

```ts
			assetShapes: async ids => { await ready; return readAssetShapes(new GetAssetDesignQuery(stack.assets, new ObsidianAssetGeometrySidecar(stack.assetGeometry)), ids); },
```

Create `tests/helpers/assetPlacement.ts`:

```ts
import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import type { Point } from '../../src/core/geometry/Point';
import type { Asset } from '../../src/domain/asset/Asset';
import { shapeFromDimensions } from '../../src/domain/asset/AssetShape';
import { placementPoints } from '../../src/domain/spatial/assetPlacement';
import { createEntityId } from '../../src/core/identity/generateId';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import { renovationEditor } from './renovationEditor';
import { makeAsset } from './entities';
import { expectOk } from './domain';
import { settle } from './editor';

/** A Studio room inside `WALL_LOOP` (0..4000 × 0..3000), real repositories, and doors to save assets and place them. */
export async function assetPlacementRig(navigation?: PlanEditorContext['navigation']) {
	const rig = await renovationEditor(true, navigation);
	const sidecar = new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry);
	async function saveAsset(name: string, designed = true): Promise<Asset> {
		const asset = makeAsset({ name, unit: 'piece' });
		expectOk(await rig.stack.assets.save(asset, 'absent'));
		if (designed) expectOk(await sidecar.write(asset.id, { calibration: null, shape: expectOk(shapeFromDimensions(800, 600)) }));
		return asset;
	}
	async function place(assetId: string, anchor: Point, heading = 0, name = 'Radiator'): Promise<string> {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id)), id = createEntityId('element');
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { id, kind: 'asset', assetId, points: placementPoints(anchor, heading), name }), rig.runtime.structureTask.ledger)));
		await settle();
		return id;
	}
	return { ...rig, saveAsset, place };
}
```

- [ ] **Step 6: Write and run the loader test**

Create `tests/presentation/editor/assetShapeLoader.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settleUntil } from '../../helpers/editor';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('loads the shape of every placed asset and answers missing for a deleted one', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.place('asset-gone', { x: 2000, y: 1000 }, 0, 'Old boiler');
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answers.size === 2, 'asset shapes');
	expect(shapes.answerFor(radiator.id)?.kind).toBe('placeable');
	expect(shapes.shapeOf(radiator.id)?.footprint.points).toHaveLength(4);
	expect(shapes.answerFor('asset-gone')).toEqual({ kind: 'missing' });
});
```

Run: `npm run check:fast -- tests/presentation/editor/assetShapeLoader.test.ts tests/presentation/read-models`
Expected: PASS.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add -A src tests
git commit -m "feat(editor): read asset shapes for placements into a per-leaf store

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Hit-testing, rotation, overlays and the Assets layer row

**Files:**
- Create: `src/presentation/editor/elements/elementFootprint.ts`
- Modify: `src/presentation/editor/tools/select-tool.ts` (`SpatialObjectCandidate`)
- Modify: `src/presentation/editor/structure/structureCandidates.ts`
- Modify: `src/presentation/editor/selection/canvasCandidates.ts`
- Modify: `src/presentation/editor/tools/registerEditorTools.ts` (the `spatialObjects` line)
- Modify: `src/presentation/editor/layers/InteractionLayer.vue`
- Modify: `src/presentation/editor/selection/resolveSelectionTarget.ts` (`priority`)
- Modify: `src/presentation/editor/structure/structureRecords.ts`
- Modify: `src/presentation/editor/planning/MaterialMarkers.vue`, `src/presentation/editor/planning/CostWorkHighlight.vue`, `src/presentation/editor/renovation/RenovationLayer.vue`
- Modify: `src/presentation/editor/elements/objectRotation.ts`, `src/presentation/editor/elements/rotationActions.ts`
- Modify: `src/presentation/editor/shell/zoneTypeLabel.ts`
- Modify: `src/presentation/editor/layers/layerCatalogue.ts`, `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Create: `src/presentation/i18n/locales/en/assetPlacement.ts`, `src/presentation/i18n/locales/de/assetPlacement.ts`
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`
- Create: `tests/presentation/editor/elements/assetCandidates.test.ts`
- Modify: `tests/presentation/editor/layers/layerCatalogue.test.ts`, `tests/presentation/editor/shell/layerList.test.ts`, `tests/presentation/editor/shell.test.ts`

**Interfaces:**
- Consumes: `placedOutline` (Task 1); `useAssetShapeStore` (Task 4).
- Produces:
  - `type ShapeLookup = (assetId: string) => AssetShape | null`; `NO_SHAPES: ShapeLookup`; `PLACEHOLDER_HALF_MM = 250`
  - `elementFootprint(element: SpatialElement, shapeOf: ShapeLookup): readonly Point[]`
  - `structureCandidates(structure: Structure, shapeOf?: ShapeLookup)`
  - `canvasCandidates(zones, structure, visible: { zone: boolean; architecture: boolean; asset: boolean }, shapeOf?: ShapeLookup)`
  - `structureRecords(structure, planId, metadata?, shapeOf?: ShapeLookup)`
  - `LayerEntryId` includes `'assets'`; `LayerToggles.assets: LayerToggle`
  - i18n keys `editor.add.asset.label`, `editor.add.asset.description`, `editor.layer.assets`

- [ ] **Step 1: Create the i18n module**

Create `src/presentation/i18n/locales/en/assetPlacement.ts`:

```ts
export const assetPlacementEn = {
	'editor.add.asset.label': 'Asset',
	'editor.add.asset.description': 'Place something from your asset library',
	'editor.layer.assets': 'Assets',
};
```

Create `src/presentation/i18n/locales/de/assetPlacement.ts`:

```ts
import type { assetPlacementEn } from '../en/assetPlacement';
export const assetPlacementDe: Record<keyof typeof assetPlacementEn, string> = {
	'editor.add.asset.label': 'Bibliotheksobjekt',
	'editor.add.asset.description': 'Etwas aus Ihrer Objektbibliothek platzieren',
	'editor.layer.assets': 'Bibliotheksobjekte',
};
```

In `en/editor.ts` import `assetPlacementEn` and add `...assetPlacementEn,` next to `...objectEn,`; in `de/editor.ts` import `assetPlacementDe` and add `...assetPlacementDe,` next to `...objectDe,`.

- [ ] **Step 2: Write the failing candidate tests**

Create `tests/presentation/editor/elements/assetCandidates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expectOk } from '../../../helpers/domain';
import { WALL_LOOP } from '../../../helpers/structure';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementPoints } from '../../../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { elementFootprint, NO_SHAPES } from '../../../../src/presentation/editor/elements/elementFootprint';
import { canvasCandidates } from '../../../../src/presentation/editor/selection/canvasCandidates';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';
import { rotationPivot } from '../../../../src/presentation/editor/elements/objectRotation';
import { structureRecords } from '../../../../src/presentation/editor/structure/structureRecords';

const shape = expectOk(shapeFromDimensions(800, 600));
const radiator: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: placementPoints({ x: 1000, y: 1000 }, 0) };
const shapeOf = (id: string) => id === 'asset-radiator' ? shape : null;
const structure = { ...WALL_LOOP, elements: [radiator] };
const room = { id: 'room', points: WALL_LOOP.walls.map(wall => wall.start) };

describe('asset placements as canvas candidates', () => {
	it('uses the derived footprint, or a 500 mm placeholder square when the shape is unknown', () => {
		expect(elementFootprint(radiator, shapeOf)).toEqual([{ x: 600, y: 700 }, { x: 1400, y: 700 }, { x: 1400, y: 1300 }, { x: 600, y: 1300 }]);
		expect(elementFootprint(radiator, NO_SHAPES)).toEqual([{ x: 750, y: 750 }, { x: 1250, y: 750 }, { x: 1250, y: 1250 }, { x: 750, y: 1250 }]);
	});
	it('admits assets through their own layer and walls through theirs', () => {
		const ids = (visible: { zone: boolean; architecture: boolean; asset: boolean }) => canvasCandidates([room], structure, visible, shapeOf).map(item => item.id);
		expect(ids({ zone: true, architecture: false, asset: true })).toEqual(['room', 'element-radiator']);
		expect(ids({ zone: true, architecture: true, asset: false })).toEqual(['room', 'wall-a', 'wall-b', 'wall-c', 'wall-d']);
	});
	it('selects a placement over the room it stands in by clicking inside its footprint', () => {
		const candidates = canvasCandidates([room], structure, { zone: true, architecture: true, asset: true }, shapeOf);
		expect(resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x: 1350, y: 1250 }, handleToleranceWorld: 0 })?.id).toBe('element-radiator');
	});
	it('rotates a placement about its anchor', () => {
		expect(rotationPivot({ id: radiator.id, kind: 'asset', points: radiator.points })).toEqual({ x: 1000, y: 1000 });
	});
	it('measures a placement record by its footprint area', () => {
		expect(structureRecords(structure, 'plan', [], shapeOf).find(item => item.id === radiator.id)?.areaMm2).toBe(480000);
	});
});
```

Run: `npm run check:fast -- tests/presentation/editor/elements/assetCandidates.test.ts`
Expected: FAIL — `elementFootprint` module not found.

- [ ] **Step 3: Create the footprint helper**

Create `src/presentation/editor/elements/elementFootprint.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { placedOutline } from '../../../domain/spatial/assetPlacement';
import { spatialElementFootprint } from '../../../domain/spatial/stairGeometry';

export type ShapeLookup = (assetId: string) => AssetShape | null;
export const NO_SHAPES: ShapeLookup = () => null;
/** Half the side of the square a placement without a readable shape is drawn and hit as. */
export const PLACEHOLDER_HALF_MM = 250;

/** What the canvas hits and outlines: an asset's derived footprint, or its placeholder square; every other kind as the domain derives it. */
export function elementFootprint(element: SpatialElement, shapeOf: ShapeLookup): readonly Point[] {
	if (element.kind !== 'asset') return spatialElementFootprint(element);
	const shape = element.assetId ? shapeOf(element.assetId) : null;
	if (shape) return placedOutline(element, shape).footprint;
	const { x, y } = element.points[0], half = PLACEHOLDER_HALF_MM;
	return [{ x: x - half, y: y - half }, { x: x + half, y: y - half }, { x: x + half, y: y + half }, { x: x - half, y: y + half }];
}
```

- [ ] **Step 4: Thread shapes through candidates and records**

`src/presentation/editor/tools/select-tool.ts`, add to `SpatialObjectCandidate`:

```ts
	readonly assetId?: string;
```

`src/presentation/editor/structure/structureCandidates.ts`:

```ts
import { elementFootprint, NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';
export function structureCandidates(structure: Structure, shapeOf: ShapeLookup = NO_SHAPES): SpatialObjectCandidate[] {
	return [
		...(structure.elements ?? []).map(element => ({ ...element, ...(element.kind === 'stair' || element.kind === 'asset' ? { hitPoints: elementFootprint(element, shapeOf) } : {}) })),
```

(the walls and openings lines are unchanged; drop the now-unused `spatialElementFootprint` import).

`src/presentation/editor/selection/canvasCandidates.ts`:

```ts
import { NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';

/** Visibility limits pointer admission, not persistent identity or the owning group's members. */
export function canvasCandidates(zones: Iterable<{ readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }>, structure: Structure, visible: { readonly zone: boolean; readonly architecture: boolean; readonly asset: boolean }, shapeOf: ShapeLookup = NO_SHAPES): SpatialObjectCandidate[] {
	const rooms = visible.zone ? [...zones].map(zone => ({ id: zone.id, points: zone.points, bulges: zone.bulges })) : [];
	return [...rooms, ...structureCandidates(structure, shapeOf).filter(item => item.kind === 'asset' ? visible.asset : visible.architecture)];
}
```

`src/presentation/editor/tools/registerEditorTools.ts`: import `useAssetShapeStore` and change the `spatialObjects` member:

```ts
			spatialObjects: () => canvasCandidates(projectStore.zones.values(), projectStore.structure, workspace.layerVisibility, assetShapes.shapeOf),
```

with `const assetShapes = useAssetShapeStore();` declared beside the function's other locals (next to `const { context, planId, … } = deps;`).

`src/presentation/editor/structure/structureRecords.ts`:

```ts
import { elementFootprint, NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';
export function structureRecords(structure: Structure, planId: string, metadata: readonly SpatialElementMetadata[] = [], shapeOf: ShapeLookup = NO_SHAPES): SpatialRecordDto[] {
	const names = new Map(metadata.map(item => [item.id, item.name]));
	return [
		...(structure.elements ?? []).map(element => {
			const footprint = elementFootprint(element, shapeOf), closed = element.kind === 'object' || element.kind === 'stair' || element.kind === 'asset';
			const measured = closed ? area({ points: footprint }) : null;
			return { ...element, ...(element.kind === 'stair' || element.kind === 'asset' ? { hitPoints: footprint } : {}), name: names.get(element.id) ?? element.id, planId, zoneType: element.kind, areaMm2: measured?.ok ? measured.value : 0 };
		}),
```

(walls and openings unchanged; drop the unused `spatialElementFootprint` import).

`src/presentation/editor/selection/resolveSelectionTarget.ts`, `priority`:

```ts
const priority = (candidate: SpatialObjectCandidate): number => candidate.kind === 'object' || candidate.kind === 'stair' || candidate.kind === 'asset' ? 4 : candidate.kind === 'opening' ? 3 : candidate.kind === 'wall' ? 2 : candidate.kind ? 1 : 0;
```

- [ ] **Step 5: Close asset outlines in the overlays**

`InteractionLayer.vue`: import `useAssetShapeStore`, add `const assetShapes = useAssetShapeStore();`, pass `assetShapes.shapeOf` as the second argument of its `structureCandidates(...)` call, and in both `hoverClosed` and `multiOutlines` extend the closed test to `kind === undefined || kind === 'object' || kind === 'stair' || kind === 'asset'` (in `multiOutlines` the variable is `zone.kind`).

`RenovationLayer.vue`: import `useAssetShapeStore`, pass its `shapeOf` to `structureCandidates(structure, …)`, and set `closed: element?.kind === 'object' || element?.kind === 'stair' || element?.kind === 'asset'`.

`MaterialMarkers.vue` and `CostWorkHighlight.vue`: import `useAssetShapeStore`, pass `shapeOf` as the fourth argument to both `structureRecords(...)` calls (`structureRecords(project.structure, project.plan?.id ?? '', project.plan?.spatialElements, shapes.shapeOf)` — pass `project.plan?.spatialElements` where the third argument was omitted), and change both `['object', 'stair'].includes(…)` arrays to `['object', 'stair', 'asset']`.

- [ ] **Step 6: Rotate about the anchor and hide with the asset layer**

`src/presentation/editor/elements/objectRotation.ts`, in `rotationPivot` after the `every(validRotationPoint)` guard:

```ts
	if (shape.kind === 'asset') return shape.points.length === 2 ? shape.points[0] : null;
```

`src/presentation/editor/elements/rotationActions.ts`, `sourceVisible`:

```ts
function sourceVisible(shape: NamedRotationShape, layers: { readonly zone: boolean; readonly architecture: boolean; readonly asset: boolean }): boolean {
	if (shape.kind === 'group') return shape.visible === true;
	if (shape.kind === 'asset') return layers.asset;
	return shape.kind === 'room' || shape.kind === 'area' ? layers.zone : layers.architecture;
}
```

`src/presentation/editor/shell/zoneTypeLabel.ts`, add to `LABELS`:

```ts
	asset: 'editor.add.asset.label',
```

- [ ] **Step 7: Add the Assets layer row**

`src/presentation/editor/layers/layerCatalogue.ts`: add `readonly assets: LayerToggle;` to `LayerToggles` (after `walls`), extend `LayerEntryId` with `'assets'`, and after the walls entry:

```ts
		{ id: 'assets', labelKey: 'editor.layer.assets', ...AVAILABLE, ...toggles.assets },
```

`PropertyLayerPanel.vue`, in `toggles`:

```ts
	assets: konva('asset'),
```

Update the pins:

- `tests/presentation/editor/layers/layerCatalogue.test.ts`: `toggles()` returns `{ reference: toggle(), rooms: toggle(), walls: toggle(), assets: toggle(), planned, notes: toggle() }`; the two id lists become `['reference', 'rooms', 'walls', 'assets', 'planned', 'notes']` and `['reference', 'rooms', 'walls', 'assets', 'notes']`; rename the first case to `lists the six rows in the mockup order`.
- `tests/presentation/editor/shell/layerList.test.ts`: `toHaveLength(4)` → `toHaveLength(5)` and the comment lists `reference, rooms, walls, assets, notes`.
- `tests/presentation/editor/shell.test.ts` (the layers panel case): `toHaveLength(5)`, `rows[3]` label `t('en', 'editor.layer.assets')`, `rows[4]` label `t('en', 'editor.shell.notes-layer')`, and the case title names Assets.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/presentation/editor tests/presentation/i18n`
Expected: PASS. If a notes-row test elsewhere indexes the rows by position, move its index by one.

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add -A src tests
git commit -m "feat(editor): asset placements hit, rotate and outline by their derived footprint

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Draw placements on the Asset layer

**Files:**
- Create: `src/presentation/editor/elements/elementPreviews.ts`
- Create: `src/presentation/editor/elements/assetShapeConfig.ts`
- Create: `src/presentation/editor/elements/AssetShapes.vue`
- Create: `src/presentation/editor/elements/AssetLayer.vue`
- Modify: `src/presentation/editor/structure/StructureLayer.vue`
- Modify: `src/presentation/editor/PlanCanvas.vue`
- Create: `tests/presentation/editor/elements/assetShapeConfig.test.ts`
- Create: `tests/presentation/editor/assetLayer.test.ts`

**Interfaces:**
- Consumes: `elementFootprint`, `ShapeLookup` (Task 5); `placedOutline`, `placementHeading` (Task 1); `useAssetShapeStore` (Task 4); `assetPlacementRig` (Task 4).
- Produces:
  - `withElementPreviews(elements: readonly SpatialElement[], names: ReadonlyMap<string, string>, rotation: { id: string; name: string; points: readonly Point[] } | null, moved: NamedSpatialElement | null): NamedSpatialElement[]`
  - `assetShapeConfig(element: NamedSpatialElement, shapeOf: ShapeLookup, state: { selected: boolean; hovered: boolean; tokens: ThemeTokens; zoom: number })` → `{ id, footprint, cross: [number[], number[]] | null, tick, clearance: object | null, label }`
  - `AssetShapes.vue` props `{ placements: readonly NamedSpatialElement[]; shapeOf: ShapeLookup; selectedIds: readonly string[]; hoveredId: string | null; tokens: ThemeTokens; zoom: number }`; each placement is a `VGroup` named `'element-asset ' + id` with children named `asset-footprint` | `asset-placeholder`, `asset-facing`, `asset-clearance`.

- [ ] **Step 1: Write the failing config test**

Create `tests/presentation/editor/elements/assetShapeConfig.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expectOk } from '../../../helpers/domain';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementPoints } from '../../../../src/domain/spatial/assetPlacement';
import { assetShapeConfig } from '../../../../src/presentation/editor/elements/assetShapeConfig';
import type { ThemeTokens } from '../../../../src/presentation/editor/theme/themeTokens';

const tokens = { canvasBackground: 'bg', zoneStroke: 'ink', zoneLabel: 'label', zoneCaption: 'muted', accent: 'accent' } as ThemeTokens;
const base = expectOk(shapeFromDimensions(800, 600));
const shape = { ...base, clearance: { points: [{ x: -600, y: -500 }, { x: 600, y: -500 }, { x: 600, y: 500 }, { x: -600, y: 500 }] } };
const element = { id: 'element-radiator', kind: 'asset' as const, assetId: 'asset-radiator', name: 'Radiator', points: placementPoints({ x: 1000, y: 1000 }, 0) };
const state = { selected: false, hovered: false, tokens, zoom: 1 };

describe('assetShapeConfig', () => {
	it('draws a closed footprint with a facing tick and no clearance at rest', () => {
		const config = assetShapeConfig(element, () => shape, state);
		expect(config.footprint).toMatchObject({ name: 'asset-footprint', closed: true, stroke: 'ink', points: [600, 700, 1400, 700, 1400, 1300, 600, 1300] });
		expect(config.tick.points).toEqual([1000, 1000, 1016, 1000]);
		expect(config.clearance).toBeNull();
		expect(config.cross).toBeNull();
	});
	it('shows the clearance while selected or hovered, in the accent when selected', () => {
		expect(assetShapeConfig(element, () => shape, { ...state, hovered: true }).clearance).toMatchObject({ name: 'asset-clearance', closed: true });
		expect(assetShapeConfig(element, () => shape, { ...state, selected: true }).footprint.stroke).toBe('accent');
	});
	it('draws a dashed, crossed placeholder when the shape is unknown', () => {
		const config = assetShapeConfig(element, () => null, state);
		expect(config.footprint).toMatchObject({ name: 'asset-placeholder', points: [750, 750, 1250, 750, 1250, 1250, 750, 1250] });
		expect(config.footprint.dash).toEqual([6, 4]);
		expect(config.cross).toEqual([[750, 750, 1250, 1250], [1250, 750, 750, 1250]]);
	});
});
```

Run: `npm run check:fast -- tests/presentation/editor/elements/assetShapeConfig.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the config**

Create `src/presentation/editor/elements/assetShapeConfig.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { placedOutline, placementHeading } from '../../../domain/spatial/assetPlacement';
import type { ThemeTokens } from '../theme/themeTokens';
import { elementFootprint, type ShapeLookup } from './elementFootprint';

const flat = (points: readonly Point[]): number[] => points.flatMap(point => [point.x, point.y]);

/** Konva configs for one placement, as data, so what a placement looks like is asked of a function. */
export function assetShapeConfig(element: NamedSpatialElement, shapeOf: ShapeLookup, state: { readonly selected: boolean; readonly hovered: boolean; readonly tokens: ThemeTokens; readonly zoom: number }) {
	const { selected, tokens, zoom } = state, shape = element.assetId ? shapeOf(element.assetId) : null;
	const footprint = elementFootprint(element, shapeOf), anchor = element.points[0], heading = placementHeading(element);
	const clearance = shape && (selected || state.hovered) ? placedOutline(element, shape).clearance : null;
	return {
		id: element.id,
		footprint: { name: shape ? 'asset-footprint' : 'asset-placeholder', points: flat(footprint), closed: true, stroke: selected ? tokens.accent : tokens.zoneStroke,
			strokeWidth: (selected ? 3 : 2) / zoom, fill: tokens.canvasBackground, dash: shape ? [] : [6 / zoom, 4 / zoom] },
		cross: shape ? null : [flat([footprint[0], footprint[2]]), flat([footprint[1], footprint[3]])],
		tick: { name: 'asset-facing', points: flat([anchor, { x: anchor.x + 16 / zoom * Math.cos(heading), y: anchor.y + 16 / zoom * Math.sin(heading) }]), stroke: selected ? tokens.accent : tokens.zoneStroke, strokeWidth: 2 / zoom },
		clearance: clearance ? { name: 'asset-clearance', points: flat(clearance), closed: true, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom, dash: [6 / zoom, 4 / zoom] } : null,
		label: { x: anchor.x, y: Math.min(...footprint.map(point => point.y)) - 18 / zoom, text: element.name, fontSize: 12 / zoom, fill: tokens.zoneLabel, listening: false },
	};
}
```

Run: `npm run check:fast -- tests/presentation/editor/elements/assetShapeConfig.test.ts`
Expected: PASS.

- [ ] **Step 3: Extract the element preview merge**

Create `src/presentation/editor/elements/elementPreviews.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';

/** Saved elements with their names, and any in-flight rotation or move preview in place of the saved one. */
export function withElementPreviews(elements: readonly SpatialElement[], names: ReadonlyMap<string, string>, rotation: { readonly id: string; readonly name: string; readonly points: readonly Point[] } | null, moved: NamedSpatialElement | null): NamedSpatialElement[] {
	return elements.map(element => rotation?.id === element.id ? { ...element, name: rotation.name, points: rotation.points }
		: moved?.id === element.id ? moved : { ...element, name: names.get(element.id) ?? element.id });
}
```

In `StructureLayer.vue`, replace the `elements` computed:

```ts
const elements = computed(() => withElementPreviews((structure.value.elements ?? []).filter(element => element.kind !== 'asset'), elementNames.value, runtime.rotationActions.preview.value, runtime.elementActions.preview.value));
```

and import `withElementPreviews` from `../elements/elementPreviews`.

- [ ] **Step 4: Create the components**

Create `src/presentation/editor/elements/AssetShapes.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import type { ShapeLookup } from './elementFootprint';
import { assetShapeConfig } from './assetShapeConfig';
const props = defineProps<{ placements: readonly NamedSpatialElement[]; shapeOf: ShapeLookup; selectedIds: readonly string[]; hoveredId: string | null; tokens: ThemeTokens; zoom: number }>();
const shapes = computed(() => props.placements.map(element => assetShapeConfig(element, props.shapeOf,
	{ selected: props.selectedIds.includes(element.id), hovered: props.hoveredId === element.id, tokens: props.tokens, zoom: props.zoom })));
</script>
<template>
	<VGroup>
		<VGroup
			v-for="shape in shapes"
			:key="shape.id"
			:config="{ name: 'element-asset ' + shape.id }"
		>
			<VLine
				v-if="shape.clearance"
				:config="shape.clearance"
			/>
			<VLine :config="shape.footprint" />
			<template v-if="shape.cross">
				<VLine
					v-for="(line, index) in shape.cross"
					:key="index"
					:config="{ name: 'asset-placeholder-cross', points: line, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom }"
				/>
			</template>
			<VLine :config="shape.tick" />
			<VText :config="shape.label" />
		</VGroup>
	</VGroup>
</template>
```

Create `src/presentation/editor/elements/AssetLayer.vue`:

```vue
<script setup lang="ts">
/** §17's asset layer: every placement drawn from its library shape, beneath annotations and above zones. */
import { computed } from 'vue';
import type { NodeTransform } from '../viewport/Viewport';
import type { ThemeTokens } from '../theme/themeTokens';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { withElementPreviews } from './elementPreviews';
import AssetShapes from './AssetShapes.vue';
const props = defineProps<{ transform: NodeTransform; tokens: ThemeTokens; visible: boolean; zoom: number }>();
const project = useProjectStore(), shapes = useAssetShapeStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const structure = computed(() => runtime.curveTask.preview.value?.structure ?? runtime.groupActions?.preview.value?.structure ?? project.structure);
const names = computed(() => new Map(project.plan?.spatialElements?.map(item => [item.id, item.name])));
const placements = computed(() => withElementPreviews((structure.value.elements ?? []).filter(element => element.kind === 'asset'), names.value, runtime.rotationActions.preview.value, runtime.elementActions.preview.value));
</script>
<template>
	<VLayer :config="{ name: 'asset', listening: false, visible: props.visible, ...props.transform }">
		<AssetShapes
			:placements="placements"
			:shape-of="shapes.shapeOf"
			:selected-ids="selection.selectedIds"
			:hovered-id="runtime.renderState.hoveredObjectId"
			:tokens="tokens"
			:zoom="zoom"
		/>
	</VLayer>
</template>
```

In `PlanCanvas.vue`, import `AssetLayer from './elements/AssetLayer.vue'` and replace the `<EmptyLayer layer-id="asset" … />` block with:

```vue
				<AssetLayer
					:transform="transform"
					:tokens="props.tokens"
					:zoom="viewport.zoom"
					:visible="layerVisibility.asset"
				/>
```

- [ ] **Step 5: Write the mounted layer test**

Create `tests/presentation/editor/assetLayer.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('draws a placed asset and a placeholder on the asset layer, and hides both with the Assets row', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const placed = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 2, 'asset shapes'); await settle();
	const layer = rig.stage.findOne('.asset');
	expect(layer?.find('.element-asset')).toHaveLength(2);
	expect(layer?.find('.asset-footprint')).toHaveLength(1);
	expect(layer?.find('.asset-placeholder')).toHaveLength(1);
	expect(rig.stage.findOne('.architecture')?.find('.element-asset')).toHaveLength(0);
	const resting = layer?.find('.asset-footprint')[0]?.getAttr('strokeWidth') as number;
	rig.selection.select([placed as never]); await settle();
	expect(layer?.find('.asset-footprint')[0]?.getAttr('strokeWidth')).toBeGreaterThan(resting);
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	expect(layer?.visible()).toBe(false);
});
```

Run: `npm run check:fast -- tests/presentation/editor/assetLayer.test.ts tests/presentation/editor`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add -A src tests
git commit -m "feat(editor): draw asset placements on the asset layer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The `place-asset` tool

**Files:**
- Create: `src/presentation/editor/elements/assetPlacementDraft.ts`
- Create: `src/presentation/editor/elements/AssetPlacementTool.ts`
- Create: `src/presentation/editor/elements/assetPlacementTask.ts`
- Create: `src/presentation/editor/elements/AssetPlacementForm.vue`
- Modify: `src/presentation/editor/elements/spatialEditing.ts`
- Modify: `src/presentation/editor/elements/AssetLayer.vue` (preview)
- Modify: `src/presentation/editor/add/creationCatalogue.ts`, `src/presentation/editor/add/AddMenu.vue`
- Modify: `src/presentation/editor/shell/EntityInspector.vue`, `src/presentation/editor/shell/TemporaryToolBanner.vue`, `src/presentation/editor/surface/cursor.ts`
- Modify: `src/presentation/i18n/locales/en/assetPlacement.ts`, `src/presentation/i18n/locales/de/assetPlacement.ts`
- Create: `tests/presentation/editor/elements/placementAt.test.ts`
- Create: `tests/presentation/editor/assetPlacement.e2e.test.ts`
- Modify: `tests/presentation/editor/add/creationCatalogue.test.ts`, `tests/presentation/editor/add/addMenu.test.ts`

**Interfaces:**
- Consumes: `placementPoints`, `backDepth` (Task 1); `AssetShapeAnswer` (Task 4); `elementInput` (existing); `withElementPreviews`, `AssetShapes.vue` (Task 6).
- Produces:
  - `AssetPlacementDraft` = reactive `{ assetId: string; name: string; shape: AssetShape | null; preview: readonly [Point, Point] | null; text: { x: string; y: string }; busy: boolean; error: AppError | null }`
  - `placementAt(point: Point, shape: AssetShape, walls: readonly Wall[], tolerance: number | null): readonly [Point, Point]`
  - `runtime.elementTask.assets` = `{ draft, blocked: ComputedRef<boolean>, available: boolean, choose(options: readonly { id: string; name: string }[]): Promise<void>, place(points: readonly [Point, Point]): Promise<void>, pickPlaceable(title: string, options): Promise<{ id: string; answer: placeable } | null>, write(element: NamedSpatialElement): Promise<boolean> }`
  - `CreationEntryId` includes `'asset'`; `CreationRuntime.chooseAsset?: () => void`

- [ ] **Step 1: Write the failing snap test**

Create `tests/presentation/editor/elements/placementAt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import { expectOk } from '../../../helpers/domain';
import { WALL_LOOP } from '../../../helpers/structure';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementAt } from '../../../../src/presentation/editor/elements/assetPlacementDraft';

const rounded = (points: readonly Point[]) => points.map(p => ({ x: Math.round(p.x * 1e6) / 1e6 + 0, y: Math.round(p.y * 1e6) / 1e6 + 0 }));
const shape = expectOk(shapeFromDimensions(800, 600)); // facing +x, anchor centred: 400 mm behind the anchor

describe('placementAt', () => {
	it('places freely with the asset\'s own facing away from walls or with snapping off', () => {
		expect(rounded(placementAt({ x: 2000, y: 1500 }, shape, WALL_LOOP.walls, 50))).toEqual([{ x: 2000, y: 1500 }, { x: 3000, y: 1500 }]);
		expect(rounded(placementAt({ x: 2000, y: 100 }, shape, WALL_LOOP.walls, null))).toEqual([{ x: 2000, y: 100 }, { x: 3000, y: 100 }]);
	});
	it('puts the back edge on the wall face on the pointer\'s side, facing into the room', () => {
		// wall-a runs along y = 0, 150 thick: its inner face is y = 75.
		expect(rounded(placementAt({ x: 2000, y: 100 }, shape, WALL_LOOP.walls, 50))).toEqual([{ x: 2000, y: 475 }, { x: 2000, y: 1475 }]);
		expect(rounded(placementAt({ x: 2000, y: -100 }, shape, WALL_LOOP.walls, 50))).toEqual([{ x: 2000, y: -475 }, { x: 2000, y: -1475 }]);
	});
});
```

Run: `npm run check:fast -- tests/presentation/editor/elements/placementAt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the draft and the snap**

Create `src/presentation/editor/elements/assetPlacementDraft.ts`:

```ts
import { reactive } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { backDepth, placementPoints } from '../../../domain/spatial/assetPlacement';
import { projectOntoWall, wallTangent, type Wall } from '../../../domain/spatial/Structure';

export interface AssetPlacementDraft {
	assetId: string; name: string; shape: AssetShape | null;
	preview: readonly [Point, Point] | null;
	text: { x: string; y: string };
	busy: boolean; error: AppError | null;
}

export function createAssetPlacementDraft(): AssetPlacementDraft {
	return reactive({ assetId: '', name: '', shape: null, preview: null, text: { x: '', y: '' }, busy: false, error: null });
}

/**
 * Where a pointer puts the asset. Within `tolerance` of a wall's face the placement faces away
 * from that wall and its footprint's back edge sits on the face; otherwise it stands where the
 * pointer is with the asset's own facing. `null` tolerance is snapping switched off.
 */
export function placementAt(point: Point, shape: AssetShape, walls: readonly Wall[], tolerance: number | null): readonly [Point, Point] {
	const hits = tolerance === null ? [] : walls.map(wall => ({ wall, ...projectOntoWall(wall, point) })).filter(hit => hit.distance <= hit.wall.thickness / 2 + tolerance);
	const hit = hits.reduce<(typeof hits)[number] | undefined>((best, candidate) => !best || candidate.distance < best.distance ? candidate : best, undefined);
	if (!hit) return placementPoints(point, shape.facing);
	const tangent = wallTangent(hit.wall, hit.offset), across = { x: tangent.y, y: -tangent.x };
	const side = Math.sign((point.x - hit.point.x) * across.x + (point.y - hit.point.y) * across.y) || 1;
	const normal = { x: across.x * side, y: across.y * side }, reach = hit.wall.thickness / 2 + backDepth(shape);
	return placementPoints({ x: hit.point.x + normal.x * reach, y: hit.point.y + normal.y * reach }, Math.atan2(normal.y, normal.x));
}
```

Run: `npm run check:fast -- tests/presentation/editor/elements/placementAt.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement the tool**

Create `src/presentation/editor/elements/AssetPlacementTool.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { Wall } from '../../../domain/spatial/Structure';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import { placementAt, type AssetPlacementDraft } from './assetPlacementDraft';

/** Click-to-place, repeatedly. It keeps no draft Escape could discard, so Escape leaves the tool. */
export class AssetPlacementTool implements EditorTool {
	readonly id = 'place-asset' as const;
	private context: EditorContext | null = null;
	constructor(private readonly deps: { draft: AssetPlacementDraft; walls(): readonly Wall[]; blocked(): boolean; place(points: readonly [Point, Point]): void }) {}
	activate(context: EditorContext): void { this.context = context; }
	deactivate(): void { this.context = null; this.deps.draft.preview = null; }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		this.pointerMove(event);
		const at = this.deps.draft.preview;
		if (at && !this.deps.blocked()) this.deps.place(at);
	}
	pointerMove(event: EditorPointerEvent): void {
		const context = this.context, shape = this.deps.draft.shape;
		if (!context || !shape) return;
		const tolerance = context.snapService.enabled ? 8 * context.viewport.worldPerScreenPixel() : null;
		this.deps.draft.preview = placementAt(event.worldPoint, shape, this.deps.walls(), tolerance);
	}
	pointerUp(): void { /* A placement belongs to pointer down. */ }
	cancel(): void { this.deps.draft.preview = null; }
	abandonGesture(): void { this.deps.draft.preview = null; }
	hasDraft(): boolean { return false; }
}
```

- [ ] **Step 4: Implement the task**

Create `src/presentation/editor/elements/assetPlacementTask.ts`:

```ts
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { EntityId } from '../../../core/identity/EntityId';
import { createEntityId } from '../../../core/identity/generateId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';
import type { AssetShapeAnswer } from '../../read-models/assetShapes';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyWarning } from '../../notices/notify';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useProjectStore } from '../../stores/ProjectStore';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useSelectionStore } from '../selection/selection-store';
import { AssetPlacementTool } from './AssetPlacementTool';
import { createAssetPlacementDraft } from './assetPlacementDraft';
import { elementInput } from './elementInput';

type Placeable = Extract<AssetShapeAnswer, { kind: 'placeable' }>;
const REFUSALS: Readonly<Record<Exclude<AssetShapeAnswer['kind'], 'placeable'>, StringKey>> = {
	'no-shape': 'editor.asset.no-shape', unscaled: 'editor.asset.unscaled', missing: 'editor.asset.unreadable', unreadable: 'editor.asset.unreadable',
};

export function createAssetPlacementTask(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'toolManager' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'setTool'> & { ledger: WriteLedger }) {
	const project = useProjectStore(), selection = useSelectionStore(), dialogs = useDialogStore(), save = useSaveStateStore();
	const draft = createAssetPlacementDraft();
	const blocked = computed(() => draft.busy || runtime.writesBlocked.value || save.state === 'saving');

	/** The picker, then the shape: an asset that cannot be drawn is refused here with its reason, before any tool starts. */
	async function pickPlaceable(title: string, options: readonly { readonly id: string; readonly name: string }[]): Promise<{ id: string; answer: Placeable } | null> {
		if (dialogs.current !== null || !context.queries.assetShapes) return null;
		const picked = await dialogs.openDialog({ kind: 'entity-picker', title, candidates: options.map(option => ({ id: option.id, label: option.name })) });
		if (picked === 'cancel') return null;
		const answer = (await context.queries.assetShapes([picked.id])).get(picked.id);
		if (answer?.kind === 'placeable') return { id: picked.id, answer };
		notifyWarning(tr(REFUSALS[answer?.kind ?? 'unreadable']));
		return null;
	}

	/** One reversible write through the leaf's dispatcher, from a fresh baseline: a second placement must not reuse the first one's version. */
	async function write(element: NamedSpatialElement): Promise<boolean> {
		const services = context.commands.renovation;
		if (blocked.value || !services) return false;
		draft.busy = true;
		try {
			const baseline = await services.read(context.planId as PlanId);
			if (!baseline.ok) { draft.error = baseline.error; return false; }
			const result = await runtime.dispatcher.run(services.command(baseline.value, elementInput(baseline.value, element), runtime.ledger));
			if (result.ok) { draft.error = null; return true; }
			draft.error = result.error;
			if (WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(code))) await runtime.refreshProjection();
			return false;
		} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.asset.write-failed'); return false; }
		finally { draft.busy = false; }
	}

	async function choose(options: readonly { readonly id: string; readonly name: string }[]): Promise<void> {
		const picked = await pickPlaceable(tr('editor.asset.pick-title'), options);
		if (!picked) return;
		Object.assign(draft, { assetId: picked.id, name: picked.answer.name, shape: picked.answer.shape, preview: null, error: null, text: { x: '', y: '' } });
		runtime.setTool('place-asset');
	}

	async function place(points: readonly [Point, Point]): Promise<void> {
		if (!draft.shape) return;
		const id = createEntityId('element');
		if (await write({ id, kind: 'asset', assetId: draft.assetId, points, name: draft.name })) selection.select([id as EntityId<string>]);
	}

	runtime.toolManager.register(new AssetPlacementTool({ draft, walls: () => project.structure.walls, blocked: () => blocked.value, place: points => { void place(points); } }));
	return { draft, blocked, choose, place, pickPlaceable, write, available: context.commands.renovation !== undefined && context.queries.assetShapes !== undefined };
}
```

In `spatialEditing.ts`:

```ts
import { createAssetPlacementTask } from './assetPlacementTask';
```

widen the `runtime` parameter type with `& Parameters<typeof createAssetPlacementTask>[1]`, and replace the `elementTask` line:

```ts
	const elementTask = Object.assign(createElementTask(context, runtime), { assets: createAssetPlacementTask(context, runtime) });
```

- [ ] **Step 5: Add the i18n keys**

Append to `assetPlacementEn`:

```ts
	'editor.asset.pick-title': 'Place an asset',
	'editor.asset.banner': 'Click the plan to place a copy; near a wall it turns to face the room. Esc stops placing.',
	'editor.asset.form-hint': 'Enter a position in metres to place a copy there, facing its own direction.',
	'editor.asset.place': 'Place',
	'editor.asset.done': 'Done',
	'editor.asset.no-shape': 'This asset has no footprint yet. Give it one in the asset designer first.',
	'editor.asset.unscaled': 'The footprint of this asset has no scale yet. Calibrate it in the asset designer first.',
	'editor.asset.unreadable': 'The shape of this asset could not be read.',
```

Append to `assetPlacementDe`:

```ts
	'editor.asset.pick-title': 'Bibliotheksobjekt platzieren',
	'editor.asset.banner': 'Klicken Sie in den Plan, um eine Kopie zu platzieren; an einer Wand dreht sie sich zum Raum. Esc beendet das Platzieren.',
	'editor.asset.form-hint': 'Position in Metern eingeben, um dort eine Kopie in ihrer eigenen Ausrichtung zu platzieren.',
	'editor.asset.place': 'Platzieren',
	'editor.asset.done': 'Fertig',
	'editor.asset.no-shape': 'Dieses Objekt hat noch keine Grundfläche. Legen Sie sie zuerst im Objektdesigner fest.',
	'editor.asset.unscaled': 'Die Grundfläche dieses Objekts hat noch keinen Maßstab. Kalibrieren Sie sie zuerst im Objektdesigner.',
	'editor.asset.unreadable': 'Die Form dieses Objekts konnte nicht gelesen werden.',
```

- [ ] **Step 6: Wire the shell**

`creationCatalogue.ts`:

```ts
export type CreationEntryId = 'room' | 'wall' | 'door' | 'window' | 'opening' | 'area' | 'path' | 'fence' | 'item' | 'asset' | 'measurement' | 'note' | 'stair' | 'arrow';
export type CreationRuntime = Pick<EditorRuntime, 'setTool'> & { readonly createNote?: () => void; readonly chooseAsset?: () => void };
```

add `asset: 'square-dashed-mouse-pointer',` to `CREATION_ICONS`, and in `ENTRIES_BY_ID` directly after `item`:

```ts
	asset: {
		id: 'asset', group: 'planning', icon: CREATION_ICONS.asset, labelKey: 'editor.add.asset.label', descriptionKey: 'editor.add.asset.description', synonymKeys: [],
		availability: { kind: 'available' },
		activate: runtime => { if (!runtime.chooseAsset) throw new Error('Asset requires its placement capability'); runtime.chooseAsset(); },
	},
```

`AddMenu.vue`:

```ts
const creation: CreationRuntime = { setTool: id => runtime.setTool(id), createNote: note.activate, chooseAsset: () => { void runtime.elementTask.assets.choose(runtime.assetOptions.value); } };
```

In `spatialUnavailable`, before the `isElementEntry` line:

```ts
	if (entry.id === 'asset') return !runtime.elementTask.assets.available;
```

In `unavailableReason`:

```ts
	if (isElementEntry(entry) || entry.id === 'asset') return tr('editor.add.element.unavailable', { name: tr(entry.labelKey) });
```

`TemporaryToolBanner.vue`, in `TASKS`:

```ts
	'place-asset': { nameKey: 'editor.add.asset.label', instructionKey: 'editor.asset.banner' },
```

`cursor.ts`: add `'place-asset',` after `'place-object',` in `PRECISE_TOOLS`.

`EntityInspector.vue`: import `AssetPlacementForm from '../elements/AssetPlacementForm.vue'` and add after the `ElementTaskForm` line:

```vue
		<AssetPlacementForm v-else-if="activeToolId === 'place-asset'" />
```

- [ ] **Step 7: The keyboard path**

Create `src/presentation/editor/elements/AssetPlacementForm.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { parseCoordinateMetres } from '../shell/formatLength';
import { placementPoints } from '../../../domain/spatial/assetPlacement';
const runtime = useEditorRuntime(), task = runtime.elementTask.assets, draft = task.draft;
const point = computed(() => {
	const x = parseCoordinateMetres(draft.text.x), y = parseCoordinateMetres(draft.text.y);
	return x.ok && y.ok ? { x: x.mm, y: y.mm } : null;
});
const placeBlocked = computed(() => task.blocked.value || point.value === null || draft.shape === null);
function placeTyped(): void {
	if (placeBlocked.value || !point.value || !draft.shape) return;
	void task.place(placementPoints(point.value, draft.shape.facing));
}
</script>
<template>
	<section
		class="rp-element-task"
		data-rp-form="asset-place"
	>
		<h3>{{ draft.name }}</h3>
		<p>{{ tr('editor.asset.form-hint') }}</p>
		<p
			v-if="draft.error"
			role="alert"
		>
			{{ trError(draft.error) }}
		</p>
		<form @submit.prevent="placeTyped">
			<label class="rp-dialog-field">X<input
				v-model="draft.text.x"
				name="asset-x"
				type="text"
				inputmode="decimal"
			></label>
			<label class="rp-dialog-field">Y<input
				v-model="draft.text.y"
				name="asset-y"
				type="text"
				inputmode="decimal"
			></label>
			<div class="rp-dialog-actions">
				<button
					type="submit"
					data-rp-action="place-asset"
					:aria-disabled="placeBlocked"
				>
					{{ tr('editor.asset.place') }}
				</button>
				<button
					type="button"
					data-rp-action="done-placing"
					@click="runtime.setTool('select')"
				>
					{{ tr('editor.asset.done') }}
				</button>
			</div>
		</form>
	</section>
</template>
```

If lint refuses the literal `X`/`Y` label text, use the keys `ElementTaskForm.vue` already uses for its own X and Y labels (read that file's labels and reuse the same keys).

- [ ] **Step 8: Preview the placement**

In `AssetLayer.vue` add:

```ts
const preview = computed(() => {
	const draft = runtime.elementTask.assets.draft;
	return runtime.activeToolId.value === 'place-asset' && draft.preview && draft.shape
		? [{ id: 'element-preview', kind: 'asset' as const, assetId: draft.assetId, name: draft.name, points: draft.preview }] : [];
});
const previewShape = (assetId: string) => assetId === runtime.elementTask.assets.draft.assetId ? runtime.elementTask.assets.draft.shape : null;
```

and a second `AssetShapes` inside the layer:

```vue
		<AssetShapes
			:placements="preview"
			:shape-of="previewShape"
			:selected-ids="['element-preview']"
			:hovered-id="null"
			:tokens="tokens"
			:zoom="zoom"
		/>
```

- [ ] **Step 9: Update the catalogue pins**

`tests/presentation/editor/add/creationCatalogue.test.ts`: in both id lists insert `'asset'` directly after `'item'`.

`tests/presentation/editor/add/addMenu.test.ts`: in the `it.each([...])` of "explains a missing save capability", add `'asset'`.

- [ ] **Step 10: Write the e2e test**

Create `tests/presentation/editor/assetPlacement.e2e.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { expectOk } from '../../helpers/domain';
import { tr } from '../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const round = (n: number) => Math.round(n * 1e6) / 1e6 + 0;

async function choose(rig: Awaited<ReturnType<typeof assetPlacementRig>>, id: string, name: string) {
	const choosing = rig.runtime.elementTask.assets.choose([{ id, name }]); await settle();
	rig.dialogs.resolve({ id }); await choosing; await settle();
}

it('places repeated copies, snapped to a wall face, each its own undo step, and Escape leaves the tool', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await choose(rig, radiator.id, radiator.name);
	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 100));
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 1, 'first placement');
	const first = rig.project.structure.elements?.[0];
	expect(first).toMatchObject({ kind: 'asset', assetId: radiator.id });
	expect(first?.points.map(p => ({ x: round(p.x), y: round(p.y) }))).toEqual([{ x: 2000, y: 475 }, { x: 2000, y: 1475 }]);
	expect(rig.project.plan?.spatialElements?.find(item => item.id === first?.id)?.name).toBe('Radiator');
	rig.runtime.toolManager.pointerDown(pointerAt(1500, 1500));
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 2, 'second placement');
	expect(rig.runtime.activeToolId.value).toBe('place-asset');
	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.structure.elements).toHaveLength(1);
	await rig.wrapper.get('.rp-plan-canvas').trigger('keydown', { key: 'Escape' }); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select');
});

it('places at typed coordinates with the asset\'s own facing', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await choose(rig, radiator.id, radiator.name);
	await rig.wrapper.get('input[name="asset-x"]').setValue('1');
	await rig.wrapper.get('input[name="asset-y"]').setValue('1,5');
	await rig.wrapper.get('[data-rp-form="asset-place"] form').trigger('submit');
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 1, 'typed placement');
	expect(rig.project.structure.elements?.[0].points).toEqual([{ x: 1000, y: 1500 }, { x: 2000, y: 1500 }]);
});

it('refuses an asset with no footprint before the tool starts', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const sketch = await rig.saveAsset('Sketch', false);
	Notice.shown.length = 0;
	await choose(rig, sketch.id, sketch.name);
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(Notice.shown).toContain(tr('editor.asset.no-shape'));
});
```

Run: `npm run check:fast -- tests/presentation/editor/assetPlacement.e2e.test.ts tests/presentation/editor`
Expected: PASS. If `Escape` on `.rp-plan-canvas` does not reach `onKeyDown`, dispatch the keydown on the element `EditorSurface.vue` binds `@keydown` to (read its template) — the tool's `hasDraft()` is `false`, so `routeEscape` switches to Select.

- [ ] **Step 11: Watch the fresh-baseline invariant fail**

In `write`, temporarily hoist the baseline read so both clicks reuse the first read (cache `services.read` in a `let` outside the function); run the e2e file; confirm the second placement case goes red with a version conflict; restore.

- [ ] **Step 12: Gate and commit**

```bash
npm run check
git add -A src tests
git commit -m "feat(editor): place-asset tool from the Add menu with wall snapping

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The Inspector's asset branch

**Files:**
- Create: `src/presentation/editor/elements/AssetPlacementDetails.vue`
- Modify: `src/presentation/editor/elements/ElementInspector.vue`
- Modify: `src/presentation/editor/elements/assetPlacementTask.ts` (`replace`)
- Modify: `src/presentation/editor/planning/planningContext.ts` (`edit` seed)
- Modify: `src/presentation/editor/PlanEditorContext.ts` (`EditorNavigation.asset?`)
- Modify: `src/plugin/editorWorkspaceNavigation.ts`
- Modify: `src/presentation/i18n/locales/en/assetPlacement.ts`, `src/presentation/i18n/locales/de/assetPlacement.ts`
- Create: `tests/presentation/editor/assetPlacementInspector.test.ts`
- Create: `tests/harness/accessibilityAssetPlacement.test.ts`

**Interfaces:**
- Consumes: `pickPlaceable`, `write` (Task 7); `useAssetShapeStore` (Task 4); `membershipProbe` (Task 1); `usePlanningContext` (existing).
- Produces:
  - `runtime.elementTask.assets.replace(elementId: string, options): Promise<void>`
  - `planning.edit(kind, id = '', seed?: { assetId?: string; rule?: RequirementSource['rule'] })`
  - `EditorNavigation.asset?(assetId: string): Promise<void>`

- [ ] **Step 1: Add the i18n keys**

Append to `assetPlacementEn`:

```ts
	'editor.asset.dimensions': '{width} × {depth} m',
	'editor.asset.missing': 'This asset no longer exists. Replace it or delete the placement.',
	'editor.asset.open-designer': 'Open in designer',
	'editor.asset.replace': 'Replace asset…',
	'editor.asset.replace-title': 'Replace asset',
	'editor.asset.add-material': 'Add as material',
```

Append to `assetPlacementDe`:

```ts
	'editor.asset.dimensions': '{width} × {depth} m',
	'editor.asset.missing': 'Dieses Objekt existiert nicht mehr. Ersetzen Sie es oder löschen Sie die Platzierung.',
	'editor.asset.open-designer': 'Im Designer öffnen',
	'editor.asset.replace': 'Objekt ersetzen…',
	'editor.asset.replace-title': 'Objekt ersetzen',
	'editor.asset.add-material': 'Als Baustoff hinzufügen',
```

- [ ] **Step 2: Write the failing Inspector test**

Create `tests/presentation/editor/assetPlacementInspector.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { tr } from '../../../src/presentation/i18n/strings';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function selectPlaced(rig: Awaited<ReturnType<typeof assetPlacementRig>>, id: string, count: number) {
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === count, 'asset shapes');
	rig.selection.select([id as never]); await settle();
	return rig.wrapper.get('.rp-element-inspector');
}

it('shows dimensions, opens the designer and hides the outline editor', async () => {
	const asset = vi.fn(async () => {});
	const rig = await assetPlacementRig({ project: async () => {}, library: () => {}, asset }); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const inspector = await selectPlaced(rig, id, 1);
	expect(inspector.text()).toContain(tr('editor.asset.dimensions', { width: formatMetres(800), depth: formatMetres(600) }));
	expect(inspector.find('[data-rp-action="edit-element"]').exists()).toBe(false);
	await inspector.get('[data-rp-action="open-asset-designer"]').trigger('click');
	expect(asset).toHaveBeenCalledWith(radiator.id);
});

it('explains a missing asset and replaces it in one undoable step', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place('asset-gone', { x: 1000, y: 1000 }, 0, 'Old boiler');
	const inspector = await selectPlaced(rig, id, 1);
	expect(inspector.text()).toContain(tr('editor.asset.missing'));
	rig.runtime.assetOptions.value = [{ id: radiator.id, name: radiator.name }];
	await inspector.get('[data-rp-action="replace-asset"]').trigger('click'); await settle();
	rig.dialogs.resolve({ id: radiator.id });
	await settleUntil(() => rig.project.structure.elements?.[0]?.assetId === radiator.id, 'replaced asset');
	expect(rig.project.plan?.spatialElements?.find(item => item.id === id)?.name).toBe('Old boiler');
	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.structure.elements?.[0]?.assetId).toBe('asset-gone');
});

it('adds a placement-count material for the room pre-filled, counting the placement', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.runtime.refreshProjection();
	const inspector = await selectPlaced(rig, id, 1);
	await inspector.get('[data-rp-action="add-asset-material"]').trigger('click'); await settle();
	expect(rig.wrapper.get<HTMLSelectElement>('select[name="asset"]').element.value).toBe(radiator.id);
	expect(rig.wrapper.get<HTMLSelectElement>('select[name="rule"]').element.value).toBe('placement-count');
	await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit');
	await settleUntil(() => !rig.wrapper.find('[data-rp-form="planning"]').exists(), 'material save');
	const saved = expectDefined(expectOk(await rig.stack.requirements.listByZone(rig.room.id)).find(item => item.entity.assetId === radiator.id), 'placement material').entity;
	expect(saved.source?.rule).toBe('placement-count');
	expect(saved.quantity.calculated.value.toString()).toBe('1');
});

it('rotates a placement about its anchor and keeps its asset', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	await selectPlaced(rig, id, 1);
	await rig.runtime.rotationActions.rotate(id, 90); await settle();
	const rotated = expectDefined(rig.project.structure.elements?.[0], 'rotated placement');
	expect(rotated.assetId).toBe(radiator.id);
	expect(rotated.points[0]).toEqual({ x: 1000, y: 1000 });
	expect(Math.round(rotated.points[1].y)).toBe(2000);
});
```

Run: `npm run check:fast -- tests/presentation/editor/assetPlacementInspector.test.ts`
Expected: FAIL — `[data-rp-action="open-asset-designer"]` not found.

- [ ] **Step 3: The navigation door**

`PlanEditorContext.ts`, in `EditorNavigation`:

```ts
	/** Open (or reveal) an asset's designer leaf — a placement's Inspector. */
	asset?(assetId: string): Promise<void>;
```

`src/plugin/editorWorkspaceNavigation.ts`: import `renovationProjectOpenAsset` beside the two seams already imported and add:

```ts
		asset: renovationProjectOpenAsset(workspace, logger),
```

- [ ] **Step 4: Replace and the planning seed**

Append to `createAssetPlacementTask` (before `runtime.toolManager.register`):

```ts
	async function replace(elementId: string, options: readonly { readonly id: string; readonly name: string }[]): Promise<void> {
		const current = project.structure.elements?.find(item => item.id === elementId);
		if (current?.kind !== 'asset' || blocked.value) return;
		const picked = await pickPlaceable(tr('editor.asset.replace-title'), options);
		const name = project.plan?.spatialElements?.find(item => item.id === elementId)?.name;
		if (picked && name) await write({ ...current, assetId: picked.id, name });
	}
```

and add `replace` to the returned object.

`planningContext.ts`, change `edit`:

```ts
	async function edit(kind: PlanningKind, id = '', seed: { readonly assetId?: string; readonly rule?: RequirementSource['rule'] } = {}): Promise<void> {
```

and directly after `const draft = planningDraft(...)`:

```ts
		if (seed.assetId) draft.assetId = seed.assetId;
		if (seed.rule) draft.source = { ...draft.source, rule: seed.rule };
```

with `import type { RequirementSource } from '../../../domain/requirement/RequirementSource';`.

- [ ] **Step 5: The details component**

Create `src/presentation/editor/elements/AssetPlacementDetails.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { membershipProbe } from '../../../domain/spatial/assetPlacement';
import { contains } from '../../../core/geometry/operations';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';
import { usePlanningContext } from '../planning/planningContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { formatMetres } from '../shell/formatLength';
const props = defineProps<{ element: SpatialElement }>();
const project = useProjectStore(), shapes = useAssetShapeStore(), context = usePlanEditorContext(), runtime = useEditorRuntime(), planning = usePlanningContext(), session = useRenovationSession();
const assetId = computed(() => props.element.assetId ?? '');
const answer = computed(() => shapes.answerFor(assetId.value));
const REASONS: Readonly<Record<string, StringKey>> = { missing: 'editor.asset.missing', unreadable: 'editor.asset.unreadable', 'no-shape': 'editor.asset.no-shape', unscaled: 'editor.asset.unscaled' };
const summary = computed(() => {
	const value = answer.value;
	if (value === null) return '';
	return value.kind === 'placeable' ? tr('editor.asset.dimensions', { width: formatMetres(value.dimensions.width), depth: formatMetres(value.dimensions.depth) }) : tr(REASONS[value.kind]);
});
const room = computed(() => [...project.zones.values()].find(zone => { const inside = contains(zone, membershipProbe(props.element)); return inside.ok && inside.value; }));
const canAddMaterial = computed(() => runtime.renovation.available && room.value !== undefined && planning.baseline.value !== null
	&& !planning.baseline.value.materials.some(({ entity }) => entity.assetId === assetId.value && entity.origin.zoneId === room.value?.id && entity.source?.rule === 'placement-count'));
async function addMaterial(): Promise<void> {
	if (!room.value) return;
	session.roomId = room.value.id; session.targetId = room.value.id; session.focusedId = '';
	await planning.edit('material', '', { assetId: assetId.value, rule: 'placement-count' });
}
function openDesigner(): void { void context.navigation?.asset?.(assetId.value); }
</script>
<template>
	<p>{{ summary }}</p>
	<div class="rp-dialog-actions">
		<button
			v-if="context.navigation?.asset && answer?.kind !== 'missing'"
			type="button"
			data-rp-action="open-asset-designer"
			@click="openDesigner"
		>
			{{ tr('editor.asset.open-designer') }}
		</button>
		<button
			type="button"
			data-rp-action="replace-asset"
			:aria-disabled="runtime.elementTask.assets.blocked.value"
			@click="runtime.elementTask.assets.replace(element.id, runtime.assetOptions.value)"
		>
			{{ tr('editor.asset.replace') }}
		</button>
		<button
			v-if="canAddMaterial"
			type="button"
			data-rp-action="add-asset-material"
			@click="addMaterial"
		>
			{{ tr('editor.asset.add-material') }}
		</button>
	</div>
</template>
```

- [ ] **Step 6: Mount it in the Inspector**

`ElementInspector.vue`: import `AssetPlacementDetails from './AssetPlacementDetails.vue'`; insert into the `v-if` chain before `<p v-else>`:

```vue
		<AssetPlacementDetails
			v-else-if="element.kind === 'asset'"
			:element="element"
		/>
```

and add `v-if="element.kind !== 'asset'"` to the `data-rp-action="edit-element"` button.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run check:fast -- tests/presentation/editor/assetPlacementInspector.test.ts tests/presentation/editor`
Expected: PASS. If `rotate(id, 90)` is refused because the rotation target requires `hitPoints`/footprint for its handle layout, read `projectedRotationTarget` in `rotationActions.ts`'s imports and give the `'asset'` kind the same arm `'stair'` has there (its footprint via `elementFootprint` with `useAssetShapeStore().shapeOf`), then re-run.

- [ ] **Step 8: Scan the new branch with axe**

Create `tests/harness/accessibilityAssetPlacement.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * The asset placement Inspector branch, scanned under the same ceiling `accessibility.test.ts`'s
 * header states; `runOptions` is shared through `./axeOptions`.
 */
import axe from 'axe-core';
import { afterEach, expect, it } from 'vitest';
import { runOptions } from './axeOptions';
import { assetPlacementRig } from '../helpers/assetPlacement';
import { settle, settleUntil } from '../helpers/editor';
import { useAssetShapeStore } from '../../src/presentation/stores/AssetShapeStore';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('reports no violations for a placed asset and for a missing one', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const placed = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const missing = await rig.place('asset-gone', { x: 3000, y: 2000 }, 0, 'Old boiler');
	await settleUntil(() => useAssetShapeStore(rig.pinia).answers.size === 2, 'asset shapes');
	for (const id of [placed, missing]) {
		rig.selection.select([id as never]); await settle();
		expect(rig.wrapper.find('[data-rp-action="replace-asset"]').exists()).toBe(true);
		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);
		expect(results.violations).toEqual([]);
	}
});
```

Run: `npm run check:fast -- tests/harness/accessibilityAssetPlacement.test.ts`
Expected: PASS.

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add -A src tests
git commit -m "feat(editor): asset placement inspector with replace, designer and material

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Harness captures, manual case and backlog status

**Files:**
- Modify: `tests/harness/referenceWorkspace.ts`
- Modify: `scripts/harness-shot.mjs` (`SHOTS`)
- Modify: `tests/build/harness-shot.test.ts` (the sorted names list)
- Create: `docs/tests/cases/Place an asset on a plan.md`
- Modify: `docs/requirements/Asset placement.md`

**Interfaces:**
- Consumes: everything above.
- Produces: harness query knob `assets` (with `reference&planning`); shots `plan-editor-assets`, `plan-editor-assets-dark`, `plan-editor-assets-narrow`.

- [ ] **Step 1: Seed placements behind a knob**

In `tests/harness/referenceWorkspace.ts`, inside the `ready` IIFE after the planning assets loop:

```ts
		if (planning && new URLSearchParams(location.search).has('assets')) {
			const radiator = makeAsset({ name: 'Radiator', unit: 'piece' });
			expectOk(await stack.assets.save(radiator, 'absent'));
			expectOk(await new ObsidianAssetGeometrySidecar(stack.assetGeometry).write(radiator.id, { calibration: null, shape: expectOk(shapeFromDimensions(800, 600)) }));
			const baseline = expectOk(await geometry.read(plan.id));
			const elements = [
				{ id: 'element-harness-radiator-a', kind: 'asset' as const, assetId: radiator.id, points: placementPoints({ x: 1500, y: 800 }, 0) },
				{ id: 'element-harness-radiator-b', kind: 'asset' as const, assetId: radiator.id, points: placementPoints({ x: 3000, y: 2000 }, Math.PI / 2) },
				{ id: 'element-harness-missing', kind: 'asset' as const, assetId: 'asset-harness-deleted', points: placementPoints({ x: 800, y: 2200 }, 0) },
			];
			expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { walls: [], openings: [], boundaries: [], elements } }, baseline.version));
			expectOk(await stack.plans.save(expectOk(withPlanSpatialElements(plan, elements.map((item, index) => ({ id: item.id, name: ['Radiator', 'Radiator', 'Old boiler'][index] })))), expectOk(await stack.plans.getById(plan.id))?.version ?? 'absent'));
		}
```

with imports `shapeFromDimensions`, `placementPoints`, `withPlanSpatialElements` (from `src/domain/plan/Plan`). If the plan save's expected-version argument has a different shape, read how `stack.plans.save` is called with a loaded plan elsewhere under `tests/helpers/` and match it.

- [ ] **Step 2: Add the shots**

In `scripts/harness-shot.mjs` `SHOTS`, after the `plan-editor-light` entry:

```js
	// Asset placement: two placed radiators and one placeholder, drawn from real repositories.
	{ name: 'plan-editor-assets', query: '?view=plan-editor&reference&planning&assets&theme=light', selector: FLOOR_STATE },
	{ name: 'plan-editor-assets-dark', query: '?view=plan-editor&reference&planning&assets', selector: FLOOR_STATE },
	{ name: 'plan-editor-assets-narrow', query: '?view=plan-editor&reference&planning&assets&theme=light', selector: PLAN_CANVAS, width: 460 },
```

In `tests/build/harness-shot.test.ts`, insert `'plan-editor-assets'`, `'plan-editor-assets-dark'`, `'plan-editor-assets-narrow'` into the sorted list (after `'plan-editor-area-light'`).

Run: `npm run check:fast -- tests/build/harness-shot.test.ts`
Expected: PASS.

- [ ] **Step 3: Capture and look**

```bash
npm run harness-shot
```

Open `harness-shots/plan-editor-assets.png`, `-dark.png`, `-narrow.png`. Expected: two rectangles 0.8 × 0.6 m with a facing tick, one dashed crossed square, labels readable in both schemes. If the browser is not installed, run `npx playwright install chromium` or set `RP_CHROMIUM_EXECUTABLE`, and say so in the PR if captures could not be taken.

- [ ] **Step 4: Write the manual case**

Create `docs/tests/cases/Place an asset on a plan.md`:

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 200
sources:
  - Plan editor asset placement design spec §2 (placing and editing)
  - Plan editor asset placement design spec §3 (the placement-count rule)
  - Plan editor asset placement design spec §4 (deleted and missing assets)
status: Ready
---

# Place an asset on a plan

Add → Asset… picks a designed asset from the library; clicking the floor places copies, each a
reversible write, turning to face the room when the pointer is near a wall. A placement's
Inspector shows its size, opens its designer, replaces its asset and adds a material that counts
placements in its room. `docs/superpowers/specs/2026-09-10-plan-editor-asset-placement-design.md`
is the design.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, a project
with a floor that has walls and one Room, and two library assets with a unit of piece — one
designed with a footprint, one never opened in the designer.

## Steps

1. Add → Asset…, choose the undesigned asset. **Expected:** a notice says it has no footprint; the
   tool does not start.
2. Add → Asset…, choose the designed asset. **Expected:** the banner reads the placing
   instruction; a preview footprint follows the pointer.
3. Move the pointer next to a wall inside the room and click. **Expected:** the footprint's back
   edge sits on the wall's inner face, the facing tick points into the room.
4. Click twice more in open floor. **Expected:** two more copies, the tool still active.
5. Press Ctrl+Z once. **Expected:** only the last copy disappears. Press Esc. **Expected:** Select
   is active.
6. Select the wall-side copy. **Expected:** the clearance outline appears; the Inspector shows its
   width × depth and Open in designer, Replace asset…, Add as material.
7. Add as material, save. **Expected:** the material's quantity equals the copies inside the room.
8. Delete one copy inside the room. **Expected:** the material recalculates one lower.
9. Delete the designed asset in the asset library, return to the plan. **Expected:** every copy
   draws as a dashed crossed square; the Inspector says the asset no longer exists; the material
   still counts them.
10. Replace asset… on one placeholder with another designed asset. **Expected:** it redraws with
    that footprint; Ctrl+Z restores the placeholder.
11. Hide the Assets layer row. **Expected:** placements disappear and cannot be clicked.

## Runs

| Date | Build | Result | Notes |
| --- | --- | --- | --- |
| — | — | Not run | Written with the increment; nobody has walked it in a vault yet. |
```

- [ ] **Step 5: Mark the backlog item started**

In `docs/requirements/Asset placement.md` frontmatter set `status: "In Progress"` and `started: "2026-09-11"`.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add -A tests scripts docs
git commit -m "test(harness): asset placement captures and manual case

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec §1 → Tasks 1–2; §2 starting/tool/drawing/layers → Tasks 5–7; §2 Inspector → Task 8; §3 → Task 3 (recalculation needs no new subscription: `RenovationCommand` publishes `PlanRenovationChanged`, which `onPlanningChanged` handles — covered end-to-end by Task 8's material test after a placement); §4 placeholder and replace → Tasks 5, 6, 8; `DeleteAsset` unchanged by decision 7; testing and manual case → every task plus Task 9.
- `runtime.ts` and `EditorSurface.vue` are untouched: the task hangs off `elementTask.assets`, whose type flows from `SpatialEditing['elementTask']`.
