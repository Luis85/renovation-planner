import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	add,
	compare,
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
	it('subtracts exactly, going negative without complaint', () => {
		expect(
			sameAmount(expectOk(subtract(of('25.00', 'USD'), of('30.125', 'USD'))), '-5.125'),
		).toBe(true);
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
