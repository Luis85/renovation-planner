# Structural Posts and Beams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a renovator draw timber-frame posts and overhead beams on a plan as two new element kinds, each with a load-bearing switch whose deletion warns.

**Architecture:** `post` and `beam` join `SpatialElementKind`. A post stores its cross-section as a closed four-corner outline, the same way `object` stores its shape. A beam stores a two-point axis plus a `width`. Both carry `loadBearing`. They ride every existing element mechanism (guarded renovation command, undo, groups, clipboard, move, renovation records). The plan geometry sidecar gains schema 11. The canvas classifies kinds through three small predicates in `SpatialElement.ts` instead of the scattered `kind === 'object'` lists.

**Tech Stack:** TypeScript, Vue 3 SFCs, vue-konva, zod, Vitest (node and jsdom), Obsidian API mock.

**Spec:** `docs/superpowers/specs/2026-09-13-structural-posts-and-beams-design.md`

## Global Constraints

- `CLAUDE.md` is authoritative. The layer bans stay in force: `domain/` imports nothing from `presentation/`, `application/` or `infrastructure/`.
- Inner loop per task: `npm run check:fast -- <paths>`. `npm run check` runs in CI on the pull request, not locally while other sessions work.
- If `node_modules` in this worktree is empty, run `npm ci` once before the first test run.
- Tabs for indentation, matching the surrounding files. The edit hook lints every file you write; answer its findings before moving on.
- Every user-visible string goes through `tr`/`t` with an `en` key and a `de` key. Sentence case.
- No literal colours anywhere. Canvas colours come from `ThemeTokens` (`accent`, `zoneStroke`, `canvasBackground`).
- Defaults, verbatim from the spec: post section 140 × 140 mm, beam width 160 mm, `loadBearing: true` for every new post or beam.
- A beam's `width` is finite, `> 0` and `<= 1e6` mm.
- Posts are never hosted by a wall.
- Deletion of a load-bearing element stays possible and undoable. The confirmation appends one sentence naming the load-bearing items.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. This overrides any model name an implementer would write for itself.

---

### Task 1: Domain facts for posts and beams

**Files:**
- Create: `src/domain/spatial/structuralElement.ts`
- Modify: `src/domain/spatial/SpatialElement.ts`
- Modify: `src/domain/spatial/stairGeometry.ts` (`spatialElementFootprint`)
- Modify: `src/domain/spatial/structureGeometry.ts` (`scaleStructure`, the `elements` map on the line that scales `stair.width`)
- Test: `tests/domain/spatial/structuralElement.test.ts`

**Interfaces:**
- Produces, from `src/domain/spatial/SpatialElement.ts`:
  - `SpatialElementKind` gains `'post' | 'beam'`.
  - `SpatialElement` gains `readonly width?: number` and `readonly loadBearing?: boolean`.
  - `outlineKind(kind: string | undefined): boolean` is true for `'object' | 'post'`.
  - `derivedFootprintKind(kind: string | undefined): boolean` is true for `'stair' | 'asset' | 'beam'`.
  - `closedFootprintKind(kind: string | undefined): boolean` is the union of the two.
- Produces, from `src/domain/spatial/structuralElement.ts`:
  - `DEFAULT_POST_SECTION: { readonly width: 140; readonly depth: 140 }`
  - `DEFAULT_BEAM_WIDTH = 160`
  - `postOutline(centre: Point, width: number, depth: number): Point[]`
  - `beamOutline(points: readonly Point[], width: number): Point[]`
  - `postSection(points: readonly Point[]): { width: number; depth: number } | null`
  - `resizedPost(points: readonly Point[], width: number, depth: number): Point[] | null`
- Produces: `spatialElementFootprint` returns `beamOutline(points, width)` for a beam.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/spatial/structuralElement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { closedFootprintKind, derivedFootprintKind, outlineKind, validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { beamOutline, DEFAULT_BEAM_WIDTH, DEFAULT_POST_SECTION, postOutline, postSection, resizedPost } from '../../../src/domain/spatial/structuralElement';
import { spatialElementFootprint } from '../../../src/domain/spatial/stairGeometry';
import { scaleStructure } from '../../../src/domain/spatial/structureGeometry';
import { groupPoints } from '../../../src/domain/spatial/groupGeometry';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';

const post: SpatialElement = { id: 'element-post', kind: 'post', loadBearing: true, points: postOutline({ x: 1000, y: 500 }, 140, 140) };
const beam: SpatialElement = { id: 'element-beam', kind: 'beam', loadBearing: true, width: 160, points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };

describe('structural posts and beams', () => {
	it('draws a post as its cross-section centred on a point and reads the section back', () => {
		expect(post.points).toEqual([{ x: 930, y: 430 }, { x: 1070, y: 430 }, { x: 1070, y: 570 }, { x: 930, y: 570 }]);
		expect(postSection(post.points)).toEqual({ width: 140, depth: 140 });
		expect(postSection(post.points.slice(0, 3))).toBeNull();
		expect(DEFAULT_POST_SECTION).toEqual({ width: 140, depth: 140 });
		expect(DEFAULT_BEAM_WIDTH).toBe(160);
	});

	it('resizes a rotated post about its centre and keeps the bearing of its first edge', () => {
		const rotated = [{ x: 0, y: -100 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: -100, y: 0 }];
		const resized = resizedPost(rotated, 200, 100);
		if (resized === null) throw new Error('a four-corner post resizes');
		const section = postSection(resized);
		expect(section?.width).toBeCloseTo(200); expect(section?.depth).toBeCloseTo(100);
		expect(resized.reduce((sum, point) => sum + point.x, 0) / 4).toBeCloseTo(0);
		expect(resized.reduce((sum, point) => sum + point.y, 0) / 4).toBeCloseTo(0);
		expect(Math.atan2(resized[1].y - resized[0].y, resized[1].x - resized[0].x)).toBeCloseTo(Math.PI / 4);
		expect(resizedPost(rotated.slice(0, 3), 200, 100)).toBeNull();
	});

	it('widens a beam axis into the band it covers and refuses a degenerate axis', () => {
		expect(beamOutline(beam.points, 160)).toEqual([{ x: 0, y: 80 }, { x: 3000, y: 80 }, { x: 3000, y: -80 }, { x: 0, y: -80 }]);
		expect(beamOutline([{ x: 0, y: 0 }, { x: 0, y: 0 }], 160)).toEqual([]);
		expect(beamOutline(beam.points, 0)).toEqual([]);
		expect(spatialElementFootprint(beam)).toEqual(beamOutline(beam.points, 160));
		expect(spatialElementFootprint(post)).toEqual(post.points);
	});

	it('holds a post and a beam to their own fields, and every other kind to none of them', () => {
		expect(validSpatialElement(post)).toBe(true);
		expect(validSpatialElement(beam)).toBe(true);
		expect(validSpatialElement({ ...beam, loadBearing: false })).toBe(true);
		const refused: SpatialElement[] = [
			{ ...post, loadBearing: undefined }, { ...post, width: 160 }, { ...post, points: post.points.slice(0, 2) },
			{ ...beam, width: undefined }, { ...beam, width: 0 }, { ...beam, width: Number.NaN }, { ...beam, width: 2e6 }, { ...beam, loadBearing: undefined },
			{ ...beam, points: [...beam.points, { x: 3000, y: 1000 }] }, { ...beam, points: [beam.points[0], beam.points[0]] },
			{ id: 'element-path', kind: 'path', points: beam.points, loadBearing: true }, { id: 'element-path', kind: 'path', points: beam.points, width: 160 },
		];
		for (const value of refused) expect(validSpatialElement(value), JSON.stringify(value)).toBe(false);
	});

	it('names which kinds are stored outlines and which draw a derived footprint', () => {
		expect(['object', 'post'].every(kind => outlineKind(kind))).toBe(true);
		expect(['stair', 'asset', 'beam'].every(kind => derivedFootprintKind(kind))).toBe(true);
		expect(['object', 'post', 'stair', 'asset', 'beam'].every(kind => closedFootprintKind(kind))).toBe(true);
		expect(['path', 'fence', 'measurement', 'arrow', undefined].some(kind => closedFootprintKind(kind))).toBe(false);
	});

	it('scales a beam width with calibration and frames a group by the beam band', () => {
		const structure = { ...EMPTY_STRUCTURE, elements: [post, beam] };
		const scaled = scaleStructure(structure, 2);
		expect(scaled.elements?.[1]).toMatchObject({ width: 320, points: [{ x: 0, y: 0 }, { x: 6000, y: 0 }] });
		expect(scaled.elements?.[0]).not.toHaveProperty('width');
		expect(groupPoints({ objects: [], structure }, [beam.id])).toEqual(beamOutline(beam.points, 160));
	});
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/domain/spatial/structuralElement.test.ts`
Expected: FAIL. Type errors for the missing module `structuralElement` and for `'post'`/`'beam'` not being assignable to `SpatialElementKind`.

- [ ] **Step 3: Create `src/domain/spatial/structuralElement.ts`**

```ts
import type { Point } from '../../core/geometry/Point';

/** A new post's cross-section, world mm (structural posts and beams design §3). */
export const DEFAULT_POST_SECTION = { width: 140, depth: 140 } as const;
/** A new beam's width across its axis, world mm (design §3). */
export const DEFAULT_BEAM_WIDTH = 160;

/** Four corners of a post centred on `centre` whose first edge bears `angle` radians; the outline IS the stored geometry. */
function corners(centre: Point, width: number, depth: number, angle: number): Point[] {
	const ux = Math.cos(angle), uy = Math.sin(angle), halfWidth = width / 2, halfDepth = depth / 2;
	return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({
		x: centre.x + along * halfWidth * ux - across * halfDepth * uy,
		y: centre.y + along * halfWidth * uy + across * halfDepth * ux,
	}));
}

/** An axis-aligned post outline centred on `centre`. */
export function postOutline(centre: Point, width: number, depth: number): Point[] {
	return corners(centre, width, depth, 0);
}

/** Width and depth read back off a post outline: its first and second edges. */
export function postSection(points: readonly Point[]): { width: number; depth: number } | null {
	if (points.length !== 4) return null;
	return { width: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), depth: Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y) };
}

/** A post with a new section about the same centre, keeping the bearing of its first edge so a rotation survives. */
export function resizedPost(points: readonly Point[], width: number, depth: number): Point[] | null {
	if (points.length !== 4) return null;
	const centre = { x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4 };
	return corners(centre, width, depth, Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x));
}

/** The band a beam covers in plan: its axis widened by `width`, or nothing for a degenerate axis or width. */
export function beamOutline(points: readonly Point[], width: number): Point[] {
	if (points.length !== 2 || !(width > 0)) return [];
	const [start, end] = points, length = Math.hypot(end.x - start.x, end.y - start.y);
	if (!(length > 0)) return [];
	const nx = -(end.y - start.y) / length * width / 2, ny = (end.x - start.x) / length * width / 2;
	return [{ x: start.x + nx, y: start.y + ny }, { x: end.x + nx, y: end.y + ny }, { x: end.x - nx, y: end.y - ny }, { x: start.x - nx, y: start.y - ny }];
}
```

Check the corner arithmetic against the first test. At angle 0, corner `[-1, -1]` of centre (1000, 500) at 140 × 140 is (930, 430). `-across * halfDepth * uy` is `+70 * 0 = 0`. `y` is `500 + (-70) * 0 + (-70) * 1 = 430`. That matches.

- [ ] **Step 4: Extend `src/domain/spatial/SpatialElement.ts`**

Replace the kind union and the interface:

```ts
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement' | 'stair' | 'arrow' | 'asset' | 'post' | 'beam';
export interface SpatialElement {
	readonly id: string;
	readonly kind: SpatialElementKind;
	/** Object and post outlines close implicitly; linear elements keep ordered open points; an asset is `[anchor, facingPoint]`; a beam is its two-point axis. */
	readonly points: readonly Point[];
	readonly stair?: StairOptions;
	/** Only an `'asset'` placement carries one, and it always does; its outline is derived from that asset. */
	readonly assetId?: string;
	/** A dragged name tag's offset from its automatic position, world mm (ADR-0029); absent while automatic. */
	readonly labelOffset?: Vector;
	/** A beam's width across its axis, world mm. Only a `'beam'` carries one, and it always does. */
	readonly width?: number;
	/** Whether a post or beam carries load. Only `'post'` and `'beam'` carry one, and both always do. */
	readonly loadBearing?: boolean;
}
```

Replace the `SPATIAL_ELEMENT_KINDS` line, and add the three predicates plus the field check directly below it:

```ts
const SPATIAL_ELEMENT_KINDS: readonly SpatialElementKind[] = ['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam'];

/** Kinds whose stored `points` are themselves a closed outline. */
export function outlineKind(kind: string | undefined): boolean { return kind === 'object' || kind === 'post'; }
/** Kinds drawn and hit through an outline derived from their points: a stair's centreline, an asset's placement, a beam's axis. */
export function derivedFootprintKind(kind: string | undefined): boolean { return kind === 'stair' || kind === 'asset' || kind === 'beam'; }
/** Every element kind the canvas treats as a closed shape. */
export function closedFootprintKind(kind: string | undefined): boolean { return outlineKind(kind) || derivedFootprintKind(kind); }

/** `loadBearing` belongs to a post or a beam and to nothing else; `width` belongs to a beam, which is exactly two points. */
function validStructuralFields(element: SpatialElement): boolean {
	if ((element.kind === 'post' || element.kind === 'beam') !== (typeof element.loadBearing === 'boolean')) return false;
	if (element.kind !== 'beam') return element.width === undefined;
	return element.width !== undefined && Number.isFinite(element.width) && element.width > 0 && element.width <= 1e6 && element.points.length === 2;
}
```

In `validSpatialElement`, add one line directly after the `(element.kind === 'asset') !== (element.assetId !== undefined)` line. Then change the `object` line:

```ts
	if (!validStructuralFields(element)) return false;
```

```ts
	if (outlineKind(element.kind)) return element.points.length >= 3;
```

A beam falls through to the existing final line, which requires two or more distinct consecutive points. `validStructuralFields` has already held it to exactly two.

- [ ] **Step 5: Derive a beam's footprint in `src/domain/spatial/stairGeometry.ts`**

Add the import at the top:

```ts
import { beamOutline } from './structuralElement';
```

Replace `spatialElementFootprint`:

```ts
/** Framing, hit testing and group bounds can consume full geometry without storing a duplicate outline. */
export function spatialElementFootprint(element: { readonly kind: string; readonly points: readonly Point[]; readonly stair?: StairOptions; readonly width?: number }): readonly Point[] {
	if (element.kind === 'beam') return element.width ? beamOutline(element.points, element.width) : [];
	if (element.kind !== 'stair') return element.points;
	return element.stair ? stairPlanGeometry(element.points, element.stair)?.outline ?? [] : [];
}
```

- [ ] **Step 6: Scale a beam's width in `src/domain/spatial/structureGeometry.ts`**

In `scaleStructure`'s `elements` map, the line holding `element.stair.width * factor`, add this spread after the `stair` spread:

```ts
...(element.width !== undefined ? { width: element.width * factor } : {}),
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `npm run check:fast -- tests/domain/spatial tests/application/commands/stairArrowGeometry.test.ts`
Expected: PASS. No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/domain/spatial tests/domain/spatial/structuralElement.test.ts
git commit -m "Add post and beam element kinds to the spatial domain

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Plan geometry sidecar schema 11

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts`
- Modify: `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` (import, `writtenSchema`, the `PlanGeometrySchemaV10.safeParse(migrated)` line)
- Modify: `src/application/commands/spatial/sameGeometryDocument.ts`
- Modify: `tests/plugin/persistence-wiring.test.ts` (`'plan-geometry': 10` becomes `11`)
- Test: `tests/application/commands/structuralGeometry.test.ts`

**Interfaces:**
- Consumes: the `SpatialElement` fields `width` and `loadBearing`, and `postOutline` (Task 1).
- Produces: `PlanGeometrySchemaV11` (exported) and `PlanGeometryDTO['schemaVersion']` including `11`. A sidecar holding a post or a beam is written as schema 11. `sameGeometryDocument` compares `width` and `loadBearing`.

- [ ] **Step 1: Write the failing test**

Create `tests/application/commands/structuralGeometry.test.ts`:

```ts
import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../../src/domain/spatial/structuralElement';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const post: SpatialElement = { id: 'element-post', kind: 'post', loadBearing: true, points: postOutline({ x: 1000, y: 500 }, 140, 140) };
const beam: SpatialElement = { id: 'element-beam', kind: 'beam', loadBearing: false, width: 160, points: [{ x: 0, y: 1500 }, { x: 4000, y: 1500 }] };

it('round-trips posts and beams as schema 11, which a build that stops at 10 refuses', async () => {
	const rig = await structureStack();
	const document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [post, beam] }, intended: { ...WALL_LOOP, elements: [{ ...beam, loadBearing: true }] } };
	expectOk(await rig.geometry.write(rig.plan.id, document, rig.baseline.version));
	expect(expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id)).document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(11);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 10));
	expect(() => older.migrateToLatest('plan-geometry', dto, 11)).toThrow('newer than this build supports');
	expect(expectDefined(PLAN_GEOMETRY_MIGRATIONS.find(step => step.toVersion === 11), 'schema 11 step').migrate({ schemaVersion: 10, revision: 3 })).toEqual({ schemaVersion: 11, revision: 3 });
});

it('treats width and load-bearing as geometry facts and refuses a malformed element before and after a write', async () => {
	const rig = await structureStack(), document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [post, beam] } };
	for (const changed of [{ ...beam, width: 200 }, { ...beam, loadBearing: true }]) {
		expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, elements: [post, changed] } })).toBe(false);
	}
	const before = [...rig.stack.vault.entries];
	for (const value of [{ ...beam, width: undefined }, { ...post, loadBearing: undefined }, { ...post, width: 160 }]) {
		expect((await rig.geometry.write(rig.plan.id, { ...document, structure: { ...document.structure, elements: [value] } }, rig.baseline.version)).ok).toBe(false);
	}
	expect([...rig.stack.vault.entries]).toEqual(before);
	expectOk(await rig.geometry.write(rig.plan.id, document, rig.baseline.version));
	const saved = expectOk(await rig.stack.store.read(rig.plan.id));
	for (const element of [{ ...beam, width: undefined }, { ...post, loadBearing: 'yes' }, { ...beam, kind: 'column' }]) {
		const invalid = JSON.stringify({ ...saved.dto, structure: { ...saved.dto.structure, elements: [element] } });
		rig.stack.vault.entries.set(saved.path, invalid);
		expect((await rig.geometry.read(rig.plan.id)).ok).toBe(false);
		expect(rig.stack.vault.entries.get(saved.path)).toBe(invalid);
	}
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/application/commands/structuralGeometry.test.ts`
Expected: FAIL. The write is refused, or reads back without the post, because schema 10's `kind` enum has no `post`. The migration step lookup throws `schema 11 step`.

- [ ] **Step 3: Declare schema 11 in `src/infrastructure/persistence/dto/planGeometry.ts`**

Loosen the two existing rule parameter types, so the wider v11 element can reuse them:

```ts
const stairRule = (element: { readonly kind: string; readonly stair?: unknown }) => element.kind === 'stair' ? element.stair !== undefined : element.stair === undefined;
const assetRule = (element: { readonly kind: string; readonly assetId?: string }) => (element.kind === 'asset') === (element.assetId !== undefined);
```

Replace the last two lines of the file (the `PlanGeometrySchema` union and `PlanGeometryDTO`) with:

```ts
/** Schema 11: structural posts and beams (structural posts and beams design §4). */
const SpatialElementShapeV11 = SpatialElementShapeV9.extend({
	kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam']),
	labelOffset: LabelOffsetSchema.optional(), width: z.number().positive().max(1e6).optional(), loadBearing: z.boolean().optional(),
});
const structuralRule = (element: z.infer<typeof SpatialElementShapeV11>) => (element.kind === 'beam') === (element.width !== undefined)
	&& (element.kind === 'post' || element.kind === 'beam') === (element.loadBearing !== undefined);
const STRUCTURAL_MESSAGE = { message: 'A beam, and only a beam, has a width; a post or a beam, and only those, says whether it is load-bearing.' };
const SpatialElementSchemaV11 = SpatialElementShapeV11.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE);
const StructureSchemaV11 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV11).optional() });
export const PlanGeometrySchemaV11 = PlanGeometrySchemaV10.extend({ schemaVersion: z.literal(11), structure: StructureSchemaV11.optional(), intended: StructureSchemaV11.optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9, PlanGeometrySchemaV10, PlanGeometrySchemaV11]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV11>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 };
```

`PlanGeometrySchemaV10` stops being referenced outside this file after Step 5. Keep its `export` only if `npm run analyze` does not report it as an unused export. Otherwise drop the `export` keyword.

- [ ] **Step 4: Add the migration step**

In `plan-geometry.migrations.ts`, append after the `fromVersion: 9` entry, before the closing `];`:

```ts
}, {
	fromVersion: 10, toVersion: 11,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 11 } : input,
```

- [ ] **Step 5: Write schema 11 and validate against it in `PlanGeometryStore.ts`**

Change the import to `import { PlanGeometrySchema, PlanGeometrySchemaV11 } from '../../persistence/dto/planGeometry';`. Change the line `const validated = PlanGeometrySchemaV10.safeParse(migrated);` to use `PlanGeometrySchemaV11`.

Add this function above `writtenSchema`:

```ts
/** A post or a beam anywhere needs schema 11; an older build must refuse it rather than drop it. */
function hasStructuralElement(dto: Pick<PlanGeometryDTO, 'structure' | 'intended'>): boolean {
	return [dto.structure, dto.intended].some(structure => structure?.elements?.some(element => element.kind === 'post' || element.kind === 'beam') === true);
}
```

Make it the first line of `writtenSchema`:

```ts
	if (hasStructuralElement(dto)) return 11;
```

- [ ] **Step 6: Compare the new facts in `sameGeometryDocument.ts`**

In `structureContent`, the element tuple ends `element.assetId ?? null, offset(element.labelOffset)])`. Extend it to:

```ts
element.assetId ?? null, offset(element.labelOffset), element.width ?? null, element.loadBearing ?? null])
```

- [ ] **Step 7: Raise the pinned latest version**

In `tests/plugin/persistence-wiring.test.ts`, change `'plan-geometry': 10,` to `'plan-geometry': 11,`.

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npm run check:fast -- tests/application/commands tests/plugin/persistence-wiring.test.ts tests/infrastructure`
Expected: PASS. `labelOffsetGeometry.test.ts` still expects schema 10 for a caption-only document, and it still gets 10.

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure src/application/commands/spatial/sameGeometryDocument.ts tests/application/commands/structuralGeometry.test.ts tests/plugin/persistence-wiring.test.ts
git commit -m "Persist posts and beams as plan geometry schema 11

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Canvas geometry — selection, outlines, snapping, rotation

**Files:**
- Modify: `src/presentation/editor/structure/structureCandidates.ts`
- Modify: `src/presentation/editor/structure/structureRecords.ts`
- Modify: `src/presentation/editor/selection/resolveSelectionTarget.ts` (`priority`, `containsCandidate`)
- Modify: `src/presentation/editor/selection/spatialOutlinePoints.ts`
- Modify: `src/presentation/editor/selection/MarqueeSelection.ts` (`hit`)
- Modify: `src/presentation/editor/selection/curvedCandidateIntersection.ts`
- Modify: `src/presentation/editor/layers/InteractionLayer.vue` (`hoverClosed`, `multiOutlines`)
- Modify: `src/presentation/editor/renovation/RenovationLayer.vue` (the `closed:` expression)
- Modify: `src/presentation/editor/snapping/roomSnapCandidates.ts` (`collectElement`)
- Modify: `src/presentation/editor/elements/objectRotation.ts` (`polygon`)
- Modify: `src/presentation/editor/elements/rotationControl.ts` (`edgesOf`'s closed list)
- Modify: `src/presentation/editor/elements/ElementMove.ts` (`hasPointHandles`)
- Modify: `src/presentation/editor/elements/elementDraft.ts` (`acceptsElementPoints`)
- Modify: `src/presentation/editor/elements/ElementShapes.vue` (`closed`)
- Test: `tests/presentation/editor/structuralCanvasGeometry.test.ts`

**Interfaces:**
- Consumes: `outlineKind`, `derivedFootprintKind`, `closedFootprintKind`, `postOutline`, `beamOutline` (Task 1).
- Produces:
  - A beam candidate or record carries `hitPoints = beamOutline(points, width)`.
  - A post is hit, outlined, snapped and rotated as a closed polygon.
  - Body priority: a post ranks 4, like an object, so it wins over the wall it stands in. A beam ranks 1, like other linear elements.
  - `hasPointHandles('beam') === true`, `hasPointHandles('post') === false`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structuralCanvasGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { beamOutline, postOutline } from '../../../src/domain/spatial/structuralElement';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { structureRecords } from '../../../src/presentation/editor/structure/structureRecords';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { spatialOutlinePoints } from '../../../src/presentation/editor/selection/spatialOutlinePoints';
import { roomSnapCandidates } from '../../../src/presentation/editor/snapping/roomSnapCandidates';
import { rotationPivot } from '../../../src/presentation/editor/elements/objectRotation';
import { hasPointHandles } from '../../../src/presentation/editor/elements/ElementMove';
import { acceptsElementPoints } from '../../../src/presentation/editor/elements/elementDraft';

const wall = { id: 'wall-frame', start: { x: 0, y: 1000 }, end: { x: 4000, y: 1000 }, height: 2500, thickness: 160 };
const post: SpatialElement = { id: 'element-post', kind: 'post', loadBearing: true, points: postOutline({ x: 2000, y: 1000 }, 140, 140) };
const beam: SpatialElement = { id: 'element-beam', kind: 'beam', loadBearing: true, width: 160, points: [{ x: 2000, y: 0 }, { x: 2000, y: 3000 }] };
const structure = { ...EMPTY_STRUCTURE, walls: [wall], elements: [post, beam] };

describe('posts and beams on the canvas', () => {
	it('hits a post standing in a wall before the wall, and a beam across its whole width', () => {
		const candidates = structureCandidates(structure);
		const at = (x: number, y: number) => resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 });
		expect(at(2050, 1040)).toEqual({ kind: 'body', id: post.id });
		expect(at(2070, 2500)).toEqual({ kind: 'body', id: beam.id });
		expect(at(1000, 1000)).toEqual({ kind: 'body', id: wall.id });
	});

	it('outlines a post as a closed shape and a beam as its band, in candidates and records alike', () => {
		const [postCandidate, beamCandidate] = structureCandidates(structure);
		expect(postCandidate.hitPoints).toBeUndefined();
		expect(spatialOutlinePoints(postCandidate, 0.25)).toEqual(spatialOutlinePoints({ ...postCandidate, kind: 'object' }, 0.25));
		expect(beamCandidate.hitPoints).toEqual(beamOutline(beam.points, 160));
		const records = structureRecords(structure, 'plan-a', [{ id: post.id, name: 'Post 1' }, { id: beam.id, name: 'Kitchen beam' }]);
		expect(records.find(item => item.id === post.id)?.areaMm2).toBe(19600);
		expect(records.find(item => item.id === beam.id)).toMatchObject({ name: 'Kitchen beam', hitPoints: beamOutline(beam.points, 160), areaMm2: 480000 });
	});

	it('snaps to a post outline including its closing edge, and gives a beam point handles but a post none', () => {
		const snap = roomSnapCandidates([], { ...EMPTY_STRUCTURE, elements: [post] });
		expect(snap.edges).toContainEqual({ start: post.points[3], end: post.points[0] });
		expect(hasPointHandles('beam')).toBe(true);
		expect(hasPointHandles('post')).toBe(false);
	});

	it('rotates a post about its centre and refuses a post outline that crosses itself', () => {
		expect(rotationPivot({ id: post.id, kind: 'post', points: post.points })).toEqual({ x: 2000, y: 1000 });
		expect(acceptsElementPoints(post, post.points)).toBe(true);
		expect(acceptsElementPoints(post, [post.points[0], post.points[2], post.points[1], post.points[3]])).toBe(false);
	});
});
```

This file runs in node. If `scripts/vitest-no-ssr-sfc.mjs` throws because an import reaches a `.vue` file, add `// @vitest-environment jsdom` as the file's first line. Leave the imports as they are.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/structuralCanvasGeometry.test.ts`
Expected: FAIL. The wall wins over the post at (2050, 1040). The beam candidate has no `hitPoints`. The records report area 0 for the post. `hasPointHandles('beam')` is false. The post pivot is a linear centre, not (2000, 1000). The bow-tie outline is accepted.

- [ ] **Step 3: Route every closed-kind question through the predicates**

Import the needed predicates from `../../../domain/spatial/SpatialElement` in each file (path relative to that file). Make exactly these replacements:

`structureCandidates.ts`, the elements line:
```ts
...(structure.elements ?? []).map(element => ({ ...element, ...(derivedFootprintKind(element.kind) ? { hitPoints: elementFootprint(element, shapeOf) } : {}) })),
```

`structureRecords.ts`, inside the elements map:
```ts
const footprint = elementFootprint(element, shapeOf), closed = closedFootprintKind(element.kind);
const measured = closed ? area({ points: footprint }) : null;
return { ...element, ...(derivedFootprintKind(element.kind) ? { hitPoints: footprint } : {}), name: names.get(element.id) ?? element.id, planId, zoneType: element.kind, areaMm2: measured?.ok ? measured.value : 0 };
```

`resolveSelectionTarget.ts`:
```ts
const priority = (candidate: SpatialObjectCandidate): number => outlineKind(candidate.kind) || candidate.kind === 'stair' || candidate.kind === 'asset' ? 4 : candidate.kind === 'opening' ? 3 : candidate.kind === 'wall' ? 2 : candidate.kind ? 1 : 0;
```
and in `containsCandidate`:
```ts
	if (candidate.kind && !outlineKind(candidate.kind)) return nearLine(candidate, point, tolerance);
```

`spatialOutlinePoints.ts`:
```ts
	if (shape.kind === undefined || outlineKind(shape.kind)) return polygonPolyline(shape, tolerance);
```

`MarqueeSelection.ts` in `hit`:
```ts
	const closed = !!candidate.hitPoints || !candidate.kind || outlineKind(candidate.kind);
```

`curvedCandidateIntersection.ts`:
```ts
	const closed = candidate.kind === undefined || outlineKind(candidate.kind);
```

`InteractionLayer.vue`: add `import { closedFootprintKind } from '../../../domain/spatial/SpatialElement';` to the script block. Then:
```ts
	return kind === undefined || closedFootprintKind(kind);
```
```ts
		closed: zone.kind === undefined || closedFootprintKind(zone.kind),
```

`RenovationLayer.vue`, in the object literal holding `closed: element?.kind === 'object' || …`, replace that expression with `closed: closedFootprintKind(element?.kind),` and add the import.

`roomSnapCandidates.ts` in `collectElement`:
```ts
	if (outlineKind(element.kind) && element.points.length > 2) into.edges.push({ start: element.points[element.points.length - 1], end: element.points[0] });
```

`objectRotation.ts`:
```ts
function polygon(shape: RotationShape): boolean { return outlineKind(shape.kind) || shape.kind === 'room' || shape.kind === 'area'; }
```

`rotationControl.ts` in `edgesOf`:
```ts
	const points = edgePoints(shape), closed = shape.hitPoints !== undefined || ['room', 'area', 'object', 'post', 'group', 'stair'].includes(shape.kind);
```

`ElementMove.ts`:
```ts
/** Elements whose individual points drag; a stair, a post and an asset move only as a body. */
export const hasPointHandles = (kind: string | undefined): boolean => kind === 'arrow' || kind === 'path' || kind === 'fence' || kind === 'measurement' || kind === 'object' || kind === 'beam';
```

`elementDraft.ts`:
```ts
	return validSpatialElement({ ...element, points }) && (!outlineKind(element.kind) || areaOutline(points).ok);
```

`ElementShapes.vue`, inside the `shapes` computed:
```ts
	const selected = props.selectedIds.includes(element.id), closed = outlineKind(element.kind), ruler = element.kind === 'measurement' && element.points.length === 2;
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run check:fast -- tests/presentation/editor/structuralCanvasGeometry.test.ts tests/presentation/editor/selection tests/presentation/editor/stairsArrows.test.ts tests/presentation/editor/tools/marqueeSelection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor tests/presentation/editor/structuralCanvasGeometry.test.ts
git commit -m "Hit, outline, snap and rotate posts and beams on the canvas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Creating posts and beams

**Files:**
- Create: `src/presentation/i18n/locales/en/structural.ts`, `src/presentation/i18n/locales/de/structural.ts`
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts` (import and spread)
- Modify: `src/presentation/editor/tools/editor-tool.ts` (`ToolId`)
- Modify: `src/presentation/editor/elements/elementDraft.ts`
- Modify: `src/presentation/editor/elements/elementTask.ts` (`addPoint`, new `placePost`, `finish`)
- Create: `src/presentation/editor/elements/StructuralDraftFields.vue`
- Modify: `src/presentation/editor/elements/ElementTaskForm.vue`
- Create: `src/presentation/editor/elements/StructuralShape.vue`
- Modify: `src/presentation/editor/elements/ElementShapes.vue`
- Modify: `src/presentation/editor/structure/StructureLayer.vue` (element preview computed)
- Modify: `src/presentation/editor/add/creationCatalogue.ts`, `src/presentation/editor/add/AddMenu.vue`
- Modify: `src/plugin/editorIconRegistration.ts`
- Modify: `src/presentation/editor/shell/zoneTypeLabel.ts`, `src/presentation/editor/shell/TemporaryToolBanner.vue`, `src/presentation/editor/surface/cursor.ts`, `src/presentation/editor/snapping/editorSnapping.ts`
- Modify tests: `tests/presentation/editor/add/creationCatalogue.test.ts`, `tests/presentation/editor/stairsArrows.test.ts`, `tests/plugin/editorIconRegistration.test.ts`
- Test: `tests/presentation/editor/structuralCreation.test.ts`

**Interfaces:**
- Consumes: `postOutline`, `DEFAULT_POST_SECTION`, `DEFAULT_BEAM_WIDTH` (Task 1). Schema 11 writes (Task 2). `outlineKind` (Task 3).
- Produces:
  - `ToolId` gains `'place-post' | 'draw-beam'`.
  - `ElementDraft` gains `post: { width: number; depth: number }` and `beamWidth: number`.
  - `CreationEntryId` gains `'post' | 'beam'`.
  - Every structural locale key below. Tasks 5 and 6 use `editor.structural.post-summary`, `beam-summary`, `load-bearing`, `apply`, `width-invalid`, `depth-invalid` and `delete-warning`.
  - Konva node names `post-outline`, `post-diagonal`, `beam-edge`.
  - Icon names `rp-post`, `rp-beam`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structuralCreation.test.ts`:

```ts
// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';
import { postOutline } from '../../../src/domain/spatial/structuralElement';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
let unregister: () => void;
beforeEach(() => { unregister = registerEditorIcons(); });
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); unregister(); });

async function setup(entry: 'post' | 'beam'): Promise<Rig> {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	await rig.wrapper.get('[data-rp-action="add"]').trigger('click');
	expect(rig.wrapper.findAll('[data-rp-entry]')).toHaveLength(16);
	expect(rig.wrapper.find('[data-icon-missing]').exists()).toBe(false);
	await rig.wrapper.get(`[data-rp-entry="${entry}"]`).trigger('click');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, `${entry} baseline`);
	return rig;
}
function click(rig: Rig, x: number, y: number): void {
	rig.runtime.toolManager.pointerDown(pointerAt(x, y)); rig.runtime.toolManager.pointerUp(pointerAt(x, y));
}

it('places one post per click at the typed section, stays on the tool, and undoes each post alone', async () => {
	const rig = await setup('post');
	expect(rig.runtime.activeToolId.value).toBe('place-post');
	await rig.wrapper.get('input[name="structural-width"]').setValue('0,2');
	click(rig, 1000, 500);
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'first post');
	const first = expectDefined(rig.project.structure.elements?.[0], 'first post');
	expect(first).toMatchObject({ kind: 'post', loadBearing: true, points: postOutline({ x: 1000, y: 500 }, 200, 140) });
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Post');
	expect(rig.runtime.activeToolId.value).toBe('place-post');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'next post baseline');
	expect(rig.runtime.elementTask.draft.post).toEqual({ width: 200, depth: 140 });
	click(rig, 3000, 2500);
	await settleUntil(() => rig.project.structure.elements?.length === 2, 'second post');
	expect(rig.stage.find('.post-outline')).toHaveLength(2);
	expect(rig.stage.find('.post-diagonal')).toHaveLength(4);
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(11);
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements).toEqual([first]);
});

it('saves a beam on its second click with the typed width and draws it as two dashed edges', async () => {
	const rig = await setup('beam');
	expect(rig.wrapper.find('input[name="structural-depth"]').exists()).toBe(false);
	await rig.wrapper.get('input[name="structural-width"]').setValue('0,24');
	click(rig, 500, 3000); click(rig, 3500, 3000);
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved beam');
	const beam = expectDefined(rig.project.structure.elements?.[0], 'saved beam');
	expect(beam).toMatchObject({ kind: 'beam', width: 240, loadBearing: true, points: [{ x: 500, y: 3000 }, { x: 3500, y: 3000 }] });
	expect(rig.selection.selectedIds).toEqual([beam.id]);
	const edges = rig.stage.find<Konva.Line>('.beam-edge');
	expect(edges).toHaveLength(2);
	expect(edges[0].dash()).toHaveLength(2);
});

it('refuses to place while a typed section is unreadable, then places with the corrected one', async () => {
	const rig = await setup('post'), before = [...rig.stack.vault.entries];
	await rig.wrapper.get('input[name="structural-depth"]').setValue('-');
	expect(rig.wrapper.get('input[name="structural-depth"]').attributes('aria-invalid')).toBe('true');
	click(rig, 1000, 500); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	expect([...rig.stack.vault.entries]).toEqual(before);
	await rig.wrapper.get('input[name="structural-depth"]').setValue('0,1');
	click(rig, 1000, 500);
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'corrected post');
	expect(rig.project.structure.elements?.[0].points).toEqual(postOutline({ x: 1000, y: 500 }, 140, 100));
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/structuralCreation.test.ts`
Expected: FAIL. The menu has 14 entries and there is no `[data-rp-entry="post"]`.

- [ ] **Step 3: Add the locale modules**

`src/presentation/i18n/locales/en/structural.ts`:

```ts
export const structuralEn = {
	'editor.add.post.label': 'Post',
	'editor.add.post.description': 'A column or timber-frame post that carries load',
	'editor.add.post.synonyms': 'Column, pillar, stud, support, timber frame',
	'editor.add.beam.label': 'Beam',
	'editor.add.beam.description': 'A ceiling beam or downstand above the room',
	'editor.add.beam.synonyms': 'Joist, girder, lintel, timber frame',
	'editor.post.banner': 'Click to place a post. The tool stays on for the next one.',
	'editor.beam.banner': 'Click the start and the end of the beam.',
	'editor.structural.width': 'Width (m)',
	'editor.structural.depth': 'Depth (m)',
	'editor.structural.width-invalid': 'Enter a width between 0.001 and 1000 m.',
	'editor.structural.depth-invalid': 'Enter a depth between 0.001 and 1000 m.',
	'editor.structural.post-summary': '{width} × {depth} m',
	'editor.structural.beam-summary': '{length} m · {width} m wide',
	'editor.structural.load-bearing': 'Load-bearing',
	'editor.structural.apply': 'Apply dimensions',
	'editor.structural.delete-warning': 'Load-bearing: {names}. Remove only after a structural check.',
} as const;
```

`src/presentation/i18n/locales/de/structural.ts`:

```ts
import type { structuralEn } from '../en/structural';
export const structuralDe: Record<keyof typeof structuralEn, string> = {
	'editor.add.post.label': 'Stütze',
	'editor.add.post.description': 'Ein Pfosten oder Fachwerkständer, der Last trägt',
	'editor.add.post.synonyms': 'Pfosten, Ständer, Pfeiler, Säule, Fachwerk',
	'editor.add.beam.label': 'Balken',
	'editor.add.beam.description': 'Ein Deckenbalken oder Unterzug über dem Raum',
	'editor.add.beam.synonyms': 'Unterzug, Deckenbalken, Träger, Fachwerk',
	'editor.post.banner': 'Klicken, um eine Stütze zu setzen. Das Werkzeug bleibt für die nächste aktiv.',
	'editor.beam.banner': 'Anfang und Ende des Balkens anklicken.',
	'editor.structural.width': 'Breite (m)',
	'editor.structural.depth': 'Tiefe (m)',
	'editor.structural.width-invalid': 'Geben Sie eine Breite zwischen 0,001 und 1000 m ein.',
	'editor.structural.depth-invalid': 'Geben Sie eine Tiefe zwischen 0,001 und 1000 m ein.',
	'editor.structural.post-summary': '{width} × {depth} m',
	'editor.structural.beam-summary': '{length} m · {width} m breit',
	'editor.structural.load-bearing': 'Tragend',
	'editor.structural.apply': 'Maße übernehmen',
	'editor.structural.delete-warning': 'Tragendes Bauteil: {names}. Entfernen nur nach statischer Prüfung.',
};
```

In `en/editor.ts`, add `import { structuralEn } from './structural';` beside the `stairsArrowsEn` import, and `...structuralEn,` on the line after `...stairsArrowsEn,`. In `de/editor.ts`, add `import { structuralDe } from './structural';` beside `stairsArrowsDe`, and `...structuralDe,` after `...stairsArrowsDe,`.

- [ ] **Step 4: Register the tools and the draft state**

`editor-tool.ts`: after the `| 'draw-arrow'` line in `ToolId`, add:
```ts
	| 'place-post'
	| 'draw-beam'
```

`elementDraft.ts`: add `import { DEFAULT_BEAM_WIDTH, DEFAULT_POST_SECTION } from '../../../domain/spatial/structuralElement';` and replace the declarations from `ElementToolId` through `draftElement`. `acceptsElementPoints` keeps its Task 3 body.

```ts
export type ElementToolId = 'place-object' | 'draw-path' | 'draw-fence' | 'measure' | 'place-stair' | 'draw-arrow' | 'place-post' | 'draw-beam';
/** No tool here produces `'asset'` yet — placement lands through its own flow (plan editor asset placement design §2). */
export const ELEMENT_TOOLS: Readonly<Record<ElementToolId, Exclude<SpatialElementKind, 'asset'>>> = {
	'place-object': 'object', 'draw-path': 'path', 'draw-fence': 'fence', measure: 'measurement',
	'place-stair': 'stair', 'draw-arrow': 'arrow', 'place-post': 'post', 'draw-beam': 'beam',
};
export function isElementTool(id: ToolId | null): id is ElementToolId { return id !== null && id in ELEMENT_TOOLS; }
export interface ElementDraft {
	kind: Exclude<SpatialElementKind, 'asset'>; name: string; points: Point[]; cursor: Point | null;
	text: { x: string; y: string };
	rectangle: ObjectRectangleText;
	stair: StairOptions;
	/** The section the next post is placed with, world mm. */
	post: { width: number; depth: number };
	/** The width the next beam is saved with, world mm. */
	beamWidth: number;
	pendingInput: boolean;
	loading: boolean; busy: boolean; conflict: boolean; error: AppError | null;
}
export function createElementDraft(): ElementDraft {
	return reactive({ kind: 'object', name: '', points: [], cursor: null, text: { x: '', y: '' }, rectangle: emptyObjectRectangle(), stair: { ...DEFAULT_STAIR },
		post: { ...DEFAULT_POST_SECTION }, beamWidth: DEFAULT_BEAM_WIDTH, pendingInput: false, loading: false, busy: false, conflict: false, error: null });
}
```

Keep `discardElementGeometry` and `acceptsElementPoints` as they are. Replace `draftElement`:

```ts
/** A new post or beam starts load-bearing (structural posts and beams design §3); a beam also carries the typed width. */
function structuralFields(draft: ElementDraft): Pick<SpatialElement, 'width' | 'loadBearing'> {
	if (draft.kind === 'beam') return { width: draft.beamWidth, loadBearing: true };
	return draft.kind === 'post' ? { loadBearing: true } : {};
}
export function draftElement(draft: ElementDraft, id = 'element-draft'): NamedSpatialElement | null {
	const element = { id, kind: draft.kind, name: draft.name.trim(), points: draft.points.map(point => ({ ...point })), ...(draft.kind === 'stair' ? { stair: { ...draft.stair } } : {}), ...structuralFields(draft) };
	return element.name && acceptsElementPoints(element, element.points) ? element : null;
}
```

- [ ] **Step 5: Place a post per click and save a beam on its second point in `elementTask.ts`**

Add `import { postOutline } from '../../../domain/spatial/structuralElement';`. Replace `addPoint`:

```ts
	function addPoint(point: Point): boolean {
		if (draft.kind === 'post') return placePost(point);
		if (blocked.value || draft.pendingInput || ((draft.kind === 'measurement' || draft.kind === 'stair' || draft.kind === 'beam') && draft.points.length === 2)) return false;
		const previous = draft.points[draft.points.length - 1];
		if (previous && previous.x === point.x && previous.y === point.y) return false;
		const added = setPoints([...draft.points, point]);
		if (added) draft.text = { x: '', y: '' };
		// A beam is exactly its two ends, so the second one saves it (structural posts and beams design §5).
		if (added && draft.kind === 'beam' && draft.points.length === 2) void finish();
		return added;
	}
	/** One click is one whole post: its section centred on the point, saved at once. */
	function placePost(point: Point): boolean {
		if (blocked.value || draft.pendingInput || !setPoints(postOutline(point, draft.post.width, draft.post.depth))) return false;
		draft.text = { x: '', y: '' };
		void finish();
		return true;
	}
```

In `finish`, replace the success line `selection.select([element.id as ReturnType<typeof createEntityId>]); draft.busy = false; runtime.returnToSelect();` with:

```ts
			selection.select([element.id as ReturnType<typeof createEntityId>]);
			// The post tool stays on for the next post along a wall, with the section last typed. `start` reads a
			// fresh baseline; the dispatcher has already refreshed the projection it is compared against.
			if (element.kind === 'post') { const post = { ...draft.post }; start('place-post'); draft.post = post; return; }
			draft.busy = false; runtime.returnToSelect();
```

`start` resets `draft.busy` through `createElementDraft()`. The `finally` then finds the ticket stale and leaves the draft alone.

- [ ] **Step 6: Create `src/presentation/editor/elements/StructuralDraftFields.vue`**

```vue
<script setup lang="ts">
import { computed, reactive } from 'vue';
import FieldError from '../../components/FieldError.vue';
import type { EditorRuntime } from '../runtime';
import { formatMetres, parseMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
type Field = 'width' | 'depth';
const props = defineProps<{ task: EditorRuntime['elementTask'] }>();
const draft = props.task.draft;
const fields = computed<readonly Field[]>(() => draft.kind === 'post' ? ['width', 'depth'] : ['width']);
const text = reactive<Record<Field, string>>({ width: formatMetres(draft.kind === 'beam' ? draft.beamWidth : draft.post.width), depth: formatMetres(draft.post.depth) });
const invalid = computed(() => new Set(fields.value.filter(field => !parseMetres(text[field]).ok)));
function input(field: Field, event: Event): void {
	const control = event.target as HTMLInputElement;
	if (props.task.blocked.value) { control.value = text[field]; return; }
	text[field] = control.value;
	const parsed = parseMetres(control.value);
	if (parsed.ok && draft.kind === 'beam') draft.beamWidth = parsed.mm;
	else if (parsed.ok) draft.post = { ...draft.post, [field]: parsed.mm };
	// An unreadable section holds every placement until it reads again: `addPoint` refuses while input is pending.
	draft.pendingInput = invalid.value.size > 0;
}
</script>
<template>
	<fieldset class="rp-stair-fields">
		<legend>{{ tr(draft.kind === 'beam' ? 'editor.add.beam.label' : 'editor.add.post.label') }}</legend>
		<FieldError
			v-for="field in fields"
			:key="field"
			v-slot="{ inputId, aria }"
			:message="invalid.has(field) ? tr(`editor.structural.${field}-invalid`) : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr(`editor.structural.${field}`) }}
				<input
					:id="inputId"
					v-bind="aria"
					:name="'structural-' + field"
					type="text"
					inputmode="decimal"
					:value="text[field]"
					:readonly="task.blocked.value"
					@input="input(field, $event)"
				>
			</label>
		</FieldError>
	</fieldset>
</template>
```

`rp-stair-fields` is the dimension fieldset style `styles/editor-object.css` already declares for both the task panel and dialogs. It is reused on purpose, so no new partial is needed.

In `ElementTaskForm.vue`:
- Add `import StructuralDraftFields from './StructuralDraftFields.vue';`.
- Render this directly after the `StairDraftFields` element:
```vue
		<StructuralDraftFields
			v-if="draft.kind === 'post' || draft.kind === 'beam'"
			:task="task"
		/>
```
- Widen `addBlocked`'s two-point cap to `(draft.kind === 'measurement' || draft.kind === 'stair' || draft.kind === 'beam') && draft.points.length === 2`.

- [ ] **Step 7: Draw the shapes**

Create `src/presentation/editor/elements/StructuralShape.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { beamOutline } from '../../../domain/spatial/structuralElement';
import type { ThemeTokens } from '../theme/themeTokens';
const props = defineProps<{ element: SpatialElement; selected: boolean; tokens: ThemeTokens; zoom: number }>();
const flat = (points: readonly Point[]) => points.flatMap(point => [point.x, point.y]);
const stroke = computed(() => props.selected ? props.tokens.accent : props.tokens.zoneStroke);
/** Load-bearing reads heavier; a selection heavier again (structural posts and beams design §6). */
const weight = computed(() => (props.element.loadBearing ? 2 : 1) * (props.selected ? 1.5 : 1) / props.zoom);
/** A post: its outline, filled when load-bearing, with both diagonals — the plan symbol for a column. */
const post = computed(() => {
	const [a, b, c, d] = props.element.points;
	return props.element.kind === 'post' && d ? { outline: flat(props.element.points), diagonals: [flat([a, c]), flat([b, d])] } : null;
});
/** A beam: the two long edges of its band, dashed because it lies above the cut plane. */
const beamEdges = computed(() => {
	const band = props.element.kind === 'beam' && props.element.width ? beamOutline(props.element.points, props.element.width) : [];
	return band.length === 4 ? [flat([band[0], band[1]]), flat([band[3], band[2]])] : [];
});
</script>
<template>
	<VGroup :config="{ name: 'structural-native-shape', listening: false }">
		<template v-if="post">
			<VLine :config="{ name: 'post-outline', points: post.outline, closed: true, stroke, strokeWidth: weight, fill: element.loadBearing ? stroke : tokens.canvasBackground }" />
			<VLine
				v-for="(diagonal, index) in post.diagonals"
				:key="index"
				:config="{ name: 'post-diagonal', points: diagonal, stroke: element.loadBearing ? tokens.canvasBackground : stroke, strokeWidth: 1 / zoom }"
			/>
		</template>
		<VLine
			v-for="(edge, index) in beamEdges"
			:key="'beam-' + index"
			:config="{ name: 'beam-edge', points: edge, stroke, strokeWidth: weight, dash: [8 / zoom, 6 / zoom] }"
		/>
	</VGroup>
</template>
```

In `ElementShapes.vue`:
- Add `import StructuralShape from './StructuralShape.vue';`.
- Insert this branch between the `DirectionArrowShape` element and the `VLine v-else`:
```vue
			<StructuralShape
				v-else-if="shape.element.kind === 'post' || shape.element.kind === 'beam'"
				:element="shape.element"
				:selected="shape.selected"
				:tokens="tokens"
				:zoom="zoom"
			/>
```

In `StructureLayer.vue`'s element preview computed, replace the two lines building `cursor` and the returned preview:

```ts
	const cursor = draft.cursor && (!['measurement', 'stair', 'beam'].includes(draft.kind) || draft.points.length < 2) ? [draft.cursor] : [];
	return [{ id: 'element-preview', kind: draft.kind, name: draft.name, points: [...draft.points, ...cursor], ...(draft.kind === 'stair' ? { stair: draft.stair } : {}), ...(draft.kind === 'beam' ? { width: draft.beamWidth, loadBearing: true } : {}) }];
```

- [ ] **Step 8: Add the catalogue entries, icons, banner, cursor and constraint**

`creationCatalogue.ts`:
- The union becomes `export type CreationEntryId = 'room' | 'wall' | 'door' | 'window' | 'opening' | 'area' | 'path' | 'fence' | 'item' | 'asset' | 'measurement' | 'note' | 'stair' | 'arrow' | 'post' | 'beam';`.
- `CREATION_ICONS` gains `post: 'rp-post', beam: 'rp-beam',` after `arrow: 'arrow-up-right',`.
- In `ENTRIES_BY_ID`, directly after the `stair:` row:
```ts
	post: toolEntry('post', 'structure', 'place-post', ['editor.add.post.synonyms']),
	beam: toolEntry('beam', 'structure', 'draw-beam', ['editor.add.beam.synonyms']),
```

`AddMenu.vue`: add `'post', 'beam'` to the arrays in `isElementEntry` (line with `['item', 'path', 'fence', 'measurement', 'stair', 'arrow']`), in `!['stair', 'arrow'].includes(entry.id)`, in `['area', 'wall', 'door', 'window', 'opening', 'stair', 'arrow']`, and in `['stair', 'arrow'].includes(entry.id) && workspace.layoutMode === 'constrained'`.

`src/plugin/editorIconRegistration.ts`, whole file:

```ts
import { addIcon, removeIcon } from 'obsidian';

/** Application-owned artwork, in Obsidian's 100-unit custom-icon coordinate system. */
const STAIR_ICON = '<path d="M12 88V64H36V40H60V16H88V88Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
/** A column's plan symbol: its section with both diagonals. */
const POST_ICON = '<path d="M22 22H78V78H22Z M22 22L78 78 M78 22L22 78" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>';
/** A beam overhead: two dashed parallel edges. */
const BEAM_ICON = '<path d="M8 36H92 M8 64H92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="14 10"/>';
const ICONS: Readonly<Record<string, string>> = { 'rp-stairs': STAIR_ICON, 'rp-post': POST_ICON, 'rp-beam': BEAM_ICON };

export function registerEditorIcons(): () => void {
	for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
	return () => { for (const name of Object.keys(ICONS)) removeIcon(name); };
}
```

`zoneTypeLabel.ts`: add `post: 'editor.add.post.label',` and `beam: 'editor.add.beam.label',` after `asset:`.

`TemporaryToolBanner.vue` `TASKS`: after the `'draw-arrow'` row add:
```ts
	'place-post': { nameKey: 'editor.add.post.label', instructionKey: 'editor.post.banner' },
	'draw-beam': { nameKey: 'editor.add.beam.label', instructionKey: 'editor.beam.banner' },
```

`cursor.ts`: add `'place-post',` and `'draw-beam',` after `'draw-arrow',` in its tool list. `editorSnapping.ts` `CONSTRAINING_TOOLS`: add `'draw-beam',` after `'draw-arrow',`.

- [ ] **Step 9: Update the three existing tests that enumerate the catalogue and icons**

`tests/presentation/editor/add/creationCatalogue.test.ts`:
- In both id lists (the `available.map` expectation and `lists every entry once…`), insert `'post', 'beam'` directly after `'stair'`.
- Extend the `it.each` table with `['post', 'place-post'], ['beam', 'draw-beam']`.

`tests/presentation/editor/stairsArrows.test.ts`: `toHaveLength(14)` becomes `toHaveLength(16)`.

`tests/plugin/editorIconRegistration.test.ts`: rename the case to `'registers the application artwork on load and removes each icon once on unload'`. After the existing `add` expectation, add:
```ts
			expect(add).toHaveBeenCalledWith('rp-post', expect.stringContaining('M22 22H78V78H22Z'));
			expect(add).toHaveBeenCalledWith('rp-beam', expect.stringContaining('stroke-dasharray'));
```
Replace the two final `remove` expectations with:
```ts
			expect(remove).toHaveBeenCalledTimes(3);
			for (const name of ['rp-stairs', 'rp-post', 'rp-beam']) expect(remove).toHaveBeenCalledWith(name);
```

- [ ] **Step 10: Run the tests and confirm they pass**

Run: `npm run check:fast -- tests/presentation/editor tests/plugin/editorIconRegistration.test.ts tests/build/localeModuleSentenceCase.test.ts`
Expected: PASS. If a test elsewhere under `tests/presentation/editor` pins the Add menu's entries (for example the empty-state or `FloorStart` catalogue), update its list the same way: `'post', 'beam'` after `'stair'`.

- [ ] **Step 11: Commit**

```bash
git add src/presentation src/plugin/editorIconRegistration.ts tests/presentation/editor tests/plugin/editorIconRegistration.test.ts
git commit -m "Add Post and Beam to the plan editor's Add menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Inspector — summary, load-bearing switch, dimensions form

**Files:**
- Create: `tests/helpers/structural.ts`
- Create: `src/presentation/editor/elements/structuralInput.ts`
- Create: `src/presentation/editor/elements/StructuralEditForm.vue`
- Modify: `src/presentation/editor/elements/elementEditPresentation.ts`
- Modify: `src/presentation/editor/elements/elementActions.ts` (new `setLoadBearing`, returned)
- Modify: `src/presentation/editor/elements/ElementInspector.vue`
- Test: `tests/presentation/editor/structuralInspector.test.ts`

**Interfaces:**
- Consumes: `postSection`, `resizedPost`, `postOutline` (Task 1). Locale keys (Task 4).
- Produces:
  - `elementActions.setLoadBearing(id: string, loadBearing: boolean): Promise<void>`.
  - `structuralText(element: StructuralShapeFacts, name: string): StructuralText`.
  - `structuralEdit(element: StructuralShapeFacts, text: StructuralText): { edit: StructuralEdit | null; errors: ReadonlySet<'width' | 'depth'> }`.
  - `tests/helpers/structural.ts` exports `POST_A`, `KITCHEN_BEAM`, `type EditorRig`, `editorWith(mounted, ...elements)`. Task 6 uses these.
  - Form marker `data-rp-form="structural-edit"`, inputs `structural-width` / `structural-depth`, checkbox `input[name="load-bearing"]`.

- [ ] **Step 1: Create the shared test helper `tests/helpers/structural.ts`**

```ts
import { renovationEditor } from './renovationEditor';
import { settle } from './editor';
import { expectOk } from './domain';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../src/domain/spatial/structuralElement';

export type EditorRig = Awaited<ReturnType<typeof renovationEditor>>;
export const POST_A: NamedSpatialElement = { id: 'element-post-a', kind: 'post', name: 'Post A', loadBearing: true, points: postOutline({ x: 1000, y: 1000 }, 140, 140) };
export const KITCHEN_BEAM: NamedSpatialElement = { id: 'element-kitchen-beam', kind: 'beam', name: 'Kitchen beam', loadBearing: true, width: 160, points: [{ x: 0, y: 3000 }, { x: 3000, y: 3000 }] };

/** A mounted planning editor whose plan already holds `elements`, each written through the guarded element command. */
export async function editorWith(mounted: EditorRig[], ...elements: readonly NamedSpatialElement[]): Promise<EditorRig> {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	for (const element of elements) {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	}
	await settle();
	return rig;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/presentation/editor/structuralInspector.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { editorWith, KITCHEN_BEAM, POST_A, type EditorRig } from '../../helpers/structural';
import { postOutline, postSection } from '../../../src/domain/spatial/structuralElement';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('summarises a beam, switches load-bearing through undoable history, and edits its width', async () => {
	const rig = await editorWith(mounted, KITCHEN_BEAM);
	rig.selection.select([KITCHEN_BEAM.id as never]); await settle();
	const text = rig.wrapper.get('.rp-element-inspector').text();
	expect(text).toContain('Beam'); expect(text).toContain('3 m · 0.16 m wide');
	const toggle = rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]');
	expect(toggle.element.checked).toBe(true);
	toggle.element.click();
	await settleUntil(() => rig.project.structure.elements?.[0].loadBearing === false, 'switched off');
	expect(rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]').element.checked).toBe(false);
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.[0].loadBearing).toBe(true);
	const editing = rig.runtime.elementActions.edit(KITCHEN_BEAM.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="structural-edit"]');
	expect(form.find('input[name="structural-depth"]').exists()).toBe(false);
	await form.get('input[name="structural-width"]').setValue('0,2');
	await form.trigger('submit'); await editing; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ width: 200, points: KITCHEN_BEAM.points, loadBearing: true });
});

it('summarises a post and resizes it about its centre from the dimensions form', async () => {
	const rig = await editorWith(mounted, POST_A);
	rig.selection.select([POST_A.id as never]); await settle();
	expect(rig.wrapper.get('.rp-element-inspector').text()).toContain('0.14 × 0.14 m');
	const editing = rig.runtime.elementActions.edit(POST_A.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="structural-edit"]');
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await form.get('input[name="structural-width"]').setValue('0,2');
	await form.get('input[name="structural-depth"]').setValue('0,1');
	await form.trigger('submit'); await editing; await settle();
	const saved = expectDefined(rig.project.structure.elements?.[0], 'resized post');
	expect(saved.points).toEqual(postOutline({ x: 1000, y: 1000 }, 200, 100));
	expect(postSection(saved.points)).toEqual({ width: 200, depth: 100 });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/structuralInspector.test.ts`
Expected: FAIL. The inspector shows the generic length line, and there is no `input[name="load-bearing"]`.

- [ ] **Step 4: Create `src/presentation/editor/elements/structuralInput.ts`**

```ts
import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { postSection, resizedPost } from '../../../domain/spatial/structuralElement';
import { formatMetres, parseMetres } from '../shell/formatLength';

export interface StructuralText { name: string; width: string; depth: string }
export interface StructuralEdit { readonly name: string; readonly points: readonly Point[]; readonly width?: number }
export type StructuralShapeFacts = Pick<SpatialElement, 'kind' | 'points' | 'width'>;

export function structuralText(element: StructuralShapeFacts, name: string): StructuralText {
	const section = element.kind === 'post' ? postSection(element.points) : null;
	return { name, width: formatMetres(section?.width ?? element.width ?? 0), depth: section ? formatMetres(section.depth) : '' };
}

/** A field still showing its stored value keeps the stored millimetres, never their rounded display. */
function lengthOf(text: string, stored: number) {
	return text === formatMetres(stored) ? { ok: true as const, mm: stored } : parseMetres(text);
}

/** What the dimensions form proposes, or which of its fields refuse; position is edited by moving, never here. */
export function structuralEdit(element: StructuralShapeFacts, text: StructuralText): { edit: StructuralEdit | null; errors: ReadonlySet<'width' | 'depth'> } {
	const section = element.kind === 'post' ? postSection(element.points) : null;
	const width = lengthOf(text.width, section?.width ?? element.width ?? 0), depth = section ? lengthOf(text.depth, section.depth) : null;
	const errors = new Set<'width' | 'depth'>();
	if (!width.ok) errors.add('width');
	if (depth && !depth.ok) errors.add('depth');
	const name = text.name.trim();
	if (!width.ok || errors.size || !name) return { edit: null, errors };
	if (element.kind === 'beam') return { edit: { name, points: element.points, width: width.mm }, errors };
	if (!section || !depth?.ok) return { edit: null, errors };
	const points = width.mm === section.width && depth.mm === section.depth ? element.points : resizedPost(element.points, width.mm, depth.mm);
	return { edit: points ? { name, points } : null, errors };
}
```

- [ ] **Step 5: Create `src/presentation/editor/elements/StructuralEditForm.vue`**

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialElementKind } from '../../../domain/spatial/SpatialElement';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { err } from '../../../core/result/Result';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import GeometryNameField from '../forms/GeometryNameField.vue';
import FormBanner from '../../components/FormBanner.vue';
import FieldError from '../../components/FieldError.vue';
import DraftRecovery from '../forms/DraftRecovery.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { commitTextInput } from '../forms/commitTextInput';
import { structuralEdit, structuralText, type StructuralEdit, type StructuralText } from './structuralInput';

const props = defineProps<{ kind: SpatialElementKind; width?: number; points: readonly Point[]; name: string; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	inputBlocked: Readonly<Ref<boolean>>; logger: Logger; retry: () => Promise<void>; openSource: () => Promise<void>;
	dispatch: (value: StructuralEdit) => Promise<DispatchResult>; preview: (value: StructuralEdit | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
const shape = computed(() => ({ kind: props.kind, points: props.points, ...(props.width === undefined ? {} : { width: props.width }) }));
let alive = true;
const form = useFormCommit({ initial: structuralText(shape.value, props.name), logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: (value: StructuralText) => { const { edit } = structuralEdit(shape.value, value); return edit ? props.dispatch(edit) : Promise.resolve(err(spatialError('element-invalid'))); } });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const parsed = computed(() => structuralEdit(shape.value, form.values.value));
const paused = computed(() => props.inputBlocked.value || form.submitting.value);
const stored = computed(() => JSON.stringify({ name: props.name, points: props.points, ...(props.kind === 'beam' ? { width: props.width } : {}) }));
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !parsed.value.edit || JSON.stringify(parsed.value.edit) === stored.value);
const fields = computed<readonly ('width' | 'depth')[]>(() => props.kind === 'post' ? ['width', 'depth'] : ['width']);
function input(field: keyof StructuralText, event: Event): void { commitTextInput(event, form.values.value[field], refuseInput, value => form.setField(field, value)); }
watchEffect(() => props.preview(parsed.value.edit));
onBeforeUnmount(() => { alive = false; props.preview(null); });
async function submit(): Promise<void> {
	if (disabled.value) { await focusFirstInvalidControl(); return; }
	if (await form.submit() && alive) emit('submit');
}
</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		data-rp-form="structural-edit"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<DraftRecovery
			v-if="blocked.value && !busy.value"
			:retry="retry"
			:open-source="openSource"
		/>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value"
			role="status"
		>
			{{ latest.value }}
		</p>
		<GeometryNameField
			:value="form.values.value.name"
			:readonly="paused"
			:invalid="!form.values.value.name.trim()"
			@input="input('name', $event)"
		/>
		<fieldset class="rp-stair-fields">
			<FieldError
				v-for="field in fields"
				:key="field"
				v-slot="{ inputId, aria }"
				:message="parsed.errors.has(field) ? tr(`editor.structural.${field}-invalid`) : null"
			>
				<label
					:for="inputId"
					class="rp-dialog-field"
				>
					{{ tr(`editor.structural.${field}`) }}
					<input
						:id="inputId"
						v-bind="aria"
						:name="'structural-' + field"
						type="text"
						inputmode="decimal"
						:value="form.values.value[field]"
						:readonly="paused"
						@input="input(field, $event)"
					>
				</label>
			</FieldError>
		</fieldset>
		<button
			type="submit"
			class="mod-cta"
			:aria-disabled="disabled"
		>
			{{ tr('editor.structural.apply') }}
		</button>
	</form>
</template>
```

If `GeometryNameField`'s `input` event does not carry the native `Event`, copy `StairEditForm.vue`'s `nameInput` exactly, since that component is the reference for it.

- [ ] **Step 6: Route the edit form in `elementEditPresentation.ts`**

Add `import StructuralEditForm from './StructuralEditForm.vue';` and `import type { StructuralEdit } from './structuralInput';`.

Widen the `dispatch` parameter type to `Pick<NamedSpatialElement, 'name' | 'points' | 'stair' | 'width'>`. Insert this branch before the stair branch:

```ts
	if (element.kind === 'post' || element.kind === 'beam') return { component: markRaw(StructuralEditForm), props: {
		kind: element.kind,
		...(element.width === undefined ? {} : { width: element.width }),
		dispatch: (value: StructuralEdit) => dispatch(value),
		preview: (value: StructuralEdit | null) => preview(value ? { ...element, ...value } : null),
	} };
```

- [ ] **Step 7: Add `setLoadBearing` to `elementActions.ts`**

Insert after `remove`:

```ts
	/** Load-bearing is an owned geometry fact, so it travels the same guarded, undoable write as a move. */
	function setLoadBearing(id: string, loadBearing: boolean): Promise<void> {
		return operate(id, async ({ baseline, element }) => {
			if ((element.kind !== 'post' && element.kind !== 'beam') || element.loadBearing === loadBearing || !context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, { ...element, loadBearing }), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
```

Add `setLoadBearing` to the returned object, after `remove`.

- [ ] **Step 8: Summary and switch in `ElementInspector.vue`**

Add imports:
```ts
import { postSection } from '../../../domain/spatial/structuralElement';
```

Add after `stairSummary`:

```ts
/** Section or length and width for a post or beam, in metres like every other inspector measure. */
const structuralSummary = computed(() => {
	const value = element.value;
	if (value?.kind === 'beam' && value.width) return tr('editor.structural.beam-summary', { length: formatMetres(elementLength(value)), width: formatMetres(value.width) });
	const section = value?.kind === 'post' ? postSection(value.points) : null;
	return section ? tr('editor.structural.post-summary', { width: formatMetres(section.width), depth: formatMetres(section.depth) }) : null;
});
function toggleLoadBearing(event: Event): void {
	// The saved projection answers the checked state once the write lands; a refused write leaves it unchanged.
	event.preventDefault();
	const value = element.value;
	if (value && !runtime.elementActions.blocked.value) void runtime.elementActions.setLoadBearing(value.id, value.loadBearing !== true);
}
```

In the template, insert between the `stairSummary` paragraph and `AssetPlacementDetails`:

```vue
		<p
			v-else-if="structuralSummary"
			class="rp-inspector-subline"
		>
			{{ structuralSummary }}
		</p>
```

Insert directly before `<StructureRenovationEntry />`:

```vue
		<label
			v-if="(element.kind === 'post' || element.kind === 'beam') && session.perspective === 'plan'"
			class="rp-dialog-field"
		>
			<input
				type="checkbox"
				name="load-bearing"
				:checked="element.loadBearing === true"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="toggleLoadBearing"
			>
			{{ tr('editor.structural.load-bearing') }}
		</label>
```

- [ ] **Step 9: Run the tests and confirm they pass**

Run: `npm run check:fast -- tests/presentation/editor/structuralInspector.test.ts tests/presentation/editor/stairsArrows.test.ts tests/presentation/editor/objectCreation.e2e.test.ts tests/presentation/editor/elementDeletionLifecycle.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/presentation/editor/elements tests/helpers/structural.ts tests/presentation/editor/structuralInspector.test.ts
git commit -m "Show post and beam dimensions and a load-bearing switch in the Inspector

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Load-bearing warning at both deletion doors

**Files:**
- Create: `src/presentation/editor/elements/loadBearingWarning.ts`
- Modify: `src/presentation/editor/elements/elementActions.ts` (`remove`, the confirmation message)
- Modify: `src/presentation/editor/elements/spatialRemoval.ts` (`approve`, the danger confirmation message)
- Test: `tests/presentation/editor/structuralDeletion.test.ts`

**Interfaces:**
- Consumes: `editorWith`, `POST_A`, `KITCHEN_BEAM`, `EditorRig` (Task 5). The `editor.structural.delete-warning` key (Task 4).
- Produces: `loadBearingWarning(ids: readonly string[], elements?: readonly SpatialElement[], metadata?: readonly SpatialElementMetadata[]): string`. It returns `''` or a leading space plus one sentence.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/structuralDeletion.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, KITCHEN_BEAM, POST_A, type EditorRig } from '../../helpers/structural';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';

const path: NamedSpatialElement = { id: 'element-garden-path', kind: 'path', name: 'Garden route', points: [{ x: 500, y: 5000 }, { x: 3000, y: 5000 }] };
const WARNING = 'Remove only after a structural check.';
const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function confirmationFor(rig: EditorRig, id: string): Promise<string> {
	rig.selection.select([id as never]); await settle();
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="delete-element"]').element.click();
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', `${id} confirmation`);
	const current = rig.dialogs.current;
	return current?.kind === 'confirm' ? current.message : '';
}

it('names a load-bearing post in its own confirmation, and still deletes it on confirm', async () => {
	const rig = await editorWith(mounted, POST_A, path);
	expect(await confirmationFor(rig, POST_A.id)).toContain(`Load-bearing: Post A. ${WARNING}`);
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'post deleted');
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.map(item => item.id)).toContain(POST_A.id);
});

it('says nothing about load for a post that carries none or an element that cannot', async () => {
	const rig = await editorWith(mounted, { ...POST_A, loadBearing: false }, path);
	for (const id of [POST_A.id, path.id]) {
		expect(await confirmationFor(rig, id)).not.toContain(WARNING);
		rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click();
		await settleUntil(() => rig.dialogs.current === null && !rig.runtime.elementActions.active.value, `${id} cancelled`);
	}
});

it('names every load-bearing element in a multi-item confirmation', async () => {
	const rig = await editorWith(mounted, POST_A, KITCHEN_BEAM, path);
	const removing = rig.runtime.elementActions.removeMany([POST_A.id, KITCHEN_BEAM.id, path.id]);
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'selection confirmation');
	const current = rig.dialogs.current;
	expect(current?.kind === 'confirm' ? current.message : '').toContain(`Load-bearing: Post A, Kitchen beam. ${WARNING}`);
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click(); await removing; await settle();
	expect(rig.project.structure.elements ?? []).toEqual([]);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/structuralDeletion.test.ts`
Expected: FAIL. Neither confirmation contains `Load-bearing:`. The second case passes already; that is correct, because it guards against the warning over-reaching.

- [ ] **Step 3: Create `src/presentation/editor/elements/loadBearingWarning.ts`**

```ts
import type { SpatialElement, SpatialElementMetadata } from '../../../domain/spatial/SpatialElement';
import { tr } from '../../i18n/strings';

/**
 * The one sentence both element deletion doors — `elementActions.remove` and `spatialRemoval` — append when a
 * removal takes a load-bearing post or beam; empty otherwise. Deleting stays possible (structural posts and beams design §7).
 */
export function loadBearingWarning(ids: readonly string[], elements: readonly SpatialElement[] = [], metadata: readonly SpatialElementMetadata[] = []): string {
	const names = elements.filter(element => element.loadBearing === true && ids.includes(element.id)).map(element => metadata.find(item => item.id === element.id)?.name ?? element.id);
	return names.length ? ' ' + tr('editor.structural.delete-warning', { names: names.join(', ') }) : '';
}
```

- [ ] **Step 4: Append it at both doors**

`elementActions.ts`: add `import { loadBearingWarning } from './loadBearingWarning';`. In `remove`, change the danger confirmation's message to:

```ts
message: tr('editor.element.delete-impact', { name: element.name }) + loadBearingWarning([id], baseline.geometry.document.structure?.elements, baseline.plan.entity.spatialElements)
```

`spatialRemoval.ts`: add the same import. In `approve`, change the final `openDialog`'s message to:

```ts
message: tr('renovation.batch.scope', { count: String(selected.length) }) + ' ' + names.join(', ') + '. ' + impact + loadBearingWarning(selected, baseline.geometry.document.structure?.elements, baseline.plan.entity.spatialElements)
```

- [ ] **Step 5: Watch the invariant fail without the fix, then restore it**

Temporarily replace the `return` of `loadBearingWarning` with `return '';`. Run `npm run check:fast -- tests/presentation/editor/structuralDeletion.test.ts` and confirm cases 1 and 3 go red. Restore the line.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm run check:fast -- tests/presentation/editor/structuralDeletion.test.ts tests/presentation/editor/elementDeletionLifecycle.test.ts tests/presentation/editor/spatialRemovalLegacy.test.ts tests/presentation/editor/groupNativeActions.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/elements tests/presentation/editor/structuralDeletion.test.ts
git commit -m "Warn when a deletion removes a load-bearing post or beam

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Harness capture, manual case, changelog, spec amendments

**Files:**
- Modify: `tests/harness/referenceWorkspace.ts` (a `?structural` seed)
- Modify: `scripts/harness-shot.mjs` (`SHOTS`)
- Modify: `tests/build/harness-shot.test.ts` (the sorted name list and one pin case)
- Create: `docs/tests/cases/Draw posts and beams.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md` (one bullet at the end of the case list)
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`, first bullet)
- Modify: `docs/superpowers/specs/2026-09-13-structural-posts-and-beams-design.md` (a closing amendments section)

**Interfaces:**
- Consumes: `postOutline` (Task 1) and the whole feature.
- Produces: shots `plan-editor-structural`, `plan-editor-structural-dark`, `plan-editor-structural-narrow`.

- [ ] **Step 1: Seed the harness plan**

In `tests/harness/referenceWorkspace.ts`, add `import { postOutline } from '../../src/domain/spatial/structuralElement';`. Insert this block directly after the `has('assets')` block's closing brace, inside the `ready` IIFE:

```ts
		if (new URLSearchParams(location.search).has('structural')) {
			const baseline = expectOk(await geometry.read(plan.id));
			const elements = [
				...[1000, 2500, 4000].map((x, index) => ({ id: `element-harness-post-${index + 1}`, kind: 'post' as const, loadBearing: true, points: postOutline({ x, y: 3000 }, 140, 140) })),
				{ id: 'element-harness-post-free', kind: 'post' as const, loadBearing: false, points: postOutline({ x: 2500, y: 1500 }, 140, 140) },
				{ id: 'element-harness-beam', kind: 'beam' as const, loadBearing: true, width: 160, points: [{ x: 0, y: 1500 }, { x: 5000, y: 1500 }] },
			];
			const walls = [{ id: 'wall-harness-frame', start: { x: 0, y: 3000 }, end: { x: 5000, y: 3000 }, height: 2500, thickness: 160 }];
			expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { walls, openings: [], boundaries: [], elements } }, baseline.version));
			const loaded = expectDefined(expectOk(await stack.plans.getById(plan.id)), 'harness structural plan');
			const names = ['Post 1', 'Post 2', 'Post 3', 'Free post', 'Ceiling beam'];
			expectOk(await stack.plans.save(expectOk(withPlanSpatialElements(loaded.entity, elements.map((item, index) => ({ id: item.id, name: names[index] })))), loaded.version));
		}
```

- [ ] **Step 2: Add the shots and pin them**

In `scripts/harness-shot.mjs` `SHOTS`, after the `plan-editor-assets-narrow` row:

```js
	{ name: 'plan-editor-structural', query: '?view=plan-editor&reference&planning&structural&theme=light', selector: FLOOR_STATE },
	{ name: 'plan-editor-structural-dark', query: '?view=plan-editor&reference&planning&structural', selector: FLOOR_STATE },
	{ name: 'plan-editor-structural-narrow', query: '?view=plan-editor&reference&planning&structural&theme=light', selector: PLAN_CANVAS, width: 460 },
```

In `tests/build/harness-shot.test.ts`, in the sorted list of `defines exactly the fixed shots this file lists, in both directions`, insert after `'plan-editor-stale-narrow',`:

```ts
			'plan-editor-structural',
			'plan-editor-structural-dark',
			'plan-editor-structural-narrow',
```

Add this case directly after `takes the selected-zone and Add-menu shots through the knobs that reach them, and the narrow shot at a sidebar width`, inside the same `describe`:

```ts
	it('takes the structural shots through the ?structural knob, one of them at a sidebar width', () => {
		for (const name of ['plan-editor-structural', 'plan-editor-structural-dark', 'plan-editor-structural-narrow']) expect(planEditorQuery(name).has('structural')).toBe(true);
		expect(planEditorQuery('plan-editor-structural-dark').has('theme')).toBe(false);
		expect(shot('plan-editor-structural-narrow').width).toBe(460);
	});
```

Run: `npm run check:fast -- tests/build/harness-shot.test.ts tests/harness`
Expected: PASS.

- [ ] **Step 3: Capture and look**

Run: `npm run harness-shot`
Then open `harness-shots/plan-editor-structural.png`, `plan-editor-structural-dark.png` and `plan-editor-structural-narrow.png` with the Read tool. Check four things:
1. The three wall posts sit centred on the wall, filled, with visible diagonals.
2. The free post is outline-only.
3. The beam reads as two dashed parallels crossing the free post.
4. Both schemes are legible, and the narrow canvas shows the same scene.

If Chromium is missing, the command names its remedy. Report the capture as not taken rather than skipping silently. If a picture shows a defect, fix it in `StructuralShape.vue`, then re-capture.

- [ ] **Step 4: Write the manual test case**

Create `docs/tests/cases/Draw posts and beams.md`:

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 97
sources:
  - Structural posts and beams design spec §5 (drawing), §6 (rendering and inspector), §7 (deletion)
status: Ready
---

# Draw posts and beams

The structural posts and beams increment: Add → Post places one post per click at a typed section and stays on
for the next; Add → Beam saves on its second click at a typed width. Both carry a Load-bearing switch, and deleting
a load-bearing one says so in the confirmation. `docs/superpowers/specs/2026-09-13-structural-posts-and-beams-design.md`
is the design and `docs/superpowers/plans/2026-09-13-structural-posts-and-beams.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a floor with one wall
drawn. **Create sample renovation project** seeds a floor; draw a wall on it first.

## Why a human is the only instrument for three of these

Every write, undo and warning below is driven in `tests/presentation/editor/structuralCreation.test.ts`,
`structuralInspector.test.ts` and `structuralDeletion.test.ts`. Outside all of it:

1. **Whether the post and beam symbols read as structure on a themed plan.** jsdom draws nothing; the harness
   shots use Obsidian's default colours only.
2. **Whether the `rp-post` and `rp-beam` icons render in the host's Add menu.** They are registered artwork,
   and only a vault shows `addIcon` honouring them.
3. **Whether a post snaps to the wall's centre line under a real hand.**

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Add → Post. Click three points along the wall's centre line. | Three filled squares with diagonals, centred on the wall; the tool stays on after each. |
| 2 | Escape. Select one post. | Inspector reads "Post · 0.14 × 0.14 m" and shows Load-bearing ticked. |
| 3 | Untick Load-bearing. Undo. Redo. | The square turns outline-only, back to filled, and outline-only again. |
| 4 | Add → Beam. Click either side of the room, crossing the wall. | Two dashed parallel lines; the Inspector shows its length and "0.16 m wide". |
| 5 | Edit the beam, set width 0.24, apply. | The dashed band widens. |
| 6 | Delete a load-bearing post. | The confirmation ends "Load-bearing: Post. Remove only after a structural check." Confirm removes it; Undo restores it. |
| 7 | Select two posts and the beam, press Delete. | One confirmation naming every load-bearing item. |
| 8 | Reopen the plan note's geometry sidecar in a text editor. | `"schemaVersion": 11`, each post with `"loadBearing"`, the beam with `"width"`. |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row is an expectation derived from the spec and the suite. |

## Outcome

Written after the first walk.
```

Append to `docs/tests/suites/Smoke Test the Editor.md`, after the `[[Alignment guides while dragging]]` bullet:

```markdown
- [[Draw posts and beams]] — the structural posts and beams increment: posts placed per click along a wall,
  a dashed beam overhead, a Load-bearing switch and a deletion that names what carries load. What only a vault
  shows is whether the symbols read on a themed plan, whether the host renders the registered `rp-post` and
  `rp-beam` icons, and whether a post lands on a wall's centre line under a real hand. Its steps carry no
  `Reachable by` verdicts yet (see the head of this file).
```

- [ ] **Step 5: Changelog**

Insert as the first bullet under `## [Unreleased]` → `### Added` in `CHANGELOG.md`:

```markdown
- Plan editor: draw structural Posts and Beams for timber-frame and other load-bearing structure from Add → Post and Add → Beam. A post is placed per click at a typed section and the tool stays on for the next; a beam is saved on its second click at a typed width and drawn dashed above the room. Both carry a Load-bearing switch in the Inspector, and deleting a load-bearing one names it in the confirmation. Plan geometry holding a post or a beam is saved as schema 11, which older builds refuse.
```

- [ ] **Step 6: Record what planning narrowed in the spec**

Append to `docs/superpowers/specs/2026-09-13-structural-posts-and-beams-design.md`:

```markdown
## 10. Amendments during planning

Taken while writing `docs/superpowers/plans/2026-09-13-structural-posts-and-beams.md`, each narrower than §5–§6:

- **The edit form carries name and dimensions only.** A post's width and depth are applied about its centre,
  keeping its rotation; a beam's width is applied to its unchanged axis. Position is edited by moving the body
  and, for a beam, by its two point handles — the existing element gestures — not by coordinate fields.
- **Inspector measures are in metres**, through the same `formatMetres` every other inspector line uses
  ("0.14 × 0.14 m", "4.2 m · 0.16 m wide"), rather than centimetres.
- **A beam rotates as a line** about its axis centre, like a measurement; only its hit, framing and selection
  outline use the widened band.
- **The icons are application artwork** (`rp-post`, `rp-beam`) registered beside `rp-stairs`, not Lucide names,
  so no harness icon fixture is added.
- **The post tool stays on by reading a fresh baseline after each save**, carrying the typed section forward; the
  beam tool returns to Select after its save, like every other element tool.
- **Selection priority:** a post ranks with objects, so a click on a post standing in a wall selects the post; a
  beam ranks with other linear elements, so it never steals a click from a wall or opening it crosses.
```

- [ ] **Step 7: Commit**

```bash
git add tests/harness/referenceWorkspace.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts docs CHANGELOG.md
git commit -m "Capture, document and changelog structural posts and beams

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage:**

| Spec section | Where it is implemented |
| --- | --- |
| §1 | Tasks 1–7 |
| §2 decisions | Model: Task 1. Posts independent of walls: no host field. Freistellen needs no field (nothing added). |
| §3 domain | Task 1 |
| §4 persistence | Task 2 |
| §5 add menu, tools, snapping | Tasks 3–4 |
| §6 rendering, inspector | Tasks 4–5, narrowed and recorded in Task 7 Step 6 |
| §7 deletion | Task 6 |
| §7 renovation | Unchanged by design. `StructureRenovationEntry` already renders for every element in `ElementInspector`. |
| §8 out of scope | Nothing added |
| §9 testing | Domain and schema: Tasks 1–2. Tools: Task 4. Rendering: Task 4 (`post-outline`, `post-diagonal`, `beam-edge`). Inspector: Task 5. Deletion watched red: Task 6 Step 5. Catalogue: Task 4 Step 9. Visual: Task 7 Step 3. Manual: Task 7 Step 4. |

**Type consistency:** these names are used identically in every task that references them: `outlineKind`, `derivedFootprintKind`, `closedFootprintKind`, `postOutline`, `beamOutline`, `postSection`, `resizedPost`, `DEFAULT_POST_SECTION`, `DEFAULT_BEAM_WIDTH`, `draft.post`, `draft.beamWidth`, `setLoadBearing`, `structuralText`, `structuralEdit`, `StructuralEdit`, `loadBearingWarning`, `editorWith`, `POST_A`, `KITCHEN_BEAM` and `EditorRig`.
