# Asset designer symbols, PR 1 (curves, details, presets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An asset's shape may carry curved outlines and interior detail linework, and a renovator can start a design from one of 14 presets (tables, seating, sanitary, plants and beds), drawn in the designer, on plans and in the library.

**Architecture:** `AssetShape.footprint`/`clearance` widen to `CurvedPolygon` and gain `details: AssetDetail[]`; the `.rpgeo` sidecar moves to schema version 2 (v1 raised in memory on read). Presets are pure domain generators that answer a validated `AssetShape`; one new `SetAssetShape` command writes it through the existing reversible geometry edit. Rendering flattens arcs with `polygonPolyline` everywhere a surface wants points.

**Tech Stack:** TypeScript, Vue 3 SFCs, Konva via vue-konva, zod 4, vitest 4 (jsdom per file), Obsidian plugin API.

**Spec:** [`docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`](../specs/2026-09-13-asset-designer-symbols-design.md) — spec steps 1 and 2 (Decisions 1–8, Rendering, the preset half of Presentation). Steps 3a/3b get their own plans.

## Global Constraints

- **Layers:** `presentation → application → domain → core`; `infrastructure → application ports → domain → core`. No `vue`, `pinia`, `konva` or `obsidian` in `core/`, `domain/`, `application/`. `presentation/dialogs/` may not import application, infrastructure, plugin or `core/events`.
- **Nothing writes to the vault outside `infrastructure/`.**
- **Budgets (ESLint, blank lines and comments not counted):** `src/**` ≤ 400 lines per file, ≤ 100 lines per function, complexity ≤ 16, max-params 5; `tests/**` ≤ 450 lines per file. `src/presentation/i18n/locales/en.ts` is at 399/400 and `de.ts` at 398/400 — **add no keys there**; new keys go in `locales/en/assetSymbols.ts` / `locales/de/assetSymbols.ts`, spread through `locales/en/editor.ts` / `locales/de/editor.ts`.
- **Every user-visible string in `en` AND `de`.** English UI text is sentence case (lint-enforced). German avoids du-form imperatives.
- **No hard-coded colours in CSS** — Obsidian CSS variables only. Styles live in `styles/*.css`, never in a `.vue` `<style>` block.
- **No new dependencies.**
- **Preset conventions (spec Decision 8):** centred on the origin; width along x, depth/length along y (bathtub and oval table: length along x); front toward +y, `facing = Math.PI / 2`; typed footprint, never pending. Vertex order for every generated outline is top-left → top-right → bottom-right → bottom-left (clockwise on screen); with that winding a **positive bulge bows outward**.
- **`src/application/commands/asset/SetAssetShape.ts` must not contain the word "undo"** anywhere (comments included) — `tests/application/events/reversibleWritePathDiscovery.test.ts` would then demand a census entry for it.
- **Inner loop per task:** `npm run check:fast -- <test paths>` (oxlint + `vue-tsc -noEmit` + vitest on the paths). It omits ESLint, so before each commit also run `npx eslint <every src/test file you touched>`. Do **not** run the full `npm run check` locally — CI runs it on the PR. If a vitest case times out under machine load, re-run with `-- <paths> --testTimeout=20000` before believing it.
- **If `node_modules` in the worktree is empty, run `npm ci` first.**
- **Commits** end with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` (this overrides any model name you would otherwise write).

---

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `src/domain/asset/AssetDetail.ts` (new) | `AssetDetail`, `DetailLine`, `validateDetails` | 1 |
| `src/domain/asset/AssetShape.ts` | curved footprint/clearance, `details`, validation | 1 |
| `src/presentation/i18n/locales/{en,de}/assetSymbols.ts` (new) | every new string of this PR | 1, 7, 10 |
| `src/infrastructure/persistence/dto/assetGeometry.ts` | schema v2 + `AssetGeometrySchema` (reads v1 and v2) | 2 |
| `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` | parse with `AssetGeometrySchema`, write v2 | 2 |
| `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts` | bulges and details across the storage boundary | 2 |
| `src/application/commands/asset/CalibrateAsset.ts` | rescale pending details | 3 |
| `src/domain/spatial/assetPlacement.ts` | flattened curves + placed details | 4 |
| `src/presentation/editor/elements/{assetShapeConfig.ts,AssetShapes.vue}` | plan draws details | 4 |
| `src/presentation/designer/layers/{footprintLayer,clearanceLayer,detailsLayer,backgroundLayer}.ts`, `DesignerCanvas.vue` | designer draws curves + details | 5 |
| `src/application/queries/ListAssetOutlines.ts`, `src/presentation/library/AssetInspectorShape.vue` | library mark reads flattened curves | 6 |
| `src/domain/asset/presets/{presetGeometry,tables,seating,sanitary,plantsBeds,catalogue}.ts` (new) | preset generators | 7, 8 |
| `src/application/commands/asset/SetAssetShape.ts` (new) + wiring | whole-shape write | 9 |
| `src/presentation/designer/presets/{AssetPresetForm.vue,presetPreview.ts}` (new), `AssetDesignerRoot.vue`, `inspector/DesignerInspector.vue`, `styles/designer.css` | the preset dialog | 10 |
| `tests/harness/{assetDesigner,page}.ts`, `scripts/harness-shot.mjs`, `docs/tests/cases/Design an Asset.md`, `docs/requirements/Start an asset from a preset.md` (new) | captures, manual steps, backlog | 11 |

---

### Task 1: Domain — details and curved outlines on `AssetShape`

**Files:**
- Create: `src/domain/asset/AssetDetail.ts`
- Modify: `src/domain/asset/AssetShape.ts`
- Modify: `src/application/commands/asset/SetAssetFootprint.ts` (`InheritedShape`, `UNDESIGNED`)
- Modify: `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts` (`shapeFromPersistence` gets `details: []` — Task 2 replaces it)
- Create: `src/presentation/i18n/locales/en/assetSymbols.ts`, `src/presentation/i18n/locales/de/assetSymbols.ts`
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`
- Modify (add `details: []` to each `AssetShape` literal the compiler reports): `tests/application/commands/asset/setAssetFootprint.test.ts`, `setAssetBackground.test.ts`, `setAssetAttributes.test.ts`, `calibrateAsset.test.ts`; `tests/application/queries/listAssetOutlines.test.ts`, `getAssetDesign.test.ts`; `tests/domain/spatial/assetPlacement.test.ts`; `tests/harness/assetLibrary.ts`; `tests/domain/asset/assetShape.test.ts`; `tests/plugin/assetGeometryWiring.test.ts`; `tests/presentation/designer/designerCalibration.test.ts`, `assetDimensions.test.ts`, `designerInspector.test.ts`, `designerTools.test.ts`; `tests/helpers/assetDesignHarness.ts`, `tests/helpers/assetDesign.ts`; `tests/infrastructure/persistence/dto/assetGeometry.test.ts`; `tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts`
- Modify: `tests/presentation/i18n/toUserMessage.test.ts` (`MINTED` rows)
- Test: `tests/domain/asset/assetDetail.test.ts` (new)

**Interfaces:**
- Produces:
  - `export type DetailLine = 'solid' | 'dashed'`
  - `export interface AssetDetail { readonly id: string; readonly name: string; readonly outline: CurvedPolygon; readonly line: DetailLine; readonly pending: boolean }`
  - `export function validateDetails(details: readonly AssetDetail[]): Result<AssetDetail[], ValidationError>`
  - `AssetShape` gains `readonly details: readonly AssetDetail[]`; `footprint: CurvedPolygon`; `clearance: CurvedPolygon | null`
  - `dimensionsOf(footprint: CurvedPolygon)`
  - error codes `asset.invalid-detail`, `asset.degenerate-detail`, `asset.invalid-detail-id`
  - `export const assetSymbolsEn = { … } as const` and `export const assetSymbolsDe: Record<keyof typeof assetSymbolsEn, string>`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/asset/assetDetail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import type { AssetDetail } from '../../../src/domain/asset/AssetDetail';
import { dimensionsOf, shapeFromDimensions, validateAssetShape, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Spec 2026-09-13 Decisions 1–4: details are curved outlines, validated like a footprint, and the
 * footprint itself may curve. The bow-tie case is the v1 compatibility lock — a straight outline
 * gets exactly the validation it got before curves existed.
 */
const QUARTER = Math.tan(Math.PI / 8);
const circle = (radius: number): CurvedPolygon => ({
	points: [{ x: 0, y: -radius }, { x: radius, y: 0 }, { x: 0, y: radius }, { x: -radius, y: 0 }],
	bulges: [QUARTER, QUARTER, QUARTER, QUARTER],
});
const square = (half: number): CurvedPolygon => ({
	points: [{ x: -half, y: -half }, { x: half, y: -half }, { x: half, y: half }, { x: -half, y: half }],
});
const detail = (id: string, outline: CurvedPolygon, line: AssetDetail['line'] = 'solid'): AssetDetail => ({
	id, name: id, outline, line, pending: false,
});
const base = (): AssetShape => expectOk(shapeFromDimensions(1200, 800));

describe('asset details', () => {
	it('accepts a solid and a dashed detail and hands back copies, not the caller’s objects', () => {
		const input = { ...base(), details: [detail('top', circle(300)), detail('overhead', square(100), 'dashed')] };
		const shape = expectOk(validateAssetShape(input));
		(input.details[0].outline.points as { x: number; y: number }[])[0] = { x: 999, y: 999 };
		expect(shape.details.map((d) => [d.id, d.line])).toEqual([['top', 'solid'], ['overhead', 'dashed']]);
		expect(shape.details[0].outline.points[0]).toEqual({ x: 0, y: -300 });
	});

	it('refuses a repeated or empty detail id', () => {
		const repeated = { ...base(), details: [detail('a', square(10)), detail('a', square(20))] };
		expect(expectErr(validateAssetShape(repeated)).code).toBe('asset.invalid-detail-id');
		expect(expectErr(validateAssetShape({ ...base(), details: [detail('', square(10))] })).code).toBe('asset.invalid-detail-id');
	});

	it('refuses a detail that is not a polygon, and one that encloses no area', () => {
		const twoPoints = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
		const collinear = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }] };
		expect(expectErr(validateAssetShape({ ...base(), details: [detail('a', twoPoints)] })).code).toBe('asset.invalid-detail');
		expect(expectErr(validateAssetShape({ ...base(), details: [detail('a', collinear)] })).code).toBe('asset.degenerate-detail');
	});
});

describe('a curved footprint', () => {
	it('is a valid footprint whose dimensions are its diameter', () => {
		const shape = expectOk(validateAssetShape({ ...base(), footprint: circle(450) }));
		const { width, depth } = expectOk(dimensionsOf(shape.footprint));
		expect(width).toBeCloseTo(900, 9);
		expect(depth).toBeCloseTo(900, 9);
	});

	it('refuses a bulge beyond a semicircle under the footprint’s own code', () => {
		const tooRound = { ...square(100), bulges: [1.5, 0, 0, 0] };
		expect(expectErr(validateAssetShape({ ...base(), footprint: tooRound })).code).toBe('asset.invalid-footprint');
	});

	it('still accepts a straight self-crossing outline, and refuses it once an edge curves', () => {
		const bowTie = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 50, y: 100 }];
		expect(validateAssetShape({ ...base(), footprint: { points: bowTie } }).ok).toBe(true);
		const curved = { points: bowTie, bulges: [0.2, 0, 0, 0] };
		expect(expectErr(validateAssetShape({ ...base(), footprint: curved })).code).toBe('asset.invalid-footprint');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/asset/assetDetail.test.ts`
Expected: FAIL — the detail cases do not refuse (details are ignored) and the "hands back copies" case reads `undefined` from `shape.details`.

- [ ] **Step 3: Create `src/domain/asset/AssetDetail.ts`**

```ts
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { createCurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { enclosesArea } from '../../core/geometry/operations';
import type { ValidationError } from '../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../core/result/Result';
import { assetError } from './Asset.errors';

export type DetailLine = 'solid' | 'dashed';

/**
 * Interior linework of an asset's plan symbol (asset designer symbols spec, Decision 1): a closed
 * curved outline. Details draw in ARRAY ORDER; a `solid` one is filled with the canvas colour and
 * covers what is beneath it, a `dashed` one is not filled (Decision 4 — dashed means overhead or
 * hidden). `name` is a stable key such as `seat` or `bowl`, not display text.
 *
 * `pending` is this detail's own awaiting-a-scale flag (Decision 5): set when it was captured over
 * an uncalibrated background, cleared by the calibration that converts it.
 */
export interface AssetDetail {
	readonly id: string;
	readonly name: string;
	readonly outline: CurvedPolygon;
	readonly line: DetailLine;
	readonly pending: boolean;
}

/**
 * Every detail a valid curved polygon enclosing an area, every id present and unique. Answers
 * COPIES, for the reason `validateAssetShape` gives: a mutation after validation must not reach
 * what was validated.
 */
export function validateDetails(details: readonly AssetDetail[]): Result<AssetDetail[], ValidationError> {
	const seen = new Set<string>();
	const validated: AssetDetail[] = [];
	for (const detail of details) {
		if (detail.id === '' || seen.has(detail.id)) {
			return err(assetError('invalid-detail-id', `Every detail needs its own non-empty id; got "${detail.id}".`));
		}
		seen.add(detail.id);
		const outline = createCurvedPolygon(detail.outline);
		if (isErr(outline)) return err(assetError('invalid-detail', outline.error.message));
		if (!enclosesArea(outline.value)) {
			return err(assetError('degenerate-detail', 'A detail must enclose an area.'));
		}
		validated.push({ id: detail.id, name: detail.name, outline: outline.value, line: detail.line, pending: detail.pending });
	}
	return ok(validated);
}
```

- [ ] **Step 4: Modify `src/domain/asset/AssetShape.ts`**

Imports — add:

```ts
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { createCurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { validateDetails, type AssetDetail } from './AssetDetail';
```

In `interface AssetShape`: change `readonly footprint: Polygon;` to `readonly footprint: CurvedPolygon;`, change `readonly clearance: Polygon | null;` to `readonly clearance: CurvedPolygon | null;`, and add after `facing`:

```ts
	/** Interior linework, drawn in this order over the footprint (symbols spec, Decisions 1 and 4). */
	readonly details: readonly AssetDetail[];
```

Change `dimensionsOf(footprint: Polygon)` to `dimensionsOf(footprint: CurvedPolygon)`.

In `validateAssetShape`:
- replace `const footprint = createPolygon(shape.footprint.points);` with `const footprint = createCurvedPolygon(shape.footprint);`
- replace `let clearance: Polygon | null = null;` with `let clearance: CurvedPolygon | null = null;`
- replace `const validated = createPolygon(shape.clearance.points);` with `const validated = createCurvedPolygon(shape.clearance);`
- immediately before the final `return ok({`, add:

```ts
	const details = validateDetails(shape.details);
	if (isErr(details)) return details;
```

- in the returned object add `details: details.value,` after `clearance,`.

Add a sentence to `validateAssetShape`'s docblock: `Curved edges are checked for self-intersection only when an edge actually curves (`validateCurvedBoundary`), so a straight outline gets exactly the validation it had before curves existed.`

In `shapeFromDimensions`, add `details: [],` after `facing: 0,`.

- [ ] **Step 5: Keep retracing from dropping details — `src/application/commands/asset/SetAssetFootprint.ts`**

Change the `InheritedShape` pick to include `'details'`:

```ts
type InheritedShape = Pick<
	AssetShape,
	'clearance' | 'clearancePending' | 'anchorPending' | 'anchor' | 'facing' | 'details'
>;
```

and add `details: [],` to `UNDESIGNED`.

- [ ] **Step 6: Placeholder in the sidecar adapter**

In `ObsidianAssetGeometrySidecar.ts`'s `shapeFromPersistence`, add `details: [],` after `facing: stored.facing,` (Task 2 replaces it with the stored details).

- [ ] **Step 7: Add `details: []` wherever the compiler asks**

Run: `npx vue-tsc -noEmit -p tsconfig.json`
Expected: errors of the form `Property 'details' is missing in type …` in the test files listed under **Files**. In each reported object literal that builds an `AssetShape`, add `details: [],` after its `facing` field. Re-run until clean.

- [ ] **Step 8: Strings — create the locale module**

`src/presentation/i18n/locales/en/assetSymbols.ts`:

```ts
/** Asset designer symbols (spec 2026-09-13): details, presets and the preset dialog. */
export const assetSymbolsEn = {
	'asset.invalid-detail': 'That detail is not a shape this plugin can store.',
	'asset.degenerate-detail': 'That detail encloses no area.',
	'asset.invalid-detail-id': 'Every detail needs its own id.',
} as const;
```

`src/presentation/i18n/locales/de/assetSymbols.ts`:

```ts
import type { assetSymbolsEn } from '../en/assetSymbols';

export const assetSymbolsDe: Record<keyof typeof assetSymbolsEn, string> = {
	'asset.invalid-detail': 'Dieses Detail ist keine Form, die gespeichert werden kann.',
	'asset.degenerate-detail': 'Dieses Detail umschließt keine Fläche.',
	'asset.invalid-detail-id': 'Jedes Detail braucht eine eigene Kennung.',
};
```

In `locales/en/editor.ts` add `import { assetSymbolsEn } from './assetSymbols';` beside `import { curvesEn } from './curves';` and `...assetSymbolsEn,` beside `...curvesEn,`. In `locales/de/editor.ts` add `import { assetSymbolsDe } from './assetSymbols';` and `...assetSymbolsDe,` the same way.

- [ ] **Step 9: `MINTED` rows**

In `tests/presentation/i18n/toUserMessage.test.ts`, after the `asset.absent-clearance-cannot-be-pending` row, add:

```ts
	// The symbols spec's detail validation (2026-09-13).
	['asset.invalid-detail', 'Validation', 'error.category.validation', 'domain/asset/AssetDetail.ts'],
	['asset.degenerate-detail', 'Validation', 'error.category.validation', 'domain/asset/AssetDetail.ts'],
	['asset.invalid-detail-id', 'Validation', 'error.category.validation', 'domain/asset/AssetDetail.ts'],
```

- [ ] **Step 10: Run the tests**

Run: `npm run check:fast -- tests/domain/asset tests/presentation/i18n tests/application/commands/asset tests/infrastructure/persistence/dto tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/domain/asset src/application/commands/asset/SetAssetFootprint.ts src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts src/presentation/i18n/locales tests
git commit -m "feat(asset): details and curved outlines on AssetShape

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Storage — sidecar schema version 2

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts` (export `BulgeSchema`, `oneBulgePerEdge`, `BULGE_MESSAGE`)
- Modify: `src/infrastructure/persistence/dto/assetGeometry.ts`
- Modify: `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar.ts`
- Modify: `tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts` (the newer-build case)
- Modify: `tests/infrastructure/persistence/dto/assetGeometry.test.ts`
- Test: `tests/infrastructure/obsidian/repositories/assetGeometrySidecarDetails.test.ts` (new)

**Interfaces:**
- Consumes: `AssetDetail`, `AssetShape.details` (Task 1)
- Produces: `export const AssetShapeSchemaV2`, `export const AssetGeometrySchema` (reads v1 and v2, outputs v2), `AssetGeometryDTO = z.infer<typeof AssetGeometrySchemaV2>` (with `schemaVersion: 2`, `shape.details`, optional `bulges`)

- [ ] **Step 1: Write the failing tests**

Create `tests/infrastructure/obsidian/repositories/assetGeometrySidecarDetails.test.ts`:

```ts
/**
 * Schema version 2 (symbols spec, Decision 6): bulges and details cross the storage boundary, a v1
 * file still reads, and every write is v2 — which is what makes a v1-only build refuse the file
 * rather than silently dropping its details on its next write.
 */
import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { shapeFromDimensions, type AssetShape } from '../../../../src/domain/asset/AssetShape';

const seeded = () => {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	return {
		stack,
		assetId,
		path: assetSidecarPathFor(stack.libraryFolder, assetId),
		sidecar: new ObsidianAssetGeometrySidecar(stack.assetGeometry),
	};
};

const RAW_SHAPE = {
	footprint: { points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] },
	footprintOrigin: 'typed',
	footprintPending: false,
	clearancePending: false,
	anchorPending: false,
	clearance: null,
	anchor: { x: 0, y: 0 },
	facing: 0,
};

const rawDocument = (assetId: string, overrides: Record<string, unknown> = {}): string =>
	JSON.stringify({ schemaVersion: 1, assetId, revision: 3, unit: 'mm', calibration: null, shape: RAW_SHAPE, ...overrides });

const QUARTER = Math.tan(Math.PI / 8);
const circle = (radius: number): CurvedPolygon => ({
	points: [{ x: 0, y: -radius }, { x: radius, y: 0 }, { x: 0, y: radius }, { x: -radius, y: 0 }],
	bulges: [QUARTER, QUARTER, QUARTER, QUARTER],
});
const square = (half: number): CurvedPolygon => ({
	points: [{ x: -half, y: -half }, { x: half, y: -half }, { x: half, y: half }, { x: -half, y: half }],
});
const symbol = (): AssetShape => ({
	...expectOk(shapeFromDimensions(900, 900)),
	footprint: circle(450),
	details: [
		{ id: 'detail-1', name: 'top', outline: circle(400), line: 'solid', pending: false },
		{ id: 'detail-2', name: 'overhead', outline: square(200), line: 'dashed', pending: true },
	],
});

describe('asset geometry sidecar, schema version 2', () => {
	it('round-trips a curved footprint and its details', async () => {
		const { sidecar, assetId } = seeded();
		const document: AssetGeometryDocument = { calibration: null, shape: symbol() };

		expectOk(await sidecar.write(assetId, document));

		expect(expectOk(await sidecar.read(assetId)).document).toEqual(document);
	});

	it('reads a version 1 file as a shape with no details, and writes version 2 back', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		stack.vault.entries.set(path, rawDocument(assetId));

		const read = expectOk(await sidecar.read(assetId));
		expect(read.document.shape?.details).toEqual([]);
		expectOk(await sidecar.write(assetId, read.document, read.version));

		expect(JSON.parse(stack.vault.entries.get(path) ?? '{}').schemaVersion).toBe(2);
	});

	it('writes a straight outline with no bulges key', async () => {
		const { sidecar, stack, assetId, path } = seeded();

		expectOk(await sidecar.write(assetId, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));

		const stored = JSON.parse(stack.vault.entries.get(path) ?? '{}');
		expect(stored.shape.footprint).toEqual({ points: [[-600, -400], [600, -400], [600, 400], [-600, 400]] });
		expect(stored.shape.details).toEqual([]);
	});

	it('refuses a version 2 outline whose bulge count does not match its edges', async () => {
		const { sidecar, stack, assetId, path } = seeded();
		const shape = { ...RAW_SHAPE, footprint: { ...RAW_SHAPE.footprint, bulges: [0.5] }, details: [] };
		stack.vault.entries.set(path, rawDocument(assetId, { schemaVersion: 2, shape }));

		expect(expectErr(await sidecar.read(assetId))).toMatchObject({ category: 'Validation', code: 'asset-geometry.schema-invalid' });
	});
});
```

In `tests/infrastructure/persistence/dto/assetGeometry.test.ts`: add `AssetGeometrySchema` to the import from `assetGeometry`, and append:

```ts
describe('AssetGeometrySchema, which reads every version this build knows', () => {
	it('raises a version 1 document to version 2 with no details', () => {
		const parsed = AssetGeometrySchema.parse(valid);
		expect(parsed.schemaVersion).toBe(2);
		expect(parsed.shape?.details).toEqual([]);
	});

	it('is refused by a version-1-only schema, so an older build cannot drop details on its next write', () => {
		const v2 = { ...valid, schemaVersion: 2, shape: { ...validShape, details: [] } };
		expect(AssetGeometrySchemaV1.safeParse(v2).success).toBe(false);
	});

	it('refuses a bulge beyond a semicircle', () => {
		const curved = { ...valid, schemaVersion: 2, shape: { ...validShape, footprint: { ...validShape.footprint, bulges: [1.5, 0, 0, 0] }, details: [] } };
		expect(AssetGeometrySchema.safeParse(curved).success).toBe(false);
	});

	it('refuses a version this build does not know', () => {
		expect(AssetGeometrySchema.safeParse({ ...valid, schemaVersion: 3 }).success).toBe(false);
	});
});
```

In `tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts`, in `it('refuses a sidecar written by a newer build, …')`, change `rawDocument(assetId, { schemaVersion: 2 })` to `rawDocument(assetId, { schemaVersion: 3 })`, and in that case's docblock change `` `schemaVersion: z.literal(1)` is what does the refusing `` to `` `AssetGeometrySchema`, which knows versions 1 and 2, is what does the refusing ``.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/assetGeometrySidecarDetails.test.ts tests/infrastructure/persistence/dto/assetGeometry.test.ts`
Expected: FAIL — `AssetGeometrySchema` is not exported; details do not round-trip.

- [ ] **Step 3: Export the bulge rule from `planGeometry.ts`**

Change these three declarations to exports (same bodies):

```ts
export const BulgeSchema = z.number().min(-1).max(1);
export const oneBulgePerEdge = (value: { readonly points: readonly unknown[]; readonly bulges?: readonly number[] }) => value.bulges === undefined || value.bulges.length === value.points.length;
export const BULGE_MESSAGE = { message: 'A closed boundary needs one bulge per edge.' };
```

- [ ] **Step 4: Schema v2 in `assetGeometry.ts`**

Change the first import line to add `import { BULGE_MESSAGE, BulgeSchema, CalibrationSchemaV1, oneBulgePerEdge } from './planGeometry';` (replacing the `CalibrationSchemaV1` import). Replace the final `export type AssetGeometryDTO = z.infer<typeof AssetGeometrySchemaV1>;` block (keep its docblock) with:

```ts
/** One closed outline: the plan sidecar's V7 bulge rule, reused rather than re-declared. */
const OutlineSchemaV2 = z
	.object({ points: z.array(pointTuple).min(3), bulges: z.array(BulgeSchema).optional() })
	.refine(oneBulgePerEdge, BULGE_MESSAGE);

const DetailSchemaV2 = z.object({
	id: z.string().min(1),
	name: z.string(),
	outline: OutlineSchemaV2,
	line: z.enum(['solid', 'dashed']),
	pending: z.boolean().default(false),
});

/**
 * Version 2 (asset designer symbols spec, Decision 6): outlines may curve and a shape carries
 * `details`. The bump is REQUIRED: a Zod object strips unknown keys, so a v1-only build reading a
 * file with details would load it and erase them on its next write; `z.literal(1)` makes that
 * build refuse the file instead.
 */
export const AssetShapeSchemaV2 = AssetShapeSchemaV1.extend({
	footprint: OutlineSchemaV2,
	clearance: OutlineSchemaV2.nullable(),
	details: z.array(DetailSchemaV2).default([]),
});

const AssetGeometrySchemaV2 = AssetGeometrySchemaV1.extend({
	schemaVersion: z.literal(2),
	shape: AssetShapeSchemaV2.nullable(),
});

/** A v1 document is a valid v2 one once it says so: `details` defaults to `[]`, `bulges` is optional. */
function raiseVersion1(input: unknown): unknown {
	if (typeof input !== 'object' || input === null) return input;
	return (input as { schemaVersion?: unknown }).schemaVersion === 1 ? { ...input, schemaVersion: 2 } : input;
}

/** Every version this build reads, answered as version 2. The store parses with this and nothing else. */
export const AssetGeometrySchema = z.preprocess(raiseVersion1, AssetGeometrySchemaV2);

export type AssetGeometryDTO = z.infer<typeof AssetGeometrySchemaV2>;
```

- [ ] **Step 5: The store parses every known version and writes v2**

In `AssetGeometryStore.ts`:
- import: `import { AssetGeometrySchema } from '../../persistence/dto/assetGeometry';` (replacing `AssetGeometrySchemaV1`)
- `declaredAssetOf`: `const validated = AssetGeometrySchema.safeParse(parsed);`
- `readUnlocked`: `const validated = AssetGeometrySchema.safeParse(parsed);`
- `emptyDocument`: `schemaVersion: 2,`
- `write`: `schemaVersion: 2,`
- class docblock: replace `` by `schemaVersion: z.literal(1)` `` with `` by `AssetGeometrySchema`, which knows versions 1 and 2 ``.

- [ ] **Step 6: Bulges and details through the adapter — `ObsidianAssetGeometrySidecar.ts`**

Replace `type StoredPolygon`, `toPolygon`, and add a store-side twin:

```ts
type StoredOutline = StoredShape['footprint'];

const toOutline = (stored: StoredOutline): CurvedPolygon => ({
	points: stored.points.map(([x, y]) => ({ x, y })),
	...(stored.bulges === undefined ? {} : { bulges: [...stored.bulges] }),
});

/** A straight outline is written with no `bulges` key, so it stays what a v1 reader would have written. */
const toStoredOutline = (outline: CurvedPolygon): StoredOutline => ({
	points: toTuples(outline.points),
	...(outline.bulges === undefined ? {} : { bulges: [...outline.bulges] }),
});
```

Add `import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';`.

`shapeFromPersistence`: `footprint: toOutline(stored.footprint)`, `clearance: stored.clearance === null ? null : toOutline(stored.clearance)`, and replace the Task 1 placeholder with:

```ts
		details: stored.details.map((detail) => ({
			id: detail.id,
			name: detail.name,
			outline: toOutline(detail.outline),
			line: detail.line,
			pending: detail.pending,
		})),
```

`shapeToPersistence`: `footprint: toStoredOutline(shape.footprint)`, `clearance: shape.clearance === null ? null : toStoredOutline(shape.clearance)`, and after `facing: shape.facing,`:

```ts
	details: shape.details.map((detail) => ({
		id: detail.id,
		name: detail.name,
		outline: toStoredOutline(detail.outline),
		line: detail.line,
		pending: detail.pending,
	})),
```

- [ ] **Step 7: Run the tests**

Run: `npm run check:fast -- tests/infrastructure tests/application/commands/asset tests/plugin/assetGeometryWiring.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure tests/infrastructure
git commit -m "feat(asset-geometry): sidecar schema v2 carries bulges and details

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Calibration converts pending details

**Files:**
- Modify: `src/application/commands/asset/CalibrateAsset.ts` (`rescaled`, `documentFinite`)
- Test: `tests/application/commands/asset/calibrateAssetDetails.test.ts` (new)

**Interfaces:**
- Consumes: `AssetDetail.pending`, sidecar v2 (Tasks 1–2)

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Decision 5 of the symbols spec: a detail is its own coordinate group with its own pending flag,
 * rescaled by exactly the calibration that converts it and by no other.
 */
import { describe, expect, it } from 'vitest';
import { CalibrateAssetCommand } from '../../../../src/application/commands/asset/CalibrateAsset';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import type { Point } from '../../../../src/core/geometry/Point';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetDetail } from '../../../../src/domain/asset/AssetDetail';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { nonFiniteRescaleError } from '../../../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const DOUBLING = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 } as const;
const TRIANGLE: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

const detail = (id: string, pending: boolean, points: readonly Point[], bulges?: readonly number[]): AssetDetail => ({
	id, name: id, line: 'solid', pending, outline: bulges === undefined ? { points } : { points, bulges },
});

async function seeded(details: readonly AssetDetail[]) {
	const stack = createRepositoryStack();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const assetId = createAssetId();
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	expectOk(await sidecar.write(assetId, { calibration: null, shape: { ...expectOk(shapeFromDimensions(100, 60)), details } }));
	return {
		assetId,
		calibrate: new CalibrateAssetCommand({ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() }),
		async storedDetails(): Promise<readonly AssetDetail[]> {
			return expectOk(await sidecar.read(assetId)).document.shape?.details ?? [];
		},
	};
}

describe('what a calibration does to details', () => {
	it('rescales a pending detail, keeps its curves and clears its flag', async () => {
		const h = await seeded([detail('traced', true, TRIANGLE, [0.5, 0, 0])]);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		const [converted] = await h.storedDetails();
		expect(converted.outline.points).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }]);
		expect(converted.outline.bulges).toEqual([0.5, 0, 0]);
		expect(converted.pending).toBe(false);
	});

	it('leaves a measured detail exactly where it is', async () => {
		const h = await seeded([detail('measured', false, TRIANGLE)]);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		expect((await h.storedDetails())[0].outline.points).toEqual(TRIANGLE);
	});

	it('refuses a rescale whose product with a detail coordinate is not finite', async () => {
		const huge = [{ x: 1e308, y: 0 }, { x: 1.5e308, y: 0 }, { x: 1.5e308, y: 1 }];
		const h = await seeded([detail('huge', true, huge)]);

		expect(expectErr(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING })).code).toBe(nonFiniteRescaleError().code);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/commands/asset/calibrateAssetDetails.test.ts`
Expected: FAIL — the pending detail's points are unchanged and the huge case writes successfully. (If the huge case instead fails with an `asset.*` or `asset-geometry.*` code, the seed itself was refused on read — report that rather than changing the coordinates silently.)

- [ ] **Step 3: Implement**

In `rescaled`, after `anchorPending: false,` add:

```ts
		details: shape.details.map((detail) =>
			detail.pending
				? { ...detail, outline: scaleShape(detail.outline, correction, ORIGIN), pending: false }
				: detail,
		),
```

Extend `rescaled`'s docblock first paragraph with: `Each detail is a fourth group with its own flag (symbols spec, Decision 5).`

In `documentFinite`, extend the return:

```ts
	return (
		pointsFinite(shape.footprint.points)
		&& pointsFinite(shape.clearance?.points ?? [])
		&& pointsFinite([shape.anchor])
		&& shape.details.every((detail) => pointsFinite(detail.outline.points))
	);
```

- [ ] **Step 4: Run the tests**

Run: `npm run check:fast -- tests/application/commands/asset`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/commands/asset/CalibrateAsset.ts tests/application/commands/asset/calibrateAssetDetails.test.ts
git commit -m "feat(asset): calibration converts pending details

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Plans draw curved footprints and details

**Files:**
- Modify: `src/domain/spatial/assetPlacement.ts`
- Modify: `src/presentation/editor/elements/assetShapeConfig.ts`
- Modify: `src/presentation/editor/elements/AssetShapes.vue`
- Test: `tests/domain/spatial/assetPlacement.test.ts`, `tests/presentation/editor/elements/assetShapeConfig.test.ts`

**Interfaces:**
- Consumes: `AssetShape.details`, `DetailLine` (Task 1)
- Produces: `PlacedDetail { readonly points: readonly Point[]; readonly line: DetailLine }`, `PlacedOutline.details: readonly PlacedDetail[]`; `assetShapeConfig(...).details: DetailLineConfig[]` where a solid entry is `{ name: 'asset-detail', points, closed: true, stroke, strokeWidth, fill }` and a dashed one `{ name: 'asset-detail', points, closed: true, stroke, strokeWidth, dash }`

- [ ] **Step 1: Write the failing tests**

Append inside `describe('asset placement geometry', …)` in `tests/domain/spatial/assetPlacement.test.ts` (and add `const QUARTER = Math.tan(Math.PI / 8);` plus the helper below after `rect`):

```ts
const circle = (r: number) => ({ points: [{ x: 0, y: -r }, { x: r, y: 0 }, { x: 0, y: r }, { x: -r, y: 0 }], bulges: [QUARTER, QUARTER, QUARTER, QUARTER] });
```

```ts
	it('places each detail with the footprint transform and keeps its line style', () => {
		const element = { points: placementPoints({ x: 0, y: 0 }, Math.PI) };
		const outline = placedOutline(element, shape({ details: [{ id: 'd', name: 'd', outline: { points: rect(200, 100) }, line: 'dashed', pending: false }] }));
		expect(outline.details.map(detail => detail.line)).toEqual(['dashed']);
		expect(rounded(outline.details[0].points)).toEqual(rounded(rotate({ points: rect(200, 100) }, Math.PI, { x: 0, y: 0 }).points));
	});

	it('flattens a curved footprint into the outline a plan draws and hits', () => {
		const footprint = placedOutline({ points: placementPoints({ x: 0, y: 0 }, 0) }, shape({ footprint: circle(500) })).footprint;
		expect(footprint.length).toBeGreaterThan(4);
		expect(Math.max(...footprint.map(point => Math.hypot(point.x, point.y)))).toBeCloseTo(500, 6);
	});

	it('measures back depth from the arc, not only its corner points', () => {
		expect(backDepth(shape({ footprint: circle(500), facing: Math.PI / 4 }))).toBeGreaterThan(499);
	});
```

Append inside `describe('assetShapeConfig', …)` in `tests/presentation/editor/elements/assetShapeConfig.test.ts`:

```ts
	it('draws each detail: solid covers with the canvas colour, dashed is unfilled', () => {
		const square = (half: number) => ({ points: [{ x: -half, y: -half }, { x: half, y: -half }, { x: half, y: half }, { x: -half, y: half }] });
		const withDetails = { ...shape, details: [
			{ id: 'd1', name: 'seat', outline: square(100), line: 'solid' as const, pending: false },
			{ id: 'd2', name: 'overhead', outline: square(50), line: 'dashed' as const, pending: false },
		] };
		const config = assetShapeConfig(element, () => withDetails, state);
		expect(config.details[0]).toMatchObject({ name: 'asset-detail', closed: true, stroke: 'ink', fill: 'bg', points: [900, 900, 1100, 900, 1100, 1100, 900, 1100] });
		expect(config.details[1]).toMatchObject({ name: 'asset-detail', dash: [4, 3] });
		expect(config.details[1]).not.toHaveProperty('fill');
	});

	it('draws no details for a placement whose shape cannot be read', () => {
		expect(assetShapeConfig(element, () => null, state).details).toEqual([]);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/spatial/assetPlacement.test.ts tests/presentation/editor/elements/assetShapeConfig.test.ts`
Expected: FAIL — `outline.details` and `config.details` are undefined; the circle has 4 points; back depth reads ~353.6.

- [ ] **Step 3: Implement `assetPlacement.ts`**

Add imports:

```ts
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../core/geometry/curvePolyline';
import type { DetailLine } from '../asset/AssetDetail';
```

Add after `FACING_POINT_MM`:

```ts
/**
 * Arcs are flattened BEFORE placement, so every plan consumer keeps reading `Point[]` (symbols spec,
 * Rendering). 1 mm of sagitta is below a pixel at any zoom a plan is drawn at.
 * ponytail: fixed world tolerance; pass the zoom in if a close-up ever shows facets.
 */
const PLAN_ARC_TOLERANCE_MM = 1;
const flattened = (outline: CurvedPolygon): readonly Point[] => polygonPolyline(outline, PLAN_ARC_TOLERANCE_MM);

export interface PlacedDetail {
	readonly points: readonly Point[];
	readonly line: DetailLine;
}
```

Add `readonly details: readonly PlacedDetail[];` to `PlacedOutline`. Replace `placedOutline`'s body:

```ts
export function placedOutline(element: Pick<SpatialElement, 'points'>, shape: AssetShape): PlacedOutline {
	const heading = placementHeading(element), anchor = element.points[0];
	const onPlan = (outline: CurvedPolygon): Point[] => place(flattened(outline), shape, heading, anchor);
	return {
		footprint: onPlan(shape.footprint),
		clearance: shape.clearance ? onPlan(shape.clearance) : null,
		details: shape.details.map(detail => ({ points: onPlan(detail.outline), line: detail.line })),
	};
}
```

Update its docblock to: `The asset's footprint, clearance and details in world millimetres, arcs flattened: turned by heading − facing about the asset anchor, moved onto the placement anchor.`

In `backDepth`, replace `shape.footprint.points.map(` with `flattened(shape.footprint).map(`.

- [ ] **Step 4: Implement `assetShapeConfig.ts`**

Replace the function body with:

```ts
export function assetShapeConfig(element: NamedSpatialElement, shapeOf: ShapeLookup, state: { readonly selected: boolean; readonly hovered: boolean; readonly tokens: ThemeTokens; readonly zoom: number }) {
	const { selected, tokens, zoom } = state, shape = element.assetId ? shapeOf(element.assetId) : null;
	const footprint = elementFootprint(element, shapeOf), anchor = element.points[0], heading = placementHeading(element);
	const placed = shape ? placedOutline(element, shape) : null;
	const clearance = placed && (selected || state.hovered) ? placed.clearance : null;
	const ink = selected ? tokens.accent : tokens.zoneStroke;
	return {
		id: element.id,
		footprint: { name: shape ? 'asset-footprint' : 'asset-placeholder', points: flat(footprint), closed: true, stroke: ink,
			strokeWidth: (selected ? 3 : 2) / zoom, fill: tokens.canvasBackground, dash: shape ? [] : [6 / zoom, 4 / zoom] },
		// Symbols spec, Decision 4: array order, lighter than the outline of record; solid covers, dashed does not.
		details: (placed?.details ?? []).map(detail => ({ name: 'asset-detail', points: flat(detail.points), closed: true, stroke: ink, strokeWidth: 1 / zoom,
			...(detail.line === 'solid' ? { fill: tokens.canvasBackground } : { dash: [4 / zoom, 3 / zoom] }) })),
		cross: shape ? null : [flat([footprint[0], footprint[2]]), flat([footprint[1], footprint[3]])],
		tick: { name: 'asset-facing', points: flat([anchor, { x: anchor.x + 16 / zoom * Math.cos(heading), y: anchor.y + 16 / zoom * Math.sin(heading) }]), stroke: ink, strokeWidth: 2 / zoom },
		clearance: clearance ? { name: 'asset-clearance', points: flat(clearance), closed: true, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom, dash: [6 / zoom, 4 / zoom] } : null,
		label: { ...assetLabelLayout(element, footprint, zoom), fontSize: ELEMENT_LABEL_FONT_PX / zoom, fill: tokens.zoneLabel, listening: false },
	};
}
```

- [ ] **Step 5: Draw them — `AssetShapes.vue`**

After `<VLine :config="shape.footprint" />` add:

```vue
			<VLine
				v-for="(detail, index) in shape.details"
				:key="index"
				:config="detail"
			/>
```

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/domain/spatial tests/presentation/editor/elements tests/presentation/editor/assetPlacement.e2e.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/spatial/assetPlacement.ts src/presentation/editor/elements tests/domain/spatial tests/presentation/editor/elements
git commit -m "feat(editor): plans draw curved asset outlines and symbol details

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The designer canvas draws curves and details

**Files:**
- Modify: `src/presentation/designer/layers/footprintLayer.ts`, `clearanceLayer.ts`, `backgroundLayer.ts` (`DesignerLayerName`)
- Create: `src/presentation/designer/layers/detailsLayer.ts`
- Modify: `src/presentation/designer/DesignerCanvas.vue`
- Test: `tests/presentation/designer/layers.test.ts`

**Interfaces:**
- Consumes: `AssetShape.details` (Task 1)
- Produces: `footprintOutline(shape, tokens, worldPerPixel)`, `clearanceOutline(shape, tokens, worldPerPixel)`, `export const ARC_TOLERANCE_PX = 0.25` (footprintLayer.ts), `detailOutlines(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): DetailOutlineConfig[]` with `DetailOutlineConfig extends OutlineConfig { readonly fill?: string }`; layer name `'asset-details'`

- [ ] **Step 1: Write the failing tests**

In `tests/presentation/designer/layers.test.ts`:
- add `import { detailOutlines } from '../../../src/presentation/designer/layers/detailsLayer';`
- change `renderLayers` so `footprint: footprintOutline(design.shape, TOKENS, UNIT_SCALE)` and `clearance: clearanceOutline(design.shape, TOKENS, UNIT_SCALE)`
- in the layer-order case, insert `'asset-details',` after `'asset-footprint',` and rename the case to `'draws the six layers, beneath-to-above, with the background first and the gesture last'`
- in the inert-layers case, the expected array gains a sixth `false`
- add after `WITH_CLEARANCE`:

```ts
const QUARTER = Math.tan(Math.PI / 8);
const WITH_DETAILS: AssetShape = {
	...BASE,
	details: [
		{ id: 'd1', name: 'top', line: 'solid', pending: false, outline: { points: [{ x: 0, y: -300 }, { x: 300, y: 0 }, { x: 0, y: 300 }, { x: -300, y: 0 }], bulges: [QUARTER, QUARTER, QUARTER, QUARTER] } },
		{ id: 'd2', name: 'overhead', line: 'dashed', pending: false, outline: { points: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }] } },
	],
};
```

- add these cases in the pure-config `describe`:

```ts
	it('fills a solid detail with the canvas colour and leaves a dashed one unfilled', () => {
		const [solid, dashed] = detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE);
		expect(solid.fill).toBe(TOKENS.canvasBackground);
		expect(solid.dash).toBeUndefined();
		expect(dashed.fill).toBeUndefined();
		expect(dashed.dash).not.toBeUndefined();
	});

	it('draws curved outlines as their arcs rather than their corners', () => {
		const circular = { ...BASE, footprint: WITH_DETAILS.details[0].outline };
		expect(detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE)[0].points.length).toBeGreaterThan(8);
		expect(footprintOutline(circular, TOKENS, UNIT_SCALE)?.points.length).toBeGreaterThan(8);
	});
```

- add this case in the mounted `describe`:

```ts
	it('draws one detail node per detail', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));

		expect(designer.stage?.find('.asset-detail')).toHaveLength(2);
		designer.unmount();
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/presentation/designer/layers.test.ts`
Expected: FAIL — `detailsLayer` module not found.

- [ ] **Step 3: Implement the layers**

`footprintLayer.ts`: add `import { polygonPolyline } from '../../../core/geometry/curvePolyline';`, add

```ts
/** Arc flattening in SCREEN pixels, converted per zoom — the tolerance `ZoneShape` draws rooms at. */
export const ARC_TOLERANCE_PX = 0.25;
```

and change `footprintOutline` to:

```ts
export function footprintOutline(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): OutlineConfig | null {
	if (shape === null) return null;
	return {
		points: flatPoints(polygonPolyline(shape.footprint, ARC_TOLERANCE_PX * worldPerPixel)),
		closed: true,
		stroke: tokens.zoneStroke,
		strokeWidth: FOOTPRINT_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
	};
}
```

`clearanceLayer.ts`: import `polygonPolyline` and `ARC_TOLERANCE_PX` (from `./footprintLayer`), add `worldPerPixel: number` as the third parameter, and use `points: flatPoints(polygonPolyline(shape.clearance, ARC_TOLERANCE_PX * worldPerPixel)),`.

`backgroundLayer.ts`: add `| 'asset-details'` after `| 'asset-footprint'` in `DesignerLayerName`.

Create `detailsLayer.ts`:

```ts
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * An asset's symbol details (asset designer symbols spec, Decisions 1 and 4), one config per detail
 * in array order. A SOLID detail is filled with the canvas colour so it covers what is beneath it;
 * a DASHED one is unfilled, because dashed means overhead or hidden. Thinner than the footprint,
 * which stays the heavier mark of record.
 */
export interface DetailOutlineConfig extends OutlineConfig {
	readonly fill?: string;
}

const DETAIL_STROKE_PX = 1;
const DETAIL_DASH_PX = [4, 3];

export function detailOutlines(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): DetailOutlineConfig[] {
	if (shape === null) return [];
	return shape.details.map((detail) => ({
		points: flatPoints(polygonPolyline(detail.outline, ARC_TOLERANCE_PX * worldPerPixel)),
		closed: true,
		stroke: tokens.zoneStroke,
		strokeWidth: DETAIL_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
		...(detail.line === 'solid' ? { fill: tokens.canvasBackground } : { dash: [...DETAIL_DASH_PX] }),
	}));
}
```

- [ ] **Step 4: Wire `DesignerCanvas.vue`**

- import: `import { detailOutlines } from './layers/detailsLayer';`
- change the two computeds and add one:

```ts
const footprint = computed(() => footprintOutline(shape.value, tokens.value, worldPerPixel.value));
const details = computed(() => detailOutlines(shape.value, tokens.value, worldPerPixel.value));
const clearance = computed(() => clearanceOutline(shape.value, tokens.value, worldPerPixel.value));
```

- in the template, between the `asset-footprint` `VLayer` and the `asset-clearance` `VLayer`:

```vue
				<VLayer :config="designerLayerConfig('asset-details', transform)">
					<VLine
						v-for="(detail, index) in details"
						:key="index"
						:config="{ ...detail, name: 'asset-detail' }"
					/>
				</VLayer>
```

- [ ] **Step 5: Run the tests**

Run: `npm run check:fast -- tests/presentation/designer tests/harness/harnessSurfaces.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer tests/presentation/designer
git commit -m "feat(designer): draw curved outlines and a details layer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The library mark reads curved footprints

**Files:**
- Modify: `src/application/queries/ListAssetOutlines.ts`
- Modify: `src/presentation/library/AssetInspectorShape.vue`
- Test: `tests/application/queries/listAssetOutlines.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing top-level `describe` of `tests/application/queries/listAssetOutlines.test.ts`:

```ts
	it('hands the mark a curved footprint flattened into its arcs, with the diameter as its extent', async () => {
		const stack = await stackWithAssets([]);
		const quarter = Math.tan(Math.PI / 8);
		const round: AssetShape = {
			...shapeWith('typed', false),
			footprint: { points: [{ x: 0, y: -50 }, { x: 50, y: 0 }, { x: 0, y: 50 }, { x: -50, y: 0 }], bulges: [quarter, quarter, quarter, quarter] },
		};
		expectOk(await stack.geometry.write('round' as AssetId, { calibration: null, shape: round }));

		const answered = (await new ListAssetOutlines(stack.geometry).execute({ assetIds: ['round' as AssetId] })).get('round' as AssetId);

		expect(answered).toMatchObject({ kind: 'measured', extent: { width: 100, depth: 100 } });
		expect(answered?.kind === 'measured' && answered.points.length).toBeGreaterThan(4);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/application/queries/listAssetOutlines.test.ts`
Expected: FAIL — `points.length` is 4.

- [ ] **Step 3: Implement**

`ListAssetOutlines.ts`: add `import { polygonPolyline } from '../../core/geometry/curvePolyline';` and change `points: shape.footprint.points,` to `points: polygonPolyline(shape.footprint),` with a comment above it: `// Arcs flattened at 1 mm: the 20px mark draws straight segments (symbols spec, Rendering).`

`AssetInspectorShape.vue`: add `import { polygonPolyline } from '../../core/geometry/curvePolyline';` and change `points: design.shape.footprint.points, extent: design.dimensions };` to `points: polygonPolyline(design.shape.footprint), extent: design.dimensions };`.

- [ ] **Step 4: Run the tests**

Run: `npm run check:fast -- tests/application/queries tests/presentation/library`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/queries/ListAssetOutlines.ts src/presentation/library/AssetInspectorShape.vue tests/application/queries/listAssetOutlines.test.ts
git commit -m "feat(library): the asset mark draws curved footprints

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Preset framework and table presets

**Files:**
- Create: `src/domain/asset/presets/presetGeometry.ts`, `src/domain/asset/presets/tables.ts`, `src/domain/asset/presets/catalogue.ts`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `de/assetSymbols.ts` (two error codes)
- Modify: `tests/presentation/i18n/toUserMessage.test.ts` (`MINTED` rows)
- Test: `tests/domain/asset/presets/presetGeometry.test.ts`, `tests/domain/asset/presets/presets.test.ts` (new)

**Interfaces:**
- Consumes: `AssetShape`, `validateAssetShape`, `AssetDetail`, `DetailLine` (Task 1)
- Produces (all from `presetGeometry.ts`):
  - `export type PresetId = 'rect-table' | 'round-table' | 'oval-table' | 'curved-table' | 'chair' | 'armchair' | 'sofa' | 'toilet' | 'washbasin' | 'shower-tray' | 'bathtub' | 'tree' | 'shrub' | 'bed'`
  - `export type PresetGroup = 'tables' | 'seating' | 'sanitary' | 'plants-beds'`
  - `export type PresetFieldKey = 'width' | 'depth' | 'diameter' | 'length' | 'radius' | 'sweep' | 'seats' | 'canopy' | 'trunk' | 'pillows'`
  - `export interface PresetField { readonly key: PresetFieldKey; readonly kind: 'length' | 'count' | 'angle'; readonly min: number; readonly max: number; readonly default: number }`
  - `export type PresetValues = Readonly<Partial<Record<PresetFieldKey, number>>>`
  - `export interface AssetPreset { readonly id: PresetId; readonly group: PresetGroup; readonly fields: readonly PresetField[]; build(values: PresetValues): Result<AssetShape, ValidationError> }`
  - `definePreset`, `defaultValues(preset): PresetValues`, `incoherent(message)`, `PRESET_FACING`
  - geometry: `rect(width, depth, cx?, cy?)`, `circle(diameter, cx?, cy?)`, `lobed(diameter, lobes, cx?, cy?)`, `stadium(sizeX, sizeY, cx?, cy?)`, `roundFront(width, depth)`, `ringSector(outerRadius, depth, sweepDegrees)`, `frontClearance(width, depth, reach)`
  - from `catalogue.ts`: `export const PRESET_GROUPS: readonly PresetGroup[]`, `export const ASSET_PRESETS: readonly AssetPreset[]`
  - codes `asset.preset-value-out-of-range`, `asset.preset-incoherent`

- [ ] **Step 1: Write the failing tests**

`tests/domain/asset/presets/presetGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createCurvedPolygon, type CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { area, boundingBoxOf } from '../../../../src/core/geometry/operations';
import { circle, ringSector, roundFront, stadium } from '../../../../src/domain/asset/presets/presetGeometry';
import { expectOk } from '../../../helpers/domain';

/**
 * Areas are the instrument for bulge SIGNS: an arc bowed the wrong way still has the right bounding
 * box in some shapes, but never the right area.
 */
const size = (outline: CurvedPolygon) => {
	const box = expectOk(boundingBoxOf(outline));
	return [box.max.x - box.min.x, box.max.y - box.min.y];
};
const areaOf = (outline: CurvedPolygon) => Math.abs(expectOk(area(expectOk(createCurvedPolygon(outline)))));

describe('preset geometry', () => {
	it('draws a circle whose arcs bow outward', () => {
		expect(size(circle(900))[0]).toBeCloseTo(900, 9);
		expect(areaOf(circle(900))).toBeCloseTo(Math.PI * 450 ** 2, 6);
	});

	it('draws a stadium along its longer side, exactly', () => {
		expect(size(stadium(1800, 1000)).map((value) => Math.round(value))).toEqual([1800, 1000]);
		expect(size(stadium(400, 900)).map((value) => Math.round(value))).toEqual([400, 900]);
		expect(areaOf(stadium(1800, 1000))).toBeCloseTo(800 * 1000 + Math.PI * 500 ** 2, 6);
	});

	it('draws a toilet silhouette: a rectangle with a semicircular front', () => {
		expect(size(roundFront(380, 700)).map((value) => Math.round(value))).toEqual([380, 700]);
		expect(areaOf(roundFront(380, 700))).toBeCloseTo(380 * (700 - 190) + (Math.PI * 190 ** 2) / 2, 6);
	});

	it('draws a ring sector with a convex outer and a concave inner arc, centred on the origin', () => {
		const sector = ringSector(1500, 600, 90);
		const box = expectOk(boundingBoxOf(sector));
		expect(box.min.y + box.max.y).toBeCloseTo(0, 6);
		expect(areaOf(sector)).toBeCloseTo((Math.PI / 4) * (1500 ** 2 - 900 ** 2), 4);
	});
});
```

`tests/domain/asset/presets/presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../../src/core/geometry/operations';
import { dimensionsOf, validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues, type AssetPreset, type PresetValues } from '../../../../src/domain/asset/presets/presetGeometry';
import { expectErr, expectOk } from '../../../helpers/domain';

/** Spec 2026-09-13 Decision 8's table-driven check, over every preset the catalogue holds. */
const EPSILON = 1e-6;
const at = (preset: AssetPreset, pick: 'min' | 'max'): PresetValues => Object.fromEntries(preset.fields.map((field) => [field.key, field[pick]]));
const v = (values: PresetValues, key: keyof PresetValues): number => values[key] ?? Number.NaN;

/** The bounding box each preset's typed fields promise, per the axis conventions in the plan. */
function typedExtent(preset: AssetPreset, values: PresetValues): readonly [number, number] {
	switch (preset.id) {
		case 'round-table': return [v(values, 'diameter'), v(values, 'diameter')];
		case 'shrub': return [v(values, 'diameter'), v(values, 'diameter')];
		case 'tree': return [v(values, 'canopy'), v(values, 'canopy')];
		case 'oval-table': return [v(values, 'length'), v(values, 'width')];
		case 'bathtub': return [v(values, 'length'), v(values, 'width')];
		case 'bed': return [v(values, 'width'), v(values, 'length')];
		case 'curved-table': {
			const radius = v(values, 'radius'), half = (v(values, 'sweep') * Math.PI) / 360;
			return [2 * radius * Math.sin(half), radius - (radius - v(values, 'depth')) * Math.cos(half)];
		}
		default: return [v(values, 'width'), v(values, 'depth')];
	}
}

describe.each(ASSET_PRESETS.map((preset) => [preset.id, preset] as const))('preset %s', (_id, preset) => {
	it.each(['default', 'min', 'max'] as const)('builds a valid typed shape at its %s values', (which) => {
		const values = which === 'default' ? defaultValues(preset) : at(preset, which);
		const shape = expectOk(preset.build(values));

		expect(validateAssetShape(shape).ok).toBe(true);
		expect([shape.footprintOrigin, shape.footprintPending]).toEqual(['typed', false]);
		expect(shape.facing).toBeCloseTo(Math.PI / 2, 12);
		const { width, depth } = expectOk(dimensionsOf(shape.footprint));
		const [expectedWidth, expectedDepth] = typedExtent(preset, values);
		expect(width).toBeCloseTo(expectedWidth, 6);
		expect(depth).toBeCloseTo(expectedDepth, 6);
		const outer = expectOk(boundingBoxOf(shape.footprint));
		for (const detail of shape.details) {
			const box = expectOk(boundingBoxOf(detail.outline));
			expect(box.min.x).toBeGreaterThanOrEqual(outer.min.x - EPSILON);
			expect(box.min.y).toBeGreaterThanOrEqual(outer.min.y - EPSILON);
			expect(box.max.x).toBeLessThanOrEqual(outer.max.x + EPSILON);
			expect(box.max.y).toBeLessThanOrEqual(outer.max.y + EPSILON);
		}
	});

	it('refuses a value above its range', () => {
		const [field] = preset.fields;
		expect(expectErr(preset.build({ ...defaultValues(preset), [field.key]: field.max + 1 })).code).toBe('asset.preset-value-out-of-range');
	});
});

describe('preset refusals that are not ranges', () => {
	it('refuses a curved table as deep as its radius', () => {
		const curved = ASSET_PRESETS.find((preset) => preset.id === 'curved-table');
		expect(curved && expectErr(curved.build({ radius: 600, depth: 600, sweep: 90 })).code).toBe('asset.preset-incoherent');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/asset/presets`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/domain/asset/presets/presetGeometry.ts`**

```ts
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, isErr, type Result } from '../../../core/result/Result';
import { assetError } from '../Asset.errors';
import type { DetailLine } from '../AssetDetail';
import { validateAssetShape, type AssetShape } from '../AssetShape';

/**
 * Preset generators (asset designer symbols spec, Decision 8): typed values in, a validated
 * `AssetShape` out. Pure domain — no text; the presentation labels ids and field keys, and both are
 * closed unions so a missing label is a build error.
 *
 * CONVENTIONS every generator here keeps: centred on the origin; front toward +y (`PRESET_FACING`),
 * so a wall snap puts the back (−y) against the wall; outlines wound top-left → top-right →
 * bottom-right → bottom-left, with which a POSITIVE bulge bows outward.
 */
export type PresetId =
	| 'rect-table' | 'round-table' | 'oval-table' | 'curved-table'
	| 'chair' | 'armchair' | 'sofa'
	| 'toilet' | 'washbasin' | 'shower-tray' | 'bathtub'
	| 'tree' | 'shrub' | 'bed';
export type PresetGroup = 'tables' | 'seating' | 'sanitary' | 'plants-beds';
export type PresetFieldKey = 'width' | 'depth' | 'diameter' | 'length' | 'radius' | 'sweep' | 'seats' | 'canopy' | 'trunk' | 'pillows';

export interface PresetField {
	readonly key: PresetFieldKey;
	/** `length` is millimetres, `angle` degrees, `count` a whole number. */
	readonly kind: 'length' | 'count' | 'angle';
	readonly min: number;
	readonly max: number;
	readonly default: number;
}

export type PresetValues = Readonly<Partial<Record<PresetFieldKey, number>>>;

export interface PresetDrawing {
	readonly footprint: CurvedPolygon;
	readonly clearance: CurvedPolygon | null;
	readonly details: readonly { readonly name: string; readonly outline: CurvedPolygon; readonly line?: DetailLine }[];
}

export interface AssetPreset {
	readonly id: PresetId;
	readonly group: PresetGroup;
	readonly fields: readonly PresetField[];
	build(values: PresetValues): Result<AssetShape, ValidationError>;
}

export const PRESET_FACING = Math.PI / 2;

export function defaultValues(preset: AssetPreset): PresetValues {
	return Object.fromEntries(preset.fields.map((field) => [field.key, field.default]));
}

export const incoherent = (message: string): Result<never, ValidationError> => err(assetError('preset-incoherent', message));

function outOfRange(id: PresetId, fields: readonly PresetField[], values: PresetValues): ValidationError | null {
	for (const field of fields) {
		const value = values[field.key];
		const whole = field.kind !== 'count' || Number.isInteger(value);
		if (value === undefined || !Number.isFinite(value) || value < field.min || value > field.max || !whole) {
			return assetError('preset-value-out-of-range', `${id}.${field.key} must be within ${field.min}–${field.max}; got ${String(value)}.`);
		}
	}
	return null;
}

/** Range-checks the values, draws, and composes the typed shape every preset answers. */
export function definePreset(
	id: PresetId,
	group: PresetGroup,
	fields: readonly PresetField[],
	draw: (value: (key: PresetFieldKey) => number) => Result<PresetDrawing, ValidationError>,
): AssetPreset {
	return {
		id,
		group,
		fields,
		build(values) {
			const refused = outOfRange(id, fields, values);
			if (refused !== null) return err(refused);
			const drawing = draw((key) => values[key] ?? Number.NaN);
			if (isErr(drawing)) return drawing;
			return validateAssetShape({
				footprint: drawing.value.footprint,
				footprintOrigin: 'typed',
				footprintPending: false,
				clearancePending: false,
				anchorPending: false,
				clearance: drawing.value.clearance,
				anchor: { x: 0, y: 0 },
				facing: PRESET_FACING,
				details: drawing.value.details.map((detail, index) => ({
					id: `detail-${index + 1}`,
					name: detail.name,
					outline: detail.outline,
					line: detail.line ?? 'solid',
					pending: false,
				})),
			});
		},
	};
}

export function rect(width: number, depth: number, cx = 0, cy = 0): CurvedPolygon {
	const halfWidth = width / 2, halfDepth = depth / 2;
	return {
		points: [
			{ x: cx - halfWidth, y: cy - halfDepth },
			{ x: cx + halfWidth, y: cy - halfDepth },
			{ x: cx + halfWidth, y: cy + halfDepth },
			{ x: cx - halfWidth, y: cy + halfDepth },
		],
	};
}

/** The area a person needs in front of an object: its own footprint extended `reach` toward +y. */
export const frontClearance = (width: number, depth: number, reach: number): CurvedPolygon => rect(width, depth + reach, 0, reach / 2);

/** `count` points on a circle from the top, clockwise on screen, every edge bulged by `bulge`. */
function ring(radius: number, count: number, bulge: number, cx: number, cy: number): CurvedPolygon {
	const points = Array.from({ length: count }, (_, index) => {
		const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
		return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
	});
	return { points, bulges: points.map(() => bulge) };
}

const QUARTER_BULGE = Math.tan(Math.PI / 8);
export const circle = (diameter: number, cx = 0, cy = 0): CurvedPolygon => ring(diameter / 2, 4, QUARTER_BULGE, cx, cy);

/** A scalloped outline inside a circle of `diameter`: lobes on a smaller ring, bowed outward, peaks under the circle. */
const LOBE_RING = 0.85;
const LOBE_BULGE = 0.35;
export const lobed = (diameter: number, lobes: number, cx = 0, cy = 0): CurvedPolygon => ring((diameter / 2) * LOBE_RING, lobes, LOBE_BULGE, cx, cy);

/** Two semicircles joined by straight sides, along whichever axis is longer; exact, not approximated. */
export function stadium(sizeX: number, sizeY: number, cx = 0, cy = 0): CurvedPolygon {
	if (sizeX === sizeY) return circle(sizeX, cx, cy);
	if (sizeX > sizeY) {
		const radius = sizeY / 2, straight = sizeX / 2 - radius;
		return { points: rect(2 * straight, sizeY, cx, cy).points, bulges: [0, 1, 0, 1] };
	}
	const radius = sizeX / 2, straight = sizeY / 2 - radius;
	return { points: rect(sizeX, 2 * straight, cx, cy).points, bulges: [1, 0, 1, 0] };
}

/** A rectangle whose front (+y) edge is a semicircle across its full width. Needs `depth > width / 2`. */
export function roundFront(width: number, depth: number): CurvedPolygon {
	const half = width / 2, back = -depth / 2, shoulder = depth / 2 - half;
	return {
		points: [{ x: -half, y: back }, { x: half, y: back }, { x: half, y: shoulder }, { x: -half, y: shoulder }],
		bulges: [0, 0, 1, 0],
	};
}

/**
 * A band between two concentric arcs, convex side toward +y, vertically centred on the origin.
 * Needs `depth < outerRadius` and `sweepDegrees <= 180` (a bulge above 1 is refused).
 */
export function ringSector(outerRadius: number, depth: number, sweepDegrees: number): CurvedPolygon {
	const inner = outerRadius - depth, half = (sweepDegrees * Math.PI) / 360;
	const sin = Math.sin(half), cos = Math.cos(half), bulge = Math.tan(half / 2);
	const centre = (outerRadius + inner * cos) / 2;
	return {
		points: [
			{ x: -inner * sin, y: inner * cos - centre },
			{ x: inner * sin, y: inner * cos - centre },
			{ x: outerRadius * sin, y: outerRadius * cos - centre },
			{ x: -outerRadius * sin, y: outerRadius * cos - centre },
		],
		bulges: [-bulge, 0, bulge, 0],
	};
}
```

- [ ] **Step 4: Create `tables.ts` and `catalogue.ts`**

`src/domain/asset/presets/tables.ts`:

```ts
import { ok } from '../../../core/result/Result';
import { circle, definePreset, incoherent, rect, ringSector, stadium, type AssetPreset } from './presetGeometry';

/** Room to pull a chair out on every side of a table. */
const CHAIR_ROOM_MM = 600;

export const TABLE_PRESETS: readonly AssetPreset[] = [
	definePreset('rect-table', 'tables', [
		{ key: 'width', kind: 'length', min: 400, max: 5000, default: 1600 },
		{ key: 'depth', kind: 'length', min: 400, max: 3000, default: 900 },
	], (value) => ok({
		footprint: rect(value('width'), value('depth')),
		clearance: rect(value('width') + 2 * CHAIR_ROOM_MM, value('depth') + 2 * CHAIR_ROOM_MM),
		details: [],
	})),
	definePreset('round-table', 'tables', [
		{ key: 'diameter', kind: 'length', min: 400, max: 3000, default: 900 },
	], (value) => ok({
		footprint: circle(value('diameter')),
		clearance: circle(value('diameter') + 2 * CHAIR_ROOM_MM),
		details: [],
	})),
	definePreset('oval-table', 'tables', [
		{ key: 'length', kind: 'length', min: 600, max: 5000, default: 1800 },
		{ key: 'width', kind: 'length', min: 400, max: 3000, default: 1000 },
	], (value) => ok({
		footprint: stadium(value('length'), value('width')),
		clearance: stadium(value('length') + 2 * CHAIR_ROOM_MM, value('width') + 2 * CHAIR_ROOM_MM),
		details: [],
	})),
	definePreset('curved-table', 'tables', [
		{ key: 'radius', kind: 'length', min: 500, max: 6000, default: 1500 },
		{ key: 'depth', kind: 'length', min: 300, max: 2000, default: 600 },
		{ key: 'sweep', kind: 'angle', min: 10, max: 180, default: 90 },
	], (value) => (value('depth') >= value('radius')
		? incoherent('A curved table must be shallower than its outer radius.')
		: ok({ footprint: ringSector(value('radius'), value('depth'), value('sweep')), clearance: null, details: [] }))),
];
```

`src/domain/asset/presets/catalogue.ts`:

```ts
import type { AssetPreset, PresetGroup } from './presetGeometry';
import { TABLE_PRESETS } from './tables';

/** The order the preset picker offers groups in. */
export const PRESET_GROUPS: readonly PresetGroup[] = ['tables', 'seating', 'sanitary', 'plants-beds'];

/** Every preset, in picker order. The first one is the picker's default. */
export const ASSET_PRESETS: readonly AssetPreset[] = [...TABLE_PRESETS];
```

- [ ] **Step 5: Strings and `MINTED` rows**

Add to `assetSymbolsEn`:

```ts
	'asset.preset-value-out-of-range': 'A value is outside what this preset allows.',
	'asset.preset-incoherent': 'Those values do not describe a shape that can be built.',
```

and to `assetSymbolsDe`:

```ts
	'asset.preset-value-out-of-range': 'Ein Wert liegt außerhalb dessen, was diese Vorlage erlaubt.',
	'asset.preset-incoherent': 'Diese Werte ergeben keine Form, die sich bauen lässt.',
```

In `toUserMessage.test.ts` `MINTED`, after the Task 1 rows:

```ts
	['asset.preset-value-out-of-range', 'Validation', 'error.category.validation', 'domain/asset/presets/presetGeometry.ts'],
	['asset.preset-incoherent', 'Validation', 'error.category.validation', 'domain/asset/presets/presetGeometry.ts'],
```

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/domain/asset tests/presentation/i18n`
Expected: PASS. If the curved-table extent case fails, the `ringSector` sign or centring is wrong — fix the generator, never the expectation.

- [ ] **Step 7: Commit**

```bash
git add src/domain/asset/presets src/presentation/i18n/locales tests/domain/asset/presets tests/presentation/i18n/toUserMessage.test.ts
git commit -m "feat(asset): preset generators and the table presets

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Seating, sanitary, plant and bed presets

**Files:**
- Create: `src/domain/asset/presets/seating.ts`, `sanitary.ts`, `plantsBeds.ts`
- Modify: `src/domain/asset/presets/catalogue.ts`
- Modify: `tests/domain/asset/presets/presets.test.ts` (three refusal cases)

**Interfaces:**
- Consumes: everything `presetGeometry.ts` produces (Task 7)
- Produces: `SEATING_PRESETS`, `SANITARY_PRESETS`, `PLANT_AND_BED_PRESETS: readonly AssetPreset[]`; detail names `backrest`, `arm`, `cushion`, `seat`, `tank`, `bowl`, `basin`, `tap-hole`, `drain`, `canopy`, `trunk`, `outline`, `pillow`, `duvet`

- [ ] **Step 1: Write the failing tests**

Append to `describe('preset refusals that are not ranges', …)` in `presets.test.ts`:

```ts
	it('refuses a fractional seat count', () => {
		const sofa = ASSET_PRESETS.find((preset) => preset.id === 'sofa');
		expect(sofa && expectErr(sofa.build({ width: 2000, depth: 900, seats: 2.5 })).code).toBe('asset.preset-value-out-of-range');
	});

	it('refuses a tree whose trunk is half its canopy or more', () => {
		const tree = ASSET_PRESETS.find((preset) => preset.id === 'tree');
		expect(tree && expectErr(tree.build({ canopy: 1000, trunk: 500 })).code).toBe('asset.preset-incoherent');
	});

	it('offers all fourteen presets', () => {
		expect(ASSET_PRESETS.map((preset) => preset.id)).toEqual([
			'rect-table', 'round-table', 'oval-table', 'curved-table',
			'chair', 'armchair', 'sofa',
			'toilet', 'washbasin', 'shower-tray', 'bathtub',
			'tree', 'shrub', 'bed',
		]);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/asset/presets/presets.test.ts`
Expected: FAIL — the catalogue holds four presets.

- [ ] **Step 3: Create `seating.ts`**

```ts
import { ok } from '../../../core/result/Result';
import { definePreset, frontClearance, rect, type AssetPreset } from './presetGeometry';

const SEAT_REACH_MM = 600;
const SOFA_REACH_MM = 450;

/** Backrest across the back, an arm each side, `cushions` seats between them. */
function upholstered(width: number, depth: number, cushions: number) {
	const arm = Math.min(150, width * 0.2), back = Math.min(200, depth * 0.25);
	const seatWidth = (width - 2 * arm) / cushions, seatDepth = depth - back, seatY = back / 2;
	return [
		{ name: 'backrest', outline: rect(width, back, 0, -depth / 2 + back / 2) },
		{ name: 'arm', outline: rect(arm, seatDepth, -width / 2 + arm / 2, seatY) },
		{ name: 'arm', outline: rect(arm, seatDepth, width / 2 - arm / 2, seatY) },
		...Array.from({ length: cushions }, (_, index) => ({
			name: 'cushion',
			outline: rect(seatWidth, seatDepth, -width / 2 + arm + seatWidth * (index + 0.5), seatY),
		})),
	];
}

export const SEATING_PRESETS: readonly AssetPreset[] = [
	definePreset('chair', 'seating', [
		{ key: 'width', kind: 'length', min: 350, max: 700, default: 450 },
		{ key: 'depth', kind: 'length', min: 350, max: 700, default: 500 },
	], (value) => {
		const width = value('width'), depth = value('depth');
		return ok({
			footprint: rect(width, depth),
			clearance: frontClearance(width, depth, SEAT_REACH_MM),
			details: [
				{ name: 'seat', outline: rect(width, depth * 0.8, 0, depth * 0.1) },
				{ name: 'backrest', outline: rect(width, depth * 0.2, 0, -depth * 0.4) },
			],
		});
	}),
	definePreset('armchair', 'seating', [
		{ key: 'width', kind: 'length', min: 600, max: 1200, default: 800 },
		{ key: 'depth', kind: 'length', min: 600, max: 1100, default: 800 },
	], (value) => ok({
		footprint: rect(value('width'), value('depth')),
		clearance: frontClearance(value('width'), value('depth'), SEAT_REACH_MM),
		details: upholstered(value('width'), value('depth'), 1),
	})),
	definePreset('sofa', 'seating', [
		{ key: 'width', kind: 'length', min: 1200, max: 3600, default: 2000 },
		{ key: 'depth', kind: 'length', min: 700, max: 1200, default: 900 },
		{ key: 'seats', kind: 'count', min: 1, max: 6, default: 3 },
	], (value) => ok({
		footprint: rect(value('width'), value('depth')),
		clearance: frontClearance(value('width'), value('depth'), SOFA_REACH_MM),
		details: upholstered(value('width'), value('depth'), value('seats')),
	})),
];
```

- [ ] **Step 4: Create `sanitary.ts`**

```ts
import { ok } from '../../../core/result/Result';
import { circle, definePreset, frontClearance, rect, roundFront, stadium, type AssetPreset } from './presetGeometry';

/** Standing room in front of a fitting, and to each side of a toilet. */
const FRONT_REACH_MM = 600;
const TOILET_SIDE_MM = 200;
const BATH_RIM_MM = 80;

export const SANITARY_PRESETS: readonly AssetPreset[] = [
	definePreset('toilet', 'sanitary', [
		{ key: 'width', kind: 'length', min: 300, max: 500, default: 380 },
		{ key: 'depth', kind: 'length', min: 500, max: 900, default: 700 },
	], (value) => {
		const width = value('width'), depth = value('depth'), tank = Math.min(200, depth * 0.3);
		return ok({
			footprint: roundFront(width, depth),
			clearance: rect(width + 2 * TOILET_SIDE_MM, depth + FRONT_REACH_MM, 0, FRONT_REACH_MM / 2),
			details: [
				{ name: 'tank', outline: rect(width, tank, 0, -depth / 2 + tank / 2) },
				{ name: 'bowl', outline: stadium(width * 0.8, (depth - tank) * 0.9, 0, -depth / 2 + tank + (depth - tank) / 2) },
			],
		});
	}),
	definePreset('washbasin', 'sanitary', [
		{ key: 'width', kind: 'length', min: 350, max: 1200, default: 600 },
		{ key: 'depth', kind: 'length', min: 300, max: 650, default: 450 },
	], (value) => {
		const width = value('width'), depth = value('depth');
		return ok({
			footprint: rect(width, depth),
			clearance: frontClearance(width, depth, FRONT_REACH_MM),
			details: [
				{ name: 'basin', outline: stadium(width * 0.7, depth * 0.6, 0, depth * 0.1) },
				{ name: 'tap-hole', outline: circle(Math.min(40, width * 0.1), 0, -depth * 0.35) },
			],
		});
	}),
	definePreset('shower-tray', 'sanitary', [
		{ key: 'width', kind: 'length', min: 700, max: 1800, default: 900 },
		{ key: 'depth', kind: 'length', min: 700, max: 1800, default: 900 },
	], (value) => {
		const width = value('width'), depth = value('depth');
		return ok({
			footprint: rect(width, depth),
			clearance: frontClearance(width, depth, FRONT_REACH_MM),
			details: [{ name: 'drain', outline: circle(Math.min(100, Math.min(width, depth) * 0.15)) }],
		});
	}),
	definePreset('bathtub', 'sanitary', [
		{ key: 'length', kind: 'length', min: 1200, max: 2200, default: 1700 },
		{ key: 'width', kind: 'length', min: 600, max: 1000, default: 750 },
	], (value) => {
		const length = value('length'), width = value('width');
		return ok({
			footprint: rect(length, width),
			clearance: frontClearance(length, width, FRONT_REACH_MM),
			details: [
				{ name: 'basin', outline: stadium(length - 2 * BATH_RIM_MM, width - 2 * BATH_RIM_MM) },
				{ name: 'drain', outline: circle(60, length / 2 - BATH_RIM_MM - 100, 0) },
			],
		});
	}),
];
```

- [ ] **Step 5: Create `plantsBeds.ts`**

```ts
import { ok } from '../../../core/result/Result';
import { circle, definePreset, incoherent, lobed, rect, type AssetPreset } from './presetGeometry';

const BED_SIDE_MM = 600;
const PILLOW_DEPTH_MM = 180;
const PILLOW_MARGIN_MM = 60;

export const PLANT_AND_BED_PRESETS: readonly AssetPreset[] = [
	definePreset('tree', 'plants-beds', [
		{ key: 'canopy', kind: 'length', min: 1000, max: 15000, default: 3000 },
		{ key: 'trunk', kind: 'length', min: 100, max: 1000, default: 300 },
	], (value) => (value('trunk') * 2 >= value('canopy')
		? incoherent('A trunk must be less than half as wide as its canopy.')
		: ok({
			footprint: circle(value('canopy')),
			clearance: null,
			details: [
				{ name: 'canopy', outline: lobed(value('canopy'), 8) },
				{ name: 'trunk', outline: circle(value('trunk')) },
			],
		}))),
	definePreset('shrub', 'plants-beds', [
		{ key: 'diameter', kind: 'length', min: 300, max: 4000, default: 1000 },
	], (value) => ok({
		footprint: circle(value('diameter')),
		clearance: null,
		details: [{ name: 'outline', outline: lobed(value('diameter'), 6) }],
	})),
	definePreset('bed', 'plants-beds', [
		{ key: 'width', kind: 'length', min: 800, max: 2200, default: 1600 },
		{ key: 'length', kind: 'length', min: 1800, max: 2200, default: 2000 },
		{ key: 'pillows', kind: 'count', min: 1, max: 2, default: 2 },
	], (value) => {
		const width = value('width'), length = value('length'), pillows = value('pillows');
		const pillowWidth = (width - PILLOW_MARGIN_MM * (pillows + 1)) / pillows;
		return ok({
			footprint: rect(width, length),
			clearance: rect(width + 2 * BED_SIDE_MM, length + BED_SIDE_MM, 0, BED_SIDE_MM / 2),
			details: [
				...Array.from({ length: pillows }, (_, index) => ({
					name: 'pillow',
					outline: rect(pillowWidth, PILLOW_DEPTH_MM,
						-width / 2 + PILLOW_MARGIN_MM + pillowWidth / 2 + index * (pillowWidth + PILLOW_MARGIN_MM),
						-length / 2 + PILLOW_MARGIN_MM + PILLOW_DEPTH_MM / 2),
				})),
				{ name: 'duvet', outline: rect(width, length * 0.7, 0, length * 0.15) },
			],
		});
	}),
];
```

- [ ] **Step 6: Register them — `catalogue.ts`**

```ts
import type { AssetPreset, PresetGroup } from './presetGeometry';
import { PLANT_AND_BED_PRESETS } from './plantsBeds';
import { SANITARY_PRESETS } from './sanitary';
import { SEATING_PRESETS } from './seating';
import { TABLE_PRESETS } from './tables';

/** The order the preset picker offers groups in. */
export const PRESET_GROUPS: readonly PresetGroup[] = ['tables', 'seating', 'sanitary', 'plants-beds'];

/** Every preset, in picker order. The first one is the picker's default. */
export const ASSET_PRESETS: readonly AssetPreset[] = [...TABLE_PRESETS, ...SEATING_PRESETS, ...SANITARY_PRESETS, ...PLANT_AND_BED_PRESETS];
```

- [ ] **Step 7: Run the tests**

Run: `npm run check:fast -- tests/domain/asset/presets`
Expected: PASS (every preset × default/min/max). A failing containment assertion means a detail pokes outside its footprint's box — fix the generator.

- [ ] **Step 8: Commit**

```bash
git add src/domain/asset/presets tests/domain/asset/presets
git commit -m "feat(asset): seating, sanitary, plant and bed presets

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: `SetAssetShape` — one whole-shape write, wired to the designer

**Files:**
- Create: `src/application/commands/asset/SetAssetShape.ts`
- Modify: `src/application/editor/asset/ReversibleAssetDesignCommands.ts`
- Modify: `src/plugin/guardedServices.ts`
- Modify: `src/presentation/designer/designerCommands.ts` (`refusingBundle`)
- Modify: `src/presentation/designer/runtime.ts`
- Modify: `tests/helpers/assetDesignHarness.ts`, `tests/helpers/designerRig.ts` (bundles)
- Modify: `tests/plugin/assetGeometryWiring.test.ts`
- Test: `tests/application/commands/asset/setAssetShape.test.ts`, `tests/application/editor/reversibleAssetShape.test.ts` (new)

**Interfaces:**
- Consumes: `AssetShape`, `updateAssetShape`, `AssetShapeDeps` (`updateAssetShape.ts`)
- Produces:
  - `export interface SetAssetShapeInput { readonly assetId: AssetId; readonly shape: AssetShape; readonly expected?: EntityVersion }`
  - `export class SetAssetShapeCommand implements Command<SetAssetShapeInput, DispatchResult>` with `execute` and `executeWithVersion`
  - `AssetDesignCommandBundle.setShape`, `ReversibleAssetDesignCommands.setShape(input): ReversibleAssetDesignEdit`
  - `GuardedAssetDesignServices['assetDesign'].setShape` under events `command.setAssetShape.failed` / `command.setAssetShape.with-version.failed`
  - `DesignerRuntime.applyShape: (shape: AssetShape) => Promise<void>`

- [ ] **Step 1: Write the failing tests**

`tests/application/commands/asset/setAssetShape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SetAssetShapeCommand } from '../../../../src/application/commands/asset/SetAssetShape';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { shapeFromDimensions, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

/** Spec 2026-09-13 Decision 7: presets and every part edit write through this one command. */
const CALIBRATION = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 100, pixelsPerWorldUnit: 1 };

async function seeded() {
	const stack = createRepositoryStack();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const assetId = createAssetId();
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	return {
		sidecar,
		assetId,
		command: new SetAssetShapeCommand({ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() }),
		read: async () => expectOk(await sidecar.read(assetId)),
	};
}

const symbol = (): AssetShape => ({
	...expectOk(shapeFromDimensions(400, 700)),
	details: [{ id: 'detail-1', name: 'tank', line: 'solid', pending: false, outline: { points: [{ x: -200, y: -350 }, { x: 200, y: -350 }, { x: 200, y: -150 }, { x: -200, y: -150 }] } }],
});

describe('SetAssetShapeCommand', () => {
	it('replaces the whole shape and keeps the calibration beside it', async () => {
		const h = await seeded();
		expectOk(await h.sidecar.write(h.assetId, { calibration: CALIBRATION, shape: expectOk(shapeFromDimensions(1200, 800)) }));

		expect(expectOk(await h.command.execute({ assetId: h.assetId, shape: symbol() }))).toBe('wrote');

		const { document } = await h.read();
		expect(document.shape?.details.map((detail) => detail.name)).toEqual(['tank']);
		expect(document.shape?.footprint.points[1]).toEqual({ x: 200, y: -350 });
		expect(document.calibration).toEqual(CALIBRATION);
	});

	it('refuses a shape the domain refuses, and writes nothing', async () => {
		const h = await seeded();
		const collinear = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] };
		const degenerate = { ...symbol(), details: [{ ...symbol().details[0], outline: collinear }] };

		expect(expectErr(await h.command.execute({ assetId: h.assetId, shape: degenerate })).code).toBe('asset.degenerate-detail');
		expect((await h.read()).version.revision).toBe(0);
	});

	it('refuses an asset that does not exist', async () => {
		const h = await seeded();

		expect(expectErr(await h.command.execute({ assetId: createAssetId(), shape: symbol() })).code).toBe('asset.not-found');
	});
});
```

`tests/application/editor/reversibleAssetShape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { expectOk } from '../../helpers/domain';
import { drawn, seeded, SQUARE } from '../../helpers/assetDesignHarness';

describe('the reversible whole-shape edit', () => {
	it('restores the traced shape a whole-shape write replaced', async () => {
		const { reversible, assetId, seed, document } = await seeded();
		await seed(drawn());

		const edit = reversible.setShape({ assetId, shape: expectOk(shapeFromDimensions(1200, 800)) });
		expect(expectOk(await edit.execute())).toBe('wrote');
		expect((await document()).shape?.footprintOrigin).toBe('typed');

		expect(expectOk(await edit.undo())).toBe('wrote');
		expect((await document()).shape?.footprint.points).toEqual(SQUARE);
	});
});
```

In `tests/plugin/assetGeometryWiring.test.ts` (add `import { shapeFromDimensions } from '../../src/domain/asset/AssetShape';` and `expectOk` from `../helpers/domain` if either is not already imported):
- in `'answers a mapped refusal at every door…'`: insert `await design.setShape.execute({ assetId, shape: expectOk(shapeFromDimensions(1200, 800)) }),` after the `setFootprintFromDimensions` line; the `ok` array becomes eight `false`; `Array.from({ length: 8 }, …)`; insert `'command.setAssetShape.failed',` after `'command.setAssetFootprintFromDimensions.failed',`.
- in `'guards the versioned door of every design command…'`: insert `await design.setShape.executeWithVersion({ assetId, shape: expectOk(shapeFromDimensions(1200, 800)) }),` after the `setFootprintFromDimensions` line; `Array.from({ length: 7 }, …)`; insert `'command.setAssetShape.with-version.failed',` after `'command.setAssetFootprintFromDimensions.with-version.failed',`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/application/commands/asset/setAssetShape.test.ts tests/application/editor/reversibleAssetShape.test.ts tests/plugin/assetGeometryWiring.test.ts`
Expected: FAIL — module not found / `setShape` undefined.

- [ ] **Step 3: Create `SetAssetShape.ts`** (remember: the word "undo" must not appear in this file)

```ts
import { ok } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { EntityVersion } from '../../ports/versioning';
import { updateAssetShape, type AssetShapeDeps, type ShapeUnchanged } from './updateAssetShape';

export interface SetAssetShapeInput {
	readonly assetId: AssetId;
	readonly shape: AssetShape;
	readonly expected?: EntityVersion;
}

/**
 * Nothing is compared: re-applying an identical shape writes again, which costs one revision
 * and nothing else (asset designer symbols spec, Decision 7).
 */
const ALWAYS_CHANGED: ShapeUnchanged = () => false;

/**
 * A WHOLE `AssetShape` in one write (asset designer symbols spec, Decision 7) — what a preset
 * produces, and what every part edit of the next increment produces. `updateAssetShape` supplies
 * the lock, the asset-exists check, `validateAssetShape` over this wide input, the conditional
 * write and the `AssetDesignChanged` announcement; the calibration and the background beside the
 * shape are untouched.
 */
export class SetAssetShapeCommand implements Command<SetAssetShapeInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetShapeInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	executeWithVersion(input: SetAssetShapeInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(this.deps, input, () => ok(input.shape), ALWAYS_CHANGED);
	}
}
```

- [ ] **Step 4: The reversible door — `ReversibleAssetDesignCommands.ts`**

- import: `import type { SetAssetShapeInput } from '../../commands/asset/SetAssetShape';`
- in `AssetDesignCommandBundle`, after `setFootprint`: `readonly setShape: VersionedDesignCommand<SetAssetShapeInput>;`
- in `class ReversibleAssetDesignCommands`, after `setFootprint(...)`:

```ts
	setShape(input: SetAssetShapeInput): ReversibleAssetDesignEdit {
		return new ReversibleAssetGeometryEdit(this.deps, this.commands.setShape, input);
	}
```

- [ ] **Step 5: Guard it — `src/plugin/guardedServices.ts`**

- import: `import { SetAssetShapeCommand, type SetAssetShapeInput } from '../application/commands/asset/SetAssetShape';`
- in `GuardedAssetDesignServices['assetDesign']`, after `setFootprintFromDimensions`: `readonly setShape: GuardedDesignCommand<SetAssetShapeInput>;`
- in `guardAssetDesign`, after the `setFootprintFromDimensions` construction:

```ts
	const setShape = guardBothDoors(new SetAssetShapeCommand(deps), designDoors('setAssetShape'), logger, map);
```

- in its returned `assetDesign` object, `setShape,` after `setFootprintFromDimensions,`.

- [ ] **Step 6: Every bundle literal**

- `src/presentation/designer/designerCommands.ts` `refusingBundle()`: add `setShape: refusingCommand(),` after `setFootprint: refusingCommand(),`.
- `tests/helpers/assetDesignHarness.ts` and `tests/helpers/designerRig.ts`: in each `const bundle: AssetDesignCommandBundle = {…}`, add `setShape: new SetAssetShapeCommand(commandDeps),` after `setFootprint`, and import `SetAssetShapeCommand` from `…/src/application/commands/asset/SetAssetShape` with the same relative prefix those files already use for `SetAssetFootprint`.

- [ ] **Step 7: The runtime gesture — `src/presentation/designer/runtime.ts`**

- import: `import type { AssetShape } from '../../domain/asset/AssetShape';`
- in the runtime interface, after `setFootprintFromDimensions`:

```ts
	/**
	 * The preset dialog's gesture (asset designer symbols spec, Decision 7): one whole-shape write,
	 * one history entry. Swallows its `Result` through `notifyIfRefused`/`reportDispatchFault` for
	 * the reason `setFootprintFromDimensions` gives — a click-bound dispatch with no field to show a
	 * refusal under.
	 */
	readonly applyShape: (shape: AssetShape) => Promise<void>;
```

- after the `setFootprintFromDimensions` implementation:

```ts
	async function applyShape(shape: AssetShape): Promise<void> {
		await notifyIfRefused(
			reportDispatchFault(context.logger, DISPATCH_FAULT_EVENT, dispatcher.run(edits.setShape({ assetId, shape }))),
		);
	}
```

- in the returned object, `applyShape,` after `setFootprintFromDimensions,`.

- [ ] **Step 8: Run the tests**

Run: `npm run check:fast -- tests/application tests/plugin tests/presentation/designer`
Expected: PASS (including `tests/plugin/guardCategory.test.ts` and `tests/application/events/reversibleWritePathDiscovery.test.ts`).

- [ ] **Step 9: Commit**

```bash
git add src/application src/plugin/guardedServices.ts src/presentation/designer tests/application tests/plugin tests/helpers
git commit -m "feat(asset): SetAssetShape writes a whole shape through the reversible edit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The preset dialog

**Files:**
- Create: `src/presentation/designer/presets/presetPreview.ts`, `src/presentation/designer/presets/AssetPresetForm.vue`
- Modify: `src/presentation/designer/AssetDesignerRoot.vue`, `src/presentation/designer/inspector/DesignerInspector.vue`
- Modify: `src/presentation/i18n/locales/en/assetSymbols.ts`, `de/assetSymbols.ts`
- Modify: `styles/designer.css`
- Modify: `tests/presentation/designer/designerInspector.test.ts`, `tests/harness/accessibilityDialogs.test.ts`
- Test: `tests/presentation/designer/presetPreview.test.ts`, `tests/presentation/designer/assetPresetForm.test.ts`, `tests/presentation/designer/assetPresetFlow.test.ts` (new)

**Interfaces:**
- Consumes: `ASSET_PRESETS`, `PRESET_GROUPS` (catalogue), `defaultValues`, `AssetPreset`, `PresetFieldKey` (Task 7), `runtime.applyShape` (Task 9)
- Produces:
  - `presetPreview(shape: AssetShape): PresetPreview` with `PresetPreview { readonly viewBox: string; readonly footprint: string; readonly details: readonly { readonly d: string; readonly dashed: boolean }[] }`
  - `AssetPresetForm.vue` — props `{ replaces: boolean }`, emits `submit: [shape: AssetShape]`
  - `DesignerInspector` prop `startFromPreset: () => Promise<void>`, button class `rp-designer-start-preset`

- [ ] **Step 1: Strings**

Add to `assetSymbolsEn`:

```ts
	'designer.inspector.start-preset': 'Start from preset',
	'designer.preset.title': 'Start from a preset',
	'designer.preset.picker': 'Preset',
	'designer.preset.replaces': 'This replaces the current design. Undo restores it.',
	'designer.preset.apply': 'Apply preset',
	'designer.preset.preview': 'Preview of the preset',
	'designer.preset.group.tables': 'Tables',
	'designer.preset.group.seating': 'Seating',
	'designer.preset.group.sanitary': 'Bathroom',
	'designer.preset.group.plants-beds': 'Plants and beds',
	'designer.preset.field.width': 'Width in millimetres',
	'designer.preset.field.depth': 'Depth in millimetres',
	'designer.preset.field.diameter': 'Diameter in millimetres',
	'designer.preset.field.length': 'Length in millimetres',
	'designer.preset.field.radius': 'Outer radius in millimetres',
	'designer.preset.field.sweep': 'Sweep in degrees',
	'designer.preset.field.seats': 'Seats',
	'designer.preset.field.canopy': 'Canopy diameter in millimetres',
	'designer.preset.field.trunk': 'Trunk diameter in millimetres',
	'designer.preset.field.pillows': 'Pillows',
	'preset.rect-table': 'Rectangular table',
	'preset.round-table': 'Round table',
	'preset.oval-table': 'Oval table',
	'preset.curved-table': 'Curved table',
	'preset.chair': 'Chair',
	'preset.armchair': 'Armchair',
	'preset.sofa': 'Sofa',
	'preset.toilet': 'Toilet',
	'preset.washbasin': 'Washbasin',
	'preset.shower-tray': 'Shower tray',
	'preset.bathtub': 'Bathtub',
	'preset.tree': 'Tree',
	'preset.shrub': 'Shrub',
	'preset.bed': 'Bed',
```

Add to `assetSymbolsDe`:

```ts
	'designer.inspector.start-preset': 'Mit Vorlage beginnen',
	'designer.preset.title': 'Mit einer Vorlage beginnen',
	'designer.preset.picker': 'Vorlage',
	'designer.preset.replaces': 'Dies ersetzt den aktuellen Entwurf. Rückgängig stellt ihn wieder her.',
	'designer.preset.apply': 'Vorlage anwenden',
	'designer.preset.preview': 'Vorschau der Vorlage',
	'designer.preset.group.tables': 'Tische',
	'designer.preset.group.seating': 'Sitzmöbel',
	'designer.preset.group.sanitary': 'Bad',
	'designer.preset.group.plants-beds': 'Pflanzen und Betten',
	'designer.preset.field.width': 'Breite in Millimetern',
	'designer.preset.field.depth': 'Tiefe in Millimetern',
	'designer.preset.field.diameter': 'Durchmesser in Millimetern',
	'designer.preset.field.length': 'Länge in Millimetern',
	'designer.preset.field.radius': 'Außenradius in Millimetern',
	'designer.preset.field.sweep': 'Bogenwinkel in Grad',
	'designer.preset.field.seats': 'Sitzplätze',
	'designer.preset.field.canopy': 'Kronendurchmesser in Millimetern',
	'designer.preset.field.trunk': 'Stammdurchmesser in Millimetern',
	'designer.preset.field.pillows': 'Kissen',
	'preset.rect-table': 'Rechteckiger Tisch',
	'preset.round-table': 'Runder Tisch',
	'preset.oval-table': 'Ovaler Tisch',
	'preset.curved-table': 'Geschwungener Tisch',
	'preset.chair': 'Stuhl',
	'preset.armchair': 'Sessel',
	'preset.sofa': 'Sofa',
	'preset.toilet': 'WC',
	'preset.washbasin': 'Waschbecken',
	'preset.shower-tray': 'Duschwanne',
	'preset.bathtub': 'Badewanne',
	'preset.tree': 'Baum',
	'preset.shrub': 'Strauch',
	'preset.bed': 'Bett',
```

- [ ] **Step 2: Write the failing tests**

`tests/presentation/designer/presetPreview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { presetPreview } from '../../../src/presentation/designer/presets/presetPreview';
import { expectOk } from '../../helpers/domain';

const built = (id: string) => {
	const preset = ASSET_PRESETS.find((item) => item.id === id);
	if (preset === undefined) throw new Error(`no preset ${id}`);
	return expectOk(preset.build(defaultValues(preset)));
};

describe('presetPreview', () => {
	it('frames the footprint with a margin', () => {
		// rect-table defaults to 1600 × 900: extent ±800 / ±450, margin 5% of the longer side = 80.
		const [x, y, width, height] = presetPreview(built('rect-table')).viewBox.split(' ').map(Number);
		expect([x, y, width, height]).toEqual([-880, -530, 1760, 1060]);
	});

	it('draws one closed path per detail and says which are dashed', () => {
		const preview = presetPreview(built('toilet'));
		expect(preview.footprint.startsWith('M')).toBe(true);
		expect(preview.footprint.endsWith('Z')).toBe(true);
		expect(preview.details.map((detail) => detail.dashed)).toEqual([false, false]);
	});
});
```

`tests/presentation/designer/assetPresetForm.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetPresetForm from '../../../src/presentation/designer/presets/AssetPresetForm.vue';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { t } from '../../../src/presentation/i18n/strings';
import { expectOk } from '../../helpers/domain';

describe('AssetPresetForm', () => {
	it('submits the first preset at its default values', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		expect(wrapper.find('svg.rp-asset-preset-preview').exists()).toBe(true);
		await wrapper.find('form').trigger('submit');

		const [[shape]] = wrapper.emitted('submit') as [[AssetShape]];
		expect(expectOk(dimensionsOf(shape.footprint))).toEqual({ width: 1600, depth: 900 });
	});

	it('resets the fields to the chosen preset’s defaults', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.find('select[name="preset"]').setValue('round-table');

		expect((wrapper.find('input[name="diameter"]').element as HTMLInputElement).value).toBe('900');
		expect(wrapper.find('input[name="width"]').exists()).toBe(false);
	});

	it('shows the refusal and submits nothing for a value out of range', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.find('input[name="width"]').setValue('0');
		await wrapper.find('form').trigger('submit');

		expect(wrapper.text()).toContain(t('en', 'asset.preset-value-out-of-range'));
		expect(wrapper.emitted('submit')).toBeUndefined();
	});

	it('warns that the current design will be replaced when there is one', () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: true } });

		expect(wrapper.text()).toContain(t('en', 'designer.preset.replaces'));
	});
});
```

`tests/presentation/designer/assetPresetFlow.test.ts` — start the file with the directive block `/**\n * @vitest-environment jsdom\n */`, then copy the imports, the two `install*` calls, `context(harness)` and `mountDesigner(harness)` **verbatim from `tests/presentation/designer/assetDimensions.test.ts` lines 15–37 and 55–92** (not `withBackground`; drop the `isOk` and `t` imports, which this file does not use), then:

```ts
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';

describe('the designer’s preset dialog', () => {
	it('writes the shape the form submits to the open asset', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		const toilet = ASSET_PRESETS.find((preset) => preset.id === 'toilet');
		if (toilet === undefined) throw new Error('the catalogue has a toilet');
		const shape = expectOk(toilet.build(defaultValues(toilet)));
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ action: 'submit', values: shape } as never);

		await wrapper.find('.rp-designer-start-preset').trigger('click');
		await flushPromises();

		expect(vi.mocked(dialogs.openDialog).mock.calls[0][0]).toMatchObject({ kind: 'form', props: { replaces: true } });
		expect((await harness.document()).shape?.details.map((detail) => detail.name)).toEqual(['tank', 'bowl']);
	});

	it('writes nothing when the dialog is cancelled', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue('cancel' as never);

		await wrapper.find('.rp-designer-start-preset').trigger('click');
		await flushPromises();

		expect((await harness.document()).shape?.footprint.points).toEqual(drawn().footprint.points);
	});
});
```

In `tests/presentation/designer/designerInspector.test.ts`:
- declare `let startFromPreset: ReturnType<typeof vi.fn<() => Promise<void>>>;`, set it in `beforeEach` with `vi.fn<() => Promise<void>>().mockResolvedValue(undefined)`, and pass `startFromPreset,` in `mountInspector`'s props
- add:

```ts
	it('offers a preset as a way to start or replace a design', async () => {
		const wrapper = mountInspector();

		expect(wrapper.find('.rp-designer-start-preset').text()).toBe(t('en', 'designer.inspector.start-preset'));
		await wrapper.find('.rp-designer-start-preset').trigger('click');

		expect(startFromPreset).toHaveBeenCalledTimes(1);
	});
```

In `tests/harness/accessibilityDialogs.test.ts`, import `AssetPresetForm` from `'../../src/presentation/designer/presets/AssetPresetForm.vue'` and add inside the top-level `describe`:

```ts
	it('reports no semantic violations with the asset preset form open', async () => {
		const { view } = mountHarness(document.body);
		await flushPromises();

		void useDialogStore().openDialog({
			kind: 'form',
			title: 'Start from a preset',
			component: AssetPresetForm,
			props: { replaces: true },
		});
		await nextTick();

		expect(view.contentEl.querySelector('.rp-asset-preset-form')).not.toBeNull();
		const results = await axe.run(view.contentEl, runOptions);
		expect(results.violations).toEqual([]);
	});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/presentation/designer/presetPreview.test.ts tests/presentation/designer/assetPresetForm.test.ts tests/presentation/designer/assetPresetFlow.test.ts tests/presentation/designer/designerInspector.test.ts`
Expected: FAIL — modules and the button do not exist.

- [ ] **Step 4: Create `presetPreview.ts`**

```ts
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { extentOf } from '../../../core/geometry/operations';
import type { AssetShape } from '../../../domain/asset/AssetShape';

/** What the preset dialog's SVG draws: world millimetres in, a viewBox and closed paths out. */
export interface PresetPreview {
	readonly viewBox: string;
	readonly footprint: string;
	readonly details: readonly { readonly d: string; readonly dashed: boolean }[];
}

/** 2 mm of sagitta is invisible in a 160px preview of a metre-sized object. */
const PREVIEW_TOLERANCE_MM = 2;
const MARGIN_RATIO = 0.05;

const path = (outline: CurvedPolygon): string =>
	`M${polygonPolyline(outline, PREVIEW_TOLERANCE_MM).map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L')} Z`;

export function presetPreview(shape: AssetShape): PresetPreview {
	const { minX, minY, maxX, maxY } = extentOf(polygonPolyline(shape.footprint, PREVIEW_TOLERANCE_MM));
	const margin = Math.max(maxX - minX, maxY - minY) * MARGIN_RATIO;
	return {
		viewBox: `${minX - margin} ${minY - margin} ${maxX - minX + 2 * margin} ${maxY - minY + 2 * margin}`,
		footprint: path(shape.footprint),
		details: shape.details.map((detail) => ({ d: path(detail.outline), dashed: detail.line === 'dashed' })),
	};
}
```

- [ ] **Step 5: Create `AssetPresetForm.vue`**

```vue
<script setup lang="ts">
/**
 * The preset picker "Start from preset" opens (asset designer symbols spec, Decision 8). Mounted
 * inside `FormDialog` under the existing `kind: 'form'`; it lives here, not in
 * `presentation/dialogs/`, because that directory holds no field knowledge.
 *
 * It dispatches nothing: `submit` hands the built `AssetShape` to `AssetDesignerRoot`, which writes
 * it through the reversible `setShape` edit — the split `AssetDimensionsDialog` already draws.
 */
import { computed, ref, shallowRef } from 'vue';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { ASSET_PRESETS, PRESET_GROUPS } from '../../../domain/asset/presets/catalogue';
import { defaultValues, type AssetPreset, type PresetFieldKey } from '../../../domain/asset/presets/presetGeometry';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { presetPreview } from './presetPreview';

defineProps<{ replaces: boolean }>();
const emit = defineEmits<{ submit: [shape: AssetShape] }>();

const groups = PRESET_GROUPS.map((group) => ({ group, presets: ASSET_PRESETS.filter((item) => item.group === group) }));
// `[0]`, not `.at(0)`: `lib` is ES2021 and `Array.prototype.at` is ES2022.
const preset = shallowRef<AssetPreset | undefined>(ASSET_PRESETS[0]);

/** `string | number` for the reason `KnownDistanceForm` gives: `v-model` on a number input yields either. */
const typed = ref<Partial<Record<PresetFieldKey, string | number>>>(preset.value === undefined ? {} : { ...defaultValues(preset.value) });

function choose(id: string): void {
	const next = ASSET_PRESETS.find((item) => item.id === id);
	if (next === undefined) return;
	preset.value = next;
	typed.value = { ...defaultValues(next) };
}

const built = computed(() => {
	const current = preset.value;
	if (current === undefined) return null;
	return current.build(Object.fromEntries(current.fields.map((field) => [field.key, Number(String(typed.value[field.key] ?? '').trim())])));
});
const preview = computed(() => (built.value?.ok === true ? presetPreview(built.value.value) : null));
const refusal = computed(() => (built.value === null || built.value.ok ? null : trError(built.value.error)));

function onSubmit(): void {
	if (built.value?.ok === true) emit('submit', built.value.value);
}
</script>

<template>
	<form
		class="rp-dialog-form rp-asset-preset-form"
		@submit.prevent="onSubmit"
	>
		<p
			v-if="replaces"
			class="rp-dialog-warning"
		>
			{{ tr('designer.preset.replaces') }}
		</p>
		<label class="rp-dialog-field">
			{{ tr('designer.preset.picker') }}
			<select
				name="preset"
				:value="preset?.id"
				@change="choose(($event.target as HTMLSelectElement).value)"
			>
				<optgroup
					v-for="entry in groups"
					:key="entry.group"
					:label="tr(`designer.preset.group.${entry.group}`)"
				>
					<option
						v-for="item in entry.presets"
						:key="item.id"
						:value="item.id"
					>
						{{ tr(`preset.${item.id}`) }}
					</option>
				</optgroup>
			</select>
		</label>
		<template v-if="preset !== undefined">
			<label
				v-for="field in preset.fields"
				:key="`${preset.id}-${field.key}`"
				class="rp-dialog-field"
			>
				{{ tr(`designer.preset.field.${field.key}`) }}
				<input
					v-model="typed[field.key]"
					type="number"
					:name="field.key"
					:min="field.min"
					:max="field.max"
					:step="field.kind === 'count' ? 1 : 'any'"
					inputmode="decimal"
				>
			</label>
		</template>
		<svg
			v-if="preview !== null"
			class="rp-asset-preset-preview"
			:viewBox="preview.viewBox"
			role="img"
			:aria-label="tr('designer.preset.preview')"
		>
			<path
				class="rp-asset-preset-preview__footprint"
				:d="preview.footprint"
			/>
			<path
				v-for="(detail, index) in preview.details"
				:key="index"
				class="rp-asset-preset-preview__detail"
				:class="{ 'rp-asset-preset-preview__detail--dashed': detail.dashed }"
				:d="detail.d"
			/>
		</svg>
		<p
			v-if="refusal !== null"
			class="rp-dialog-warning"
		>
			{{ refusal }}
		</p>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="built === null || !built.ok"
			>
				{{ tr('designer.preset.apply') }}
			</button>
		</div>
	</form>
</template>
```

- [ ] **Step 6: The inspector button — `DesignerInspector.vue`**

Add `startFromPreset: () => Promise<void>;` to `defineProps`. After the `rp-designer-edit-dimensions` `<button>`:

```vue
		<button
			type="button"
			class="rp-designer-start-preset"
			@click="() => void startFromPreset()"
		>
			{{ tr('designer.inspector.start-preset') }}
		</button>
```

- [ ] **Step 7: Open it — `AssetDesignerRoot.vue`**

- change `import { computed, onMounted, ref } from 'vue';` to `import { computed, markRaw, onMounted, ref } from 'vue';`
- add `import AssetPresetForm from './presets/AssetPresetForm.vue';` and `import type { AssetShape } from '../../domain/asset/AssetShape';`
- after `editDimensions`, add:

```ts
/** `FormDialog` carries its payload as `unknown`; the command validates the shape itself. */
function isShape(values: unknown): values is AssetShape {
	return typeof values === 'object' && values !== null && 'footprint' in values && 'details' in values;
}

/**
 * The symbols spec's preset gesture: open the picker, write what it builds. Guarded like
 * `editDimensions` against a second dialog, and a cancel writes nothing.
 */
async function startFromPreset(): Promise<void> {
	if (dialogs.current !== null) return;
	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('designer.preset.title'),
		component: markRaw(AssetPresetForm),
		props: { replaces: (design.value?.shape ?? null) !== null },
	});
	if (result === 'cancel' || !isShape(result.values)) return;
	await runtime.applyShape(result.values);
}
```

- on `<DesignerInspector …>` add `:start-from-preset="startFromPreset"`.

- [ ] **Step 8: Styles — `styles/designer.css`**

Turn each of the three `.rp-designer-inspector .rp-designer-edit-dimensions` rules into a selector list covering the new button, e.g.

```css
.rp-designer-inspector .rp-designer-edit-dimensions,
.rp-designer-inspector .rp-designer-start-preset {
```

(and the same for `:hover` and `:focus-visible`). Then append:

```css
/* The preset dialog's preview (asset designer symbols spec). Colours are theme variables. */
.rp-asset-preset-form .rp-asset-preset-preview {
	width: 100%;
	height: 160px;
	background-color: var(--background-secondary);
	border-radius: var(--radius-s);
}

.rp-asset-preset-preview .rp-asset-preset-preview__footprint,
.rp-asset-preset-preview .rp-asset-preset-preview__detail {
	fill: var(--background-primary);
	stroke: var(--text-normal);
	stroke-width: 1.5px;
	vector-effect: non-scaling-stroke;
}

.rp-asset-preset-preview .rp-asset-preset-preview__detail--dashed {
	fill: none;
	stroke-dasharray: 4 3;
}
```

- [ ] **Step 9: Run the tests**

Run: `npm run check:fast -- tests/presentation tests/harness/accessibilityDialogs.test.ts tests/build/buttonSpecificity.test.ts tests/build/styles.test.ts`
Expected: PASS. Then `npx eslint src/presentation/designer src/presentation/i18n/locales/en/assetSymbols.ts src/presentation/i18n/locales/de/assetSymbols.ts` — clean (sentence case, Vue formatting).

- [ ] **Step 10: Commit**

```bash
git add src/presentation styles/designer.css tests/presentation tests/harness/accessibilityDialogs.test.ts
git commit -m "feat(designer): start an asset from a preset

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Captures, manual steps, backlog

**Files:**
- Modify: `tests/harness/assetDesigner.ts`, `tests/harness/page.ts`
- Modify: `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts`
- Modify: `docs/tests/cases/Design an Asset.md`
- Create: `docs/requirements/Start an asset from a preset.md`

**Interfaces:**
- Consumes: `ASSET_PRESETS`, `defaultValues`, `dimensionsOf`
- Produces: `mountAssetDesignerHarness(root: HTMLElement, presetId?: string | null)`; harness knob `?preset=<PresetId>`; four shots

- [ ] **Step 1: Write the failing test**

In `tests/build/harness-shot.test.ts`, in the sorted `declared` list, insert after `'asset-designer-narrow',`:

```ts
			'asset-designer-preset-curved-table',
			'asset-designer-preset-sofa',
			'asset-designer-preset-toilet',
			'asset-designer-preset-tree',
```

and add a pin beside the `'takes the asset designer at a sidebar width…'` case:

```ts
	it('seeds the designer with a preset through the harness knob', () => {
		expect(shot('asset-designer-preset-toilet')).toMatchObject({ query: '?view=asset-designer&preset=toilet' });
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/build/harness-shot.test.ts`
Expected: FAIL — the four names are not declared in `SHOTS`.

- [ ] **Step 3: The harness knob**

`tests/harness/assetDesigner.ts`:
- imports: `import { dimensionsOf } from '../../src/domain/asset/AssetShape';`, `import { ASSET_PRESETS } from '../../src/domain/asset/presets/catalogue';`, `import { defaultValues } from '../../src/domain/asset/presets/presetGeometry';`
- add before `assetDesignerHarnessDeps`:

```ts
/**
 * `?preset=<id>` seeds the fixture with that preset at its defaults, so a capture draws curves and
 * details instead of the empty state (asset designer symbols spec, Testing). An unknown id is the
 * shapeless fixture.
 */
function designFor(presetId: string | null): AssetDesignDto {
	const preset = ASSET_PRESETS.find((item) => item.id === presetId);
	if (preset === undefined) return HARNESS_ASSET_DESIGN;
	const built = preset.build(defaultValues(preset));
	if (!built.ok) return HARNESS_ASSET_DESIGN;
	const measured = dimensionsOf(built.value.footprint);
	return { ...HARNESS_ASSET_DESIGN, shape: built.value, dimensions: measured.ok ? measured.value : null };
}
```

- `assetDesignerHarnessDeps(presetId: string | null)`; its `getAssetDesign` becomes `() => Promise.resolve(ok(structuredClone(designFor(presetId))))`
- `export function mountAssetDesignerHarness(root: HTMLElement, presetId: string | null = null): MountedAssetDesigner` and pass `assetDesignerHarnessDeps(presetId)`.

`tests/harness/page.ts`: change `mountAssetDesignerHarness(document.body).view` to `mountAssetDesignerHarness(document.body, params.get('preset')).view`.

`scripts/harness-shot.mjs`, after the `asset-designer-narrow` entry:

```js
	// The symbols spec's presets, one per group, seeded through the designer harness's `?preset=` knob so
	// the canvas draws curves and details rather than the empty state.
	{ name: 'asset-designer-preset-curved-table', query: '?view=asset-designer&preset=curved-table', selector: ASSET_DESIGNER_VIEW },
	{ name: 'asset-designer-preset-sofa', query: '?view=asset-designer&preset=sofa', selector: ASSET_DESIGNER_VIEW },
	{ name: 'asset-designer-preset-toilet', query: '?view=asset-designer&preset=toilet', selector: ASSET_DESIGNER_VIEW },
	{ name: 'asset-designer-preset-tree', query: '?view=asset-designer&preset=tree', selector: ASSET_DESIGNER_VIEW },
```

- [ ] **Step 4: Run the tests**

Run: `npm run check:fast -- tests/build/harness-shot.test.ts tests/harness`
Expected: PASS.

- [ ] **Step 5: Capture and look**

Run: `npm run harness-shot`
Expected: `harness-shots/asset-designer-preset-{curved-table,sofa,toilet,tree}.png` exist. Open each and check: arcs are smooth; details sit inside the outline; solid details cover (a sofa's cushions are not crossed by other lines); the toilet's bowl points down the screen (+y). If Chromium is missing and cannot be installed, set `RP_CHROMIUM_EXECUTABLE` to a local Chrome, or report the capture as not run — do not claim it.

- [ ] **Step 6: Manual steps — `docs/tests/cases/Design an Asset.md`**

Append these rows to the `## Steps` table after its last row (if that row is not 24, renumber these four to follow it):

```markdown
| 25 | `suite` | On an asset with a traced footprint, click "Start from preset" in the Inspector, choose Toilet, keep the defaults and press "Apply preset" | The dialog warns that the current design is replaced; afterwards the canvas draws a round-fronted outline with a tank and a bowl inside it, and Dimensions read 380 × 700 mm | `SetAssetShape` through the reversible geometry edit, and the details layer drawing what the preset built |
| 26 | `suite` | Press Undo | The traced footprint returns and the tank and bowl are gone | The whole-document inverse restoring a shape the preset replaced, details included |
| 27 | `obsidian` | Place that toilet on a plan by snapping it to a wall | The tank sits against the wall, the bowl points into the room, and the plan draws the tank and bowl inside the outline | The +y front convention meeting `backDepth` on a curved footprint, and `assetShapeConfig`'s details in a real Konva stage — no harness capture covers a placed symbol |
| 28 | `browser` | Start from preset → Curved table, set Sweep to 180, apply, and zoom the designer in on one end of the arc | The arc stays smooth, with no visible facets | The zoom-aware arc tolerance (`ARC_TOLERANCE_PX`) rather than a fixed world tolerance |
```

- [ ] **Step 7: Backlog item — `docs/requirements/Start an asset from a preset.md`**

```markdown
---
type: PBI
parent: "[[Asset designer]]"
order: 8.8
status: In progress
started: "2026-09-13"
finished: ""
horizon: MVP
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Start an asset from a preset

## Actor

[[Private renovator]] who needs a chair, a round table, a toilet or a tree on a plan and does not
have a spec sheet to trace.

## Main flow

1. The renovator opens an asset in the designer and chooses "Start from preset".
2. They pick a preset — tables, seating, bathroom, or plants and beds — and type its dimensions,
   watching a preview.
3. They apply it: the asset's shape becomes the preset's outline, clearance and interior details,
   drawn in the designer, in the library and on every plan the asset is placed on.

## Extensions

- **2a** — A value is outside the preset's range, or the values cannot describe a shape. The
  preview disappears, the reason is shown, and applying is refused.
- **3a** — The asset already had a design. It is replaced; undo restores it.

## Acceptance criteria

1. Fourteen presets are offered, grouped as tables, seating, bathroom, and plants and beds.
2. An applied preset is one undo entry.
3. A preset's width and depth are the asset's derived dimensions.
4. Curved outlines draw as arcs in the designer, the library and on plans.

## Sources

- `docs/superpowers/specs/2026-09-13-asset-designer-symbols-design.md`
- `docs/superpowers/plans/2026-09-13-asset-designer-symbols-pr1.md`
```

- [ ] **Step 8: Commit**

```bash
git add tests/harness scripts/harness-shot.mjs tests/build/harness-shot.test.ts "docs/tests/cases/Design an Asset.md" "docs/requirements/Start an asset from a preset.md"
git commit -m "test(harness): preset captures, manual preset steps and the backlog item

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## After the last task

Push the branch and open the PR; CI runs `npm run check` on all four legs. Read `coverage-final.json` for the changed files if the coverage floor reddens (a single untested arm in a tight metric fails outright).
