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
		});

		tool.activate(h.context);
		tool.pointerDown(at(812, 240));
		await flush();
		expect(h.dispatched).toHaveLength(0); // still waiting for the second point

		tool.pointerDown(at(812, 1040));
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
		});
		tool.activate(h.context);
		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(30, 40));
		await flush();
		expect(h.screenToWorld).not.toHaveBeenCalled();
	});

	it('cancel after the first click clears the pending point and dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
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
		});
		tool.activate(h.context);
		tool.pointerDown(at(812, 240));
		tool.pointerDown(at(812, 1040)); // the gesture is now parked at the prompt
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
		});
		tool.activate(h.context);
		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(10, 0));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('coincident clicks never reach the prompt or the dispatcher', async () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
		});
		tool.activate(h.context);
		tool.pointerDown(at(5, 5));
		tool.pointerDown(at(5, 5));
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
			});
			tool.activate(h.context);
			tool.pointerDown(at(0, 0));
			tool.pointerDown(at(10, 0));
			await flush();
			expect(h.dispatched).toHaveLength(0);
		}
	});

	it('events before activate() belong to no editor and dispatch nothing', async () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
		});
		tool.pointerDown(at(1, 1));
		tool.pointerDown(at(2, 2));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('pointerMove and pointerUp are part of the gesture surface and are inert', () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
		});
		tool.activate(h.context);
		expect(() => {
			tool.pointerMove(at(1, 2));
			tool.pointerUp(at(1, 2));
		}).not.toThrow();
		expect(h.dispatched).toHaveLength(0);
	});

	it('a secondary or auxiliary button places nothing and never starts a gesture', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
		});
		tool.activate(h.context);
		tool.pointerDown({ ...at(812, 240), button: 'secondary' });
		tool.pointerDown({ ...at(812, 1040), button: 'auxiliary' });
		await flush();
		// Not merely "did not dispatch": neither click may have become the pending FIRST
		// point either, or the next primary click would complete a gesture over a point the
		// user never placed with the button that places them.
		expect(h.supplierMeasurements).toEqual([]);
		expect(h.dispatched).toHaveLength(0);

		tool.pointerDown(at(812, 240));
		tool.pointerDown(at(812, 1040));
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
		});
		tool.activate(h.context);
		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(0, 800));
		await flush();

		// Two more clicks while the first gesture's prompt is still open. Without the
		// guard these become a second gesture, and the second answer dispatches a
		// calibration derived against a scale the first one has not landed yet.
		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(0, 1600));
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
		});
		tool.activate(h.context);
		tool.pointerDown(at(812, 240));
		tool.pointerDown(at(812, 1040));
		await flush();

		const gesture = h.dispatched[0];
		if (!gesture) throw new Error('nothing was dispatched');
		const result = await gesture.undo();
		if (!result.ok) throw new Error('expected ok');
		expect(h.undoCount).toBe(1);
	});
});
