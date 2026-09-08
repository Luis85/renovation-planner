/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined, expectOk } from '../../helpers/domain';
import { createTrade, type TradeId } from '../../../src/domain/trade/Trade';
import { err } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
describe('Project Work through real native forms and repositories', () => {
 it('refreshes a renamed Trade and preserves a missing assignment while allowing an explicit DIY change', async () => {
  const rig = await downstreamStack(), trade = expectOk(createTrade('trade' as TradeId, 'Finishing'));
  const named = expectOk(await rig.persistence.trades.save(trade, 'absent')), view = await downstreamView(rig, 'schedule');
  try {
   const baseline = expectOk(await view.work.renovation.read(rig.plan.id));
   const work = { ...rig.value.work[0], responsibility: 'trade' as const, tradeId: trade.id, schedule: { start: '2026-09-07' } };
   expectOk(await view.work.renovation.command(baseline, { renovation: { ...rig.value, work: [work] }, intended: undefined }, rig.ledger).execute()); await flushPromises();
   expectOk(await rig.persistence.trades.save({ ...trade, name: 'Renamed finishing' }, named.version));
   await rig.root.eventBus.publish({ type: 'ProjectIndexEntryChanged', payload: { entityType: 'renovation-trade' } }); await flushPromises();
   expect(view.wrapper.text()).toContain('Renamed finishing');
   rig.stack.vault.entries.delete(expectDefined(rig.persistence.index.getPath(trade.id), 'Trade path'));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   expect(view.wrapper.text()).toContain(tr('trade.unresolved', { id: trade.id }));
   await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('[data-rp-form="renovation"]'); expect(form.get<HTMLSelectElement>('select[name="responsibility"]').element.value).toBe('trade:' + trade.id);
   await form.get('select[name="responsibility"]').setValue('diy'); await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
   const saved = expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'Plan').entity.renovation?.work[0];
   expect(saved?.responsibility).toBe('diy'); expect(saved?.tradeId).toBeUndefined(); expect(saved?.schedule?.start).toBe('2026-09-07');
  } finally { view.dispose(); }
 });
 it('previews and applies a Trade/date assignment and conditionally undoes and redoes it', async () => {
  const rig = await downstreamStack(), trade = expectOk(createTrade('trade' as TradeId, 'Finishing'));
  expectOk(await rig.persistence.trades.save(trade, 'absent')); const view = await downstreamView(rig, 'schedule');
  try {
   await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('[data-rp-form="renovation"]');
   await form.get('select[name="responsibility"]').setValue('trade:' + trade.id);
   await form.get('input[name="schedule-start"]').setValue('2026-09-07'); await form.get('input[name="schedule-end"]').setValue('2026-09-09');
   await form.trigger('submit'); await flushPromises(); expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].responsibility).toBe('diy');
   await form.trigger('submit'); await flushPromises();
   expect(view.wrapper.find('[data-rp-form="renovation"]').exists()).toBe(false);
   expect(view.wrapper.text()).toContain('Finishing'); expect(view.wrapper.text()).toContain('2026-09-09');
   expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].tradeId).toBe(trade.id);
   await view.button(tr('editor.context.undo')).trigger('click'); await flushPromises(); expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].schedule).toBeUndefined();
   await view.button(tr('editor.context.redo')).trigger('click'); await flushPromises(); expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].schedule?.end).toBe('2026-09-09');
  } finally { view.dispose(); }
 });
 it('retains a successful date write when read-back fails and retries only the projection', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  try {
   await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('[data-rp-form="renovation"]'); await form.get('input[name="schedule-start"]').setValue('2026-09-08'); await form.trigger('submit'); await flushPromises();
   const read = vi.spyOn(view.work, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'test.read-back', message: 'offline' })), writes = vi.spyOn(rig.persistence.plans, 'save');
   await form.trigger('submit'); await flushPromises(); expect(writes).toHaveBeenCalledOnce(); expect(view.wrapper.text()).toContain(tr('save-state.saved-refresh-needed'));
   read.mockRestore(); await view.button(tr('view.project.resume-retry')).trigger('click'); await flushPromises();
   expect(writes).toHaveBeenCalledOnce(); expect(view.wrapper.text()).toContain('2026-09-08'); expect(view.wrapper.text()).not.toContain(tr('save-state.saved-refresh-needed'));
  } finally { view.dispose(); }
 });
 it('keeps invalid native date input and refuses navigation while a draft dialog is open', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  try {
   await view.button(tr('renovation.edit.work')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('[data-rp-form="renovation"]'), field = form.get<HTMLInputElement>('input[name="schedule-start"]');
   await field.setValue('2026-02-29'); field.element.focus(); await form.trigger('submit'); await flushPromises();
   expect(field.element.value).toBe('2026-02-29'); expect(field.attributes('aria-invalid')).toBe('true'); expect(await view.context.session?.canLeave?.()).toBe(false);
   expect(expectOk(await rig.persistence.plans.getById(rig.plan.id))?.entity.renovation?.work[0].schedule).toBeUndefined();
  } finally { view.dispose(); }
 });
});
