import { describe, expect, it, vi } from 'vitest';
import { CalibrateTool } from '../../../../src/presentation/editor/tools/calibrate-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import { ok } from '../../../../src/core/result/Result';
import type {
	CalibratePlanInput,
	ReversibleCalibratePlanCommand,
} from '../../../../src/application/commands/plan/ReversibleCalibratePlan';
import type { PlanId } from '../../../../src/domain/plan/PlanId';

interface Harness {
	context: EditorContext;
	screenToWorld: ReturnType<typeof vi.fn>;
	dispatched: UndoableCommand[];
	inputs: CalibratePlanInput[];
	undoCount: number;
	supplierMeasurements: number[];
	supplyNextDistance: (distance: number | null) => void;
	supplyKnownDistance: (measuredWorldUnits: number) => Promise<number | null>;
	createCommand: () => ReversibleCalibratePlanCommand;
	hasSpatialObjects: () => boolean;
	confirmRecalibration: () => Promise<boolean>;
}

/**
 * An `EditorContext` double plus a scripted distance supplier. Each gesture's answer is
 * queued with `supplyNextDistance`, because the real prompt — the inspector UI that asks
 * for the known distance — is later-slice work that does not exist yet.
 */
const harness = (): Harness => {
	const dispatched: UndoableCommand[] = [];
	const inputs: CalibratePlanInput[] = [];
	const state = { undos: 0 };
	const measurements: number[] = [];
	const answers: (number | null)[] = [];

	const commandInstance = {
		execute: (input: CalibratePlanInput) => {
			inputs.push(input);
			return Promise.resolve(ok(undefined));
		},
		undo: () => {
			state.undos += 1;
			return Promise.resolve(ok(undefined));
		},
	} as unknown as ReversibleCalibratePlanCommand;

	const screenToWorld = vi.fn<(point: { x: number; y: number }) => { x: number; y: number }>(
		(point) => point,
	);
	const context: EditorContext = {
		viewport: {
			worldToScreen: (point) => point as never,
			screenToWorld: screenToWorld as never,
			setPan: () => undefined,
			setZoom: () => undefined,
		},
		selection: {} as never,
		snapService: {} as never,
		commandDispatcher: {
			run: (runnable: UndoableCommand) => {
				dispatched.push(runnable);
				return runnable.execute();
			},
		},
		writeLedger: {} as never,
		renderState: {} as never,
		activePlan: { id: 'plan-1' as PlanId, calibration: null },
	};

	return {
		context,
		screenToWorld,
		dispatched,
		inputs,
		get undoCount() {
			return state.undos;
		},
		get supplierMeasurements() {
			return measurements;
		},
		supplyNextDistance: (distance) => answers.push(distance),
		supplyKnownDistance(measuredWorldUnits: number): Promise<number | null> {
			measurements.push(measuredWorldUnits);
			return Promise.resolve(answers.shift() ?? null);
		},
		createCommand: () => commandInstance,
		// Permissive defaults: no existing case here is about the recalibration gate, so
		// neither asking nor declining should change what any of them were testing.
		hasSpatialObjects: () => false,
		confirmRecalibration: () => Promise.resolve(true),
	};
};

/** Hoisted so the placeholder is not a fresh closure per call (unicorn scoping). */
const noop = (): void => undefined;

const at = (x: number, y: number): EditorPointerEvent => ({
	worldPoint: { x, y },
	screenPoint: screenPoint(x, y),
	button: 'primary',
	modifiers: { shift: false, ctrl: false, alt: false },
	targetId: null,
});

/** One down+up pair — the grammar a real mouse click produces — for a call site that has
 * no reason to split the two, unlike the cases below that assert BETWEEN them. */
function click(tool: CalibrateTool, event: EditorPointerEvent): void {
	tool.pointerDown(event);
	tool.pointerUp(event);
}

/**
 * Drains the gesture's microtask chain — `complete()` crosses an awaited supplier and
 * the dispatcher before its dispatch lands, so a single `await Promise.resolve()` races
 * it instead of awaiting it. Counted rounds rather than one long chain so each round is
 * an explicit "let the next continuation run".
 */
async function flush(): Promise<void> {
	for (let round = 0; round < 8; round++) {
		await Promise.resolve();
	}
}

describe('CalibrateTool', () => {
	it('dispatches once after two clicks, with both worldPoints and the supplied distance', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});

		tool.activate(h.context);
		click(tool, at(812, 240));
		await flush();
		expect(h.dispatched).toHaveLength(0); // still waiting for the second point

		tool.pointerDown(at(812, 1040));
		await flush();
		// The gesture completes on pointerUp, not pointerDown — see `CalibrateTool.pointerUp`.
		// A dialog opened synchronously inside pointerdown's dispatch loses focus to the
		// browser's own mousedown-driven focus-to-<body> move, which runs AFTER the handler
		// returns; deferring the start of `complete()` to pointerup is the fix.
		expect(h.dispatched).toHaveLength(0);

		tool.pointerUp(at(812, 1040));
		await flush();

		expect(h.dispatched).toHaveLength(1);
		expect(h.inputs[0]).toEqual({
			planId: 'plan-1',
			pointA: { x: 812, y: 240 },
			pointB: { x: 812, y: 1040 },
			knownDistance: 3200,
		});
		expect(h.supplierMeasurements).toEqual([800]);
	});

	it('reads ONLY event.worldPoint — the conversion already happened upstream', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(0, 0));
		click(tool, at(30, 40));
		await flush();
		expect(h.screenToWorld).not.toHaveBeenCalled();
	});

	it('cancel after the first click clears the pending point and dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);

		tool.pointerDown(at(1, 1));
		tool.cancel();
		tool.pointerDown(at(2, 2));
		await flush();

		// The post-cancel click became a NEW first point, not the second half of a gesture.
		expect(h.dispatched).toHaveLength(0);
		expect(h.supplierMeasurements).toHaveLength(0);
	});

	it('deactivate before the prompt clears a pending FIRST point and dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		tool.pointerDown(at(1, 1));
		tool.deactivate();
		tool.activate(h.context);
		tool.pointerDown(at(2, 2));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('answering the distance prompt AFTER deactivate dispatches nothing', async () => {
		const h = harness();
		let answer!: (distance: number | null) => void;
		const gate = new Promise<number | null>((resolve) => {
			answer = resolve;
		});
		const tool = new CalibrateTool({
			supplyKnownDistance: () => gate,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(812, 240));
		click(tool, at(812, 1040)); // the gesture is now parked at the prompt
		tool.deactivate();
		answer(3200);
		await flush();
		await flush();

		// The gesture was abandoned mid-prompt; a late answer must not calibrate whatever
		// plan the editor has switched to in the meantime.
		expect(h.dispatched).toHaveLength(0);
		expect(h.inputs).toHaveLength(0);
	});

	it('a cancelled distance prompt dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(null);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(0, 0));
		click(tool, at(10, 0));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('coincident clicks never reach the prompt or the dispatcher', async () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(5, 5));
		click(tool, at(5, 5));
		await flush();
		expect(h.dispatched).toHaveLength(0);
		expect(h.supplierMeasurements).toHaveLength(0);
	});

	it('a non-positive or non-finite supplied distance dispatches nothing', async () => {
		for (const bad of [-4, Number.NaN]) {
			const h = harness();
			h.supplyNextDistance(bad);
			const tool = new CalibrateTool({
				supplyKnownDistance: h.supplyKnownDistance,
				createCommand: h.createCommand,
				hasSpatialObjects: h.hasSpatialObjects,
				confirmRecalibration: h.confirmRecalibration,
			});
			tool.activate(h.context);
			click(tool, at(0, 0));
			click(tool, at(10, 0));
			await flush();
			expect(h.dispatched).toHaveLength(0);
		}
	});

	it('events before activate() belong to no editor and dispatch nothing', async () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.pointerDown(at(1, 1));
		tool.pointerDown(at(2, 2));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('pointerMove and a pointerUp with no matching pointerDown are inert', () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		// No `pointerDown` precedes either call — the gesture no real mouse produces (a
		// release with no matching press), and the one this project has already recorded
		// once as a rig defect (CLAUDE.md, slice 8's e2e rig). `pointerUp` must not throw
		// and must not have anything buffered to complete.
		expect(() => {
			tool.pointerMove(at(1, 2));
			tool.pointerUp(at(1, 2));
		}).not.toThrow();
		expect(h.dispatched).toHaveLength(0);
	});

	it('a gesture cancelled between the completing pointerDown and its pointerUp dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(812, 240));
		// The second point's `pointerDown` buffers `pendingCompletion` — `complete()` has
		// not started yet, which is the whole point of deferring it to `pointerUp`.
		tool.pointerDown(at(812, 1040));
		// `cancel()` is what `ToolManager.cancelGesture()` calls on Escape, and what
		// `PlanCanvas.onPointerCancel` calls when the browser claims the gesture for
		// scrolling (`pointercancel`, no `pointerup` ever follows on a real device) — either
		// way it must clear the buffered completion before any `pointerUp` arrives for it.
		tool.cancel();
		// The `pointerUp` that WOULD have completed the gesture, had it not been cancelled —
		// on a real `pointercancel` this call never happens at all, but a `cancel()` reached
		// through Escape can still be followed by the original press's `pointerUp`, so the
		// guard must hold even then.
		tool.pointerUp(at(812, 1040));
		await flush();
		expect(h.dispatched).toHaveLength(0);
		expect(h.supplierMeasurements).toHaveLength(0);
	});

	it('a secondary or auxiliary button places nothing and never starts a gesture', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		tool.pointerDown({ ...at(812, 240), button: 'secondary' });
		await flush();
		// Not merely "did not dispatch": neither click may have become the pending FIRST
		// point either, or the next primary click would complete a gesture over a point the
		// user never placed with the button that places them.
		expect(h.supplierMeasurements).toEqual([]);
		expect(h.dispatched).toHaveLength(0);

		click(tool, at(812, 240));
		// The completing pointerDown, buffered — then a stray secondary/auxiliary release
		// (a mouse shares one pointerId across its buttons) must not consume it early; only
		// the matching primary release below may.
		tool.pointerDown(at(812, 1040));
		tool.pointerUp({ ...at(812, 1040), button: 'auxiliary' });
		await flush();
		expect(h.dispatched).toHaveLength(0);

		tool.pointerUp(at(812, 1040));
		await flush();
		expect(h.inputs).toEqual([
			{ planId: 'plan-1', pointA: { x: 812, y: 240 }, pointB: { x: 812, y: 1040 }, knownDistance: 3200 },
		]);
	});

	it('clicks during an outstanding prompt start no second gesture', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		h.supplyNextDistance(6400);
		let release: () => void = noop;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const asked: number[] = [];
		const tool = new CalibrateTool({
			// Records the ask BEFORE blocking, so "was a second prompt opened?" is answerable
			// while the first one is still outstanding — which is the whole question here.
			supplyKnownDistance: async (measured) => {
				asked.push(measured);
				await held;
				return h.supplyKnownDistance(measured);
			},
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(0, 0));
		click(tool, at(0, 800));
		await flush();

		// Two more clicks while the first gesture's prompt is still open. Without the
		// guard these become a second gesture, and the second answer dispatches a
		// calibration derived against a scale the first one has not landed yet.
		click(tool, at(0, 0));
		click(tool, at(0, 1600));
		await flush();
		expect(asked).toEqual([800]);

		release();
		await flush();
		expect(h.inputs).toEqual([
			{ planId: 'plan-1', pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 800 }, knownDistance: 3200 },
		]);
	});

	it('the dispatched history entry undoes through the same command instance', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
		});
		tool.activate(h.context);
		click(tool, at(812, 240));
		click(tool, at(812, 1040));
		await flush();

		const gesture = h.dispatched[0];
		if (!gesture) throw new Error('nothing was dispatched');
		const result = await gesture.undo();
		if (!result.ok) throw new Error('expected ok');
		expect(h.undoCount).toBe(1);
	});
});

/**
 * Builds a `CalibrateTool` over `harness()`'s permissive defaults, overridden per test —
 * and hands back `dispatched` plus a count of how many times the distance prompt was
 * reached, since a stale gesture must not merely fail to dispatch: it must not ask the
 * user anything either, and `dispatched` alone cannot tell those apart.
 */
function makeTool(overrides: Pick<Harness, 'hasSpatialObjects' | 'confirmRecalibration'>): {
	tool: CalibrateTool;
	dispatched: UndoableCommand[];
	distancePrompts: () => number;
} {
	const h = harness();
	h.supplyNextDistance(3200);
	let distancePromptCount = 0;
	const tool = new CalibrateTool({
		supplyKnownDistance: (measuredWorldUnits) => {
			distancePromptCount += 1;
			return h.supplyKnownDistance(measuredWorldUnits);
		},
		createCommand: h.createCommand,
		hasSpatialObjects: overrides.hasSpatialObjects,
		confirmRecalibration: overrides.confirmRecalibration,
	});
	tool.activate(h.context);
	return { tool, dispatched: h.dispatched, distancePrompts: () => distancePromptCount };
}

/**
 * Drives one full two-click gesture and drains its microtask chain (see `flush`). Each
 * click is down+up on the SAME point, matching the grammar a real mouse produces — a bare
 * `pointerDown` with no matching `pointerUp` is a sequence no mouse can produce, and CLAUDE.md
 * records that exact shape certifying a broken Escape path in slice 8's rig.
 */
async function calibrate(tool: CalibrateTool): Promise<void> {
	click(tool, at(812, 240));
	click(tool, at(812, 1040));
	await flush();
}

describe('the recalibration gate', () => {
	/**
	 * The trigger is whether objects will be RESCALED, not whether this is the first
	 * calibration — a freshly imported plan with nothing drawn on it has nothing to lose,
	 * and asking there is the "are you sure" that trains people to click through the ones
	 * that matter.
	 */
	it('asks nothing on a plan with no geometry', async () => {
		let asked = 0;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => false,
			confirmRecalibration: () => {
				asked += 1;
				return Promise.resolve(true);
			},
		});

		await calibrate(tool);

		expect(asked).toBe(0);
		expect(dispatched).toHaveLength(1);
	});

	it('asks before rescaling a plan that has geometry', async () => {
		let asked = 0;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () => {
				asked += 1;
				return Promise.resolve(true);
			},
		});

		await calibrate(tool);

		expect(asked).toBe(1);
		expect(dispatched).toHaveLength(1);
	});

	it('dispatches nothing when the user declines', async () => {
		const { tool, dispatched, distancePrompts } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () => Promise.resolve(false),
		});

		await calibrate(tool);

		expect(dispatched).toEqual([]);
		// The ordering claim itself: a user about to decline is never made to answer the
		// distance prompt first. `dispatched` alone cannot tell "asked, then declined,
		// then would-have-prompted-but-didn't" apart from "prompted anyway and only the
		// dispatch was blocked" — this is the one assertion that does.
		expect(distancePrompts()).toBe(0);
	});

	/**
	 * The generation rule, applied to the SECOND await this method now has. Without the
	 * re-check, an Escape while the confirmation sat open let a late `true` calibrate a
	 * plan the user had cancelled out of — the exact defect slice 7's counter exists for,
	 * reintroduced by adding an await above it.
	 */
	it('drops a confirmation that resolves after the gesture was cancelled', async () => {
		let release: ((confirmed: boolean) => void) | null = null;
		const { tool, dispatched, distancePrompts } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () =>
				new Promise<boolean>((resolve) => {
					release = resolve;
				}),
		});

		const gesture = calibrate(tool);
		await Promise.resolve();
		tool.cancel();
		release?.(true);
		await gesture;

		expect(dispatched).toEqual([]);
		// Not merely "did not dispatch": a stale gesture that reaches the distance prompt
		// still asked the user something about points and a plan they no longer control —
		// the trailing generation check catches the dispatch either way, so ONLY this
		// assertion is what actually exercises the re-check right after the confirmation.
		expect(distancePrompts()).toBe(0);
	});
});
