import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { checkWasteFraction } from '../../../src/domain/asset/Asset';
import { assetError } from '../../../src/domain/asset/Asset.errors';

/**
 * `checkWasteFraction` in isolation — `tests/application/domainValidation.test.ts` drives
 * `Asset.create`'s refusals end to end, and this is the one case that needs the function
 * directly: a negative-zero waste factor (C6).
 */
describe('checkWasteFraction', () => {
	it('accepts a negative-zero waste factor as zero', () => {
		// decimal.js reports negative zero as negative (`isNegative()`), and a waste factor
		// of zero arrived at by multiplication is still a legitimate zero — the same
		// construction `quantityEngine`'s `negativeQuantity` guards against with `lessThan(0)`.
		const negativeZero = new Decimal(0).mul(-1);
		expect(negativeZero.isNegative()).toBe(true);
		expect(checkWasteFraction(negativeZero, 'waste-factor-default', assetError).ok).toBe(true);
	});

	it('still refuses a genuinely negative fraction', () => {
		const result = checkWasteFraction(new Decimal('-0.5'), 'waste-factor-default', assetError);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('asset.negative-waste-factor-default');
	});
});
