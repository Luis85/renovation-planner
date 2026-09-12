import { describe, expect, it, vi } from 'vitest';
import { StructureTool } from '../../../../src/presentation/editor/structure/StructureTool';
import { createStructureDraft, type StructureToolId } from '../../../../src/presentation/editor/structure/structureDraft';
import { EMPTY_STRUCTURE, type Wall } from '../../../../src/domain/spatial/Structure';
import { toolContext, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';
import { WALL_LOOP } from '../../../helpers/structure';
import { createEditorSnapService } from '../../../../src/presentation/editor/snapping/editorSnapping';

function wallTool(structure = WALL_LOOP) {
	const draft = createStructureDraft();
	const finish = vi.fn<() => void>();
	const tool = new StructureTool('draw-wall', { draft, structure: () => structure, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish, blocked: () => false });
	tool.activate(toolContext().context);
	return { draft, finish, tool };
}

describe('StructureTool', () => {
	it('shows a pending join while the cursor is on a wall body, and none at an endpoint or in free space', () => {
		const { draft, tool } = wallTool();
		tool.pointerMove(pointerAt(1234.4, 5));
		expect(draft.pending).toMatchObject({ wallId: 'wall-a', offset: 1234, perpendicular: false });
		expect(draft.cursor).toEqual({ x: 1234, y: 0 }); expect(draft.snapped).toBe(true);
		tool.pointerMove(pointerAt(3996, 3));
		expect(draft.pending).toBeNull(); expect(draft.cursor).toEqual({ x: 4000, y: 0 });
		tool.pointerMove(pointerAt(2000, 1500));
		expect(draft.pending).toBeNull(); expect(draft.snapped).toBe(false);
	});
	it('starts the chain on a wall body with a click, cutting the host, and keeps drawing', () => {
		const { draft, finish, tool } = wallTool();
		tool.pointerDown(pointerAt(1000.3, 4));
		expect(draft.points).toEqual([{ x: 1000, y: 0 }]);
		expect(draft.joins.start).toMatchObject({ wallId: 'wall-a', offset: 1000 });
		expect(draft.pending).toBeNull(); expect(finish).not.toHaveBeenCalled();
	});
	it('ends the chain on a wall body with a click and finishes at once, preferring the perpendicular foot', () => {
		const { draft, finish, tool } = wallTool();
		tool.pointerDown(pointerAt(2000, 1500));
		// Slightly off the perpendicular foot: the foot at (2000, 0) wins.
		tool.pointerMove(pointerAt(2004, 3));
		expect(draft.pending).toMatchObject({ wallId: 'wall-a', offset: 2000, perpendicular: true });
		tool.pointerDown(pointerAt(2004, 3));
		expect(draft.points).toEqual([{ x: 2000, y: 1500 }, { x: 2000, y: 0 }]);
		expect(draft.joins.end).toMatchObject({ wallId: 'wall-a', offset: 2000 });
		expect(finish).toHaveBeenCalledOnce();
	});
	it('does not finish when the end is refused, and leaves the chain in place', () => {
		const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 };
		const { draft, finish, tool } = wallTool({ ...WALL_LOOP, openings: [door] });
		tool.pointerDown(pointerAt(900, 1500));
		tool.pointerDown(pointerAt(900, 3));
		expect(draft.points).toHaveLength(1); expect(draft.error?.code).toBe('spatial.opening-split');
		expect(finish).not.toHaveBeenCalled();
	});
	it('keeps the Shift angle exact by intersecting the constrained ray with the wall', () => {
		const { draft, tool } = wallTool();
		tool.pointerDown(pointerAt(1000, 1000));
		// 45° from (1000, 1000) reaches wall-a at (2000, 0); the raw cursor is a few mm off the line.
		tool.pointerMove(shiftPointerAt(1997, 6));
		expect(draft.pending).toMatchObject({ wallId: 'wall-a', offset: 2000, perpendicular: false });
		expect(draft.cursor).toEqual({ x: 2000, y: 0 });
	});
	it('drops the start join with the first point, and cancel clears both joins', () => {
		const { draft, tool } = wallTool();
		tool.pointerDown(pointerAt(1000, 4)); tool.pointerDown(pointerAt(1000, 1500));
		expect(tool.editCorner(-1, null)).toBe(true); expect(draft.joins.start).not.toBeNull();
		expect(tool.editCorner(-1, null)).toBe(true); expect(draft.joins.start).toBeNull(); expect(draft.points).toEqual([]);
		tool.pointerDown(pointerAt(2000, 4)); expect(draft.joins.start).not.toBeNull();
		tool.cancel();
		expect(draft.joins).toEqual({ start: null, end: null }); expect(draft.pending).toBeNull(); expect(draft.points).toEqual([]);
	});
	it('offers no join while snapping is switched off', () => {
		const draft = createStructureDraft();
		const tool = new StructureTool('draw-wall', { draft, structure: () => WALL_LOOP, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(), blocked: () => false });
		// `enabled` is a getter over the callback the service is built with, so a disabled service is built, not assigned.
		tool.activate({ ...toolContext().context, snapService: createEditorSnapService(() => false) });
		tool.pointerMove(pointerAt(1234, 5));
		expect(draft.pending).toBeNull(); expect(draft.cursor).toEqual({ x: 1234, y: 5 }); expect(draft.snapped).toBe(false);
	});
	it('finishes a place-door press the moment it lands snapped on a wall, and does nothing off one', () => {
		const wall: Wall = { id: 'wall-1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
		const structure = { ...EMPTY_STRUCTURE, walls: [wall] };
		const draft = createStructureDraft();
		const start = vi.fn<(kind: StructureToolId) => void>(), stop = vi.fn<() => void>(), finish = vi.fn<() => void>();
		const tool = new StructureTool('place-door', { draft, structure: () => structure, start, stop, finish, blocked: () => false });
		const r = toolContext();
		tool.activate(r.context);

		// Off the wall entirely: pickHost finds no hit, draft.snapped stays false, the press finishes nothing.
		tool.pointerDown(pointerAt(2000, 5000));
		expect(finish).not.toHaveBeenCalled();

		// Squarely on the wall: pickHost hits, draft.snapped becomes true, and the press finishes the tool
		// (a non-draw-wall tool has no multi-point buffer — a snapped press IS the whole placement).
		tool.pointerDown(pointerAt(2000, 0));
		expect(finish).toHaveBeenCalledOnce();
	});
});
