import { describe, expect, it } from 'vitest';
import { normalizeDecimalInput } from '../../../src/presentation/library/decimalInput';

describe('normalizeDecimalInput', () => {
	it.each([
		['4,50', '4.50'],
		[' 4,5 ', '4.5'],
		['12', '12'],
		[' 12.50 ', '12.50'],
		['', ''],
		['-0', '-0'],
	])('turns %j into %j', (raw, expected) => {
		expect(normalizeDecimalInput(raw)).toBe(expected);
	});
	it.each(['1,000.5', '1,2,3', '1.000,5'])('leaves %j for Decimal to refuse', (raw) => {
		expect(normalizeDecimalInput(raw)).toBe(raw);
	});
});
