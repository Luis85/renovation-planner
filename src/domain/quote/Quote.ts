import type { EntityId } from '../../core/identity/EntityId';
import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';
import { createMoney, type Money } from '../../core/money/Money';
import type { ProjectId } from '../project/ProjectId';
import type { SupplierId } from '../supplier/Supplier';
import { isCalendarDate } from '../schedule/WorkSchedule';
export type QuoteId = EntityId<'quote'>;
export interface QuoteWorkLink { readonly planId: string; readonly workId: string }
export interface QuoteItem {
 readonly id: string;
 readonly description: string;
 readonly amount: Money;
 readonly assetIds: readonly string[];
 readonly work: readonly QuoteWorkLink[];
}
export interface Quote {
 readonly id: QuoteId;
 readonly projectId: ProjectId;
 readonly supplierId: SupplierId;
 readonly title: string;
 readonly issuedOn: string;
 readonly validUntil?: string;
 readonly status: 'draft' | 'received';
 readonly items: readonly QuoteItem[];
}
function invalid(): ValidationError { return { category: 'Validation', code: 'quote.invalid', message: 'A quote needs a title, supplier, valid dates and distinct priced items with explicit scope.' }; }
function uniqueNonempty(values: readonly string[]): boolean { return values.every(value => value.trim().length > 0) && new Set(values).size === values.length; }
function validItem(item: QuoteItem): boolean {
 return !!item.description.trim() && createMoney(item.amount.amount, item.amount.currency).ok
  && uniqueNonempty(item.assetIds) && uniqueNonempty(item.work.map(link => link.planId + ':' + link.workId))
  && item.work.every(link => link.planId.trim() && link.workId.trim());
}
export function validateQuote(quote: Quote): Result<void, ValidationError> {
 if (![quote.id, quote.projectId, quote.supplierId, quote.title].every(value => value.trim())) return err(invalid());
 if (quote.status !== 'draft' && quote.status !== 'received') return err(invalid());
 if (!isCalendarDate(quote.issuedOn) || (quote.validUntil !== undefined && (!isCalendarDate(quote.validUntil) || quote.validUntil < quote.issuedOn))) return err(invalid());
 if (quote.items.length === 0 || !uniqueNonempty(quote.items.map(item => item.id)) || !quote.items.every(validItem)) return err(invalid());
 return ok(undefined);
}
/** The validity boundary is inclusive and evaluated from a supplied calendar date. */
export function quoteExpired(quote: Quote, today: string): boolean { return quote.validUntil !== undefined && isCalendarDate(today) && quote.validUntil < today; }

function quoteFacts(quote: Quote): unknown { return [quote.id, quote.projectId, quote.supplierId, quote.title, quote.issuedOn, quote.validUntil, quote.status, quote.items.map(item => [item.id, item.description, item.amount.amount, item.amount.currency, item.assetIds, item.work.map(link => [link.planId, link.workId])])]; }
/** Compare canonical quote facts independently of object property insertion order. */
export function sameQuote(a: Quote, b: Quote): boolean {
 return JSON.stringify(quoteFacts(a)) === JSON.stringify(quoteFacts(b));
}
