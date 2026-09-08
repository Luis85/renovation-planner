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
	knownDistance: z.number().positive(),
	pixelsPerWorldUnit: z.number().positive(),
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

const SpatialPointSchema = z.object({ x: z.number(), y: z.number() });
const StructureSchema = z.object({
	walls: z.array(z.object({ id: z.string().startsWith('wall-'), start: SpatialPointSchema, end: SpatialPointSchema, height: z.number(), thickness: z.number() })),
	openings: z.array(z.object({ id: z.string().startsWith('opening-'), kind: z.enum(['door', 'window', 'opening']), hostId: z.string(), offset: z.number(), width: z.number(), height: z.number(), sill: z.number() })),
	boundaries: z.array(z.object({ roomId: z.string(), wallIds: z.array(z.string()) })),
});
const PlanGeometrySchemaV2 = PlanGeometrySchemaV1.extend({ schemaVersion: z.literal(2), structure: StructureSchema.optional() });
const PlanGeometrySchemaV3 = PlanGeometrySchemaV2.extend({ schemaVersion: z.literal(3), intended: StructureSchema.optional() });
const StructureSchemaV4 = StructureSchema.extend({ elements: z.array(z.object({
	id: z.string().startsWith('element-'), kind: z.enum(['object', 'path', 'fence', 'measurement']), points: z.array(SpatialPointSchema),
})).optional() });
export const PlanGeometrySchemaV4 = PlanGeometrySchemaV3.extend({ schemaVersion: z.literal(4), structure: StructureSchemaV4.optional(), intended: StructureSchemaV4.optional() });
const OpeningSwingSchema = z.object({ hinge: z.enum(['start', 'end']), side: z.enum(['left', 'right']), angle: z.number().min(0).max(180) });
const StructureSchemaV5 = StructureSchemaV4.extend({ openings: z.array(StructureSchema.shape.openings.element.extend({ swing: OpeningSwingSchema.optional() })) });
export const PlanGeometrySchemaV5 = PlanGeometrySchemaV4.extend({ schemaVersion: z.literal(5), structure: StructureSchemaV5.optional(), intended: StructureSchemaV5.optional() });
/** Any persisted version, for a reader that asks only what the file DECLARES (no migration). */
export const PlanGeometrySchemaV6 = PlanGeometrySchemaV5.extend({ schemaVersion: z.literal(6), groups: z.array(z.object({
	id: z.string().startsWith('group-'), name: z.string().trim().min(1).max(100), memberIds: z.array(z.string().min(1)).min(1),
})).optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV6>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 };
