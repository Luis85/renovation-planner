import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { computeEstimatedCost } from '../../../src/domain/cost/costPipeline';
import { currencyOf, of } from '../../../src/core/money/Money';
import { expectErr, expectOk } from '../../helpers/domain';

const TEN_SQUARE_METRES = { value: new Decimal('10'), unit: 'm2' } as const;

describe('the pipeline is told the currency it must produce', () => {
	it('refuses a unit price in another currency', () => {
		const error = expectErr(
			computeEstimatedCost({
				quantity: TEN_SQUARE_METRES,
				unitPrice: of('39.50', 'GBP'),
				expectedCurrency: currencyOf('EUR'),
			}),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('cost.currency-mismatch');
		// Developer English names both values; the USER sentence cannot, because
		// `toUserMessage` takes no params.
		expect(error.message).toContain('GBP');
		expect(error.message).toContain('EUR');
	});

	it('computes when they agree, so the test is not green because it refuses everything', () => {
		const result = expectOk(
			computeEstimatedCost({
				quantity: TEN_SQUARE_METRES,
				unitPrice: of('39.50', 'EUR'),
				expectedCurrency: currencyOf('EUR'),
			}),
		);
		expect(result.calculated.amount).toBe('395.00');
	});

	/**
	 * BEFORE any arithmetic: a mismatch must not be able to produce a partially computed
	 * figure. Driven with a discount above 100% as well — a second refusable input — so the
	 * assertion is that the currency check runs in the guard block rather than mid-chain.
	 */
	it('refuses before arithmetic, alongside the other input guards', () => {
		const error = expectErr(
			computeEstimatedCost({
				quantity: TEN_SQUARE_METRES,
				unitPrice: of('39.50', 'GBP'),
				expectedCurrency: currencyOf('EUR'),
				shipping: of('10.00', 'GBP'),
			}),
		);
		expect(error.code).toBe('cost.currency-mismatch');
	});
});
