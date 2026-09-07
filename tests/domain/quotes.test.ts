import { describe, expect, it } from 'vitest';
import { of } from '../../src/core/money/Money';
import { validateQuote, quoteExpired, type Quote, type QuoteId } from '../../src/domain/quote/Quote';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { SupplierId } from '../../src/domain/supplier/Supplier';
import { quoteTotals } from '../../src/domain/quote/compareQuotes';
import { quoteDraft, quoteInput } from '../../src/presentation/views/quotes/quoteDraft';
const quote: Quote = { id: 'quote' as QuoteId, projectId: 'project' as ProjectId, supplierId: 'supplier' as SupplierId, title: 'Offer', issuedOn: '2026-09-07', validUntil: '2026-09-30', status: 'received', items: [{ id: 'one', description: 'Floor preparation', amount: of('594.005', 'EUR'), assetIds: [], work: [] }] };
describe('immutable offer facts and comparison amounts', () => {
 it('allows an unlinked offer without manufacturing scope, validity or an order', () => {
  expect(validateQuote(quote).ok).toBe(true);
  expect(validateQuote({ ...quote, validUntil: undefined, status: 'draft' }).ok).toBe(true);
  expect(quote.items[0].work).toEqual([]);
 });
 it.each([{ id: '' }, { title: ' ' }, { supplierId: '' }, { issuedOn: '2026-02-29' }, { validUntil: '' }, { validUntil: '2026-09-06' }, { status: 'accepted' }, { items: [] }])('refuses invalid quote facts %j', patch => {
  expect(validateQuote({ ...quote, ...patch } as Quote).ok).toBe(false);
 });
 it('refuses duplicate item identities, empty descriptions and malformed scope links', () => {
  expect(validateQuote({ ...quote, items: [quote.items[0], quote.items[0]] }).ok).toBe(false);
  for (const patch of [{ id: '' }, { description: ' ' }, { assetIds: ['a', 'a'] }, { assetIds: [' '] }, { work: [{ planId: '', workId: 'work' }] }, { work: [{ planId: 'floor', workId: 'work' }, { planId: 'floor', workId: 'work' }] }]) {
   expect(validateQuote({ ...quote, items: [{ ...quote.items[0], ...patch }] }).ok).toBe(false);
  }
 });
 it('derives expiry inclusively without persisting an expired status', () => {
  expect(quoteExpired(quote, '2026-09-30')).toBe(false); expect(quoteExpired(quote, '2026-10-01')).toBe(true);
  expect(quoteExpired(quote, 'invalid')).toBe(false); expect(quoteExpired({ ...quote, validUntil: undefined }, '2026-10-01')).toBe(false);
  expect(quote.status).toBe('received');
 });
 it('keeps decimal precision, credits and currencies separate per offer', () => {
  const value = { ...quote, items: [...quote.items, { ...quote.items[0], id: 'two', amount: of('-0.005', 'EUR') }, { ...quote.items[0], id: 'three', amount: of('12.50', 'USD') }] };
  expect(quoteTotals(value)).toEqual({ ok: true, value: [of('594', 'EUR'), of('12.5', 'USD')] });
  expect(quote.items[0].amount.amount).toBe('594.005');
 });
 it('round trips editable drafts without mutating immutable offers, and accepts a German decimal comma', () => {
  const draft = quoteDraft(quote.projectId, 'EUR', quote); draft.items[0].amount = '594,005';
  expect(quoteInput(draft)).toEqual({ ok: true, value: quote });
  draft.items[0].description = 'Draft edit'; expect(quote.items[0].description).toBe('Floor preparation');
  draft.items[0].amount = '1.234,50'; expect(quoteInput(draft).ok).toBe(false);
  const blank = quoteDraft(quote.projectId, 'EUR'); expect(blank.id).not.toBe(quote.id); expect(blank.status).toBe('draft'); expect(quoteInput(blank).ok).toBe(false);
 });
});
