# Asset Designer, First Increment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an `Asset` definition a shape — footprint, clearance boundary, anchor, facing and height — stored in a library-scoped geometry sidecar, and a per-asset designer surface to draw it on.

**Architecture:** The footprint polygon is the only stored geometry of record; typing dimensions writes a rectangle into it, tracing replaces it, and width/depth are always its bounding box. Scalars (`height`, background reference) live in the asset note's frontmatter; the coordinate space (footprint, clearance, anchor, facing, calibration, provenance) lives in `<libraryFolder>/Geometry/<assetId>.rpgeo`. The designer is a per-asset Obsidian view that mounts the same gesture surface as the plan editor, extracted from `PlanCanvas.vue` in a commit of its own.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Konva via vue-konva, zod, decimal.js, Obsidian 1.13.0 API, vitest + jsdom, ESLint + oxlint.

**Spec:** [`docs/superpowers/specs/2026-08-30-asset-designer-first-increment-design.md`](../specs/2026-08-30-asset-designer-first-increment-design.md)

## Global Constraints

- **`npm run check` must pass before every commit.** It is build + lint (oxlint then ESLint) + `test:coverage` + `analyze`. All four, verbatim; CI runs the same command across Ubuntu 22/24/26 and Windows 22.
- **Layer bans are lint rules.** `presentation → application → domain → core`; `infrastructure → application`; only `src/plugin/` composes. `core/`, `domain/` and `application/` may not name `vue`, `pinia`, `konva`, `vue-konva` or `obsidian`.
- **Nothing writes to the vault outside `infrastructure/`** (`WRITE_BOUNDARY` in `eslint.config.mjs`).
- **No user-facing string literal.** Every one goes through `t(language, key)` with entries in **both** `src/presentation/i18n/en.ts` and `de.ts`. German says **`Objekt`**, never `Material`.
- **No raw exception text in a notice.** `NOTICE_TEXT_BAN` refuses `.message`/`.stack` inside `notify(...)`, `notifySuccess(...)`, `notifyWarning(...)` and `new Notice(...)`.
- **World coordinates are millimetres** (ADR-009). Every sidecar declares `unit: 'mm'` and fails validation otherwise.
- **Sentence-case UI text**; no hard-coded colours in `styles/` (use Obsidian CSS variables); `max-lines` is 400 for `src/**`.
- **Every command leaving the composition root is guarded** (`guardCommand`/`guardQuery`, or `guardBothDoors` where a reversible adapter dispatches through `executeWithVersion`).
- **Every command's `ok(...)` reports a `DispatchOutcome`** — `'wrote' | 'no-write'`, required, never inferred.
- **This branch may not merge before design slice 19's implementation.** It consumes `libraryFolder`, an `Asset` with no `projectId`, `t(language, key, params?)` and a vault-wide `ListAssets`.

## Prerequisite check before Task A1

Run this first. If any line disagrees, **stop and report** — the plan is written against slice 19's post-state:

```bash
grep -n "projectId" src/domain/asset/Asset.ts            # expect: no matches
grep -rn "libraryFolder" src/plugin/settings.ts          # expect: the setting exists
grep -n "execute(" src/application/queries/ListAssets.ts # expect: no projectId parameter
grep -n "params" src/presentation/i18n/strings.ts        # expect: t takes a third argument
```

## File Structure

**Phase A — the shape (ships without a canvas)**

| File | Responsibility |
| --- | --- |
| `docs/development/adrs/0014-library-scoped-asset-geometry-sidecar.md` | where an asset's geometry file lives, and why |
| `src/domain/asset/AssetShape.ts` | the shape value type; `footprintFromDimensions`, `dimensionsOf`, `validateAssetShape` |
| `src/application/ports/AssetGeometrySidecar.ts` | read/write one asset's geometry document, conditional on a version |
| `src/infrastructure/persistence/dto/assetGeometry.ts` | `AssetGeometrySchemaV1` and its mapper |
| `src/infrastructure/persistence/geometry/AssetGeometryStore.ts` | the concrete `.rpgeo` store |
| `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts` | the port's adapter |
| `src/application/commands/asset/SetAssetFootprint.ts` | traced polygon, and the typed-dimensions sibling |
| `src/application/commands/asset/SetAssetClearance.ts` | clearance boundary |
| `src/application/commands/asset/SetAssetAnchor.ts` | anchor point |
| `src/application/commands/asset/SetAssetFacing.ts` | facing angle |
| `src/application/commands/asset/SetAssetHeight.ts` | the one frontmatter scalar |
| `src/application/queries/GetAssetDesign.ts` | the designer's single read |
| `src/presentation/dialogs/kinds/NewAssetForm.vue` | create an asset, optionally with dimensions |

**Phase B — the designer**

| File | Responsibility |
| --- | --- |
| `docs/development/adrs/0015-asset-designer-workspace-surface.md` | the view type, and the superseded mode decision |
| `src/presentation/editor/surface/EditorSurface.vue` | subject-agnostic camera and pointer routing, extracted from `PlanCanvas.vue` |
| `src/presentation/designer/AssetDesignerView.ts` | the `ItemView`, its state and its Vue app |
| `src/presentation/designer/AssetDesignerRoot.vue` | shell regions, dialog host, save state |
| `src/presentation/designer/layers/*.ts` | background, footprint, clearance, anchor and facing |
| `src/presentation/designer/tools/*.ts` | the designer's tool registrations |
| `src/presentation/designer/inspector/DesignerInspector.vue` | derived dimensions, the unscaled marker, the height field |
| `src/application/commands/asset/CalibrateAsset.ts` | the object's own calibration, rescaling everything it owns |
| `src/plugin/assetDesignerCommands.ts` | `open-asset-designer` and its picker |

---

# Phase A — the shape

Phase A ships a usable feature with no new canvas: a renovator creates an asset with a width and a depth, and every plan referencing it knows its footprint.

### Task A1: ADR-0014 — where an asset's geometry lives

**Files:**
- Create: `docs/development/adrs/0014-library-scoped-asset-geometry-sidecar.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the path rule every later task builds on — `<libraryFolder>/Geometry/<assetId>.rpgeo`, named by the **full prefixed id**, carrying `assetId` where the plan's sidecar carries `planId`.

- [ ] **Step 1: Read the ADR this one mirrors**

Read `docs/development/adrs/0011-project-scoped-geometry-sidecar-folder-and-file-extension.md` in full. ADR-0014 is its reasoning with one noun changed — the owning unit of a catalogue entry is the library, not the project.

- [ ] **Step 2: Write the ADR**

Use ADR-011's frontmatter shape (`adr`, `title`, `status: Accepted`, `date: 2026-08-30`, `area: persistence`). Sections: Context, Decision, Consequences, Alternatives. It must state:

- the layout `<libraryFolder>/Geometry/<assetId>.rpgeo`, a sibling of `Assets/`, with a directory sketch;
- that the id is the full `<prefix>-<ULID>`, so note field, sidecar field and filename are one comparable string;
- that `rpgeo` is already registered with Obsidian by `GEOMETRY_SIDECAR_VIEW`, so no new registration is owed;
- **the stray-note consequence**: slice 19's open question 3 leaves asset notes filed outside the library indexed but unmoved, and their geometry still lands in the library's `Geometry/` because the path derives from the setting, not from the note — the index is the only thing pairing them, exactly as for plans;
- that a `libraryFolder` change must move `Geometry/` with `Assets/` in slice 19's own migration, so a stale path cannot survive the setting;
- Alternatives rejected, each with ADR-011's own reason: colocation beside the note (scatters `.rpgeo` into a folder the user reads, and re-couples geometry to a display name), and a second configurable folder (re-answers a question `libraryFolder` has already answered).

- [ ] **Step 3: Check the wikilinks resolve**

```bash
grep -o "\[\[[^]]*\]\]" docs/development/adrs/0014-library-scoped-asset-geometry-sidecar.md | sort -u
```

Every target must exist under `docs/`. Fix any that does not.

- [ ] **Step 4: Commit**

```bash
git add docs/development/adrs/0014-library-scoped-asset-geometry-sidecar.md
git commit -m "ADR-0014: asset geometry lives in the library's own Geometry folder"
```

---

### Task A2: `AssetShape` and the maths under it

**Files:**
- Create: `src/domain/asset/AssetShape.ts`
- Test: `tests/domain/asset/assetShape.test.ts`

**Interfaces:**
- Consumes: `core/geometry` — `Polygon`, `createPolygon`, `boundingBoxOf`, `coincident`, `Point`; `core/result` — `Result`, `ok`, `err`; `domain/asset/Asset.errors` — `assetError`.
- Produces:

```typescript
export type FootprintOrigin = 'typed' | 'traced';

export interface AssetShape {
	readonly footprint: Polygon;
	readonly footprintOrigin: FootprintOrigin;
	/** Captured on an uncalibrated surface and still awaiting a scale. Typed geometry is never pending. */
	readonly pendingScale: boolean;
	readonly clearance: Polygon | null;
	readonly anchor: Point;
	/** Radians, measured anticlockwise from +x, normalised to [0, 2π). */
	readonly facing: number;
}

export interface Dimensions { readonly width: number; readonly depth: number; }

export function footprintFromDimensions(width: number, depth: number): Result<Polygon, ValidationError>;
export function dimensionsOf(footprint: Polygon): Result<Dimensions, GeometryError>;
export function normaliseFacing(radians: number): number;
export function validateAssetShape(shape: AssetShape): Result<AssetShape, ValidationError>;
```

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/asset/assetShape.test.ts
import { describe, expect, it } from 'vitest';
import { footprintFromDimensions, dimensionsOf, normaliseFacing } from '../../../src/domain/asset/AssetShape';
import { isErr, isOk } from '../../../src/core/result/Result';

describe('footprintFromDimensions', () => {
	it('centres a rectangle on the origin so the anchor default is meaningful', () => {
		const result = footprintFromDimensions(1200, 800);
		expect(isOk(result)).toBe(true);
		if (!isOk(result)) return;
		expect(result.value.points).toEqual([
			{ x: -600, y: -400 }, { x: 600, y: -400 },
			{ x: 600, y: 400 }, { x: -600, y: 400 },
		]);
	});

	it('refuses a non-positive dimension, which would be a degenerate polygon', () => {
		const result = footprintFromDimensions(0, 800);
		expect(isErr(result)).toBe(true);
		if (!isErr(result)) return;
		expect(result.error.code).toBe('asset.non-positive-dimension');
	});

	it('refuses a non-finite dimension before it reaches the polygon validator', () => {
		expect(isErr(footprintFromDimensions(Number.NaN, 800))).toBe(true);
	});
});

describe('dimensionsOf', () => {
	it('reads the bounding box, so a traced outline needs no typed numbers beside it', () => {
		const traced = footprintFromDimensions(1200, 800);
		if (!isOk(traced)) throw new Error('fixture');
		const dims = dimensionsOf(traced.value);
		expect(isOk(dims) && dims.value).toEqual({ width: 1200, depth: 800 });
	});
});

describe('normaliseFacing', () => {
	it('folds a negative angle into [0, 2π)', () => {
		expect(normaliseFacing(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10);
	});

	it('folds exactly 2π to 0 rather than leaving two spellings of north', () => {
		expect(normaliseFacing(Math.PI * 2)).toBe(0);
	});
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run tests/domain/asset/assetShape.test.ts
```

Expected: FAIL — `Cannot find module '.../AssetShape'`.

- [ ] **Step 3: Implement `AssetShape.ts`**

```typescript
import type { Point } from '../../core/geometry/Point';
import type { Polygon } from '../../core/geometry/Polygon';
import { createPolygon } from '../../core/geometry/Polygon';
import { boundingBoxOf, coincident } from '../../core/geometry/operations';
import type { GeometryError, ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';

const TAU = Math.PI * 2;

export type FootprintOrigin = 'typed' | 'traced';

export interface AssetShape {
	readonly footprint: Polygon;
	readonly footprintOrigin: FootprintOrigin;
	/** Captured on an uncalibrated surface and still awaiting a scale. Typed geometry is never pending. */
	readonly pendingScale: boolean;
	readonly clearance: Polygon | null;
	readonly anchor: Point;
	readonly facing: number;
}

export interface Dimensions {
	readonly width: number;
	readonly depth: number;
}

/**
 * A typed width and depth become a rectangle CENTRED ON THE ORIGIN, which is what makes
 * the default anchor `{ x: 0, y: 0 }` mean the middle of the object rather than a corner
 * nobody chose. Millimetres (ADR-009), like every world coordinate here.
 */
export function footprintFromDimensions(width: number, depth: number): Result<Polygon, ValidationError> {
	for (const value of [width, depth]) {
		if (!Number.isFinite(value) || value <= 0) {
			return err(assetError('non-positive-dimension', `A dimension must be a positive, finite number of millimetres; got ${String(value)}.`));
		}
	}
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const polygon = createPolygon([
		{ x: -halfWidth, y: -halfDepth },
		{ x: halfWidth, y: -halfDepth },
		{ x: halfWidth, y: halfDepth },
		{ x: -halfWidth, y: halfDepth },
	]);
	if (isErr(polygon)) {
		return err(assetError('invalid-footprint', polygon.error.message));
	}
	return ok(polygon.value);
}

/**
 * Dimensions are DERIVED (§88) — the bounding box of the footprint, never a stored pair.
 * A traced outline and a typed rectangle answer through one function for that reason.
 */
export function dimensionsOf(footprint: Polygon): Result<Dimensions, GeometryError> {
	const box = boundingBoxOf(footprint);
	if (isErr(box)) return box;
	return ok({
		width: box.value.max.x - box.value.min.x,
		depth: box.value.max.y - box.value.min.y,
	});
}

/** One spelling per direction: `[0, 2π)`, so a stored 2π and a stored 0 cannot differ. */
export function normaliseFacing(radians: number): number {
	if (!Number.isFinite(radians)) return 0;
	const folded = radians % TAU;
	return folded < 0 ? folded + TAU : folded;
}

/**
 * The shape's own smart constructor: both polygons must be valid, the facing finite, and
 * the anchor's coordinates finite. `coincident` rather than bitwise equality is the rule
 * this repository has already paid for twice — a point through trigonometry is never
 * exactly what it should be.
 */
export function validateAssetShape(shape: AssetShape): Result<AssetShape, ValidationError> {
	const footprint = createPolygon(shape.footprint.points);
	if (isErr(footprint)) return err(assetError('invalid-footprint', footprint.error.message));
	if (shape.clearance !== null) {
		const clearance = createPolygon(shape.clearance.points);
		if (isErr(clearance)) return err(assetError('invalid-clearance', clearance.error.message));
	}
	if (!Number.isFinite(shape.anchor.x) || !Number.isFinite(shape.anchor.y)) {
		return err(assetError('invalid-anchor', 'An anchor must have finite coordinates.'));
	}
	if (!Number.isFinite(shape.facing)) {
		return err(assetError('invalid-facing', 'A facing must be a finite angle in radians.'));
	}
	return ok({ ...shape, facing: normaliseFacing(shape.facing) });
}

/** Every shape starts here: the rectangle, centred, facing +x, with no clearance. */
export function shapeFromDimensions(width: number, depth: number): Result<AssetShape, ValidationError> {
	const footprint = footprintFromDimensions(width, depth);
	if (isErr(footprint)) return footprint;
	return ok({
		footprint: footprint.value,
		footprintOrigin: 'typed',
		pendingScale: false,
		clearance: null,
		anchor: { x: 0, y: 0 },
		facing: 0,
	});
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run tests/domain/asset/assetShape.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Add the `validateAssetShape` cases**

Three more `it` blocks, each asserting the code rather than the message: a two-point footprint refuses `asset.invalid-footprint`, a `NaN` anchor refuses `asset.invalid-anchor`, and a `facing` of `2π` comes back as `0` from the ok arm — that last one proves normalisation happens on the way through the validator and not only in `normaliseFacing`'s own test.

- [ ] **Step 6: Full gate, then commit**

```bash
npm run check
git add src/domain/asset/AssetShape.ts tests/domain/asset/assetShape.test.ts
git commit -m "An asset's shape, and the maths that derives its dimensions"
```

---

### Task A3: the sidecar port and its schema

**Files:**
- Create: `src/application/ports/AssetGeometrySidecar.ts`
- Create: `src/infrastructure/persistence/dto/assetGeometry.ts`
- Test: `tests/infrastructure/persistence/dto/assetGeometry.test.ts`

**Interfaces:**
- Consumes: `AssetShape` (Task A2), `EntityVersion` from `application/ports/versioning`, `Calibration` from `domain/plan/Calibration`.
- Produces:

```typescript
export interface AssetGeometryDocument {
	readonly calibration: Calibration | null;
	readonly shape: AssetShape | null;
}
export interface AssetGeometrySnapshot {
	readonly document: AssetGeometryDocument;
	readonly version: EntityVersion;
}
export interface AssetGeometrySidecar {
	read(assetId: AssetId): Promise<Result<AssetGeometrySnapshot, RepositoryError>>;
	write(assetId: AssetId, document: AssetGeometryDocument, expected?: EntityVersion): Promise<Result<EntityVersion, RepositoryError>>;
}
```

- [ ] **Step 1: Read the two files this pair mirrors**

`src/application/ports/PlanGeometrySidecar.ts` and `src/infrastructure/persistence/dto/planGeometry.ts`. The asset pair is the same shape with `assetId` for `planId` and one `shape` for many `objects`.

- [ ] **Step 2: Write the failing schema tests**

```typescript
// tests/infrastructure/persistence/dto/assetGeometry.test.ts
import { describe, expect, it } from 'vitest';
import { AssetGeometrySchemaV1 } from '../../../../src/infrastructure/persistence/dto/assetGeometry';

const valid = {
	schemaVersion: 1,
	assetId: 'asset-01JABC',
	revision: 3,
	unit: 'mm',
	calibration: null,
	shape: {
		footprint: { points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] },
		footprintOrigin: 'typed',
		pendingScale: false,
		clearance: null,
		anchor: { x: 0, y: 0 },
		facing: 0,
	},
};

describe('AssetGeometrySchemaV1', () => {
	it('round-trips a typed rectangle', () => {
		expect(AssetGeometrySchemaV1.safeParse(valid).success).toBe(true);
	});

	it('refuses a unit that is not mm, rather than silently reinterpreting it (ADR-009)', () => {
		expect(AssetGeometrySchemaV1.safeParse({ ...valid, unit: 'cm' }).success).toBe(false);
	});

	it('refuses a provenance outside the union, so an unknown origin cannot be read as typed', () => {
		const bad = { ...valid, shape: { ...valid.shape, footprintOrigin: 'imported' } };
		expect(AssetGeometrySchemaV1.safeParse(bad).success).toBe(false);
	});

	it('keeps three decimals, which is what catches a YAML float coercion', () => {
		const precise = { ...valid, shape: { ...valid.shape, anchor: { x: 594.005, y: 0 } } };
		const parsed = AssetGeometrySchemaV1.safeParse(precise);
		expect(parsed.success && parsed.data.shape?.anchor.x).toBe(594.005);
	});

	it('reads a missing revision as 0 rather than failing, like every other schema here', () => {
		const { revision: _dropped, ...withoutRevision } = valid;
		const parsed = AssetGeometrySchemaV1.safeParse(withoutRevision);
		expect(parsed.success && parsed.data.revision).toBe(0);
	});

	it('accepts a null shape: an asset may have a background and a calibration before it has an outline', () => {
		expect(AssetGeometrySchemaV1.safeParse({ ...valid, shape: null }).success).toBe(true);
	});
});
```

- [ ] **Step 3: Run and watch it fail**

```bash
npx vitest run tests/infrastructure/persistence/dto/assetGeometry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the schema**

```typescript
// src/infrastructure/persistence/dto/assetGeometry.ts
import { z } from 'zod';
import { CalibrationSchemaV1 } from './planGeometry';

const pointTuple = z.tuple([z.number(), z.number()]);

export const AssetShapeSchemaV1 = z.object({
	footprint: z.object({ points: z.array(pointTuple) }),
	footprintOrigin: z.enum(['typed', 'traced']),
	/**
	 * Whether these coordinates are still awaiting a scale — a fact recorded AT CAPTURE, not
	 * derived from whether a calibration happens to exist now. Deriving it would answer a
	 * question about the past out of live state, and would re-flag a genuinely measured
	 * outline the moment its background was replaced.
	 */
	pendingScale: z.boolean().catch(false),
	clearance: z.object({ points: z.array(pointTuple) }).nullable(),
	anchor: z.object({ x: z.number(), y: z.number() }),
	facing: z.number(),
});

/**
 * One file per ASSET (ADR-0014), named by the asset's stable id with the registered
 * `rpgeo` extension — the plan sidecar's schema with `assetId` for `planId` and one
 * `shape` where a plan holds many `objects`, because an asset IS one object.
 *
 * `calibration` is the ASSET's own and never a plan's: the epic replaces
 * "calibration belongs to the plan" with "an object's calibration belongs to the object".
 *
 * `shape` is nullable because the states are ordered — an asset may carry a background
 * and a calibration before anybody has drawn an outline on it.
 */
export const AssetGeometrySchemaV1 = z.object({
	schemaVersion: z.literal(1),
	assetId: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	unit: z.literal('mm'),
	calibration: CalibrationSchemaV1.nullable(),
	shape: AssetShapeSchemaV1.nullable(),
});

export type AssetGeometryDTO = z.infer<typeof AssetGeometrySchemaV1>;
```

If `revision` fails the missing-key case, note that `.catch(0)` rescues a *present but invalid* value, not an absent key — add `.default(0)` before `.catch(0)` and re-run.

- [ ] **Step 5: Write the port**

`src/application/ports/AssetGeometrySidecar.ts`, copying `PlanGeometrySidecar.ts`'s docblock discipline: state that the write replaces the whole document and is conditional on `expected`, and that recalibration rewrites the calibration and every rescaled coordinate in ONE file operation, which is why it is document-grained.

- [ ] **Step 6: Run, then commit**

```bash
npx vitest run tests/infrastructure/persistence/dto/assetGeometry.test.ts
npm run check
git add src/application/ports/AssetGeometrySidecar.ts src/infrastructure/persistence/dto/assetGeometry.ts tests/infrastructure/persistence/dto/assetGeometry.test.ts
git commit -m "The asset geometry sidecar: its schema and its port"
```

---

### Task A4: the store, the path, and the adapter

**Files:**
- Create: `src/infrastructure/persistence/geometry/AssetGeometryStore.ts`
- Create: `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts`
- Modify: `src/infrastructure/obsidian/repositories/paths.ts` (add `libraryGeometryFolderFor`, `assetSidecarPathFor`)
- Test: `tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts`
- Test: `tests/infrastructure/obsidian/repositories/paths.test.ts` (extend)

**Interfaces:**
- Consumes: `AssetGeometrySidecar` (A3), `FakeVault` from `tests/helpers/vault.ts`, `normalizeFolder`/`joinFolder` from `paths.ts`.
- Produces: `libraryGeometryFolderFor(libraryFolder: string): string` and `assetSidecarPathFor(libraryFolder: string, assetId: AssetId | string): string`; the `ObsidianAssetGeometrySidecar` class the composition root constructs.

- [ ] **Step 1: Write the failing path tests**

```typescript
it('puts an asset sidecar in the library, a sibling of Assets/', () => {
	expect(assetSidecarPathFor('Renovation/Library', 'asset-01JABC'))
		.toBe('Renovation/Library/Geometry/asset-01JABC.rpgeo');
});

it('normalises a library folder given with a trailing slash', () => {
	expect(assetSidecarPathFor('Renovation/Library/', 'asset-01JABC'))
		.toBe('Renovation/Library/Geometry/asset-01JABC.rpgeo');
});

it('names the file by the full prefixed id, so note, sidecar and filename compare directly', () => {
	expect(assetSidecarPathFor('L', 'asset-01JABC')).toContain('asset-01JABC.rpgeo');
});
```

- [ ] **Step 2: Run, watch fail, implement the two helpers**

```typescript
export function libraryGeometryFolderFor(libraryFolder: string): string {
	return joinFolder(normalizeFolder(libraryFolder), 'Geometry');
}

/** ADR-0014: one file per asset, in the library's own `Geometry/`, named by the full id. */
export function assetSidecarPathFor(libraryFolder: string, assetId: AssetId | string): string {
	return `${libraryGeometryFolderFor(libraryFolder)}/${String(assetId)}.rpgeo`;
}
```

- [ ] **Step 3: Write the failing store tests**

Model them on the existing plan-geometry sidecar tests (find them with `grep -rl "PlanGeometryStore\|sidecarPathFor" tests/`). Five cases, each asserting behaviour rather than a call:

1. a read of an absent sidecar answers a document with `shape: null` and `calibration: null` at revision 0 — **not** a failure, because an asset without geometry is the ordinary starting state;
2. a write creates the `Geometry/` folder first — drive it against a `FakeVault` whose `create` refuses a missing parent, which is the fake that caught this exact defect for plans;
3. a write then a read round-trips a typed rectangle including `footprintOrigin`;
4. a write with a stale `expected` refuses with a revision-conflict code and leaves the bytes on disk unchanged (assert the file content, not just the error);
5. a file whose `unit` is not `mm` fails the read rather than loading.

- [ ] **Step 4: Implement the store and the adapter**

`AssetGeometryStore` mirrors `PlanGeometryStore`: `ensureFolder` before create, whole-document write, `revision` incremented by the store, schema validation on read, and the `unit: 'mm'` literal doing the refusing. `ObsidianAssetGeometrySidecar` adapts it to the port and maps storage tuples to `Point`s so no caller parses storage shape.

- [ ] **Step 5: Run the whole infrastructure suite**

```bash
npx vitest run tests/infrastructure
```

Expected: PASS, with the new file's cases included.

- [ ] **Step 5a: Move `Geometry/` when `libraryFolder` changes**

Slice 19's settings migration validates, moves the catalogue notes, rebuilds the index and persists
the new value **last**. Asset geometry joins that same move — it does not get a second migration.

Write the failing test first:

```typescript
it('moves the geometry sidecars with the catalogue, so a designed shape survives the setting', async () => {
	await store.write(assetId, documentWithShape);
	await changeLibraryFolder('Renovation/Library', 'Vault/Catalogue');
	const moved = await store.read(assetId);
	expect(isOk(moved) && moved.value.document.shape).not.toBeNull();
	expect(vault.exists('Renovation/Library/Geometry/' + assetId + '.rpgeo')).toBe(false);
});

it('does not persist the new folder when moving the geometry fails', async () => {
	await store.write(assetId, documentWithShape);
	vault.failRenameOf(/\.rpgeo$/);
	await expectRejectedChange('Vault/Catalogue');
	expect(settings.libraryFolder).toBe('Renovation/Library');
	const stillThere = await store.read(assetId);
	expect(isOk(stillThere) && stillThere.value.document.shape).not.toBeNull();
});
```

Without this, the store resolves sidecars under the new folder the instant the setting persists,
every designed shape disappears from the application and the files are orphaned under the old path
— **silently**, because an absent sidecar reads as `shape: null` rather than as an error. The
second case is what keeps the failure recoverable: persist last, or not at all.

- [ ] **Step 6: Add the fixture-vault fixtures**

Slice 12's disk-backed fixture vault needs two assets: one with a `.rpgeo` beside its note in the
library's `Geometry/`, and one with none. Add them where the existing fixtures live (find them with
`grep -rln "FixtureStack\|fixtureVault" tests/`), and assert the second reads as
`shape: null` rather than failing — an asset without geometry is the ordinary starting state, and a
fixture that cannot express it would hide every "no shape yet" path from the suite.

- [ ] **Step 7: Full gate, then commit**

```bash
npm run check
git add src/infrastructure tests/infrastructure tests/helpers
git commit -m "Store an asset's geometry in the library's Geometry folder"
```

---

### Task A5: the two footprint commands

**Files:**
- Create: `src/application/commands/asset/SetAssetFootprint.ts` (both commands live here — they share one write path and splitting them would be two derivations of it)
- Test: `tests/application/commands/asset/setAssetFootprint.test.ts`

**Interfaces:**
- Consumes: `AssetGeometrySidecar` (A3), `shapeFromDimensions`/`validateAssetShape` (A2), `Command` from `application/commands/Command`, `DispatchOutcome`.
- Produces:

```typescript
export interface SetAssetFootprintFromDimensionsInput {
	readonly assetId: AssetId;
	readonly width: number;
	readonly depth: number;
	readonly expected?: EntityVersion;
}
export interface SetAssetFootprintInput {
	readonly assetId: AssetId;
	readonly points: readonly Point[];
	readonly expected?: EntityVersion;
}
export class SetAssetFootprintFromDimensionsCommand implements Command<SetAssetFootprintFromDimensionsInput, Result<DispatchOutcome, AppError>> {}
export class SetAssetFootprintCommand implements Command<SetAssetFootprintInput, Result<DispatchOutcome, AppError>> {}
```

- [ ] **Step 1: Write the failing tests**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { SetAssetFootprintFromDimensionsCommand, SetAssetFootprintCommand } from '../../../../src/application/commands/asset/SetAssetFootprint';
import { isErr, isOk } from '../../../../src/core/result/Result';
// Build the sidecar and event bus with the suite's existing helpers; see
// tests/helpers/vault.ts for createRepositoryStack.

describe('SetAssetFootprintFromDimensions', () => {
	it('writes a centred rectangle and reports that it wrote', async () => {
		const result = await command.execute({ assetId, width: 1200, depth: 800 });
		expect(isOk(result) && result.value).toBe('wrote');
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprint.points).toHaveLength(4);
	});

	it('marks the footprint typed, so no unscaled warning is shown for numbers nobody measured', async () => {
		await command.execute({ assetId, width: 1200, depth: 800 });
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('typed');
	});

	it('preserves the clearance, anchor and facing an existing shape already carries', async () => {
		await seedShapeWith({ anchor: { x: 100, y: 50 }, facing: Math.PI / 2 });
		await command.execute({ assetId, width: 1200, depth: 800 });
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.anchor).toEqual({ x: 100, y: 50 });
		expect(isOk(stored) && stored.value.document.shape?.facing).toBeCloseTo(Math.PI / 2, 10);
	});

	it('refuses a non-positive dimension without touching the vault', async () => {
		const before = await sidecar.read(assetId);
		const result = await command.execute({ assetId, width: -5, depth: 800 });
		expect(isErr(result) && result.error.code).toBe('asset.non-positive-dimension');
		const after = await sidecar.read(assetId);
		expect(isOk(before) && isOk(after) && after.value.version.revision)
			.toBe(isOk(before) ? before.value.version.revision : -1);
	});
});

describe('SetAssetFootprint', () => {
	it('marks a traced footprint traced, and pending a scale when the surface is uncalibrated', async () => {
		await traceCommand.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }] });
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('traced');
		expect(isOk(stored) && stored.value.document.shape?.pendingScale).toBe(true);
	});

	it('marks a trace taken on a CALIBRATED surface as already scaled', async () => {
		await seedCalibration();
		await traceCommand.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }] });
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.pendingScale).toBe(false);
	});

	it('refuses a two-point outline through the one polygon validator', async () => {
		const result = await traceCommand.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
		expect(isErr(result)).toBe(true);
	});

	it('refuses a stale expected version and reports the conflict rather than overwriting', async () => {
		const stale = { revision: 0, digest: 'stale' };
		const result = await traceCommand.execute({ assetId, points: square, expected: stale });
		expect(isErr(result)).toBe(true);
	});
});
```

Replace `seedShapeWith` and `square` with real local helpers in the file — do not leave them undefined.

- [ ] **Step 2: Run, watch it fail**

```bash
npx vitest run tests/application/commands/asset/setAssetFootprint.test.ts
```

- [ ] **Step 3: Implement both commands**

Each: read the sidecar, build or validate the shape, merge it over the existing document preserving every attribute it does not own, write conditionally on `expected`, publish an `assetShapeChanged` event, return `ok('wrote')`. A refusal returns before the write. Add the event to `src/domain/asset/Asset.events.ts` following `assetCreated`'s shape.

**The preservation rule is the load-bearing part**: setting a footprint must never clear a clearance, an anchor or a facing. That is what test 3 pins, and it is why these commands read before they write rather than composing a fresh document.

- [ ] **Step 4: Run, watch pass, then commit**

```bash
npx vitest run tests/application/commands/asset
npm run check
git add src/application/commands/asset/SetAssetFootprint.ts src/domain/asset/Asset.events.ts tests/application/commands/asset/setAssetFootprint.test.ts
git commit -m "Set an asset's footprint, typed or traced"
```

---

### Task A6: clearance, anchor and facing

**Files:**
- Create: `src/application/commands/asset/SetAssetClearance.ts`
- Create: `src/application/commands/asset/SetAssetAnchor.ts`
- Create: `src/application/commands/asset/SetAssetFacing.ts`
- Test: `tests/application/commands/asset/setAssetAttributes.test.ts`

**Interfaces:**
- Consumes: exactly what Task A5 consumes.
- Produces: `SetAssetClearanceCommand` (input `{ assetId, points: readonly Point[] | null, expected? }`), `SetAssetAnchorCommand` (`{ assetId, anchor: Point, expected? }`), `SetAssetFacingCommand` (`{ assetId, facing: number, expected? }`), all resolving `Result<DispatchOutcome, AppError>`.

- [ ] **Step 1: Write the failing tests**

Seven cases, and two of them exist because of rules this repository has already paid for:

```typescript
it('refuses a clearance on an asset with no footprint, because a boundary is relative to one', async () => {
	const result = await clearance.execute({ assetId: withoutShape, points: square });
	expect(isErr(result) && result.error.code).toBe('asset.no-footprint');
});

it('clears the clearance when given null, and reports that it wrote', async () => {
	await clearance.execute({ assetId, points: square });
	const result = await clearance.execute({ assetId, points: null });
	expect(isOk(result) && result.value).toBe('wrote');
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.shape?.clearance).toBeNull();
});

it('normalises a facing given as 2π to 0, so two spellings of north cannot be stored', async () => {
	await facing.execute({ assetId, facing: Math.PI * 2 });
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.shape?.facing).toBe(0);
});

it('reports no-write when the anchor given is the anchor already stored', async () => {
	await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
	const again = await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
	expect(isOk(again) && again.value).toBe('no-write');
});
```

Plus: a non-finite anchor refuses; a non-finite facing refuses; a two-point clearance refuses.

**The `no-write` case is not a nicety.** `ok` is not evidence that anything was written, and the save-state indicator infers nothing — a repeated identical anchor must say so, or a "Saved" badge claims a write that did not happen.

- [ ] **Step 2: Run, watch fail, implement the three commands**

Each reads, validates through `validateAssetShape`, compares against the stored value (`coincident` for the anchor, not `===`), writes only on a real change, and returns `'no-write'` otherwise.

- [ ] **Step 3: Run, gate, commit**

```bash
npx vitest run tests/application/commands/asset
npm run check
git add src/application/commands/asset tests/application/commands/asset
git commit -m "Set an asset's clearance, anchor and facing"
```

---

### Task A7: height, the one frontmatter scalar

**Files:**
- Create: `src/application/commands/asset/SetAssetHeight.ts`
- Modify: `src/infrastructure/persistence/dto/assetFrontmatter.ts` (find it with `ls src/infrastructure/persistence/dto/`)
- Modify: the asset mapper beside it
- Test: `tests/application/commands/asset/setAssetHeight.test.ts`
- Test: extend the existing asset frontmatter/mapper test

**Interfaces:**
- Consumes: `AssetRepository`, `Asset.withChanges`.
- Produces: `SetAssetHeightCommand` with input `{ assetId, height: number | null, expected? }`; `Asset.height: number | null`.

- [ ] **Step 1: Add the field to the schema, additively**

Follow the pattern the existing nullable asset fields use — `.number().nullable().catch(null)` — so **no schema version bump is owed**: an absent key reads as `null` and a garbage value reads as `null` rather than failing the load. Confirm the pattern by reading the file before editing it; if the existing nullable fields use a different spelling, match theirs.

- [ ] **Step 2: Write the failing tests**

```typescript
it('round-trips a height through the note, so a plugin-less reader sees it', async () => {
	await height.execute({ assetId, height: 900 });
	const reloaded = await assets.getById(assetId);
	expect(isOk(reloaded) && reloaded.value?.height).toBe(900);
});

it('clears a height given null', async () => {
	await height.execute({ assetId, height: 900 });
	await height.execute({ assetId, height: null });
	const reloaded = await assets.getById(assetId);
	expect(isOk(reloaded) && reloaded.value?.height).toBeNull();
});

it('refuses a negative height', async () => {
	const result = await height.execute({ assetId, height: -10 });
	expect(isErr(result) && result.error.code).toBe('asset.negative-height');
});

it('is stored and read by nothing that calculates: no quantity or cost changes with it', async () => {
	const before = await requirementsFor(assetId);
	await height.execute({ assetId, height: 900 });
	expect(await requirementsFor(assetId)).toEqual(before);
});
```

That last case is the epic's "interpreted by nothing" made checkable. It is weak evidence today and strong evidence the day somebody adds a reader — which is exactly what it exists to catch.

- [ ] **Step 3: Implement, run, gate, commit**

```bash
npm run check
git add src/application/commands/asset/SetAssetHeight.ts src/infrastructure/persistence src/domain/asset tests
git commit -m "An asset carries a height, and nothing computes with it"
```

---

### Task A8: `GetAssetDesign`

**Files:**
- Create: `src/application/queries/GetAssetDesign.ts`
- Test: `tests/application/queries/getAssetDesign.test.ts`

**Interfaces:**
- Consumes: `AssetRepository`, `AssetGeometrySidecar`, `dimensionsOf` (A2).
- Produces:

```typescript
export interface AssetDesignDto {
	readonly assetId: string;
	readonly name: string;
	readonly height: number | null;
	readonly background: { path: string; kind: string; page: number | null } | null;
	readonly calibration: Calibration | null;
	readonly shape: AssetShape | null;
	/** Null when there is no footprint to measure. */
	readonly dimensions: Dimensions | null;
	/** `shape.pendingScale` — a stored fact about capture, never a join of live state. */
	readonly dimensionsUnscaled: boolean;
	readonly version: EntityVersion;
}
export class GetAssetDesignQuery implements Query<AssetId, Result<AssetDesignDto, AppError>> {}
```

- [ ] **Step 1: Write the failing tests — the provenance truth table**

This is the query's real subject, so drive all four rows:

```typescript
it.each([
	['typed',  false, false],
	['traced', false, false],
	['traced', true,  true ],
])('origin %s with pendingScale %s reports unscaled=%s', async (origin, pendingScale, expected) => {
	await seed({ origin, pendingScale });
	const dto = await query.execute(assetId);
	expect(isOk(dto) && dto.value.dimensionsUnscaled).toBe(expected);
});

it('keeps a measured outline measured when its background is replaced', async () => {
	await seed({ origin: 'traced', pendingScale: false, calibration: 'calibrated' });
	await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	const dto = await query.execute(assetId);
	expect(isOk(dto) && dto.value.calibration).toBeNull();
	expect(isOk(dto) && dto.value.dimensionsUnscaled).toBe(false);
});

it('answers null dimensions rather than zeros when there is no footprint', async () => {
	const dto = await query.execute(assetWithoutShape);
	expect(isOk(dto) && dto.value.dimensions).toBeNull();
	expect(isOk(dto) && dto.value.dimensionsUnscaled).toBe(false);
});

it('fails when the asset itself cannot be read, rather than answering an empty design', async () => {
	const dto = await query.execute(missingAssetId);
	expect(isErr(dto)).toBe(true);
});
```

The last case matters because collapsing a failed read into an empty answer is a defect this repository has recorded three times — a vault fault reported as "the thing is gone".

- [ ] **Step 2: Run, watch fail, implement, run, gate, commit**

```bash
npm run check
git add src/application/queries/GetAssetDesign.ts tests/application/queries/getAssetDesign.test.ts
git commit -m "Read an asset's design, and say when its dimensions are unscaled"
```

---

### Task A9: wire it into the composition root

**Files:**
- Modify: `src/plugin/composition-root.ts`
- Modify: `src/plugin/guardedServices.ts`
- Test: `tests/plugin/guardCategory.test.ts` (its detonation list)
- Test: `tests/plugin/assetGeometryWiring.test.ts` (create)

**Interfaces:**
- Consumes: every command from A5–A7, the query from A8, the adapter from A4.
- Produces: the guarded bundle later phases inject — `assetDesign: { setFootprint, setFootprintFromDimensions, setClearance, setAnchor, setFacing, setHeight, get }`.

- [ ] **Step 1: Construct the sidecar and the commands at the root**

The store takes the `libraryFolder` setting, resolved the same way slice 19's asset repository resolves it. **Do not cache the folder in a constructor** — slice 18's rule: resolve the folder per write from the entity being saved, and refuse with a `PersistenceError` rather than defaulting when it resolves to nothing.

- [ ] **Step 2: Guard every door**

Wrap each command with `guardCommand` and the query with `guardQuery` in `guardedServices.ts`, one event name each (`command.setAssetFootprint.failed`, …). Any command that later gains a reversible adapter dispatching through `executeWithVersion` takes `guardBothDoors` instead — a guard on the door nobody dispatches through is a guard nobody has.

- [ ] **Step 3: Extend the behavioural guard category test**

Add the asset geometry sidecar to `guardCategory.test.ts`'s detonated collaborators, so a hostile input through every door the walk finds still comes back as the mapped `vault.unexpected-failure`.

- [ ] **Step 4: Write the wiring test**

```typescript
it('a shape written through the root reaches a subscriber on the root event bus', async () => {
	const root = createCompositionRoot(deps);
	const heard: string[] = [];
	root.eventBus.subscribe('AssetShapeChanged', (e) => heard.push(e.assetId));
	await root.assetDesign.setFootprintFromDimensions.execute({ assetId, width: 100, depth: 60 });
	expect(heard).toEqual([assetId]);
});
```

A fresh `createEventBus()` passed into the root compiles, passes every other test, and announces into an object nothing subscribed to. This case is what tells those two compositions apart.

- [ ] **Step 5: Gate and commit**

```bash
npm run check
git add src/plugin tests/plugin
git commit -m "Compose and guard the asset geometry commands"
```

---

### Task A10: creating an asset, with dimensions

**Files:**
- Create: `src/presentation/dialogs/kinds/NewAssetForm.vue`
- Modify: `src/presentation/dialogs/` descriptor types (`DialogResultByKind`, `DialogHost`'s branch, `cancelResultFor`)
- Modify: `src/presentation/i18n/en.ts`, `src/presentation/i18n/de.ts`
- Modify: `src/plugin/` command registration (a `create-asset` command)
- Test: `tests/presentation/dialogs/newAssetForm.test.ts`
- Test: `tests/presentation/i18n/strings.test.ts` (already asserts locale completeness — no edit needed unless it fails)

**Interfaces:**
- Consumes: `useFormCommit` (`presentation/forms/`), `routeError`, `FieldError`, `FormBanner`, `openDialog`, and A9's guarded `createAsset` + `setFootprintFromDimensions`.
- Produces: a dialog kind `'new-asset'` resolving `{ assetId: string } | null`.

- [ ] **Step 1: Read the form this one mirrors**

`src/presentation/dialogs/kinds/NewProjectForm.vue` and its test. Adding a dialog kind is five edits, four of which are build failures — let `vue-tsc` find them rather than hunting.

- [ ] **Step 2: Write the failing tests**

```typescript
it('creates the asset and, when dimensions are given, its rectangle footprint', async () => {
	await fillAndSubmit({ name: 'Kitchen island', width: '1200', depth: '800' });
	expect(createAsset).toHaveBeenCalledTimes(1);
	expect(setFootprintFromDimensions).toHaveBeenCalledWith(
		expect.objectContaining({ width: 1200, depth: 800 }),
	);
});

it('creates the asset with no footprint when dimensions are left empty', async () => {
	await fillAndSubmit({ name: 'Kitchen island', width: '', depth: '' });
	expect(createAsset).toHaveBeenCalledTimes(1);
	expect(setFootprintFromDimensions).not.toHaveBeenCalled();
});

it('routes a refused dimension to the field it is about and keeps what the user typed', async () => {
	setFootprintFromDimensions.mockResolvedValue(err({ category: 'Validation', code: 'asset.non-positive-dimension', message: 'x' }));
	await fillAndSubmit({ name: 'Island', width: '0', depth: '800' });
	expect(fieldErrorFor('width')).not.toBeNull();
	expect(inputValue('width')).toBe('0');
});

it('refuses one dimension given without the other, since a rectangle needs both', async () => {
	await fillAndSubmit({ name: 'Island', width: '1200', depth: '' });
	expect(fieldErrorFor('depth')).not.toBeNull();
	expect(createAsset).not.toHaveBeenCalled();
});

it('drops a second submit while the first is still in flight', async () => {
	let release = (): void => {};
	createAsset.mockReturnValue(new Promise((resolve) => { release = () => resolve(ok(asset)); }));
	const form = mountForm();
	await form.submit();
	await form.submit();
	release();
	await flushPromises();
	expect(createAsset).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Implement the form**

Both dimension fields optional but paired; on submit, create the asset, then set the footprint only if both are given. **A rejected commit keeps the user's typed value and shows a persistent inline error — it never reverts.** Editing a field retires only its own message, and the paired dimension error retires both halves together.

- [ ] **Step 4: Add the copy to both locales**

Every key in `en.ts` and `de.ts`. German: `Objekt`, never `Material`. Sentence case — a capitalised word mid-sentence fails `obsidianmd/ui/sentence-case-locale-module`.

- [ ] **Step 4a: Bind every new code to its raise site in `toUserMessage.test.ts`**

Add a row per code this increment raises — `asset.non-positive-dimension`,
`asset.invalid-footprint`, `asset.invalid-clearance`, `asset.invalid-anchor`,
`asset.invalid-facing`, `asset.no-footprint`, `asset.negative-height` — asserting the English and
German sentence each resolves to.

**Copy the table from the RAISE SITES, not from `en.ts`.** A table derived from the locale file
agrees with a typo. Find them with:

```bash
grep -rn "assetError(" src/domain/asset src/application/commands/asset
```

A code with no entry does not degrade to silence — it degrades to the wrong sentence, which is how
two refusals once told a user "that entry no longer exists" about an entry whose existence was the
reason for the refusal.

- [ ] **Step 5: Register the command, and reach it from the picker later**

`create-asset` as a plain callback (never `checkCallback`), opening the dialog through `runDetached` so a fault maps, logs and notifies rather than vanishing.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add src/presentation src/plugin tests/presentation
git commit -m "Create an asset, optionally with a width and a depth"
```

**Phase A is now shippable.** Confirm it end to end in a real vault before starting Phase B: `npm run test-build`, then create an asset with dimensions and read the `.rpgeo` file the plugin wrote.

---

# Phase B — the designer

### Task B1: extract the gesture surface

**Files:**
- Create: `src/presentation/editor/surface/EditorSurface.vue`
- Modify: `src/presentation/editor/PlanCanvas.vue`
- Test: no new test file — the existing suites are the gate

**Interfaces:**
- Consumes: `ToolManager`, `EditorStore`, `PanOverride`, `pointerButtons.ts`, `wheelDelta.ts`.
- Produces: `<EditorSurface>` with props `{ toolManager, editor, overlay?: boolean }`, a default slot for the layer stack and a named `overlay` slot, emitting nothing — every gesture is routed inside it.

**This task changes no behaviour. It is alone in its commit for that reason.**

- [ ] **Step 1: Record the baseline**

```bash
npx vitest run tests/presentation/editor/canvasPointerRouting.test.ts \
  tests/presentation/editor/canvasNavigation.test.ts \
  tests/presentation/editor/interactionLayer.test.ts
```

Write down the passing counts. These three suites hold roughly thirty documented pointer findings and are the only thing standing between this extraction and rediscovering them.

- [ ] **Step 2: Move the gesture code, unchanged**

Into `EditorSurface.vue`: `onPointerDown/Move/Up/Cancel/Leave`, `onMouseDown`, `onWheel`, `onKeyDown`, `onBlur`, the window blur registration and its unmount removal, `PanOverride` ownership, `swallowedPointers`, `toolGesturePointer`, `lastStagePoint`, `reissuePointerMove`, `isGestureOwner`, `gestureInFlight`, `cameraIsLocked`, `cursorClass`, and the `display: contents` overlay wrapper with its three `.stop` handlers.

**Move the lines. Do not retype them, do not tidy them, do not rename a variable.** Every comment travels with its code — several of them are the only record of why a door asks what it asks.

- [ ] **Step 3: Mount it from `PlanCanvas.vue`**

`PlanCanvas` keeps the Konva stage, the layer stack, the plan's own empty-state overlays and everything that names a Plan or a Zone. It passes its `toolManager` and `editor` into `<EditorSurface>` and puts its layers in the default slot.

- [ ] **Step 4: Run the three suites and compare against the baseline**

```bash
npx vitest run tests/presentation/editor
```

Expected: the same counts, all passing. **A single changed assertion means behaviour moved — revert the difference rather than updating the test.**

- [ ] **Step 5: Check the line budgets**

```bash
npx eslint src/presentation/editor/PlanCanvas.vue src/presentation/editor/surface/EditorSurface.vue
```

Both must be under `max-lines`. If `EditorSurface.vue` is over, extract by seam (the pan override's own handlers) rather than collapsing formatting — a budget bought back by reformatting is a budget already spent.

- [ ] **Step 6: Gate and commit, alone**

```bash
npm run check
git add src/presentation/editor
git commit -m "Extract the editor's gesture surface, unchanged"
```

---

### Task B2: one context, two subjects

**Files:**
- Modify: `src/presentation/editor/tools/editor-context.ts` (`activePlan` → `subject`)
- Modify: `src/presentation/editor/tools/draw-polygon-tool.ts`
- Modify: `src/presentation/editor/runtime.ts` and every construction site the compiler names
- Test: `tests/presentation/editor/type-safety.test-d.ts` (extend)
- Test: `tests/presentation/editor/drawPolygonTool.test.ts` (extend)

**Interfaces:**
- Produces:

```typescript
// editor-context.ts
readonly subject: { readonly id: EntityId; readonly calibration: Calibration | null };

// draw-polygon-tool.ts — the tool no longer names a Zone
export interface PolygonCompletion {
	complete(points: readonly Point[]): Promise<Result<DispatchOutcome, AppError>>;
}
```

- [ ] **Step 1: Rename the field and let the compiler find the callers**

```bash
npx vue-tsc --noEmit
```

Fix each site it names. There is exactly one coupled field, so this is a rename, not a redesign.

- [ ] **Step 2: Write the failing test for the injected completion**

```typescript
it('dispatches whatever completion it was given, so one tool serves zones and footprints', async () => {
	const complete = vi.fn().mockResolvedValue(ok('wrote'));
	const tool = new DrawPolygonTool({ complete });
	await drawTriangle(tool);
	expect(complete).toHaveBeenCalledWith([
		{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 },
	]);
});
```

- [ ] **Step 3: Implement the injection**

`DrawPolygonTool` takes a `PolygonCompletion` rather than constructing a `CreateZone` dispatch. The plan editor passes the zone completion; the designer will pass a footprint one in Task B5. **The generation counter, the duplicate-vertex `coincident` guard, the close-target rule and the Shift constraint all stay exactly as they are** — this is a change to what completion does, not to how a polygon is drawn.

- [ ] **Step 4: Run the editor suite, gate, commit**

```bash
npx vitest run tests/presentation/editor
npm run check
git add src/presentation/editor tests/presentation/editor
git commit -m "The editor context names a subject, and the polygon tool takes its completion"
```

---

### Task B3: ADR-0015, the view, and its empty states

**Files:**
- Create: `docs/development/adrs/0015-asset-designer-workspace-surface.md`
- Create: `src/presentation/designer/AssetDesignerView.ts`
- Create: `src/presentation/designer/AssetDesignerRoot.vue`
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (register the view)
- Modify: `src/presentation/empty-states/` registry (`EMPTY_STATE_CONTENT`), `en.ts`, `de.ts`
- Modify: `docs/issues/The plan editor is a mode, not a second view.md` (a superseded-by note)
- Test: `tests/presentation/designer/assetDesignerView.test.ts`
- Test: `tests/plugin/registration.test.ts` (extend)

**Interfaces:**
- Consumes: `GetAssetDesignQuery` (A8) through a deps bundle, `DialogHost`, `SaveStateIndicator`.
- Produces: `ASSET_DESIGNER_VIEW = 'renovation-asset-designer'`, view state `{ assetId: string }`, and empty-state keys `assetDesigner.noShape`, `assetDesigner.noBackground`.

- [ ] **Step 1: Write ADR-0015**

It decides a per-asset view type keyed by `assetId` in Obsidian's own view state, and it must **record the supersession**: `docs/issues/The plan editor is a mode, not a second view.md` is `status: Done` and says slice 05 registers no new view type; slice 05's document designs `PLAN_EDITOR_VIEW` and `RenovationPlannerPlugin.ts:184` registers it. Say that the code took the rejected alternative, that this ADR follows the code, and that the note's own *Revisit when* — a use case needing two surfaces at once — is met by tracing a spec sheet beside the plan the object will land in. Add a one-line "Superseded in practice by ADR-0015" pointer to the issue note itself, so the contradiction cannot be found from only one side.

- [ ] **Step 2: Write the failing view tests**

```typescript
it('carries the open asset in its own view state, so a workspace restore reopens the same asset', async () => {
	const view = new AssetDesignerView(leaf, deps);
	await view.setState({ assetId: 'asset-01JABC' }, {});
	expect(view.getState()).toEqual({ assetId: 'asset-01JABC' });
});

it('falls back rather than throwing when a restored state names no asset', async () => {
	const view = new AssetDesignerView(leaf, deps);
	await view.setState({}, {});
	expect(view.getState()).toEqual({ assetId: null });
});

it('mounts a dialog host, so a dialog opened from the designer has somewhere to draw', async () => {
	const view = new AssetDesignerView(leaf, deps);
	await view.setState({ assetId: 'asset-01JABC' }, {});
	await view.onOpen();
	expect(view.contentEl.querySelector('.rp-dialog-host')).not.toBeNull();
});
```

The fallback case is the same trust rule `settingsFrom` states about `data.json`: persisted state is user-reachable, so a value this version does not know falls back rather than throwing.

- [ ] **Step 3: Implement the view and the root**

`AssetDesignerView` mirrors `PlanEditorView`: its own Vue app, `app.config.idPrefix` set (two apps' `useId()` must not collide), unmounted on close. `AssetDesignerRoot` draws the shell regions, mounts `DialogHost` and the save-state indicator.

- [ ] **Step 4: Add the two empty states as OVERLAYS**

Both live inside the canvas region, never replacing it — slice 14's rule. `assetDesigner.noShape` carries an action that opens the dimensions form; `assetDesigner.noBackground` carries an action too, which needs Task B7's port, so **write it buttonless here and add the button in B7**, and assert the absence now so B7 flips a real assertion rather than closing a gap quietly.

- [ ] **Step 5: Register the view**

In `src/plugin/` only — `tests/build/registration-locality.test.ts` requires every registration member under that directory. Extend `tests/plugin/registration.test.ts` for the fourth view type.

- [ ] **Step 6: Gate and commit**

```bash
npm run check
git add docs/development/adrs docs/issues src/presentation/designer src/plugin src/presentation/i18n tests
git commit -m "ADR-0015 and the asset designer view"
```

---

### Task B4: the layers

**Files:**
- Create: `src/presentation/designer/layers/backgroundLayer.ts`, `footprintLayer.ts`, `clearanceLayer.ts`, `anchorLayer.ts`
- Create: `src/presentation/designer/DesignerCanvas.vue`
- Test: `tests/presentation/designer/layers.test.ts`

**Interfaces:**
- Consumes: `EditorSurface` (B1), the Konva layer patterns in `src/presentation/editor/layers/`, `AssetDesignDto` (A8).
- Produces: `<DesignerCanvas>` mounting `<EditorSurface>` with the four layers and the overlay slot.

- [ ] **Step 1: Write the failing tests**

```typescript
it('draws the clearance distinct from the footprint, so neither is mistaken for the other', () => {
	const drawn = renderLayers({ shape: withClearance });
	expect(drawn.footprint.dash).toBeUndefined();
	expect(drawn.clearance.dash).not.toBeUndefined();
});

it('draws the anchor and a facing indicator that points where facing says', () => {
	const drawn = renderLayers({ shape: { ...base, facing: Math.PI / 2 } });
	expect(drawn.facing.points.slice(2)).toEqual([0, expect.any(Number)]);
});

it('draws nothing but the background when there is no shape yet', () => {
	const drawn = renderLayers({ shape: null });
	expect(drawn.footprint).toBeUndefined();
});
```

- [ ] **Step 2: Run, watch fail, implement the layers**

Reuse the plan editor's screen-space conventions: handle radii from `handleMetrics.ts`, screen-spaced strokes so a zoom does not thicken a line. The clearance renders dashed and the footprint solid — the same vocabulary the plan editor already uses for "provisional" versus "committed".

- [ ] **Step 3: Gate and commit**

```bash
npm run check
git add src/presentation/designer tests/presentation/designer
git commit -m "Draw an asset's footprint, clearance, anchor and facing"
```

---

### Task B5: the designer's tools

**Files:**
- Create: `src/presentation/designer/tools/registerDesignerTools.ts`
- Create: `src/presentation/designer/tools/set-anchor-tool.ts`, `set-facing-tool.ts`
- Test: `tests/presentation/designer/designerTools.test.ts`

**Interfaces:**
- Consumes: `ToolManager`, `SelectTool`, `DrawPolygonTool` + `PolygonCompletion` (B2), A5/A6's commands through the designer's command bundle.
- Produces: registered tool ids `'select'`, `'trace-footprint'`, `'trace-clearance'`, `'set-anchor'`, `'set-facing'`.

- [ ] **Step 1: Write the failing tests**

```typescript
it('registers every tool the toolbar offers, so none is unreachable', () => {
	const manager = registerDesignerTools(context, commands);
	expect(manager.toolIds().sort()).toEqual(
		['select', 'set-anchor', 'set-facing', 'trace-clearance', 'trace-footprint'].sort(),
	);
});

it('sends a traced footprint to the footprint command and a traced clearance to the clearance one', async () => {
	manager.setActiveTool('trace-footprint');
	await drawTriangle(manager);
	expect(commands.setFootprint).toHaveBeenCalledTimes(1);
	expect(commands.setClearance).not.toHaveBeenCalled();

	manager.setActiveTool('trace-clearance');
	await drawTriangle(manager);
	expect(commands.setClearance).toHaveBeenCalledTimes(1);
});

it('places the anchor with one click and reports it', async () => {
	manager.setActiveTool('set-anchor');
	await click(manager, { x: 120, y: 40 });
	expect(commands.setAnchor).toHaveBeenCalledWith(
		expect.objectContaining({ anchor: { x: 120, y: 40 } }),
	);
});

it('sets the facing from the direction of a drag, not from where it ended', async () => {
	manager.setActiveTool('set-facing');
	await drag(manager, { from: { x: 0, y: 0 }, to: { x: 0, y: 100 } });
	const [call] = commands.setFacing.mock.calls;
	expect(call[0].facing).toBeCloseTo(Math.PI / 2, 6);

	await drag(manager, { from: { x: 0, y: 0 }, to: { x: 0, y: 300 } });
	const [, second] = commands.setFacing.mock.calls;
	expect(second[0].facing).toBeCloseTo(Math.PI / 2, 6);
});
```

**The first case is this plan's guard against slice 7 repeating itself**: `CalibrateTool` was proven by tests, absent from the registration list, and unreachable for two slices with all four gates green.

- [ ] **Step 1a: Build the designer's rig, and build it honestly**

Mirror `tests/helpers/planEditorRig.ts`, with two properties that file had to be corrected into:

- a **dispatching** `EventBus`, registering the same handlers the composition root does — a
  `RecordingEventBus` discards its handler, so every geometry-driven figure in the rig would be as
  stale as the day it was written with no assertion able to see it;
- pointer streams obeying the **real device's grammar** — a click is down+up on the same button, a
  drag is down/move…/up, every move carries `buttons`, and a chorded press fires no second
  `pointerdown`. A test that drives an impossible input is not weak evidence; it is evidence about a
  different program, and it stays green through every fix and every regression alike.

Its `SnapService` stand-in must subclass the real one, composed with the editor's own 15° step, so
the next method added to that service is present here the day it is written.

- [ ] **Step 2: Implement, run, gate, commit**

Shift constrains the facing drag to 15° through `SnapService.snapDirection`, the same service and step the plan editor's tools use — and the status bar says so, since a modifier nothing advertises is a modifier nobody finds.

```bash
npm run check
git add src/presentation/designer tests/presentation/designer
git commit -m "The designer's tools, and a toolbar that reaches all of them"
```

---

### Task B6: `CalibrateAsset`

**Files:**
- Create: `src/application/commands/asset/CalibrateAsset.ts`
- Modify: `src/presentation/designer/tools/registerDesignerTools.ts` (register `'calibrate'`)
- Test: `tests/application/commands/asset/calibrateAsset.test.ts`

**Interfaces:**
- Consumes: `deriveCalibration` and `scaleShape` — read `src/application/commands/plan/ReversibleCalibratePlan.ts:150-164` before writing a line of this.
- Produces: `CalibrateAssetCommand`, input `{ assetId, pointA, pointB, knownDistance, expected? }`.

- [ ] **Step 1: Write the failing tests**

```typescript
it('rescales the coordinates that came off the background, its own calibration pair included', async () => {
	await seedShape({ footprint: rect(100, 60), footprintOrigin: 'traced', anchor: { x: 10, y: 10 }, clearance: rect(120, 80) });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	// scaleCorrection is 2: the drawn 100 units are really 200 mm.
	expect(isOk(stored) && stored.value.document.shape?.anchor).toEqual({ x: 20, y: 20 });
	expect(isOk(stored) && stored.value.document.shape?.clearance?.points[1]).toEqual({ x: 120, y: -80 });
	const c = isOk(stored) ? stored.value.document.calibration : null;
	expect(c && distance(c.pointA, c.pointB)).toBeCloseTo(c?.knownDistance ?? 0, 6);
});

it('touches no plan and no other asset', async () => {
	const otherBefore = await sidecar.read(otherAssetId);
	const planBefore = await planSidecar.read(planId);
	await calibrate.execute({ assetId, pointA: a, pointB: b, knownDistance: 200 });
	expect(await sidecar.read(otherAssetId)).toEqual(otherBefore);
	expect(await planSidecar.read(planId)).toEqual(planBefore);
});

it('leaves a TYPED footprint alone, because it was authored in millimetres', async () => {
	await seedShape({ footprint: rect(1200, 800), footprintOrigin: 'typed', clearance: rect(1400, 1000) });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	// The typed rectangle is untouched; the traced clearance is doubled.
	expect(shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });
	expect(shape?.clearance?.points[2]).toEqual({ x: 1400, y: 1000 });
});

it('clears pendingScale, because the coordinates it just converted are millimetres now', async () => {
	await seedShape({ footprint: rect(100, 60), footprintOrigin: 'traced', pendingScale: true });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.shape?.pendingScale).toBe(false);
});

it('refuses two coincident points, which is a division by zero', async () => {
	const result = await calibrate.execute({ assetId, pointA: p, pointB: p, knownDistance: 200 });
	expect(isErr(result) && result.error.code).toBe('calibration.coincident-points');
});

it('refuses a non-positive known distance', async () => {
	const result = await calibrate.execute({ assetId, pointA: a, pointB: b, knownDistance: 0 });
	expect(isErr(result)).toBe(true);
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.calibration).toBeNull();
});
```

The second case is the epic's central separation — the calibration a designer surface takes belongs to that object and never reaches a plan's — asserted rather than asserted-in-prose.

- [ ] **Step 2: Implement**

Derive, then apply `scaleShape(…, scaleCorrection, origin)` to **the coordinates that came off the
background** — the clearance, the anchor, the calibration's own pair, and the footprint **only when
`footprintOrigin === 'traced'`** — then clear `pendingScale` and write the whole document once.

**This is the one place slice 7's plan rule may not be copied**, and it is worth reading
`ReversibleCalibratePlan` with that in mind rather than transcribing it. That command rescales
*every* coordinate the plan owns, which is right there because every one of them was drawn on the
background at the placeholder scale of 1. An asset has a coordinate source a plan never had: a
typed 1200 × 800 is authored in true millimetres and was never in the background's space, so
rescaling it turns an exact oven into an arbitrary one — silently, since the result still looks
like a plausible oven.

The at-rest invariant `distance(pointA, pointB) === knownDistance` is established by the command,
not by the validator — `Calibration.ts`'s docblock says why, and that part applies here unchanged.

- [ ] **Step 3: Register the tool and run the whole suite**

```bash
npx vitest run
npm run check
git add src/application/commands/asset/CalibrateAsset.ts src/presentation/designer tests
git commit -m "Calibrate an asset, and rescale only what that object owns"
```

---

### Task B7: the background, and the port that picks one

**Files:**
- Create: `src/application/commands/asset/SetAssetBackground.ts`
- Create: `src/presentation/designer/ports.ts` (`BackgroundPicker`)
- Modify: `src/plugin/composition-root.ts` (bind the picker)
- Modify: the designer's `noBackground` empty state (add its action)
- Test: `tests/application/commands/asset/setAssetBackground.test.ts`
- Test: `tests/presentation/designer/backgroundPicker.test.ts`

**Interfaces:**
- Produces:

```typescript
export interface DocumentRef { readonly path: string; readonly kind: 'image' | 'pdf'; readonly page: number | null; }
export interface BackgroundPicker { pick(): Promise<DocumentRef | null>; }
```

- [ ] **Step 1: Write the failing tests**

```typescript
it('stores the reference in the note, so a plugin-less reader can see which file it is', async () => {
	await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
	const frontmatter = await readFrontmatter(assetNotePath);
	expect(frontmatter['background-path']).toBe('Specs/oven.pdf');
	expect(frontmatter['background-kind']).toBe('pdf');
	expect(frontmatter['background-page']).toBe(1);
});

it('refuses a path that is not a supported background kind', async () => {
	const result = await setBackground.execute({ assetId, path: 'Specs/oven.docx', kind: 'docx', page: null });
	expect(isErr(result)).toBe(true);
});

it('clears the calibration, because two points on the old document name nothing on the new one', async () => {
	await seedCalibration();
	await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.calibration).toBeNull();
});

it('does NOT re-flag an already-measured outline: the object did not change size', async () => {
	await seedShape({ footprintOrigin: 'traced', pendingScale: false });
	await seedCalibration();
	await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.shape?.pendingScale).toBe(false);
});

it('leaves neither half applied when the write fails', async () => {
	sidecarWriteFails();
	const before = await readFrontmatter(assetNotePath);
	const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	expect(isErr(result)).toBe(true);
	expect(await readFrontmatter(assetNotePath)).toEqual(before);
});

it('draws no background button when no picker is bound, rather than a control that does nothing', () => {
	const wrapper = mountDesigner({ picker: null });
	expect(wrapper.find('.rp-empty-state__action').exists()).toBe(false);
});

it('opens the picker from the empty state action and stores what it returns', async () => {
	picker.pick.mockResolvedValue({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
	await mountDesigner({ picker }).find('.rp-empty-state__action').trigger('click');
	expect(setBackground).toHaveBeenCalledWith(expect.objectContaining({ path: 'Specs/oven.pdf' }));
});

it('does nothing when the picker is cancelled', async () => {
	picker.pick.mockResolvedValue(null);
	await mountDesigner({ picker }).find('.rp-empty-state__action').trigger('click');
	expect(setBackground).not.toHaveBeenCalled();
});
```

The third case is why this port exists at all: `presentation/` may not import `obsidian`, so a file picker is unreachable from the Vue tree without a bound port — and `planEditor.noBackground` ships buttonless for exactly that reason. A button with no picker behind it is the failure mode slice 14's amendment exists to avoid.

- [ ] **Step 2: Implement the command, the port and the Obsidian binding**

The command writes the note's three background keys **and** clears the sidecar's calibration. Those
are two files, so order them so a failure cannot leave a scale belonging to a document that is no
longer there: clear the calibration first, then write the reference; a failure after the clear
leaves a surface that says it is uncalibrated, which is true and recoverable, while the reverse
leaves a new picture measured by the old document's scale. The last test above pins that ordering.


The binding lives in `src/plugin/`, uses Obsidian's own file suggester, and reaches the designer through the deps bundle — never through the global `app`, which the marketplace rules refuse.

- [ ] **Step 3: Flip the empty-state assertion added in B3**

That assertion said `noBackground` carries no action. It now does. **Change the assertion deliberately, in this commit**, so the closing is visible in the diff.

- [ ] **Step 4: Gate and commit**

```bash
npm run check
git add src/application src/presentation src/plugin tests
git commit -m "Give an asset a background, and the designer a picker to choose one"
```

---

### Task B8: the inspector

**Files:**
- Create: `src/presentation/designer/inspector/DesignerInspector.vue`
- Test: `tests/presentation/designer/designerInspector.test.ts`

**Interfaces:**
- Consumes: `AssetDesignDto` (A8), `useFieldCommit`, `routeError`, `FieldError`.
- Produces: the inspector region of `AssetDesignerRoot`.

- [ ] **Step 1: Write the failing tests**

```typescript
it('shows dimensions derived from the footprint, with no field to type them into', () => {
	const wrapper = mountInspector({ dimensions: { width: 1200, depth: 800 } });
	expect(wrapper.text()).toContain('1200');
	expect(wrapper.find('input[name="width"]').exists()).toBe(false);
});

it('says so where a measurement would otherwise appear, when a trace is unscaled', () => {
	const wrapper = mountInspector({ dimensionsUnscaled: true });
	expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(true);
});

it('shows no unscaled warning for typed dimensions, which are exact millimetres', () => {
	const wrapper = mountInspector({ dimensionsUnscaled: false, origin: 'typed' });
	expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
});

it('commits a height on blur and keeps the typed value when the command refuses', async () => {
	setHeight.mockResolvedValue(err({ category: 'Validation', code: 'asset.negative-height', message: 'x' }));
	const input = mountInspector({ height: 900 }).find('input[name="height"]');
	await input.setValue('-10');
	await input.trigger('blur');
	await flushPromises();
	expect(setHeight).toHaveBeenCalledTimes(1);
	expect((input.element as HTMLInputElement).value).toBe('-10');
});

it('does not dispatch when a clean height field is blurred', async () => {
	await mountInspector({ height: 900 }).find('input[name="height"]').trigger('blur');
	expect(setHeight).not.toHaveBeenCalled();
});
```

The last case is the Reset-button lesson from slice 16: a guard inside a composable cannot see a caller that walks past its precondition, and a dispatch for a change nobody made buys a vault write and an undo entry.

- [ ] **Step 2: Implement, gate, commit**

```bash
npm run check
git add src/presentation/designer tests/presentation/designer
git commit -m "The designer's inspector: derived dimensions, an honest warning, one editable scalar"
```

---

### Task B9: reaching the designer

**Files:**
- Create: `src/plugin/assetDesignerCommands.ts`
- Modify: `src/infrastructure/obsidian/` reveal helper (extend the in-flight map keying)
- Test: `tests/plugin/assetDesignerCommands.test.ts`

**Interfaces:**
- Consumes: `ListAssets` (slice 19's vault-wide version), `revealCandidate`, `FuzzySuggestModal`.
- Produces: the `open-asset-designer` command.

- [ ] **Step 1: Write the failing tests**

```typescript
it('is a plain callback, so it appears in the palette in a vault with no assets', () => {
	const registered = host.commands.find((c) => c.id === 'open-asset-designer');
	expect(registered?.callback).toBeTypeOf('function');
	expect(registered?.checkCallback).toBeUndefined();
});

it('opens one leaf for two activations in the same tick', async () => {
	await Promise.all([open(assetId), open(assetId)]);
	expect(workspace.createdLeaves).toHaveLength(1);
});

it('opens two leaves for two different assets', async () => {
	await Promise.all([open(assetA), open(assetB)]);
	expect(workspace.createdLeaves).toHaveLength(2);
});
```

Case 1 is the `open-plan-editor` defect, refused in advance: a `checkCallback` requiring an active asset note kept that command out of the palette in every vault that had none. Case 3 is the mutation that proves case 2's key is the view type **plus the state** — keying on the type alone collapses the multiplicity the view exists to permit.

- [ ] **Step 2: Implement, gate, commit**

```bash
npm run check
git add src/plugin src/infrastructure tests/plugin
git commit -m "Open the asset designer from the palette, once per asset"
```

---

### Task B10: the instruments that read pixels

**Files:**
- Modify: `tests/harness/accessibility.test.ts`
- Modify: `tests/harness/` entry registry and `src/prototypes/` as needed
- Modify: `scripts/harness-shot.mjs` fixed-capture list

**- [ ] Step 1: Add the axe case**

Scan the mounted designer after `await flushPromises()` — synchronous mounting `void`s `onOpen`, so a scan one tick early finds zero elements and passes on an empty subtree. Assert `.rp-empty-state` **and** `.rp-empty-state__action` are present in the scanned DOM, so a regression that reopens the timing gap fails here rather than passing quietly.

**- [ ] Step 2: Add `?view=asset-designer` to the harness and two fixed captures**

Both colour schemes. Then run it and **look at the pictures**:

```bash
npm run harness-shot
```

Ten defects have been found this way that all four gates missed — spacing, wrapping, contrast, focus rings and hit size are measured by no gate in this repository.

**- [ ] Step 3: Gate and commit**

```bash
npm run check
git add tests/harness scripts src/prototypes
git commit -m "Grade the designer for accessibility, and photograph it"
```

---

### Task B11: close the increment

**Files:**
- Create: `docs/tests/cases/Design an Asset.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md`
- Modify: `CLAUDE.md`
- Modify: `docs/requirements/Asset designer.md` (status/started fields only)

**- [ ] Step 1: Write the manual case**

Steps a human runs in a real vault, each with its expected result. It must cover what no gate here can see: that the `.rpgeo` file appears in the file explorer; that a PDF spec sheet renders as a background; that a calibration changes the reported dimensions and **no plan's** dimensions; that the unscaled warning appears before calibration and disappears after; that a notice looks like a notice (the harness declares no `.notice` rule at all); and that toggling the plugin off and on logs no Konva or duplicate-view warning.

**- [ ] Step 2: Update `CLAUDE.md`**

One section, in the file's own voice: what landed, and the rules that came out of it. Write the guarantee to the check — if a claim outruns what a gate verifies, narrow the sentence. Include what is deliberately **not** built: nothing draws the shape on a plan, nothing computes with the height, and the clearance has no consumer yet.

**- [ ] Step 3: Final gate, on both halves**

```bash
npm run check
npx vitest run --coverage
```

Read the branch figure against the floor in `vitest.config.ts`, and read `coverage-final.json` for the files this increment changed — the threshold cannot see one uncovered arm while headroom hides it.

**- [ ] Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "Close the asset designer's first increment"
```

---

## Deviations from the spec, and why

- **The picker moved from Phase A to Phase B (Task B9).** The spec's sequencing line puts "the create dialog and the picker" in half A. A picker whose only destination is the designer cannot ship before the designer exists, so A carries the create dialog — which is what makes typed dimensions reachable — and B carries the picker. The halves stay independently green either way.
- **Editing dimensions after creation is a Phase B capability.** In A they are typed once, at creation. That is a real limitation of half A rather than an oversight, and it is why B8's inspector is not optional.

## Open questions this plan does not settle

They are the spec's, unchanged, and each has a task that will force the answer:

1. **Facing's zero direction** — Task A2 stores radians anticlockwise from +x; whether the product zero is +x or the footprint's longest edge is [[Asset placement]]'s to inherit and cannot be renegotiated later without moving every stored angle.
2. **A derived default clearance** — not built. Task A6 stores only what somebody drew.
3. **Origin versus anchor** — this plan makes them one point (`{ x: 0, y: 0 }` at the centre of a typed rectangle). If they must differ, A2's `AssetShape` grows a field and A3's schema version bumps.
4. **Two assets sharing one spec sheet** each calibrate it separately; nothing is shared. Measured only by using it (Task B11's manual case).
