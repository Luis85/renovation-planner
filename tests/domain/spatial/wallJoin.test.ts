import { describe, expect, it } from 'vitest';
import { resolveWallJoin } from '../../../src/domain/spatial/wallJoin';
import { alongWall, wallLength, type Wall } from '../../../src/domain/spatial/Structure';

const north: Wall = { id: 'wall-north', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
const east: Wall = { id: 'wall-east', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, height: 2400, thickness: 150 };
// A semicircle (bulge 1), centre (2000, 0), radius 2000; which side it bends to is the bulge sign's business, so the cases read its midpoint rather than assume one.
const arc: Wall = { id: 'wall-arc', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, bulge: 1 };
const arcMid = alongWall(arc, wallLength(arc) / 2), inward = -Math.sign(arcMid.y);
const walls = [north, east];

describe('resolveWallJoin', () => {
	it('lands the nearest point on a wall body within tolerance, rounded to whole millimetres', () => {
		expect(resolveWallJoin({ walls, point: { x: 1234.4, y: 6 }, tolerance: 8 })).toEqual({ wallId: 'wall-north', offset: 1234, point: { x: 1234, y: 0 }, perpendicular: false });
	});
	it('answers null off every wall and null within tolerance of a wall end, which is an endpoint snap and not a cut', () => {
		expect(resolveWallJoin({ walls, point: { x: 1234, y: 9 }, tolerance: 8 })).toBeNull();
		expect(resolveWallJoin({ walls, point: { x: 3995, y: 2 }, tolerance: 8 })).toBeNull();
		expect(resolveWallJoin({ walls, point: { x: 4, y: 2 }, tolerance: 8 })).toBeNull();
	});
	it('prefers the foot of the perpendicular from the previous point when the cursor is near it', () => {
		const join = resolveWallJoin({ walls, point: { x: 1505, y: 3 }, tolerance: 8, from: { x: 1500, y: 1200 } });
		expect(join).toEqual({ wallId: 'wall-north', offset: 1500, point: { x: 1500, y: 0 }, perpendicular: true });
		// Too far from the foot: the nearest point wins, not perpendicular.
		expect(resolveWallJoin({ walls, point: { x: 1520, y: 3 }, tolerance: 8, from: { x: 1500, y: 1200 } })).toEqual({ wallId: 'wall-north', offset: 1520, point: { x: 1520, y: 0 }, perpendicular: false });
		// A foot within tolerance of an end is an endpoint, so the nearest point stands in for it.
		expect(resolveWallJoin({ walls, point: { x: 12, y: 3 }, tolerance: 8, from: { x: 5, y: 1200 } })).toEqual({ wallId: 'wall-north', offset: 12, point: { x: 12, y: 0 }, perpendicular: false });
	});
	it('picks the closest wall when two are in reach, and a perpendicular foot over a nearer plain point', () => {
		const corner = [north, { ...east, start: { x: 1000, y: 0 }, end: { x: 1000, y: 3000 }, id: 'wall-stem' }];
		expect(resolveWallJoin({ walls: corner, point: { x: 1002, y: 500 }, tolerance: 8 })?.wallId).toBe('wall-stem');
		expect(resolveWallJoin({ walls: corner, point: { x: 1005, y: 6 }, tolerance: 8, from: { x: 1003, y: 1200 } })).toMatchObject({ wallId: 'wall-north', perpendicular: true });
		// Neither corner case has two live candidates (the stem's point near the corner is an endpoint), so these do, in both wall orders.
		const near: Wall = { ...north, id: 'wall-near', start: { x: 0, y: 12 }, end: { x: 4000, y: 12 } };
		expect(resolveWallJoin({ walls: [north, near], point: { x: 500, y: 7 }, tolerance: 8 })?.wallId).toBe('wall-near');
		expect(resolveWallJoin({ walls: [north, near], point: { x: 500, y: 5 }, tolerance: 8 })?.wallId).toBe('wall-north');
		const cross: Wall = { ...east, id: 'wall-cross', start: { x: 1000, y: -1000 }, end: { x: 1000, y: 3000 } };
		for (const order of [[north, cross], [cross, north]]) {
			// The crossing wall's plain point (1000, 6) is 5 mm away; the foot (1003, 0) on the north wall is 6.3 mm away and still wins.
			expect(resolveWallJoin({ walls: order, point: { x: 1005, y: 6 }, tolerance: 8, from: { x: 1003, y: 1200 } })).toMatchObject({ wallId: 'wall-north', offset: 1003, perpendicular: true });
		}
	});
	it('projects radially onto a curved wall', () => {
		// 6 mm inside the arc's midpoint, on the radius: the nearest arc point is the midpoint, half way along.
		const join = resolveWallJoin({ walls: [arc], point: { x: arcMid.x, y: arcMid.y + inward * 6 }, tolerance: 8 });
		expect(join?.wallId).toBe('wall-arc');
		expect(join?.point.x).toBeCloseTo(arcMid.x, 0); expect(join?.point.y).toBeCloseTo(arcMid.y, 0);
		expect(join?.offset).toBe(Math.round(wallLength(arc) / 2));
	});
	it('intersects the Shift ray with the wall so the constrained angle stays exact', () => {
		// From (1500, 1200) straight up (the constrained point is on the ray, 5 mm short of the wall).
		const join = resolveWallJoin({ walls, point: { x: 1500, y: 5 }, tolerance: 8, from: { x: 1500, y: 1200 }, ray: { x: 1500, y: 5 } });
		expect(join).toEqual({ wallId: 'wall-north', offset: 1500, point: { x: 1500, y: 0 }, perpendicular: true });
		// A 45° ray from (1000, 1000) meets the north wall at (2000, 0): not perpendicular.
		const diagonal = resolveWallJoin({ walls, point: { x: 1996, y: 4 }, tolerance: 8, from: { x: 1000, y: 1000 }, ray: { x: 1996, y: 4 } });
		expect(diagonal).toEqual({ wallId: 'wall-north', offset: 2000, point: { x: 2000, y: 0 }, perpendicular: false });
		// The ray misses the wall by more than the tolerance: null, no fallback to the nearest point.
		expect(resolveWallJoin({ walls, point: { x: 1500, y: 20 }, tolerance: 8, from: { x: 1500, y: 1200 }, ray: { x: 1500, y: 20 } })).toBeNull();
		// A zero-length ray (cursor on the anchor) is no ray.
		expect(resolveWallJoin({ walls, point: { x: 1500, y: 1200 }, tolerance: 8, from: { x: 1500, y: 1200 }, ray: { x: 1500, y: 1200 } })).toBeNull();
	});
	it('intersects the Shift ray with a curved wall', () => {
		// A vertical ray from the centre's side, stopping 5 mm short of the arc's midpoint: radial, so perpendicular.
		const from = { x: arcMid.x, y: arcMid.y / 2 }, ray = { x: arcMid.x, y: arcMid.y + inward * 5 };
		const join = resolveWallJoin({ walls: [arc], point: ray, tolerance: 8, from, ray });
		expect(join?.point.y).toBeCloseTo(arcMid.y, 0); expect(join?.perpendicular).toBe(true);
		// A near-tangent ray crosses the arc twice within tolerance, at x = 1992 and 2008; the crossing nearer the cursor wins.
		const y = Math.sign(arcMid.y) * Math.sqrt(2000 ** 2 - 8 ** 2), grazing = { x: 2001, y };
		const tangent = resolveWallJoin({ walls: [arc], point: grazing, tolerance: 10, from: { x: 1000, y }, ray: grazing });
		expect(tangent?.point.x).toBeCloseTo(2008, 0); expect(tangent?.perpendicular).toBe(false);
	});
});
