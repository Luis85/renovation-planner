import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { computeEstimatedCost, type CostPipelineInput } from '../../../src/domain/cost/costPipeline';
import { runQuantityEngine } from '../../../src/domain/cost/quantityEngine';
import { effectiveValue } from '../../../src/core/derived/DerivedValue';
import { currencyOf, of as moneyOf, type Money } from '../../../src/core/money/Money';
import { expectErr, expectOk } from '../../helpers/domain';

function d(value: string): Decimal {
	return new Decimal(value);
}

/** Parsed-decimal equality, never `toNumber()`. */
function sameAmount(money: Money, expected: string): boolean {
	return new Decimal(money.amount).equals(d(expected));
}

/** The worked example's purchase quantity: 15 m2 from 12,345,678 mm2, 10% waste, 2.5 m2 lots. */
function workedExampleQuantity() {
	return expectOk(
		runQuantityEngine(d('12345678'), 'm2', { coverageRate: d('1') }, d('10'), {
			lotSize: d('2.5'),
		}),
	).calculated;
}

function baseInput(): CostPipelineInput {
	return {
		quantity: workedExampleQuantity(),
		unitPrice: moneyOf('12.50', 'USD'),
		expectedCurrency: currencyOf('USD'),
	};
}

describe('computeEstimatedCost', () => {
	it('runs the worked example: subtotal -> discount -> shipping -> tax -> one final round', () => {
		const result = expectOk(
			computeEstimatedCost({
				...baseInput(),
				discount: { percent: d('5') },
				shipping: moneyOf('25.00', 'USD'),
				taxRate: d('8.25'),
			}),
		);
		expect(result.calculated.currency).toBe('USD');
		expect(sameAmount(result.calculated, '219.88')).toBe(true);
		expect(result.override).toBeUndefined();
	});

	it('keeps intermediate precision: a zero-tax run shows the unrounded post-shipping total', () => {
		const result = expectOk(
			computeEstimatedCost({
				...baseInput(),
				discount: { percent: d('5') },
				shipping: moneyOf('25.00', 'USD'),
			}),
		);
		expect(sameAmount(result.calculated, '203.13')).toBe(true);
	});

	it('consumes the EFFECTIVE purchase quantity, so an override flows through the whole pipeline', () => {
		const calculated = workedExampleQuantity();
		const overridden = effectiveValue({ calculated, override: { value: d('18'), unit: 'm2' as const } });
		const result = expectOk(
			computeEstimatedCost({
				quantity: overridden,
				unitPrice: moneyOf('12.50', 'USD'),
				expectedCurrency: currencyOf('USD'),
			}),
		);
		expect(sameAmount(result.calculated, '225.00')).toBe(true);
	});

	it('a supplied surcharge is added before tax (ADR-12), which rounding cannot hide', () => {
		const withSurcharge = expectOk(
			computeEstimatedCost({
				...baseInput(),
				discount: { percent: d('5') },
				shipping: moneyOf('25.00', 'USD'),
				surcharge: moneyOf('25.00', 'USD'),
				taxRate: d('8.25'),
			}),
		);
		// Before tax: (203.125 + 25) x 1.0825 = 246.9453125 -> 246.95.
		// After tax it would be 203.125 x 1.0825 + 25 = 244.8828125 -> 244.88.
		expect(sameAmount(withSurcharge.calculated, '246.95')).toBe(true);
	});

	it('an omitted surcharge leaves the post-shipping total unchanged', () => {
		const without = expectOk(
			computeEstimatedCost({
				...baseInput(),
				discount: { percent: d('5') },
				shipping: moneyOf('25.00', 'USD'),
				taxRate: d('8.25'),
			}),
		);
		expect(sameAmount(without.calculated, '219.88')).toBe(true);
	});

	it('applies a discount alone in decimal, half-up where banker’s rounding differs', () => {
		const discounted = expectOk(
			computeEstimatedCost({
				quantity: workedExampleQuantity(),
				unitPrice: moneyOf('12.50', 'USD'),
				expectedCurrency: currencyOf('USD'),
				discount: { percent: d('5') },
			}),
		);
		// 187.50 x 0.95 = 178.125 exactly - ROUND_HALF_UP gives 178.13, banker’s 178.12.
		expect(sameAmount(discounted.calculated, '178.13')).toBe(true);
	});

	it('an omitted optional component costs nothing rather than failing', () => {
		const bare = expectOk(
			computeEstimatedCost({
				quantity: { value: d('10'), unit: 'piece' },
				unitPrice: moneyOf('7.05', 'EUR'),
				expectedCurrency: currencyOf('EUR'),
			}),
		);
		expect(sameAmount(bare.calculated, '70.50')).toBe(true);
	});

	it('refuses optional components in another currency', () => {
		for (const mismatched of [
			{ ...baseInput(), shipping: moneyOf('25.00', 'EUR') },
			{ ...baseInput(), surcharge: moneyOf('25.00', 'EUR') },
		]) {
			const error = expectErr(computeEstimatedCost(mismatched));
			expect(error.category).toBe('Calculation');
			expect(error.code).toBe('money.currency-mismatch');
		}
	});

	it('refuses a unit price whose pricing BASIS differs from the quantity’s, when the caller declares one', () => {
		const error = expectErr(
			computeEstimatedCost({ ...baseInput(), pricedPer: 'm' }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('cost.pricing-basis-mismatch');
	});

	it('accepts a declared pricing basis of the same kind', () => {
		const result = expectOk(computeEstimatedCost({ ...baseInput(), pricedPer: 'm2' }));
		expect(sameAmount(result.calculated, '187.50')).toBe(true);
	});

	it('a NEGATIVE discount would add money instead of subtracting it, and is refused', () => {
		const error = expectErr(
			computeEstimatedCost({ ...baseInput(), discount: { percent: d('-5') } }),
		);
		expect(error.code).toBe('cost.negative-percent');
	});

	it('a NEGATIVE tax rate is refused for the same reason', () => {
		const error = expectErr(computeEstimatedCost({ ...baseInput(), taxRate: d('-8.25') }));
		expect(error.code).toBe('cost.negative-percent');
	});

	it('a discount ABOVE 100% would report a negative cost as a success, and is refused', () => {
		const error = expectErr(
			computeEstimatedCost({ ...baseInput(), discount: { percent: d('150') } }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('cost.discount-above-full');
	});

	it('a discount of exactly 100% is the boundary and still computes, to zero', () => {
		const free = expectOk(
			computeEstimatedCost({ ...baseInput(), discount: { percent: d('100') } }),
		);
		expect(sameAmount(free.calculated, '0')).toBe(true);
	});

	it('a tax rate above 100% is surprising but cannot go negative, so it is NOT refused', () => {
		const taxed = expectOk(
			computeEstimatedCost({
				quantity: { value: d('1'), unit: 'piece' },
				unitPrice: moneyOf('10.00', 'USD'),
				expectedCurrency: currencyOf('USD'),
				taxRate: d('150'),
			}),
		);
		expect(sameAmount(taxed.calculated, '25.00')).toBe(true);
	});

	it('a NEGATIVE quantity is a typed failure, not a negative cost reported as a success', () => {
		const error = expectErr(
			computeEstimatedCost({
				quantity: { value: d('-3'), unit: 'piece' },
				unitPrice: moneyOf('12.50', 'USD'),
				expectedCurrency: currencyOf('USD'),
			}),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.negative');
	});

	it('a NEGATIVE unit price is refused: Money is signed, but a price is not', () => {
		// `core/money` stopped enforcing this and a FIELD that cannot go below zero is
		// guarded where it enters — here, beside the negative quantity and the discount
		// bound, before any arithmetic runs.
		const error = expectErr(
			computeEstimatedCost({ ...baseInput(), unitPrice: moneyOf('-12.50', 'USD') }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('cost.negative-amount');
		expect(error.message).toContain('unit price');
	});

	it('a NEGATIVE shipping charge is refused, and names the field it refused', () => {
		const error = expectErr(
			computeEstimatedCost({ ...baseInput(), shipping: moneyOf('-25.00', 'USD') }),
		);
		expect(error.code).toBe('cost.negative-amount');
		expect(error.message).toContain('shipping charge');
	});

	it('a NEGATIVE surcharge is refused, which is what ADR-012 refused to model as a discount', () => {
		const error = expectErr(
			computeEstimatedCost({ ...baseInput(), surcharge: moneyOf('-5.00', 'USD') }),
		);
		expect(error.code).toBe('cost.negative-amount');
		expect(error.message).toContain('surcharge');
	});

	it('a zero unit price, shipping and surcharge are not negative and still compute', () => {
		const free = expectOk(
			computeEstimatedCost({
				quantity: { value: d('3'), unit: 'piece' },
				unitPrice: moneyOf('0', 'USD'),
				expectedCurrency: currencyOf('USD'),
				shipping: moneyOf('0', 'USD'),
				surcharge: moneyOf('0', 'USD'),
			}),
		);
		expect(sameAmount(free.calculated, '0')).toBe(true);
	});

	it('a zero quantity is not negative, and costs the additive components alone', () => {
		const none = expectOk(
			computeEstimatedCost({
				quantity: { value: d('0'), unit: 'piece' },
				unitPrice: moneyOf('12.50', 'USD'),
				expectedCurrency: currencyOf('USD'),
				shipping: moneyOf('25.00', 'USD'),
			}),
		);
		expect(sameAmount(none.calculated, '25.00')).toBe(true);
	});
	it('accepts a NEGATIVE ZERO tax rate and a negative-zero discount — both are zero', () => {
		// decimal.js reports negative zero as negative, so `isNegative()` refused a rate of
		// zero arrived at by multiplication — exactly the construction `quantityEngine`
		// names beside its own `lessThan(0)`. Two answers to one question, one directory
		// apart, and the newer one had already written down why the older was wrong.
		const negativeZero = new Decimal(0).mul(-1);
		expect(negativeZero.isNegative()).toBe(true); // the property this guards against
		expect(negativeZero.lessThan(0)).toBe(false);

		for (const field of ['taxRate', 'discount'] as const) {
			const input = {
				quantity: { value: new Decimal('2'), unit: 'm2' as const },
				unitPrice: moneyOf('10.00', 'USD'),
				expectedCurrency: currencyOf('USD'),
				...(field === 'taxRate'
					? { taxRate: negativeZero }
					: { discount: { kind: 'percent' as const, percent: negativeZero } }),
			};
			expect(computeEstimatedCost(input)).toMatchObject({ ok: true });
		}
	});
});
