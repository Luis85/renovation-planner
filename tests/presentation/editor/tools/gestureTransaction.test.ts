import { describe, expect, it, vi } from 'vitest';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { ok } from '../../../../src/core/result/Result';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { ReversibleMoveZoneCommand } from '../../../../src/presentation/editor/tools/reversible-move-zone-command';
import { expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makeZone, squareAt } from '../../../helpers/entities';
import { SnapService } from '../../../../src/presentation/editor/snapping/snap-service';
import { RenderState } from '../../../../src/presentation/editor/tools/render-state';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import { screenPoint, type Point, type ScreenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import {
	createEditorContext,
	type EditorContext,
	type EditorContextDeps,
} from '../../../../src/presentation/editor/tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../../../../src/presentation/editor/tools/editor-tool';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import type { SelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { mapDispatchFaults } from '../../../../src/presentation/editor/report-failure';
import { recorder } from '../../../helpers/logger';

/**
 * The transaction-boundary rule (`docs/tasks/06-editor-tool-framework-undo-redo-and-
 * inspector.md`, "Transaction boundary"), asserted end to end through `ToolManager` +
 * a test-double `EditorTool` + a real `CommandHistory`, rather than at any one piece in
 * isolation:
 *
 *   pointerDown  → capture "before" state (no command, no history entry)
 *   pointerMove* → update renderState only — never dispatch
 *   pointerUp    → build ONE UndoableCommand from before/after state
 *                → CommandHistory.run(command) → one execute() → one persistence write
 *
 * Four things this file checks, each traceable to a Definition-of-Done item in that spec:
 *
 * 1. (DoD 2) `pointerDown` → 25×`pointerMove` → `pointerUp` produces exactly one
 *    `CommandHistory.run()`, one wrapped-command `execute()`, **one persistence write**,
 *    and zero of each during the moves — checked BEFORE `pointerUp`, not only at the end,
 *    since a count read only after the whole gesture completes cannot tell "one dispatch at
 *    pointerUp" apart from "one dispatch during move 12 and none at pointerUp".
 *
 *    The write half is why that one test does not use a fake command like the three below
 *    it. DoD 2 names three things — one execution, one history entry, and "(through slice
 *    4's handler) one persistence write" — and a fake `UndoableCommand` can only ever
 *    demonstrate the first two: it writes nothing, so a design that wrote once per
 *    `pointerMove` would pass it. So that test wires the real chain a gesture actually ends
 *    in — `ReversibleMoveZoneCommand` over `MoveSpatialObjectCommand` over a real
 *    `InMemoryZoneRepository` — and counts `zones.save`. `reversibleMoveZoneCommand.test.ts`
 *    drives that same chain against a real repository too, but never through a gesture, so
 *    the seam between the two was the one thing this slice's headline claim rested on and
 *    nothing asserted.
 * 2. The Escape path: `cancelGesture()` mid-gesture produces zero dispatches and resets
 *    `renderState`. The test-double tool dirties all FOUR `RenderState` fields during the
 *    gesture (`hoveredObjectId`, `previewPolygon`, `marquee`, `snapGuides`), not just one,
 *    so `reset()` clearing each of them is actually observable — an assertion that a field
 *    is empty is worthless if the double never dirtied it in the first place, since it
 *    would then pass whether or not `cancel()` ran at all. **Honesty note**: the
 *    test-double tool below is what calls `context.renderState.reset()` from its
 *    `cancel()`. This proves `ToolManager` routes `cancelGesture()` to the active tool's
 *    `cancel()`, and that a tool *can* clear render state on cancellation — it does NOT
 *    prove any real tool does, because no concrete `EditorTool` exists yet (that is
 *    slices 7 and 8's job). Read the assertion no wider than that.
 * 3. (DoD 3) A new `run()` dispatched through a second gesture, after `undo()`, clears the
 *    redo stack — driven through the same gesture path as 1 and 2, not `CommandHistory`
 *    directly.
 * 4. (DoD 4) Two gestures dispatched back-to-back, without awaiting the first, land on
 *    `undoStack` in DISPATCH order even though the second command would resolve first if
 *    the two ran independently. `tests/presentation/editor/tools/commandHistory.test.ts`
 *    ("serializes: two commands dispatched without awaiting the first…") already asserts
 *    this exact guarantee, but at `CommandHistory` directly. This test adds the
 *    INTEGRATION-level statement instead of repeating that unit-level one: the same
 *    ordering guarantee survives being reached through `ToolManager`, a tool, and
 *    `EditorContext.commandDispatcher`.
 *
 *    Both use a manually-resolved deferred promise rather than a timer, so neither has a
 *    wall clock to be slow against. That was this file's technique first: the unit-level
 *    test used a real 30ms/0ms cascade with a `delay(10)` checkpoint inside it, which a
 *    reviewer flagged as a flakiness surface on a slower CI runner (Windows is one of the
 *    four legs), and it was ported to this one afterwards.
 *
 * Production code: none of this required touching `src/`. Everything the test-double
 * tool needs — building a command only at `pointerUp`, writing only to `renderState`
 * during moves, calling `context.commandDispatcher.run` — is already expressible through
 * the existing `EditorTool`/`EditorContext`/`CommandHistory` surface.
 */

function pointerEvent(): EditorPointerEvent {
	return {
		worldPoint: { x: 1, y: 2 },
		screenPoint: screenPoint(3, 4),
		button: 'primary',
		modifiers: { shift: false, ctrl: false, alt: false },
		targetId: null,
	};
}

function stubSelection(): SelectionStore {
	return {
		selectedIds: [],
		select: () => undefined,
		clear: () => undefined,
		isSelected: () => false,
	};
}

function stubViewport(): EditorContext['viewport'] {
	return {
		worldToScreen: (p: Point): ScreenPoint => screenPoint(p.x, p.y),
		screenToWorld: (p: ScreenPoint): Point => ({ x: p.x, y: p.y }),
		// One world unit per screen pixel, matching the identity projection above. The third and
		// fourth stub viewport to omit this member — the one `tool-context.ts`'s header names as
		// exactly the omission that leaves a suite exercising the old shape with nothing to say so.
		worldPerScreenPixel: () => 1,
		setPan: () => undefined,
		setZoom: () => undefined,
	};
}

/**
 * Builds a real `EditorContext` whose `commandDispatcher` forwards straight to `history`
 * — the one dep that matters for this file, since every assertion here is really about
 * what reaches (or does not reach) that `CommandHistory` instance.
 */
function buildContext(history: CommandHistory): {
	context: EditorContext;
	renderState: RenderState;
	writeLedger: SessionWriteLedger;
} {
	const renderState = new RenderState();
	const writeLedger = new SessionWriteLedger();
	const deps: EditorContextDeps = {
		bindViewport: stubViewport,
		selection: stubSelection(),
		snapService: new SnapService({ gridSpacingMm: 100, toleranceMm: 10, angleStepRadians: Math.PI / 2 }),
		// Through `mapDispatchFaults`, which `EditorContextDeps` requires: the brand is what
		// makes "a tool's dispatch door cannot reject" a compile-time fact rather than a rule
		// each surface remembers. It forwards straight to `history.run` on every path this file
		// drives, so what these cases observe is unchanged.
		commandDispatcher: mapDispatchFaults(
			{ run: (command: UndoableCommand): Promise<DispatchResult> => history.run(command) },
			recorder,
			'test.dispatch.faulted',
		),
		writeLedger,
		renderState,
		subject: { id: createPlanId(), calibration: null },
	};
	return { context: createEditorContext(deps), renderState, writeLedger };
}

/**
 * A real zone in a real repository, at the origin. Returned alongside the repository and
 * the move command so a gesture can end in a genuine persistence write rather than in a
 * fake that records a call and writes nothing.
 */
function seededZone() {
	const zones = new InMemoryZoneRepository();
	const zone = makeZone({
		projectId: 'project-gesture' as ProjectId,
		planId: 'plan-gesture' as PlanId,
		geometry: squareAt(0, 0),
	});
	return { zones, zone, move: new MoveSpatialObjectCommand(zones, new RecordingEventBus()) };
}

let cmdSeq = 0;
/** A fake `UndoableCommand` whose `execute()` behaviour the test controls, and whose
 * `id` lets a test read `undoStack` order back the same way `commandHistory.test.ts` does. */
function fakeCommand(execute: () => Promise<DispatchResult>): UndoableCommand & { id: number } {
	const id = ++cmdSeq;
	return {
		id,
		execute: vi.fn<() => Promise<DispatchResult>>(execute),
		undo: vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(ok('wrote'))),
	};
}

/**
 * A test-double `EditorTool` that follows the transaction-boundary rule literally:
 * `pointerDown` captures nothing dispatchable, `pointerMove` only ever writes to
 * `context.renderState`, and `pointerUp` builds exactly one command (from the factory a
 * test supplies, so each gesture can use a different fake) and dispatches it through
 * `context.commandDispatcher.run`. That call is never awaited inline — a real tool
 * wouldn't await it either — so the returned promise is stashed on `pendingRun` purely so
 * a test can synchronize with it; a real tool built in a later slice has no reason to
 * expose this.
 *
 * `pointerDown`/`pointerMove` dirty all four `RenderState` fields — `hoveredObjectId` on
 * `pointerDown`, as a tool tracking what is under the cursor would; `previewPolygon`,
 * `marquee` and `snapGuides` on each `pointerMove`, as a tool accumulating a preview shape,
 * a marquee rectangle and snap guides would — so `cancel()`'s `context.renderState.reset()`
 * (see file header note 2 above) has something real to clear in every field, not just one.
 */
function fakeGestureTool(
	context: EditorContext,
	buildCommand: () => UndoableCommand,
): EditorTool & { pendingRun: Promise<DispatchResult> | null; moveCount: number } {
	const tool = {
		id: 'select' as const,
		pendingRun: null as Promise<DispatchResult> | null,
		moveCount: 0,
		activate: (): void => undefined,
		deactivate: (): void => undefined,
		pointerDown: (event: EditorPointerEvent): void => {
			// Capture "before" state here in a real tool; nothing to dispatch yet. Also
			// record what is under the cursor, as a real tool would.
			context.renderState.hoveredObjectId = event.targetId ?? 'fake-hover-target';
		},
		pointerMove: (event: EditorPointerEvent): void => {
			tool.moveCount += 1;
			context.renderState.previewPolygon = [event.worldPoint];
			context.renderState.marquee = { min: event.worldPoint, max: event.worldPoint };
			context.renderState.snapGuides = [{ start: event.worldPoint, end: event.worldPoint }];
		},
		pointerUp: (): void => {
			tool.pendingRun = context.commandDispatcher.run(buildCommand());
		},
		cancel: (): void => {
			context.renderState.reset();
		},
		// Required since interruptions were split from deliberate cancels: `cancel()` is Escape
		// or a tool switch and throws the accumulation away, `abandonGesture()` is the OS taking
		// the pointer and must abandon only what the missing release would have completed. This
		// fake has one gesture and no buffer, so the two coincide.
		abandonGesture: (): void => {
			context.renderState.reset();
		},
		// Not exercised by this file's cases — they drive the dispatch pipeline, not Escape —
		// so the fake states the one honest default: nothing here accumulates across calls that
		// `cancel()` doesn't already clear.
		hasDraft: (): boolean => false,
	};
	return tool;
}

describe('gesture -> command transaction (design slice 6)', () => {
	it('DoD 2: pointerDown -> 25x pointerMove -> pointerUp dispatches exactly one command and writes exactly once', async () => {
		const history = new CommandHistory();
		const runSpy = vi.spyOn(history, 'run');
		const { context, writeLedger } = buildContext(history);
		const { zones, zone, move } = seededZone();
		// The seed is not the gesture's write, so it happens before the spy exists rather
		// than being subtracted from the count afterwards.
		expectOk(await zones.save(zone, 'absent'));
		const saveSpy = vi.spyOn(zones, 'save');
		// The real chain a gesture ends in: the reversible adapter this slice added, over
		// slice 3's move command, over a real repository (file header, item 1).
		const command = new ReversibleMoveZoneCommand(move, writeLedger, zone.id, squareAt(10, 10), squareAt(0, 0));
		const executeSpy = vi.spyOn(command, 'execute');
		const tool = fakeGestureTool(context, () => command);
		const manager = new ToolManager(() => context);
		manager.register(tool);
		manager.setActiveTool('select');

		manager.pointerDown(pointerEvent());
		for (let i = 0; i < 25; i++) {
			manager.pointerMove(pointerEvent());
		}

		// The zero-checks belong HERE, before pointerUp: read only after the gesture ends,
		// they could not distinguish "one dispatch at pointerUp" from "one dispatch during a
		// move and none at pointerUp" (see file header, item 1). The write is the one that
		// matters most — a tool dispatching per `pointerMove` would already have written 25
		// times by now.
		expect(runSpy).not.toHaveBeenCalled();
		expect(executeSpy).not.toHaveBeenCalled();
		expect(saveSpy).not.toHaveBeenCalled();
		expect(tool.moveCount).toBe(25);

		manager.pointerUp(pointerEvent());
		await tool.pendingRun;

		expect(runSpy).toHaveBeenCalledTimes(1);
		expect(executeSpy).toHaveBeenCalledTimes(1);
		expect(saveSpy).toHaveBeenCalledTimes(1);
		expect(history.canUndo).toBe(true);
		// And the one write actually landed the gesture's geometry, so "one write" is not
		// satisfied by one write of the wrong thing.
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(10, 10));
	});

	it('the Escape path: cancelGesture() mid-gesture dispatches nothing and resets renderState', () => {
		const history = new CommandHistory();
		const runSpy = vi.spyOn(history, 'run');
		const { context, renderState } = buildContext(history);
		const command = fakeCommand(() => Promise.resolve(ok('wrote')));
		const tool = fakeGestureTool(context, () => command);
		const manager = new ToolManager(() => context);
		manager.register(tool);
		manager.setActiveTool('select');

		manager.pointerDown(pointerEvent());
		manager.pointerMove(pointerEvent());
		// All four fields dirtied — otherwise the corresponding post-cancel assertion below
		// would pass whether or not cancel() ran at all.
		expect(renderState.hoveredObjectId).not.toBeNull();
		expect(renderState.previewPolygon).not.toBeNull();
		expect(renderState.marquee).not.toBeNull();
		expect(renderState.snapGuides).not.toEqual([]);

		manager.cancelGesture();

		expect(runSpy).not.toHaveBeenCalled();
		expect(command.execute).not.toHaveBeenCalled();
		expect(tool.pendingRun).toBeNull();
		expect(renderState.hoveredObjectId).toBeNull();
		expect(renderState.previewPolygon).toBeNull();
		expect(renderState.marquee).toBeNull();
		expect(renderState.snapGuides).toEqual([]);
	});

	it('DoD 3: a new run() after undo() clears the redo stack', async () => {
		const history = new CommandHistory();
		const { context } = buildContext(history);
		const manager = new ToolManager(() => context);
		let nextCommand: UndoableCommand = fakeCommand(() => Promise.resolve(ok('wrote')));
		const tool = fakeGestureTool(context, () => nextCommand);
		manager.register(tool);
		manager.setActiveTool('select');

		manager.pointerDown(pointerEvent());
		manager.pointerUp(pointerEvent());
		await tool.pendingRun;
		await history.undo();
		expect(history.canRedo).toBe(true);

		nextCommand = fakeCommand(() => Promise.resolve(ok('wrote')));
		manager.pointerDown(pointerEvent());
		manager.pointerUp(pointerEvent());
		await tool.pendingRun;

		expect(history.canRedo).toBe(false);
		expect(history.canUndo).toBe(true);
	});

	it('DoD 4: two gestures dispatched back-to-back land on undoStack in dispatch order, not completion order', async () => {
		// See file header, item 4: this is the integration-level counterpart of
		// commandHistory.test.ts's own "serializes: two commands dispatched without
		// awaiting the first…" — same guarantee, reached through ToolManager + a tool +
		// EditorContext.commandDispatcher rather than CommandHistory directly, and using a
		// manually-resolved deferred instead of a wall-clock delay.
		const history = new CommandHistory();
		const { context } = buildContext(history);
		const manager = new ToolManager(() => context);

		// command1's cascade resolves only when this test chooses to (deliberately the
		// "slow" one); command2's resolves the instant it is invoked (deliberately the
		// "fast" one) — so completion order would disagree with dispatch order here if
		// CommandHistory did not serialize run() calls against one another.
		let resolveFirst!: (result: DispatchResult) => void;
		const firstCascade = new Promise<DispatchResult>((resolve) => {
			resolveFirst = resolve;
		});
		const command1 = fakeCommand(() => firstCascade);
		const command2 = fakeCommand(() => Promise.resolve(ok('wrote')));
		let nextCommand: UndoableCommand = command1;
		const tool = fakeGestureTool(context, () => nextCommand);
		manager.register(tool);
		manager.setActiveTool('select');

		manager.pointerDown(pointerEvent());
		manager.pointerUp(pointerEvent()); // dispatches command1; its run() is now pending
		const firstRun = tool.pendingRun;

		nextCommand = command2;
		manager.pointerDown(pointerEvent());
		manager.pointerUp(pointerEvent()); // dispatches command2 without awaiting command1
		const secondRun = tool.pendingRun;

		// Flush the microtask queue so command1's queued run() actually starts (its own
		// `execute()` call happens synchronously inside CommandHistory's queued operation,
		// which only runs on a microtask tick, not inline with `pointerUp`) — no wall clock
		// involved, just letting the promise machinery already in flight take its turn.
		await Promise.resolve();

		// The checkpoint: command2's execute() must not have begun yet, since command1's
		// run() has not resolved — CommandHistory's serialization queue holds command2's
		// operation behind command1's until command1's `runNow` settles. No timer needed —
		// command1's promise is unresolved by construction, not by a race against a clock.
		expect(command1.execute).toHaveBeenCalledTimes(1);
		expect(command2.execute).not.toHaveBeenCalled();

		resolveFirst(ok('wrote'));
		await firstRun;
		await secondRun;

		expect(command2.execute).toHaveBeenCalledTimes(1);
		const undoOrder = (history as never as { undoStack: { id: number }[] }).undoStack;
		expect(undoOrder.map((c) => c.id)).toEqual([command1.id, command2.id]);
	});
});
