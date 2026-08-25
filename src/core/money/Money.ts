import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../result/Result';
import type { CalculationError, ValidationError } from '../errors/AppError';

/**
 * An opaque monetary amount (ADR-010): the value type every budget/cost field carries,
 * never a raw number. All arithmetic runs on decimal.js inside THIS module — call sites
 * never import `decimal.js` to touch an `amount`, and nothing may coerce one with
 * `Number()`.
 *
 * `amount` is stored as a plain decimal STRING, not a number: a float is exactly what
 * ADR-010 refuses. The string is this module's serialization of an exact `Decimal`;
 * every operation parses, computes at full precision, and serializes back, so no
 * intermediate pipeline value is ever rounded between stages (ADR-010: rounding happens
 * once, where a figure is finalized as output — see `round`).
 *
 * A Money is never NEGATIVE, and that is an invariant rather than a claim made at one
 * door: `createMoney`'s pattern refuses a leading `-`, and `fromDecimal` — the single
 * point every operation mints through — refuses one too. So anything this module can
 * produce, `createMoney` can read back; an amount that failed on the way back in through
 * persistence would be a value the engine computed and can never re-read. `subtract`
 * reports a negative difference as a typed failure, and the operations that answer a bare
 * Money throw, because the only way to reach one there is a negative factor or percent
 * that every user-input caller refuses first.
 *
 * Two constructors, by who vouches for the input. `createMoney` validates user-shaped
 * input (a persisted amount is a file the user can edit) and answers `Result`. `of` is
 * the engine-facing constructor for values that come from validated persistence or
 * program literals; it THROWS on malformed input rather than answer a `Result`, because
 * continuing without a valid `Money` would silently corrupt every downstream total — a
 * programmer error, not a business failure (SDD §65 reserves thrown exceptions for
 * exactly that).
 *
 * The brand key is a module-private symbol, so an unvalidated `{ amount, currency }`
 * object literal does not compile as a Money outside this file — construction lives in
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

/**
 * Minor-unit places used when a Money value is finalized (`round`). Every currency this
 * plugin prices in today (USD/EUR/…) has two; a currency with a different minor unit
 * arrives with the supplier/quote work that first needs one.
 */
const MINOR_UNIT_PLACES = 2;

/**
 * The ONE place a Money is minted from a Decimal, and so the one place the non-negative
 * invariant can hold for every operation at once. It is an invariant rather than a claim
 * made at one door: `createMoney` — the persistence door, reading a file the user can
 * hand-edit — refuses a leading `-`, so an amount this module produced and persistence
 * cannot read back would be a value the engine computed and can never re-read.
 *
 * A breach THROWS rather than answering a `Result`, in the same spirit as `of`: every
 * caller that could reach one from USER input refuses it first as a typed failure — the
 * Cost Pipeline bounds its discount at 100% and refuses a negative quantity, and
 * `subtract` reports a negative difference as an error — so arriving here with a negative
 * amount is a programmer error (SDD §65), not a business failure.
 *
 * `lessThan(0)` rather than `isNegative()`: decimal.js reports negative ZERO as negative,
 * and a zero is a zero — `toFixed` serializes it as a plain `0` either way.
 *
 * `places` is how `round` finalizes at the currency's minor unit; every other caller
 * serializes at the value's own precision. `toFixed` is the exact plain (never
 * exponential) notation — `toString()` would switch to exponential form past 20 digits
 * and break the round-trip back through `new Decimal(...)`.
 */
function fromDecimal(amount: Decimal, currency: string, places?: number): Money {
	if (amount.lessThan(0)) {
		throw new Error(
			`A monetary amount cannot be negative; got ${amount.toFixed(amount.dp())}.`,
		);
	}
	return { [moneyBrand]: true, amount: amount.toFixed(places ?? amount.dp()), currency };
}

/**
 * A base-ten decimal literal, plain or exponential. decimal.js also reads `0x`, `0b` and
 * `0o` forms, so `of('0x10', 'USD')` silently meant sixteen dollars; this is what refuses
 * them. Exponent forms stay accepted because `fromDecimal` normalizes them to plain
 * notation on the way out, which `createMoney` reads back.
 */
const LITERAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

export function of(value: string | number | Decimal, currency: string): Money {
	if (!CURRENCY_PATTERN.test(currency)) {
		throw new Error(
			`A currency must be an uppercase ISO 4217 alpha-3 code; got "${currency}".`,
		);
	}
	if (typeof value === 'string' && !LITERAL_PATTERN.test(value)) {
		throw new Error(
			`A monetary amount must be a finite decimal literal in base ten; got "${value}".`,
		);
	}
	// Every remaining string parses, so no DecimalError can escape here. What decimal.js
	// CONSTRUCTS happily is NaN and Infinity, from a number or another Decimal; only the
	// later arithmetic would notice, so finiteness is checked here, where the value enters.
	const amount = new Decimal(value);
	if (!amount.isFinite()) {
		throw new Error(
			`A monetary amount must be a finite decimal; got "${String(value)}".`,
		);
	}
	return fromDecimal(amount, currency);
}

export function zero(currency: string): Money {
	return of('0', currency);
}

function currencyMismatch(a: Money, b: Money): CalculationError | null {
	if (a.currency === b.currency) return null;
	return {
		category: 'Calculation',
		code: 'money.currency-mismatch',
		message: `Currencies cannot be mixed: ${a.currency} against ${b.currency}.`,
	};
}

export function add(a: Money, b: Money): Result<Money, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	return ok(fromDecimal(new Decimal(a.amount).plus(b.amount), a.currency));
}

/**
 * A difference below zero is a typed failure, not a negative `Money`: `subtract` is the
 * one operation whose operands can legitimately produce one from valid input, and it
 * already answers a `Result`, so the invariant costs an error code rather than a throw.
 */
export function subtract(a: Money, b: Money): Result<Money, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	const difference = new Decimal(a.amount).minus(b.amount);
	if (difference.lessThan(0)) {
		return err({
			category: 'Calculation',
			code: 'money.negative-result',
			message:
				`A monetary amount cannot be negative: ${a.amount} minus ${b.amount} `
				+ `${a.currency} would be ${difference.toFixed(difference.dp())}.`,
		});
	}
	return ok(fromDecimal(difference, a.currency));
}

/** The PART `percent` of `a` (`a × percent / 100`) — never the adjusted total. */
export function percentageOf(a: Money, percent: Decimal): Money {
	return fromDecimal(new Decimal(a.amount).mul(percent).div(100), a.currency);
}

/** Unit price × quantity, at full precision — rounding happens only at `round`. */
export function scale(a: Money, factor: Decimal): Money {
	return fromDecimal(new Decimal(a.amount).mul(factor), a.currency);
}

/**
 * Finalizes to the currency's minor unit, ROUND_HALF_UP, once (ADR-010) — and SERIALIZES
 * there too. Rounding 219.80 to two places and then storing `dp()` of the result gives
 * "219.8", which defeats the one function whose whole job is to produce the figure that
 * goes out, so this is the one caller that passes `places`.
 */
export function round(a: Money): Money {
	return fromDecimal(
		new Decimal(a.amount).toDecimalPlaces(MINOR_UNIT_PLACES, Decimal.ROUND_HALF_UP),
		a.currency,
		MINOR_UNIT_PLACES,
	);
}

export function compare(a: Money, b: Money): Result<-1 | 0 | 1, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	return ok(new Decimal(a.amount).comparedTo(b.amount) as -1 | 0 | 1);
}
