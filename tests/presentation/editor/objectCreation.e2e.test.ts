// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { resizeTo } from '../../helpers/layout';
import { pointerAt } from '../../helpers/tool-context';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
	const rig = await structureEditor(true); mounted.push(rig);
	rig.runtime.setTool('place-object');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'item baseline');
	await rig.wrapper.get('.rp-object-rectangle summary').trigger('click');
	return { ...rig, task: rig.runtime.elementTask };
}
it('applies precise rectangle input once, then saves one named item with reversible identity and geometry', async () => {
	const rig = await setup();
	await rig.wrapper.get('input[name="element-name"]').setValue('Cabinet');
	await rig.wrapper.get('input[name="object-x"]').setValue('-1');
	await rig.wrapper.get('input[name="object-width"]').setValue('1,2');
	await rig.wrapper.get('input[name="object-depth"]').setValue('0,6');
	const width = rig.wrapper.get('input[name="object-width"]');
	for (const event of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
		await width.trigger('keydown', { key: 'Enter', ...event }); expect(rig.task.draft.points).toHaveLength(0);
	}
	await width.trigger('keydown', { key: 'ArrowLeft' });
	await width.trigger('keydown', { key: 'Enter' }); await settle();
	const points = [{ x: -1000, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 600 }, { x: -1000, y: 600 }];
	expect(rig.task.draft.points).toEqual(points); expect(rig.project.structure.elements ?? []).toHaveLength(0);
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved item');
	const saved = expectDefined(rig.project.structure.elements?.[0], 'saved item');
	expect(saved.points).toEqual(points); expect(rig.project.plan?.spatialElements).toEqual([{ id: saved.id, name: 'Cabinet' }]);
	expect(rig.selection.selectedIds).toEqual([saved.id]);
	expect(rig.wrapper.get('.rp-element-inspector').text()).toContain('Cabinet');
	expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.structure.elements ?? []).toHaveLength(0);
	expectOk(await rig.runtime.dispatcher.redo()); await settle(); expect(rig.project.structure.elements?.[0]).toEqual(saved);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements?.[0]).toEqual(saved);
	rig.selection.select([]); await settle();
	const row = rig.wrapper.get(`.rp-structure-list [data-rp-id="${saved.id}"]`); expect(row.text()).toBe('Cabinet');
	await row.trigger('click'); expect(rig.selection.selectedIds).toEqual([saved.id]); expect(row.attributes('aria-pressed')).toBe('true');
});
it('retains pending rectangle input through reflow and blocks pointer, Undo point and Finish until discarded', async () => {
	const rig = await setup(), tool = rig.runtime.toolManager;
	for (const point of [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 0, y: 2000 }]) tool.pointerDown(pointerAt(point.x, point.y));
	const points = rig.task.draft.points.map(point => ({ ...point }));
	const width = rig.wrapper.get<HTMLInputElement>('input[name="object-width"]');
	await width.setValue('-'); width.element.focus();
	resizeTo(rig.rootEl, 460, 900); await settle();
	expect(rig.wrapper.get<HTMLInputElement>('input[name="object-width"]').element.value).toBe('-');
	expect(rig.wrapper.get('input[name="object-width"]').element).toBe(width.element); expect(document.activeElement).toBe(width.element);
	await rig.wrapper.get('input[name="element-x"]').setValue('9');
	expect(rig.task.draft.text.x).toBe(''); expect(rig.task.draft.rectangle.width).toBe('-');
	tool.pointerDown(pointerAt(2000, 2000)); await rig.wrapper.get('.rp-element-task > button').trigger('click'); await rig.task.finish();
	expect(rig.task.draft.points).toEqual(points); expect(rig.project.structure.elements ?? []).toHaveLength(0);
	await rig.wrapper.get('[data-rp-action="discard-object-rectangle"]').trigger('click'); await settle();
	expect(rig.task.draft.pendingInput).toBe(false); expect(rig.task.draft.points).toEqual(points); expect(rig.task.canFinish.value).toBe(true); expect(rig.task.draft.error).toBeNull();
	await rig.wrapper.get('.rp-element-task > button').trigger('click'); expect(rig.task.draft.points).toEqual(points.slice(0, -1));
	const cancel = rig.wrapper.get<HTMLButtonElement>('.rp-element-task > .rp-dialog-actions button:last-child'); cancel.element.focus();
	await cancel.trigger('click'); await settle(); expect(document.activeElement).toBe(rig.wrapper.get('.rp-plan-canvas').element);
	rig.runtime.setTool('place-object'); await settleUntil(() => !rig.task.draft.loading, 'new item task');
	expect(rig.task.draft.rectangle).toEqual({ x: '0', y: '0', width: '', depth: '' }); expect(rig.task.draft.pendingInput).toBe(false);
});
it('keeps paused fields and pending outline coordinates from being overwritten by a rectangle action', async () => {
	const rig = await setup(), save = useSaveStateStore(rig.pinia);
	await rig.wrapper.get('input[name="object-width"]').setValue('1');
	await rig.wrapper.get('input[name="object-depth"]').setValue('1');
	save.beginSaving(); await settle();
	const name = rig.wrapper.get<HTMLInputElement>('input[name="element-name"]'), originalName = name.element.value;
	await name.setValue('Refused change'); expect(name.element.value).toBe(originalName); expect(rig.task.draft.name).toBe(originalName);
	await rig.wrapper.get('.rp-element-task form').trigger('submit'); expect(rig.task.draft.points).toHaveLength(0);
	await rig.wrapper.get('input[name="object-width"]').setValue('9');
	await rig.wrapper.get('[data-rp-action="apply-object-rectangle"]').trigger('click');
	await rig.wrapper.get('[data-rp-action="discard-object-rectangle"]').trigger('click');
	expect(rig.task.draft.rectangle.width).toBe('1'); expect(rig.task.draft.pendingInput).toBe(true); expect(rig.task.draft.points).toHaveLength(0);
	save.resolveOk(); await settle();
	await rig.wrapper.get('[data-rp-action="discard-object-rectangle"]').trigger('click');
	await rig.wrapper.get('input[name="element-x"]').setValue('2');
	await rig.wrapper.get('input[name="object-width"]').setValue('3');
	await rig.wrapper.get('[data-rp-action="apply-object-rectangle"]').trigger('click');
	expect(rig.task.draft.rectangle.width).toBe(''); expect(rig.task.draft.text.x).toBe('2'); expect(rig.task.draft.points).toHaveLength(0);
});
it('drags a selected item corner, refuses an outline enclosing no surface and restores it through Undo', async () => {
	const r = await renovationEditor(true); r.changePlan(); await settle();
	try {
		const tools = r.runtime.toolManager, triangle = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }];
		await r.wrapper.get('[data-rp-action="add"]').trigger('click'); await r.wrapper.get('[data-rp-entry="item"]').trigger('click');
		await settleUntil(() => !r.runtime.elementTask.draft.loading, 'item baseline');
		await r.wrapper.get('input[name="element-name"]').setValue('Cabinet'); expect(r.runtime.elementTask.setPoints(triangle)).toBe(true);
		await r.wrapper.get('[data-rp-action="finish-element"]').trigger('click'); await settleUntil(() => r.runtime.activeToolId.value === 'select', 'item save');
		const saved = expectDefined(r.project.structure.elements?.[0], 'saved item');
		expect(saved.points).toEqual(triangle); expect(r.stage.find('.element-vertex')).toHaveLength(3);
		tools.pointerDown(pointerAt(2000, 0)); tools.pointerMove(pointerAt(3000, -1000)); tools.pointerUp(pointerAt(3000, -1000));
		await settleUntil(() => !r.runtime.elementActions.active.value && r.project.structure.elements?.[0].points[1].x === 3000, 'corner move');
		expect(r.project.structure.elements?.[0].points).toEqual(triangle.with(1, { x: 3000, y: -1000 }));
		await r.runtime.undo(); await settle(); expect(r.project.structure.elements?.[0]).toEqual(saved);
		const before = [...r.stack.vault.entries];
		// Collinear with the other two corners: a valid element, but no surface (`areaOutline`).
		tools.pointerDown(pointerAt(2000, 2000)); tools.pointerMove(pointerAt(1000, 0)); tools.pointerUp(pointerAt(1000, 0)); await settle();
		expect(r.project.structure.elements?.[0]).toEqual(saved); expect([...r.stack.vault.entries]).toEqual(before);
		await r.runtime.renovation.perspective('review'); await settle(); expect(r.stage.find('.element-vertex')).toHaveLength(0);
	} finally { r.unmount(); }
});
it('retains a third measurement coordinate without extending its two-point geometry', async () => {
	const rig = await structureEditor(true); mounted.push(rig); rig.runtime.setTool('measure');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'measurement baseline');
	for (const value of ['0', '1', '2']) {
		await rig.wrapper.get('input[name="element-x"]').setValue(value); await rig.wrapper.get('input[name="element-y"]').setValue('0');
		await rig.wrapper.get('.rp-element-task form').trigger('submit');
	}
	expect(rig.runtime.elementTask.draft.points).toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
	expect(rig.wrapper.get<HTMLInputElement>('input[name="element-x"]').element.value).toBe('2');
	expect(rig.wrapper.get('.rp-element-task form button').attributes('aria-disabled')).toBe('true');
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
});
it('does not reclaim focus after the element editor leaf is disposed', async () => {
	const rig = await setup(); rig.wrapper.get<HTMLInputElement>('input[name="element-name"]').element.focus();
	rig.unmount(); mounted.pop();
	const outside = document.createElement('button'); document.body.append(outside); outside.focus();
	await settle(); expect(document.activeElement).toBe(outside); outside.remove();
});
it.each([
	['x', 'invalid'], ['y', '9007199254740'], ['width', '1001'], ['depth', '0'],
])('explains invalid %s input and focuses that field without changing the outline', async (field, value) => {
	const rig = await setup();
	await rig.wrapper.get('input[name="object-width"]').setValue('1');
	await rig.wrapper.get('input[name="object-depth"]').setValue('1');
	const input = rig.wrapper.get<HTMLInputElement>(`input[name="object-${field}"]`);
	await input.setValue(value); await rig.wrapper.get('[data-rp-action="apply-object-rectangle"]').trigger('click'); await settle();
	expect(input.attributes('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(input.element);
	expect(input.element.value).toBe(value); expect(rig.task.draft.points).toHaveLength(0);
	expect(rig.wrapper.findAll('.rp-object-rectangle .rp-field-error__message')).toHaveLength(1);
});

it.each(['item', 'path', 'fence', 'measurement'] as const)('opens %s details from Add in a narrow leaf and cancels from its visible banner', async id => {
	const rig = await structureEditor(true); mounted.push(rig); resizeTo(rig.rootEl, 460, 900); await settle();
	await rig.wrapper.get('[data-rp-action="add"]').trigger('click'); await rig.wrapper.get(`[data-rp-entry="${id}"]`).trigger('click');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'element from Add');
	const name = rig.wrapper.get('input[name="element-name"]'); expect(name.isVisible()).toBe(true); expect(document.activeElement).toBe(name.element);
	expect(rig.wrapper.get('.rp-task-banner').text()).not.toBe('');
	expect(rig.wrapper.get('.rp-task-banner__finish').text()).toBe('Finish');
	await rig.wrapper.get('.rp-task-banner__cancel').trigger('click'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.project.structure.elements ?? []).toHaveLength(0);
});
it('expands a collapsed Inspector for item details from Add in a full leaf and focuses the name', async () => {
	const rig = await structureEditor(true); mounted.push(rig);
	await rig.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click'); await settle();
	await rig.wrapper.get('[data-rp-action="add"]').trigger('click'); await rig.wrapper.get('[data-rp-entry="item"]').trigger('click');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'element from Add');
	const name = rig.wrapper.get('input[name="element-name"]'); expect(name.isVisible()).toBe(true); expect(document.activeElement).toBe(name.element);
});
it('explains partial outline coordinates, keeps native editing keys local, and finishes through the shared banner', async () => {
	const rig = await setup();
	const x = rig.wrapper.get<HTMLInputElement>('input[name="element-x"]');
	await x.setValue('-'); await rig.wrapper.get('.rp-element-task form').trigger('submit'); await settle();
	expect(x.attributes('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(x.element); expect(x.element.value).toBe('-');
	await x.setValue('0'); await rig.wrapper.get('input[name="element-y"]').setValue('0');
	await x.trigger('keydown', { key: 'Enter', isComposing: true }); expect(rig.task.draft.points).toHaveLength(0);
	await rig.wrapper.get('.rp-element-task form').trigger('submit'); expect(rig.task.draft.points).toHaveLength(1);
	await x.setValue('0'); const y = rig.wrapper.get('input[name="element-y"]'); await y.setValue('0');
	await rig.wrapper.get('.rp-element-task form').trigger('submit'); await settle();
	expect(rig.task.draft.points).toHaveLength(1); expect(document.activeElement).toBe(y.element);
	expect(rig.wrapper.get('.rp-element-task form').text()).toContain('different from the previous');
	await y.setValue('1'); await rig.wrapper.get('.rp-element-task form').trigger('submit'); expect(rig.task.draft.points).toHaveLength(2);
	const name = rig.wrapper.get('input[name="element-name"]'); await name.setValue('');
	expect(name.attributes('aria-invalid')).toBe('true'); expect(rig.wrapper.get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('true');
	await name.setValue('Table');
	await rig.wrapper.get('input[name="object-width"]').setValue('1'); await rig.wrapper.get('input[name="object-depth"]').setValue('1');
	await rig.wrapper.get('[data-rp-action="apply-object-rectangle"]').trigger('click');
	expect(rig.wrapper.get('.rp-task-banner__finish').attributes('aria-disabled')).toBe('false');
	await rig.wrapper.get('.rp-task-banner__finish').trigger('click'); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'banner save');
	expect(rig.project.structure.elements).toHaveLength(1); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Table');
});
