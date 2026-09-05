import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { spatialSelection } from '../../../../src/presentation/editor/selection/spatialSelection';
import { selectSpatial } from '../../../../src/presentation/editor/selection/selectSpatial';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { toSpatialRecordDto } from '../../../../src/presentation/read-models/spatialRecords';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const records = ['Room', 'Terrace'].map((zoneType, index) => toSpatialRecordDto({
	id: `record-${index}`, planId: 'floor', name: zoneType, zoneType, status: 'Planned', points,
}));

describe('M11 typed selection and shared input action', () => {
	it('keeps unavailable members explicit and never turns an entirely unreadable selection into a zero area', () => {
		expect(spatialSelection(['gone', 'record-0'], records)).toMatchObject({ kind: 'multiple', unavailable: 1, areaMm2: 10000, sharedType: null });
		expect(spatialSelection(['gone', 'also-gone'], records)).toMatchObject({ kind: 'multiple', unavailable: 2, areaMm2: null, sharedType: null });
	});
	it('resolves floor, room and area without inventing a record for an absent ID', () => {
		expect(spatialSelection(['gone'], records)).toEqual({ kind: 'floor' });
		expect(spatialSelection(['record-0'], records)).toEqual({ kind: 'room', record: records[0] });
		expect(spatialSelection(['record-1'], records)).toEqual({ kind: 'area', record: records[1] });
	});
	it('preserves selection order and focus independently, deduplicates IDs and retires focus deterministically', () => {
		setActivePinia(createPinia());
		const selection = useSelectionStore();
		selection.select(['record-1', 'record-0', 'record-1'] as never[]);
		expect(selection.selectedIds).toEqual(['record-1', 'record-0']);
		const members = selection.selectedIds;
		selection.focus('record-0' as never);
		expect(selection.focusedId).toBe('record-0');
		expect(selection.selectedIds).toBe(members);
		selection.focus('gone' as never);
		expect(selection.focusedId).toBe('record-0');
		expect(spatialSelection(selection.selectedIds, records)).toMatchObject({ records: [records[1], records[0]] });
		selection.select(['record-1'] as never[]);
		expect(selection.focusedId).toBe('record-1');
		selection.select([]);
		expect(selection.focusedId).toBeNull();
		selection.select(['record-1'] as never[]);
		selection.clear();
		expect(selection.focusedId).toBeNull();
	});
	it('counts overlapping areas separately and exposes only genuinely shared types', () => {
		expect(spatialSelection(['record-0', 'record-1', 'record-0'], records)).toMatchObject({
			kind: 'multiple', areaMm2: 20000, sharedType: null,
		});
		expect(spatialSelection(['record-0', 'record-1'], records.map((record) => ({ ...record, zoneType: 'Room' })))).toMatchObject({ sharedType: 'Room' });
	});
	it('toggle adds and removes while replacement has exactly one target', () => {
		setActivePinia(createPinia());
		const selection = useSelectionStore();
		selectSpatial(selection, 'record-0', false);
		selectSpatial(selection, 'record-1', true);
		expect(selection.selectedIds).toEqual(['record-0', 'record-1']);
		selectSpatial(selection, 'record-0', true);
		expect(selection.selectedIds).toEqual(['record-1']);
		selectSpatial(selection, 'record-0', false);
		expect(selection.selectedIds).toEqual(['record-0']);
	});
});

describe('M00 overlap selection', () => {
	const candidates = records.map((record) => ({ id: record.id, points: record.points }));
	const input = { candidates, worldPoint: { x: 50, y: 50 }, handleToleranceWorld: 5, cycle: true };
	it('cycles top to bottom, wraps, and starts at the top for an unrelated selection', () => {
		expect(resolveSelectionTarget({ ...input, selectedIds: ['elsewhere'] })).toEqual({ kind: 'body', id: 'record-1' });
		expect(resolveSelectionTarget({ ...input, selectedIds: ['record-1'] })).toEqual({ kind: 'body', id: 'record-0' });
		expect(resolveSelectionTarget({ ...input, selectedIds: ['record-0'] })).toEqual({ kind: 'body', id: 'record-1' });
		expect(resolveSelectionTarget({ ...input, worldPoint: { x: 0, y: 0 }, selectedIds: ['record-1'] })).toEqual({ kind: 'body', id: 'record-0' });
	});
	it('Shift and Alt clicks never begin a move, including on selected handles', () => {
		setActivePinia(createPinia());
		const { context } = toolContext();
		const tool = new SelectTool({
			spatialObjects: () => candidates,
			createMoveGesture: () => { throw new Error('Selection must not write'); },
			reportRejected: () => { throw new Error('Unexpected rejection'); },
			reportInvalidInput: () => { throw new Error('Unexpected invalid input'); },
		});
		tool.activate(context);
		selectSpatial(context.selection, 'record-0', false);
		const shift = { ...pointerAt(0, 0), modifiers: { shift: true, ctrl: false, alt: false } };
		tool.pointerDown(shift);
		expect(context.selection.selectedIds).toEqual(['record-0', 'record-1']);
		expect(tool.hasDraft()).toBe(false);
		tool.pointerDown(pointerAt(50, 50));
		expect(context.selection.focusedId).toBe('record-1');
		expect(context.selection.selectedIds).toEqual(['record-0', 'record-1']);
		context.selection.focus('record-0' as never);
		tool.pointerDown(pointerAt(-5, 0));
		// Coincident badges select the last painted (visible) member.
		expect(context.selection.focusedId).toBe('record-1');
		expect(tool.hasDraft()).toBe(false);
		tool.pointerDown(shift);
		expect(context.selection.selectedIds).toEqual(['record-0']);
		const alt = { ...pointerAt(50, 50), modifiers: { shift: false, ctrl: false, alt: true } };
		tool.pointerMove(alt);
		expect(context.renderState.hoveredObjectId).toBe('record-1');
		tool.pointerDown(alt);
		expect(context.selection.selectedIds).toEqual(['record-1']);
		expect(tool.hasDraft()).toBe(false);
		tool.pointerUp(pointerAt(150, 150));
	});
});
