import { add, zero, type Money } from '../../core/money/Money';
import { ok, type Result } from '../../core/result/Result';
import type { CalculationError } from '../../core/errors/AppError';
import type { Quote } from './Quote';
/** Totals remain per offer and currency; competing offers are never added together. */
export function quoteTotals(quote: Quote): Result<readonly Money[], CalculationError> {
 const totals = new Map<string, Money>();
 for (const item of quote.items) {
  const amount = item.amount, previous = totals.get(amount.currency) ?? zero(amount.currency);
  const total = add(previous, amount);
  if (!total.ok) return total;
  totals.set(amount.currency, total.value);
 }
 return ok(Array.from(totals.values()));
}
