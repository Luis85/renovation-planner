import { z } from 'zod';

/**
 * The plan geometry sidecar (SDD §40, ADR-011), schema version 1. One file per plan,
 * named by the plan's stable ID with the registered `rpgeo` extension.
 *
 * `calibration` is declared here as a nullable v1 field rather than added by slice 7:
 * a Zod object strips unknown keys, so a field "added additively" without touching this
 * schema would be silently discarded on every read. Slice 7 fills it in; this slice only
 * round-trips whatever value it is given and computes nothing.
 *
 * `revision` is the WHOLE FILE's counter — one sidecar write rewrites the whole document,
 * so a per-object version would claim a granularity the write does not have. Named the
 * same as the notes' field so both share one `EntityVersion`. `.catch(0)` for the same
 * reason as on every note-backed schema: a hand-created or pre-field file reads as 0
 * rather than failing validation.
 */
export const SpatialObjectGeometrySchemaV1 = z.object({
	id: z.string().min(1),
	type: z.literal('polygon'),
	points: z.array(z.tuple([z.number(), z.number()])),
});

export type SpatialObjectGeometryDTO = z.infer<typeof SpatialObjectGeometrySchemaV1>;

/** Declared now so the sidecar has one schema, versioned once; slice 7 writes it. */
export const CalibrationSchemaV1 = z.object({
	pointA: z.object({ x: z.number(), y: z.number() }),
	pointB: z.object({ x: z.number(), y: z.number() }),
	knownDistance: z.number().finite().positive(),
	pixelsPerWorldUnit: z.number().finite().positive(),
});

/**
 * ADR-009 makes the unit mandatory, not merely recommended: world coordinates ARE
 * millimeters (`core/units`), so a sidecar missing this field, or carrying any other
 * value, fails validation and is never loaded rather than being silently interpreted.
 */
export const PlanGeometrySchemaV1 = z.object({
	schemaVersion: z.literal(1),
	planId: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	unit: z.literal('mm'),
	calibration: CalibrationSchemaV1.nullable(),
	objects: z.array(SpatialObjectGeometrySchemaV1),
});

export type PlanGeometryDTO = z.infer<typeof PlanGeometrySchemaV1>;
