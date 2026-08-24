import { describe, expect, it } from 'vitest';
import { effectiveValue, type DerivedValue } from '../../../src/core/derived/DerivedValue';

describe('effectiveValue', () => {
	it('resolves to the override when one is present', () => {
		const dv: DerivedValue<number> = { calculated: 15, override: 18 };
		expect(effectiveValue(dv)).toBe(18);
	});

	it('resolves to the calculated value when no override is present', () => {
		const dv: DerivedValue<number> = { calculated: 15 };
		expect(effectiveValue(dv)).toBe(15);
	});
});
