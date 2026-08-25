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
 * **A Money is SIGNED**, and this paragraph is the record of a reversal. For one
 * increment it was not: `createMoney` and `fromDecimal` both refused a leading `-`, and
 * `subtract` reported a negative difference as a `money.negative-result` failure. That
 * was the wrong repair to a real defect. The defect was that `subtract` MINTED
 * `amount: '-5'` while `createMoney` refused to read it back — a value this module
 * produced and could not re-read — and it was fixed by narrowing the producer when the
 * reader was the half that was wrong.
 *
 * Two reasons it was wrong, both of them about what a value type is for. Non-negativity
 * is a property of particular FIELDS — a unit price, a shipping charge, a budget — not of
 * a monetary quantity, so the narrow version left `Money` unable to express a legitimate
 * domain value. And it made the important case an error: "am I over budget"
 * (`docs/requirements/Reporting and project cockpit.md`) is answered by a difference
 * whose SIGN is the answer, so the one computation a variance exists to report came back
 * as a failure exactly when it mattered. A signed `Variance` type of its own was the
 * escape hatch this comment used to propose, and it is refused: it would need add,
 * subtract, compare, round and currency matching — `Money` under a different name.
 *
 * **Non-negativity is enforced per FIELD, where those fields are validated**, not here:
 * `domain/cost/costPipeline.ts` refuses a negative unit price, shipping charge or
 * surcharge on its input (`cost.negative-amount`) alongside the negative quantity and
 * out-of-range discount it already refused, and `domain/project/Project.ts`'s smart
 * constructor refuses a negative `budget` or `contingency` (`project.negative-amount`).
 * A field that must not go below zero gets a guard where it enters; a difference does not.
 *
 * What survives the reversal is the invariant that was actually breached: **anything this
 * module can PRODUCE, `createMoney` can read back**, now over the wider signed set.
 * `AMOUNT_PATTERN` admits exactly what `fromDecimal`'s `toFixed` can emit — including a
 * leading `-`, and excluding a signed ZERO, which `toFixed` never writes. It is a
 * property of the two doors together rather than a claim about one, so
 * `tests/core/money/moneyArithmetic.test.ts` drives it over a grid of negative operands,
 * negative factors and negative results rather than over one example.
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

/**
 * One canonical spelling per value, signed: an optional `-`, no `+`, no leading zero, no
 * exponent, no bare `-`, no trailing dot — nothing `fromDecimal`'s `toFixed` cannot emit.
 *
 * The negative LOOKAHEAD is what refuses a signed zero (`-0`, `-0.00`): the sign is
 * admitted only in front of a magnitude that is not all zeros. `toFixed` drops the sign
 * of a zero — `new Decimal('-0').toFixed()` is `"0"`, and `round` rounds to the minor unit
 * before it serializes there, so a tiny negative cannot print as `-0.00` either — so this
 * refuses nothing this module writes. What it buys is that zero has ONE string: two
 * amounts that compare equal would otherwise digest differently in persistence.
 */
const AMOUNT_PATTERN = /^(-(?!0+(\.0+)?$))?(0|[1-9]\d*)(\.\d+)?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function createMoney(amount: string, currency: string): Result<Money, ValidationError> {
	if (!AMOUNT_PATTERN.test(amount)) {
		return err({
			category: 'Validation',
			code: 'money.invalid-amount',
			message: `A monetary amount must be a plain decimal string; got "${amount}".`,
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
 * The ONE place a Money is minted from a Decimal, and so the one place the round-trip
 * invariant lives: every string this module ever puts in an `amount` is written here, by
 * `toFixed`, and `AMOUNT_PATTERN` — the persistence door, reading a file the user can
 * hand-edit — is written to accept exactly that set. An amount this module produced and
 * `createMoney` then refused would be a value the engine computed and can never re-read,
 * which is the defect that pairing exists to prevent.
 *
 * It refuses NOTHING. A negative amount is a value (see the header), and a field that
 * must not hold one is guarded where that field is validated, not here.
 *
 * `places` is how `round` finalizes at the currency's minor unit; every other caller
 * serializes at the value's own precision. `toFixed` is the exact plain (never
 * exponential) notation — `toString()` would switch to exponential form past 20 digits
 * and break the round-trip back through `new Decimal(...)`. It also normalizes a negative
 * ZERO to a plain `0`, which is what lets `AMOUNT_PATTERN` refuse `-0`.
 */
function fromDecimal(amount: Decimal, currency: string, places?: number): Money {
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
 * A difference below zero is a VALUE. The `Result` here is for the currency mismatch and
 * nothing else — "budget minus planned cost" is the computation this exists for, and its
 * sign is the answer rather than an error (see the header's record of the reversal).
 */
export function subtract(a: Money, b: Money): Result<Money, CalculationError> {
	const mismatch = currencyMismatch(a, b);
	if (mismatch) return err(mismatch);
	return ok(fromDecimal(new MoneyDecimal(a.amount).minus(b.amount), a.currency));
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

/**
 * The sign, asked of the module that owns the representation: nothing outside
 * `core/money` may parse an `amount` itself (ADR-010), and a FIELD that must not go below
 * zero — a unit price, a shipping charge, a budget — is guarded by whoever validates that
 * field. This is what those guards ask.
 *
 * `lessThan(0)` rather than `isNegative()`, which decimal.js answers `true` for a negative
 * ZERO. No `Money` can hold one (`fromDecimal` serializes it as a plain `0`), so the two
 * agree here — `lessThan(0)` is the one that keeps agreeing if that ever changes.
 */
export function isNegative(a: Money): boolean {
	return new MoneyDecimal(a.amount).lessThan(0);
}
