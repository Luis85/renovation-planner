import { createEntityId } from '../../../core/identity/generateId';
import { createMoney } from '../../../core/money/Money';
import { ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import { validateQuote, type Quote, type QuoteItem, type QuoteWorkLink, type QuoteId } from '../../../domain/quote/Quote';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { SupplierId } from '../../../domain/supplier/Supplier';
export interface QuoteItemDraft { id: string; description: string; amount: string; currency: string; assetIds: string[]; work: QuoteWorkLink[] }
export interface QuoteDraft { id: QuoteId; projectId: ProjectId; title: string; supplierId: string; issuedOn: string; validUntil: string; status: Quote['status']; items: QuoteItemDraft[] }
export function newQuoteItem(currency: string): QuoteItemDraft { return { id: createEntityId('quote-item'), description: '', amount: '', currency, assetIds: [], work: [] }; }
export function quoteDraft(projectId: ProjectId, currency: string, original?: Quote): QuoteDraft {
 return original ? { ...original, validUntil: original.validUntil ?? '', items: original.items.map(item => ({ ...item, amount: item.amount.amount, currency: item.amount.currency, assetIds: [...item.assetIds], work: item.work.map(link => ({ ...link })) })) }
  : { id: createEntityId('quote'), projectId, title: '', supplierId: '', issuedOn: '', validUntil: '', status: 'draft', items: [newQuoteItem(currency)] };
}
export function quoteInput(draft: QuoteDraft): Result<Quote, AppError> {
 const items: QuoteItem[] = [];
 for (const item of draft.items) {
  const amount = createMoney(item.amount.trim().replace(',', '.'), item.currency.trim().toUpperCase());
  if (!amount.ok) return amount;
  items.push({ id: item.id, description: item.description, amount: amount.value, assetIds: [...item.assetIds], work: item.work.map(link => ({ ...link })) });
 }
 const quote: Quote = { id: draft.id, projectId: draft.projectId, title: draft.title.trim(), supplierId: draft.supplierId as SupplierId, issuedOn: draft.issuedOn, status: draft.status, items, ...(draft.validUntil ? { validUntil: draft.validUntil } : {}) };
 const valid = validateQuote(quote);
 return valid.ok ? ok(quote) : valid;
}
