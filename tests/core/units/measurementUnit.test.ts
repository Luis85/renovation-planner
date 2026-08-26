import { describe, expect, it } from 'vitest';
import { UNIT_KIND, type MeasurementUnit, type UnitKind } from '../../../src/core/units/MeasurementUnit';

describe('UNIT_KIND', () => {
	it('maps each measurement unit onto its dimension', () => {
		const expected: Readonly<Record<MeasurementUnit, UnitKind>> = {
			piece: 'piece',
			m: 'length',
			m2: 'area',
			m3: 'volume',
			hour: 'hour',
			day: 'day',
			fixed: 'fixed',
		};
		expect(UNIT_KIND).toEqual(expected);
	});

	it('has an entry for every measurement unit, so a new unit cannot skip the mapping', () => {
		const units: readonly MeasurementUnit[] = ['piece', 'm', 'm2', 'm3', 'hour', 'day', 'fixed'];
		for (const unit of units) {
			expect(UNIT_KIND[unit]).toBeDefined();
		}
	});
});
