/**
 * The `CalibrateTool` unit harness, extracted so more than one spec file can drive the tool
 * without a second, drifting copy of it. It moved here when
 * `tests/presentation/editor/tools/calibrateTool.test.ts` crossed the 450-line `max-lines`
 * budget: the canvas-segment cases are a separable concern, and splitting the FILE while
 * duplicating the harness would have traded a lint error for the very thing the budget
 * exists to prevent. `tool-context.ts` beside this is the same idea for the generic
 * `EditorContext`; this one is specific to the tool's five dependencies.
 */
import { vi } from 'vitest';
import { CalibrateTool } from '../../src/presentation/editor/tools/calibrate-tool';
import type { EditorContext } from '../../src/presentation/editor/tools/editor-context';
import type { EditorPointerEvent } from '../../src/presentation/editor/tools/editor-tool';
import type { UndoableCommand } from '../../src/presentation/editor/tools/undoable-command';
import { screenPoint } from '../../src/presentation/editor/viewport/Viewport';
import { err, ok } from '../../src/core/result/Result';
import type { AppError } from '../../src/core/errors/AppError';
import type {
	CalibratePlanInput,
	ReversibleCalibratePlanCommand,
} from '../../src/application/commands/plan/ReversibleCalibratePlan';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { RenderState } from '../../src/presentation/editor/tools/render-state';

export interface Harness {
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
	/** Every error `reportRejected` was called with, in call order. */
	rejected: AppError[];
	reportRejected: (error: AppError) => void;
	/** Makes the NEXT dispatched command's `execute()` resolve this refusal instead of `ok`. */
	failNextExecute: (error: AppError) => void;
}

/**
 * An `EditorContext` double plus a scripted distance supplier. Each gesture's answer is
 * queued with `supplyNextDistance`, because the real prompt — the inspector UI that asks
 * for the known distance — is later-slice work that does not exist yet.
 */
export const harness = (): Harness => {
	const dispatched: UndoableCommand[] = [];
	const inputs: CalibratePlanInput[] = [];
	const state = { undos: 0 };
	const measurements: number[] = [];
	const answers: (number | null)[] = [];
	const rejected: AppError[] = [];
	/** Set by `failNextExecute`; consumed (and cleared) by the next `execute()` call. */
	let nextExecuteFailure: AppError | null = null;

	const commandInstance = {
		execute: (input: CalibratePlanInput) => {
			inputs.push(input);
			const failure = nextExecuteFailure;
			nextExecuteFailure = null;
			return Promise.resolve(failure === null ? ok(undefined) : err(failure));
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
		// A REAL `RenderState`, not `{} as never`: the calibration segment is a field on it
		// with a `null` default, and a bare object would make "nothing is drawn" read as
		// `undefined` — a fake thinner than the thing it stands in for. `tool-context.ts`, the
		// shared helper, already builds one.
		renderState: new RenderState(),
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
		rejected,
		reportRejected: (error) => rejected.push(error),
		failNextExecute: (error) => {
			nextExecuteFailure = error;
		},
		// Permissive defaults: no existing case here is about the recalibration gate, so
		// neither asking nor declining should change what any of them were testing.
		hasSpatialObjects: () => false,
		confirmRecalibration: () => Promise.resolve(true),
	};
};

/** Hoisted so the placeholder is not a fresh closure per call (unicorn scoping). */
export const noop = (): void => undefined;

export const at = (x: number, y: number): EditorPointerEvent => ({
	worldPoint: { x, y },
	screenPoint: screenPoint(x, y),
	button: 'primary',
	modifiers: { shift: false, ctrl: false, alt: false },
	targetId: null,
});

/** One down+up pair — the grammar a real mouse click produces — for a call site that has
 * no reason to split the two, unlike the cases below that assert BETWEEN them. */
export function click(tool: CalibrateTool, event: EditorPointerEvent): void {
	tool.pointerDown(event);
	tool.pointerUp(event);
}

/**
 * Builds a `CalibrateTool` from `h`'s deps and activates it — the construction boilerplate
 * every case below needs, with `supplyKnownDistance` overridable for the few that script
 * their own answer instead of `harness()`'s queue. The one case that must NOT activate
 * ("events before activate() belong to no editor…") builds its own tool directly instead.
 */
export function newTool(h: Harness, supplyKnownDistance = h.supplyKnownDistance): CalibrateTool {
	const tool = new CalibrateTool({
		supplyKnownDistance,
		createCommand: h.createCommand,
		hasSpatialObjects: h.hasSpatialObjects,
		confirmRecalibration: h.confirmRecalibration,
		reportRejected: h.reportRejected,
	});
	tool.activate(h.context);
	return tool;
}

/**
 * Drains the gesture's microtask chain — `complete()` crosses an awaited supplier and
 * the dispatcher before its dispatch lands, so a single `await Promise.resolve()` races
 * it instead of awaiting it. Counted rounds rather than one long chain so each round is
 * an explicit "let the next continuation run".
 */
export async function flush(): Promise<void> {
	for (let round = 0; round < 8; round++) {
		await Promise.resolve();
	}
}
