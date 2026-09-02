import { describe, expect, it } from 'vitest';
import {
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
