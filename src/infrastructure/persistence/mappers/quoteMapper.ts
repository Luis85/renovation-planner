import { QuoteFrontmatterSchemaV1 } from '../dto/quoteFrontmatter';
import { createMoney } from '../../../core/money/Money';
import { ok, type Result } from '../../../core/result/Result';
import type { ValidationError } from '../../../core/errors/AppError';
import { validateQuote, type Quote, type QuoteId, type QuoteItem } from '../../../domain/quote/Quote';
import type { SupplierId } from '../../../domain/supplier/Supplier';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { parsePersisted } from './parse';

export function quoteFromPersistence(raw: unknown): Result<Quote, ValidationError> {
 const parsed = parsePersisted(QuoteFrontmatterSchemaV1, raw, 'quote.frontmatter-invalid', 'Quote note');
 if (!parsed.ok) return parsed;
 const value = parsed.value, items: QuoteItem[] = [];
 for (const item of value.items) {
  const amount = createMoney(item.amount.amount, item.amount.currency);
  if (!amount.ok) return amount;
  items.push({ ...item, amount: amount.value });
 }
 const quote: Quote = { id: value.id as QuoteId, projectId: value.project as ProjectId, supplierId: value.supplier as SupplierId, title: value.title, issuedOn: value.issuedOn, status: value.status, items, ...(value.validUntil === undefined ? {} : { validUntil: value.validUntil }) };
 const valid = validateQuote(quote);
 return valid.ok ? ok(quote) : valid;
}
export function quoteToPersistence(quote: Quote, revision: number): Record<string, unknown> {
 return { type: 'renovation-quote', 'schema-version': 1, id: quote.id, revision, project: quote.projectId, supplier: quote.supplierId, title: quote.title, issuedOn: quote.issuedOn, ...(quote.validUntil === undefined ? {} : { validUntil: quote.validUntil }), status: quote.status,
  items: quote.items.map(item => ({ ...item, amount: { amount: item.amount.amount, currency: item.amount.currency } })) };
}
