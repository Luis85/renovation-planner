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

function fromDecimal(amount: Decimal, currency: string): Money {
	// `toFixed(dp())` is the exact plain (never exponential) notation of the value it is
	// called on — `toString()` would switch to exponential form past 20 digits and break
	// the round-trip back through `new Decimal(...)`.
	return { [moneyBrand]: true, amount: amount.toFixed(amount.dp()), currency };
}

export function of(value: string | number | Decimal, currency: string): Money {
	if (!CURRENCY_PATTERN.test(currency)) {
		throw new Error(
			`A currency must be an uppercase ISO 4217 alpha-3 code; got "${currency}".`,
		);
	}
	let amount: Decimal;
	try {
		amount = new Decimal(value);
	} catch {
		throw new Error(
			`A monetary amount must be a finite decimal; got "${String(value)}".`,
		);
	}
	// decimal.js CONSTRUCTS NaN and Infinity happily; only the later arithmetic would
	// notice, so finiteness is checked here, where the value enters.
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

export function subtract(a: Money, b: Money): Result<Money, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	return ok(fromDecimal(new Decimal(a.amount).minus(b.amount), a.currency));
}

/** The PART `percent` of `a` (`a × percent / 100`) — never the adjusted total. */
export function percentageOf(a: Money, percent: Decimal): Money {
	return fromDecimal(new Decimal(a.amount).mul(percent).div(100), a.currency);
}

/** Unit price × quantity, at full precision — rounding happens only at `round`. */
export function scale(a: Money, factor: Decimal): Money {
	return fromDecimal(new Decimal(a.amount).mul(factor), a.currency);
}

/** Finalizes to the currency's minor unit, ROUND_HALF_UP, once (ADR-010). */
export function round(a: Money): Money {
	return fromDecimal(
		new Decimal(a.amount).toDecimalPlaces(MINOR_UNIT_PLACES, Decimal.ROUND_HALF_UP),
		a.currency,
	);
}

export function compare(a: Money, b: Money): Result<-1 | 0 | 1, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	return ok(new Decimal(a.amount).comparedTo(b.amount) as -1 | 0 | 1);
}
