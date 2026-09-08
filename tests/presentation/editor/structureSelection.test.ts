import { describe, expect, it, vi } from 'vitest';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { SelectTool } from '../../../src/presentation/editor/tools/select-tool';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { WALL_LOOP } from '../../helpers/structure';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import { ok } from '../../../src/core/result/Result';

const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0 }] };
const room = { id: 'room-a', points: WALL_LOOP.walls.map(wall => wall.start) };
const candidates = [...structureCandidates(structure), room];
describe('typed wall and opening selection', () => {
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
	it('ranks a generic element below opening and wall and above the room, and cycles all four', () => {
		const element = { id: 'element-a', kind: 'measurement' as const, points: [{ x: 800, y: -500 }, { x: 800, y: 500 }] };
		const base = { candidates: [...candidates, element], selectedIds: [], worldPoint: { x: 800, y: 0 }, handleToleranceWorld: 10 };
		expect(resolveSelectionTarget(base)).toEqual({ kind: 'body', id: 'opening-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['opening-a'], cycle: true })).toEqual({ kind: 'body', id: 'wall-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['wall-a'], cycle: true })).toEqual({ kind: 'body', id: 'element-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['element-a'], cycle: true })).toEqual({ kind: 'body', id: 'room-a' });
		expect(resolveSelectionTarget({ ...base, selectedIds: ['room-a'], cycle: true })).toEqual({ kind: 'body', id: 'opening-a' });
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
