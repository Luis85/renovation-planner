import { z } from 'zod';
import { PROJECT_STATUSES } from '../../../domain/project/ProjectStatus';
import { kebabEnum } from './kebab';

/**
 * Project frontmatter, schema version 1 (SDD §38). Shape-of-storage: this type never
 * leaves the Obsidian repository implementations (§37) — the mapper lifts it into the
 * domain entity at one end and lowers it back here at the other.
 *
 * `revision` is declared so a disk round-trip survives it (Zod strips undeclared keys):
 * slice 3's conditional-write contract has no value to present back without it. A note
 * written before the field existed — or hand-created — reads as 0 and takes the insert
 * path; the value is only ever compared for equality, never ordered on.
 */
export const PROJECT_TYPE = 'renovation-project';

export const ProjectFrontmatterSchemaV1 = z.object({
	type: z.literal(PROJECT_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	name: z.string(),
	status: kebabEnum(PROJECT_STATUSES),
});

export type ProjectFrontmatterDTO = z.infer<typeof ProjectFrontmatterSchemaV1>;
