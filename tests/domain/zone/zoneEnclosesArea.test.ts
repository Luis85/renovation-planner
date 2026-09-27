import { describe, expect, it } from 'vitest';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { Zone, type CreateZoneProps } from '../../../src/domain/zone/Zone';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import type { CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { expectErr, expectOk } from '../../helpers/domain';
import { squareAt } from '../../helpers/entities';

/**
 * L-23, owner rulings 34 and 35: a Zone outline must enclose an area to be WRITTEN — created or
 * changed — while a zone already stored without one still LOADS, through its own entry.
 *
 * The predicate is `enclosesArea`, which refuses exactly a zero (or unrepresentable) shoelace
 * sum. So the duplicate-vertex and symmetric-bowtie cases below are pinned both ways on purpose:
 * this is the zero-area rule and not a simplicity rule (L-29's is `outlineCrosses`, at the tool).
 */
const base = (geometry: CurvedPolygon = squareAt()): CreateZoneProps => ({
	id: createZoneId(),
	planId: createPlanId(),
	projectId: createProjectId(),
	name: 'Sliver',
	zoneType: 'Room',
	geometry,
});

/** Three corners on one horizontal line: L-23's gesture leaves exactly this shape behind. */
const COLLINEAR: CurvedPolygon = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }] };
/** Two equal lobes: the signed sum is exactly zero, so this is refused as zero area. */
const EVEN_BOWTIE: CurvedPolygon = { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }] };
/** A repeated corner around a real surface: a duplicate is not a zero area. */
const REPEATED_CORNER: CurvedPolygon = { points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] };
const TRIANGLE: CurvedPolygon = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };

describe('creating a zone', () => {
	it.each([['a collinear outline', COLLINEAR], ['an even bowtie', EVEN_BOWTIE]])('refuses %s as enclosing no area', (_what, geometry) => {
		const error = expectErr(Zone.create(base(geometry)));
		expect(error.category).toBe('Geometry');
		expect(error.code).toBe('polygon-zero-area');
	});

	it('accepts a repeated corner around a real surface', () => {
		expect(expectOk(Zone.create(base(REPEATED_CORNER))).geometry.points).toHaveLength(4);
	});

	it('leaves a curved outline to the curve rules, which refuse an overlapping one under their own code', () => {
		expect(expectOk(Zone.create(base({ ...squareAt(), bulges: [0.25, 0, 0, 0] }))).geometry.bulges).toEqual([0.25, 0, 0, 0]);
		expect(expectErr(Zone.create(base({ ...COLLINEAR, bulges: [0.5, 0, 0] }))).code).toBe('curve-self-intersection');
	});

	it('still reports a name refusal first, so the order of the checks is unchanged', () => {
		expect(expectErr(Zone.create({ ...base(COLLINEAR), name: '' })).code).toBe('zone.empty-name');
	});
});

describe('changing a zone outline', () => {
	it('refuses an outline that encloses no area and keeps the zone as it was', () => {
		const zone = expectOk(Zone.create(base()));
		expect(expectErr(zone.withGeometry(COLLINEAR)).code).toBe('polygon-zero-area');
		expect(zone.geometry).toEqual(squareAt());
	});
});

describe('a zone stored without an area', () => {
	const stored = () => expectOk(Zone.fromStored(base(COLLINEAR)));

	it('loads through its own entry, with the outline exactly as stored', () => {
		expect(stored().geometry).toEqual(COLLINEAR);
	});

	it('still refuses what every stored zone refuses', () => {
		expect(expectErr(Zone.fromStored(base({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }))).code).toBe('polygon-too-few-points');
		expect(expectErr(Zone.fromStored({ ...base(COLLINEAR), name: '' })).code).toBe('zone.empty-name');
	});

	it('is fixed by an outline change that gives it an area', () => {
		expect(expectOk(stored().withGeometry(TRIANGLE)).geometry).toEqual(TRIANGLE);
	});

	it('refuses an outline change that keeps it without one, such as a translation', () => {
		const moved = { points: COLLINEAR.points.map(point => ({ x: point.x + 50, y: point.y + 50 })) };
		expect(expectErr(stored().withGeometry(moved)).code).toBe('polygon-zero-area');
	});

	/** Ruling 35: what does not touch the outline stays allowed, so the room can be found and deleted. */
	it('still takes a rename, a details change and a lock', () => {
		expect(expectOk(stored().withName('Found it')).name).toBe('Found it');
		expect(expectOk(stored().withDetails('Found it', 'Room')).name).toBe('Found it');
		expect(stored().withLocked(true).locked).toBe(true);
	});
});
