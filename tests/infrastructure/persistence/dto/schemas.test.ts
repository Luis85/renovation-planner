import { describe, expect, it } from 'vitest';
import {
	CalibrationSchemaV1,
	PlanGeometrySchemaV1,
	SpatialObjectGeometrySchemaV1,
} from '../../../../src/infrastructure/persistence/dto/planGeometry';
import { PlanFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/planFrontmatter';
import { ProjectFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/projectFrontmatter';
import { ZoneFrontmatterSchemaV1 } from '../../../../src/infrastructure/persistence/dto/zoneFrontmatter';

/**
 * Schema validation fixtures (SDD §43): the valid shapes parse; every invalid shape is
 * REFUSED HERE, at the door — which is the only place a hand-edited file can be caught,
 * because nothing downstream ever sees raw frontmatter again.
 */

function parseProjectFrontmatterWith(status: string) {
	return ProjectFrontmatterSchemaV1.safeParse({
		type: 'renovation-project',
		'schema-version': 1,
		id: 'project-x',
		name: 'Riverside',
		status,
	});
}

describe('persisted schemas', () => {
	const zoneValid = {
		type: 'renovation-zone',
		'schema-version': 1,
		id: 'zone-01JABC7XG3QK9F8N2M4P6R5T0W',
		revision: 3,
		project: 'project-01JAB9Q2WE4RT6YU8IO0PA1SD2',
		plan: 'plan-01JABB3C5D7E9F1G3H5J7K9M1N',
		name: 'Bathroom',
		'zone-type': 'room',
		status: 'in-progress',
	};

	it('parses the zone shape and restores the domain vocabulary', () => {
		const parsed = ZoneFrontmatterSchemaV1.parse(zoneValid);
		expect(parsed['zone-type']).toBe('Room');
		expect(parsed.status).toBe('InProgress');
	});

	it('refuses a wrong discriminator, a bad status, and an unknown zone type', () => {
		for (const broken of [
			{ ...zoneValid, type: 'renovation-something' },
			{ ...zoneValid, status: 'done' },
			{ ...zoneValid, 'zone-type': 'cupboard' },
			{ ...zoneValid, 'schema-version': 2 },
			{ ...zoneValid, id: '' },
		]) {
			expect(ZoneFrontmatterSchemaV1.safeParse(broken).success).toBe(false);
		}
	});

	it('reads a missing revision as 0 rather than failing (hand-created or pre-field note)', () => {
		const { revision, ...withoutRevision } = zoneValid;
		void revision;
		expect(ZoneFrontmatterSchemaV1.parse(withoutRevision).revision).toBe(0);
	});

	it('maps every kebab-case project status back to its domain value', () => {
		expect(parseProjectFrontmatterWith('idea')).toMatchObject({ success: true, data: expect.objectContaining({ status: 'IDEA' }) });
		expect(parseProjectFrontmatterWith('as-built')).toMatchObject({ success: true, data: expect.objectContaining({ status: 'AS_BUILT' }) });
		expect(parseProjectFrontmatterWith('in-progress').success).toBe(false); // a zone value, not a project one
	});

	it('round-trips the plan background reference through three flat keys', () => {
		const parsed = PlanFrontmatterSchemaV1.parse({
			type: 'renovation-plan',
			'schema-version': 1,
			id: 'plan-x',
			project: 'project-x',
			name: 'Ground Floor',
			'background-path': 'attachments/ground-floor-plan.pdf',
			'background-kind': 'pdf',
			'background-page': 2,
			layers: ['Walls', 'Fixtures'],
		});
		expect(parsed['background-kind']).toBe('pdf');
		expect(parsed['background-page']).toBe(2);
		expect(parsed.layers).toEqual(['Walls', 'Fixtures']);
	});

	it('refuses an unsupported background kind', () => {
		expect(
			PlanFrontmatterSchemaV1.safeParse({
				type: 'renovation-plan',
				'schema-version': 1,
				id: 'plan-x',
				project: 'project-x',
				name: 'Ground Floor',
				'background-path': 'x.dwg',
				'background-kind': 'dwg',
				'background-page': null,
				layers: [],
			}).success,
		).toBe(false);
	});

	const geometryValid = {
		schemaVersion: 1,
		planId: 'plan-01JABB3C5D7E9F1G3H5J7K9M1N',
		revision: 1,
		unit: 'mm',
		calibration: null,
		objects: [{ id: 'zone-01JABC7XG3QK9F8N2M4P6R5T0W', type: 'polygon', points: [[0, 0], [2400, 0], [2400, 1800]] }],
	};

	it('parses the sidecar example shape', () => {
		const parsed = PlanGeometrySchemaV1.parse(geometryValid);
		expect(parsed.objects).toHaveLength(1);
		expect(SpatialObjectGeometrySchemaV1.safeParse(parsed.objects[0]).success).toBe(true);
	});

	it('accepts a nullable calibration and validates its positive scale', () => {
		const calibration = {
			pointA: { x: 0, y: 0 },
			pointB: { x: 100, y: 0 },
			knownDistance: 2000,
			pixelsPerWorldUnit: 20,
		};
		expect(CalibrationSchemaV1.safeParse(calibration).success).toBe(true);
		expect(CalibrationSchemaV1.safeParse({ ...calibration, knownDistance: -1 }).success).toBe(false);
		expect(CalibrationSchemaV1.safeParse({ ...calibration, pixelsPerWorldUnit: Number.NaN }).success).toBe(false);
	});

	// ADR-009: mandatory, not merely recommended — never silently interpreted as millimeters.
	it('refuses a sidecar whose unit is missing or not millimeters', () => {
		expect(PlanGeometrySchemaV1.safeParse(geometryValid).success).toBe(true);
		const { unit, ...withoutUnit } = geometryValid;
		void unit;
		expect(PlanGeometrySchemaV1.safeParse(withoutUnit).success).toBe(false);
		expect(PlanGeometrySchemaV1.safeParse({ ...geometryValid, unit: 'cm' }).success).toBe(false);
	});

	it('refuses malformed geometry points (null where a finite coordinate belongs)', () => {
		expect(
			PlanGeometrySchemaV1.safeParse({
				...geometryValid,
				objects: [{ id: 'zone-x', type: 'polygon', points: [[0, 0], [Number.NaN, 1]] }],
			}).success,
		).toBe(false);
	});
});
