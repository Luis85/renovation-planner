/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import NamedCatalogueForm from '../../../src/presentation/catalogue/NamedCatalogueForm.vue';
import { guardedNamedCatalogue } from '../../../src/plugin/namedCatalogueServices';
import { createTrade } from '../../../src/domain/trade/Trade';
import { downstreamStack } from '../../helpers/downstream';
import { defer } from '../../helpers/async';
import { expectOk } from '../../helpers/domain';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack();
 const services = guardedNamedCatalogue({ kind: 'trade', repository: rig.persistence.trades, create: createTrade }, rig.root.eventBus, rig.root.logger);
 const wrapper = mount(NamedCatalogueForm, { attachTo: document.body, props: { kind: 'trade', busy: ref(false), create: input => services.create(input) } });
 await wrapper.get('input[name="name"]').setValue('Finishing');
 return { rig, wrapper, form: wrapper.get('form') };
}
describe('Named catalogue form lifecycle', () => {
 it('refuses a detached native submit after the owning dialog has unmounted', async () => {
  const { rig, wrapper, form } = await setup(), writes = vi.spyOn(rig.persistence.trades, 'save');
  wrapper.unmount(); await form.trigger('submit'); await flushPromises();
  expect(writes).not.toHaveBeenCalled(); expect(expectOk(await rig.persistence.trades.listAll()).loaded).toHaveLength(0); rig.dispose();
 });
 it('coalesces submits while saving and lets an authorized write finish without emitting after disposal', async () => {
  const { rig, wrapper, form } = await setup(), entered = defer<void>(), held = defer<void>();
  const original = rig.persistence.trades.save.bind(rig.persistence.trades);
  const writes = vi.spyOn(rig.persistence.trades, 'save').mockImplementationOnce(async (...args) => { entered.resolve(); await held.promise; return original(...args); });
  await form.trigger('submit'); await entered.promise; await form.trigger('submit');
  wrapper.unmount(); held.resolve(); await flushPromises();
  expect(writes).toHaveBeenCalledOnce(); expect(expectOk(await rig.persistence.trades.listAll()).loaded.map(value => value.entity.name)).toEqual(['Finishing']);
  expect(wrapper.emitted('submit')).toBeUndefined(); rig.dispose();
 });
});
