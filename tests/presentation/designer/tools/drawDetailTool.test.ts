/**
 * `DrawDetailTool` and its two outline builders, driven DIRECTLY — the guards, the preview, the
 * three report doors and a write that lands after the tool was switched away, none of which the
 * mounted designer can discriminate. `designerDrawDetails.test.ts` drives the registered tools
 * through the real toolbar and canvas and asserts what reached the sidecar.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../../src/core/result/Result';
import type { AppError, ValidationError } from '../../../../src/core/errors/AppError';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../../src/core/geometry/curvePolyline';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import {
	circleOutline,
	DrawDetailTool,
	rectOutline,
	type DrawDetailToolDeps,
} from '../../../../src/presentation/designer/tools/draw-detail-tool';
import { flushGesture, pointerAt, toolContext, type ToolContextOptions } from '../../../helpers/tool-context';

const COMMAND: UndoableCommand = {
	execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
	undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
};
const REFUSAL: ValidationError = { category: 'Validation', code: 'asset.degenerate-detail', message: 'x' };
const QUARTER = Math.tan(Math.PI / 8);

function rig(options: ToolContextOptions = {}, overrides: Partial<DrawDetailToolDeps> = {}) {
	const harness = toolContext(options);
	const outlines: CurvedPolygon[] = [];
	const completed: string[] = [];
	const rejected: AppError[] = [];
	const invalid: AppError[] = [];
	const tool = new DrawDetailTool({
		id: 'draw-rect',
		outlineFor: rectOutline,
		commandFor: (outline) => {
			outlines.push(outline);
			return ok({ command: COMMAND, detailId: 'detail-7' });
		},
		reportRejected: (error) => rejected.push(error),
		reportInvalidInput: (error) => invalid.push(error),
		onCompleted: (detailId) => completed.push(detailId),
		...overrides,
	});
	return { harness, tool, outlines, completed, rejected, invalid };
}

describe('the outlines a drag describes', () => {
	it('boxes two corners in either order, wound from the top-left', () => {
		const expected = { points: [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 500 }, { x: 200, y: 500 }] };

		expect(rectOutline({ x: 600, y: 500 }, { x: 200, y: 200 })).toEqual(expected);
		expect(rectOutline({ x: 200, y: 500 }, { x: 600, y: 200 })).toEqual(expected);
	});

	it('describes no box with no width or no depth', () => {
		expect(rectOutline({ x: 200, y: 200 }, { x: 200, y: 500 })).toBeNull();
		expect(rectOutline({ x: 200, y: 200 }, { x: 600, y: 200 })).toBeNull();
	});

	it('draws a circle through the rim from the centre, as four quarter arcs', () => {
		const outline = circleOutline({ x: 300, y: 300 }, { x: 300, y: 500 });

		const expected = [[300, 100], [500, 300], [300, 500], [100, 300]];
		outline?.points.forEach((point, index) => {
			expect(point.x).toBeCloseTo(expected[index][0], 9);
			expect(point.y).toBeCloseTo(expected[index][1], 9);
		});
		expect(outline?.points).toHaveLength(4);
		expect(outline?.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	it('describes no circle when the rim is the centre', () => {
		expect(circleOutline({ x: 300, y: 300 }, { x: 300, y: 300 })).toBeNull();
	});
});

describe('DrawDetailTool', () => {
	it('previews the box while dragging and writes one command for it on release', async () => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		expect(r.tool.hasDraft()).toBe(true);
		expect(r.tool.tracksPointer()).toBe(true);
		r.tool.pointerMove(pointerAt(600, 500));
		const box = rectOutline({ x: 200, y: 200 }, { x: 600, y: 500 }) as CurvedPolygon;
		expect(r.harness.context.renderState.previewPolygon).toEqual(polygonPolyline(box, 0.25));
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.outlines).toEqual([box]);
		expect(r.harness.dispatched).toEqual([COMMAND]);
		expect(r.completed).toEqual(['detail-7']);
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		expect(r.tool.hasDraft()).toBe(false);
		expect(r.tool.tracksPointer()).toBe(false);
	});

	it('flattens a circle’s preview at a quarter of a screen pixel through the current camera', () => {
		const r = rig({ worldPerScreenPixel: 10 }, { id: 'draw-circle', outlineFor: circleOutline });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(300, 300));
		r.tool.pointerMove(pointerAt(300, 500));

		const outline = circleOutline({ x: 300, y: 300 }, { x: 300, y: 500 }) as CurvedPolygon;
		expect(r.harness.context.renderState.previewPolygon).toEqual(polygonPolyline(outline, 2.5));
	});

	it('clears the preview while the pointer rests where the box has no area, and writes nothing there', async () => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerMove(pointerAt(600, 500));
		r.tool.pointerMove(pointerAt(200, 500));
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		r.tool.pointerUp(pointerAt(200, 500));
		await flushGesture();

		expect(r.outlines).toEqual([]);
		expect(r.harness.dispatched).toEqual([]);
		expect(r.completed).toEqual([]);
	});

	it('snaps the press and the release onto a candidate vertex', async () => {
		const r = rig({ snapCandidates: () => ({ vertices: [{ x: 0, y: 0 }, { x: 100, y: 50 }] }) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(5, 5));
		r.tool.pointerUp(pointerAt(96, 47));
		await flushGesture();

		expect(r.outlines).toEqual([rectOutline({ x: 0, y: 0 }, { x: 100, y: 50 })]);
	});

	it('reports a refusal of its own and dispatches nothing', async () => {
		const r = rig({}, { commandFor: () => err(REFUSAL) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.invalid).toEqual([REFUSAL]);
		expect(r.harness.dispatched).toEqual([]);
		expect(r.completed).toEqual([]);
	});

	it('reports a dispatched refusal and completes nothing', async () => {
		const refused: DispatchResult = err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' });
		const r = rig({ commandDispatcher: { run: () => Promise.resolve(refused) } });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.rejected.map((error) => error.code)).toEqual(['vault.unexpected-failure']);
		expect(r.completed).toEqual([]);
	});

	/**
	 * A write that lands after the user switched tools must not select the new detail and pull
	 * them back to Select out of whatever they are doing now. The write itself still landed.
	 */
	it('completes nothing when the tool was switched away while the write was in flight', async () => {
		let settle!: (result: DispatchResult) => void;
		const r = rig({
			commandDispatcher: {
				run: () =>
					new Promise<DispatchResult>((resolve) => {
						settle = resolve;
					}),
			},
		});
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		r.tool.deactivate();
		settle(ok('wrote'));
		await flushGesture();

		expect(r.completed).toEqual([]);
	});

	it('draws nothing before activation, for a secondary button, or for a release no press began', async () => {
		const r = rig();
		r.tool.deactivate();
		r.tool.cancel();
		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.pointerMove(pointerAt(100, 100));
		r.tool.pointerUp(pointerAt(100, 100));

		r.tool.activate(r.harness.context);
		r.tool.pointerUp(pointerAt(100, 100));
		r.tool.pointerDown(pointerAt(0, 0, 'secondary'));
		r.tool.pointerMove(pointerAt(100, 100));
		r.tool.pointerUp(pointerAt(100, 100, 'secondary'));
		r.tool.pointerDown(pointerAt(0, 0));
		r.tool.pointerUp(pointerAt(100, 100, 'secondary'));
		await flushGesture();

		expect(r.outlines).toEqual([]);
		expect(r.harness.dispatched).toEqual([]);
	});

	it.each(['cancel', 'abandonGesture'] as const)('drops the drag and its preview on %s, dispatching nothing', async (exit) => {
		const r = rig();
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerMove(pointerAt(600, 500));
		r.tool[exit]();
		expect(r.harness.context.renderState.previewPolygon).toBeNull();
		expect(r.tool.hasDraft()).toBe(false);
		r.tool.pointerUp(pointerAt(600, 500));
		await flushGesture();

		expect(r.harness.dispatched).toEqual([]);
	});
});
