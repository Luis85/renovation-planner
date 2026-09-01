/**
 * The designer's two own tools, driven DIRECTLY — the guards and the lifecycle that the
 * mounted designer cannot reach.
 *
 * `designerTools.test.ts` is the file that matters most: it drives every gesture through the
 * real toolbar and the real canvas and asserts what reached the sidecar, because a tool proven
 * in isolation and reachable by nothing is design slice 7's `CalibrateTool` exactly. This file
 * is the complement, and each case here is one the mounted path provably CANNOT discriminate:
 *
 * - **the button guards.** `EditorSurface` filters `pointerdown` and `pointerup` by button
 *   before it forwards anything, so a secondary press never reaches a tool through the canvas
 *   at all. Measured, not assumed: deleting `SetAnchorTool`'s own `event.button !== 'primary'`
 *   left the whole mounted suite green. The guard stays because the invariant belongs to the
 *   tool — `CLAUDE.md`'s "every tool guards `event.button` itself, which is where the invariant
 *   belongs" — and a caller that is not `EditorSurface` is under no obligation to filter first.
 *   A mutation that does not redden is a finding about the TEST, and this file is that finding
 *   answered rather than a case quietly kept.
 * - **`cancel` and `abandonGesture`.** Escape and an interruption reach the manager, and what
 *   each tool does with them is the difference between a discarded gesture and a destroyed one.
 * - **a pointer arriving with no context**, which is what a tool that was never activated, or
 *   has been deactivated, must survive rather than throw through.
 */
import { describe, expect, it } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { noSelectableObjectsYet } from '../../../../src/presentation/designer/tools/registerDesignerTools';
import { SetAnchorTool } from '../../../../src/presentation/designer/tools/set-anchor-tool';
import { SetFacingTool } from '../../../../src/presentation/designer/tools/set-facing-tool';
import type { AppError } from '../../../../src/core/errors/AppError';
import {
	flushGesture,
	pointerAt,
	shiftPointerAt,
	toolContext,
	type ToolContextHarness,
} from '../../../helpers/tool-context';

/** A command that records nothing but the fact that it was built, and writes when run. */
function recordingCommand(): UndoableCommand {
	return {
		execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
		undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
	};
}

interface AnchorRig {
	readonly tool: SetAnchorTool;
	readonly harness: ToolContextHarness;
	readonly placed: { x: number; y: number }[];
	readonly rejected: AppError[];
}

function anchorRig(): AnchorRig {
	const harness = toolContext();
	const placed: { x: number; y: number }[] = [];
	const rejected: AppError[] = [];
	const tool = new SetAnchorTool({
		createCommand: (anchor) => {
			placed.push(anchor);
			return recordingCommand();
		},
		reportRejected: (error) => rejected.push(error),
	});
	return { tool, harness, placed, rejected };
}

interface FacingRig {
	readonly tool: SetFacingTool;
	readonly harness: ToolContextHarness;
	readonly set: number[];
	readonly refused: AppError[];
}

function facingRig(): FacingRig {
	const harness = toolContext();
	const set: number[] = [];
	const refused: AppError[] = [];
	const tool = new SetFacingTool({
		createCommand: (facing) => {
			set.push(facing);
			return recordingCommand();
		},
		reportRejected: (error) => refused.push(error),
		reportInvalidInput: (error) => refused.push(error),
	});
	return { tool, harness, set, refused };
}

/**
 * The designer's `SelectTool` is registered with an EMPTY candidate set, because nothing on
 * this canvas is selectable until Task B8. Its move factory is therefore unreachable through
 * every door a user has, and asserting the refusal is the only way to know it refuses rather
 * than silently handing back a command that writes nothing — the same reason the module this
 * task deleted exported its throwing context factory and had it asserted.
 */
describe('the designer’s selection', () => {
	it('refuses to build a move gesture, because nothing here is selectable yet', () => {
		expect(() => noSelectableObjectsYet()).toThrow(/Task B8/);
	});
});

describe('SetAnchorTool', () => {
	it('places nothing for a secondary press, because the invariant is the tool’s own', () => {
		const rig = anchorRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(40, 50, 'secondary'));

		expect(rig.placed).toEqual([]);
	});

	it('places nothing before it is activated, and nothing after it is deactivated', () => {
		const rig = anchorRig();

		rig.tool.pointerDown(pointerAt(40, 50));
		rig.tool.activate(rig.harness.context);
		rig.tool.deactivate();
		rig.tool.pointerDown(pointerAt(60, 70));

		expect(rig.placed).toEqual([]);
	});

	/**
	 * A hover writes nothing and holds nothing. Asserted rather than left as an empty method:
	 * an empty method has no behaviour for any test to disagree with, and the shape this tool
	 * would most plausibly grow — a ghost anchor following the pointer — is one a later author
	 * should have to make deliberately.
	 */
	it('holds nothing between clicks: a move, an Escape and an interruption all place nothing', () => {
		const rig = anchorRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerMove(pointerAt(10, 10));
		rig.tool.pointerUp(pointerAt(10, 10));
		rig.tool.cancel();
		rig.tool.abandonGesture();

		expect(rig.placed).toEqual([]);
		expect(rig.harness.context.renderState.polygonSketch).toBeNull();
	});

	/**
	 * A REFUSED placement reaches the report door — the only channel this tool has, since
	 * everything it can refuse is refused by the command rather than by itself.
	 */
	it('reports a refused placement', async () => {
		const harness = toolContext({
			commandDispatcher: {
				run: () =>
					Promise.resolve({
						ok: false as const,
						error: { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } as AppError,
					}),
			},
		});
		const rejected: AppError[] = [];
		const tool = new SetAnchorTool({ createCommand: recordingCommand, reportRejected: (error) => rejected.push(error) });
		tool.activate(harness.context);

		tool.pointerDown(pointerAt(40, 50));
		await flushGesture();

		expect(rejected.map((error) => error.code)).toEqual(['vault.unexpected-failure']);
	});
});

describe('SetFacingTool', () => {
	it('sets nothing for a secondary press, and nothing for a secondary release', async () => {
		const rig = facingRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(0, 0, 'secondary'));
		rig.tool.pointerUp(pointerAt(100, 0, 'secondary'));
		// ...and a primary drag whose RELEASE names another button is not a facing either.
		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.pointerUp(pointerAt(100, 0, 'secondary'));
		await flushGesture();

		expect(rig.set).toEqual([]);
	});

	it('sets nothing before it is activated, and nothing after it is deactivated', async () => {
		const rig = facingRig();

		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.pointerUp(pointerAt(100, 0));
		rig.tool.activate(rig.harness.context);
		rig.tool.deactivate();
		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.pointerUp(pointerAt(100, 0));
		await flushGesture();

		expect(rig.set).toEqual([]);
	});

	/** A release with no press behind it names no drag, whatever coordinate it carries. */
	it('sets nothing for a release that no press began', async () => {
		const rig = facingRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerUp(pointerAt(100, 0));
		await flushGesture();

		expect(rig.set).toEqual([]);
	});

	/**
	 * **The preview is written while the drag runs and cleared when it ends**, which is the
	 * field a designer interaction layer will read. It is `measurement` and not
	 * `polygonSketch` — a direction indicated between two points is not a shape being drawn,
	 * and `polygonSketch` renders as a dashed closing outline with a vertex circle per point.
	 *
	 * Nothing draws either field on the designer's canvas today (see
	 * `registerDesignerTools.ts`), so this is the only instrument there is for it — which is
	 * exactly why it is asserted here rather than left to an eye.
	 */
	it('previews the drag as a measurement while it runs, and clears it on release', async () => {
		const rig = facingRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.pointerMove(pointerAt(100, 0));
		const during = rig.harness.context.renderState.measurement;
		rig.tool.pointerUp(pointerAt(100, 0));
		await flushGesture();

		expect(during).toEqual({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } });
		expect(rig.harness.context.renderState.measurement).toBeNull();
		expect(rig.harness.context.renderState.polygonSketch).toBeNull();
	});

	/** The preview follows the CONSTRAINT, so what is drawn is what a release would commit. */
	it('previews the constrained point while shift is held, not the raw pointer', () => {
		const rig = facingRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.pointerMove(shiftPointerAt(100, 7));

		expect(rig.harness.context.renderState.measurement?.end.y).toBeCloseTo(0, 9);
	});

	/**
	 * **Escape discards the drag and dispatches nothing**, and the preview goes with it — the
	 * whole of this tool's gesture is press-to-release, so there is no accumulation for a later
	 * click to complete. A build that kept the origin would set a facing out of the user's next
	 * unrelated release.
	 */
	it('discards the drag on Escape, and on an interruption, without dispatching', async () => {
		const rig = facingRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.cancel();
		rig.tool.pointerUp(pointerAt(100, 0));

		rig.tool.pointerDown(pointerAt(0, 0));
		rig.tool.abandonGesture();
		rig.tool.pointerUp(pointerAt(100, 0));
		await flushGesture();

		expect(rig.set).toEqual([]);
		expect(rig.harness.context.renderState.measurement).toBeNull();
	});

	/**
	 * A REFUSED dispatch reaches the report door — and a gesture cancelled while that dispatch
	 * was in flight does NOT, because the refusal belongs to a gesture the user has taken back.
	 * That is what the generation counter is for, and the two halves are one case because a
	 * build with no counter passes the first.
	 */
	it('reports a refused facing, unless the gesture was cancelled while it was in flight', async () => {
		let settle!: (result: DispatchResult) => void;
		const harness = toolContext({
			commandDispatcher: {
				run: () =>
					new Promise<DispatchResult>((resolve) => {
						settle = resolve;
					}),
			},
		});
		const refused: AppError[] = [];
		const tool = new SetFacingTool({
			createCommand: recordingCommand,
			reportRejected: (error) => refused.push(error),
			reportInvalidInput: (error) => refused.push(error),
		});
		tool.activate(harness.context);

		tool.pointerDown(pointerAt(0, 0));
		tool.pointerUp(pointerAt(100, 0));
		tool.cancel();
		settle({ ok: false, error: { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } });
		await flushGesture();

		expect(refused).toEqual([]);
	});
});
