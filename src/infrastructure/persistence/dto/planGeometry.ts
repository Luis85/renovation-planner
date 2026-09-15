import { z } from 'zod';
import { ITEM_COLORS, itemColorKind } from '../../../domain/spatial/ItemColor';

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
const PlanGeometrySchemaV5 = PlanGeometrySchemaV4.extend({ schemaVersion: z.literal(5), structure: StructureSchemaV5.optional(), intended: StructureSchemaV5.optional() });
/** Any persisted version, for a reader that asks only what the file DECLARES (no migration). */
const PlanGeometrySchemaV6 = PlanGeometrySchemaV5.extend({ schemaVersion: z.literal(6), groups: z.array(z.object({
	id: z.string().startsWith('group-'), name: z.string().trim().min(1).max(100), memberIds: z.array(z.string().min(1)).min(1),
})).optional() });
export const BulgeSchema = z.number().min(-1).max(1);
const SpatialObjectShapeV7 = SpatialObjectGeometrySchemaV1.extend({ bulges: z.array(BulgeSchema).optional() });
export const oneBulgePerEdge = (value: { readonly points: readonly unknown[]; readonly bulges?: readonly number[] }) => value.bulges === undefined || value.bulges.length === value.points.length;
export const BULGE_MESSAGE = { message: 'A closed boundary needs one bulge per edge.' };
const SpatialObjectGeometrySchemaV7 = SpatialObjectShapeV7.refine(oneBulgePerEdge, BULGE_MESSAGE);
const StructureSchemaV7 = StructureSchemaV5.extend({ walls: z.array(StructureSchema.shape.walls.element.extend({ bulge: BulgeSchema.optional() })) });
const PlanGeometrySchemaV7 = PlanGeometrySchemaV6.extend({ schemaVersion: z.literal(7), objects: z.array(SpatialObjectGeometrySchemaV7), structure: StructureSchemaV7.optional(), intended: StructureSchemaV7.optional() });
const StairOptionsSchema = z.object({ width: z.number().min(1).max(1e6), treads: z.number().int().min(1).max(200), direction: z.enum(['up', 'down']) });
const StructureSchemaV8 = StructureSchemaV7.extend({ elements: z.array(z.object({
	id: z.string().startsWith('element-'), kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow']),
	points: z.array(SpatialPointSchema), stair: StairOptionsSchema.optional(),
}).refine(element => element.kind === 'stair' ? element.stair !== undefined : element.stair === undefined)).optional() });
const PlanGeometrySchemaV8 = PlanGeometrySchemaV7.extend({ schemaVersion: z.literal(8), structure: StructureSchemaV8.optional(), intended: StructureSchemaV8.optional() });
const SpatialElementShapeV9 = z.object({
	id: z.string().startsWith('element-'), kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset']),
	points: z.array(SpatialPointSchema), stair: StairOptionsSchema.optional(), assetId: z.string().min(1).optional(),
});
const stairRule = (element: { readonly kind: string; readonly stair?: unknown }) => element.kind === 'stair' ? element.stair !== undefined : element.stair === undefined;
const assetRule = (element: { readonly kind: string; readonly assetId?: string }) => (element.kind === 'asset') === (element.assetId !== undefined);
const ASSET_MESSAGE = { message: 'An asset placement, and only an asset placement, names its asset.' };
const SpatialElementSchemaV9 = SpatialElementShapeV9.refine(stairRule).refine(assetRule, ASSET_MESSAGE);
const StructureSchemaV9 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV9).optional() });
const PlanGeometrySchemaV9 = PlanGeometrySchemaV8.extend({ schemaVersion: z.literal(9), structure: StructureSchemaV9.optional(), intended: StructureSchemaV9.optional() });
/** Schema 10: a dragged canvas caption, as a world-millimetre offset from its automatic anchor (ADR-0029). */
const LabelOffsetSchema = z.object({ dx: z.number(), dy: z.number() });
export const SpatialObjectGeometrySchemaV10 = SpatialObjectShapeV7.extend({ labelOffset: LabelOffsetSchema.optional() }).refine(oneBulgePerEdge, BULGE_MESSAGE);
export type SpatialObjectGeometryDTO = z.infer<typeof SpatialObjectGeometrySchemaV10>;
const SpatialElementSchemaV10 = SpatialElementShapeV9.extend({ labelOffset: LabelOffsetSchema.optional() }).refine(stairRule).refine(assetRule, ASSET_MESSAGE);
const StructureSchemaV10 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV10).optional() });
const PlanGeometrySchemaV10 = PlanGeometrySchemaV9.extend({ schemaVersion: z.literal(10), objects: z.array(SpatialObjectGeometrySchemaV10), structure: StructureSchemaV10.optional(), intended: StructureSchemaV10.optional() });
/** Schema 11: structural posts and beams (structural posts and beams design §4). */
const SpatialElementShapeV11 = SpatialElementShapeV9.extend({
	kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam']),
	labelOffset: LabelOffsetSchema.optional(), width: z.number().positive().max(1e6).optional(), loadBearing: z.boolean().optional(),
});
const structuralRule = (element: { readonly kind: string; readonly width?: number; readonly loadBearing?: boolean }) => (element.kind === 'beam') === (element.width !== undefined)
	&& (element.kind === 'post' || element.kind === 'beam') === (element.loadBearing !== undefined);
const STRUCTURAL_MESSAGE = { message: 'A beam, and only a beam, has a width; a post or a beam, and only those, says whether it is load-bearing.' };
const SpatialElementSchemaV11 = SpatialElementShapeV11.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE);
const StructureSchemaV11 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV11).optional() });
const PlanGeometrySchemaV11 = PlanGeometrySchemaV10.extend({ schemaVersion: z.literal(11), structure: StructureSchemaV11.optional(), intended: StructureSchemaV11.optional() });
/** Schema 12: drafting marks — dimension chains, section and view markers, hatches, text, boundary lines, grid points (plan drafting tools design §4). */
const SpatialElementShapeV12 = SpatialElementShapeV11.extend({
	kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam', 'dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid']),
	offset: z.number().min(-1e6).max(1e6).optional(), flipped: z.boolean().optional(),
});
const draftingRule = (element: { readonly kind: string; readonly offset?: number; readonly flipped?: boolean }) => (element.kind === 'dimension') === (element.offset !== undefined)
	&& (element.kind === 'section') === (element.flipped !== undefined);
const DRAFTING_MESSAGE = { message: 'A dimension chain, and only a dimension chain, has an offset; a section line, and only a section line, says which way it looks.' };
const SpatialElementSchemaV12 = SpatialElementShapeV12.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE).refine(draftingRule, DRAFTING_MESSAGE);
const StructureSchemaV12 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV12).optional() });
export const PlanGeometrySchemaV12 = PlanGeometrySchemaV11.extend({ schemaVersion: z.literal(12), structure: StructureSchemaV12.optional(), intended: StructureSchemaV12.optional() });
/** Schema 13 owns both directed face distances. Optional at the type seam for legacy command inputs; mandatory on the wire at v13. */
const WallSidesSchema = z.object({ a: z.number().min(0).max(1e6), b: z.number().min(0).max(1e6) });
const WallSchemaV13 = StructureSchemaV7.shape.walls.element.extend({ sideExtents: WallSidesSchema.optional() })
	.refine(wall => wall.sideExtents !== undefined, { message: 'A schema-13 wall needs both face extents.' });
const StructureSchemaV13 = StructureSchemaV12.extend({ walls: z.array(WallSchemaV13) });
export const PlanGeometrySchemaV13 = PlanGeometrySchemaV12.extend({ schemaVersion: z.literal(13), structure: StructureSchemaV13.optional(), intended: StructureSchemaV13.optional() });
/** Schema 14 adds placement colors without letting schema-13 readers silently strip them. */
const SpatialElementSchemaV14 = SpatialElementShapeV12.extend({ color: z.enum(ITEM_COLORS).optional() })
	.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE).refine(draftingRule, DRAFTING_MESSAGE)
	.refine(element => element.color === undefined || itemColorKind(element.kind), { message: 'Only an item or asset placement can carry a color.' });
const StructureSchemaV14 = StructureSchemaV13.extend({ elements: z.array(SpatialElementSchemaV14).optional() });
export const PlanGeometrySchemaV14 = PlanGeometrySchemaV13.extend({ schemaVersion: z.literal(14), structure: StructureSchemaV14.optional(), intended: StructureSchemaV14.optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9, PlanGeometrySchemaV10, PlanGeometrySchemaV11, PlanGeometrySchemaV12, PlanGeometrySchemaV13, PlanGeometrySchemaV14]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV14>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 };
