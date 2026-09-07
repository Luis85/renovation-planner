import { z } from 'zod';
import { RenovationSchema } from './renovation';
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
const PlanFrontmatterSchemaV2 = PlanFrontmatterSchemaV1.extend({
	'schema-version': z.literal(2),
	'reference-appearance': z.object({
		crop: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
		rotation: z.number().min(-180).max(180), opacity: z.number().min(0).max(1),
		visible: z.boolean(), locked: z.boolean(),
	}).optional(),
});
const PlanFrontmatterSchemaV3 = PlanFrontmatterSchemaV2.extend({
	'schema-version': z.literal(3), renovation: RenovationSchema.optional(),
});
export const PlanFrontmatterSchemaV4 = PlanFrontmatterSchemaV3.extend({ 'schema-version': z.literal(4) });
/** Shared contexts must be refused by v4 writers, which otherwise strip those links. */
export const PlanFrontmatterSchemaV5 = PlanFrontmatterSchemaV4.extend({ 'schema-version': z.literal(5) });
const SpatialElementMetadataSchema = z.array(z.object({ id: z.string().startsWith('element-'), name: z.string().min(1) }));
export const PlanFrontmatterSchemaV6 = PlanFrontmatterSchemaV5.extend({ 'schema-version': z.literal(6), 'spatial-elements': SpatialElementMetadataSchema.optional() });
export const PlanFrontmatterSchemaV7 = PlanFrontmatterSchemaV6.extend({ 'schema-version': z.literal(7) });
export const PlanFrontmatterSchema = z.union([PlanFrontmatterSchemaV1, PlanFrontmatterSchemaV2, PlanFrontmatterSchemaV3, PlanFrontmatterSchemaV4, PlanFrontmatterSchemaV5, PlanFrontmatterSchemaV6, PlanFrontmatterSchemaV7]);
export type PlanFrontmatterDTO = z.infer<typeof PlanFrontmatterSchemaV7>;
