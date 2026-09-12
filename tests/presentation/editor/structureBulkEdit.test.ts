// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { err, ok } from '../../../src/core/result/Result';
import type { Opening } from '../../../src/domain/spatial/Structure';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';
import StructureBulkEditForm from '../../../src/presentation/editor/structure/StructureBulkEditForm.vue';
import * as notices from '../../../src/presentation/notices/notify';

const OPENINGS: readonly Opening[] = [
	{ id: 'opening-window-a', kind: 'window', hostId: 'wall-a', offset: 500, width: 1000, height: 1200, sill: 900 },
	{ id: 'opening-window-b', kind: 'window', hostId: 'wall-b', offset: 500, width: 800, height: 1200, sill: 900 },
	{ id: 'opening-door', kind: 'door', hostId: 'wall-c', offset: 1000, width: 900, height: 2100, sill: 0 },
];
const STRUCTURE_IDS = ['wall-a', 'wall-b', 'wall-c', 'wall-d', ...OPENINGS.map(item => item.id)];

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

/** Four 2.40 m walls, the second 200 mm thick, carrying two windows of different widths and a door. */
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig);
	await rig.runtime.renovation.perspective('plan');
	const before = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(before.document.structure, 'structure');
	const walls = structure.walls.map(wall => wall.id === 'wall-b' ? { ...wall, thickness: 200 } : wall);
	expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...structure, walls, openings: OPENINGS } }, before.version));
	await rig.runtime.refreshProjection();
	const ids = [rig.room.id, ...STRUCTURE_IDS];
	rig.selection.select(ids as never[]); await settle();
	return { rig, ids };
}
async function open(rig: Awaited<ReturnType<typeof setup>>['rig'], ids: readonly string[]) {
	const editing = rig.runtime.structureActions.editMany(ids); await settle();
	const form = rig.wrapper.getComponent(StructureBulkEditForm);
	const field = (name: string) => form.get<HTMLInputElement>(`[name="${name}"]`);
	return { editing, form, field };
}

describe('editing the dimensions of several walls, windows and doors at once', () => {
	it('is offered in the multi-selection Inspector only while a wall, window or door is selected', async () => {
		const { rig } = await setup();
		rig.selection.select([rig.room.id, 'missing'] as never[]); await settle();
		expect(rig.wrapper.find('[data-rp-action="edit-dimensions"]').exists()).toBe(false);
		rig.selection.select([rig.room.id, 'opening-door'] as never[]); await settle();
		await rig.wrapper.get('[data-rp-action="edit-dimensions"]').trigger('click'); await settle();
		const form = rig.wrapper.getComponent(StructureBulkEditForm);
		expect(form.findAll('legend').map(legend => legend.text())).toEqual(['Doors (1)']);
		expect(rig.wrapper.get('[data-rp-action="edit-dimensions"]').attributes('aria-disabled')).toBe('true');
	});

	it('starts from shared values, marks differing ones mixed and saves only the entered fields in one undoable write', async () => {
		const { rig, ids } = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document;
		const { editing, form, field } = await open(rig, ids);
		expect(form.findAll('legend').map(legend => legend.text())).toEqual(['Walls (4)', 'Windows (2)', 'Doors (1)']);
		expect(field('wall-thickness').element.value).toBe(''); expect(field('wall-thickness').attributes('placeholder')).toBe('Mixed');
		expect(field('wall-height').element.value).toBe(formatMetres(2400)); expect(field('wall-height').attributes('placeholder')).toBeUndefined();
		expect(field('window-width').element.value).toBe(''); expect(field('window-sill').element.value).toBe(formatMetres(900));
		expect(field('door-width').element.value).toBe(formatMetres(900));
		const run = vi.spyOn(rig.runtime.dispatcher, 'run');
		await field('wall-height').setValue('2.6'); await field('door-width').setValue('1');
		await form.trigger('submit'); await settle();
		expect(form.get('[role="status"]').text()).toBe('Walls changing: 4. Windows changing: 0. Doors changing: 1. Review the preview and apply to save.');
		expect(rig.runtime.structureActions.preview.value?.walls.map(wall => wall.height)).toEqual([2600, 2600, 2600, 2600]);
		expect(run).not.toHaveBeenCalled();
		await form.trigger('submit'); await editing; await settle();
		expect(run).toHaveBeenCalledTimes(1); expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.structureActions.preview.value).toBeNull();
		const saved = expectDefined(expectOk(await rig.geometry.read(rig.plan.id)).document.structure, 'saved structure');
		expect(saved.walls.map(wall => [wall.height, wall.thickness])).toEqual([[2600, 150], [2600, 200], [2600, 150], [2600, 150]]);
		expect(saved.openings).toEqual([OPENINGS[0], OPENINGS[1], { ...OPENINGS[2], width: 1000 }]);
		expectOk(await rig.runtime.dispatcher.undo()); await settle();
		expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	});

	it('refuses the whole change when a lowered wall would no longer contain its window, saving nothing', async () => {
		const { rig, ids } = await setup(), { editing, form, field } = await open(rig, ids);
		const run = vi.spyOn(rig.runtime.dispatcher, 'run'), bytes = [...rig.stack.vault.entries];
		await field('wall-height').setValue('1.5'); await form.trigger('submit'); await settle();
		expect(form.get('[role="alert"]').text()).toContain('The opening must fit within the wall length and height.');
		expect(document.activeElement).toBe(field('window-width').element.ownerDocument.querySelector('[aria-invalid="true"]'));
		expect(rig.runtime.structureActions.preview.value).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		rig.dialogs.resolve({ action: 'cancel' }); await editing;
	});

	it('treats an emptied field as unchanged and refuses text that is not a length', async () => {
		const { rig, ids } = await setup(), { form, field } = await open(rig, ids);
		const submit = form.get('button[type="submit"]');
		await field('wall-height').setValue(''); await field('window-width').setValue(' ');
		expect(submit.attributes('aria-disabled')).toBe('true');
		await form.trigger('submit'); await settle();
		expect(form.find('[role="alert"]').exists()).toBe(false); expect(rig.runtime.structureActions.preview.value).toBeNull();
		await field('window-sill').setValue('abc'); await form.trigger('submit'); await settle();
		expect(form.get('[role="alert"]').text()).toContain('Enter complete numbers.');
		expect(document.activeElement).toBe(field('wall-thickness').element);
	});

	it('keeps the draft and names a failed write, and marks a stale write as a conflict', async () => {
		const { rig, ids } = await setup(), { form, field } = await open(rig, ids);
		const run = vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(injectedPersistenceError()));
		await field('wall-thickness').setValue('0.2'); await form.trigger('submit'); await form.trigger('submit'); await settle();
		expect(run).toHaveBeenCalledTimes(1); expect(form.find('[role="alert"]').exists()).toBe(true); expect(form.find('[role="status"]').text()).not.toContain('saved floor changed');
		run.mockRejectedValueOnce(new Error('disk gone')); await form.trigger('submit'); await settle();
		expect(form.get('[role="alert"]').text()).toContain('could not be saved');
		run.mockResolvedValueOnce(err({ ...injectedPersistenceError(), code: 'undo.superseded' })); await form.trigger('submit'); await settle();
		expect(form.text()).toContain('The saved floor changed.');
		expect(field('wall-thickness').element.value).toBe('0.2');
	});

	it('opens nothing for a stale projection, a changed selection, a failed read or no dimension targets', async () => {
		const { rig, ids } = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
		const structure = expectDefined(before.document.structure, 'structure');
		const read = vi.spyOn(rig.services, 'read'), report = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		await rig.runtime.structureActions.editMany(['missing', rig.room.id]); expect(rig.dialogs.current).toBeNull();
		read.mockResolvedValueOnce(err(injectedPersistenceError())); await rig.runtime.structureActions.editMany(ids);
		expect(rig.dialogs.current).toBeNull(); expect(report).toHaveBeenCalledTimes(1);
		const fault = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		read.mockRejectedValueOnce(new Error('offline')); await rig.runtime.structureActions.editMany(ids);
		expect(rig.dialogs.current).toBeNull(); expect(fault).toHaveBeenCalledTimes(1); expect(rig.runtime.structureActions.active.value).toBe(false);
		const gate = defer<Awaited<ReturnType<typeof rig.services.read>>>(); read.mockReturnValueOnce(gate.promise);
		const pending = rig.runtime.structureActions.editMany(ids);
		await rig.runtime.structureActions.editMany(ids); expect(read).toHaveBeenCalledTimes(4);
		rig.selection.select([rig.room.id]); gate.resolve(ok(before)); await pending; expect(rig.dialogs.current).toBeNull();
		rig.selection.select(ids as never[]); await settle();
		expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...structure, openings: [] } }, before.version));
		await rig.runtime.structureActions.editMany(ids); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(report).toHaveBeenCalledTimes(2); expect(rig.project.structure.openings).toEqual([]);
	});

	it('refuses a captured dispatch and clears its preview once the leaf has closed', async () => {
		const { rig, ids } = await setup(), { editing, form, field } = await open(rig, ids);
		const dispatch = form.props('dispatch'), preview = form.props('preview');
		await field('wall-height').setValue('2.5'); await form.trigger('submit');
		const proposal = expectDefined(rig.runtime.structureActions.preview.value, 'reviewed change');
		const run = vi.spyOn(rig.runtime.dispatcher, 'run'), bytes = [...rig.stack.vault.entries];
		mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); await editing;
		expect(expectErr(await dispatch(proposal)).code).toBe('editor.stale-write-refused');
		preview(proposal); expect(rig.runtime.structureActions.preview.value).toBeNull();
		expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
