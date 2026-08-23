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

	it('rejects amounts a float would mangle: leading zeros, signs, exponents, empty', () => {
		for (const bad of ['0149.99', '-5', '1e3', '.5', '5.', '', '1 2']) {
			const error = expectErr(createMoney(bad, 'EUR'));
			expect(error.code).toBe('money.invalid-amount');
		}
	});

	it('rejects anything that is not an ISO 4217 alpha-3 code', () => {
		for (const bad of ['eur', 'EURO', 'E', '']) {
			const error = expectErr(createMoney('10', bad));
			expect(error.code).toBe('money.invalid-currency');
		}
	});
});
