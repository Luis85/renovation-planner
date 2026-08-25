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
 * ADR-010 refuses. The string is this module's serialization of a `Decimal`; every
 * operation parses, computes and serializes back, and no intermediate value is rounded
 * TO THE CURRENCY'S MINOR UNIT between stages — that happens once, at `round`, where a
 * figure is finalized as output (ADR-010).
 *
 * That is narrower than "full precision", which an earlier version of this comment
 * claimed and decimal.js does not provide: every operation rounds to a configured number
 * of SIGNIFICANT digits. Here that number is `MONEY_PRECISION`, on a constructor of this
 * module's own — see the constant for both the figure and the residual limit it leaves.
 *
 * A Money is never NEGATIVE, and that is an invariant rather than a claim made at one
 * door: `createMoney`'s pattern refuses a leading `-`, and `fromDecimal` — the single
 * point every operation mints through — refuses one too. So anything this module can
 * produce, `createMoney` can read back; an amount that failed on the way back in through
 * persistence would be a value the engine computed and can never re-read. `subtract`
 * reports a negative difference as a typed failure, and the operations that answer a bare
 * Money throw on one instead. Today's only caller — the Cost Pipeline — refuses a
 * negative factor or percent before either reaches `scale`/`percentageOf`, but that is a
 * convention this module's one caller observes, not a gate this module enforces:
 * `scale` and `percentageOf` are exported, and nothing here stops a future caller from
 * handing either a negative `Decimal` straight from user input.
 *
 * The invariant itself is right for what this module computes today — a cost, a price, a
 * subtotal are never negative — and wrong the day something needs a SIGNED amount.
 * `docs/requirements/Reporting and project cockpit.md` asks "am I over budget"; a budget
 * variance (spent minus budget) is a difference whose sign is the answer, and under this
 * design that computation comes back as `subtract`'s `money.negative-result` failure
 * rather than a value whenever spend exceeds budget — the one case a variance exists to
 * report. Whoever builds that reads this as the recorded decision: the fix is a signed
 * `Variance` type of its own, not a relaxation of this invariant for every caller that
 * already relies on it.
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
 * Significant digits every operation below computes to. 34 is IEEE 754 decimal128's
 * precision — a figure with a source rather than a guess, and wide enough that a
 * twelve-digit unit price times a twelve-digit quantity is still exact, which no
 * renovation figure comes near.
 *
 * The residual limit, stated because there is one: `plus`, `minus` and `mul` each round
 * (ROUND_HALF_UP, ADR-010's mode) when their exact result needs more than 34 significant
 * digits. `div` cannot round here — the only division is by 100 in `percentageOf`, which
 * shifts an exponent and leaves the digits alone.
 */
const MONEY_PRECISION = 34;

/**
 * A module-private constructor, not the shared `Decimal`, because `Decimal.precision` is
 * process-global mutable state: any dependency — or a future import here — calling
 * `Decimal.set` would silently move every total this plugin computes, with nothing
 * recording that it had a value at all. A clone takes neither the global settings in
 * force when it is made (`defaults: true`) nor any later change to them.
 *
 * The threat it answers is a configuration call. Reading `Decimal.ROUND_HALF_UP` off the
 * shared constructor is safe from that, since `set` cannot reach the library's constants.
 */
const MoneyDecimal = Decimal.clone({
	defaults: true,
	precision: MONEY_PRECISION,
	rounding: Decimal.ROUND_HALF_UP,
});

/**
 * The ONE place a Money is minted from a Decimal, and so the one place the non-negative
 * invariant can hold for every operation at once. It is an invariant rather than a claim
 * made at one door: `createMoney` — the persistence door, reading a file the user can
 * hand-edit — refuses a leading `-`, so an amount this module produced and persistence
 * cannot read back would be a value the engine computed and can never re-read.
 *
 * A breach THROWS rather than answering a `Result`, in the same spirit as `of`: today's
 * only caller that could reach one from USER input — the Cost Pipeline — refuses it first
 * as a typed failure (it bounds its discount at 100% and refuses a negative quantity
 * before calling `percentageOf`/`scale`), and `subtract` reports a negative difference as
 * an error. That is a convention this module's one caller observes, not a gate `scale`/
 * `percentageOf` enforce themselves (see the module header above), so arriving here with
 * a negative amount from that caller is a programmer error (SDD §65), not a business
 * failure.
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

/**
 * The `number` overload is CALLER-BEWARE, and ADR-010 is the reason why that matters: a
 * float has already lost precision before it reaches this function, so
 * `of(0.1 + 0.2, 'USD')` mints `"0.30000000000000004"` — `LITERAL_PATTERN` guards the
 * string overload only and cannot see a value that arrived already rounded wrong as a
 * `number`. Prefer the string overload for anything that started as user input or a
 * literal in source; the `number` overload exists for a value some other API already
 * hands back as a float, not as an invitation to skip the string. Left open rather than
 * closed here: unlike `LITERAL_PATTERN`'s check, refusing a non-integer `number` (or the
 * overload outright) would be a behaviour change, and needs its own test and review, not
 * a documentation pass.
 */
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
	const amount = new MoneyDecimal(value);
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
	return ok(fromDecimal(new MoneyDecimal(a.amount).plus(b.amount), a.currency));
}

/**
 * A difference below zero is a typed failure, not a negative `Money`: `subtract` is the
 * one operation whose operands can legitimately produce one from valid input, and it
 * already answers a `Result`, so the invariant costs an error code rather than a throw.
 */
export function subtract(a: Money, b: Money): Result<Money, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	const difference = new MoneyDecimal(a.amount).minus(b.amount);
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
	return fromDecimal(new MoneyDecimal(a.amount).mul(percent).div(100), a.currency);
}

/**
 * Unit price × quantity. Nothing is rounded to the minor unit here — that is `round`'s
 * job, once, at the end; `MONEY_PRECISION` is the significant-digit limit that still
 * applies.
 */
export function scale(a: Money, factor: Decimal): Money {
	return fromDecimal(new MoneyDecimal(a.amount).mul(factor), a.currency);
}

/**
 * Finalizes to the currency's minor unit, ROUND_HALF_UP, once (ADR-010) — and SERIALIZES
 * there too. Rounding 219.80 to two places and then storing `dp()` of the result gives
 * "219.8", which defeats the one function whose whole job is to produce the figure that
 * goes out, so this is the one caller that passes `places`.
 */
export function round(a: Money): Money {
	return fromDecimal(
		new MoneyDecimal(a.amount).toDecimalPlaces(MINOR_UNIT_PLACES, MoneyDecimal.ROUND_HALF_UP),
		a.currency,
		MINOR_UNIT_PLACES,
	);
}

export function compare(a: Money, b: Money): Result<-1 | 0 | 1, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	return ok(new MoneyDecimal(a.amount).comparedTo(b.amount) as -1 | 0 | 1);
}
