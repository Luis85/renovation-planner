import { describe, expect, it, vi } from 'vitest';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { SpatialObjectCandidate, SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import type { SelectionInteractions } from '../../../../src/presentation/editor/selection/selectionInteractions';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import { pointerAt, shiftPointerAt, toolContext } from '../../../helpers/tool-context';
import { ok } from '../../../../src/core/result/Result';
const square = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }];
function setup(candidates: readonly SpatialObjectCandidate[], interactions: SelectionInteractions = {}, writesBlocked = false) {
	const harness = toolContext({ writesBlocked }), move = vi.fn<SelectToolDeps['createMoveGesture']>(() => ({ execute: () => Promise.resolve(ok('wrote' as const)), undo: () => Promise.resolve(ok('wrote' as const)) }));
	const tool = new SelectTool({ ...interactions, spatialObjects: () => candidates, createMoveGesture: move, reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>() });
	tool.activate(harness.context); return { ...harness, tool, move };
}
describe('empty-canvas marquee selection', () => {
	it('adds and removes a whole group with Shift while Alt inspects only the member', () => {
		const start = vi.fn<(ids: readonly string[], event: EditorPointerEvent) => boolean>(() => false);
		const { tool, context, move } = setup([{ id: 'one', points: square }], { expandSelection: (_id, deep) => deep ? ['one'] : ['one', 'two'], selectionMove: { active: false, start, move: () => undefined, finish: () => undefined, cancel: () => undefined } });
		context.selection.select(['one' as never, 'two' as never]);
		tool.pointerDown(shiftPointerAt(50, 50)); tool.pointerUp(shiftPointerAt(50, 50)); expect(context.selection.selectedIds).toEqual([]);
		tool.pointerDown(shiftPointerAt(50, 50)); tool.pointerUp(shiftPointerAt(50, 50)); expect(context.selection.selectedIds).toEqual(['one', 'two']);
		const alt = { ...pointerAt(50, 50), modifiers: { shift: false, ctrl: false, alt: true } };
		tool.pointerDown(alt); tool.pointerUp(alt); expect(context.selection.selectedIds).toEqual(['one']);
		expect(start).not.toHaveBeenCalled(); expect(move).not.toHaveBeenCalled();
	});
	it.each([false, true])('keeps group selection inspectable without a member-write fallback when refused or paused=%s', paused => {
		const start = vi.fn<(ids: readonly string[], event: EditorPointerEvent) => boolean>(() => false);
		const { tool, context, move } = setup([{ id: 'one', points: square }], { expandSelection: () => ['one', 'two'], selectionMove: { active: false, start, move: () => undefined, finish: () => undefined, cancel: () => undefined } }, paused);
		tool.pointerDown(pointerAt(50, 50)); tool.pointerMove(pointerAt(65, 65)); tool.pointerUp(pointerAt(65, 65));
		expect(context.selection.selectedIds).toEqual(['one', 'two']);
		tool.pointerDown(pointerAt(50, 50)); tool.pointerUp(pointerAt(50, 50));
		expect(context.selection.focusedId).toBe('one'); expect(start).toHaveBeenCalledTimes(paused ? 0 : 2); expect(move).not.toHaveBeenCalled();
	});
	it('waits for primary release and drops a deleted selected record from an additive marquee', () => {
		const { tool, context, move } = setup([{ id: 'one', points: square }]);
		context.selection.select(['retired' as never]);
		tool.pointerDown(shiftPointerAt(-100, -100)); tool.pointerMove(shiftPointerAt(100, 100));
		tool.pointerUp({ ...shiftPointerAt(100, 100), button: 'secondary' }); expect(context.renderState.marquee).not.toBeNull();
		tool.pointerUp(shiftPointerAt(100, 100)); expect(context.selection.selectedIds).toEqual(['one']); expect(context.renderState.marquee).toBeNull();
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
