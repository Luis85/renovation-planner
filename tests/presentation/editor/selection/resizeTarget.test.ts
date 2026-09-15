import { expect, it } from 'vitest';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';

const item = { id: 'element-item', kind: 'object' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }] };
const points = [{ x: -12, y: -12 }, { x: 500, y: -12 }, { x: 1012, y: -12 }, { x: 1012, y: 250 }, { x: 1012, y: 512 }, { x: 500, y: 512 }, { x: -12, y: 512 }, { x: -12, y: 250 }];
const base = { candidates: [item], selectedIds: [item.id], handleToleranceWorld: 8, resizeHandles: { id: item.id, points } };

it('answers a transform box handle for the one selected element, below its vertex handle and above its body', () => {
	expect(resolveSelectionTarget({ ...base, worldPoint: { x: 1014, y: 514 } })).toEqual({ kind: 'resize', id: item.id, handleIndex: 4 });
	expect(resolveSelectionTarget({ ...base, worldPoint: { x: -12, y: 250 } })).toEqual({ kind: 'resize', id: item.id, handleIndex: 7 });
	const crowded = { ...base, resizeHandles: { id: item.id, points: [{ x: -4, y: -4 }, ...points.slice(1)] } };
	expect(resolveSelectionTarget({ ...crowded, worldPoint: { x: -2, y: -2 } })).toEqual({ kind: 'handle', id: item.id, vertexIndex: 0 });
	expect(resolveSelectionTarget({ ...base, worldPoint: { x: 500, y: 250 } })).toEqual({ kind: 'body', id: item.id });
});

it('offers no transform box handle to a multi-selection, another selection, a Shift-cleared selection or Alt cycling', () => {
	const other = { ...item, id: 'element-other', points: item.points.map(point => ({ x: point.x + 5000, y: point.y })) };
	const at = { x: 1012, y: 512 };
	expect(resolveSelectionTarget({ ...base, candidates: [item, other], selectedIds: [item.id, other.id], worldPoint: at })).toBeNull();
	expect(resolveSelectionTarget({ ...base, candidates: [item, other], selectedIds: [other.id], worldPoint: at })).toBeNull();
	expect(resolveSelectionTarget({ ...base, selectedIds: [], worldPoint: at })).toBeNull();
	expect(resolveSelectionTarget({ ...base, worldPoint: at, cycle: true })).toBeNull();
});
