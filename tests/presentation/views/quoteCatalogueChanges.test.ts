/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined, expectOk } from '../../helpers/domain';
import { createSupplier, type SupplierId } from '../../../src/domain/supplier/Supplier';
import { of } from '../../../src/core/money/Money';
import { saveQuote } from '../../../src/application/commands/quote/QuoteServices';
import type { Quote, QuoteId } from '../../../src/domain/quote/Quote';
import { RenameZoneCommand } from '../../../src/application/commands/zone/RenameZone';
import { tr } from '../../../src/presentation/i18n/strings';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack();
 const supplier = expectOk(createSupplier('supplier' as SupplierId, 'Local business')); expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
 const asset = expectOk(await rig.persistence.createAsset.execute({ name: 'Offered material', category: rig.asset.category, unit: rig.asset.unit, unitCostAmount: '12', currency: 'EUR' }));
 const quote: Quote = { id: 'quote' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Offer', issuedOn: '2026-09-07', status: 'draft', items: [{ id: 'line', description: 'Installation', amount: of('594.005', 'EUR'), assetIds: [asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
 expectOk(await saveQuote(rig.persistence, { quote, expected: 'absent' }));
 const view = await downstreamView(rig, 'quotes', { planId: rig.plan.id, roomId: rig.roomId });
 return { rig, view, asset };
}
describe('Quote view follows internal catalogue and Room commands', () => {
 it('refreshes created and renamed Asset choices while retaining the raw quote draft and its selection', async () => {
  const { rig, view, asset } = await setup();
  try {
   await view.button(tr('quote.edit')).trigger('click'); await flushPromises();
   const form = view.wrapper.get('.rp-quote-form'); await form.get('input[name="item-amount"]').setValue('594,005');
   const writes = vi.spyOn(rig.persistence.quotes, 'save');
   expectOk(await rig.persistence.updateAsset.execute({ assetId: asset.id, changes: { name: 'Renamed offered material' } })); await flushPromises();
   expect(view.wrapper.get('.rp-quote-comparison').text()).toContain('Renamed offered material'); expect(form.text()).toContain('Renamed offered material');
   const created = expectOk(await rig.persistence.createAsset.execute({ name: 'New available material', category: asset.category, unit: asset.unit, unitCostAmount: '4', currency: 'EUR' })); await flushPromises();
   expect(form.text()).toContain(created.name); expect(form.get<HTMLInputElement>('input[name="item-amount"]').element.value).toBe('594,005');
   expect(form.get<HTMLInputElement>('input[value="' + asset.id + '"]').element.checked).toBe(true); expect(writes).not.toHaveBeenCalled();
  } finally { view.dispose(); }
 });
 it('retains a deleted Asset identity as unresolved in the comparison and open draft', async () => {
  const { rig, view, asset } = await setup();
  try {
   await view.button(tr('quote.edit')).trigger('click'); await flushPromises(); const form = view.wrapper.get('.rp-quote-form');
   const writes = vi.spyOn(rig.persistence.quotes, 'save');
   expectOk(await rig.persistence.deleteAsset.execute({ assetId: asset.id })); await flushPromises();
   expect(view.wrapper.get('.rp-quote-comparison').text()).toContain(tr('quote.unresolved', { id: asset.id }));
   expect(form.text()).toContain(tr('quote.unresolved', { id: asset.id })); expect(form.get<HTMLInputElement>('input[value="' + asset.id + '"]').element.checked).toBe(true); expect(writes).not.toHaveBeenCalled();
  } finally { view.dispose(); }
 });
 it('refreshes the origin Room after its real rename command without saving the quote', async () => {
  const { rig, view } = await setup();
  try {
   const room = expectDefined(expectOk(await rig.persistence.zones.getById(rig.roomId)), 'Room'), writes = vi.spyOn(rig.persistence.quotes, 'save');
   expectOk(await new RenameZoneCommand(rig.persistence.zones, rig.root.eventBus).execute({ zoneId: rig.roomId, name: 'Renamed origin Room', expected: room.version })); await flushPromises();
   expect(view.wrapper.text()).toContain(tr('quote.from-room', { name: 'Renamed origin Room' })); expect(writes).not.toHaveBeenCalled();
  } finally { view.dispose(); }
 });
});
