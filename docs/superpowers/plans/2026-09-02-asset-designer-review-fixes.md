# Asset Designer Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Critical and Important findings of the 2026-09-02 adversarial review of PR 43 so the asset designer's trace-calibrate-trace workflow produces correct geometry, its undo cannot discard a peer's edit, and its tracing gesture is visible while it is being made.

**Architecture:** Eleven independent tasks on branch `claude/asset-designer-first-increment-eh5fxq`, worked in the existing worktree `C:\Projects\renovation-planner\.worktrees\asset-designer`. Four tasks are about `SetAssetBackground` and its reversible adapter (the background render, the forward-read window, the undo pre-flight, the compensated version). One extracts the plan editor's gesture drawing into a pure module both surfaces share and mounts a designer gesture layer over it. The rest are a dead tool, a hard-coded currency, one coverage gap, one unmounted class, German copy, and the docblocks the review found false. Nothing here changes the plan editor's gesture behaviour; every plan-editor edit is either a refactor held by existing tests or an added assertion.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Konva via vue-konva, vitest with jsdom, the repository's own test rigs (`tests/helpers/designerRig.ts`, `tests/helpers/assetDesignHarness.ts`, `tests/helpers/planEditorRig.ts`).

**Spec:** `docs/superpowers/specs/2026-08-30-asset-designer-first-increment-design.md` (Decisions 5 and 6, and "The designer itself"), plus the review findings this plan closes, listed at the top of each task. The original plan is `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md`; Task 11 appends its amendments there.

## Global Constraints

- Work only in the worktree `C:\Projects\renovation-planner\.worktrees\asset-designer`; run every command from it.
- Definition of done for the branch is `npm run check` (build, lint, coverage-thresholded tests, fallow). Run targeted files while working: `npx vitest run <path> --no-coverage`. Never run two vitest processes at once.
- Coverage floors are statements 99, functions 99, lines 99, branches 98. Functions headroom is about one covered unit, so every new arm gets a test in the same task, and every new `if` is one somebody can drive.
- Layer rule: `presentation → application → domain → core`; `presentation/dialogs/` may not import `application/`; `presentation/` may not import `plugin/` or `infrastructure/`. Nothing outside `infrastructure/` writes to the vault.
- Every user-visible string goes through `tr()`/`t()` with an entry in BOTH `en.ts` and `de.ts`. German says *Objekt*, never *Material*, and uses the formal *Sie* throughout. Sentence case.
- Every command's `ok(...)` carries a `DispatchOutcome` of `'wrote'` or `'no-write'`.
- No hard-coded colours in CSS; `max-lines` 400 per file (blank lines and comments not counted).
- A docblock that states a count or an exclusivity claim gets a grep in the same edit, and the sentence is written from what the grep printed.
- Commit after every task with the message given; do not amend.

---

### Task 1: The background raster follows the subject's calibration

**Closes:** Critical finding "the background never follows the calibration". `BackgroundRenderModel` draws every raster at `PLACEHOLDER_WORLD_SCALE`, and nothing reads `Calibration.pixelsPerWorldUnit`, although slice 7's own task document names feeding it into `worldScale` as that value's first job. After a calibration the traced geometry is multiplied by `scaleCorrection` and the sheet stays at 1 px per mm, so a later trace is recorded as millimetres while being sheet pixels.

**Files:**
- Modify: `src/presentation/editor/layers/background/BackgroundRenderModel.ts`
- Modify: `src/presentation/editor/layers/background/BackgroundLayer.vue`
- Modify: `src/presentation/editor/PlanCanvas.vue`
- Modify: `src/presentation/designer/DesignerCanvas.vue`
- Create: `tests/presentation/editor/drawnWorldScale.test.ts`
- Modify: `tests/presentation/editor/backgroundInEditor.test.ts`
- Modify: `tests/presentation/designer/designerBackground.test.ts`

**Interfaces:**
- Produces: `export function drawnWorldScale(rasterWorldScale: number, pixelsPerWorldUnit: number): number` in `BackgroundRenderModel.ts`.
- Produces: a REQUIRED prop `pixelsPerWorldUnit: number` on `BackgroundLayer.vue`, `1` for an uncalibrated subject.

- [ ] **Step 1: Write the failing node test for the pure helper**

Create `tests/presentation/editor/drawnWorldScale.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
	drawnWorldScale,
	PLACEHOLDER_WORLD_SCALE,
} from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';

/**
 * A calibration with `pixelsPerWorldUnit` 0.5 means two world millimetres per source pixel,
 * so a 400 px raster is 800 mm wide on a calibrated surface and 400 mm on an uncalibrated one.
 * A PDF raster arrives with its own guessed scale and the calibration corrects THAT.
 */
describe('drawnWorldScale', () => {
	it('is the raster scale itself while nothing has calibrated the subject', () => {
		expect(drawnWorldScale(PLACEHOLDER_WORLD_SCALE, 1)).toBe(1);
		expect(drawnWorldScale(0.3527, 1)).toBeCloseTo(0.3527);
	});

	it('divides the raster scale by the calibrated pixels-per-world-unit', () => {
		expect(drawnWorldScale(1, 0.5)).toBe(2);
		expect(drawnWorldScale(0.3527, 0.5)).toBeCloseTo(0.7054);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/editor/drawnWorldScale.test.ts --no-coverage`
Expected: FAIL, `drawnWorldScale` is not exported.

- [ ] **Step 3: Add the helper and correct the docblock that promised it**

In `src/presentation/editor/layers/background/BackgroundRenderModel.ts`, replace the docblock above `PLACEHOLDER_WORLD_SCALE` (the one beginning "The placeholder scale, until Increment 5 (slice 7) calibrates") and the constant with:

```typescript
/**
 * The placeholder scale a raster is decoded at: one source pixel is one world millimetre.
 *
 * A raster has no physical size of its own, so nothing pretends otherwise until a calibration
 * says so — and the calibration does NOT become a parameter of `worldToScreen`, because §24
 * fixes that transform's components as translation, zoom, rotation and device pixel ratio.
 * What a calibration changes is the size the raster is DRAWN at: `drawnWorldScale` below,
 * which the layer asks with the subject's own `pixelsPerWorldUnit`.
 *
 * **This value was drawn unmodified for eight slices after slice 7 landed.** Slice 7's own
 * design gave `pixelsPerWorldUnit` two jobs and named this one first — "how many world
 * millimetres one source pixel of this Plan's background covers … after, it is this value's
 * reciprocal" — and nothing in `presentation/` ever read it. The plan's zones were multiplied
 * by `scaleCorrection` and the image was not, so a zone drawn after calibrating had its area
 * wrong by the scale squared. The asset designer inherited it, and there it broke the
 * increment's central workflow: a footprint traced on an uncalibrated sheet was rescaled off
 * the sheet, and a clearance traced afterwards was recorded as millimetres while being sheet
 * pixels, because `captureAwaitsScale` correctly reads a calibrated surface as millimetres.
 * Found by an adversarial review reading the model against slice 7's document.
 */
export const PLACEHOLDER_WORLD_SCALE = 1;

/**
 * World millimetres per source pixel as DRAWN: the raster's own decoded scale, corrected by
 * the subject's calibration. `pixelsPerWorldUnit` is `1` for an uncalibrated subject, which
 * is why the uncalibrated case is the identity and why callers pass `?? 1` rather than a
 * nullable.
 *
 * Division rather than a second stored field, because `deriveCalibration` already defines
 * `pixelsPerWorldUnit` as the placeholder divided by every `scaleCorrection` so far, and a
 * calibration multiplies every world coordinate by that same correction — so this is the one
 * expression that keeps a traced outline over the pixels it was traced on.
 */
export function drawnWorldScale(rasterWorldScale: number, pixelsPerWorldUnit: number): number {
	return rasterWorldScale / pixelsPerWorldUnit;
}
```

- [ ] **Step 4: Run the node test to verify it passes**

Run: `npx vitest run tests/presentation/editor/drawnWorldScale.test.ts --no-coverage`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing designer case, and flip the placeholder case's comment**

In `tests/presentation/designer/designerBackground.test.ts`, inside `describe('an asset with a spec sheet', …)`, replace the comment inside the first case (the two lines beginning `// One source pixel is one world millimetre until a calibration converts`) with:

```typescript
		// One source pixel is one world millimetre until a calibration says otherwise; the
		// calibrated case below is the one where the sheet grows with what was traced on it.
```

and add this case after it:

```typescript
	it('draws the sheet at the CALIBRATED scale, so a rescaled trace still sits on it', async () => {
		registerResource(`app://fake/${SHEET}`, pngFixture(400, 300));
		const designer = await mountDesigner(
			assetDesign({
				background: { path: SHEET, kind: 'image', page: null },
				// 0.5 source pixels per world millimetre: the user said a 400-unit bar was 800 mm.
				calibration: {
					pointA: { x: 0, y: 0 },
					pointB: { x: 800, y: 0 },
					knownDistance: 800,
					pixelsPerWorldUnit: 0.5,
				},
			}),
			vaultWith([SHEET]),
		);
		const image = await drawnSheet(designer);
		expect({ width: image.width(), height: image.height() }).toEqual({ width: 800, height: 600 });
		expect({ x: image.x(), y: image.y() }).toEqual({ x: 0, y: 0 });
	});
```

- [ ] **Step 6: Write the failing plan editor case**

In `tests/presentation/editor/backgroundInEditor.test.ts`, inside `describe('a plan with a background', …)`, after the first case add:

```typescript
	it('draws the raster at the CALIBRATED scale, so the zones traced on it stay over it', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(400, 300));
		harness = await mountPlanEditor({
			plan: {
				...planWith({ path: PNG, kind: 'image' }),
				calibration: {
					pointA: { x: 0, y: 0 },
					pointB: { x: 800, y: 0 },
					knownDistance: 800,
					pixelsPerWorldUnit: 0.5,
				},
			},
			vault: vaultWith([PNG]),
		});
		await settle();
		const image = backgroundImage(harness);
		expect({ width: image?.width(), height: image?.height() }).toEqual({ width: 800, height: 600 });
	});
```

Also replace that file's first-case comment (the two lines beginning `// One source pixel is one world millimetre until slice 7 calibrates`) with:

```typescript
		// One source pixel is one world millimetre for an uncalibrated plan; the calibrated
		// case below is where the raster follows what slice 7 rescaled.
```

- [ ] **Step 7: Run both files to verify the new cases fail at their size assertion**

Run: `npx vitest run tests/presentation/designer/designerBackground.test.ts tests/presentation/editor/backgroundInEditor.test.ts --no-coverage`
Expected: exactly two failures, each `expected { width: 400, height: 300 } to deeply equal { width: 800, height: 600 }`.

- [ ] **Step 8: Give the layer the prop and use it**

In `src/presentation/editor/layers/background/BackgroundLayer.vue`:

Add to the import from `./BackgroundRenderModel`: `drawnWorldScale,`.

Replace the `defineProps` block with:

```typescript
const props = defineProps<{
	name: string;
	reference: BackgroundDocumentRef | null;
	vault: BackgroundVault;
	transform: NodeTransform;
	visible: boolean;
	/**
	 * The subject's calibration, reduced to the one number the raster's drawn size depends on;
	 * `1` for an uncalibrated subject. REQUIRED rather than defaulted, for `name`'s reason: a
	 * default is what let this layer draw every calibrated plan at the placeholder scale for
	 * eight slices with nothing failing.
	 */
	pixelsPerWorldUnit: number;
}>();
```

Replace the `<VImage>` `width`/`height` lines in the template with:

```vue
				width: raster.width * drawnWorldScale(raster.worldScale, props.pixelsPerWorldUnit),
				height: raster.height * drawnWorldScale(raster.worldScale, props.pixelsPerWorldUnit),
```

And in the component docblock replace the sentence `` * world-space layer: the raster's own pixels become millimetres through the model's `` / `` * `worldScale`, which is a placeholder until a calibration converts what was traced over it. `` with:

```
 * world-space layer: the raster's own pixels become millimetres through `drawnWorldScale`,
 * the decoded scale corrected by the subject's `pixelsPerWorldUnit`, so the picture grows with
 * the coordinates a calibration multiplies.
```

- [ ] **Step 9: Pass it from both canvases**

In `src/presentation/editor/PlanCanvas.vue`, below `const background = computed(() => project.plan?.background ?? null);` add:

```typescript
/** The plan's calibration as the ONE number the raster's drawn size needs; `1` uncalibrated. */
const pixelsPerWorldUnit = computed(() => project.plan?.calibration?.pixelsPerWorldUnit ?? 1);
```

and add `:pixels-per-world-unit="pixelsPerWorldUnit"` to the `<BackgroundLayer` mount, after `:visible="layerVisibility.background"`.

In `src/presentation/designer/DesignerCanvas.vue`, below the `background` computed add:

```typescript
/** The asset's OWN calibration, reduced to the raster's drawn scale; `1` uncalibrated. */
const pixelsPerWorldUnit = computed(() => design.value?.calibration?.pixelsPerWorldUnit ?? 1);
```

and add `:pixels-per-world-unit="pixelsPerWorldUnit"` to its `<BackgroundLayer` mount, after `:visible="true"`.

- [ ] **Step 10: Run the affected suites**

Run: `npx vitest run tests/presentation/designer tests/presentation/editor/backgroundInEditor.test.ts tests/presentation/editor/background.test.ts tests/presentation/editor/drawnWorldScale.test.ts tests/harness --no-coverage`
Expected: PASS. If `tests/harness/fixture.ts` or `tests/harness/planEditor.ts` mounts `BackgroundLayer` standalone, `vue-tsc` will name the missing prop at `npm run build`; add `:pixels-per-world-unit="1"` there.

- [ ] **Step 11: Build, so the required prop is checked everywhere it is mounted**

Run: `npm run build`
Expected: PASS. A `TS2741` naming `pixelsPerWorldUnit` means a mount was missed; fix it and re-run.

- [ ] **Step 12: Commit**

```bash
git add src/presentation/editor/layers/background/BackgroundRenderModel.ts src/presentation/editor/layers/background/BackgroundLayer.vue src/presentation/editor/PlanCanvas.vue src/presentation/designer/DesignerCanvas.vue tests/presentation/editor/drawnWorldScale.test.ts tests/presentation/editor/backgroundInEditor.test.ts tests/presentation/designer/designerBackground.test.ts
git commit -m "Draw a background at the scale its subject's calibration establishes"
```

---

### Task 2: The background gesture conditions its sidecar clear on the adapter's own read

**Closes:** Important finding "the background adapter loses a peer's sidecar edit on undo". `ReversibleAssetBackgroundEdit.execute` reads the sidecar, then `SetAssetBackgroundCommand` reads it again and conditions the calibration clear on its own read. A peer anchor write landing between the two reads is merged by the command while the adapter's inverse holds the pre-peer document; undo then succeeds and the peer's anchor is gone. Proven by a driven probe during review: undo answered `wrote` and the anchor reverted from 77,77 to 5,5.

**Files:**
- Modify: `src/application/commands/asset/SetAssetBackground.ts`
- Modify: `src/application/editor/asset/ReversibleAssetDesignCommands.ts`
- Modify: `tests/application/editor/reversibleAssetDesignWindows.test.ts`

**Interfaces:**
- Produces: `SetAssetBackgroundInput.expectedGeometry?: EntityVersion`, the sidecar version the caller read.
- Produces: `ReversibleAssetEdit.runForward(version, extra = {})`, where `extra: Partial<TInput>` is merged before `expected`.

- [ ] **Step 1: Write the failing test**

In `tests/application/editor/reversibleAssetDesignWindows.test.ts`, add `sidecarWritingBetweenReads` to the import list from `'../../helpers/assetDesignHarness'`, and add this `describe` block at the end of the file:

```typescript
describe('the window between the background adapter\'s sidecar read and the command\'s own', () => {
	it('refuses the gesture rather than merging a peer\'s sidecar edit into an inverse that predates it', async () => {
		let peer: () => Promise<unknown> = () => Promise.resolve();
		// The adapter's read is the sidecar's FIRST read; the peer lands right after it and
		// before the command reads for itself.
		const w = await seeded({ sidecar: (real) => sidecarWritingBetweenReads(real, 1, () => peer()) });
		await w.seed(drawn());
		await w.seedCalibration();
		peer = async () => {
			expect(expectOk(await w.plain.setFacing.execute({ assetId: w.assetId, facing: 1 }))).toBe('wrote');
		};

		const gesture = w.reversible.setBackground({ assetId: w.assetId, path: 'Specs/a.png', kind: 'image', page: null });
		expect(expectErr(await gesture.execute()).code).toBe('asset-geometry.revision-conflict');

		// Neither half applied, and the peer's edit is exactly where the peer left it.
		const after = await w.document();
		expect(after.calibration).not.toBeNull();
		expect(after.shape?.facing).toBe(1);
		expect(present(expectOk(await w.stack.assets.getById(w.assetId))).entity.background).toBeNull();
		// A refused gesture has no inverse to spend.
		expect(expectOk(await gesture.undo())).toBe('no-write');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/application/editor/reversibleAssetDesignWindows.test.ts --no-coverage`
Expected: FAIL at `expectErr(await gesture.execute())`: the gesture succeeds today.

- [ ] **Step 3: Let the command take a caller's sidecar expectation**

In `src/application/commands/asset/SetAssetBackground.ts`, in `SetAssetBackgroundInput` after the `expected?` member add:

```typescript
	/**
	 * The SIDECAR's version this gesture read, if the caller already has one — the reversible
	 * adapter does, and without it the calibration clear below is conditioned on the command's
	 * OWN read, a second read a peer can land between: the peer's edit is merged here, the
	 * adapter's inverse predates it, and the undo restores over it with no refusal. The same
	 * two-read window `updateAssetShape` closes for every one-resource command with `expected`.
	 */
	readonly expectedGeometry?: EntityVersion;
```

Change the clearing write from `const clearedWrite = await sidecar.write(input.assetId, cleared, geometryVersion);` to:

```typescript
		const clearedWrite = await sidecar.write(input.assetId, cleared, input.expectedGeometry ?? geometryVersion);
```

- [ ] **Step 4: Let the base adapter merge extra input, and have the background adapter supply it**

In `src/application/editor/asset/ReversibleAssetDesignCommands.ts`, replace `runForward` in `ReversibleAssetEdit` with:

```typescript
	/**
	 * `extra` is what a two-resource gesture conditions its SECOND resource on — the background
	 * adapter's `expectedGeometry` — merged before `expected` so the note rule below still owns
	 * that one field. One-resource adapters pass nothing.
	 */
	protected async runForward(version: EntityVersion, extra: Partial<TInput> = {}): Promise<VersionedDispatchResult> {
		const expected = this.ran ? version : (this.input.expected ?? version);
		const ran = await this.command.executeWithVersion({ ...this.input, ...extra, expected });
		this.ran = true;
		return ran;
	}
```

In `ReversibleAssetBackgroundEdit.execute`, replace the comment and call

```typescript
		// The NOTE's pre-write version is what this gesture's own `expected` claim is about —
		// `runForward` states the rule; `SetAssetBackgroundCommand` reads the sidecar itself
		// and conditions that half of its write on nothing this adapter supplies.
		const ran = await this.runForward(beforeNote.value.version);
```

with

```typescript
		// BOTH snapshots travel forward: the note's as `expected`, per `runForward`'s rule, and
		// the sidecar's as `expectedGeometry`. The first draft conditioned the sidecar half on
		// nothing this adapter supplied, and a peer landing between this read and the command's
		// own was merged by the command and then undone over — measured, the peer's anchor
		// reverted with no refusal anywhere.
		const ran = await this.runForward(beforeNote.value.version, {
			expectedGeometry: beforeGeometry.value.version,
		});
```

In that class's docblock, replace the sentence beginning `` **`expected` names the NOTE version**, `` through `` rather than on anything the caller supplied. `` with:

```
 * **`expected` names the NOTE version and `expectedGeometry` the SIDECAR's**, both read by this
 * adapter before the forward write, so the command refuses a peer that landed in either window
 * rather than merging it into a document this adapter's inverse predates.
```

- [ ] **Step 5: Run the windows and adapter suites**

Run: `npx vitest run tests/application/editor tests/application/commands/asset/setAssetBackground.test.ts --no-coverage`
Expected: PASS, the new case included.

- [ ] **Step 6: Commit**

```bash
git add src/application/commands/asset/SetAssetBackground.ts src/application/editor/asset/ReversibleAssetDesignCommands.ts tests/application/editor/reversibleAssetDesignWindows.test.ts
git commit -m "Condition the background gesture's sidecar clear on the adapter's own read"
```

---

### Task 3: A background undo checks the sidecar before it touches the note

**Closes:** Important finding "a peer's sidecar edit turns a background undo into a permanent half-undo". Undo restores the note, then the conditional sidecar restore refuses; the inverse is kept, so every further press re-saves the note and refuses again, nothing publishes, and both canvases keep drawing the new sheet against a note holding the old one.

**Files:**
- Modify: `src/application/editor/asset/ReversibleAssetDesignCommands.ts`
- Modify: `tests/application/editor/reversibleAssetDesignWindows.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/application/editor/reversibleAssetDesignWindows.test.ts`, add `import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';` and this `describe` at the end of the file:

```typescript
describe('a background undo after a peer has written the sidecar', () => {
	it('refuses BEFORE touching the note, so nothing is half-undone and nothing churns', async () => {
		const w = await seeded();
		await w.seed(drawn());
		await w.seedCalibration();
		const gesture = w.reversible.setBackground({ assetId: w.assetId, path: 'Specs/a.png', kind: 'image', page: null });
		expect(expectOk(await gesture.execute())).toBe('wrote');
		const noteAfterGesture = present(expectOk(await w.stack.assets.getById(w.assetId)));

		// A peer designer leaf, through the plain door, moves the sidecar past this history.
		expect(expectOk(await w.plain.setFacing.execute({ assetId: w.assetId, facing: 1 }))).toBe('wrote');

		const refused = expectErr(await gesture.undo());
		expect(refused.code).toBe('undo.superseded');
		expect(leftWritesBehind(refused)).toBe(false);

		// The note is untouched: same version, still the new reference.
		const noteAfterUndo = present(expectOk(await w.stack.assets.getById(w.assetId)));
		expect(noteAfterUndo.version).toEqual(noteAfterGesture.version);
		expect(noteAfterUndo.entity.background?.path).toBe('Specs/a.png');
		expect((await w.document()).shape?.facing).toBe(1);

		// And pressing again does not buy a note revision either.
		expectErr(await gesture.undo());
		expect(present(expectOk(await w.stack.assets.getById(w.assetId))).version).toEqual(noteAfterGesture.version);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/application/editor/reversibleAssetDesignWindows.test.ts --no-coverage`
Expected: FAIL at `expect(refused.code).toBe('undo.superseded')` with `asset-geometry.revision-conflict` received, or at the note-version equality.

- [ ] **Step 3: Pre-flight the sidecar in `undo`**

In `src/application/editor/asset/ReversibleAssetDesignCommands.ts`, add to the imports:

```typescript
import { sameVersion, type EntityVersion } from '../../ports/versioning';
```

(replacing the existing `import type { EntityVersion } from '../../ports/versioning';`).

In `ReversibleAssetBackgroundEdit.undo`, replace everything from `const noteExpected = …` through `geometryLedger.record(assetId, savedGeometry.value);` with:

```typescript
		// The sidecar is asked FIRST, before either resource is written. A restore of the note
		// that is then followed by a refused sidecar restore is a genuinely half-undone state —
		// and the generation check above cannot see a peer no later gesture sampled, so without
		// this read the note was restored, the sidecar refused, the inverse was kept, and every
		// further press re-saved the note and refused again. A read-then-write is not atomic,
		// so the `markUncompensated` arm below is kept for the peer that lands between them.
		const geometryExpected = geometryLedger.lastWritten(assetId) ?? inverse.geometryPreVersion;
		const current = await sidecar.read(assetId);
		if (isErr(current)) return current;
		if (!sameVersion(current.value.version, geometryExpected)) return err(undoSuperseded(assetId));

		const noteExpected = noteLedger.lastWritten(assetId) ?? inverse.notePreVersion;
		const savedNote = await assets.save(inverse.entity, noteExpected);
		if (isErr(savedNote)) return savedNote;
		noteLedger.record(assetId, savedNote.value.version);

		const savedGeometry = await sidecar.write(assetId, inverse.document, geometryExpected);
		if (isErr(savedGeometry)) {
			// The note IS restored; the calibration it implies is not. Reported rather than
			// swallowed, for `DispatchOutcome`'s reason: a "Saved" badge here would claim a
			// vault as safe as it was before, which it is not.
			return err(markUncompensated(savedGeometry.error));
		}
		geometryLedger.record(assetId, savedGeometry.value);
```

In the class docblock, replace the paragraph beginning `` * **Undo restores in the REVERSE of the forward order** `` with:

```
 * **Undo asks the sidecar FIRST and then restores in the REVERSE of the forward order** — the
 * note, then the sidecar — mirroring `deleteResolution.ts`'s "undo is the same compensated
 * sequence run backwards". A peer sidecar write since the gesture is refused pre-write as
 * `undo.superseded`, from a read taken before the note is touched, because the generation
 * check only sees peers a LATER gesture sampled. A failure restoring the sidecar AFTER the note
 * has already been put back can still happen in the window between that read and the write,
 * and is a genuinely half-undone state — the note points at the OLD reference again, but the
 * calibration that reference implies is still gone — so it is reported the same way the
 * forward command's own compensation failure is: `markUncompensated`, not swallowed. The
 * inverse is kept rather than cleared in that case, so a retry re-attempts the (idempotent)
 * note write and the still-outstanding sidecar restore rather than losing the gesture's
 * inverse outright.
```

- [ ] **Step 4: Run the suites**

Run: `npx vitest run tests/application/editor tests/application/commands/asset --no-coverage`
Expected: PASS. If the case `refuses a background undo when the GEOMETRY ledger has moved since, via a sandwiched peer` now reports `undo.superseded` from the new read rather than from the generation check, that is the same code and it stays green.

- [ ] **Step 5: Commit**

```bash
git add src/application/editor/asset/ReversibleAssetDesignCommands.ts tests/application/editor/reversibleAssetDesignWindows.test.ts
git commit -m "Refuse a background undo before the note is touched when the sidecar has moved"
```

---

### Task 4: A compensated refusal reports the sidecar version it restored

**Closes:** Important finding "a compensated background refusal leaves the geometry ledger two revisions behind". The command clears the sidecar, the note save refuses, the compensation restores the calibration: two sidecar writes the history's ledger never learns about, because the adapter returns on `isErr(ran)` and the error carries no version. The user's earlier geometry undo is then refused forever, and the next gesture's `observe` counts the command's own compensation as a foreign write.

**Files:**
- Modify: `src/application/commands/DispatchOutcome.ts`
- Modify: `src/application/commands/asset/SetAssetBackground.ts`
- Modify: `src/application/editor/asset/ReversibleAssetDesignCommands.ts`
- Modify: `tests/application/editor/reversibleAssetDesignWindows.test.ts`

**Interfaces:**
- Produces in `DispatchOutcome.ts`: `interface CompensatedWrite { readonly compensatedVersion: EntityVersion }`, `markCompensated(error, version)`, `compensatedVersionOf(error): EntityVersion | null`.

- [ ] **Step 1: Write the failing test**

In `tests/application/editor/reversibleAssetDesignWindows.test.ts`, add `import type { AssetRepository } from '../../../src/application/ports/AssetRepository';` and this helper above the first `describe`:

```typescript
/**
 * A peer writing the NOTE between the adapter's `getById` and the command's own `save`:
 * fires once, after the first read, and never for the peer's own read.
 */
function assetsWritingAfterRead(real: AssetRepository, peer: () => Promise<unknown>): AssetRepository {
	let fired = false;
	return {
		getById: async (id) => {
			const found = await real.getById(id);
			if (!fired) {
				fired = true;
				await peer();
			}
			return found;
		},
		listAll: () => real.listAll(),
		delete: (id, expected) => real.delete(id, expected),
		save: (asset, expected) => real.save(asset, expected),
	};
}
```

and this `describe` at the end of the file:

```typescript
describe('a background gesture whose note save refuses after the sidecar was cleared', () => {
	it('leaves the history able to undo the geometry gesture before it', async () => {
		let peer: () => Promise<unknown> = () => Promise.resolve();
		const w = await seeded({ assets: (real) => assetsWritingAfterRead(real, () => peer()) });
		await w.seed(drawn());
		await w.seedCalibration();

		const footprint = w.reversible.setFootprint({ assetId: w.assetId, points: TRIANGLE });
		expect(expectOk(await footprint.execute())).toBe('wrote');

		// The peer bumps the note's revision inside the background gesture's read window, so the
		// command's own save refuses and its compensation restores the calibration it cleared.
		peer = async () => {
			expect(expectOk(await w.plain.setHeight.execute({ assetId: w.assetId, height: 1200 }))).toBe('wrote');
		};
		const background = w.reversible.setBackground({ assetId: w.assetId, path: 'Specs/a.png', kind: 'image', page: null });
		expect(expectErr(await background.execute()).code).toBe('asset.revision-conflict');
		expect((await w.document()).calibration).not.toBeNull();

		// The compensation was TWO sidecar writes this history dispatched; the footprint's undo
		// must not be refused for them, and must not read them as somebody else's.
		expect(expectOk(await footprint.undo())).toBe('wrote');
		expect((await w.document()).shape?.footprint.points).toEqual(SQUARE);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/application/editor/reversibleAssetDesignWindows.test.ts --no-coverage`
Expected: FAIL at `expect(expectOk(await footprint.undo()))` with `asset-geometry.revision-conflict`.

- [ ] **Step 3: Add the stamp beside `UncompensatedWrite`**

In `src/application/commands/DispatchOutcome.ts`, after `leftWritesBehind` add:

```typescript
/**
 * The other outcome a compensation can have: it SUCCEEDED, and the resource it put back now
 * carries a version the dispatching history has to learn.
 *
 * `UncompensatedWrite` covers the compensation that refused. This covers the one that worked —
 * which is neutral for the save indicator (the vault is back at its pre-state) and is NOT
 * neutral for a `WriteLedger`: the compensating write was this history's own, dispatched by
 * the command it ran, and a ledger that never hears of it refuses the next undo below as a
 * revision conflict and reads the following gesture's pre-read as a foreign write. Measured:
 * a refused background pick left every earlier sidecar gesture un-undoable for the leaf's life.
 * A read-back by the adapter would reopen the peer window `VersionedDispatch` exists to close,
 * so the command that wrote reports it, on the failure channel, beside the refusal.
 */
export interface CompensatedWrite {
	readonly compensatedVersion: EntityVersion;
}

/** Stamp a refusal with the version its successful compensation produced. Returns a copy. */
export function markCompensated<TError extends AppError>(
	error: TError,
	version: EntityVersion,
): TError & CompensatedWrite {
	return { ...error, compensatedVersion: version };
}

/** The version a refusal's compensation produced, or `null` when it compensated nothing. */
export function compensatedVersionOf(error: AppError): EntityVersion | null {
	return (error as Partial<CompensatedWrite>).compensatedVersion ?? null;
}
```

- [ ] **Step 4: Have the command report it**

In `src/application/commands/asset/SetAssetBackground.ts`, change the import to include `markCompensated`:

```typescript
import {
	markCompensated,
	markUncompensated,
	plainDispatch,
	type DispatchResult,
	type VersionedDispatchResult,
} from '../DispatchOutcome';
```

and replace the compensation arm

```typescript
			const restored = await sidecar.write(input.assetId, document, clearedWrite.value);
			if (isErr(restored)) {
				return err(markUncompensated(saved.error));
			}
			return saved;
```

with

```typescript
			const restored = await sidecar.write(input.assetId, document, clearedWrite.value);
			if (isErr(restored)) {
				return err(markUncompensated(saved.error));
			}
			// The restore SUCCEEDED, and it is a write this gesture's history has to record:
			// `CompensatedWrite` says why a refusal carries a version at all.
			return err(markCompensated(saved.error, restored.value));
```

- [ ] **Step 5: Have the adapter record it**

In `src/application/editor/asset/ReversibleAssetDesignCommands.ts`, add `compensatedVersionOf` to the import from `'../../commands/DispatchOutcome'`, and in `ReversibleAssetBackgroundEdit.execute` replace

```typescript
		if (isErr(ran)) return ran;
```

with

```typescript
		if (isErr(ran)) {
			// A refused gesture has no inverse, but its COMPENSATION may have written: the clear
			// landed and was put back, two sidecar revisions this history dispatched and would
			// otherwise never learn of. Recording the version the restore produced is what keeps
			// the gestures below this one undoable — `CompensatedWrite` carries the account.
			const compensated = compensatedVersionOf(ran.error);
			if (compensated !== null) geometryLedger.record(assetId, compensated);
			return ran;
		}
```

- [ ] **Step 6: Run the suites**

Run: `npx vitest run tests/application/editor tests/application/commands/asset/setAssetBackground.test.ts tests/presentation/editor/save-state --no-coverage`
Expected: PASS. The save-state suite is run because `affectsSaveState` reads the same error objects; a stamped refusal must still resolve NEUTRAL there (nothing in `affectsSaveState` reads `compensatedVersion`).

- [ ] **Step 7: Commit**

```bash
git add src/application/commands/DispatchOutcome.ts src/application/commands/asset/SetAssetBackground.ts src/application/editor/asset/ReversibleAssetDesignCommands.ts tests/application/editor/reversibleAssetDesignWindows.test.ts
git commit -m "Report the sidecar version a compensated background refusal restored"
```

---

### Task 5: The designer draws the gesture in progress

**Closes:** Important finding "the tracing gesture is invisible while in progress". No designer layer reads `RenderState.polygonSketch` or `RenderState.measurement`, and `DrawPolygonTool` closes only on a click within `POLYGON_CLOSE_GRAB_RADIUS_PX` of the first vertex, which is drawn nowhere. The plan editor's `InteractionLayer.vue` already draws both but is bound to `useEditorRuntime`, `useProjectStore` and `useSelectionStore`, so the drawing arithmetic is extracted into a pure module both layers call.

**Files:**
- Create: `src/presentation/editor/layers/gestureGeometry.ts`
- Modify: `src/presentation/editor/layers/InteractionLayer.vue`
- Create: `src/presentation/designer/layers/DesignerGestureLayer.vue`
- Modify: `src/presentation/designer/layers/backgroundLayer.ts`
- Modify: `src/presentation/designer/DesignerCanvas.vue`
- Modify: `src/presentation/designer/AssetDesignerRoot.vue` (docblock only)
- Modify: `src/presentation/designer/tools/registerDesignerTools.ts` (docblock only)
- Modify: `src/presentation/designer/tools/set-facing-tool.ts` (docblock only)
- Modify: `tests/helpers/designerRig.ts`
- Create: `tests/presentation/editor/gestureGeometry.test.ts`
- Create: `tests/presentation/designer/designerGesture.test.ts`
- Modify: `tests/presentation/designer/layers.test.ts`
- Modify: `tests/presentation/designer/designerBackground.test.ts`
- Modify: `tests/presentation/designer/tools/designerToolUnits.test.ts` (docblock only)
- Modify: `docs/tests/cases/Design an Asset.md`

**Interfaces:**
- Produces in `gestureGeometry.ts`: `type ToScreen = (point: Point) => ScreenPoint`; `interface SketchScreenGeometry { vertices: readonly ScreenPoint[]; outlineFlat: readonly number[] | null; closeArmed: boolean }`; `sketchScreenGeometry(sketch: PolygonSketch | null, toScreen: ToScreen): SketchScreenGeometry | null`; `measurementScreenMarks(segment: LineSegment | null, toScreen: ToScreen): RulerMarks | null`.
- Produces: `export const GESTURE_LAYER: DesignerLayerName = 'asset-gesture'` in `backgroundLayer.ts`; the union gains `'asset-gesture'`.
- Produces in `designerRig.ts`: `export function move(rig: DesignerRig, world: Point): void` (a hover, `buttons: 0`).

- [ ] **Step 1: Write the failing node test for the pure module**

Create `tests/presentation/editor/gestureGeometry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
	measurementScreenMarks,
	sketchScreenGeometry,
	type ToScreen,
} from '../../../src/presentation/editor/layers/gestureGeometry';

/** A camera that doubles every coordinate: enough to prove the projection is applied. */
const doubled: ToScreen = (point) => ({ x: point.x * 2, y: point.y * 2 });

describe('sketchScreenGeometry', () => {
	it('answers null for no sketch', () => {
		expect(sketchScreenGeometry(null, doubled)).toBeNull();
	});

	it('projects the placed vertices and appends the loose next vertex to the outline', () => {
		const geometry = sketchScreenGeometry(
			{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], pointer: { x: 10, y: 10 }, nextVertex: { x: 10, y: 10 } },
			doubled,
		);
		expect(geometry?.vertices).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
		expect(geometry?.outlineFlat).toEqual([0, 0, 20, 0, 20, 20]);
		expect(geometry?.closeArmed).toBe(false);
	});

	it('has no outline under two points and never arms the close target under three vertices', () => {
		const geometry = sketchScreenGeometry(
			{ vertices: [{ x: 0, y: 0 }], pointer: { x: 0, y: 0 }, nextVertex: null },
			doubled,
		);
		expect(geometry?.outlineFlat).toBeNull();
		expect(geometry?.closeArmed).toBe(false);
	});

	it('arms the close target when the POINTER is within reach of the first vertex on screen', () => {
		const sketch = {
			vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			pointer: { x: 3, y: 0 },
			nextVertex: { x: 3, y: 0 },
		};
		// 3 world units doubled is 6 screen pixels: inside the twelve a close click takes.
		expect(sketchScreenGeometry(sketch, doubled)?.closeArmed).toBe(true);
		// 10 world units doubled is 20 screen pixels: outside it.
		expect(sketchScreenGeometry({ ...sketch, pointer: { x: 10, y: 0 } }, doubled)?.closeArmed).toBe(false);
	});
});

describe('measurementScreenMarks', () => {
	it('answers null for no measurement, and ruler marks between the projected ends otherwise', () => {
		expect(measurementScreenMarks(null, doubled)).toBeNull();
		const marks = measurementScreenMarks({ start: { x: 0, y: 0 }, end: { x: 50, y: 0 } }, doubled);
		expect(marks?.spine).toEqual([0, 0, 100, 0]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/editor/gestureGeometry.test.ts --no-coverage`
Expected: FAIL, module not found.

- [ ] **Step 3: Create the pure module**

Create `src/presentation/editor/layers/gestureGeometry.ts`:

```typescript
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';
import { closesPolygon } from '../closeTarget';
import type { PolygonSketch } from '../tools/render-state';
import type { ScreenPoint } from '../viewport/Viewport';
import { rulerMarks, type RulerMarks } from './rulerGeometry';

/**
 * The gesture pictures both surfaces draw, as ARITHMETIC rather than as a component.
 *
 * `InteractionLayer.vue` drew a polygon sketch and a calibration tape from `RenderState` and
 * was bound to the plan editor's runtime, project store and selection store, so the asset
 * designer could not mount it — and for a whole increment the designer drew nothing while a
 * gesture was in progress: `DrawPolygonTool` closes only on a click within twelve screen pixels
 * of the FIRST vertex, and that vertex was drawn nowhere, so a user traced against an invisible
 * target. Found by an adversarial review. What the two surfaces share is exactly this file:
 * the projection of a sketch and a measurement into screen space, and the close-target rule
 * asked of the projected pointer. Each surface keeps its own template, because the plan
 * editor's also draws a selection and a translated ghost that the designer has no subject for.
 */
export type ToScreen = (point: Point) => ScreenPoint;

export interface SketchScreenGeometry {
	/** Every PLACED vertex, projected; one circle each, the first drawn as the close target. */
	readonly vertices: readonly ScreenPoint[];
	/** The placed vertices plus the loose next one, flattened for a `VLine`; `null` under two points. */
	readonly outlineFlat: readonly number[] | null;
	/** Whether a click where the pointer IS would close the shape — asked of the pointer, never of `nextVertex`. */
	readonly closeArmed: boolean;
}

export function sketchScreenGeometry(sketch: PolygonSketch | null, toScreen: ToScreen): SketchScreenGeometry | null {
	if (sketch === null) return null;
	const vertices = sketch.vertices.map(toScreen);
	const loose = sketch.nextVertex === null ? [] : [toScreen(sketch.nextVertex)];
	const points = [...vertices, ...loose];
	const outlineFlat = points.length < 2 ? null : points.flatMap((at) => [at.x, at.y]);
	const first = vertices.at(0);
	const closeArmed =
		sketch.pointer !== null && first !== undefined && closesPolygon(vertices.length, toScreen(sketch.pointer), first);
	return { vertices, outlineFlat, closeArmed };
}

export function measurementScreenMarks(segment: LineSegment | null, toScreen: ToScreen): RulerMarks | null {
	return segment === null ? null : rulerMarks(toScreen(segment.start), toScreen(segment.end));
}
```

- [ ] **Step 4: Run the node test to verify it passes**

Run: `npx vitest run tests/presentation/editor/gestureGeometry.test.ts --no-coverage`
Expected: PASS, 5 tests.

- [ ] **Step 5: Refactor `InteractionLayer.vue` onto the module, behaviour unchanged**

In `src/presentation/editor/layers/InteractionLayer.vue`:

Replace the import of `closesPolygon` and the import of `paintRulerMarks, rulerMarks` with:

```typescript
import { paintRulerMarks } from './rulerGeometry';
import { measurementScreenMarks, sketchScreenGeometry } from './gestureGeometry';
```

Delete the four computeds `sketchVertices`, `sketchOutlineFlat`, `closeArmed` and `measurementMarks`, and add in their place:

```typescript
/** The sketch, projected once per render through the ONE module both surfaces share. */
const sketch = computed(() => sketchScreenGeometry(runtime.renderState.polygonSketch, toScreen));
const measurementMarks = computed(() => measurementScreenMarks(runtime.renderState.measurement, toScreen));
```

Replace `vertexRadius` and `vertexFill` with:

```typescript
function vertexRadius(index: number): number {
	if (index !== 0) return POLYGON_VERTEX_RADIUS_PX;
	return sketch.value?.closeArmed === true ? POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX : POLYGON_CLOSE_TARGET_RADIUS_PX;
}
function vertexFill(index: number): string {
	return index === 0 && sketch.value?.closeArmed === true ? props.tokens.accent : props.tokens.canvasBackground;
}
```

In the template, change `<template v-if="sketchVertices !== null">` to `<template v-if="sketch !== null">`, change `v-if="sketchOutlineFlat !== null"` to `v-if="sketch.outlineFlat !== null"`, change `points: sketchOutlineFlat,` to `points: sketch.outlineFlat,`, and change `v-for="(vertex, index) in sketchVertices"` to `v-for="(vertex, index) in sketch.vertices"`. Leave every other line of the template untouched.

- [ ] **Step 6: Run the plan editor's gesture suites to prove the refactor changed nothing**

Run: `npx vitest run tests/presentation/editor/interactionLayer.test.ts tests/presentation/editor/canvasGestureOwnership.test.ts tests/presentation/editor/canvasKeyboardGestures.test.ts tests/presentation/editor/zoneEditing.test.ts --no-coverage`
Expected: PASS with the same counts as before the edit.

- [ ] **Step 7: Write the failing designer test**

Add to `tests/helpers/designerRig.ts`, after `click`:

```typescript
/** A hover: a move with NO button held, which is the input a rubber band follows. */
export function move(rig: DesignerRig, world: Point): void {
	const at = rig.at(world);
	pointer(rig.canvasEl, 'pointermove', at.x, at.y, { buttons: 0 });
}
```

Create `tests/presentation/designer/designerGesture.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../../../src/presentation/editor/handleMetrics';
import { t } from '../../../src/presentation/i18n/strings';
import { settle } from '../../helpers/editor';
import { click, designerRig, move, type DesignerRig } from '../../helpers/designerRig';

function gestureLayer(rig: DesignerRig): Konva.Layer {
	const layer = rig.stage.findOne<Konva.Layer>('.asset-gesture');
	if (layer === undefined) throw new Error('expected a mounted gesture layer');
	return layer;
}

function radii(rig: DesignerRig): number[] {
	return gestureLayer(rig).find('Circle').map((circle) => (circle as Konva.Circle).radius());
}

/**
 * The designer drew NOTHING between clicks for a whole increment: `DrawPolygonTool` closes only
 * on a click within twelve screen pixels of the first vertex, and that vertex was drawn
 * nowhere. These cases drive the real tool through the real rig and read the layer.
 */
describe('the designer while a footprint is being traced', () => {
	it('marks every placed vertex, and draws the first one as the close target', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		click(rig, { x: 1000, y: 0 });
		click(rig, { x: 1000, y: 1000 });
		await settle();
		expect(radii(rig)).toEqual([POLYGON_CLOSE_TARGET_RADIUS_PX, POLYGON_VERTEX_RADIUS_PX, POLYGON_VERTEX_RADIUS_PX]);
		rig.unmount();
	});

	it('grows the close target while the pointer is over the first vertex, and clears the sketch on close', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		click(rig, { x: 1000, y: 0 });
		click(rig, { x: 1000, y: 1000 });
		move(rig, { x: 0, y: 0 });
		await settle();
		expect(radii(rig).at(0)).toBe(POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX);

		click(rig, { x: 0, y: 0 });
		await settle();
		expect(radii(rig)).toEqual([]);
		expect((await rig.document()).shape?.footprint.points).toHaveLength(3);
		rig.unmount();
	});
});

describe('the designer while a calibration is being measured', () => {
	it('draws the tape from the first pick, following the pointer', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.calibrate')).click();
		await settle();
		click(rig, { x: 0, y: 0 });
		move(rig, { x: 500, y: 0 });
		await settle();
		const marks = gestureLayer(rig).findOne<Konva.Shape>('.measurement-marks');
		expect(marks).toBeDefined();
		rig.unmount();
	});
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run tests/presentation/designer/designerGesture.test.ts --no-coverage`
Expected: FAIL at `expected a mounted gesture layer`.

- [ ] **Step 9: Name the layer, create it, mount it**

In `src/presentation/designer/layers/backgroundLayer.ts`, change the union to:

```typescript
export type DesignerLayerName =
	| 'asset-background'
	| 'asset-footprint'
	| 'asset-clearance'
	| 'asset-anchor'
	| 'asset-gesture';
```

and after `BACKGROUND_LAYER` add:

```typescript
/**
 * The gesture layer's name — the one SCREEN-space layer, drawn last, above every world-space
 * one, because a rubber band and a close target are sized in pixels and must not scale with
 * the camera. A constant for `BACKGROUND_LAYER`'s reason: its node is built by a component
 * whose `name` is not checked against this union anywhere else.
 */
export const GESTURE_LAYER: DesignerLayerName = 'asset-gesture';
```

Create `src/presentation/designer/layers/DesignerGestureLayer.vue`:

```vue
<script setup lang="ts">
/**
 * The asset designer's transient layer: the footprint or clearance being traced, and the
 * calibration tape being measured, read from the leaf's `RenderState` and drawn in SCREEN
 * space over the four world-space layers.
 *
 * Every projection and the close-target rule come from `editor/layers/gestureGeometry.ts`,
 * which `InteractionLayer.vue` calls for the plan editor; only the template lives twice,
 * because the plan editor's also draws a selection and a translated ghost this surface has
 * no subject for. `listening: false` for the same reason every designer layer says it — the
 * tools hit-test world points themselves.
 *
 * It takes the `RenderState` as a PROP rather than injecting the runtime, so it can be mounted
 * standalone in the harness against a fixture and drawn there.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { Point } from '../../../core/geometry/Point';
import { useEditorStore } from '../../stores/EditorStore';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import type { RenderState } from '../../editor/tools/render-state';
import { STAGE_PIXELS, worldToScreen } from '../../editor/viewport/Viewport';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../../editor/handleMetrics';
import { paintRulerMarks } from '../../editor/layers/rulerGeometry';
import { measurementScreenMarks, sketchScreenGeometry } from '../../editor/layers/gestureGeometry';
import { GESTURE_LAYER } from './backgroundLayer';

const props = defineProps<{ renderState: RenderState; tokens: ThemeTokens }>();

const { viewport } = storeToRefs(useEditorStore());

function toScreen(point: Point) {
	return worldToScreen(point, viewport.value, STAGE_PIXELS);
}

const sketch = computed(() => sketchScreenGeometry(props.renderState.polygonSketch, toScreen));
const measurementMarks = computed(() => measurementScreenMarks(props.renderState.measurement, toScreen));

function vertexRadius(index: number): number {
	if (index !== 0) return POLYGON_VERTEX_RADIUS_PX;
	return sketch.value?.closeArmed === true ? POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX : POLYGON_CLOSE_TARGET_RADIUS_PX;
}

function vertexFill(index: number): string {
	return index === 0 && sketch.value?.closeArmed === true ? props.tokens.accent : props.tokens.canvasBackground;
}
</script>

<template>
	<VLayer :config="{ name: GESTURE_LAYER, listening: false }">
		<template v-if="sketch !== null">
			<VLine
				v-if="sketch.outlineFlat !== null"
				:config="{
					points: sketch.outlineFlat,
					closed: true,
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
					dash: [4, 4],
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VCircle
				v-for="(vertex, index) in sketch.vertices"
				:key="index"
				:config="{
					x: vertex.x,
					y: vertex.y,
					radius: vertexRadius(index),
					fill: vertexFill(index),
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
					listening: false,
				}"
			/>
		</template>
		<template v-if="measurementMarks !== null">
			<VLine
				:config="{
					points: measurementMarks.spine,
					stroke: props.tokens.accent,
					strokeWidth: 2,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VShape
				:config="{
					name: 'measurement-marks',
					marks: measurementMarks,
					sceneFunc: paintRulerMarks,
					stroke: props.tokens.accent,
					strokeScaleEnabled: false,
					perfectDrawEnabled: false,
					listening: false,
				}"
			/>
		</template>
	</VLayer>
</template>
```

In `src/presentation/designer/DesignerCanvas.vue`:

Add the import `import DesignerGestureLayer from './layers/DesignerGestureLayer.vue';` after the `anchorLayer` import. Change `const { toolManager } = useDesignerRuntime();` to `const { toolManager, renderState } = useDesignerRuntime();`. In the template, after the closing `</VLayer>` of the `asset-anchor` layer and before `</VStage>`, add:

```vue
				<!--
					Screen space and LAST: the gesture in progress sits over every committed
					picture, sized in pixels. `layers.test.ts` asserts this order by name.
				-->
				<DesignerGestureLayer
					:render-state="renderState"
					:tokens="tokens"
				/>
```

Replace the docblock paragraph beginning `` * **Nothing on this canvas draws a gesture IN PROGRESS.** `` (four lines) with:

```
 * **The gesture in progress is drawn by `DesignerGestureLayer`, last and in screen space.**
 * For a whole increment it was not — no task built a designer interaction layer, and a user
 * traced against a close target drawn nowhere — which the docblocks of this file,
 * `registerDesignerTools.ts` and `AssetDesignerRoot.vue` recorded as a gap and nothing
 * scheduled. The arithmetic is `editor/layers/gestureGeometry.ts`, shared with the plan editor.
```

- [ ] **Step 10: Update the layer-order assertions and run the designer suites**

In `tests/presentation/designer/layers.test.ts`, the assertion listing `'asset-background', 'asset-footprint', 'asset-clearance', 'asset-anchor'` gains `'asset-gesture',` as its last entry. In `tests/presentation/designer/designerBackground.test.ts`, the case `draws the sheet beneath the footprint, the clearance and the anchor` lists the layer names the same way; add `'asset-gesture',` last there too.

Run: `npx vitest run tests/presentation/designer --no-coverage`
Expected: PASS, including the three new gesture cases and `regionsReachable.test.ts`, which now finds the new `.vue` reachable from the view.

- [ ] **Step 11: Retire the sentences that recorded the gap**

In `src/presentation/designer/tools/registerDesignerTools.ts`, find the docblock paragraph that says no designer layer reads `polygonSketch`/`measurement` (grep `interaction layer` in that file) and replace that paragraph with:

```
 * **What these tools publish to `RenderState` is drawn by `DesignerGestureLayer`** — the sketch
 * and the tape both — through the same `gestureGeometry.ts` the plan editor's interaction layer
 * uses. It was not for a whole increment, and the close target a trace has to hit was invisible.
```

In `src/presentation/designer/AssetDesignerRoot.vue`, in the overlay docblock, replace the sentence beginning `` * design slice B4 gave the designer four world-space layers and no transient one, so a gesture `` through `` * of what they were doing. `` with:

```
 * the designer's gesture layer draws the vertices and the close target now, and an opaque
 * centred card over them would hide exactly the picture a user mid-gesture is steering by.
```

In `src/presentation/designer/tools/set-facing-tool.ts`, grep `interaction layer` or `no designer layer` and rewrite that sentence to say the measurement is drawn by `DesignerGestureLayer`. In `tests/presentation/designer/tools/designerToolUnits.test.ts`, replace `the field a designer interaction layer will read` with `the field `DesignerGestureLayer` reads`.

In `docs/tests/cases/Design an Asset.md`:
- Step 10's Expected column: prepend `Each click draws a small circle at the vertex, the first one larger; moving back over the first vertex grows it before the closing click. ` to the existing text.
- Delete the "Deliberately NOT checked" bullet that begins `**Gesture feedback while tracing`(or equivalent; it is the bullet whose text says no designer layer reads `RenderState.polygonSketch` or `RenderState.measurement`).
- Add a new step after step 16: `| 16a | \`browser\` | Look at the canvas after the calibration lands | The spec sheet has grown with the footprint, and the outline still sits over the pixels it was traced on | Task 1 of the review fixes: \`drawnWorldScale\` corrects the raster by the asset's own \`pixelsPerWorldUnit\`; before it the footprint doubled and the sheet did not |`

- [ ] **Step 12: Run the whole editor and designer trees and build**

Run: `npx vitest run tests/presentation --no-coverage && npm run build`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/presentation/editor/layers/gestureGeometry.ts src/presentation/editor/layers/InteractionLayer.vue src/presentation/designer/layers/DesignerGestureLayer.vue src/presentation/designer/layers/backgroundLayer.ts src/presentation/designer/DesignerCanvas.vue src/presentation/designer/AssetDesignerRoot.vue src/presentation/designer/tools/registerDesignerTools.ts src/presentation/designer/tools/set-facing-tool.ts tests/helpers/designerRig.ts tests/presentation/editor/gestureGeometry.test.ts tests/presentation/designer/designerGesture.test.ts tests/presentation/designer/layers.test.ts tests/presentation/designer/designerBackground.test.ts tests/presentation/designer/tools/designerToolUnits.test.ts "docs/tests/cases/Design an Asset.md"
git commit -m "Draw the designer's gesture in progress through the geometry the plan editor already had"
```

---

### Task 6: Remove the Select tool from the designer

**Closes:** Important finding "the registered Select tool does nothing it can deliver". It hit-tests an empty set, its move factory throws under a comment saying "until Task B8 gives this surface a selection", and B8 shipped an inspector that reads no selection. A control the surface offers for a capability it does not have is a live control that does nothing, which slice 14's amendment refuses.

**Files:**
- Modify: `src/presentation/designer/tools/registerDesignerTools.ts`
- Modify: `tests/presentation/designer/tools/designerToolUnits.test.ts`
- Modify: `tests/presentation/designer/designerToolbar.test.ts`
- Modify: `docs/tests/cases/Design an Asset.md`
- Modify: `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md`

- [ ] **Step 1: Write the failing toolbar test**

In `tests/presentation/designer/designerToolbar.test.ts`, add a case inside `describe('every tool the toolbar offers', …)`:

```typescript
	it('offers Pan, the five design tools, Undo and Redo — and no Select, because nothing here is selectable', async () => {
		const rig = await designerRig();
		const labels = rig.wrapper.findAll('.rp-designer-tools button').map((button) => button.text());
		expect(labels).toEqual([
			t('en', 'editor.toolbar.pan'),
			t('en', 'designer.toolbar.trace-footprint'),
			t('en', 'designer.toolbar.trace-clearance'),
			t('en', 'designer.toolbar.set-anchor'),
			t('en', 'designer.toolbar.set-facing'),
			t('en', 'designer.toolbar.calibrate'),
			t('en', 'editor.toolbar.undo'),
			t('en', 'editor.toolbar.redo'),
		]);
		rig.unmount();
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/designer/designerToolbar.test.ts --no-coverage`
Expected: FAIL, the received list carries `Select` second.

- [ ] **Step 3: Remove the tool**

In `src/presentation/designer/tools/registerDesignerTools.ts`:
- Delete the line `import { SelectTool } from '../../editor/tools/select-tool';`.
- Delete the `select: 'editor.toolbar.select',` entry from `DESIGNER_TOOL_LABELS`.
- Delete `noSelectableObjectsYet` and `designerSelectTool` entirely, with their docblocks.
- Delete the `select: designerSelectTool(deps),` entry from `tools`.
- Add above `DESIGNER_TOOL_LABELS`:

```typescript
/**
 * FIVE tools and no Select. The designer shipped a `SelectTool` over an empty candidate set
 * with a move factory that threw, under a docblock saying Task B8 would give the surface a
 * selection; B8 shipped an inspector that reads the design and no selection, and the button
 * stayed — a live control that did nothing but stop a primary-button pan, which slice 14's
 * amendment refuses. Selection returns with the first thing on this canvas that can be
 * selected and moved, and it returns with its candidates and its gesture together.
 */
```

In `tests/presentation/designer/tools/designerToolUnits.test.ts`, delete the import of `noSelectableObjectsYet` and the whole `describe('the designer’s selection', …)` block with its docblock.

- [ ] **Step 4: Run the designer suites**

Run: `npx vitest run tests/presentation/designer tests/presentation/editor/snapping --no-coverage`
Expected: PASS. `designerToolbar.test.ts`'s `it.each` now runs five tools.

- [ ] **Step 5: Correct the manual case and record the withdrawal**

In `docs/tests/cases/Design an Asset.md`, step 5's Expected column: replace `Seven tool buttons on one line — Pan, Select, Trace footprint,` with `Six tool buttons on one line — Pan, Trace footprint,`.

In `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md`, find the Task B5 section (grep `registerDesignerTools`) and append after its last amendment, or at the end of the task if it has none:

```markdown
#### Amendment — Select withdrawn from the designer, 2026-09-02

The spec's toolbar list names "select" and B5 registered a `SelectTool` over an empty
candidate set whose move factory threw "until Task B8 gives this surface a selection". B8 built
an inspector that reads the design and no selection, so the tool stayed registered with nothing
to select and a button that did nothing. Withdrawn by the review-fixes plan
(`2026-09-02-asset-designer-review-fixes.md`, Task 6): the designer offers five tools and Pan.
Selection returns with the first selectable thing on this canvas, candidates and gesture
together, and the spec's list is read as the tools that exist rather than as a promise.
```

- [ ] **Step 6: Commit**

```bash
git add src/presentation/designer/tools/registerDesignerTools.ts tests/presentation/designer/tools/designerToolUnits.test.ts tests/presentation/designer/designerToolbar.test.ts "docs/tests/cases/Design an Asset.md" docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md
git commit -m "Withdraw the designer's Select tool, which had nothing to select"
```

---

### Task 7: The new-asset form defaults to the configured currency

**Closes:** Important finding "`NewAssetForm` hard-codes EUR". `CreateProjectCommand` is composed with the `defaultCurrency` setting; the asset form's `INITIAL.currency` is the literal `'EUR'`, so a GBP user who accepts the prefilled asset and assigns it into a GBP project is refused with `cost.currency-mismatch` on a default the plugin itself supplied.

**Files:**
- Modify: `src/presentation/views/renovationProjectCommands.ts`
- Modify: `src/plugin/composition-root.ts`
- Modify: `src/presentation/views/ViewRoot.vue`
- Modify: `src/presentation/views/NewAssetForm.vue`
- Modify: `tests/presentation/views/newAssetForm.test.ts`
- Modify: `tests/presentation/dialogs/formBusy.test.ts`
- Modify: `tests/helpers/makeRenovationProjectView.ts`
- Modify: `tests/presentation/views/viewRootCreateAsset.test.ts`
- Modify: `tests/plugin/renovationProjectCommandWiring.test.ts`

**Interfaces:**
- Produces: `RenovationProjectCommandServices.defaultCurrency: Currency`; `PersistenceServices.defaultCurrency: Currency`; `NewAssetForm` prop `defaultCurrency: string` (REQUIRED).

- [ ] **Step 1: Write the failing form test**

In `tests/presentation/views/newAssetForm.test.ts`, change `mountAndSubmit`'s mount line to `const wrapper = mount(NewAssetForm, { props: { ...props, logger: recorder, defaultCurrency: 'EUR' } });` and add this case inside `describe('NewAssetForm', …)`:

```typescript
	it('prefills the currency from the configured default rather than from a literal', async () => {
		const createAsset = createOk();
		const wrapper = mount(NewAssetForm, {
			props: { createAsset, setFootprintFromDimensions: footprintOk(), logger: recorder, defaultCurrency: 'GBP' },
		});
		expect((wrapper.get('[data-field="currency"]').element as HTMLInputElement).value).toBe('GBP');
		await wrapper.get('[data-field="name"]').setValue('Kitchen island');
		await wrapper.get('[data-field="unitCostAmount"]').setValue('450.00');
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(createAsset.mock.calls[0][0]).toMatchObject({ currency: 'GBP' });
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/newAssetForm.test.ts --no-coverage`
Expected: FAIL, the input's value is `EUR`.

- [ ] **Step 3: Carry the default from the settings to the form**

In `src/presentation/views/renovationProjectCommands.ts`:
- Add `import { currencyOf, type Currency } from '../../core/money/Money';`.
- In `RenovationProjectCommandServices`, after `readonly logger: Logger;` add:

```typescript
	/**
	 * The plugin's `defaultCurrency` setting, for the creation form's prefill. `CreateProject`
	 * takes it at the composition root; `CreateAsset` takes its currency from its input, so the
	 * FORM is where an asset's default is decided, and a literal there re-denominated every
	 * new asset in a vault configured otherwise.
	 */
	readonly defaultCurrency: Currency;
```

- In `unavailableRenovationProjectCommands()`, after `logger: { … },` add `defaultCurrency: currencyOf('EUR'),` with the comment `// The refusal bundle writes nothing, so its prefill is never persisted; a valid code is all the form needs.`

In `src/plugin/composition-root.ts`:
- In `PersistenceServices`, after `readonly overlaps: LibraryOverlaps;` add `readonly defaultCurrency: Currency;` (import `type Currency` from `'../core/money/Money'` if the file does not already).
- In the `persistence: { … }` return, after `overlaps: repositories.overlaps,` add `defaultCurrency: repositories.defaultCurrency,`.
- In `renovationProjectDeps`, in the `commands:` object after `logger: root.logger,` add `defaultCurrency: persistence.defaultCurrency,`.

In `src/presentation/views/ViewRoot.vue`, in `onCreateAsset`'s `props:` after `logger: context.commands.logger,` add `defaultCurrency: context.commands.defaultCurrency,`.

In `src/presentation/views/NewAssetForm.vue`:
- Add `defaultCurrency: string;` to `defineProps` after `logger: Logger;`.
- Change `currency: 'EUR',` in `INITIAL` to `currency: '',` and change `initial: INITIAL,` in `useFormCommit` to `initial: { ...INITIAL, currency: props.defaultCurrency },`.

- [ ] **Step 4: Update every other mount and the fake bundle**

- `tests/presentation/dialogs/formBusy.test.ts`: in the `NewAssetForm` `props:` object (the one with `createAsset`, `setFootprintFromDimensions`, `logger`) add `defaultCurrency: 'EUR',`.
- `tests/helpers/makeRenovationProjectView.ts`: in the `commands: { … }` literal after `logger: recorder,` add `defaultCurrency: DEFAULT_SETTINGS.defaultCurrency,` (the file already imports `DEFAULT_SETTINGS`, as its `createProject` line shows).
- `tests/presentation/views/viewRootCreateAsset.test.ts`: add a case beside the one that fills `['currency', 'EUR']`, opening the form the same way that case does and asserting the prefill:

```typescript
	it('prefills the asset currency from the bundle default', async () => {
		// Open the New asset form exactly as the sibling case above does, then:
		expect((wrapper.get('[data-field="currency"]').element as HTMLInputElement).value).toBe(
			DEFAULT_SETTINGS.defaultCurrency,
		);
	});
```

(Copy the sibling case's setup lines verbatim above the assertion, and import `DEFAULT_SETTINGS` from `'../../../src/plugin/settings/settings'`.)

- `tests/plugin/renovationProjectCommandWiring.test.ts`: add a case:

```typescript
	it('carries a valid default currency even while every write refuses', () => {
		expect(unavailableRenovationProjectCommands().defaultCurrency).toBe('EUR');
	});
```

- [ ] **Step 5: Run the suites and build**

Run: `npx vitest run tests/presentation/views tests/presentation/dialogs tests/plugin/renovationProjectCommandWiring.test.ts tests/plugin/assetDesignerWiring.test.ts --no-coverage && npm run build`
Expected: PASS. A `vue-tsc` error naming `defaultCurrency` means a mount or bundle literal was missed.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/views/renovationProjectCommands.ts src/plugin/composition-root.ts src/presentation/views/ViewRoot.vue src/presentation/views/NewAssetForm.vue tests/presentation/views/newAssetForm.test.ts tests/presentation/dialogs/formBusy.test.ts tests/helpers/makeRenovationProjectView.ts tests/presentation/views/viewRootCreateAsset.test.ts tests/plugin/renovationProjectCommandWiring.test.ts
git commit -m "Prefill a new asset's currency from the configured default"
```

---

### Task 8: Pin the plan editor's zone completion

**Closes:** Important finding "the zone completion is asserted by nothing". The generalised `DrawPolygonTool` takes a completion, and the plan editor's `registerEditorTools` builds the zone's plan id, counted name and `'Room'` type in a closure that no test reads since the tool-level assertions were deleted.

**Files:**
- Modify: `tests/presentation/editor/zoneEditing.test.ts`

- [ ] **Step 1: Add the assertions to the first case**

In `tests/presentation/editor/zoneEditing.test.ts`, in the case `draws a zone through the toolbar and canvas, persists it, selects it, and undo/redo keep the SAME id`, directly after the `expect(created.entity.geometry.points).toEqual([…]);` block add:

```typescript
		// The completion the plan editor hands `DrawPolygonTool` — plan id, counted name, Room —
		// used to be asserted at the tool and is asserted at the CLOSURE now, which is the only
		// place it exists since the tool stopped hard-wiring `CreateZone`.
		expect(created.entity.planId).toBe('plan-e2e');
		expect(created.entity.name).toBe('Zone 2');
		expect(created.entity.zoneType).toBe('Room');
```

- [ ] **Step 2: Run it, then prove it binds**

Run: `npx vitest run tests/presentation/editor/zoneEditing.test.ts --no-coverage`
Expected: PASS.

Then in `src/presentation/editor/runtime.ts`, inside `registerEditorTools`'s completion, temporarily change `zoneType: 'Room'` to `zoneType: 'Terrace'` and re-run. Expected: FAIL at `expected 'Terrace' to be 'Room'`. Revert with `git checkout -- src/presentation/editor/runtime.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/presentation/editor/zoneEditing.test.ts
git commit -m "Pin the plan editor's zone completion at the closure that builds it"
```

---

### Task 9: Mount the dimensions dialog with its warning

**Closes:** parked item "no test mounts `AssetDimensionsDialog` with a `warning`". The fix-wave case asserts the DESCRIPTOR carries the warning; nothing asserts the template renders it, so a dropped `<p>` or a misspelled class passes every gate. This repository shipped `rp-save-state-error` against an emitted `rp-save-state-save-error` once.

**Files:**
- Modify: `tests/presentation/dialogs/dialogKinds.test.ts`

- [ ] **Step 1: Write the test**

In `tests/presentation/dialogs/dialogKinds.test.ts`, add `import { readFileSync } from 'node:fs';` and this block at the end of the file:

```typescript
describe('AssetDimensionsDialog', () => {
	it('renders the caller warning above the fields, in a class the stylesheet declares', () => {
		const warned = mount(AssetDimensionsDialog, {
			props: {
				descriptor: { kind: 'asset-dimensions', title: 'Set dimensions', warning: 'Not measured yet.' },
				titleId: TITLE_ID,
			},
		});
		const warning = warned.get('.rp-dialog-warning');
		expect(warning.text()).toBe('Not measured yet.');
		// Above the fields: the warning is a claim about the PAIR, so it precedes both inputs.
		expect(warned.element.innerHTML.indexOf('rp-dialog-warning')).toBeLessThan(
			warned.element.innerHTML.indexOf('name="width"'),
		);
		// jsdom resolves no CSS, so the class the template emits is checked against the sheet
		// by text — the `rp-save-state-error` defect, refused here before it can recur.
		expect(readFileSync('styles/dialogs.css', 'utf8')).toContain('.rp-dialog-warning {');
	});

	it('renders no warning element at all when the caller sends none', () => {
		const silent = mount(AssetDimensionsDialog, {
			props: { descriptor: { kind: 'asset-dimensions', title: 'Set dimensions' }, titleId: TITLE_ID },
		});
		expect(silent.find('.rp-dialog-warning').exists()).toBe(false);
	});
});
```

- [ ] **Step 2: Run it, then prove it binds**

Run: `npx vitest run tests/presentation/dialogs/dialogKinds.test.ts --no-coverage`
Expected: PASS.

Then temporarily change `class="rp-dialog-warning"` in `src/presentation/dialogs/AssetDimensionsDialog.vue` to `class="rp-dialog-warn"` and re-run. Expected: FAIL at `warned.get('.rp-dialog-warning')`. Revert with `git checkout -- src/presentation/dialogs/AssetDimensionsDialog.vue`.

- [ ] **Step 3: Commit**

```bash
git add tests/presentation/dialogs/dialogKinds.test.ts
git commit -m "Mount the dimensions dialog with a warning, so the class it emits is bound"
```

---

### Task 10: German register and terminology

**Closes:** Important finding "the German copy mixes register and terminology". Main's locale has zero informal imperatives; this branch added six du-form strings beside fourteen Sie-form ones, and the footprint is *Umriss* in eight keys but *Grundfläche* in the toolbar.

**Files:**
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `tests/presentation/i18n/strings.test.ts`

- [ ] **Step 1: Write the failing register test**

In `tests/presentation/i18n/strings.test.ts`, add a case beside the existing German term checks (the `describe` that pins `Objekt` and `Vault`):

```typescript
	it('addresses the user formally throughout: no du-form imperative anywhere in de.ts', () => {
		// The locale used the formal Sie in every sentence until one increment added six
		// du-form imperatives beside fourteen Sie-form ones. A register is a fact about the whole
		// file, so the check is over every value rather than over the six that were found.
		const informal = /\b(Gib|Wähle|Setze|Lege|Zeichne|Tippe|Klicke|Ziehe)\b/;
		const offenders = Object.entries(de)
			.filter(([, german]) => informal.test(german))
			.map(([key]) => key);
		expect(offenders).toEqual([]);
	});

	it('calls a footprint an Umriss everywhere, including the toolbar', () => {
		expect(de['designer.toolbar.trace-footprint']).toBe('Umriss nachzeichnen');
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/i18n/strings.test.ts --no-coverage`
Expected: FAIL, `offenders` lists six keys and the toolbar label reads `Grundfläche nachzeichnen`.

- [ ] **Step 3: Rewrite the seven strings**

In `src/presentation/i18n/locales/de.ts`:

| key | new value |
| --- | --- |
| `asset.unknown-category` | `Wählen Sie eine Kategorie aus der Liste.` |
| `asset.invalid-height` | `Geben Sie eine Höhe als Zahl in Millimetern ein.` |
| `asset.no-footprint` | `Geben Sie diesem Objekt zuerst einen Umriss; Freiraum, Ankerpunkt und Ausrichtung beziehen sich jeweils darauf.` |
| `money.invalid-amount` | `Geben Sie einen Betrag als einfache Dezimalzahl ein, zum Beispiel 45.00.` |
| `money.invalid-currency` | `Geben Sie einen dreibuchstabigen Währungscode in Großbuchstaben ein.` |
| `settings.library-source-is-vault-root` | replace the trailing sentence `Setze ihn zuerst in der data.json auf einen echten Ordner.` with `Setzen Sie ihn zuerst in der data.json auf einen echten Ordner.` |
| `designer.toolbar.trace-footprint` | `Umriss nachzeichnen` |

- [ ] **Step 4: Run the locale suite**

Run: `npx vitest run tests/presentation/i18n --no-coverage`
Expected: PASS, including the completeness and interpolation-hole cases.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/i18n/locales/de.ts tests/presentation/i18n/strings.test.ts
git commit -m "Address the user formally in every German sentence, and call a footprint an Umriss"
```

---

### Task 11: Docblocks, the manual case, CLAUDE.md and the coverage ledger

**Closes:** the false counts and exclusivity claims the review grepped, the plan-editor behaviour changes that rode in the refactor unrecorded, and the missing dated coverage entry. Every sentence below is replaced with one written from a grep run in this task.

**Files:**
- Modify: `src/application/commands/DispatchOutcome.ts`
- Modify: `src/plugin/guardedServices.ts`
- Modify: `src/application/editor/asset/ReversibleAssetDesignCommands.ts`
- Modify: `src/presentation/designer/stores/assetDesignStore.ts`
- Modify: `src/domain/asset/Asset.events.ts`
- Modify: `src/presentation/designer/layers/anchorLayer.ts`
- Modify: `src/presentation/designer/AssetDesignerContext.ts`
- Modify: `src/presentation/designer/designerCommands.ts`
- Modify: `src/presentation/designer/DesignerCanvas.vue`
- Modify: `tests/harness/fixture.ts`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Correct each sentence from its grep**

Run each grep, then edit:

1. `grep -rn "markUncompensated(" src/ | grep -v DispatchOutcome.ts` prints four call sites in three files after Task 4. In `src/application/commands/DispatchOutcome.ts` replace the paragraph beginning `` * **Its only producer today is `compensate` in `application/reference/deleteResolution.ts`**, `` with:

```
 * **Four producers in three files** — `grep -rn "markUncompensated(" src/`, run in the edit that
 * wrote this: `deleteResolution.ts`'s `compensate` and its `markStalePersisted` re-read,
 * `SetAssetBackground.ts`'s failed calibration restore, and
 * `ReversibleAssetDesignCommands.ts`'s failed sidecar restore on a background undo. Each is
 * at a moment the vault is KNOWN to be half-written. A compensation that succeeds leaves the
 * vault at its pre-state and is deliberately NOT marked with this: neutral is the true answer
 * for the indicator, and `CompensatedWrite` below is how the LEDGER still hears of it.
```

2. `grep -c "GuardedDesignCommand<" src/plugin/guardedServices.ts` prints 8, and the bundle has a ninth member `get`. In `src/plugin/guardedServices.ts` replace `ONE BUNDLE rather than seven top-level members, because these seven are the whole surface` with `ONE BUNDLE rather than nine top-level members — eight commands and one query — because these nine are the whole surface`, and replace `than spelled at seven members so an eighth design command cannot arrive carrying one door.` with `than spelled at eight members so a ninth design command cannot arrive carrying one door.`

3. `grep -c "new Reversible" src/application/editor/asset/ReversibleAssetDesignCommands.ts` prints 8 constructions over THREE classes. Replace `EIGHT doors and SIX mechanisms:` with `EIGHT doors and THREE mechanisms:` and the rest of that sentence with `six doors — both footprint commands, the clearance, the anchor, the facing and Task B6's calibration — are inverted by the same geometry adapter, because what an inverse restores is the sidecar's whole document; the height is the note adapter's; and Task B7's background is its own, `ReversibleAssetBackgroundEdit`, being the one door that spans both resources.`

4. `grep -rn "store.hydrate(\|\.hydrate(" src/presentation/designer/` prints one call site in `runtime.ts`. In `src/presentation/designer/stores/assetDesignStore.ts` replace `THE hydration routine. One, with three callers, rather than one per site.` with `THE hydration routine. ONE call site (`runtime.ts`'s `read`), reached from four triggers — mount, retry, the post-command refresh and the cross-leaf subscription — rather than one routine per trigger.`

5. In `src/domain/asset/Asset.events.ts` replace the paragraph beginning `` * **Nothing subscribes to it yet.** `` with:

```
 * **Its subscriber is `createAssetDesignChangeSource`**, which every designer leaf takes through
 * `AssetDesignerDeps.onDesignChanged`; publishing it from every design command is what lets a
 * peer leaf showing the same asset re-read, forward path and undo path alike.
```

6. In `src/presentation/designer/layers/anchorLayer.ts` replace `and Task B5's set-anchor` / `tool is what will need the grab radius beside it.` with `and the day this mark becomes draggable, the grab radius beside it is the one to reach for — `SetAnchorTool` today places on a bare click and hit-tests nothing.`

7. In `src/presentation/designer/AssetDesignerContext.ts` replace `The designer's four tools are that first thing.` with `The designer's five tools are that first thing.`; in `src/presentation/designer/designerCommands.ts` replace `This slice's four tools are that first` with `This slice's five tools are that first`; in `src/presentation/designer/DesignerCanvas.vue` replace `B5 registers five and moved the manager` with `B5 registered the tools and moved the manager`.

8. In `tests/harness/fixture.ts` replace `` — `PlanEditorRoot`, `BackgroundLayer`, anything `` with `` — `PlanEditorRoot`, `PlanCanvas`, anything `` (`BackgroundLayer` takes props and calls no context since Task B1; `PlanCanvas` does).

9. In `CLAUDE.md`, in the paragraph beginning `**One function is not enough on its own, because a leaf takes TIME to exist.**`, replace `there are exactly two in `src/`, counted by grepping `getLeaf(` and` / ``getLeavesOfType(` —` with `there are exactly two in `src/`, `openNote.ts` and `reveal.ts`, counted by grepping `getLeaf('tab')` — a bare `getLeaf(` grep prints seventeen lines today, most of them thunks and rebind loops —`. In the two sentences saying `KnownDistanceForm` `disables its submit` (grep `disables its submit` prints two lines), replace `disables its submit button` and `disables its submit` with `marks its submit button `aria-disabled`` and `marks its submit `aria-disabled`` respectively, and append to the first: `— and `onSubmit` returns without emitting for an unparseable value, which `calibrateWiring.test.ts` pins, since an `aria-disabled` button is still clickable.`

- [ ] **Step 2: Record the two plan-editor behaviour changes**

In `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md`, at the end of the Task B1 section (grep `EditorSurface`), append:

```markdown
#### Amendment — two plan-editor behaviour changes rode beside the extraction, 2026-09-02

The extraction commit itself is byte-faithful, verified by diffing the old `PlanCanvas.vue`
against `EditorSurface.vue` and by mutating four pointer rules and watching each redden at its
assertion. Two later commits on this branch changed the plan editor's behaviour in ways no task
here named:

- `DrawPolygonTool.closePolygon` now reports a refusal even when the gesture was cancelled
  mid-dispatch (the `reportRejected` call moved above the generation check). Kept: a refusal is
  a fact about the vault whether or not the user has moved on.
- `ReversibleMoveZoneCommand.undo` gained an `undo.superseded` refusal keyed on the ledger's
  per-entity generation, so a move's undo refuses after any later write to that zone from
  outside the history. Kept, with the standing consequence CLAUDE.md records for
  `undo.superseded`: a refused undo stays on the stack and `canUndo` reads true.

Both are recorded here because a reviewer had to find them by reading the diff.
```

In `CLAUDE.md`, at the end of the "Design slice 8 has landed" bullet list, append one bullet:

```markdown
- **`undo.superseded` is the designed answer to a peer's write, and it pins the stack.** A
  refused undo stays on `CommandHistory`'s stack, `canUndo` reads true, and every further press
  refuses for the leaf's life. The asset designer made this an ordinary state rather than a
  rare one — two leaves on one asset is the case its ledgers exist for — and the remedy
  (dropping the superseded entry and saying so, or disabling undo below it) is a decision about
  `CommandHistory` every surface inherits, not a fix in any adapter. Open, and named here so
  the next surface does not rediscover it.
```

- [ ] **Step 3: Run the whole check and append the coverage ledger entry**

Run: `npm run check`
Expected: PASS. Read the four coverage figures the summary prints (statements, branches, functions, lines) and the covered/total for functions and branches.

In `vitest.config.ts`, directly above `thresholds: {` and after the last existing ledger paragraph, append a comment block in the existing style:

```
			//
			// **The asset designer's review fixes (2026-09-02), measured after all eleven tasks:**
			// <statements> / <branches> / <functions> / <lines>. NOTHING RATCHETS unless a figure
			// rounds down above its floor; functions headroom is <covered − ceil(0.99 × total)>
			// units and branches <covered − ceil(0.98 × total)>. Every file this increment changed
			// that carries an uncovered position carries only INHERITED ones, measured per changed
			// file from `coverage-final.json` with `git diff --name-only origin/main...HEAD -- src/`
			// as the file list, not a hand-written filter.
```

Replace each `<…>` with the measured value. If any figure rounds down ABOVE its floor, raise that floor to the rounded-down figure per the ratchet policy stated in the same file.

- [ ] **Step 4: Run the check once more if a floor moved, then commit**

Run: `npm run check` (only if Step 3 changed a threshold).
Expected: PASS.

```bash
git add src/application/commands/DispatchOutcome.ts src/plugin/guardedServices.ts src/application/editor/asset/ReversibleAssetDesignCommands.ts src/presentation/designer/stores/assetDesignStore.ts src/domain/asset/Asset.events.ts src/presentation/designer/layers/anchorLayer.ts src/presentation/designer/AssetDesignerContext.ts src/presentation/designer/designerCommands.ts src/presentation/designer/DesignerCanvas.vue tests/harness/fixture.ts CLAUDE.md docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md vitest.config.ts
git commit -m "Write the designer's docblocks, CLAUDE.md and the coverage ledger from what the tree measures"
```

---

## Not in this plan, and why

Deferred deliberately, each with the trigger that reopens it:

- **A thrown note save inside `SetAssetBackground` is not compensated.** `noteEntityWrite.ts` catches vault faults and maps them into results, so today only a programmer error reaches this path. Reopens with the first repository method that can throw past that mapping.
- **A refused undo pins the whole stack** (`CommandHistory.undoNow`). Recorded in CLAUDE.md by Task 11; a change to the history every surface inherits needs its own increment.
- **The capture rule's third arm and a retyped footprint.** A freehand footprint drawn with no sheet is the frame for a pending anchor or clearance; typing dimensions replaces that frame while `SetAssetFootprint` inherits both pending flags. Reachable only by tracing freehand before typing; reopens with the first user report or with any change to `captureAwaitsScale`.
- **The inspector prints unrounded floats followed by `mm` even when unscaled**, and the harness fixture seeds no shape or sheet so the layers have never been photographed. Both are one small task each and neither is a correctness defect.
- **`regionsReachable.test.ts` walks only `.vue` files under `designer/`**, so un-mounting a SHARED component from the designer canvas passes it. `designerBackground.test.ts` and Task 5's `designerGesture.test.ts` hold the two shared mounts behaviourally; widening the walk to imported `.vue` files outside the folder is the next step if a third shared mount arrives.
