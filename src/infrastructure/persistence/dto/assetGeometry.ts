import { z } from 'zod';
import { BULGE_MESSAGE, BulgeSchema, CalibrationSchemaV1, oneBulgePerEdge } from './planGeometry';

const pointTuple = z.tuple([z.number(), z.number()]);

/**
 * One asset's designed geometry, as it sits in the sidecar. The domain's `AssetShape`
 * (`domain/asset/AssetShape`) is what this becomes once the adapter has raised the
 * `[x, y]` tuples to `Point`s and run the shape through `validateAssetShape`; the two
 * are deliberately not the same type, because storage shape stops at this file.
 */
export const AssetShapeSchemaV1 = z.object({
	footprint: z.object({ points: z.array(pointTuple).min(3) }),
	footprintOrigin: z.enum(['typed', 'traced']),
	/**
	 * Whether these coordinates are still awaiting a scale — a fact recorded AT CAPTURE, not
	 * derived from whether a calibration happens to exist now. Deriving it would answer a
	 * question about the past out of live state, and would re-flag a genuinely measured
	 * outline the moment its background was replaced.
	 *
	 * One flag per coordinate group that can be captured on its own, matching the domain
	 * shape's three: there is no single `pendingScale`, because a traced footprint and a
	 * typed clearance are converted by different gestures at different times.
	 *
	 * `.default(false)` and NOT `.catch(false)`: a missing key is an older file and reads as
	 * measured, but a PRESENT invalid value (`"true"` from a hand edit) must fail the read
	 * rather than be coerced — coercing it silently suppresses the unscaled warning and
	 * presents placeholder-space geometry as millimetres, which is the one direction of this
	 * field that is unsafe. Refuse, do not repair. (`revision` below keeps `.catch(0)`
	 * because a bad counter costs a conflict, not a silent misreading.)
	 */
	footprintPending: z.boolean().default(false),
	clearancePending: z.boolean().default(false),
	anchorPending: z.boolean().default(false),
	clearance: z.object({ points: z.array(pointTuple).min(3) }).nullable(),
	anchor: z.object({ x: z.number(), y: z.number() }),
	facing: z.number(),
});

/**
 * One file per ASSET (ADR-0014), named by the asset's stable id with the registered
 * `rpgeo` extension — the plan sidecar's schema (`./planGeometry`) with `assetId` for
 * `planId` and one `shape` where a plan holds many `objects`, because an asset IS one
 * object.
 *
 * `calibration` is the ASSET's own and never a plan's: an asset is designed against its
 * own reference image, so the scale that image was measured at belongs to the object
 * rather than to any plan the object is later placed on. The schema is shared with the
 * plan sidecar rather than re-declared, so the two cannot drift apart.
 *
 * `shape` is nullable because the states are ordered — an asset may carry a background
 * and a calibration before anybody has drawn an outline on it.
 *
 * ADR-009 makes `unit` mandatory rather than merely recommended: world coordinates ARE
 * millimetres (`core/units`), so a sidecar missing this field, or carrying any other
 * value, fails validation and is never loaded rather than being silently reinterpreted.
 */
export const AssetGeometrySchemaV1 = z.object({
	schemaVersion: z.literal(1),
	assetId: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	unit: z.literal('mm'),
	calibration: CalibrationSchemaV1.nullable(),
	shape: AssetShapeSchemaV1.nullable(),
});

/** One closed outline: the plan sidecar's V7 bulge rule, reused rather than re-declared. */
const OutlineSchemaV2 = z
	.object({ points: z.array(pointTuple).min(3), bulges: z.array(BulgeSchema).optional() })
	.refine(oneBulgePerEdge, BULGE_MESSAGE);

const DetailSchemaV2 = z.object({
	id: z.string().min(1),
	name: z.string(),
	outline: OutlineSchemaV2,
	line: z.enum(['solid', 'dashed']),
	pending: z.boolean().default(false),
});

/**
 * Version 2 (asset designer symbols spec, Decision 6): outlines may curve and a shape carries
 * `details`. The bump is REQUIRED: a Zod object strips unknown keys, so a v1-only build reading a
 * file with details would load it and erase them on its next write; `z.literal(1)` makes that
 * build refuse the file instead.
 */
const AssetShapeSchemaV2 = AssetShapeSchemaV1.extend({
	footprint: OutlineSchemaV2,
	clearance: OutlineSchemaV2.nullable(),
	details: z.array(DetailSchemaV2).default([]),
});

const AssetGeometrySchemaV2 = AssetGeometrySchemaV1.extend({
	schemaVersion: z.literal(2),
	shape: AssetShapeSchemaV2.nullable(),
});

/** An OPEN graphic's geometry: two points or more, and one bulge per SEGMENT rather than per point. */
const PathSchemaV3 = z
	.object({ points: z.array(pointTuple).min(2), bulges: z.array(BulgeSchema).optional() })
	.refine((value) => value.bulges === undefined || value.bulges.length === value.points.length - 1, {
		message: 'An open path needs one curve value per segment.',
	});

/**
 * Version 3 (AD04): a graphic may be an open path, may carry the user's own label beside its stable
 * semantic name, and a shape may carry shallow groups of graphic ids.
 *
 * A DISCRIMINATED union on `kind` rather than one object with two optional geometries: the two arms
 * have different point minimums and different bulge arithmetic, and a single schema admitting both
 * would accept a two-point "closed" outline and a polygon-shaped bulge array on a path.
 *
 * `kind` defaults to `'closed'` because that is the only kind a v1 or v2 document could express —
 * absent means closed, which is what makes the migration additive. A `kind` that is PRESENT and
 * outside the union fails the read; so does a non-string `label` and a `groups` that is not an
 * array. Defaults are for ABSENT fields, never for malformed present ones — `footprintPending`'s
 * rule, generalised: refuse, do not repair.
 */
const ClosedDetailSchemaV3 = DetailSchemaV2.extend({ kind: z.literal('closed').default('closed'), label: z.string().optional() });
const OpenDetailSchemaV3 = DetailSchemaV2.omit({ outline: true }).extend({
	kind: z.literal('open'),
	label: z.string().optional(),
	outline: PathSchemaV3,
});
const DetailSchemaV3 = z.union([OpenDetailSchemaV3, ClosedDetailSchemaV3]);

/**
 * A group names graphic ids and carries no coordinates (C06). Membership is checked against the
 * shape's own details by `validateAssetShape` rather than here: a schema sees one document's text
 * and cannot know which ids survived geometry validation.
 */
const GroupSchemaV3 = z.object({ id: z.string().min(1), label: z.string().optional(), members: z.array(z.string().min(1)).min(1) });

const AssetShapeSchemaV3 = AssetShapeSchemaV2.extend({
	details: z.array(DetailSchemaV3).default([]),
	groups: z.array(GroupSchemaV3).default([]),
});

const AssetGeometrySchemaV3 = AssetGeometrySchemaV2.extend({
	schemaVersion: z.literal(3),
	shape: AssetShapeSchemaV3.nullable(),
});

/**
 * A v1 or v2 document is a valid v3 one once it says so: `details` defaults to `[]`, `bulges` is
 * optional, `kind` defaults to closed, `label` is optional and `groups` defaults to `[]`. Nothing
 * is rewritten and nothing is inferred — every added field has a default that means "this document
 * predates the field", which is the only kind of migration that cannot lose data.
 *
 * The bump is REQUIRED rather than tidy, for the reason v2's own note gives: a Zod object strips
 * unknown keys, so a v2-only build reading a v3 file would load it and erase every group and every
 * open graphic on its next write. `z.literal(2)` makes that build refuse the file instead.
 */
function raiseLegacyVersions(input: unknown): unknown {
	if (typeof input !== 'object' || input === null) return input;
	const version = (input as { schemaVersion?: unknown }).schemaVersion;
	return version === 1 || version === 2 ? { ...input, schemaVersion: 3 } : input;
}

/** Every version this build reads, answered as version 3. The store parses with this and nothing else. */
export const AssetGeometrySchema = z.preprocess(raiseLegacyVersions, AssetGeometrySchemaV3);

/**
 * The parsed document's shape, for the store and the adapter that raise it.
 *
 * Declared as the plan's own Task A3 code block specifies and as `planGeometry.ts`'s
 * `PlanGeometryDTO` already does — A3 shipped the schemas without it, so the two sidecar
 * DTO modules were asymmetric and neither the store nor the adapter could annotate what it
 * holds. Inferred rather than hand-written: a second spelling of a Zod schema's output is
 * a second answer to what is in the file.
 */
export type AssetGeometryDTO = z.infer<typeof AssetGeometrySchemaV3>;
