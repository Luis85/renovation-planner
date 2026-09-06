// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { err, ok } from '../../../src/core/result/Result';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { WALL_LOOP } from '../../helpers/structure';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { pointerAt } from '../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
async function rig() { const value = await structureEditor(); mounted.push(value); return value; }
afterEach(() => { for (const value of mounted.splice(0)) value.unmount(); });
const fault = { category: 'Persistence' as const, code: 'spatial.write-failed', message: 'Disk unavailable' };
async function start(value: Awaited<ReturnType<typeof rig>>, kind: 'draw-wall' | 'place-window' = 'draw-wall') {
	value.runtime.setTool(kind); await settleUntil(() => !value.runtime.structureTask.draft.loading, 'loaded baseline');
	return value.runtime.structureTask;
}
async function seeded(value: Awaited<ReturnType<typeof rig>>) {
	const baseline = expectOk(await value.geometry.read(value.plan.id));
	expectOk(await value.runtime.dispatcher.run(value.services.command({ planId: value.plan.id, baseline, structure: WALL_LOOP, ledger: value.runtime.structureTask.ledger })));
}
describe('spatial task failure, busy and leaf lifetime', () => {
	it.each(['structure', 'calibration'] as const)('refuses a fresh baseline when the displayed %s is older', async kind => {
		const value = await rig(), before = expectOk(await value.geometry.read(value.plan.id));
		const document = kind === 'structure' ? { ...before.document, structure: WALL_LOOP }
			: { ...before.document, calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 1000, y: 0 }, knownDistance: 2000, pixelsPerWorldUnit: 0.5 } };
		expectOk(await value.geometry.write(value.plan.id, document, before.version));
		expect(value.project.structure.walls).toHaveLength(0);
		const task = await start(value); expect(task.draft.conflict).toBe(true);
		expect(task.addNumeric()).toBe(false); await task.finish();
		expect(expectOk(await value.geometry.read(value.plan.id)).document).toEqual(document);
		value.runtime.returnToSelect(); await start(value);
		expect(task.draft.conflict).toBe(false); expect(task.addNumeric()).toBe(true);
	});
	it('does not restore a draft when its pending write rejects after disposal', async () => {
		const value = await rig(), task = await start(value);
		task.addNumeric(); task.draft.text.length = '4'; task.addNumeric();
		let rejectLate!: (cause: Error) => void;
		vi.spyOn(value.runtime.dispatcher, 'run').mockImplementationOnce(() => new Promise((resolve, reject) => { void resolve; rejectLate = reject; }));
		const pending = task.finish(); expect(task.draft.busy).toBe(true);
		value.unmount(); rejectLate(new Error('retired write')); await pending;
		expect(task.draft.points).toEqual([]); expect(task.draft.error).toBeNull(); expect(task.draft.busy).toBe(false);
	});
	it('preserves a conflicting numeric segment and discards a late baseline fault on leaf disposal', async () => {
		const value = await rig(); await seeded(value); const task = await start(value);
		expect(task.addNumeric()).toBe(true); task.draft.text.length = '4'; expect(task.addNumeric()).toBe(false); expect(task.draft.text.length).toBe('4');
		value.runtime.returnToSelect();
		let reject!: (cause: Error) => void; vi.spyOn(value.services, 'read').mockImplementationOnce(() => new Promise((_resolve, _reject) => { reject = _reject; }));
		value.runtime.setTool('draw-wall'); value.unmount(); reject(new Error('late read')); await settle(); expect(task.draft.error).toBeNull(); expect(task.draft.loading).toBe(false);
	});
	it('traces a temporary loop, operates every numeric field, creates its Room and uses list selection and deletion focus', async () => {
		const value = await rig(), task = await start(value);
		const before = expectOk(await value.geometry.read(value.plan.id));
		await value.wrapper.find('.rp-structure-task input[name="x"]').setValue('0'); await value.wrapper.find('.rp-structure-task input[name="y"]').setValue('0');
		await value.wrapper.find('.rp-structure-task input[name="height"]').setValue('2.5'); await value.wrapper.find('.rp-structure-task input[name="thickness"]').setValue('0.2');
		value.runtime.toolManager.pointerDown(pointerAt(0, 0)); value.runtime.toolManager.pointerMove(pointerAt(4000, 2)); await settle();
		expect(value.wrapper.find('.rp-structure-task').text()).toContain('4 m');
		value.runtime.toolManager.pointerDown(pointerAt(4000, 0)); value.runtime.toolManager.pointerDown(pointerAt(4000, 3000));
		await value.wrapper.find('.rp-structure-task .rp-dialog-actions button:first-child').trigger('click'); expect(task.draft.points).toHaveLength(2);
		value.runtime.toolManager.pointerDown(pointerAt(4000, 3000)); value.runtime.toolManager.pointerDown(pointerAt(0, 3000));
		await value.wrapper.find('.rp-structure-task .rp-dialog-actions button:last-child').trigger('click');
		await value.wrapper.find('.rp-structure-task input[type="checkbox"]').setValue(true);
		await value.wrapper.find('.rp-structure-task input[type="text"]:not([name])').setValue('Study');
		expect(expectOk(await value.geometry.read(value.plan.id))).toEqual(before);
		value.runtime.toolManager.finishActiveTool(); await settleUntil(() => value.runtime.activeToolId.value === 'select', 'saved traced loop');
		await value.runtime.dispatcher.undo(); expect(value.project.zones.size).toBe(0); await value.runtime.dispatcher.redo(); expect(value.project.zones.size).toBe(1);
		await value.wrapper.find('.rp-structure-list > ul > li:first-child > button').trigger('click');
		const edit = value.runtime.structureActions.edit(value.project.structure.walls[0].id); await settle();
		expect(value.wrapper.find('.rp-dialog').text()).toContain('Study'); value.dialogs.resolve('cancel'); await edit;
		await start(value, 'place-window'); await value.wrapper.find('.rp-structure-task select').setValue(value.project.structure.walls[1].id);
		value.runtime.returnToSelect(); value.runtime.setTool('place-opening'); await settleUntil(() => !task.draft.loading, 'opening baseline');
		await value.wrapper.find('.rp-structure-task select').setValue(value.project.structure.walls[1].id); await task.finish();
		await value.wrapper.find('.rp-structure-list > ul > li:nth-child(2) ul button').trigger('click'); expect(value.selection.selectedIds[0]).toBe(value.project.structure.openings[0].id);
		await value.wrapper.find('.rp-structure-list > ul > li:first-child > button').trigger('click', { shiftKey: true }); expect(value.selection.selectedIds).toHaveLength(2);
		await value.wrapper.find('.rp-structure-list > ul > li:first-child > button').trigger('click');
		await value.wrapper.find('.rp-structure-inspector details button').trigger('click'); await settle(); value.dialogs.resolve('confirm');
		await settleUntil(() => value.project.structure.walls.length === 3, 'wall removed');
		expect(value.project.structure.boundaries).toEqual([]); expect(value.wrapper.element.contains(document.activeElement)).toBe(true);
	});
	it('retains the draft on failed dispatch, blocks duplicate submits and retires late success after cancellation', async () => {
		const value = await rig(), task = await start(value);
		task.addNumeric(); task.draft.text.length = '4'; expect(task.addNumeric()).toBe(true);
		const run = vi.spyOn(value.runtime.dispatcher, 'run').mockResolvedValueOnce(err(fault));
		await task.finish(); expect(task.draft.error).toEqual(fault); expect(task.draft.points).toHaveLength(2);
		let release!: (result: DispatchResult) => void;
		run.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
		const pending = task.finish(); await task.finish(); task.undoPoint(); task.closeLoop(); expect(task.addNumeric()).toBe(false);
		expect(run).toHaveBeenCalledTimes(2); expect(task.draft.busy).toBe(true); expect(task.draft.points).toHaveLength(2);
		value.unmount(); release(ok('wrote')); await pending;
		expect(value.runtime.activeToolId.value).not.toBe('select'); expect(task.draft.points).toEqual([]);
		expect(value.fileListeners()).toBe(0); expect(value.themeListeners()).toBe(0);
	});
	it('pauses a version-conflicted task and preserves raw fields until it is explicitly reopened', async () => {
		const value = await rig(), task = await start(value);
		await task.finish(); expect(task.draft.error?.code).toBe('spatial.wall-dimensions');
		task.draft.text.x = 'invalid'; expect(task.addNumeric()).toBe(false); task.draft.text.x = '0'; task.addNumeric();
		task.draft.text.length = '4'; task.addNumeric();
		vi.spyOn(value.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ category: 'Validation', code: 'plan-geometry.revision-conflict', message: 'Changed' }));
		await task.finish(); expect(task.draft.conflict).toBe(true); expect(task.blocked.value).toBe(true); expect(task.draft.points).toHaveLength(2);
		value.runtime.returnToSelect(); await start(value); expect(task.draft.conflict).toBe(false);
		value.project.stale = true; expect(task.addNumeric()).toBe(false); await task.finish(); value.project.stale = false;
		useSaveStateStore(value.pinia).beginSaving(); expect(task.blocked.value).toBe(true);
	});
	it('handles baseline refusal and throws, ignores stale activation replies and finishes no task without a baseline', async () => {
		const value = await rig(), read = vi.spyOn(value.services, 'read');
		read.mockResolvedValueOnce(err(fault)); let task = await start(value); expect(task.draft.error).toEqual(fault); await task.finish();
		value.runtime.returnToSelect(); read.mockRejectedValueOnce(new Error('read')); task = await start(value); expect(task.draft.loading).toBe(false);
		value.runtime.returnToSelect();
		let release!: (result: Awaited<ReturnType<typeof value.services.read>>) => void;
		read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
		value.runtime.setTool('draw-wall'); value.runtime.returnToSelect(); release(err(fault)); await settle(); expect(value.runtime.activeToolId.value).toBe('select');
		await start(value); task.addNumeric(); task.draft.text.length = '4'; task.addNumeric();
		vi.spyOn(value.runtime.dispatcher, 'run').mockRejectedValueOnce(new Error('dispatch')); await task.finish(); expect(task.draft.points).toHaveLength(2); expect(task.draft.busy).toBe(false);
	});
	it('renders and validates a window draft and uses native keys without triggering commands', async () => {
		const value = await rig(); await seeded(value); const task = await start(value, 'place-window');
		expect(task.draft.text).toMatchObject({ openingHeight: '1.2', sill: '0.9', hostId: 'wall-a' });
		const field = value.wrapper.find('.rp-structure-task input[name="width"]');
		for (const props of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...props }); field.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
		}
		await field.setValue('0'); await value.wrapper.find('.rp-structure-task').trigger('submit'); expect(task.draft.error).not.toBeNull();
		await field.setValue('0.9'); task.draft.text.offset = '0.5'; await value.wrapper.find('.rp-structure-task').trigger('submit');
		await settleUntil(() => value.runtime.activeToolId.value === 'select', 'saved window'); expect(value.project.structure.openings[0].kind).toBe('window');
		await value.runtime.structureActions.edit('missing'); expect(value.dialogs.current).toBeNull();
	});
	it('records the optional Room in the editor-wide ledger, so a sibling edit and its undo do not strand the loop undo', async () => {
		// The Room's create command recorded its versions in a ledger private to this task,
		// while a nudge, a rename or a resize records in the editor's; after one of those and
		// its undo, undoing the loop asked the private ledger for the Room's ORIGINAL version
		// and the delete was refused, leaving the composite step stuck in history.
		const value = await rig(), task = await start(value);
		for (const [x, y] of [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]) value.runtime.toolManager.pointerDown(pointerAt(x, y));
		task.closeLoop(); task.draft.room = true; task.draft.roomName = 'Study';
		await task.finish(); await settleUntil(() => value.runtime.activeToolId.value === 'select', 'saved loop');
		const roomId = expectDefined([...value.project.zones.keys()][0], 'the loop room');
		value.selection.select([roomId as never]);
		await value.runtime.nudgeSelection({ dx: 100, dy: 0 });
		await value.runtime.dispatcher.undo();
		await value.runtime.dispatcher.undo();
		await settleUntil(() => value.project.zones.size === 0, 'the room removed with its loop');
		expect(value.project.structure.walls).toHaveLength(0);
	});
	it('previews a dragged connected end without writing and clears it on cancellation', async () => {
		const value = await rig(); await seeded(value);
		value.selection.select(['wall-a' as never]);
		value.runtime.structureActions.previewWall('wall-a', { x: 5000, y: 0 });
		expect(value.runtime.structureActions.preview.value?.walls[1].start).toEqual({ x: 5000, y: 0 });
		value.runtime.structureActions.previewWall(null); expect(value.runtime.structureActions.preview.value).toBeNull();
		value.runtime.structureActions.previewWall('missing', { x: 1, y: 1 }); expect(value.runtime.structureActions.preview.value).toBeNull();
		const before = expectOk(await value.geometry.read(value.plan.id));
		value.runtime.toolManager.pointerMove(pointerAt(500, 500));
		expect(expectOk(await value.geometry.read(value.plan.id))).toEqual(before);
	});
});
