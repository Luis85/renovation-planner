/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined, expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { createTrade, type TradeId } from '../../../src/domain/trade/Trade';
import { err } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
import WorkResponsibilityFields from '../../../src/presentation/catalogue/WorkResponsibilityFields.vue';
import * as notices from '../../../src/presentation/notices/notify';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

async function editWork(view: Awaited<ReturnType<typeof downstreamView>>) {
 await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
 return view.wrapper.get('[data-rp-form="renovation"]');
}
async function submitWork(form: Awaited<ReturnType<typeof editWork>>) {
 await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
}

describe('Work choices retain intent across native edits and catalogue failures', () => {
 it('discloses a refused Trade note while keeping readable choices available', async () => {
  const rig = await downstreamStack();
  for (const [id, name] of [['readable-trade', 'Floor finishing'], ['invalid-trade', 'Broken trade']]) {
   expectOk(await rig.persistence.trades.save(expectOk(createTrade(id as TradeId, name)), 'absent'));
  }
  const path = expectDefined(rig.persistence.index.getPath('invalid-trade' as TradeId), 'Trade path');
  const bytes = expectDefined(rig.stack.vault.entries.get(path), 'Trade bytes');
  const invalid = bytes.replace(/name: .+/, 'name: 42'); expect(invalid).not.toBe(bytes);
  rig.stack.vault.entries.set(path, invalid);
  const view = await downstreamView(rig, 'schedule');
  try {
   const form = await editWork(view), responsibility = view.wrapper.getComponent(WorkResponsibilityFields);
   expect(responsibility.text()).toContain(tr('trade.partial'));
   expect(responsibility.text()).toContain('Floor finishing'); expect(responsibility.text()).not.toContain('Broken trade');
   await form.get('select[name="responsibility"]').setValue('trade:readable-trade'); await submitWork(form);
   expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].tradeId).toBe('readable-trade');
   expect(rig.stack.vault.entries.get(path)).toBe(invalid);
  } finally { view.dispose(); }
 });

 it('clears either date independently, then removes the schedule when its final date is cleared', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  try {
   let form = await editWork(view);
   await form.get('input[name="schedule-start"]').setValue('2026-09-07');
   await form.get('input[name="schedule-end"]').setValue('2026-09-09');
   await submitWork(form);
   form = await editWork(view); await form.get('input[name="schedule-start"]').setValue(''); await submitWork(form);
   expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].schedule).toEqual({ end: '2026-09-09' });
   form = await editWork(view); await form.get('input[name="schedule-end"]').setValue('');
   await form.get('select[name="responsibility"]').setValue('unassigned'); await submitWork(form);
   const work = expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0];
   expect(work?.schedule).toBeUndefined(); expect(work?.responsibility).toBe('unassigned');
  } finally { view.dispose(); }
 });

 it('keeps accepted dates and responsibility while a native save is in flight', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  const held = defer<void>(), entered = defer<void>();
  try {
   const form = await editWork(view);
   await form.get('input[name="schedule-start"]').setValue('2026-09-07');
   await form.trigger('submit'); await flushPromises();
   const save = rig.persistence.plans.save.bind(rig.persistence.plans);
   const writes = vi.spyOn(rig.persistence.plans, 'save').mockImplementationOnce(async (...args) => { entered.resolve(); await held.promise; return save(...args); });
   await form.trigger('submit'); await entered.promise; await flushPromises();
   const start = form.get<HTMLInputElement>('input[name="schedule-start"]'), end = form.get<HTMLInputElement>('input[name="schedule-end"]');
   expect(start.element.readOnly).toBe(true); expect(end.element.readOnly).toBe(true);
   await start.setValue('2030-01-01'); await end.setValue('2030-01-02');
   await form.get('select[name="responsibility"]').setValue('unassigned');
   expect(start.element.value).toBe('2026-09-07'); expect(end.element.value).toBe('');
   expect(form.get<HTMLSelectElement>('select[name="responsibility"]').element.value).toBe('diy');
   held.resolve(); await flushPromises();
   expect(writes).toHaveBeenCalledOnce();
   expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0]).toMatchObject({ responsibility: 'diy', schedule: { start: '2026-09-07' } });
  } finally { held.resolve(); await flushPromises(); view.dispose(); }
 });

 it('retains a Trade selection on catalogue failure and retries the real catalogue without writing the Plan', async () => {
  const rig = await downstreamStack(), trade = expectOk(createTrade('choice-trade' as TradeId, 'Floor finishing'));
  expectOk(await rig.persistence.trades.save(trade, 'absent'));
  const view = await downstreamView(rig, 'schedule');
  try {
   const form = await editWork(view), field = form.get<HTMLSelectElement>('select[name="responsibility"]');
   await field.setValue('trade:' + trade.id);
   const before = [...rig.stack.vault.entries], listing = vi.spyOn(rig.persistence.trades, 'listAll').mockResolvedValue(err({ category: 'Persistence', code: 'trade.read-failed', message: 'Offline' }));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   const responsibility = view.wrapper.getComponent(WorkResponsibilityFields);
   expect(responsibility.text()).toContain(tr('trade.unavailable')); expect(field.element.value).toBe('trade:' + trade.id);
   listing.mockRestore();
   await expectDefined(responsibility.findAll('button').find(button => button.text() === tr('editor.warning.retry')), 'catalogue Retry').trigger('click'); await flushPromises();
   expect(responsibility.text()).not.toContain(tr('trade.unavailable')); expect(field.element.value).toBe('trade:' + trade.id);
   expect([...rig.stack.vault.entries]).toEqual(before);
  } finally { view.dispose(); }
 });

 it('refuses a different Trade while the catalogue is unavailable, keeping the one already chosen', async () => {
  const rig = await downstreamStack();
  for (const [id, name] of [['trade-a', 'Floor finishing'], ['trade-b', 'Tiling']]) expectOk(await rig.persistence.trades.save(expectOk(createTrade(id as TradeId, name)), 'absent'));
  const view = await downstreamView(rig, 'schedule');
  try {
   const form = await editWork(view), field = form.get<HTMLSelectElement>('select[name="responsibility"]');
   await field.setValue('trade:trade-a');
   vi.spyOn(rig.persistence.trades, 'listAll').mockResolvedValue(err({ category: 'Persistence', code: 'trade.read-failed', message: 'Offline' }));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   await field.setValue('trade:trade-b'); await flushPromises();
   expect(field.element.value).toBe('trade:trade-a');
   expect(view.wrapper.getComponent(WorkResponsibilityFields).props('modelValue')).toMatchObject({ responsibility: 'trade', tradeId: 'trade-a' });
  } finally { view.dispose(); }
 });

 it('marks the catalogue failed and reports once when the listing itself faults, and ignores a late fault after close', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined), fault = new Error('Listing crashed');
  try {
   await editWork(view);
   const listing = vi.spyOn(view.work.trades, 'list').mockRejectedValueOnce(fault);
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   expect(report).toHaveBeenCalledExactlyOnceWith(fault, view.context.commands.logger, 'trade.list-failed');
   const responsibility = view.wrapper.getComponent(WorkResponsibilityFields);
   expect(responsibility.text()).toContain(tr('trade.unavailable'));
   const held = defer<void>(); listing.mockImplementationOnce(async () => { await held.promise; throw new Error('Late listing failure'); });
   await responsibility.get('button').trigger('click');
   view.dispose(); held.resolve(); await flushPromises();
   expect(report).toHaveBeenCalledOnce();
  } finally { if (view.wrapper.exists()) view.dispose(); }
 });

 it('keeps a failed catalogue readable after an unexpected listing fault and ignores a late fault after close', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  try {
   await editWork(view);
   const listing = vi.spyOn(rig.persistence.trades, 'listAll').mockRejectedValue(new Error('Vault listing failed'));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   expect(view.wrapper.getComponent(WorkResponsibilityFields).text()).toContain(tr('trade.unavailable'));
   const held = defer<void>(); listing.mockImplementation(async () => { await held.promise; throw new Error('Late listing failure'); });
   await view.wrapper.getComponent(WorkResponsibilityFields).get('button').trigger('click');
   view.dispose(); held.resolve(); await flushPromises();
   expect(document.querySelector('[data-rp-form="renovation"]')).toBeNull();
  } finally { if (view.wrapper.exists()) view.dispose(); }
 });
});
