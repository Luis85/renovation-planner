import { err, ok, type Result } from '../result/Result';
import type { ValidationError } from '../errors/AppError';

/**
 * An opaque monetary amount (ADR-010): the value type every budget/cost field carries,
 * never a raw number. The arithmetic (addition, tax, rounding, currency safety) and the
 * decimal.js backing are slice 9's; this slice consumes Money as an opaque value and
 * performs no arithmetic on it, so the type arrives here with construction and validity
 * only — the smallest thing Project.budget/contingency need to exist.
 *
 * `amount` is a decimal STRING, not a number: a float is exactly what ADR-010 refuses,
 * and the string survives until slice 9 hands it to decimal.js verbatim. The pattern
 * enforces shape only — no sign, no leading zeros, no exponent, no bare trailing dot.
 * It does NOT normalize trailing fractional zeros (`'0.5'` and `'0.50'` are both
 * accepted and stay distinct strings), so nothing here may compare amounts as text;
 * that is slice 9's job, on parsed values.
 *
 * The brand key is a module-private symbol, so an unvalidated `{ amount, currency }`
 * object literal does not compile as a Money outside this file — validity lives in
 * exactly one place, like `createPolygon`.
 */
const moneyBrand = Symbol('Money');

export interface Money {
	readonly [moneyBrand]: true;
	readonly amount: string;
	/** ISO 4217 alpha-3, uppercase. */
	readonly currency: string;
}

const AMOUNT_PATTERN = /^(0|[1-9]\d*)(\.\d+)?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function createMoney(amount: string, currency: string): Result<Money, ValidationError> {
	if (!AMOUNT_PATTERN.test(amount)) {
		return err({
			category: 'Validation',
			code: 'money.invalid-amount',
			message: `A monetary amount must be a plain non-negative decimal string; got "${amount}".`,
		});
	}
	if (!CURRENCY_PATTERN.test(currency)) {
		return err({
			category: 'Validation',
			code: 'money.invalid-currency',
			message: `A currency must be an uppercase ISO 4217 alpha-3 code; got "${currency}".`,
		});
	}
	return ok({ [moneyBrand]: true, amount, currency });
}
