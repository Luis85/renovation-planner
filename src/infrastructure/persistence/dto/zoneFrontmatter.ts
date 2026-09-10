import { z } from 'zod';
import { kebabEnum } from './kebab';
import { ZONE_STATUSES } from '../../../domain/zone/ZoneStatus';
import { ZONE_TYPES } from '../../../domain/zone/ZoneType';

export const ZONE_TYPE = 'renovation-zone';

/**
 * Zone frontmatter, schema version 1 — the SDD §38 example, with `revision` added per
 * the conditional-write contract. The note carries identity and metadata; geometry lives
 * in the plan's sidecar, keyed by this note's `id`.
 */
export const ZoneFrontmatterSchemaV1 = z.object({
	type: z.literal(ZONE_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	project: z.string().min(1),
	plan: z.string().min(1),
	name: z.string(),
	'zone-type': kebabEnum(ZONE_TYPES),
	status: kebabEnum(ZONE_STATUSES),
});

/**
 * Schema version 2 (ADR-0027): a locked zone. Written ONLY while `locked` is true, so an older
 * build — which parses V1 alone — refuses a locked note instead of saving the lock away, and
 * unlocking returns the note to V1. `locked` is optional because the discriminator migration
 * lifts every V1 note to 2 in memory without inventing the key.
 */
export const ZoneFrontmatterSchemaV2 = ZoneFrontmatterSchemaV1.extend({
	'schema-version': z.literal(2),
	locked: z.boolean().optional(),
});

export const ZoneFrontmatterSchema = z.union([ZoneFrontmatterSchemaV1, ZoneFrontmatterSchemaV2]);
