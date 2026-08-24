import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	applyPackaging,
	applyRequirementRule,
	applyWaste,
	runQuantityEngine,
	toMeasuredQuantity,
	type PackagingRule,
	type RequirementRule,
} from '../../../src/domain/cost/quantityEngine';
import { expectErr, expectOk } from '../../helpers/domain';

function d(value: string): Decimal {
	return new Decimal(value);
}

/** Parsed-decimal equality, never `toNumber()`. */
function sameValue(q: { readonly value: Decimal }, expected: string): boolean {
	return q.value.equals(d(expected));
}

describe('toMeasuredQuantity', () => {
	it('converts an mm2 geometry measurement to m2 once, at the first stage', () => {
		const measured = toMeasuredQuantity(d('12345678'), 'm2');
		expect(measured.unit).toBe('m2');
		expect(sameValue(measured, '12.345678')).toBe(true);
	});

	it('converts mm to m for lengths', () => {
		expect(sameValue(toMeasuredQuantity(d('4575'), 'm'), '4.575')).toBe(true);
	});

	it('converts mm3 to m3 for volumes', () => {
		expect(sameValue(toMeasuredQuantity(d('2500000000'), 'm3'), '2.5')).toBe(true);
	});

	it('passes pieces through unconverted', () => {
		const measured = toMeasuredQuantity(d('12'), 'piece');
		expect(sameValue(measured, '12')).toBe(true);
	});

	it('a fixed quantity is one lump sum regardless of any raw measurement', () => {
		const measured = toMeasuredQuantity(d('0'), 'fixed');
		expect(sameValue(measured, '1')).toBe(true);
	});
});

describe('applyRequirementRule', () => {
	it('divides the measured quantity by the coverage rate', () => {
		const rule: RequirementRule = { coverageRate: d('2.5') };
		const required = expectOk(
			applyRequirementRule(toMeasuredQuantity(d('12345678'), 'm2'), rule),
		);
		expect(required.unit).toBe('m2');
		expect(sameValue(required, '4.9382712')).toBe(true);
	});

	it('refuses a zero coverage rate instead of dividing by it', () => {
		const error = expectErr(
			applyRequirementRule(toMeasuredQuantity(d('10'), 'm2'), { coverageRate: d('0') }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.zero-coverage-rate');
	});

	it('refuses a NEGATIVE coverage rate, which would flow a negative purchase through every later stage', () => {
		const error = expectErr(
			applyRequirementRule(toMeasuredQuantity(d('10'), 'm2'), { coverageRate: d('-1') }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.negative-coverage-rate');
	});

	it('refuses a negative measured quantity when driven stage by stage, not only through the engine', () => {
		const error = expectErr(
			applyRequirementRule({ value: d('-3'), unit: 'piece' }, { coverageRate: d('1') }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.negative');
	});
});

describe('applyWaste', () => {
	it('multiplies by 1 + percent/100 at full precision', () => {
		const required = { value: d('12.345678'), unit: 'm2' as const };
		const wasted = expectOk(applyWaste(required, d('10')));
		expect(sameValue(wasted, '13.5802458')).toBe(true);
	});

	it('at 0% is the identity operation', () => {
		const required = { value: d('7'), unit: 'piece' as const };
		const wasted = expectOk(applyWaste(required, d('0')));
		expect(sameValue(wasted, '7')).toBe(true);
	});

	it('refuses a negative waste percentage with its own error, not the quantity’s', () => {
		const error = expectErr(applyWaste({ value: d('7'), unit: 'piece' }, d('-5')));
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.negative-waste');
	});
});

describe('applyPackaging', () => {
	it('with no packaging rule passes the quantity through unchanged', () => {
		const wasted = { value: d('13.5802458'), unit: 'm2' as const };
		const purchase = expectOk(applyPackaging(wasted, undefined));
		expect(purchase.value.equals(wasted.value)).toBe(true);
	});

	it('rounds up to the next whole lot', () => {
		const rule: PackagingRule = { lotSize: d('2.5') };
		const purchase = expectOk(
			applyPackaging({ value: d('13.5802458'), unit: 'm2' }, rule),
		);
		expect(sameValue(purchase, '15')).toBe(true);
	});

	it('an exact whole number of lots stays put', () => {
		const purchase = expectOk(
			applyPackaging({ value: d('5'), unit: 'm2' }, { lotSize: d('2.5') }),
		);
		expect(sameValue(purchase, '5')).toBe(true);
	});

	it('raises a quantity below the minimum order up to it', () => {
		const rule: PackagingRule = { lotSize: d('2.5'), minimumOrder: d('10') };
		const purchase = expectOk(applyPackaging({ value: d('3'), unit: 'm2' }, rule));
		expect(sameValue(purchase, '10')).toBe(true);
	});

	it('a minimum order below the lot-rounded quantity changes nothing', () => {
		const rule: PackagingRule = { lotSize: d('2.5'), minimumOrder: d('4') };
		const purchase = expectOk(
			applyPackaging({ value: d('13.5802458'), unit: 'm2' }, rule),
		);
		expect(sameValue(purchase, '15')).toBe(true);
	});

	it('refuses a zero lot size instead of dividing by it', () => {
		const error = expectErr(
			applyPackaging({ value: d('10'), unit: 'm2' }, { lotSize: d('0') }),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.invalid-packaging');
	});

	it('refuses a negative lot size, which would round DOWN to a plausible-looking purchase', () => {
		const error = expectErr(
			applyPackaging({ value: d('10'), unit: 'm2' }, { lotSize: d('-2.5') }),
		);
		expect(error.code).toBe('quantity.invalid-packaging');
	});

	it('refuses a non-positive minimum order', () => {
		for (const bad of [d('0'), d('-10')]) {
			const error = expectErr(
				applyPackaging({ value: d('10'), unit: 'm2' }, { lotSize: d('2.5'), minimumOrder: bad }),
			);
			expect(error.code).toBe('quantity.invalid-packaging');
		}
	});
});

describe('runQuantityEngine', () => {
	it('runs the worked example end to end: 12,345,678 mm2 of paintable wall to 15 m2', () => {
		const result = expectOk(
			runQuantityEngine(d('12345678'), 'm2', { coverageRate: d('1') }, d('10'), {
				lotSize: d('2.5'),
			}),
		);
		expect(result.calculated.unit).toBe('m2');
		expect(sameValue(result.calculated, '15')).toBe(true);
		expect(result.override).toBeUndefined();
	});

	it('wraps the purchase quantity in a DerivedValue with only calculated populated', () => {
		const result = expectOk(
			runQuantityEngine(d('5000'), 'm', { coverageRate: d('1') }, d('0')),
		);
		expect(result.override).toBeUndefined();
		expect(sameValue(result.calculated, '5')).toBe(true);
	});

	it('refuses a negative geometry measurement', () => {
		const error = expectErr(
			runQuantityEngine(d('-1'), 'm2', { coverageRate: d('1') }, d('0')),
		);
		expect(error.category).toBe('Calculation');
		expect(error.code).toBe('quantity.negative');
	});

	it('propagates the zero-coverage failure from its stage', () => {
		const error = expectErr(
			runQuantityEngine(d('10'), 'm2', { coverageRate: d('0') }, d('0')),
		);
		expect(error.code).toBe('quantity.zero-coverage-rate');
	});

	it('propagates the negative-waste failure from its stage', () => {
		const error = expectErr(
			runQuantityEngine(d('10'), 'm2', { coverageRate: d('1') }, d('-1')),
		);
		expect(error.code).toBe('quantity.negative-waste');
	});

	it('propagates the invalid-packaging failure from its stage', () => {
		const error = expectErr(
			runQuantityEngine(d('10'), 'm2', { coverageRate: d('1') }, d('0'), {
				lotSize: d('0'),
			}),
		);
		expect(error.code).toBe('quantity.invalid-packaging');
	});
});
