import type { Decimal } from 'decimal.js';

/**
 * The two unit vocabularies of the cost engine (SDD §48), deliberately distinct.
 *
 * `UnitKind` is the DIMENSION — what kind of thing is being counted, §48's seven
 * entries verbatim. `MeasurementUnit` is the concrete SYMBOL a quantity is expressed
 * and priced in, and what an Asset persists (slice 10). Keeping both is what lets a
 * rule be stated as "an area-kind asset" (`UNIT_KIND[unit] === 'area'`) rather than
 * hard-coding `"m2"` — a check that would silently stop working the day a second area
 * unit (`ft2`) is added.
 *
 * Not renovation-specific: this is Core Layer vocabulary (§7.1).
 */
export type UnitKind = 'piece' | 'length' | 'area' | 'volume' | 'hour' | 'day' | 'fixed';

export type MeasurementUnit = 'piece' | 'm' | 'm2' | 'm3' | 'hour' | 'day' | 'fixed';

export const UNIT_KIND: Readonly<Record<MeasurementUnit, UnitKind>> = {
	piece: 'piece',
	m: 'length',
	m2: 'area',
	m3: 'volume',
	hour: 'hour',
	day: 'day',
	fixed: 'fixed',
};

/**
 * A count of something in one measurement unit. The value is exact decimal arithmetic
 * (ADR-010) — never a native number. Raw geometric measurements enter the engine in
 * world millimeters (ADR-009); conversion to display/pricing units happens once, at the
 * engine's first stage (`toMeasuredQuantity`).
 */
export interface Quantity {
	readonly value: Decimal;
	readonly unit: MeasurementUnit;
}
