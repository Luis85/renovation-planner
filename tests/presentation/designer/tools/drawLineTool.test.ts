/**
 * `DrawLineTool` driven DIRECTLY — the guards, the three report doors, and the two windows a write
 * in flight opens, none of which the mounted designer can discriminate.
 * `designerDrawOpenLines.test.ts` drives the registered tool through the real toolbar and canvas
 * and asserts what reached the sidecar; this file is `drawDetailTool.test.ts`'s counterpart for the
 * open arm, and it is deliberately the same rig so the two tools' guards are asserted alike.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../../src/core/result/Result';
import type { AppError, ValidationError } from '../../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { DrawLineTool, LINE_MIN_VERTICES, type DrawLineToolDeps } from '../../../../src/presentation/designer/tools/draw-line-tool';
import { flushGesture, pointerAt, toolContext, type ToolContextOptions } from '../../../helpers/tool-context';

const COMMAND: UndoableCommand = {
	execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
	undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
};
const REFUSAL: ValidationError = { category: 'Validation', code: 'asset.invalid-detail', message: 'x' };

/**
 * A dispatcher whose writes resolve only when the case says so — `drawDetailTool.test.ts`'s, with
 * one addition: it keeps EVERY resolver rather than the latest, so a case can settle the first
 * write while a second is still in flight. That ordering is the whole subject of the last case
 * below, and a single-resolver version silently settles the wrong one.
 */
function deferredWrite() {
	const runs: UndoableCommand[] = [];
	const resolvers: ((result: DispatchResult) => void)[] = [];
	return {
		runs,
		commandDispatcher: {
			run: (command: UndoableCommand) => {
				runs.push(command);
				return new Promise<DispatchResult>((resolve) => { resolvers.push(resolve); });
			},
		},
		settle: (result: DispatchResult, index = resolvers.length - 1) => resolvers[index](result),
	};
}

function rig(options: ToolContextOptions = {}, overrides: Partial<DrawLineToolDeps> = {}) {
	const harness = toolContext(options);
	const completed: string[] = [];
	const rejected: AppError[] = [];
	const invalid: AppError[] = [];
	const tool = new DrawLineTool({
		id: 'draw-line',
		commandFor: () => ok({ command: COMMAND, detailId: 'detail-7' }),
		reportRejected: (error) => rejected.push(error),
		reportInvalidInput: (error) => invalid.push(error),
		onCompleted: (detailId) => completed.push(detailId),
		...overrides,
	});
	return { harness, tool, completed, rejected, invalid };
}

/** Two vertices, the floor a run can be finished from. */
function placeRun(r: ReturnType<typeof rig>): void {
	r.tool.pointerDown(pointerAt(0, 0));
	r.tool.pointerDown(pointerAt(500, 0));
}

describe('what the tool refuses to act on at all', () => {
	/**
	 * Every door asked before activation, with a secondary button, and with nothing placed. The
	 * mounted designer cannot produce any of these — `ToolManager` routes only to the tool it has
	 * activated, and `DesignerCanvas` routes only a primary press — so this is the one place the
	 * narrowing guards those doors carry are actually exercised rather than assumed.
	 */
	it('does nothing before activation, for a secondary button, or for a move with nothing placed', async () => {
		const r = rig();
		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.pointerMove(pointerAt(100, 100));
		r.tool.finish();
		r.tool.cancel();
		r.tool.abandonGesture();

		r.tool.activate(r.harness.context);
		r.tool.pointerMove(pointerAt(100, 100));
		r.tool.pointerDown(pointerAt(0, 0, 'secondary'));
		r.tool.pointerUp();
		await flushGesture();

		expect(r.tool.hasDraft()).toBe(false);
		expect(r.tool.tracksPointer()).toBe(false);
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		expect(r.harness.dispatched).toEqual([]);
	});

	it(`finishes nothing below ${LINE_MIN_VERTICES} vertices, and reports nothing either`, async () => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.finish();
		await flushGesture();

		expect(r.harness.dispatched).toEqual([]);
		expect(r.invalid).toEqual([]);
		expect(r.tool.hasDraft()).toBe(true);
	});

	it('reports a refusal of its own and dispatches nothing, keeping every vertex placed', async () => {
		const r = rig({}, { commandFor: () => err(REFUSAL) });
		r.tool.activate(r.harness.context);

		placeRun(r);
		r.tool.finish();
		await flushGesture();

		expect(r.invalid).toEqual([REFUSAL]);
		expect(r.harness.dispatched).toEqual([]);
		expect(r.tool.hasDraft()).toBe(true);
	});
});

describe('an interruption that is not a cancel', () => {
	/**
	 * **`abandonGesture` keeps the buffer and `cancel` does not**, which is the whole of why this
	 * tool has both. A vertex is placed on `pointerdown` with no release to complete, so focus loss
	 * has no press-to-release state to abandon — routing it through `cancel()` would throw away
	 * every vertex the user had placed. The guides go, because they describe a pointer that has left.
	 */
	it('drops the guides on abandonGesture and keeps the run; cancel drops the run', () => {
		const r = rig({ snapCandidates: () => ({ alignments: [{ x: 500, y: 900 }] }) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.pointerDown(pointerAt(503, 0));
		expect(r.harness.context.renderState.snapGuides).toHaveLength(1);

		r.tool.abandonGesture();
		expect(r.harness.context.renderState.snapGuides).toEqual([]);
		expect(r.tool.hasDraft()).toBe(true);

		r.tool.cancel();
		expect(r.tool.hasDraft()).toBe(false);
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		expect(r.harness.context.renderState.previewClosed).toBe(true);
	});
});

describe('a write in flight', () => {
	it('reports a dispatched refusal, completes nothing, and keeps the user’s vertices', async () => {
		const refused: DispatchResult = err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' });
		const r = rig({ commandDispatcher: { run: () => Promise.resolve(refused) } });
		r.tool.activate(r.harness.context);

		placeRun(r);
		r.tool.finish();
		await flushGesture();

		expect(r.rejected.map((error) => error.code)).toEqual(['vault.unexpected-failure']);
		expect(r.completed).toEqual([]);
		expect(r.tool.hasDraft()).toBe(true);
	});

	/** A second Enter while the first is still in flight must not dispatch the run twice. */
	it('ignores a second finish and a press while the first write is still in flight', async () => {
		const write = deferredWrite();
		const r = rig({ commandDispatcher: write.commandDispatcher });
		r.tool.activate(r.harness.context);

		placeRun(r);
		r.tool.finish();
		r.tool.finish();
		r.tool.pointerDown(pointerAt(900, 900));
		r.tool.pointerMove(pointerAt(950, 900));
		write.settle(ok('wrote'));
		await flushGesture();

		expect(write.runs).toEqual([COMMAND]);
		expect(r.completed).toEqual(['detail-7']);
	});

	/**
	 * A write that lands after the user switched tools must not select the new graphic and pull them
	 * back to Select out of whatever they are doing now. The write itself still landed.
	 */
	it('completes nothing when the tool was switched away while the write was in flight', async () => {
		const write = deferredWrite();
		const r = rig({ commandDispatcher: write.commandDispatcher });
		r.tool.activate(r.harness.context);

		placeRun(r);
		r.tool.finish();
		r.tool.deactivate();
		write.settle(ok('wrote'));
		await flushGesture();

		expect(r.completed).toEqual([]);
	});

	/**
	 * Escape mid-flight opens a NEW gesture, so a late write must not select for it either.
	 */
	it('leaves a run started after a cancel alone, and that run can still be finished', async () => {
		const write = deferredWrite();
		const r = rig({ commandDispatcher: write.commandDispatcher });
		r.tool.activate(r.harness.context);

		placeRun(r);
		r.tool.finish();
		r.tool.cancel();
		r.tool.pointerDown(pointerAt(900, 900));
		r.tool.pointerDown(pointerAt(900, 500));
		write.settle(ok('wrote'), 0);
		await flushGesture();

		expect(r.completed).toEqual([]);
		expect(r.tool.hasDraft()).toBe(true);

		r.tool.finish();
		write.settle(ok('wrote'));
		await flushGesture();

		expect(r.completed).toEqual(['detail-7']);
	});

	/**
	 * **The `finally` releases `finishing` only for the gesture that claimed it**, and this is the
	 * one ordering that can tell the difference: the FIRST write settles while the SECOND gesture's
	 * own write is in flight. Releasing the flag there would release a flag this write never set,
	 * and the next Enter would dispatch the second run a second time — one gesture, two history
	 * entries, which is exactly what C05 refuses.
	 */
	it('does not release a later gesture’s in-flight flag when an earlier write lands', async () => {
		const write = deferredWrite();
		const r = rig({ commandDispatcher: write.commandDispatcher });
		r.tool.activate(r.harness.context);

		placeRun(r);
		r.tool.finish();
		r.tool.cancel();
		r.tool.pointerDown(pointerAt(900, 900));
		r.tool.pointerDown(pointerAt(900, 500));
		r.tool.finish();
		write.settle(ok('wrote'), 0);
		await flushGesture();

		r.tool.finish();
		await flushGesture();

		expect(write.runs).toEqual([COMMAND, COMMAND]);
	});
});
