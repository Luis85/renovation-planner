// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { defer } from '../../helpers/async';
import { FakeWorkspace } from '../../helpers/workspace';
import { planEditorOpenNote } from '../../../src/plugin/renovationProjectOpenSeams';
import { err } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
it('opens a paused Work draft source and retries the read while preserving raw input and never applying the draft', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule'), workspace = new FakeWorkspace();
 Object.assign(view.context, { openRecord: planEditorOpenNote(workspace as never, rig.stack.deps.vault, rig.persistence.index, rig.stack.logger) });
 try {
  await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
  const form = view.wrapper.get('[data-rp-form="renovation"]'), field = form.get<HTMLInputElement>('input[name="schedule-start"]');
  await field.setValue('2026-02-29');
  const read = vi.spyOn(view.work, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'test.peer-read', message: 'Peer read unavailable' }));
  await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
  const bytes = [...rig.stack.vault.entries], writes = vi.spyOn(rig.persistence.plans, 'save');
  await form.get('.rp-draft-recovery').findAll('button')[1].trigger('click'); await flushPromises();
  expect(workspace.leaves.at(-1)?.opened[0]?.path).toBe(rig.persistence.index.getPath(rig.plan.id));
  expect(field.element.value).toBe('2026-02-29'); await form.trigger('submit'); await flushPromises(); expect(writes).not.toHaveBeenCalled();
  read.mockRestore(); await view.button(tr('planning.retry')).trigger('click'); await flushPromises();
  expect(form.find('.rp-draft-recovery').exists()).toBe(false); expect(field.element.value).toBe('2026-02-29');
  expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { view.dispose(); }
});
it('retires a successful Work baseline that finishes after its Project view has closed', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule'), entered = defer<void>(), held = defer<void>();
 const original = view.work.renovation.read.bind(view.work.renovation), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
 vi.spyOn(view.work.renovation, 'read').mockImplementationOnce(async id => { const result = await original(id); entered.resolve(); await held.promise; return result; });
 let disposed = false;
 try {
  await view.button(tr('renovation.edit.work')).trigger('click'); await entered.promise;
  expect(await view.context.session?.canLeave?.()).toBe(false); const bytes = [...rig.stack.vault.entries];
  view.dispose(); disposed = true; held.resolve(); await flushPromises();
  expect(document.querySelector('.rp-dialog')).toBeNull(); expect(view.context.session?.canLeave).toBeUndefined();
  expect(report).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { held.resolve(); if (!disposed) view.dispose(); }
});
it('keeps an already landed Work write when its completion arrives after disposal and performs no read-back or late notification', async () => {
 const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule'), entered = defer<void>(), held = defer<void>();
 let disposed = false;
 try {
  await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
  const form = view.wrapper.get('[data-rp-form="renovation"]'); await form.get('input[name="schedule-start"]').setValue('2026-09-19');
  await form.trigger('submit'); await flushPromises();
  const original = view.work.renovation.command.bind(view.work.renovation), writes = vi.spyOn(rig.persistence.plans, 'save');
  vi.spyOn(view.work.renovation, 'command').mockImplementationOnce((...args) => {
   const command = original(...args);
   return { execute: async () => { const result = await command.execute(); entered.resolve(); await held.promise; return result; }, undo: () => command.undo() };
  });
  const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
  await form.trigger('submit'); await entered.promise; const bytes = [...rig.stack.vault.entries];
  view.dispose(); disposed = true; const read = vi.spyOn(view.work, 'read'); held.resolve(); await flushPromises();
  expect(writes).toHaveBeenCalledOnce(); expect(read).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled();
  expect(view.context.session?.canLeave).toBeUndefined(); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(document.querySelector('.rp-dialog')).toBeNull();
 } finally { held.resolve(); if (!disposed) view.dispose(); }
});
