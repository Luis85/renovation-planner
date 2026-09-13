import { describe, expect, it } from 'vitest';
import { pointerAt as at } from '../../../helpers/tool-context';
import { build, harness } from '../../../helpers/drawPolygonHarness';

/**
 * Smart alignment guides: `DrawPolygonTool` reads the shared `context.snapCandidates()` and
 * writes the guides `snapPointWithGuides` answers. Its own file because
 * `drawPolygonTool.test.ts` is at the 450-line `max-lines` budget.
 */
describe('DrawPolygonTool: alignment guides', () => {
	it('the landing point aligns to a neighbour on one axis and the guide is drawn, then cleared with the sketch', () => {
		const h = harness({ snapCandidates: () => ({ alignments: [{ x: 300, y: 900 }] }) });
		const tool = build(h);
		tool.activate(h.context);
		tool.pointerDown(at(0, 0));
		tool.pointerMove(at(297, 50));
		expect(h.context.renderState.polygonSketch?.nextVertex).toEqual({ x: 300, y: 50 });
		expect(h.context.renderState.snapGuides).toEqual([{ start: { x: 300, y: 50 }, end: { x: 300, y: 900 } }]);
		tool.cancel();
		expect(h.context.renderState.snapGuides).toEqual([]);
	});

	it('abandonGesture clears the guide and leaves the placed vertices standing', () => {
		// Spec §5 names `abandonGesture` as a clearing site. It is otherwise the documented no-op:
		// focus loss must not destroy the polygon, so the buffer and its sketch survive it.
		const h = harness({ snapCandidates: () => ({ alignments: [{ x: 300, y: 900 }] }) });
		const tool = build(h);
		tool.activate(h.context);
		tool.pointerDown(at(0, 0));
		tool.pointerMove(at(297, 50));
		expect(h.context.renderState.snapGuides).toHaveLength(1);
		tool.abandonGesture();
		expect(h.context.renderState.snapGuides).toEqual([]);
		expect(h.context.renderState.polygonSketch?.vertices).toEqual([{ x: 0, y: 0 }]);
		expect(tool.hasDraft()).toBe(true);
	});
});
