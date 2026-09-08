import { describe, expect, it, vi } from 'vitest';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { SpatialObjectCandidate, SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import type { SelectionInteractions } from '../../../../src/presentation/editor/selection/selectionInteractions';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import { pointerAt, shiftPointerAt, toolContext } from '../../../helpers/tool-context';
import { ok } from '../../../../src/core/result/Result';
const square = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }];
function setup(candidates: readonly SpatialObjectCandidate[], interactions: SelectionInteractions = {}) {
	const harness = toolContext(), move = vi.fn<SelectToolDeps['createMoveGesture']>(() => ({ execute: () => Promise.resolve(ok('wrote' as const)), undo: () => Promise.resolve(ok('wrote' as const)) }));
	const tool = new SelectTool({ ...interactions, spatialObjects: () => candidates, createMoveGesture: move, reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>() });
	tool.activate(harness.context); return { ...harness, tool, move };
}
describe('empty-canvas marquee selection', () => {
	it('includes a stair footprint when the marquee misses its canonical centreline', () => {
		const points = [{ x: 100, y: 0 }, { x: 100, y: 200 }], hitPoints = [{ x: 50, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 200 }, { x: 50, y: 200 }];
		const { tool, context, move } = setup([{ id: 'element-stair', kind: 'stair', points, hitPoints }]);
		tool.pointerDown(pointerAt(0, 50)); tool.pointerUp(pointerAt(70, 100));
		expect(context.selection.selectedIds).toEqual(['element-stair']);
		expect(points).toEqual([{ x: 100, y: 0 }, { x: 100, y: 200 }]);
		expect(move).not.toHaveBeenCalled();
	});
	it('intersects real geometry, excludes a diagonal bounding-box false positive, and writes no command', () => {
		const { tool, context, move } = setup([{ id: 'room', points: square }, { id: 'diagonal', kind: 'path', points: [{ x: 0, y: 100 }, { x: 100, y: 0 }] }]);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(35, 35));
		expect(context.renderState.marquee).toEqual({ min: { x: 0, y: 0 }, max: { x: 35, y: 35 } });
		tool.pointerUp(pointerAt(35, 35));
		expect(context.selection.selectedIds).toEqual(['room']); expect(move).not.toHaveBeenCalled(); expect(context.renderState.marquee).toBeNull();
	});
	it('adds without duplicates with Shift and restores the opening selection when interrupted', () => {
		const { tool, context } = setup([{ id: 'room', points: square }]);
		context.selection.select(['room' as never]);
		tool.pointerDown(shiftPointerAt(0, 0)); tool.pointerUp(shiftPointerAt(100, 100));
		expect(context.selection.selectedIds).toEqual(['room']);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(10, 10)); tool.abandonGesture();
		expect(context.selection.selectedIds).toEqual(['room']); expect(context.renderState.marquee).toBeNull();
	});
	it('retains Object-first body click priority instead of starting a marquee', () => {
		const { tool, context } = setup([{ id: 'room', points: square }, { id: 'object', kind: 'object', points: square }]);
		tool.pointerDown(pointerAt(50, 50)); tool.pointerUp(pointerAt(50, 50));
		expect(context.selection.selectedIds).toEqual(['object']); expect(context.renderState.marquee).toBeNull();
	});
	it('expands a saved group and delegates its entire drag without falling back to a member edit', () => {
		let active = false;
		const start = vi.fn<(ids: readonly string[], event: EditorPointerEvent) => boolean>(() => { active = true; return true; }), moveGroup = vi.fn<(event: EditorPointerEvent) => void>(), finish = vi.fn<(event: EditorPointerEvent) => void>(() => { active = false; });
		const { tool, context, move } = setup([{ id: 'one', points: square }], { expandSelection: (_id, deep) => deep ? ['one'] : ['one', 'two'], selectionMove: { get active() { return active; }, start, move: moveGroup, finish, cancel: () => { active = false; } } });
		tool.pointerDown(pointerAt(50, 50)); tool.pointerMove(pointerAt(70, 70)); tool.pointerUp(pointerAt(70, 70));
		expect(context.selection.selectedIds).toEqual(['one', 'two']); expect(start.mock.calls[0]?.[0]).toEqual(['one', 'two']);
		expect(moveGroup).toHaveBeenCalledOnce(); expect(finish).toHaveBeenCalledOnce(); expect(move).not.toHaveBeenCalled();
	});
});
