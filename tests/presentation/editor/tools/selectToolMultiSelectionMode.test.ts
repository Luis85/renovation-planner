import { expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

const square = (x: number) => [{ x, y: 0 }, { x: x + 100, y: 0 }, { x: x + 100, y: 100 }, { x, y: 100 }];

/**
 * The sidebar's "select multiple" checkbox reaches the canvas as a held Shift. Its own file
 * because `selectTool.test.ts` is at its line budget.
 */
it('makes a plain click add and remove, as Shift does, while the mode is on', () => {
	setActivePinia(createPinia());
	const { context } = toolContext({ commandDispatcher: { run: () => Promise.resolve(ok('wrote')) } });
	let multiple = true;
	const tool = new SelectTool({
		multiSelectionMode: () => multiple,
		spatialObjects: () => [{ id: 'zone-a', points: square(0) }, { id: 'zone-b', points: square(200) }],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
	});
	tool.activate(context);
	for (const x of [10, 210]) { tool.pointerDown(pointerAt(x, 10)); tool.pointerUp(pointerAt(x, 10)); }
	expect(context.selection.selectedIds).toEqual(['zone-a', 'zone-b']);
	// A click on a member removes it rather than grabbing it for a drag or focusing it.
	tool.pointerDown(pointerAt(10, 10));
	expect(tool.hasDraft()).toBe(false);
	tool.pointerUp(pointerAt(10, 10));
	expect(context.selection.selectedIds).toEqual(['zone-b']);
	multiple = false;
	tool.pointerDown(pointerAt(10, 10));
	expect(context.selection.selectedIds).toEqual(['zone-a']);
});
