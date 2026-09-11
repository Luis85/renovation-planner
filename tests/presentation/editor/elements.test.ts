import { describe, expect, it, vi } from 'vitest';
import { createElementDraft, draftElement, isElementTool } from '../../../src/presentation/editor/elements/elementDraft';
import { ElementTool } from '../../../src/presentation/editor/elements/ElementTool';
import { ElementMove } from '../../../src/presentation/editor/elements/ElementMove';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { structureRecords } from '../../../src/presentation/editor/structure/structureRecords';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import type { Point } from '../../../src/core/geometry/Point';
import { toolContext, pointerAt } from '../../helpers/tool-context';

const points = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 0, y: 1000 }];
describe('spatial element drafts and real selection projections', () => {
	it('keeps unfinished/zero-area Object drafts unavailable and preserves exact valid points', () => {
		const draft = createElementDraft(); expect(draftElement(draft)).toBeNull(); draft.points = points; expect(draftElement(draft)).toBeNull();
		draft.name = ' Radiator '; expect(draftElement(draft)).toMatchObject({ id: 'element-draft', name: 'Radiator', points });
		draft.points = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]; expect(draftElement(draft)).toBeNull();
		draft.kind = 'path'; expect(draftElement(draft)).not.toBeNull(); draft.kind = 'measurement'; expect(draftElement(draft)).toBeNull();
		draft.points.pop(); expect(draftElement(draft)).not.toBeNull(); expect(isElementTool(null)).toBe(false); expect(isElementTool('select')).toBe(false); expect(isElementTool('measure')).toBe(true);
	});
	it('joins canonical labels and hit-tests an Object interior and every path segment', () => {
		const structure = { ...EMPTY_STRUCTURE, elements: [{ id: 'element-object', kind: 'object' as const, points }, { id: 'element-path', kind: 'path' as const, points: [{ x: 3000, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 2000 }] }] };
		const records = structureRecords(structure, 'plan', [{ id: 'element-object', name: 'Radiator' }]);
		expect(records[0]).toMatchObject({ name: 'Radiator', areaMm2: 2_000_000, kind: 'object' }); expect(records[1].name).toBe('element-path');
		const input = { candidates: structureCandidates(structure), selectedIds: [], handleToleranceWorld: 10 };
		expect(resolveSelectionTarget({ ...input, worldPoint: { x: 1000, y: 500 } })).toEqual({ kind: 'body', id: 'element-object' });
		expect(resolveSelectionTarget({ ...input, selectedIds: ['element-path'], worldPoint: { x: 4005, y: 1500 } })).toEqual({ kind: 'body', id: 'element-path' });
		expect(resolveSelectionTarget({ ...input, worldPoint: { x: 3500, y: 1000 } })).toBeNull();
	});
	it('snaps placed points, preserves them on blur, and cancels a conflicted draft without writing', () => {
		const draft = createElementDraft(), start = vi.fn<(id: string) => void>(), stop = vi.fn<() => void>(), finish = vi.fn<() => void>();
		let blocked = false;
		const addPoint = vi.fn<(point: Point) => boolean>(point => { draft.points.push(point); return true; });
		const tool = new ElementTool('draw-path', { draft, start, stop, finish, addPoint, blocked: () => blocked, candidates: () => ({}) });
		const r = toolContext({ snapPoint: point => ({ x: Math.round(point.x), y: Math.round(point.y) }) });
		tool.pointerDown(pointerAt(10, 20)); expect(addPoint).not.toHaveBeenCalled();
		tool.activate(r.context); expect(start).toHaveBeenCalledWith('draw-path');
		tool.pointerDown({ ...pointerAt(10, 20), button: 'secondary' }); expect(addPoint).not.toHaveBeenCalled();
		tool.pointerDown(pointerAt(10.2, 20.3)); expect(draft.points).toEqual([{ x: 10, y: 20 }]); expect(tool.hasDraft()).toBe(true);
		tool.abandonGesture(); expect(draft.cursor).toBeNull(); expect(draft.points).toHaveLength(1);
		expect(tool.editCorner(-1, { x: 15, y: 25 })).toBe(true); expect(tool.editCorner(8, null)).toBe(false);
		blocked = true; tool.pointerMove(pointerAt(30, 40)); tool.pointerDown(pointerAt(30, 40)); expect(draft.points).toHaveLength(1); expect(tool.editCorner(-1, null)).toBe(false);
		draft.busy = true; tool.cancel(); expect(tool.hasDraft()).toBe(true); draft.busy = false; tool.cancel(); expect(tool.hasDraft()).toBe(false);
		blocked = false; tool.pointerDown(pointerAt(10, 20)); expect(tool.editCorner(-1, null)).toBe(true); expect(tool.editCorner(-1, null)).toBe(false);
		tool.finish(); expect(finish).toHaveBeenCalledOnce(); tool.pointerUp(); tool.deactivate(); expect(stop).toHaveBeenCalledOnce();
		tool.pointerMove(pointerAt(20, 30)); expect(r.dispatched).toEqual([]);
	});
	it('places no point when a press becomes blocked between its own two blocked() reads', () => {
		// `pointerDown` asks `inputContext()` once for itself and once again, implicitly,
		// through the `pointerMove` it calls — and `inputContext()` re-reads `blocked()` each
		// time rather than caching it. A `blocked()` that flips true between those two reads
		// (the trust path clamping shut mid-gesture) leaves `pointerMove`'s own guard refusing
		// to set `draft.cursor`, so the press's `if (this.deps.draft.cursor)` finds it still
		// null and never calls `addPoint`.
		const draft = createElementDraft(), start = vi.fn<(id: string) => void>(), stop = vi.fn<() => void>(), finish = vi.fn<() => void>();
		const addPoint = vi.fn<(point: Point) => boolean>(point => { draft.points.push(point); return true; });
		let reads = 0;
		const blocked = () => { reads += 1; return reads > 1; };
		const tool = new ElementTool('draw-path', { draft, start, stop, finish, addPoint, blocked, candidates: () => ({}) });
		const r = toolContext();
		tool.activate(r.context);

		tool.pointerDown(pointerAt(10, 20));

		expect(draft.cursor).toBeNull();
		expect(addPoint).not.toHaveBeenCalled();
	});
	it('translates Object/line bodies only on a completed meaningful primary drag', () => {
		const preview = vi.fn<(id: string | null, points?: readonly Point[]) => void>(), move = vi.fn<(id: string, points: readonly Point[]) => void>();
		const gesture = new ElementMove({ previewElement: preview, moveElement: move }), r = toolContext({ worldPerScreenPixel: 10 });
		const hit = { id: 'element-object', kind: 'object' as const, points };
		gesture.move(pointerAt(10, 20)); gesture.finish(r.context, pointerAt(10, 20)); expect(move).not.toHaveBeenCalled();
		gesture.start(r.context, pointerAt(0, 0), hit); gesture.move(pointerAt(100, 200)); expect(preview).toHaveBeenLastCalledWith(hit.id, points.map(point => ({ x: point.x + 100, y: point.y + 200 })));
		gesture.finish(r.context, { ...pointerAt(100, 200), button: 'secondary' }); expect(gesture.active).toBe(true); expect(move).not.toHaveBeenCalled();
		gesture.finish(r.context, pointerAt(100, 200)); expect(gesture.active).toBe(false); expect(move).toHaveBeenCalledOnce(); expect(preview).toHaveBeenLastCalledWith(hit.id, points.map(point => ({ x: point.x + 100, y: point.y + 200 })));
		gesture.start(r.context, pointerAt(0, 0), hit); gesture.finish(r.context, pointerAt(1, 1)); expect(move).toHaveBeenCalledOnce();
		gesture.start(r.context, pointerAt(0, 0), hit); gesture.cancel(); expect(gesture.active).toBe(false);
		gesture.start({ ...r.context, writesBlocked: () => true }, pointerAt(0, 0), hit); expect(gesture.active).toBe(false);
		gesture.start(r.context, { ...pointerAt(0, 0), modifiers: { shift: true, ctrl: false, alt: false } }, hit); expect(gesture.active).toBe(false);
		gesture.start(r.context, pointerAt(0, 0), hit); gesture.finish({ ...r.context, writesBlocked: () => true }, pointerAt(100, 100)); expect(move).toHaveBeenCalledOnce();
		const unavailable = new ElementMove({}); unavailable.start(r.context, pointerAt(0, 0), hit); expect(unavailable.active).toBe(false); unavailable.cancel();
	});
});
