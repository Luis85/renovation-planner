/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined, expectOk } from '../../helpers/domain';
import { createSupplier, type SupplierId } from '../../../src/domain/supplier/Supplier';
import { saveQuote } from '../../../src/application/commands/quote/QuoteServices';
import type { Quote, QuoteId } from '../../../src/domain/quote/Quote';
import { of } from '../../../src/core/money/Money';
import { tr } from '../../../src/presentation/i18n/strings';
import { defer } from '../../helpers/async';
import { makePlan } from '../../helpers/entities';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

async function openScopedQuote() {
 const rig = await downstreamStack(), supplier = expectOk(createSupplier('scope-supplier' as SupplierId, 'Floor supplier'));
 expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
 const quote: Quote = { id: 'scope-quote' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft',
  items: [{ id: 'scope-line', description: 'Floor preparation', amount: of('500', 'EUR'), assetIds: [rig.asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
 const saved = expectOk(await saveQuote(rig.persistence, { quote, expected: 'absent' }));
 const view = await downstreamView(rig, 'quotes');
 await view.button(tr('quote.edit')).trigger('click'); await flushPromises();
 return { rig, view, saved, form: view.wrapper.get('.rp-quote-form') };
}

describe('Quote scope choices through persisted records and native controls', () => {
 it('edits validity and currency, explicitly removes scope, and prevents repeated/composed Enter from submitting', async () => {
  const { rig, view, saved, form } = await openScopedQuote();
  try {
   const validity = form.get<HTMLInputElement>('input[name="valid-until"]'); await validity.setValue('2026-10-01');
   for (const options of [{ repeat: true }, { isComposing: true }]) {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
    validity.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
   }
   expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.validUntil).toBeUndefined();
   await form.get('input[name="item-currency"]').setValue('USD');
   const groups = form.findAll('details');
   await groups[0].get('input[type="checkbox"]').setValue(false);
   await groups[1].get('input[type="checkbox"]').setValue(false);
   await form.trigger('submit'); await flushPromises();
   expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.items[0].assetIds).toEqual([rig.asset.id]);
   await form.trigger('submit'); await flushPromises();
   const updated = expectDefined(expectOk(await rig.persistence.quotes.getById(saved.entity.id)), 'updated offer').entity;
   expect(updated.validUntil).toBe('2026-10-01'); expect(updated.items[0]).toMatchObject({ amount: { amount: '500', currency: 'USD' }, work: [], assetIds: [] });
   expect(view.wrapper.text()).toContain(tr('quote.unmapped'));
  } finally { view.dispose(); }
 });

 it('retains unresolved Work and Asset identities after peer deletion until the user explicitly removes each link', async () => {
  const { rig, view, saved, form } = await openScopedQuote();
  try {
   const current = expectDefined(expectOk(await rig.persistence.plans.getById(rig.plan.id)), 'Plan');
   expectOk(await rig.persistence.plans.save(makePlan({ ...current.entity, renovation: { ...rig.value, work: [] } }), current.version));
   rig.stack.vault.entries.delete(expectDefined(rig.persistence.index.getPath(rig.asset.id), 'Asset path'));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   expect(form.text()).toContain(tr('quote.unresolved', { id: 'work-sand' }));
   expect(form.text()).toContain(tr('quote.unresolved', { id: rig.asset.id }));
   const groups = form.findAll('details');
   expect(groups[0].get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true);
   expect(groups[1].get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true);
   expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity).toEqual(saved.entity);
   await groups[0].get('input[type="checkbox"]').setValue(false); await groups[1].get('input[type="checkbox"]').setValue(false);
   await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
   expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.items[0]).toMatchObject({ assetIds: [], work: [] });
  } finally { view.dispose(); }
 });

 it('refuses native scope changes while an accepted quote write is pending', async () => {
  const { rig, view, saved, form } = await openScopedQuote(), held = defer<void>(), entered = defer<void>();
  try {
   await form.get('input[name="item-description"]').setValue('Confirmed floor preparation');
   await form.trigger('submit'); await flushPromises();
   const save = rig.persistence.quotes.save.bind(rig.persistence.quotes);
   const writes = vi.spyOn(rig.persistence.quotes, 'save').mockImplementationOnce(async (...args) => { entered.resolve(); await held.promise; return save(...args); });
   await form.trigger('submit'); await entered.promise; await flushPromises();
   for (const group of form.findAll('details')) {
    const checkbox = group.get<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox.attributes('aria-disabled')).toBe('true'); await checkbox.setValue(false); expect(checkbox.element.checked).toBe(true);
   }
   held.resolve(); await flushPromises();
   expect(writes).toHaveBeenCalledOnce();
   expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.items[0]).toMatchObject({ description: 'Confirmed floor preparation', assetIds: [rig.asset.id], work: saved.entity.items[0].work });
  } finally { held.resolve(); await flushPromises(); view.dispose(); }
 });
});
