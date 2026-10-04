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
 * The predicate is `isNegligibleArea` over `area` (ruling 36): zero, or below a millionth of the
 * outline's bounding box, is no area, and an unrepresentable one is refused as an overflow. So the
 * duplicate-vertex and symmetric-bowtie cases below are pinned both ways on purpose:
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

/** A `width` by `depth` rectangle at the origin, turned by `degrees`. */
function rectangle(width: number, depth: number, degrees: number): CurvedPolygon {
	const [c, s] = [Math.cos(degrees * Math.PI / 180), Math.sin(degrees * Math.PI / 180)];
	return { points: [[0, 0], [width, 0], [width, depth], [0, depth]].map(([x, y]) => ({ x: x * c - y * s, y: x * s + y * c })) };
}

/**
 * A corner `offset` mm off the diagonal of a 10 m square: 5000 × `offset` mm² inside a 1e8 mm²
 * box, so 0.002 mm is a ratio of 1e-7, a tenth of the ruling's millionth, and 0.024 mm is 1.2e-6,
 * just above it. Both sides have to hold, or a threshold lowered towards zero or a ratio missing
 * its width would still pass.
 */
function offDiagonal(offset: number): CurvedPolygon {
	return { points: [{ x: 0, y: 0 }, { x: 10_000, y: 10_000 }, { x: 5000, y: 5000 + offset }] };
}

/**
 * Owner ruling 36: an outline whose area is negligible beside its axis-aligned bounding box —
 * below a millionth of it — is refused as enclosing none. The review's case is the slanted edge:
 * a corner projected onto a non-axis-aligned line lands at an unrounded float, so the "collinear"
 * triangle keeps a residue of about 1e-10 mm² that an exact-zero test reads as a real area.
 */
describe('an outline whose area is negligible beside its size', () => {
	/** The review's neighbour edge (4594,3606)–(7436,2164), and a corner a fifth of the way along it, as the float the projection gives. */
	const SLANTED_SLIVER: CurvedPolygon = { points: [{ x: 4594, y: 3606 }, { x: 7436, y: 2164 }, { x: 5162.4, y: 3317.6 }] };

	it('refuses the slanted sliver on create and on an outline change', () => {
		expect(expectErr(Zone.create(base(SLANTED_SLIVER))).code).toBe('polygon-zero-area');
		expect(expectErr(expectOk(Zone.create(base())).withGeometry(SLANTED_SLIVER)).code).toBe('polygon-zero-area');
	});

	it.each([
		['10 mm by 10 m, axis-aligned', rectangle(10, 10_000, 0)],
		['10 mm by 10 m, rotated 45 degrees', rectangle(10, 10_000, 45)],
		// Its area is about 2.0e-4 of its bounding box: two hundred times the ruling's threshold.
		['1 mm by 10 m, rotated 45 degrees', rectangle(1, 10_000, 45)],
	])('accepts a genuinely thin room, %s', (_what, geometry) => {
		expect(expectOk(Zone.create(base(geometry))).geometry.points).toHaveLength(4);
	});

	/** Collinear corners and a closing semicircle: a flat corner box around a real area, which the arc alone encloses. */
	it('still accepts a curved outline whose corners are collinear', () => {
		const halfDisc: CurvedPolygon = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], bulges: [0, 0, 1] };
		expect(expectOk(Zone.create(base(halfDisc))).geometry.bulges).toEqual([0, 0, 1]);
	});

	/** The ratio is divided out rather than multiplied up: this box overflows a double while its area, about half of it, does not. */
	it('accepts a real area whose bounding box is not representable', () => {
		const vast: CurvedPolygon = { points: [{ x: -6.75e153, y: -6.75e153 }, { x: 6.75e153, y: -4.05e153 }, { x: -4.05e153, y: 6.75e153 }] };
		expect(expectOk(Zone.create(base(vast))).geometry.points).toHaveLength(3);
	});

	/** The threshold pinned from BELOW as well as above: see `offDiagonal`. */
	it('refuses an outline at a tenth of the threshold, over a 10 m box', () => {
		expect(expectErr(Zone.create(base(offDiagonal(0.002)))).code).toBe('polygon-zero-area');
	});

	it('accepts an outline just above the threshold, over the same box', () => {
		expect(expectOk(Zone.create(base(offDiagonal(0.024)))).geometry.points).toHaveLength(3);
	});

	/**
	 * m1: the box's WIDTH is what overflows here, not its area — 2e308 across and 1e-308 high, an
	 * area of about 1 inside a box of about 2 (`boundsMidpoint`'s own spanning triangle). Taking the
	 * extents as `max - min` read the width as Infinity and the area as negligible.
	 */
	it('accepts a real area whose bounding box is wider than a double', () => {
		const spanning: CurvedPolygon = { points: [{ x: -1e308, y: 0 }, { x: 1e308, y: 1e-308 }, { x: 1e308, y: 0 }] };
		expect(expectOk(Zone.create(base(spanning))).geometry.points).toHaveLength(3);
	});

	/** M2: finite corners whose area overflows are refused under the code that says so, not as zero area. */
	it('refuses an unrepresentable area as an overflow', () => {
		const huge: CurvedPolygon = { points: [{ x: 0, y: 0 }, { x: 1e308, y: 0 }, { x: 0, y: 1e308 }] };
		expect(expectErr(Zone.create(base(huge))).code).toBe('polygon-area-overflow');
	});
});
