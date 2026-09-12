# Draggable Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A renovator drags the caption of a selected room, area, element or placed asset to a new place on the Plan Editor canvas; the position is saved as an offset from the automatic position, survives reload, follows the item when it moves, and is one undo step.

**Architecture:** An optional `labelOffset: { dx, dy }` (world mm) lives on `Zone` and `SpatialElement` and in the plan geometry sidecar (schema v10, written only while some caption is moved). One placement module answers where every caption is drawn and what box grabs it; the renderers and a new `labelActions` both call it. `resolveSelectionTarget` gains a `'label'` target for selected items; `SelectTool` hands it to a small `LabelMove` gesture, and the drop is written through the two guarded write paths rotation already uses (`rotationBaseline.ts`).

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, vue-konva, zod 4, vitest (+ jsdom, @vue/test-utils, @napi-rs/canvas).

**Spec:** `docs/superpowers/specs/2026-09-12-draggable-labels-design.md`

**Plan-time amendments to the spec** (Task 7 writes them back into the spec):

1. The persisted key is `labelOffset`, not `label`. Elements pass through the sidecar port unmapped, so the domain name and the stored name must be the same word; rooms use the same key for consistency.
2. Grab boxes come from a `labelHits` tool dependency (the `rotationControls` precedent), not from a `labelBounds` field on `SpatialObjectCandidate`. `canvasCandidates` has no viewport, names or caption obstacles, and its three callers would all have to grow them. The property the spec wants — drawn position and grab box computed by one function — still holds.
3. Found while tracing every writer of a room's sidecar entry, each of which would otherwise drop or distort a moved caption: a calibration rescales offsets with the geometry; the group-move projection (`groupSnapshot.ts`) and the group write's zone versions (`zoneGeometryVersions.ts`) carry the offset; the zone version digest (`digest.ts`) observes it.
4. `Zone.withLabelOffset` takes `Vector | null`: undo of a first drag must restore the automatic caption. No UI clears an offset.
5. No new fixed `harness-shot` capture: the harness Plan Editor floor has no renovation services, so a drag cannot save there. The jsdom rendering test and the manual case cover it.
6. Main moved during execution (#148 draws a zone's detail plans as a THIRD caption line; `captionOffsetY`'s fifth parameter became `{ viewport, bottom }`). The branch merges `origin/main` after Task 1; Tasks 4 and 6 use `captionBottom(detailed)` so a room caption's drawn position and grab box both honour the taller block.
7. Main's #150 gave paths, fences, measurements and objects draggable point handles. A caption now ranks BELOW vertex handles and multi-selection badges (spec §4.2 said above): an element's name tag sits just above its first point, where its handle is grabbed.

## Global Constraints

- Work in `C:\Projects\renovation-planner\.claude\worktrees\select-multiple-items-sidebar-e00376` on branch `claude/reverent-perlman-8f5d29`. Never edit the main checkout.
- The worktree's `node_modules` is empty: run `npm ci` once before anything else (Task 1, Step 0).
- Red/green steps use `npx vitest run <paths>`. Before each commit run `npm run check:fast -- <the task's test paths>`, then `npm run check` once. Never run two full gates at once.
- Layers: `presentation → application → domain → core`; nothing outside `infrastructure/` writes to the vault.
- No new user-visible strings. If one becomes necessary it goes through `tr` with entries in BOTH `en` and `de` locale files.
- `max-lines` 400 per `src/` file and 450 per test file (blank lines and comments skipped); `max-params` 5; `complexity` 16. `tests/presentation/editor/tools/selectTool.test.ts` is already at its budget — new SelectTool cases go in a new file.
- Do not export a type only to name it in a signature (fallow `unused-exports`), and do not name a non-exported type in an exported signature (fallow `private-type-leaks` is an error). Inline the type instead.
- Every test is watched failing before its implementation exists.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Scope: rooms/areas, elements and assets; only a SELECTED item's caption is grabbable; only in the `plan` perspective with the Select tool; no snapping; no reset action; no keyboard move.

---

### Task 1: Sidecar schema v10 stores a label offset

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts`
- Modify: `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` (imports, `writtenSchema`, the `safeParse` in `readUnlocked`)
- Modify: `src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts`
- Modify: `src/application/ports/PlanGeometrySidecar.ts`
- Modify: `src/domain/spatial/SpatialElement.ts`
- Modify: `src/infrastructure/obsidian/repositories/digest.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` (import and pre-write `safeParse`)
- Modify: `src/infrastructure/persistence/mappers/zoneMapper.ts` (import and `parsePersisted` schema only)
- Modify: `tests/infrastructure/obsidian/repositories/groupVersionBoundaries.test.ts` (V7 → V10)
- Create: `tests/application/commands/labelOffsetGeometry.test.ts`

**Interfaces:**
- Produces: `SpatialObjectGeometrySchemaV10` (exported), `PlanGeometrySchemaV10` (exported), `SpatialObjectGeometryDTO` (now inferred from V10, carries `labelOffset?: { dx: number; dy: number }`), `PlanGeometryDTO['schemaVersion']` includes `10`.
- Produces: `SpatialObjectGeometry.labelOffset?: Vector` (port), `SpatialElement.labelOffset?: Vector` (domain).
- `SpatialObjectGeometrySchemaV7` and `PlanGeometrySchemaV9` stop being exported.

- [ ] **Step 0: Install dependencies**

Run: `npm ci`
Expected: completes with no `ERR!`.

- [ ] **Step 1: Write the failing test**

Create `tests/application/commands/labelOffsetGeometry.test.ts`:

```ts
import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectOk } from '../../helpers/domain';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { SpatialObjectGeometrySchemaV10 } from '../../../src/infrastructure/persistence/dto/planGeometry';
import { observeZone } from '../../../src/infrastructure/obsidian/repositories/digest';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';

/** ADR-0029: a moved canvas caption is sidecar geometry, stored as an offset from its automatic anchor. */
const plainCabinet: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }] };
const cabinet: SpatialElement = { ...plainCabinet, labelOffset: { dx: 250, dy: -120 } };

it('round-trips a room and an element label offset at schema 10 and refuses them to a schema-9 reader', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const objects = baseline.document.objects.map(object => ({ ...object, labelOffset: { dx: -400, dy: 300 } }));
	expect(objects.length).toBeGreaterThan(0);
	const document = { ...baseline.document, objects, structure: { ...WALL_LOOP, elements: [cabinet] } };
	expectOk(await rig.geometry.write(rig.plan.id, document, baseline.version));
	expect(expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id)).document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(10);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 9));
	expect(() => older.migrateToLatest('plan-geometry', dto, 10)).toThrow('newer than this build supports');
});

it('writes the lowest schema that holds the content while no caption is moved', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...WALL_LOOP, elements: [plainCabinet] } }, baseline.version));
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(4);
	expect(PLAN_GEOMETRY_MIGRATIONS.at(-1)?.migrate({ schemaVersion: 9, revision: 2 })).toEqual({ schemaVersion: 10, revision: 2 });
});

it('refuses an offset that is not a pair of numbers, and lets a zone version see an offset change', () => {
	const entry = { id: 'zone-1', type: 'polygon' as const, points: [[0, 0], [10, 0], [10, 10]] as [number, number][] };
	expect(SpatialObjectGeometrySchemaV10.safeParse({ ...entry, labelOffset: { dx: 'far', dy: 0 } }).success).toBe(false);
	expect(SpatialObjectGeometrySchemaV10.safeParse({ ...entry, labelOffset: { dx: 5, dy: 0 } }).success).toBe(true);
	const frontmatter = { id: 'zone-1', revision: 1 };
	expect(observeZone(frontmatter, { ...entry, labelOffset: { dx: 5, dy: 0 } })).not.toEqual(observeZone(frontmatter, { ...entry, labelOffset: { dx: 6, dy: 0 } }));
	expect(observeZone(frontmatter, { ...entry, labelOffset: { dx: 5, dy: 0 } })).not.toEqual(observeZone(frontmatter, entry));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/application/commands/labelOffsetGeometry.test.ts`
Expected: FAIL — the first case's `toEqual` (the store strips `labelOffset`), the second on the migration step (`undefined` vs `schemaVersion: 10`), the third on `SpatialObjectGeometrySchemaV10` being undefined.

- [ ] **Step 3: Declare schema v10**

In `src/infrastructure/persistence/dto/planGeometry.ts`, replace the `BulgeSchema` / `SpatialObjectGeometrySchemaV7` / `SpatialObjectGeometryDTO` lines (currently 66-69) with:

```ts
const BulgeSchema = z.number().min(-1).max(1);
const SpatialObjectShapeV7 = SpatialObjectGeometrySchemaV1.extend({ bulges: z.array(BulgeSchema).optional() });
const oneBulgePerEdge = (value: { readonly points: readonly unknown[]; readonly bulges?: readonly number[] }) => value.bulges === undefined || value.bulges.length === value.points.length;
const BULGE_MESSAGE = { message: 'A closed boundary needs one bulge per edge.' };
const SpatialObjectGeometrySchemaV7 = SpatialObjectShapeV7.refine(oneBulgePerEdge, BULGE_MESSAGE);
```

Replace the `SpatialElementSchemaV9` declaration (currently lines 78-82) with a base object and its two refinements, so v10 can extend the base (zod 4 refuses `.extend` on a refined object):

```ts
const SpatialElementShapeV9 = z.object({
	id: z.string().startsWith('element-'), kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset']),
	points: z.array(SpatialPointSchema), stair: StairOptionsSchema.optional(), assetId: z.string().min(1).optional(),
});
const stairRule = (element: z.infer<typeof SpatialElementShapeV9>) => element.kind === 'stair' ? element.stair !== undefined : element.stair === undefined;
const assetRule = (element: z.infer<typeof SpatialElementShapeV9>) => (element.kind === 'asset') === (element.assetId !== undefined);
const ASSET_MESSAGE = { message: 'An asset placement, and only an asset placement, names its asset.' };
const SpatialElementSchemaV9 = SpatialElementShapeV9.refine(stairRule).refine(assetRule, ASSET_MESSAGE);
```

Change `export const PlanGeometrySchemaV9 =` to `const PlanGeometrySchemaV9 =`, then replace the last two lines of the file (the `PlanGeometrySchema` union and `PlanGeometryDTO`) with:

```ts
/** Schema 10: a dragged canvas caption, as a world-millimetre offset from its automatic anchor (ADR-0029). */
const LabelOffsetSchema = z.object({ dx: z.number(), dy: z.number() });
export const SpatialObjectGeometrySchemaV10 = SpatialObjectShapeV7.extend({ labelOffset: LabelOffsetSchema.optional() }).refine(oneBulgePerEdge, BULGE_MESSAGE);
export type SpatialObjectGeometryDTO = z.infer<typeof SpatialObjectGeometrySchemaV10>;
const SpatialElementSchemaV10 = SpatialElementShapeV9.extend({ labelOffset: LabelOffsetSchema.optional() }).refine(stairRule).refine(assetRule, ASSET_MESSAGE);
const StructureSchemaV10 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV10).optional() });
export const PlanGeometrySchemaV10 = PlanGeometrySchemaV9.extend({ schemaVersion: z.literal(10), objects: z.array(SpatialObjectGeometrySchemaV10), structure: StructureSchemaV10.optional(), intended: StructureSchemaV10.optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9, PlanGeometrySchemaV10]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV10>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 };
```

`z.number()` refuses `Infinity` and `NaN` in zod 4; do not add the deprecated `.finite()`.

- [ ] **Step 4: Migrate 9 → 10**

Append to the `PLAN_GEOMETRY_MIGRATIONS` array in `plan-geometry.migrations.ts`, after the 8 → 9 entry:

```ts
}, {
	fromVersion: 9, toVersion: 10,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 10 } : input,
```

(the array's closing `}];` stays where it is).

- [ ] **Step 5: Read and write v10 in the store**

In `PlanGeometryStore.ts`:
- Import line 10 becomes `import { PlanGeometrySchema, PlanGeometrySchemaV10 } from '../../persistence/dto/planGeometry';`
- In `readUnlocked`, `PlanGeometrySchemaV9.safeParse(migrated)` becomes `PlanGeometrySchemaV10.safeParse(migrated)`.
- Above `writtenSchema`, add a helper, and make it `writtenSchema`'s first line (kept out of `writtenSchema` itself so that function stays under the complexity budget):

```ts
/** A moved caption anywhere in the document needs schema 10; an older build must refuse it rather than drop it. */
function hasMovedCaption(dto: Pick<PlanGeometryDTO, 'objects' | 'structure' | 'intended'>): boolean {
	return dto.objects.some(object => object.labelOffset !== undefined) || [dto.structure, dto.intended].some(structure => structure?.elements?.some(element => element.labelOffset !== undefined) === true);
}
```

```ts
function writtenSchema(dto: Pick<PlanGeometryDTO, 'objects' | 'structure' | 'intended' | 'groups'>): PlanGeometryDTO['schemaVersion'] {
	if (hasMovedCaption(dto)) return 10;
	// …the existing lines, unchanged
```

- [ ] **Step 6: Carry the offset through the port and the domain types**

In `src/application/ports/PlanGeometrySidecar.ts`, add `import type { Vector } from '../../core/geometry/Vector';` and to `SpatialObjectGeometry`:

```ts
	/** A dragged caption's offset from its automatic anchor, world mm (ADR-0029); absent while automatic. */
	readonly labelOffset?: Vector;
```

In `src/domain/spatial/SpatialElement.ts`, add `import type { Vector } from '../../core/geometry/Vector';` and to `SpatialElement`:

```ts
	/** A dragged name tag's offset from its automatic position, world mm (ADR-0029); absent while automatic. */
	readonly labelOffset?: Vector;
```

In `ObsidianPlanGeometrySidecar.ts`, `read`'s `objects` map gains, after the `bulges` spread:

```ts
					...(object.labelOffset ? { labelOffset: { ...object.labelOffset } } : {}),
```

and `write`'s `objects` map gains the same line after its `bulges` spread. Elements need nothing: `toStructure` and `read` already pass each element through whole.

- [ ] **Step 7: Point the zone schema users at v10**

- `digest.ts`: import `SpatialObjectGeometrySchemaV10` instead of V7, and replace `ENTRY_KEYS` with:

```ts
// `JSON.stringify`'s key list filters NESTED objects too, so the offset's own keys are listed or it digests as `{}`.
const ENTRY_KEYS = [...Object.keys(SpatialObjectGeometrySchemaV10.shape), 'dx', 'dy'];
```

  Appending keys changes nothing for an entry without an offset: a key list orders output by the list, and the existing keys keep their order.
- `ObsidianZoneRepository.ts`: import `SpatialObjectGeometrySchemaV10` instead of V7; the pre-write check becomes `SpatialObjectGeometrySchemaV10.safeParse(geometryEntry).success`.
- `zoneMapper.ts`: import `SpatialObjectGeometrySchemaV10` instead of V7, and pass it to `parsePersisted` in `zoneFromPersistence`.
- `tests/infrastructure/obsidian/repositories/groupVersionBoundaries.test.ts`: import and call `SpatialObjectGeometrySchemaV10` instead of V7.

- [ ] **Step 8: Run the test to see it pass**

Run: `npx vitest run tests/application/commands/labelOffsetGeometry.test.ts tests/application/commands/assetPlacementGeometry.test.ts tests/application/commands/stairArrowGeometry.test.ts tests/infrastructure/obsidian/repositories`
Expected: PASS.

- [ ] **Step 9: Gate and commit**

Run: `npm run check:fast -- tests/application tests/infrastructure`, then `npm run check`.
Expected: both green.

```bash
git add src/infrastructure/persistence/dto/planGeometry.ts src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts src/infrastructure/obsidian/repositories/PlanGeometryStore.ts src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts src/application/ports/PlanGeometrySidecar.ts src/domain/spatial/SpatialElement.ts src/infrastructure/obsidian/repositories/digest.ts src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts src/infrastructure/persistence/mappers/zoneMapper.ts tests/infrastructure/obsidian/repositories/groupVersionBoundaries.test.ts tests/application/commands/labelOffsetGeometry.test.ts
git commit -m "persistence: store a dragged caption offset as plan geometry schema 10" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: A zone carries its caption offset

**Files:**
- Modify: `src/domain/zone/Zone.ts`
- Modify: `src/infrastructure/persistence/mappers/zoneMapper.ts`
- Modify: `src/infrastructure/obsidian/repositories/zoneGeometryVersions.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` (`prepareGeometryVersions` signature)
- Modify: `src/application/ports/ZoneRepository.ts` (`prepareGeometryVersions` signature)
- Modify: `src/presentation/read-models/PlanDto.ts` (`ZoneDto`, `toZoneDto`)
- Modify: `src/presentation/editor/groups/groupSnapshot.ts`
- Modify: `tests/domain/zone/zone.test.ts` (append)
- Modify: `tests/infrastructure/persistence/mappers/mappers.test.ts` (append)
- Modify: `tests/infrastructure/obsidian/repositories/planGeometrySidecar.test.ts` (append)
- Modify: `tests/presentation/editor/selection/canvasCandidates.test.ts` (append)

**Interfaces:**
- Consumes: `SpatialObjectGeometryDTO.labelOffset`, `SpatialObjectGeometry.labelOffset` (Task 1).
- Produces: `Zone.labelOffset: Vector | null`; `Zone.withLabelOffset(offset: Vector | null): Zone`; `CreateZoneProps.labelOffset?: Vector | null`; `ZoneDto.labelOffset?: Vector` (present only while moved); `ZoneRepository.prepareGeometryVersions?(id: ZoneId, geometry: CurvedPolygon & { readonly labelOffset?: Vector })`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/zone/zone.test.ts`:

```ts
describe('Zone caption offset', () => {
	it('starts automatic, and withLabelOffset changes the offset and nothing else', () => {
		const zone = expectOk(Zone.create(base()));
		expect(zone.labelOffset).toBeNull();
		const moved = zone.withLabelOffset({ dx: 120, dy: -40 });
		expect(moved.labelOffset).toEqual({ dx: 120, dy: -40 });
		expect({ ...moved, labelOffset: null }).toEqual({ ...zone });
		expect(moved.withLabelOffset(null).labelOffset).toBeNull();
	});

	it('keeps the offset through a geometry, name and lock change', () => {
		const moved = expectOk(Zone.create({ ...base(), labelOffset: { dx: 5, dy: 6 } }));
		expect(expectOk(moved.withGeometry(squareAt(50, 50))).labelOffset).toEqual({ dx: 5, dy: 6 });
		expect(expectOk(moved.withName('Kitchen')).labelOffset).toEqual({ dx: 5, dy: 6 });
		expect(moved.withLocked(true).labelOffset).toEqual({ dx: 5, dy: 6 });
	});
});
```

Append to `tests/infrastructure/persistence/mappers/mappers.test.ts`:

```ts
describe('zone caption offset mapping', () => {
	it('writes labelOffset only while the caption is moved, and reads it back', () => {
		const zone = makeZoneEntity({ projectId: createProjectId(), planId: createPlanId() });
		expect('labelOffset' in zoneToGeometryEntry(zone)).toBe(false);
		expect(expectOkOf(zoneFromPersistence(zoneToPersistence(zone, 1), zoneToGeometryEntry(zone))).labelOffset).toBeNull();
		const moved = zone.withLabelOffset({ dx: 30, dy: -10 });
		const entry = zoneToGeometryEntry(moved);
		expect(entry.labelOffset).toEqual({ dx: 30, dy: -10 });
		expect(expectOkOf(zoneFromPersistence(zoneToPersistence(moved, 1), entry)).labelOffset).toEqual({ dx: 30, dy: -10 });
	});
});
```

Append to `tests/infrastructure/obsidian/repositories/planGeometrySidecar.test.ts`:

```ts
describe('a zone caption offset in the sidecar', () => {
	it('is saved on the zone entry, read by the port, and seen by the versions a group write prepares', async () => {
		const { stack, zones, planId, sidecar } = await seeded();
		const [zone] = zones;
		if (!zone) throw new Error('no zone was seeded');
		const loaded = expectOk(await stack.zones.getById(zone.id));
		if (!loaded) throw new Error('the seeded zone did not load');
		expectOk(await stack.zones.save(zone.withLabelOffset({ dx: 7, dy: -3 }), loaded.version));
		const object = expectOk(await sidecar.read(planId)).document.objects.find(item => item.id === zone.id);
		expect(object?.labelOffset).toEqual({ dx: 7, dy: -3 });
		const labelled = expectOk(await stack.zones.prepareGeometryVersions(zone.id, { ...zone.geometry, labelOffset: { dx: 7, dy: -3 } }));
		const unlabelled = expectOk(await stack.zones.prepareGeometryVersions(zone.id, zone.geometry));
		expect(labelled?.zone.entity.labelOffset).toEqual({ dx: 7, dy: -3 });
		expect(labelled?.zone.version).not.toEqual(unlabelled?.zone.version);
	});
});
```

Append to `tests/presentation/editor/selection/canvasCandidates.test.ts`:

```ts
describe('a moved caption reaches the zone read model', () => {
	it('is absent until moved, then carried by toZoneDto', () => {
		const zone = makeZone({ projectId: createProjectId(), planId: createPlanId() });
		expect('labelOffset' in toZoneDto(zone)).toBe(false);
		expect(toZoneDto(zone.withLabelOffset({ dx: 1, dy: 2 })).labelOffset).toEqual({ dx: 1, dy: 2 });
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/domain/zone/zone.test.ts tests/infrastructure/persistence/mappers/mappers.test.ts tests/infrastructure/obsidian/repositories/planGeometrySidecar.test.ts tests/presentation/editor/selection/canvasCandidates.test.ts`
Expected: FAIL — `withLabelOffset is not a function` in each new case.

- [ ] **Step 3: Give `Zone` the offset**

In `src/domain/zone/Zone.ts` add `import type { Vector } from '../../core/geometry/Vector';`, then:
- `CreateZoneProps` gains
  ```ts
  	/** Where its canvas caption was dragged, from the automatic anchor, world mm (ADR-0029). Absent or null is automatic. */
  	readonly labelOffset?: Vector | null;
  ```
- `ZoneFields` gains `readonly labelOffset: Vector | null;`
- the class gains the field `readonly labelOffset: Vector | null;` and the constructor `this.labelOffset = fields.labelOffset;`
- `create` passes `labelOffset: props.labelOffset ?? null,` beside `locked`
- `fields()` returns `labelOffset: this.labelOffset,`
- after `withLocked`:
  ```ts
  	/** Move the canvas caption, or `null` to put it back at its automatic anchor; nothing about an offset can be invalid. */
  	withLabelOffset(offset: Vector | null): Zone {
  		return new Zone({ ...this.fields(), labelOffset: offset });
  	}
  ```

- [ ] **Step 4: Map it, version it, project it**

`zoneMapper.ts` — `zoneToGeometryEntry` gains after its `bulges` spread:

```ts
		...(zone.labelOffset ? { labelOffset: { ...zone.labelOffset } } : {}),
```

and `zoneFromPersistence`'s `Zone.create({ … })` gains `labelOffset: entry.labelOffset ?? null,`.

`zoneGeometryVersions.ts` — add `import type { Vector } from '../../../core/geometry/Vector';`, widen the parameter to `geometry: CurvedPolygon & { readonly labelOffset?: Vector }`, and give `entry` the offset after its `bulges` spread:

```ts
	const entry = { id, type: 'polygon' as const, points: geometry.points.map(point => [point.x, point.y] as [number, number]), ...(geometry.bulges ? { bulges: [...geometry.bulges] } : {}), ...(geometry.labelOffset ? { labelOffset: { ...geometry.labelOffset } } : {}) };
```

`ZoneRepository.ts` (port) — add `import type { Vector } from '../../core/geometry/Vector';` and change the signature to `prepareGeometryVersions?(id: ZoneId, geometry: CurvedPolygon & { readonly labelOffset?: Vector }): Promise<Result<ZoneGeometryVersions | null, RepositoryError>>;`. `ObsidianZoneRepository.prepareGeometryVersions` gets the same parameter type (add the `Vector` type import there). `GroupGeometryCommand` already passes the document's object, which now carries the offset.

`PlanDto.ts` — add `import type { Vector } from '../../core/geometry/Vector';` (skip if present), and `ZoneDto` gains

```ts
	/** A dragged caption's offset from its automatic anchor, world mm (ADR-0029); present only while moved. */
	readonly labelOffset?: Vector;
```

`toZoneDto` gains `...(zone.labelOffset ? { labelOffset: { ...zone.labelOffset } } : {}),` beside the `locked` spread.

`groupSnapshot.ts` — `projectedGroupGeometry`'s `objects` map becomes:

```ts
		objects: [...project.zones.values()].map(zone => ({ id: zone.id, points: zone.points, ...(zone.bulges ? { bulges: zone.bulges } : {}), ...(zone.labelOffset ? { labelOffset: zone.labelOffset } : {}) })),
```

A group move writes this projection back as the whole document; without the spread every moved room caption on the plan would reset.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/domain/zone tests/infrastructure tests/presentation/editor/selection tests/application/commands/spatial tests/application/commands/groupGeometry.test.ts`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

Run: `npm run check:fast -- tests/domain tests/infrastructure tests/application tests/presentation/editor/selection`, then `npm run check`.

```bash
git add src/domain/zone/Zone.ts src/infrastructure/persistence/mappers/zoneMapper.ts src/infrastructure/obsidian/repositories/zoneGeometryVersions.ts src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts src/application/ports/ZoneRepository.ts src/presentation/read-models/PlanDto.ts src/presentation/editor/groups/groupSnapshot.ts tests/domain/zone/zone.test.ts tests/infrastructure/persistence/mappers/mappers.test.ts tests/infrastructure/obsidian/repositories/planGeometrySidecar.test.ts tests/presentation/editor/selection/canvasCandidates.test.ts
git commit -m "domain: a zone carries its dragged caption offset through save, versions and group moves" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Commands write and rescale the offset

**Files:**
- Modify: `src/application/commands/zone/MoveSpatialObject.ts`
- Modify: `src/presentation/editor/tools/reversible-move-zone-command.ts`
- Modify: `src/application/commands/plan/ReversibleCalibratePlan.ts`
- Modify: `src/domain/spatial/structureGeometry.ts` (`scaleStructure`)
- Modify: `tests/application/commands/zone/moveSpatialObject.test.ts` (append)
- Modify: `tests/presentation/editor/tools/reversibleMoveZoneCommand.test.ts` (append)
- Modify: `tests/application/commands/plan/reversibleCalibratePlan.test.ts` (append)
- Modify: `tests/domain/spatial/structure.test.ts` (append)

**Interfaces:**
- Consumes: `Zone.withLabelOffset`, `Zone.labelOffset` (Task 2).
- Produces: `MoveSpatialObjectInput.labelOffset?: Vector | null` (absent keeps, `null` restores automatic). `ReversibleMoveZoneCommand`'s `forward` and `inverse` constructor parameters become `Polygon & { readonly labelOffset?: Vector | null }` (same five parameters).

- [ ] **Step 1: Write the failing tests**

Append to `tests/application/commands/zone/moveSpatialObject.test.ts`:

```ts
describe('MoveSpatialObjectCommand caption offset', () => {
	it('sets, keeps and clears the caption offset around the geometry it saves', async () => {
		const { zones, command } = wired();
		const zone = await seed(zones);
		const dragged = expectOk(await command.execute({ zoneId: zone.id, geometry: zone.geometry, labelOffset: { dx: 90, dy: 15 } }));
		expect(dragged.zone.entity.labelOffset).toEqual({ dx: 90, dy: 15 });
		expect(dragged.zone.entity.geometry).toEqual(zone.geometry);
		const moved = expectOk(await command.execute({ zoneId: zone.id, geometry: squareAt(40, 40) }));
		expect(moved.zone.entity.labelOffset).toEqual({ dx: 90, dy: 15 });
		const cleared = expectOk(await command.execute({ zoneId: zone.id, geometry: squareAt(40, 40), labelOffset: null }));
		expect(cleared.zone.entity.labelOffset).toBeNull();
	});
});
```

Append to `tests/presentation/editor/tools/reversibleMoveZoneCommand.test.ts`:

```ts
describe('ReversibleMoveZoneCommand caption drag', () => {
	it('moves only the caption, and undo puts the automatic caption back with the geometry untouched', async () => {
		const { zones, ledger, history, move } = wired();
		const zone = await seed(zones);
		const drag = new ReversibleMoveZoneCommand(move, ledger, zone.id, { ...zone.geometry, labelOffset: { dx: 300, dy: -50 } }, { ...zone.geometry, labelOffset: zone.labelOffset });
		expectOk(await history.run(drag));
		const after = expectOk(await zones.getById(zone.id))?.entity;
		expect(after?.labelOffset).toEqual({ dx: 300, dy: -50 });
		expect(after?.geometry).toEqual(zone.geometry);
		expectOk(await history.undo());
		const undone = expectOk(await zones.getById(zone.id))?.entity;
		expect(undone?.labelOffset).toBeNull();
		expect(undone?.geometry).toEqual(zone.geometry);
	});

	it('leaves a saved caption offset alone when a plain move carries none', async () => {
		const { zones, ledger, history, move } = wired();
		const labelled = makeZone({ projectId: 'project-seed' as ProjectId, planId: 'plan-seed' as PlanId, geometry: squareAt(0, 0), labelOffset: { dx: 1, dy: 2 } });
		await zones.save(labelled, 'absent');
		expectOk(await history.run(new ReversibleMoveZoneCommand(move, ledger, labelled.id, squareAt(10, 10), squareAt(0, 0))));
		expect(expectOk(await zones.getById(labelled.id))?.entity.labelOffset).toEqual({ dx: 1, dy: 2 });
	});
});
```

Append to `tests/application/commands/plan/reversibleCalibratePlan.test.ts`:

```ts
describe('ReversibleCalibratePlanCommand caption offsets', () => {
	it('rescales a moved caption with the room it labels', async () => {
		const w = await wired([{ ...zoneEntry('zone-1' as never, 10), labelOffset: { dx: 25, dy: -10 } }]);
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		expect(expectOk(await w.sidecar.read(w.planId)).document.objects[0].labelOffset).toEqual({ dx: 100, dy: -40 });
	});
});
```

Append to `tests/domain/spatial/structure.test.ts`:

```ts
describe('scaleStructure caption offsets', () => {
	it('rescales an element caption offset with its points', () => {
		const element = { id: 'element-cabinet', kind: 'object' as const, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], labelOffset: { dx: 3, dy: -4 } };
		expect(scaleStructure({ walls: [], openings: [], boundaries: [], elements: [element] }, 2).elements?.[0].labelOffset).toEqual({ dx: 6, dy: -8 });
	});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/application/commands/zone/moveSpatialObject.test.ts tests/presentation/editor/tools/reversibleMoveZoneCommand.test.ts tests/application/commands/plan/reversibleCalibratePlan.test.ts tests/domain/spatial/structure.test.ts`
Expected: FAIL — the first case of each new `describe` (offset not written / not rescaled). The "leaves a saved caption offset alone" case already passes; it is a regression guard.

- [ ] **Step 3: Write the offset in `MoveSpatialObjectCommand`**

Add `import type { Vector } from '../../../core/geometry/Vector';`. `MoveSpatialObjectInput` gains:

```ts
	/** A dragged caption's new offset from its automatic anchor (ADR-0029): absent keeps the saved one, `null` restores automatic. */
	readonly labelOffset?: Vector | null;
```

In `execute`, replace `const saved = await this.zones.save(updated.value, input.expected ?? loaded.value.version);` with:

```ts
		const next = input.labelOffset === undefined ? updated.value : updated.value.withLabelOffset(input.labelOffset);
		const saved = await this.zones.save(next, input.expected ?? loaded.value.version);
```

- [ ] **Step 4: Carry it through `ReversibleMoveZoneCommand`**

Add `import type { Vector } from '../../../core/geometry/Vector';`. Change the constructor's last two parameters to:

```ts
		private readonly forward: Polygon & { readonly labelOffset?: Vector | null },
		private readonly inverse: Polygon & { readonly labelOffset?: Vector | null },
```

Replace `dispatch` with:

```ts
	private async dispatch(state: Polygon & { readonly labelOffset?: Vector | null }): Promise<Result<DispatchOutcome, MoveError>> {
		const expected = this.hasWritten ? this.ledger.lastWritten(this.zoneId) : undefined;
		// A caption drag hands identical geometry both ways and only its offset differs; a plain move carries none.
		const { labelOffset, ...geometry } = state;
		const change: MoveSpatialObjectInput = labelOffset === undefined ? { zoneId: this.zoneId, geometry } : { zoneId: this.zoneId, geometry, labelOffset };
		const input: MoveSpatialObjectInput = expected === undefined || expected === null ? change : { ...change, expected };
		const result = await this.moveCommand.execute(input);
		// …the rest of the existing body, unchanged from `if (isErr(result)) return result;` on
```

Leave the class docblock and the two comments inside the old body as they are.

- [ ] **Step 5: Rescale offsets on calibration**

`ReversibleCalibratePlan.ts`, the `objects` map in the rescaled document becomes:

```ts
			objects: previous.objects.map((object) => ({
				...object,
				points: scaleShape({ points: object.points }, scaleCorrection, origin).points,
				// A caption follows its room: the offset is world millimetres, so it rescales with the points.
				...(object.labelOffset ? { labelOffset: { dx: object.labelOffset.dx * scaleCorrection, dy: object.labelOffset.dy * scaleCorrection } } : {}),
			})),
```

`structureGeometry.ts`, `scaleStructure`'s element map becomes:

```ts
		...(structure.elements ? { elements: structure.elements.map(element => ({ ...element, points: element.points.map(point), ...(element.stair ? { stair: { ...element.stair, width: element.stair.width * factor } } : {}), ...(element.labelOffset ? { labelOffset: { dx: element.labelOffset.dx * factor, dy: element.labelOffset.dy * factor } } : {}) })) } : {}),
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run tests/application/commands tests/domain/spatial tests/presentation/editor`
Expected: PASS.

- [ ] **Step 7: Gate and commit**

`ReversibleMoveZoneCommand` is shared by body drags, vertex drags, nudges and rotation: run every caller's directory. Run `npm run check:fast -- tests/application tests/domain tests/presentation/editor`, then `npm run check`.

```bash
git add src/application/commands/zone/MoveSpatialObject.ts src/presentation/editor/tools/reversible-move-zone-command.ts src/application/commands/plan/ReversibleCalibratePlan.ts src/domain/spatial/structureGeometry.ts tests/application/commands/zone/moveSpatialObject.test.ts tests/presentation/editor/tools/reversibleMoveZoneCommand.test.ts tests/application/commands/plan/reversibleCalibratePlan.test.ts tests/domain/spatial/structure.test.ts
git commit -m "commands: write a caption offset with a zone move, and rescale offsets on calibration" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: One caption placement, drawn at the offset

**Files:**
- Create: `src/presentation/editor/labels/labelLayout.ts`
- Modify: `src/presentation/editor/layers/zone/captionPlacement.ts`
- Modify: `src/presentation/editor/layers/zone/ZoneRenderModel.ts`
- Modify: `src/presentation/editor/layers/zone/ZoneShape.vue`
- Modify: `src/presentation/editor/layers/zone/ZoneLayer.vue`
- Modify: `src/presentation/editor/PlanCanvas.vue` (one prop on `<ZoneLayer>`)
- Modify: `src/presentation/editor/elements/ElementShapes.vue`
- Modify: `src/presentation/editor/elements/assetShapeConfig.ts`
- Modify: `src/presentation/editor/elements/elementPreviews.ts`
- Modify: `src/presentation/editor/structure/StructureLayer.vue`
- Modify: `src/presentation/editor/elements/AssetLayer.vue`
- Modify: `src/presentation/editor/tools/render-state.ts`
- Create: `tests/presentation/editor/labels/labelLayout.test.ts`
- Modify: `tests/presentation/editor/elements/assetShapeConfig.test.ts`
- Create: `tests/presentation/editor/labelRendering.test.ts`

**Interfaces:**
- Consumes: `ZoneDto.labelOffset`, `SpatialElement.labelOffset` (Tasks 1-2).
- Produces (all in `labelLayout.ts` unless noted):
  - `ELEMENT_LABEL_FONT_PX: number` (12)
  - `elementLabelLayout(element: NamedSpatialElement, zoom: number): { readonly x: number; readonly y: number; readonly text: string }`
  - `assetLabelLayout(element: NamedSpatialElement, footprint: readonly Point[], zoom: number)` — same return shape
  - `elementCaptionLayout(element: NamedSpatialElement, shapeOf: ShapeLookup, zoom: number)` — same return shape; picks the asset or element layout
  - `measureLabelWidth(text: string, fontPx: number): number`
  - `textLabelBounds(layout: { readonly x: number; readonly y: number; readonly text: string }, zoom: number, measure?: (text: string, fontPx: number) => number): BoundingBox`
  - The layout shape is written inline, never as an exported type: nothing outside the module would import it (fallow `unused-exports`), and a non-exported name in these signatures is a `private-type-leaks` error.
  - `roomCaptionBounds(anchor: Point, zoom: number, bottom: number): BoundingBox`
  - `captionPlacement.ts`: `CAPTION_BOUNDS_PX`, `captionPins(pins, sessionVisible: boolean, annotationVisible: boolean)`, `captionBottom(detailed: boolean): number`, `roomCaptionAnchor(zone, zoom, pins, dimensions, options: { readonly viewport: BoundingBox | null; readonly bottom: number }): Point`
  - `RenderState.labelPreview: { readonly id: string; readonly offset: Vector } | null`
  - `withElementPreviews(elements, names, rotation, moved, label?: { readonly id: string; readonly offset: Vector } | null)`
  - `ZoneRenderModel.labelOffset?: Vector`; `ZoneLayer` prop `labelPreview`

- [ ] **Step 1: Write the failing pure tests**

Create `tests/presentation/editor/labels/labelLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assetLabelLayout, elementCaptionLayout, elementLabelLayout, measureLabelWidth, roomCaptionBounds, textLabelBounds } from '../../../../src/presentation/editor/labels/labelLayout';
import { captionBottom, captionOffsetY, captionPins, DETAIL_CAPTION_BOTTOM, roomCaptionAnchor } from '../../../../src/presentation/editor/layers/zone/captionPlacement';
import { elementFootprint } from '../../../../src/presentation/editor/elements/elementFootprint';
import { withElementPreviews } from '../../../../src/presentation/editor/elements/elementPreviews';
import type { NamedSpatialElement } from '../../../../src/domain/spatial/SpatialElement';

/** ADR-0029: every caption's drawn position and grab box are answered here, once. */
const path: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: 100, y: 500 }, { x: 900, y: 500 }] };
const square = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

describe('element and asset name tags', () => {
	it('sit 18 screen px above their anchor and move by a dragged offset', () => {
		expect(elementLabelLayout(path, 0.5)).toEqual({ x: 100, y: 464, text: 'Garden path' });
		expect(elementLabelLayout({ ...path, labelOffset: { dx: 40, dy: -20 } }, 0.5)).toEqual({ x: 140, y: 444, text: 'Garden path' });
	});

	it('picks the asset layout for a placement and the element layout for everything else', () => {
		const asset = { ...path, kind: 'asset' as const, assetId: 'asset-a', points: [{ x: 100, y: 500 }, { x: 100, y: 900 }] };
		expect(elementCaptionLayout(asset, () => null, 1)).toEqual(assetLabelLayout(asset, elementFootprint(asset, () => null), 1));
		expect(elementCaptionLayout(path, () => null, 1)).toEqual(elementLabelLayout(path, 1));
	});

	it('names a measurement with its length', () => {
		expect(elementLabelLayout({ ...path, kind: 'measurement' }, 1)?.text).toMatch(/^Garden path · .+ m$/);
	});

	it('puts an asset tag above the footprint it draws, plus its offset', () => {
		const asset = { ...path, kind: 'asset' as const, assetId: 'asset-a', labelOffset: { dx: 10, dy: 0 } };
		expect(assetLabelLayout(asset, [{ x: 0, y: 300 }, { x: 50, y: 200 }], 1)).toEqual({ x: 110, y: 182, text: 'Garden path' });
	});

	it('bounds a tag by its measured width and one line of text, estimating where no canvas exists', () => {
		expect(textLabelBounds({ x: 100, y: 200, text: 'Sofa' }, 0.5, () => 30)).toEqual({ min: { x: 100, y: 200 }, max: { x: 160, y: 224 } });
		expect(measureLabelWidth('Sofa', 10)).toBeCloseTo(24);
	});
});

describe('room captions', () => {
	it('draw a dragged caption at anchor plus offset, ignoring the pins an automatic one clears', () => {
		const pins = [{ x: 500, y: 500, number: 1 }];
		const automatic = roomCaptionAnchor({ points: square }, 1, pins, [], { viewport: null, bottom: captionBottom(false) });
		expect(automatic).toEqual({ x: 500, y: 500 + captionOffsetY({ x: 500, y: 500 }, pins, 1) });
		expect(automatic.y).not.toBe(500);
		// A third caption line (a zone's detail plans, ADR-0028) clears obstacles with a taller block.
		expect(roomCaptionAnchor({ points: square }, 1, pins, [], { viewport: null, bottom: captionBottom(true) }).y).toBe(500 + captionOffsetY({ x: 500, y: 500 }, pins, 1, [], { bottom: DETAIL_CAPTION_BOTTOM }));
		expect(roomCaptionAnchor({ points: square, labelOffset: { dx: 50, dy: -70 } }, 1, pins, [], { viewport: null, bottom: captionBottom(true) })).toEqual({ x: 550, y: 430 });
		expect(roomCaptionBounds({ x: 500, y: 500 }, 2, captionBottom(false))).toEqual({ min: { x: 454.5, y: 488 }, max: { x: 545.5, y: 516 } });
		expect(roomCaptionBounds({ x: 500, y: 500 }, 2, captionBottom(true)).max.y).toBe(500 + DETAIL_CAPTION_BOTTOM / 2);
	});

	it('clear pins only while the session and the annotation layer both show them', () => {
		const pins = [{ x: 1, y: 2, number: 1 }];
		expect(captionPins(pins, true, true)).toBe(pins);
		expect(captionPins(pins, false, true)).toEqual([]);
		expect(captionPins(pins, true, false)).toEqual([]);
	});
});

describe('withElementPreviews', () => {
	it('moves only the dragged element caption', () => {
		const other = { ...path, id: 'element-other' };
		const shown = withElementPreviews([path, other], new Map([[path.id, path.name], [other.id, 'Other']]), null, null, { id: path.id, offset: { dx: 5, dy: 6 } });
		expect(shown.map(item => item.labelOffset)).toEqual([{ dx: 5, dy: 6 }, undefined]);
	});
});
```

In `tests/presentation/editor/elements/assetShapeConfig.test.ts`, inside `describe('assetShapeConfig', …)` after its last `it`, add:

```ts
	it('draws the name tag above the footprint, moved by a dragged offset', () => {
		expect(assetShapeConfig(element, () => shape, state).label).toMatchObject({ x: 1000, y: 682, text: 'Radiator' });
		expect(assetShapeConfig({ ...element, labelOffset: { dx: -100, dy: 50 } }, () => shape, state).label).toMatchObject({ x: 900, y: 732 });
	});
```

- [ ] **Step 2: Write the failing rendering test**

Create `tests/presentation/editor/labelRendering.test.ts`:

```ts
// @vitest-environment jsdom
/** ADR-0029: a moved room caption is drawn at its anchor plus its offset, and a live drag preview overrides it. */
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { labelAnchor } from '../../../src/presentation/editor/layers/zone/ZoneRenderModel';

const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });

const square = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];

it('draws a moved room caption at its anchor plus its offset, and follows a live drag preview', async () => {
	const rig = await structureEditor(); rigs.push(rig);
	const zone = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: square }, labelOffset: { dx: 600, dy: -400 } });
	expectOk(await rig.stack.zones.save(zone, 'absent'));
	await rig.runtime.refreshProjection(); await settle();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.zone'), 'zone layer');
	// A zone group's children are fill, outline, name, area — `ZoneShape.vue`'s template order.
	const name = () => expectDefined(layer.findOne<Konva.Group>(`.${zone.id}`), zone.id).getChildren()[2] as Konva.Text;
	const anchor = labelAnchor(square);
	expect({ x: name().x(), y: name().y() }).toEqual({ x: anchor.x + 600, y: anchor.y - 400 });
	rig.runtime.renderState.labelPreview = { id: zone.id, offset: { dx: 0, dy: 0 } }; await settle();
	expect({ x: name().x(), y: name().y() }).toEqual(anchor);
	rig.runtime.renderState.labelPreview = null; await settle();
	expect(name().x()).toBe(anchor.x + 600);
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/presentation/editor/labels/labelLayout.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts tests/presentation/editor/labelRendering.test.ts`
Expected: FAIL — `labelLayout` does not resolve; the asset offset case draws at `x: 1000`; the rendering case draws the caption at the anchor.

- [ ] **Step 4: Export the room caption rules**

In `captionPlacement.ts`, add `import type { Vector } from '../../../../core/geometry/Vector';` and `import { labelAnchor } from './ZoneRenderModel';`, and replace the `const CAPTION = …` line with:

```ts
/** A room caption's name-and-area block, in screen px around its anchor: what obstacles clear and what a caption drag grabs. */
export const CAPTION_BOUNDS_PX = { halfWidth: 91, top: -24, bottom: 32 } as const;
const CAPTION = CAPTION_BOUNDS_PX, PIN_HALF_HEIGHT = 15, GAP = 6;
```

Append:

```ts
/** Pins clear captions only while the evidence session and the annotation layer both show them; `ZoneLayer` and a caption drag ask this once. */
export function captionPins<T extends NumberedPin>(pins: readonly T[], sessionVisible: boolean, annotationVisible: boolean): readonly T[] {
	return sessionVisible && annotationVisible ? pins : [];
}

/** Where a room caption's block ends, in screen px: lower while it carries a third line naming its detail plans (ADR-0028). */
export function captionBottom(detailed: boolean): number {
	return detailed ? DETAIL_CAPTION_BOTTOM : CAPTION.bottom;
}

/**
 * Where a room caption is DRAWN (ADR-0029). A dragged caption sits exactly at its automatic anchor
 * plus its offset — a placement the renovator chose wins — and only an undragged one is displaced
 * around pins and dimension labels.
 */
export function roomCaptionAnchor(zone: { readonly points: readonly Point[]; readonly bulges?: readonly number[]; readonly labelOffset?: Vector | null }, zoom: number, pins: readonly NumberedPin[], dimensions: readonly BoundingBox[], options: { readonly viewport: BoundingBox | null; readonly bottom: number }): Point {
	const anchor = labelAnchor(zone.points, zone.bulges);
	if (zone.labelOffset) return { x: anchor.x + zone.labelOffset.dx, y: anchor.y + zone.labelOffset.dy };
	return { x: anchor.x, y: anchor.y + captionOffsetY(anchor, pins, zoom, dimensions, options) };
}
```

(Since the merge of `origin/main`, `captionPlacement.ts` already exports `DETAIL_CAPTION_BOTTOM` and `captionOffsetY` takes `{ viewport, bottom }` as its fifth parameter; the `const CAPTION = …` line this step replaces is unchanged.)

- [ ] **Step 5: Create the placement module**

Create `src/presentation/editor/labels/labelLayout.ts`:

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import { elementLength, type NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { formatMetres } from '../shell/formatLength';
import { CAPTION_BOUNDS_PX } from '../layers/zone/captionPlacement';
import { elementFootprint, type ShapeLookup } from '../elements/elementFootprint';

/**
 * Where every canvas caption is DRAWN and what box GRABS it (ADR-0029), in world millimetres. The
 * renderers and `labelActions` both ask here, so a caption cannot be drawn in one place and grabbed
 * in another. Room captions are placed by `roomCaptionAnchor`, beside the obstacle rules they share.
 */

/** An element or asset name tag's text size, in screen px. */
export const ELEMENT_LABEL_FONT_PX = 12;
const ELEMENT_LABEL_GAP_PX = 18;

const offsetBy = (point: Point, offset: Vector | undefined): Point => offset ? { x: point.x + offset.dx, y: point.y + offset.dy } : point;

/** An element's name tag: above its first point (a valid element always has one), moved by a dragged offset. */
export function elementLabelLayout(element: NamedSpatialElement, zoom: number): { readonly x: number; readonly y: number; readonly text: string } {
	const point = element.points[0];
	const at = offsetBy({ x: point.x, y: point.y - ELEMENT_LABEL_GAP_PX / zoom }, element.labelOffset);
	return { ...at, text: element.kind === 'measurement' ? element.name + ' · ' + formatMetres(elementLength(element)) + ' m' : element.name };
}

/** An asset's name tag: above the footprint it draws, never its stored anchor → facing pair, moved by a dragged offset. */
export function assetLabelLayout(element: NamedSpatialElement, footprint: readonly Point[], zoom: number): { readonly x: number; readonly y: number; readonly text: string } {
	const anchor = element.points[0];
	return { ...offsetBy({ x: anchor.x, y: Math.min(...footprint.map(point => point.y)) - ELEMENT_LABEL_GAP_PX / zoom }, element.labelOffset), text: element.name };
}

/** Either tag, by the element's kind — what a caption drag asks, so it never re-decides which layout an element draws. */
export function elementCaptionLayout(element: NamedSpatialElement, shapeOf: ShapeLookup, zoom: number): { readonly x: number; readonly y: number; readonly text: string } {
	return element.kind === 'asset' ? assetLabelLayout(element, elementFootprint(element, shapeOf), zoom) : elementLabelLayout(element, zoom);
}

let context: CanvasRenderingContext2D | null | undefined;

/** Measured with the same 2D canvas and default family (Konva's `Arial`) the tag is drawn with. */
export function measureLabelWidth(text: string, fontPx: number): number {
	context ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	// ponytail: an estimate only where no 2D context exists (a node test); Obsidian always has one.
	if (!context) return text.length * fontPx * 0.6;
	context.font = `${fontPx}px Arial`;
	return context.measureText(text).width;
}

/** A name tag's world box: its top-left at the layout, one line tall. */
export function textLabelBounds(layout: { readonly x: number; readonly y: number; readonly text: string }, zoom: number, measure: (text: string, fontPx: number) => number = measureLabelWidth): BoundingBox {
	return { min: { x: layout.x, y: layout.y }, max: { x: layout.x + measure(layout.text, ELEMENT_LABEL_FONT_PX) / zoom, y: layout.y + ELEMENT_LABEL_FONT_PX / zoom } };
}

/** A room caption's world box around the drawn anchor; `bottom` is `captionBottom(…)`, lower while a detail-plans line shows. */
export function roomCaptionBounds(anchor: Point, zoom: number, bottom: number): BoundingBox {
	return {
		min: { x: anchor.x - CAPTION_BOUNDS_PX.halfWidth / zoom, y: anchor.y + CAPTION_BOUNDS_PX.top / zoom },
		max: { x: anchor.x + CAPTION_BOUNDS_PX.halfWidth / zoom, y: anchor.y + bottom / zoom },
	};
}
```

- [ ] **Step 6: Carry the offset and the preview into the renderers**

`render-state.ts` — add `import type { Vector } from '../../../core/geometry/Vector';`; after `polygonSketch`:

```ts
	/**
	 * A caption being dragged (ADR-0029): whose, and the offset from its automatic anchor the pointer
	 * has reached. Left at the drop until the write has been read back, so the caption does not flick
	 * back for the length of the save.
	 */
	labelPreview: { readonly id: string; readonly offset: Vector } | null = null;
```

and `reset()` gains `this.labelPreview = null;`.

`ZoneRenderModel.ts` — add `import type { Vector } from '../../../../core/geometry/Vector';`; the interface gains `/** A dragged caption's offset from its automatic anchor (ADR-0029). */ readonly labelOffset?: Vector;` and `toZoneRenderModel` gains `...(zone.labelOffset ? { labelOffset: zone.labelOffset } : {}),` beside the `locked` spread.

`ZoneShape.vue`:
- import line 37 becomes `import { zoneFillToken, type ZoneRenderModel } from './ZoneRenderModel';`
- import line 39 (`import { captionOffsetY, DETAIL_CAPTION_BOTTOM, type NumberedPin } from './captionPlacement';` since the merge) becomes `import { captionBottom, roomCaptionAnchor, type NumberedPin } from './captionPlacement';`
- delete `const anchor = computed(() => labelAnchor(props.model.points, props.model.bulges));`
- replace the comment starting `// Viewport/obstacle movement often leaves a caption in the same place.`, the two-line `const captionDisplacement = computed(…` statement, and the first line of `captionLayout` with:

```ts
// A caption's position is two NUMBERS rather than one Point: an unchanged position then propagates
// nothing, so vue-konva does not diff seven unchanged configs for every Room.
const captionAnchor = computed(() => roomCaptionAnchor(props.model, props.zoom, props.pins, props.dimensionObstacles,
	{ viewport: props.captionViewport, bottom: captionBottom(props.detailCaption !== null) }));
const captionX = computed(() => captionAnchor.value.x);
const captionY = computed(() => captionAnchor.value.y);
const captionLayout = computed(() => ({ x: captionX.value, y: captionY.value, width: 180, offsetX: 90, align: 'center',
```

(the rest of `captionLayout` is unchanged).

`ZoneLayer.vue`:
- add `import type { Vector } from '../../../../core/geometry/Vector';` and `import { captionPins } from './captionPlacement';`
- props gain `labelPreview?: { readonly id: string; readonly offset: Vector } | null;`
- `captionObstacles` becomes `computed(() => captionPins(props.pins, session.visible, workspace.layerVisibility.annotation))`
- `models` becomes:

```ts
const models = computed(() => {
	const preview = new Map(props.preview?.map(object => [object.id, object]));
	const label = props.labelPreview;
	return [...zones.value.values()].map(zone => toZoneRenderModel({ ...zone, ...preview.get(zone.id), ...(label?.id === zone.id ? { labelOffset: label.offset } : {}) }));
});
```

`PlanCanvas.vue` — `<ZoneLayer>` gains `:label-preview="runtime.renderState.labelPreview"` after `:caption-viewport`.

`elementPreviews.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';

/** Saved elements with their names, any in-flight rotation or move preview in place of the saved one, and a dragged caption's offset. */
export function withElementPreviews(elements: readonly SpatialElement[], names: ReadonlyMap<string, string>, rotation: { readonly id: string; readonly name: string; readonly points: readonly Point[] } | null, moved: NamedSpatialElement | null, label: { readonly id: string; readonly offset: Vector } | null = null): NamedSpatialElement[] {
	return elements.map(element => {
		const shown = rotation?.id === element.id ? { ...element, name: rotation.name, points: rotation.points }
			: moved?.id === element.id ? moved : { ...element, name: names.get(element.id) ?? element.id };
		return label?.id === element.id ? { ...shown, labelOffset: label.offset } : shown;
	});
}
```

(keep the file's existing first import line if it differs only in order).

`StructureLayer.vue` and `AssetLayer.vue` — each `withElementPreviews(…, runtime.elementActions.preview.value)` call gains a fifth argument `, runtime.renderState.labelPreview`.

`ElementShapes.vue`:
- delete the imports of `elementLength` and `formatMetres`; add `import { ELEMENT_LABEL_FONT_PX, elementLabelLayout } from '../labels/labelLayout';`
- the line `const point = element.points[0], zoom = props.zoom, tokens = props.tokens, stroke = …;` becomes `const zoom = props.zoom, tokens = props.tokens, stroke = selected ? tokens.accent : tokens.zoneStroke, label = elementLabelLayout(element, zoom);`
- the `label:` entry becomes `label: { ...label, fontSize: ELEMENT_LABEL_FONT_PX / zoom, fill: tokens.zoneLabel, listening: false } };` (every valid element has a first point, so the old `point ? … : null` arm could never be taken; the template's `v-if="shape.label"` stays)

`assetShapeConfig.ts` — add `import { assetLabelLayout, ELEMENT_LABEL_FONT_PX } from '../labels/labelLayout';`; the `label:` entry becomes:

```ts
		label: { ...assetLabelLayout(element, footprint, zoom), fontSize: ELEMENT_LABEL_FONT_PX / zoom, fill: tokens.zoneLabel, listening: false },
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run tests/presentation/editor/labels tests/presentation/editor/elements tests/presentation/editor/labelRendering.test.ts tests/presentation/editor/captionViewportFallback.test.ts tests/presentation/editor/zoneLayerOrder.test.ts tests/presentation/editor/zoneOutlineEnclosure.test.ts tests/presentation/editor/scene.test.ts`
Expected: PASS.

- [ ] **Step 8: Gate and commit**

Run: `npm run check:fast -- tests/presentation/editor tests/harness`, then `npm run check`.

```bash
git add src/presentation/editor/labels/labelLayout.ts src/presentation/editor/layers/zone/captionPlacement.ts src/presentation/editor/layers/zone/ZoneRenderModel.ts src/presentation/editor/layers/zone/ZoneShape.vue src/presentation/editor/layers/zone/ZoneLayer.vue src/presentation/editor/PlanCanvas.vue src/presentation/editor/elements/ElementShapes.vue src/presentation/editor/elements/assetShapeConfig.ts src/presentation/editor/elements/elementPreviews.ts src/presentation/editor/structure/StructureLayer.vue src/presentation/editor/elements/AssetLayer.vue src/presentation/editor/tools/render-state.ts tests/presentation/editor/labels/labelLayout.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts tests/presentation/editor/labelRendering.test.ts
git commit -m "editor: draw every caption from one placement, at its dragged offset" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: A selected item's caption is a drag target

**Files:**
- Modify: `src/presentation/editor/labels/labelLayout.ts` (add `LabelHit`)
- Create: `src/presentation/editor/labels/LabelMove.ts`
- Modify: `src/presentation/editor/selection/resolveSelectionTarget.ts`
- Modify: `src/presentation/editor/tools/select-tool.ts`
- Modify: `src/presentation/editor/handleMetrics.ts`
- Modify: `src/presentation/editor/tools/render-state.ts` (`hoveredTargetKind` union)
- Modify: `src/presentation/editor/surface/cursor.ts`
- Modify: `tests/presentation/editor/selection/resolveSelectionTarget.test.ts` (append)
- Create: `tests/presentation/editor/tools/selectToolLabelDrag.test.ts`

**Interfaces:**
- Consumes: `RenderState.labelPreview` (Task 4).
- Produces:
  - `LabelHit { readonly id: string; readonly bounds: BoundingBox; readonly offset: Vector }` in `labelLayout.ts` (`offset` is where the caption is drawn NOW relative to its automatic anchor)
  - `LabelMoveDeps { readonly labelHits?: () => readonly LabelHit[]; readonly moveLabel?: (id: string, offset: Vector) => void }`
  - `LabelMove { get active(): boolean; start(context, event, id): void; move(event): boolean; finish(event): boolean; cancel(): void }` — `move`/`finish` answer whether a caption drag consumed the event
  - `SelectionTarget` gains `{ readonly kind: 'label'; readonly id: string }`; `resolveSelectionTarget` input gains `labels?: readonly LabelHit[]` and `labelToleranceWorld?: number`
  - `SelectToolDeps extends … LabelMoveDeps`
  - `LABEL_GRAB_PADDING_PX = 4`
  - `hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | null` in `RenderState` and `CursorInputs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`:

```ts
describe('resolveSelectionTarget caption grabs', () => {
	const room = square('room', 0, 0, 1000);
	const labels = [{ id: 'room', bounds: { min: { x: 400, y: 450 }, max: { x: 600, y: 520 } }, offset: { dx: 0, dy: 0 } }];
	const hit = { candidates: [room], labels, worldPoint: { x: 500, y: 500 }, handleToleranceWorld: 50, labelToleranceWorld: 10 };

	it('grabs a selected item caption, padded, ahead of its body', () => {
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'] })).toEqual({ kind: 'label', id: 'room' });
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], worldPoint: { x: 395, y: 500 } })).toEqual({ kind: 'label', id: 'room' });
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], worldPoint: { x: 380, y: 500 } })).toEqual({ kind: 'body', id: 'room' });
	});

	it('never grabs an unselected, undrawn or cycled caption', () => {
		expect(resolveSelectionTarget({ ...hit, selectedIds: [] })).toEqual({ kind: 'body', id: 'room' });
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], candidates: [] })).toBeNull();
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], cycle: true })).toEqual({ kind: 'body', id: 'room' });
	});

	it('leaves a vertex handle to the handle even where a caption covers it', () => {
		const corner = [{ id: 'room', bounds: { min: { x: -20, y: -20 }, max: { x: 100, y: 100 } }, offset: { dx: 0, dy: 0 } }];
		expect(resolveSelectionTarget({ ...hit, labels: corner, selectedIds: ['room'], worldPoint: { x: 0, y: 0 } })).toEqual({ kind: 'handle', id: 'room', vertexIndex: 0 });
		expect(resolveSelectionTarget({ ...hit, labels: corner, selectedIds: ['room'], worldPoint: { x: 90, y: 90 } })).toEqual({ kind: 'label', id: 'room' });
	});
});
```

Create `tests/presentation/editor/tools/selectToolLabelDrag.test.ts`:

```ts
import { expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, toolContext } from '../../../helpers/tool-context';
import { cursorClassFor } from '../../../../src/presentation/editor/surface/cursor';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { Vector } from '../../../../src/core/geometry/Vector';

/**
 * ADR-0029: a SELECTED item's caption is a drag target. Its own file because `selectTool.test.ts`
 * is at its line budget.
 */
const room = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] };
const caption = { id: 'zone-a', bounds: { min: { x: 400, y: 450 }, max: { x: 600, y: 520 } }, offset: { dx: 0, dy: 20 } };
const zoneA = 'zone-a' as EntityId<string>;

function rig(options: { readonly writesBlocked?: boolean; readonly multiple?: boolean } = {}) {
	setActivePinia(createPinia());
	const { context } = toolContext({ ...(options.writesBlocked ? { writesBlocked: true } : {}), commandDispatcher: { run: () => Promise.resolve(ok('wrote')) } });
	const moves: { id: string; offset: Vector }[] = [], bodyMoves: string[] = [];
	const deps: SelectToolDeps = {
		multiSelectionMode: () => options.multiple === true,
		spatialObjects: () => [room],
		labelHits: () => [caption],
		moveLabel: (id, offset) => { moves.push({ id, offset }); },
		createMoveGesture: (zoneId) => { bodyMoves.push(zoneId); return { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }; },
		reportRejected: () => {},
		reportInvalidInput: () => {},
	};
	const tool = new SelectTool(deps);
	tool.activate(context);
	return { context, tool, moves, bodyMoves };
}

it('drags a selected caption from where it is drawn, previewing and then saving one offset', () => {
	const { context, tool, moves, bodyMoves } = rig();
	context.selection.select([zoneA]);
	tool.pointerMove(pointerAt(500, 500));
	expect(context.renderState.hoveredTargetKind).toBe('label');
	expect(cursorClassFor({ activeToolId: 'select', panPhase: 'idle', hoveredObjectId: 'zone-a', hoveredTargetKind: 'label' })).toBe('rp-plan-canvas-grab');
	tool.pointerDown(pointerAt(500, 500));
	tool.pointerMove(pointerAt(560, 470));
	expect(context.renderState.labelPreview).toEqual({ id: 'zone-a', offset: { dx: 60, dy: -10 } });
	tool.pointerUp(pointerAt(560, 470));
	expect(moves).toEqual([{ id: 'zone-a', offset: { dx: 60, dy: -10 } }]);
	// Left up at the drop: `moveLabel` clears it once the write is read back.
	expect(context.renderState.labelPreview).toEqual({ id: 'zone-a', offset: { dx: 60, dy: -10 } });
	expect(bodyMoves).toEqual([]);
	expect(context.selection.selectedIds).toEqual(['zone-a']);
});

it('treats a press that does not travel as a click: no save, no preview', () => {
	const { context, tool, moves } = rig();
	context.selection.select([zoneA]);
	tool.pointerDown(pointerAt(500, 500)); tool.pointerMove(pointerAt(502, 501)); tool.pointerUp(pointerAt(502, 501));
	expect(moves).toEqual([]);
	expect(context.renderState.labelPreview).toBeNull();
});

it('cancels a caption drag without saving, and starts none while writes are blocked', () => {
	const live = rig();
	live.context.selection.select([zoneA]);
	live.tool.pointerDown(pointerAt(500, 500)); live.tool.pointerMove(pointerAt(600, 600));
	live.tool.pointerUp(pointerAt(600, 600, 'secondary'));
	expect(live.tool.hasDraft()).toBe(true);
	live.tool.cancel();
	expect(live.tool.hasDraft()).toBe(false);
	expect(live.context.renderState.labelPreview).toBeNull();
	live.tool.pointerUp(pointerAt(600, 600));
	expect(live.moves).toEqual([]);
	const blocked = rig({ writesBlocked: true });
	blocked.context.selection.select([zoneA]);
	blocked.tool.pointerDown(pointerAt(500, 500)); blocked.tool.pointerMove(pointerAt(600, 600)); blocked.tool.pointerUp(pointerAt(600, 600));
	expect(blocked.moves).toEqual([]);
	expect(blocked.context.renderState.labelPreview).toBeNull();
});

it('leaves an unselected room, and the select-multiple mode, to their ordinary click', () => {
	const unselected = rig();
	unselected.tool.pointerDown(pointerAt(500, 500)); unselected.tool.pointerMove(pointerAt(600, 600)); unselected.tool.pointerUp(pointerAt(600, 600));
	expect(unselected.moves).toEqual([]);
	expect(unselected.bodyMoves).toEqual(['zone-a']);
	const multiple = rig({ multiple: true });
	multiple.context.selection.select([zoneA]);
	multiple.tool.pointerDown(pointerAt(500, 500)); multiple.tool.pointerUp(pointerAt(500, 500));
	expect(multiple.moves).toEqual([]);
	expect(multiple.context.selection.selectedIds).toEqual([]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/presentation/editor/selection/resolveSelectionTarget.test.ts tests/presentation/editor/tools/selectToolLabelDrag.test.ts`
Expected: FAIL — `resolveSelectionTarget` answers `body` where `label` is expected; `moves` stays empty and a body drag is dispatched instead.

- [ ] **Step 3: Declare the hit and the gesture**

Append to `labelLayout.ts`:

```ts
/** A drawn caption a press can grab: its world box, and the offset it is drawn at NOW (an undragged room caption's pin displacement included). */
export interface LabelHit { readonly id: string; readonly bounds: BoundingBox; readonly offset: Vector }
```

Append to `handleMetrics.ts`:

```ts
/** Invisible screen-pixel margin around a selected item's caption, so a small name tag stays grabbable at any zoom (ADR-0029). */
export const LABEL_GRAB_PADDING_PX = 4;
```

Create `src/presentation/editor/labels/LabelMove.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { LabelHit } from './labelLayout';

export interface LabelMoveDeps {
	/** The captions a press could grab right now: selected, drawn and editable (ADR-0029). */
	readonly labelHits?: () => readonly LabelHit[];
	/** Saves a dropped caption, and clears `renderState.labelPreview` once the write has been read back. */
	readonly moveLabel?: (id: string, offset: Vector) => void;
}

interface LabelGesture { readonly id: string; readonly start: Point; readonly offset: Vector; readonly context: EditorContext }

const offsetAt = (gesture: LabelGesture, event: EditorPointerEvent): Vector =>
	({ dx: gesture.offset.dx + event.worldPoint.x - gesture.start.x, dy: gesture.offset.dy + event.worldPoint.y - gesture.start.y });

/** A caption drag previews only, and a release hands one offset to the write. No snapping: a caption is an annotation. */
export class LabelMove {
	private gesture: LabelGesture | null = null;
	constructor(private readonly deps: LabelMoveDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, id: string): void {
		const hit = this.deps.labelHits?.().find(item => item.id === id);
		if (!hit || !this.deps.moveLabel || context.writesBlocked()) return;
		this.gesture = { id, start: event.worldPoint, offset: hit.offset, context };
	}
	/** Answers whether a caption drag consumed the move, so `SelectTool` asks once instead of checking `active` first. */
	move(event: EditorPointerEvent): boolean {
		const gesture = this.gesture;
		if (!gesture) return false;
		gesture.context.renderState.labelPreview = { id: gesture.id, offset: offsetAt(gesture, event) };
		return true;
	}
	/** Answers whether a caption drag consumed the release; a non-primary release is consumed and ends nothing. */
	finish(event: EditorPointerEvent): boolean {
		const gesture = this.gesture;
		if (!gesture) return false;
		if (event.button !== 'primary') return true;
		this.gesture = null;
		const { context } = gesture;
		const travelled = Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y);
		if (travelled <= CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel() || context.writesBlocked()) { context.renderState.labelPreview = null; return true; }
		const offset = offsetAt(gesture, event);
		// Left previewing at the drop; `moveLabel` clears it once the write has been read back.
		context.renderState.labelPreview = { id: gesture.id, offset };
		this.deps.moveLabel?.(gesture.id, offset);
		return true;
	}
	cancel(): void {
		if (this.gesture) this.gesture.context.renderState.labelPreview = null;
		this.gesture = null;
	}
}
```

- [ ] **Step 4: Resolve a caption target**

In `resolveSelectionTarget.ts`:
- add `import type { LabelHit } from '../labels/labelLayout';`
- the union gains `| { readonly kind: 'label'; readonly id: string }` after the `'rotation'` arm
- add above `resolveSelectionTarget`:

```ts
function labelAt(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly labels?: readonly LabelHit[];
	readonly labelToleranceWorld?: number;
}): SelectionTarget {
	const labels = input.labels ?? [], pad = input.labelToleranceWorld ?? 0, { x, y } = input.worldPoint;
	// Later captions are painted last, so overlapping captions follow the visible stacking. A caption
	// whose item is not a candidate (locked, or on a hidden layer) is not drawn to be grabbed.
	for (let index = labels.length - 1; index >= 0; index -= 1) {
		const { id, bounds } = labels[index];
		if (!input.selectedIds.includes(id) || !input.candidates.some(candidate => candidate.id === id)) continue;
		if (x >= bounds.min.x - pad && x <= bounds.max.x + pad && y >= bounds.min.y - pad && y <= bounds.max.y + pad) return { kind: 'label', id };
	}
	return null;
}
```

- the input type gains

```ts
	/** Selected items' drawn captions (ADR-0029); a press on one drags the caption, not the item. */
	readonly labels?: readonly LabelHit[];
	readonly labelToleranceWorld?: number;
```

- inside `if (!input.cycle) {`, after the `if (decoration !== null) return decoration;` line, add:

```ts
		const label = labelAt(input);
		if (label !== null) return label;
```

  Handles and badges rank ABOVE captions: since `origin/main`'s #150 a selected path, fence, measurement or object has draggable point handles, and its name tag sits just above its first point, so a caption checked first would take a press aimed at that handle.
- the docblock's priority sentence becomes: "Priority: a single selection's vertex handle or a multi-selection badge, then a selected item's caption, then the topmost containing body, then nothing."

- [ ] **Step 5: Route it in `SelectTool`, the render state and the cursor**

`select-tool.ts`:
- imports: `import { LabelMove, type LabelMoveDeps } from '../labels/LabelMove';` and add `LABEL_GRAB_PADDING_PX` to the `../handleMetrics` import
- `export interface SelectToolDeps extends ElementMoveDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {`
- add the field `private readonly labelMove: LabelMove;` beside `elementRotation`, and end the constructor body with `this.labelMove = new LabelMove(deps);`
- `pointerDown`, directly after the `if (target.kind === 'rotation') …` line:
  ```ts
  		if (target.kind === 'label') { this.labelMove.start(context, event, target.id); return; }
  ```
- `pointerMove`, directly after the `selectionMove` line: `if (this.labelMove.move(event)) return;`
- `pointerUp`, directly after the `finishSelectionGesture` line: `if (this.labelMove.finish(event)) return;`
- `discardGesture`: `this.elementMove.cancel(); this.elementRotation.cancel(); this.labelMove.cancel();`
- `hasDraft`: append `|| this.labelMove.active`
- `targetAt`'s `resolveSelectionTarget({ … })` gains:
  ```ts
  			labels: this.deps.labelHits?.(),
  			labelToleranceWorld: LABEL_GRAB_PADDING_PX * context.viewport.worldPerScreenPixel(),
  ```

`render-state.ts`: `hoveredTargetKind: 'body' | 'handle' | 'rotation' | 'label' | null = null;`

`cursor.ts`: `CursorInputs.hoveredTargetKind` gets the same union, and the select line becomes:

```ts
		return inputs.hoveredTargetKind === 'handle' || inputs.hoveredTargetKind === 'rotation' || inputs.hoveredTargetKind === 'label' ? 'rp-plan-canvas-grab' : 'rp-plan-canvas-target';
```

Add one sentence to that function's docblock: "A selected item's caption promises a drag of the caption, so it takes `grab` too (ADR-0029)."

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run tests/presentation/editor/selection tests/presentation/editor/tools tests/presentation/editor/snapping/lineDrawingConstraints.test.ts`
Expected: PASS.

- [ ] **Step 7: Gate and commit**

Run: `npm run check:fast -- tests/presentation/editor`, then `npm run check`.

```bash
git add src/presentation/editor/labels/labelLayout.ts src/presentation/editor/labels/LabelMove.ts src/presentation/editor/selection/resolveSelectionTarget.ts src/presentation/editor/tools/select-tool.ts src/presentation/editor/handleMetrics.ts src/presentation/editor/tools/render-state.ts src/presentation/editor/surface/cursor.ts tests/presentation/editor/selection/resolveSelectionTarget.test.ts tests/presentation/editor/tools/selectToolLabelDrag.test.ts
git commit -m "editor: make a selected item's caption a drag target in the Select tool" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: A dropped caption is saved and undoable

**Files:**
- Create: `src/presentation/editor/labels/labelActions.ts`
- Modify: `src/presentation/editor/elements/rotationBaseline.ts`
- Modify: `src/presentation/editor/elements/spatialEditing.ts`
- Modify: `src/presentation/editor/tools/registerEditorTools.ts`
- Modify: `src/presentation/editor/runtime.ts`
- Modify: `src/presentation/editor/PlanCanvas.vue`
- Create: `tests/presentation/editor/labelDrag.test.ts`

**Interfaces:**
- Consumes: `LabelHit`, `LabelMoveDeps` (Task 5); `roomCaptionAnchor`, `captionPins`, `captionBottom`, `roomCaptionBounds`, `elementCaptionLayout`, `textLabelBounds` (Task 4); `usePlanHierarchyStore().hierarchy.detailPlans[].parentZoneId` (from `origin/main`, ADR-0028); `ReversibleMoveZoneCommand` offset states (Task 3); `Zone.labelOffset` (Task 2).
- Produces: `createLabelActions(context, runtime)` returning `{ hits: ComputedRef<readonly LabelHit[]>; move(id: string, offset: Vector): Promise<void>; setCaptionContext(evidence: readonly NumberedPin[], layout: DimensionObstacleLayout): void }`; `RotationBaseline.labelCommand(offset: Vector): UndoableCommand`; `EditorRuntime.labelActions`.

- [ ] **Step 1: Write the failing integration tests**

Create `tests/presentation/editor/labelDrag.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * ADR-0029, end to end: a selected item's caption dragged through the real Select tool is saved as an
 * offset through that item's own guarded write, previewed until read back, and undone in one step.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { makeZone } from '../../helpers/entities';
import { pointerAt } from '../../helpers/tool-context';
import { err, ok } from '../../../src/core/result/Result';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { projectedGroupGeometry } from '../../../src/presentation/editor/groups/groupSnapshot';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import type { BoundingBox } from '../../../src/core/geometry/BoundingBox';

const rigs: { unmount(): void }[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });

const centre = (box: BoundingBox) => ({ x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 });
const square = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];

async function roomRig() {
	const rig = await structureEditor(); rigs.push(rig);
	const zone = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: square } });
	expectOk(await rig.stack.zones.save(zone, 'absent'));
	await rig.runtime.refreshProjection(); await settle();
	rig.selection.select([zone.id]); await settle();
	return { rig, zone };
}

it('drags a selected room caption, saves only its offset, and undo restores the automatic caption', async () => {
	const { rig, zone } = await roomRig();
	const hit = expectDefined(rig.runtime.labelActions.hits.value.find(item => item.id === zone.id), 'room caption hit');
	const from = centre(hit.bounds), tool = rig.runtime.toolManager;
	const expected = { dx: hit.offset.dx + 500, dy: hit.offset.dy - 300 };
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerMove(pointerAt(from.x + 500, from.y - 300)); await settle();
	expect(rig.runtime.renderState.labelPreview).toEqual({ id: zone.id, offset: expected });
	tool.pointerUp(pointerAt(from.x + 500, from.y - 300));
	await settleUntil(() => rig.project.zones.get(zone.id)?.labelOffset !== undefined && rig.runtime.renderState.labelPreview === null, 'room caption save');
	const saved = expectDefined(expectOk(await rig.stack.zones.getById(zone.id)), 'saved zone').entity;
	expect(saved.labelOffset).toEqual(expected);
	expect(saved.geometry).toEqual(zone.geometry);
	expect(projectedGroupGeometry(rig.project).objects.find(object => object.id === zone.id)?.labelOffset).toEqual(expected);
	await rig.runtime.undo(); await settle();
	expect(expectDefined(expectOk(await rig.stack.zones.getById(zone.id)), 'undone zone').entity.labelOffset).toBeNull();
});

it('grabs no caption in the select-multiple mode, and an unselected room still moves from its caption', async () => {
	const { rig, zone } = await roomRig();
	const from = centre(expectDefined(rig.runtime.labelActions.hits.value[0], 'caption hit').bounds), tool = rig.runtime.toolManager;
	rig.runtime.multiSelectionMode.value = true;
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerUp(pointerAt(from.x, from.y)); await settle();
	expect(rig.selection.selectedIds).toEqual([]);
	rig.runtime.multiSelectionMode.value = false;
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerMove(pointerAt(from.x + 200, from.y)); tool.pointerUp(pointerAt(from.x + 200, from.y));
	await settleUntil(() => rig.project.zones.get(zone.id)?.points[0].x !== 0, 'room body drag');
	expect(rig.project.zones.get(zone.id)?.labelOffset).toBeUndefined();
	expect(rig.runtime.renderState.labelPreview).toBeNull();
});

const element: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: 500, y: 500 }, { x: 3000, y: 500 }] };

async function elementRig() {
	const rig = await renovationEditor(true); rigs.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	rig.selection.select([element.id as never]); await settle();
	return rig;
}

it('saves a dragged element caption through the element write path, and grabs it again from where it now is', async () => {
	const rig = await elementRig();
	const hit = expectDefined(rig.runtime.labelActions.hits.value.find(item => item.id === element.id), 'element caption hit');
	const from = centre(hit.bounds), tool = rig.runtime.toolManager;
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerMove(pointerAt(from.x + 400, from.y - 200)); tool.pointerUp(pointerAt(from.x + 400, from.y - 200));
	await settleUntil(() => rig.project.structure.elements?.find(item => item.id === element.id)?.labelOffset !== undefined && rig.runtime.renderState.labelPreview === null, 'element caption save');
	expect(rig.project.structure.elements?.find(item => item.id === element.id)).toMatchObject({ points: element.points, labelOffset: { dx: 400, dy: -200 } });
	expect(rig.runtime.labelActions.hits.value.find(item => item.id === element.id)?.offset).toEqual({ dx: 400, dy: -200 });
});

it.each(['refuse', 'throw', 'fail'] as const)('writes nothing and drops the preview when the caption save will %s', async failure => {
	const rig = await elementRig(), before = [...rig.stack.vault.entries];
	if (failure === 'refuse') vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
	if (failure === 'throw') vi.spyOn(rig.renovation, 'read').mockRejectedValueOnce(new Error('Offline baseline'));
	if (failure === 'fail') vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(injectedPersistenceError()));
	rig.runtime.renderState.labelPreview = { id: element.id, offset: { dx: 9, dy: 9 } };
	await rig.runtime.labelActions.move(element.id, { dx: 9, dy: 9 }); await settle();
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.runtime.renderState.labelPreview).toBeNull();
});

it('offers and saves nothing for an item with no caption, while blocked, or after the leaf is gone', async () => {
	const rig = await elementRig(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), read = vi.spyOn(rig.renovation, 'read');
	await rig.runtime.labelActions.move('element-missing', { dx: 1, dy: 1 });
	rig.selection.select([expectDefined(rig.project.structure.walls[0], 'a wall').id as never]); await settle();
	expect(rig.runtime.labelActions.hits.value).toEqual([]);
	rig.selection.select([element.id as never]); rig.project.stale = true; await settle();
	expect(rig.runtime.labelActions.hits.value).toEqual([]);
	await rig.runtime.labelActions.move(element.id, { dx: 1, dy: 1 });
	expect(read).not.toHaveBeenCalled();
	rig.project.stale = false; await settle();
	const late = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
	read.mockReturnValueOnce(late.promise);
	const disposed = rig.runtime.labelActions.move(element.id, { dx: 1, dy: 1 });
	rigs.splice(rigs.indexOf(rig), 1); rig.unmount();
	late.resolve(ok(baseline)); await disposed;
	expect(expectDefined(rig.project.structure.elements?.find(item => item.id === element.id), 'element').labelOffset).toBeUndefined();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/presentation/editor/labelDrag.test.ts`
Expected: FAIL — `rig.runtime.labelActions` is undefined.

- [ ] **Step 3: Give both rotation baselines a caption command**

In `rotationBaseline.ts`:
- imports: `import type { Vector } from '../../../core/geometry/Vector';` and change the reversible command import to `import { ReversibleMoveZoneCommand, type MoveCommand } from '../tools/reversible-move-zone-command';`
- `RotationBaseline` gains:
  ```ts
  	/** The same guarded write for a dragged caption: only its offset from the automatic anchor changes (ADR-0029). */
  	labelCommand(offset: Vector): UndoableCommand;
  ```
- `readZoneBaseline`'s `return ok<RotationBaseline>(…)` line becomes:

```ts
		const move: MoveCommand = { execute: input => context.commands.moveObject.execute({ ...input, expected: input.expected ?? version }) };
		return ok<RotationBaseline>({ shape: { ...shape, ...entity.geometry },
			command: points => new ReversibleMoveZoneCommand(move, ledger, entity.id, { ...entity.geometry, points }, entity.geometry),
			labelCommand: offset => new ReversibleMoveZoneCommand(move, ledger, entity.id, { ...entity.geometry, labelOffset: offset }, { ...entity.geometry, labelOffset: entity.labelOffset }) });
```

- `readElementBaseline`'s return becomes:

```ts
	return ok<RotationBaseline>({ shape: { ...element, name },
		command: points => service.command(baseline, elementInput(baseline, { ...element, name, points }), ledger),
		labelCommand: offset => service.command(baseline, elementInput(baseline, { ...element, name, labelOffset: offset }), ledger) });
```

- the docblock above `readZoneBaseline` becomes: `/** Source-specific reads/commands retain the existing guarded Zone and two-document element paths, for a turn and for a dragged caption alike. */`

- [ ] **Step 4: Create `labelActions`**

Create `src/presentation/editor/labels/labelActions.ts`:

```ts
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import type { Vector } from '../../../core/geometry/Vector';
import type { SessionWriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { captionBottom, captionPins, roomCaptionAnchor, type NumberedPin } from '../layers/zone/captionPlacement';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { labelAnchor } from '../layers/zone/ZoneRenderModel';
import type { DimensionObstacleLayout } from '../resize/useDimensionObstacles';
import { projectedRotationTarget, readRotationBaseline } from '../elements/rotationBaseline';
import { elementCaptionLayout, roomCaptionBounds, textLabelBounds, type LabelHit } from './labelLayout';

/**
 * Canvas captions a renovator drags (ADR-0029): which captions a press could grab, and the one write
 * a drop makes. The offset travels the zone's and the element's existing guarded writes
 * (`rotationBaseline.ts`), so a caption drag has their stale check, history and conflict refusal.
 */
export function createLabelActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'renderState'> & { readonly ledger: SessionWriteLedger }) {
	const project = useProjectStore(), editor = useEditorStore(), workspace = useWorkspaceStore(), shapes = useAssetShapeStore(), plans = usePlanHierarchyStore();
	const selection = useSelectionStore(), saves = useSaveStateStore(), session = useRenovationSession(), dialogs = useDialogStore();
	// A zone some plan details draws a third caption line (ADR-0028), so its caption block is taller.
	const detailed = computed(() => new Set(plans.hierarchy.detailPlans.map(detail => detail.parentZoneId)));
	const pins = shallowRef<readonly NumberedPin[]>([]), dimensions = shallowRef<DimensionObstacleLayout>({ bounds: [], viewport: null });
	const working = ref(false);
	let alive = true;
	onBeforeUnmount(() => { alive = false; runtime.renderState.labelPreview = null; });
	const blocked = computed(() => working.value || runtime.writesBlocked.value || saves.state === 'saving' || session.perspective !== 'plan' || runtime.activeToolId.value !== 'select');

	/** A room caption is grabbed where it is DRAWN, pin displacement included, so its hit offset is drawn minus automatic. */
	function hitFor(id: string, zoom: number): LabelHit | null {
		const zone = project.zones.get(id);
		if (zone) {
			const bottom = captionBottom(detailed.value.has(id));
			const drawn = roomCaptionAnchor(zone, zoom, captionPins(pins.value, session.visible, workspace.layerVisibility.annotation), dimensions.value.bounds, { viewport: dimensions.value.viewport, bottom });
			const automatic = labelAnchor(zone.points, zone.bulges);
			return { id, bounds: roomCaptionBounds(drawn, zoom, bottom), offset: { dx: drawn.x - automatic.x, dy: drawn.y - automatic.y } };
		}
		const element = project.structure.elements?.find(item => item.id === id), name = project.plan?.spatialElements?.find(item => item.id === id)?.name;
		if (!element || name === undefined) return null;
		return { id, bounds: textLabelBounds(elementCaptionLayout({ ...element, name }, shapes.shapeOf, zoom), zoom), offset: element.labelOffset ?? { dx: 0, dy: 0 } };
	}
	const hits = computed<readonly LabelHit[]>(() => blocked.value ? [] : selection.selectedIds.flatMap(id => hitFor(String(id), editor.viewport.zoom) ?? []));

	async function move(id: string, offset: Vector): Promise<void> {
		const shape = projectedRotationTarget(project, id, false);
		try {
			if (!alive || blocked.value || dialogs.current || !shape) return;
			working.value = true;
			const baseline = await readRotationBaseline(context, project, shape, runtime.ledger);
			if (!alive) return;
			if (!baseline.ok) { notifyOperationFailure(baseline.error); await runtime.refreshProjection(); return; }
			const result = await runtime.dispatcher.run(baseline.value.labelCommand(offset));
			// A save that failed is reported even from a leaf closed while it ran: the renovator's drop was lost.
			if (!result.ok) notifyOperationFailure(result.error);
		} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.label.failed'); }
		finally {
			working.value = false;
			// A drop leaves its preview up until here, however the write ended.
			if (runtime.renderState.labelPreview?.id === id) runtime.renderState.labelPreview = null;
		}
	}

	return { hits, move, setCaptionContext: (evidence: readonly NumberedPin[], layout: DimensionObstacleLayout) => { pins.value = evidence; dimensions.value = layout; } };
}
```

- [ ] **Step 5: Wire it into the runtime and the tool**

`spatialEditing.ts`:
- imports: `import { createLabelActions } from '../labels/labelActions';` and `import type { LabelMoveDeps } from '../labels/LabelMove';`
- after `const rotationActions = …`: `const labelActions = createLabelActions(context, runtime);`
- `toolBindings`'s type becomes `ElementMoveDeps & RotationGestureDeps & SelectionInteractions & LabelMoveDeps`, and it gains:
  ```ts
  		labelHits: () => labelActions.hits.value,
  		moveLabel: (id, offset) => { void labelActions.move(id, offset); },
  ```
- the return becomes `return { elementTask, elementActions, groupActions, rotationActions, labelActions, curveTask, toolBindings };`

`registerEditorTools.ts`:
- add `import type { LabelMoveDeps } from '../labels/LabelMove';`
- `export interface EditorToolDeps extends ElementMoveDeps, RotationGestureDeps, SelectionInteractions, LabelMoveDeps {`
- the `new SelectTool({ … })` object gains, after `moveElement: deps.moveElement,`: `labelHits: deps.labelHits, moveLabel: deps.moveLabel,`

`runtime.ts`:
- `EditorRuntime` gains `readonly labelActions: SpatialEditing['labelActions'];` after `rotationActions`
- the `createSpatialEditing` destructure gains `labelActions`
- the returned object's `…, rotationActions, curveTask,` line becomes `…, rotationActions, labelActions, curveTask,`

`PlanCanvas.vue`:
- the vue import becomes `import { computed, shallowRef, watch, watchEffect } from 'vue';`
- after `const dimensionLayout = shallowRef<DimensionObstacleLayout>(…);` add:

```ts
// A caption drag grabs a room caption where it is DRAWN, after pins and dimension labels clear it (ADR-0029).
watchEffect(() => { runtime.labelActions.setCaptionContext(evidencePins.value, dimensionLayout.value); });
```

  (`runtime` is declared above it, at line 60.)

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run tests/presentation/editor/labelDrag.test.ts tests/presentation/editor/labelRendering.test.ts tests/presentation/editor/tools tests/presentation/editor/elementInteractionGuards.test.ts tests/presentation/editor/groupRotationDispatchBoundary.test.ts tests/presentation/views/planEditorView.test.ts`
Expected: PASS. If a `settleUntil` times out on a loaded machine, re-run with `--testTimeout=20000` before diagnosing.

- [ ] **Step 7: Gate and commit**

Run: `npm run check:fast -- tests/presentation tests/harness`, then `npm run check`. Read `coverage/coverage-final.json` for `labelActions.ts`, `LabelMove.ts`, `labelLayout.ts` and `resolveSelectionTarget.ts`: every new branch arm must be covered (the floors are 99/99/99/98, so one uncovered arm in a tight metric fails the gate and in a slack one hides). An arm with no test is either given one or removed.

```bash
git add src/presentation/editor/labels/labelActions.ts src/presentation/editor/elements/rotationBaseline.ts src/presentation/editor/elements/spatialEditing.ts src/presentation/editor/tools/registerEditorTools.ts src/presentation/editor/runtime.ts src/presentation/editor/PlanCanvas.vue tests/presentation/editor/labelDrag.test.ts
git commit -m "editor: save a dropped caption through its item's guarded write, one undo step" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Record the decision and the manual case

**Files:**
- Create: `docs/development/adrs/0029-a-label-position-is-sidecar-geometry.md`
- Create: `docs/tests/cases/Drag a caption.md`
- Modify: `docs/superpowers/specs/2026-09-12-draggable-labels-design.md`

**Interfaces:** none.

- [ ] **Step 1: Write the ADR**

Create `docs/development/adrs/0029-a-label-position-is-sidecar-geometry.md`:

```markdown
---
adr: 29
title: A label position is sidecar geometry, stored as an offset
status: Accepted
date: 2026-09-12
area: application
---

# ADR-0029: A label position is sidecar geometry, stored as an offset

## Context

Every caption on the Plan Editor canvas — a room's name and area, an element's name tag, an asset's
name tag — was placed automatically and could not be moved, so captions overlapped furniture, pins
and each other with no remedy.

## Decision

- **Scope:** rooms and areas, elements, and asset placements.
- **Meaning:** an optional `labelOffset: { dx, dy }`, world millimetres from the caption's automatic
  position. Absent means automatic. A dragged room caption is no longer displaced around pins and
  dimension labels: a placement the renovator chose wins.
- **Authority:** the plan geometry sidecar (ADR-0002), on the zone's `objects` entry and on the
  element. Schema 10, written only while some caption in the document is moved; the 9 → 10 migration
  advances the discriminator only. An older build refuses such a sidecar rather than dropping offsets
  on its next save.
- **Interaction:** only a SELECTED item's caption is grabbable, in the `plan` perspective with the
  Select tool, never in the select-multiple mode or with Shift or Alt held. No snapping.
- **History:** a drop is one write through the item's existing guarded path — `MoveSpatialObjectCommand`
  for a zone, the two-document renovation command for an element — so it is one undo step with the
  same stale and conflict refusals as a move or a turn.
- **Carried by every rewrite of the geometry:** zone moves, nudges and turns keep the offset; a
  calibration rescales it; a group move's projection and its zone versions carry it; the zone version
  digest observes it.

## Alternatives

- **An absolute position.** Left behind by every move, nudge and turn, so each of those commands
  would have to move it as well.
- **Session-only state.** Lost on reload.
- **Frontmatter on the zone note.** Elements have no note, and a caption position is geometry.

## Consequences

- A vault with a moved caption opened in an older build refuses that plan's sidecar until the build
  is updated.
- A caption cannot be moved by keyboard, and there is no action returning it to its automatic place;
  undo is the way back from an accidental drag.

## Revisit when

A renovator asks for a reset action, a keyboard move, or to move a room's name and area separately.
```

- [ ] **Step 2: Write the manual case**

Create `docs/tests/cases/Drag a caption.md`:

```markdown
---
type: Test case
sources:
  - ADR-0029
status: Ready
---

# Drag a caption

Run in `npm run test-build`'s vault with a plan holding one room, one object and one placed asset.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + obsidian | Select the room; hover its name | Grab cursor over the caption; outside it the ordinary target cursor |
| suite + obsidian | Drag the room's caption to a corner of the room and release | Caption follows the pointer; on release it stays there; the room does not move |
| suite + obsidian | Undo, then Redo | Caption returns to the room's centre, then back to the corner |
| suite + obsidian | Move, nudge and rotate the room | Caption keeps its place relative to the room |
| suite + obsidian | Click an unselected room on its caption and drag | The room moves, not the caption |
| suite + obsidian | Turn on select multiple, click a selected room's caption | The room is deselected; nothing is dragged |
| suite + obsidian | Select the object, drag its name tag; repeat for the asset | Each tag stays where dropped; geometry unchanged |
| obsidian | Close and reopen the plan | Every moved caption is where it was dropped |
| suite + obsidian | Calibrate the plan | Captions keep their place relative to their items |
| obsidian | Switch to the renovation perspective; press a selected room's caption | No caption drag starts |

## Runs

Not yet run. Record the build hash, date and outcome of each row here when it is.
```

- [ ] **Step 3: Write the plan-time amendments back into the spec**

In `docs/superpowers/specs/2026-09-12-draggable-labels-design.md`:
- §3.2: every `label: { dx, dy }` becomes `labelOffset: { dx, dy }`, with the sentence "The key is the domain's own name because elements pass through the sidecar port unmapped."
- §4.1 and §4.2: replace `SpatialObjectCandidate` gains an optional `labelBounds` … `canvasCandidates` computes it with: "`SelectTool` gains a `labelHits` dependency (the `rotationControls` precedent), answered by `labelActions` from the same placement functions the renderers call."
- §4.2: "answers `'label'` after the rotation handle and before vertex handles, badges and bodies" becomes "answers `'label'` after the rotation handle, vertex handles and badges, and before bodies — an element's name tag sits just above its first point, where its handle is grabbed". §3.3 and §5.1 gain: "a room caption's block is taller while a detail-plans line shows (`captionBottom`, ADR-0028)".
- §5.2: add a bullet "**Every rewrite of the geometry carries it**: a calibration rescales offsets; the group-move projection and its zone versions carry them; the zone version digest observes them."
- §6: replace the harness-shot sentence with "Outside the gates: the manual case `docs/tests/cases/Drag a caption.md`. No fixed harness capture: the harness Plan Editor floor has no renovation services, so a drag cannot save there."

- [ ] **Step 4: Gate and commit**

Run: `npm run check`.
Expected: green (`tests/build/encoding.test.ts` refuses a BOM, so write these files with the editor tools, not PowerShell).

```bash
git add "docs/development/adrs/0029-a-label-position-is-sidecar-geometry.md" "docs/tests/cases/Drag a caption.md" docs/superpowers/specs/2026-09-12-draggable-labels-design.md
git commit -m "docs: ADR-0029 and the manual case for dragging a caption" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
