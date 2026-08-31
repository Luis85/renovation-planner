import { z } from 'zod';
import { CalibrationSchemaV1 } from './planGeometry';

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

/**
 * The parsed document's shape, for the store and the adapter that raise it.
 *
 * Declared as the plan's own Task A3 code block specifies and as `planGeometry.ts`'s
 * `PlanGeometryDTO` already does — A3 shipped the schemas without it, so the two sidecar
 * DTO modules were asymmetric and neither the store nor the adapter could annotate what it
 * holds. Inferred rather than hand-written: a second spelling of a Zod schema's output is
 * a second answer to what is in the file.
 */
export type AssetGeometryDTO = z.infer<typeof AssetGeometrySchemaV1>;
