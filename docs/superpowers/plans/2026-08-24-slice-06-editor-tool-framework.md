# Slice 6 Implementation Plan — Editor Tool Framework, Undo/Redo & Inspector

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the editor machinery — tool lifecycle, gesture→command transaction boundary, serialized undo/redo with revision expectations, selection, snapping, transformer normalization, and the Inspector pipeline — per `docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md`.

**Architecture:** Pure presentation-layer framework over slice 3 commands and slice 4 persistence. One gesture → one `UndoableCommand` → one `CommandHistory` entry → one write. Undo expectations come from a shared `WriteLedger` (history-scoped, never per-adapter).

**Tech Stack:** TypeScript strict, Pinia setup stores, Vitest (node default, jsdom via pragma), relative imports only (no path aliases exist).

**Spec:** [`docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md`](../../tasks/06-editor-tool-framework-undo-redo-and-inspector.md)

## Global Constraints

- **BLOCKING PREREQUISITE — Task 0 verifies it:** slice 5 must be landed first (`presentation/editor/viewport/` exporting `ScreenPoint`/`worldToScreen`/`screenToWorld`, `useEditorStore`, konva installed). This slice declares none of those three itself (spec Dependencies §).
- Definition of done per task: `npm run check` green (build = `vue-tsc && vite build`; lint = oxlint + ESLint, warnings fail; coverage floors ratcheted ~99/98 — every new line needs a test; fallow).
- Layers: `presentation → application → domain → core`; no `obsidian`/`konva`/`vue`/`pinia` imports in core/domain/application (ESLint enforces; `WriteLedger` goes in **application**, everything else in `presentation/editor/`).
- All `Result`-returning signatures resolve `Result<void, AppError>` from `src/core/result/Result.ts` (`ok`/`err`/`isErr`). Never throw for expected failures.
- Relative imports mirroring existing style (`../../../core/…`). Tabs, matching repo style.
- Test helpers already available: `tests/helpers/domain.ts` (`expectOk`, `expectErr`, `observationToken`, `RecordingEventBus`, `injectedReadFailure`), `tests/helpers/entities.ts` (`makeZone`, `squareAt` → 10×10 polygon), `InMemoryZoneRepository` (has `.poke(id)` to simulate foreign writes).
- No Konva, no Obsidian anywhere in this slice's tests except where noted; jsdom only for Pinia store tests (`// @vitest-environment jsdom` pragma line 1).

---

### Task 0: Verify prerequisites

- [ ] Confirm `src/presentation/editor/viewport/` exists and exports `ScreenPoint`, `worldToScreen(p, viewport, dpr)`, `screenToWorld(p, viewport, dpr)` (read the actual signatures — Task 8's facade binds them), `presentation/stores/EditorStore.ts` exists, `konva` is in package.json. If any is missing: **STOP — execute slice 5 first.**
- [ ] Read actual `Viewport`/`EditorStore` exports; record them for Tasks 7–8.

---

### Task 1: WriteLedger

**Files:**
- Create: `src/application/editor/WriteLedger.ts`
- Test: `tests/application/editor/writeLedger.test.ts`

**Interfaces:**
- Produces: `interface WriteLedger { lastWritten(id: EntityId<string>): EntityVersion | null; record(id: EntityId<string>, version: EntityVersion): void }`, `class SessionWriteLedger`.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from 'vitest';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { observationToken } from '../../helpers/domain';

const version = (revision: number) => ({ revision, observed: observationToken(`t${revision}`) });

describe('SessionWriteLedger', () => {
	it('answers null for an entity this history never wrote', () => {
		const ledger = new SessionWriteLedger();
		expect(ledger.lastWritten('zone-x' as never)).toBeNull();
	});
	it('records per entity and answers the latest write', () => {
		const ledger = new SessionWriteLedger();
		ledger.record('zone-a' as never, version(2));
		ledger.record('zone-b' as never, version(5));
		expect(ledger.lastWritten('zone-a' as never)?.revision).toBe(2);
		ledger.record('zone-a' as never, version(3));
		expect(ledger.lastWritten('zone-a' as never)?.revision).toBe(3);
	});
});
```

- [ ] **Step 2:** `npx vitest run tests/application/editor/writeLedger.test.ts` → FAIL (module missing)
- [ ] **Step 3: implement**

```ts
import type { EntityId } from '../../core/identity/EntityId';
import type { EntityVersion } from '../ports/versioning';

export interface WriteLedger {
	lastWritten(id: EntityId<string>): EntityVersion | null;
	record(id: EntityId<string>, version: EntityVersion): void;
}

export class SessionWriteLedger implements WriteLedger {
	private readonly versions = new Map<EntityId<string>, EntityVersion>();

	lastWritten(id: EntityId<string>): EntityVersion | null {
		return this.versions.get(id) ?? null;
	}

	record(id: EntityId<string>, version: EntityVersion): void {
		this.versions.set(id, version);
	}
}
```

- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(editor): session write ledger for undo expectations"`

---

### Task 2: UndoableCommand + CommandHistory

**Files:**
- Create: `src/presentation/editor/tools/undoable-command.ts`, `src/presentation/editor/tools/command-history.ts`
- Test: `tests/presentation/editor/tools/commandHistory.test.ts`

**Interfaces:**
- Produces: `interface UndoableCommand { execute(): Promise<Result<void, AppError>>; undo(): Promise<Result<void, AppError>> }`, `const UNDO_DEPTH = 100`, `class CommandHistory implements { run, undo, redo, canUndo, canRedo, clear }`.
- Semantics (spec §CommandHistory): failed `execute()` → not pushed, same failed Result returned; failed `undo()` → stays on undoStack; failed `redo()` → stays on redoStack; stacks mutate only after confirmed success; `run`/`undo`/`redo` serialize through one queue; cap drops oldest from undoStack only.

- [ ] **Step 1: failing tests** (key ones)

```ts
import { describe, expect, it, vi } from 'vitest';
import { err, isErr, ok, type Result } from '../../../../../src/core/result/Result'; // adjust depth
import type { AppError } from '../../../../../src/core/errors/AppError';
import { CommandHistory, UNDO_DEPTH } from '../../../../../src/presentation/editor/tools/command-history';
import type { UndoableCommand } from '../../../../../src/presentation/editor/tools/undoable-command';

let seq = 0;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const okCommand = (cascadeMs = 0): UndoableCommand & { id: number } => {
	const id = ++seq;
	return {
		id,
		execute: vi.fn(async () => { await delay(cascadeMs); return ok(undefined); }),
		undo: vi.fn(async () => { await delay(cascadeMs); return ok(undefined); }),
	};
};
const failExecute = (): UndoableCommand => ({
	execute: async () => err({ category: 'Validation', code: 'x.fail', message: 'fail' }) as Result<void, AppError>,
	undo: async () => ok(undefined),
});
const failUndo = (): UndoableCommand => ({
	execute: async () => ok(undefined),
	undo: async () => err({ category: 'Persistence', code: 'y.fail', message: 'fail' }) as Result<void, AppError>,
});

describe('CommandHistory', () => {
	it('pushes a successful run and clears the redo stack', async () => {
		const h = new CommandHistory();
		await h.run(okCommand());
		expect(h.canUndo).toBe(true);
		await h.run(okCommand());
		await h.undo();
		expect(h.canRedo).toBe(true);
		const result = await h.run(okCommand());
		expect(result).toEqual(ok(undefined));
		expect(h.canRedo).toBe(false);
	});
	it('never pushes a command whose execute resolves a failed Result and returns that same Result', async () => {
		const h = new CommandHistory();
		const failed = failExecute();
		const result = await h.run(failed);
		expect(isErr(result)).toBe(true);
		expect(h.canUndo).toBe(false);
		expect(failed.execute).toHaveBeenCalledTimes(1);
	});
	it('a failed undo leaves the command on the undo stack', async () => {
		const h = new CommandHistory();
		const cmd = failUndo();
		await h.run(cmd);
		await h.undo();
		expect(h.canUndo).toBe(true);   // still retryable
		expect(h.canRedo).toBe(false);  // never moved
	});
	it('a failed redo leaves the command on the redo stack', async () => {
		const h = new CommandHistory();
		const cmd = okCommand();
		await h.run(cmd);
		cmd.execute = async () => err({ category: 'Geometry', code: 'z.fail', message: 'fail' });
		await h.undo();
		await h.redo();
		expect(h.canRedo).toBe(true);
		expect(h.canUndo).toBe(false);
	});
	it('serializes operations: second execute does not begin until first resolved', async () => {
		const h = new CommandHistory();
		const slow = okCommand(30);   // dispatched first, resolves last
		const fast = okCommand(0);
		void h.run(slow);
		void h.run(fast);
		await h.undo(); await h.undo(); // queued behind both runs
		const slowOrder = vi.mocked(slow.execute).mock.invocationCallOrder[0];
		const fastOrder = vi.mocked(fast.execute).mock.invocationCallOrder[0];
		expect(slowOrder).toBeLessThan(fastOrder);
		const stack = (h as never as { undoStack: unknown[] }).undoStack;
		expect(stack).toHaveLength(0); // both undone, LIFO completed without interleave
	});
	it(`caps the undo stack at UNDO_DEPTH (${UNDO_DEPTH}) and still reports canUndo`, async () => {
		const h = new CommandHistory();
		for (let i = 0; i < UNDO_DEPTH + 5; i++) await h.run(okCommand());
		const stack = (h as never as { undoStack: unknown[] }).undoStack;
		expect(stack).toHaveLength(UNDO_DEPTH);
		expect(h.canUndo).toBe(true);
	});
	it('clear() empties both stacks', async () => {
		const h = new CommandHistory();
		await h.run(okCommand());
		await h.clear();
		expect(h.canUndo).toBe(false);
		expect(h.canRedo).toBe(false);
	});
});
```

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3: implement**

```ts
// src/presentation/editor/tools/undoable-command.ts
import type { Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';

export interface UndoableCommand {
	execute(): Promise<Result<void, AppError>>;
	undo(): Promise<Result<void, AppError>>;
}
```

```ts
// src/presentation/editor/tools/command-history.ts
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { UndoableCommand } from './undoable-command';

export const UNDO_DEPTH = 100;

type VoidResult = Result<void, AppError>;

export class CommandHistory {
	private undoStack: UndoableCommand[] = [];
	private redoStack: UndoableCommand[] = [];
	private tail: Promise<unknown> = Promise.resolve();

	get canUndo(): boolean { return this.undoStack.length > 0; }
	get canRedo(): boolean { return this.redoStack.length > 0; }

	run(command: UndoableCommand): Promise<VoidResult> {
		return this.enqueue(() => this.runNow(command));
	}
	undo(): Promise<VoidResult> { return this.enqueue(() => this.undoNow()); }
	redo(): Promise<VoidResult> { return this.enqueue(() => this.redoNow()); }

	clear(): Promise<VoidResult> {
		return this.enqueue(async () => {
			this.undoStack = [];
			this.redoStack = [];
			return ok(undefined);
		});
	}

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const routed = this.tail.then(operation, operation);
		this.tail = routed.catch(() => undefined);
		return routed;
	}

	private async runNow(command: UndoableCommand): Promise<VoidResult> {
		const result = await command.execute();
		if (isErr(result)) return result;
		this.undoStack.push(command);
		if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
		this.redoStack = [];
		return ok(undefined);
	}

	private async undoNow(): Promise<VoidResult> {
		const command = this.undoStack[this.undoStack.length - 1];
		if (!command) return ok(undefined);
		const result = await command.undo();
		if (isErr(result)) return result;
		this.undoStack.pop();
		this.redoStack.push(command);
		return ok(undefined);
	}

	private async redoNow(): Promise<VoidResult> {
		const command = this.redoStack[this.redoStack.length - 1];
		if (!command) return ok(undefined);
		const result = await command.execute();
		if (isErr(result)) return result;
		this.redoStack.pop();
		this.undoStack.push(command);
		return ok(undefined);
	}
}
```

- [ ] **Steps 4–5:** PASS, commit `feat(editor): serialized CommandHistory with failure-preserving stacks`

---

### Task 3: ReversibleMoveZoneCommand

**Files:**
- Create: `src/presentation/editor/tools/reversible-move-zone-command.ts`
- Test: `tests/presentation/editor/tools/reversibleMoveZoneCommand.test.ts`

**Interfaces:**
- Consumes: `MoveSpatialObjectCommand` (its input's optional `expected?: EntityVersion` already exists — verified in `src/application/commands/zone/MoveSpatialObject.ts:26`), `WriteLedger`, success payload `{ zone: Loaded<Zone> }` (version at `result.value.zone.version` — NOT `result.value.zone.entity.version`; the spec's sketch predates slice 3's `Loaded<T>` correction).
- Produces: `class ReversibleMoveZoneCommand implements UndoableCommand` — `constructor(moveCommand, ledger: WriteLedger, zoneId: ZoneId, forward: Polygon, inverse: Polygon)`.

- [ ] **Step 1: failing tests** — the two cases the spec says must BOTH exist:

Test wiring sketch:

```ts
const wired = () => {
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const ledger = new SessionWriteLedger();
	const history = new CommandHistory();
	const move = new MoveSpatialObjectCommand(zones, events);
	return { zones, ledger, history, move };
};
```

1. **Sibling writes (the case a per-adapter field fails):** seed a zone (`squareAt(0,0)`); run adapterA through history (forward=`squareAt(10,10)`, inverse=`squareAt(0,0)`), then adapterB (forward=`squareAt(20,20)`, inverse=`squareAt(10,10)`); `history.undo()` twice; expect BOTH succeed and geometry equals `squareAt(0,0)` (the pre-move value). With a per-adapter expectation field, the second undo refuses with `zone.revision-conflict` — watched failing.
2. **Watched-failing step:** temporarily replace `this.ledger.lastWritten(...)` with a per-adapter captured version → test 1 must FAIL; restore. Record the red run in the PR description.
3. **Foreign write:** run A, then `zones.poke(zone.id)` (bumps stored revision outside this history), then `history.undo()` → error has `code === 'zone.external-modification'`; stored geometry is still the foreign state; command stayed on the undoStack (`history.canUndo === true`).
4. First `execute()` carries NO expectation (spy wrapper over the move command asserting `expected === undefined` on the first dispatch, present on later ones).
5. Failed forward (geometry `{ points: [] }`) returns the error unchanged and records nothing in the ledger.

- [ ] **Step 2:** FAIL · **Step 3: implement**

```ts
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { Command } from '../../../application/commands/Command';
import type { MoveSpatialObjectInput } from '../../../application/commands/zone/MoveSpatialObject';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Loaded } from '../../../application/ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { UndoableCommand } from './undoable-command';

type MoveCommand = Command<
	MoveSpatialObjectInput,
	Result<{ zone: Loaded<Zone> }, AppError>
>;

export class ReversibleMoveZoneCommand implements UndoableCommand {
	private hasWritten = false;

	constructor(
		private readonly moveCommand: MoveCommand,
		private readonly ledger: WriteLedger,
		private readonly zoneId: ZoneId,
		private readonly forward: Polygon,
		private readonly inverse: Polygon,
	) {}

	async execute(): Promise<Result<void, AppError>> {
		return this.dispatch(this.forward);
	}

	async undo(): Promise<Result<void, AppError>> {
		return this.dispatch(this.inverse);
	}

	private async dispatch(geometry: Polygon): Promise<Result<void, AppError>> {
		const expected = this.hasWritten ? this.ledger.lastWritten(this.zoneId) : undefined;
		const input: MoveSpatialObjectInput =
			expected === undefined || expected === null
				? { zoneId: this.zoneId, geometry }
				: { zoneId: this.zoneId, geometry, expected };
		const result = await this.moveCommand.execute(input);
		if (isErr(result)) return result;
		this.hasWritten = true;
		this.ledger.record(this.zoneId, result.value.zone.version);
		return ok(undefined);
	}
}
```

(Executor: tighten the `MoveCommand` error union to the handler's real union — `ReferenceError | GeometryError | ValidationError | PersistenceError` — if the wider `AppError` upsets assignability.)

- [ ] **Steps 4–5:** PASS, commit `feat(editor): reversible move adapter with history-scoped expectations`

---

### Task 4: normalizeTransformerResult

**Files:**
- Create: `src/presentation/editor/selection/normalize-transform.ts`
- Test: `tests/presentation/editor/selection/normalizeTransform.test.ts`

**Interfaces:** `function normalizeTransformerResult(transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }, baseGeometry: BoundingBox): BoundingBox` (`BoundingBox` is `{ min: Point; max: Point }`).

Semantics (documented in-file as the slice's stated assumption): dimensions scale by `scaleX`/`scaleY`; the output box anchors its min corner at `(transform.x, transform.y)`; rotation rides along in the input because Transformer always reports it, but the axis-aligned `BoundingBox` contract means oriented extents are slice 8's resize concern.

- [ ] Table-driven tests including the spec's anchor case: `scaleX: 2, scaleY: 1` on a 1000×500 base box normalizes to a 2000×500 box; each asserts `!('scaleX' in result) && !('scaleY' in result)`; identity transform reproduces base dimensions; fractional scales round-trip.
- [ ] Implement (pure arithmetic):

```ts
import type { BoundingBox } from '../../../core/geometry/BoundingBox';

export interface TransformerTransform {
	readonly x: number;
	readonly y: number;
	readonly rotation: number;
	readonly scaleX: number;
	readonly scaleY: number;
}

export function normalizeTransformerResult(
	transform: TransformerTransform,
	baseGeometry: BoundingBox,
): BoundingBox {
	const width = (baseGeometry.max.x - baseGeometry.min.x) * transform.scaleX;
	const height = (baseGeometry.max.y - baseGeometry.min.y) * transform.scaleY;
	return {
		min: { x: transform.x, y: transform.y },
		max: { x: transform.x + width, y: transform.y + height },
	};
}
```

- [ ] PASS, commit `feat(editor): transformer scale normalization to world mm`

---

### Task 5: SnapService

**Files:**
- Create: `src/presentation/editor/snapping/snap-service.ts`
- Test: `tests/presentation/editor/snapping/snapService.test.ts`

**Interfaces:** all six spec methods; config injected once (editor preferences, SDD §15 — settings, not persistent domain data):

```ts
export interface SnapServiceConfig {
	gridSpacingMm: number;
	toleranceMm: number;
	angleStepRadians: number;
}
export interface SnapCandidates {
	vertices?: readonly Point[];
	edges?: readonly LineSegment[];
}
export type TransformerHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export class SnapService implements SnapServiceInterface {
	constructor(private readonly config: SnapServiceConfig) {}
	snapPoint(point: Point, candidates: SnapCandidates): Point;
	snapRotation(angleRadians: number): number;
	snapResize(box: BoundingBox, handle: TransformerHandle): BoundingBox;
	snapToGrid(point: Point): Point;
	snapToVertex(point: Point, candidates: readonly Point[]): Point | null;
	snapToEdge(point: Point, candidates: readonly LineSegment[]): Point | null;
}
```

Behavior: `snapToGrid` rounds both axes to `gridSpacingMm`; `snapToVertex` nearest vertex within tolerance else `null`; `snapToEdge` nearest point ON the segment (clamped projection) within tolerance else `null`; `snapPoint` precedence vertex > edge > original point (returns `Point`, never null); `snapRotation` rounds to the nearest `angleStepRadians` multiple; `snapResize` snaps only the handle-moved edges of the box to the grid (corner handles move two edges, edge handles one).

- [ ] Node tests per method over geometry fixtures (grid 100mm, tolerance 15mm typical). PASS, commit `feat(editor): injectable six-method SnapService`

---

### Task 6: SelectionStore (Pinia)

**Files:**
- Create: `src/presentation/editor/selection/selection-store.ts`
- Test: `tests/presentation/editor/selection/selectionStore.test.ts` (jsdom pragma)

**Interfaces:** `useSelectionStore` setup store: `readonly selectedIds: Ref<readonly EntityId<string>[]>`, `select(ids)`, `clear()`, `isSelected(id)`. Domain IDs only — no Konva node/ref type reachable from it (DoD 8; layer rules back this). Per vue-conventions §5: setup store, every piece of state returned.

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { EntityId } from '../../../core/identity/EntityId';

export const useSelectionStore = defineStore('editor-selection', () => {
	const selectedIds = ref<readonly EntityId<string>[]>([]);
	function select(ids: readonly EntityId<string>[]): void {
		selectedIds.value = [...ids];
	}
	function clear(): void {
		selectedIds.value = [];
	}
	function isSelected(id: EntityId<string>): boolean {
		return selectedIds.value.includes(id);
	}
	return { selectedIds, select, clear, isSelected };
});
```

- [ ] Test with `createPinia()`/`setActivePinia`: initial empty; `select` replaces prior selection and defensively copies; `clear`; `isSelected` membership. PASS, commit `feat(editor): selection store holding domain ids only`

---

### Task 7: EditorTool / EditorPointerEvent / ToolManager

**Files:**
- Create: `src/presentation/editor/tools/editor-tool.ts`, `src/presentation/editor/tools/tool-manager.ts`
- Test: `tests/presentation/editor/tools/toolManager.test.ts`

**Interfaces:** `ToolId` union exactly as spec (incl. `'calibrate'`); `EditorPointerEvent` per spec (`worldPoint: Point`, `screenPoint: ScreenPoint` imported from slice 5's viewport module, `button`, `modifiers`, `targetId`); `EditorTool` per spec. `class ToolManager { register(tool: EditorTool): void; get activeToolId(): ToolId | null; setActiveTool(id: ToolId): void; pointerDown(e)/pointerMove(e)/pointerUp(e): void; cancelGesture(): void }`. No tool-specific branching inside the manager (DoD 12).

Lifecycle rules (DoD 1): switch = outgoing `cancel()` **iff gesture in flight**, then outgoing `deactivate()`, then incoming `activate(context)` — each exactly once; setting the already-active id is a no-op; unregistered id throws (programming error). Gesture tracking: `pointerDown` marks in-flight; `pointerUp`/`cancelGesture` clears it. The context is provided by a factory callback (`contextFactory: () => EditorContext`) so each activation hands a live context.

- [ ] Fake-tool doubles recording call order; assert ordering `[cancel?, deactivate, activate]`, exactly-once counts, no-op re-select, unregistered-id throw, Escape-path `cancelGesture()` calls `cancel()` once and clears the in-flight flag. PASS, commit `feat(editor): tool registry and switching lifecycle`

---

### Task 8: RenderState + EditorContext facade

**Files:**
- Create: `src/presentation/editor/tools/render-state.ts`, `src/presentation/editor/tools/editor-context.ts`
- Test: `tests/presentation/editor/tools/editorContext.test.ts`

**Interfaces:**

```ts
// render-state.ts — transient visuals only (SDD §19), never persisted
export class RenderState {
	hoveredObjectId: string | null = null;
	previewPolygon: readonly Point[] | null = null;
	marquee: BoundingBox | null = null;
	snapGuides: LineSegment[] = [];
	reset(): void { /* clears all four */ }
}
```

```ts
// editor-context.ts — exactly the spec shape:
export interface EditorContext {
	readonly viewport: {
		worldToScreen(p: Point): ScreenPoint;
		screenToWorld(p: ScreenPoint): Point;
		setPan(delta: Vector): void;
		setZoom(factor: number, origin: ScreenPoint): void;
	};
	readonly selection: SelectionStore;
	readonly snapService: SnapService;
	readonly commandDispatcher: { run(command: UndoableCommand): Promise<Result<void, AppError>> };
	readonly writeLedger: WriteLedger;
	readonly renderState: RenderState;
	readonly activePlan: { id: PlanId; calibration: Calibration | null };
}
export function createEditorContext(deps: {
	bindViewport(): EditorContext['viewport'];   // closes over slice 5's live pan/zoom/dpr
	selection: SelectionStore;
	snapService: SnapService;
	commandDispatcher: EditorContext['commandDispatcher'];
	writeLedger: WriteLedger;
	renderState: RenderState;
	activePlan: { id: PlanId; calibration: Calibration | null };
}): EditorContext
```

`bindViewport` closes over slice 5's `worldToScreen`/`screenToWorld` bound to current pan/zoom (Task 0 recorded the real slice-5 signatures — adapt the binding, do NOT redeclare `ScreenPoint`). PanTool-only mutators ride the same facade; camera state is ephemeral, never dispatched (spec's stated assumption).

- [ ] Runtime architecture contract test (DoD 11): build a context with stub deps; assert its enumerable members are exactly the seven spec members, and no member exposes functions named `getById`/`save`/`delete`/`listBy*`.
- [ ] PASS, commit `feat(editor): EditorContext facade and transient render state`

---

### Task 9: Compile-time screen/world type-safety proof

**Files:**
- Create: `tests/presentation/editor/type-safety.test-d.ts` (**not** matched by vitest's `tests/**/*.test.ts` glob)
- Modify: `tsconfig.json` — add this one file to `include` so `vue-tsc -noEmit` (the only type gate that sees tests) checks it.

```ts
import { createPolygon } from '../../../src/core/geometry/Polygon';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { ScreenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import type { Point } from '../../../src/core/geometry/Point';

declare const screen: ScreenPoint;
declare const world: Point;
declare const zone: Zone;

// @ts-expect-error a screen pixel is not domain geometry
createPolygon([screen]);
createPolygon([world]);

// @ts-expect-error Zone.withGeometry consumes world-millimetre points, not screen pixels
zone.withGeometry({ points: [screen] });
```

An unused `@ts-expect-error` directive is itself a compile failure, which keeps the proof honest in both directions.
- [ ] Run `npm run build` → type-check passes WITH the negative cases present. Commit `test(editor): compile-time screen/world brand separation`

---

### Task 10: Inspector pipeline

**Files:**
- Create: `src/application/queries/GetZoneInspector.ts`, `src/presentation/editor/inspector/inspector-store.ts`
- Modify: `src/domain/zone/Zone.ts` — remove the now-unneeded `fallow-ignore-next-line` above `area()` (its first consumer arrives)
- Test: `tests/presentation/editor/inspector/inspectorStore.test.ts` (jsdom), extend `tests/application/queries/queries.test.ts`

**Interfaces:**

```ts
// src/application/queries/GetZoneInspector.ts
export interface ZoneInspectorFields {
	readonly id: ZoneId;
	readonly name: string;
	readonly areaMm2: number;
}
// getById → entity.area() → { id, name, areaMm2 }; "not found" is ok(null), like GetZone
export class GetZoneInspector
	implements Query<{ id: ZoneId }, Result<ZoneInspectorFields | null, PersistenceError>>
{
	constructor(zones: ZoneRepository) {}
}
```

```ts
// src/presentation/editor/inspector/inspector-store.ts
export type InspectorDto =
	| { kind: 'empty' }
	| { kind: 'zone'; id: ZoneId; name: string; areaMm2: number }
	| { kind: 'multiple'; ids: readonly EntityId<string>[] };

export interface InspectorDeps {
	query: { execute(id: EntityId<string>): Promise<Result<ZoneInspectorFields | null, PersistenceError>> };
	dispatcher: { run(c: UndoableCommand): Promise<Result<void, AppError>> };
	toCommand(edit: Record<string, unknown>): UndoableCommand;
	// No concrete property-update command exists yet (slice 8 owns "rename a Zone");
	// slice 6 fixes only the shape — one commit, one UndoableCommand, one history entry.
}
export function createInspectorStoreDefinition(deps: InspectorDeps) {
	return defineStore('inspector', () => { /* dto ref; hydrateFrom(selection); commit; refresh */ });
}
```

Rules (DoD 10 + spec): selection of one id → zone DTO sourced from the **query**, never a repository handle held by presentation; several ids → `{ kind: 'multiple' }` without querying; empty selection → `{ kind: 'empty' }`, query never called. `commit(edit)` → exactly ONE `dispatcher.run(toCommand(edit))` per call (keystroke-coalescing on blur/enter is future UI's job). `refresh(): Promise<void>` — no-op on empty selection (zero query calls), replaces dto on success, keeps the previous dto on a failed query, NEVER mutates what is selected. Its caller is slice 8's post-command funnel, not each edit site — this slice declares and tests the operation only.

- [ ] Tests for each rule above. PASS, commit `feat(inspector): selection-to-DTO-to-command pipeline with refresh invalidation`

---

### Task 11: Gesture→command integration test

**Files:**
- Test only: `tests/presentation/editor/tools/gestureTransaction.test.ts`

- [ ] Wire ToolManager + CommandHistory + spy dispatcher + a test-double tool that builds one fake `UndoableCommand` at pointerUp. Simulate `pointerDown` → 25 × `pointerMove` → `pointerUp`: assert exactly **1** `run()`, **1** wrapped-command `execute()`, **0** dispatches during moves (DoD 2). Then Escape (`cancelGesture`) mid-gesture: 0 dispatches, renderState reset (transaction-boundary rule). New `run()` after `undo()` clears the redo stack (DoD 3). Back-to-back dispatches where completion order disagrees with dispatch order appear on the stack in dispatch order (DoD 4 — controllable cascade durations).
- [ ] Commit `test(editor): one gesture produces exactly one transaction`

---

### Task 12: Gate and bookkeeping

- [ ] Run full `npm run check` (all four legs). Fix anything the gates surface (coverage floors, size/complexity budgets, fallow dead-code findings).
- [ ] Update `docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md` frontmatter: `status` → done-state used by earlier slices, `finished` date.
- [ ] Commit `chore(docs): mark design slice 6 complete`

## Deliberate assumptions recorded (flag during review)

1. Pan/zoom bypasses the undo stack (spec states this assumption; consistent with SDD §15's ephemeral list).
2. `normalizeTransformerResult` ignores rotation for the axis-aligned box; oriented resize is slice 8.
3. `MeasureTool` dispatches nothing (spec's assumption).
4. Inspector multi-select DTO is shape-only; bulk-edit UX deferred (spec).
5. No Vue UI component is built in this slice — the Inspector ships as store + query; the panel arrives with slice 8's editing commands.
6. Undo history is ephemeral — not persisted across reload or Plan switch (spec's stated assumption).

## Self-review notes

- Spec coverage checked against all 13 Definition-of-Done items: DoD 1→T7, 2/3/4→T11/T2, 5→T3, 6→T4, 7→T2, 8→T6, 9→T5, 10→T10, 11→T8, 12→T7/T8, 13→T2. Snapshot-inverse contract obligations (multi-file restores, event re-emission) are documented rules with no code in this slice — correctly absent.
- Type consistency: `Loaded<Zone>.version` (not `zone.version` as the spec's pre-slice-3 sketch says) — corrected throughout; `BoundingBox` is `{min,max}` — normalization math written against that.
