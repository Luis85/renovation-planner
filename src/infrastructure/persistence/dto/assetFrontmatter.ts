import { z } from 'zod';
import { kebabEnum } from './kebab';
import { ASSET_CATEGORIES } from '../../../domain/asset/AssetCategory';
import { UNIT_KIND, type MeasurementUnit } from '../../../core/units/MeasurementUnit';

export const ASSET_TYPE = 'renovation-asset';

/** Schema version 1 — the PRD §36 example plus `revision` per the conditional-write contract. */
export const AssetFrontmatterSchemaV1 = z.object({
	type: z.literal(ASSET_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	project: z.string().min(1),
	name: z.string(),
	category: kebabEnum(ASSET_CATEGORIES),
	supplier: z.string().nullable().catch(null),
	sku: z.string().nullable().catch(null),
	/** A decimal STRING (ADR-010) — a YAML float would reintroduce exactly what ADR-010 refuses. */
	'unit-cost': z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/),
	currency: z.string().regex(/^[A-Z]{3}$/),
	unit: z.string().refine(
		(value): value is MeasurementUnit => value in UNIT_KIND,
		'Unknown measurement unit',
	),
	'waste-factor-default': z
		.string()
		.regex(/^(0|[1-9]\d*)(\.\d+)?$/)
		.nullable()
		.catch(null),
	notes: z.string().nullable().catch(null),
});
