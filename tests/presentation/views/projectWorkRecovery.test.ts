// @vitest-environment jsdom
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';
import RenovationForm from '../../../src/presentation/editor/renovation/RenovationForm.vue';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function peerEdit(rig: Awaited<ReturnType<typeof downstreamStack>>) {
 const loaded = expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'Plan');
 const renovation = expectDefined(loaded.entity.renovation, 'Work register');
 expectOk(await rig.persistence.plans.save(expectOk(withPlanRenovation(loaded.entity, { ...renovation, work: renovation.work.map(work => ({ ...work, title: 'Peer renamed Work' })) })), loaded.version));
}
it('refreshes a peer-changed Work baseline before opening any draft and preserves the peer write', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
 try {
  await peerEdit(rig); const bytes = [...rig.stack.vault.entries], notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
  await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
  expect(view.wrapper.find('[data-rp-form="renovation"]').exists()).toBe(false); expect(view.wrapper.text()).toContain('Peer renamed Work'); expect(notify).toHaveBeenCalledOnce();
  expect([...rig.stack.vault.entries]).toEqual(bytes);
  await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises(); expect(view.wrapper.find('[data-rp-form="renovation"]').exists()).toBe(true);
 } finally { view.dispose(); }
});
it('reports a refused baseline and an unexpected read failure without creating a draft', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
 try {
  const refused = injectedPersistenceError(), fault = new Error('Work baseline failed');
  const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
  const read = vi.spyOn(view.work.renovation, 'read').mockResolvedValueOnce(err(refused)).mockRejectedValueOnce(fault);
  for (let attempt = 0; attempt < 2; attempt++) { await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises(); }
  expect(notify).toHaveBeenCalledExactlyOnceWith(refused); expect(report).toHaveBeenCalledExactlyOnceWith(fault, view.context.commands.logger, 'project.work-edit-failed'); expect(view.wrapper.find('[data-rp-form="renovation"]').exists()).toBe(false);
  read.mockRestore(); await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises(); expect(view.wrapper.find('[data-rp-form="renovation"]').exists()).toBe(true);
 } finally { view.dispose(); }
});
it('blocks floor navigation while a Work baseline is loading and suppresses a late read failure after disposal', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule'), pending = defer<void>();
 const open = vi.spyOn(view.context, 'openPlan'), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
 vi.spyOn(view.work.renovation, 'read').mockReturnValueOnce(pending.promise.then(() => { throw new Error('Retired Work read'); }));
 await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
 expect(await view.context.session?.canLeave?.()).toBe(false); await view.button(tr('schedule.open-floor')).trigger('click'); await flushPromises(); expect(open).not.toHaveBeenCalled();
 view.dispose(); pending.resolve(); await flushPromises(); expect(report).not.toHaveBeenCalled(); expect(view.context.session?.canLeave).toBeUndefined();
});
it('opens the owning floor and Work identity and refuses Undo after an independent peer write', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
 try {
  const open = vi.spyOn(view.context, 'openPlan'); await view.button(tr('schedule.open-floor')).trigger('click'); await flushPromises();
  expect(open).toHaveBeenCalledWith(rig.plan.id, { planId: rig.plan.id, roomId: rig.roomId, workId: 'work-sand' });
  await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
  const form = view.wrapper.get('[data-rp-form="renovation"]'); await form.get('input[name="schedule-start"]').setValue('2026-09-10'); await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
  await peerEdit(rig); const bytes = [...rig.stack.vault.entries], notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
  await view.button(tr('editor.context.undo')).trigger('click'); await flushPromises();
  expect(notify).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(view.wrapper.text()).toContain('Peer renamed Work');
 } finally { view.dispose(); }
});
it('refuses a dispatch that arrives after the view is gone, and lets a paused form open its source on a host that cannot', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
 try {
  await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
  const form = view.wrapper.get('[data-rp-form="renovation"]'), dispatch = view.wrapper.getComponent(RenovationForm).props('dispatch');
  const read = vi.spyOn(view.work, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'test.offline', message: 'Offline' }));
  await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
  expect(view.context.openRecord).toBeUndefined();
  await expectDefined(form.findAll('button').find(button => button.text() === tr('editor.warning.open-source-note')), 'open source').trigger('click'); await flushPromises();
  expect(view.wrapper.find('[data-rp-form="renovation"]').exists()).toBe(true);
  read.mockRestore();
  const baseline = expectOk(await view.work.renovation.read(rig.plan.id)), bytes = [...rig.stack.vault.entries];
  view.dispose();
  expect(await dispatch({ renovation: expectDefined(baseline.plan.entity.renovation, 'renovation'), intended: undefined })).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { if (view.wrapper.exists()) view.dispose(); }
});
it('keeps disabled Undo and Redo inert before any Work edit', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
 try {
  const read = vi.spyOn(view.work, 'read'), notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined), bytes = [...rig.stack.vault.entries];
  for (const key of ['editor.context.undo', 'editor.context.redo'] as const) {
   const button = view.button(tr(key)); expect(button.attributes('aria-disabled')).toBe('true'); await button.trigger('click'); await flushPromises();
  }
  expect(read).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { view.dispose(); }
});
