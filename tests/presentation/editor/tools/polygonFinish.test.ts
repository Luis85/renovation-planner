import { describe, expect, it } from 'vitest';
import { build, harness } from '../../../helpers/drawPolygonHarness';
import { pointerAt as at, flushGesture } from '../../../helpers/tool-context';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';

describe('explicit polygon completion', () => {
	it('ignores an inactive finish and refuses an empty active outline', async () => {
		const h = harness();
		const tool = build(h);
		tool.finish();
		expect(h.dispatched).toEqual([]);
		tool.activate(h.context);
		tool.finish();
		await flushGesture();
		expect(h.dispatched).toEqual([]);
		expect(tool.hasDraft()).toBe(false);
	});
	it('the manager forwards Finish once and the tool ignores concurrent closes', async () => {
		const h = harness();
		const tool = build(h);
		const manager = new ToolManager(() => h.context);
		manager.finishActiveTool();
		manager.register(tool);
		manager.setActiveTool(tool.id);
		for (const point of [[0, 0], [100, 0], [0, 100]]) manager.pointerDown(at(...point as [number, number]));
		const release = h.gateNextDispatch();
		manager.finishActiveTool();
		manager.finishActiveTool();
		release();
		await flushGesture();
		expect(h.dispatched).toHaveLength(1);
		expect(h.context.selection.selectedIds).toEqual(['zone-created']);
	});
});
