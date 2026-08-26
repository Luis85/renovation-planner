import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	add,
	compare,
	createMoney,
	percentageOf,
	round,
	scale,
	subtract,
	zero,
	type Money,
	of,
} from '../../../src/core/money/Money';
import { expectErr, expectOk } from '../../helpers/domain';

/** Parsed-decimal equality, never text comparison and never a coerced number. */
function sameAmount(money: Money, expected: string): boolean {
	return new Decimal(money.amount).equals(new Decimal(expected));
}

describe('add', () => {
	it('adds exactly where native floats lose the cents (ADR-010)', () => {
		const sum = expectOk(add(of('0.10', 'USD'), of('0.20', 'USD')));
		expect(sum.currency).toBe('USD');
		expect(sameAmount(sum, '0.30')).toBe(true);
	});

	it('refuses to mix currencies', () => {
		const error = expectErr(add(of('10', 'USD'), of('10', 'EUR')));
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('money.currency-mismatch');
	});

	it('does not mutate either operand', () => {
		const a = of('0.10', 'USD');
		expect(sameAmount(expectOk(add(a, of('0.20', 'USD'))), '0.30')).toBe(true);
		expect(sameAmount(a, '0.10')).toBe(true);
	});
});

describe('subtract', () => {
	it('subtracts exactly', () => {
		expect(
			sameAmount(expectOk(subtract(of('30.125', 'USD'), of('25.00', 'USD'))), '5.125'),
		).toBe(true);
	});

	it('answers a NEGATIVE difference as a value, because over budget is the answer', () => {
		// The case a variance exists to report: `budget - planned` below zero is the
		// result, not an error path.
		const under = expectOk(subtract(of('25.00', 'USD'), of('30.125', 'USD')));
		expect(sameAmount(under, '-5.125')).toBe(true);
		expect(under.currency).toBe('USD');
	});

	it('subtracting a value from itself is zero, and zero is unsigned', () => {
		expect(sameAmount(expectOk(subtract(of('30.125', 'USD'), of('30.125', 'USD'))), '0')).toBe(
			true,
		);
	});

	it('refuses to mix currencies', () => {
		const error = expectErr(subtract(of('10', 'USD'), of('10', 'EUR')));
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('money.currency-mismatch');
	});
});

describe('scale', () => {
	it('multiplies a unit price by a quantity in decimal, not binary floating point', () => {
		expect(sameAmount(scale(of('12.50', 'USD'), new Decimal('15')), '187.50')).toBe(true);
	});
});

describe('percentageOf', () => {
	it('returns the PART, not the adjusted total', () => {
		expect(sameAmount(percentageOf(of('187.50', 'USD'), new Decimal('5')), '9.375')).toBe(true);
	});

	it('adds nothing for a zero percent', () => {
		expect(sameAmount(percentageOf(of('187.50', 'USD'), new Decimal('0')), '0')).toBe(true);
	});
});

describe('round', () => {
	it('finalizes to the currency minor unit once, at the end', () => {
		expect(sameAmount(round(of('219.8828125', 'USD')), '219.88')).toBe(true);
	});

	it('SERIALIZES at the minor unit, keeping the trailing zero round exists to produce', () => {
		// The one function whose job is to finalize a figure for output: asserted on the
		// STRING, not on a re-parsed Decimal, because a re-parsed value cannot tell
		// "219.8" from "219.80" and that difference is the whole output.
		expect(round(of('219.80', 'USD')).amount).toBe('219.80');
		expect(round(of('219.8828125', 'USD')).amount).toBe('219.88');
		expect(round(of('7', 'USD')).amount).toBe('7.00');
		expect(round(of('0', 'USD')).amount).toBe('0.00');
	});

	it('resolves the .005 boundary upward (ROUND_HALF_UP, ADR-010)', () => {
		expect(sameAmount(round(of('2.005', 'USD')), '2.01')).toBe(true);
	});

	it('resolves the .125 boundary upward, where banker’s rounding would round down', () => {
		expect(sameAmount(round(of('2.125', 'USD')), '2.13')).toBe(true);
	});
});

describe('compare', () => {
	it('orders by amount', () => {
		expect(expectOk(compare(of('5', 'EUR'), of('7', 'EUR')))).toBe(-1);
		expect(expectOk(compare(of('7', 'EUR'), of('7', 'EUR')))).toBe(0);
		expect(expectOk(compare(of('9.5', 'EUR'), of('7', 'EUR')))).toBe(1);
	});

	it('refuses to mix currencies', () => {
		const error = expectErr(compare(of('10', 'USD'), of('10', 'EUR')));
		expect(error.category).toBe('Calculation');
	});
});

describe('of and zero', () => {
	it('constructs from a string without float parsing loss', () => {
		expect(sameAmount(of('0.10', 'USD'), '0.10')).toBe(true);
	});

	it('constructs from a number through its shortest decimal form', () => {
		expect(sameAmount(of(0.1, 'USD'), '0.1')).toBe(true);
	});

	it('constructs from a Decimal verbatim', () => {
		expect(sameAmount(of(new Decimal('13.5802458'), 'USD'), '13.5802458')).toBe(true);
	});

	it('persists exponent forms as plain decimal strings, so the stored amount round-trips', () => {
		// `toString()` would keep "1e+3" and break `new Decimal(...)` nowhere — but a plain
		// string is the invariant every reader of `amount` relies on.
		expect(of('1e3', 'USD').amount).toBe('1000');
		expect(of('1.5e-2', 'USD').amount).toBe('0.015');
	});

	it('refuses a currency that is not an ISO alpha-3 code rather than corrupting every later total', () => {
		expect(() => of('10', 'eur')).toThrow('ISO 4217');
		expect(() => of('10', 'EURO')).toThrow('ISO 4217');
	});

	it('diagnoses a malformed amount in its own words instead of a raw DecimalError', () => {
		expect(() => of('abc', 'USD')).toThrow('finite decimal');
		expect(() => of(Number.NaN, 'USD')).toThrow('finite decimal');
	});

	it('zero is the additive identity', () => {
		const z = zero('EUR');
		expect(z.currency).toBe('EUR');
		expect(sameAmount(expectOk(add(of('149.99', 'EUR'), z)), '149.99')).toBe(true);
	});
});

describe('the round-trip invariant', () => {
	/**
	 * The property under every case below: anything this module can PRODUCE,
	 * `createMoney` can read back. A value the engine minted that persistence then
	 * refuses is a value that cannot be re-read, which is what made this a defect rather
	 * than a taste — so it is asserted over the operations, not over one example.
	 *
	 * The grid carries NEGATIVE operands and factors as well as positive ones, because
	 * `Money` is signed: widening `AMOUNT_PATTERN` without widening this grid would leave
	 * exactly the new half of the value set unchecked.
	 */
	it('round-trips every produced amount back through createMoney, sign included', () => {
		const amounts = [
			'0', '5', '0.1', '219.80', '1e3', '12.345678', '0.005', '187.50',
			'-5', '-0.1', '-219.80', '-1e3', '-12.345678', '-0.005',
		];
		const factors = ['0', '1', '3', '0.5', '13.5802458', '100', '-1', '-3', '-0.5', '-100'];
		const produced: Money[] = [zero('USD')];
		for (const amount of amounts) {
			const a = of(amount, 'USD');
			produced.push(a, round(a));
			for (const factor of factors) {
				const b = of(factor, 'USD');
				produced.push(scale(a, new Decimal(factor)), percentageOf(a, new Decimal(factor)));
				produced.push(expectOk(add(a, b)));
				// Both directions, so a negative DIFFERENCE from positive operands is in the
				// set too — the case the reversed decision made an error path.
				produced.push(expectOk(subtract(a, b)), expectOk(subtract(b, a)));
			}
		}
		expect(produced.length).toBeGreaterThan(500);
		expect(produced.some((money) => money.amount.startsWith('-'))).toBe(true);
		for (const money of produced) {
			const readBack = createMoney(money.amount, money.currency);
			if (!readBack.ok) {
				throw new Error(`createMoney refused an amount this module produced: "${money.amount}".`);
			}
			expect(new Decimal(readBack.value.amount).equals(new Decimal(money.amount))).toBe(true);
		}
	});

	it('mints a negative amount, which is a value and not a programmer error', () => {
		expect(of('-5', 'USD').amount).toBe('-5');
		expect(sameAmount(scale(of('12.50', 'USD'), new Decimal('-3')), '-37.50')).toBe(true);
		expect(sameAmount(percentageOf(of('12.50', 'USD'), new Decimal('-8')), '-1')).toBe(true);
	});

	it('drops the sign of a ZERO at every door, so zero has one spelling', () => {
		// `toFixed` serializes negative zero as a plain `0`, which is what lets
		// `AMOUNT_PATTERN` refuse `-0` without ever refusing something this module wrote.
		expect(scale(of('0', 'USD'), new Decimal('-3')).amount).toBe('0');
		expect(of('-0', 'USD').amount).toBe('0');
		expect(of('-0.00', 'USD').amount).toBe('0');
		// `round` is the one caller that serializes at a FIXED number of places, so it is
		// the one that could print `-0.00` from a tiny negative. It rounds first, and a
		// rounded-to-zero value has no sign left to print.
		expect(round(of('-0.001', 'USD')).amount).toBe('0.00');
		expect(round(of('-0.006', 'USD')).amount).toBe('-0.01');
	});

	it('refuses a literal in another base, which decimal.js would read as a number', () => {
		// `of('0x10', 'USD')` silently meant sixteen dollars.
		for (const bad of ['0x10', '0b101', '0o17']) {
			expect(() => of(bad, 'USD')).toThrow('decimal literal');
		}
	});
});

describe('the arithmetic precision', () => {
	/** 20 significant digits, so its square needs 37 — more than any precision here. */
	const WIDE = '12345678901234567890';

	it('is immune to a global Decimal.set, which any dependency could call', () => {
		const before = scale(of(WIDE, 'USD'), new Decimal(WIDE)).amount;
		Decimal.set({ precision: 5 });
		try {
			// The GLOBAL constructor is now crippled — a total computed through it would
			// come out as 152420000000000000000000000000000000000.
			expect(new Decimal(WIDE).mul(WIDE).toFixed(0)).toBe(
				'152420000000000000000000000000000000000',
			);
			expect(scale(of(WIDE, 'USD'), new Decimal(WIDE)).amount).toBe(before);
		} finally {
			Decimal.set({ defaults: true });
		}
		expect(before).toBe('152415787532388367501905199875019100000');
	});

	it('rounds beyond 34 significant digits, which is the limit the header names', () => {
		// The residual, stated as a check rather than as a promise of exactness: the
		// exact square needs 37 significant digits and does not survive.
		const product = new Decimal(scale(of(WIDE, 'USD'), new Decimal(WIDE)).amount);
		expect(product.sd()).toBeLessThanOrEqual(34);
		expect(product.equals(new Decimal('152415787532388367501905199875019052100'))).toBe(false);
	});

	it('a percentage divides by one hundred exactly, at any size', () => {
		// `div` is the operation that would round if it could, and dividing by 100 only
		// shifts an exponent — the significant digits are the ones `mul` already produced.
		expect(percentageOf(of('187.50', 'USD'), new Decimal('8.25')).amount).toBe('15.46875');
	});
});
