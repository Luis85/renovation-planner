import { z } from 'zod';
import { PLAN_BACKGROUND_KINDS } from '../../../domain/plan/PlanBackgroundRef';

export const PLAN_TYPE = 'renovation-plan';

const backgroundKind = z
	.string()
	.transform((value, ctx) => {
		const parsed = PLAN_BACKGROUND_KINDS.find((kind) => kind === value);
		if (parsed === undefined) {
			ctx.addIssue({ code: 'custom', message: `"${value}" is not a background kind.` });
			return z.NEVER;
		}
		return parsed;
	});

/**
 * Plan frontmatter, schema version 1 (SDD §38). `background` is a REFERENCE, not a path:
 * three flat keys rather than one string, because a bare path would silently lose which
 * PDF page the Plan was calibrated against. `calibration` is deliberately absent — it
 * lives in the plan's geometry sidecar (slice 7's reasoning).
 */
export const PlanFrontmatterSchemaV1 = z.object({
	type: z.literal(PLAN_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	project: z.string().min(1),
	name: z.string(),
	'background-path': z.string(),
	'background-kind': backgroundKind,
	'background-page': z.number().int().positive().nullable().catch(null),
	layers: z.array(z.string()),

});

/** V2 prevents older builds silently dropping prepared-reference transforms on write. */
export const PlanFrontmatterSchemaV2 = PlanFrontmatterSchemaV1.extend({
	'schema-version': z.literal(2),
	'reference-appearance': z.object({
		crop: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
		rotation: z.number().min(-180).max(180), opacity: z.number().min(0).max(1),
		visible: z.boolean(), locked: z.boolean(),
	}).optional(),
});
export const PlanFrontmatterSchema = z.union([PlanFrontmatterSchemaV1, PlanFrontmatterSchemaV2]);
export type PlanFrontmatterDTO = z.infer<typeof PlanFrontmatterSchemaV2>;
