import { z } from 'zod';
import { UNIT_KIND, type MeasurementUnit } from '../../../core/units/MeasurementUnit';

export const REQUIREMENT_TYPE = 'renovation-requirement';

/** A plain-decimal string (ADR-010), or `null` for an absent figure/override. */
const DECIMAL_STRING = z.string().regex(/^-?(0|[1-9]\d*)(\.\d+)?$/);
const OPTIONAL_DECIMAL_STRING = DECIMAL_STRING.nullable();

/** The raw `MeasurementUnit` symbol — a vocabulary value, not a decimal. */
const UNIT_SYMBOL = z.string().refine(
	(value): value is MeasurementUnit => value in UNIT_KIND,
	'Unknown measurement unit',
);

/**
 * Schema version 1. Every decimal-valued field is a QUOTED STRING on disk; the mapper is
 * the only place the conversion happens. The three `calculated-from-*` fields persist
 * because they are what keeps a reading honest when `recalculation-status` itself could
 * not be written — and `calculated-from-asset-unit` is the one whose loss would be
 * invisible, so it gets its own round-trip assertion in the contract suite.
 */
export const RequirementFrontmatterSchemaV1 = z.object({
	type: z.literal(REQUIREMENT_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	project: z.string().min(1),
	asset: z.string().min(1),
	'origin-kind': z.literal('zone'),
	'origin-zone': z.string().min(1),

	unit: UNIT_SYMBOL,
	'waste-factor': DECIMAL_STRING,

	'quantity-calculated': DECIMAL_STRING,
	'quantity-override': OPTIONAL_DECIMAL_STRING,

	'cost-calculated': DECIMAL_STRING,
	'cost-override': OPTIONAL_DECIMAL_STRING,
	currency: z.string().regex(/^[A-Z]{3}$/),

	'calculated-from-area': DECIMAL_STRING,
	'calculated-from-unit-cost': DECIMAL_STRING,
	'calculated-from-asset-unit': UNIT_SYMBOL,

	'recalculation-status': z.enum(['current', 'stale']),
	'required-date': z.string().nullable().catch(null),
});
