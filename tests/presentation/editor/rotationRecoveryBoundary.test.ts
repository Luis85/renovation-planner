// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const operation = rig.runtime.rotationActions.rotate(rig.room.id);
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'Room rotation form');
	const component = rig.wrapper.getComponent(ObjectRotationForm), form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await form.get('input').setValue('25.5');
	return { ...rig, operation, component, form };
}
it('keeps typed rotation values through read-only retry, opens the source and commits once after recovery', async () => {
	const rig = await setup(), write = vi.spyOn(rig.deps.commands.zones, 'save');
	const read = vi.spyOn(rig.deps.queries, 'findZonesByPlan').mockResolvedValue(err(injectedPersistenceError()));
	await rig.runtime.refreshProjection(); await settle();
	const buttons = rig.form.get('.rp-draft-recovery').findAll('button');
	await buttons[1].trigger('click'); expect(rig.openedNote()).toBe(1);
	await buttons[0].trigger('click'); await settle(); expect(rig.project.stale).toBe(true); expect(write).not.toHaveBeenCalled();
	expect(rig.form.get('input').element).toHaveProperty('value', '25.5');
	read.mockRestore(); await buttons[0].trigger('click'); await settleUntil(() => !rig.project.stale, 'rotation recovered');
	await rig.form.trigger('submit'); await rig.operation;
	expect(write).toHaveBeenCalledTimes(1); expect(rig.dialogs.current).toBeNull();
	expect(rig.project.zones.get(rig.room.id)?.points).not.toEqual(rig.room.geometry.points);
});
it.each(['plan.external-modification', 'undo.superseded'])('retires a numeric draft after %s without replaying its command', async code => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	const dispatch = vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ ...injectedPersistenceError(), code }));
	await rig.form.trigger('submit'); await settle();
	expect(dispatch).toHaveBeenCalledTimes(1); expect(rig.form.text()).toContain('changed');
	expect(rig.form.get('input').element).toHaveProperty('value', '25.5');
	await rig.form.trigger('submit'); expect(dispatch).toHaveBeenCalledTimes(1); expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.dialogs.resolve('cancel'); await rig.operation;
});
it('makes a retained Retry callback inert after its editor is closed', async () => {
	const rig = await setup(), retry = rig.component.props('retry');
	rig.dialogs.resolve('cancel'); await rig.operation;
	rig.unmount(); mounted.splice(mounted.indexOf(rig), 1);
	const refresh = vi.spyOn(rig.runtime, 'refreshProjection'), bytes = [...rig.stack.vault.entries];
	await retry(); expect(refresh).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('lets an already dispatched failure finish after close without restoring a form or writing geometry', async () => {
	const rig = await setup(), pending = defer<DispatchResult>(), bytes = [...rig.stack.vault.entries];
	const run = vi.spyOn(rig.runtime.dispatcher, 'run').mockReturnValueOnce(pending.promise);
	await rig.form.trigger('submit'); expect(run).toHaveBeenCalledTimes(1);
	rig.unmount(); mounted.splice(mounted.indexOf(rig), 1);
	pending.resolve(err(injectedPersistenceError())); await rig.operation;
	expect(rig.runtime.rotationActions.active.value).toBe(false); expect(rig.runtime.rotationActions.preview.value).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.objects[0].points).toEqual(rig.room.geometry.points);
});
