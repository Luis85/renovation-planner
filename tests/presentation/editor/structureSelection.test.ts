import { describe, expect, it, vi } from 'vitest';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { SelectTool } from '../../../src/presentation/editor/tools/select-tool';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { WALL_LOOP } from '../../helpers/structure';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import { ok } from '../../../src/core/result/Result';
import { selectSpatial } from '../../../src/presentation/editor/selection/selectSpatial';

const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0 }] };
const room = { id: 'room-a', points: WALL_LOOP.walls.map(wall => wall.start) };
const candidates = [...structureCandidates(structure), room];
describe('typed wall and opening selection', () => {
	it.each([
		['Object body', 'object-a', 800, 0], ['Opening body', 'opening-a', 1200, 0], ['Wall body', 'wall-a', 2000, 0],
		['Object badge', 'object-a', 600, -100], ['Opening badge', 'opening-a', 500, 0], ['Wall badge', 'wall-a', 0, 0],
	] as const)('focuses %s without collapsing mixed membership or starting a geometry edit', (label, id, x, y) => {
		void label;
		const object = { id: 'object-a', kind: 'object' as const, points: [{ x: 600, y: -100 }, { x: 1000, y: -100 }, { x: 1000, y: 100 }, { x: 600, y: 100 }] };
		const { context, dispatched } = toolContext();
		const tool = new SelectTool({ spatialObjects: () => [object, ...candidates],
			createMoveGesture: () => { throw new Error('Focus must not write'); }, moveElement: () => { throw new Error('Focus must not move'); },
			reportRejected: () => undefined, reportInvalidInput: () => undefined });
		tool.activate(context);
		context.selection.select(['room-a', id] as never[]); context.selection.focus('room-a' as never);
		const members = context.selection.selectedIds;
		tool.pointerDown(pointerAt(x, y));
		expect(context.selection.selectedIds).toBe(members); expect(context.selection.focusedId).toBe(id);
		expect(tool.hasDraft()).toBe(false);
		tool.pointerMove(pointerAt(x + 100, y + 100)); tool.pointerUp(pointerAt(x + 100, y + 100));
		expect(dispatched).toEqual([]); expect(context.selection.selectedIds).toBe(members); tool.deactivate();
	});
	it('shares Object-first hover and click while Alt, list identity and Shift retain the same selection set', () => {
		const object = { id: 'object-a', kind: 'object' as const, points: [{ x: 600, y: -100 }, { x: 1000, y: -100 }, { x: 1000, y: 100 }, { x: 600, y: 100 }] };
		const { context, dispatched } = toolContext();
		const tool = new SelectTool({ spatialObjects: () => [object, ...candidates],
			createMoveGesture: () => { throw new Error('Selection must not write'); }, reportRejected: () => undefined, reportInvalidInput: () => undefined });
		tool.activate(context);
		const at = pointerAt(800, 0);
		tool.pointerMove(at); expect(context.renderState.hoveredObjectId).toBe('object-a');
		tool.pointerDown(at); tool.pointerUp(at); expect(context.selection.selectedIds).toEqual(['object-a']);
		const alt = { ...at, modifiers: { shift: false, ctrl: false, alt: true } };
		tool.pointerMove(alt); expect(context.renderState.hoveredObjectId).toBe('opening-a');
		tool.pointerDown(alt); tool.pointerUp(alt); expect(context.selection.selectedIds).toEqual(['opening-a']);
		// The non-canvas list invokes the same ID-based action, independently of hit priority.
		selectSpatial(context.selection, 'room-a', true);
		const shift = { ...at, modifiers: { shift: true, ctrl: false, alt: false } };
		tool.pointerDown(shift); tool.pointerUp(shift);
		expect(context.selection.selectedIds).toEqual(['opening-a', 'room-a', 'object-a']);
		tool.pointerDown(shift); tool.pointerUp(shift);
		expect(context.selection.selectedIds).toEqual(['opening-a', 'room-a']);
		expect(dispatched).toEqual([]); tool.deactivate();
	});
	it('prioritizes opening, wall, then room regardless of paint order and cycles all three', () => {
		const base = { candidates, selectedIds: [], worldPoint: { x: 800, y: 0 }, handleToleranceWorld: 10 };
		expect(resolveSelectionTarget(base)).toEqual({ kind: 'body', id: 'opening-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['opening-a'], cycle: true })).toEqual({ kind: 'body', id: 'wall-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['wall-a'], cycle: true })).toEqual({ kind: 'body', id: 'room-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['room-a'], cycle: true })).toEqual({ kind: 'body', id: 'opening-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['opening-a'], worldPoint: { x: 500, y: 0 } })).toEqual({ kind: 'body', id: 'opening-a' });
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 1700, y: 60 } })).toEqual({ kind: 'body', id: 'wall-a' });
		expect(resolveSelectionTarget({ ...base, candidates: [{ id: 'wall-empty', kind: 'wall', points: [] }], worldPoint: { x: 0, y: 0 } })).toBeNull();
	});
	it('keeps bodies selectable, previews only a selected wall end, and shares the reviewed edit callback', () => {
		const editWall = vi.fn<(id: string, end: { x: number; y: number }) => void>(), previewWall = vi.fn<(id: string | null, end?: { x: number; y: number }) => void>();
		const createMoveGesture = vi.fn<() => { execute: () => Promise<ReturnType<typeof ok<'no-write'>>>; undo: () => Promise<ReturnType<typeof ok<'no-write'>>> }>(() => ({ execute: () => Promise.resolve(ok('no-write')), undo: () => Promise.resolve(ok('no-write')) }));
		const tool = new SelectTool({ spatialObjects: () => candidates, createMoveGesture, editWall, previewWall, reportRejected: () => undefined, reportInvalidInput: () => undefined });
		const { context } = toolContext(); tool.activate(context);
		tool.pointerDown(pointerAt(2000, 0)); tool.pointerUp(pointerAt(2000, 0)); expect(context.selection.selectedIds).toEqual(['wall-a']);
		tool.pointerDown(pointerAt(0, 0)); expect(tool.hasDraft()).toBe(false);
		tool.pointerDown(pointerAt(4000, 0)); expect(tool.hasDraft()).toBe(true);
		tool.pointerMove(pointerAt(5000, 0)); expect(previewWall).toHaveBeenLastCalledWith('wall-a', { x: 5000, y: 0 });
		tool.pointerUp({ ...pointerAt(5000, 0), button: 'secondary' }); expect(editWall).not.toHaveBeenCalled();
		tool.pointerUp(pointerAt(5000, 0)); expect(editWall).toHaveBeenCalledExactlyOnceWith('wall-a', { x: 5000, y: 0 });
		tool.pointerDown(pointerAt(4000, 0)); tool.pointerUp(pointerAt(4000, 0)); expect(editWall).toHaveBeenCalledOnce();
		tool.pointerDown(pointerAt(4000, 0)); tool.cancel(); expect(tool.hasDraft()).toBe(false); expect(previewWall).toHaveBeenLastCalledWith(null);
		tool.pointerDown(pointerAt(800, 0)); tool.pointerUp(pointerAt(1000, 0)); expect(context.selection.selectedIds).toEqual(['opening-a']);
		expect(createMoveGesture).not.toHaveBeenCalled(); tool.deactivate();
	});
});
