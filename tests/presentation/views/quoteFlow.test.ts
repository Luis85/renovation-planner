// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined, expectOk } from '../../helpers/domain';
import { createSupplier, type SupplierId } from '../../../src/domain/supplier/Supplier';
import { err } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
import { saveQuote } from '../../../src/application/commands/quote/QuoteServices';
import type { Quote, QuoteId } from '../../../src/domain/quote/Quote';
import { of } from '../../../src/core/money/Money';
import QuoteForm from '../../../src/presentation/views/quotes/QuoteForm.vue';
import { defer } from '../../helpers/async';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack(), supplier = expectOk(createSupplier('supplier' as SupplierId, 'Local craft'));
 expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
 const quote: Quote = { id: 'quote' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft', items: [{ id: 'line', description: 'Floor preparation', amount: of('594.005', 'EUR'), assetIds: [], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
 const saved = expectOk(await saveQuote(rig.persistence, { quote, expected: 'absent' }));
 return { rig, supplier, saved, view: await downstreamView(rig, 'quotes') };
}
describe('Project quote comparison through native forms and repositories', () => {
 it('finishes an already authorized save after disposal, retires its callbacks and clears its expiry timer', async () => {
  const timers = vi.spyOn(globalThis, 'setInterval'), clears = vi.spyOn(globalThis, 'clearInterval');
  const { rig, view, saved } = await setup();
  await view.button(tr('quote.edit')).trigger('click'); await flushPromises();
  const component = view.wrapper.getComponent(QuoteForm), dispatch = component.props('save'), form = view.wrapper.get('.rp-quote-form');
  await form.get('input[name="title"]').setValue('Landed after closing'); await form.trigger('submit'); await flushPromises();
  const entered = defer<void>(), held = defer<void>(), original = rig.persistence.quotes.save.bind(rig.persistence.quotes);
  const writes = vi.spyOn(rig.persistence.quotes, 'save').mockImplementationOnce(async (...args) => { entered.resolve(); await held.promise; return original(...args); });
  await form.trigger('submit'); await entered.promise;
  expect(await view.context.session?.canLeave?.()).toBe(false);
  const timerIndex = timers.mock.calls.findIndex(call => call[1] === 60_000), timer = timers.mock.results[timerIndex].value;
  view.dispose(); held.resolve(); await flushPromises();
  expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.title).toBe('Landed after closing');
  expect(component.emitted('submit')).toBeUndefined(); expect(clears).toHaveBeenCalledWith(timer); expect(view.context.session?.canLeave).toBeUndefined();
  expect(await dispatch({ quote: saved.entity, expected: saved.version })).toMatchObject({ ok: false, error: { code: 'quote.paused' } });
  expect(writes).toHaveBeenCalledOnce();
 });
 it('shows explicit scope gaps and keeps each offer and currency total separate', async () => {
  const { rig, view, saved } = await setup();
  try {
   const second = { ...saved.entity, id: 'quote-second' as QuoteId, title: 'Partial offer', items: [{ ...saved.entity.items[0], id: 'unmapped', description: 'Unspecified scope', amount: of('25', 'USD'), work: [] }] };
   expectOk(await saveQuote(rig.persistence, { quote: second, expected: 'absent' }));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   const table = view.wrapper.get('.rp-quote-comparison table');
   expect(table.findAll('tbody tr')).toHaveLength(2); expect(table.text()).toContain(tr('quote.unmapped'));
   expect(table.findAll('tbody td').filter(cell => cell.text() === tr('quote.not-covered'))).toHaveLength(2);
   const totals = table.findAll('tfoot td'); expect(totals).toHaveLength(2); expect(totals[0].text()).toContain('594.'); expect(totals[1].text()).toContain('25');
   expect(table.text()).toContain('Unspecified scope'); expect(table.text()).toContain('Floor preparation');
  } finally { view.dispose(); }
 });
 it('creates a Supplier and a received quote, then records a separate editable revision', async () => {
  const rig = await downstreamStack(), view = await downstreamView(rig, 'quotes');
  try {
   await view.button(tr('supplier.add')).trigger('click'); await flushPromises();
   const supplierForm = view.wrapper.get('.rp-dialog-form'); await supplierForm.get('input[name="name"]').setValue('Local craft'); await supplierForm.trigger('submit'); await flushPromises();
   const supplier = expectOk(await rig.persistence.suppliers.listAll()).loaded[0].entity;
   await view.button(tr('quote.add')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('.rp-quote-form');
   for (const [name, value] of [['title', 'Received offer'], ['issued', '2026-09-07'], ['item-description', 'Floor preparation'], ['item-amount', '594,005']]) await form.get('input[name="' + name + '"]').setValue(value);
   await form.get('select[name="supplier"]').setValue(supplier.id); await form.get('select[name="quote-status"]').setValue('received');
   await form.findAll('details')[0].findAll('input[type="checkbox"]')[0].setValue(true);
   await form.trigger('submit'); await flushPromises(); expect(expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded).toEqual([]);
   await form.trigger('submit'); await flushPromises();
   const first = expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded[0];
   expect(first.entity.items[0].amount.amount).toBe('594.005'); expect(first.entity.status).toBe('received');
   expect(view.wrapper.findAll('button').some(button => button.text() === tr('quote.edit'))).toBe(false);
   await view.button(tr('quote.revise')).trigger('click'); await flushPromises();
   const revision = view.wrapper.get('.rp-quote-form'); await revision.get('input[name="item-amount"]').setValue('610.005');
   await revision.trigger('submit'); await flushPromises(); await revision.trigger('submit'); await flushPromises();
   const offers = expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded; expect(offers).toHaveLength(2);
   expect(offers.find(offer => offer.entity.id === first.entity.id)?.entity).toEqual(first.entity);
   expect(offers.find(offer => offer.entity.id !== first.entity.id)?.entity).toMatchObject({ status: 'draft', items: [{ amount: { amount: '610.005' } }] });
  } finally { view.dispose(); }
 });
 it('keeps editable raw values during failed reads and refreshes Supplier choices without rebasing the captured version', async () => {
  const { rig, view, supplier, saved } = await setup();
  try {
   await view.button(tr('quote.edit')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('.rp-quote-form'), amount = form.get<HTMLInputElement>('input[name="item-amount"]');
   await amount.setValue('812,345');
   const read = vi.spyOn(view.quotes, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'test.offline', message: 'Offline' }));
   await rig.root.eventBus.publish({ type: 'ProjectIndexRebuilt' }); await flushPromises();
   expect(amount.element.readOnly).toBe(false); await amount.setValue('813,345');
   const writes = vi.spyOn(view.quotes, 'save'); await form.trigger('submit'); await flushPromises(); expect(writes).not.toHaveBeenCalled();
   const current = expectDefined(expectOk(await rig.persistence.suppliers.getById(supplier.id)), 'supplier');
   expectOk(await rig.persistence.suppliers.save({ ...supplier, name: 'Renamed craft' }, current.version));
   read.mockRestore(); await expectDefined(form.findAll('button').find(button => button.text() === tr('view.project.resume-retry')), 'dialog Retry').trigger('click'); await flushPromises();
   expect(form.get('select[name="supplier"]').text()).toContain('Renamed craft'); expect(amount.element.value).toBe('813,345');
   await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
   expect(writes).toHaveBeenCalledOnce(); expect(writes.mock.calls[0][0].expected).toEqual(saved.version);
   expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.items[0].amount.amount).toBe('813.345');
  } finally { view.dispose(); }
 });
 it('keeps a successful save after read-back failure and retries without replaying the quote write', async () => {
  const { rig, view, saved } = await setup();
  try {
   await view.button(tr('quote.edit')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('.rp-quote-form'); await form.get('input[name="title"]').setValue('Updated offer'); await form.trigger('submit'); await flushPromises();
   const read = vi.spyOn(view.quotes, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'test.offline', message: 'Offline' })), writes = vi.spyOn(rig.persistence.quotes, 'save');
   await form.trigger('submit'); await flushPromises(); expect(writes).toHaveBeenCalledOnce(); expect(view.wrapper.text()).toContain(tr('save-state.saved-refresh-needed'));
   read.mockRestore(); await view.button(tr('view.project.resume-retry')).trigger('click'); await flushPromises();
   expect(writes).toHaveBeenCalledOnce(); expect(view.wrapper.text()).toContain('Updated offer'); expect(expectOk(await rig.persistence.quotes.getById(saved.entity.id))?.entity.title).toBe('Updated offer');
  } finally { view.dispose(); }
 });
 it('keeps a conflicting draft as a new quote only after an explicit action and new preview', async () => {
  const { rig, view, saved } = await setup();
  try {
   await view.button(tr('quote.edit')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('.rp-quote-form'), amount = form.get<HTMLInputElement>('input[name="item-amount"]'); await amount.setValue('800,005');
   const peer = expectOk(await rig.persistence.quotes.save({ ...saved.entity, title: 'Peer offer' }, saved.version));
   await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
   expect(form.text()).toContain(tr('quote.conflict')); expect(amount.element.value).toBe('800,005'); expect(amount.element.readOnly).toBe(true);
   await view.button(tr('quote.keep-revision')).trigger('click'); await flushPromises(); expect(amount.element.readOnly).toBe(false);
   await form.trigger('submit'); await flushPromises(); expect(expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded).toHaveLength(1);
   await form.trigger('submit'); await flushPromises();
   const offers = expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded; expect(offers).toHaveLength(2);
   expect(offers.find(offer => offer.entity.id === peer.entity.id)?.entity).toEqual(peer.entity);
   expect(offers.find(offer => offer.entity.id !== peer.entity.id)?.entity.items[0].amount.amount).toBe('800.005');
  } finally { view.dispose(); }
 });
});
