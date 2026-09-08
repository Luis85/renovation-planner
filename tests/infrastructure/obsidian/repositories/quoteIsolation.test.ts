// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { downstreamStack } from '../../../helpers/downstream';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { makeProject } from '../../../helpers/entities';
import { createSupplier, type SupplierId } from '../../../../src/domain/supplier/Supplier';
import type { Quote, QuoteId } from '../../../../src/domain/quote/Quote';
import { of } from '../../../../src/core/money/Money';
afterEach(() => { vi.restoreAllMocks(); });
async function setup() {
 const rig = await downstreamStack(), other = makeProject({ name: 'Other renovation' }); expectOk(await rig.persistence.projects.save(other, 'absent'));
 const supplier = expectOk(createSupplier('isolation-supplier' as SupplierId, 'Local craft')); expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
 const quote: Quote = { id: 'isolation-quote' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft',
  items: [{ id: 'line', description: 'Floor preparation', amount: of('594.005', 'EUR'), assetIds: [], work: [] }] };
 return { rig, other, quote };
}
it('refuses moving an existing draft Quote to another real Project at the repository boundary and preserves both projects', async () => {
 const { rig, other, quote } = await setup();
 try {
  const saved = expectOk(await rig.persistence.quotes.save(quote, 'absent')), bytes = [...rig.stack.vault.entries], source = rig.persistence.index.getPath(quote.id);
  const result = await rig.persistence.quotes.save({ ...quote, projectId: other.id }, saved.version);
  expect(result).toMatchObject({ ok: false, error: { code: 'quote.project-immutable' } });
  expect(rig.persistence.index.getPath(quote.id)).toBe(source); expect([...rig.stack.vault.entries]).toEqual(bytes);
  expect(expectOk(await rig.persistence.quotes.listByProject(other.id)).loaded).toHaveLength(0);
 } finally { rig.dispose(); }
});
it('lists only readable Quotes of the requested Project while distinguishing malformed, deleted and foreign notes', async () => {
 const { rig, other, quote } = await setup();
 try {
  for (const offer of [quote, { ...quote, id: 'malformed-quote' as QuoteId, title: 'Malformed offer' }, { ...quote, id: 'deleted-quote' as QuoteId, title: 'Deleted offer' }, { ...quote, id: 'foreign-quote' as QuoteId, projectId: other.id, title: 'Foreign offer' }]) expectOk(await rig.persistence.quotes.save(offer, 'absent'));
  const malformed = expectDefined(rig.persistence.index.getPath('malformed-quote' as QuoteId), 'malformed path'), deleted = expectDefined(rig.persistence.index.getPath('deleted-quote' as QuoteId), 'deleted path');
  rig.stack.vault.entries.set(malformed, expectDefined(rig.stack.vault.entries.get(malformed), 'malformed source').replace(/^title:.*$/m, 'title: []')); rig.stack.vault.entries.delete(deleted);
  const bytes = [...rig.stack.vault.entries], listed = expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId));
  expect(listed.loaded.map(offer => offer.entity.id)).toEqual([quote.id]); expect(listed.refused).toBe(1);
  expect(expectOk(await rig.persistence.quotes.listByProject(other.id)).loaded.map(offer => offer.entity.id)).toEqual(['foreign-quote']);
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { rig.dispose(); }
});

it.each([{ amount: 'NaN', currency: 'EUR' }, { amount: '594.005', currency: 'invalid' }])('refuses hand-edited persisted amount $amount / $currency through the real Quote mapper without rewriting it', async amount => {
 const { rig, quote } = await setup();
 try {
  expectOk(await rig.persistence.quotes.save(quote, 'absent'));
  const path = expectDefined(rig.persistence.index.getPath(quote.id), 'quote path'), file = expectDefined(rig.stack.deps.vault.getAbstractFileByPath(path), 'quote file');
  expect(file).toBeInstanceOf(TFile);
  await rig.persistence.vaultDeps.fileManager.processFrontMatter(file as TFile, raw => {
   const items = raw['items'] as Array<{ amount: { amount: string; currency: string } }>;
   expectDefined(items[0], 'quoted line').amount = amount;
  });
  rig.stack.metadataCache.catchUp();
  const bytes = [...rig.stack.vault.entries], read = await rig.persistence.quotes.getById(quote.id);
  expect(read.ok).toBe(false); expect(expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).refused).toBe(1); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { rig.dispose(); }
});

it('retains an explicit signed credit in the supplier quote without normalizing its precision or changing source bytes', async () => {
 const { rig, quote } = await setup();
 try {
  const credit = { ...quote, items: [{ id: 'credit', description: 'Returned material credit', amount: of('-5.005', 'EUR'), assetIds: [], work: [] }] };
  expectOk(await rig.persistence.quotes.save(credit, 'absent')); const bytes = [...rig.stack.vault.entries];
  const read = expectDefined(expectOk(await rig.persistence.quotes.getById(quote.id)), 'saved credit quote');
  expect(read.entity.items).toEqual(credit.items); expect(expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded.map(offer => offer.entity)).toEqual([read.entity]);
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { rig.dispose(); }
});
