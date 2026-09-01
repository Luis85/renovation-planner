import { describe, expect, it } from 'vitest';
import { createMoney, currencyOf, of, parseCurrency, zero } from '../../../src/core/money/Money';
import { expectErr, expectOk } from '../../helpers/domain';

describe('parseCurrency', () => {
	it('accepts an uppercase ISO 4217 alpha-3 code', () => {
		expect(expectOk(parseCurrency('EUR'))).toBe('EUR');
	});

	it('refuses a lowercase code', () => {
		expect(expectErr(parseCurrency('eur')).code).toBe('money.invalid-currency');
	});

	it('refuses a non-string, because data.json holds whatever a user typed', () => {
		expect(expectErr(parseCurrency(42)).code).toBe('money.invalid-currency');
	});
});

describe('currencyOf', () => {
	it('answers the code for a program literal', () => {
		expect(currencyOf('GBP')).toBe('GBP');
	});

	it('THROWS rather than answering a Result, like `of` above it', () => {
		expect(() => currencyOf('gbp')).toThrow(/ISO 4217/);
	});
});

describe('a Money carries a validated Currency', () => {
	it('through `of`', () => {
		expect(of('1.00', 'CHF').currency).toBe('CHF');
	});

	it('through `zero`', () => {
		expect(zero('USD').currency).toBe('USD');
	});

	it('through `createMoney`', () => {
		expect(expectOk(createMoney('1.00', 'GBP')).currency).toBe('GBP');
	});
});
