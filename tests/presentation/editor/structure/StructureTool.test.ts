import { describe, expect, it, vi } from 'vitest';
import { StructureTool } from '../../../../src/presentation/editor/structure/StructureTool';
import { createStructureDraft, type StructureToolId } from '../../../../src/presentation/editor/structure/structureDraft';
import { EMPTY_STRUCTURE, type Wall } from '../../../../src/domain/spatial/Structure';
import { toolContext, pointerAt } from '../../../helpers/tool-context';

describe('StructureTool', () => {
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
