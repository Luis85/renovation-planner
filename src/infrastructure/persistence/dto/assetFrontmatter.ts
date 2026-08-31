import { z } from 'zod';
import { kebabEnum } from './kebab';
import { ASSET_CATEGORIES } from '../../../domain/asset/AssetCategory';
import { UNIT_KIND, type MeasurementUnit } from '../../../core/units/MeasurementUnit';

export const ASSET_TYPE = 'renovation-asset';

/**
 * Schema version 1 — the PRD §36 example plus `revision` per the conditional-write
 * contract. Still version 1 after design slice 19 dropped `project`: the version is
 * DERIVED from the registered migration steps, `ASSET_MIGRATIONS` is empty, and no
 * release of this plugin exists (verified against the remote: no tags, no releases), so
 * no vault anywhere holds an Asset note this build has to migrate. A note carrying a
 * leftover `project` key still parses — the schema is not strict — and the write path
 * retires the key on that note's next save.
 */
export const AssetFrontmatterSchemaV1 = z.object({
	type: z.literal(ASSET_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
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
	/**
	 * Millimetres, as a plain YAML number — NOT an ADR-010 decimal string, because a height
	 * is not money: nothing multiplies it, nothing sums it, and the exactness ADR-010 buys
	 * has nothing here to protect. A quoted string would cost a reader with no plugin the
	 * one thing this key exists for.
	 *
	 * Additive, so NO SCHEMA VERSION BUMP IS OWED and none is taken: `.catch(null)` reads an
	 * absent key and a garbage value alike as "this asset says nothing about how tall it is",
	 * which is what a note written before this key existed means. Beyond that the schema
	 * stops — `z.number()` types the field and refuses a non-finite one, and only
	 * `Asset.create` can see that `-10` is not a height.
	 */
	height: z.number().nullable().catch(null),
});
