import { expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import { ok } from '../../../../src/core/result/Result';
import { flushGesture as flush, pointerAt, toolContext } from '../../../helpers/tool-context';

/**
 * A dropped zone must not flick back to its saved geometry while the move is written and read
 * back. The dispatcher's `run` resolves only after the refreshed projection has landed, so the
 * ghost is what keeps the drop on screen for that window. Its own file because `selectTool.test.ts`
 * is at its line budget.
 */
it('holds the dropped ghost where it landed until the move has been written and read back', async () => {
	setActivePinia(createPinia());
	let settle!: () => void;
	const { context } = toolContext({
		commandDispatcher: { run: () => new Promise((resolve) => { settle = () => resolve(ok('wrote')); }) },
	});
	const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
	const tool = new SelectTool({
		spatialObjects: () => [{ id: 'zone-a', points: square }],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
	});
	tool.activate(context);

	tool.pointerDown(pointerAt(10, 10));
	tool.pointerMove(pointerAt(40, 10));
	tool.pointerUp(pointerAt(60, 10)); // released further than the last move
	await flush();
	expect(context.renderState.previewPolygon?.[0]).toEqual({ x: 50, y: 0 });

	settle();
	await flush();
	expect(context.renderState.previewPolygon).toBeNull();
});
