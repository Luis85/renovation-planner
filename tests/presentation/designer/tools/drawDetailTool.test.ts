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
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { ReversibleAssetDesignCommands } from '../../../../src/application/editor/asset/ReversibleAssetDesignCommands';
import { registerDesignerTools } from '../../../../src/presentation/designer/tools/registerDesignerTools';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import { DESIGN_VERSION, TOILET } from '../../../helpers/designerSelection';
import { flushGesture, pointerAt, toolContext, type ToolContextOptions } from '../../../helpers/tool-context';

const COMMAND: UndoableCommand = {
	execute: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
	undo: (): Promise<DispatchResult> => Promise.resolve(ok('wrote')),
};
const REFUSAL: ValidationError = { category: 'Validation', code: 'asset.degenerate-detail', message: 'x' };
const QUARTER = Math.tan(Math.PI / 8);

/** A dispatcher whose one write resolves only when the case says so. */
function deferredWrite() {
	let resolveWrite!: (result: DispatchResult) => void;
	return {
		commandDispatcher: {
			run: () =>
				new Promise<DispatchResult>((resolve) => {
					resolveWrite = resolve;
				}),
		},
		settle: (result: DispatchResult) => resolveWrite(result),
	};
}

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

	it('draws the guide that decided a landing, and clears it when the drag ends or is cancelled', async () => {
		const r = rig({ snapCandidates: () => ({ alignments: [{ x: 100, y: 900 }] }) });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(5, 5));
		r.tool.pointerMove(pointerAt(103, 400));
		const midDrag = r.harness.context.renderState.snapGuides;
		r.tool.pointerUp(pointerAt(103, 400));
		await flushGesture();

		expect(midDrag).toEqual([{ start: { x: 100, y: 400 }, end: { x: 100, y: 900 } }]);
		expect(r.outlines).toEqual([rectOutline({ x: 5, y: 5 }, { x: 100, y: 400 })]);
		expect(r.harness.context.renderState.snapGuides).toEqual([]);

		r.tool.pointerDown(pointerAt(103, 5));
		expect(r.harness.context.renderState.snapGuides).toHaveLength(1);
		r.tool.cancel();
		expect(r.harness.context.renderState.snapGuides).toEqual([]);
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
		const write = deferredWrite();
		const r = rig({ commandDispatcher: write.commandDispatcher });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		r.tool.deactivate();
		write.settle(ok('wrote'));
		await flushGesture();

		expect(r.completed).toEqual([]);
	});

	/**
	 * A new press is a new gesture: the previous write landing mid-drag must not switch to Select
	 * under the pointer and throw the drag in progress away.
	 */
	it('completes nothing when a new press began while the previous write was in flight', async () => {
		const write = deferredWrite();
		const r = rig({ commandDispatcher: write.commandDispatcher });
		r.tool.activate(r.harness.context);

		r.tool.pointerDown(pointerAt(200, 200));
		r.tool.pointerUp(pointerAt(600, 500));
		r.tool.pointerDown(pointerAt(700, 700));
		write.settle(ok('wrote'));
		await flushGesture();

		expect(r.completed).toEqual([]);
		expect(r.tool.hasDraft()).toBe(true);
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

	it.each(['cancel', 'abandonGesture', 'deactivate'] as const)('drops the drag and its preview on %s, dispatching nothing', async (exit) => {
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

/**
 * Trace detail as `registerDesignerTools` builds it, over a recording context. A domain refusal is
 * the tool's OWN, asked before any command exists, so it reaches `reportInvalidInput` and the
 * dispatcher never sees it — which the mounted designer cannot tell apart from a dispatched refusal
 * that raises the same notice.
 */
function traceRig(shape: AssetShape | null) {
	const harness = toolContext();
	const invalid: AppError[] = [];
	const rejected: AppError[] = [];
	const manager = new ToolManager(() => harness.context);
	registerDesignerTools(manager, {
		assetId: 'asset-1' as AssetId,
		edits: {} as ReversibleAssetDesignCommands,
		reportRejected: (error) => rejected.push(error),
		reportInvalidInput: (error) => invalid.push(error),
		supplyKnownDistance: () => Promise.resolve(null),
		hasGeometryToRescale: () => false,
		confirmRecalibration: () => Promise.resolve(false),
		detailPending: () => false,
		returnToSelect: () => undefined,
		selectTool: {
			design: () => (shape === null ? null : { shape, geometryVersion: DESIGN_VERSION }),
			selection: () => null,
			mode: () => 'transform',
			select: () => undefined,
			setPreview: () => undefined,
			createCommand: () => COMMAND,
			reportRejected: (error) => rejected.push(error),
			reportInvalidInput: (error) => invalid.push(error),
			writing: () => false,
			settled: () => Promise.resolve(),
		},
	});
	manager.setActiveTool('trace-detail');
	return { harness, manager, invalid, rejected };
}

/** A click per vertex, then a click back on the first, which closes the outline. */
async function trace(traced: ReturnType<typeof traceRig>, vertices: readonly Point[]): Promise<void> {
	for (const vertex of [...vertices, vertices[0]]) traced.manager.pointerDown(pointerAt(vertex.x, vertex.y));
	await flushGesture();
}

describe('trace detail, as registered', () => {
	const TRIANGLE: readonly Point[] = [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 500 }];
	const COLLINEAR: readonly Point[] = [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 600, y: 200 }];

	it.each([
		['an asset with no shape', null, TRIANGLE, 'asset.no-footprint'],
		['an outline that encloses no area', TOILET, COLLINEAR, 'asset.degenerate-detail'],
	] as const)('refuses %s before any command is built, dispatching nothing', async (_case, shape, vertices, code) => {
		const r = traceRig(shape);

		await trace(r, vertices);

		expect(r.invalid.map((error) => error.code)).toEqual([code]);
		expect(r.rejected).toEqual([]);
		expect(r.harness.dispatched).toEqual([]);
		// The refusal keeps the user's vertices, as every `DrawPolygonTool` refusal does.
		expect(r.manager.activeToolHasDraft()).toBe(true);
	});

	/** Finish closes with whatever is placed, so two corners meet the polygon rules first, as every trace does. */
	it('refuses an outline of fewer than three corners by the polygon rules, dispatching nothing', async () => {
		const r = traceRig(TOILET);

		r.manager.pointerDown(pointerAt(200, 200));
		r.manager.pointerDown(pointerAt(600, 200));
		r.manager.finishActiveTool();
		await flushGesture();

		expect(r.invalid.map((error) => error.category)).toEqual(['Geometry']);
		expect(r.harness.dispatched).toEqual([]);
	});
});
