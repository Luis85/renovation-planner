import { describe, expect, it } from 'vitest';
import { createMoney } from '../../../src/core/money/Money';
import { expectErr, expectOk } from '../../helpers/domain';

describe('createMoney', () => {
	it('accepts a plain decimal amount and uppercase currency code', () => {
		const money = expectOk(createMoney('1499.99', 'EUR'));
		expect(money.amount).toBe('1499.99');
		expect(money.currency).toBe('EUR');
	});

	it('does NOT normalize amounts: equal amounts may stay distinct strings', () => {
		// Shape validation only — text comparison of amounts is slice 9's job on parsed
		// values, so this pins the absence of a guarantee rather than its presence.
		expect(expectOk(createMoney('0.5', 'EUR')).amount).toBe('0.5');
		expect(expectOk(createMoney('0.50', 'EUR')).amount).toBe('0.50');
	});

	it('accepts a NEGATIVE amount: Money is signed, and a difference is a value', () => {
		expect(expectOk(createMoney('-5', 'EUR')).amount).toBe('-5');
		expect(expectOk(createMoney('-0.01', 'EUR')).amount).toBe('-0.01');
		expect(expectOk(createMoney('-1499.99', 'EUR')).amount).toBe('-1499.99');
	});

	it('rejects amounts a float would mangle: leading zeros, a plus, exponents, empty', () => {
		for (const bad of ['0149.99', '+5', '1e3', '.5', '5.', '', '1 2', '-.5', '-5.', '--5', '-']) {
			const error = expectErr(createMoney(bad, 'EUR'));
			expect(error.code).toBe('money.invalid-amount');
		}
	});

	it('rejects a SIGNED ZERO, so zero has exactly one spelling', () => {
		// `fromDecimal` can never emit one — `toFixed` drops the sign of a zero — so
		// admitting `-0` would add a second string for a value the module always writes
		// as `0`, and two amounts that compare equal would digest differently.
		for (const bad of ['-0', '-0.0', '-0.00']) {
			const error = expectErr(createMoney(bad, 'EUR'));
			expect(error.code).toBe('money.invalid-amount');
		}
		expect(expectOk(createMoney('0.00', 'EUR')).amount).toBe('0.00');
	});

	it('rejects anything that is not an ISO 4217 alpha-3 code', () => {
		for (const bad of ['eur', 'EURO', 'E', '']) {
			const error = expectErr(createMoney('10', bad));
			expect(error.code).toBe('money.invalid-currency');
		}
	});
});
