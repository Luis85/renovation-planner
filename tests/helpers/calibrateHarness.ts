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
import {
	CalibrateTool,
	type CalibrationMeasurement,
} from '../../src/presentation/editor/tools/calibrate-tool';
import type { EditorContext } from '../../src/presentation/editor/tools/editor-context';
import type { EditorPointerEvent } from '../../src/presentation/editor/tools/editor-tool';
import type { UndoableCommand } from '../../src/presentation/editor/tools/undoable-command';
import { screenPoint } from '../../src/presentation/editor/viewport/Viewport';
import { harnessSnapService } from './tool-context';
import { err, ok } from '../../src/core/result/Result';
import type { AppError } from '../../src/core/errors/AppError';
import type { CalibratePlanInput } from '../../src/application/commands/plan/ReversibleCalibratePlan';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { RenderState } from '../../src/presentation/editor/tools/render-state';

export interface Harness {
	context: EditorContext;
	/**
	 * The plan this harness's gestures calibrate, branded. It no longer reaches the tool at all
	 * — design slice B6 made `CalibrateTool` subject-agnostic, so `createCommand` below closes
	 * over this id exactly as `presentation/editor/runtime.ts` closes over the leaf's own. Held
	 * here so the three files that build a tool directly cannot each invent their own, and so
	 * `inputs` can go on recording the whole command input.
	 */
	planId: PlanId;
	screenToWorld: ReturnType<typeof vi.fn>;
	dispatched: UndoableCommand[];
	inputs: CalibratePlanInput[];
	undoCount: number;
	supplierMeasurements: number[];
	supplyNextDistance: (distance: number | null) => void;
	supplyKnownDistance: (measuredWorldUnits: number) => Promise<number | null>;
	createCommand: (measurement: CalibrationMeasurement) => UndoableCommand;
	hasGeometryToRescale: () => boolean;
	confirmRecalibration: () => Promise<boolean>;
	/**
	 * Every error EITHER report door was called with, in call order.
	 *
	 * One list across both doors on purpose: design slice 17 split `reportRejected` (a
	 * dispatched command refused) from `reportInvalidInput` (this tool refused before building
	 * one), and every case here asks "was the user told", which is true through either. A case
	 * that cares WHICH door reads `invalidInput` below.
	 */
	rejected: AppError[];
	/** The subset that came through `reportInvalidInput` — refusals no dispatcher ever saw. */
	invalidInput: AppError[];
	reportRejected: (error: AppError) => void;
	reportInvalidInput: (error: AppError) => void;
	/** Makes the NEXT dispatched command's `execute()` resolve this refusal instead of `ok`. */
	failNextExecute: (error: AppError) => void;
}

/**
 * An `EditorContext` double plus a scripted distance supplier. Each gesture's answer is
 * queued with `supplyNextDistance`, because the real prompt — the inspector UI that asks
 * for the known distance — is later-slice work that does not exist yet.
 */
const PLAN_ID = 'plan-1' as PlanId;

export const harness = (): Harness => {
	const dispatched: UndoableCommand[] = [];
	const inputs: CalibratePlanInput[] = [];
	const state = { undos: 0 };
	const measurements: number[] = [];
	const answers: (number | null)[] = [];
	const rejected: AppError[] = [];
	const invalidInput: AppError[] = [];
	/** Set by `failNextExecute`; consumed (and cleared) by the next `execute()` call. */
	let nextExecuteFailure: AppError | null = null;

	/**
	 * The gesture the tool dispatches, built the way `presentation/editor/runtime.ts` builds it:
	 * the PLAN is closed over here and the tool supplies only the measurement, which is what
	 * makes `CalibrateTool` serve an asset as well since design slice B6. `inputs` therefore
	 * records the whole `CalibratePlanInput` — the branded id included — so the cases that
	 * assert what the command was asked to do go on asserting exactly that.
	 *
	 * A FRESH object per call rather than one shared instance, because that is what
	 * `createCommand`'s contract says ("per gesture — the reversible command holds that one
	 * transaction's inverse state") and a shared one made two gestures indistinguishable in
	 * `dispatched`.
	 */
	const createCommand = (measurement: CalibrationMeasurement): UndoableCommand => ({
		execute: () => {
			const input: CalibratePlanInput = { planId: PLAN_ID, ...measurement };
			inputs.push(input);
			const failure = nextExecuteFailure;
			nextExecuteFailure = null;
			return Promise.resolve(failure === null ? ok('wrote') : err(failure));
		},
		undo: () => {
			state.undos += 1;
			return Promise.resolve(ok('wrote'));
		},
	});

	const screenToWorld = vi.fn<(point: { x: number; y: number }) => { x: number; y: number }>(
		(point) => point,
	);
	const context: EditorContext = {
		viewport: {
			worldToScreen: (point) => point as never,
			screenToWorld: screenToWorld as never,
			// One world millimetre per screen pixel, matching this harness's identity
			// projection above — a camera whose scale disagreed with its own transform would
			// be the harsher half of the too-thin rule rather than a fix for it.
			//
			// ABSENT until `tests/**` was type-checked, and `tool-context.ts`'s header — one
			// file over — already names this exact member as the one whose omission leaves a
			// suite exercising the old shape with nothing to say so. It was fixed there and
			// not here, which is this repository's oldest recurring shape: a rule stated in a
			// docblock is a rule some door is not following.
			worldPerScreenPixel: () => 1,
			setPan: () => undefined,
			setZoom: () => undefined,
		},
		selection: {} as never,
		// The REAL service, composed as the editor composes it. It stood here as `{} as never`
		// until this tool started offering the Shift angle constraint, at which point an empty
		// object would have thrown on the first constrained move — the same too-thin-fake shape
		// this repository has now recorded half a dozen times. Shared with `tool-context.ts`
		// rather than built again, so both harnesses snap by the same rules the app does.
		snapService: harnessSnapService(),
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
		subject: { id: PLAN_ID, calibration: null },
	};

	return {
		context,
		planId: PLAN_ID,
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
		createCommand,
		rejected,
		reportRejected: (error) => rejected.push(error),
		invalidInput,
		reportInvalidInput: (error) => {
			rejected.push(error);
			invalidInput.push(error);
		},
		failNextExecute: (error) => {
			nextExecuteFailure = error;
		},
		// Permissive defaults: no existing case here is about the recalibration gate, so
		// neither asking nor declining should change what any of them were testing.
		hasGeometryToRescale: () => false,
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

/** The same event with Shift held — the angle constraint the tool offers on its second point. */
export const shiftAt = (x: number, y: number): EditorPointerEvent => ({
	...at(x, y),
	modifiers: { shift: true, ctrl: false, alt: false },
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
		hasGeometryToRescale: h.hasGeometryToRescale,
		confirmRecalibration: h.confirmRecalibration,
		reportRejected: h.reportRejected,
		reportInvalidInput: h.reportInvalidInput,
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
