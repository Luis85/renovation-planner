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

	it('refuses to produce a NEGATIVE amount, which no Money can hold', () => {
		const error = expectErr(subtract(of('25.00', 'USD'), of('30.125', 'USD')));
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('money.negative-result');
	});

	it('subtracting a value from itself is zero, not a negative-result failure', () => {
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
	it('multiplies a unit price by a quantity at full precision', () => {
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

describe('the non-negative invariant', () => {
	/**
	 * The property under every case below: anything this module can PRODUCE,
	 * `createMoney` can read back. A value the engine minted that persistence then
	 * refuses is a value that cannot be re-read, which is what made this a defect rather
	 * than a taste — so it is asserted over the operations, not over one example.
	 */
	it('round-trips every produced amount back through createMoney', () => {
		const amounts = ['0', '5', '0.1', '219.80', '1e3', '12.345678', '0.005', '187.50'];
		const factors = ['0', '1', '3', '0.5', '13.5802458', '100'];
		const produced: Money[] = [zero('USD')];
		for (const amount of amounts) {
			const a = of(amount, 'USD');
			produced.push(a, round(a));
			for (const factor of factors) {
				const b = of(factor, 'USD');
				produced.push(scale(a, new Decimal(factor)), percentageOf(a, new Decimal(factor)));
				produced.push(expectOk(add(a, b)));
				const difference = subtract(a, b);
				// Only the ok arm can be collected: the whole point is that the err arm
				// never yields a Money at all.
				if (difference.ok) produced.push(difference.value);
			}
		}
		expect(produced.length).toBeGreaterThan(150);
		for (const money of produced) {
			const readBack = createMoney(money.amount, money.currency);
			if (!readBack.ok) {
				throw new Error(`createMoney refused an amount this module produced: "${money.amount}".`);
			}
			expect(new Decimal(readBack.value.amount).equals(new Decimal(money.amount))).toBe(true);
		}
	});

	it('refuses to construct a negative amount at all, as a programmer error', () => {
		expect(() => of('-5', 'USD')).toThrow('negative');
	});

	it('throws rather than mint a negative amount from an operation the pipeline cannot reach', () => {
		// `scale` and `percentageOf` return a bare Money, so a negative factor has nowhere
		// to report to. The Cost Pipeline refuses a negative quantity and a negative
		// percent before either is called, which is what makes this arm unreachable from
		// there and a programmer error everywhere else (SDD §65).
		expect(() => scale(of('12.50', 'USD'), new Decimal('-3'))).toThrow('negative');
		expect(() => percentageOf(of('12.50', 'USD'), new Decimal('-5'))).toThrow('negative');
	});

	it('a negative ZERO is a zero, not a negative amount', () => {
		expect(scale(of('0', 'USD'), new Decimal('-3')).amount).toBe('0');
	});

	it('refuses a literal in another base, which decimal.js would read as a number', () => {
		// `of('0x10', 'USD')` silently meant sixteen dollars.
		for (const bad of ['0x10', '0b101', '0o17']) {
			expect(() => of(bad, 'USD')).toThrow('decimal literal');
		}
	});
});
