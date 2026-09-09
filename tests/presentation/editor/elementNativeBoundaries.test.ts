// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const element = { id: 'element-boundary-path', kind: 'path' as const, name: 'Side path', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }] };
async function setup(seed = true) {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	if (seed) {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
		rig.selection.select([element.id as never]); await settle();
	}
	return rig;
}
async function stairParameters(rig: Awaited<ReturnType<typeof setup>>) {
	rig.runtime.setTool('place-stair'); await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'Stair baseline'); await settle();
	return rig.wrapper.get('[data-rp-form="stair-parameters"]');
}

it('refuses an absent element and an Inspector click whose selection retired before the next render', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], read = vi.spyOn(rig.renovation, 'read');
	await rig.runtime.elementActions.edit('element-no-longer-present'); expect(rig.dialogs.current).toBeNull();
	const opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="edit-element"]');
	read.mockClear(); rig.selection.clear(); opener.element.click(); await settle();
	expect(read).not.toHaveBeenCalled(); expect(rig.dialogs.current).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('discards a failed native edit read after leaf disposal without publishing a fault or stealing focus', async () => {
	const rig = await setup(), pending = defer<void>();
	vi.spyOn(rig.renovation, 'read').mockImplementationOnce(async () => { await pending.promise; throw new Error('retired edit read'); });
	const log = vi.spyOn(rig.deps.commands.logger, 'error'), bytes = [...rig.stack.vault.entries];
	await rig.wrapper.get('[data-rp-action="edit-element"]').trigger('click'); await settle();
	mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
	const other = document.createElement('button'); document.body.append(other); other.focus();
	try {
		pending.resolve(); await settleUntil(() => !rig.runtime.elementActions.active.value, 'retired read'); await settle();
		expect(log.mock.calls.some(([event]) => event === 'editor.element.operation-failed')).toBe(false);
		expect(rig.dialogs.current).toBeNull(); expect(document.activeElement).toBe(other); expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { other.remove(); }
});

it('moves from an unchanged geometry baseline after a metadata-only rename and retains that state on a later write refusal', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { ...element, name: 'Renamed path' }), rig.runtime.structureTask.ledger)));
	const moved = element.points.map(point => ({ x: point.x + 250, y: point.y + 100 }));
	await rig.runtime.elementActions.move(element.id, moved, element); await settle();
	expect(rig.project.structure.elements?.[0].points).toEqual(moved); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Renamed path');
	const before = expectOk(await rig.renovation.read(rig.plan.id)), planPath = expectDefined(rig.stack.index.getPath(rig.plan.id), 'Plan path');
	const unrelatedBytes = [...rig.stack.vault.entries].filter(([path]) => path !== planPath);
	const write = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError())), savePlan = vi.spyOn(rig.stack.plans, 'save');
	await rig.runtime.elementActions.move(element.id, element.points, { ...element, points: moved }); await settle();
	expect(write).toHaveBeenCalledExactlyOnceWith(rig.plan.id, expect.objectContaining({ structure: expect.objectContaining({ elements: [expect.objectContaining({ id: element.id, points: element.points })] }) }), before.geometry.version);
	expect(savePlan).toHaveBeenCalledTimes(2); expect(savePlan.mock.calls[0][1]).toEqual(before.plan.version);
	expect(savePlan.mock.calls[1][1]).toEqual(expect.objectContaining({ revision: before.plan.version.revision + 1 }));
	const after = expectOk(await rig.renovation.read(rig.plan.id));
	expect(after.plan.entity).toEqual(before.plan.entity); expect(after.plan.version.revision).toBe(before.plan.version.revision + 2);
	expect(after.geometry).toEqual(before.geometry); expect([...rig.stack.vault.entries].filter(([path]) => path !== planPath)).toEqual(unrelatedBytes);
	expect(rig.runtime.elementActions.active.value).toBe(false);
	expect(rig.project.structure.elements?.[0].points).toEqual(moved); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Renamed path');
});

it('keeps invalid native Stair dimensions pending and consumes chorded Enter without placing geometry', async () => {
	const rig = await setup(false), before = [...rig.stack.vault.entries], form = await stairParameters(rig), task = rig.runtime.elementTask;
	await form.get('input[name="stair-width"]').setValue('invalid'); await form.trigger('submit');
	expect(task.draft.pendingInput).toBe(true); expect(task.draft.points).toEqual([]);
	expect(form.get('input[name="stair-width"]').attributes('aria-invalid')).toBe('true');
	const chord = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
	form.get('input[name="stair-width"]').element.dispatchEvent(chord); expect(chord.defaultPrevented).toBe(true);
	await form.get('input[name="stair-width"]').setValue('1.2'); await form.get('input[name="stair-run"]').setValue('2.5'); await form.trigger('submit');
	expect(task.draft.points).toEqual([{ x: 0, y: 0 }, { x: 0, y: -2500 }]); expect(task.draft.stair.width).toBe(1200);
	rig.runtime.cancelActiveTask(); await settle(); expect(rig.runtime.activeToolId.value).toBe('select');
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('freezes native Stair creation parameters during the real geometry write and saves the reviewed dimensions once', async () => {
	const rig = await setup(false), form = await stairParameters(rig), task = rig.runtime.elementTask;
	await form.get('input[name="stair-width"]').setValue('1.2'); await form.get('input[name="stair-run"]').setValue('2.5'); await form.trigger('submit');
	const expectedPoints = [...task.draft.points], gate = defer<void>(), write = rig.geometry.write.bind(rig.geometry);
	const writing = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
	const finishing = task.finish();
	try {
		await settleUntil(() => writing.mock.calls.length === 1, 'pending Stair geometry write');
		await form.get('input[name="stair-width"]').setValue('9'); await form.get('select[name="stair-direction"]').setValue('down'); await form.trigger('submit');
		expect(form.get('input[name="stair-width"]').element).toHaveProperty('value', '1.2');
		expect(task.draft.points).toEqual(expectedPoints); expect(task.draft.stair).toEqual({ width: 1200, treads: 12, direction: 'up' });
		expect(writing).toHaveBeenCalledTimes(1); gate.resolve(); await finishing; await settle();
		expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'stair', points: expectedPoints, stair: { width: 1200, treads: 12, direction: 'up' } });
	} finally { gate.resolve(); }
});
