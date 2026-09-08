// @vitest-environment jsdom
// Exercises the browser-hosted plugin composition, including its native view imports.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downstreamStack } from '../../../helpers/downstream';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { createSupplier, type SupplierId } from '../../../../src/domain/supplier/Supplier';
import { of } from '../../../../src/core/money/Money';
import type { Quote, QuoteId } from '../../../../src/domain/quote/Quote';
import { saveQuote, readQuoteComparison } from '../../../../src/application/commands/quote/QuoteServices';
import { parseFrontmatter } from '../../../helpers/vault';
import { ObsidianQuoteRepository } from '../../../../src/infrastructure/obsidian/repositories/ObsidianQuoteRepository';
import { err } from '../../../../src/core/result/Result';
afterEach(() => { vi.restoreAllMocks(); });
async function setup() {
 const rig = await downstreamStack();
 const supplier = expectOk(createSupplier('supplier' as SupplierId, 'Local business')); expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
 const quote: Quote = { id: 'quote' as QuoteId, projectId: rig.plan.projectId, supplierId: supplier.id, title: 'Floor offer', issuedOn: '2026-09-07', status: 'draft', validUntil: '2026-09-30', items: [{ id: 'line', description: 'Prepare floor', amount: of('594.005', 'EUR'), assetIds: [rig.asset.id], work: [{ planId: rig.plan.id, workId: 'work-sand' }] }] };
 return { ...rig, supplier, quote };
}
describe('project-owned quote notes and received immutability', () => {
 it('refuses a comparison whose project disappeared and reads the complete comparison after repair', async () => {
  const rig = await setup();
  try {
   expectOk(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' }));
   const path = expectDefined(rig.persistence.index.getPath(rig.plan.projectId), 'project path'), original = expectDefined(rig.stack.vault.entries.get(path), 'project bytes');
   rig.stack.vault.entries.delete(path); const before = [...rig.stack.vault.entries];
   expect(await readQuoteComparison(rig.persistence, rig.plan.projectId)).toMatchObject({ ok: false, error: { code: 'project.not-found' } });
   expect([...rig.stack.vault.entries]).toEqual(before);
   rig.stack.vault.entries.set(path, original);
   const restored = expectOk(await readQuoteComparison(rig.persistence, rig.plan.projectId));
   expect(restored.work.project.id).toBe(rig.plan.projectId); expect(restored.work.rows.map(row => row.work)).toEqual(rig.value.work);
   expect(restored.offers.map(offer => offer.entity)).toEqual([rig.quote]); expect(restored.unreadable).toBe(0);
  } finally { rig.dispose(); }
 });
 it.each([{ field: 'title' as const, value: 'Peer offer', revision: false }, { field: 'status' as const, value: 'received', revision: false }, { field: 'title' as const, value: 'Peer revision', revision: true }])('preserves a peer $field change arriving inside the host write callback', async ({ field, value, revision }) => {
  const rig = await setup();
  try {
   const saved = expectOk(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' }));
   const path = expectDefined(rig.persistence.index.getPath(rig.quote.id), 'quote path');
   const fileManager = rig.persistence.vaultDeps.fileManager;
   const process = fileManager.processFrontMatter.bind(fileManager);
   let peerBytes = '';
   vi.spyOn(fileManager, 'processFrontMatter').mockImplementationOnce(async (file, update) => {
    await process(file, raw => { raw[field] = value; if (revision) raw['revision'] = 2; });
    peerBytes = expectDefined(rig.stack.vault.entries.get(path), 'peer bytes');
    await process(file, update);
   });
   const result = await saveQuote(rig.persistence, { quote: { ...rig.quote, title: 'Local draft' }, expected: saved.version });
   expect(result).toMatchObject({ ok: false, error: { code: revision ? 'quote.revision-conflict' : 'quote.external-modification' } });
   expect(rig.stack.vault.entries.get(path)).toBe(peerBytes);
   rig.stack.metadataCache.catchUp();
   expect(expectDefined(expectOk(await rig.persistence.quotes.getById(rig.quote.id)), 'peer quote').entity[field]).toBe(value);
  } finally { rig.dispose(); }
 });

 it('writes through the project folder, preserves decimal bytes and user content, clears optional validity and reads in a fresh repository', async () => {
  const rig = await setup();
  try {
   const saved = expectOk(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' }));
   const path = expectDefined(rig.persistence.index.getPath(rig.quote.id), 'quote path'); expect(path).toContain('/Quotes/');
   const before = expectDefined(rig.stack.vault.entries.get(path), 'quote bytes'); expect(before).toContain('594.005');
   rig.stack.vault.entries.set(path, before.replace('---\n', '---\nmy-reference: keep\n') + '\nOffer conditions\n');
   const updated = expectOk(await saveQuote(rig.persistence, { quote: { ...rig.quote, validUntil: undefined }, expected: saved.version }));
   const bytes = expectDefined(rig.stack.vault.entries.get(path), 'updated bytes'); expect(bytes).toContain('Offer conditions'); expect(parseFrontmatter(bytes).frontmatter['my-reference']).toBe('keep'); expect(parseFrontmatter(bytes).frontmatter['validUntil']).toBeUndefined();
   const fresh = new ObsidianQuoteRepository(rig.persistence.vaultDeps); expect(expectOk(await fresh.getById(rig.quote.id))?.entity).toEqual(updated.entity);
   expect(expectOk(await fresh.listByProject(rig.plan.projectId)).loaded).toHaveLength(1);
  } finally { rig.dispose(); }
 });
 it('refuses stale writes and immutable received changes while stable create retries acknowledge the same offer', async () => {
  const rig = await setup();
  try {
   const first = expectOk(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' }));
   const received = expectOk(await saveQuote(rig.persistence, { quote: { ...rig.quote, status: 'received' }, expected: first.version }));
   expect(await saveQuote(rig.persistence, { quote: { ...rig.quote, title: 'Overwrite' }, expected: first.version })).toMatchObject({ ok: false });
   expect(await rig.persistence.quotes.save({ ...received.entity, title: 'Changed price' }, received.version)).toMatchObject({ ok: false, error: { code: 'quote.immutable' } });
   expect(expectOk(await saveQuote(rig.persistence, { quote: received.entity, expected: 'absent' }))).toEqual(received);
   expect(expectOk(await rig.persistence.quotes.getById(rig.quote.id))?.entity).toEqual(received.entity);
  } finally { rig.dispose(); }
 });
 it('refuses disappearing supplier, asset and Work links before writing any quote', async () => {
  const rig = await setup();
  try {
   for (const quote of [{ ...rig.quote, supplierId: 'missing' as SupplierId }, { ...rig.quote, items: [{ ...rig.quote.items[0], assetIds: ['missing'] }] }, { ...rig.quote, items: [{ ...rig.quote.items[0], work: [{ planId: rig.plan.id, workId: 'missing' }] }] }]) expect(await saveQuote(rig.persistence, { quote, expected: 'absent' })).toMatchObject({ ok: false, error: { code: 'quote.link-missing' } });
   expect(expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded).toEqual([]);
   const fault = { category: 'Persistence' as const, code: 'test.read', message: 'offline' };
   vi.spyOn(rig.persistence.suppliers, 'getById').mockResolvedValueOnce(err(fault)); expect(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' })).toEqual(err(fault));
  } finally { rig.dispose(); }
 });
 it('keeps unreadable offers explicit and exposes a missing supplier as an unresolved identity', async () => {
  const rig = await setup();
  try {
   expectOk(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' }));
   const supplierPath = expectDefined(rig.persistence.index.getPath(rig.supplier.id), 'supplier path'); rig.stack.vault.entries.delete(supplierPath);
   const read = expectOk(await readQuoteComparison(rig.persistence, rig.plan.projectId)); expect(read.offers[0].entity.supplierId).toBe(rig.supplier.id); expect(read.suppliers).toEqual([]);
   const path = expectDefined(rig.persistence.index.getPath(rig.quote.id), 'quote path'); rig.stack.vault.entries.set(path, expectDefined(rig.stack.vault.entries.get(path), 'bytes').replace('schema-version: 1', 'schema-version: 99'));
   expect(expectOk(await readQuoteComparison(rig.persistence, rig.plan.projectId))).toMatchObject({ offers: [], unreadable: 1 });
  } finally { rig.dispose(); }
 });
});

it.each(['quotes', 'projects', 'assets', 'plans'] as const)('preserves an ordinary %s lookup refusal before saving a quote', async kind => {
 const rig = await setup();
 try {
  const fault = { category: 'Persistence' as const, code: 'test.quote-read-refused', message: 'The linked record cannot be read.' }, bytes = [...rig.stack.vault.entries];
  vi.spyOn(rig.persistence[kind], 'getById').mockResolvedValueOnce(err(fault));
  const writes = vi.spyOn(rig.persistence.quotes, 'save');
  expect(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' })).toEqual(err(fault));
  expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { rig.dispose(); }
});
it.each(['quotes', 'suppliers', 'assets'] as const)('preserves a %s listing refusal instead of presenting an empty comparison', async kind => {
 const rig = await setup();
 try {
  const fault = { category: 'Persistence' as const, code: 'test.quote-list-refused', message: 'The catalogue cannot be listed.' };
  if (kind === 'quotes') vi.spyOn(rig.persistence.quotes, 'listByProject').mockResolvedValueOnce(err(fault));
  else vi.spyOn(rig.persistence[kind], 'listAll').mockResolvedValueOnce(err(fault));
  expect(await readQuoteComparison(rig.persistence, rig.plan.projectId)).toEqual(err(fault));
 } finally { rig.dispose(); }
});
it.each(['project', 'plan'] as const)('refuses a linked %s deleted before quote creation without recreating notes', async kind => {
 const rig = await setup();
 try {
  const id = kind === 'project' ? rig.plan.projectId : rig.plan.id, path = expectDefined(rig.persistence.index.getPath(id), 'linked note');
  rig.stack.vault.entries.delete(path); const bytes = [...rig.stack.vault.entries], writes = vi.spyOn(rig.persistence.quotes, 'save');
  expect(await saveQuote(rig.persistence, { quote: rig.quote, expected: 'absent' })).toMatchObject({ ok: false, error: { code: 'quote.link-missing' } });
  expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { rig.dispose(); }
});
