import { describe, expect, it } from 'vitest';
import { UNIT_KIND, type MeasurementUnit, type UnitKind } from '../../../src/core/units/MeasurementUnit';

describe('UNIT_KIND', () => {
	/**
	 * Finding C12: the second case this file used to carry ("has an entry for every
	 * measurement unit") asserted only its OWN hand-typed fixture against itself — the
	 * totality it claimed to check is actually held by `UNIT_KIND`'s own
	 * `Readonly<Record<MeasurementUnit, UnitKind>>` annotation at the source, which fails
	 * `npm run build` the moment a unit is added to `MeasurementUnit` and left out of the
	 * map. That is the instrument; this case is the content.
	 */
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
});
