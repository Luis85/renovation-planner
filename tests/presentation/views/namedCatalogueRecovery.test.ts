/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { tr } from '../../../src/presentation/i18n/strings';
import NamedCatalogueForm from '../../../src/presentation/catalogue/NamedCatalogueForm.vue';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('Native catalogue creation preserves drafts and retires closed views', () => {
 it.each(['trade', 'supplier'] as const)('retains the %s name on a validation refusal and an unexpected write fault, then retries', async kind => {
  const rig = await downstreamStack(), view = await downstreamView(rig, kind === 'trade' ? 'schedule' : 'quotes');
  try {
   await view.button(tr(kind === 'trade' ? 'trade.add' : 'supplier.add')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('.rp-dialog-form'), name = form.get<HTMLInputElement>('input[name="name"]');
   await name.setValue('   '); await form.trigger('submit'); await flushPromises();
   expect(form.find('[role="alert"]').exists()).toBe(true); expect(name.element.value).toBe('   ');
   const repository = kind === 'trade' ? rig.persistence.trades : rig.persistence.suppliers;
   const writes = vi.spyOn(repository, 'save').mockRejectedValueOnce(new Error('Vault write unavailable'));
   await name.setValue('Local finishing'); await name.trigger('keydown', { key: 'Enter', code: 'Enter' });
   await form.trigger('submit'); await flushPromises();
   expect(form.find('[role="alert"]').exists()).toBe(true); expect(name.element.readOnly).toBe(false); expect(name.element.value).toBe('Local finishing');
   await form.trigger('submit'); await flushPromises();
   expect(view.wrapper.find('.rp-dialog-form').exists()).toBe(false); expect(writes).toHaveBeenCalledTimes(2);
   const names = kind === 'trade'
    ? expectOk(await rig.persistence.trades.listAll()).loaded.map(item => item.entity.name)
    : expectOk(await rig.persistence.suppliers.listAll()).loaded.map(item => item.entity.name);
   expect(names).toEqual(['Local finishing']);
  } finally { view.dispose(); }
 });

 it.each([false, true])('does not emit a late catalogue completion after close (fault: %s)', async fault => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'schedule');
  const held = defer<void>(), entered = defer<void>();
  try {
   await view.button(tr('trade.add')).trigger('click'); await flushPromises();
   const component = view.wrapper.getComponent(NamedCatalogueForm), form = component.get('form');
   await form.get('input[name="name"]').setValue('Finishing');
   const save = rig.persistence.trades.save.bind(rig.persistence.trades);
   const writes = vi.spyOn(rig.persistence.trades, 'save').mockImplementationOnce(async (...args) => { entered.resolve(); await held.promise; if (fault) throw new Error('Late vault fault'); return save(...args); });
   await form.trigger('submit'); await entered.promise; await flushPromises();
   expect(form.get<HTMLInputElement>('input[name="name"]').element.readOnly).toBe(true);
   await form.trigger('submit'); expect(writes).toHaveBeenCalledOnce();
   view.dispose(); held.resolve(); await flushPromises();
   expect(component.emitted('submit')).toBeUndefined();
   expect(expectOk(await rig.persistence.trades.listAll()).loaded).toHaveLength(fault ? 0 : 1);
  } finally { held.resolve(); await flushPromises(); if (view.wrapper.exists()) view.dispose(); }
 });
});
