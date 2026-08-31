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
| `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` | the concrete `.rpgeo` store |
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
| `src/application/commands/asset/CalibrateAsset.ts` | the object's own calibration, rescaling only what came off the background and still awaits a scale |
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
	/**
	 * One flag per coordinate group that can be captured on its own, each set at THAT
	 * attribute's capture on an uncalibrated surface and cleared by the calibration that
	 * converts it. Typed geometry is never pending, which is why no rule has to name it.
	 */
	readonly footprintPending: boolean;
	readonly clearancePending: boolean;
	readonly anchorPending: boolean;
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
	/**
	 * One flag per coordinate group that can be captured on its own, each set at THAT
	 * attribute's capture on an uncalibrated surface and cleared by the calibration that
	 * converts it. Typed geometry is never pending, which is why no rule has to name it.
	 */
	readonly footprintPending: boolean;
	readonly clearancePending: boolean;
	readonly anchorPending: boolean;
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
	// The SIGN guard above is about the input; this one is about the RECTANGLE it produces.
	// A positive subnormal (`Number.MIN_VALUE`, say) satisfies `> 0` and halves to exactly
	// zero, so all four vertices collapse onto the origin and `createPolygon` accepts them
	// happily — four finite points, no rule broken. The command would report a written
	// footprint with no extent. Asking whether the constructed half survived is the general
	// question; refusing one magnitude would leave the next one through.
	if (halfWidth <= 0 || halfDepth <= 0) {
		return err(
			assetError(
				'dimension-underflow',
				`A dimension is too small to describe a rectangle: ${String(width)} x ${String(depth)}.`,
			),
		);
	}
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
	const width = box.value.max.x - box.value.min.x;
	const depth = box.value.max.y - box.value.min.y;
	// A finite EXTENT does not mean a finite SPAN. Every boundary below this one admits
	// coordinates one at a time — the schema, `validatePolygonPoints`, `boundingBoxOf` —
	// so -1e308 and 1e308 each pass and their difference is `Infinity`. Reported rather
	// than returned, because a non-finite width presented as a measurement is the lie the
	// unscaled marker exists to prevent, and `JSON.stringify` would write it as `null`.
	// The same shape as `ReversibleCalibratePlan`'s finite-result guard: a finite ratio
	// does not mean a finite product.
	if (!Number.isFinite(width) || !Number.isFinite(depth)) {
		return err({
			category: 'Geometry',
			code: 'dimensions-overflow',
			message: `A footprint's extent is not representable: got ${String(width)} x ${String(depth)}.`,
		});
	}
	return ok({ width, depth });
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
	// DEGENERACY — see Amendment 2 below. `createPolygon` validates vertex count and
	// finiteness, both of which a collinear trace satisfies.
	if (!enclosesArea(footprint.value)) {
		return err(
			assetError('degenerate-footprint', 'A footprint must enclose an area; these vertices are collinear.'),
		);
	}
	let clearance: Polygon | null = null;
	if (shape.clearance !== null) {
		const validated = createPolygon(shape.clearance.points);
		if (isErr(validated)) return err(assetError('invalid-clearance', validated.error.message));
		if (!enclosesArea(validated.value)) {
			return err(
				assetError('degenerate-clearance', 'A clearance must enclose an area; these vertices are collinear.'),
			);
		}
		clearance = validated.value;
	}
	if (!Number.isFinite(shape.anchor.x) || !Number.isFinite(shape.anchor.y)) {
		return err(assetError('invalid-anchor', 'An anchor must have finite coordinates.'));
	}
	if (!Number.isFinite(shape.facing)) {
		return err(assetError('invalid-facing', 'A facing must be a finite angle in radians.'));
	}
	if (shape.footprintOrigin === 'typed' && shape.footprintPending) {
		return err(
			assetError(
				'typed-footprint-cannot-be-pending',
				'A typed footprint is authored in millimetres and never awaits a scale.',
			),
		);
	}
	if (shape.clearance === null && shape.clearancePending) {
		return err(
			assetError(
				'absent-clearance-cannot-be-pending',
				'A shape with no clearance has no clearance coordinates awaiting a scale.',
			),
		);
	}
	// Every reference-typed field is DETACHED from the caller: the validated polygons
	// rather than the input's, and a copied anchor. A mutation after a successful
	// validation must not be able to break what was just validated.
	return ok({
		...shape,
		footprint: footprint.value,
		clearance,
		anchor: { x: shape.anchor.x, y: shape.anchor.y },
		facing: normaliseFacing(shape.facing),
	});
}

/** Every shape starts here: the rectangle, centred, facing +x, with no clearance. */
export function shapeFromDimensions(width: number, depth: number): Result<AssetShape, ValidationError> {
	const footprint = footprintFromDimensions(width, depth);
	if (isErr(footprint)) return footprint;
	return ok({
		footprint: footprint.value,
		footprintOrigin: 'typed',
		footprintPending: false,
		clearancePending: false,
		anchorPending: false,
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

Two of them are the states the per-attribute model makes incoherent, and they are refused rather
than repaired for the same reason A4 refuses a two-vertex polygon: no command can produce either, so
one in a sidecar is a hand edit, and reading it as "already measured" suppresses the unscaled
warning over placeholder-space geometry.

```typescript
it('refuses a typed footprint marked as awaiting a scale', () => {
	const result = validateAssetShape({ ...typedShape, footprintPending: true });
	expect(isErr(result) && result.error.code).toBe('asset.typed-footprint-cannot-be-pending');
});

it('refuses a pending clearance on a shape that has no clearance', () => {
	const result = validateAssetShape({ ...typedShape, clearance: null, clearancePending: true });
	expect(isErr(result) && result.error.code).toBe('asset.absent-clearance-cannot-be-pending');
});
```

Then three more `it` blocks, each asserting the code rather than the message: a two-point footprint refuses `asset.invalid-footprint`, a `NaN` anchor refuses `asset.invalid-anchor`, and a `facing` of `2π` comes back as `0` from the ok arm — that last one proves normalisation happens on the way through the validator and not only in `normaliseFacing`'s own test.

- [ ] **Step 6: Full gate, then commit**

```bash
npm run check
git add src/domain/asset/AssetShape.ts tests/domain/asset/assetShape.test.ts
git commit -m "An asset's shape, and the maths that derives its dimensions"
```

---

#### Amendment 2 — the degeneracy guards, added 2026-08-31 after they shipped

The listing above carries `enclosesArea` for the footprint AND the clearance. It did not when
this task was executed, and the guards arrived later as `c532556`, in response to a review
finding: `createPolygon` validates vertex COUNT and FINITENESS, both of which a collinear trace
satisfies, so the traced path accepted a zero-area footprint while the typed path refused
degeneracy through its sign guard.

**This amendment exists because a stale listing in an executable plan is a REGRESSION waiting to
be re-run, not a documentation defect.** A subagent given this task follows the code block
literally; left as it was, the next execution would have silently reverted a shipped fix and
every test of it would have been deleted along with the guard. That is the difference between
this and the plan-text findings deliberately left open elsewhere on this branch.

Two things the listing cannot carry, both recorded where the code is:

- `enclosesArea` is TOTAL rather than `Result`-returning. `area` validates its input, so a caller
  downstream of `createPolygon` would carry a refusal arm nothing can reach — the dead-guard
  shape this task's own `footprintFromDimensions` docblock already records.
- It tests AREA, not bounding-box extent. Three points on a diagonal enclose nothing while their
  box is square, so an extent test refuses the axis-aligned collinear case and passes the
  diagonal one. Measured: swapping the rule for an extent test reddens the diagonal case alone.

Both `degenerate-footprint` and `degenerate-clearance` are new codes and belong in Task A12's
locale table, which builds from the raise sites rather than from `en.ts`.

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
		footprintPending: false,
		clearancePending: false,
		anchorPending: false,
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
	 *
	 * `.default(false)` and NOT `.catch(false)`: a missing key is an older file and reads as
	 * measured, but a PRESENT invalid value (`"true"` from a hand edit) must fail the read
	 * rather than be coerced — coercing it silently suppresses the unscaled warning and
	 * presents placeholder-space geometry as millimetres, which is the one direction of this
	 * field that is unsafe. Same rule as the polygon vertex count in Task A4: refuse, do not
	 * repair. (`revision` keeps `.catch(0)` because a bad counter costs a conflict, not a
	 * silent misreading.)
	 */
	footprintPending: z.boolean().default(false),
	clearancePending: z.boolean().default(false),
	anchorPending: z.boolean().default(false),
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
- Create: `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` — **not**
  `persistence/geometry/`, which two earlier drafts of this plan named. The store imports `TFile`,
  `FileManager` and `Vault` from `obsidian` directly, so it belongs beside its siblings in
  `obsidian/repositories/`; the other path would either put Obsidian-specific code in a layer that
  does not name Obsidian, or produce a second implementation beside the landed one
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

**The read runs BOTH domain validators, not one.** The shape goes through `validateAssetShape`
and the calibration through `validateCalibration` (`domain/plan/Calibration.ts`, which calls
itself the read path's validator). An earlier draft of this step named only the first, and the
gap was real rather than editorial: coincident points are four well-typed numbers the schema
cannot fault, and `updateAssetShape` decides `footprintPending` from `calibration !== null`, so
a degenerate calibration records a fresh trace as ALREADY SCALED while no usable scale exists.

The plan sidecar has no equivalent hole because its calibration is validated one layer up, at
`Plan.withCalibration` while `ObsidianPlanRepository` assembles the entity. An
`AssetGeometryDocument` reaches a command with no assembly step in between, so this read is the
only door there is — which is why the asymmetry with `ObsidianPlanGeometrySidecar` is correct
rather than an oversight to be tidied away.

`validateCalibration`'s CODE passes through unchanged, so one rule keeps one vocabulary; only its
category is restamped, because `plan.degenerate-points` is a `CalculationError` and
`RepositoryError` admits `ValidationError`. Add the two cases: a sidecar whose calibration has
coincident points refuses the read, and an ordinary calibration still reads — the second is the
positive control, without which the rule is pinned as refusing calibrations rather than refusing
degenerate ones.

- [ ] **Step 5: Run the whole infrastructure suite**

```bash
npx vitest run tests/infrastructure
```

Expected: PASS, with the new file's cases included.

- [ ] **Step 4a: Refuse a corrupt shape at the READ, not only at the command**

The schema shape in A3 accepts a polygon with zero, one or two vertices — `Polygon` is deliberately
unvalidated at the type level so a tool can hold a mid-gesture buffer — so a hand-edited sidecar
would otherwise cross into `AssetShape` without ever passing `createPolygon`, while every command
above assumes it did.

Close it at both ends: `.min(3)` on each polygon's `points` in `AssetShapeSchemaV1`, **and**
`validateAssetShape` in the adapter's read path, because the schema cannot see the non-finite and
facing rules the domain validator owns. Add the test:

```typescript
it('refuses a hand-edited sidecar whose footprint has two vertices', async () => {
	await vault.write(sidecarPath, JSON.stringify({ ...validDocument, shape: { ...validShape, footprint: { points: [[0, 0], [1, 1]] } } }));
	const read = await sidecar.read(assetId);
	expect(isErr(read)).toBe(true);
});
```

That is a refusal and not a silent repair: a shape somebody typed by hand is data this plugin did
not write, and reading it as an empty design would present a corrupted file as an asset nobody has
drawn yet.

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
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(true);
	});

	it('marks a trace taken on a CALIBRATED surface as already scaled', async () => {
		await seedCalibration();
		await traceCommand.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }] });
		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
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

Each: read the sidecar, build or validate the shape, merge it over the existing document preserving every attribute it does not own, write conditionally on `expected`, publish an `assetDesignChanged` event — one event for every design command in this increment (see Task B3a), never a per-field family, return `ok('wrote')`. A refusal returns before the write. Add the event to `src/domain/asset/Asset.events.ts` following `assetCreated`'s shape.

**Two rules are load-bearing here, and both apply to every command in A5, A6 and B6.**

*Preservation*: setting a footprint must never clear a clearance, an anchor or a facing. That is
what test 3 pins, and it is why these commands read before they write rather than composing a fresh
document.

*Provenance and pending*: a traced footprint sets `footprintOrigin: 'traced'` and sets
`footprintPending` from whether the surface is calibrated at capture; the typed command sets
`'typed'` and leaves `footprintPending` clear. Neither touches `clearancePending` or `anchorPending`.

*Conditioning*: the write passes **`input.expected ?? snapshot.version`** — the version this command
just read — never `undefined`. An unconditional whole-document replace is a lost update the moment
two designer leaves show one asset: both read revision N, one sets the anchor, the other sets the
facing, and the later write restores the earlier attribute from its own stale snapshot with nothing
reporting anything. Add the case:

```typescript
it('refuses the second of two writes built from the same revision, rather than losing one', async () => {
	const first = await sidecar.read(assetId);
	const second = await sidecar.read(assetId);
	await anchor.execute({ assetId, anchor: { x: 1, y: 1 }, expected: isOk(first) ? first.value.version : undefined });
	const late = await facing.execute({ assetId, facing: 1, expected: isOk(second) ? second.value.version : undefined });
	expect(isErr(late)).toBe(true);
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.shape?.anchor).toEqual({ x: 1, y: 1 });
});
```

- [ ] **Step 4: Run, watch pass, then commit**

```bash
npx vitest run tests/application/commands/asset
npm run check
git add src/application/commands/asset/SetAssetFootprint.ts src/domain/asset/Asset.events.ts tests/application/commands/asset/setAssetFootprint.test.ts
git commit -m "Set an asset's footprint, typed or traced"
```

#### Amendment 1 — executed 2026-08-31 as `e748d4c`, and what it did NOT do

**Shipped:** both commands and sixteen cases, two files, `npm run check` green (290 files,
4161 passed, statements 99.28%, the new file at zero uncovered statements, functions and
branches). Every guard was mutated out one at a time and each reddened exactly its intended
case.

**NOT shipped: the event.** Step 3 above requires `assetDesignChanged` and an addition to
`src/domain/asset/Asset.events.ts`; Step 4's `git add` names that file. The task's own
**Interfaces** block names no `EventBus` at all, and the instruction was two files. The
executing agent shipped neither the event nor a bus, and said so rather than substituting
`assetUpdated` — which has live subscribers (slice 10's recalculation cascade re-reads every
Requirement referencing the asset), so publishing it on a footprint edit would have been a
behaviour decision wearing a stand-in's clothes.

**The consequence is scheduled rather than left to be discovered.** `AssetDesignChanged` does
not exist, so Task A9's wiring case
(`root.eventBus.subscribe('AssetDesignChanged', …)`, line ~1138) and Task B3a cannot pass. It
is **Task A5a** below, and it lands before A6 so that A6's three commands copy an established
pattern rather than inventing one — and so that the retrofit of A5's two commands is explicit
in its own commit rather than buried inside a task about clearance.

**Three corrections to this task's own text, found by executing it:**

1. **`shapeFromDimensions` is unusable here** and the Consumes block names it. It composes a
   WHOLE fresh shape (clearance `null`, anchor `{0,0}`, facing `0`), so using it destroys
   exactly what the *Preservation* rule protects and test 3 fails. What A5 actually consumes
   is `footprintFromDimensions` plus a merge over the stored shape. Task A6's "exactly what
   Task A5 consumes" inherits this correction.
2. **The stale-version fixture does not compile.** `const stale = { revision: 0, digest:
   'stale' }` — `EntityVersion` is `{ revision, observed: ObservationToken }`, a branded
   string, and `tests/**` is type-checked by `build`. Take a real earlier version from a prior
   read instead, which is also the stronger fixture: it proves the file was not overwritten.
3. **The Conditioning case above only exercises the `expected` a caller passed.** Mutating
   `input.expected ?? snapshot.version` to `input.expected` leaves it green — the `??` half is
   unobservable through the port with a single writer. An interposing sidecar that lands a
   competing write between the command's read and its write is what reddens it, and that is
   the case as shipped.
4. **`seedCalibration()` implies a command that does not exist** in this increment. The test
   seeds the document straight through the port, and `AssetGeometryDocument` is written whole,
   so seeding is `sidecar.write` rather than a helper.

**One judgement call, pinned as behaviour rather than left implicit:** a stale `expected` over
an *identical* footprint returns `no-write` rather than a conflict, because the command returns
before reaching the port — no field it owns would change, so there is nothing to lose. It has a
case and a paragraph in the docblock.

---

### Task A5a: `AssetDesignChanged`, and the bus both A5 commands owe it

**Why it is its own task.** The event is named in five places (this plan's A5 Step 3, A9's
wiring case, B3a, the undo section, and the spec's §371) and defined in none. Task A5 shipped
without it for the reason its Amendment 1 records; Task A6's text does not mention it at all,
so left alone the gap reaches A9 as a failing wiring test with three tasks' worth of commands
to retrofit at once.

**Files:**
- Modify: `src/domain/asset/Asset.events.ts` — add the event following `assetCreated`'s shape
- Modify: `src/application/commands/asset/SetAssetFootprint.ts` — an `EventBus` constructor
  argument on both commands, published on the `'wrote'` path only
- Test: `tests/application/commands/asset/setAssetFootprint.test.ts` — extend

**Interfaces:**
- Consumes: `EventBus` (**`src/core/events/EventBus.ts`** — NOT `application/ports/`, which has no such file; every `application/` command imports it from core), `AssetId`.
- Produces: `AssetDesignChanged { assetId }` — ONE event for every design command in this
  increment, never a per-field family. B3a depends on that being one name.

- [ ] **Step 1: Write the failing cases**

Two, and the second is the one that discriminates:

**Both snippets below are written for the SHAPE, and the shape is nested.** An
`EventBus.subscribe` handler receives `DomainEvent<TType>`, which declares only `type` — every
subscriber in `src/` narrows with a cast first (`onAssetUpdated.ts:30`) — and every asset event
carries `{ type, payload: { assetId } }` through the existing `AssetEventPayload`, so it is
`e.payload.assetId` and never `e.assetId`. The Produces line above reads as a flat event; taken
literally it would produce one inconsistent with `AssetCreated`/`AssetUpdated`/`AssetDeleted`.
Since `tests/**` is type-checked by `build`, the flat spelling fails the GATE and not merely the
assertion — and `npx vitest run` alone cannot see it, because vitest transpiles without checking.

```typescript
it('announces a footprint that was written', async () => {
	const heard: AssetId[] = [];
	bus.subscribe('AssetDesignChanged', (e) => heard.push((e as AssetDesignChanged).payload.assetId));
	await typed.execute({ assetId, width: 120, depth: 80 });
	expect(heard).toEqual([assetId]);
});

it('announces nothing when the write was a no-write', async () => {
	await typed.execute({ assetId, width: 120, depth: 80 });
	const heard = designChangesHeardOn(bus);
	await typed.execute({ assetId, width: 120, depth: 80 });
	expect(heard).toEqual([]);
});
```

**The second is not a nicety.** `no-write` returns before the port is reached, and a command
that announced regardless would tell every open designer leaf to re-read on every idle
re-submit — and would make the event mean "somebody pressed something" rather than "the stored
design changed", which is not a signal a subscriber can act on. A refusal announces nothing
either, for the same reason and by the same `'wrote'` gate.

- [ ] **Step 2: Run, watch fail, implement**

Publish inside `setFootprint`'s `'wrote'` arm, so both commands announce through one line and a
third design command added to that file cannot forget. **Mutate the gate out** — announce
unconditionally — and watch case two go red on its own.

- [ ] **Step 3: Run, gate, commit**

```bash
npx vitest run tests/application/commands/asset
npm run check
git add src/domain/asset/Asset.events.ts src/application/commands/asset tests/application/commands/asset
git commit -m "Announce a changed asset design"
```

---

### Task A6: clearance, anchor and facing

**Files:**
- Create: `src/application/commands/asset/SetAssetClearance.ts`
- Create: `src/application/commands/asset/SetAssetAnchor.ts`
- Create: `src/application/commands/asset/SetAssetFacing.ts`
- Test: `tests/application/commands/asset/setAssetAttributes.test.ts`

**Interfaces:**
- Consumes: exactly what Task A5 consumes **as corrected by its Amendment 1** —
  `footprintFromDimensions` and a merge, never `shapeFromDimensions`, which composes a whole
  fresh shape and destroys the very attributes the *Preservation* rule protects — plus the
  `EventBus` Task A5a threads through. All three commands here take it and publish
  `AssetDesignChanged` on the `'wrote'` path only, copying `setFootprint`'s single publish
  point rather than each announcing for itself.
- Produces: `SetAssetClearanceCommand` (input `{ assetId, points: readonly Point[] | null, expected? }`), `SetAssetAnchorCommand` (`{ assetId, anchor: Point, expected? }`), `SetAssetFacingCommand` (`{ assetId, facing: number, expected? }`), all resolving `Result<DispatchOutcome, AppError>`.

- [ ] **Step 1: Write the failing tests**

Seven cases, and two of them exist because of rules this repository has already paid for:

```typescript
it('refuses a clearance on an asset with no footprint, because a boundary is relative to one', async () => {
	const result = await clearance.execute({ assetId: withoutShape, points: square });
	expect(isErr(result) && result.error.code).toBe('asset.no-footprint');
});

it('clears the clearance when given null, and clears its pending flag with it', async () => {
	await seedUncalibratedSurface();
	await clearance.execute({ assetId, points: square });   // captures with clearancePending: true
	const result = await clearance.execute({ assetId, points: null });
	expect(isOk(result) && result.value).toBe('wrote');
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	expect(shape?.clearance).toBeNull();
	expect(shape?.clearancePending).toBe(false);
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

#### Amendment 1 — the shared write path, decided 2026-08-31 after Task A5a

**A5a establishes a property this task as written cannot inherit.** Its Step 2 rationale is that
the publish sits in `setFootprint` "so both commands announce through one line and a third design
command added to that file cannot forget" — and A6's three commands are in THREE files with no
shared write helper named anywhere. Copying the publish three times gives three publish points and
the property is gone; the Interfaces block above says "copying `setFootprint`'s single publish
point", which is not a thing a caller in another file can do.

So the first move of this task is an EXTRACTION, not a third command:

- Move `setFootprint`'s body out of `SetAssetFootprint.ts` into
  `src/application/commands/asset/updateAssetShape.ts` as `updateAssetShape(sidecar, events,
  input, change)`, unchanged. It is already generic — the only per-command part is the `change`
  callback — so this is a move plus a rename, and both A5 commands keep working through it.
- All FIVE commands go through it: the two footprint ones and this task's three. One read, one
  `validateAssetShape`, one `expected ?? version`, one no-write comparison, one publish.
- **The comparison is the one part that cannot be shared as-is.** `sameFootprint` asks about the
  three fields the footprint commands own; each of these three owns different ones. Hand the
  comparison in beside the change — `unchanged: (current, next) => boolean` — so the "would this
  write change anything" question stays at the one place that decides whether to publish, and the
  per-command knowledge of WHICH fields stays with the command.

**Why an extraction rather than a base class or three copies:** the property being preserved is
that a sixth design command cannot forget to announce, and that is only true if there is one
function it must call to write at all. Three copies satisfy every test in this task and lose it
silently.

Add the case A5a's own suite has for the footprint pair, once per command here:

```typescript
it('announces nothing when the write was a no-write', async () => {
	await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
	const heard = designChangesHeardOn(bus);
	await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
	expect(heard).toEqual([]);
});
```

- [ ] **Step 2: Run, watch fail, implement the three commands**

Each reads, validates through `validateAssetShape`, compares against the stored value (`coincident` for the anchor, not `===`), writes only on a real change, and returns `'no-write'` otherwise — all of it through `updateAssetShape`, per Amendment 1 above.

**Each sets its OWN pending flag at capture**, and only its own: `SetAssetClearance` sets
`clearancePending` from whether the surface is calibrated at that moment, `SetAssetAnchor` sets
`anchorPending`, and neither touches the other's or the footprint's.

**Removal is not a capture.** `SetAssetClearance` with `points: null` sets `clearancePending` to
**false** unconditionally — there are no coordinates left to convert, and a flag saying otherwise
hands B6 a group to rescale that does not exist. `validateAssetShape` refuses that state (Task A2),
so a build that derives the flag from calibration alone fails at the write rather than persisting
something the reader would have to interpret. That is the whole of what the
per-attribute model asks of these commands, and it is why B6 needs no conjunction. Add the case:

```typescript
it('sets only its own pending flag, leaving a measured footprint measured', async () => {
	await seedShape({ footprintOrigin: 'traced', footprintPending: false });   // already calibrated once
	await clearFlagsBySeedingUncalibratedSurface();
	await clearance.execute({ assetId, points: square });
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	expect(shape?.clearancePending).toBe(true);
	expect(shape?.footprintPending).toBe(false);
	expect(shape?.anchorPending).toBe(false);
});
```

- [ ] **Step 3: Run, gate, commit**

```bash
npx vitest run tests/application/commands/asset
npm run check
git add src/application/commands/asset tests/application/commands/asset
git commit -m "Set an asset's clearance, anchor and facing"
```

Each of the three needs the `no-write`-does-not-announce case Task A5a pins, or the gate is
kept in one command out of five by memory rather than by a shared publish point.

---

### Task A7: height, the one frontmatter scalar

**Files:**
- Create: `src/application/commands/asset/SetAssetHeight.ts`
- Modify: `src/infrastructure/persistence/dto/assetFrontmatter.ts` (find it with `ls src/infrastructure/persistence/dto/`)
- Modify: `src/infrastructure/persistence/mappers/assetMapper.ts` — NOT "beside" the DTO, it is a
  sibling directory
- Test: `tests/application/commands/asset/setAssetHeight.test.ts`
- Test: extend the existing asset frontmatter/mapper test

**Interfaces:**
- Consumes: `AssetRepository`, `Asset.withChanges`, **`EventBus`** (`src/core/events/EventBus.ts`).
  The bus was missing from this line and it is not optional: Task B3a requires this exact command
  to publish `AssetDesignChanged` — it names `SetAssetHeight` — and Task A9 wires
  `assetDesign: { …, setHeight, … }` against whatever signature this task shipped. Built to the
  stated interface, A7 makes B3a a retrofit across the bundle.
- Produces: `SetAssetHeightCommand` with input `{ assetId, height: number | null, expected? }`
  resolving **`DispatchResult`**, like every other command in this increment; `Asset.height: number
  | null`. The return type was unstated, and the wrong one COMPILES — `Result<Asset, …>` is
  `UpdateAssetCommand`'s shape, the nearest neighbour and the one a reader copies, and it breaks
  the save indicator, which is the `ok`-is-not-evidence-of-a-write defect this repository has
  already paid for.

- [ ] **Step 1: Add the field to the schema, additively**

`height: z.number().nullable().catch(null)`, so **no schema version bump is owed**: an absent key
reads as `null` and a garbage value reads as `null` rather than failing the load.

**Two corrections to how that was originally stated.** There is no `.number()` field on
`AssetFrontmatterSchemaV1` at all — the existing nullable fields are `.string().nullable()
.catch(null)` and one with a `.regex(…)` — so "follow the pattern the existing nullable asset
fields use" pointed at a pattern that is not there. And `.catch(null)` protects the READ and does
nothing for the WRITE: `serializeFrontmatter` emits `String(v)`, so a non-finite height is written
as a bare word no YAML number grammar accepts, read back as `null`, and lost — having refused
nothing. That hole is closed by the finiteness gate in Step 2, not by the schema.

**The no-bump claim is a fact about a TAG.** Measured with `git ls-remote --tags origin`, which
prints nothing: no release exists, so no vault holds an Asset note written by a build predating
this key. If a release is cut before this reaches `main`, ask that tag's tree instead.

- [ ] **Step 2: Write the failing tests**

**`.value?.entity.height`, not `.value?.height`.** `AssetRepository.getById` answers
`Result<Loaded<Asset> | null, RepositoryError>` and `Loaded<T>` puts the version BESIDE the
entity, deliberately. Every snippet below had the flat spelling, which under
`expect(isOk(x) && …)` silently asserts on a boolean rather than failing loudly.

```typescript
it('round-trips a height through the note, so a plugin-less reader sees it', async () => {
	await height.execute({ assetId, height: 900 });
	const reloaded = await assets.getById(assetId);
	expect(isOk(reloaded) && reloaded.value?.entity.height).toBe(900);
});

it('clears a height given null', async () => {
	await height.execute({ assetId, height: 900 });
	await height.execute({ assetId, height: null });
	const reloaded = await assets.getById(assetId);
	expect(isOk(reloaded) && reloaded.value?.entity.height).toBeNull();
});

it('refuses a negative height', async () => {
	const result = await height.execute({ assetId, height: -10 });
	expect(isErr(result) && result.error.code).toBe('asset.negative-height');
});

it('refuses a non-finite height, which is a SECOND question and a separate code', async () => {
	for (const height_ of [Number.POSITIVE_INFINITY, Number.NaN]) {
		const result = await height.execute({ assetId, height: height_ });
		expect(isErr(result) && result.error.code).toBe('asset.invalid-height');
	}
});
```

**Why finiteness is its own gate and its own code.** `NaN < 0` is `false`, so a sign guard cannot
see it, and "a height cannot be negative; got NaN" is not a true sentence — the same split
`footprintFromDimensions` already makes between sign and finiteness. Its loss is SILENT: the
schema's `.catch(null)` turns a non-finite value into `null` on the way in, while
`serializeFrontmatter` writes `String(v)` on the way out, so the command reports `'wrote'`, the
note carries a bare word, and the height is gone at the next read having refused nothing. Zero
stays legal.

**Four more cases the original list omitted**, each covering a branch this command must have and
none of which the four snippets reach — measured, and against floors with about one covered unit
of headroom, so their absence fails the gate rather than passing quietly: the `no-write` report
(which `DispatchResult` requires a decision on and this task never mentioned), the `expected`
condition (declared in the Interfaces above and exercised by nothing), the not-found arm, and a
READ that fails rather than answering `null` — the last being the `isErr(x) || x.value === null`
collapse this repository has already paid for, where a vault fault is reported as "the asset is
gone".

**Does height count as a design change? Yes — `AssetDesignChanged`, never `AssetUpdated`.** A
height is an input to no quantity and no cost and is absent from `calculatedFrom`, so announcing
it on the event slice 10's recalculation cascade subscribes to would be a behaviour change
wearing a name's clothes. But the designer's inspector draws it, so a peer leaf must re-read.

**The "interpreted by nothing" case, rewritten because as originally written it discriminated
nothing.** It called `requirementsFor(assetId)`, which does not exist — two hits in this plan and
none in `src/` or `tests/` — and its stated justification ("weak evidence today and strong
evidence the day somebody adds a reader") was too generous even once built:
`registerOnAssetUpdated` filters through `assetMatchesCalculatedFrom`, which compares price and
unit, neither of which a height moves. So a build publishing `AssetUpdated` would list the
referring requirements, skip every one, and write nothing — identical figures and revisions in
both worlds. Build it with the cascade REGISTERED and an `AssetUpdated` subscriber asserted
EMPTY; that is what makes the wrong-event mutation redden it, and the figure and revision
assertions stay as the tripwire for the day a reader appears.

- [ ] **Step 3: Implement, run, gate, commit**

```bash
npm run check
git add src/application/commands/asset/SetAssetHeight.ts src/infrastructure/persistence src/domain/asset tests
git commit -m "An asset carries a height, and nothing computes with it"
```

---

### Task A7a: delete an asset's geometry with the asset

**Why it exists.** Found by review after Task A4, and scheduled rather than fixed inline because
it is four moves and a lifecycle change, which deserves the same test-first and mutation
discipline the commands around it got.

`AssetGeometrySidecar` declares `read` and `write` and nothing else, and `AssetDeleted` has exactly
ONE consumer in `src/` — `assetCatalogueChangeSource.ts`, a refresh signal for the catalogue picker
— so nothing removes a file. The sidecar did not exist before A4, so this branch introduced the
orphan.

**The consequence is not merely untidy.** `<libraryFolder>/Geometry/<assetId>.rpgeo` survives the
note, is carried through every later library migration by `libraryGeometryIn`, and — since an id is
a user-editable frontmatter field — a REUSED id silently loads a deleted asset's design onto the
new one. That defeats an existing guard rather than slipping past one: A4's read refuses a sidecar
whose internal `assetId` disagrees with the file requested, and a reused id makes the two agree.

**The precedent is a sibling file, so nothing here needs designing.** `ObsidianPlanRepository`
calls `this.geometry.delete(...)` at TWO sites — one on the ordinary delete path and one on a
compensation path — and they differ. Read both before writing either.

**Files:**
- Modify: `src/application/ports/AssetGeometrySidecar.ts` — a `delete` member
- Modify: `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` and
  `ObsidianAssetGeometrySidecar.ts`
- Modify: whichever repository owns the asset note's delete — find it rather than assuming, and
  mirror the plan side's call sites
- Test: extend `tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts`, plus the
  asset delete path's own suite

- [ ] **Step 1: Write the failing cases**

Four, and the second is the one a naive implementation breaks:

1. deleting a DESIGNED asset removes its `.rpgeo`;
2. deleting an UNDESIGNED asset — no sidecar on disk — still succeeds. An absent sidecar is the
   ordinary state, not a failure, which is the rule A4's read already follows;
3. a sidecar whose removal FAILS does not leave the note gone and the file behind. Which of refuse
   or compensate is right is decided by reading the plan side's two sites, not by choosing here;
4. a library migration after a delete carries nothing orphaned — the `libraryGeometryIn` half,
   which is what makes the consequence above checkable rather than argued.

- [ ] **Step 2: Run, watch fail, implement**

- [ ] **Step 3: Mutate**

Remove the delete call and watch case 1 redden alone. Then remove the no-sidecar guard and watch
case 2. **If case 2 reddens nothing, the fixture has a sidecar it should not** — the absence is
only evidence if the fixture could have produced the thing.

- [ ] **Step 4: Run, gate, commit**

```bash
npm run check
git commit -m "Delete an asset's geometry with the asset"
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
	/** `shape.footprintPending` — a stored fact about the footprint's own capture, never a join. */
	readonly dimensionsUnscaled: boolean;
	readonly version: EntityVersion;
}
export class GetAssetDesignQuery implements Query<AssetId, Result<AssetDesignDto, AppError>> {}
```

- [ ] **Step 1: Write the failing tests — the pending truth table**

`dimensionsUnscaled` **is** `footprintPending`, with no second term. An earlier draft of this table
carried a fourth row — typed with `footprintPending: true`, expecting no warning — which quietly
reinstated the conjunction the per-attribute model exists to remove, and described a state no
command can produce: `footprintPending` is about the FOOTPRINT, so a typed outline never sets it.
The mixed case it was reaching for is a typed footprint beside a pending *clearance*, and that is
the separate case below. The incoherent state is refused at the boundary instead (Task A2).

Three reachable rows, then:

```typescript
it.each([
	['typed',  false, false],
	['traced', false, false],
	['traced', true,  true ],
])('origin %s with footprintPending %s reports unscaled=%s', async (origin, footprintPending, expected) => {
	await seed({ origin, footprintPending });
	const dto = await query.execute(assetId);
	expect(isOk(dto) && dto.value.dimensionsUnscaled).toBe(expected);
});

it('keeps a measured outline measured when its background is replaced', async () => {
	await seed({ origin: 'traced', footprintPending: false, calibration: 'calibrated' });
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

The store takes the `libraryFolder` setting **in its constructor**, resolved the same way slice
19's asset repository resolves it, and derives each path through `assetSidecarPathFor`.

**An earlier draft said the opposite in the very next sentence** — "do not cache the folder in a
constructor; resolve it per write from the entity being saved" — which contradicted the line above
it and the landed store both. That is slice 18's rule and it belongs to slice 18's regime: a
PROJECT-scoped entity whose folder is derived from where its `Project.md` sits (ADR-0013), so
there is an entity to resolve from and a refusal to make when it resolves to nothing.

An Asset is LIBRARY-scoped — slice 19's whole change — and since then carries no project and no
folder at all. A sidecar operation receives an `assetId` and nothing else, so there is no
entity-derived folder to resolve; following the deleted instruction would force a dependency that
does not exist or replace the correct setting-based rule with a broken one. Nothing goes stale
either, which is what that rule exists to prevent: `saveSettings` swaps the composition root, so a
library migration rebuilds the store against the new folder rather than leaving a cached one
behind.

- [ ] **Step 2: Guard every door**

Wrap each command with `guardCommand` and the query with `guardQuery` in `guardedServices.ts`, one event name each (`command.setAssetFootprint.failed`, …). Any command that later gains a reversible adapter dispatching through `executeWithVersion` takes `guardBothDoors` instead — a guard on the door nobody dispatches through is a guard nobody has.

- [ ] **Step 3: Extend the behavioural guard category test**

Add the asset geometry sidecar to `guardCategory.test.ts`'s detonated collaborators, so a hostile input through every door the walk finds still comes back as the mapped `vault.unexpected-failure`.

- [ ] **Step 4: Write the wiring test**

```typescript
it('a shape written through the root reaches a subscriber on the root event bus', async () => {
	const root = createCompositionRoot(deps);
	const heard: string[] = [];
	// `e.payload.assetId`, and `heard: AssetId[]` — the flat spelling and a `string[]` both fail
	// `build`, which type-checks `tests/**`. Found by executing Task A5a; see its report.
	root.eventBus.subscribe('AssetDesignChanged', (e) => heard.push((e as AssetDesignChanged).payload.assetId));
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

Both dimension fields optional but paired; on submit, create the asset, then set the footprint only
if both are given.

**Two rules stop a failed footprint write stranding an asset**, which is the sequence's real
hazard — the note is committed before the sidecar is touched, so a vault fault in between leaves an
asset with no footprint and a dialog that would create a *second* one on retry:

1. **Validate the dimensions before creating anything.** `footprintFromDimensions` is pure, so the
   common failure — a zero, a negative, a non-number — is caught with nothing yet written.
2. **Keep the created id and reuse it on retry.** The form holds the `assetId` it created; a retry
   after a footprint failure dispatches only `SetAssetFootprintFromDimensions` against that id. The
   asset already exists and is usable — it simply has no footprint yet — so re-creating it would
   turn one vault fault into two catalogue entries.

```typescript
it('does not create a second asset when the footprint write fails and the user retries', async () => {
	setFootprintFromDimensions.mockResolvedValueOnce(err(vaultFault));
	const form = mountForm();
	await fillAndSubmit(form, { name: 'Island', width: '1200', depth: '800' });
	setFootprintFromDimensions.mockResolvedValueOnce(ok('wrote'));
	await form.submit();
	expect(createAsset).toHaveBeenCalledTimes(1);
	expect(setFootprintFromDimensions).toHaveBeenCalledTimes(2);
});

it('writes nothing at all when the dimensions are invalid', async () => {
	await fillAndSubmit(mountForm(), { name: 'Island', width: '0', depth: '800' });
	expect(createAsset).not.toHaveBeenCalled();
});
``` **A rejected commit keeps the user's typed value and shows a persistent inline error — it never reverts.** Editing a field retires only its own message, and the paired dimension error retires both halves together.

- [ ] **Step 4: Add the copy to both locales**

Every key in `en.ts` and `de.ts`. German: `Objekt`, never `Material`. Sentence case — a capitalised word mid-sentence fails `obsidianmd/ui/sentence-case-locale-module`.

- [ ] **Step 4a: Bind every new code to its raise site in `toUserMessage.test.ts`**

Add a row per code this increment raises — `asset.non-positive-dimension`,
`asset.invalid-footprint`, `asset.invalid-clearance`, `asset.invalid-anchor`,
`asset.invalid-facing`, `asset.no-footprint`, `asset.negative-height`, plus the three this list
did not have when it was written: **`asset.degenerate-footprint`**, **`asset.degenerate-clearance`**
(Task A2's Amendment 2) and **`asset.invalid-height`** (Task A7's finiteness gate) — asserting the
English and German sentence each resolves to.

**Those three are exactly why the instruction below is a grep and not a list.** All three are
raised through `assetError`, so the command finds them; the enumeration above did not, and a code
with no locale entry does not degrade to silence — it degrades to the WRONG sentence, which is
slice 11's own recorded defect. Read the list as a floor that has already gone stale once, and
trust what the grep prints over what this paragraph says.

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

// draw-polygon-tool.ts — the tool no longer names a Zone, and still produces a COMMAND
export interface PolygonCompletion {
	/** Builds the reversible command for these vertices; the tool dispatches it through
	 *  `context.commandDispatcher.run`, which is what puts the gesture on the undo stack. */
	commandFor(points: readonly Point[]): UndoableCommand;
}
```

- [ ] **Step 1: Rename the field and let the compiler find the callers**

```bash
npx vue-tsc --noEmit
```

Fix each site it names. There is exactly one coupled field, so this is a rename, not a redesign.

- [ ] **Step 2: Write the failing test for the injected completion**

```typescript
it('builds its command from the completion it was given, so one tool serves zones and footprints', async () => {
	const commandFor = vi.fn().mockReturnValue(fakeUndoableCommand);
	const tool = new DrawPolygonTool({ commandFor });
	await drawTriangle(tool);
	expect(commandFor).toHaveBeenCalledWith([
		{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 },
	]);
});

it('dispatches that command through the dispatcher, so the gesture reaches the undo stack', async () => {
	const tool = new DrawPolygonTool({ commandFor: () => fakeUndoableCommand });
	await drawTriangle(tool);
	expect(context.commandDispatcher.run).toHaveBeenCalledWith(fakeUndoableCommand);
});
```

- [ ] **Step 3: Implement the injection**

`DrawPolygonTool` takes a `PolygonCompletion` rather than constructing a `CreateZone` dispatch. The plan editor passes the zone completion; the designer will pass a footprint one in Task B5.

**The completion returns a COMMAND, not a result**, and that distinction is load-bearing: the tool must go on dispatching through `context.commandDispatcher.run`, because that is the single funnel per leaf that puts a gesture on the undo stack, refreshes the stores and drives the save-state badge. A completion that performed its own dispatch would take every drawing gesture off all three with nothing erroring anywhere. **The generation counter, the duplicate-vertex `coincident` guard, the close-target rule and the Shift constraint all stay exactly as they are** — this is a change to what completion does, not to how a polygon is drawn.

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

### Task B3a: the designer's runtime, and the refresh nobody else performs

**Files:**
- Create: `src/presentation/designer/runtime.ts`
- Create: `src/presentation/designer/stores/assetDesignStore.ts`
- Test: `tests/presentation/designer/designerRefresh.test.ts`

**Interfaces:**
- Consumes: `GetAssetDesignQuery` (A8), `CommandHistory`, `withEditorStateRefresh`'s pattern, the guarded command bundle (A9).
- Produces: `useDesignerRuntime()` — one wrapped dispatcher per leaf, and `AssetDesignStore.hydrate(assetId)`.

**Why this task exists:** without it every write in Phase B is invisible until the leaf is reopened.
The plan editor solves this with `withEditorStateRefresh` and a per-leaf wrapped dispatcher, and
that solution does not come along with the extracted gesture surface — it lives above it.

- [ ] **Step 1: Write the failing tests**

```typescript
it('re-reads the design after a successful dispatch, so the canvas shows what was written', async () => {
	const runtime = useDesignerRuntime(deps);
	await runtime.dispatch(setFootprintCommand);
	expect(store.design?.dimensions).toEqual({ width: 1200, depth: 800 });
});

it('re-reads after a REJECTED dispatch too, because a write may have landed before the fault', async () => {
	setFootprint.mockRejectedValueOnce(new Error('vault exploded'));
	const runtime = useDesignerRuntime(deps);
	await expect(runtime.dispatch(setFootprintCommand)).rejects.toThrow();
	expect(query.execute).toHaveBeenCalledTimes(2);
});

it('keeps the LATEST read when two hydrations overlap', async () => {
	const slow = deferred(); const fast = deferred();
	query.execute.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
	const a = store.hydrate(assetId); const b = store.hydrate(assetId);
	fast.resolve(ok(designWithFootprint));
	slow.resolve(ok(designWithoutFootprint));
	await Promise.all([a, b]);
	expect(store.design?.shape).not.toBeNull();
});

it.each(['footprint', 'height', 'background'])('refreshes a second leaf on the same asset after a %s change', async (field) => {
	mountTwoLeavesOn(assetId);
	await changeOnFirstLeaf(field);
	expect(secondLeaf.store.design).toEqual(await currentDesign(assetId));
});

it('reports a fault from a dispatch bound to a click, which has no awaiter', async () => {
	setFootprint.mockRejectedValueOnce(new Error('vault exploded'));
	await clickToolbarButton();
	expect(logger.error).toHaveBeenCalled();
	expect(notices.shown).toHaveLength(1);
});
```

**One event, not a list of them.** Every command in A5–A7, B6 and B7 publishes
`AssetDesignChanged { assetId }` — including `SetAssetHeight` and `SetAssetBackground`, which change
fields `GetAssetDesign` returns without touching the shape. A subscription keyed on shape events
alone leaves a peer leaf's inspector and background stale until it is reopened, and a per-field
event list is a rule stated as a list: it goes stale the day a ninth command is added, silently and
in the direction of a stale surface. The leaf filters by `assetId`, so an unrelated asset's change
costs nothing.

Each case is a rule this repository has already paid for: a thrown fault is not "nothing happened"
so the refresh runs on rejection too; a store two things hydrate needs a request ticket or the
slower earlier read wins and a just-drawn shape vanishes with no error; a change reaches every leaf
showing that subject; and every dispatch is ultimately bound to a click handler that discards its
promise, so without a last-stop reporter a fault is an unhandled rejection and the button silently
stops working.

- [ ] **Step 2: Implement**

One wrapped dispatcher per leaf — tools, toolbar and inspector all dispatch through it, because a
dispatch that bypasses it breaks the refresh and the undo/redo flags with nothing erroring
anywhere. Wrap `run`, `undo` and `redo` with the save-state tracking **outside** the refresh
decorator, so `Saved` never appears while the canvas still shows the pre-command state.

- [ ] **Step 3: Run, gate, commit**

```bash
npx vitest run tests/presentation/designer
npm run check
git add src/presentation/designer tests/presentation/designer
git commit -m "One dispatcher per designer leaf, and a refresh that survives a fault"
```

---

### Task B3b: the reversible adapters, without which undo is a lie

**Files:**
- Create: `src/application/editor/asset/ReversibleAssetDesignCommands.ts`
- Test: `tests/application/editor/reversibleAssetDesign.test.ts`

**Interfaces:**
- Consumes: A5–A7's commands, B6's `CalibrateAsset`, B7's `SetAssetBackground`, the
  `AssetGeometrySidecar` port, the `EventBus`, and **two** `WriteLedger`s — `noteLedger` and
  `geometryLedger` (see the rule below).
- Produces: one reversible adapter per design command, each satisfying `UndoableCommand`
  **structurally** — the interface lives in `presentation/` and the layer ban holds, exactly as
  slice 8's zone adapters do.

**Why this task exists:** B3a wires `CommandHistory` and the toolbar advertises undo and redo, and
until this task nothing gives those buttons anything to reverse. Every design command is a
read-merge-write against one document, so the inverse is the same write with the document as it
was — but "as it was" has to be **captured before the forward write**, and by the command itself,
because a later reader cannot reconstruct it.

- [ ] **Step 1: Write the failing tests**

```typescript
it('restores the exact document the forward write replaced', async () => {
	await seedShape({ footprint: rect(1200, 800), footprintOrigin: 'typed' });
	const before = await sidecar.read(assetId);
	const command = reversible.setFootprint({ assetId, points: triangle });
	await command.execute();
	await command.undo();
	const after = await sidecar.read(assetId);
	expect(isOk(before) && isOk(after) && after.value.document).toEqual(before.value.document);
});

it('restores a calibration undo including every coordinate it rescaled', async () => {
	await seedShape({ footprint: rect(100, 60), footprintOrigin: 'traced', footprintPending: true });
	const command = reversible.calibrate({ assetId, pointA: a, pointB: b, knownDistance: 200 });
	await command.execute();
	await command.undo();
	const after = await sidecar.read(assetId);
	expect(isOk(after) && after.value.document.shape?.footprint.points[2]).toEqual({ x: 100, y: 60 });
	expect(isOk(after) && after.value.document.shape?.footprintPending).toBe(true);
});

it('records every write into the ledger, restores included, so the next expectation is the history\'s', async () => {
	const command = reversible.setAnchor({ assetId, anchor: { x: 5, y: 5 } });
	await command.execute();
	const afterWrite = ledger.expectationFor(assetId);
	await command.undo();
	expect(ledger.expectationFor(assetId)).not.toEqual(afterWrite);
});

it('reports no-write on an undo that had nothing to reverse', async () => {
	const command = reversible.setAnchor({ assetId, anchor: unchangedAnchor });
	await command.execute();
	expect(await command.undo()).toEqual(ok('no-write'));
});

it('undoes a height change through the note, not the sidecar', async () => { /* height is frontmatter */ });
```

The third case is slice 8's rule applied here: **every write records into the `WriteLedger`,
restores included**, or the next command's expectation is a revision the vault no longer has.

**Two ledgers, because an asset is two resources.** `SessionWriteLedger` holds one
`EntityVersion` per `EntityId` (`WriteLedger.ts:53`), and this increment writes an asset's **note**
(height, background) and its **sidecar** (everything geometric) under the same `assetId`. One
ledger therefore has them overwrite each other: undo a height edit, and the note's version is what
the ledger holds; undo the geometry edit beneath it, and that note version is presented to the
sidecar, refused as stale, and the undo stack is stuck with no way forward. The designer's runtime
holds `noteLedger` and `geometryLedger`, and each adapter records into the one its own write went
to. Add the case:

```typescript
it('undoes a geometry edit beneath a height edit, rather than presenting the note version to the sidecar', async () => {
	await history.run(reversible.setFootprint({ assetId, points: triangle }));
	await history.run(reversible.setHeight({ assetId, height: 900 }));
	expect(isOk(await history.undo())).toBe(true);   // the height
	expect(isOk(await history.undo())).toBe(true);   // the geometry — this is the one that used to fail
});
```

**Two adapters are not note-only, and one of them looks like it is.** `SetAssetHeight` writes the
note alone. `SetAssetBackground` writes the note **and clears the sidecar's calibration** (Decision
5), so its inverse must restore **both** — a snapshot rule that captures only the asset's background
field restores the old document reference over an erased calibration, which is not the pre-command
design and is exactly what the undo advertises. Its case seeds a **calibrated** asset:

```typescript
it('restores the calibration a background change cleared, not only the reference', async () => {
	await seedCalibration();
	const command = reversible.setBackground({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	await command.execute();
	await command.undo();
	const after = await sidecar.read(assetId);
	expect(isOk(after) && after.value.document.calibration).not.toBeNull();
});
```

**Every successful restore publishes `AssetDesignChanged` too.** The initiating leaf refreshes
through its own dispatcher, so an undo that publishes nothing leaves a peer leaf sitting on the
forward state until something unrelated wakes it — the same staleness Task B3a closed for the
forward path, re-entering through the inverse. Cover it across leaves for a note change and a
geometry change alike.

- [ ] **Step 2: Implement**

Each adapter captures the pre-state (the sidecar snapshot, or the asset's own field for height and
background), runs the forward command, and returns an inverse built from **what it actually found**
rather than from what it assumed. Conditioning on `expected` applies to the undo write too — an
undo that overwrites somebody else's later edit is the lost update this plan already closed once.

- [ ] **Step 3: Gate and commit**

```bash
npm run check
git add src/application/editor tests/application/editor
git commit -m "Reversible adapters for every asset design command"
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
	await seedShape({ footprint: rect(100, 60), footprintOrigin: 'traced', footprintPending: true, clearancePending: true, anchorPending: true, anchor: { x: 10, y: 10 }, clearance: rect(120, 80) });
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

it('converts a pending clearance and leaves a typed footprint alone, with no rule naming the footprint', async () => {
	await seedShape({ footprint: rect(1200, 800), footprintOrigin: 'typed', footprintPending: false, clearance: rect(1400, 1000), clearancePending: true });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	// The typed rectangle is untouched; the traced clearance is doubled.
	expect(shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });
	expect(shape?.clearance?.points[2]).toEqual({ x: 1400, y: 1000 });
});

it('clears each flag it converts, and only those', async () => {
	await seedShape({ footprint: rect(100, 60), footprintOrigin: 'traced', footprintPending: true, clearance: rect(120, 80), clearancePending: false });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	expect(shape?.footprintPending).toBe(false);
	expect(shape?.clearance?.points[2]).toEqual({ x: 120, y: 80 });   // not pending, so not converted
});

it('converts a NEW trace on a replaced background without re-multiplying the measured geometry', async () => {
	// The case one shape-level flag could not express: a measured asset, its background replaced
	// (Decision 5), a fresh clearance traced on the new document before it is calibrated.
	await seedShape({
		footprint: rect(1200, 800), footprintOrigin: 'traced', footprintPending: false,
		anchor: { x: 10, y: 10 }, anchorPending: false,
		clearance: rect(100, 60), clearancePending: true,
	});
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	expect(shape?.clearance?.points[2]).toEqual({ x: 100, y: 60 });   // doubled from 50 x 30
	expect(shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });   // untouched
	expect(shape?.anchor).toEqual({ x: 10, y: 10 });                  // untouched
});

it('rescales nothing on a second calibration, because those coordinates are already millimetres', async () => {
	// trace -> calibrate -> replace the background (Decision 5) -> calibrate the new document.
	await seedShape({ footprint: rect(100, 60), footprintOrigin: 'traced', footprintPending: false, clearance: rect(120, 80), clearancePending: false });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	const shape = isOk(stored) ? stored.value.document.shape : null;
	// footprintOrigin is still 'traced' and always will be. The pending flags are what say these
	// coordinates were already converted; gating on provenance alone doubles a measured oven.
	expect(shape?.footprint.points[2]).toEqual({ x: 50, y: 30 });
	expect(shape?.clearance?.points[2]).toEqual({ x: 60, y: 40 });
	// The calibration itself is still recorded — the command did its job, it just rescaled nothing.
	expect(isOk(stored) && stored.value.document.calibration).not.toBeNull();
});

it('rescales its own calibration pair even when no geometry awaits a scale', async () => {
	// The ordinary first calibration: a background, nothing traced on it yet.
	await seedShape({ footprint: rect(1200, 800), footprintOrigin: 'typed', footprintPending: false });
	await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 });
	const stored = await sidecar.read(assetId);
	const c = isOk(stored) ? stored.value.document.calibration : null;
	// The at-rest invariant is definitional and gated on nothing.
	expect(c && distance(c.pointA, c.pointB)).toBeCloseTo(200, 6);
	// ...while the typed footprint it sits beside is still untouched.
	expect(isOk(stored) && stored.value.document.shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });
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

Derive, then rescale in two steps, because they are gated differently.

**Always** apply `scaleCorrection` to the calibration's **own pair**, gated on nothing. The at-rest
invariant asserted below is definitional, and every pending flag is clear on the ordinary first
calibration — a background calibrated before any geometry is drawn — so gating the pair stores the
picked points unconverted: a 100-unit pair claiming a known distance of 200.

**Then rescale each coordinate group whose own flag is set, independently** — `footprintPending`,
`clearancePending`, `anchorPending` — clearing each flag as it converts that group. Write the whole
document once. A group whose flag is clear is already in millimetres and is left alone; when none is
set, only the new calibration is recorded.

**There is no conjunction, and that is the owner's ruling on the one question this plan left open.**
Three earlier gates each failed at a different point, and the tests above are their regressions:

- **Provenance alone** (`footprintOrigin === 'traced'`) rescales a trace an earlier calibration
  already converted — the replace-the-background path of Decision 5 — multiplying millimetres by a
  correction that answers a question about pixels. `footprintOrigin` stays `'traced'` for the life
  of the outline, so it cannot answer a question about what has already happened to the coordinates.
- **A shape-level `pendingScale` alone** rescales a *typed* footprint whenever any later trace is
  awaiting a scale.
- **The two conjoined** patched the footprint out of that and left the anchor and the clearance
  still sharing one flag — so tracing a new clearance on a replaced background either re-multiplied
  the measured footprint and anchor or never converted the new clearance at all. The same defect one
  level down.

**One flag per thing that can be captured on its own** removes the question rather than answering
it: a typed footprint is never pending, so nothing has to name it, and `footprintOrigin` reverts to
pure provenance for the inspector and the retype rule. **The accepted cost is unchanged:** correcting
a calibration no longer retroactively repairs an earlier trace, so the user re-traces.

**This is the one place slice 7's plan rule may not be copied**, and it is worth reading
`ReversibleCalibratePlan` with that in mind rather than transcribing it. That command rescales
*every* coordinate the plan owns, which is right there because every one of them was drawn on the
background at the placeholder scale of 1. An asset has a coordinate source a plan never had: a
typed 1200 × 800 is authored in true millimetres and was never in the background's space, so
rescaling it turns an exact oven into an arbitrary one — silently, since the result still looks
like a plausible oven.

**Mirror the finite-result guard, which is the part of `ReversibleCalibratePlan` that must be
copied.** `ReversibleCalibratePlan.ts:167` carries it with its reason: a finite ratio does not mean
a finite product — a legal-looking input (a measured ~1e-302 over a known 3200) yields a finite
correction whose rescaled coordinates overflow to `Infinity`, which `JSON.stringify` then writes as
`null`, leaving a sidecar that fails every later read. Check every rescaled coordinate before
writing and refuse the calibration instead:

```typescript
it('refuses a calibration whose rescaled coordinates would overflow, rather than writing nulls', async () => {
	// `footprintPending` is load-bearing here: without it the per-coordinate gate leaves the
	// footprint alone, only the calibration pair rescales, the command SUCCEEDS, and this case
	// passes against a build with no finite guard at all.
	await seedShape({ footprint: rect(1e300, 1e300), footprintOrigin: 'traced', footprintPending: true });
	const result = await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 1e-302, y: 0 }, knownDistance: 3200 });
	expect(isErr(result)).toBe(true);
	const stored = await sidecar.read(assetId);
	expect(isOk(stored)).toBe(true);
});
```

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
- Modify: `src/domain/asset/Asset.ts` (the background reference field)
- Modify: `src/infrastructure/persistence/dto/assetFrontmatter.ts` (the three keys)
- Modify: `src/infrastructure/persistence/mappers/assetMapper.ts` (both directions)
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

- [ ] **Step 0: Add the three keys to the owned-field path first**

`AssetFrontmatterSchemaV1` is a `z.object`, so it **strips unknown keys**, and `assetMapper.ts`
writes only modelled fields — the two are the repository's only owned-field read/write path. A
command that wrote `background-path` around them would not round-trip, and the next ordinary save of
that asset would silently delete it.

So this task carries the same three-file change A7 made for `height`: the field on `Asset`, the
schema keys, and both directions of the mapper. Follow `planFrontmatter.ts`, which already models
exactly these three (`background-path`, `background-kind`, `background-page`) — same names, same
nullable page — and use the existing `.nullable().catch(null)` pattern so no schema version bump is
owed. Add a repository round-trip case:

```typescript
it('round-trips a background reference through the repository, and an ordinary save keeps it', async () => {
	await setBackground.execute({ assetId, path: 'Specs/oven.pdf', kind: 'pdf', page: 2 });
	await assets.save(await loadAsset(assetId));       // an unrelated later save
	const reloaded = await assets.getById(assetId);
	expect(isOk(reloaded) && reloaded.value?.background).toEqual({ path: 'Specs/oven.pdf', kind: 'pdf', page: 2 });
});
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
	await seedShape({ footprintOrigin: 'traced', footprintPending: false });
	await seedCalibration();
	await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
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

The command writes the note's three background keys **and** clears the sidecar's calibration
(Decision 5). Those are two files, so both the ordering and the failure of the SECOND write matter:

- **Order**: clear the calibration first, then write the reference. A failure between them leaves a
  surface that says it is uncalibrated — true and recoverable — where the reverse order leaves a new
  picture measured by the old document's scale.
- **Compensate**: if the note write then fails, **restore the calibration that was just cleared**,
  from the snapshot taken before clearing it. Without that, a failed background change leaves the
  user on their old background with its perfectly valid calibration destroyed, for a change that
  did not happen. The first version of this step had only the ordering and its test injected a
  failure into the first write alone, so it could not see this at all.
- **A failed compensation is reported, not swallowed**: stamp the returned refusal with
  `markUncompensated` so the save-state indicator does not settle at `Saved` over a vault whose
  calibration is gone — the rule slice 13 arrived at after four measurements of `affectsSaveState`.

```typescript
it('restores the calibration when the note write fails, so a failed change changes nothing', async () => {
	await seedCalibration();
	noteWriteFails();
	const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	expect(isErr(result)).toBe(true);
	const stored = await sidecar.read(assetId);
	expect(isOk(stored) && stored.value.document.calibration).not.toBeNull();
});

it('reports an uncompensated failure rather than letting the indicator settle at Saved', async () => {
	await seedCalibration();
	noteWriteFails();
	sidecarWriteFails();          // the compensation cannot land either
	const result = await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null });
	expect(isErr(result) && leftWritesBehind(result.error)).toBe(true);
});
```


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

- [ ] **Step 1a: Build the dimensions editor the empty state promises**

`assetDesigner.noShape`'s action opens a **dimensions form for the asset already open**, and
nothing in this plan built one until this step: `NewAssetForm` creates a *different* asset, and this
inspector renders width and depth read-only. So an existing asset with no geometry — including one
deliberately created with the dimension fields left blank — had no way to type the rectangle the
epic's "usable before it is accurate" ladder promises.

Add one dialog kind, `'asset-dimensions'`, resolving `{ width: number; depth: number } | null`, with
**two** callers: the empty state's action, and an "Edit dimensions" control in this inspector beside
the read-only pair. Both dispatch `SetAssetFootprintFromDimensions` for the open asset.

```typescript
it('opens the dimensions dialog from the empty state and writes the rectangle to the OPEN asset', async () => {
	dialog.openDialog.mockResolvedValue({ width: 1200, depth: 800 });
	await mountDesigner({ design: withoutShape }).find('.rp-empty-state__action').trigger('click');
	expect(setFootprintFromDimensions).toHaveBeenCalledWith(expect.objectContaining({ assetId: openAssetId, width: 1200, depth: 800 }));
	expect(createAsset).not.toHaveBeenCalled();
});

it('offers the same editor from the inspector once a shape exists', async () => {
	await mountInspector({ dimensions: { width: 1200, depth: 800 } }).find('.rp-designer-edit-dimensions').trigger('click');
	expect(dialog.openDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'asset-dimensions' }));
});

it('retypes a TRACED footprint as typed, since the numbers are now authored rather than measured', async () => {
	dialog.openDialog.mockResolvedValue({ width: 1200, depth: 800 });
	await editDimensionsOn({ footprintOrigin: 'traced' });
	const stored = await sidecar.read(openAssetId);
	expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('typed');
	expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
});
```

That third case is the one worth thinking about rather than copying: typing dimensions over a trace
replaces measured coordinates with authored ones, so the provenance must follow, or a later
calibration would rescale a rectangle nobody measured (Decision 6).

- [ ] **Step 2: Implement, gate, commit**

```bash
npm run check
git add src/presentation/designer src/presentation/dialogs tests/presentation/designer
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

- [ ] **Step 1a: Make the create dialog open what it created**

The design promises that the new-asset dialog opens the designer on what it created, and A10 built
the dialog against a designer that did not exist yet — it returns an `assetId` nobody consumes. Wire
the `create-asset` callback to reveal that asset now, through the same door the picker uses:

```typescript
it('opens the designer on the asset the dialog created, in exactly one leaf', async () => {
	dialog.openDialog.mockResolvedValue({ assetId: 'asset-01JABC' });
	await runCreateAssetCommand();
	expect(workspace.createdLeaves).toHaveLength(1);
	expect(workspace.createdLeaves[0].state).toEqual({ assetId: 'asset-01JABC' });
});

it('opens nothing when the dialog is cancelled', async () => {
	dialog.openDialog.mockResolvedValue(null);
	await runCreateAssetCommand();
	expect(workspace.createdLeaves).toHaveLength(0);
});
```

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
