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
