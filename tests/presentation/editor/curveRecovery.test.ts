// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { settle } from '../../helpers/editor';
import { err, ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { trError } from '../../../src/presentation/i18n/toUserMessage';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const refusal = { category: 'Validation' as const, code: 'curve.refused', message: 'This edit was refused.' };
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	return { rig, task: rig.runtime.curveTask, service: expectDefined(rig.deps.commands.groups, 'geometry service') };
}
function retire(rig: Awaited<ReturnType<typeof renovationEditor>>): void { mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); }

it('uses native edge, radius, straighten, Apply and Cancel controls with invalid-field and exit focus', async () => {
	const { rig, task } = await setup();
	await rig.wrapper.get('[data-rp-action="edit-curves"]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="edit-curves"]');
	await form.get('select').setValue('1'); expect(task.state.edge).toBe(1);
	await form.get('input[name="radius"]').setValue('1'); await form.trigger('submit');
	expect(document.activeElement).toBe(form.get('input[name="radius"]').element); expect(form.find('[role="alert"]').exists()).toBe(true);
	await form.get('input[name="radius"]').setValue('1.5'); expect(task.target.value?.geometry.bulges?.[1]).toBe(1);
	await expectDefined(form.findAll('button').find(button => button.text() === 'Straighten this edge'), 'straighten').trigger('click');
	expect(task.state.text.radius).toBe('');
	await form.get('input[name="depth"]').setValue('0.3'); await form.trigger('submit'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.project.zones.get(rig.room.id)?.bulges?.[1]).toBeCloseTo(0.2);
	await task.open(rig.room.id); await settle(); const bytes = [...rig.stack.vault.entries];
	const cancel = expectDefined(rig.wrapper.findAll<HTMLButtonElement>('[data-rp-form="edit-curves"] button').find(button => button.text() === 'Cancel'), 'cancel');
	cancel.element.focus(); await cancel.trigger('click'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(document.activeElement).toBe(rig.canvasEl); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps returned read errors visible and catches unexpected read faults without creating a draft or write', async () => {
	const { rig, task, service } = await setup(), bytes = [...rig.stack.vault.entries], log = vi.spyOn(rig.deps.commands.logger, 'error');
	vi.spyOn(service, 'read').mockResolvedValueOnce(err(refusal)); await task.open(rig.room.id); await settle();
	expect(task.state.error).toEqual(refusal); expect(rig.wrapper.get('[data-rp-form="edit-curves"] [role="alert"]').text()).toBe(trError(refusal));
	task.choose(0); task.input('depth', '0.2'); task.set(0, 0.2); await task.finish(); expect(task.target.value).toBeNull();
	task.cancel(); await settle();
	const cause = new Error('read failed'); vi.spyOn(service, 'read').mockRejectedValueOnce(cause);
	await task.open(rig.room.id); expect(task.state.loading).toBe(false); expect(task.target.value).toBeNull();
	expect(log).toHaveBeenCalledWith('editor.curves.read-failed', expect.objectContaining({ cause })); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it.each(['cancel', 'close', 'late-fault'] as const)('retires an outstanding source read on %s without restoring a ghost draft', async mode => {
	const { rig, task, service } = await setup(), baseline = await service.read(rig.plan.id), pending = defer<void>();
	const log = vi.spyOn(rig.deps.commands.logger, 'error'); vi.spyOn(service, 'read').mockImplementationOnce(async () => {
		await pending.promise; if (mode === 'late-fault') throw new Error('late read'); return baseline;
	});
	const opening = task.open(rig.room.id);
	if (mode === 'cancel') { task.cancel(); await settle(); } else retire(rig);
	pending.resolve(undefined);
	await opening; expect(task.target.value).toBeNull(); expect(task.state.loading).toBe(false);
	expect(log.mock.calls.some(([event]) => event === 'editor.curves.read-failed')).toBe(false);
});

it.each(['missing', 'different'] as const)('refuses a %s saved outline before accepting a curve baseline', async mode => {
	const { rig, task, service } = await setup(), baseline = expectOk(await service.read(rig.plan.id));
	const objects = baseline.document.objects.flatMap(object => object.id !== rig.room.id ? [object] : mode === 'missing' ? [] : [{ ...object, points: object.points.map(point => ({ x: point.x + 20, y: point.y })) }]);
	vi.spyOn(service, 'read').mockResolvedValueOnce(ok({ ...baseline, document: { ...baseline.document, objects } }));
	const bytes = [...rig.stack.vault.entries]; await task.open(rig.room.id); await settle();
	expect(task.state.conflict).toBe(true); expect(task.target.value).toBeNull(); expect(task.preview.value).toBeNull();
	task.input('depth', '0.5'); task.choose(1); await task.finish(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('freezes native values and tool lifetime while Apply is pending, then retains a refused draft', async () => {
	const { rig, task, service } = await setup(); await task.open(rig.room.id); task.input('depth', '0.5');
	const pending = defer<DispatchResult>(), command = vi.spyOn(service, 'command').mockReturnValue({ execute: () => pending.promise, undo: () => Promise.resolve(ok('no-write')) });
	const bytes = [...rig.stack.vault.entries], text = { ...task.state.text }, apply = task.finish();
	task.input('depth', '0.9'); task.set(0, 0.8); task.choose(1); task.cancel(); rig.runtime.setTool('draw-wall'); await task.finish();
	expect(task.state.text).toEqual(text); expect(task.state.edge).toBe(0); expect(rig.runtime.activeToolId.value).toBe('edit-curves'); expect(command).toHaveBeenCalledOnce();
	pending.resolve(err(refusal)); await apply; await settle();
	expect(task.state.busy).toBe(false); expect(task.state.conflict).toBe(true); expect(task.state.error).toEqual(refusal); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('catches unexpected command creation faults and retires completion after its leaf closes', async () => {
	const { rig, task, service } = await setup(); await task.open(rig.room.id); task.set(0, 0.25);
	const cause = new Error('command unavailable'), log = vi.spyOn(rig.deps.commands.logger, 'error');
	vi.spyOn(service, 'command').mockImplementationOnce(() => { throw cause; }); await task.finish();
	expect(log).toHaveBeenCalledWith('editor.curves.write-failed', expect.objectContaining({ cause })); expect(task.state.busy).toBe(false);
	const pending = defer<DispatchResult>(); vi.spyOn(service, 'command').mockReturnValueOnce({ execute: () => pending.promise, undo: () => Promise.resolve(ok('no-write')) });
	const apply = task.finish(); retire(rig); pending.resolve(ok('no-write')); await apply;
	expect(task.target.value).toBeNull(); expect(task.state.busy).toBe(false);
});

it('retains typed curve values through a failed refresh and enables them again only after successful read-back', async () => {
	const { rig, task } = await setup(); await task.open(rig.room.id); task.input('depth', '0.5');
	const bytes = [...rig.stack.vault.entries], read = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	await rig.runtime.refreshProjection(); await settle();
	expect(task.blocked.value).toBe(true); expect(task.target.value?.id).toBe(rig.room.id); expect(task.state.text.depth).toBe('0.5');
	await task.finish(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	read.mockRestore(); await rig.runtime.refreshProjection(); await settle();
	expect(task.blocked.value).toBe(false); expect(task.state.text.depth).toBe('0.5');
	await task.finish(); await settle(); expect(rig.project.zones.get(rig.room.id)?.bulges?.[0]).toBe(0.25);
});

it('discards the curve task when its leaf changes to Review without committing the preview', async () => {
	const { rig, task } = await setup(); await task.open(rig.room.id); task.set(0, 0.25);
	const bytes = [...rig.stack.vault.entries]; rig.session.perspective = 'review'; await settle();
	expect(task.target.value).toBeNull(); expect(rig.runtime.activeToolId.value).toBe('select'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
