# Plan editor item modes and "Add to asset library" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan items are drawn as a rectangle drag by default, with a two-way switch to free-form corners. A right-click on a saved item turns it into a placement of a new asset library entry.

**Architecture:** The drawing mode is a `shape` field on the shared element draft, read only by the `place-object` tool, so no tool id changes. Promotion reuses the existing New asset dialog with an optional outline prefill. It writes the footprint through `SetAssetFootprintCommand` with a new `measured` flag, so the footprint is typed millimetres and not waiting on calibration. The item is then replaced by an `asset` placement with the same id through the placement task's existing reversible `write`.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia, Konva (untouched), Vitest with jsdom and `@vue/test-utils`.

**Spec:** `docs/superpowers/specs/2026-09-13-plan-editor-item-modes-and-library-design.md`

## Global Constraints

- **Layers:** `presentation → application → domain → core`. `vue`, `pinia`, `konva` and `obsidian` are banned by name in `core/`, `domain/` and `application/`.
- **Budgets:** `src/**` has 400 counted lines per file (blank lines and comments skipped), 100 lines per function, complexity 16 and max depth 4. `tests/**` has 450 counted lines per file.
- **User-visible text** always goes through `tr(...)`. Every new key goes into the `en` file AND its `de` sibling. `de` files are typed `Record<keyof typeof …En, string>`, so a missing German key fails `vue-tsc`. Use sentence case: no capitalised words mid-sentence.
- **Refusing controls** use `aria-disabled` and are never `:disabled`. The action refuses on its own as well.
- **Inner loop:** `npm run check:fast -- <paths>` (oxlint, `vue-tsc`, vitest). Add `--testTimeout=20000` if cases time out under machine load. **Do not run `npm run check` locally;** CI runs it on the pull request.
- **Coverage floors** are 99/99/99/98. An unreachable guard costs a branch, so do not add guards a test cannot reach.
- **No new dependency.** The `add-to-library` context-action id and all existing tool ids and command ids stay as written.
- **Commit trailer:** every commit message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. This overrides any trailer your own tooling suggests.
- Work in `C:\Projects\renovation-planner\.claude\worktrees\room-wall-boundaries-288627`, branch `claude/plan-editor-add-item-6fd679`.

---

### Task 1: Measured footprint write

**Files:**
- Modify: `src/application/commands/asset/SetAssetFootprint.ts`
- Test (create): `tests/application/commands/asset/setAssetFootprintMeasured.test.ts`

**Interfaces:**
- Produces: `SetAssetFootprintInput.measured?: true`. When set, the stored shape has `footprintOrigin: 'typed'` and `footprintPending: false`, whether or not the asset has a calibration or background.

- [ ] **Step 1: Write the failing test**

Create `tests/application/commands/asset/setAssetFootprintMeasured.test.ts`:

```ts
/**
 * `measured: true` (2026-09-13 item modes spec §B): an outline copied off a plan is already in
 * millimetres, so it is stored typed and never awaits a scale. Without the flag the same first
 * outline on an uncalibrated asset is pending, and the Plan editor refuses to place it as
 * `unscaled`, which is the whole reason the flag exists.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetFootprintCommand } from '../../../../src/application/commands/asset/SetAssetFootprint';
import { createEventBus } from '../../../../src/core/events/EventBus';
import type { Point } from '../../../../src/core/geometry/Point';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const OUTLINE: readonly Point[] = [{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }];

async function freshAsset() {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	const command = new SetAssetFootprintCommand({ sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() });
	return { assetId, command, stored: async () => expectOk(await sidecar.read(assetId)).document.shape };
}

describe('SetAssetFootprint, measured', () => {
	it('stores a first outline on an uncalibrated asset as typed millimetres, not awaiting a scale', async () => {
		const { assetId, command, stored } = await freshAsset();

		expect(expectOk(await command.execute({ assetId, points: OUTLINE, measured: true }))).toBe('wrote');

		expect(await stored()).toMatchObject({ footprint: { points: OUTLINE }, footprintOrigin: 'typed', footprintPending: false });
	});

	it('still records the same outline as a pending trace without the flag', async () => {
		const { assetId, command, stored } = await freshAsset();

		await command.execute({ assetId, points: OUTLINE });

		expect(await stored()).toMatchObject({ footprintOrigin: 'traced', footprintPending: true });
	});
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/application/commands/asset/setAssetFootprintMeasured.test.ts`
Expected: the first case FAILS (`footprintOrigin` is `'traced'`, `footprintPending` is `true`). `vue-tsc` would also refuse `measured`, but vitest does not type-check.

- [ ] **Step 3: Implement**

In `src/application/commands/asset/SetAssetFootprint.ts`, add the field to `SetAssetFootprintInput`:

```ts
export interface SetAssetFootprintInput {
	readonly assetId: AssetId;
	readonly points: readonly Point[];
	/**
	 * The outline is already in millimetres — copied off a plan item (2026-09-13 item modes spec §B) —
	 * so it is stored `typed` and never pending, whatever the surface's calibration says. Absent, the
	 * outline is a trace and `captureAwaitsScale` decides.
	 */
	readonly measured?: true;
	readonly expected?: EntityVersion;
}
```

Then replace the change callback in `SetAssetFootprintCommand.executeWithVersion`:

```ts
		return updateAssetShape(
			this.deps,
			input,
			(current, awaitsScale) =>
				ok(input.measured
					? withFootprint(current, { points: input.points }, 'typed', false)
					: withFootprint(current, { points: input.points }, 'traced', awaitsScale)),
			sameFootprint,
		);
```

- [ ] **Step 4: Run the gate on the change**

Run: `npm run check:fast -- tests/application/commands/asset`
Expected: PASS, including the existing `setAssetFootprint.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/application/commands/asset/SetAssetFootprint.ts tests/application/commands/asset/setAssetFootprintMeasured.test.ts
git commit -m "asset: write a measured outline as a typed, unpending footprint

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Item outline geometry helpers

**Files:**
- Create: `src/presentation/editor/elements/objectShape.ts`
- Test (create): `tests/presentation/editor/elements/objectShape.test.ts`

**Interfaces:**
- Produces:
  - `type ObjectShapeMode = 'rectangle' | 'free'`
  - `rectangleCorners(a: Point, b: Point): Point[] | null`: clockwise from the top-left, or `null` with no area
  - `boundingRectangle(points: readonly Point[]): Point[] | null`
  - `centredFootprint(points: readonly Point[]): { readonly centre: Point; readonly footprint: Point[] }`: centre rounded to whole millimetres, `footprint[i] = points[i] - centre`

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/elements/objectShape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boundingRectangle, centredFootprint, rectangleCorners } from '../../../../src/presentation/editor/elements/objectShape';

describe('rectangleCorners', () => {
	it('normalises a drag in any direction into clockwise corners from the top-left', () => {
		expect(rectangleCorners({ x: 5000, y: 4000 }, { x: 800, y: 200 })).toEqual([
			{ x: 800, y: 200 }, { x: 5000, y: 200 }, { x: 5000, y: 4000 }, { x: 800, y: 4000 },
		]);
	});

	it.each([[{ x: 10, y: 0 }], [{ x: 0, y: 10 }], [{ x: 0, y: 0 }]])('answers null for a rectangle with no area (%o)', b => {
		expect(rectangleCorners({ x: 0, y: 0 }, b)).toBeNull();
	});
});

describe('boundingRectangle', () => {
	it('boxes an outline', () => {
		expect(boundingRectangle([{ x: 1000, y: 500 }, { x: 3000, y: 2000 }, { x: 2000, y: 2600 }])).toEqual([
			{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2600 }, { x: 1000, y: 2600 },
		]);
	});

	it.each([[[]], [[{ x: 1, y: 1 }]], [[{ x: 0, y: 0 }, { x: 0, y: 900 }]]])('answers null when there is no area to box (%o)', points => {
		expect(boundingRectangle(points)).toBeNull();
	});
});

describe('centredFootprint', () => {
	it('moves the outline onto its bounding-box middle, so centre plus footprint is the drawn outline', () => {
		const points = [{ x: 1000, y: 1000 }, { x: 2200, y: 1000 }, { x: 2200, y: 1600 }, { x: 1000, y: 1600 }];
		const { centre, footprint } = centredFootprint(points);
		expect(centre).toEqual({ x: 1600, y: 1300 });
		expect(footprint).toEqual([{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }]);
	});

	it('rounds the middle to whole millimetres and keeps the round trip exact', () => {
		const points = [{ x: 0, y: 0 }, { x: 1001, y: 0 }, { x: 0, y: 3 }];
		const { centre, footprint } = centredFootprint(points);
		expect(Number.isInteger(centre.x) && Number.isInteger(centre.y)).toBe(true);
		expect(footprint.map(point => ({ x: point.x + centre.x, y: point.y + centre.y }))).toEqual(points);
	});
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/presentation/editor/elements/objectShape.test.ts`
Expected: FAIL. The import does not resolve.

- [ ] **Step 3: Implement**

Create `src/presentation/editor/elements/objectShape.ts`:

```ts
import type { Point } from '../../../core/geometry/Point';

/** How an item's outline is drawn (2026-09-13 item modes spec §A): one rectangle drag, or corner by corner. */
export type ObjectShapeMode = 'rectangle' | 'free';

/** The rectangle two opposite corners span, clockwise from the top-left; `null` when it encloses no area. */
export function rectangleCorners(a: Point, b: Point): Point[] | null {
	const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y), right = Math.max(a.x, b.x), bottom = Math.max(a.y, b.y);
	if (left === right || top === bottom) return null;
	return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
}

/** Free-form to rectangle: the outline's bounding box, or `null` when it spans no area. */
export function boundingRectangle(points: readonly Point[]): Point[] | null {
	if (points.length === 0) return null;
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	return rectangleCorners({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
}

/**
 * An item outline as a library footprint (spec §B): moved so the middle of its bounding box is the origin —
 * the convention `footprintFromDimensions` uses, which makes the default anchor the middle of the object —
 * with that middle in world millimetres. Rounded to whole millimetres so the placement anchor and every
 * footprint vertex stay integers and `centre + footprint` is the drawn outline exactly.
 */
export function centredFootprint(points: readonly Point[]): { readonly centre: Point; readonly footprint: Point[] } {
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	const centre = { x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2) };
	return { centre, footprint: points.map(point => ({ x: point.x - centre.x, y: point.y - centre.y })) };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm run check:fast -- tests/presentation/editor/elements/objectShape.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/elements/objectShape.ts tests/presentation/editor/elements/objectShape.test.ts
git commit -m "editor: item outline rectangle, bounding box and centred footprint helpers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Rectangle drag in the item tool and the shape switch on the task

**Files:**
- Modify: `src/presentation/editor/elements/elementDraft.ts`
- Modify: `src/presentation/editor/elements/ElementTool.ts`
- Modify: `src/presentation/editor/elements/elementTask.ts`
- Test (create): `tests/presentation/editor/elements/elementToolRectangle.test.ts`

**Interfaces:**
- Consumes: `ObjectShapeMode`, `rectangleCorners` and `boundingRectangle` from Task 2.
- Produces:
  - `ElementDraft.shape: ObjectShapeMode`. The default is `'rectangle'`, reset on every task start by `createElementBaseline.stop()`, and kept by `discardElementGeometry`.
  - The `ElementTool` deps gain `setPoints(points: readonly Point[]): boolean`.
  - `runtime.elementTask.setShape(shape: ObjectShapeMode): boolean`
  - `runtime.elementTask.shapeLocked: ComputedRef<boolean>`

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/elements/elementToolRectangle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ElementTool } from '../../../../src/presentation/editor/elements/ElementTool';
import { createElementDraft, type ElementToolId } from '../../../../src/presentation/editor/elements/elementDraft';
import type { ObjectShapeMode } from '../../../../src/presentation/editor/elements/objectShape';
import type { Point } from '../../../../src/core/geometry/Point';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

function armed(id: ElementToolId = 'place-object', shape: ObjectShapeMode = 'rectangle') {
	const draft = createElementDraft();
	draft.shape = shape;
	const tool = new ElementTool(id, {
		draft, start: () => undefined, stop: () => undefined, blocked: () => false, finish: () => undefined, candidates: () => ({}),
		addPoint: (point: Point) => { draft.points.push(point); return true; },
		setPoints: (points: readonly Point[]) => { draft.points = points.map(point => ({ ...point })); return true; },
	});
	tool.activate(toolContext().context);
	return { tool, draft };
}

const RECT = [{ x: 800, y: 200 }, { x: 5000, y: 200 }, { x: 5000, y: 4000 }, { x: 800, y: 4000 }];

describe('ElementTool, an item in rectangle mode', () => {
	it('follows the drag with one normalised rectangle and lets the release name it', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(5000, 4000));
		tool.pointerMove(pointerAt(3000, 4500));
		expect(draft.points).toEqual([{ x: 3000, y: 4000 }, { x: 5000, y: 4000 }, { x: 5000, y: 4500 }, { x: 3000, y: 4500 }]);
		tool.pointerUp(pointerAt(800, 200));
		expect(draft.points).toEqual(RECT);
		tool.pointerMove(pointerAt(0, 0));
		expect(draft.points).toEqual(RECT);
	});

	it('replaces the rectangle with the next drag, and a click keeps it', () => {
		const { tool, draft } = armed();
		tool.pointerDown(pointerAt(800, 200)); tool.pointerUp(pointerAt(5000, 4000));
		tool.pointerDown(pointerAt(2000, 2000)); tool.pointerUp(pointerAt(2000, 2000));
		expect(draft.points).toEqual(RECT);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerUp(pointerAt(100, 50));
		expect(draft.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
	});

	it('stops following once the gesture is abandoned, cancelled or the tool is left', () => {
		for (const end of ['abandonGesture', 'cancel', 'deactivate'] as const) {
			const { tool, draft } = armed();
			tool.pointerDown(pointerAt(800, 200)); tool.pointerMove(pointerAt(5000, 4000));
			tool[end]();
			const after = draft.points.map(point => ({ ...point }));
			tool.pointerMove(pointerAt(9000, 9000)); tool.pointerUp(pointerAt(9000, 9000));
			expect(draft.points).toEqual(after);
		}
	});
});

describe('ElementTool, corner by corner', () => {
	it.each([['place-object', 'free'], ['draw-path', 'rectangle']] as const)('adds one point per click for %s in %s mode', (id, shape) => {
		const { tool, draft } = armed(id, shape);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerUp(pointerAt(0, 0));
		tool.pointerDown(pointerAt(2000, 0)); tool.pointerMove(pointerAt(2500, 900)); tool.pointerUp(pointerAt(2500, 900));
		expect(draft.points).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 0 }]);
	});
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/presentation/editor/elements/elementToolRectangle.test.ts`
Expected: FAIL. The rectangle cases add single points instead of four corners.

- [ ] **Step 3: Add the draft field**

In `src/presentation/editor/elements/elementDraft.ts`:

```ts
import type { ObjectShapeMode } from './objectShape';
```

Add to `ElementDraft`, after `cursor: Point | null;`:

```ts
	/** Only an item reads it (2026-09-13 item modes spec §A); every other kind is drawn corner by corner. */
	shape: ObjectShapeMode;
```

In `createElementDraft`, add `shape: 'rectangle'` after `name: ''`:

```ts
	return reactive({ kind: 'object', name: '', shape: 'rectangle', points: [], cursor: null, text: { x: '', y: '' }, rectangle: emptyObjectRectangle(), stair: { ...DEFAULT_STAIR }, pendingInput: false, loading: false, busy: false, conflict: false, error: null });
```

In `discardElementGeometry`, keep the mode. Escape clears the outline, not the choice of how to draw it:

```ts
export function discardElementGeometry(draft: ElementDraft): void {
	const { kind, name, shape, loading, busy, conflict } = draft, error = conflict ? draft.error : null;
	Object.assign(draft, createElementDraft(), { kind, name, shape, loading, busy, conflict, error });
}
```

- [ ] **Step 4: Implement the drag in `ElementTool`**

Replace `src/presentation/editor/elements/ElementTool.ts` with:

```ts
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import type { ElementDraft, ElementToolId } from './elementDraft';
import { discardElementGeometry } from './elementDraft';
import type { Point } from '../../../core/geometry/Point';
import type { SnapCandidates } from '../snapping/snap-service';
import { constrainDrawingPoint } from '../snapping/constrainDrawingPoint';
import { rectangleCorners } from './objectShape';

/**
 * Multi-click linear drafts share the standard tool lifecycle and require explicit Finish. An item in
 * rectangle mode is the one drag (2026-09-13 item modes spec §A): the press anchors a corner, every move
 * rewrites the four corners, and the release names the rectangle — `DrawRoomTool`'s rule, since a fast
 * flick is a legal pointer stream with no move at all. A click encloses no area and changes nothing.
 */
export class ElementTool implements EditorTool {
	private context: EditorContext | null = null;
	private dragAnchor: Point | null = null;
	constructor(readonly id: ElementToolId, private readonly deps: {
		draft: ElementDraft; start(id: ElementToolId): void; stop(): void; blocked(): boolean;
		addPoint(point: Point): boolean; setPoints(points: readonly Point[]): boolean; finish(): void; candidates(): SnapCandidates;
	}) {}
	activate(context: EditorContext): void { this.context = context; this.deps.start(this.id); }
	deactivate(): void { this.context = null; this.dragAnchor = null; this.deps.stop(); }
	private inputContext(): EditorContext | null { return this.context && !this.deps.blocked() ? this.context : null; }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary' || !this.inputContext()) return;
		this.pointerMove(event);
		// Set by the move above: `snapPoint` always answers a point, and the input context was just checked.
		const cursor = this.deps.draft.cursor as Point;
		if (this.id === 'place-object' && this.deps.draft.shape === 'rectangle') this.dragAnchor = cursor;
		else this.deps.addPoint(cursor);
	}
	pointerMove(event: EditorPointerEvent): void {
		const context = this.inputContext();
		if (!context) return;
		const constrained = constrainDrawingPoint(this.deps.draft.points.at(-1), event.worldPoint, event.modifiers.shift && this.id !== 'place-object', context.snapService);
		const cursor = context.snapService.snapPoint(constrained, this.deps.candidates(), 8 * context.viewport.worldPerScreenPixel());
		this.deps.draft.cursor = cursor;
		const corners = this.dragAnchor && rectangleCorners(this.dragAnchor, cursor);
		if (corners) this.deps.setPoints(corners);
	}
	pointerUp(event: EditorPointerEvent): void {
		if (!this.dragAnchor) return;
		this.pointerMove(event);
		this.dragAnchor = null;
	}
	finish(): void { this.deps.finish(); }
	cancel(): void { this.dragAnchor = null; if (!this.deps.draft.busy) discardElementGeometry(this.deps.draft); }
	abandonGesture(): void { this.deps.draft.cursor = null; this.dragAnchor = null; }
	hasDraft(): boolean { return this.deps.draft.points.length > 0 || this.deps.draft.pendingInput || !!this.deps.draft.text.x || !!this.deps.draft.text.y; }
	editCorner(index: number, point: Point | null): boolean {
		if (this.deps.blocked()) return false;
		const points = this.deps.draft.points, resolved = index === -1 ? points.length - 1 : index;
		if (resolved < 0 || resolved >= points.length) return false;
		if (point) points.splice(resolved, 1, point); else points.splice(resolved, 1);
		return true;
	}
}
```

- [ ] **Step 5: Add `setShape` and `shapeLocked` to the task and pass `setPoints` to the tool**

In `src/presentation/editor/elements/elementTask.ts`:

```ts
import { boundingRectangle, type ObjectShapeMode } from './objectShape';
```

After `undoPoint`, add:

```ts
	/** Pending typed input belongs to the mode it was typed in, so it has to be applied or discarded before the mode changes. */
	const shapeLocked = computed(() => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y);
	/**
	 * Rectangle drag or free-form corners for an item (2026-09-13 item modes spec §A). The outline carries across:
	 * free-form keeps the corners as editable points, rectangle takes their bounding box — or nothing, when that
	 * box has no area.
	 */
	function setShape(shape: ObjectShapeMode): boolean {
		if (shapeLocked.value || draft.shape === shape) return false;
		draft.shape = shape;
		if (shape === 'rectangle') draft.points = boundingRectangle(draft.points) ?? [];
		return true;
	}
```

Pass `setPoints` into the tool registration:

```ts
	for (const id of Object.keys(ELEMENT_TOOLS) as ElementToolId[]) runtime.toolManager.register(new ElementTool(id, {
		draft, start, stop, blocked: () => blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y, addPoint, setPoints, finish: () => { void finish(); }, candidates: () => candidates.value,
	}));
	return { draft, blocked, canFinish, needsRead, retry, setPoints, addPoint, undoPoint, setShape, shapeLocked, finish, measureFrom, available: context.commands.renovation !== undefined };
```

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/elements/elementToolRectangle.test.ts tests/presentation/editor/objectCreation.e2e.test.ts tests/presentation/editor/elementCreationGuards.test.ts`
Expected: the new file PASSES.

`objectCreation.e2e.test.ts` and `elementCreationGuards.test.ts` may now FAIL wherever they click corners with `place-object`, because an item now starts in rectangle mode. Fix the setup, not the assertions. In `objectCreation.e2e.test.ts`'s `setup()`, add this line right after the `settleUntil(… 'item baseline')` line:

```ts
	expect(rig.runtime.elementTask.setShape('free')).toBe(true);
```

For `elementCreationGuards.test.ts`, add the same line after each `place-object` task has settled, in any case that adds corners by pointer or by "Add point". Re-run until green.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/elements tests/presentation/editor
git commit -m "editor: draw an item as a rectangle drag, with a free-form mode on the task

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Rectangle | Free-form switch in the task bar and details

**Files:**
- Create: `src/presentation/editor/elements/ObjectShapeSwitch.vue`
- Modify: `src/presentation/editor/shell/TaskDrawingControls.vue`
- Modify: `src/presentation/editor/shell/TemporaryToolBanner.vue`
- Modify: `src/presentation/editor/elements/ElementTaskForm.vue`
- Modify: `src/presentation/editor/elements/ObjectRectangleFields.vue`
- Modify: `src/presentation/i18n/locales/en/object.ts`, `src/presentation/i18n/locales/de/object.ts`
- Modify: the stylesheet partial that styles `.rp-task-banner` (`styles/editor-task-bar.css`; confirm with `grep -l "rp-task-banner" styles/*.css`)
- Test (create): `tests/presentation/editor/objectShapeModes.e2e.test.ts`

**Interfaces:**
- Consumes: `elementTask.setShape`, `elementTask.shapeLocked` and `draft.shape` (Task 3).
- Produces:
  - `ObjectShapeSwitch.vue` renders `[data-rp-object-shape="rectangle"|"free"]` buttons with `aria-pressed`.
  - `ObjectRectangleFields` gets an `open?: boolean` prop.
  - New i18n keys: `editor.object.mode`, `editor.object.mode.rectangle`, `editor.object.mode.free`, `editor.element.banner.object-rectangle`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/objectShapeModes.e2e.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { tr } from '../../../src/presentation/i18n/strings';
import type { Point } from '../../../src/core/geometry/Point';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup() {
	const rig = await structureEditor(true); mounted.push(rig);
	rig.runtime.setTool('place-object');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'item baseline');
	return { ...rig, task: rig.runtime.elementTask };
}
type Rig = Awaited<ReturnType<typeof setup>>;
async function drag(rig: Rig, from: Point, to: Point) {
	const tools = rig.runtime.toolManager;
	tools.pointerDown(pointerAt(from.x, from.y)); tools.pointerMove(pointerAt(to.x, to.y)); tools.pointerUp(pointerAt(to.x, to.y));
	await settle();
}
const RECTANGLE = [{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2000 }, { x: 1000, y: 2000 }];

it('starts an item as a rectangle drag and saves the dragged outline', async () => {
	const rig = await setup(), banner = rig.wrapper.get('.rp-task-banner');
	expect(banner.text()).toContain(tr('editor.element.banner.object-rectangle'));
	expect(banner.get('[data-rp-object-shape="rectangle"]').attributes('aria-pressed')).toBe('true');
	expect(rig.wrapper.get<HTMLDetailsElement>('.rp-object-rectangle').element.open).toBe(true);
	expect(rig.wrapper.find('input[name="element-x"]').exists()).toBe(false);
	await drag(rig, { x: 3000, y: 2000 }, { x: 1000, y: 500 });
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	await banner.get('.rp-task-banner__finish').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved item');
	expect(expectDefined(rig.project.structure.elements?.[0], 'saved item')).toMatchObject({ kind: 'object', points: RECTANGLE });
});

it('carries the outline across both switches, from the task bar and from details', async () => {
	const rig = await setup();
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	await rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]').trigger('click');
	expect(rig.task.draft.shape).toBe('free');
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	expect(rig.wrapper.get('.rp-task-banner').text()).toContain(tr('editor.element.banner.object'));
	expect(rig.wrapper.find('input[name="element-x"]').exists()).toBe(true);
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 2600)); await settle();
	expect(rig.task.draft.points).toHaveLength(5);
	await rig.wrapper.get('.rp-element-task [data-rp-object-shape="rectangle"]').trigger('click');
	expect(rig.task.draft.points).toEqual([{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2600 }, { x: 1000, y: 2600 }]);
});

it('keeps its mode while typed rectangle input is pending, and a click leaves the drawn rectangle', async () => {
	const rig = await setup();
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 1000)); rig.runtime.toolManager.pointerUp(pointerAt(2000, 1000)); await settle();
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	await rig.wrapper.get('input[name="object-width"]').setValue('1');
	const free = () => rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]');
	expect(free().attributes('aria-disabled')).toBe('true');
	await free().trigger('click');
	expect(rig.task.draft.shape).toBe('rectangle');
	await rig.wrapper.get('[data-rp-action="discard-object-rectangle"]').trigger('click'); await settle();
	expect(free().attributes('aria-disabled')).toBe('false');
});
```

If a corner lands a few millimetres off because the harness floor snaps it to a wall or room edge, move the drag points by whole metres away from every wall and room edge. Do not loosen the equality.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/presentation/editor/objectShapeModes.e2e.test.ts`
Expected: FAIL. There is no `[data-rp-object-shape]` element and no `object-rectangle` banner key.

- [ ] **Step 3: Add the locale keys**

In `src/presentation/i18n/locales/en/object.ts`, replace the `'editor.element.banner.object'` line and add the new keys after `'editor.object.rectangle'`:

```ts
	'editor.element.banner.object': 'Click to place the item corners, or enter their positions in details.',
	'editor.element.banner.object-rectangle': 'Drag on the plan to size the item, or enter its position and size in details.',
```

```ts
	'editor.object.mode': 'Item shape',
	'editor.object.mode.rectangle': 'Rectangle',
	'editor.object.mode.free': 'Free-form',
```

In `src/presentation/i18n/locales/de/object.ts`, at the same places:

```ts
	'editor.element.banner.object': 'Ecken des Gegenstands im Plan setzen oder ihre Positionen unter Details eingeben.',
	'editor.element.banner.object-rectangle': 'Im Plan ziehen, um die Größe des Gegenstands festzulegen, oder Position und Größe unter Details eingeben.',
```

```ts
	'editor.object.mode': 'Form des Gegenstands',
	'editor.object.mode.rectangle': 'Rechteck',
	'editor.object.mode.free': 'Freie Form',
```

- [ ] **Step 4: Create the switch component**

Create `src/presentation/editor/elements/ObjectShapeSwitch.vue`:

```vue
<script setup lang="ts">
/**
 * Rectangle or free-form for an item (2026-09-13 item modes spec §A), drawn in the task bar and in details:
 * two doors onto `elementTask.setShape`, which refuses on its own while the draft is busy or holds typed
 * input, so `aria-disabled` here only says what the action already does.
 */
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import { useEditorRuntime } from '../runtime';
import type { ObjectShapeMode } from './objectShape';

const task = useEditorRuntime().elementTask, draft = task.draft;
const MODES: readonly { readonly shape: ObjectShapeMode; readonly label: StringKey }[] = [
	{ shape: 'rectangle', label: 'editor.object.mode.rectangle' },
	{ shape: 'free', label: 'editor.object.mode.free' },
];
</script>

<template>
	<div
		class="rp-object-shape"
		role="group"
		:aria-label="tr('editor.object.mode')"
	>
		<button
			v-for="mode in MODES"
			:key="mode.shape"
			type="button"
			:data-rp-object-shape="mode.shape"
			:aria-pressed="draft.shape === mode.shape"
			:aria-disabled="task.shapeLocked.value"
			@click="task.setShape(mode.shape)"
		>
			{{ tr(mode.label) }}
		</button>
	</div>
</template>
```

- [ ] **Step 5: Mount it in the task bar and switch the banner instruction**

In `src/presentation/editor/shell/TaskDrawingControls.vue`, import it and render it first:

```ts
import ObjectShapeSwitch from '../elements/ObjectShapeSwitch.vue';
```

```vue
	<ObjectShapeSwitch v-if="runtime.activeToolId.value === 'place-object'" />
```

In `src/presentation/editor/shell/TemporaryToolBanner.vue`, add after `const isElement = …`:

```ts
/** An item's instruction follows how it is being drawn (2026-09-13 item modes spec §A). */
const isRectangleItem = computed(() => runtime.activeToolId.value === 'place-object' && runtime.elementTask.draft.shape === 'rectangle');
```

and change the instruction span's text to:

```vue
			>{{ tr(isRectangleItem ? 'editor.element.banner.object-rectangle' : task.instructionKey) }}</span>
```

- [ ] **Step 6: Show mode-specific entry in details**

In `src/presentation/editor/elements/ObjectRectangleFields.vue`, add the prop and bind it:

```ts
const props = defineProps<{ task: {
	draft: { rectangle: ObjectRectangleText; text: { x: string; y: string }; points: readonly Point[]; pendingInput: boolean };
	blocked: Readonly<Ref<boolean>>;
	setPoints(points: readonly Point[]): boolean;
}; open?: boolean }>();
```

```vue
	<details
		ref="root"
		class="rp-object-rectangle"
		:open="props.open"
	>
```

In `src/presentation/editor/elements/ElementTaskForm.vue`:
- Import `ObjectShapeSwitch from './ObjectShapeSwitch.vue'`.
- Add `const pointEntry = computed(() => draft.kind !== 'object' || draft.shape === 'free');`.
- Render `<ObjectShapeSwitch v-if="draft.kind === 'object'" />` directly after the name `FieldError`.
- Pass `:open="draft.shape === 'rectangle'"` to `ObjectRectangleFields`.
- Move `<DraftRecovery … />` out of the `<form>` so it renders just before it, in both modes.
- Wrap the `<form>`, the `<ol>` and the "Undo point" `<button>` in `<template v-if="pointEntry">`.

The result:

```vue
		<ObjectShapeSwitch v-if="draft.kind === 'object'" />
		<ObjectRectangleFields
			v-if="draft.kind === 'object'"
			:task="task"
			:open="draft.shape === 'rectangle'"
		/>
		<StairDraftFields
			v-if="draft.kind === 'stair'"
			:task="task"
		/>
		<DraftRecovery
			v-if="task.needsRead.value || runtime.writesBlocked.value"
			:retry="task.retry"
			:open-source="runtime.openPlanNote"
		/>
		<template v-if="pointEntry">
			<form
				ref="pointForm"
				@submit.prevent="add"
				@keydown="nativeSubmitKey"
			>
				<!-- the two coordinate FieldErrors and the Add point submit button, unchanged -->
			</form>
			<ol>
				<!-- unchanged -->
			</ol>
			<button
				type="button"
				:aria-disabled="undoBlocked"
				@click="task.undoPoint()"
			>
				{{ tr('editor.element.undo-point') }}
			</button>
		</template>
```

(Keep the form's FieldErrors, the `<ol>` items and the undo button's contents exactly as they are today. Only the wrapper and the `DraftRecovery` position change.)

- [ ] **Step 7: Style the pressed state**

Append to the partial that styles `.rp-task-banner`. A pressed mode needs a second channel beyond `aria-pressed`, the same as other toggles here:

```css
/* Rectangle | Free-form for an item (2026-09-13 item modes spec §A): the pressed mode wears the accent border and weight. */
.renovation-plan-editor .rp-object-shape {
	display: inline-flex;
	gap: var(--size-4-1);
}
.renovation-plan-editor .rp-object-shape button[aria-pressed='true'] {
	border-color: var(--interactive-accent);
	font-weight: var(--font-semibold);
}
```

- [ ] **Step 8: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor tests/harness tests/build/styles.test.ts`
Expected: PASS. If an existing editor test drove `place-object` corners by pointer or by `element-x` and fails, add `rig.runtime.elementTask.setShape('free')` after its baseline settles, as in Task 3 Step 6.

- [ ] **Step 9: Visual check**

Run: `npm run harness-shot -- --width=460` and look at the `?view=plan-editor` captures after choosing Add → Item, or open `npm run harness` and choose Add → Item. The switch should sit in the task bar without wrapping the Finish/Cancel buttons off the bar at 460 px. If it wraps badly, note it in the task report; do not restyle other task-bar controls.

- [ ] **Step 10: Commit**

```bash
git add src/presentation/editor src/presentation/i18n/locales/en/object.ts src/presentation/i18n/locales/de/object.ts styles tests/presentation/editor
git commit -m "editor: Rectangle | Free-form switch for items in the task bar and details

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: New asset dialog with an item outline

**Files:**
- Modify: `src/presentation/views/NewAssetForm.vue`
- Modify: `src/presentation/views/newAssetDialog.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Test (create): `tests/presentation/views/newAssetFormOutline.test.ts`

**Interfaces:**
- Consumes: `SetAssetFootprintInput.measured` (Task 1).
- Produces:
  - `NewAssetForm` gets the optional props `initialName?: string` and `outline?: { readonly points: readonly Point[]; write(input: SetAssetFootprintInput): Promise<DispatchResult> }`.
  - `NewAssetDialogDeps` gets an optional `prefill?: { readonly name: string; readonly outline: { readonly points: readonly Point[]; write(input: SetAssetFootprintInput): Promise<DispatchResult> } }`.
  - New i18n keys: `form.new-asset.outline` (params `width`, `depth`) and `form.new-asset.already-created-outline`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/views/newAssetFormOutline.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 *
 * `NewAssetForm` opened from a plan item (2026-09-13 item modes spec §B): the name starts from the item, the
 * outline stands where the two dimension fields would, and the footprint is written MEASURED after the asset
 * exists. The created-id retry rule is the same one `newAssetForm.test.ts` holds for dimensions.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { Point } from '../../../src/core/geometry/Point';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import type { SetAssetFootprintInput } from '../../../src/application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { Asset } from '../../../src/domain/asset/Asset';
import { makeAsset } from '../../helpers/entities';
import { recorder } from '../../helpers/logger';
import { t } from '../../../src/presentation/i18n/strings';

type Write = (input: SetAssetFootprintInput) => Promise<DispatchResult>;
const CENTRED: readonly Point[] = [{ x: -600, y: -300 }, { x: 600, y: -300 }, { x: 600, y: 300 }, { x: -600, y: 300 }];

function mountWithOutline(points: readonly Point[] = CENTRED, write = vi.fn<Write>(() => Promise.resolve(ok('wrote')))) {
	const asset = makeAsset();
	const createAsset = vi.fn<(input: CreateAssetInput) => Promise<Result<Asset, AppError>>>(() => Promise.resolve(ok(asset)));
	const setFootprintFromDimensions = vi.fn(() => Promise.resolve(ok('wrote') as DispatchResult));
	const wrapper = mount(NewAssetForm, {
		props: { createAsset, setFootprintFromDimensions, logger: recorder, defaultCurrency: 'EUR', initialName: 'Cabinet', outline: { points, write } },
	});
	return { wrapper, asset, createAsset, setFootprintFromDimensions, write };
}

async function submit(wrapper: VueWrapper): Promise<void> {
	await wrapper.get('[data-field="unitCostAmount"]').setValue('450.00');
	await wrapper.get('form').trigger('submit');
	await flushPromises();
}

describe('NewAssetForm with an item outline', () => {
	it('starts from the item name and states the outline in place of the dimension fields', () => {
		const { wrapper } = mountWithOutline();
		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe('Cabinet');
		expect(wrapper.find('[data-field="width"]').exists()).toBe(false);
		expect(wrapper.find('[data-field="depth"]').exists()).toBe(false);
		expect(wrapper.get('.rp-new-asset__outline').text()).toBe(t('en', 'form.new-asset.outline', { width: '1200', depth: '600' }));
	});

	it('creates the asset, writes the outline measured, and submits the created id', async () => {
		const { wrapper, asset, createAsset, setFootprintFromDimensions, write } = mountWithOutline();
		await submit(wrapper);
		expect(createAsset.mock.calls[0][0]).toMatchObject({ name: 'Cabinet', unitCostAmount: '450.00', currency: 'EUR' });
		expect(write).toHaveBeenCalledWith({ assetId: asset.id, points: CENTRED, measured: true });
		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
		expect(wrapper.emitted('submit')).toEqual([[{ assetId: asset.id, created: true }]]);
	});

	it('retries only the outline after a refused write, never creating a second asset', async () => {
		const refused = err({ category: 'Persistence', code: 'asset-geometry.write-failed', message: 'x' } as AppError);
		const write = vi.fn<Write>().mockResolvedValueOnce(refused).mockResolvedValue(ok('wrote'));
		const { wrapper, createAsset } = mountWithOutline(CENTRED, write);
		await submit(wrapper);
		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.get('.rp-new-asset__created').text()).toBe(t('en', 'form.new-asset.already-created-outline'));
		await wrapper.get('form').trigger('submit'); await flushPromises();
		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledTimes(2);
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	it('refuses an outline enclosing no area before anything is written', async () => {
		const { wrapper, createAsset, write } = mountWithOutline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]);
		await submit(wrapper);
		expect(createAsset).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
		expect(wrapper.emitted('submit')).toBeUndefined();
	});
});
```

If `t` in `src/presentation/i18n/strings.ts` takes parameters in a different position, match its signature. `tr(key, params)` is the form the components use.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/presentation/views/newAssetFormOutline.test.ts`
Expected: FAIL. The name starts empty and the width field exists.

- [ ] **Step 3: Add the locale keys**

In `src/presentation/i18n/locales/en.ts`, directly after the `'form.new-asset.already-created'` entry:

```ts
	// Opened from a plan item (2026-09-13 item modes spec §B): its outline stands where the two dimension fields
	// would, and the retry sentence names the footprint rather than dimensions nobody typed.
	'form.new-asset.outline': 'Footprint: the item outline, {width} × {depth} mm',
	'form.new-asset.already-created-outline':
		'The asset is saved. Its details can be edited from the catalogue; only its footprint is still pending.',
```

In `src/presentation/i18n/locales/de.ts`, directly after its `'form.new-asset.already-created'` entry:

```ts
	'form.new-asset.outline': 'Grundfläche: der Umriss des Gegenstands, {width} × {depth} mm',
	'form.new-asset.already-created-outline':
		'Das Objekt ist gespeichert. Seine Angaben lassen sich im Katalog bearbeiten; nur seine Grundfläche steht noch aus.',
```

- [ ] **Step 4: Implement in `NewAssetForm.vue`**

Imports. Merge the footprint input types and add the domain validator and types:

```ts
import { shapeFromDimensions, validateAssetShape, type AssetShape } from '../../domain/asset/AssetShape';
import type { Point } from '../../core/geometry/Point';
import type { SetAssetFootprintFromDimensionsInput, SetAssetFootprintInput } from '../../application/commands/asset/SetAssetFootprint';
```

Props. Add after `defaultCurrency: string;`:

```ts
	/** Opened from a plan item (2026-09-13 item modes spec §B): the item's name to start from. */
	initialName?: string;
	/**
	 * The same gesture's outline, centred and in millimetres, with the write that stores it measured. Present,
	 * it REPLACES the two dimension fields: the footprint is decided, and a width and depth typed beside it
	 * would be a second answer to the same question.
	 */
	outline?: {
		readonly points: readonly Point[];
		write(input: SetAssetFootprintInput): Promise<DispatchResult>;
	};
```

Add a module-level function after `parseDimensions`:

```ts
/**
 * The shape `SetAssetFootprintCommand` validates for a just-created asset given `measured: true` — rule 1
 * above applied to an outline, so a footprint the command would refuse is refused with the vault untouched.
 */
function outlineShape(points: readonly Point[]): AssetShape {
	return { footprint: { points }, footprintOrigin: 'typed', footprintPending: false, clearance: null, clearancePending: false, anchorPending: false, anchor: { x: 0, y: 0 }, facing: 0 };
}
```

In `createAssetAndFootprint`, replace the dimensions preflight block (`if (dimensions.value !== null) { … }`) with:

```ts
	if (props.outline) {
		const shape = validateAssetShape(outlineShape(props.outline.points));
		if (isErr(shape)) return shape;
	} else if (dimensions.value !== null) {
		const shape = shapeFromDimensions(dimensions.value.width, dimensions.value.depth);
		if (isErr(shape)) return shape;
	}
```

Replace the tail after the `createAsset` block (from `if (dimensions.value === null) return ok({ assetId });` onwards) with:

```ts
	if (props.outline) {
		const written = await props.outline.write({ assetId, points: props.outline.points, measured: true });
		if (isErr(written)) return written;
		return ok({ assetId });
	}
	if (dimensions.value === null) return ok({ assetId });
	const written = await props.setFootprintFromDimensions({
		assetId,
		width: dimensions.value.width,
		depth: dimensions.value.depth,
	});
	if (isErr(written)) return written;
	return ok({ assetId });
```

The initial name. Change the `useFormCommit` `initial`:

```ts
	initial: { ...INITIAL, name: props.initialName ?? '', currency: props.defaultCurrency },
```

The size line. Add after `catalogueInoperative`:

```ts
/** The outline's width × depth in whole millimetres, for the one line standing where the dimension fields would. */
const outlineSize = computed(() => {
	if (!props.outline) return null;
	const xs = props.outline.points.map(point => point.x), ys = props.outline.points.map(point => point.y);
	return { width: String(Math.round(Math.max(...xs) - Math.min(...xs))), depth: String(Math.round(Math.max(...ys) - Math.min(...ys))) };
});
```

Template changes:
- The `already-created` paragraph text becomes `{{ tr(outline ? 'form.new-asset.already-created-outline' : 'form.new-asset.already-created') }}`.
- Wrap the width and depth `FieldError`s:

```vue
		<p
			v-if="outlineSize"
			class="rp-new-asset__outline"
		>
			{{ tr('form.new-asset.outline', outlineSize) }}
		</p>
		<template v-else>
			<!-- the width FieldError and the depth FieldError, unchanged -->
		</template>
```

- [ ] **Step 5: Implement in `newAssetDialog.ts`**

Imports:

```ts
import type { Point } from '../../core/geometry/Point';
import type { SetAssetFootprintFromDimensionsInput, SetAssetFootprintInput } from '../../application/commands/asset/SetAssetFootprint';
```

Add to `NewAssetDialogDeps`, after `findExisting`:

```ts
	/**
	 * "Add to asset library" from a plan item (2026-09-13 item modes spec §B): the name to start from and the
	 * outline that replaces the dimension fields. Absent for both catalogue surfaces.
	 */
	readonly prefill?: {
		readonly name: string;
		readonly outline: { readonly points: readonly Point[]; write(input: SetAssetFootprintInput): Promise<DispatchResult> };
	};
```

In `openNewAssetDialog`'s `props`, add:

```ts
			initialName: deps.prefill?.name,
			outline: deps.prefill?.outline,
```

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/presentation/views tests/presentation/library tests/harness/accessibilityDialogs.test.ts`
Expected: PASS, including the unchanged `newAssetForm.test.ts` and `newAssetFormSimilarName.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/views/NewAssetForm.vue src/presentation/views/newAssetDialog.ts src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts tests/presentation/views/newAssetFormOutline.test.ts
git commit -m "assets: New asset dialog can start from an item name and outline

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Asset creation services for the Plan editor

**Files:**
- Modify: `src/presentation/editor/planEditorCommands.ts`
- Modify: `src/plugin/planEditorDeps.ts`
- Modify: `tests/harness/referenceWorkspace.ts`
- Test (modify): `tests/plugin/planEditorWiring.test.ts`

**Interfaces:**
- Produces: `PlanEditorCommandServices.assetCreation?: { createAsset: Command<CreateAssetInput, Result<Asset, AppError>>; setAssetFootprintFromDimensions: Command<SetAssetFootprintFromDimensionsInput, DispatchResult>; setAssetFootprint: Command<SetAssetFootprintInput, DispatchResult>; defaultCurrency: string }`. It structurally satisfies `NewAssetDialogDeps['commands']`.

- [ ] **Step 1: Write the failing test**

In `tests/plugin/planEditorWiring.test.ts`, inside `describe('the plan editor dependencies', …)` and after the first `it`, add:

```ts
	it('hands over the guarded doors the New asset dialog and the measured outline write need', () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const persistence = root.persistence;

		const deps = planEditorDeps(root, new FakeWorkspace() as never, vaultStack().vault, createEditorClipboard(), memoryDeviceStorage());

		const creation = deps.commands.assetCreation;
		expect(creation?.createAsset).toBeDefined();
		expect(creation?.createAsset).toBe(persistence?.createAsset);
		expect(creation?.setAssetFootprintFromDimensions).toBe(persistence?.assetDesign.setFootprintFromDimensions);
		expect(creation?.setAssetFootprint).toBe(persistence?.assetDesign.setFootprint);
		expect(creation?.defaultCurrency).toBe(persistence?.defaultCurrency);
	});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/plugin/planEditorWiring.test.ts`
Expected: FAIL at `expect(creation?.createAsset).toBeDefined()`.

- [ ] **Step 3: Declare the member**

In `src/presentation/editor/planEditorCommands.ts`, merge `DispatchResult` into the existing `DispatchOutcome` type import and add:

```ts
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput, SetAssetFootprintInput } from '../../application/commands/asset/SetAssetFootprint';
import type { Asset } from '../../domain/asset/Asset';
```

Add to `PlanEditorCommandServices`, after `updatePlanDetails`:

```ts
	/**
	 * "Add to asset library" on a plan item (2026-09-13 item modes spec §B): the New asset dialog's own doors plus
	 * the outline write it stores measured. OPTIONAL like `createPlan`: without it the context menu offers no
	 * promotion and `unavailablePlanEditorCommands` needs no refusing stand-in.
	 */
	readonly assetCreation?: {
		readonly createAsset: Command<CreateAssetInput, Result<Asset, AppError>>;
		readonly setAssetFootprintFromDimensions: Command<SetAssetFootprintFromDimensionsInput, DispatchResult>;
		readonly setAssetFootprint: Command<SetAssetFootprintInput, DispatchResult>;
		readonly defaultCurrency: string;
	};
```

- [ ] **Step 4: Wire it at the root**

In `src/plugin/planEditorDeps.ts`, add after `updatePlanDetails: persistence.updatePlanDetails,`:

```ts
						// The GUARDED doors, as every other member here: the New asset dialog's pair plus the
						// measured outline write (2026-09-13 item modes spec §B).
						assetCreation: {
							createAsset: persistence.createAsset,
							setAssetFootprintFromDimensions: persistence.assetDesign.setFootprintFromDimensions,
							setAssetFootprint: persistence.assetDesign.setFootprint,
							defaultCurrency: persistence.defaultCurrency,
						},
```

If `vue-tsc` says one of these members is not on `root.persistence`, find where `renovationProjectCommandBundle` gets the same member in `src/plugin/composition-root.ts` and read it from there. Do not construct a new command.

- [ ] **Step 5: Give the test and harness workspace real services**

In `tests/harness/referenceWorkspace.ts`, add these imports:

```ts
import { CreateAssetCommand } from '../../src/application/commands/asset/CreateAsset';
import { SetAssetFootprintCommand, SetAssetFootprintFromDimensionsCommand } from '../../src/application/commands/asset/SetAssetFootprint';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
```

Add `assetCreation: assetCreation(stack),` inside `commands: { … }` (after `structure: …`). Add at the end of the file:

```ts
/** "Add to asset library" over the same stack (2026-09-13 item modes spec §B): real commands, so a promoted asset and its footprint land where a placement reads them. */
function assetCreation(stack: ReturnType<typeof createRepositoryStack>) {
	const design = { sidecar: new ObsidianAssetGeometrySidecar(stack.assetGeometry), assets: stack.assets, events: stack.events, locks: new ReferenceLocks() };
	return {
		createAsset: new CreateAssetCommand(stack.assets, stack.events),
		setAssetFootprintFromDimensions: new SetAssetFootprintFromDimensionsCommand(design),
		setAssetFootprint: new SetAssetFootprintCommand(design),
		defaultCurrency: 'EUR',
	};
}
```

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/plugin/planEditorWiring.test.ts tests/plugin/guardCategory.test.ts tests/harness/harness.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/planEditorCommands.ts src/plugin/planEditorDeps.ts tests/harness/referenceWorkspace.ts tests/plugin/planEditorWiring.test.ts
git commit -m "editor: hand the Plan editor the guarded asset creation doors

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Right-click "Add to asset library"

**Files:**
- Create: `src/presentation/editor/elements/itemPromotion.ts`
- Modify: `src/presentation/editor/elements/spatialEditing.ts`
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts`
- Modify: `src/presentation/i18n/locales/en/input.ts`, `src/presentation/i18n/locales/de/input.ts`
- Modify: `src/presentation/i18n/locales/en/assetPlacement.ts`, `src/presentation/i18n/locales/de/assetPlacement.ts`
- Test (create): `tests/presentation/editor/itemPromotion.e2e.test.ts`

**Interfaces:**
- Consumes:
  - `centredFootprint` (Task 2)
  - `openNewAssetDialog({ …, prefill })` (Task 5)
  - `context.commands.assetCreation` (Task 6)
  - `elementTask.assets.write(element: NamedSpatialElement): Promise<boolean>` (existing, `assetPlacementTask.ts`)
  - `placementPoints(anchor, heading)` (existing, `src/domain/spatial/assetPlacement.ts`)
- Produces: `runtime.elementTask.promotion: { available(): boolean; promote(elementId: string): Promise<void> }`, and the context action `add-to-library`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/itemPromotion.e2e.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { placedOutline } from '../../../src/domain/spatial/assetPlacement';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';
import { tr } from '../../../src/presentation/i18n/strings';

const CABINET = [{ x: 1000, y: 1000 }, { x: 2200, y: 1000 }, { x: 2200, y: 1600 }, { x: 1000, y: 1600 }];
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const rig of mounted.splice(0)) rig.unmount(); });

async function withItem(kind: 'object' | 'path' = 'object') {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const read = expectOk(await rig.renovation.read(rig.plan.id));
	const item = kind === 'object'
		? { id: 'element-cabinet', kind, name: 'Cabinet', points: CABINET }
		: { id: 'element-path', kind, name: 'Garden path', points: CABINET.slice(0, 2) };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, elementInput(read, item), rig.runtime.structureTask.ledger)));
	await settle();
	rig.selection.select([item.id as never]); await settle();
	return { rig, item };
}
type Rig = Awaited<ReturnType<typeof withItem>>['rig'];
async function openMenu(rig: Rig) { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
const promoteAction = (rig: Rig) => rig.wrapper.find('[data-rp-context-action="add-to-library"]');
async function promoteFromMenu(rig: Rig) { await openMenu(rig); await promoteAction(rig).trigger('click'); await settle(); }
async function submitDialog(rig: Rig) {
	const form = rig.wrapper.get('.rp-dialog-form');
	await form.get('[data-field="unitCostAmount"]').setValue('450.00');
	await form.trigger('submit');
}

it('turns an item into a placement of a new asset with the same id, name and outline, undone in one step', async () => {
	const { rig, item } = await withItem();
	await promoteFromMenu(rig);
	const form = rig.wrapper.get('.rp-dialog-form');
	expect(form.get<HTMLInputElement>('[data-field="name"]').element.value).toBe('Cabinet');
	expect(form.get('.rp-new-asset__outline').text()).toContain('1200 × 600');
	await submitDialog(rig);
	await settleUntil(() => rig.project.structure.elements?.[0]?.kind === 'asset', 'promoted item');

	const placed = expectDefined(rig.project.structure.elements?.[0], 'placement');
	expect(placed.id).toBe(item.id);
	expect(rig.project.plan?.spatialElements).toEqual([{ id: item.id, name: 'Cabinet' }]);
	const assetId = expectDefined(placed.assetId, 'asset id');
	expect(expectDefined(expectOk(await rig.stack.assets.getById(assetId as never)), 'asset').entity.name).toBe('Cabinet');
	const shape = expectDefined(expectOk(await new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry).read(assetId as never)).document.shape, 'shape');
	expect(shape).toMatchObject({ footprintOrigin: 'typed', footprintPending: false });
	expect(placedOutline(placed, shape).footprint).toEqual(CABINET);
	expect(rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);

	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ id: item.id, kind: 'object', points: CABINET });
});

it('changes nothing when the dialog is cancelled, and opens one dialog for two quick requests', async () => {
	const { rig, item } = await withItem();
	const promotion = rig.runtime.elementTask.promotion;
	const first = promotion.promote(item.id);
	await promotion.promote(item.id); await settle();
	expect(rig.wrapper.findAll('.rp-dialog-form')).toHaveLength(1);
	rig.dialogs.resolve('cancel'); await first; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ id: item.id, kind: 'object' });
});

it('starts from an empty name for an item with no label', async () => {
	const { rig, item } = await withItem();
	rig.project.plan = { ...expectDefined(rig.project.plan, 'plan'), spatialElements: [] };
	const pending = rig.runtime.elementTask.promotion.promote(item.id); await settle();
	expect(rig.wrapper.get<HTMLInputElement>('.rp-dialog-form [data-field="name"]').element.value).toBe('');
	rig.dialogs.resolve('cancel'); await pending;
});

it('is offered only for a plain item, outside Review, in a leaf that can create an asset', async () => {
	const path = await withItem('path');
	await openMenu(path.rig); expect(promoteAction(path.rig).exists()).toBe(false);
	await path.rig.runtime.elementTask.promotion.promote(path.item.id); await settle();
	expect(path.rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);

	const { rig, item } = await withItem();
	await openMenu(rig); expect(promoteAction(rig).exists()).toBe(true);
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	await rig.runtime.renovation.perspective('review'); await settle();
	await openMenu(rig); expect(promoteAction(rig).exists()).toBe(false);
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	await rig.runtime.renovation.perspective('plan'); await settle();

	Reflect.deleteProperty(rig.deps.commands, 'assetCreation');
	await openMenu(rig); expect(promoteAction(rig).exists()).toBe(false);
	await rig.runtime.elementTask.promotion.promote(item.id); await settle();
	expect(rig.wrapper.find('.rp-dialog-form').exists()).toBe(false);
});

it('warns and leaves the item when the asset is created but the item cannot be replaced', async () => {
	const { rig, item } = await withItem();
	const warning = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
	await promoteFromMenu(rig);
	vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.failed', message: 'Unavailable' }));
	await submitDialog(rig);
	await settleUntil(() => warning.mock.calls.length > 0, 'promotion warning');
	expect(warning).toHaveBeenCalledWith(tr('editor.asset.promote-unplaced'));
	expect(rig.project.structure.elements?.[0]).toMatchObject({ id: item.id, kind: 'object' });
});
```

Verify two details while making this pass:
- **The perspective id** for leaving Review. Read `useRenovationSession` or `renovationSession.ts` for the non-review perspective name and use it in place of `'plan'`.
- **Which object `rig.deps.commands` is.** It is the object the leaf's context holds, because `structureEditor` passes `workspace.deps.commands` straight to `mountPlanEditorCanvas`. If deleting `assetCreation` does not hide the action, the context holds a copy. In that case, mount a second rig whose workspace omits `assetCreation` instead of weakening the assertion.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/presentation/editor/itemPromotion.e2e.test.ts`
Expected: FAIL. `promotion` is undefined and there is no `add-to-library` action.

- [ ] **Step 3: Add the locale keys**

`src/presentation/i18n/locales/en/input.ts`, after `'editor.input.rename'`:

```ts
	'editor.input.add-to-library': 'Add to asset library',
```

`src/presentation/i18n/locales/de/input.ts`, after `'editor.input.rename'`:

```ts
	'editor.input.add-to-library': 'Zur Objektbibliothek hinzufügen',
```

`src/presentation/i18n/locales/en/assetPlacement.ts`, after `'editor.asset.unreadable'`:

```ts
	'editor.asset.promote-unplaced': 'The asset is in the library, but the item could not be replaced by it. Place the asset on the plan instead.',
```

`src/presentation/i18n/locales/de/assetPlacement.ts`, after `'editor.asset.unreadable'`:

```ts
	'editor.asset.promote-unplaced': 'Das Objekt ist in der Bibliothek, aber der Gegenstand konnte nicht dadurch ersetzt werden. Platzieren Sie das Objekt stattdessen im Plan.',
```

- [ ] **Step 4: Create the promotion**

Create `src/presentation/editor/elements/itemPromotion.ts`:

```ts
import { ref } from 'vue';
import { placementPoints } from '../../../domain/spatial/assetPlacement';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { notifyWarning } from '../../notices/notify';
import { useProjectStore } from '../../stores/ProjectStore';
import { openNewAssetDialog } from '../../views/newAssetDialog';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { createAssetPlacementTask } from './assetPlacementTask';
import { centredFootprint } from './objectShape';

/**
 * "Add to asset library" on a plain item (2026-09-13 item modes spec §B). The New asset dialog opens prefilled with
 * the item's name and its outline centred as a measured footprint; then ONE reversible write turns the item into a
 * placement of that asset — same id and name, anchored at the outline's centre and facing +x, so the placed outline
 * is the drawn one. Undo restores the item; the asset stays in the library, as a catalogue entry does everywhere.
 *
 * `assetCreation` is read per call rather than captured, so the menu asks what this leaf can do when it is drawn.
 * Every refusal of the replacing write gets the one warning: what the user needs is where the asset went.
 */
export function createItemPromotion(context: PlanEditorContext, assets: Pick<ReturnType<typeof createAssetPlacementTask>, 'write'>) {
	const project = useProjectStore(), dialogs = useDialogStore(), busy = ref(false);
	const available = (): boolean => context.commands.assetCreation !== undefined;
	async function promote(elementId: string): Promise<void> {
		const creation = context.commands.assetCreation;
		const item = project.structure.elements?.find(element => element.id === elementId);
		if (!creation || item?.kind !== 'object' || dialogs.current !== null) return;
		const name = project.plan?.spatialElements?.find(label => label.id === elementId)?.name ?? '';
		const { centre, footprint } = centredFootprint(item.points);
		const outcome = await openNewAssetDialog({
			dialogs, busy, logger: context.commands.logger, commands: creation,
			prefill: { name, outline: { points: footprint, write: input => creation.setAssetFootprint.execute(input) } },
		});
		if (outcome === null) return;
		const placed = await assets.write({ id: item.id, kind: 'asset', assetId: outcome.assetId, points: placementPoints(centre, 0), name });
		if (!placed) notifyWarning(tr('editor.asset.promote-unplaced'));
	}
	return { available, promote };
}
```

If lint refuses the `presentation/editor → presentation/views` import, move `openNewAssetDialog`'s call behind a function passed in from `spatialEditing.ts`. `src/presentation/library/AssetLibraryRoot.vue` already imports `../views/newAssetDialog`, so the import is expected to pass.

- [ ] **Step 5: Compose it beside the placement task**

In `src/presentation/editor/elements/spatialEditing.ts`:

```ts
import { createItemPromotion } from './itemPromotion';
```

Replace the `elementTask` line with:

```ts
	const assets = createAssetPlacementTask(context, runtime);
	const elementTask = Object.assign(createElementTask(context, runtime), { assets, promotion: createItemPromotion(context, assets) });
```

- [ ] **Step 6: Offer it in the context menu**

In `src/presentation/editor/selection/useCanvasMenuActions.ts`, add after `addSubmenu`:

```ts
	/** A plain item's promotion into the asset library (2026-09-13 item modes spec §B); nothing where this leaf cannot create an asset. */
	function promoteActions(id: string, blocked: boolean): CanvasMenuAction[] {
		const promotion = runtime.elementTask.promotion;
		if (!promotion.available() || !project.structure.elements?.some(item => item.id === id && item.kind === 'object')) return [];
		return [{ id: 'add-to-library', label: 'editor.input.add-to-library', group: 'records', icon: 'square-dashed-mouse-pointer', disabled: blocked || runtime.elementActions.active.value, run: () => promotion.promote(id) }];
	}
```

and change the single-selection line in the computed to:

```ts
		if (ids.length === 1) result.push(...singleActions(id, blocked), ...promoteActions(id, blocked), ...addSubmenu(id, blocked));
```

- [ ] **Step 7: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor tests/harness`
Expected: PASS. `canvasContextMenuStandalone.test.ts` mounts the menu outside a real runtime. If it now fails reading `elementTask.promotion`, give its runtime stub `promotion: { available: () => false, promote: async () => {} }`, beside the stub's other `elementTask` members. Do not guard the production code.

- [ ] **Step 8: Check the branch arms**

Run: `npx vitest run --coverage --coverage.include=src/presentation/editor/elements/itemPromotion.ts --coverage.include=src/presentation/editor/selection/useCanvasMenuActions.ts --coverage.include=src/presentation/views/NewAssetForm.vue tests/presentation/editor/itemPromotion.e2e.test.ts tests/presentation/views/newAssetFormOutline.test.ts tests/presentation/editor/contextMenuActions.test.ts`

Read `coverage/coverage-final.json` for these three files. Any arm added by Tasks 5 and 7 that no case reaches must get a case, or be removed if nothing can reach it. Do not leave it for the CI floor to find.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/editor src/presentation/i18n/locales tests/presentation/editor
git commit -m "editor: right-click Add to asset library turns an item into a placement

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: User guide, ADR amendment and manual test case

**Files:**
- Modify: `docs/using-plan-editor.md`
- Modify: `docs/development/adrs/0023-generic-spatial-elements.md`
- Create: `docs/tests/cases/Add an item to the asset library.md`

- [ ] **Step 1: User guide**

In `docs/using-plan-editor.md`, section "Shape and select the space", insert after the paragraph ending "…does not finish the element." (before "Hold Shift while drawing a line…"):

```markdown
An **Item** starts as a rectangle: drag on the floor to size it, or type its position and size in
details. Choose **Free-form** in the task bar or in details to place its corners one by one instead,
and **Rectangle** to go back; the outline carries across both ways. Right-click a saved item and
choose **Add to asset library** to create a library asset from its name and outline. The item
becomes a placement of that asset; Undo turns it back into an item, and the asset stays in the
library.
```

- [ ] **Step 2: ADR amendment**

Append to `docs/development/adrs/0023-generic-spatial-elements.md`:

```markdown

## Amendment 2026-09-13

An object still never references an asset on its own. **Add to asset library**
(`docs/superpowers/specs/2026-09-13-plan-editor-item-modes-and-library-design.md`) is an explicit
user action: it creates an asset whose footprint is the object's outline and changes the element's
kind to `asset` under the same id, in one reversible write.
```

- [ ] **Step 3: Manual test case**

Create `docs/tests/cases/Add an item to the asset library.md`:

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 210
sources:
  - Plan editor item modes and library design spec §A (rectangle or free-form)
  - Plan editor item modes and library design spec §B (Add to asset library)
status: Ready
---

# Add an item to the asset library

Add → Item draws a rectangle by default and switches to free-form corners and back. Right-click on a
saved item creates a library asset from its name and outline and puts a placement of it where the
item was. `docs/superpowers/specs/2026-09-13-plan-editor-item-modes-and-library-design.md` is the
design.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, a project with
a floor that has walls and one Room.

## Steps

1. Add → Item. **Expected:** the task bar shows **Rectangle** pressed and says to drag; details show
   the position and size fields open.
2. Drag inside the room. **Expected:** a rectangle follows the pointer; a single click afterwards
   leaves it unchanged.
3. Choose **Free-form**. **Expected:** the same four corners stay; clicking the plan adds a corner.
4. Choose **Rectangle**. **Expected:** the outline becomes the box around every corner.
5. Type a width in details, then try **Free-form**. **Expected:** nothing changes until the entry is
   applied or discarded.
6. Name it `Cabinet` and Finish. Right-click it. **Expected:** **Add to asset library** is listed.
7. Choose it. **Expected:** New asset opens with `Cabinet` and a footprint line giving the outline's
   size in millimetres, and no width or depth fields.
8. Enter a unit cost and create. **Expected:** the item redraws as a placement with the same outline;
   its Inspector offers Open in designer.
9. Open the asset library. **Expected:** `Cabinet` is listed; its designer shows the same footprint,
   without an unscaled warning.
10. Back on the plan, press Ctrl+Z. **Expected:** the placement is a plain item again; the asset is
    still in the library.
11. Switch to Review and right-click the item. **Expected:** no **Add to asset library**.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not run. Written with the increment; nobody has walked it in a vault yet. |
```

- [ ] **Step 4: Run the doc-adjacent gates**

Run: `npm run check:fast -- tests/build tests/release`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/using-plan-editor.md docs/development/adrs/0023-generic-spatial-elements.md "docs/tests/cases/Add an item to the asset library.md"
git commit -m "docs: item drawing modes and Add to asset library

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
