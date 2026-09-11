// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
async function menu(rig: Awaited<ReturnType<typeof setup>>) { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
async function action(rig: Awaited<ReturnType<typeof setup>>, id: string) { await menu(rig); await rig.wrapper.get(`[data-rp-context-action="${id}"]`).trigger('click'); await settle(); }

it('opens real Add and Fit routes, keeps unavailable framing inert, and limits Review to viewing', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), fit = vi.spyOn(editor, 'fitTo'), bytes = [...rig.stack.vault.entries];
	rig.selection.clear(); await action(rig, 'add'); expect(rig.wrapper.find('.rp-add-menu').exists()).toBe(true);
	await rig.wrapper.get('.rp-add-menu').trigger('keydown', { key: 'Escape' }); await settle();
	await action(rig, 'fit'); expect(fit).toHaveBeenCalledOnce();
	rig.selection.select([rig.room.id]); await action(rig, 'fit'); expect(fit).toHaveBeenCalledTimes(2);
	rig.selection.select(['retired-selection' as never]); await menu(rig);
	// Nothing copyable is no Copy at all: a greyed one could only offer an edit's reason, and Copy is not an edit.
	expect(rig.wrapper.find('[data-rp-context-action="copy"]').exists()).toBe(false);
	const unavailable = rig.wrapper.get('[data-rp-context-action="fit"]'); expect(unavailable.attributes('aria-disabled')).toBe('true');
	await unavailable.trigger('click'); expect(fit).toHaveBeenCalledTimes(2);
	await unavailable.trigger('keydown', { key: 'Escape' });
	await rig.runtime.renovation.perspective('review'); rig.selection.clear(); await menu(rig);
	expect(rig.wrapper.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'))).toEqual(['fit']);
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	rig.selection.select([rig.room.id]); await menu(rig);
	expect(rig.wrapper.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'))).toEqual(['fit', 'copy']);
	// Something on the clipboard still offers no Paste in Review.
	await rig.wrapper.get('[data-rp-context-action="copy"]').trigger('click'); await menu(rig);
	expect(rig.wrapper.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'))).toEqual(['fit', 'copy']);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('fits nothing when the plan empties out between the menu opening and the click landing', async () => {
	// `actions` is a `computed`: the button's `disabled` and its `run` closure's `ids.length
	// === 0` both come from the SAME evaluation that built the currently-rendered menu, not
	// from whatever the store holds the instant the click actually lands. Emptying the plan
	// with no tick in between (before Vue's own re-render would have caught up) is what makes
	// the two disagree — `fit(true)` re-reads `frame()` fresh and finds nothing to bound.
	const rig = await setup(), fit = vi.spyOn(useEditorStore(rig.pinia), 'fitTo');
	rig.selection.clear();
	await menu(rig);
	const button = rig.wrapper.get('[data-rp-context-action="fit"]');
	expect(button.attributes('aria-disabled')).toBeUndefined();

	rig.project.zones = new Map();
	rig.project.structure = EMPTY_STRUCTURE;
	await button.trigger('click');

	expect(fit).not.toHaveBeenCalled();
});

it('routes Area shape and metadata actions to their existing forms and persists metadata through real history', async () => {
	const rig = await setup();
	const area = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Garden', zoneType: 'Garden', geometry: { points: [{ x: 5000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 2000 }, { x: 5000, y: 2000 }] } })).zone.entity;
	await rig.runtime.refreshProjection(); rig.selection.select([area.id]);
	await action(rig, 'edit'); expect(rig.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(true);
	rig.dialogs.resolve('cancel'); await settle();
	await action(rig, 'rename'); const form = rig.wrapper.get('[data-rp-form="area-details"]');
	await form.get('input[name="name"]').setValue('Patio'); await form.get('select[name="zoneType"]').setValue('Terrace');
	await form.trigger('submit'); await settleUntil(() => rig.dialogs.current === null, 'Area metadata saved');
	const saved = expectFound(await rig.stack.zones.getById(area.id)).entity; expect(saved.name).toBe('Patio'); expect(saved.zoneType).toBe('Terrace'); expect(saved.geometry).toEqual(area.geometry);
	await rig.runtime.undo(); expect(expectFound(await rig.stack.zones.getById(area.id)).entity.name).toBe('Garden');
});

it('deletes an unreferenced Room through history and keeps cancelled Wall changes unapplied', async () => {
	const rig = await setup();
	await action(rig, 'delete'); await settleUntil(() => !rig.project.zones.has(rig.room.id), 'unreferenced Room deletion');
	expect(rig.dialogs.current).toBeNull(); expect(expectOk(await rig.stack.zones.getById(rig.room.id))).toBeNull();
	await rig.runtime.undo(); await settle(); expect(expectFound(await rig.stack.zones.getById(rig.room.id)).entity.geometry).toEqual(rig.room.geometry);
	const bytes = [...rig.stack.vault.entries];
	rig.selection.select(['wall-a' as never]); await action(rig, 'edit');
	expect(rig.wrapper.find('.rp-dialog input[name="length"]').exists()).toBe(true); rig.dialogs.resolve('cancel'); await settle();
	await action(rig, 'delete'); await settleUntil(() => rig.dialogs.current !== null, 'Wall deletion review');
	expect(rig.wrapper.get('.rp-dialog').text()).toMatch(/opening/i); rig.dialogs.resolve('cancel'); await settle();
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.project.structure.walls).toHaveLength(4);
});

it('edits and deletes an Object through typed context actions and restores its label and geometry on undo', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const original = { id: 'element-context-desk', kind: 'object' as const, name: 'Desk', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1500 }, { x: 500, y: 1500 }] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, original), rig.runtime.structureTask.ledger)));
	rig.selection.select([original.id as never]); await action(rig, 'edit');
	const form = rig.wrapper.get('[data-rp-form="outline-points"]'); await form.get('input[name="name"]').setValue('Work desk');
	await form.trigger('submit'); await settleUntil(() => rig.dialogs.current === null, 'Object edit');
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Work desk');
	await action(rig, 'rotate'); const rotation = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await rotation.get('input[name="angle"]').setValue('90'); await rotation.trigger('submit'); await settleUntil(() => rig.dialogs.current === null, 'context rotation');
	expect(rig.project.structure.elements?.[0].points).not.toEqual(original.points); await rig.runtime.undo();
	expect(rig.project.structure.elements?.[0].points).toEqual(original.points);
	await action(rig, 'delete'); await settleUntil(() => rig.dialogs.current !== null, 'Object deletion review'); rig.dialogs.resolve('confirm');
	await settleUntil(() => !rig.project.structure.elements?.length, 'Object deletion');
	await rig.runtime.undo(); expect(rig.project.structure.elements?.[0]).toMatchObject({ id: original.id, points: original.points }); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Work desk');
});

it('offers Select while panning and Pan while selecting, in every branch, and switches the tool on click', async () => {
	const rig = await setup();
	rig.selection.clear(); await menu(rig);
	expect(rig.wrapper.find('[data-rp-context-action="pan"]').exists()).toBe(true); expect(rig.wrapper.find('[data-rp-context-action="select"]').exists()).toBe(false);
	await rig.wrapper.get('[data-rp-context-action="pan"]').trigger('click'); await settle(); expect(rig.runtime.activeToolId.value).toBe('pan');
	rig.selection.select([rig.room.id]); await menu(rig);
	expect(rig.wrapper.find('[data-rp-context-action="pan"]').exists()).toBe(false);
	await rig.wrapper.get('[data-rp-context-action="select"]').trigger('click'); await settle(); expect(rig.runtime.activeToolId.value).toBe('select');
	await menu(rig); expect(rig.wrapper.find('[data-rp-context-action="pan"]').exists()).toBe(true);
	await rig.wrapper.get('[data-rp-context-action="pan"]').trigger('keydown', { key: 'Escape' });
});

it('puts Add first and Delete last, draws one known icon per item, and names the single object it acts on', async () => {
	const rig = await setup();
	rig.selection.clear(); await menu(rig);
	const empty = rig.wrapper.get('.rp-canvas-context-menu');
	expect(empty.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'))).toEqual(['add', 'fit', 'pan']);
	expect(empty.find('[role="separator"]').exists()).toBe(false); expect(empty.find('.rp-canvas-context-menu-title').exists()).toBe(false);
	await empty.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	rig.selection.select([rig.room.id]); await menu(rig);
	const menuEl = rig.wrapper.get('.rp-canvas-context-menu');
	expect(menuEl.get('.rp-canvas-context-menu-title').text()).toBe(rig.room.name);
	const ids = menuEl.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'));
	expect(ids[0]).toBe('fit'); expect(ids.at(-1)).toBe('delete');
	for (const item of menuEl.findAll('[data-rp-context-action]')) { expect(item.find('.rp-host-icon[data-icon]').exists()).toBe(true); expect(item.find('[data-icon-missing]').exists()).toBe(false); }
	await menuEl.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	rig.selection.select(['wall-a' as never]); await menu(rig);
	expect(rig.wrapper.get('.rp-canvas-context-menu-title').text()).toBe('Wall 1');
	for (const item of rig.wrapper.findAll('[data-rp-context-action]')) expect(item.find('[data-icon-missing]').exists()).toBe(false);
});

it('tells why a greyed action is unavailable', async () => {
	const rig = await setup();
	rig.selection.select([rig.room.id]); rig.project.stale = true; await menu(rig);
	expect(rig.wrapper.get('[data-rp-context-action="delete"]').attributes('title')).toBe('Editing is paused until the floor is re-read.');
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	rig.project.stale = false; rig.runtime.setTool('pan'); rig.selection.select([rig.room.id]); await menu(rig);
	expect(rig.wrapper.get('[data-rp-context-action="fit"]').attributes('title')).toBeUndefined();
	expect(rig.wrapper.get('[data-rp-context-action="rotate"]').attributes('title')).toBe('Not available while another tool or edit is active.');
});
