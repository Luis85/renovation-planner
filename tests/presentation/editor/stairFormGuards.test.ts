// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { err } from '../../../src/core/result/Result';
import { pointerAt } from '../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const stair = { id: 'element-guard-stair', kind: 'stair' as const, name: 'Landing stairs', points: [{ x: 1000, y: 500 }, { x: 1000, y: 2500 }], stair: { width: 900, treads: 12, direction: 'up' as const } };
async function setup(seed = true) {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	if (seed) { const baseline = expectOk(await rig.renovation.read(rig.plan.id)); expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, stair), rig.runtime.structureTask.ledger))); rig.selection.select([stair.id as never]); await settle(); }
	return rig;
}
async function edit(rig: Awaited<ReturnType<typeof setup>>) { const operation = rig.runtime.elementActions.edit(stair.id); await settle(); return { operation, form: rig.wrapper.get('[data-rp-form="stair-edit"]') }; }

it('focuses invalid stair fields, retains their text, and retries a first-write refusal without losing the draft', async () => {
	const rig = await setup(), { operation, form } = await edit(rig), bytes = [...rig.stack.vault.entries];
	await form.get('input[name="name"]').setValue(''); await form.trigger('submit');
	expect(document.activeElement).toBe(form.get('input[name="name"]').element); expect([...rig.stack.vault.entries]).toEqual(bytes);
	await form.get('input[name="name"]').setValue('Rear stairs');
	await form.get('input[name="stair-width"]').setValue('-'); await form.trigger('submit');
	expect(form.get('input[name="stair-width"]').attributes('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(form.get('input[name="stair-width"]').element);
	await form.get('input[name="stair-width"]').setValue('1,2'); await form.get('input[name="stair-run"]').setValue('0'); await form.trigger('submit');
	expect(form.get('input[name="stair-run"]').attributes('aria-invalid')).toBe('true');
	await form.get('input[name="stair-run"]').setValue('2,5');
	vi.spyOn(rig.stack.plans, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
	await form.trigger('submit'); await settle(); expect(rig.dialogs.current).not.toBeNull();
	expect(form.find('.rp-form-banner[role="alert"]').exists()).toBe(true); expect(form.get('input[name="stair-width"]').element).toHaveProperty('value', '1,2');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	await form.trigger('submit'); await operation; expect(rig.project.structure.elements?.[0].stair?.width).toBe(1200); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Rear stairs');
});

it('refuses inputs and duplicate submission while the stair write is pending', async () => {
	const rig = await setup(), { operation, form } = await edit(rig);
	await form.get('input[name="stair-width"]').setValue('1,2');
	const gate = defer<void>(), write = rig.geometry.write.bind(rig.geometry);
	const writing = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
	try {
	form.element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	// A second input can arrive before readonly markup has painted; the form's live gate owns refusal.
	const early = form.get<HTMLInputElement>('input[name="stair-width"]'); early.element.value = '9'; early.element.dispatchEvent(new Event('input', { bubbles: true }));
	await settleUntil(() => writing.mock.calls.length === 1, 'pending stair write');
	expect(early.element.value).toBe('1,2'); expect(early.element.readOnly).toBe(true);
	await form.get('input[name="name"]').setValue('Blocked rename'); await form.get('select[name="stair-direction"]').setValue('down');
	await form.trigger('submit'); await form.trigger('keydown', { key: 'Escape' });
	expect(rig.dialogs.current).not.toBeNull(); expect(writing).toHaveBeenCalledOnce();
	expect(form.get('input[name="name"]').element).toHaveProperty('value', stair.name); expect(form.get('select[name="stair-direction"]').element).toHaveProperty('value', 'up');
	gate.resolve(); await operation; expect(rig.project.structure.elements?.[0].stair).toEqual({ width: 1200, treads: 12, direction: 'up' });
	} finally { gate.resolve(); }
});

it('retains a conflicted stair form and refuses later edits against its retired baseline', async () => {
	const rig = await setup(), { operation, form } = await edit(rig);
	await form.get('input[name="stair-width"]').setValue('1,2');
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const peer = { id: stair.id, kind: stair.kind, points: stair.points, stair: { ...stair.stair, width: 1400 } };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...rig.project.structure, elements: [peer] } }, read.version));
	await form.trigger('submit'); await settle(); const bytes = [...rig.stack.vault.entries];
	expect(form.get('input[name="stair-width"]').element).toHaveProperty('readOnly', true); expect(form.text()).toContain('changed');
	await form.get('input[name="stair-width"]').setValue('2'); await form.trigger('submit'); await settle();
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(form.get('input[name="stair-width"]').element).toHaveProperty('value', '1,2');
	rig.dialogs.resolve('cancel'); await operation; expect(rig.project.structure.elements?.[0].stair?.width).toBe(1400);
});

it('finishes an already-started stair write after leaf closure without reclaiming focus', async () => {
	const rig = await setup(), { operation, form } = await edit(rig), gate = defer<void>(), write = rig.geometry.write.bind(rig.geometry);
	const writing = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
	await form.get('input[name="stair-treads"]').setValue('14'); await form.trigger('submit'); await settleUntil(() => writing.mock.calls.length === 1, 'pending write');
	mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
	const other = document.createElement('button'); document.body.append(other); other.focus();
	try { gate.resolve(); await operation; await settle(); expect(document.activeElement).toBe(other); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements?.[0].stair?.treads).toBe(14); }
	finally { other.remove(); }
});

it('keeps a one-point stair anchor for numeric placement and refuses unfinished or paused parameters', async () => {
	const rig = await setup(false), task = rig.runtime.elementTask; rig.runtime.setTool('place-stair'); await settleUntil(() => !task.draft.loading, 'stair baseline');
	const before = [...rig.stack.vault.entries]; rig.runtime.toolManager.pointerDown(pointerAt(1000, 1000)); rig.runtime.toolManager.pointerUp(pointerAt(1000, 1000)); await settle();
	const form = rig.wrapper.get('[data-rp-form="stair-parameters"]'); await form.get('input[name="stair-width"]').setValue('1,2');
	rig.runtime.toolManager.pointerDown(pointerAt(2500, 2500)); rig.runtime.toolManager.pointerUp(pointerAt(2500, 2500)); expect(task.draft.points).toHaveLength(1);
	rig.project.stale = true; form.element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	const field = form.get<HTMLInputElement>('input[name="stair-width"]'); field.element.value = '9'; field.element.dispatchEvent(new Event('input', { bubbles: true })); await settle();
	expect(task.draft.points).toHaveLength(1); expect(task.draft.pendingInput).toBe(true); expect(field.element.value).toBe('1,2');
	rig.project.stale = false; await settle(); await form.trigger('submit');
	expect(task.draft.points).toEqual([{ x: 1000, y: 1000 }, { x: 1000, y: -2000 }]); expect(task.draft.stair.width).toBe(1200);
	expect(task.draft.pendingInput).toBe(false); expect([...rig.stack.vault.entries]).toEqual(before);
});
