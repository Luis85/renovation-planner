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

/**
 * A real calendar date, not merely a date-SHAPED string.
 *
 * The finite check runs first and is load-bearing: `toISOString()` on an `Invalid Date`
 * throws a `RangeError`, so a predicate that round-tripped first would fault on exactly the
 * input it exists to reject. The round trip then catches the quiet half — `2026-02-30`
 * parses happily and comes back as `2026-03-02`, so a value that fails to equal itself is
 * one the calendar renamed.
 */
function isRealCalendarDate(value: string): boolean {
	const parsed = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * A stored date-only value, or absent. `.catch(null)` runs LAST and catches the refinement
 * as well as the regex, so every rejected spelling — wrong shape, impossible date, renamed
 * date — reads as absent rather than as a parse failure that would refuse the whole note.
 */
const DATE_ONLY = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine(isRealCalendarDate)
	.nullable()
	.catch(null);

export const ProjectFrontmatterSchemaV1 = z.object({
	type: z.literal(PROJECT_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	name: z.string(),
	status: kebabEnum(PROJECT_STATUSES),
	description: z.string().nullable().catch(null),
	start: DATE_ONLY,
	'target-completion': DATE_ONLY,
});

export type ProjectFrontmatterDTO = z.infer<typeof ProjectFrontmatterSchemaV1>;
