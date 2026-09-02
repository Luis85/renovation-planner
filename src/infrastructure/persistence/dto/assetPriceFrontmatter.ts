import { z } from 'zod';

export const ASSET_PRICE_TYPE = 'renovation-asset-price';

/**
 * Schema version 1. `ASSET_PRICE_MIGRATIONS` is empty and the version is DERIVED from the
 * registered steps, so this is version 1 for as long as no key moves, splits or changes
 * meaning. A key merely ARRIVING is a redefinition rather than a migration here, the same
 * call slice 19's Asset schema and the currency increment's Project schema both took — and
 * the cost of that habit is named in CLAUDE.md: the migration runner stays unproven on a real
 * chain, and the first change that CANNOT be a redefinition should be scheduled with that
 * proof in mind rather than discovered.
 *
 * `project` and `asset` are the pair. They are plain strings on disk and branded ids in the
 * domain; `assetPriceFromPersistence` asserts them, exactly as every other mapper here does.
 */
export const AssetPriceFrontmatterSchemaV1 = z.object({
	type: z.literal(ASSET_PRICE_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	project: z.string().min(1),
	asset: z.string().min(1),
	/** A decimal STRING (ADR-010) — a YAML float would reintroduce exactly what ADR-010 refuses. */
	'unit-cost': z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/),
	currency: z.string().regex(/^[A-Z]{3}$/),
});
