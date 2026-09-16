# Asset designer consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set dimensions resizes a measured design instead of replacing it with a rectangle, a typed size lands on curved geometry, and the overdue "recoverable shape" obligation is settled as a snapshot at approval.

**Architecture:** The secant solver that already lands a typed extent for one selected part moves into `domain/asset/` and gains a second caller — a whole-design `scaleDesignToDimensions`. The designer's dimensions gesture then scales whenever there is a footprint in real millimetres and writes a rectangle only when there is no shape or the footprint is still tracing pixels. Nothing persisted changes; the remaining work is documentation.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Konva, Vitest (node + jsdom), ESLint/oxlint.

**Spec:** [`docs/superpowers/specs/2026-09-16-asset-designer-consolidate-design.md`](../specs/2026-09-16-asset-designer-consolidate-design.md)

## Global Constraints

- **Layers:** `presentation → application → domain → core`. `domain/` and `core/` may not import `vue`, `pinia`, `konva` or `obsidian`. `presentation/` may import `domain/`; never the reverse.
- **Gate:** `npm run check` is the definition of done and runs in CI on the pull request. Locally use `npm run check:fast -- <paths>` between edits. Never run two full gates at once.
- **Every user-visible string goes through `t`/`tr`**, and both `en.ts` and `de.ts` carry every key. Sentence case, no special characters.
- **A fake must not be kinder, thinner, harsher or faster than the real thing.**
- **Invariants stated in a comment get a test that is watched failing first** — revert the fix, see red, restore.
- **Coverage floors are 99/99/99/98** and only rise. Plan the test with the code.
- **Commit trailer** on every commit: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Address code by name, not by line number**, in comments and docs.
- **Budgets:** 400 lines per `src/` module (blank lines and comments not counted), 100 lines per function, complexity 16.

---

### Task 1: One scale solver, in the domain

`resizeToExtent` in `src/presentation/designer/selection/partExtent.ts` solves for the factor that lands a typed extent on an outline whose bulges are kept. Task 2 needs exactly that loop for the whole design, so it moves to `domain/` first, with its behaviour unchanged.

**Files:**
- Create: `src/domain/asset/scaleSolve.ts`
- Modify: `src/presentation/designer/selection/partExtent.ts`
- Create: `tests/domain/asset/scaleSolve.test.ts`
- Unchanged, and must stay green: `tests/presentation/designer/selection/partExtent.test.ts`

**Interfaces:**
- Consumes: `Result`, `ValidationError` from `core/`.
- Produces: `solveScale<T>(attempt: ScaleAttempt<T>): Result<T, ValidationError>` and `interface ScaleAttempt<T> { readonly start: number; readonly target: number; readonly apply: (factor: number) => Result<T, ValidationError>; readonly measure: (value: T) => number }`, both exported from `src/domain/asset/scaleSolve.ts`. Task 2 calls it.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/asset/scaleSolve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assetError } from '../../../src/domain/asset/Asset.errors';
import { solveScale } from '../../../src/domain/asset/scaleSolve';
import { err, ok } from '../../../src/core/result/Result';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * The secant `resizeToExtent` has always used, with its subject made explicit: a factor is solved
 * for because the thing being measured is not linear in it. Driven here against plain numbers so
 * the loop's own rules — exact at step one when it IS linear, the nearest landing when the target
 * cannot be reached, a refusal only when nothing landed — are checked without a polygon in the way.
 */
describe('solveScale', () => {
	it('lands a linear extent exactly at the first factor', () => {
		const tries: number[] = [];

		const solved = expectOk(
			solveScale({
				start: 100,
				target: 250,
				apply: (factor) => {
					tries.push(factor);
					return ok(100 * factor);
				},
				measure: (extent) => extent,
			}),
		);

		expect(solved).toBeCloseTo(250, 9);
		expect(tries).toEqual([2.5]);
	});

	it('converges on an extent that is not linear in the factor', () => {
		// Half the growth arrives through a square root, the way an arc's sagitta follows its chord.
		const grown = (factor: number): number => 50 * factor + 50 * Math.sqrt(factor);

		const solved = expectOk(
			solveScale({ start: 100, target: 250, apply: (factor) => ok(grown(factor)), measure: (extent) => extent }),
		);

		expect(solved).toBeCloseTo(250, 6);
	});

	it('answers the nearest landing when the target cannot be reached', () => {
		// Never above 200, whatever the factor — a four-arc circle asked to narrow past its floor.
		const capped = (factor: number): number => 200 - 100 / (1 + factor);

		const solved = expectOk(
			solveScale({ start: 100, target: 900, apply: (factor) => ok(capped(factor)), measure: (extent) => extent }),
		);

		expect(solved).toBeGreaterThan(100);
		expect(solved).toBeLessThan(200);
	});

	it('refuses when the first factor is refused', () => {
		const refusal = assetError('invalid-scale', 'A scale factor must be a finite positive number.');

		const answered = solveScale({
			start: 100,
			target: -5,
			apply: () => err(refusal),
			measure: () => 0,
		});

		expect(expectErr(answered).code).toBe('asset.invalid-scale');
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npm run check:fast -- tests/domain/asset/scaleSolve.test.ts
```

Expected: FAIL — cannot resolve `src/domain/asset/scaleSolve`.

- [ ] **Step 3: Write the solver**

Create `src/domain/asset/scaleSolve.ts`:

```ts
import type { ValidationError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';

/** A solve this close to the typed extent has landed it; far below the whole millimetres any inspector shows. */
const TOLERANCE_MM = 1e-6;
/** The first guess plus three secant corrections. */
const MAX_STEPS = 4;

/** One axis being solved: where it starts at factor 1, where it should land, how a factor is applied, and how the result is measured. */
export interface ScaleAttempt<T> {
	readonly start: number;
	readonly target: number;
	readonly apply: (factor: number) => Result<T, ValidationError>;
	readonly measure: (value: T) => number;
}

/**
 * The factor that lands `target`, solved rather than divided.
 *
 * Both callers scale geometry whose BULGES are kept, so an arc keeps bowing by a sagitta that follows
 * its chord: `target / start` lands a straight outline exactly and misses a curved one — the toilet
 * bowl's Depth 900 as a plain factor measures 596. So the factor is solved by a secant over the
 * measured extent: exact at the first step whenever the extent is linear in the factor, and within
 * `TOLERANCE_MM` in a few more for an arc whose chord turns with the scale.
 *
 * **Some extents cannot be reached at all.** A four-arc circle cannot be narrowed below about a fifth
 * of its diameter with a positive factor, and the secant can step past zero on the way. A step past
 * zero is halved toward zero instead (a negative factor is a mirror, which every caller refuses), and
 * the answer is the NEAREST attempt that landed — never a refusal worded as a scale to nothing. A
 * refusal comes back only when nothing landed at all, which is `apply`'s own answer to the first factor.
 *
 * ponytail: at most `MAX_STEPS` attempts; something needing more lands near rather than on the target.
 */
export function solveScale<T>(attempt: ScaleAttempt<T>): Result<T, ValidationError> {
	const { start, target, apply, measure } = attempt;
	const landed: { readonly result: Result<T, ValidationError>; readonly miss: number }[] = [];
	let previous = { factor: 1, extent: start };
	let factor = target / start;
	let result = apply(factor);
	for (let step = 1; result.ok; step += 1) {
		const extent = measure(result.value);
		landed.push({ result, miss: Math.abs(extent - target) });
		if (Math.abs(extent - target) <= TOLERANCE_MM || step === MAX_STEPS) break;
		const next = factor + ((target - extent) * (factor - previous.factor)) / (extent - previous.extent);
		previous = { factor, extent };
		factor = next > 0 ? next : factor / 2;
		result = apply(factor);
	}
	const misses = landed.map((tried) => tried.miss);
	return landed.length === 0 ? result : landed[misses.indexOf(Math.min(...misses))].result;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm run check:fast -- tests/domain/asset/scaleSolve.test.ts
```

Expected: PASS, four cases.

- [ ] **Step 5: Point `resizeToExtent` at the solver**

In `src/presentation/designer/selection/partExtent.ts`, delete the `TOLERANCE_MM` and `MAX_STEPS` constants and replace the body of `resizeToExtent` (keep `partBox` and `withPartBox` exactly as they are):

```ts
import { solveScale } from '../../../domain/asset/scaleSolve';
```

```ts
/**
 * One part resized along one axis about its box centre so its curve-aware extent is `target` (asset
 * designer symbols spec, "Inspector for the selection").
 *
 * The factor is SOLVED rather than divided, because `resizeBox` carries bulges — `solveScale` in
 * `domain/asset/` owns that loop and the ceilings it has, and the whole-design Set dimensions path
 * (`scaleDesignToDimensions`) solves through the same function, so the two cannot disagree about what
 * a typed size means.
 */
export function resizeToExtent(
	shape: AssetShape,
	part: OutlinePart,
	axis: 'width' | 'depth',
	target: number,
): Result<AssetShape, ValidationError> {
	return withPartBox(shape, part, (start) =>
		solveScale({
			start: start[axis],
			target,
			apply: (factor) =>
				resizeBox(shape, part, axis === 'width' ? { sx: factor, sy: 1 } : { sx: 1, sy: factor }, start.centre),
			// The part is there: `resizeBox` just answered it.
			measure: (resized) => partBox(outlineOf(resized, part) as CurvedPolygon)[axis],
		}),
	);
}
```

- [ ] **Step 6: Run the existing part-solver suite unchanged**

```bash
npm run check:fast -- tests/presentation/designer/selection/partExtent.test.ts tests/presentation/designer/designerSelectionInspector.test.ts
```

Expected: PASS, with no edit to either test file. That is the evidence the extraction preserved behaviour. If a case fails, the extraction is wrong — do not adjust the test.

- [ ] **Step 7: Commit**

```bash
git add src/domain/asset/scaleSolve.ts src/presentation/designer/selection/partExtent.ts tests/domain/asset/scaleSolve.test.ts
git commit -m "refactor(asset): share the typed-extent solver from the domain

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: A typed size lands on a curved design

`scaleDesign` uses the plain ratio, so Set dimensions on a design with curved edges lands the wrong size — the defect the part inspector already fixed for one part. This adds the whole-design equivalent, and pins the deliberate difference between how the designer and a plan stretch an arc.

**Files:**
- Modify: `src/domain/asset/shapeEdits.ts` (add `scaleDesignToDimensions` beside `scaleDesign`)
- Modify: `src/domain/spatial/assetPlacement.ts` (header comment only)
- Modify: `tests/domain/asset/shapeEdits.test.ts`
- Create: `tests/domain/asset/stretchParity.test.ts`

**Interfaces:**
- Consumes: `solveScale` / `ScaleAttempt` from Task 1; `scaleDesign`, `dimensionsOf`, `assetError`.
- Produces: `scaleDesignToDimensions(shape: AssetShape, width: number, depth: number): Result<AssetShape, ValidationError>`, exported from `src/domain/asset/shapeEdits.ts`. Task 3 calls it.

- [ ] **Step 1: Write the failing tests**

Append to `describe('scaleDesign', …)`'s file, `tests/domain/asset/shapeEdits.test.ts`, a new top-level block (and add `scaleDesignToDimensions` to the existing import list from `shapeEdits`, and `circle` is already imported):

```ts
describe('scaleDesignToDimensions', () => {
	it('lands a straight design exactly and scales every part about the anchor', () => {
		const scaled = expectOk(scaleDesignToDimensions(editableShape(), 2000, 300));

		const box = expectOk(boundingBoxOf(scaled.footprint));
		expect([box.max.x - box.min.x, box.max.y - box.min.y]).toEqual([2000, 300]);
		expect(scaled.anchor).toEqual({ x: 0, y: 0 });
		// 1400 x 1000 clearance scaled by the same 2 x 0.5 the footprint took.
		const clearance = expectOk(boundingBoxOf(expectDefined(scaled.clearance, 'the clearance')));
		expect([clearance.max.x - clearance.min.x, clearance.max.y - clearance.min.y]).toEqual([2800, 500]);
		expect(scaled.details[1].pending).toBe(true);
	});

	it('lands a curved footprint the plain ratio would miss', () => {
		const round = editableShape({ footprint: circle(1000), clearance: null, details: [] });

		const plain = expectOk(scaleDesign(round, 1.4, 1));
		const plainBox = expectOk(boundingBoxOf(plain.footprint));
		// The miss this function exists for, measured rather than asserted as "close".
		expect(Math.abs(plainBox.max.x - plainBox.min.x - 1400)).toBeGreaterThan(1);

		const solved = expectOk(scaleDesignToDimensions(round, 1400, 1000));
		const box = expectOk(boundingBoxOf(solved.footprint));
		expect(box.max.x - box.min.x).toBeCloseTo(1400, 3);
		expect(box.max.y - box.min.y).toBeCloseTo(1000, 3);
		expect(solved.footprint.bulges).toEqual(round.footprint.bulges);
	});

	it('refuses a size that is not a finite positive number', () => {
		expect(expectErr(scaleDesignToDimensions(editableShape(), 0, 300)).code).toBe('asset.invalid-scale');
	});
});
```

Add `expectDefined` to the `../../helpers/domain` import in that file if it is not there already.

- [ ] **Step 2: Run them and watch them fail**

```bash
npm run check:fast -- tests/domain/asset/shapeEdits.test.ts
```

Expected: FAIL — `scaleDesignToDimensions` is not exported.

- [ ] **Step 3: Write `scaleDesignToDimensions`**

In `src/domain/asset/shapeEdits.ts`, extend the `AssetShape` import to `import { dimensionsOf, validateAssetShape, type AssetShape, type Dimensions } from './AssetShape';`, add `import { solveScale } from './scaleSolve';`, and add below `scaleDesign`:

```ts
/** The design and what its footprint measures, carried together so a solve never re-asks for a size that could overflow. */
interface Sized {
	readonly shape: AssetShape;
	readonly dimensions: Dimensions;
}

function sized(shape: AssetShape): Result<Sized, ValidationError> {
	const dimensions = dimensionsOf(shape.footprint);
	if (isErr(dimensions)) return err(assetError('invalid-footprint', dimensions.error.message));
	return ok({ shape, dimensions: dimensions.value });
}

/**
 * The design scaled about its anchor until its FOOTPRINT measures `width` x `depth` — what Set
 * dimensions does to a design that already has real millimetres in it.
 *
 * Solved rather than divided, through `solveScale`, for the reason that function states: bulges are
 * kept, so an arc's reach follows its chord and a plain ratio misses on anything curved.
 *
 * **One axis at a time, three passes, because the axes are COUPLED.** Scaling y changes the chord of
 * an arc that bows in x, so its x-extent moves with it: x, then y, then x again, each solved on the
 * result of the last, and the answer is the pass whose combined miss is smallest rather than the last
 * one tried. A straight-sided design lands both axes exactly on the first pass and the later ones
 * change nothing.
 *
 * Its ceiling is `solveScale`'s: an unreachable extent lands near the typed value rather than on it.
 */
export function scaleDesignToDimensions(shape: AssetShape, width: number, depth: number): Result<AssetShape, ValidationError> {
	const start = sized(shape);
	if (isErr(start)) return start;
	const passes = [
		{ axis: 'width', target: width },
		{ axis: 'depth', target: depth },
		{ axis: 'width', target: width },
	] as const;
	let current = start.value;
	let best = current;
	let bestMiss = Infinity;
	for (const pass of passes) {
		const solved = solveScale<Sized>({
			start: current.dimensions[pass.axis],
			target: pass.target,
			apply: (factor) => {
				const scaled = scaleDesign(current.shape, pass.axis === 'width' ? factor : 1, pass.axis === 'width' ? 1 : factor);
				return isErr(scaled) ? scaled : sized(scaled.value);
			},
			measure: (candidate) => candidate.dimensions[pass.axis],
		});
		if (isErr(solved)) return solved;
		current = solved.value;
		const miss = Math.abs(current.dimensions.width - width) + Math.abs(current.dimensions.depth - depth);
		if (miss < bestMiss) {
			best = current;
			bestMiss = miss;
		}
	}
	return ok(best.shape);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npm run check:fast -- tests/domain/asset/shapeEdits.test.ts
```

Expected: PASS, including the three new cases.

- [ ] **Step 5: Write the parity pin**

Create `tests/domain/asset/stretchParity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { polygonPolyline } from '../../../src/core/geometry/curvePolyline';
import { circle } from '../../../src/domain/asset/presets/presetGeometry';
import { scaleDesignToDimensions } from '../../../src/domain/asset/shapeEdits';
import { placedOutline, placementPoints } from '../../../src/domain/spatial/assetPlacement';
import { editableShape } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';

/**
 * The designer and a plan approximate a STRETCHED ARC differently, deliberately (consolidation spec
 * §5): the designer keeps bulges, because it has to store its curves and a bulge cannot express an
 * ellipse, while a placement flattens first and stretches the polyline, because it stores nothing.
 *
 * What is GUARANTEED is the measurement: the same nominal size measures the same on both surfaces.
 * What is TOLERATED is the silhouette. This file pins both, so the day a `CurvedPolygon` learns
 * ellipses the second assertion fails and somebody deletes it on purpose.
 *
 * The plan's box is compared with a millimetre of slack because `placedOutline` flattens at a 1 mm
 * sagitta, which sits just inside the true arc.
 */
const ROUND = editableShape({ footprint: circle(1000), clearance: null, details: [] });
const WIDTH = 1400;
const DEPTH = 1000;

function box(points: readonly { readonly x: number; readonly y: number }[]) {
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

describe('a stretched arc on the two surfaces', () => {
	const designed = expectOk(scaleDesignToDimensions(ROUND, WIDTH, DEPTH));
	const placed = placedOutline({ points: placementPoints({ x: 0, y: 0 }, 0), size: { width: WIDTH, depth: DEPTH } }, ROUND);

	it('measures the same on both', () => {
		const designedBox = expectOk(boundingBoxOf(designed.footprint));
		expect(designedBox.max.x - designedBox.min.x).toBeCloseTo(WIDTH, 3);
		expect(designedBox.max.y - designedBox.min.y).toBeCloseTo(DEPTH, 3);

		const planBox = box(placed.footprint);
		expect(Math.abs(planBox.width - WIDTH)).toBeLessThan(1);
		expect(Math.abs(planBox.depth - DEPTH)).toBeLessThan(1);
	});

	it('draws a different silhouette, which is the tolerated approximation', () => {
		expect(polygonPolyline(designed.footprint, 1)).not.toEqual(placed.footprint);
	});
});
```

- [ ] **Step 6: Run it**

```bash
npm run check:fast -- tests/domain/asset/stretchParity.test.ts
```

Expected: PASS. If the first case fails, Task 2's solver is wrong; if the second passes only because both sides are empty, check the outlines have points before trusting it.

- [ ] **Step 7: Write the difference where the plan's rule lives**

In `src/domain/spatial/assetPlacement.ts`, extend the comment above `PLAN_ARC_TOLERANCE_MM` (keep the existing sentence and its `ponytail:` line):

```ts
/**
 * Arcs are flattened BEFORE placement, so every plan consumer keeps reading `Point[]` (symbols spec,
 * Rendering). 1 mm of sagitta is below a pixel at any zoom a plan is drawn at.
 *
 * Flattening first also makes a placement's own `size` a TRUE stretch, where the designer's
 * `scaleDesignToDimensions` keeps each bulge and leaves every arc circular through its new chord. The
 * same nominal size therefore measures the same on both surfaces and draws a slightly different
 * silhouette — deliberately, and pinned by `tests/domain/asset/stretchParity.test.ts`. The designer
 * cannot do what this does because it has to STORE its curves and a bulge cannot express an ellipse;
 * the trigger for closing the gap is native ellipse or path geometry in `CurvedPolygon`, which would
 * have to arrive for validation, bounds, hit testing, persistence and export at once.
 * ponytail: fixed world tolerance; pass the zoom in if a close-up ever shows facets.
 */
```

- [ ] **Step 8: Commit**

```bash
git add src/domain/asset/shapeEdits.ts src/domain/spatial/assetPlacement.ts tests/domain/asset/shapeEdits.test.ts tests/domain/asset/stretchParity.test.ts
git commit -m "fix(asset): land a typed size on a design with curved edges

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Set dimensions scales a measured footprint

`editDimensions` replaces the footprint with a centred rectangle whenever `scalesDrawing` is false — no details and no curved edge — so a calibrated L-shaped counter is squared off with no warning.

**Files:**
- Modify: `src/presentation/designer/AssetDesignerRoot.vue` (`scalesDrawing`, `editDimensions`, imports)
- Modify: `src/presentation/i18n/locales/en.ts` and `src/presentation/i18n/locales/de.ts` (`designer.dimensions.unscaled`)
- Modify: `tests/presentation/designer/assetDimensions.test.ts`

**Interfaces:**
- Consumes: `scaleDesignToDimensions` from Task 2; `runtime.editShape`, `runtime.setFootprintFromDimensions`, `notifyIfRefused`, all already in the file.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

`tests/presentation/designer/assetDimensions.test.ts` already has every fixture this needs:
`seeded()`, `harness.seed(shape)`, `drawn()` (a traced, NOT pending 100 x 100 square with anchor
(5, 5)), `mountDesigner(harness)` → `{ wrapper, dialogs }`, `harness.document()` for the saved
design, `expectNear`, and the `.rp-designer-edit-dimensions` control. Use them; do not add a second
harness. Add inside `describe('the designer’s dimensions dialog', …)`:

```ts
	/**
	 * A footprint in real millimetres is SCALED whatever it is drawn as. The old branch scaled only a
	 * design with details or a curved edge, so a straight traced outline with a notch — an L-shaped
	 * counter — was silently squared off into a centred rectangle (consolidation spec §3).
	 */
	it('scales a calibrated L-shaped footprint instead of squaring it off', async () => {
		const harness = await seeded();
		// 1000 x 600 overall, six corners, the notch in the +x/+y quadrant.
		await harness.seed({
			...drawn(),
			footprint: {
				points: [
					{ x: -500, y: -300 },
					{ x: 500, y: -300 },
					{ x: 500, y: 0 },
					{ x: 0, y: 0 },
					{ x: 0, y: 300 },
					{ x: -500, y: 300 },
				],
			},
			clearance: null,
			anchor: { x: 0, y: 0 },
		});
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 2000, depth: 300 });
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(fromDimensions).not.toHaveBeenCalled();
		const footprint = (await harness.document()).shape?.footprint;
		// x doubled and y halved about the anchor at the origin; the notch is still there.
		expectNear(footprint?.points, [[-1000, -150], [1000, -150], [1000, 0], [0, 0], [0, 150], [-1000, 150]]);
	});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run check:fast -- tests/presentation/designer/assetDimensions.test.ts
```

Expected: FAIL — `setFootprintFromDimensions` was called and the saved footprint has four corners.

- [ ] **Step 3: Change the branch**

In `src/presentation/designer/AssetDesignerRoot.vue`: delete the `scalesDrawing` function with its
whole docblock, drop the now-unused `hasCurves`, `unwrap` and `dimensionsOf` imports (keep
`type AssetShape`, which `isShape` uses), and import `scaleDesignToDimensions` in place of
`scaleDesign`. Replace the tail of `editDimensions`:

```ts
	if (result === null) return;
	// A footprint in real millimetres is SCALED, whatever it is drawn as — a traced L-shape keeps its
	// corners, and its anchor keeps whatever relationship to the shape the user gave it. The rectangle
	// is for the two states where there is nothing to scale: no shape at all, and a footprint still in
	// placeholder pixels, where scaling by typed millimetres would leave the result flagged pending and
	// multiplied again by a later calibration.
	if (unscaled || current?.shape == null) {
		await runtime.setFootprintFromDimensions(result.width, result.depth);
		return;
	}
	await notifyIfRefused(runtime.editShape((shape) => scaleDesignToDimensions(shape, result.width, result.depth)));
}
```

Update the docblock above `editDimensions` where it describes the old branch, and the sentence in
`src/presentation/designer/selection/editShape.ts`'s chain docblock reading "Edit dimensions'
SCALING path (`scaleDesign`, taken when the design has a detail or a curved footprint or clearance
edge)" — it now joins the chain whenever the footprint is measured, and the function it calls is
`scaleDesignToDimensions`.

- [ ] **Step 4: Update the two cases whose expectation WAS the defect**

Both are in the same file, and each is a behaviour change to state rather than a test to bend:

- **"retypes a TRACED footprint as typed, since the numbers are now authored rather than measured"**
  seeds `drawn()` — straight, measured — which now takes the scaling path. A scaled trace is still a
  trace: its coordinates came from the drawing and only their scale changed, so `footprintOrigin`
  stays `'traced'`, exactly as `CalibrateAsset`'s own "no conjunction with provenance" note already
  has it, and nothing is put at risk because a non-pending footprint is never rescaled by a later
  calibration. Rewrite the case, renamed, to assert that a measured traced square is scaled to the
  typed size with `footprintOrigin: 'traced'` and `footprintPending: false`, and rewrite its docblock
  to say why retyping belongs to the replace path alone.
- Any case elsewhere in `tests/presentation/designer/` asserting that a straight, measured design is
  replaced by a rectangle. Run the directory to find them; there may be none.

Leave every case about a PENDING footprint exactly as it is — they are the rule that still holds.

- [ ] **Step 5: Say so in the warning**

`src/presentation/i18n/locales/en.ts`, `designer.dimensions.unscaled` — append one sentence to the
existing string, and extend the comment above it to say the sentence names the replacement:

```
'This footprint was traced before a scale existed, so its current size is not a real measurement. Type the real width and depth, or calibrate the background first. Saving replaces the traced outline with a rectangle of that size.'
```

`src/presentation/i18n/locales/de.ts`, the same key:

```
'Dieser Umriss wurde gezeichnet, bevor ein Maßstab vorlag; seine aktuelle Größe ist kein echtes Maß. Geben Sie die echte Breite und Tiefe ein, oder kalibrieren Sie zuerst den Hintergrund. Beim Speichern wird der gezeichnete Umriss durch ein Rechteck dieser Größe ersetzt.'
```

The existing case "offers no default and says why…" asserts that exact string through
`t('en', 'designer.dimensions.unscaled')`, so it needs no edit and is the check that both locales
still carry the key.

- [ ] **Step 6: Run the designer, domain and i18n suites**

```bash
npm run check:fast -- tests/presentation/designer tests/domain/asset tests/presentation/i18n
```

Expected: PASS, with the two cases from Step 4 rewritten and nothing else touched.

- [ ] **Step 7: Lint the changed files**

```bash
npx eslint src/presentation/designer/AssetDesignerRoot.vue src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts
```

Expected: clean. `check:fast` does not run `eslint .`, and an unused import left behind by Step 3 fails only here.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/designer src/presentation/i18n/locales tests/presentation/designer/assetDimensions.test.ts
git commit -m "fix(designer): resize a measured footprint instead of replacing it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Settle the recoverability obligation, and the paperwork

Placement shipped against a live shape, which fired the trigger in the Foundations feature and was missed. The decision taken in brainstorming: an approved revision snapshots the shapes it references, so nothing is owed until a plan can be approved.

**Files:**
- Modify: `docs/requirements/Asset Designer Foundations.md`
- Modify: `docs/requirements/Asset designer.md`
- Modify: `docs/requirements/Plan revisions.md`
- Modify: `docs/requirements/Immutable approved revisions.md`
- Modify: `docs/tests/cases/Design an Asset.md`
- Modify: `CHANGELOG.md`

**Interfaces:** none — documentation only. No frontmatter key changes, no new notes, so nothing in `docs/` needs a new `type`, `parent` or `order`.

- [ ] **Step 1: Retarget the trigger in the feature**

In `docs/requirements/Asset Designer Foundations.md`, the paragraph beginning "**The epic's recoverability condition is open beneath this feature**": keep everything up to and including the sentence about the sidecar being a single mutable document, and replace the last two sentences with:

```markdown
A placement references the live shape, which is what the correct-it-once promise is for, and stays
correct for as long as nothing can be frozen. The trigger is therefore [[Plan revisions]] rather
than placement: an approved revision **snapshots** every shape it references, taken at approval
from the state on screen, so no earlier state is owed before a plan can be approved. That decision
was taken on 2026-09-16 (`docs/superpowers/specs/2026-09-16-asset-designer-consolidate-design.md`
§2); a version pin would have needed history reaching back before the pin existed, which is the
thing nothing here retained.
```

- [ ] **Step 2: Record the decision in the epic**

In `docs/requirements/Asset designer.md`, in the Definition of done bullet beginning "**Every attribute of the shape a placement referenced**", keep the bullet as written and replace its final sentence ("Whether the answer is a version pin or a snapshot taken at approval is **that epic's to decide**; …") with:

```markdown
Whether the answer was a version pin or a snapshot taken at approval was **that epic's to decide**,
and it has been decided: the snapshot, taken at approval, carrying all five attributes named above
(`docs/superpowers/specs/2026-09-16-asset-designer-consolidate-design.md` §2). The obligation here
is unchanged — the state a placement used is recoverable rather than overwritten in place — and it
is now owed where it is enforced, beneath [[Plan revisions]].
```

- [ ] **Step 3: Give the obligation to the receiving epic**

In `docs/requirements/Plan revisions.md`, add one Definition of done item after "Revision comparison is derived from the two revisions (§88) and stored nowhere.":

```markdown
- An approved revision reproduces every **asset shape it referenced** — footprint, clearance
  boundary, anchor, facing and height — and not the plan's own geometry alone. A placement stores a
  reference to a shared definition that goes on being corrected, so a revision that snapshots the
  plan sidecar and nothing else redraws, reorients and re-exports a drawing somebody approved. The
  five attributes are named one at a time because an obligation written about *the geometry* reads
  as the outline, and the other four move the drawing just as surely ([[Asset designer]]).
```

And in `docs/requirements/Immutable approved revisions.md`, replace the Outcome sentence with:

```markdown
Once a plan version is approved, nothing can change it, and what somebody quoted against can always be
reproduced — the plan's own geometry and every asset shape it referenced, which goes on changing in the
shared catalogue after the approval.
```

- [ ] **Step 4: Add the manual step**

In `docs/tests/cases/Design an Asset.md`, add a row to the steps table, numbered after the current last one (51 today — read the table, do not assume), and leave the Runs table saying the case has not been run:

```markdown
| 52 | `obsidian` | On an asset whose spec sheet is calibrated, trace an L-shaped footprint with no details, then Edit dimensions and type a new width | The outline keeps its six corners and its notch at the new overall size | The footprint replaced by a rectangle — the defect this row exists for |
```

- [ ] **Step 5: Add the changelog entry**

In `CHANGELOG.md`, under `## [Unreleased]`, in a `### Fixed` section (create it if the section is not there, after `### Added`):

```markdown
- Asset designer: Set dimensions now resizes a design that was traced rather than replacing it with a rectangle — an L-shaped counter keeps its corners — and a typed size lands correctly on a design with curved edges. A footprint traced before its drawing was calibrated is still replaced, and the dialog now says so.
```

- [ ] **Step 6: Check the docs tests still pass**

```bash
npm run check:fast -- tests/release tests/build/changelog.test.ts
```

Expected: PASS — the changelog heading format is checked, and nothing else here is machine-read.

- [ ] **Step 7: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs(requirements): settle the recoverable-shape obligation as a snapshot at approval

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The gate

- [ ] **Step 1: Run the full gate**

```bash
npm run check
```

Expected: build, both linters, the suite with its coverage floors, and fallow all pass. If another session is running a gate, wait rather than running a second one — two at once corrupt `coverage/.tmp` and time out `tests/build/`'s ESLint boots.

- [ ] **Step 2: Read the coverage of the changed files**

Open `coverage/coverage-final.json` for `src/domain/asset/scaleSolve.ts`, `src/domain/asset/shapeEdits.ts` and `src/presentation/designer/AssetDesignerRoot.vue`. Every branch added by this plan must be covered; a single uncovered arm is about 0.035 points and will not move the summary line. If an arm is unreachable, delete the guard rather than testing it.

- [ ] **Step 3: Push and open the pull request**

```bash
git push -u origin HEAD
```

Then open the PR with a body describing the three changes and linking the spec, ending with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Treat a red CI leg as the report to act on.
