/**
 * The `DrawPolygonTool` unit harness, extracted so more than one spec file can drive the tool
 * without a second, drifting copy of it — the same move `calibrateHarness.ts` beside this made
 * for `CalibrateTool`, and for the same reason: `drawPolygonTool.test.ts` crossed the 450-line
 * `max-lines` budget when design slice B2 gave the tool an injected `PolygonCompletion`, and
 * splitting the FILE while duplicating the harness would trade a lint error for the very thing
 * the budget exists to prevent. `tool-context.ts` is the generic `EditorContext` double both
 * of these build on.
 */
import { createPinia, setActivePinia } from 'pinia';
import {
	DrawPolygonTool,
	type PolygonCommand,
} from '../../src/presentation/editor/tools/draw-polygon-tool';
import type { EntityId } from '../../src/core/identity/EntityId';
import type { EditorContext } from '../../src/presentation/editor/tools/editor-context';
import type { UndoableCommand } from '../../src/presentation/editor/tools/undoable-command';
import { err, ok } from '../../src/core/result/Result';
import type { Polygon } from '../../src/core/geometry/Polygon';
import { pointerAt as at, toolContext } from './tool-context';

export interface Harness {
	context: EditorContext;
	dispatched: UndoableCommand[];
	/**
	 * Every polygon the tool handed its completion, in order. It used to be
	 * `CreateZoneInput[]` — the tool built that input itself, naming a plan, a zone name and a
	 * zone type. Design slice B2 moved all three into the `PolygonCompletion` the plan editor
	 * binds, so what this file can still assert about the tool is the SHAPE it completes with;
	 * that the shape becomes a Zone named "Zone 2" on the open plan is asserted end to end in
	 * `tests/presentation/editor/zoneEditing.test.ts`, against a real repository.
	 */
	completions: Polygon[];
	rejections: string[];
	failNextDispatch: () => void;
	gateNextDispatch: () => () => void;
}

export function harness(options: { worldPerScreenPixel?: number } = {}): Harness {
	setActivePinia(createPinia());
	const dispatched: UndoableCommand[] = [];
	const completions: Polygon[] = [];
	const rejections: string[] = [];
	let failNext = false;
	// `Promise<void>`, not `void`: `gateNextDispatch` assigns a function that returns the gated
	// promise, and the dispatcher below awaits it through `.then`. The declaration said `void`
	// until `tests/**` was type-checked — wrong about the value it holds, while the runtime was
	// right all along, which is why nothing failed.
	let gate: (() => Promise<void>) | null = null;

	const { context } = toolContext({
		worldPerScreenPixel: options.worldPerScreenPixel,
		commandDispatcher: {
			run: (runnable) => {
				if (gate !== null) {
					const release = gate;
					gate = null;
					return release().then(() => {
						// The failure is re-asked on the far side of the gate, so a case can hold a
						// dispatch open AND have it refuse — the combination a slow write that the
						// vault then declines actually has. It used to be reachable only on the
						// ungated path, which left "a refusal that lands after the gesture ended"
						// inexpressible, and that is precisely the window a generation check sits in.
						if (failNext) {
							failNext = false;
							return err({ category: 'Persistence', code: 'test.injected-failure', message: 'injected' });
						}
						dispatched.push(runnable);
						return runnable.execute();
					});
				}
				if (failNext) {
					failNext = false;
					return Promise.resolve(
						err({ category: 'Persistence', code: 'test.injected-failure', message: 'injected' }),
					);
				}
				dispatched.push(runnable);
				return runnable.execute();
			},
		},
	});

	return {
		context,
		dispatched,
		completions,
		rejections,
			failNextDispatch: () => {
				failNext = true;
			},
			gateNextDispatch: () => {
				let release!: () => void;
				const gated = new Promise<void>((resolve) => {
					release = resolve;
				});
				gate = () => {
					gate = null;
					return gated;
				};
				return () => release();
			},
	};
}

/**
 * A `PolygonCommand` double: the shape a `PolygonCompletion` hands back. `createdId` is what
 * the gesture selects once the dispatch succeeds — `null` for a completion that mints no new
 * entity (an Asset's footprint replaces a field of the asset already open).
 */
export function stubCommand(createdId: EntityId<string> | null = 'zone-created' as EntityId<string>): PolygonCommand {
	return {
		execute: () => Promise.resolve(ok('wrote')),
		undo: () => Promise.resolve(ok('wrote')),
		createdId,
	};
}

/**
 * Three vertices and a close click on the first — the shortest gesture that closes a shape.
 * Down-only, matching every other case in this file: `DrawPolygonTool` places its vertex on
 * `pointerdown` and its `pointerUp` is empty, so a paired release adds nothing to drive.
 */
export function drawTriangle(tool: DrawPolygonTool): void {
	tool.pointerDown(at(0, 0));
	tool.pointerDown(at(100, 0));
	tool.pointerDown(at(100, 60));
	tool.pointerDown(at(0, 0)); // closes on the first vertex
}

export function build(h: Harness, options: { onCompleted?: () => void } = {}): DrawPolygonTool {
	return new DrawPolygonTool({
		id: 'draw-polygon',
		completion: {
			commandFor: (geometry) => {
				h.completions.push(geometry);
				return stubCommand();
			},
		},
		// Design slice 17 split the door: `reportInvalidInput` is a refusal this tool made
		// itself, before any command existed. Both feed one list here, because every case in
		// this file asks "was the user told", which is true through either.
		reportRejected: (error) => h.rejections.push(error.message),
		reportInvalidInput: (error) => h.rejections.push(error.message),
		// A no-op default: most cases here have no runtime to hand back to, and only the ones
		// asserting the completion callback itself supply their own.
		onCompleted: options.onCompleted ?? (() => undefined),
	});
}
