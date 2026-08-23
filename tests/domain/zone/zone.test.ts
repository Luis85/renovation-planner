import { describe, expect, it } from 'vitest';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { Zone } from '../../../src/domain/zone/Zone';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { expectErr, expectOk } from '../../helpers/domain';
import { squareAt } from '../../helpers/entities';

const base = () => ({
	id: createZoneId(),
	planId: createPlanId(),
	projectId: createProjectId(),
	name: 'Living room',
	zoneType: 'Room' as const,
	geometry: squareAt(),
});

describe('Zone.create', () => {
	it('constructs with defaults and keeps the denormalized projectId', () => {
		const props = base();
		const zone = expectOk(Zone.create({ ...props, name: ' Living room ' }));
		expect(zone.name).toBe('Living room');
		expect(zone.status).toBe('Planned');
		expect(zone.domainNoteLink).toBeNull();
		expect(zone.projectId).toBe(props.projectId);
	});

	it('keeps an optional domain note link — navigation only, never identity', () => {
		const zone = expectOk(
			Zone.create({ ...base(), domainNoteLink: '[[Zones/Living room]]' }),
		);
		expect(zone.domainNoteLink).toBe('[[Zones/Living room]]');
	});

	it('rejects an empty name', () => {
		const error = expectErr(Zone.create({ ...base(), name: '' }));
		expect(error.code).toBe('zone.empty-name');
	});

	it('rejects a zone type outside the vocabulary', () => {
		const error = expectErr(Zone.create({ ...base(), zoneType: 'Balcony' as never }));
		expect(error.code).toBe('zone.unknown-type');
	});

	it('rejects a status outside the vocabulary', () => {
		const error = expectErr(Zone.create({ ...base(), status: 'Archived' as never }));
		expect(error.code).toBe('zone.unknown-status');
	});

	it('rejects a geometry with fewer than three vertices', () => {
		const error = expectErr(
			Zone.create({ ...base(), geometry: { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] } }),
		);
		expect(error.code).toBe('polygon-too-few-points');
		expect(error.category).toBe('Geometry');
	});

	it('rejects a geometry with non-finite coordinates', () => {
		const error = expectErr(
			Zone.create({
				...base(),
				geometry: {
					points: [
						{ x: 0, y: 0 },
						{ x: Number.POSITIVE_INFINITY, y: 0 },
						{ x: 1, y: 1 },
					],
				},
			}),
		);
		expect(error.code).toBe('polygon-non-finite-coordinate');
	});
});

describe('Zone.withGeometry', () => {
	it('replaces the geometry on a new instance', () => {
		const zone = expectOk(Zone.create(base()));
		const moved = expectOk(zone.withGeometry(squareAt(500, 500)));
		expect(moved.geometry).toEqual(squareAt(500, 500));
		expect(moved.id).toBe(zone.id);
		expect(zone.geometry).not.toEqual(moved.geometry);
	});

	it('re-validates the replacement', () => {
		const zone = expectOk(Zone.create(base()));
		const error = expectErr(zone.withGeometry({ points: [] }));
		expect(error.code).toBe('polygon-too-few-points');
	});
});

describe('derived measures', () => {
	it('area returns mm² and perimeter mm, computed on demand', () => {
		const zone = expectOk(Zone.create(base()));
		expect(expectOk(zone.area())).toBe(100); // 10mm × 10mm
		expect(expectOk(zone.perimeter())).toBe(40);
	});

	it('answers in error shape for a geometry that can no longer occur', () => {
		// A stored Zone always came through validation; this drives the delegate's own
		// error shape rather than unwrapping a Zone-only guarantee.
		const zone = expectOk(Zone.create(base()));
		const broken = Object.create(zone) as Zone;
		Object.defineProperty(broken, 'geometry', {
			value: {
				points: [
					{ x: 0, y: 0 },
					{ x: Number.NaN, y: 0 },
					{ x: 1, y: 1 },
				],
			},
		});
		expect(expectErr(broken.area()).code).toBe('polygon-non-finite-coordinate');
		expect(expectErr(broken.perimeter()).code).toBe('polygon-non-finite-coordinate');
	});
});
