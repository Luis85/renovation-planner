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
	 * Task 9 — the whole gesture is over inside `pointerDown` (the class docblock's own
	 * account), so there is never a draft for Escape to ask about.
	 */
	it('never holds a draft: the gesture is over inside pointerDown', () => {
		const rig = anchorRig();
		rig.tool.activate(rig.harness.context);

		expect(rig.tool.hasDraft()).toBe(false);
		rig.tool.pointerDown(pointerAt(40, 50));
		expect(rig.tool.hasDraft()).toBe(false);
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
	 * field `DesignerGestureLayer` reads. It is `measurement` and not
	 * `polygonSketch` — a direction indicated between two points is not a shape being drawn,
	 * and `polygonSketch` renders as a dashed closing outline with a vertex circle per point.
	 *
	 * Nothing drew either field on the designer's canvas for a whole increment, which is why
	 * this was the only instrument there was for it. `designerGesture.test.ts` reads the layer
	 * now; this case still holds the FIELD, which is the half a scene assertion cannot see —
	 * that the preview is cleared on release rather than merely drawn.
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
	/**
	 * Task 9 — a press with no release yet is this tool's whole draft (`origin`), and Escape
	 * asks before `cancel()` discards it.
	 */
	it('holds a draft only between pointerDown and its release', () => {
		const rig = facingRig();
		rig.tool.activate(rig.harness.context);

		expect(rig.tool.hasDraft()).toBe(false);

		rig.tool.pointerDown(pointerAt(0, 0));
		expect(rig.tool.hasDraft()).toBe(true);

		rig.tool.pointerUp(pointerAt(100, 0));
		expect(rig.tool.hasDraft()).toBe(false);
	});

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
	 * **A REFUSED dispatch reaches the report door, and a gesture that ended while it was in
	 * flight does not change that** — which is the correction of what this case used to assert.
	 *
	 * It was written as "reports a refused facing, UNLESS the gesture was cancelled while it was
	 * in flight", on the reasoning that "the refusal belongs to a gesture the user has taken
	 * back". Two things were wrong with it. The name promised the first half and the body
	 * asserted only the second, so nothing here ever watched a refusal being reported at all;
	 * and the reasoning confuses two subjects. A generation counter answers "is the PREVIEW I am
	 * about to touch still mine". A refusal answers "the vault declined a write that really was
	 * attempted" — a fact about the vault, true however the tool has been switched since, and
	 * `SetAnchorTool`'s own docblock already says exactly this about its own missing counter.
	 * `asset.no-footprint` is a pre-write code, so `affectsSaveState` leaves the indicator
	 * neutral and the notice door was the only channel that refusal had.
	 *
	 * Both halves in ONE case, deliberately: a build that reports nothing at all passes either
	 * one alone, and the pair is what says the report is unconditional rather than merely
	 * present on the happy path.
	 */
	it('reports a refused facing, whether or not the gesture ended while it was in flight', async () => {
		const refused: AppError[] = [];
		const refusal = {
			ok: false as const,
			error: { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } as AppError,
		};
		let settle!: (result: DispatchResult) => void;
		const harness = toolContext({
			commandDispatcher: {
				run: () =>
					new Promise<DispatchResult>((resolve) => {
						settle = resolve;
					}),
			},
		});
		const tool = new SetFacingTool({
			createCommand: recordingCommand,
			reportRejected: (error) => refused.push(error),
			reportInvalidInput: (error) => refused.push(error),
		});
		tool.activate(harness.context);

		// An ordinary drag, refused.
		tool.pointerDown(pointerAt(0, 0));
		tool.pointerUp(pointerAt(100, 0));
		settle(refusal);
		await flushGesture();

		// And a second drag the user cancels out of before its refusal lands. `cancel()` bumps
		// nothing this continuation reads any more, which is the whole change.
		tool.pointerDown(pointerAt(0, 0));
		tool.pointerUp(pointerAt(0, 100));
		tool.cancel();
		settle(refusal);
		await flushGesture();

		expect(refused.map((error) => error.code)).toEqual([
			'vault.unexpected-failure',
			'vault.unexpected-failure',
		]);
	});

	/**
	 * What a tool switch DOES still take with it: the preview. Cleared by `deactivate` and left
	 * cleared by a refusal resolving afterwards — the tool must not repaint a segment for a
	 * gesture whose surface has moved on.
	 *
	 * Its own case rather than an extra assertion above, because the two are separate claims:
	 * "the refusal is reported" and "the picture is not restored" are what a build that dropped
	 * the report to protect the picture would have conflated.
	 */
	it('leaves the preview cleared when a refusal lands after the tool was switched away', async () => {
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
		tool.deactivate();
		settle({ ok: false, error: { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } });
		await flushGesture();

		expect(refused).toHaveLength(1);
		expect(harness.context.renderState.measurement).toBeNull();
	});
});
