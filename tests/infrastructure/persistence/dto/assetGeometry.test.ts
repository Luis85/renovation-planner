import { describe, expect, it } from 'vitest';
import {
	AssetGeometrySchema,
	AssetGeometrySchemaV1,
	AssetShapeSchemaV1,
} from '../../../../src/infrastructure/persistence/dto/assetGeometry';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import { validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import { isOk } from '../../../../src/core/result/Result';

/**
 * The asset geometry sidecar's schema is a TRUST BOUNDARY, exactly as the plan sidecar's
 * is: it is the only place a hand-edited `.rpgeo` can be caught, because nothing above it
 * ever sees the raw document again. Every case below is therefore a REFUSAL or a
 * round-trip, never a repair.
 */

const validShape = {
	footprint: {
		points: [
			[-600, -400],
			[600, -400],
			[600, 400],
			[-600, 400],
		],
	},
	footprintOrigin: 'typed',
	footprintPending: false,
	clearancePending: false,
	anchorPending: false,
	clearance: null,
	anchor: { x: 0, y: 0 },
	facing: 0,
};

const valid = {
	schemaVersion: 1,
	assetId: 'asset-01JABC',
	revision: 3,
	unit: 'mm',
	calibration: null,
	shape: validShape,
};

describe('AssetGeometrySchemaV1', () => {
	it('round-trips a typed rectangle', () => {
		expect(AssetGeometrySchemaV1.safeParse(valid).success).toBe(true);
	});

	it('refuses a unit that is not mm, rather than silently reinterpreting it (ADR-009)', () => {
		expect(AssetGeometrySchemaV1.safeParse({ ...valid, unit: 'cm' }).success).toBe(false);
	});

	it('refuses a provenance outside the union, so an unknown origin cannot be read as typed', () => {
		const bad = { ...valid, shape: { ...valid.shape, footprintOrigin: 'imported' } };
		expect(AssetGeometrySchemaV1.safeParse(bad).success).toBe(false);
	});

	it('keeps three decimals, which is what catches a YAML float coercion', () => {
		const precise = { ...valid, shape: { ...valid.shape, anchor: { x: 594.005, y: 0 } } };
		const parsed = AssetGeometrySchemaV1.safeParse(precise);
		expect(parsed.success && parsed.data.shape?.anchor.x).toBe(594.005);
	});

	it('reads a missing revision as 0 rather than failing, like every other schema here', () => {
		const { revision: _dropped, ...withoutRevision } = valid;
		const parsed = AssetGeometrySchemaV1.safeParse(withoutRevision);
		expect(parsed.success && parsed.data.revision).toBe(0);
	});

	it('accepts a null shape: an asset may have a background and a calibration before it has an outline', () => {
		expect(AssetGeometrySchemaV1.safeParse({ ...valid, shape: null }).success).toBe(true);
	});

	it("round-trips a calibration, which is the asset's own and never a plan's", () => {
		const calibrated = {
			...valid,
			calibration: {
				pointA: { x: 0, y: 0 },
				pointB: { x: 1200.005, y: 0 },
				knownDistance: 1200.005,
				pixelsPerWorldUnit: 2.5,
			},
		};
		const parsed = AssetGeometrySchemaV1.safeParse(calibrated);
		expect(parsed.success && parsed.data.calibration?.pointB.x).toBe(1200.005);
	});
});

/**
 * The sub-schema is asked its own rules directly, because that is where they live — and
 * because a document-level case cannot tell a rule the shape schema enforces from one the
 * outer object happens to enforce for it.
 */
describe('AssetShapeSchemaV1', () => {
	it('reads a missing pending flag as measured, so a pre-field sidecar still loads', () => {
		const { footprintPending: _dropped, ...withoutFlag } = validShape;
		const parsed = AssetShapeSchemaV1.safeParse(withoutFlag);
		expect(parsed.success && parsed.data.footprintPending).toBe(false);
	});

	it('refuses a present but invalid pending flag rather than coercing it to measured', () => {
		const handEdited = { ...validShape, footprintPending: 'true' };
		expect(AssetShapeSchemaV1.safeParse(handEdited).success).toBe(false);
	});

	it('carries three pending flags, one per group a gesture can capture on its own', () => {
		const traced = {
			...validShape,
			footprintOrigin: 'traced',
			footprintPending: true,
			anchorPending: true,
		};
		const parsed = AssetShapeSchemaV1.safeParse(traced);
		expect(parsed.success && [parsed.data.footprintPending, parsed.data.anchorPending]).toEqual([
			true,
			true,
		]);
	});
});

/**
 * The two halves of this task meet here: a document the SCHEMA accepts must be one the
 * DOMAIN validator accepts too, once its storage tuples are raised to `Point`s. They are
 * separate validators with separate rules — `validateAssetShape` refuses a typed footprint
 * marked pending, which no `z.object` can see — so "the fixture parses" is not evidence
 * that anything above the port could use it.
 */
describe('the schema and the port document', () => {
	it('accepts a shape the domain validator also accepts', () => {
		const parsed = AssetGeometrySchemaV1.parse(valid);
		const shape = parsed.shape;
		if (shape === null) throw new Error('the fixture declares a shape');
		const document: AssetGeometryDocument = {
			calibration: parsed.calibration,
			shape: {
				...shape,
				footprint: { points: shape.footprint.points.map(([x, y]) => ({ x, y })) },
				clearance: null,
				details: [],
			},
		};
		expect(document.shape !== null && isOk(validateAssetShape(document.shape))).toBe(true);
	});

	it('refuses a footprint with too few vertices, rather than admitting it for a later task to catch', () => {
		const corrupt = { ...valid, shape: { ...valid.shape, footprint: { points: [[0, 0], [10, 0]] } } };
		expect(AssetGeometrySchemaV1.safeParse(corrupt).success).toBe(false);
	});

	it('refuses a too-few-vertex CLEARANCE too, which is the arm a footprint-only rule would miss', () => {
		const corrupt = { ...valid, shape: { ...valid.shape, clearance: { points: [[0, 0], [10, 0]] } } };
		expect(AssetGeometrySchemaV1.safeParse(corrupt).success).toBe(false);
	});
});

describe('AssetGeometrySchema, which reads every version this build knows', () => {
	it('refuses a document that is not an object at all, rather than raising it', () => {
		expect(AssetGeometrySchema.safeParse(null).success).toBe(false);
	});

	it('raises a version 1 document to version 3, with no details and no groups', () => {
		const parsed = AssetGeometrySchema.parse(valid);
		expect(parsed.schemaVersion).toBe(3);
		expect(parsed.shape?.details).toEqual([]);
		expect(parsed.shape?.groups).toEqual([]);
	});

	/**
	 * The v2 half of the same migration (AD04 §5): every field version 3 adds defaults to what a
	 * document written before it meant — closed graphics, no label, no groups — so nothing is
	 * rewritten and nothing is inferred.
	 */
	it('raises a version 2 document to version 3, defaulting each graphic to closed', () => {
		const v2 = { ...valid, schemaVersion: 2, shape: { ...validShape, details: [{ id: 'detail-1', name: 'seat', outline: validShape.footprint, line: 'solid', pending: false }] } };
		const parsed = AssetGeometrySchema.parse(v2);
		expect(parsed.schemaVersion).toBe(3);
		expect(parsed.shape?.details[0]).toMatchObject({ kind: 'closed', name: 'seat' });
		expect(parsed.shape?.groups).toEqual([]);
	});

	/** An OPEN graphic: two points is enough, and its bulge array is one per SEGMENT. */
	it('reads an open graphic with two points and one bulge per segment', () => {
		const open = { id: 'detail-1', name: 'swing', kind: 'open', outline: { points: [[0, 0], [100, 0]], bulges: [0.5] }, line: 'dashed', pending: false };
		const parsed = AssetGeometrySchema.parse({ ...valid, schemaVersion: 3, shape: { ...validShape, details: [open] } });
		expect(parsed.shape?.details[0]).toMatchObject({ kind: 'open' });
	});

	it('refuses an open graphic carrying a closed shape-s bulge array, which would name an edge it has not got', () => {
		const open = { id: 'detail-1', name: 'swing', kind: 'open', outline: { points: [[0, 0], [100, 0]], bulges: [0.5, 0] }, line: 'solid', pending: false };
		expect(AssetGeometrySchema.safeParse({ ...valid, schemaVersion: 3, shape: { ...validShape, details: [open] } }).success).toBe(false);
	});

	it('refuses a CLOSED graphic with only two points, which an open one may have', () => {
		const thin = { id: 'detail-1', name: 'seat', kind: 'closed', outline: { points: [[0, 0], [100, 0]] }, line: 'solid', pending: false };
		expect(AssetGeometrySchema.safeParse({ ...valid, schemaVersion: 3, shape: { ...validShape, details: [thin] } }).success).toBe(false);
	});

	/** A default is for an ABSENT field; a present malformed one fails the read (footprintPending-s rule). */
	it('refuses a kind outside the union rather than defaulting it to closed', () => {
		const odd = { id: 'detail-1', name: 'seat', kind: 'spline', outline: validShape.footprint, line: 'solid', pending: false };
		expect(AssetGeometrySchema.safeParse({ ...valid, schemaVersion: 3, shape: { ...validShape, details: [odd] } }).success).toBe(false);
	});

	it('reads groups, and refuses one with no members', () => {
		const withGroup = { ...validShape, groups: [{ id: 'group-1', label: 'Tank', members: ['detail-1'] }] };
		expect(AssetGeometrySchema.parse({ ...valid, schemaVersion: 3, shape: withGroup }).shape?.groups).toEqual([{ id: 'group-1', label: 'Tank', members: ['detail-1'] }]);
		const empty = { ...validShape, groups: [{ id: 'group-1', members: [] }] };
		expect(AssetGeometrySchema.safeParse({ ...valid, schemaVersion: 3, shape: empty }).success).toBe(false);
	});

	it('is refused by a version-1-only schema, so an older build cannot drop details on its next write', () => {
		const v2 = { ...valid, schemaVersion: 2, shape: { ...validShape, details: [] } };
		expect(AssetGeometrySchemaV1.safeParse(v2).success).toBe(false);
	});

	it('refuses a bulge beyond a semicircle', () => {
		const curved = { ...valid, schemaVersion: 2, shape: { ...validShape, footprint: { ...validShape.footprint, bulges: [1.5, 0, 0, 0] }, details: [] } };
		expect(AssetGeometrySchema.safeParse(curved).success).toBe(false);
	});

	it('refuses a version this build does not know', () => {
		expect(AssetGeometrySchema.safeParse({ ...valid, schemaVersion: 4 }).success).toBe(false);
	});
});
